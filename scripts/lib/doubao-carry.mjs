// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * 豆包(Doubao)跨号会话归档 —— 让「对话在云端、本地零副本」这条腿从"做不到"变成
 * "能导出、能留档"(回放能力见下)。
 *
 * 形状全部现读自本机 2.32.6 明文前端(`E:\Software\Doubao\app\local_webcontents\...`),
 * 不是按公开博客猜的:
 *
 *  1) `genBaseURL(e){return "string"==typeof this.baseURL?this.baseURL+e:this.baseURL(e)}`
 *     + `baseURL:"https://www.doubao.com"`(entry-main/main.js:349866 的 initFlowApiOptions),
 *     ⇒ 所有 `/samantha/**` 端点 = `https://www.doubao.com` + 路径字面量。
 *  2) 公共参数走 **query 不是 header**:`async-request` 的 request 包装是
 *     `params:{...getCommonParams(), ...a}`;只有 `getCommonHeaders()` 那一条
 *     `{"Agw-Js-Conv":"str"}` 进 header。所以本文件的公共参数一律拼进 URL。
 *  3) 会话列表:`ThreadList({index,batch_size})` → `POST /samantha/thread/list`,
 *     响应解析在 4213.js:196068 —— `var{thread_list:m=[],has_more:f,next_index:h}=p||{}`,
 *     每项 `e.conversation` 里才有 `conversation_id`/`name`(另有 `thread_id_str||thread_id`)。
 *  4) 消息体:客户端真正的取消息入口是 IM 网关 `POST /im/chain/single`(4213.js:539041),
 *     响应解析在 4213.js:4130 —— `var{messages:t=[],has_more:n,regen_messages:d}={}`;
 *     单条消息字段(4213.js:115700 附近归一函数):`message_id` / `sender_id` / `user_type`
 *     / `content_type` / `content` / `create_time` / `index_in_conv` / `status`。
 *     `/samantha/thread/get?collection_id=` 的**消费端不在本机安装包内**(全库搜 `.GetThread(`
 *     只有服务定义,零调用点),故本模块对它的响应用"多形态兜底解析",取不到再退 IM 网关。
 *  5) `ThreadCreate` 只有 `{conversation_id,message_id,bot_id,samantha_onboarding}`,
 *     没有 messages/contents/text ⇒ **不能把历史消息写进新号云端**,只能本地归档。
 *
 * 硬边界:
 *  - 绝不写豆包任何数据目录,绝不启动/关闭豆包客户端;只读 Cookies 库 + 只写 `outDir`;
 *  - 所有网络调用都过可注入的 `fetchImpl`(默认 globalThis.fetch)⇒ 单测零真网;
 *  - cookie 缺失/过期一律带 `code` 明确报错,绝不静默返回空数组冒绿;
 *  - 翻页有双闸:`has_more` 为假 或 `index` 不前进即停 + `maxPages` 硬上限。
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { readAesKeyFromLocalState } from './codearts-auth-extract.mjs'
import { decryptOsCryptString, stripDoubaoAppPrefix } from './doubao-auth-extract.mjs'

const require = createRequire(import.meta.url)
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

export const DOUBAO_BASE_URL = 'https://www.doubao.com'
/** 会话 cookie 域(实证 .doubao.com;www.doubao.com 也可能单独成行) */
const COOKIE_HOSTS = ['.doubao.com', 'doubao.com', 'www.doubao.com']
/** 登录过期码(实测无 cookie 直调 `{"code":710012001,"msg":"登录已过期，请重新登录"}`) */
export const LOGIN_INVALID_CODE = '710012001'
/** Chromium ≥130 的 cookie 明文会前置 32 字节 host_key sha256 */
const HOST_HASH_BYTES = 32

/**
 * 公共参数(取自 getCommonParams,见文件头第 2 条)。
 * 只保留服务端判身份/版本必需的那几项;device_id / fp 与本机账号绑定,**故意不伪造**
 * —— 缺了它们服务端仍按 cookie 认账号,伪造错了反而会被风控打回。
 */
export const DEFAULT_COMMON_PARAMS = Object.freeze({
  version_code: '20800',
  language: 'zh',
  device_platform: 'web',
  doubao_device_platform: 'web',
  aid: '497858',
  real_aid: '497858',
  pkg_type: 'release',
  region: 'cn',
  sys_region: 'cn',
  samantha_web: '1',
  web_platform: 'web',
  'use-olympus-account': '1',
  client_platform: 'pc_client',
})

