// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 控制命令「文本形态」判定 —— 共享层唯一实现(G-11 a 格,2026-10-26 立)。
//
// 为什么要有它:`@ihui/shared/chat/input-notices.ts` 的排队拒因里有两格的条件输入是
// `isControlCommand`(「本次动作的对象是否控制命令」),而全仓现读**没有任何生产者** ——
// 唯一赋值点是 `apps/web/src/components/chat/message-input.tsx` 里写死的 `false`。
// 「造好没装车 = 没有」(AGENTS §0.9):那两格(`denied.cause.controlCommand` /
// `blocked.controlCommandNoInterject`)结构上永远判不出来。本文件补的是**判定本体**,
// 端内只做「取本端名单 + 取动作对象的正文」两件事。
//
// 为什么名单不在这里写死(§0.6 单一真相源 + §3 工厂/依赖注入先例 `app-control-intent.ts`):
// 命令名单在各端不同(web 的工具型斜杠命令登记在 `apps/web/src/lib/command-registry.ts`
// 的 `CHAT_TOOL_COMMANDS`,别端族名未必相同)。判据(形态怎么算控制命令)只许这一份,
// 名单(哪些名字算)由各端注入 —— 在此写死等于把 web 的清单抄进共享层,第二份必然漂移。
//
// 与执行侧的对齐纪律(重要,别"顺手放宽"):
//   web 的执行侧 `apps/web/src/hooks/use-chat/slash-commands.ts` 的 `tryHandleToolSlash`
//   用 `/^\/(diff|status|model|mcp|compact)\b\s*$/.exec(text.trim())` 认领命令 ——
//   **区分大小写**、**整条正文就是命令本身(不带参数)**。拒因必须与执行侧同形:
//   执行侧不会当命令执行的那串字,这里不得自称"这是控制命令"并据此拦下用户的插话,
//   那是把用户误导成"队列里这条发不出去是因为它是控制命令"。
//   ⇒ 改执行侧形态时,请同批改本文件的名单注入点(端内适配层),不要在这里加选项放宽。
//
// 纯度纪律:零 `node:` 内建、零 React、零 i18n、零 I/O(守门 126 shared 非 Node 宿主纯度)。

/** 斜杠命令前缀(全站同形:输入框敲的字面量与名单登记形态都带它) */
export const CONTROL_COMMAND_PREFIX = '/'

/**
 * 命令名的合法字符集:首字符字母或数字,其后可含 `.` `_` `-`。
 * 空格 / 斜杠 / 换行一律不是命令名字符 —— 所以 `/compact now`、`//compact`、
 * `/compact\n请压缩` 都不是"一条命令",而是一串普通正文。
 */
const CONTROL_COMMAND_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/

/**
 * 名单条目归一化:去首尾空白、剥掉前导斜杠,形态不合法 ⇒ null(不是抛错、不是当空串匹配)。
 *
 * 接受 `'/compact'` 与 `'compact'` 两种登记形态(端内名单常带斜杠字面量,见
 * `CHAT_TOOL_COMMANDS[].slash`),比对时两侧都归一到裸名,免得"带不带斜杠"变成第三种真相。
 * **不做大小写折叠**(与执行侧正则同形,见文件头)。
 */
export function normalizeControlCommandName(name: string): string | null {
  const raw = name.trim()
  const bare = raw.startsWith(CONTROL_COMMAND_PREFIX)
    ? raw.slice(CONTROL_COMMAND_PREFIX.length)
    : raw
  return CONTROL_COMMAND_NAME_PATTERN.test(bare) ? bare : null
}

/**
 * 名单归一化 + 去重(保持声明顺序)。非法条目被丢弃 ⇒ 名单为空时判定恒 false,
 * 这是"没有登记就没有控制命令"的诚实形态,不得用来给任意文本放行。
 */
export function normalizeControlCommandNames(names: readonly string[]): readonly string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const name of names) {
    const bare = typeof name === 'string' ? normalizeControlCommandName(name) : null
    if (bare === null || seen.has(bare)) continue
    seen.add(bare)
    out.push(bare)
  }
  return out
}

/**
 * 取一条正文所「就是」的命令名:整条 trim 后必须是 `/<合法命令名>` 本体,否则 null。
 *
 * 刻意不用正则量整个串以外的部分:`\s*$` 在执行侧只吞尾随空白,trim 后等价,
 * 所以"尾随空白/尾随换行仍算命中"与执行侧一致(先 trim 再比)。
 */
export function extractControlCommandName(text: string): string | null {
  if (typeof text !== 'string' || text.length === 0) return null
  const trimmed = text.trim()
  if (!trimmed.startsWith(CONTROL_COMMAND_PREFIX)) return null
  // 双斜杠不是命令(`//compact` 是注释/路径形态)
  if (trimmed.startsWith(CONTROL_COMMAND_PREFIX + CONTROL_COMMAND_PREFIX)) return null
  const bare = trimmed.slice(CONTROL_COMMAND_PREFIX.length)
  return CONTROL_COMMAND_NAME_PATTERN.test(bare) ? bare : null
}

/**
 * 一条正文是否**就是**名单里登记的控制命令(判定本体,唯一实现)。
 *
 * @param text   待判正文(动作对象的原文,调用方负责取值,本函数不取数)
 * @param names  本端控制命令名单(带不带前导斜杠皆可;空名单 ⇒ 恒 false)
 */
export function isControlCommandText(text: string, names: readonly string[]): boolean {
  const bare = extractControlCommandName(text)
  if (bare === null) return false
  for (const name of names) {
    if (normalizeControlCommandName(name) === bare) return true
  }
  return false
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
