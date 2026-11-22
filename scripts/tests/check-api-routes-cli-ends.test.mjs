// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试:守门 8(check-api-routes)的 `apps/cli` + `packages/app` 两端纳入(2026-09-28)
// 判据本体在 scripts/check-api-routes.mjs;本文件按 §22c 只锁"装上了 / 有牙 / 不静默",
// 不重写判据实现(重写就是第二份真相,会跟着源一起漂绿)。
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
  const dir = mkScratch('ihui-api-routes-cli-')
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

// ─── T1 扩面有牙:apps/cli 里后端未注册的路由必须被判红并点名 ───
test('apps/cli 纳入:前缀拼接形态的死调用被扫出并点名文件(此前该端零判据)', () => {
  const dir = root()
  try {
    emptyBackend(dir)
    put(
      dir,
      'apps/cli/src/commands/probe.ts',
      [
        "const API_PREFIX = '/api/clione';",
        'const apiRequest = createApiRequest(API_PREFIX, 1000);',
        "const r = await apiRequest(baseUrl, '/ghost', { method: 'POST' });",
        '',
      ].join('\n'),
    )
    const r = run(dir)
    assert.equal(r.status, 1, `cli 死调用应判红\n${r.out}`)
    assert.match(r.out, /POST \/api\/clione\/ghost/)
    assert.match(r.out, /apps\/cli\/src\/commands\/probe\.ts/)
    assert.match(r.out, /· cli:文件 1 \/ 调用 1/)
  } finally {
    rmScratch(dir)
  }
})

// ─── T2 正例对照:拼接结果与后端注册同值 ⇒ 不得判红(证明提取式不是噪声发生器) ───
test('apps/cli 前缀拼接的正例:已注册路径不得判红(证明拼的是真路径)', () => {
  const dir = root()
  try {
    put(dir, 'scripts/api-routes-baseline.json', BASELINE)
    put(dir, 'apps/api/src/routes/cli.ts', "server.post('/api/clione/list', async () => ({}))\n")
    put(
      dir,
      'apps/cli/src/commands/probe.ts',
      [
        "const API_PREFIX = '/api/clione';",
        'const apiRequest = createApiRequest(API_PREFIX, 1000);',
        "const r = await apiRequest(baseUrl, '/list', { method: 'POST' });",
        '',
      ].join('\n'),
    )
    const r = run(dir)
    assert.equal(r.status, 0, `拼出的路径与注册同值即不得判红\n${r.out}`)
    assert.match(r.out, /通过/)
  } finally {
    rmScratch(dir)
  }
})

// ─── T3 `${base}/api/x` 模板前缀插值:旧 pathRe 要求引号紧邻,这一族整型隐身 ───
test('apps/cli 模板前缀插值形态必须被抽出(实测该型 21 处此前零判据)', () => {
  const dir = root()
  try {
    emptyBackend(dir)
    put(
      dir,
      'apps/cli/src/lib/tpl.ts',
      "const res = await fetch(`${cfg.apiUrl}/api/tplprobe/ghost`, { method: 'POST' })\n",
    )
    const r = run(dir)
    assert.equal(r.status, 1, `模板前缀插值的死调用应判红\n${r.out}`)
    assert.match(r.out, /POST \/api\/tplprobe\/ghost/)
  } finally {
    rmScratch(dir)
  }
})

// ─── T4 位置实参 method:后端只有 POST 时不得把调用报成 GET(方法错=假阳) ───
test('apps/cli 位置实参 method:POST 被认出来;写成 DELETE 时反向必须判红', () => {
  const ok = root()
  const bad = root()
  try {
    for (const [dir, verb] of [
      [ok, 'POST'],
      [bad, 'DELETE'],
    ]) {
      put(dir, 'scripts/api-routes-baseline.json', BASELINE)
      put(dir, 'apps/api/src/routes/pos.ts', "server.post('/api/posprobe/save', async () => ({}))\n")
      put(
        dir,
        'apps/cli/src/tools/pos.ts',
        `const r = await memorySend('${verb}', '/api/posprobe/save', body)\n`,
      )
      const r = run(dir)
      if (verb === 'POST') {
        assert.equal(r.status, 0, `位置实参 'POST' 必须被认成 POST 而非默认 GET\n${r.out}`)
      } else {
        assert.equal(r.status, 1, `写成 DELETE 而后端只有 POST ⇒ 必须判红\n${r.out}`)
        assert.match(r.out, /DELETE \/api\/posprobe\/save/)
      }
    }
  } finally {
    rmScratch(ok)
    rmScratch(bad)
  }
})

