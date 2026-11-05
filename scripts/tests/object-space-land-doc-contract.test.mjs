// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 形状锁:scripts/object-space-land.mjs 的**文档面**(头注 + 用户可见提示)必须与器物现行行为逐字一致。
//
// 立因(AGENTS §0.9 / §12f 点名那一型):头注⑤与"新建路径注入"档的 stdout 曾把盘上面写成绝对表述
// ("工作树副本一个字节都不写 / 本器绝不写工作树"),而 AGENTS §5b-④ 的落地欠回写层与
// `scripts/lib/landing-worktree-align.mjs` 让本器**只补盘上根本没有的声明路径**(盘上已有副本 ⇒
// `existsSync` 那一格跳过;索引 blob 与父提交态不一致 ⇒ 归属他人不动并点名;「N 未判定 / N 归属他人」
// ⇒ 退出码 2)。旧绝对表述会把下一席往两个方向都读歪:①以为落地后不必再校验磁盘,②反过来以为
// 写盘必然越界、于是绕过本器手搓临时索引。
//
// 本锁**只判文档面**(注释与提示字符串),不碰任何判据/阈值/退出码分支 —— 行为由
// `scripts/tests/object-space-land.test.mjs`(97 枚)与 remove / json-guard 两档镜像钉着。
// 每条断言都配阳面对照:把旧句伪造回去、或把关键短语摘掉,锁必须抓到(恒真锁当场自曝)。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const TOOL = join(HERE, '..', 'object-space-land.mjs')
const ALIGN = join(HERE, '..', 'lib', 'landing-worktree-align.mjs')

/**
 * 禁语:把盘上面写成"工具级绝对不动"的那几类句子。行为早已是"盘上没有才补",
 * 这类表述一旦回潮就是文档与行为相反(§0.9)。
 */
const FORBIDDEN_DOC = [
  { re: /不写工作树/, label: '"…不写工作树"(绝不/从不/永不 写工作树 同族)' },
  { re: /工作树副本\S{0,4}一个字节都[不没]写/, label: '"工作树副本一个字节都不写/没写"' },
  { re: /任何情况下都[不没]碰工作树/, label: '"任何情况下都不碰工作树"' },
]

/** 头注⑤必须写清的新口径关键短语(与 lib 的回写判据逐字同源)。 */
const REQUIRED_IN_HEADER = [
  '只补盘上根本不存在的声明路径',
  '盘上已有副本一律不动',
  '索引 blob 与父提交态不一致 ⇒ 归属他人',
  'N 未判定 / N 归属他人',
  '不得读成绿',
]

/** 用户可见提示(stdout + USAGE)必须带上的同一口径。 */
const REQUIRED_IN_USER_COPY = [
  '只补**盘上根本没有**的声明路径',
  '已有副本一律不动',
  '归属他人,不动并点名',
  '以及回写让路或未判定',
]

/** 头注 = 横幅之后第一处块注释;取不到边界 ⇒ 抛错(未判定不记绿,§0.3)。 */
function headerDocOf(src) {
  const start = src.indexOf('/**')
  const end = start < 0 ? -1 : src.indexOf('*/', start + 3)
  if (start < 0 || end < start) throw new Error('头注边界取不到 ⇒ 本锁不判,不得静默记绿')
  return src.slice(start, end)
}

/** 纯判据:返回违规清单(空 = 文档面与行为同口径)。头注与全文件的注释/字符串都在这把尺下。 */
function docViolationsOf(src) {
  const head = headerDocOf(src)
  const out = []
  for (const f of FORBIDDEN_DOC) {
    if (f.re.test(head)) out.push(`头注仍带绝对表述:${f.label}`)
    if (f.re.test(src)) out.push(`提示/注释仍带绝对表述:${f.label}`)
  }
  for (const r of REQUIRED_IN_HEADER) if (!head.includes(r)) out.push(`头注缺新口径关键短语:${r}`)
  return out
}

/** 用户可见提示的口径核对(同样只判字面,不改任何输出逻辑,与上面那维不并桶)。 */
function copyViolationsOf(src) {
  return REQUIRED_IN_USER_COPY.filter((r) => !src.includes(r)).map((r) => `缺这句口径:${r}`)
}

