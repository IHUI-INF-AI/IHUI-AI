// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 微信智联导出渲染器（纯函数，零 IO）。
 *
 * 覆盖 WeFlow 那套导出矩阵里我们真正需要的四种文本形态：
 *  - html     单文件、离线可开、带搜索与气泡排版，适合直接发给客户/存档
 *  - markdown 适合进文档库、喂给 AI、贴进飞书
 *  - chatlab  结构化交换格式（conversations / messages 两层），可被 ChatLab 类工具读
 *  - xlsx     真 Excel（见 export.ts 的 exceljs 分支）
 *
 * 约束：所有用户可写字段（昵称/正文/标题）必须转义后再拼接，禁止裸插模板。
 */

export interface ExportMessageRow {
  id: string
  conversationId: string
  conversationTitle: string
  conversationKind: string
  direction: string
  kind: string
  content: string
  mediaUrl: string | null
  senderId: string | null
  senderName: string | null
  platformMessageId: string
  sentAt: Date
}

export interface ExportConversationMeta {
  id: string
  title: string
  kind: string
  platformChatId: string
}

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ESCAPES[char] ?? char)
}

/** 固定时区格式化，避免服务器 UTC 与用户本地时间错位。 */
export function formatInZone(date: Date, timezone: string, withSeconds = true): string {
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    ...(withSeconds ? { second: '2-digit' } : {}),
    hour12: false,
  }).formatToParts(date)
  const pick = (type: string): string => parts.find((part) => part.type === type)?.value ?? '00'
  const base = `${pick('year')}-${pick('month')}-${pick('day')} ${pick('hour')}:${pick('minute')}`
  return withSeconds ? `${base}:${pick('second')}` : base
}

export function dayKey(date: Date, timezone: string): string {
  return formatInZone(date, timezone, false).slice(0, 10)
}

/** 目标时区相对 UTC 的偏移（分钟）。用于把「某地某天 0 点」换成绝对时间。 */
export function zoneOffsetMinutes(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date)
  const pick = (type: string): number => Number(parts.find((part) => part.type === type)?.value)
  const hour = pick('hour') === 24 ? 0 : pick('hour')
  const asUtc = Date.UTC(
    pick('year'),
    pick('month') - 1,
    pick('day'),
    hour,
    pick('minute'),
    pick('second'),
  )
  return Math.round((asUtc - date.getTime()) / 60_000)
}

/** 目标时区「今天 0 点」的绝对时间；offsetDays 为负表示往前推几天。 */
export function dayStartUtc(offsetDays: number, timezone: string, now = new Date()): Date {
  const key = dayKey(now, timezone)
  const dateKey = new Date(`${key}T00:00:00Z`)
  dateKey.setUTCDate(dateKey.getUTCDate() + offsetDays)
  const composed = `${dateKey.toISOString().slice(0, 10)}T00:00:00Z`
  const guess = new Date(composed)
  return new Date(guess.getTime() - zoneOffsetMinutes(guess, timezone) * 60_000)
}

function displayName(row: ExportMessageRow): string {
  if (row.direction === 'outbound') return '我'
  return row.senderName?.trim() || row.senderId?.trim() || '对方'
}

function contentText(row: ExportMessageRow): string {
  const body = row.content.trim()
  const media = row.mediaUrl?.trim()
  if (body.length > 0) return media ? `${body}\n[${row.kind}] ${media}` : body
  if (media) return `[${row.kind}] ${media}`
  return `[${row.kind}]`
}

function groupByConversation(
  conversations: ExportConversationMeta[],
  messages: ExportMessageRow[],
): Array<{ conversation: ExportConversationMeta; messages: ExportMessageRow[] }> {
  const byConversation = new Map<string, ExportMessageRow[]>()
  for (const message of messages) {
    const list = byConversation.get(message.conversationId)
    if (list) list.push(message)
    else byConversation.set(message.conversationId, [message])
  }
  return conversations
    .filter((conversation) => byConversation.has(conversation.id))
    .map((conversation) => ({
      conversation,
      messages: byConversation.get(conversation.id) as ExportMessageRow[],
    }))
}

