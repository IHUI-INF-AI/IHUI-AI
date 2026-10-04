// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 纯通配注册造成的覆盖缺口(2026-10-04):**门必须如实报出它,不得把"没判"写成"判过了"。**
 *
 * 缺陷本体:`matchSegs` 双向跳过 `:param` 段后「段数相等」成了唯一约束,
 * 于是纯通配注册(`/api/:type/:id` 这种)吞掉任意同段数路径 ——
 * 注入一条**明显不存在**的 `/api/zzz-not-here` 本门也不报(实证见 matchSegs 上方注释)。
 *
 * 关键取舍:匹配侧**刻意不收紧**。量表显示收紧后各端新增死调用 +294 条,
 * 而抽样里大量是**真实接口**(`/api/plans` = `billing.ts:25` 的 `'/plans'` +
 * `routes/index.ts:536` 的 `prefix:'/api'`)—— 纯通配是本仓 prefix 拼接的**常态**,
 * 按形态收紧会误杀 ⇒ 恒红门 ⇒ 逼人 `--no-verify`(AGENTS §12e)。
 * 正解在取材侧(拼接保住中间段),不在匹配侧。
 *
 * 所以本组钉的是**"门不把缺口记成绿"**,不是"门堵住了缺口":
 *   G1 覆盖缺口提示**无条件**打印,且措辞明说"死调用 0 只代表在可判面内为 0";
 *   G2 该提示出现在 `✅ 通过` 结论行**之前**(顺序反了等于被结论盖住);
 *   G3 死调用为 0 时提示**仍在**(最容易被省掉的正是这一档 —— 正是它把缺口变成了绿);
 *   G4 缺口提示不得计失败(不判红,§12e)。
 *
 * 不重写判据实现(重写就是第二份真相,会跟着源一起漂绿);只锁"有牙 / 不静默"。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPT = join(HERE, '..', 'check-api-routes.mjs')
const SRC = readFileSync(SCRIPT, 'utf8')

const BASELINE = JSON.stringify({ version: 1, perFileCount: {} })

function root() {
  const dir = mkScratch('ihui-api-routes-gap-')
  mkdirSync(join(dir, 'apps', 'api', 'src', 'routes'), { recursive: true })
  mkdirSync(join(dir, 'apps', 'web', 'src'), { recursive: true })
  return dir
}
function put(dir, rel, content) {
  const full = join(dir, ...rel.split('/'))
  mkdirSync(dirname(full), { recursive: true })
  writeFileSync(full, content)
}
function run(dir, extra = []) {
  const r = spawnSync(process.execPath, [SCRIPT, '--worktree', '--root', dir, ...extra], {
    cwd: HERE,
    encoding: 'utf8',
    // 不建 stdin 管道在本机会必 EBUSY(见记忆:凡不吃 stdin 的子进程一律带管道)
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  r.out = (r.stdout || '').replace(/\x1b\[[0-9;]*m/g, '')
  return r
}

/**
 * 复现缺陷的夹具:后端有一条**纯通配**注册 `/:type/:id`(经 prefix `/api/admin/content`
 * 拼接后落成 `/api/:type/:id`),前端调一条**明显不存在**的 `/api/zzz-not-here`。
 * 期望:门**不报死调用**(这正是缺口),但**必须**打出覆盖缺口提示。
 */
function gapFixture(dir) {
  put(
    dir,
    'apps/api/src/routes/content.ts',
    "server.get('/:type/:id', async () => ({}))\n",
  )
  put(dir, 'apps/web/src/calls.ts', "fetch('/api/zzz-not-here')\n")
  put(dir, 'scripts/api-routes-baseline.json', BASELINE)
}

// ─── G1/G2/G3 缺口提示本身 ───

test('G1 覆盖缺口提示无条件打印,且措辞明说"死调用 0 只代表在可判面内为 0"', () => {
  const dir = root()
  try {
    gapFixture(dir)
    const r = run(dir)
    assert.match(r.out, /覆盖缺口/, '覆盖缺口提示必须出现')
    assert.match(
      r.out,
      /只代表"在可判面内为 0",不代表全量对账通过/,
      '措辞必须点破"0 处"不等于"对账通过"',
    )
  } finally {
    rmScratch(dir)
  }
})

test('G2 缺口提示出现在 `✅ 通过` 结论行之前(顺序反了等于被结论盖住)', () => {
  const dir = root()
  try {
    gapFixture(dir)
    const r = run(dir)
    const iGap = r.out.indexOf('覆盖缺口')
    const iPass = r.out.search(/✅ 通过|❌ 未通过/)
    assert.ok(iGap >= 0, '缺口提示缺失')
    if (iPass >= 0) {
      assert.ok(iGap < iPass, `缺口提示(${iGap})必须早于结论行(${iPass}),否则读者只看到结论`)
    }
  } finally {
    rmScratch(dir)
  }
})

test('G3 死调用为 0 的那一档也必须打提示(最容易被省的正是这一档)', () => {
  const dir = root()
  try {
    gapFixture(dir)
    const r = run(dir)
    // 这一档正是"把缺口读成绿"的高危场景:门报 0 处死调用,人以为全对账过了
    assert.match(r.out, /死调用 0 处|新增 0 处死调用/, '夹具前提:本轮死调用应为 0')
    assert.match(
      r.out,
      /覆盖缺口/,
      '死调用为 0 时缺口提示**仍**必须出现 —— 正是这一档把缺口变成了绿',
    )
  } finally {
    rmScratch(dir)
  }
})

test('G4 缺口提示不计失败(不判红,§12e 恒红门防线)', () => {
  const dir = root()
  try {
    gapFixture(dir)
    const r = run(dir, ['--warn-only'])
    assert.equal(r.status, 0, `缺口提示不得让守门失败,实得 status=${r.status}`)
  } finally {
    rmScratch(dir)
  }
})

// ─── G5 源码锁:缺口注释与提示不得被静默删掉 ───

test('G5 源码锁:matchSegs 上方的缺口证据链注释不得被删(否则下一个人要重查一遍)', () => {
  assert.match(SRC, /已知假绿\(2026-10-04 定位并实证/, '缺口证据链注释缺失')
  assert.match(SRC, /crud\.ts:112/, '证据链必须点名那个真实注册的位置')
  assert.match(SRC, /billing\.ts/, '必须点名"纯通配是常态"的反例,否则下一个人会直接收紧判据')
})

test('G6 缺口提示是无条件打印,不受本轮读数影响', () => {
  // 防的是有人把它挪进 `if (死调用 > 0)` 之类 —— 那样"死调用 0"那档就又静默了
  const iLog = SRC.indexOf('覆盖缺口:含 ')
  assert.ok(iLog > 0, '提示字面量缺失')
  const before = SRC.lastIndexOf('if (', iLog)
  const guard = SRC.slice(before, iLog)
  // 提示的前置条件里不得含"死调用 > 0"之类的读数依赖
  assert.ok(
    !/死调用\s*[>!=]/.test(guard.slice(guard.lastIndexOf('\n'))),
    '缺口提示不得挂在"死调用 > 0"这类读数条件下',
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
