// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 占位：水印头由同目录 doubao-carry.mjs 逐字节拼接（见落盘步骤）
/**
 * 豆包归档 → ChatGPT conversations.json（豆包官方「数据导入与同步」可识别格式）。
 *
 * 为什么是这个格式（2026-11-24 取证）：
 *  - 豆包 2.37.16 客户端「设置 → 数据导入与同步」支持从 ChatGPT/Claude Code/TRAE Work
 *    的**本地备份文件**导入历史会话；导入后会话进入原生会话列表、**保留原有上下文、
 *    打开即可接着聊**（官方宣传 + 实测报道一致）。
 *  - 豆包自身没有「把会话归属从旧 uid 改到新 uid」的端点；官方导入通道是唯一能拿到
 *    「逐条原生会话 + 可续聊」的原生路径，比旧的文本回放（压成一条、AI 重新生成）强一个量级。
 *  - ChatGPT 导出格式公开稳定：conversations.json 是数组，每条含 title/create_time/
 *    mapping（id→node 树）/current_node；active 分支从 current_node 沿 parent 回溯。
 *
 * 本模块只做纯数据映射 + 纯内存打包 —— 不读 cookie、不发网络、不碰真实账号、不碰磁盘。
 * 消息逐条保留（用户/助手各一条），不做压缩、不重新生成、不丢图片文本线索。
 */
import zlib from 'node:zlib'

/** Unix 秒/毫秒归一化：豆包 create_time 实测有秒也有毫秒，统一输出 ChatGPT 的秒浮点。 */
export function toUnixSeconds(value) {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return 0
  return n > 1e12 ? n / 1000 : n
}

/**
 * 豆包图片消息(contentType=20)的 content 是 JSON 串,形如
 *   {"entities":[{"entity_content":{"image":{"key":"...","image_ori":{"url":"https://..."}}}}]}
 * 此前它和语音一样被当成一坨 JSON 文本塞进 parts —— 图片信息完全失真。这里抽出 URL:
 *   结构化 image_url part(懂多模态的导入器可直接渲染) + URL 文本兜底(纯文本导入器也不丢线索)。
 */
function extractImageUrls(content) {
  let data = content
  if (typeof content === 'string') {
    try {
      data = JSON.parse(content)
    } catch {
      return []
    }
  }
  if (!data || typeof data !== 'object') return []
  const urls = []
  const walk = (node, depth) => {
    if (!node || typeof node !== 'object' || depth > 12) return
    if (Array.isArray(node)) {
      for (const x of node) walk(x, depth + 1)
      return
    }
    if (node.image && typeof node.image === 'object') {
      const im = node.image
      const url =
        im?.image_ori?.url || im?.image_raw?.url || im?.image_thumb?.url ||
        (typeof im?.key === 'string' ? im.key : '')
      if (url) urls.push(String(url))
    }
    for (const [k, v] of Object.entries(node)) {
      if (k === 'image') continue // 上面已处理,避免重复
      if (v && typeof v === 'object') walk(v, depth + 1)
    }
  }
  walk(data, 0)
  return [...new Set(urls)]
}

/**
 * 豆包语音消息(contentType=101)的 content 是 JSON 串,asr_content / summary_content.content
 * 是转写文本。抽出它们,避免导入后只剩原始 JSON。
 */
function extractVoiceText(content) {
  let data = content
  if (typeof content === 'string') {
    try {
      data = JSON.parse(content)
    } catch {
      return ''
    }
  }
  if (!data || typeof data !== 'object') return ''
  const parts = [
    data.asr_content,
    data.summary_content?.content,
    data.summary_content?.title,
  ].filter((x) => typeof x === 'string' && x.trim().length > 0)
  return parts.join('\n').trim()
}

/**
 * 豆包消息 → ChatGPT content.parts 数组。
 *  - 纯文本(ct=1/9999):[text]
 *  - 图片(ct=20):结构化 image_url part + URL 文本兜底,content_type 升为 multimodal_text
 *  - 语音(ct=101):转写文本,空转写给 [语音消息] 标记避免空消息被吞
 *  - 解析失败一律原样字符串兜底(宁可留原始线索,绝不丢消息)
 * 空 parts 会被 toChatGptConversation 过滤,避免导入器吃掉整条会话。
 */
