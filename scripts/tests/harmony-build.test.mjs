// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * scripts/harmony-build.mjs 的行为镜像(Y-3 ③ 鸿蒙产物腿,C 档用例钉)。
 * 判据一律 import 源文件的 __test__ 出口,本文件零复算(§22c / §0.6)。
 *
 * 钉的六件事:
 *   H1 五格清单 ↔ 解锁方表 成套,新增一档未登记 ⇒ 同一把尺翻红(含变异对照)
 *   H2 读数形状:格名同序、detail 非空、非 found 必点名缺件(不许空串冒充"没这一步")
 *   H3 枚举到 0 个候选 ⇒ MISSING(判死不记绿);输入取不到 ⇒ UNJUDGED(不判"无")
 *   H4 三态不并桶:全 found ⇒ ready / found+missing ⇒ blocked / 含 unjudged ⇒ unjudged
 *   H5 dry-run 零副作用:不发网络、不派生构建进程、plan 里不存在上传动作
 *   H6 矩阵列与出包门链接的是同一把尺(列名逐字取自清单;门链 harmony 前置且默认档不变)
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

import { __test__ as HM } from '../harmony-build.mjs'
import { __test__ as RM } from '../release-mobile-rn.mjs'
import { __test__ as GATE } from '../mobile-release-gate.mjs'
import { STATUS, STORE_VENDORS } from '../lib/rn-release-credentials.mjs'

const { HARMONY_AXES, HARMONY_OWNER_PLAYBOOK, axesPlaybookDrift, harmonyAxes, harmonyLeg, planHarmonyBuild } = HM

/** 全缺的假根:RN 工程目录可读但零命中、无依赖、无凭据、无端点表条目、无 SDK 安装位。 */
const emptyRootFs = {
  existsSync: (p) => /mobile[-\\]rn/i.test(String(p)),
  readFileSync: () => JSON.stringify({ dependencies: {} }),
  readdirSync: () => [],
}
const stubCredMissing = () => ({ status: STATUS.MISSING, detail: '桩:密钥目录零命中' })
const stubCredFound = () => ({ status: STATUS.FOUND, detail: '桩', value: [{ path: 'X:/密钥/鸿蒙发布件.json', bytes: 128, fields: ['client_id'] }] })
const allFoundFs = {
  existsSync: () => true,
  readFileSync: () => JSON.stringify({ dependencies: { 'react-native-harmony': '0.72.0' } }),
  readdirSync: () => [{ name: 'oh-package.json5', isDirectory: () => false, isFile: () => true }],
}

test('H1 五格清单与解锁方表成套;变异对照:新档未登记必须翻红', () => {
  assert.deepEqual(axesPlaybookDrift(), [], '在册五格必须每格都有 owner 动作')
  assert.deepEqual(axesPlaybookDrift([...HARMONY_AXES, '新格未登记'], HARMONY_OWNER_PLAYBOOK), ['新格未登记'], '同一把尺必须认得出新格')
  for (const k of HARMONY_AXES) {
    const p = HARMONY_OWNER_PLAYBOOK[k]
    assert.ok(p.owner && p.action && p.verify, `${k} 的解锁方三件(owner/action/verify)缺一不可写`)
  }
})

test('H2 读数形状:格名同序 + detail 非空 + 非 found 必点名缺件', () => {
  const axes = harmonyAxes({ root: 'X:/none', env: {}, fs: emptyRootFs, credentialProbe: stubCredMissing, channels: {} })
  assert.deepEqual(axes.map((a) => a.k), [...HARMONY_AXES], '矩阵列名逐字取自清单,不允许第二套叫法')
  for (const a of axes) {
    assert.ok(typeof a.detail === 'string' && a.detail.trim().length > 0, `${a.k} 不得以空串冒充"没这一步"`)
    if (a.status !== STATUS.FOUND) assert.ok(a.gap && a.gap.trim().length > 0, `${a.k} 判 ${a.status} 却没点名缺件`)
  }
})

