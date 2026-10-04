// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-815966 镜像判据(2026-10-04 补上票面验收缺的最后一格):
 * 「同一百分比裁剪在第二个文件出现即红」—— 百分比钳位 [0,100] 的唯一实现是
 * packages/shared/src/utils/clamp-percent.ts 的具名出口 clampPercent;任何**其他**
 * 生产文件再手搓 `Math.max(0, Math.min(100, x))`(min 两侧任一顺序、外层 max/min
 * 互换均算)即"第二处真相"(守门 103/D3 反复记的形态)。
 *
 * 存量处置 = 按文件棘轮(2026-10-04 首次站点普查实测 30 处/26 文件,全部早于本判据):
 * 基线内文件不得**多于**基线数、基线外文件零容忍——与恒红门的区别写在 AGENTS §12e,
 * 清理一批就把对应条目从基线摘除(摘除本身即验收),直到基线空、届时本测试自然回到
 * 全量零容忍形态(基线空时 RATCHET_BASELINE 为空对象即可)。
 *
 * 判据单一实现:git grep 只做**预筛**(Math.max/min 候选行,必须是判据字面量的
 * 超集——门 102 的既有教训);是否违规一律由本文件的 JS 正则 + code-mask 剥注释裁定,
 * 预筛与裁定各写一遍必然漂开。注释里引用旧形态(如出口文件自己的成因注释)不算违规。
 * 判定面 = HEAD blob(仓规:工作树是别人的在飞现场)。
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import { maskComments } from '../lib/code-mask.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

/** 唯一出口(它的函数体是允许存在的"第一份";换路径必须同笔改这里) */
const CANONICAL_FILE = 'packages/shared/src/utils/clamp-percent.ts'

/**
 * 内联百分比钳位判据(三形态,覆盖 min 两侧顺序与外层 max/min 互换):
 *  A `Math.max(0, Math.min(100, x))`   B `Math.max(0, Math.min(x, 100))`
 *  C `Math.min(100, Math.max(0, x))`
 * 只认 0..100 这一档:0..1(归一化)、0..255 等不是百分比,刻意不拦。
 */
const INLINE_CLAMP_RE =
  /Math\.max\(\s*0\s*,\s*Math\.min\(\s*100\s*,|Math\.max\(\s*0\s*,\s*Math\.min\([^()]*,\s*100\s*\)|Math\.min\(\s*100\s*,\s*Math\.max\(\s*0\s*,/

/** 测试面(与各守门的排除口径同形:测试里摆同形算例是合法的) */
const isTestFace = (path) =>
  /\.test\.[cm]?[jt]sx?$/.test(path) || /\.spec\.[cm]?[jt]sx?$/.test(path) || path.includes('__tests__/') || path.includes('/tests/')

/**
 * 棘轮基线(2026-10-04 站点普查现读,路径→处数)。清理该文件后把条目摘除;
 * 基线必须只减不增,新增文件永不入基线。
 */
const RATCHET_BASELINE = {}

/** 裁定:一条 grep 预筛输出(HEAD:path:line:content)是否构成违规 */
function judgeLine(raw) {
  const m = raw.match(/^HEAD:([^:]+):(\d+):(.*)$/)
  if (!m) return null
  const [, path, line, content] = m
  if (path === CANONICAL_FILE) return null
  if (isTestFace(path)) return null
  if (!INLINE_CLAMP_RE.test(maskComments(content))) return null
  return { path, line: Number(line), content: content.trim() }
}

/** 预筛:HEAD 面上所有 Math.max/min 候选行(超集,不做判定) */
function candidateLines(pattern) {
  try {
    return execFileSync('git', ['-C', ROOT, 'grep', '-n', '-E', pattern, 'HEAD', '--', 'apps', 'packages'], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      timeout: 120_000,
    })
      .split(/\r?\n/)
      .filter(Boolean)
  } catch (error) {
    // git grep exit 1 = 零候选(判定面干净);其他码才是取材失败,不得记绿
    if (error && (error.status === 1 || error.code === 1)) return []
    throw error
  }
}

function currentViolations() {
  const byFile = new Map()
  for (const v of candidateLines('Math\\.(max|min)\\(').map(judgeLine).filter(Boolean)) {
    byFile.set(v.path, (byFile.get(v.path) ?? 0) + 1)
  }
  return byFile
}

test('G-815966 镜像判据(棘轮):基线外文件零内联百分比钳位,基线内不得增多', () => {
  const byFile = currentViolations()
  const offenders = []
  for (const [path, count] of byFile) {
    const allowed = RATCHET_BASELINE[path] ?? 0
    if (count > allowed) offenders.push(`${path}: ${count} 处 > 基线 ${allowed}`)
  }
  assert.deepEqual(offenders, [], `同一百分比裁剪出现了第二份内联实现——改走具名出口 import { clampPercent } from '@ihui/shared/utils/clamp-percent':\n${offenders.join('\n')}`)
})

test('基线卫生:条目必须真实(已清零的文件要摘条目;基线文件消失=清单腐烂)', () => {
  const byFile = currentViolations()
  const staleZero = Object.keys(RATCHET_BASELINE).filter((p) => !byFile.has(p))
  assert.deepEqual(staleZero, [], `以下基线条目当前已零命中——清理完成后请从 RATCHET_BASELINE 摘除它们(基线只减不增):\n${staleZero.join('\n')}`)
})

test('正反成对(判据必须有牙,且不得误伤):', () => {
  // 阳:三种内联形态在无关生产文件里都必须被判
  for (const bad of [
    'const p = Math.max(0, Math.min(100, progress ?? 0))',
    'const p = Math.max(0, Math.min(progress ?? 0, 100))',
    'const p = Math.min(100, Math.max(0, value))',
    'const p = Math.max( 0 , Math.min( 100 , v ))',
  ]) {
    assert.ok(judgeLine(`HEAD:apps/web/src/__census_fixture__.ts:9:${bad}`), `漏判:${bad}`)
  }
  // 阴:唯一出口本体 / 测试面 / 非 0..100 档的钳位 / 仅候选无钳位 / 注释里的旧形态示例,一律不判
  assert.equal(judgeLine('HEAD:packages/shared/src/utils/clamp-percent.ts:15:  return Math.max(0, Math.min(100, value))'), null)
  assert.equal(judgeLine('HEAD:apps/web/src/foo.test.ts:9:const p = Math.max(0, Math.min(100, v))'), null)
  assert.equal(judgeLine('HEAD:apps/web/src/foo.ts:9:const n = Math.max(0, Math.min(1, ratio))'), null)
  assert.equal(judgeLine('HEAD:apps/web/src/foo.ts:9:const m = Math.max(a, b)'), null)
  assert.equal(judgeLine('HEAD:apps/api/src/db/learn-queries.ts:705:  // G-815966:裁剪走具名唯一出口(旧形态 Math.max(0, Math.min(100, …)) 逐处手搓)。'), null)
})

test('装车证明:具名出口必须仍有生产调用方(防"判据在、出口被摘线后无人用")', () => {
  const users = new Set()
  for (const raw of candidateLines('clampPercent')) {
    const m = raw.match(/^HEAD:([^:]+):/)
    if (!m) continue
    const path = m[1]
    if (path === CANONICAL_FILE || isTestFace(path)) continue
    users.add(path)
  }
  assert.ok(users.size >= 1, `clampPercent 生产面零调用方(现读:${[...users].join(',') || '无'})——出口被摘线或改名时本断言红`)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
