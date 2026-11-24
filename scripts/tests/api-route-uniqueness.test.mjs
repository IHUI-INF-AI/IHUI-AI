// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 镜像测试(§22c):`check-api-route-uniqueness.mjs`(门 269)与 `lib/api-route-uniqueness.mjs`。
 *
 * **判据一份都不复制**:纯档全部 import 源脚本 `__test__`(§0.6);端到端档跑真 CLI,
 * 只用「退出码 + 结论行」取证 —— 门的失效形态历来是「静默变绿」,所以每条方向都配成对的
 * 反向夹具:重复 ⇒ 红、不重复 ⇒ 绿、取不到面 ⇒ 未判定(§0.3)。
 *
 * 覆盖的方向(逐条对应判据设计,不是凑数):
 *   T1 出口面 / 判据单源形状锁 —— CLI 不得自己抽路径(正则只许住取材层)
 *   T2 同前缀两处同名 ⇒ 1 条重复,两处位置逐条点名(事故原形)
 *   T3 不同前缀 ⇒ 0(反向对照:不是恒红)
 *   T4 同路径不同方法 ⇒ 0(method 是键的一部分)
 *   T5 通配 ANY 与具体方法相撞 ⇒ 1
 *   T6 站点归一:同一声明被展开两次只算一处(菱形/近似挂载的重入不是两处注册)
 *   T7 内联别名塌陷:三块同名形参 ⇒ 整块判不可判定并报出,不得变 3 个假阳性
 *   T8 兜底前缀(via=fallback)剔除并报数
 *   T9 棘轮三向:增 = 红、降 = 只报数、平 = 绿
 *   T10 出口码三态(含基线不可得却已有重复 ⇒ 2 不猜)
 *   T11 参数名差异只作旁路报数,不进判红面
 *   T12 CLI 用法错:未知旗标 / 两面旗同给 ⇒ exit 2
 *   T13 端到端:干净仓 ⇒ exit 0
 *   T14 端到端:暂存一枚重复 ⇒ exit 1 且两处位置都点名
 *   T15 端到端:重复已在 HEAD(存量)⇒ exit 0,只报数(棘轮锚点 = 基线自身)
 *   T16 端到端:射程为空 ⇒ exit 2 未判定,绝不记绿
 *   T17 端到端:--worktree 磁盘面能判(人工档)
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import {
  EXCLUDE_REASON,
  __test__ as U,
  analyzeRouteUniqueness,
  decideExitCode,
} from '../lib/api-route-uniqueness.mjs'
import { gitBinary } from '../lib/face-reader.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { copyScriptWithClosure } from '../lib/scratch-module-closure.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const SCRIPTS = join(REPO, 'scripts')
const CLI_REL = 'check-api-route-uniqueness.mjs'
const CLI = join(SCRIPTS, CLI_REL)

const GIT = gitBinary()
const RUN_OPTS = { encoding: 'utf8', windowsHide: true, timeout: 120_000, maxBuffer: 64 << 20 }
const runGit = (dir, args) =>
  execFileSync(
    GIT,
    [
      '-c',
      'safe.directory=*',
      '-c',
      'user.email=t@e2e.local',
      '-c',
      'user.name=e2e',
      '-c',
      'core.autocrlf=false',
      '-C',
      dir,
      ...args,
    ],
    { ...RUN_OPTS, stdio: ['ignore', 'pipe', 'pipe'] },
  )

/** 起一片夹具面(纯函数档不落盘:直接喂 Map)。 */
function fixture(serverBody, extra = {}) {
  const files = new Map()
  files.set(
    'apps/api/src/server.ts',
    `import { aRoutes } from './routes/a.js'\nimport { bRoutes } from './routes/b.js'\nexport async function buildServer(server) {\n${serverBody}\n}\n`,
  )
  const plugin = (name, path = '/x') => `
import type { FastifyPluginAsync } from 'fastify'
export const ${name}: FastifyPluginAsync = async (server) => {
  server.get('${path}', async () => 'ok')
}
`
  files.set('apps/api/src/routes/a.ts', plugin('aRoutes'))
  files.set('apps/api/src/routes/b.ts', plugin('bRoutes'))
  for (const [rel, text] of Object.entries(extra)) files.set(rel, text)
  return files
}