test('H3 枚举到 0 判死不记绿;输入取不到判未判定(不判"无")', () => {
  const zero = harmonyAxes({ root: 'X:/none', env: {}, fs: emptyRootFs, credentialProbe: stubCredMissing, channels: {} })
  const missing = zero.filter((a) => a.status === STATUS.MISSING)
  assert.equal(missing.length, 5, '五格全零命中 ⇒ 全部 MISSING,不得有一格冒绿')
  const broken = harmonyAxes({
    root: 'X:/none',
    env: {},
    fs: { existsSync: () => false, readFileSync: () => { throw new Error('nope') }, readdirSync: () => { throw new Error('nope') } },
    credentialProbe: () => ({ status: STATUS.UNJUDGED, detail: '桩:取不到' }),
    channels: {},
  })
  assert.ok(broken.filter((a) => a.status === STATUS.UNJUDGED).length >= 2, '工程根/依赖表读不到 ⇒ 至少前两格落未判定')
  assert.ok(!broken.some((a) => a.status === STATUS.FOUND), '取不到输入的一律不许冒绿')
})

test('H4 三态不并桶:全 found ⇒ ready,+missing ⇒ blocked,含 unjudged ⇒ unjudged', () => {
  const ready = harmonyLeg({ root: 'X:/none', env: { IHUI_DEVECO_SDK_HOME: 'X:/sdk' }, fs: allFoundFs, credentialProbe: stubCredFound, channels: { harmony: { label: '桩:已核实端点' } } })
  assert.equal(ready.status, 'ready', '五格齐 ⇒ 判就绪(说明这把尺不是恒红门,§12e)')
  assert.equal(ready.blockers.length, 0)
  const blocked = harmonyLeg({ root: 'X:/none', env: {}, fs: emptyRootFs, credentialProbe: stubCredMissing, channels: {} })
  assert.equal(blocked.status, 'blocked')
  assert.equal(blocked.blockers.length, 5, '缺件必须逐条点名到 owner/action/verify')
  for (const b of blocked.blockers) assert.ok(b.owner && b.action && b.verify, `${b.axis} 缺解锁方三件`)
  const unjudged = harmonyLeg({ root: 'X:/none', env: {}, fs: allFoundFs, credentialProbe: () => ({ status: STATUS.UNJUDGED, detail: '桩:取不到' }), channels: {} })
  assert.equal(unjudged.status, 'unjudged', 'unjudged 必须压过 blocked(§0.3)')
})

test('H5 dry-run 零副作用:不发网络请求、plan 内不存在上传动作', async () => {
  let fetchCalls = 0
  const realFetch = globalThis.fetch
  globalThis.fetch = () => { fetchCalls++; throw new Error('用例禁止出网') }
  try {
    harmonyAxes({ root: 'X:/none', env: {}, fs: emptyRootFs, credentialProbe: stubCredMissing, channels: {} })
    const leg = harmonyLeg({ root: 'X:/none', env: {}, fs: emptyRootFs, credentialProbe: stubCredMissing, channels: {} })
    assert.equal(fetchCalls, 0, '五格现读一律离线(§0.3:量不到就点名,不打猜的 URL)')
    assert.equal(leg.status, 'blocked')
    const plan = planHarmonyBuild()
    assert.ok(plan.length >= 2, 'dry-run 必须给出真到齐后要跑的命令,不是"待补"')
    for (const line of plan) {
      assert.ok(!/PUT https|curl -T|Invoke-WebRequest -Method Put|upload[-_]?hap/i.test(line), `plan 里出现上传动作:${line}`)
      assert.ok(!/curl|wget|npm (i|install)|pip install|choco|winget/i.test(line), `plan 里出现装工具链/下载动作:${line}(边界禁止)`)
    }
    assert.ok(plan.some((c) => /hvigorw assembleHap/.test(c)), '构建命令必须是 hvigor 形态,不是把 gradle 换个名字')
    assert.ok(plan.some((c) => /register-app-version-latest\.mjs --platform harmony/.test(c)), '登记腿必须显式带 harmony 档,免得整轮又落回无渠道那一格')
  } finally {
    globalThis.fetch = realFetch
  }
})

