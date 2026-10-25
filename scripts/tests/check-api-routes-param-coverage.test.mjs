// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 镜像测试:守门 8(check-api-routes)「参数段假命中」盲区(2026-10-23 立)。
 *
 * 病根(复现证据):旧 `matchSegs` 对 `:param` 段两侧都 `continue`,「段数相等」成了唯一约束 ⇒
 * 一条参数路由会吞掉任意同段数的**具体字面路径**。实证(HEAD 面全量档):
 *   · 主腿 60 处:如 `GET /api/asks/mine` ↔ `GET /api/asks/:id`、
 *     `GET /api/auth/google/callback` ↔ `GET /api/auth/:provider/callback`;
 *   · BP 腿 4 处:如 `GET /api/refund/:param` ↔ `GET /api/refunds/:id` 一族。
 * 旧口径把它们全记成「已在册」,于是"后端从未注册的具体静态路径"在账面是绿的 —— 真死调用结构上不可见。
 *
 * 本票只改**分档**,不新增判红路径(§12e:改判会让存量一次性从"在册"落到"未判定",
 * 当场判红就是与任何提交都无关的恒红门):
 *   · `literal` / `wild` ⇒ 仍按在册(正例);
 *   · `param`          ⇒ 落「未判定(参数段覆盖)」,逐条点名 + 计入结论行,**不记在册也不判红**。
 *
 * 覆盖面(每条都盯住一种"修过头/修漏/静默失效"的方向):
 *   T1 判据本体(直接 import 源脚本 `__test__`,§22c 不复制判据)
 *   T2 反例:具体路径只被 `:param` 接住 ⇒ 不记在册、不判红、逐条点名
 *   T3 正例:字面静态注册优先 ⇒ 同一条调用仍判在册(未判定桶 0)
 *   T4 防过度收紧:前端动态段 ↔ 后端参数段是同一路由形状,不得误判
 *   T5 存量只报数:结论行必须带读数,且退出码不得因此翻红
 *   T6 源码锁:param 分流不得被并回 `found`;`matchSegs` 必须委托共享判据
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as LIB } from '../lib/route-registration-extract.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPT = join(HERE, '..', 'check-api-routes.mjs')
const SRC = readFileSync(SCRIPT, 'utf8')
const BASELINE = JSON.stringify({ version: 1, perFileCount: {} })