const SAME_PREFIX = `  server.register(aRoutes, { prefix: '/api/a' })\n  server.register(bRoutes, { prefix: '/api/a' })`
const DIFF_PREFIX = `  server.register(aRoutes, { prefix: '/api/a' })\n  server.register(bRoutes, { prefix: '/api/b' })`

test('T1 出口面齐备 + 判据单源形状锁(CLI 不得自己抽路径)', () => {
  for (const k of [
    'analyzeFace',
    'classifyEntries',
    'countByKey',
    'decideExitCode',
    'detectInlineAliasCollisions',
    'findDuplicateRoutes',
    'findParamAdvisories',
    'lineInBlocks',
    'methodsOverlap',
    'ratchetDuplicates',
    'routeKey',
    'siteKey',
  ])
    assert.equal(typeof U[k], 'function', `lib 的 __test__ 缺 ${k}`)
  // 形状锁:路由动词正则只许住在取材层。CLI 里出现就是第二份挂载图(§0.6 两处实现必漂移)。
  const cliSrc = readFileSync(CLI, 'utf8')
  assert.ok(
    !/\\\.\(get\|post\|put\|patch\|delete\)/.test(cliSrc),
    'CLI 里出现了路由动词正则 —— 判据被复制了',
  )
  assert.ok(cliSrc.includes('analyzeRouteUniqueness'), 'CLI 必须经 lib 入口')
  // 派生 git 一律走 face-reader(§12g):裸 execFileSync('git') 会被门 193 判红。
  assert.ok(!/execFileSync\(\s*['"]git/.test(cliSrc), 'CLI 里出现了裸 git 派生')
})

test('T2 同前缀两处同名注册 ⇒ 1 条重复,两处位置逐条点名', () => {
  const r = analyzeRouteUniqueness(fixture(SAME_PREFIX), { baseFiles: new Map() })
  assert.equal(r.duplicates.length, 1, JSON.stringify(r.duplicates.map((d) => d.key)))
  assert.equal(r.duplicates[0].key, 'GET /api/a/x')
  assert.deepEqual(r.duplicates[0].sites.map((s) => s.file).sort(), [
    'apps/api/src/routes/a.ts',
    'apps/api/src/routes/b.ts',
  ])
})

test('T3 不同前缀 ⇒ 0 条(反向对照:不是恒红)', () => {
  const r = analyzeRouteUniqueness(fixture(DIFF_PREFIX), { baseFiles: new Map() })
  assert.equal(r.duplicates.length, 0, JSON.stringify(r.duplicates.map((d) => d.key)))
})

test('T4 同路径不同方法 ⇒ 0 条(method 是键的一部分)', () => {
  const files = fixture(DIFF_PREFIX, {
    'apps/api/src/routes/c.ts': `
import type { FastifyPluginAsync } from 'fastify'
export const cRoutes: FastifyPluginAsync = async (server) => {
  server.post('/x', async () => 'ok')
}
`,
  })
  files.set(
    'apps/api/src/server.ts',
    `import { aRoutes } from './routes/a.js'\nimport { cRoutes } from './routes/c.js'\nexport async function buildServer(server) {\n  server.register(aRoutes, { prefix: '/api/a' })\n  server.register(cRoutes, { prefix: '/api/a' })\n}\n`,
  )
  const r = analyzeRouteUniqueness(files, { baseFiles: new Map() })
  assert.equal(r.duplicates.length, 0, JSON.stringify(r.duplicates.map((d) => d.key)))
})

test('T5 通配 ANY 与具体方法在同一路径相撞', () => {
  const dup = U.findDuplicateRoutes([
    { method: 'GET', path: '/a', file: 'f.ts', line: 3, via: 'graph' },
    { method: 'ANY', path: '/a', file: 'g.ts', line: 5, via: 'graph' },
  ])
  assert.equal(dup.length, 1)
  assert.equal(dup[0].sites.length, 2)
  assert.ok(U.methodsOverlap('GET', 'ANY'))
  assert.ok(!U.methodsOverlap('GET', 'POST'))
})

test('T6 站点归一:同一声明被展开两次只算一处', () => {
  const one = { method: 'GET', path: '/a', file: 'f.ts', line: 3, via: 'graph' }
  const dup = U.findDuplicateRoutes([one, { ...one }, { ...one, file: 'g.ts' }])
  assert.equal(dup.length, 1)
  assert.equal(dup[0].sites.length, 2, '同 file+line+method+path 必须折成一个站点')
})

test('T7 内联别名塌陷:整块判不可判定并报出,不得变成假阳性', () => {
  const files = new Map()
  files.set(
    'apps/api/src/server.ts',
    `import { aliasRoutes } from './routes/alias.js'\nexport async function buildServer(server) {\n  server.register(aliasRoutes, { prefix: '/api/admin' })\n}\n`,
  )
  files.set(
    'apps/api/src/routes/alias.ts',
    `
import type { FastifyPluginAsync } from 'fastify'
export const aliasRoutes: FastifyPluginAsync = async (server) => {
  server.register(
    async (s) => {
      s.get('/list', async () => 'a')
      s.delete('/clean', async () => 'a')
    },
    { prefix: '/login-logs' },
  )
  server.register(
    async (s) => {
      s.get('/list', async () => 'b')
      s.delete('/clean', async () => 'b')
    },
    { prefix: '/tasks/logs' },
  )
  server.register(
    async (s) => {
      s.get('/list', async () => 'c')
      s.delete('/clean', async () => 'c')
    },
    { prefix: '/posts' },
  )
}
`,
  )
  const r = analyzeRouteUniqueness(files, { baseFiles: new Map() })
  assert.equal(
    r.duplicates.length,
    0,
    `塌陷块不得判重复:${JSON.stringify(r.duplicates.map((d) => d.key))}`,
  )
  assert.equal(
    r.excludeByReason[EXCLUDE_REASON.INLINE_ALIAS_COLLISION],
    6,
    '三块 × 两条 = 6 条须记不可判定',
  )
  assert.equal(r.collisions.length, 1)
  assert.equal(r.collisions[0].groups[0].param, 's')
  assert.deepEqual(
    r.collisions[0].groups[0].blocks.map((b) => b.prefix),
    ['/login-logs', '/tasks/logs', '/posts'],
  )
})

test('T8 兜底前缀(via=fallback)剔除并报数', () => {
  const files = new Map()
  files.set(
    'apps/api/src/server.ts',
    `export async function buildServer(server) {\n  server.get('/', async () => 'ok')\n}\n`,
  )
  files.set(
    'apps/api/src/routes/orphan.ts',
    `
import type { FastifyPluginAsync } from 'fastify'
export const orphanRoutes: FastifyPluginAsync = async (server) => {
  server.get('/', async () => 'a')
}
`,
  )
  const r = analyzeRouteUniqueness(files, { baseFiles: new Map() })
  assert.ok(
    r.excludeByReason[EXCLUDE_REASON.FALLBACK_PREFIX] >= 1,
    JSON.stringify(r.excludeByReason),
  )
  assert.equal(r.duplicates.length, 0, '兜底前缀不是真实挂载前缀,不得判重复')
})

test('T9/T10 棘轮三向 + 出口码三态', () => {
  const at = (n) => ({
    method: 'GET',
    path: '/a',
    key: 'GET /a',
    sites: Array.from({ length: n }, (_, i) => ({ file: 'f.ts', line: i + 1 })),
  })
  assert.equal(U.ratchetDuplicates([at(1)], [at(2)]).regressed.length, 1, '站点变多 = 回归')
  assert.equal(U.ratchetDuplicates([at(2)], [at(1)]).regressed.length, 0, '站点变少 = 只报数')
  assert.equal(U.ratchetDuplicates([at(2)], [at(2)]).regressed.length, 0, '持平 = 绿')
  assert.deepEqual(
    [
      decideExitCode({ determinableCount: 0 }),
      decideExitCode({ determinableCount: 5, regressedCount: 1 }),
      decideExitCode({ determinableCount: 5, duplicateCount: 1, baselineKnown: false }),
      decideExitCode({ determinableCount: 5, duplicateCount: 1, baselineKnown: true }),
    ],
    [2, 1, 2, 0],
  )
})

test('T11 参数名差异只作旁路报数,不进判红面', () => {
  const entries = [
    { method: 'GET', path: '/api/x/:id', file: 'f.ts', line: 1, via: 'graph' },
    { method: 'GET', path: '/api/x/:uuid', file: 'g.ts', line: 2, via: 'graph' },
  ]
  assert.equal(U.findDuplicateRoutes(entries).length, 0, '参数名不同不得判红(版本语义不一)')
  assert.equal(U.findParamAdvisories(entries).length, 1, '但必须旁路报出来')
})

// ── 端到端:真 CLI + scratch git 仓(禁 os.tmpdir / 禁仓内嵌套仓) ──────────────

function makeRepo(t, { commitFirst = true } = {}) {
  const dir = mkScratch('route-uniq-')
  t.after(() => rmScratch(dir))
  runGit(dir, ['init', '-q'])
  const write = (rel, text) => {
    mkdirSync(dirname(join(dir, rel)), { recursive: true })
    writeFileSync(join(dir, rel), text)
  }
  write(
    'apps/api/src/server.ts',
    `import { aRoutes } from './routes/a.js'\nimport { bRoutes } from './routes/b.js'\nexport async function buildServer(server) {\n${SAME_PREFIX}\n}\n`,
  )
  write(
    'apps/api/src/routes/a.ts',
    `import type { FastifyPluginAsync } from 'fastify'\nexport const aRoutes: FastifyPluginAsync = async (server) => {\n  server.get('/x', async () => 'ok')\n}\n`,
  )
  write(
    'apps/api/src/routes/b.ts',
    `import type { FastifyPluginAsync } from 'fastify'\nexport const bRoutes: FastifyPluginAsync = async (server) => {\n  server.get('/x', async () => 'ok')\n}\n`,
  )
  copyScriptWithClosure(SCRIPTS, CLI_REL, join(dir, 'scripts'))
  if (commitFirst) {
    runGit(dir, ['add', '-A'])
    runGit(dir, ['commit', '-q', '-m', 'seed'])
  }
  return { dir, write }
}

function runCli(dir, args) {
  let out = ''
  let code = 0
  try {
    out = execFileSync(process.execPath, [join(dir, 'scripts', CLI_REL), ...args], {
      cwd: dir,
      ...RUN_OPTS,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (e) {
    code = typeof e?.status === 'number' ? e.status : -1
    out = String(e?.stdout ?? '') + String(e?.stderr ?? '')
  }
  return { code, out }
}

test('T12 用法错:未知旗标 / 两面旗同给 ⇒ exit 2', () => {
  const a = runCli(REPO, ['--nope'])
  assert.equal(a.code, 2, a.out)
  assert.match(a.out, /未认识/, '未知旗标必须点名为用法错')
  const b = runCli(REPO, ['--staged', '--worktree'])
  assert.equal(b.code, 2, b.out)
})

test('T13 端到端:干净仓(两枚提交)⇒ exit 0 且判过', (t) => {
  const { dir, write } = makeRepo(t, { commitFirst: false })
  write(
    'apps/api/src/server.ts',
    `import { aRoutes } from './routes/a.js'\nimport { bRoutes } from './routes/b.js'\nexport async function buildServer(server) {\n${DIFF_PREFIX}\n}\n`,
  )
  runGit(dir, ['add', '-A'])
  runGit(dir, ['commit', '-q', '-m', 'v1'])
  write('README.md', 'v2\n')
  runGit(dir, ['add', '-A'])
  runGit(dir, ['commit', '-q', '-m', 'v2'])
  const r = runCli(dir, [])
  assert.equal(r.code, 0, r.out)
  assert.match(r.out, /\[OK\] 判过/)
  assert.match(r.out, /可判定 \d+/, '必须报出可判定站点数,不能只喊绿')
})

test('T14 端到端:暂存一枚重复 ⇒ exit 1 且两处位置都点名', (t) => {
  const { dir, write } = makeRepo(t, { commitFirst: false })
  write(
    'apps/api/src/server.ts',
    `import { aRoutes } from './routes/a.js'\nimport { bRoutes } from './routes/b.js'\nexport async function buildServer(server) {\n${DIFF_PREFIX}\n}\n`,
  )
  runGit(dir, ['add', '-A'])
  runGit(dir, ['commit', '-q', '-m', 'v1'])
  // 第二枚提交把 b 挂到 a 的前缀上 ⇒ 暂存面出现 GET /api/a/x 两处注册
  write(
    'apps/api/src/server.ts',
    `import { aRoutes } from './routes/a.js'\nimport { bRoutes } from './routes/b.js'\nexport async function buildServer(server) {\n${SAME_PREFIX}\n}\n`,
  )
  runGit(dir, ['add', '-A'])
  const r = runCli(dir, ['--staged'])
  assert.equal(r.code, 1, r.out)
  assert.match(r.out, /GET \/api\/a\/x/)
  assert.match(r.out, /routes\/a\.ts:\d+/)
  assert.match(r.out, /routes\/b\.ts:\d+/)
})

test('T15 端到端:重复已在 HEAD(存量)⇒ exit 0 只报数(棘轮锚点 = 基线自身)', (t) => {
  const { dir, write } = makeRepo(t, { commitFirst: false })
  // 第一枚提交就带着重复(存量),第二枚只改无关文件
  write(
    'apps/api/src/server.ts',
    `import { aRoutes } from './routes/a.js'\nimport { bRoutes } from './routes/b.js'\nexport async function buildServer(server) {\n${SAME_PREFIX}\n}\n`,
  )
  write(
    'apps/api/src/routes/a.ts',
    `import type { FastifyPluginAsync } from 'fastify'\nexport const aRoutes: FastifyPluginAsync = async (server) => {\n  server.get('/y', async () => 'ok')\n}\n`,
  )
  write(
    'apps/api/src/routes/b.ts',
    `import type { FastifyPluginAsync } from 'fastify'\nexport const bRoutes: FastifyPluginAsync = async (server) => {\n  server.get('/y', async () => 'ok')\n}\n`,
  )
  runGit(dir, ['add', '-A'])
  runGit(dir, ['commit', '-q', '-m', 'v1'])
  write('apps/api/src/notes.ts', 'export const NOTE = 1\n')
  write(
    'apps/api/src/server.ts',
    `import { aRoutes } from './routes/a.js'\nimport { bRoutes } from './routes/b.js'\nexport async function buildServer(server) {\n  server.register(aRoutes, { prefix: '/api/a' })\n  server.register(bRoutes, { prefix: '/api/a' })\n}\n`,
  )
  runGit(dir, ['add', '-A'])
  const r = runCli(dir, ['--staged'])
  assert.equal(r.code, 0, `${r.out}\n存量重复不得判红(§12e 恒红门禁令)`)
  assert.match(r.out, /GET \/api\/a\/y/, '存量必须逐条点名(只报数不等于不报)')
})

test('T16 端到端:射程为空 ⇒ exit 2 未判定,绝不记绿', (t) => {
  const dir = mkScratch('route-uniq-empty-')
  t.after(() => rmScratch(dir))
  runGit(dir, ['init', '-q'])
  mkdirSync(join(dir, 'scripts'), { recursive: true })
  writeFileSync(join(dir, 'README.md'), 'x\n')
  copyScriptWithClosure(SCRIPTS, CLI_REL, join(dir, 'scripts'))
  runGit(dir, ['add', '-A'])
  runGit(dir, ['commit', '-q', '-m', 'seed'])
  const r = runCli(dir, ['--staged'])
  assert.equal(r.code, 2, r.out)
  assert.match(r.out, /UNDETERMINED|未判定/)
})

test('T17 端到端:--worktree 磁盘面能判(人工档)', (t) => {
  const { dir, write } = makeRepo(t, { commitFirst: false })
  write(
    'apps/api/src/server.ts',
    `import { aRoutes } from './routes/a.js'\nimport { bRoutes } from './routes/b.js'\nexport async function buildServer(server) {\n${DIFF_PREFIX}\n}\n`,
  )
  write(
    'apps/api/src/routes/a.ts',
    `import type { FastifyPluginAsync } from 'fastify'\nexport const aRoutes: FastifyPluginAsync = async (server) => {\n  server.get('/z', async () => 'ok')\n}\n`,
  )
  write(
    'apps/api/src/routes/b.ts',
    `import type { FastifyPluginAsync } from 'fastify'\nexport const bRoutes: FastifyPluginAsync = async (server) => {\n  server.get('/z', async () => 'ok')\n}\n`,
  )
  runGit(dir, ['add', '-A'])
  runGit(dir, ['commit', '-q', '-m', 'v1'])
  // 只改磁盘、不暂存 ⇒ 只有 --worktree 档看得见这枚重复
  write(
    'apps/api/src/server.ts',
    `import { aRoutes } from './routes/a.js'\nimport { bRoutes } from './routes/b.js'\nexport async function buildServer(server) {\n  server.register(aRoutes, { prefix: '/api/a' })\n  server.register(bRoutes, { prefix: '/api/a' })\n}\n`,
  )
  const r = runCli(dir, ['--worktree'])
  assert.equal(r.code, 1, r.out)
  assert.match(r.out, /GET \/api\/a\/z/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