/** 变异靶有效性:原文必须真在源码里、且替换确实生效,否则对应断言是恒真的。 */
function forged(label, src, before, after) {
  if (!src.includes(before)) throw new Error(`变异靶在真器源码里找不到原文 ⇒ 靶写歪了:${label}`)
  const out = src.replace(before, after)
  if (out === src) throw new Error(`变异「${label}」一个字节都没改下去 ⇒ 对应断言是恒真的`)
  return out
}

const SRC = readFileSync(TOOL, 'utf8')

test('D1 真器文档面:绝对表述已清零,且头注四条新口径齐备', () => {
  assert.deepEqual(
    docViolationsOf(SRC),
    [],
    `文档面与行为相反:\n${docViolationsOf(SRC).join('\n')}`,
  )
  assert.deepEqual(
    copyViolationsOf(SRC),
    [],
    `提示文案缺与行为同源的口径:\n${copyViolationsOf(SRC).join('\n')}`,
  )
})

test('D2 阳面对照:把头注⑤伪造回旧绝对句 ⇒ 两型禁语都必须被抓到', () => {
  const 旧句集 = [
    ['**注入这一格只落在对象空间,不改盘上那份**', '工作树副本一个字节都不写'],
    ['盘上已有副本一律不动', '本器绝不写工作树'],
  ]
  for (const [原文, 旧句] of 旧句集) {
    const 伪造 = forged(`头注回旧句:${旧句}`, SRC, 原文, 旧句)
    const v = docViolationsOf(伪造)
    assert.ok(v.length > 0, `旧句 ${JSON.stringify(旧句)} 伪造回头注而锁没抓到 ⇒ 恒真锁`)
    assert.ok(
      v.some((x) => x.includes('绝对表述')),
      `必须点名"绝对表述",实得:${v.join(' | ')}`,
    )
  }
})

test('D3 阳面对照:摘掉头注里的新口径短语 ⇒ 必须逐条报缺', () => {
  for (const 短语 of REQUIRED_IN_HEADER) {
    const 伪造 = forged(`摘除短语:${短语}`, SRC, 短语, '〔被摘掉的那一格〕')
    const v = docViolationsOf(伪造)
    assert.ok(
      v.some((x) => x.includes(短语)),
      `摘除 ${JSON.stringify(短语)} 后锁必须点名它,实得:${v.join(' | ')}`,
    )
  }
})

test('D4 阳面对照:提示文案回潮"绝不写工作树" ⇒ 文件级禁语抓到,而口径维不并桶', () => {
  const 伪造 = forged(
    'stdout 回旧句',
    SRC,
    "'   盘上这份滞后是预期的(本格只改对象空间里的 blob);",
    "'   盘上副本滞后是预期的(本器绝不写工作树);",
  )
  const v = docViolationsOf(伪造)
  assert.ok(
    v.some((x) => x.startsWith('提示/注释仍带绝对表述')),
    `stdout 里的旧绝对句必须被抓到,实得:${v.join(' | ')}`,
  )
  assert.deepEqual(
    copyViolationsOf(伪造),
    [],
    '本枚只动措辞 ⇒ 口径齐全性那一维不该一起翻红(两维不并桶)',
  )
})

test('D5 头注写的四条在实现里各有落点(不是空话:lib 那一格真这么判)', () => {
  const align = readFileSync(ALIGN, 'utf8')
  assert.ok(
    align.includes('if (existsSync(resolve(root, p))) continue'),
    '头注"盘上已有副本一律不动"的落点:盘上已存在 ⇒ 直接跳过',
  )
  assert.ok(
    align.includes('他人已暂存,不覆盖'),
    '头注"索引 blob 与父提交态不一致 ⇒ 归属他人"的落点在 lib 里',
  )
  assert.match(
    align,
    /git\(\['checkout', ref, '--', p\]/,
    '头注"只补盘上根本不存在的声明路径"的落点:仅当盘上无该路径才从新 HEAD 补齐',
  )
  assert.ok(
    SRC.includes('这些路径的索引/磁盘状态不记绿'),
    '结论行必须写明"不记绿"(HEAD 已推进 ≠ 索引/磁盘已对上)',
  )
  assert.match(
    SRC,
    /landingAlign\.undetermined\.length > 0 \|\| landingAlign\.skipped\.length > 0/,
    '「N 未判定 / N 归属他人」那一档必须真顶高退出码,不是只在 stdout 点名',
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
