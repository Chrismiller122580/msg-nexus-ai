export type PlatformId =
  | 'whatsapp'
  | 'email'
  | 'slack'
  | 'sms'
  | 'telegram'
  | 'x'
  | 'discord'
  | 'imessage';

export interface Platform {
  id: PlatformId;
  name: string;
  color: string; // e.g. 'bg-green-500' or hex for inline
}

export interface Message {
  id: string;
  platformId: PlatformId;
  timestamp: string; // ISO string
  from: string;
  body: string;
  subject?: string;
}

export type Category = 'bill' | 'subscription' | 'shopping' | 'other';

export interface Insight {
  messageId: string;
  category: Category;
  amount?: number;
  currency?: string;
  vendor?: string;
  dueDate?: string; // human display or ISO-ish
  isRecurring?: boolean;
  confidence: number; // 0-1
  summary: string;
  entities: Array<{ type: string; value: string }>;
}

export interface AppState {
  messages: Message[];
  insights: Record<string, Insight>; // key = messageId
}

export interface RankedMessage {
  message: Message;
  score: number;
  insight?: Insight;
}
