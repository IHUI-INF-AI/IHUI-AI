// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { copyFileSync, cpSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const ROOT = join(here, '..', '..')
const SCRIPT = join(ROOT, 'scripts', 'check-web-mp-route-carriers.mjs')
const { __test__ } = await import(pathToFileURL(SCRIPT).href)
const { judgeCarriers, judgeCarrierRatchet, parseLedger, parseLegalLedger, serializeRows, serializeLegalRows, VERDICTS, rowKey } =
  __test__
const { __test__: cov } = await import(pathToFileURL(join(ROOT, 'scripts', 'check-cross-end-screen-coverage.mjs')).href)

const SHARED = cov.SHARED_DIR
const mirrorText = (name) => `/* 对齐 RN Shared${name}(packages/app/src/features/x):dp × 2 = rpx */`

function fixture() {
  const shared = [
    { spec: `${SHARED}/demo/DemoScreen.tsx`, domain: 'demo', name: 'DemoScreen' },
    { spec: `${SHARED}/gone/GoneScreen.tsx`, domain: 'gone', name: 'GoneScreen' },
    { spec: `${SHARED}/und/UndScreen.tsx`, domain: 'und', name: 'UndScreen' },
    { spec: `${SHARED}/legal/LegalScreen.tsx`, domain: 'legal', name: 'LegalScreen' },
    { spec: `${SHARED}/vip/VipScreen.tsx`, domain: 'vip', name: 'VipScreen' },
  ]
  const mpPages = [
    { route: 'pages/demo/demo', file: 'apps/miniapp-taro/src/pages/demo/demo.tsx', text: mirrorText('DemoScreen'), cssText: '' },
    { route: 'pages/gone/gone', file: 'apps/miniapp-taro/src/pages/gone/gone.tsx', text: 'export default {}', cssText: '' },
    { route: 'pkg-vip/a/index', file: 'apps/miniapp-taro/src/pkg-vip/a/index.tsx', text: mirrorText('VipScreen'), cssText: '' },
    { route: 'pkg-vip/b/index', file: 'apps/miniapp-taro/src/pkg-vip/b/index.tsx', text: mirrorText('VipScreen'), cssText: '' },
  ]
  const registryRows = [
    { shared: `${SHARED}/demo/DemoScreen.tsx`, miniapp: 'pages/demo/demo' },
    { shared: `${SHARED}/gone/GoneScreen.tsx`, miniapp: 'pages/ghost/ghost' },
    { shared: `${SHARED}/vip/VipScreen.tsx`, miniapp: 'pkg-vip/a/index' },
    { shared: `${SHARED}/vip/VipScreen.tsx`, miniapp: 'pkg-vip/b/index' },
  ]
  const verdictRows = [
    { shared: `${SHARED}/legal/LegalScreen.tsx`, verdict: 'not-applicable', evidence: 'apps/web/x.tsx:10 平台不承载' },
  ]
  const webMap = [
    { web: '/demo', rn: `${SHARED}/demo/DemoScreen.tsx`, status: 'aligned' },
    { web: '/gone', rn: `${SHARED}/gone/GoneScreen.tsx`, status: 'aligned' },
    { web: '/legal', rn: `${SHARED}/legal/LegalScreen.tsx`, status: 'aligned' },
  ]
  return { shared, mpPages, registryRows, verdictRows, webMap }
}

test('承载列:路由在册 + 页面声明承载 ⇒ carried;登记路由不在配置 ⇒ route-not-in-config', () => {
  const r = judgeCarriers(fixture())
  const demo = r.rows.find((x) => x.shared.endsWith('/demo/DemoScreen.tsx'))
  assert.equal(demo.verdict, VERDICTS.carried)
  assert.deepEqual(demo.mpRoutes, ['pages/demo/demo'])
  const gone = r.rows.find((x) => x.shared.endsWith('/gone/GoneScreen.tsx'))
  assert.equal(gone.verdict, VERDICTS.routeNotInConfig)
  assert.match(gone.reason, /no-config-entry/)
})

test('真缺口:web 承载但 registry 无路由 ⇒ mp 缺承载(不折成未判定)', () => {
  const r = judgeCarriers({
    shared: [{ spec: `${SHARED}/demo/DemoScreen.tsx`, domain: 'demo', name: 'DemoScreen' }],
    registryRows: [],
    verdictRows: [],
    mpPages: [],
    webMap: [{ web: '/demo', rn: `${SHARED}/demo/DemoScreen.tsx`, status: 'aligned' }],
  })
  assert.equal(r.rows[0].verdict, VERDICTS.missingCarrier)
  assert.equal(r.readouts.missingCarrier.length, 1)
})

test('未判定:registry 无条目 + web 映射也没有 ⇒ undetermined,且读数不为 0', () => {
  const r = judgeCarriers(fixture())
  const und = r.rows.find((x) => x.shared.endsWith('/und/UndScreen.tsx'))
  assert.equal(und.verdict, VERDICTS.undetermined)
  assert.equal(r.readouts.undetermined.length, 1, '未判定必须逐条点名,不许折 0')
})

test('合法差异:not-applicable 单独立账,不混进缺口三桶', () => {
  const r = judgeCarriers(fixture())
  const legal = r.rows.find((x) => x.shared.endsWith('/legal/LegalScreen.tsx'))
  assert.equal(legal.verdict, VERDICTS.legalAbsence)
  assert.equal(r.readouts.legalAbsence.length, 1)
  assert.equal(r.readouts.missingCarrier.length, 0, '合法差异不得算进缺承载')
  assert.equal(r.readouts.routeNotInConfig.length, 1, '只有 gone 是路由不存在')
  assert.ok(r.legalRows.some((x) => x.legalKind === 'platform-does-not-carry'))
})