/** 本机默认 profile:%LOCALAPPDATA%\Doubao\User Data\Default */
export function defaultDoubaoProfileDir(env = process.env) {
  const base = env.LOCALAPPDATA
    ? env.LOCALAPPDATA
    : path.join(env.USERPROFILE || env.HOME || '.', 'AppData', 'Local')
  return path.join(base, 'Doubao', 'User Data', 'Default')
}

/** Local State 与 profile 同级(User Data\Local State) */
export function defaultLocalStatePath(profileDir = defaultDoubaoProfileDir()) {
  return path.join(path.dirname(profileDir), 'Local State')
}

/** node:sqlite 的 BLOB 返回裸 Uint8Array(isBuffer=false),三种形态都要认 */
function toBuffer(v) {
  if (v === null || v === undefined) return null
  if (Buffer.isBuffer(v)) return v
  if (ArrayBuffer.isView(v)) return Buffer.from(v.buffer, v.byteOffset, v.byteLength)
  if (typeof v === 'object' && v.data) return Buffer.from(v.data)
  return null
}

function hostMatches(host) {
  return COOKIE_HOSTS.some((h) => host === h || host.endsWith(h))
}

/**
 * 解密单条 cookie。返回 {value} / {appBound:true} / {skip:原因}。
 * v10/v11 = AES-256-GCM(密钥 = Local State 的 DPAPI 包封 key)⇒ DPAPI 在这一步必经;
 * v20 = app-bound,本机解不了 ⇒ 如实点名,不猜。
 */
function decryptCookieRow(row, getAesKey) {
  const host = String(row.host_key ?? '')
  const name = String(row.name ?? '')
  const plain = typeof row.value === 'string' ? row.value.trim() : ''
  if (plain !== '') return { value: row.value }
  const blob = toBuffer(row.encrypted_value)
  if (!blob || blob.length === 0) return { skip: `${host}/${name} 无 value 也无 encrypted_value` }
  const prefix = blob.subarray(0, 3).toString('ascii')
  if (prefix === 'v20') return { appBound: true, name: `${host}/${name}` }
  if (prefix !== 'v10' && prefix !== 'v11') {
    return { skip: `${host}/${name} 密文前缀 "${prefix || '空'}" 非 v10/v11(app-bound 等未判定)` }
  }
  let key
  try {
    key = getAesKey()
  } catch (e) {
    return { keyError: e instanceof Error ? e.message : String(e) }
  }
  try {
    let buf = decryptOsCryptString(blob, key, { rawBuffer: true })
    // Chromium ≥130:明文前置 32 字节 host_key sha256,命中才剥
    const digest = crypto.createHash('sha256').update(host).digest()
    if (buf.length > HOST_HASH_BYTES && buf.subarray(0, HOST_HASH_BYTES).equals(digest)) {
      buf = buf.subarray(HOST_HASH_BYTES)
    }
    // 豆包自家那层 32 字节固定头(2026-10-27 实证,见 doubao-auth-extract.mjs)
    return { value: stripDoubaoAppPrefix(buf) }
  } catch (e) {
    return { skip: `${host}/${name} 解密失败: ${e instanceof Error ? e.message : String(e)}` }
  }
}

/**
 * 从 Chromium Cookies SQLite 读豆包 cookie,拼成 `k=v; k=v` 请求头。
 *
 * @returns {Promise<{code:string, cookieHeader:string|null, count:number, source:string,
 *   skipped?:string[], appBound?:string[]}>}
 *   code: 'ok' | 'cookie-missing' | 'cookie-app-bound' | 'cookie-unreadable' | 'cookie-undecryptable'
 */
