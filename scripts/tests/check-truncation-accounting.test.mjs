// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试(§22c):判据一律 import 门体的 __test__,本文件不复制任何正则/词表/阈值。
// 覆盖的是「升 blocking 的两条腿」:① 新增违规 ⇒ 红;② 存量零/全量档 ⇒ 绿(不冒红)。
// 另钉一枚接线锁:runner 注册条目 mode 与 skipEnv 必须成套(读工作树,与升档同批提交)。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { __test__ as gate } from '../check-truncation-accounting.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const RUNNER = join(HERE, '..', 'guardian-runner.mjs')

// ── 夹具:同一声明块,唯一变量 = 有没有计数/总量型数值兄弟键 ──────────────
const BARE =
  'export interface EnrichResult {\n' +
  '  items: Row[]\n' +
  '  truncated: boolean\n' +
  '}\n'
const WITH_COUNT =
  'export interface EnrichResult {\n' +
  '  items: Row[]\n' +
  '  total: number\n' +
  '  truncated: boolean\n' +
  '}\n'

function decideStaged(src, file = 'packages/types/src/fixture.ts') {
  return gate.decide({
    perFile: new Map([[file, gate.judgeSource(src)]]),
    undetermined: [],
    mode: 'staged',
    filesScanned: 1,
  })
}

// ── 1. 正反对照:本次改动带进裸奔站点 ⇒ 红;补齐计数键 ⇒ 绿 ───────────────
test('对照·红:声明块有数组成员 + truncated 而无计数兄弟 ⇒ --staged 判 1', () => {
  const r = decideStaged(BARE)
  assert.equal(r.sites.length, 1, '夹具必须被门体判为站点(判不出 ⇒ 本镜像无效)')
  assert.equal(r.exit, 1)
})

test('对照·绿:同型块补 total: number ⇒ 站点 0 且 --staged 判 0', () => {
  assert.equal(gate.judgeSource(WITH_COUNT).sites.length, 0)
  assert.equal(decideStaged(WITH_COUNT).exit, 0)
})

test('对照·唯一变量是计数键:两夹具只差那一行', () => {
  assert.equal(
    gate.judgeSource(WITH_COUNT).sites.length,
    0,
    '正型放行,而负型必须判红 —— 缺一边都不构成对照',
  )
})

// ── 2. 棘轮方向锁:全量档(HEAD 面)只报数,不得升档时偷偷变成恒红门 ───────
test('全量档只报数:同一裸奔夹具在 full/head 档恒 exit 0', () => {
  for (const mode of ['full', 'head']) {
    const r = gate.decide({
      perFile: new Map([['packages/types/src/fixture.ts', gate.judgeSource(BARE)]]),
      undetermined: [],
      mode,
      filesScanned: 1,
    })
    assert.equal(r.exit, 0, `mode=${mode} 必须只报数(§12e:存量非零不得拦提交)`)
    assert.equal(r.sites.length, 1, '报数维度仍要看得见这格(不得遮成「没有」)')
  }
})

// ── 3. 三态不并桶:未判定与空扫都是 exit 2,既不记绿也不冒红 ──────────────
test('未判定 ⇒ 2 · 空扫判死 ⇒ 2', () => {
  assert.equal(
    gate.decide({
      perFile: new Map([['packages/types/src/fixture.ts', gate.judgeSource(BARE)]]),
      undetermined: ['packages/types/src/x.ts'],
      mode: 'staged',
      filesScanned: 1,
    }).exit,
    2,
  )
  assert.equal(gate.decide({ perFile: new Map(), undetermined: [], mode: 'full', filesScanned: 0 }).exit, 2)
})

// ── 4. 绊线只咬代码标识符:写成代码 ⇒ 红;写在注释里 ⇒ 只报数 ─────────────
test('绊线:代码里的档位字段 ⇒ staged 判 1;注释提及 ⇒ 判 0', () => {
  const code = decideStaged('const p = req.deliveryProfile\n')
  assert.equal(code.tripwire.length, 1)
  assert.equal(code.exit, 1)
  const mention = decideStaged('// deliveryProfile: x\n')
  assert.equal(mention.tripwire.length, 0, '注释里的提及不得进判红面')
  assert.equal(mention.exit, 0)
})

// ── 5. 射程边界(覆盖面不随升档漂移)────────────────────────────────────
test('射程:声明层源根进射程;测试目录与根外路径不进', () => {
  assert.equal(gate.inTsRoots('packages/types/src/a.ts'), true)
  assert.equal(gate.inTsRoots('apps/api/src/routes/a.ts'), true)
  assert.equal(gate.inPyRoots('apps/ai-service/app/services/a.py'), true)
  // TEST_RE 排的是「目录形态」(tests/ __tests__/ e2e/ test/),不是 *.test.ts 文件名 —— 现读口径
  assert.equal(gate.inTsRoots('packages/types/tests/a.ts'), false)
  assert.equal(gate.inTsRoots('packages/shared/__tests__/a.ts'), false)
  assert.equal(gate.inTsRoots('apps/web/src/a.ts'), false, 'TS_ROOTS 现值不含 apps/web')
  assert.equal(gate.inTsRoots('packages/types/src/a.md'), false)
})

// ── 6. 接线锁:升档必须成套(mode=blocking + skipEnv),否则 = 假门 ───────
test('注册条目:197 为 blocking 且 skipEnv 成套(读工作树,与升档同批)', () => {
  const text = readFileSync(RUNNER, 'utf8')
  const start = text.indexOf("    id: '197',")
  assert.notEqual(start, -1, 'runner 里必须仍有 id 197 条目')
  const next = text.indexOf("    id: '198',", start)
  const entry = text.slice(start, next === -1 ? start + 2000 : next)
  assert.match(entry, /script: 'check-truncation-accounting\.mjs'/, '197 必须仍是这把尺')
  assert.match(entry, /mode: 'blocking'/, '升档后 mode 必须是 blocking(档位与声称同形,§0.9)')
  assert.match(entry, /skipEnv: 'HUSKY_SKIP_TRUNCATION_ACCOUNTING'/, 'blocking 必须配应急跳过变量')
  assert.match(entry, /stagedTriggers:/, '棘轮门必须保留 stagedTriggers,否则每次提交全量扫')
  const idCount = (text.match(/^\s*id: '197',$/gm) || []).length
  assert.equal(idCount, 1, 'R5:同一 id 不得登记两道门')
})

// 门体头注自称的档位必须与注册表现值同形(文档与代码不得脱节)
test('门体头注不得再自称 warn/观察档', () => {
  const src = readFileSync(
    join(HERE, '..', 'check-truncation-accounting.mjs'),
    'utf8',
  )
  const head = src.split('\n').slice(0, 20).join('\n')
  assert.match(head, /档位现读 = blocking/)
  assert.doesNotMatch(head, /不是 blocking 判据/, '头注与注册表脱节即门 89 R1/R2 型撒谎')
})

// ── 7. 判据不复制(门 191):本文件不得出现第二份词表/正则实现 ────────────
test('镜像测试零判据复制:只 import __test__', () => {
  const self = readFileSync(fileURLToPath(import.meta.url), 'utf8')
  const body = self.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n')
  for (const name of ['COUNT_NAME_RE', 'NUMERIC_TYPE_RE', 'ARRAY_TYPE_RE', 'PROFILE_TIER_RE']) {
    assert.ok(gate[name] instanceof RegExp, `门体必须仍导出 ${name}(判据单一真相源)`)
    assert.doesNotMatch(body, new RegExp(`const ${name}`), `测试里不得再声明 ${name}`)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