function summarize(messages: ExportMessageRow[]) {
  const participants = new Set<string>()
  let chars = 0
  for (const message of messages) {
    chars += message.content.length
    participants.add(`${message.direction}:${message.senderId ?? 'self'}`)
  }
  const startAt = messages[0]?.sentAt ?? null
  const endAt = messages[messages.length - 1]?.sentAt ?? null
  return { count: messages.length, chars, participants: participants.size, startAt, endAt }
}

/** Markdown：会话分节 + 时间线，正文原样保留（Markdown 本身不是 HTML，无需转义）。 */
export function renderMarkdown(
  accountLabel: string,
  conversations: ExportConversationMeta[],
  messages: ExportMessageRow[],
  timezone: string,
): string {
  const groups = groupByConversation(conversations, messages)
  const summary = summarize(messages)
  const lines: string[] = [
    `# ${accountLabel} 微信聊天记录`,
    '',
    `- 导出时间：${formatInZone(new Date(), timezone, false)}（${timezone}）`,
    `- 会话数：${groups.length}`,
    `- 消息数：${summary.count}`,
    `- 时间范围：${
      summary.startAt && summary.endAt
        ? `${formatInZone(summary.startAt, timezone, false)} ~ ${formatInZone(summary.endAt, timezone, false)}`
        : '无'
    }`,
    '',
  ]
  for (const group of groups) {
    lines.push(`## ${group.conversation.title || group.conversation.platformChatId}`, '')
    lines.push(`> ${group.conversation.kind} · ${group.messages.length} 条`, '')
    for (const message of group.messages) {
      const text = contentText(message).replaceAll('\n', '\n  ')
      lines.push(
        `- **${displayName(message)}** · ${formatInZone(message.sentAt, timezone, false)}：${text}`,
      )
    }
    lines.push('')
  }
  return lines.join('\n')
}

