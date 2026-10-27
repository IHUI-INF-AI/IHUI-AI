// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 渲染推翻复判(①b)的形状锁与派发锁(2026-10-28 立)。
 *
 * 背景:对账尺 `check-web-rn-screen-parity.mjs` 会点名「在册 gap 行的同名共享屏确被 RN 以 JSX 渲染」
 * 这种互斥陈述,但刻意**只点名不翻案**(理由写在门体头注:同名 ≠ 同物 —— 现读反例是教职侧页面撞上
 * 学生侧数据的 StudyPlanScreen)。于是这 10 条队列只能等人逐屏翻代码 —— 与"最大化减少开发"正面冲突。
 * `auto-register-cross-end.mjs --converge-render` 把它变成机器裁决,判据一律复用主判据那一条阈值。
 *
 * 本件钉四件事(件件都是"摘掉就会出事"的牙):
 *   A1 派发锁:守护轮那条收敛腿必须带上 --converge-render(否则复判又退回"只能人工敲",§0.9);
 *   A2 阈值单源:端点阈值只许一处实现,①b 必须走 scoreRenderCandidate(不许在复判里另写一条);
 *   A3 空集不算证据:一侧端点取不到 ⇒ 进 undetermined 桶,不许并进"实测不重叠"(§0.3);
 *   A4 取代面收窄:改判行只按显式 (web,status) 对取代旧行,不许把 aligned 当万能覆盖档洗掉别席判定。
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import test from 'node:test'

const ROOT = resolve(import.meta.dirname, '..', '..')
const headOr = (rel) => {
  try {
    return execFileSync('git', ['show', `HEAD:${rel}`], {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 1 << 26,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch {
    return null
  }
}
const work = (rel) => readFileSync(join(ROOT, rel), 'utf8')
const flat = (s) => s.replace(/\\s+/g, ' ')

test('A1 派发锁:收敛腿带 --converge-render(HEAD 面未入库时如实跳过)', (t) => {
  const src = headOr('scripts/git-guardian.mjs')
  if (src === null) {
    t.skip('HEAD 面取不到 git-guardian.mjs ⇒ 未判定')
    return
  }
  if (!/export function convergeCrossEndPortalVerdicts\b/.test(src)) {
    t.skip('该腿尚未进 HEAD')
    return
  }
  const body = src.slice(
    src.indexOf('export function convergeCrossEndPortalVerdicts'),
    src.indexOf('export function healCrossEndMirror'),
  )
  assert.match(
    body,
    /'--converge-render'/,
    '渲染复判必须随同一条派发跑;另开一条腿 = 两处都在改同一本台账而彼此不知道',
  )
  assert.match(body, /'--converge-portal'/, '门户收敛仍是同一条派发的一部分')
})

test('A2 阈值单源:①b 走 scoreRenderCandidate,且端点阈值全文件只一处', () => {
  const src = flat(work('scripts/auto-register-cross-end.mjs'))
  assert.ok(
    /export const epOverlapStrong = \(jac, n\) => jac >= 0\.5 \|\| n >= 2/.test(src),
    '阈值助手必须在(两处各写一遍必然漂移)',
  )
  assert.equal(
    (src.match(/jac >= 0\.5 \|\| n >= 2/g) || []).length,
    1,
    '阈值字面量出现两次 ⇒ 主判据与复判成了两把尺子',
  )
  assert.match(
    src,
    /const sc = scoreRenderCandidate\(webEps, sep\)/,
    '①b 必须用同一份打分,而不是就地再算一遍 jaccard',
  )
})

test('A3 空集不算证据:一侧取不到 ⇒ undetermined,不并进"不重叠"', () => {
  const src = flat(work('scripts/auto-register-cross-end.mjs'))
  assert.match(src, /const renderUndetermined = \[\]/, '未判定必须单独成桶')
  assert.match(
    src,
    /if \(webEps\.size === 0 \|\| sep\.size === 0\)[\s\S]{0,200}renderUndetermined\.push/,
    '空集走 undetermined 分支(把"量不到"报成"量出不同"是坏尺子,不是结论)',
  )
  assert.match(src, /未判=\$\{renderUndetermined\.length\}/, '出账必须把未判定条数报出来')
})

test('A4 取代面收窄:改判行只按显式 (web,status) 对取代旧 gap 行', () => {
  const src = flat(work('scripts/auto-register-cross-end.mjs'))
  assert.match(
    src,
    /const dropPairs = new Set\(\(opt\.supersede \|\| \[\]\)\.map\(\(s\) => `\$\{s\.web\}::\$\{s\.dropStatus\}`\)\)/,
    '取代集必须由调用方逐条点名',
  )
  assert.match(
    src,
    /supersede: renderRowsToLand\.map\(\(r\) => \(\{ web: r\.web, dropStatus: 'gap' \}\)\)/,
    '只摘被本案推翻的那一条 gap 行',
  )
  // keep 谓词必须同时受两侧约束:portal 那一族照旧整族取代,本案只按点名的 (web,status) 对取代。
  assert.match(
    src,
    /return !\(supersedeWebs\.has\(o\.web\) && o\.status !== 'portal'\) && !dropPairs\.has\(`\$\{o\.web\}::\$\{o\.status\}`\)/,
    '取代必须逐对命中,不得按 status 一刀切',
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