export function toParts(message) {
  const content = message?.content
  const ct = Number(message?.contentType) || 0
  const raw = typeof content === 'string' ? content : content ? JSON.stringify(content) : ''
  if (!raw) return []

  if (ct === 20) {
    const urls = extractImageUrls(content)
    if (urls.length > 0) {
      const parts = []
      for (const url of urls) {
        parts.push({ type: 'image_url', image_url: { url } })
        parts.push(`[图片] ${url}`)
      }
      // 图片消息 content 实测只有 entities 一个键,没有独立文字字段;原始 JSON 不再塞回(纯噪声)
      return parts
    }
  }
  if (ct === 101) {
    const text = extractVoiceText(content)
    if (text) return [`[语音转写] ${text}`]
    return ['[语音消息]']
  }
  return raw.length > 0 ? [raw] : []
}

/** parts 含非字符串元素 ⇒ ChatGPT content_type 用 multimodal_text。 */
function partsContentType(parts) {
  return parts.some((p) => typeof p !== 'string') ? 'multimodal_text' : 'text'
}

/**
 * 单会话 → ChatGPT conversation 对象。
 * @param {{conversationId?:string,name?:string,createTime?:number,updateTime?:number,messages?:Array}} conv
 */
export function toChatGptConversation(conv) {
  const messages = Array.isArray(conv?.messages) ? conv.messages : []
  // 按豆包的 index_in_conv 还原顺序（接口返回顺序不保证）。
  const ordered = messages
    .map((m, i) => ({ m, i }))
    .filter(({ m }) => toParts(m).length > 0)
    .sort((a, b) => {
      const ai = Number(a.m?.index ?? a.i) || 0
      const bi = Number(b.m?.index ?? b.i) || 0
      if (ai !== bi) return ai - bi
      const ac = Number(a.m?.createTime ?? 0) || 0
      const bc = Number(b.m?.createTime ?? 0) || 0
      if (ac !== bc) return ac - bc
      return a.i - b.i
    })
    .map(({ m }) => m)

  const mapping = {}
  // ChatGPT 导出根节点：message:null、parent:null、children:[首条]。
  const rootId = ''
  mapping[rootId] = {
    id: rootId,
    message: null,
    parent: null,
    children: ordered.length > 0 ? [`n1`] : [],
  }

  ordered.forEach((m, idx) => {
    const id = `n${idx + 1}`
    const parent = idx === 0 ? rootId : `n${idx}`
    const child = idx + 1 < ordered.length ? `n${idx + 2}` : null
    const rawRole = String(m?.role ?? '').toLowerCase()
    const role = rawRole === 'assistant' || rawRole === 'system' ? rawRole : 'user'
    const parts = toParts(m)
    mapping[id] = {
      id,
      message: {
        id,
        author: { role },
        create_time: toUnixSeconds(m?.createTime) || undefined,
        content: { content_type: partsContentType(parts), parts },
        metadata: {},
      },
      parent,
      children: child ? [child] : [],
    }
    mapping[parent].children = [id]
  })

  const currentNode = ordered.length > 0 ? `n${ordered.length}` : rootId
  const create = toUnixSeconds(conv?.createTime) || toUnixSeconds(ordered[0]?.createTime)
  const update = toUnixSeconds(conv?.updateTime) || toUnixSeconds(ordered.at(-1)?.createTime) || create
  return {
    title: String(conv?.name ?? '').trim() || '未命名会话',
    create_time: create || undefined,
    update_time: update || undefined,
    mapping,
    current_node: currentNode,
  }
}

/**
 * 整仓归档 → conversations.json 数组。
 * @param {{conversations?:Array}} index 归档 index.json
 * @param {(entry:object)=>object|null} readBody 按 index.conversations[i] 读会话正文（注入式）
 */
export function buildConversationsJson(index, readBody) {
  const entries = Array.isArray(index?.conversations) ? index.conversations : []
  const out = []
  const skipped = []
  for (const entry of entries) {
    const body = typeof readBody === 'function' ? readBody(entry) : null
    if (!body || !Array.isArray(body.messages) || body.messages.length === 0) {
      skipped.push({ conversationId: entry?.conversationId ?? '', reason: 'no-messages' })
      continue
    }
    const conv = toChatGptConversation({
      conversationId: body.conversationId ?? entry?.conversationId,
      name: body.name ?? entry?.name,
      createTime: body.createTime ?? entry?.createTime,
      updateTime: body.updateTime ?? entry?.updateTime,
      messages: body.messages,
    })
    out.push(conv)
  }
  return { conversations: out, skipped }
}

