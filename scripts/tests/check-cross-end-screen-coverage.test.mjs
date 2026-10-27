// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 跨端页面覆盖对账守门(门 237,check-cross-end-screen-coverage.mjs)的镜像测试。
 *
 * 覆盖两条已证缺陷(2026-10-27 收口):
 *   ① 取数函数(faceList / faceRead / gitGrep / collectMiniapp)的 catch 曾把 git 派生故障
 *      折成空集/空串/null ⇒ 「取不到输入」被记成「零命中」冒绿(违反 §0.3)。修法后必须
 *      抛 Undetermined,直执行入口折成 exit 2 显式「未判定」并点名原因。
 *   ② collectRn 口径松:只筛 `.endsWith('.tsx')`,任何伴生 .tsx(tests/components/barrel)
 *      都会混进 RN 屏分母。收紧为 RN_SCREEN_RE(`<Name>Screen.tsx` 形态,与 collectShared
 *      同尺),headDelegatedRn 同批收紧保持 R4 两尺对称。
 *
 * §22c:正常路径组直接 import 源 `__test__`,禁止另抄判据;故障注入组经演练仓 stub 取材层。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { copyScriptWithClosure } from '../lib/scratch-module-closure.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { gitRaw } from '../lib/face-reader.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const ROOT = join(here, '..', '..')
const SCRIPT = join(ROOT, 'scripts', 'check-cross-end-screen-coverage.mjs')

// §22c:直接 import 源符号,不留镜像常量
const { __test__ } = await import(pathToFileURL(SCRIPT).href)
const { collectRn, headDelegatedRn, faceRead, RN_SCREEN_RE } = __test__

// ---- 正常路径组:判据复用,存量读数不漂移 ----

test('M1 collectRn 全部命中 RN_SCREEN_RE(收紧尺:伴生 .tsx 不再进分母)', () => {
  const rn = collectRn()
  assert.ok(rn.length > 0, 'HEAD 面 RN 屏可枚举')
  const off = rn.filter((r) => !RN_SCREEN_RE.test(r.file))
  assert.deepEqual(
    off.map((r) => r.file),
    [],
    '非 <Name>Screen.tsx 形态的文件不得进 RN 屏集',
  )
})

test('M2 R4 两尺对称:HEAD 锚点集 ⊆ 当前委托集(收紧后存量不漂移)', () => {
  const now = new Set(collectRn().map((r) => r.file))
  const lost = [...headDelegatedRn()].filter((f) => !now.has(f))
  assert.deepEqual(lost, [], 'headDelegatedRn 与 collectRn 必须同一把尺,漂移即 R4 恒红')
})

test('M3 「该面没有这份件」仍是合法 null,不得冒充未判定(missing 不抛是取材层契约)', () => {
  assert.equal(
    faceRead('head', 'scripts/__definitely_not_in_head_probe__.ts'),
    null,
    'HEAD 面没有的件 ⇒ null(业务面"不存在"),不是 Undetermined',
  )
})

test('M4 RN_SCREEN_RE 形态正反例(大写开头 + Screen 后缀 + 顶层)', () => {
  assert.ok(RN_SCREEN_RE.test('apps/mobile-rn/src/screens/ActivityScreen.tsx'))
  for (const bad of [
    'apps/mobile-rn/src/screens/helpers.tsx',
    'apps/mobile-rn/src/screens/index.tsx',
    'apps/mobile-rn/src/screens/tests/quick-notes-insert-wiring.test.tsx',
    'apps/mobile-rn/src/screens/activity/ActivityScreen.tsx',
    'apps/mobile-rn/src/screens/activityScreen.tsx',
    'apps/mobile-rn/src/screens/Activity.tsx',
  ]) {
    assert.ok(!RN_SCREEN_RE.test(bad), `不应命中: ${bad}`)
  }
})

test('M5 装车证明:guardian-runner(HEAD 面)注册 blocking + skipEnv 成套', () => {
  const runner = gitRaw(['show', 'HEAD:scripts/guardian-runner.mjs'], ROOT)
  assert.match(runner, /script: 'check-cross-end-screen-coverage\.mjs'/)
  assert.match(runner, /mode: 'blocking'/)
  assert.match(runner, /skipEnv: 'HUSKY_SKIP_CROSS_END_SCREEN_COVERAGE'/)
})

