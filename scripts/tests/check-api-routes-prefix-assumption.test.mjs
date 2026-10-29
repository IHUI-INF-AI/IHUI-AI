// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 镜像测试:门 8「前缀假设」不再产生假绿(G-962 / O87g 收口,2026-10-29 立)。
 *
 * 本组钉的是三条判据,不是三条输出文案:
 *  · P1 精确挂载命中 ⇒ 绿(阳性对照:证明判据没被收紧成"一律未判定");
 *  · P2 精确挂载未命中 ⇒ 红(证明没放宽);
 *  · P3 图盲区兜底条目(`via:'fallback'`,前缀取自文件内部声明)+ 该文件无人挂载
 *       ⇒ **判红**。这就是本票要找的那台假绿:旧行为把兜底条目当注册,于是
 *       「客户端调用了一个生产上永远不会生效的路径」被记成「在册」,全门报通过。
 *       变异自证见交付报告:把 `if (e.via === 'fallback') continue` 摘掉 ⇒ 本组 P3 翻红;
 *  · P4 动态前缀(`register(x, { prefix: EXPR })`)⇒ 未判定并点名缺的输入,
 *       且**不得**落进「无后端路由」清单(按空前缀处理 = 假红);
 *  · P5 同文件常量前缀(`const BASE = '/api'`)⇒ 仍判命中(提取式已扩这一态,不得回退);
 *  · P6 源码锁:精确面构造必须同时跳过 `fallback` 与 `dynamic-prefix` 两种 via,
 *       且兜底两档的出口必须都带 evidence(禁消音)。
 * 读数全部从子进程输出里现取,不复制脚本里的常量(§22c)。
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