// ─── T5 packages/app 纳入:该端的死调用同样点名(零存量也要有判据) ───
test('packages/app 纳入:该端死调用被点名(纳入理由是"以后有人写路径"那天)', () => {
  const dir = root()
  try {
    emptyBackend(dir)
    put(
      dir,
      'packages/app/src/features/probe/ProbeScreen.tsx',
      "fetchApi('/api/appsharedprobe/ghost', { method: 'POST' })\n",
    )
    const r = run(dir)
    assert.equal(r.status, 1, `packages/app 的死调用应判红\n${r.out}`)
    assert.match(r.out, /POST \/api\/appsharedprobe\/ghost/)
    assert.match(r.out, /· app-shared:文件 1 \/ 调用 1/)
  } finally {
    rmScratch(dir)
  }
})

// ─── T6 变量路径 ⇒ 未判定:点名且不判红也不记通过(判不出≠没有) ───
test('apps/cli 变量路径调用点 ⇒ 未判定 + 点名,不改退出码', () => {
  const dir = root()
  try {
    emptyBackend(dir)
    put(
      dir,
      'apps/cli/src/commands/vp.ts',
      [
        "const API_PREFIX = '/api/vp';",
        'const apiRequest = createApiRequest(API_PREFIX, 1000);',
        'const qs = buildQs()',
        'const r = await apiRequest(baseUrl, qs, { apiKey })',
        '',
      ].join('\n'),
    )
    const r = run(dir)
    assert.equal(r.status, 0, `变量路径不得判红\n${r.out}`)
    assert.match(r.out, /未判定\(CLI 变量路径调用点\)1 处/)
    assert.match(r.out, /apps\/cli\/src\/commands\/vp\.ts:4/)
  } finally {
    rmScratch(dir)
  }
})

// ─── T7 后端注册面扩到 app/api:挂在别名 include_router 上的路由必须算"已注册" ───
test('ai-service app/api 目录纳入注册面:别名 include_router 的路由不再被当死调用', () => {
  const dir = root()
  try {
    put(dir, 'scripts/api-routes-baseline.json', BASELINE)
    put(dir, 'apps/api/src/routes/none.ts', "server.get('/api/nothing-at-all', async () => ({}))\n")
    put(
      dir,
      'apps/ai-service/app/main.py',
      [
        'from app.api.memapi import router as memapi_router',
        'app.include_router(memapi_router, prefix="/api", tags=["m"])',
        '',
      ].join('\n'),
    )
    put(
      dir,
      'apps/ai-service/app/api/memapi.py',
      'router = APIRouter()\n@router.post("/probe/save")\nasync def save():\n    return {}\n',
    )
    put(
      dir,
      'apps/cli/src/tools/probe.ts',
      "const r = await memorySend('POST', '/api/probe/save', body)\n",
    )
    const r = run(dir)
    assert.equal(r.status, 0, `app/api 注册的路由必须参与比对\n${r.out}\n${r.stderr}`)
  } finally {
    rmScratch(dir)
  }
})

// ─── T8 反向锁(装车证明):两端必须真在端表里,摘线即红 ───
test('两端必须留在 FRONTEND_ENDS 表内且走棘轮(摘线不得被读成"已收口")', () => {
  assert.match(SRC, /name:\s*'cli',\s*\n\s*dir:\s*'apps\/cli',\s*\n\s*ratchet:\s*true/, 'cli 端注册形态')
  assert.match(
    SRC,
    /name:\s*'app-shared',\s*\n\s*dir:\s*'packages\/app',\s*\n\s*ratchet:\s*true/,
    'packages/app 端注册形态',
  )
})

