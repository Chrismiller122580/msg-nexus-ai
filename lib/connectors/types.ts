import type { PlatformId } from '@/lib/types';

export interface FetchedMessage {
  externalId: string;
  platformId: PlatformId;
  from: string;
  body: string;
  subject?: string;
  timestamp: string;
}

export interface SyncResult {
  imported: number;
  error?: string;
}

export interface ConnectorStatus {
  id: string;
  name: string;
  configured: boolean;
  connected: boolean;
  identifier?: string;
  lastSyncedAt?: string;
}

export interface Connector {
  id: string;
  name: string;
  platformId: PlatformId;
  isConfigured(): boolean;
  getStatus(userId: number): Promise<ConnectorStatus>;
  sync(userId: number, limit?: number): Promise<SyncResult>;
}