// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 语音消息转写服务层：把消息表里未转写（空串/纯空白/桥接占位文案）的语音音频交给
 * ai-service 本地 faster-whisper STT，转写文本回写该行 content（检索/知识库链路后续
 * 按 content 切片入库，本层只负责把真实文本落回消息行）。
 *
 * 几条不可破的取舍：
 * - stub 结果绝不写库：STT 引擎未装好/推理失败时上游会返回 stub=True 与带
 *   "[stub]"/"[STT 失败]" 前缀的占位文本。这种文本一旦落进 content，会被后续检索
 *   链路当成真实聊天内容切片、向量化，污染问答结果；所以 stub 只回传、不覆盖 content。
 * - 超大音频先判大小再读盘/下载：20MB 上限在 stat 与 Content-Length 阶段就拦掉，
 *   不把整包音频读进内存后才发现超限。
 * - 错误分类可辨：「音频取不到/越界/超限」与「STT 服务不可用」分开抛，批量层据此
 *   区分 skipped（确定性排除，重试也不会变）与 failed（基础设施故障，值得重试）。
 */

import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { and, desc, eq, inArray, or, sql } from 'drizzle-orm'
import { wechatHubMessages } from '@ihui/database'
import { db, dbRead } from '../../db/index.js'
import { AppError, isAppError } from '../../errors/AppError.js'
import { aiServiceSystemFetch } from '../../utils/ai-service-fetch.js'
import { assertAccountForUser } from './guards.js'
import { confinedMediaDir, configuredMediaRoot } from './local-media.js'
import { VOICE_PLACEHOLDERS, isVoicePlaceholder } from './voice-placeholder.js'

/** 批量默认扫描条数。 */
export const DEFAULT_VOICE_BATCH_LIMIT = 20
/** 批量扫描条数硬上限；入参超限在此截断，不报错。 */
export const MAX_VOICE_BATCH_LIMIT = 50
/** 单条音频大小上限：超过直接跳过，不读全文。 */
export const MAX_VOICE_AUDIO_BYTES = 20 * 1024 * 1024

/**
 * STT 调用超时（毫秒）。默认 60s 是给普通 LLM 补全留的；本地 whisper small 模型
 * 首次懒加载要读约 483MB 模型文件，叠加 CPU int8 推理，冷启动首条很容易超过 60s，
 * 故这里单独抬到 180s，避免把“模型还在加载”误判成超时失败。
 */
const STT_TIMEOUT_MS = 180_000

/** STT 端点（ai-service 内以 /api 前缀挂载，path 相对 ai-service 根）。 */
const STT_PATH = '/api/voice/stt'

export interface TranscribeResult {
  messageId: string
  text: string
  model: string
  stub: boolean
  chars: number
}

export interface TranscribeBatchItem {
  messageId: string
  ok: boolean
  text: string | null
  error: string | null
}

export interface TranscribeBatchResult {
  scanned: number
  transcribed: number
  failed: number
  skipped: number
  remaining: number
  /** 本次碰到 stub（STT 未就绪）：remaining 不会因这轮下降，前端应立刻停轮询。 */
  stub: boolean
  items: TranscribeBatchItem[]
}

interface VoiceMessageRow {
  id: string
  kind: string
  content: string
  mediaUrl: string | null
}

/** 批量里归为 skipped 的错误码：确定性排除，重试结果不变。 */
const SKIPPABLE_ERROR_CODES = new Set([
  'WECHAT_VOICE_NOT_VOICE',
  'WECHAT_VOICE_ALREADY_TRANSCRIBED',
  'WECHAT_VOICE_MEDIA_MISSING',
  'WECHAT_VOICE_MEDIA_OUTSIDE_ROOT',
  'WECHAT_VOICE_AUDIO_MISSING',
  'WECHAT_VOICE_AUDIO_UNAVAILABLE',
  'WECHAT_VOICE_AUDIO_TOO_LARGE',
])

/**
 * 单进程内的批量互斥：同一账号同一时刻只允许一批在跑。
 *
 * 多实例部署时这层不管用，真正的幂等靠下面 writeTranscription 的条件写回
 * （where 里带「content 仍是待转写形态」），两个实例同时转同一条时只有一个能写进去，
 * 另一个的 returning 为空、按已转写计入 skipped，不会互相覆盖。
 */
const RUNNING_BATCHES = new Set<string>()

/**
 * 桥接后端入站时会给语音消息写占位文案（`[语音]`、`[语音消息]` 这类），
 * 这些不是真实转写结果，但会挡住「content 为空才转写」的判断。
 * 统一认成「未转写」，既让批量能捞到，也允许单条重转。
 *
 * 一致性约束：这里判为「未转写」的行，批量 where 必须同样捞得到 —— 纯空白由
 * btrim 条件兜底，占位词走 inArray；两层口径不能分叉（单条能转、批量漏捞）。
 * 判定本体在 voice-placeholder.ts：分析与导出也共用同一份列表。
 */
