// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 反向回归锁:safe-commit 的多 `-m` 语义不得退回"后者覆盖前者"。
//
// 为什么只能锁源码形态:本工具没有 §22d 的 isDirectRun 守卫(顶层就是 CLI 主流程,import 即跑一次
// 提交链),而把它改成有守卫的形态等于动全队都在用的提交入口 —— 风险大于收益。
// 所以这里锁"判据所依赖的那一行写法",行为端到端证明交给下一次真实提交后回读 `%s`(已登记的规矩)。
//
// 成因(实测四次同型):`message = args[++i]` 让最后一段正文成了整条消息,主题行就此消失,
// 而提交"成功"、钩子全绿、git log 里只有一坨正文 —— 2026-09-23 的 22d87f1b6 / 920d655dd,
// 2026-09-27 的 440675aa87 / 025a0a982a 都是它。两枚主题丢失的提交当时已在本地,内容完好,
// 按 §22 不改写历史,所以这条锁是唯一还能做的事。
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { maskCommentsAndStrings } from '../lib/code-mask.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC = readFileSync(join(HERE, '..', 'safe-commit.mjs'), 'utf8')
// 判据面 = 剥掉注释与字符串后的代码面。本锁第一版直接测原文,结果它把自己头注里那句
// 「旧写法 `message = args[++i]`」判成了违规 —— 同一型在守门 131 上也咬过一次
// (门判红自己解释缺陷的那行注释)。**说明性文字会带执行性字符,尺子必须只量执行面。**
const CODE = maskCommentsAndStrings(SRC)

test('S1 主题不得被后续 -m 覆盖:旧的单变量赋值写法不得回来', () => {
  assert.doesNotMatch(
    CODE,
    /message\s*=\s*args\[\+\+i\]/,
    '又写回 `message = args[++i]` 了 ⇒ 多段 -m 只剩最后一段,主题行会消失',
  )
  assert.match(CODE, /messageParts\.push\(args\[\+\+i\]\)/, '解析必须收进数组')
  // 这一条要认的是**字面量**('\n\n'),而 maskCommentsAndStrings 会把字符串抹白 —— 所以它判原文,
  // 不判代码面。两类判据各用各的面,反过来用会让"必须存在的字符串"永远匹配不到。
  assert.match(
    SRC,
    /messageParts[\s\S]{0,200}\.join\('\\n\\n'\)/,
    '必须以空行拼接成一条消息(git 的多段语义)',
  )
})

test('S1b 遮噪声的层必须真在干活,又不能把真违规一起遮掉(双向合成面证明,不依赖头注措辞)', () => {
  const HAS = /message\s*=\s*args\[\+\+i\]/
  const noise = [
    '// 旧写法 `message = args[++i]` 会丢主题 —— 这句是说明,不是执行面',
    'const keep = "message = args[++i]" // 字符串里的同样字样也不该被当违规',
    'const untouched = args[++i] // 真代码留原样',
  ].join('\n')
  assert.equal(
    HAS.test(maskCommentsAndStrings(noise)),
    false,
    '说明与字符串里的旧写法都不得进入判据面',
  )
  assert.equal(HAS.test(noise), true, '阳性对照:原文里确实有那些字样,否则这条对照没有意义')
  assert.match(maskCommentsAndStrings(noise), /const untouched = args\[\+\+i\]/)
  // 真违规必须照样看得见 —— 否则 S1 就成了"永远不红"的装饰
  const violation = ['const messageParts = []', 'let message = args[++i]'].join('\n')
  assert.equal(HAS.test(maskCommentsAndStrings(violation)), true, '把真代码退回旧写法时本锁必须红')
})

test('S2 空消息仍判死:拼接后的 message 为空时必须 exit 2,不许提交空主题', () => {
  assert.match(CODE, /if \(!message\) \{[\s\S]{0,160}exit\(2\)/)
})

test('S3 阳性对照:本文件测的是真源码而不是自己的复读(把锚点行删掉就该红)', () => {
  // 若 safe-commit 里连"用法说明"都没了(工具改名/搬家),本锁应当失效并被发现,而不是静默通过
  assert.match(SRC, /safe-commit\.mjs -m/, '夹具与真实源码脱节时,本锁应当红而不是绿')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
