import { ami } from './ami';
import { AmiError } from './ami/client';
import { HttpError } from './errors';

export type EndpointState = 'unavailable' | 'idle' | 'busy' | 'ringing' | 'unknown';

export interface LiveEndpoint {
  registered: boolean;
  state: EndpointState;
  contacts: string[];
  activeChannels: number;
}

function mapDeviceState(deviceState: string): EndpointState {
  switch (deviceState) {
    case 'Unavailable':
      return 'unavailable';
    case 'Not in use':
      return 'idle';
    case 'In use':
    case 'Busy':
    case 'On Hold':
    case 'Ring, In Use':
      return 'busy';
    case 'Ringing':
      return 'ringing';
    default:
      return 'unknown';
  }
}

// "HH:MM:SS" as given by asterisk
function toSeconds(duration: string): number {
  const [h = 0, m = 0, s = 0] = duration.split(':').map(Number);
  return h * 3600 + m * 60 + s;
}

// asterisk writes "<unknown>" when it has no value
function clean(value: string | undefined): string | null {
  return !value || value === '<unknown>' ? null : value;
}

export async function getStatus() {
  const [settings, uptime, core] = await Promise.all([
    ami.action({ Action: 'CoreSettings' }),
    ami.action({ Action: 'Command', Command: 'core show uptime seconds' }),
    ami.action({ Action: 'CoreStatus' }),
  ]);

  const output = uptime.response.Output ?? '';
  const uptimeSeconds = Number(/System uptime:\s*(\d+)/.exec(output)?.[1] ?? 0);
  const lastReloadSeconds = Number(/Last reload:\s*(\d+)/.exec(output)?.[1] ?? 0);

  return {
    version: settings.response.AsteriskVersion,
    realtime: settings.response.CoreRealTimeEnabled === 'Yes',
    uptimeSeconds,
    lastReloadSeconds,
    // asterisk counts channels here, a call between two phones uses two of them
    activeChannels: Number(core.response.CoreCurrentCalls ?? 0),
  };
}

// live state of every pjsip endpoint, keyed by extension number
export async function getLiveEndpoints(): Promise<Map<string, LiveEndpoint>> {
  const result = await ami.action({ Action: 'PJSIPShowEndpoints' });
  const endpoints = new Map<string, LiveEndpoint>();

  for (const event of result.events) {
    if (event.Event !== 'EndpointList') continue;
    const contacts = (event.Contacts ?? '').split(',').filter(Boolean);
    endpoints.set(event.ObjectName, {
      registered: contacts.length > 0,
      state: mapDeviceState(event.DeviceState ?? ''),
      contacts,
      activeChannels: (event.ActiveChannels ?? '').split(',').filter(Boolean).length,
    });
  }

  return endpoints;
}

export async function getChannels() {
  const result = await ami.action({ Action: 'CoreShowChannels' });

  const channels = result.events
    .filter((event) => event.Event === 'CoreShowChannel')
    .map((event) => ({
      channel: event.Channel,
      state: event.ChannelStateDesc,
      callerNumber: clean(event.CallerIDNum),
      callerName: clean(event.CallerIDName),
      connectedNumber: clean(event.ConnectedLineNum),
      connectedName: clean(event.ConnectedLineName),
      application: clean(event.Application),
      exten: clean(event.Exten),
      context: clean(event.Context),
      durationSeconds: toSeconds(event.Duration ?? ''),
      bridgeId: clean(event.BridgeId),
      linkedId: event.Linkedid,
    }));

  // all the legs of one call share the same linked id
  const byCall = new Map<string, typeof channels>();
  for (const channel of channels) {
    byCall.set(channel.linkedId, [...(byCall.get(channel.linkedId) ?? []), channel]);
  }

  const calls = [...byCall.entries()].map(([id, legs]) => ({
    id,
    durationSeconds: Math.max(...legs.map((leg) => leg.durationSeconds)),
    parties: [
      ...new Set(legs.flatMap((leg) => [leg.callerNumber, leg.connectedNumber]).filter((n): n is string => n !== null)),
    ],
    channels: legs.map((leg) => leg.channel),
  }));

  return { channels, calls };
}

export async function hangupChannel(channel: string) {
  try {
    await ami.action({ Action: 'Hangup', Channel: channel });
  } catch (err) {
    if (err instanceof AmiError && err.message === 'No such channel') {
      throw new HttpError(404, 'Channel not found');
    }
    throw err;
  }
}

const RELOAD_COMMANDS = {
  dialplan: 'dialplan reload',
  pjsip: 'module reload res_pjsip.so',
} as const;

export type ReloadTarget = keyof typeof RELOAD_COMMANDS;

export async function reloadAsterisk(target: ReloadTarget): Promise<string> {
  const result = await ami.action({ Action: 'Command', Command: RELOAD_COMMANDS[target] }, 15_000);
  return result.response.Output ?? '';
}