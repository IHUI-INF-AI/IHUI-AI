export type SessionStatus = 'running' | 'completed' | 'failed' | 'cancelled';

export interface SessionMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp?: string;
  toolCallId?: string;
  toolName?: string;
}

export interface SessionState {
  id: string;
  sessionId: string;
  createdAt: string;
  updatedAt: string;
  model?: string;
  messages: SessionMessage[];
  toolState?: Record<string, unknown>;
  cwd?: string;
  status: SessionStatus;
  error?: string;
}

export interface SessionSummary {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: SessionStatus;
}