function root() {
  const dir = mkScratch('ihui-api-routes-prefix-')
  mkdirSync(join(dir, 'apps', 'api', 'src', 'routes'), { recursive: true })
  mkdirSync(join(dir, 'apps', 'web', 'src'), { recursive: true })
  return dir
}
function put(dir, rel, content) {
  const full = join(dir, ...rel.split('/'))
  mkdirSync(dirname(full), { recursive: true })
  writeFileSync(full, content)
}
function run(dir) {
  const r = spawnSync(process.execPath, [SCRIPT, '--worktree', '--root', dir], {
    cwd: HERE,
    encoding: 'utf8',
    // 不吃 stdin 的子进程也必须带管道:本机不带会 EBUSY(见记忆)
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  r.out = `${r.stdout || ''}${r.stderr || ''}`.replace(/\x1b\[[0-9;]*m/g, '')
  return r
}

/** 一个真挂载的插件(/api)+ 一个**没有任何 register 边指向**的孤儿路由文件 */
function fixture(dir, { withOrphan, webPaths }) {
  put(
    dir,
    'apps/api/src/server.ts',
    [
      "import Fastify from 'fastify'",
      "import { aRoutes } from './routes/a'",
      'export function buildServer() {',
      '  const server = Fastify()',
      "  server.register(aRoutes, { prefix: '/api' })",
      '  return server',
      '}',
      '',
    ].join('\n'),
  )
  put(
    dir,
    'apps/api/src/routes/a.ts',
    ['export async function aRoutes(server) {', "  server.get('/ok', async () => 1)", '}', ''].join('\n'),
  )
  if (withOrphan) {
    // 关键:文件里写的是**绝对路径** `/api/orphan`(库的 isAbsoluteApiPath 会原样收下),
    // 而 server.ts 从不 import 它 ⇒ 兜底条目 = `GET /api/orphan`,旧行为据此判绿。
    put(
      dir,
      'apps/api/src/routes/orphan.ts',
      [
        'export async function orphanRoutes(server) {',
        "  server.get('/api/orphan', async () => 0)",
        '}',
        '',
      ].join('\n'),
    )
  }
  put(
    dir,
    'apps/web/src/api.ts',
    webPaths.map((p, i) => `export const c${i} = fetchApi('${p}')`).join('\n'),
  )
}

function fixtureDynamic(dir, { prefixExpr }) {
  put(
    dir,
    'apps/api/src/server.ts',
    [
      "import Fastify from 'fastify'",
      "import { aRoutes } from './routes/a'",
      "import { dynRoutes } from './routes/dyn'",
      prefixExpr === 'const' ? "const BASE = '/api'" : '',
      'export function buildServer() {',
      '  const server = Fastify()',
      "  server.register(aRoutes, { prefix: '/api' })",
      `  server.register(dynRoutes, { prefix: ${prefixExpr === 'const' ? 'BASE' : 'BASE_PREFIX'} })`,
      '  return server',
      '}',
      '',
    ]
      .filter((l) => l !== '')
      .join('\n'),
  )
  put(
    dir,
    'apps/api/src/routes/a.ts',
    ['export async function aRoutes(server) {', "  server.get('/ok', async () => 1)", '}', ''].join('\n'),
  )
  put(
    dir,
    'apps/api/src/routes/dyn.ts',
    ['export async function dynRoutes(server) {', "  server.get('/ledger', async () => 1)", '}', ''].join('\n'),
  )
  put(dir, 'apps/web/src/api.ts', "export const c0 = fetchApi('/api/ok')\nexport const c1 = fetchApi('/api/ledger')")
}

// ─── P1 阳性:精确挂载命中必须仍判绿 ───
test('P1 精确挂载命中:/api/ok 在真挂载链上 ⇒ 通过(exit 0)', () => {
  const dir = root()
  try {
    fixture(dir, { withOrphan: false, webPaths: ['/api/ok'] })
    const r = run(dir)
    assert.equal(r.status, 0, `真挂载路径不得被判红\nstdout: ${r.out}`)
    assert.match(r.out, /✅ 通过/)
  } finally {
    rmScratch(dir)
  }
})

// ─── P2 防放宽:精确面未命中必须判红 ───
test('P2 精确挂载未命中:/api/nope 不存在 ⇒ 判红且点名为无后端路由', () => {
  const dir = root()
  try {
    fixture(dir, { withOrphan: false, webPaths: ['/api/nope'] })
    const r = run(dir)
    assert.equal(r.status, 1, `不存在的路径必须判红\nstdout: ${r.out}`)
    assert.match(r.out, /发现 \d+ 处前端调用无后端路由/)
    assert.match(r.out, /GET \/api\/nope/)
  } finally {
    rmScratch(dir)
  }
})

// ─── P3 本票的假绿本体:图盲区兜底条目 + 无人挂载 ⇒ 判红 ───
test('P3 图盲区兜底条目 + 无人挂载:孤儿路由文件里的 /api/orphan ⇒ 判红(旧行为是假绿)', () => {
  const dir = root()
  try {
    fixture(dir, { withOrphan: true, webPaths: ['/api/ok', '/api/orphan'] })
    const r = run(dir)
    assert.equal(
      r.status,
      1,
      `孤儿文件的路由不得被记成在册(这正是本票的假绿)\nstdout: ${r.out}`,
    )
    assert.match(
      r.out,
      /图盲区兜底条目 \d+ 条.*无人挂载 ⇒ 判红 1 条/,
      `兜底条目必须进不了精确面并报数\nstdout: ${r.out}`,
    )
    assert.match(r.out, /死调用\(图盲区兜底条目 \+ 无人挂载\)1 处/)
    assert.match(r.out, /GET \/api\/orphan/)
    // 禁消音:判红那行必须点名"零 import/零 register"这个缺的输入
    assert.match(r.out, /零 import\/零 register/)
  } finally {
    rmScratch(dir)
  }
})

// ─── P4 动态前缀:未判定 + 点名,且不得落进无后端路由 ───
test('P4 动态前缀 register(x, { prefix: EXPR }) ⇒ 未判定并点名缺的输入,不判红', () => {
  const dir = root()
  try {
    fixtureDynamic(dir, { prefixExpr: 'var' })
    const r = run(dir)
    assert.equal(
      r.status,
      0,
      `前缀未知的调用既不该判绿也不该判红\nstdout: ${r.out}`,
    )
    assert.match(r.out, /未判定\(动态前缀子树\)1 处/)
    assert.match(r.out, /缺的输入是前缀表达式的静态值/)
    assert.doesNotMatch(
      r.out.split('无后端路由')[1] || '',
      /\/api\/ledger/,
      `动态前缀下的调用不得被当成死调用(按空前缀处理 = 假红)\nstdout: ${r.out}`,
    )
  } finally {
    rmScratch(dir)
  }
})

// ─── P5 同文件常量前缀:提取式已覆盖,不得回退成假红 ───
test("P5 同文件常量前缀 const BASE = '/api' ⇒ 仍判命中(退出 0)", () => {
  const dir = root()
  try {
    fixtureDynamic(dir, { prefixExpr: 'const' })
    const r = run(dir)
    assert.equal(
      r.status,
      0,
      `常量前缀必须被提取式解出,否则 /api/ledger 会被假红\nstdout: ${r.out}`,
    )
    assert.doesNotMatch(r.out, /无后端路由/)
  } finally {
    rmScratch(dir)
  }
})

// ─── P6 源码锁:两种 via 必须在精确面构造处被跳过,且 evidence 不得缺 ───
test('P6 源码锁:精确面跳过 fallback/dynamic-prefix 两种 via,两档出口都带 evidence', () => {
  assert.match(
    SRC,
    /if \(e\.via === 'fallback'\) continue/,
    '精确注册面必须跳过图盲区兜底条目(摘掉即 P3 翻红)',
  )
  assert.match(
    SRC,
    /if \(e\.via === 'dynamic-prefix'\) continue/,
    '精确注册面必须跳过动态前缀条目(它们缺了前缀那一段)',
  )
  assert.match(SRC, /kind: 'orphan'/, '兜底条目必须有 orphan(判红)档')
  assert.match(SRC, /kind: 'blind'/, '兜底条目必须有 blind(未判定)档')
  assert.match(SRC, /无人挂载/, 'orphan 档的原因必须写清,禁消音')
  assert.match(SRC, /缺的输入是前缀表达式的静态值/, '动态前缀档必须点名缺什么输入')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