export { VOICE_PLACEHOLDERS, isVoicePlaceholder }

/** 「这条音频的内容还是待转写形态」：批量捞取与写回抢占用同一个条件，口径不许分叉。 */
function pendingContentFilter() {
  return or(
    // btrim 兜纯空白：与 isVoicePlaceholder 的 trim 口径对齐，
    // 避免纯空白行单条能转、批量永远捞不到。
    sql`btrim(${wechatHubMessages.content}) = ''`,
    inArray(wechatHubMessages.content, VOICE_PLACEHOLDERS),
  )
}

function pendingVoiceFilter(accountId: string) {
  return and(
    eq(wechatHubMessages.accountId, accountId),
    eq(wechatHubMessages.kind, 'voice'),
    pendingContentFilter(),
  )
}

interface LoadedAudio {
  data: Buffer
  filename: string
}

interface SttPayload {
  text: string
  stub: boolean
  model: string
}

async function fetchVoiceMessage(messageId: string, accountId: string): Promise<VoiceMessageRow> {
  const rows = await dbRead
    .select({
      id: wechatHubMessages.id,
      kind: wechatHubMessages.kind,
      content: wechatHubMessages.content,
      mediaUrl: wechatHubMessages.mediaUrl,
    })
    .from(wechatHubMessages)
    .where(and(eq(wechatHubMessages.id, messageId), eq(wechatHubMessages.accountId, accountId)))
    .limit(1)
  const row = rows[0]
  if (!row) throw new AppError('语音消息不存在', 404, 'WECHAT_MESSAGE_NOT_FOUND')
  return row
}

/** 校验消息形态，返回收紧后的音频地址；不满足契约直接抛 AppError。 */
function validateVoiceRow(row: VoiceMessageRow): string {
  if (row.kind !== 'voice') {
    throw new AppError('该消息不是语音类型', 400, 'WECHAT_VOICE_NOT_VOICE')
  }
  if (!isVoicePlaceholder(row.content)) {
    // 已有真实转写文本：不重复调 STT，避免把同一条语音重复转写后覆盖已有内容。
    throw new AppError('该语音消息已转写过', 409, 'WECHAT_VOICE_ALREADY_TRANSCRIBED')
  }
  if (!row.mediaUrl || row.mediaUrl.trim() === '') {
    throw new AppError('语音消息缺少音频地址', 400, 'WECHAT_VOICE_MEDIA_MISSING')
  }
  return row.mediaUrl.trim()
}

/** 本地/相对路径收紧到配置媒体根目录内；复用 local-media 的越界判定，不另造一套。 */
function resolveLocalAudioPath(mediaUrl: string): string | null {
  const root = configuredMediaRoot()
  if (!root) return null
  const target = path.isAbsolute(mediaUrl) ? path.resolve(mediaUrl) : path.join(root, mediaUrl)
  return confinedMediaDir(root, target)
}

/** 从地址推导上传文件名；必须带扩展名，否则 STT 服务端按 .wav 兜底解码。 */
function audioFileName(mediaUrl: string): string {
  let base: string
  if (/^https?:\/\//i.test(mediaUrl)) {
    try {
      base = decodeURIComponent(path.posix.basename(new URL(mediaUrl).pathname))
    } catch {
      base = 'voice'
    }
  } else {
    base = path.basename(mediaUrl)
  }
  const stem = base.replace(/\.[^.]*$/, '') || 'voice'
  const ext = path.extname(base).toLowerCase()
  if (/^\.[a-z0-9]{1,6}$/.test(ext)) return base
  return `${stem}.wav`
}

async function readLocalAudio(mediaUrl: string): Promise<LoadedAudio> {
  const target = resolveLocalAudioPath(mediaUrl)
  if (!target) {
    throw new AppError('本地音频不在配置的媒体根目录内', 400, 'WECHAT_VOICE_MEDIA_OUTSIDE_ROOT')
  }
  let info: Awaited<ReturnType<typeof stat>>
  try {
    info = await stat(target)
  } catch (e) {
    if (e && typeof e === 'object' && 'code' in e && (e as { code: string }).code === 'ENOENT') {
      throw new AppError('本地音频文件不存在', 404, 'WECHAT_VOICE_AUDIO_MISSING')
    }
    throw e
  }
  if (!info.isFile()) {
    throw new AppError('本地音频路径不是文件', 404, 'WECHAT_VOICE_AUDIO_MISSING')
  }
  if (info.size > MAX_VOICE_AUDIO_BYTES) {
    throw new AppError('语音音频超过 20MB 上限', 413, 'WECHAT_VOICE_AUDIO_TOO_LARGE')
  }
  const data = await readFile(target)
  return { data, filename: audioFileName(mediaUrl) }
}

