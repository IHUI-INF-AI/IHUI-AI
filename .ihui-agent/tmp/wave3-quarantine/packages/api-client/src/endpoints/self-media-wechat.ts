/**
 * 公众号稿流水线端点(Wave3 q4 新建,2026-10-26)。
 *
 * 为什么另起一个文件而不是往 `self-media.ts` 里塞:那道文件 2026-09-05 起只承载
 * skills 即席调用 + records 记录浏览,与「generate/validate/publish 三段流水线」
 * 不是同一契约面(请求体、耗时量级、失败语义都不同),混在一起后续改名会连带打断老调用方。
 *
 * 后端契约(逐条取证,均为**真注册**路由,非推测):
 *  - 代理层:`apps/api/src/routes/self-media-routes.ts:115-131`
 *      POST /self-media/wechat/generate   → proxyToAiService('/wechat/generate')
 *      POST /self-media/wechat/validate   → proxyToAiService('/wechat/validate')
 *      POST /self-media/wechat/publish    → proxyToAiService('/wechat/publish')
 *      GET  /self-media/wechat/history    → proxyToAiService('/wechat/history?limit=')
 *    路由级 preHandler = authenticate(self-media-routes.ts:87-95),Bearer 认证。
 *  - 代理实现:`self-media-routes.ts:48-84` —— `reply.send(payload)` **原样透传**上游 JSON,
 *    不加 `{code,message,data}` 信封(仅 502 兜底走 error())⇒ 本包必须用
 *    `fetchAiServiceJson`(整包 body 即 data),用 fetchApi 会被「json.code !== 0」判成业务失败。
 *  - 上游实现:`apps/ai-service/app/routers/self_media.py`
 *      generate(:493-548)入参 WechatGenerateRequest(:106-114:title 2..200 必填、
 *        digest≤500、topic≤2000、mdPath≤500、mdContent≤200000、dryRun 默认 true);
 *        成功出 {ok, returncode, mdPath, stdout, stderr, duration_ms, dryRun},
 *        LLM 失败出 {ok:false, error, stage:"llm_generate"},mdPath 不存在出 {ok:false, error}。
 *        子进程超时 180s(:531)⇒ 客户端超时必须 >180s,否则前端先断而后端还在跑。
 *      validate(:550-577)入参 {mdPath}(WechatValidateRequest:117-118,min_length=1);
 *        md 不在 ⇒ HTTPException 404(:556),出参 {ok, returncode, stdout, stderr}。
 *      publish(:598-628)入参 WechatPublishRequest(:121-126:mdPath+title 必填,
 *        digest/cover ≤500,dryRun 默认 true);子进程超时 300s ⇒ 客户端超时 >300s。
 *      history(:630-634)出参 **裸** {items:[...], count}(条目形态见 _serialize_history:282-308,
 *        键为 id/category/title/status/draftId/topicKeyword/createdAt/updatedAt/payload)。
 *
 * web 同页面取值口径:`apps/web/app/(main)/self-media/wechat/page.tsx:71`(history?limit=20)、
 * :159/:310(generate)、:171/:330(validate)、:184/:343(publish),本文件与之一一对应。
 */

import { fetchAiServiceJson } from '../client.js'

/** ai-service 子进程 180s + 余量;transport 侧 <=0 会回落默认 30s,故必须显式给。 */
const GENERATE_TIMEOUT_MS = 210_000
/** ai-service 子进程 300s + 余量。 */
const PUBLISH_TIMEOUT_MS = 330_000
/** validate 内联 python 默认 60s(_run_inline_python timeout_sec=60)。 */
const VALIDATE_TIMEOUT_MS = 75_000

/**
 * 宿主基址选项。
 *
 * apps/api 已把 /api/self-media/* 代理到 ai-service,所以相对路径在 web/RN 都能命中;
 * `baseUrl` 供「只想直连 ai-service」的宿主传绝对前缀(与 UsageScreen 取 WEB_BASE_URL
 * 同一条链路口径),缺省时走 api-client 注入的共享基址。
 */
export interface SelfMediaWechatTransport {
  baseUrl?: string
}

/** 三段流水线共用的运行结果(字段逐字对齐 self_media.py 出参) */
export interface WechatPipelineResult {
  ok: boolean
  stdout?: string
  stderr?: string
  error?: string
  stage?: string
  returncode?: number
  mdPath?: string
  duration_ms?: number
  dryRun?: boolean
}

/** history 条目的 payload(生成参数回填写用,全部可选) */
export interface WechatHistoryPayload {
  title?: string
  digest?: string
  mdPath?: string
  cover?: string
  topic?: string
}