/** 纯校验：输出必须是数组，每条含 mapping/current_node，且 active 分支可回溯到根。 */
export function validateConversationsJson(conversations) {
  if (!Array.isArray(conversations)) return { ok: false, code: 'not-array' }
  for (let i = 0; i < conversations.length; i += 1) {
    const c = conversations[i]
    if (!c || typeof c !== 'object') return { ok: false, code: 'bad-conversation', index: i }
    if (!c.mapping || typeof c.mapping !== 'object') return { ok: false, code: 'no-mapping', index: i }
    if (!Object.prototype.hasOwnProperty.call(c.mapping, c.current_node ?? '')) {
      return { ok: false, code: 'bad-current-node', index: i }
    }
    // 沿 parent 回溯必须能到根，且不出现环。
    const seen = new Set()
    let nodeId = c.current_node
    while (nodeId !== '' && nodeId !== null && nodeId !== undefined) {
      if (seen.has(nodeId)) return { ok: false, code: 'cycle', index: i }
      seen.add(nodeId)
      const node = c.mapping[nodeId]
      if (!node) return { ok: false, code: 'dangling-node', index: i }
      nodeId = node.parent
    }
  }
  return { ok: true, count: conversations.length }
}

/**
 * 最小 store 模式 ZIP 写出器(零依赖,Node 22 内置 zlib.crc32)。
 * 豆包官方 ChatGPT 来源未明示收裸 conversations.json 还是 ZIP ⇒ 双格式一起产出,
 * 消除格式不确定。ChatGPT 原生导出就是 ZIP 内一个 conversations.json,这里同形。
 * store(不压缩)而非 deflate:JSON 已由调用方序列化,省 CPU 且任何解压器都支持。
 * @param {{name:string, data:Buffer}[]} entries
 * @returns {Buffer}
 */
export function buildStoreZip(entries, { year = 2026, month = 11, day = 24 } = {}) {
  const enc = new TextEncoder()
  const dosTime = 0 // 时间固定 00:00:00(纯交换文件,无意义)
  const dosDate = ((Math.max(1980, year) - 1980) << 9) | (month << 5) | day
  const locals = []
  const centrals = []
  let offset = 0
  for (const entry of entries) {
    const name = enc.encode(entry.name)
    const data = entry.data
    const crc = zlib.crc32(data) >>> 0
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0) // local file header signature
    local.writeUInt16LE(20, 4) // version needed
    local.writeUInt16LE(0, 6) // flags
    local.writeUInt16LE(0, 8) // compression = store
    local.writeUInt16LE(dosTime, 10)
    local.writeUInt16LE(dosDate, 12)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(data.length, 18) // compressed size
    local.writeUInt32LE(data.length, 22) // uncompressed size
    local.writeUInt16LE(name.length, 26)
    local.writeUInt16LE(0, 28) // extra length
    locals.push(local, Buffer.from(name), data)

    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0) // central dir signature
    central.writeUInt16LE(20, 4) // version made by
    central.writeUInt16LE(20, 6) // version needed
    central.writeUInt16LE(0, 8) // flags
    central.writeUInt16LE(0, 10) // store
    central.writeUInt16LE(dosTime, 12)
    central.writeUInt16LE(dosDate, 14)
    central.writeUInt32LE(crc, 16)
    central.writeUInt32LE(data.length, 20)
    central.writeUInt32LE(data.length, 24)
    central.writeUInt16LE(name.length, 28)
    central.writeUInt16LE(0, 30) // extra
    central.writeUInt16LE(0, 32) // comment
    central.writeUInt16LE(0, 34) // disk start
    central.writeUInt16LE(0, 36) // internal attrs
    central.writeUInt32LE(0, 38) // external attrs
    central.writeUInt32LE(offset, 42) // local header offset
    centrals.push(central, Buffer.from(name))
    offset += local.length + name.length + data.length
  }
  const centralSize = centrals.reduce((n, b) => n + b.length, 0)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(0, 4) // this disk
  eocd.writeUInt16LE(0, 6) // disk with central dir
  eocd.writeUInt16LE(entries.length, 8)
  eocd.writeUInt16LE(entries.length, 10)
  eocd.writeUInt32LE(centralSize, 12)
  eocd.writeUInt32LE(offset, 16)
  eocd.writeUInt16LE(0, 20) // comment length
  return Buffer.concat([...locals, ...centrals, eocd])
}

/** --out 的 json 路径 → 同目录同名 zip 路径(conversations.json → conversations.zip)。 */
export function zipPathFor(outFile) {
  return outFile.replace(/\.json$/i, '') + '.zip'
}