function root() {
  const dir = mkScratch('ihui-api-routes-param-')
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
/** 契约夹具:后端 /asks 面由 asksBody 决定,前端调用由 webCall 决定 */
function fixture(asksBody, webCall) {
  const dir = root()
  put(dir, 'scripts/api-routes-baseline.json', BASELINE)
  put(
    dir,
    'apps/api/src/server.ts',
    "import { asksRoutes } from './routes/asks'\nserver.register(asksRoutes, { prefix: '/api' })\n",
  )
  put(dir, 'apps/api/src/routes/asks.ts', `export async function asksRoutes(server) {\n${asksBody}}\n`)
  put(dir, 'apps/web/src/call.ts', webCall)
  return dir
}

// ─── T1 判据本体:直接打共享 lib 的 __test__(不复制判据)───

test('T1 覆盖分类:具体字面段被 :param 吞 ⇒ param;字面相等/同族动态段 ⇒ literal;段数不等 ⇒ null', () => {
  const f = LIB.classifyRouteCoverage
  assert.equal(typeof f, 'function', '共享判据必须由 __test__ 暴露(§22c)')
  assert.equal(f(['', 'api', 'asks', 'my'], ['', 'api', 'asks', ':id']), 'param')
  assert.equal(f(['', 'api', 'asks', 'my', 'answers'], ['', 'api', 'asks', ':id', 'answers']), 'param')
  assert.equal(f(['', 'api', 'asks', 'my'], ['', 'api', 'asks', 'my']), 'literal')
  assert.equal(f(['', 'api', 'asks', ':param'], ['', 'api', 'asks', ':id']), 'literal')
  assert.equal(f(['', 'api', 'asks', 'my'], ['', 'api', 'asks', ':id', 'answers']), null)
  assert.equal(f(['', 'api', 'asks', 'my'], ['', 'api', 'circles', ':id']), null)
})

// ─── T2 反例:参数段假命中不再记「已在册」───

test('T2 反例:具体路径只被 :param 接住 ⇒ 落未判定桶 + 逐条点名,且不进死调用清单', () => {
  const dir = fixture("  server.get('/asks/:id', async () => ({}))\n", "fetch('/api/asks/my')\n")
  try {
    const dump = join(dir, 'undetermined.json')
    const missingFile = join(dir, 'missing.json')
    const r = run(dir, ['--dump-undetermined', dump, '--dump-missing', missingFile])
    const u = JSON.parse(readFileSync(dump, 'utf8'))
    const missing = JSON.parse(readFileSync(missingFile, 'utf8'))
    assert.equal(r.status, 0, `存量不得判红(§12e)\n${r.out}`)
    assert.match(r.out, /未判定\(参数段覆盖\)1 处/, `必须把这一档单独点名\n${r.out}`)
    assert.match(r.out, /\/api\/asks\/my/, '必须逐条报名,不许只给数字')
    assert.deepEqual(
      (u.paramSegmentCovered || []).map((c) => `${c.method} ${c.path}`),
      ['GET /api/asks/my'],
      `--dump-undetermined 必须带出该站点\n${JSON.stringify(u, null, 1)}`,
    )
    assert.deepEqual(missing, [], '参数覆盖不是死调用 —— 不得同时落进死调用桶(两桶互斥)')
  } finally {
    rmScratch(dir)
  }
})

// ─── T3 正例:字面静态注册优先 ───

test('T3 正例:后端真有字面静态注册 ⇒ 同一条调用仍判在册,未判定桶 0', () => {
  const dir = fixture(
    "  server.get('/asks/:id', async () => ({}))\n  server.get('/asks/my', async () => ({}))\n",
    "fetch('/api/asks/my')\n",
  )
  try {
    const r = run(dir)
    assert.equal(r.status, 0, r.out)
    assert.match(r.out, /未判定\(参数段覆盖\)0 处/, `字面注册必须优先,不得被打进未判定桶\n${r.out}`)
    assert.match(r.out, /✅ 通过/, r.out)
  } finally {
    rmScratch(dir)
  }
})

// ─── T4 防过度收紧:前端动态段是同一路由形状 ───

test('T4 防过度收紧:前端动态段 ↔ 后端参数段不误判(未判定桶 0 且 exit 0)', () => {
  const dir = fixture(
    "  server.get('/asks/:id/answers', async () => ({}))\n",
    'fetch(`/api/asks/${encodeURIComponent(id)}/answers`)\n',
  )
  try {
    const r = run(dir)
    assert.equal(r.status, 0, r.out)
    assert.match(r.out, /未判定\(参数段覆盖\)0 处/, `同族动态段不得被误判为参数假命中\n${r.out}`)
  } finally {
    rmScratch(dir)
  }
})

// ─── T5 存量只报数:读数必须进结论行,退出码不因存量翻红 ───

test('T5 存量只报数:结论行带"参数段覆盖 N 处未判定、不记在册",不改变退出码', () => {
  const dir = fixture("  server.get('/asks/:id', async () => ({}))\n", "fetch('/api/asks/my')\n")
  try {
    const r = run(dir)
    assert.equal(r.status, 0, r.out)
    assert.match(
      r.out,
      /参数段覆盖 1\+0 处未判定、不记在册/,
      `结论行必须带读数 —— 否则"通过"被读成"没有这一档"\n${r.out}`,
    )
    // 未判定块必须早于结论行(顺序反了等于被结论盖住)
    const iBlock = r.out.indexOf('未判定(参数段覆盖)')
    const iPass = r.out.indexOf('✅ 通过')
    assert.ok(iBlock >= 0 && iPass > iBlock, `未判定块(${iBlock})必须早于结论行(${iPass})`)
  } finally {
    rmScratch(dir)
  }
})

// ─── T6 源码锁:分流不得被并回 found / 判据不得被抄第二份 ───

test('T6 源码锁:param 必须先于 found 分流;matchSegs 必须委托共享判据', () => {
  assert.match(
    SRC,
    /coverage === 'param'[\s\S]{0,120}paramCovered\.push\(call\)[\s\S]{0,40}continue/,
    '主腿必须把 param 档单独分流进未判定桶(并回 found 即复活假绿)',
  )
  assert.match(
    SRC,
    /bareParam\.push\(c\)/,
    'BP 腿同一分档不得被删(裸路径同样会被 :param 吞)',
  )
  assert.match(
    SRC,
    /function matchSegs\(fParts, bParts\) \{\n  return classifyRouteCoverage\(fParts, bParts\) !== null/,
    'matchSegs 必须委托共享判据(第二份实现必然漂移,§0.6)',
  )
  assert.match(
    SRC,
    /classifyRouteCoverage/,
    '共享判据必须被门 import 使用,否则装上没装车',
  )
  assert.match(
    SRC,
    /参数段覆盖 \$\{paramCovered\.length\}\+\$\{bareParam\.length\} 处未判定、不记在册/,
    '结论行读数不得被删(判据失效的表现永远是安静)',
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
