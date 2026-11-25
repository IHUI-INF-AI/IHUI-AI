// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 入口解码归一化(2026-11-25 立,补齐 WAF 单轮解码的绕过面)。
 *
 * 洞在哪:`waf-signatures.mjs` 原 `normalizeScanTarget` 只 `decodeURIComponent` 一次。
 * 攻击串 `%2527%2520union%2520select%25201` 解一次得 `%27%20union%20select%201` ——
 * 规则里的 `union\s+select` 不命中;而只要下游任何一层再解一次,剩下的 `%27%20…`
 * 就还原成真实载荷。**判定之前必须先把串收敛到定值**,否则规则表写得再全也能被套娃绕过。
 *
 * 纪律(四条,改之前先读):
 *   · 纯函数、零 IO、**绝不抛**:任何非法编码回落原文继续下一轮,不能让一个畸形
 *     请求把判定路径打成异常(router 里未捕获异常 = 进程退出,2026-11-24 踩过);
 *   · 只用于**判定**,绝不改写 req.url —— 路由匹配与上游转发必须看原串;
 *   · 轮数上限 3:真实绕过极少超过两层,再多只放大 CPU;
 *   · NFKC 只做兼容字符折叠(全角→半角、兼容数字),不动 ASCII 结构;
 *     放在每轮末尾,这样「全角百分号 + 数字」也能在下一轮被解出来。
 */

const MAX_ROUNDS = 3
const CONTROL = /[\u0000-\u001f\u007f\u200b-\u200f\u2060\ufeff]/g
const ENTITY_DEC = /&#(\d{1,7});/g
const ENTITY_HEX = /&#x([0-9a-fA-F]{1,6});/g
const ESCAPE_U = /\\u([0-9a-fA-F]{4})/g
const ESCAPE_X = /\\x([0-9a-fA-F]{2})/g
const NAME_RE = /&(lt|gt|amp|quot|apos);/g
const NAMED = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" }

function codePointOf(n) {
  if (!Number.isFinite(n) || n < 0 || n > 0x10ffff) return ''
  try {
    return String.fromCodePoint(n)
  } catch {
    return ''
  }
}

/** 单轮:百分比 → 实体 → 反斜杠转义 → 剥控制字符 → 兼容折叠。非法编码不抛。 */
export function decodeOnce(text) {
  let out = String(text ?? '')
  try {
    out = decodeURIComponent(out)
  } catch {
    /* 非法编码:保持原样进下一轮,绝不抛 */
  }
  out = out
    .replace(ENTITY_HEX, (m, h) => codePointOf(parseInt(h, 16)) || m)
    .replace(ENTITY_DEC, (m, d) => codePointOf(parseInt(d, 10)) || m)
    .replace(NAME_RE, (m, n) => NAMED[n] ?? m)
    .replace(ESCAPE_U, (m, h) => codePointOf(parseInt(h, 16)) || m)
    .replace(ESCAPE_X, (m, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(CONTROL, '')
  try {
    out = out.normalize('NFKC')
  } catch {
    /* 老环境无 NFKC:保持原样 */
  }
  return out
}

/**
 * 多轮归一化。返回 `{ text, rounds, truncated }`:
 *   rounds = 实际发生变化的轮数(0 表示原串已是最简,便于日志区分"没解码"与"解到底");
 *   truncated = 是否被 slice 截断(截断即后续判定只覆盖前 N 字符)。
 */
export function decodeChain(raw, { maxRounds = MAX_ROUNDS, slice = 2048 } = {}) {
  let text = String(raw ?? '')
  let rounds = 0
  for (let i = 0; i < maxRounds; i++) {
    const next = decodeOnce(text)
    if (next === text) break
    text = next
    rounds++
  }
  return { text: text.slice(0, slice), rounds, truncated: text.length > slice }
}

export const __test__ = { decodeChain, decodeOnce, MAX_ROUNDS }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