async function downloadHttpAudio(url: string): Promise<LoadedAudio> {
  // 先 HEAD 探一次 Content-Length；服务端不给长度就降级到 GET 响应头再判，
  // 都拿不到才兜底读字节长度，避免把超大整包一次性拉进内存。
  let headLength: number | null = null
  try {
    const head = await fetch(url, { method: 'HEAD' })
    if (head.ok) {
      const len = Number(head.headers.get('content-length'))
      headLength = Number.isFinite(len) && len >= 0 ? len : null
    }
  } catch {
    // HEAD 不被支持或网络抖动不阻断流程，交给 GET 兜底。
  }
  if (headLength !== null && headLength > MAX_VOICE_AUDIO_BYTES) {
    throw new AppError('语音音频超过 20MB 上限', 413, 'WECHAT_VOICE_AUDIO_TOO_LARGE')
  }

  let resp: Response
  try {
    resp = await fetch(url)
  } catch (e) {
    throw new AppError(
      `语音音频下载失败: ${(e as Error).message}`,
      502,
      'WECHAT_VOICE_AUDIO_UNAVAILABLE',
    )
  }
  if (!resp.ok) {
    throw new AppError(
      `语音音频下载失败: HTTP ${resp.status}`,
      502,
      'WECHAT_VOICE_AUDIO_UNAVAILABLE',
    )
  }
  const len = Number(resp.headers.get('content-length'))
  if (Number.isFinite(len) && len > MAX_VOICE_AUDIO_BYTES) {
    await resp.body?.cancel().catch(() => undefined)
    throw new AppError('语音音频超过 20MB 上限', 413, 'WECHAT_VOICE_AUDIO_TOO_LARGE')
  }
  const data = Buffer.from(await resp.arrayBuffer())
  if (data.byteLength > MAX_VOICE_AUDIO_BYTES) {
    throw new AppError('语音音频超过 20MB 上限', 413, 'WECHAT_VOICE_AUDIO_TOO_LARGE')
  }
  return { data, filename: audioFileName(url) }
}

