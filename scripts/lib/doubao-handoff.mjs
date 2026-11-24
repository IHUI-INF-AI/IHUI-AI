// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 豆包归档 → 切号「对话交接单」(2026-11-24 立)。
 *
 * 为什么需要它:
 *  - 豆包原生会话归属绑定云端账号,官方「数据导入与同步」在本机 2.37.16 实测是
 *    **扫描已安装 AI 应用**(`正在扫描你安装的应用`),不是选文件上传;手搓的
 *    ChatGPT conversations.json 没有可用的文件导入入口。
 *  - 因此跨号续聊的确定可用路径只剩两条:旧版文本回放(耗新号额度、AI 重生成)
 *    或本模块的「交接单」——把最近若干轮原样摘出来,新号新建会话后作为首条上下文
 *    发送,模型据此接着干,不重生成、不丢结论。
 *
 * 边界(必须说清,不许冒充原生历史):
 *  - 交接单只带**文本消息**,图片/语音/附件只保留其文本线索;
 *  - 默认只带最近 `maxMessages` 条、总字数 `maxChars` 以内,超长自动截断并明示;
 *  - 不是新号会话列表里的原生会话,不会出现在侧栏历史里。
 */
import fs from 'node:fs'
import path from 'node:path'

const DEFAULT_MAX_MESSAGES = 24
const DEFAULT_MAX_CHARS = 80_000
const DEFAULT_MAX_MESSAGE_CHARS = 6_000

function clip(text, limit) {
  const s = String(text ?? '')
  if (s.length <= limit) return { text: s, clipped: false }
  return { text: `${s.slice(0, limit)}\n…(已截断 ${s.length - limit} 字)`, clipped: true }
}

/** 只在归档里挑一条:显式 id 优先,否则取 index 第一条带正文的会话(导出顺序=最新在前) */
export function pickHandoffConversation(index, conversationId = '') {
  const entries = Array.isArray(index?.conversations) ? index.conversations : []
  const usable = entries.filter((e) => e && e.file && Number(e.messages ?? 0) > 0)
  if (conversationId) {
    const hit = usable.find((e) => String(e.conversationId ?? '') === String(conversationId))
    return hit ? { ok: true, entry: hit, why: 'explicit' } : { ok: false, code: 'conversation-not-found', entry: null }
  }
  if (usable.length === 0) return { ok: false, code: 'no-usable-conversation', entry: null }
  return { ok: true, entry: usable[0], why: 'latest-first' }
}

/**
 * 渲染交接单(Markdown,纯函数;不读盘)。
 * @param {object} args
 * @param {object} args.index 归档 index.json
 * @param {object} args.body 会话正文
 * @param {string} [args.conversationId]
 * @param {number} [args.maxMessages]
 * @param {number} [args.maxChars]
 * @param {number} [args.maxMessageChars]
 */
export function renderHandoff({
  index = {},
  body = {},
  conversationId = '',
  archiveDir = '',
  maxMessages = DEFAULT_MAX_MESSAGES,
  maxChars = DEFAULT_MAX_CHARS,
  maxMessageChars = DEFAULT_MAX_MESSAGE_CHARS,
} = {}) {
  const all = (Array.isArray(body.messages) ? body.messages : [])
    .filter((m) => m && typeof m.content === 'string' && m.content.trim() !== '')
  if (all.length === 0) {
    return { ok: false, code: 'no-messages', markdown: '', messages: 0, totalMessages: 0, truncated: false }
  }
  const totalMessages = all.length
  const tail = all.slice(Math.max(0, all.length - Math.max(1, Number(maxMessages) || DEFAULT_MAX_MESSAGES)))
  const picked = []
  let used = 0
  let truncated = tail.length < totalMessages
  for (let i = tail.length - 1; i >= 0; i -= 1) {
    const m = tail[i]
    const role = m.role === 'user' ? '用户' : m.role === 'assistant' ? '助手' : String(m.role ?? '消息')
    const c = clip(m.content, Number(maxMessageChars) || DEFAULT_MAX_MESSAGE_CHARS)
    if (c.clipped) truncated = true
    const block = `**${role}**\n\n${c.text}\n`
    if (used + block.length > Number(maxChars || DEFAULT_MAX_CHARS) && picked.length > 0) {
      truncated = true
      break
    }
    picked.unshift(block)
    used += block.length
  }
  const title = body.name || index?.conversations?.find((e) => e.file)?.name || '(未命名会话)'
  const id = body.conversationId || conversationId || '(未知)'
  const archiveCount = Array.isArray(index?.conversations) ? index.conversations.length : 0
  const markdown = [
    '# 豆包对话交接单(切号续聊用)',
    '',
    `- 来源会话：${title}`,
    `- conversationId：${id}`,
    `- 归档目录：${archiveDir || '(未知)'}`,
    `- 归档会话数：${archiveCount}（本单只带最近一条,其余会话仍在归档目录）`,
    `- 归档导出时间：${body.exportedAt || index?.generatedAt || '(未知)'}`,
    `- 原会话消息：${totalMessages} 条；本单保留最近 ${picked.length} 条${truncated ? '(有截断)' : ''}`,
    '- 边界：这是**上下文交接单**,不是新号的原生历史;新号新建会话后把本单内容作为首条消息发送,即可接着聊。',
    '',
    '## 对话记录',
    '',
    ...picked,
    '## 续聊要求',
    '',
    '请直接基于以上对话继续,保持原有结论、口径、待办与已否决方案;不要重新总结,也不要重复已完成的步骤。',
    '',
  ].join('\n')
  return {
    ok: true,
    code: 'ok',
    markdown,
    messages: picked.length,
    totalMessages,
    truncated,
    conversationId: id,
    name: title,
  }
}

