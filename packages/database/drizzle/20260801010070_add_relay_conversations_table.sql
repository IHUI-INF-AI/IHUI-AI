-- 中转站用户对话会话历史(2026-08-01 立,B 端协作场景)
-- 用途:中转站用户通过 API Key 调用时附带 conversation_id 保存对话历史,
--       区别于平台 chat 表(C 端用户聊天)。一个 conversation_id 对应一个会话。

-- 中转站用户对话会话表(一个 conversation_id 对应一个会话)
CREATE TABLE IF NOT EXISTS relay_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id VARCHAR(100) NOT NULL UNIQUE, -- 用户传入的 conversation_id(或自动生成)
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  api_key_id UUID NOT NULL REFERENCES developer_api_keys(id) ON DELETE CASCADE,
  title VARCHAR(200), -- 会话标题(取首条消息前 50 字符)
  model VARCHAR(100), -- 最后使用的模型
  message_count INTEGER DEFAULT 0,
  total_tokens BIGINT DEFAULT 0,
  total_cost_cents INTEGER DEFAULT 0,
  last_message_at TIMESTAMPTZ DEFAULT now(),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_relay_conversations_user ON relay_conversations(user_id, last_message_at DESC);
CREATE INDEX idx_relay_conversations_api_key ON relay_conversations(api_key_id);
CREATE INDEX idx_relay_conversations_user_updated ON relay_conversations(user_id, updated_at DESC);

-- 中转站用户对话消息表(每条 message 一行)
CREATE TABLE IF NOT EXISTS relay_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES relay_conversations(id) ON DELETE CASCADE,
  log_id UUID REFERENCES llm_call_logs(id) ON DELETE SET NULL, -- 关联调用日志
  role VARCHAR(20) NOT NULL, -- user/assistant/system
  content TEXT NOT NULL,
  model VARCHAR(100),
  prompt_tokens INTEGER DEFAULT 0,
  completion_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  cost_cents INTEGER DEFAULT 0,
  latency_ms INTEGER,
  status VARCHAR(20) DEFAULT 'success', -- success/error
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_relay_messages_conversation ON relay_messages(conversation_id, created_at);
CREATE INDEX idx_relay_messages_log ON relay_messages(log_id);
