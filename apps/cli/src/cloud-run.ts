// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * CLI 云会话写入客户端 — 把 CLI 侧 agent 运行记录写入 ai-service 云会话存储(/api/cloud-runs)。
 *
 * P0-7 补全端闭环:CLI 运行 agent 时通过 HTTP 调 ai-service 写入口,让运行记录能在
 * /cloud-agent 页面被看到与恢复(此前仅 web HTTP streaming 路径落盘)。
 *
 * 设计要点:
 *   - 地址:环境变量 AI_SERVICE_URL 优先,默认 http://localhost:8803(ai-service 端口)。
 *   - 鉴权:复用 ai-service 的 JWT(get_current_user_id),CLI 携带 settings 里的登录 token
 *     (Authorization: Bearer)。未登录 / token 无效时写失败。
 *   - 静默降级:任何网络/解析/鉴权失败都返回失败标记绝不抛出,不影响 agent 主流程退出码。
 *   - 超时:4s,避免阻塞长任务收尾。
 */

import { randomUUID } from 'node:crypto';

export interface CloudRunStartInput {
  task: string;
  agentType?: string;
  sessionAlias?: string;
  /** CLI 登录 JWT(settings.json apiKey / --api-key)。为空则无法写云会话。 */
  apiKey?: string;
}

export interface CloudRunCompleteInput {
  runId: string;
  status: 'done' | 'error';
  output?: string;
  error?: string;
  /** CLI 登录 JWT(settings.json apiKey / --api-key)。为空则无法写云会话。 */
  apiKey?: string;
}

const TIMEOUT_MS = 4000;

/** 解析 ai-service 基地址(环境变量 AI_SERVICE_URL 优先,默认 8803)。 */
export function resolveCloudRunBase(): string {
  return (process.env.AI_SERVICE_URL || 'http://localhost:8803').replace(/\/+$/, '');
}

function buildHeaders(apiKey?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }
  return headers;
}

/**
 * 带超时的 fetch。失败/超时/非 2xx 都返回 false(静默降级,绝不抛出)。
 * timeoutMs 目标 window.setTimeout;用 Number(wrapper) 兼容 Node 类型。
 */
async function send(
  method: 'POST' | 'PATCH',
  url: string,
  body: unknown,
  timeoutMs: number,
  apiKey?: string,
): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method,
      headers: buildHeaders(apiKey),
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 启动一次云运行记录(状态 running)。成功返回生成的 run_id;失败返回 null(静默降级)。
 */
export async function startCloudRun(input: CloudRunStartInput): Promise<string | null> {
  const runId = randomUUID().replace(/-/g, '');
  const ok = await send(
    'POST',
    `${resolveCloudRunBase()}/api/cloud-runs/run`,
    {
      run_id: runId,
      task: (input.task || '').slice(0, 2000),
      agent_type: input.agentType || 'loop_v2',
      session_alias: input.sessionAlias || runId,
    },
    TIMEOUT_MS,
    input.apiKey,
  );
  return ok ? runId : null;
}

/**
 * 结束一次云运行记录(状态 done/error)。失败静默降级,绝不抛出。
 */
export async function completeCloudRun(input: CloudRunCompleteInput): Promise<boolean> {
  return send(
    'PATCH',
    `${resolveCloudRunBase()}/api/cloud-runs/run/${encodeURIComponent(input.runId)}`,
    {
      status: input.status === 'error' ? 'error' : 'done',
      output: input.output || '',
      error: input.error || '',
    },
    TIMEOUT_MS,
    input.apiKey,
  );
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
