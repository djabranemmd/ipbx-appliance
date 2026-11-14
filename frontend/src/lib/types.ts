export type Role = 'admin' | 'operator' | 'viewer';

export interface Admin {
  id: number;
  username: string;
  fullName: string;
  role: Role;
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  admin: Admin;
}

export type EndpointState = 'unavailable' | 'idle' | 'busy' | 'ringing' | 'unknown';

export interface LiveEndpoint {
  registered: boolean;
  state: EndpointState;
  contacts: string[];
  activeChannels: number;
}

export interface SummaryExtension {
  id: number;
  number: string;
  displayName: string;
  enabled: boolean;
  user: { id: number; firstName: string; lastName: string } | null;
  live: LiveEndpoint;
}

export interface PbxSummary {
  counters: {
    extensions: number;
    registered: number;
    busy: number;
    ringing: number;
    activeCalls: number;
  };
  extensions: SummaryExtension[];
}

export interface PbxStatus {
  version: string;
  realtime: boolean;
  uptimeSeconds: number;
  lastReloadSeconds: number;
  activeChannels: number;
}

export interface Call {
  id: string;
  durationSeconds: number;
  parties: string[];
  channels: string[];
}

export interface PbxChannels {
  calls: Call[];
}

export type CallPermission = 'internal' | 'external';

export interface ExtensionItem {
  id: number;
  number: string;
  displayName: string;
  enabled: boolean;
  callPermission: CallPermission;
  user: { id: number; firstName: string; lastName: string } | null;
  forwarding: {
    always: string | null;
    busy: string | null;
    noAnswer: string | null;
    ringTimeout: number;
  };
  registration: {
    registered: boolean;
    contactUri: string | null;
    userAgent: string | null;
    expiresAt: string | null;
  };
}

export interface UserItem {
  id: number;
  firstName: string;
  lastName: string;
  email: string | null;
  createdAt: string;
  extensionId: number | null;
  extensionNumber: string | null;
}

export interface RangeItem {
  id: number;
  name: string;
  rangeStart: number;
  rangeEnd: number;
  extensionCount: number;
}

// what a phone needs to register on the pbx
export interface PhoneCredentials {
  username: string;
  password: string;
  server: string | null;
  port: number;
  transport: string;
}

export interface RangeRef {
  id: number;
  name: string;
  rangeStart: number;
  rangeEnd: number;
}

// the extensions of the "from" range cannot call the extensions of the "to" range
export interface RestrictionItem {
  id: number;
  from: RangeRef;
  to: RangeRef;
}