export async function readDoubaoCookie({ profileDir, localStatePath, shellBin } = {}) {
  const profile = profileDir || defaultDoubaoProfileDir()
  const dbPath = path.join(profile, 'Network', 'Cookies')
  const source = dbPath
  if (!fs.existsSync(dbPath)) {
    return {
      code: 'cookie-missing',
      cookieHeader: null,
      count: 0,
      source,
      message: `Cookies 库不存在: ${dbPath}(该机器当前没有豆包登录态)`,
    }
  }
  const { DatabaseSync } = require('node:sqlite')
  let db
  try {
    db = new DatabaseSync(dbPath, { readOnly: true })
  } catch (e) {
    return {
      code: 'cookie-unreadable',
      cookieHeader: null,
      count: 0,
      source,
      message: `Cookies 库只读打开失败(${e instanceof Error ? e.message : String(e)});客户端在跑时先退出豆包`,
    }
  }
  const lsPath = localStatePath || defaultLocalStatePath(profile)
  let aesKey = null
  const getAesKey = () => {
    if (!aesKey) aesKey = readAesKeyFromLocalState(lsPath, { shellBin })
    return aesKey
  }
  const pairs = []
  const skipped = []
  const appBound = []
  let keyError = null
  try {
    const rows = db
      .prepare('SELECT host_key, name, value, encrypted_value FROM cookies ORDER BY creation_utc')
      .all()
    for (const row of rows) {
      if (!hostMatches(String(row.host_key ?? ''))) continue
      const r = decryptCookieRow(row, getAesKey)
      if (r.value !== undefined) pairs.push({ name: String(row.name), value: r.value })
      else if (r.appBound) appBound.push(r.name)
      else if (r.keyError) keyError = r.keyError
      else if (r.skip) skipped.push(r.skip)
    }
  } finally {
    db.close()
  }
  if (pairs.length === 0) {
    if (appBound.length > 0) {
      return {
        code: 'cookie-app-bound',
        cookieHeader: null,
        count: 0,
        source,
        appBound,
        skipped,
        message: `豆包 cookie 全是 v20(app-bound)形态,本机解不开(${appBound.length} 条);改用 --cdp <port> 从运行中的客户端取`,
      }
    }
    if (keyError) {
      return {
        code: 'cookie-undecryptable',
        cookieHeader: null,
        count: 0,
        source,
        skipped,
        message: `Local State 的 DPAPI 密钥取不到: ${keyError}`,
      }
    }
    return {
      code: 'cookie-missing',
      cookieHeader: null,
      count: 0,
      source,
      skipped,
      message: `Cookies 库在盘但 0 条豆包 cookie 可读(未登录或键名/域形态变更)`,
    }
  }
  pairs.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
  return {
    code: 'ok',
    cookieHeader: pairs.map((p) => `${p.name}=${p.value}`).join('; '),
    count: pairs.length,
    source,
    skipped,
    appBound,
  }
}

/** 把 `k=v; k=v` 拆成对象(CLI 里 --cookie 直接给的字符串也走这条) */
export function parseCookieHeader(header) {
  const out = {}
  for (const part of String(header ?? '').split(';')) {
    const i = part.indexOf('=')
    if (i <= 0) continue
    out[part.slice(0, i).trim()] = part.slice(i + 1).trim()
  }
  return out
}

function buildUrl(pathname, params = {}) {
  const url = new URL(pathname, DOUBAO_BASE_URL)
  for (const [k, v] of Object.entries({ ...DEFAULT_COMMON_PARAMS, ...params })) {
    if (v === undefined || v === null || v === '') continue
    url.searchParams.set(k, String(v))
  }
  return url.toString()
}

function buildHeaders(cookieHeader, extra = {}) {
  const headers = {
    'Agw-Js-Conv': 'str',
    Accept: 'application/json, text/plain, */*',
    'Content-Type': 'application/json; encoding=utf-8',
    Referer: `${DOUBAO_BASE_URL}/chat/`,
    Origin: DOUBAO_BASE_URL,
    ...extra,
  }
  if (cookieHeader) headers.Cookie = cookieHeader
  return headers
}

async function readJson(res) {
  if (res && typeof res.json === 'function') {
    try {
      return await res.json()
    } catch {
      /* 落到 text 分支 */
    }
  }
  const text = res && typeof res.text === 'function' ? await res.text() : ''
  return JSON.parse(text)
}

function apiCodeOf(json, keys = ['code']) {
  for (const k of keys) {
    const v = json?.[k]
    if (v !== undefined && v !== null && v !== '') return String(v)
  }
  return ''
}

/** 服务端码 → 本模块 code。'' / '0' ⇒ null(成功) */
function apiErrorCode(raw) {
  if (!raw || raw === '0') return null
  if (raw === LOGIN_INVALID_CODE) return 'cookie-expired'
  return 'api-error'
}

function errMessage(json) {
  return String(json?.msg ?? json?.message ?? json?.status_desc ?? '')
}

async function postJson(fetchImpl, url, body, headers) {
  const res = await fetchImpl(url, { method: 'POST', headers, body: JSON.stringify(body) })
  return readJson(res)
}