test('判重:同屏多路 = 合法别名单独立账;同一路由被两屏登记 = 真冲突判红', () => {
  const r = judgeCarriers(fixture())
  assert.equal(r.readouts.duplicateAlias.length, 1)
  assert.ok(r.legalRows.some((x) => x.legalKind === 'multi-route-alias'))
  const dup = judgeCarriers({
    shared: [
      { spec: `${SHARED}/a/AScreen.tsx`, domain: 'a', name: 'AScreen' },
      { spec: `${SHARED}/b/BScreen.tsx`, domain: 'b', name: 'BScreen' },
    ],
    registryRows: [
      { shared: `${SHARED}/a/AScreen.tsx`, miniapp: 'pages/x/x' },
      { shared: `${SHARED}/b/BScreen.tsx`, miniapp: 'pages/x/x' },
    ],
    verdictRows: [],
    mpPages: [{ route: 'pages/x/x', file: 'apps/miniapp-taro/src/pages/x/x.tsx', text: '', cssText: '' }],
    webMap: [],
  })
  assert.equal(dup.readouts.duplicateConflict.length, 2)
  const expectedKey = rowKey(`${SHARED}/a/AScreen.tsx`, VERDICTS.missingCarrier)
  assert.equal(dup.readouts.duplicateConflict[0].verdict, VERDICTS.missingCarrier)
  assert.ok(expectedKey.includes(VERDICTS.missingCarrier))
})

test('棘轮:新缺口/新未判定无账 ⇒ 红;全量台账在位 ⇒ 绿;新合法差异无账 ⇒ 红', () => {
  const r = judgeCarriers(fixture())
  const ledger = r.rows.map((x) => ({ shared: x.shared, verdict: x.verdict }))
  assert.ok(judgeCarrierRatchet(r.readouts, [], []).newRows.length >= 1, '无账存量必须判红')
  const ok = judgeCarrierRatchet(r.readouts, ledger, r.legalRows)
  assert.equal(ok.newRows.length, 0)
  assert.equal(ok.newLegal.length, 0)
  const noLegal = judgeCarrierRatchet(r.readouts, ledger, [])
  assert.equal(noLegal.newLegal.length, 1, '合法差异必须单独落账,没账就红')
})

test('台账往返:序列化后逐行可解且键不变(坏行拒收)', () => {
  const r = judgeCarriers(fixture())
  const text = serializeRows(r.rows)
  const { rows, bad } = parseLedger(text)
  assert.equal(bad.length, 0)
  assert.equal(rows.length, r.rows.length)
  assert.deepEqual(
    rows.map((x) => `${x.shared}|${x.verdict}`),
    r.rows.map((x) => `${x.shared}|${x.verdict}`),
  )
  const legal = parseLegalLedger(serializeLegalRows(r.legalRows))
  assert.equal(legal.bad.length, 0)
  assert.equal(legal.rows.length, r.legalRows.length)
  const broken = parseLedger('{"shared":"x"}')
  assert.equal(broken.bad.length, 1)
})

// ---- 故障注入:取材层恒故障 ⇒ 直执行 exit 2 ----

const STUB_FACE_READER = `// 镜像测试夹具:取材层恒故障
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

function makeFixture() {
  const dir = mkdtempSync(join(tmpdir(), 'mp-route-carriers-'))
  const scripts = join(dir, 'scripts')
  mkdirSync(scripts, { recursive: true })
  copyFileSync(join(ROOT, 'scripts', 'check-web-mp-route-carriers.mjs'), join(scripts, 'check-web-mp-route-carriers.mjs'))
  copyFileSync(
    join(ROOT, 'scripts', 'check-cross-end-screen-coverage.mjs'),
    join(scripts, 'check-cross-end-screen-coverage.mjs'),
  )
  cpSync(join(ROOT, 'scripts', 'lib'), join(scripts, 'lib'), { recursive: true })
  // gen-rn-host-shell 拉 typescript 裸包;夹具只演练取材故障,给它不落盘的桩
  writeFileSync(join(scripts, 'gen-rn-host-shell.mjs'), 'export const __test__ = { classify: () => ({}) }\n', 'utf8')
  writeFileSync(join(scripts, 'lib', 'face-reader.mjs'), STUB_FACE_READER, 'utf8')
  return { entry: join(scripts, 'check-web-mp-route-carriers.mjs'), dir }
}

test('exit 2:取不到映射台账/共享屏 ⇒ exit 2,stderr 点名「未判定」', () => {
  const fx = makeFixture()
  const r = spawnSync(process.execPath, [fx.entry], {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  assert.equal(r.status, 2, `stderr=${r.stderr}`)
  assert.match(String(r.stderr), /未判定/)
  assert.match(String(r.stderr), /取不到/)
})

test('自检:--self-test 10 例全绿(正例/反例/未判定/合法差异/判重/棘轮)', () => {
  const r = spawnSync(process.execPath, [SCRIPT, '--self-test'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  assert.equal(r.status, 0, `stderr=${r.stderr}`)
  assert.match(String(r.stdout), /自检 \d+ 例,失败 0/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
