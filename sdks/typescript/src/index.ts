// IHUI-AI TypeScript SDK(骨架,后续真发布时填实现)
// OpenAI 兼容:POST /api/chat/completions + GET /api/models

export interface ChatCompletionRequest {
  model: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

export interface ChatCompletionResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: { role: string; content: string };
    finish_reason: string;
  }>;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

export interface ModelInfo {
  id: string;
  object: 'model';
  created: number;
  owned_by: string;
}

export interface ModelsListResponse {
  object: 'list';
  data: ModelInfo[];
}

export class IhuiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown,
  ) {
    super(`IHUI API 错误 [${status}]: ${message}`);
    this.name = 'IhuiError';
  }
}

export class IhuiClient {
  /** 内部封装 fetch,统一加 Authorization header + JSON 处理 + 错误抛出 */
  constructor(
    private apiBase: string,
    private apiKey: string,
  ) {}

  /** 统一请求封装:4xx/5xx 抛 IhuiError */
  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const url = `${this.apiBase.replace(/\/$/, '')}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
      ...(init.headers as Record<string, string> | undefined),
    };
    const resp = await fetch(url, { ...init, headers });
    const text = await resp.text();
    let body: unknown;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    if (!resp.ok) {
      throw new IhuiError(resp.status, typeof body === 'string' ? body : JSON.stringify(body), body);
    }
    return body as T;
  }

  /** Chat Completions 资源(OpenAI 兼容) */
  readonly chat = {
    completions: {
      /** POST /api/chat/completions — 创建对话补全 */
      create: (body: ChatCompletionRequest) =>
        this.request<ChatCompletionResponse>('/api/chat/completions', {
          method: 'POST',
          body: JSON.stringify(body),
        }),
    },
  };

  /** Models 资源 */
  readonly models = {
    /** GET /api/models — 模型列表 */
    list: () => this.request<ModelsListResponse>('/api/models', { method: 'GET' }),
  };
}

export default IhuiClient;
