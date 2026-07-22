/**
 * 四层记忆工具 — 让 Agent 具备记忆检索/保存/梦境固化/遗忘能力。
 *
 * 对标 OpenClaw Mem 系统,通过 HTTP 调用 ai-service /api/memory/* 端点:
 * - memory_recall:语义检索记忆(semantic 层 cosine similarity)
 * - memory_save:保存新记忆到 working/episodic/semantic/procedural 层
 * - memory_dream:触发梦境固化(consolidate,LLM 提取跨会话模式)
 * - memory_forget:查看/触发遗忘曲线衰减
 *
 * 策略:
 *   - 通过 cli config 的 apiUrl(默认 http://localhost:8000)调用 ai-service
 *   - 网络失败优雅降级(返回 errorType='network',不阻塞主流程)
 *   - dangerLevel='read'(记忆操作无破坏性,dream/forget 也是幂等衰减)
 */

import { loadConfig } from '../config/index.js';
import { registerTools, type Tool, type ToolResult } from './index.js';

const MEMORY_TIMEOUT_MS = 15_000;

interface MemoryApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

/** 获取 ai-service base URL(从 cli config apiUrl,默认 http://localhost:8000) */
function getBaseUrl(): string {
  const config = loadConfig();
  return config.apiUrl || 'http://localhost:8000';
}

/** 调用 ai-service /api/memory/* 端点(GET) */
async function memoryGet<T>(
  path: string,
  params: Record<string, string>,
): Promise<T> {
  const base = getBaseUrl();
  const url = new URL(path, base);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MEMORY_TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }
    const json = (await res.json()) as MemoryApiResponse<T>;
    if (json.code !== 0) {
      throw new Error(json.message || `code=${json.code}`);
    }
    return json.data;
  } finally {
    clearTimeout(timer);
  }
}

/** 调用 ai-service /api/memory/* 端点(POST/DELETE with optional body) */
async function memorySend<T>(
  method: 'POST' | 'DELETE',
  path: string,
  body: Record<string, unknown> | null,
  params: Record<string, string> = {},
): Promise<T> {
  const base = getBaseUrl();
  const url = new URL(path, base);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MEMORY_TIMEOUT_MS);
  try {
    const init: RequestInit = {
      method,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
    };
    if (body) {
      init.body = JSON.stringify(body);
    }
    const res = await fetch(url.toString(), init);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }
    const json = (await res.json()) as MemoryApiResponse<T>;
    if (json.code !== 0) {
      throw new Error(json.message || `code=${json.code}`);
    }
    return json.data;
  } finally {
    clearTimeout(timer);
  }
}

function memoryErrorResult(err: unknown): ToolResult {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('aborted') || msg.toLowerCase().includes('timeout')) {
    return {
      success: false,
      output: '',
      error: `记忆服务请求超时(${MEMORY_TIMEOUT_MS / 1000}s)`,
      errorType: 'timeout',
    };
  }
  if (
    msg.includes('ECONNREFUSED') ||
    msg.includes('fetch failed') ||
    msg.includes('ENOTFOUND') ||
    msg.toLowerCase().includes('network')
  ) {
    return {
      success: false,
      output: '',
      error: `无法连接记忆服务(ai-service):${msg}`,
      errorType: 'network',
    };
  }
  return { success: false, output: '', error: msg };
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

const memory_recall: Tool = {
  name: 'memory_recall',
  description:
    '语义检索记忆:用 query 在 semantic 层做 cosine similarity 检索,返回 top_k 相关记忆条目。适合回忆用户偏好、历史决策、知识点。',
  dangerLevel: 'read',
  parameters: {
    user_id: { type: 'string', description: '用户 ID(UUID)' },
    query: { type: 'string', description: '语义检索查询文本' },
    top_k: {
      type: 'number',
      description: '返回最相关的 N 条(默认 5,上限 50)',
    },
  },
  required: ['user_id', 'query'],
  async execute(args): Promise<ToolResult> {
    const userId = String(args.user_id ?? '').trim();
    const query = String(args.query ?? '').trim();
    if (!userId || !query) {
      return { success: false, output: '', error: '缺少 user_id 或 query 参数' };
    }
    const topK = typeof args.top_k === 'number' ? args.top_k : 5;
    try {
      const results = await memoryGet<unknown[]>('/api/memory/recall', {
        user_id: userId,
        query,
        top_k: String(topK),
      });
      if (!Array.isArray(results) || results.length === 0) {
        return {
          success: true,
          output: `语义检索: ${query}\n无相关记忆条目`,
        };
      }
      const lines = [
        `语义检索: ${query}`,
        `找到 ${results.length} 条相关记忆 (top ${topK}):`,
        '',
      ];
      for (let i = 0; i < results.length; i++) {
        const r = results[i] as Record<string, unknown>;
        const entry = (r.entry ?? r) as Record<string, unknown>;
        const score = typeof r.score === 'number' ? r.score.toFixed(4) : 'N/A';
        const content = String(entry.content ?? '').slice(0, 300);
        lines.push(`### ${i + 1}. [score=${score}] ${content}`);
        if (entry.summary) lines.push(`摘要: ${entry.summary}`);
        lines.push('');
      }
      return { success: true, output: lines.join('\n').trim() };
    } catch (err) {
      return memoryErrorResult(err);
    }
  },
};

