// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试:守门 8(check-api-routes)的**探针档**(`--probe-ends`,2026-10-04)
//
// 票面主张"只扫 apps/web、其余端零判据" —— 现读已不成立(FRONTEND_ENDS 早已 7 端)。
// 本文件锁的是本轮**新增**的那一格:缺判据的端进扫描面,但**只报数、绝不判红**,
// 且**默认档读数一字不变**(票面硬约束)。
//
// 覆盖面:
//   ① 默认档不入面(方向锁:探针端在默认档下必须完全不可见)
//   ② --probe-ends 入面且逐端报数
//   ③ **永不判红**(探针端死调用存在时退出码仍为 0,且不得进 webViolations 名单)
//   ④ 基线不被探针端污染(--update-baseline 写出的 ends 不含探针端)
//   ⑤ 正例对照:已注册路径在探针端不得被报成"疑似不存在"(证明量出来的数不是噪声发生器)
//
// 不重写判据实现(重写就是第二份真相,会跟着源一起漂绿);只锁"装上了 / 有牙 / 不静默"。
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

function root() {
  const dir = mkScratch('ihui-api-routes-probe-')
  mkdirSync(join(dir, 'apps', 'api', 'src', 'routes'), { recursive: true })
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
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  r.out = (r.stdout || '').replace(/\x1b\[[0-9;]*m/g, '')
  return r
}
const BASELINE = JSON.stringify({ version: 1, perFileCount: {} })
/** 只注册一条无关路由的后端 ⇒ 任何真调用都会被判死(除非夹具里显式注册) */
function emptyBackend(dir) {
  put(dir, 'apps/api/src/routes/none.ts', "server.get('/api/nothing-at-all', async () => ({}))\n")
  put(dir, 'scripts/api-routes-baseline.json', BASELINE)
}

// ─── T1 方向锁:默认档下探针端必须**完全不可见**(票面硬约束"默认档读数不变") ───
test('T1 默认档:探针端不进扫描面 —— 输出里不得出现任何探针端名', () => {
  const dir = root()
  try {
    emptyBackend(dir)
    // 放一个**只在探针端目录里**的死调用:若探针端默认入面,它必然被判红(exit 1)
    put(dir, 'packages/sdk/src/ghost.ts', "fetchApi('/api/probedefault/ghost', { method: 'POST' })\n")
    const r = run(dir)
    assert.equal(r.status, 0, `默认档下 packages/sdk 不该被扫到,更不该判红\n${r.out}`)
    assert.doesNotMatch(
      r.out,
      /探针档/,
      `默认档不得打印探针档统计(证明 PROBE_ENDS 没进 ACTIVE_ENDS)\n${r.out}`,
    )
    for (const name of ['shared-pkg', 'sdk', 'auth-pkg', 'types-pkg', 'mobile-cap']) {
      assert.doesNotMatch(r.out, new RegExp(`· ${name}:`), `默认档读数多了 ${name} 一行\n${r.out}`)
    }
  } finally {
    rmScratch(dir)
  }
})

// ─── T2 装上了:开档后探针端入面,且逐端报出"文件/调用点/疑似不存在"三个数 ───
test('T2 --probe-ends:缺判据的端入面并逐端报数(此前这几端零判据)', () => {
  const dir = root()
  try {
    emptyBackend(dir)
    put(dir, 'packages/sdk/src/probe.ts', "fetchApi('/api/probesdk/ghost', { method: 'POST' })\n")
    const r = run(dir, ['--warn-only', '--probe-ends'])
    assert.equal(r.status, 0, `探针档不得改变退出码\n${r.out}`)
    assert.match(r.out, /探针档\(--probe-ends,只报数·永不判红\)/)
    // 五个探针端都必须出现,且带"疑似不存在"计数列
    for (const name of ['shared-pkg', 'sdk', 'auth-pkg', 'types-pkg', 'mobile-cap']) {
      assert.match(
        r.out,
        new RegExp(`· ${name}:文件 \\d+ / 调用点 \\d+ / 疑似不存在 \\d+`),
        `${name} 缺报数行\n${r.out}`,
      )
    }
    assert.match(r.out, /疑似不存在 1 /, `sdk 的死调用应被量出来\n${r.out}`)
    assert.match(r.out, /POST \/api\/probesdk\/ghost @ packages\/sdk\/src\/probe\.ts:1/)
  } finally {
    rmScratch(dir)
  }
})

// ─── T3 有牙但不咬人:探针端死调用**永不判红**(strict 档也不红) ───
test('T3 探针端死调用永不判红:strict 档退出码仍为 0(§12e 恒红门防线)', () => {
  const dir = root()
  try {
    emptyBackend(dir)
    put(dir, 'packages/sdk/src/ghost.ts', "fetchApi('/api/probestrict/ghost', { method: 'POST' })\n")
    put(dir, 'packages/shared/src/ghost.ts', "fetchApi('/api/probeshared/ghost', { method: 'POST' })\n")
    // 注意:**不传 --warn-only**,即 strict 档 —— 判据最严的那一档
    const r = run(dir, ['--probe-ends'])
    assert.equal(r.status, 0, `探针端判红就是恒红门(§12e),strict 档也必须 exit 0\n${r.out}`)
    assert.match(r.out, /探针档合计:2 条疑似不存在/)
    // 不得出现判红话术
    assert.doesNotMatch(r.out, /❌/, `探针档输出了判红话术\n${r.out}`)
  } finally {
    rmScratch(dir)
  }
})

// ─── T4 探针端不得污染基线:--update-baseline 写出的 ends 不含探针端 ───
test('T4 基线不被探针端污染:--update-baseline 的 ends 名单不含探针端', () => {
  const dir = root()
  try {
    emptyBackend(dir)
    put(dir, 'apps/miniapp-taro/src/g.ts', "fetchApi('/api/ratchetanchor/x', { method: 'POST' })\n")
    const r = run(dir, ['--probe-ends', '--update-baseline'])
    assert.equal(r.status, 0, `--update-baseline 应 exit 0\n${r.out}`)
    const written = JSON.parse(readFileSync(join(dir, 'scripts', 'api-routes-baseline.json'), 'utf8'))
    assert.ok(!('sdk' in (written.ends || [])), `基线 ends 混进了探针端 sdk:${JSON.stringify(written.ends)}`)
    assert.ok(
      !('shared-pkg' in (written.ends || [])),
      `基线 ends 混进了探针端 shared-pkg:${JSON.stringify(written.ends)}`,
    )
    // 棘轮端仍须在册(证明这不是把 ends 写空)
    assert.ok((written.ends || []).includes('miniapp-taro'), `棘轮端被误删\n${r.out}`)
  } finally {
    rmScratch(dir)
  }
})

// ─── T5 正例对照:已注册路径不得被报成"疑似不存在"(证明这个数不是噪声发生器) ───
test('T5 探针端正例:后端已注册的路径在探针端报 0(量出来的数可信)', () => {
  const dir = root()
  try {
    put(dir, 'scripts/api-routes-baseline.json', BASELINE)
    put(dir, 'apps/api/src/routes/ok.ts', "server.post('/api/engine/rpc', async () => ({}))\n")
    // 复刻 packages/sdk/src/agent-engine.ts:292 的真实形态:路径住在 const 里
    put(
      dir,
      'packages/sdk/src/agent-engine.ts',
      [
        "const RPC_PATH = '/api/engine/rpc'",
        'async function call(baseUrl) {',
        '  return this.fetchFn(`${this.baseUrl}${RPC_PATH}`, { method: "POST" })',
        '}',
        '',
      ].join('\n'),
    )
    const r = run(dir, ['--warn-only', '--probe-ends'])
    assert.equal(r.status, 0, `已注册路径不得判红\n${r.out}`)
    assert.match(r.out, /· sdk:文件 1 \/ 调用点 1 \/ 疑似不存在 0/)
  } finally {
    rmScratch(dir)
  }
})

// ─── T6 静默防线:探针端"有文件但 0 调用点"必须被点名(不得读成"已判过且没问题") ───
test('T6 探针端零调用点必须点名,不得静默记绿', () => {
  const dir = root()
  try {
    emptyBackend(dir)
    // 放一个**已注册**的前端调用,让 frontendRels.length > 0(silentEnds 那段的触发前提)
    put(dir, 'apps/api/src/routes/anchor.ts', "server.get('/api/anchor', async () => ({}))\n")
    put(dir, 'apps/web/src/anchor.ts', "fetchApi('/api/anchor')\n")
    // 探针端 auth-pkg:有受管文件、但整端不写路径字面量(真实仓 packages/auth 就是这一格)
    put(dir, 'packages/auth/src/providers/oidc.ts', 'export async function go(u: string) { return u }\n')
    const r = run(dir, ['--warn-only', '--probe-ends'])
    assert.equal(r.status, 0, `本用例不该判红\n${r.out}`)
    assert.match(
      r.out,
      /本轮 0 个调用点的端/,
      `"有文件但 0 调用点"的端必须被点名(判据失效的表现永远是安静)\n${r.out}`,
    )
    assert.match(
      r.out,
      /auth-pkg\(文件 1\)/,
      `探针端 auth-pkg 应出现在零调用点名单里\n${r.out}`,
    )
  } finally {
    rmScratch(dir)
  }
})

// ─── T7 源码级方向锁:PROBE_ENDS 不得被塞进 FRONTEND_ENDS(那是判红面) ───
test('T7 源码锁:PROBE_ENDS 与 FRONTEND_ENDS 是两个独立常量,探针端不在判红面里', () => {
  // 这条是防"后来者把探针端直接并进 FRONTEND_ENDS 求省事"—— 那样它会立刻继承
  // ratchet 语义(新增判红),本票的核心分寸(只报数)被静默推翻,而上面 T1–T6 全绿。
  const probeBlock = SRC.slice(SRC.indexOf('const PROBE_ENDS = ['))
  const frontendBlock = SRC.slice(
    SRC.indexOf('const FRONTEND_ENDS = ['),
    SRC.indexOf('const PROBE_ENDS = ['),
  )
  for (const name of ['shared-pkg', 'sdk', 'auth-pkg', 'types-pkg', 'mobile-cap']) {
    assert.ok(
      probeBlock.includes(`name: '${name}'`),
      `${name} 应在 PROBE_ENDS 里`,
    )
    assert.ok(
      !frontendBlock.includes(`name: '${name}'`),
      `${name} 出现在 FRONTEND_ENDS(判红面)里 —— 探针端不得继承 ratchet/零容忍语义`,
    )
  }
  // 判红桶必须显式排除探针端,而不是靠"名单里没有"隐式兜底
  assert.match(
    SRC,
    /const webViolations = realMissing\.filter\(\(c\) => \{[\s\S]*?PROBE_END_NAMES\.has\(end\)[\s\S]*?return false/,
    'webViolations 必须显式排除探针端',
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