/**
 * 列全部会话(自动翻页)。入口是 `thread/list` 而不是 `conversation/list`:
 * 前者是侧栏历史列表的真实来源且带 `next_index`(4213.js:196068),后者在
 * ConversationList 服务定义里只透传 `index`、响应只有 `conversation_list + has_more`,
 * 没有游标 —— 用它翻页必死循环。
 *
 * @returns {Promise<{code:string, conversations:Array<object>, pages:number, total:number,
 *   hasMore?:boolean, message?:string}>}
 */
export async function listConversations({
  cookieHeader,
  fetchImpl = globalThis.fetch,
  index = 0,
  maxPages = 50,
  pageSize = 20,
  commonParams = {},
} = {}) {
  if (!cookieHeader) {
    return { code: 'cookie-missing', conversations: [], pages: 0, total: 0, message: '缺少 cookie' }
  }
  const conversations = []
  const seen = new Set()
  let cursor = Number.isFinite(index) ? index : 0
  let pages = 0
  let hasMore = false
  while (pages < Math.max(1, Number(maxPages) || 1)) {
    const url = buildUrl('/samantha/thread/list', commonParams)
    const json = await postJson(
      fetchImpl,
      url,
      { index: cursor, batch_size: pageSize },
      buildHeaders(cookieHeader),
    )
    const bad = apiErrorCode(apiCodeOf(json))
    if (bad) {
      return { code: bad, conversations, pages, total: conversations.length, message: errMessage(json) }
    }
    const data = json?.data ?? {}
    // 旧版 thread/list 把翻页字段放在 data 顶层;新版 threadFeed 把它们收进 data.threads
    // (4213.js:169031 的 {threads:{has_more,next_cursor,thread_list}})。两种都认。
    const pageData = Array.isArray(data.thread_list) ? data : (data.threads ?? {})
    const list = Array.isArray(pageData.thread_list) ? pageData.thread_list : []
    for (const item of list) {
      const conv = item?.conversation ?? item ?? {}
      const conversationId = String(conv.conversation_id ?? conv.conversationId ?? '').trim()
      if (!conversationId || seen.has(conversationId)) continue
      seen.add(conversationId)
      conversations.push({
        conversationId,
        name: String(conv.name ?? conv.conversation_name ?? ''),
        conversationType: conv.conversation_type ?? null,
        threadId: String(item?.thread_id_str ?? item?.thread_id ?? conv.thread_id ?? ''),
        threadSource: item?.thread_source ?? null,
        createTime: Number(conv.create_time ?? 0) || 0,
        updateTime: Number(conv.update_time ?? 0) || 0,
      })
    }
    pages += 1
    hasMore = Boolean(pageData.has_more)
    if (!hasMore || list.length === 0) break
    const next = Number(pageData.next_index ?? pageData.next_cursor)
    // 防死循环闸:游标不前进(或缺失)立刻停,绝不靠 maxPages 兜到 50 页空转
    if (!Number.isFinite(next) || next === cursor) break
    cursor = next
  }
  return { code: 'ok', conversations, pages, total: conversations.length, hasMore }
}

/** 消息可能在 data.messages / data.message_list / data.thread.messages … 里(消费端不在本机包内) */
function pickMessageList(data) {
  const candidates = [
    data?.messages,
    data?.message_list,
    data?.messageList,
    data?.thread?.messages,
    data?.thread?.message_list,
    data?.data?.messages,
    data?.data?.message_list,
  ]
  for (const c of candidates) if (Array.isArray(c)) return c
  return []
}

/**
 * 单条消息 → 稳定的本地形状。
 * user_type: HUMAN=1 / AIBOT=2 / SYSTEM=3(25488.js:923146 的 FWD 枚举)。
 */
export function normalizeMessage(raw) {
  const m = raw ?? {}
  const userType = Number(m.user_type)
  let role = 'unknown'
  if (userType === 1) role = 'user'
  else if (userType === 2) role = 'assistant'
  else if (userType === 3) role = 'system'
  else if (typeof m.role === 'string') role = m.role
  return {
    messageId: String(m.message_id ?? ''),
    role,
    userType: Number.isFinite(userType) ? userType : null,
    senderId: m.sender_id === undefined || m.sender_id === null ? '' : String(m.sender_id),
    contentType: Number(m.content_type ?? 0) || 0,
    content: typeof m.content === 'string' ? m.content : '',
    createTime: Number(m.create_time ?? 0) || 0,
    index: Number(m.index_in_conv ?? 0) || 0,
    status: Number(m.status ?? 0) || 0,
    sectionId: m.section_id ?? null,
    ext: m.ext ?? null,
  }
}