/**
 * 从归档目录生成 `handoff.md`。纯本地文件操作,零网络、零 cookie。
 * @returns {{ok:boolean, code:string, file:string|null, conversationId:string, name:string,
 *   messages:number, totalMessages:number, truncated:boolean, note:string}}
 */
export function buildHandoffFile({
  archiveDir,
  outFile,
  conversationId = '',
  maxMessages = DEFAULT_MAX_MESSAGES,
  maxChars = DEFAULT_MAX_CHARS,
  deps = {},
} = {}) {
  const fsImpl = deps.fs ?? fs
  const pathImpl = deps.path ?? path
  try {
    const index = JSON.parse(fsImpl.readFileSync(pathImpl.join(archiveDir, 'index.json'), 'utf8'))
    const picked = pickHandoffConversation(index, conversationId)
    if (!picked.ok) {
      return {
        ok: false,
        code: picked.code,
        file: null,
        conversationId: '',
        name: '',
        messages: 0,
        totalMessages: 0,
        truncated: false,
        note:
          picked.code === 'conversation-not-found'
            ? `交接单未生成:归档里没有会话 ${conversationId}`
            : '交接单未生成:归档里没有带正文的会话(导出全失败或全为空)',
      }
    }
    const body = JSON.parse(fsImpl.readFileSync(pathImpl.join(archiveDir, picked.entry.file), 'utf8'))
    const rendered = renderHandoff({
      index,
      body,
      conversationId: picked.entry.conversationId,
      archiveDir,
      maxMessages,
      maxChars,
    })
    if (!rendered.ok) {
      return {
        ok: false,
        code: rendered.code,
        file: null,
        conversationId: picked.entry.conversationId ?? '',
        name: '',
        messages: 0,
        totalMessages: rendered.totalMessages ?? 0,
        truncated: false,
        note: '交接单未生成:该会话没有可用的文本消息',
      }
    }
    const target = outFile || pathImpl.join(archiveDir, 'handoff.md')
    fsImpl.mkdirSync(pathImpl.dirname(target), { recursive: true })
    fsImpl.writeFileSync(target, rendered.markdown, 'utf8')
    return {
      ok: true,
      code: 'ok',
      file: target,
      conversationId: rendered.conversationId,
      name: rendered.name,
      messages: rendered.messages,
      totalMessages: rendered.totalMessages,
      truncated: rendered.truncated,
      note:
        `交接单 ✓ ${rendered.name} 最近 ${rendered.messages}/${rendered.totalMessages} 条` +
        `${rendered.truncated ? '(有截断)' : ''} → ${target}`,
    }
  } catch (e) {
    return {
      ok: false,
      code: 'handoff-threw',
      file: null,
      conversationId: '',
      name: '',
      messages: 0,
      totalMessages: 0,
      truncated: false,
      note: `交接单生成失败:${e instanceof Error ? e.message : String(e)}`,
    }
  }
}

export const __test__ = {
  DEFAULT_MAX_MESSAGES,
  DEFAULT_MAX_CHARS,
  clip,
  pickHandoffConversation,
  renderHandoff,
  buildHandoffFile,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
