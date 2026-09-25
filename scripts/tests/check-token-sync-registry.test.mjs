// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * scripts/tests/check-token-sync-registry.test.mjs — 守门「TOKEN_SYNC_TARGETS 登记表四向对账」
 * 的 §22c 镜像测试。判据全部经 `__test__` 直取源实现(不复制镜像常量);面纪律行为用
 * 纯函数 + 构造面证明,不依赖真仓瞬时状态(真仓 HEAD 会被并行会话推进)。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
// §22c 装车锚点:测试必须直接 import 源脚本的 __test__,而非复读实现
import { __test__ as gate } from '../check-token-sync-registry.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SRC_PATH = path.join(HERE, '..', 'check-token-sync-registry.mjs')
const SRC = readFileSync(SRC_PATH, 'utf8')

function mkFiles(map) {
  const paths = new Set(Object.keys(map))
  return {
    paths,
    hasPath: (p) => paths.has(p),
    readText: (p) => (Object.prototype.hasOwnProperty.call(map, p) ? map[p] : null),
  }
}

function evalPure(files, tableSrc, runnerSrc = 'export const CHECKS = []\n') {
  const ctx = mkFiles(files)
  return gate.evaluateRegistry({
    hookSrc: tableSrc,
    runnerSrc,
    otherRefsText: '',
    paths: ctx.paths,
    hasPath: ctx.hasPath,
    readText: ctx.readText,
  })
}

const ROW_FILES = {
  'trig1.css': 'x',
  'scripts/sync-row1.mjs': '// stub',
  'scripts/check-row1.mjs': '// stub',
}
const BLOCKING = (name = 'check-row1.mjs') =>
  gate.regRunner([{ id: '9', script: name, mode: 'blocking' }])

test('T1 §22c 锚点:源脚本 export __test__ 且核心判据函数齐备', () => {
  for (const key of [
    'extractTokenSyncTargets',
    'classifyCmd',
    'parseGuardianRegistrations',
    'evaluateRegistry',
    'basenameOf',
  ])
    assert.equal(typeof gate[key], 'function', `__test__ 缺 ${key}`)
})

test('T2 形状锁(核心):pre-commit-hook 的表行若缺 check 字段,本门必判红而不是跳过', () => {
  const noCheck = { ...gate.goodRow(1) }
  delete noCheck.check
  const v = evalPure(ROW_FILES, gate.buildTableSrc([noCheck]))
  assert.equal(v.status, 'red')
  assert.ok(
    v.violations.some((s) => /R1 .*缺字段 `check`/.test(s)),
    `未点名缺 check:${JSON.stringify(v.violations)}`,
  )
})

test('T3 形状锁反向对照:同表补 check + guardian blocking ⇒ 全绿', () => {
  const v = evalPure(ROW_FILES, gate.buildTableSrc([gate.goodRow(1)]), BLOCKING())
  assert.equal(v.status, 'ok', `应绿,实得 ${JSON.stringify(v.violations)}`)
  assert.equal(v.violations.length, 0)
})

test('T4 R4 自证防护:表行自己的 check: 值不得充当"复核者在场"证据', () => {
  // 只在表里出现、五处权威点零引用 ⇒ 必红;若 blankRange 失效,这里会误绿。
  const v = evalPure(ROW_FILES, gate.buildTableSrc([gate.goodRow(1)]))
  assert.ok(v.violations.some((s) => /R4 .*零引用/.test(s)), JSON.stringify(v.violations))
  assert.equal(v.undetermined.length, 0, '不得以"判不出"洗掉摘线红')
})

test('T5 classifyCmd 三形态', () => {
  assert.deepEqual(gate.classifyCmd('node scripts/sync-a.mjs --quiet'), {
    kind: 'node-script',
    path: 'scripts/sync-a.mjs',
  })
  assert.deepEqual(gate.classifyCmd('pnpm --filter @ihui/demo sync-tokens'), {
    kind: 'pnpm-script',
    pkg: '@ihui/demo',
    script: 'sync-tokens',
  })
  assert.deepEqual(gate.classifyCmd('pnpm --filter @ihui/demo run build'), {
    kind: 'pnpm-script',
    pkg: '@ihui/demo',
    script: 'build',
  })
  assert.equal(gate.classifyCmd('bash -c x').kind, 'unknown')
})