// ---- 故障注入组:演练仓 stub 取材层,catch 注错必须翻成 Undetermined / exit 2 ----

const STUB_FACE_READER = `// 镜像测试夹具:取材层恒故障(同步抛,与真实现 execFileSync 同步语义一致)
export class Undetermined extends Error {}
export function gitRaw() {
  throw new Undetermined('stub: git 派生故障注入(镜像测试夹具)')
}
export function catBatch() {
  throw new Undetermined('stub: catBatch 故障注入(镜像测试夹具)')
}
export function readWorktreeFile() {
  return null
}
`

/** 演练仓:拷门体 + import 闭包,再把取材层覆写成恒故障 stub。 */
function makeFixture() {
  const dir = mkScratch('cross-end-screen-coverage-')
  const scripts = join(dir, 'scripts')
  copyScriptWithClosure(join(ROOT, 'scripts'), 'check-cross-end-screen-coverage.mjs', scripts, [
    'check-cross-end-screen-coverage.mjs',
    'lib/face-reader.mjs',
  ])
  writeFileSync(join(scripts, 'lib', 'face-reader.mjs'), STUB_FACE_READER, 'utf8')
  return {
    entry: join(scripts, 'check-cross-end-screen-coverage.mjs'),
    cleanup: () => rmScratch(dir, { bestEffort: true }),
  }
}

const fixture = makeFixture()
test.after(() => fixture.cleanup())

test('M6 faceList 取数故障 ⇒ 抛 Undetermined(不折成空集)', async () => {
  const { __test__: t2 } = await import(pathToFileURL(fixture.entry).href)
  // 不比 instanceof:stub 与真取材层的 Undetermined 是两个模块身份,比身份会把夹具测成假红。
  // 钉的是行为:抛错(不折空集)+ 消息点名「取不到」与故障原因(§0.3)。
  assert.throws(
    () => t2.faceList('head', 'apps/mobile-rn/src/screens'),
    (e) => /取不到.*面清单: stub: git 派生故障注入/.test(e?.message ?? ''),
    'git 派生故障必须显式未判定,不得折成空集冒充零命中',
  )
})

test('M7 faceRead 取数故障 ⇒ 抛 Undetermined(不折成 null 冒充"文件不存在")', async () => {
  const { __test__: t2 } = await import(pathToFileURL(fixture.entry).href)
  assert.throws(
    () => t2.faceRead('head', 'apps/miniapp-taro/src/app.config.ts'),
    (e) => /取不到.*面内容: stub: catBatch 故障注入/.test(e?.message ?? ''),
    'catBatch 故障 ≠ missing,null 只留给真不存在的件',
  )
})

test('M8 gitGrep(经 headMirroredSpecs)取数故障 ⇒ 抛 Undetermined(不折成空锚点集冒绿)', async () => {
  const { __test__: t2 } = await import(pathToFileURL(fixture.entry).href)
  assert.throws(
    () => t2.headMirroredSpecs(['apps/miniapp-taro/src/pages/index/index.tsx']),
    (e) => /取不到锚点: stub: git 派生故障注入/.test(e?.message ?? ''),
    '锚点集取不到必须未判定;旧 catch 返回 "" 会让 R3/R4 棘轮整体记绿',
  )
})

test('M9 直执行取数故障 ⇒ exit 2 且输出含「未判定」(不冒绿也不冒红)', () => {
  const r = spawnSync(process.execPath, [fixture.entry], {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  assert.equal(r.status, 2, `stderr=${r.stderr}`)
  assert.match(String(r.stderr), /未判定/, '结论必须显式写「未判定」并点名原因')
})

test('M10 --self-test 取数故障 ⇒ 同样 exit 2 未判定(自检不豁免 §0.3)', () => {
  const r = spawnSync(process.execPath, [fixture.entry, '--self-test'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  assert.equal(r.status, 2, `stderr=${r.stderr}`)
  assert.match(String(r.stderr), /未判定/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