// ─── T9 反向锁:新判据必须真挂在扫描循环上(函数在而无人调 = 一路绿灯) ───
test('CLI 形态判据必须被扫描循环调用(不得只定义不接线)', () => {
  const calls = (re) => (SRC.match(re) || []).length
  assert.ok(
    calls(/resolveCliRequestFactory\(/g) >= 2,
    'resolveCliRequestFactory 必须既有定义又有调用点(接线)',
  )
  assert.ok(
    calls(/extractCliShapeCalls\(/g) >= 2,
    'extractCliShapeCalls 必须既有定义又有调用点(接线)',
  )
  assert.ok(calls(/inferMethodAtLine\(/g) >= 2, 'method 推断唯一出口必须被两处共用(通用面 + CLI 面)')
  assert.ok(
    calls(/normalizeCallPath\(/g) >= 2,
    '路径归一化唯一出口必须被两处共用(通用面 + CLI 面)',
  )
})

// ─── T10 反向锁:同一把尺子不得有第二份实现 ───
test('查询串谓词与遮罩判据各只允许一份实现', () => {
  assert.equal(
    (SRC.match(/function looksLikeQueryStringBuilder\(/g) || []).length,
    1,
    'looksLikeQueryStringBuilder 只许定义一次',
  )
  assert.equal(
    (SRC.match(/isQueryStringBuilder\s*=/g) || []).length,
    0,
    '旧的内联谓词形态不得回来(那等于第二份判据)',
  )
})

// ─── T11 枚举到 0 个受管文件的端必须喊"未判定",不得静默 ───
test('面里枚举到 0 文件的端 ⇒ 必须点名未判定(空扫不是通过)', () => {
  const dir = root()
  try {
    emptyBackend(dir)
    put(dir, 'apps/cli/src/only.ts', "fetchApi('/api/only/probe', { method: 'POST' })\n")
    const r = run(dir)
    assert.match(
      r.out,
      /未判定:.*枚举到 0 个受管源文件/,
      `web 等端在本夹具里 0 文件,必须喊出来\n${r.out}`,
    )
  } finally {
    rmScratch(dir)
  }
})

// ─── N12 一跳解析·能解析的构造面必命中(2026-09-27 判据扩面票,成对正例) ───
// 单值 const 模板 + 第三实参 method ⇒ 拼真前缀、认 POST、点名到调用行;不得再落未判定。
test('一跳解析正例:单值 const 模板解析后必须带真 method 进对账并点名', () => {
  const dir = root()
  try {
    emptyBackend(dir)
    put(
      dir,
      'apps/cli/src/commands/n12.ts',
      [
        "const API_PREFIX = '/api/n12probe';",
        'const apiRequest = createApiRequest(API_PREFIX, 1000);',
        'async function go(baseUrl, x) {',
        '  const path = `/thing/${encodeURIComponent(x)}`;',
        "  const resp = await apiRequest(baseUrl, path, { method: 'POST' });",
        '  return resp',
        '}',
        '',
      ].join('\n'),
    )
    const r = run(dir)
    assert.equal(r.status, 1, `单值 const 解析出的死调用必须判红\n${r.out}`)
    assert.match(r.out, /POST \/api\/n12probe\/thing\/:param/)
    assert.match(r.out, /n12\.ts:5/)
    assert.match(r.out, /· cli:文件 1 \/ 调用 1/)
    assert.match(r.out, /未判定\(CLI 变量路径调用点\)0 处 —— 变量站点/)
    assert.doesNotMatch(r.out, /<变量路径>/, '解出来了就不许再点名未判定条目')
  } finally {
    rmScratch(dir)
  }
})

// ─── N13 一跳解析·解析不到的仍落未判定(成对反例;红线:不许为降数造路径) ───
test('一跳解析反例:初始化式是函数调用 ⇒ 仍计未判定并点名原因,不改退出码', () => {
  const dir = root()
  try {
    emptyBackend(dir)
    put(
      dir,
      'apps/cli/src/commands/n13.ts',
      [
        "const API_PREFIX = '/api/n13probe';",
        'const apiRequest = createApiRequest(API_PREFIX, 1000);',
        'const qs = makeQs(a, b)',
        'const r = await apiRequest(baseUrl, qs, { apiKey })',
        '',
      ].join('\n'),
    )
    const r = run(dir)
    assert.equal(r.status, 0, `解析不出不得判红\n${r.out}`)
    assert.match(r.out, /未判定\(CLI 变量路径调用点\)1 处/)
    assert.match(r.out, /n13\.ts:4 —— 初始化式不是字面量/)
  } finally {
    rmScratch(dir)
  }
})

// ─── N14 三元两分支逐条对账:注册的一支不得被牵连判红,没注册的一支必须点名 ───
test('三元两分支各判各的:已注册分支放过、未注册分支点名(不是挑一条代表)', () => {
  const dir = root()
  try {
    put(dir, 'scripts/api-routes-baseline.json', BASELINE)
    put(dir, 'apps/api/src/routes/n14.ts', "server.get('/api/n14probe/list', async () => ({}))\n")
    put(
      dir,
      'apps/cli/src/commands/n14.ts',
      [
        "const API_PREFIX = '/api/n14probe';",
        'const apiRequest = createApiRequest(API_PREFIX, 1000);',
        'async function go(baseUrl, session, apiKey) {',
        '  const path = session',
        '    ? `/session/${encodeURIComponent(session)}`',
        '    : `/list?pageSize=${N}`;',
        '  const resp = await apiRequest(baseUrl, path, { apiKey });',
        '  return resp',
        '}',
        '',
      ].join('\n'),
    )
    const r = run(dir)
    assert.equal(r.status, 1, `未注册的那条分支必须判红\n${r.out}`)
    assert.match(r.out, /GET \/api\/n14probe\/session\/:param/)
    assert.doesNotMatch(r.out, /n14probe\/list @/, '已注册分支不得被连片判红')
    assert.match(r.out, /未判定\(CLI 变量路径调用点\)0 处 —— 变量站点/, '两分支都解析掉了,只剩 0 处')
    assert.doesNotMatch(r.out, /<变量路径>/, '解出来了就不许再点名未判定条目')
  } finally {
    rmScratch(dir)
  }
})

// ─── N15 import 一跳端到端:目标文件在面上 ⇒ 常量路径进对账并点到调用行 ───
test('import 一跳:同仓相对路径的导出常量必须被拼到调用点名下', () => {
  const dir = root()
  try {
    emptyBackend(dir)
    put(dir, 'apps/cli/src/lib/n15paths.ts', "export const HOP_PATH = '/api/n15probe/hop';\n")
    put(
      dir,
      'apps/cli/src/commands/n15.ts',
      [
        "import { HOP_PATH } from '../lib/n15paths.js';",
        "const API_PREFIX = '/api/n15probe';",
        'const apiRequest = createApiRequest(API_PREFIX, 1000);',
        'const resp = await apiRequest(baseUrl, HOP_PATH, { apiKey });',
        '',
      ].join('\n'),
    )
    const r = run(dir)
    assert.equal(r.status, 1, `import 一跳解析出的死调用必须判红\n${r.out}`)
    assert.match(r.out, /GET \/api\/n15probe\/hop @ apps\/cli\/src\/commands\/n15\.ts:4/)
    assert.match(r.out, /未判定\(CLI 变量路径调用点\)0 处 —— 变量站点/)
    assert.doesNotMatch(r.out, /<变量路径>/, '解出来了就不许再点名未判定条目')
  } finally {
    rmScratch(dir)
  }
})

// ─── N16 跨包 import 刻意不在一跳射程 ⇒ 未判定 + 点名,而不是跟着解析器猜 ───
test('跨包/别名 import 说明符不参与一跳解析,站点必须仍落未判定并点名', () => {
  const dir = root()
  try {
    emptyBackend(dir)
    put(
      dir,
      'apps/cli/src/commands/n16.ts',
      [
        "import { EXT_PATH } from '@ihui/shared/x';",
        "const API_PREFIX = '/api/n16probe';",
        'const apiRequest = createApiRequest(API_PREFIX, 1000);',
        'const r = await apiRequest(baseUrl, EXT_PATH, { apiKey })',
        '',
      ].join('\n'),
    )
    const r = run(dir)
    assert.equal(r.status, 0, `不判红(判不出不是违规)\n${r.out}`)
    assert.match(r.out, /未判定\(CLI 变量路径调用点\)1 处/)
    assert.match(r.out, /n16\.ts:4 —— import 说明符非相对路径/)
  } finally {
    rmScratch(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
