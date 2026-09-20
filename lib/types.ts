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
  color: string;
}

export interface Message {
  id: string;
  platformId: PlatformId;
  timestamp: string;
  from: string;
  body: string;
  subject?: string;
  threadKey?: string;
}

export type Category = 'bill' | 'subscription' | 'shopping' | 'travel' | 'other';

export interface Insight {
  messageId: string;
  category: Category;
  amount?: number;
  currency?: string;
  vendor?: string;
  dueDate?: string;
  isRecurring?: boolean;
  confidence: number;
  summary: string;
  entities: Array<{ type: string; value: string }>;
  parserVersion?: number;
}

export interface AppState {
  messages: Message[];
  insights: Record<string, Insight>;
}

export interface RankedMessage {
  message: Message;
  score: number;
  insight?: Insight;
}