test('T6 parseGuardianRegistrations:识别 script/mode,无 script 块忽略,无 mode 记 null', () => {
  const src = [
    'export const CHECKS = [',
    "  {",
    "    id: '1',",
    "    script: 'check-a.mjs',",
    "    mode: 'blocking',",
    '  },',
    "  {",
    "    id: '2',",
    "    script: 'check-b.mjs',",
    '  },',
    "  {",
    "    id: '3',",
    '  },',
    ']',
  ].join('\n')
  const regs = gate.parseGuardianRegistrations(src)
  assert.equal(regs.length, 2)
  assert.deepEqual(
    regs.map((r) => [r.id, r.script, r.mode]),
    [
      ['1', 'check-a.mjs', 'blocking'],
      ['2', 'check-b.mjs', null],
    ],
  )
})

test('T7 形状漂 ⇒ unparseable(判据层),由 evaluateRegistry 折成"无法判定"而非 0 行绿', () => {
  const ext = gate.extractTokenSyncTargets('const TOKEN_SYNC_TARGETS = loadTargets()\n')
  assert.equal(ext.status, 'unparseable')
  const v = evalPure({}, 'const TOKEN_SYNC_TARGETS = loadTargets()\n')
  assert.equal(v.status, 'undetermined')
  const v2 = evalPure({}, 'const TOKEN_SYNC_TARGETS = []\n')
  assert.equal(v2.status, 'undetermined', '空扫同样不得记绿')
})

test('T8 R4 warn 注册 ⇒ 红;注册块取不出 mode ⇒ 未判定(不记绿不冒红)', () => {
  const warn = gate.regRunner([{ id: '9', script: 'check-row1.mjs', mode: 'warn' }])
  const v1 = evalPure(ROW_FILES, gate.buildTableSrc([gate.goodRow(1)]), warn)
  assert.ok(v1.violations.some((s) => /mode:'warn'/.test(s)))
  const noMode =
    "export const CHECKS = [\n  {\n    id: '9',\n    script: 'check-row1.mjs',\n  },\n]\n"
  const v2 = evalPure(ROW_FILES, gate.buildTableSrc([gate.goodRow(1)]), noMode)
  assert.equal(v2.status, 'ok')
  assert.ok(v2.undetermined.some((s) => /R4/.test(s)))
})

test('T9 头注诚实(守门 89 反向锁):声称"接线由主会话统一做"且通篇无肯定式已接线声称', () => {
  assert.match(SRC, /接线由主会话统一做/)
  const affirm = /(已接|已接入|已注册到|挂在)\s*(guardian-runner|pre-commit|CI)/
  assert.ok(!affirm.test(SRC), `头注出现肯定式接线声称,但它并未经接线:${affirm.exec(SRC)?.[0]}`)
})

test('T10 §22d/§22c 结构锁:isDirectRun 守卫在 __test__ 导出之前,测试 import 不触发 main', () => {
  const guard = SRC.indexOf('const isDirectRun')
  const exp = SRC.indexOf('export const __test__')
  assert.ok(guard > 0 && exp > guard, 'isDirectRun 守卫必须存在且先于 __test__ 导出')
  assert.match(SRC, /pathToFileURL\(process\.argv\[1\]\)\.href/)
})

test('T11 git 纪律:取材一律走 face-reader(绝对路径 git + timeout + windowsHide 由层统一提供)', () => {
  assert.match(SRC, /from '\.\/lib\/face-reader\.mjs'/)
  assert.ok(!/execFileSync\(\s*['"]git['"]/.test(SRC), '禁止裸 execFileSync("git")')
  assert.ok(!/execSync\(\s*['"]git\s/.test(SRC), '禁止裸 execSync("git …")')
  assert.ok(!/shell:\s*true/.test(SRC), '不得依赖 shell:true 调 pnpm/git(CMD shim ENOENT,§5b)')
  assert.match(SRC, /spawnSync\(process\.execPath[\s\S]{0,200}?windowsHide:\s*true/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
