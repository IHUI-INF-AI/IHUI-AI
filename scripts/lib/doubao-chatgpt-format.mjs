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
 * 本模块只做纯数据映射 —— 不读 cookie、不发网络、不碰真实账号。
 * 消息逐条保留（用户/助手各一条），不做压缩、不重新生成、不丢图片文本线索。
 */

/** Unix 秒/毫秒归一化：豆包 create_time 实测有秒也有毫秒，统一输出 ChatGPT 的秒浮点。 */
export function toUnixSeconds(value) {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return 0
  return n > 1e12 ? n / 1000 : n
}

/** ChatGPT content.parts 的元素：纯文本就是字符串。空内容过滤，避免导入器吃掉整条会话。 */
function toParts(content) {
  const text = typeof content === 'string' ? content : ''
  return text.length > 0 ? [text] : []
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
    .filter(({ m }) => toParts(m?.content).length > 0)
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
    mapping[id] = {
      id,
      message: {
        id,
        author: { role },
        create_time: toUnixSeconds(m?.createTime) || undefined,
        content: { content_type: 'text', parts: toParts(m?.content) },
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
