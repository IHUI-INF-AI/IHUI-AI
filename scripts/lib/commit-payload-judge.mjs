// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//
// 提交载荷**相等性**判据(seat-safecommit,2026-10-25 立;票面出处见 safe-commit.mjs Step 5 注)。
//
// 为什么单独一格、而且只有这一份:
//   `safe-commit.mjs` 的整个主体是顶层线性 CLI(它没有、也不该有 §22d `isDirectRun` 守卫 ——
//   把 1800 行主体包进 main() 是重写它),import 它会当场解析 argv 并 exit 2。所以判据想被
//   §22c 镜像测试**直接 import**,只能住在这里;提交器与测试 import 的是同一份实现,不存在"测试里
//   另写一遍断言"的第二把尺子(§0.6)。
//
// 立因(2026-10-25,seat-apiclient 实测):旧 Step 5 只判 `实到 ⊖ 预期`(多出来的),
//   实到集合为空 ⇒ 差集为空 ⇒ 打印「commit 干净,仅包含 0 个预期文件」并 exit 0。
//   两次实害:`c8f2750a5c`、`56227f8b33` 被打成空提交 —— 钩子链跑的 9 分钟里,暂存面被并发
//   会话 safe-commit Step1 的 `git reset HEAD` 清空,而本器 Step5 对空集判绿。实测复现见
//   `scripts/tests/safe-commit-payload-equality.test.mjs` 的夹具①(pre-commit 钩子里 reset)。
//   第二型同源:实到 ⊂ 预期(只落地了一部分)同样走绿 —— 旧判据是"⊆"不是"=="。
//
// 判据语义(三档,全部基于**已归一化的路径身份**):
//   预期集合为空        ⇒ kind='no-expected'   —— 拒绝判绿(Step 1 已先拒;此处是"判据必须在
//                                                 真跑它的那一刻成立"的自证,防上游被改)
//   实到集合为空        ⇒ kind='empty-commit'   —— 提交窗口内暂存面被清空(并发 reset)
//   实到 ≠ 预期        ⇒ kind='extra' / 'missing'(两者都非空时 kind='extra',两个清单都回报)
//   实到 == 预期 且非空 ⇒ kind='exact' ⇒ ok=true
//
// 归一化(反斜杠→斜杠、去 `./`)不在这里再做一遍:那是路径身份口径,`safe-commit.mjs` 的
// `normalize()` 是唯一实现,调用方必须传入已归一化的清单。本模块**零 IO、零子进程**。
export function judgeCommitPayload({ expected, actual } = {}) {
  const asList = (v) => [...new Set((Array.isArray(v) ? v : []).filter((f) => typeof f === 'string' && f))]
  const exp = asList(expected)
  const act = asList(actual)
  const base = { expected: exp, actual: act, missing: [], extra: [] }
  if (exp.length === 0) return { ...base, ok: false, kind: 'no-expected' }
  if (act.length === 0) return { ...base, ok: false, kind: 'empty-commit', missing: exp }
  const expSet = new Set(exp)
  const actSet = new Set(act)
  const extra = act.filter((f) => !expSet.has(f))
  const missing = exp.filter((f) => !actSet.has(f))
  if (extra.length > 0) return { ...base, ok: false, kind: 'extra', extra, missing }
  if (missing.length > 0) return { ...base, ok: false, kind: 'missing', missing }
  return { ...base, ok: true, kind: 'exact' }
}

export const __extern__ = { judgeCommitPayload }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
