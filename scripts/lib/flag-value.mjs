// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 带值旗标的**唯一取值出口**(G-322)。
//
// 立据:`grep -rn "^function flagValue" scripts/` 在普查当日命中 **9 份逐字副本**(分散在门、
// 归并器、pre-deploy、migrate、lib/plan-line-age),这正是 §22c「同类实现全仓只许一份,第二份必然
// 漂移」的形状;而 `.ihui-agent/archive/flag-value-census-2026-09-28.md` 量到的后果不是"代码难看",
// 是**结论造假**:60 个取值点里 38 处静默降级 —— `--root`(结尾无值)26/56 站、`--root ""`
// 34/56 站照常出具 `✅ 通过`,因为旧写法要么 `argv[i+1]` 直传 `undefined`(裸栈),
// 要么 `|| '.'` / `!v.startsWith('-') ? v : null` 主动把坏值折回默认根。
//
// 因此本文件只锁一条口径,调用方一律不许自己重写:
//   **给了旗标就必须给一个"值"——非空字符串、且不以 `-` 开头;否则算错,绝不回落默认。**
// 不给旗标是合法用法(走调用方的默认档),给了旗标却不给值则是用法错 —— 这两件事必须可区分,
// 旧代码把它们混成一件事(`f.value || DEFAULT`)就是成片静默的根因。
//
// 三态点名(`describeFlagToken`)照普查里已收口的正解写:值被下一个旗标顶掉 / 结尾无值 / 空串
// 是三种不同的错,只断言其中一支会在另两支留洞(census「三支坏值不等价」一节)。

/** 紧邻旗标的那个 token 是不是一个"值":必须是字符串、非空、且不以 `-` 开头。 */
export function isFlagValueToken(token) {
  return typeof token === 'string' && token !== '' && !token.startsWith('-')
}

/**
 * 取 `flag` 紧邻的那个 token,**不判定好坏** —— 只把"给了没给"和"给的是什么"如实交出来。
 *
 * 语义(与它取代的那 9 份副本逐字同形,故替换是行为不变的):
 * - `list` 里没有 `flag` ⇒ `{ present: false, valid: false, value: null, token: null }`
 * - 有 `flag` 但紧邻 token 不是合法值 ⇒ `{ present: true, valid: false, value: null, token }`
 *   (空串 ⇒ `token: ''`;结尾无值或非字符串 ⇒ `token: null`)
 * - 有 `flag` 且紧邻 token 合法 ⇒ `{ present: true, valid: true, value: token, token }`
 *
 * 出现多次时按**第一次**取(沿用旧副本的 `indexOf`,不得顺手改成"最后一次"——那是行为变更)。
 */
export function flagValue(list, flag) {
  if (!Array.isArray(list) || !list.includes(flag)) return { present: false, valid: false, value: null, token: null }
  const raw = list[list.indexOf(flag) + 1]
  const token = typeof raw === 'string' ? raw : null
  const valid = isFlagValueToken(token)
  return { present: true, valid, value: valid ? token : null, token }
}

/**
 * 把"实得了什么"写成一句能定位的话 —— 三态分开,不接受笼统的"参数错误"。
 * 用法错必须能让读到那行的人知道**自己少打了什么**,否则等于让人再猜一轮。
 */
export function describeFlagToken(f) {
  if (!f.present) return '(未给出该旗标)'
  if (f.token === null) return '(其后没有任何参数)'
  return JSON.stringify(f.token)
}

/**
 * 「给了旗标就要有值」的判定出口。
 *
 * 返回 `{ present, value, error }`:
 * - 没给旗标 ⇒ `{ present: false, value: fallback, error: null }` —— 调用方按默认档走;
 * - 给了但值无效 ⇒ `{ present: true, value: null, error: '<旗标> 需要…—— 紧邻的 token 实得:X;不得静默退回…' }`
 *   —— **调用方必须非零退出并打印 error**,不得把 `value: null` 当"没给"处理(那正是本票要消的形态);
 * - 给了且值有效 ⇒ `{ present: true, value: '<原样 token>', error: null }`。
 *
 * 域名校验(目录存在吗 / 端口是数字吗 / face 在枚举里吗)留给调用方 —— 本出口只管"值有没有被吞",
 * 免得把某一扇门的判据塞进公共层,变成第二个漂移点。
 */
export function requireFlagValue(list, flag, opts = {}) {
  const f = flagValue(list, flag)
  const noun = opts.noun ?? '参数'
  const fallback = opts.fallback ?? null
  if (!f.present) return { present: false, value: fallback, error: null }
  if (!f.valid) {
    return {
      present: true,
      value: null,
      error: `${flag} 需要一个${noun} —— 紧邻的 token 实得:${describeFlagToken(f)}(不得静默退回默认)`,
    }
  }
  return { present: true, value: f.value, error: null }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
