// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'node:test'
import assert from 'node:assert/strict'

/**
 * 跳门成因如实的形状锁(2026-10-31 立)。
 *
 * 为什么不 import 源文件:scripts/lib/pre-commit-hook.js 是 CJS 钩子,顶层直接跑主流程
 * (见 scripts/tests/pre-commit-hook-no-import-side-effects.test.mjs 记过的那一型),
 * 所以本锁按**静态文本**判,比对前先归一化空白(prettier 一折行就会造出与正确性无关的假红)。
 *
 * 四格:
 *  T1 阳性对照 —— 把缺陷形态(硬写成因)喂进同一把尺子,必须被点名(否则尺子在读 0)。
 *  T2 真实文件里缺陷形态 = 0 处。
 *  T3 skipCause 已定义,且每个 else 播报站点都经过它(站点数不得少于注册变量数)。
 *  T4 三条 opt-in 腿(条件写 `(env ?? '1') !== '1'`)必须显式声明 {optIn:true} ——
 *     它们的"没跑"成因是默认关闭,不是专项档;混报会把"本来就没这条腿"说成"被专项档掩盖"。
 */

const ROOT = resolve(import.meta.dirname, '../..')
const SRC_PATH = resolve(ROOT, 'scripts/lib/pre-commit-hook.js')

/** 归一化:折行续行合并、行首缩进与多余空白压掉 */
const norm = (s) =>
  s
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .join('\n')

/** 尺子:可执行行里把成因硬写成 "(HUSKY_SKIP_X=1, 跳过)" 的站点 */
function findHardCodedCauses(text) {
  return norm(text)
    .split('\n')
    .map((l, i) => [i, l])
    .filter(
      ([, l]) => /console\.log\([^)]*HUSKY_SKIP_[A-Z0-9_]+=1, 跳过/.test(l) && !l.startsWith('//'),
    )
    .map(([, l]) => l.slice(0, 90))
}

const src = readFileSync(SRC_PATH, 'utf8')

test('T1 阳性对照:缺陷形态必须被尺子点名', () => {
  const bad = "  console.log('⏭  某某守门(HUSKY_SKIP_SOMETHING_GUARD=1, 跳过)')\n"
  assert.deepEqual(findHardCodedCauses(bad).length, 1, '尺子读不到已知缺陷形态 ⇒ 本测试无牙')
})

test('T2 真实文件已无硬写成因', () => {
  const hits = findHardCodedCauses(src)
  assert.deepEqual(hits, [], `仍有 ${hits.length} 处把成因写死:\n${hits.join('\n')}`)
})

test('T3 skipCause 在位且被播报站点使用', () => {
  const n = norm(src)
  assert.match(n, /function skipCause\(envName, opts = \{\}\)/, 'skipCause 定义形态漂移')
  const callNames = [
    ...new Set(
      (n.match(/skipCause\('HUSKY_SKIP_[A-Z0-9_]+'/g) || []).map(
        (s) => /HUSKY_SKIP_[A-Z0-9_]+/.exec(s)[0],
      ),
    ),
  ]
  assert.ok(
    callNames.length >= 15,
    `经 skipCause 归因的站点仅 ${callNames.length} 段(专项档 else 播报有 12+ 段)`,
  )
  const 播报走实测成因 = (n.match(/⏭[^`]*\$\{skipCause\(/g) || []).length
  assert.ok(播报走实测成因 >= 15, `仅 ${播报走实测成因} 处 ⏭ 接上实测成因`)
})

test('T4 三条 opt-in 腿:走 skipCause 的必须声明 optIn,自写文案的不得硬写成因', () => {
  const n = norm(src)
  const optInIfs = (
    n.match(/if \(\(process\.env\.(HUSKY_SKIP_[A-Z0-9_]+) \?\? '1'\) !== '1'\) \{/g) || []
  ).map((s) => /HUSKY_SKIP_[A-Z0-9_]+/.exec(s)[0])
  assert.deepEqual(
    optInIfs.length,
    3,
    `opt-in 腿应为 3 段,现读 ${optInIfs.length}:${optInIfs.join(',')}`,
  )
  for (const name of optInIfs) {
    const usesHelper = n.includes(`skipCause('${name}'`)
    if (usesHelper) {
      assert.ok(
        n.includes(`skipCause('${name}', { optIn: true })`),
        `${name} 是默认关闭腿却未声明 optIn ⇒ 会被报成"专项档/成因未判定"`,
      )
    }
  }
  // 第三条腿自写文案:必须说清"默认延后/未开启",且不得长得像有人在跳门
  const unconverted = optInIfs.filter((nm) => !n.includes(`skipCause('${nm}'`))
  for (const nm of unconverted) {
    const line = n.split('\n').find((l) => l.includes('⏭') && l.includes(nm))
    assert.ok(line, `${nm} 既未接 skipCause 也没有对应 ⏭ 文案`)
    assert.doesNotMatch(line, /=1, 跳过/, `${nm} 的自写文案又把"没跑"写成应急变量跳门`)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