/** IM 网关单页(4213.js:539041 的请求体 + 4213.js:4130 的响应解析,逐字对齐) */
async function postImChain({ cookieHeader, conversationId, fetchImpl, commonParams, anchorIndex, limit }) {
  const url = buildUrl('/im/chain/single', commonParams)
  const body = {
    sequence_id: `${Date.now()}${Math.floor(Math.random() * 1000)}`,
    channel: 2,
    version: '1',
    cmd: 3100, // PULL_SINGLE_CHAIN
    uplink_body: {
      pull_singe_chain_uplink_body: {
        conversation_id: conversationId,
        anchor_index: anchorIndex,
        conversation_type: 3, // ONE_TO_BOT_CHAT
        direction: 1, // MSG_DIRECTION.OLDER
        limit,
        ext: {},
        filter: { index_list: [], bot_id: '' },
        evaluate_ab_params: '',
        evaluate_common_params: '',
      },
    },
  }
  const json = await postJson(fetchImpl, url, body, buildHeaders(cookieHeader))
  const raw = apiCodeOf(json, ['status_code', 'code'])
  const bad = apiErrorCode(raw)
  if (bad) return { code: bad, messages: [], page: json, message: errMessage(json) }
  const downlink = json?.downlink_body?.pull_singe_chain_downlink_body ?? json?.data ?? {}
  return {
    code: 'ok',
    messages: Array.isArray(downlink.messages) ? downlink.messages : [],
    hasMore: Boolean(downlink.has_more),
    page: json,
  }
}

/**
 * 拉单个会话的全部消息。
 * 先走 `/samantha/thread/get?collection_id=`(服务定义在 entry-main/main.js:268795);
 * 它 0 消息时退 IM 网关 `/im/chain/single`(客户端真实取消息的那条路),并按
 * `has_more` + 最老 index 翻页,三条闸防死循环。
 *
 * @returns {Promise<{code:string, conversationId:string, messages:Array<object>,
 *   source?:string, raw?:object, message?:string}>}
 */
export async function getThread({
  cookieHeader,
  conversationId,
  fetchImpl = globalThis.fetch,
  commonParams = {},
  imMaxPages = 40,
  pageSize = 50,
} = {}) {
  const id = String(conversationId ?? '').trim()
  if (!cookieHeader) {
    return { code: 'cookie-missing', conversationId: id, messages: [], message: '缺少 cookie' }
  }
  if (!id) return { code: 'bad-arg', conversationId: id, messages: [], message: '缺少 conversationId' }

  const url = buildUrl('/samantha/thread/get', { ...commonParams, collection_id: id })
  const res = await fetchImpl(url, { method: 'GET', headers: buildHeaders(cookieHeader) })
  const json = await readJson(res)
  const bad = apiErrorCode(apiCodeOf(json))
  if (bad) {
    return { code: bad, conversationId: id, messages: [], raw: json, message: errMessage(json) }
  }
  const data = json?.data ?? {}
  let messages = pickMessageList(data).map(normalizeMessage)
  let source = 'thread/get'
  const raw = json

  if (messages.length === 0) {
    const collected = []
    const seen = new Set()
    let anchor = 0
    let prevAnchor = null
    let pages = 0
    for (; pages < Math.max(1, Number(imMaxPages) || 1); pages += 1) {
      const page = await postImChain({
        cookieHeader,
        conversationId: id,
        fetchImpl,
        commonParams,
        anchorIndex: anchor,
        limit: pageSize,
      })
      if (page.code !== 'ok') {
        // thread/get 已通、IM 只是补正文;补不到就如实带 warning,不把整个会话判死
        return {
          code: 'ok',
          conversationId: id,
          messages: [],
          source: 'thread/get',
          raw,
          warning: `消息正文取不到(${page.code}): ${page.message || '未知'}`,
        }
      }
      for (const m of page.messages) {
        const norm = normalizeMessage(m)
        const key = norm.messageId || `${norm.index}`
        if (seen.has(key)) continue
        seen.add(key)
        collected.push(norm)
      }
      if (!page.hasMore || page.messages.length === 0) break
      const indexes = page.messages
        .map((m) => Number(m.index_in_conv))
        .filter((n) => Number.isFinite(n))
      const oldest = indexes.length ? Math.min(...indexes) : null
      if (oldest === null || oldest === prevAnchor) break
      prevAnchor = anchor
      anchor = oldest
    }
    messages = collected.sort((a, b) => a.index - b.index || a.createTime - b.createTime)
    source = 'im/chain'
  }
  return { code: 'ok', conversationId: id, messages, source, raw }
}

