// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * miniapp-shell-form.test.mjs —— 门 299 的镜像测试(§22c)。
 *
 * 判据不复制一份:分类/棘轮全部 import 源 lib 与源门 `__test__`;本文件只钉方向:
 *   T1 入口识别:只认 import,不认注释/字符串(观测面抗伪装)
 *   T2 等价入口:必须与声明 spec 对得上,不认野路径
 *   T3 分类:copy/pure、copy/local-delta、shell、不在射程、读不到 ⇒ undetermined
 *   T4 棘轮三向:增 = 红、存量在册 = 绿、存量收敛 = advisory
 *   T5 端到端:真实仓(HEAD 面)当前复制页全部在册 ⇒ exit 0
 *   T6 射程真覆盖:真实仓确有复制页与薄壳页(阳性/阴性对照材质都在)
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import {
  classifyMiniappPages,
  classifyPage,
  equivalentEntry,
  evaluateRatchet,
  hasShellImport,
  loadLedgerRows,
} from '../lib/miniapp-shell-form.mjs'
import { __test__ as G } from '../check-miniapp-shell-form.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SCRIPTS = join(ROOT, 'scripts')

const SPEC = ['packages/app/src/features/demo/DemoScreen.tsx']

test('T1 入口识别只认 import,不认注释/字符串/裸提及', () => {
  assert.equal(hasShellImport("import { DemoScreen } from '@rn-shells/DemoScreen'"), true)
  assert.equal(hasShellImport("import X from '@ihui/rn-app/features/demo/DemoScreen'"), false, '等价入口要走 equivalentEntry')
  assert.equal(hasShellImport('// 见 @rn-shells/DemoScreen'), false)
  assert.equal(hasShellImport("const s = '@rn-shells/DemoScreen'"), false)
  assert.equal(hasShellImport("import { __ } from '@rn-shells-utils/x'"), false, '前缀撞名不能误认')
})

test('T2 等价入口必须与声明 spec 对得上', () => {
  assert.match(
    equivalentEntry("import { S } from '@ihui/rn-app/features/demo/DemoScreen'", SPEC) || '',
    /rn-app\/features\/demo\/DemoScreen/,
  )
  assert.equal(equivalentEntry("import { S } from '@ihui/rn-app/features/other/OtherScreen'", SPEC), null)
  assert.equal(equivalentEntry("import { DemoScreen } from '@ihui/rn-app'", SPEC), "import {DemoScreen} from '@ihui/rn-app'")
  const otherSpec = ['packages/app/src/features/other/OtherScreen.tsx']
  assert.equal(equivalentEntry("import { DemoScreen } from '@ihui/rn-app'", otherSpec), null)
})

test('T3 分类:声明 + 无壳 = copy,并按数据层痕迹分 pure/local', () => {
  const base = {
    route: 'demo/x',
    file: 'demo/x.tsx',
    declaredSpecs: SPEC,
    registry: { miniapp: 'demo/x' },
  }
  const copy = classifyPage({ ...base, text: 'fetch("/api/x")' })
  assert.equal(copy.impl, 'copy')
  assert.equal(copy.reasonClass, 'local-delta')
  assert.equal(copy.mapStatus, 'registry+declaration')

  const pure = classifyPage({ ...base, text: "import { View } from '@tarojs/components'\n// 对齐 RN" })
  assert.equal(pure.reasonClass, 'pure-copy')

  const shell = classifyPage({ ...base, text: "import { DemoScreen } from '@rn-shells/DemoScreen'" })
  assert.equal(shell.impl, 'shell')

  assert.equal(classifyPage({ route: 'demo/p', file: 'demo/p.tsx', text: 'export default 1' }).impl, 'plain')
  assert.equal(classifyPage({ route: 'demo/u', file: 'demo/u.tsx', text: null }).impl, 'undetermined')
  assert.equal(classifyPage({ route: 'demo/m', file: null, text: null }).impl, 'undetermined')
})

test('T4 棘轮三向:增=红、存量在册=绿、存量收敛=advisory', () => {
  const copy = classifyPage({
    route: 'demo/x',
    file: 'demo/x.tsx',
    text: 'fetch("/api/x")',
    declaredSpecs: SPEC,
    registry: { miniapp: 'demo/x' },
  })
  const shell = classifyPage({
    route: 'demo/s',
    file: 'demo/s.tsx',
    text: "import { DemoScreen } from '@rn-shells/DemoScreen'",
    declaredSpecs: SPEC,
    registry: { miniapp: 'demo/s' },
  })
  assert.equal(evaluateRatchet([copy], []).reds.length, 1)
  assert.equal(evaluateRatchet([shell], []).reds.length, 0)
  const row = { route: copy.route, file: copy.file, loc: copy.loc, mapStatus: copy.mapStatus, reasonClass: copy.reasonClass, impl: 'copy' }
  assert.equal(evaluateRatchet([copy], [row]).reds.length, 0)
  assert.equal(evaluateRatchet([], [row]).advisories[0]?.rule, 'S2')
})

test('T5 真实仓 HEAD 面:当前复制页全部在册,门 exit 0', () => {
  const out = execFileSync(process.execPath, [join(SCRIPTS, 'check-miniapp-shell-form.mjs'), '--json'], {
    cwd: ROOT,
    encoding: 'utf8',
  })
  const j = JSON.parse(out)
  assert.equal(j.reds.length, 0)
  assert.ok(j.stats.copy > 0, '存量复制页必须被数出来,否则射程存疑')
  assert.ok(j.stats.shell > 0, '薄壳页必须被数出来,否则阴性对照缺失')
  assert.equal(j.stats.ledgerRows, loadLedgerRows(ROOT).length)
})

test('T6 射程真覆盖:真实仓同时存在复制页与薄壳页(对照材质)', () => {
  const { rows } = classifyMiniappPages(ROOT, 'head')
  assert.ok(rows.some((r) => r.impl === 'copy'), '阳性对照材质缺失')
  assert.ok(rows.some((r) => r.impl === 'shell' && r.mapStatus !== 'none'), '阴性对照材质缺失')
  assert.ok(rows.every((r) => r.mapStatus !== 'missing-file'), '映射指向不存在的页面 = 未判定,不该静默')
  assert.ok(G.validateLedger(loadLedgerRows(ROOT)).length === 0, '台账不得有腐烂行')
})

test('T7 台账行形状锁:必含 route/file/loc/mapStatus/reasonClass', () => {
  const rows = loadLedgerRows(ROOT)
  assert.ok(rows.length > 0)
  for (const r of rows) {
    assert.equal(typeof r.route, 'string')
    assert.match(r.file, /^apps\/miniapp-taro\/src\/.+\.[jt]sx$/)
    assert.ok(r.loc > 0)
    assert.ok(['registry+declaration', 'registry', 'declaration', 'ambiguous'].includes(r.mapStatus))
    assert.ok(['pure-copy', 'local-delta', 'undetermined'].includes(r.reasonClass))
  }
  // 台账是判据输入,永远从工作树读;门源码里不得出现对工作树业务代码的直读
  const src = readFileSync(join(SCRIPTS, 'check-miniapp-shell-form.mjs'), 'utf8')
  assert.ok(src.includes('GATE_ID: 299'), '门号头注缺失')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
