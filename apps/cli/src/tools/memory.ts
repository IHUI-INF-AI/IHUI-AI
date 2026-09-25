// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
 *   - 通过 cli config 的 apiUrl(默认 http://localhost:8803)调用 ai-service
 *   - 网络失败优雅降级(返回 errorType='network',不阻塞主流程)
 *   - dangerLevel='read'(记忆操作无破坏性,dream/forget 也是幂等衰减)
 *
 * 属主绑定(2026-09-25,守门 113 清偿):`user_id` / `session_id` **不再是模型可填的参数**。
 *   原因:这两个键会被逐字投进发给 provider 的 JSON Schema,于是模型可以填一个别人的
 *   UUID 读到/写进别人的记忆 —— 这是越权,不是参数校验问题(同族先例:agent-control
 *   投递定址按实例绑定)。正确形状:属主由宿主登录态(JWT 的 `sub`)派生,会话号由宿主
 *   在进程内铸造,模型侧根本看不见这两个键。
 *   ⚠️ 如实登记:ai-service 的 `/api/memory/*` 自身**没有任何鉴权依赖**
 *   (`apps/ai-service/app/api/memory.py` 直接收请求里的 user_id),仓里已有的
 *   `require_request_user_id`(`app/core/jwt_auth.py`)没被它用上。服务端 fail-closed
 *   属另一票(见 PROJECT_PLAN 登记),本票只把模型可控面拆掉。
 */

import { randomUUID } from 'node:crypto';
import { loadConfig } from '../config/index.js';
import { buildApiAuthHeaders, decodeJwtClaims, resolveOutboundCredential, type ResolvedCredential } from '../config/credentials.js';
import { registerTools, type Tool, type ToolResult } from './index.js';

const MEMORY_TIMEOUT_MS = 15_000;

/**
 * 宿主铸造的会话号(进程内稳定)。`working` / `episodic` 层用它分区,
 * 模型既看不到也改不动 —— 与 debug/terminal 的 sessionId 同属"句柄",不是"路由身份"。
 */
const HOST_SESSION_ID = randomUUID();

/** 记忆属主:只能从本地登录凭据派生。null = 未登录或凭据不含用户主体。 */
function memoryCredential(): ResolvedCredential | null {
  return resolveOutboundCredential({ settings: loadConfig() });
}

function resolveMemoryOwner(): string | null {
  const cred = memoryCredential();
  if (!cred) return null;
  // 机器凭据(ihui_ 前缀)没有"人"的主体;拿它的 token 当 sub 会造出一个假属主,
  // 表现是"记忆写进一个谁都不认识的 UUID"并且静默成功。
  if (cred.kind === 'api_key') return null;
  const sub = decodeJwtClaims(cred.token)?.sub;
  return typeof sub === 'string' && sub.trim() !== '' ? sub.trim() : null;
}

/** 未登录时的统一出口(不带任何凭据内容) */
const OWNER_UNRESOLVED: ToolResult = {
  success: false,
  output: '',
  error:
    '记忆工具需要已登录的用户身份(从本地 JWT 的 sub 派生属主)。当前凭据不可用或不含用户主体,请 `ihui login`。' +
    '属主参数不由模型提供 —— 那等于让模型指定"读谁的记忆"。',
  errorType: 'auth',
};

interface MemoryApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

/** 获取 ai-service base URL(从 cli config apiUrl,默认 http://localhost:8803) */
function getBaseUrl(): string {
  const config = loadConfig();
  return config.apiUrl || 'http://localhost:8803';
}

/** 出站到 ai-service 的鉴权头(复用 `buildApiAuthHeaders`,不得另拼一份 Authorization) */
function memoryHeaders(): Record<string, string> {
  return {
    Accept: 'application/json',
    ...buildApiAuthHeaders(resolveOutboundCredential({ settings: loadConfig() })),
  };
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
      headers: memoryHeaders(),
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
        ...memoryHeaders(),
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
    '语义检索记忆:用 query 在 semantic 层做 cosine similarity 检索,返回 top_k 相关记忆条目。适合回忆用户偏好、历史决策、知识点。属主由本地登录态绑定,无需(也不允许)指定用户 ID。',
  dangerLevel: 'read',
  parameters: {
    query: { type: 'string', description: '语义检索查询文本' },
    top_k: {
      type: 'number',
      description: '返回最相关的 N 条(默认 5,上限 50)',
    },
  },
  required: ['query'],
  async execute(args): Promise<ToolResult> {
    const userId = resolveMemoryOwner();
    if (!userId) return OWNER_UNRESOLVED;
    const query = String(args.query ?? '').trim();
    if (!query) {
      return { success: false, output: '', error: '缺少 query 参数' };
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
    '保存新记忆到指定层(working/episodic/semantic/procedural)。working=当前会话缓冲;episodic=历史会话片段;两者分区由宿主会话号自动带上,模型不指定;semantic=向量知识(自动生成 embedding);procedural=工具用法模式(需 metadata.pattern/tool_name/success)。',
  dangerLevel: 'read',
  parameters: {
    content: { type: 'string', description: '记忆内容' },
    layer: {
      type: 'string',
      description: '记忆层:working / episodic / semantic / procedural',
      enum: ['working', 'episodic', 'semantic', 'procedural'],
    },
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
  required: ['content', 'layer'],
  async execute(args): Promise<ToolResult> {
    const userId = resolveMemoryOwner();
    if (!userId) return OWNER_UNRESOLVED;
    const content = String(args.content ?? '').trim();
    const layer = String(args.layer ?? '').trim();
    if (!content || !layer) {
      return { success: false, output: '', error: '缺少 content/layer 参数' };
    }
    const body: Record<string, unknown> = {
      user_id: userId,
      content,
      layer,
      session_id: HOST_SESSION_ID,
    };
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
    '触发梦境固化(Dream consolidation):扫描 episodic_memory 未固化条目,调用 LLM 提取跨会话模式 → 生成 semantic_memory + 更新 procedural_memory。适合空闲时定时调用,把短期记忆固化为长期知识。属主由本地登录态绑定。',
  dangerLevel: 'read',
  parameters: {},
  required: [],
  async execute(): Promise<ToolResult> {
    const userId = resolveMemoryOwner();
    if (!userId) return OWNER_UNRESOLVED;
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
    '触发遗忘曲线衰减:基于 decay_factor *= 0.95^(days_since_access) 衰减 episodic_memory,importance_score < threshold 的删除。适合定期清理低价值记忆。属主由本地登录态绑定。',
  dangerLevel: 'read',
  parameters: {
    threshold: {
      type: 'number',
      description: '遗忘阈值(0-1,默认 0.1,低于此值的记忆删除)',
    },
  },
  required: [],
  async execute(args): Promise<ToolResult> {
    const userId = resolveMemoryOwner();
    if (!userId) return OWNER_UNRESOLVED;
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