/** 默认归档根:`<repo>/.ihui-agent/doubao-archive/<timestamp>/` */
export function defaultArchiveDir(now = Date.now()) {
  const stamp = new Date(now).toISOString().replace(/[:.]/g, '-')
  return path.join(ROOT, '.ihui-agent', 'doubao-archive', stamp)
}

export function fileNameFor(conv, i = 0) {
  const id = String(conv?.conversationId ?? 'unknown')
  const name = String(conv?.name ?? '')
    .replace(/[\\/:*?"<>|\s]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40)
  const head = `${String(i + 1).padStart(3, '0')}${name ? `-${name}` : ''}`
  return `${head}-${id.replace(/[^\w.-]+/g, '_')}.json`
}

/**
 * 全量导出。真写盘(CLI 的 dry-run 在调用前就 return,不走这里)。
 * 每个会话一个 json,外加一份 index.json。
 */
export async function exportArchive({
  cookieHeader,
  outDir,
  fetchImpl = globalThis.fetch,
  onProgress,
  commonParams = {},
  pageSize = 20,
  maxPages = 50,
} = {}) {
  const dir = outDir || defaultArchiveDir()
  const listed = await listConversations({
    cookieHeader,
    fetchImpl,
    maxPages,
    pageSize,
    commonParams,
  })
  if (listed.code !== 'ok') {
    return {
      code: listed.code,
      dir,
      exported: 0,
      failed: 0,
      totalMessages: 0,
      message: listed.message,
    }
  }
  const index = {
    generatedAt: new Date().toISOString(),
    source: 'doubao',
    baseUrl: DOUBAO_BASE_URL,
    count: 0,
    totalMessages: 0,
    conversations: [],
  }
  const payloads = []
  let failed = 0
  let totalMessages = 0
  for (const [i, conv] of listed.conversations.entries()) {
    const th = await getThread({
      cookieHeader,
      conversationId: conv.conversationId,
      fetchImpl,
      commonParams,
    })
    if (th.code !== 'ok') {
      failed += 1
      index.conversations.push({
        conversationId: conv.conversationId,
        name: conv.name,
        file: null,
        messages: 0,
        error: th.code,
      })
      onProgress?.({ phase: 'thread-failed', conv, code: th.code, done: i + 1, total: listed.conversations.length })
      continue
    }
    const file = fileNameFor(conv, i)
    payloads.push({
      file,
      body: {
        conversationId: conv.conversationId,
        name: conv.name,
        threadId: conv.threadId,
        createTime: conv.createTime,
        updateTime: conv.updateTime,
        exportedAt: index.generatedAt,
        messageSource: th.source ?? '',
        warning: th.warning ?? null,
        messages: th.messages,
      },
    })
    index.conversations.push({
      conversationId: conv.conversationId,
      name: conv.name,
      file,
      messages: th.messages.length,
      messageSource: th.source ?? '',
    })
    totalMessages += th.messages.length
    onProgress?.({
      phase: 'thread-done',
      conv,
      messages: th.messages.length,
      done: i + 1,
      total: listed.conversations.length,
    })
  }
  fs.mkdirSync(dir, { recursive: true })
  for (const p of payloads) {
    fs.writeFileSync(path.join(dir, p.file), `${JSON.stringify(p.body, null, 2)}\n`, 'utf8')
  }
  index.count = payloads.length
  index.totalMessages = totalMessages
  fs.writeFileSync(path.join(dir, 'index.json'), `${JSON.stringify(index, null, 2)}\n`, 'utf8')
  return {
    code: listed.conversations.length > 0 && payloads.length === 0 ? 'export-all-failed' : 'ok',
    dir,
    exported: payloads.length,
    failed,
    totalMessages,
    conversations: listed.conversations.length,
  }
}

// =============================================================================
// 回放腿(2026-11-10 深挖结论):豆包没有「逐条消息写回云端」的端点 ——
// ThreadCreate 只带 conversation_id/message_id(4213.js:… ThreadCreate 体),
// PutChatRecord 只认 tool_message_id,都是落库确认不是内容写入口。
// 聊天发送链是 /samantha/chat/completion(SSE,cookie + Agw-Js-Conv 鉴权,
// 端点形态与 getCommonParams/getCommonHeaders 同源,本机 bundle 只有封装壳,
// 真 URL 在线上 web 层)。⇒ 迁移语义 = 回放:用新号把旧对话作为一条 user
// 消息发进新会话,服务端自动建 conversation,新号上立即可接着聊。
// =============================================================================

/** 旧对话 → 单条回放文本(结构清晰,供新会话里 AI/人共同读) */
export function buildReplayText(conv, messages) {
  const turns = (messages ?? [])
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && String(m.content ?? '').trim() !== '')
    .map((m) => `${m.role === 'user' ? '用户' : 'AI'}:${String(m.content).trim()}`)
  const name = String(conv?.name ?? '').trim() || '(未命名)'
  const header = [
    '【对话迁移】以下为旧账号的历史对话记录,请作为上下文保留:',
    `会话名:${name}`,
    `消息数:${turns.length}`,
    '--- 原始对话开始 ---',
  ]
  return [...header, ...turns, '--- 原始对话结束 ---'].join('\n')
}

/** 会话指纹:同一归档重复回放防重(comversationId+createTime+消息数+首末消息 id) */
export function replayFingerprint(conv, messages) {
  const list = messages ?? []
  const first = list[0]?.messageId ?? ''
  const last = list[list.length - 1]?.messageId ?? ''
  return crypto
    .createHash('sha256')
    .update(`${conv?.conversationId ?? ''}|${conv?.createTime ?? 0}|${list.length}|${first}|${last}`)
    .digest('hex')
    .slice(0, 32)
}

/** replay-log.json 读写(存在归档目录内,跟 index.json 同级) */
function readReplayLog(dir) {
  const file = path.join(dir, 'replay-log.json')
  try {
    const json = JSON.parse(fs.readFileSync(file, 'utf8'))
    return { file, entries: json.entries ?? {} }
  } catch {
    return { file, entries: {} }
  }
}

function writeReplayLog(dir, log) {
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(
    log.file,
    `${JSON.stringify({ generatedAt: new Date().toISOString(), entries: log.entries }, null, 2)}\n`,
    'utf8',
  )
}

/** 从 SSE 全文里抽新会话 id(服务端建的 conversation) */
export function pickNewConversationId(sseText) {
  const m =
    /"conversation_id"\s*:\s*"(\d{10,})"/.exec(sseText) ??
    /"conversation_id"\s*:\s*(\d{10,})/.exec(sseText)
  return m ? m[1] : ''
}

/**
 * 单会话回放:POST /samantha/chat/completion,body 不带 conversation_id
 * ⇒ 服务端新建会话。响应是 SSE,整段读完用 res.text()(避免流式状态机),
 * 从中抽 conversation_id 作为回放落点。
 *
 * @returns {Promise<{code:string, newConversationId:string, message?:string}>}
 *   code: 'ok' | 'cookie-missing' | 'login-invalid' | 'send-failed' | 'no-new-conversation'
 */
export async function replayConversation({
  cookieHeader,
  conv,
  messages,
  fetchImpl = globalThis.fetch,
  commonParams = {},
} = {}) {
  if (!cookieHeader) return { code: 'cookie-missing', newConversationId: '', message: '缺少 cookie' }
  const text = buildReplayText(conv, messages)
  const url = buildUrl('/samantha/chat/completion', commonParams)
  let res
  try {
    res = await fetchImpl(url, {
      method: 'POST',
      headers: buildHeaders(cookieHeader),
      body: JSON.stringify({
        messages: [{ role: 'user', content: text }],
        local_message_id: `migr_${Date.now()}`,
        stream: true,
      }),
    })
  } catch (e) {
    return { code: 'send-failed', newConversationId: '', message: e instanceof Error ? e.message : String(e) }
  }
  if (res.status === 401 || res.status === 403) {
    return { code: 'login-invalid', newConversationId: '', message: `HTTP ${res.status}:登录态无效` }
  }
  if (!res.ok) {
    return { code: 'send-failed', newConversationId: '', message: `HTTP ${res.status}` }
  }
  const sse = await res.text()
  // 错误体可能是裸 JSON(如 {"code":710012001})而非 SSE;SSE 文本里抽不到 code 字段就当成功流
  let apiJson = null
  try {
    apiJson = JSON.parse(sse)
  } catch {
    apiJson = null
  }
  const raw = apiJson && typeof apiJson === 'object' ? apiErrorCode(apiCodeOf(apiJson)) : null
  if (raw) {
    return {
      code: raw === 'cookie-expired' ? 'login-invalid' : raw,
      newConversationId: '',
      message: errMessage(apiJson) || raw,
    }
  }
  const newId = pickNewConversationId(sse)
  if (!newId) {
    return { code: 'no-new-conversation', newConversationId: '', message: 'SSE 里抽不到 conversation_id(响应形状可能已变,需复核)' }
  }
  return { code: 'ok', newConversationId: newId }
}

/**
 * 全量回放:读归档 → 逐会话(可 limit)→ 指纹防重 → 写 replay-log.json。
 * apply=false 时只列「将回放什么」不发送(与仓库 dry-run 同规矩)。
 *
 * @returns {Promise<{code:string, apply:boolean, total:number, replayed:number, skipped:number,
 *   failed:number, logFile:string, message?:string}>}
 */
export async function replayArchive({
  cookieHeader,
  archiveDir,
  fetchImpl = globalThis.fetch,
  commonParams = {},
  apply = false,
  limit = 0,
  onProgress,
} = {}) {
  const idx = readArchiveIndex(archiveDir)
  if (idx.code !== 'ok') {
    return {
      code: idx.code,
      apply,
      total: 0,
      replayed: 0,
      skipped: 0,
      failed: 0,
      logFile: '',
      message: idx.message,
    }
  }
  const convs = (idx.conversations ?? []).filter((c) => c.file)
  const planned = Number.isFinite(limit) && limit > 0 ? convs.slice(0, limit) : convs
  if (!cookieHeader) {
    return {
      code: 'cookie-missing',
      apply,
      total: planned.length,
      replayed: 0,
      skipped: 0,
      failed: 0,
      logFile: '',
      message: '缺少 cookie(给新号的登录态:--cookie / --cdp / 本机 Cookies 库)',
    }
  }
  const log = readReplayLog(archiveDir)
  let replayed = 0
  let skipped = 0
  let failed = 0
  for (const [i, c] of planned.entries()) {
    let body
    try {
      body = JSON.parse(fs.readFileSync(path.join(archiveDir, c.file), 'utf8'))
    } catch (e) {
      failed += 1
      onProgress?.({ phase: 'failed', conv: c, message: `归档文件读不出: ${e instanceof Error ? e.message : e}` })
      continue
    }
    const fp = replayFingerprint(c, body.messages)
    if (log.entries[fp]) {
      skipped += 1
      onProgress?.({ phase: 'skipped', conv: c, newConversationId: log.entries[fp].newConversationId })
      continue
    }
    if (!apply) {
      onProgress?.({ phase: 'dry-run', conv: c, messages: (body.messages ?? []).length, done: i + 1, total: planned.length })
      continue
    }
    const r = await replayConversation({
      cookieHeader,
      conv: c,
      messages: body.messages,
      fetchImpl,
      commonParams,
    })
    if (r.code === 'ok') {
      replayed += 1
      log.entries[fp] = {
        conversationId: c.conversationId,
        name: c.name ?? '',
        newConversationId: r.newConversationId,
        at: new Date().toISOString(),
      }
      writeReplayLog(archiveDir, log)
      onProgress?.({ phase: 'done', conv: c, newConversationId: r.newConversationId, done: i + 1, total: planned.length })
    } else {
      failed += 1
      onProgress?.({ phase: 'failed', conv: c, code: r.code, message: r.message })
    }
  }
  if (apply) writeReplayLog(archiveDir, log)
  return {
    code: 'ok',
    apply,
    total: planned.length,
    replayed,
    skipped,
    failed,
    logFile: log.file,
  }
}

/** 读归档 index(给"作为上下文引用"/回放腿用) */
export function readArchiveIndex(dir) {
  if (!dir) return { code: 'bad-arg', message: '缺少归档目录' }
  const file = path.join(dir, 'index.json')
  if (!fs.existsSync(file)) {
    return { code: 'archive-missing', dir, file, message: `归档清单不存在: ${file}` }
  }
  try {
    const json = JSON.parse(fs.readFileSync(file, 'utf8'))
    return { code: 'ok', dir, file, ...json }
  } catch (e) {
    return {
      code: 'archive-unreadable',
      dir,
      file,
      message: `归档清单解析失败: ${e instanceof Error ? e.message : String(e)}`,
    }
  }
}

export const __test__ = {
  buildUrl,
  buildHeaders,
  pickMessageList,
  apiErrorCode,
  decryptCookieRow,
  fileNameFor,
  DOUBAO_BASE_URL,
  DEFAULT_COMMON_PARAMS,
  LOGIN_INVALID_CODE,
}
