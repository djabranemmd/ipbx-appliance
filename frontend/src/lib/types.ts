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