const memory_save: Tool = {
  name: 'memory_save',
  description:
    '保存新记忆到指定层(working/episodic/semantic/procedural)。working=当前会话缓冲(需 session_id);episodic=历史会话片段(需 session_id);semantic=向量知识(自动生成 embedding);procedural=工具用法模式(需 metadata.pattern/tool_name/success)。',
  dangerLevel: 'read',
  parameters: {
    user_id: { type: 'string', description: '用户 ID(UUID)' },
    content: { type: 'string', description: '记忆内容' },
    layer: {
      type: 'string',
      description: '记忆层:working / episodic / semantic / procedural',
      enum: ['working', 'episodic', 'semantic', 'procedural'],
    },
    session_id: { type: 'string', description: '会话 ID(working/episodic 必填)' },
    summary: { type: 'string', description: '摘要(episodic 用,可选)' },
    importance_score: {
      type: 'number',
      description: '重要性评分 0-1(可选,默认 0.5)',
    },
    metadata: {
      type: 'object',
      description:
        '元数据(procedural 层需含 pattern/tool_name/success 字段;其他层可选)',
      properties: {
        pattern: { type: 'string', description: '工具调用模式(procedural 用)' },
        tool_name: { type: 'string', description: '工具名(procedural 用)' },
        success: { type: 'boolean', description: '是否成功(procedural 用)' },
      },
    },
  },
  required: ['user_id', 'content', 'layer'],
  async execute(args): Promise<ToolResult> {
    const userId = String(args.user_id ?? '').trim();
    const content = String(args.content ?? '').trim();
    const layer = String(args.layer ?? '').trim();
    if (!userId || !content || !layer) {
      return { success: false, output: '', error: '缺少 user_id/content/layer 参数' };
    }
    const body: Record<string, unknown> = { user_id: userId, content, layer };
    if (args.session_id) body.session_id = String(args.session_id);
    if (args.summary) body.summary = String(args.summary);
    if (typeof args.importance_score === 'number') {
      body.importance_score = args.importance_score;
    }
    if (args.metadata && typeof args.metadata === 'object') {
      body.metadata = args.metadata;
    }
    try {
      const result = await memorySend<Record<string, unknown>>(
        'POST',
        '/api/memory/save',
        body,
      );
      const id = result?.id ?? 'N/A';
      return {
        success: true,
        output: `已保存记忆 [layer=${layer}] id=${id}\n内容: ${content.slice(0, 200)}`,
      };
    } catch (err) {
      return memoryErrorResult(err);
    }
  },
};

const memory_dream: Tool = {
  name: 'memory_dream',
  description:
    '触发梦境固化(Dream consolidation):扫描 episodic_memory 未固化条目,调用 LLM 提取跨会话模式 → 生成 semantic_memory + 更新 procedural_memory。适合空闲时定时调用,把短期记忆固化为长期知识。',
  dangerLevel: 'read',
  parameters: {
    user_id: { type: 'string', description: '用户 ID(UUID)' },
  },
  required: ['user_id'],
  async execute(args): Promise<ToolResult> {
    const userId = String(args.user_id ?? '').trim();
    if (!userId) {
      return { success: false, output: '', error: '缺少 user_id 参数' };
    }
    try {
      const result = await memorySend<Record<string, unknown>>(
        'POST',
        '/api/memory/dream',
        { user_id: userId },
      );
      const patterns = Array.isArray(result?.patterns)
        ? (result.patterns as string[]).join(', ')
        : '无';
      const lines = [
        `梦境固化完成 [user=${userId}]`,
        `耗时: ${result?.durationMs ?? 'N/A'} ms`,
        `固化 semantic 条目: ${result?.consolidatedCount ?? 0}`,
        `更新 procedural 条目: ${result?.proceduralUpdated ?? 0}`,
        `提取模式: ${patterns}`,
        `梦境主题: ${result?.topic ?? 'N/A'}`,
      ];
      return { success: true, output: lines.join('\n') };
    } catch (err) {
      return memoryErrorResult(err);
    }
  },
};

const memory_forget: Tool = {
  name: 'memory_forget',
  description:
    '触发遗忘曲线衰减:基于 decay_factor *= 0.95^(days_since_access) 衰减 episodic_memory,importance_score < threshold 的删除。适合定期清理低价值记忆。',
  dangerLevel: 'read',
  parameters: {
    user_id: { type: 'string', description: '用户 ID(UUID)' },
    threshold: {
      type: 'number',
      description: '遗忘阈值(0-1,默认 0.1,低于此值的记忆删除)',
    },
  },
  required: ['user_id'],
  async execute(args): Promise<ToolResult> {
    const userId = String(args.user_id ?? '').trim();
    if (!userId) {
      return { success: false, output: '', error: '缺少 user_id 参数' };
    }
    const threshold = typeof args.threshold === 'number' ? args.threshold : 0.1;
    try {
      const result = await memorySend<Record<string, unknown>>(
        'DELETE',
        '/api/memory/forget',
        null,
        { user_id: userId, threshold: String(threshold) },
      );
      const lines = [
        `遗忘衰减完成 [user=${userId}]`,
        `阈值: ${result?.threshold ?? threshold}`,
        `已删除(完全遗忘): ${result?.forgottenCount ?? 0} 条`,
        `已衰减(importance 降低): ${result?.decayedCount ?? 0} 条`,
      ];
      return { success: true, output: lines.join('\n') };
    } catch (err) {
      return memoryErrorResult(err);
    }
  },
};

export const MEMORY_TOOLS: Tool[] = [
  memory_recall,
  memory_save,
  memory_dream,
  memory_forget,
];

export function registerMemoryTools(): void {
  registerTools(MEMORY_TOOLS);
}