export interface WechatHistoryItem {
  id: string
  category?: string
  title: string
  status: string
  draftId?: string | null
  topicKeyword?: string | null
  payload?: WechatHistoryPayload
  createdAt?: string | null
  updatedAt?: string | null
}

export interface WechatGenerateInput {
  title: string
  digest?: string
  topic?: string
  /** 已有 md 落盘路径(优先级高于 mdContent) */
  mdPath?: string
  /** 在线编辑/粘贴的 md 正文(非空时后端落盘后走流水线) */
  mdContent?: string
  dryRun?: boolean
}

export interface WechatPublishInput {
  mdPath: string
  title: string
  digest?: string
  cover?: string
  dryRun?: boolean
}

function joinBase(baseUrl: string | undefined, path: string): string {
  if (!baseUrl) return path
  return `${baseUrl.replace(/\/$/, '')}${path}`
}

/**
 * 把传输层失败(ApiResult 的 error 分支)归一成一次「运行失败」。
 * web 端 page.tsx:142-149 是同一条写法(不弹 toast,把错误并进结果卡片),RN 保持同口径。
 */
function toRunResult(
  res: Awaited<ReturnType<typeof fetchAiServiceJson<WechatPipelineResult>>>,
  fallbackError: string,
): WechatPipelineResult {
  if (res.success && res.data && typeof res.data === 'object') {
    return { ...res.data, ok: res.data.ok === true }
  }
  return { ok: false, error: res.error || fallbackError }
}

/** POST /api/self-media/wechat/generate — 生成/落盘 md 并跑流水线(dry-run 渲染摸鱼绿 HTML) */
export async function generateWechatArticle(
  input: WechatGenerateInput,
  transport: SelfMediaWechatTransport = {},
): Promise<WechatPipelineResult> {
  const res = await fetchAiServiceJson<WechatPipelineResult>(
    joinBase(transport.baseUrl, '/api/self-media/wechat/generate'),
    {
      method: 'POST',
      body: JSON.stringify({
        title: input.title,
        digest: input.digest ?? '',
        topic: input.topic ?? '',
        mdPath: input.mdPath ?? '',
        mdContent: input.mdContent ?? '',
        dryRun: input.dryRun ?? true,
      }),
      timeoutMs: GENERATE_TIMEOUT_MS,
    },
  )
  return toRunResult(res, 'generate request failed')
}

/** POST /api/self-media/wechat/validate — 对已落盘的 md 跑 22 项自检 */
export async function validateWechatArticle(
  mdPath: string,
  transport: SelfMediaWechatTransport = {},
): Promise<WechatPipelineResult> {
  const res = await fetchAiServiceJson<WechatPipelineResult>(
    joinBase(transport.baseUrl, '/api/self-media/wechat/validate'),
    {
      method: 'POST',
      body: JSON.stringify({ mdPath }),
      timeoutMs: VALIDATE_TIMEOUT_MS,
    },
  )
  return toRunResult(res, 'validate request failed')
}

/** POST /api/self-media/wechat/publish — 推送草稿箱(dryRun=false 才真推) */
export async function publishWechatArticle(
  input: WechatPublishInput,
  transport: SelfMediaWechatTransport = {},
): Promise<WechatPipelineResult> {
  const res = await fetchAiServiceJson<WechatPipelineResult>(
    joinBase(transport.baseUrl, '/api/self-media/wechat/publish'),
    {
      method: 'POST',
      body: JSON.stringify({
        mdPath: input.mdPath,
        title: input.title,
        digest: input.digest ?? '',
        cover: input.cover ?? '',
        dryRun: input.dryRun ?? true,
      }),
      timeoutMs: PUBLISH_TIMEOUT_MS,
    },
  )
  return toRunResult(res, 'publish request failed')
}

/**
 * GET /api/self-media/wechat/history — 已发布历史(裸 {items,count},无信封)。
 * 取数失败返回空列表而不抛错:web 端 page.tsx:70-73 同样只在 success 时 setHistory,
 * 失败保持上一份(本屏把它渲染成「暂无记录」)。
 */
export async function listWechatHistory(
  limit = 20,
  transport: SelfMediaWechatTransport = {},
): Promise<{ items: WechatHistoryItem[]; count: number }> {
  const res = await fetchAiServiceJson<{ items?: WechatHistoryItem[]; count?: number }>(
    joinBase(transport.baseUrl, '/api/self-media/wechat/history'),
    { params: { limit }, timeoutMs: 30_000 },
  )
  if (!res.success || !res.data) return { items: [], count: 0 }
  const items = Array.isArray(res.data.items) ? res.data.items : []
  return { items, count: typeof res.data.count === 'number' ? res.data.count : items.length }
}
