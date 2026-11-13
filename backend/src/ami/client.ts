import { EventEmitter } from 'node:events';
import net from 'node:net';
import { HttpError } from '../errors';

// Minimal client for the Asterisk Manager Interface (AMI), a plain text protocol:
// "Key: Value" lines, a message ends with an empty line.

export class AmiUnavailableError extends HttpError {
  constructor() {
    super(503, 'Asterisk is not reachable');
  }
}

export class AmiError extends HttpError {
  constructor(message: string) {
    super(502, message);
  }
}

export type AmiFields = Record<string, string>;

export interface AmiResult {
  response: AmiFields;
  // for list actions (CoreShowChannels, PJSIPShowEndpoints...): one entry per item
  events: AmiFields[];
}

export interface AmiOptions {
  host: string;
  port: number;
  username: string;
  secret: string;
}

interface Pending {
  resolve: (result: AmiResult) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
  response?: AmiFields;
  events: AmiFields[];
}

const MAX_RETRY_DELAY = 30_000;

function parseBlock(block: string): AmiFields {
  const fields: AmiFields = {};
  for (const line of block.split('\r\n')) {
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const key = line.slice(0, colon);
    const value = line.slice(colon + 1).trimStart();
    // a key can repeat (the "Output" lines of a CLI command), the values are joined
    fields[key] = key in fields ? `${fields[key]}\n${value}` : value;
  }
  return fields;
}

export class AmiClient extends EventEmitter {
  private socket: net.Socket | null = null;
  private buffer = '';
  private bannerSeen = false;
  private ready = false;
  private stopped = true;
  private nextId = 1;
  private pending = new Map<string, Pending>();
  private retryDelay = 1000;
  private retryTimer?: NodeJS.Timeout;
  private lastError = '';

  constructor(private options: AmiOptions) {
    super();
  }

  // keeps the connection alive: reconnects by itself when asterisk restarts
  start() {
    this.stopped = false;
    this.connect();
  }

  stop() {
    this.stopped = true;
    clearTimeout(this.retryTimer);
    this.socket?.destroy();
  }

  isReady() {
    return this.ready;
  }

  async action(fields: Record<string, string | number>, timeoutMs = 5000): Promise<AmiResult> {
    if (!this.ready) {
      throw new AmiUnavailableError();
    }
    return this.request(fields, timeoutMs);
  }

  private connect() {
    const socket = net.createConnection({ host: this.options.host, port: this.options.port });
    this.socket = socket;
    this.buffer = '';
    this.bannerSeen = false;
    this.ready = false;

    socket.setEncoding('utf8');
    socket.setKeepAlive(true, 15_000);
    socket.on('data', (chunk: string) => this.onData(chunk));
    socket.on('error', (err) => {
      this.lastError = err.message;
    });
    socket.on('close', () => this.onClose(socket));
  }

  private onData(chunk: string) {
    this.buffer += chunk;

    // the first line is a banner: "Asterisk Call Manager/9.0.0"
    if (!this.bannerSeen) {
      const end = this.buffer.indexOf('\r\n');
      if (end === -1) return;
      this.buffer = this.buffer.slice(end + 2);
      this.bannerSeen = true;
      void this.login();
    }

    let end: number;
    while ((end = this.buffer.indexOf('\r\n\r\n')) !== -1) {
      const block = this.buffer.slice(0, end);
      this.buffer = this.buffer.slice(end + 4);
      this.handleBlock(parseBlock(block));
    }
  }

  private async login() {
    try {
      await this.request({ Action: 'Login', Username: this.options.username, Secret: this.options.secret }, 5000);
      this.ready = true;
      this.retryDelay = 1000;
      this.lastError = '';
      console.log('ami: connected to asterisk');
      this.emit('ready');
    } catch (err) {
      console.error('ami: login failed:', err instanceof Error ? err.message : err);
      this.socket?.destroy();
    }
  }

  private handleBlock(fields: AmiFields) {
    const pending = fields.ActionID ? this.pending.get(fields.ActionID) : undefined;

    if (fields.Response !== undefined) {
      if (!pending) return;
      if (fields.Response === 'Error' || fields.Response === 'Failure') {
        this.settle(fields.ActionID, () => pending.reject(new AmiError(fields.Message ?? 'Asterisk refused the action')));
      } else if (fields.EventList === 'start') {
        pending.response = fields;
      } else {
        this.settle(fields.ActionID, () => pending.resolve({ response: fields, events: [] }));
      }
      return;
    }

    if (fields.Event === undefined) return;

    if (pending && pending.response) {
      if (fields.EventList === 'Complete') {
        this.settle(fields.ActionID, () => pending.resolve({ response: pending.response!, events: pending.events }));
      } else {
        pending.events.push(fields);
      }
      return;
    }

    this.emit('event', fields);
  }

  private settle(id: string, finish: () => void) {
    const pending = this.pending.get(id);
    if (!pending) return;
    clearTimeout(pending.timer);
    this.pending.delete(id);
    finish();
  }

  private request(fields: Record<string, string | number>, timeoutMs: number): Promise<AmiResult> {
    return new Promise((resolve, reject) => {
      if (!this.socket || this.socket.destroyed) {
        reject(new AmiUnavailableError());
        return;
      }

      const id = `api-${this.nextId++}`;
      let message = `ActionID: ${id}\r\n`;
      for (const [key, rawValue] of Object.entries(fields)) {
        const value = String(rawValue);
        // a line break inside a value would let the caller inject extra AMI lines
        if (!/^[A-Za-z0-9_-]+$/.test(key) || /[\r\n]/.test(value)) {
          reject(new Error('Invalid AMI field'));
          return;
        }
        message += `${key}: ${value}\r\n`;
      }

      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new HttpError(504, 'Asterisk did not answer in time'));
      }, timeoutMs);

      this.pending.set(id, { resolve, reject, timer, events: [] });
      this.socket.write(`${message}\r\n`);
    });
  }

  private onClose(socket: net.Socket) {
    if (socket !== this.socket) return;

    const wasReady = this.ready;
    this.ready = false;

    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(new AmiUnavailableError());
      this.pending.delete(id);
    }

    if (wasReady) {
      console.error('ami: connection to asterisk lost');
    } else if (this.lastError) {
      console.error(`ami: cannot connect (${this.lastError}), retrying`);
      this.lastError = '';
    }

    if (this.stopped) return;
    this.retryTimer = setTimeout(() => this.connect(), this.retryDelay);
    this.retryDelay = Math.min(this.retryDelay * 2, MAX_RETRY_DELAY);
  }
}