test('H6 矩阵鸿蒙列接的是同一把尺(列名逐字取自清单,其余厂商行为不变)', () => {
  const ev = {
    artifacts: { status: STATUS.FOUND, detail: '桩:提交物在位' },
    signing: { status: STATUS.FOUND, detail: '桩:签名件在位' },
    stores: STORE_VENDORS.map((vendor) => ({ vendor, cred: { status: STATUS.MISSING, detail: '桩:无凭据' } })),
  }
  const legs = RM.buildStoreLegs(ev)
  const harmony = legs.find((l) => l.id === 'store-harmony')
  const names = harmony.checks.map((c) => c.k)
  for (const axis of HARMONY_AXES) assert.ok(names.includes(axis), `鸿蒙列必须含「${axis}」这一格(逐字取自清单)`)
  assert.ok(!names.includes('上传通道器物'), '鸿蒙列不再吃那句写死的散文')
  assert.ok(!names.includes('开发者凭据'), '鸿蒙的凭据格住在五格里(同一把 storeCredential,不重复开格)')
  assert.ok(harmony.checks.every((c) => typeof c.detail === 'string' && c.detail.trim().length > 0), '任何一格都不得空串')
  assert.match(harmony.command, /node scripts\/harmony-build\.mjs/, '出路必须是这条真跑得通的命令(§0.8)')
  const huawei = legs.find((l) => l.id === 'store-huawei')
  assert.ok(huawei.checks.some((c) => c.k === '上传通道器物'), '正向对照:华为列形态未被本次改动波及')
  assert.ok(huawei.checks.some((c) => c.k === '开发者凭据'))
  const fold = RM.foldStatus(harmony.checks.map((c) => c.status))
  assert.ok(['blocked', 'unjudged'].includes(fold), `鸿蒙列今日只能判 ${fold},拿 ready 冒充即违规`)
})

test('H7 出包门链:harmony 前置同一把尺,缺省档逐字不变', () => {
  const base = GATE.planGates({})
  assert.equal(base.length, 4, '缺省 android 档仍是那四道门(既有 ps1/CI 调用方行为逐字不变)')
  assert.equal(base[0].id, 'typecheck')
  const wt = GATE.planGates({ face: 'worktree' })
  assert.ok(wt.every((g) => g.cmd !== 'node' || !g.args.includes('--head')), 'worktree 面必须带 --worktree')
  assert.deepEqual(
    wt.filter((g) => g.id === 'version-code' || g.id === 'base-bake').map((g) => g.args.at(-1)),
    ['--worktree', '--worktree'],
  )
  const hm = GATE.planGates({ platform: 'harmony' })
  assert.equal(hm.length, 5)
  assert.equal(hm[0].id, 'harmony-readiness', '产物未齐必须前置中止,不等四轮 gradle 才发现本机没 SDK')
  assert.deepEqual(hm[0].args, ['scripts/harmony-build.mjs', '--check'], '门链只调那把尺,不复算五格')
  assert.deepEqual(hm.slice(1).map((g) => g.id), base.map((g) => g.id), 'harmony 档不摘任何既有门(多判不伤,少判是缺口)')
})

test('H8 CLI 形状:未知 platform 用法错 exit 2 且不派生子门;harmony-build --check 只读', () => {
  const r = spawnSync(process.execPath, ['scripts/mobile-release-gate.mjs', '--platform', 'ios'], {
    cwd: repoRootForSpawn(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    timeout: 60000,
  })
  assert.equal(r.status, 2, `未知 --platform 必须 exit 2(未判定),实读 status=${r.status} stdout=${r.stdout}`)
  assert.match(r.stderr, /不在册/, '要点名合法取值,不得静默回落 android')
  assert.ok(!/\[mobile-release-gate\] 1\/\d/.test(r.stdout + r.stderr), '用法错的一轮里不得派出任何子门')
  const hb = spawnSync(process.execPath, ['scripts/harmony-build.mjs', '--check'], { cwd: repoRootForSpawn(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, timeout: 120000 })
  assert.ok([0, 1, 2].includes(hb.status), `--check 只出三态读数,实读 rc=${hb.status}`)
  assert.match(hb.stdout, /产物工程配置/, '末行读数必须逐格点名')
  assert.ok(!/client_secret\s*[:=]\s*\S{8,}/.test(hb.stdout), '读数里不得出现凭据明文')
})

/** 用例统一在仓根跑(§15:根由脚本自身位置推导,不信 process.cwd())。 */
function repoRootForSpawn() {
  return resolve(fileURLToPath(new URL('../..', import.meta.url)))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
