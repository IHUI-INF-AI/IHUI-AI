// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/**

/**
 * ai-service 端点**调用层**(2026-11-13 自 `ai-bridge.ts` 拆出,AGENTS §3 拆档)。
 *
 * 把一次"method + path + 参数"真正发到 ai-service,并把三类失败分开归因:
 *   · 参数不全/路径不合法 ⇒ **当场拒**(连请求都不构造)—— 与"后端拒绝"必须可区分,
 *     否则模型会把"我没写全 path"读成"服务端没有这个接口";
 *   · 后端 4xx/5xx ⇒ 错误串带 method/path/status,让模型能自己判断是权限、路径还是服务本身;
 *   · 网络异常 ⇒ 同上,不伪装成成功。
 *
 * 传输腿只有一条:`fetchAiServiceJson`(ai-service 专用基址 + 401 静默续期)。
 */

import { fetchAiServiceJson } from '@ihui/api-client'

import { aiPathParamsOf } from './ai-bridge-catalog.js'

export function resolveAiBase(): string {
  return (process.env.AI_SERVICE_URL || 'http://localhost:8803').replace(/\/+$/, '')
}

export function asString(args: Record<string, unknown>, key: string): string {
  const v = args[key]
  return typeof v === 'string' ? v.trim() : ''
}

export function asNumber(args: Record<string, unknown>, key: string, fallback: number): number {
  const v = args[key]
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v)
    if (Number.isFinite(n)) return n
  }
  return fallback
}

export function asRecord(args: Record<string, unknown>, key: string): Record<string, unknown> | undefined {
  const v = args[key]
  if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined
  return v as Record<string, unknown>
}

/** 统一收口:path 必须是目录里的**完整路径**(含 `/api` 等前缀),否则 404 与拼错无从区分。 */
export function assertInvocationPath(raw: string): string {
  const path = raw.trim()
  if (!path.startsWith('/')) {
    throw new Error(
      `path 必须是完整路径(以 / 开头、含 /api 等前缀),当前为 ${path === '' ? '(空)' : path};先用 ai_list_endpoints 查目录`,
    )
  }
  if (/\s/.test(path)) throw new Error(`path 不得含空白字符: ${path}`)
  return path
}

/**
 * 把 `{param}` 占位替换成实参(URL 编码)。
 *
 * 与 `route-tools.ts#callRoute` 的 `:param` 形态不同,这里是 OpenAPI 的 `{param}` ——
 * 载体不同,不能共用那一行的 `.replace(':name', …)`;但**失效方向一致**:缺参直接报错,
 * 不把 `{id}` 原样发出去(那会得到一个语义不明的 404)。
 */
export function fillPathParams(path: string, args: Record<string, unknown>): { path: string; used: Set<string> } {
  const used = new Set<string>()
  let out = path
  for (const name of aiPathParamsOf(path)) {
    const v = args[name]
    if (v === undefined || v === null || v === '') {
      throw new Error(`缺少路径参数 ${name};完整调用形如 ${path.replace(`{${name}}`, `<${name}>`)}`)
    }
    used.add(name)
    out = out.split(`{${name}}`).join(encodeURIComponent(String(v)))
  }
  return { path: out, used }
}

/** 尾部 `/` 归一(ai-service 的路由有 `/foo` 与 `/foo/` 并存的情况,拼错就是 307/404 噪音)。 */
export function normalizeTail(path: string): string {
  return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path
}

export async function runAiHttp(
  method: string,
  args: Record<string, unknown>,
): Promise<{ success: boolean; output: string; error?: string }> {
  try {
    let path = assertInvocationPath(asString(args, 'path'))
    const filled = fillPathParams(path, args)
    path = normalizeTail(filled.path)

    // 路径参数已写进 path;其余按方法分流:GET/HEAD 走 query,写方法走 body。
    // (ai-service 的 DELETE 端点多数只带 path/query,把残参塞进 body 会被 FastAPI 忽略 ——
    //  所以 DELETE 也走 query,而不是照搬"非 GET 即 body"的简化。)
    const rest: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(args)) {
      if (k === 'path' || k === 'query' || k === 'body') continue
      if (filled.used.has(k)) continue
      if (v === undefined || v === null || v === '') continue
      rest[k] = v
    }

    const queryArg = asRecord(args, 'query')
    const bodyArg = asRecord(args, 'body')
    const query: Record<string, unknown> = { ...(queryArg ?? {}), ...rest }

    const base = resolveAiBase()
    const url = new URL(`${base}${path}`)
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null || v === '') continue
      // 数组按重复键展开(FastAPI 的 `List[x]` query 就是这形态),其余 JSON 化
      if (Array.isArray(v)) {
        for (const item of v) url.searchParams.append(k, String(item))
      } else {
        url.searchParams.set(k, typeof v === 'string' ? v : JSON.stringify(v))
      }
    }

    const isRead = method === 'GET' || method === 'HEAD'
    const payload = isRead ? undefined : bodyArg
    const res = await fetchAiServiceJson<unknown>(url.toString(), {
      method,
      ...(payload ? { body: JSON.stringify(payload), headers: { 'Content-Type': 'application/json' } } : {}),
    })

    if (!res.success) {
      return {
        success: false,
        output: '',
        error: `ai-service ${method} ${path} -> ${res.status ?? 'network'}: ${res.error ?? '(无错误正文)'}`,
      }
    }
    const data = res.data
    return { success: true, output: typeof data === 'string' ? data : JSON.stringify(data, null, 2) }
  } catch (e) {
    return { success: false, output: '', error: e instanceof Error ? e.message : String(e) }
  }
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