async function loadAudio(mediaUrl: string): Promise<LoadedAudio> {
  if (/^https?:\/\//i.test(mediaUrl)) return downloadHttpAudio(mediaUrl)
  return readLocalAudio(mediaUrl)
}

async function callStt(audio: LoadedAudio): Promise<SttPayload> {
  const form = new FormData()
  // 显式带文件名与扩展名：STT 服务端按扩展名选临时文件后缀，缺扩展名会按 .wav 兜底，
  // m4a/mp3 等格式可能解码失败。
  const blob = new Blob([new Uint8Array(audio.data)], { type: 'application/octet-stream' })
  form.append('file', blob, audio.filename)

  let resp: Response
  try {
    resp = await aiServiceSystemFetch(STT_PATH, { method: 'POST', body: form }, STT_TIMEOUT_MS)
  } catch (e) {
    // 超时/连接失败归为 STT 不可用；与“音频取不到”分开，便于上层决定是否重试。
    throw new AppError(
      `STT 服务调用失败: ${(e as Error).message}`,
      503,
      'WECHAT_VOICE_STT_UNAVAILABLE',
    )
  }
  if (!resp.ok) {
    throw new AppError(`STT 服务返回 HTTP ${resp.status}`, 503, 'WECHAT_VOICE_STT_UNAVAILABLE')
  }
  const payload = (await resp.json()) as Partial<SttPayload>
  return {
    text: typeof payload.text === 'string' ? payload.text : '',
    stub: payload.stub === true,
    model: typeof payload.model === 'string' ? payload.model : 'unknown',
  }
}

async function transcribeCore(row: VoiceMessageRow): Promise<TranscribeResult> {
  const mediaUrl = validateVoiceRow(row)
  const audio = await loadAudio(mediaUrl)
  const stt = await callStt(audio)
  const text = stt.text.trim()

  // stub 铁律：占位文本绝不落库，content 保持原样（空），只把结果照实回传便于排查。
  if (stt.stub) {
    return {
      messageId: row.id,
      text: stt.text,
      model: stt.model,
      stub: true,
      chars: stt.text.trim().length,
    }
  }

  // 只回写 content；mediaUrl 与其他列一律不动，避免转写顺带改掉原始归档信息。
  // 写回是条件更新：where 里必须还带着「仍是待转写形态」，两个实例同时转同一条时，
  // 只有先到的那次能命中，后到那次 returning 为空 —— 按已转写处理，不覆盖、不重试。
  const written = await db
    .update(wechatHubMessages)
    .set({ content: text })
    .where(and(eq(wechatHubMessages.id, row.id), pendingContentFilter()))
    .returning({ id: wechatHubMessages.id })
  if (written.length === 0) {
    throw new AppError(
      '该语音已被另一次转写抢先写入',
      409,
      'WECHAT_VOICE_ALREADY_TRANSCRIBED',
    )
  }

  return {
    messageId: row.id,
    text,
    model: stt.model,
    stub: false,
    chars: text.length,
  }
}

/**
 * 转写单条语音消息。账号归属先过 assertAccountForUser；消息形态、音频可取性、
 * STT 可用性任一不满足都抛 AppError；stub 结果不写库。
 */
export async function transcribeMessage(
  userId: string,
  accountId: string,
  messageId: string,
): Promise<TranscribeResult> {
  await assertAccountForUser(userId, accountId)
  const row = await fetchVoiceMessage(messageId, accountId)
  return transcribeCore(row)
}

function resolveBatchLimit(limit?: number): number {
  if (typeof limit !== 'number' || !Number.isFinite(limit) || limit <= 0)
    return DEFAULT_VOICE_BATCH_LIMIT
  return Math.min(Math.floor(limit), MAX_VOICE_BATCH_LIMIT)
}

/**
 * 批量转写某账号下未转写的语音消息：按 sentAt 倒序扫描，逐条处理。
 * 单条异常只计入 failed/skipped 并在 item 里记录原因，绝不整体失败。
 */
export async function transcribeAccountVoice(
  userId: string,
  accountId: string,
  opts: { limit?: number } = {},
): Promise<TranscribeBatchResult> {
  await assertAccountForUser(userId, accountId)
  if (RUNNING_BATCHES.has(accountId)) {
    throw new AppError('该账号已有一批语音正在转写，等它跑完再来', 409, 'WECHAT_VOICE_BATCH_RUNNING')
  }
  RUNNING_BATCHES.add(accountId)
  try {
    return await runVoiceBatch(accountId, resolveBatchLimit(opts.limit))
  } finally {
    // 异常也必须放锁：否则一次 STT 抖动会把账号的语音转写永久卡死。
    RUNNING_BATCHES.delete(accountId)
  }
}

async function runVoiceBatch(accountId: string, limit: number): Promise<TranscribeBatchResult> {
  const rows = await dbRead
    .select({
      id: wechatHubMessages.id,
      kind: wechatHubMessages.kind,
      content: wechatHubMessages.content,
      mediaUrl: wechatHubMessages.mediaUrl,
    })
    .from(wechatHubMessages)
    .where(pendingVoiceFilter(accountId))
    .orderBy(desc(wechatHubMessages.sentAt))
    .limit(limit)

  const result: TranscribeBatchResult = {
    scanned: rows.length,
    transcribed: 0,
    failed: 0,
    skipped: 0,
    remaining: 0,
    stub: false,
    items: [],
  }

  for (const row of rows) {
    try {
      const r = await transcribeCore(row)
      if (r.stub) {
        // stub 未写库，归入 skipped：与成功转写区分开，调度层据此知道要等 STT 恢复后重试。
        result.stub = true
        result.skipped += 1
        result.items.push({
          messageId: row.id,
          ok: false,
          text: null,
          error: 'STT 返回 stub 占位结果，未写入检索库',
        })
        continue
      }
      result.transcribed += 1
      result.items.push({ messageId: row.id, ok: true, text: r.text, error: null })
    } catch (e) {
      const message = isAppError(e) ? e.message : String(e)
      if (isAppError(e) && SKIPPABLE_ERROR_CODES.has(e.errorCode)) {
        result.skipped += 1
        result.items.push({ messageId: row.id, ok: false, text: null, error: message })
      } else {
        // 单条异常不拖垮整批：其余条目继续转写，这里只记 failed。
        result.failed += 1
        result.items.push({ messageId: row.id, ok: false, text: null, error: message })
      }
    }
  }

  // 扫完之后再数一次：stub/超大/取不到的行仍是待转写，remaining 会告诉前端
  // 还要不要继续跑下一轮。一次跑 50 条会撞 180s 的上限，所以宁可让前端多按几次。
  const remainingRows = await dbRead
    .select({ n: sql<number>`count(*)` })
    .from(wechatHubMessages)
    .where(pendingVoiceFilter(accountId))
  result.remaining = Number(remainingRows[0]?.n ?? 0)

  return result
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