/** HTML：单文件自包含，带搜索框、日期分隔、左右气泡、统计头。 */
export function renderHtml(
  accountLabel: string,
  conversations: ExportConversationMeta[],
  messages: ExportMessageRow[],
  timezone: string,
): string {
  const groups = groupByConversation(conversations, messages)
  const summary = summarize(messages)
  const rangeText =
    summary.startAt && summary.endAt
      ? `${formatInZone(summary.startAt, timezone, false)} ~ ${formatInZone(summary.endAt, timezone, false)}`
      : '无'
  const sections: string[] = []
  for (const group of groups) {
    const title = escapeHtml(group.conversation.title || group.conversation.platformChatId)
    const bubbles: string[] = []
    let lastDay = ''
    for (const message of group.messages) {
      const day = dayKey(message.sentAt, timezone)
      if (day !== lastDay) {
        bubbles.push(`<div class="day"><span>${escapeHtml(day)}</span></div>`)
        lastDay = day
      }
      const outbound = message.direction === 'outbound'
      bubbles.push(
        [
          `<div class="row ${outbound ? 'out' : 'in'}" data-search="${escapeHtml(
            `${displayName(message)} ${message.content}`.toLowerCase(),
          )}">`,
          `<div class="meta"><b>${escapeHtml(displayName(message))}</b><time>${escapeHtml(
            formatInZone(message.sentAt, timezone, false),
          )}</time></div>`,
          `<div class="bubble">${escapeHtml(contentText(message)).replaceAll('\n', '<br>')}</div>`,
          '</div>',
        ].join(''),
      )
    }
    sections.push(
      [
        `<section class="conv" data-title="${title}">`,
        `<h2>${title}<small>${escapeHtml(group.conversation.kind)} · ${group.messages.length} 条</small></h2>`,
        `<div class="stream">${bubbles.join('')}</div>`,
        '</section>',
      ].join(''),
    )
  }

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(accountLabel)} 微信聊天记录</title>
<style>
:root{color-scheme:light dark;--bg:#f5f6f8;--card:#fff;--text:#1f2328;--muted:#7a828c;--in:#fff;--out:#95ec69;--line:#e6e8eb}
@media (prefers-color-scheme:dark){:root{--bg:#141517;--card:#1d1f22;--text:#e8eaed;--muted:#9aa3ad;--in:#26282c;--out:#2f6b3a;--line:#2c2f33}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font:14px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif}
header{position:sticky;top:0;z-index:9;padding:14px 20px;background:var(--card);border-bottom:1px solid var(--line);display:flex;gap:12px;align-items:center;flex-wrap:wrap}
header h1{margin:0;font-size:16px}
header .stats{color:var(--muted);font-size:12px}
header input{flex:1;min-width:180px;padding:8px 12px;border:1px solid var(--line);border-radius:999px;background:var(--bg);color:var(--text);outline:none}
main{max-width:860px;margin:0 auto;padding:16px 14px 60px}
.conv{background:var(--card);border:1px solid var(--line);border-radius:14px;margin:14px 0;overflow:hidden}
.conv h2{font-size:15px;margin:0;padding:12px 16px;border-bottom:1px solid var(--line)}
.conv h2 small{font-weight:400;color:var(--muted);margin-left:8px;font-size:12px}
.stream{padding:12px 14px}
.day{text-align:center;margin:10px 0}
.day span{font-size:12px;color:var(--muted);background:var(--bg);padding:2px 10px;border-radius:999px}
.row{display:flex;flex-direction:column;margin:10px 0;max-width:76%}
.row.in{align-items:flex-start}
.row.out{align-items:flex-end;margin-left:auto}
.meta{display:flex;gap:6px;font-size:12px;color:var(--muted);margin-bottom:3px}
.bubble{padding:8px 11px;border-radius:10px;background:var(--in);border:1px solid var(--line);white-space:normal;word-break:break-word}
.row.out .bubble{background:var(--out);border-color:transparent;color:#0b1a0e}
@media (prefers-color-scheme:dark){.row.out .bubble{color:#eaf7ec}}
.row.hide{display:none}
</style>
</head>
<body>
<header>
  <h1>${escapeHtml(accountLabel)} 微信聊天记录</h1>
  <span class="stats">${groups.length} 个会话 · ${summary.count} 条 · ${escapeHtml(rangeText)} · ${escapeHtml(timezone)}</span>
  <input id="q" placeholder="搜索昵称或内容…" autocomplete="off">
</header>
<main id="main">${sections.join('\n')}</main>
<script>
(function(){
  var input=document.getElementById('q');
  var rows=Array.prototype.slice.call(document.querySelectorAll('.row'));
  input.addEventListener('input',function(){
    var term=input.value.trim().toLowerCase();
    rows.forEach(function(row){
      row.classList.toggle('hide', term.length>0 && row.getAttribute('data-search').indexOf(term)===-1);
    });
    Array.prototype.forEach.call(document.querySelectorAll('.conv'),function(conv){
      var visible=conv.querySelectorAll('.row:not(.hide)').length;
      conv.style.display=term.length>0 && visible===0 ? 'none':'';
    });
  });
})();
</script>
</body>
</html>`
}

/**
 * ChatLab 交换格式：conversations / messages 两层，一条消息同时带
 * isSelf、sender、timestamp（毫秒）与 type，方便下游按“谁说的、什么时候”重建时间线。
 */
export function renderChatLab(
  accountLabel: string,
  conversations: ExportConversationMeta[],
  messages: ExportMessageRow[],
): Record<string, unknown> {
  const groups = groupByConversation(conversations, messages)
  return {
    format: 'chatlab',
    version: 1,
    exportedAt: new Date().toISOString(),
    account: { label: accountLabel },
    conversations: groups.map((group) => ({
      id: group.conversation.id,
      platformChatId: group.conversation.platformChatId,
      title: group.conversation.title || group.conversation.platformChatId,
      kind: group.conversation.kind,
      messageCount: group.messages.length,
      messages: group.messages.map((message) => ({
        id: message.platformMessageId || message.id,
        timestamp: message.sentAt.getTime(),
        time: message.sentAt.toISOString(),
        sender: displayName(message),
        senderId: message.senderId,
        isSelf: message.direction === 'outbound',
        type: message.kind,
        content: message.content,
        mediaUrl: message.mediaUrl,
      })),
    })),
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
