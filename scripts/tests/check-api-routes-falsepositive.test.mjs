// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE).
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 镜像测试:守门 8(check-api-routes)取材侧 5 个误报机制的修复(2026-10-04)
 *
 * 背景:门报"死调用 0 处"是**假绿**。用一份 A/B 副本模拟剔除纯通配注册条目
 * (`scripts/_ab-probe-apiroutes.mjs` / `_ab-probe-after.mjs`,同在 scripts/ 下)后暴露:
 * 改前 26 条、改后 24 条。逐条回源码核过,**没有一条是"纯通配收口"造成的** ——
 * 收口只是把它们从通配条目背后暴露出来。本票只修取材侧 5 个机制。
 *
 * 五个机制各自的病根与修法(判据依据写在 scripts/check-api-routes.mjs 的对应注释里):
 *   ① P1 `looksLikeQueryStringBuilder` 的 `params` 词条过宽 —— `params.id` 是 Next.js
 *      **路径段**,却被当查询串构造器整段丢弃 ⇒ 段数少 1 ⇒ 落进通配射程(4 条误报)。
 *      修法:`params` 词条加否定前瞻(后不接 `.` / `?.` / `[`)。实测影响面:受影响位置
 *      24 条全是 `${params.id}`,而"独立 `params`"形态在受影响面上**0 条**。
 *   ② P4 FastAPI `@router.xxx("")` 空路径抽不出 —— 路径组要求 ≥1 字符,全仓 7 处抽不出,
 *      端点在册却报"不在册"。修法:改 `([^'"`]+)?`,空值交给已有的 `normalizePath`。
 *   ③ P3 `isPathConstDecl` 被 `cliShapes &&` 限死在 cli 端 —— "片段不是调用点"与端无关。
 *      修法:去掉 `cliShapes &&`,判据本体一字未改。
 *   ④ P2 嵌套 `sub.register(..., { prefix })` 的 prefix 未参与拼接 —— 修法:新增
 *      `expandNestedRegisterRoutes`(括号配对 + 尾参 prefix,只展开一层,产出**额外**条目)。
 *   ⑤ P5 `.includes('/api/...')` 子串匹配不是调用点 —— 修法:遮罩行上是字符串谓词实参
 *      **且同行无任何传输口**则不进调用集。
 *
 * 每组都钉两件事:**该剔的剔掉了**(装上了牙)、**不该剔的仍在调用集里**(防过度收紧)。
 * 防过度收紧是本组重点:5 个机制里有 4 个的失败形态都是"把真调用一起剔掉"。
 *
 * 不重写判据实现(重写就是第二份真相,会跟着源一起漂绿);只锁"装上了 / 有牙 / 不过度"。
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
  const dir = mkScratch('ihui-api-routes-fp-')
  mkdirSync(join(dir, 'apps', 'api', 'src', 'routes'), { recursive: true })
  mkdirSync(join(dir, 'apps', 'ai-service', 'app', 'routers'), { recursive: true })
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
/** 某一端的调用点数 */
function calls(out, end) {
  const m =
    out.match(new RegExp(`· ${end}:文件 (\\d+) / 调用 (\\d+) /`)) ||
    out.match(new RegExp(`· ${end}:文件 (\\d+) / 调用点 (\\d+) /`))
  if (!m) throw new Error(`输出里没有 ${end} 的报数行\n${out}`)
  return Number(m[2])
}
/** 某一端的死调用数(读不到行 = 0,零容忍端死调用 0 时不打印那一行) */
function deadCalls(out, end) {
  const m = out.match(new RegExp(`· ${end}:死调用 (\\d+) 处`))
  return m ? Number(m[1]) : 0
}
/** 某一端「未判定(有传输口却抽不出路径)」计数 */
function shapeUnknown(out, end) {
  const m = out.match(
    new RegExp(`· ${end}:文件 \\d+ / 调用(?:点)? \\d+ / [^\\n]*?未判定\\(有传输口却抽不出路径\\)(\\d+)`),
  )
  if (!m) throw new Error(`输出里没有 ${end} 的未判定计数\n${out}`)
  return Number(m[1])
}

// ─────────────────────────────────────────────────────────────────────────
// 机制 ①`params` 词条过宽(Next.js 路由参数被当查询串丢弃)
// ─────────────────────────────────────────────────────────────────────────
//
// ⚠️ 判据选型的坑(实测,别再踩):**"调用点数"这个读数钉不住机制①**。
// 修前修后调用点数**都是 1** —— 差别在**归一后的路径**:修前落 4 段
// `/api/favorites/check/aiworld`(段被丢弃),修后落 6 段 `.../aiworld/:param`。
// 只断言调用点数的话,退回 ① 这个用例照样绿(实测过)。所以本组一律读
// **`--dump-missing` 的逐条清单**:那里面有没有那条被丢段的假路径,才是判据。
//
// 夹具:后端注册 `/api/favorites/check/:resourceType/:resourceId`(6 段),
// 前端调 `` `/api/favorites/check/aiworld/${params.id}` ``。
// 修前:params.id 被整段丢弃 ⇒ 落成 4 段 ⇒ 段数不等 ⇒ 判死调用
//      (改前这是 .check-api-routes-ignore.json 里的一条豁免)。
// 修后:归一成 6 段 ⇒ 与后端 :param 段对上 ⇒ 不在死调用清单里。
test('① params.id 是路径段:落 :param 与后端 :param 段对上,不再整段丢弃', () => {
  const dir = root()
  try {
    put(dir, 'scripts/api-routes-baseline.json', BASELINE)
    put(
      dir,
      'apps/api/src/routes/social.ts',
      "server.get('/api/favorites/check/:resourceType/:resourceId', async () => ({}))\n",
    )
    put(
      dir,
      'apps/web/src/ai-world/PageClient.tsx',
      [
        'export function useFav(params: { id: string }) {',
        '  return api(`/api/favorites/check/aiworld/${params.id}`)',
        '}',
        '',
      ].join('\n'),
    )
    const r = run(dir, ['--warn-only', '--dump-missing', join(dir, 'missing.json')])
    const missing = JSON.parse(readFileSync(join(dir, 'missing.json'), 'utf8'))
    assert.equal(calls(r.out, 'web'), 1, `该调用点必须仍在调用集里\n${r.out}`)
    assert.deepEqual(
      missing,
      [],
      `params.id 必须落 :param 与后端两段对上;判死清单非空 = 段被整段丢弃了\n${JSON.stringify(missing, null, 1)}`,
    )
    assert.equal(r.status, 0, `本用例不该判红\n${r.out}`)
  } finally {
    rmScratch(dir)
  }
})

// 防过度收紧:独立 `params` 形态必须**继续**被当查询串构造器。
// 这条是判据的另一半 —— 若把 `params` 词条整个删掉而不是加否定前瞻,`${params}`
// 就会变成 `:param` 路径段,查询串尾巴被误当路径,真调用对不上后端。
// 夹具用真实形态(`/api/hooks${qs}` 这一族由 `qs` 词条兜住;这里直接盯 `params` 自己):
// 后端注册 `/api/x/hooks/list`,前端调 `` `/api/x/list${params}` ``(params 是查询串对象)。
// 修后:params 是独立标识符(后不接 . / [)⇒ 仍判查询串 ⇒ 落成 `/api/x/list` ⇒ 对上 ⇒ 0 死调用。
test('① 防过度收紧:独立 `params`(非点访问)仍被当查询串,不误留 :param 段', () => {
  const dir = root()
  try {
    put(dir, 'scripts/api-routes-baseline.json', BASELINE)
    put(dir, 'apps/api/src/routes/hooks.ts', "server.get('/api/x/list', async () => ({}))\n")
    put(
      dir,
      'apps/web/src/hooks.ts',
      [
        'export function q(params: Record<string, string>) {',
        '  return api(`/api/x/list${params}`)',
        '}',
        '',
      ].join('\n'),
    )
    const r = run(dir, ['--warn-only', '--dump-missing', join(dir, 'missing.json')])
    const missing = JSON.parse(readFileSync(join(dir, 'missing.json'), 'utf8'))
    assert.equal(calls(r.out, 'web'), 1, `真调用必须仍在调用集里\n${r.out}`)
    assert.deepEqual(
      missing,
      [],
      `独立 params 必须继续当查询串构造器(落 /api/x/list);判成 :param 会变成 /api/x/list:param 对不上后端\n${JSON.stringify(missing, null, 1)}`,
    )
  } finally {
    rmScratch(dir)
  }
})

// 防过度收紧(同族第二条腿,实测有依据的那条):可选链形态 `params?.id` 也是**路径段**。
// 现状:真实面 24 条受影响位置里**没有** `params?.` 形态,但 Next.js 客户端组件里
// `use(params)` + 可选链是常见写法,判据漏了它就会在别的仓/别的分支上重新出现。
// 只判 `params.` 而漏了 `?.` 分支的实现会在这里现形。
test('① 防过度收紧:params?.id 可选链取值同样是路径段(不是查询串)', () => {
  const dir = root()
  try {
    put(dir, 'scripts/api-routes-baseline.json', BASELINE)
    put(
      dir,
      'apps/api/src/routes/opt.ts',
      "server.get('/api/z/items/:id', async () => ({}))\n",
    )
    put(
      dir,
      'apps/web/src/opt.ts',
      [
        'export function q(params: { id?: string }) {',
        '  return api(`/api/z/items/${params?.id}`)',
        '}',
        '',
      ].join('\n'),
    )
    const r = run(dir, ['--warn-only', '--dump-missing', join(dir, 'missing.json')])
    const missing = JSON.parse(readFileSync(join(dir, 'missing.json'), 'utf8'))
    assert.equal(calls(r.out, 'web'), 1, `可选链取值调用点必须仍在调用集\n${r.out}`)
    assert.deepEqual(
      missing,
      [],
      `params?.id 必须落 :param 与后端 :id 对上\n${JSON.stringify(missing, null, 1)}`,
    )
  } finally {
    rmScratch(dir)
  }
})

// ─────────────────────────────────────────────────────────────────────────
// 机制 ②FastAPI `@router.get("")` 空路径抽不出
// ─────────────────────────────────────────────────────────────────────────

// 复刻 apps/ai-service/app/routers/model_pricing_api.py 的真实形态:
// `router = APIRouter(prefix="/api/model-pricing")` + `@router.get("")`。
// 修前:`([^'"`]+)` 要求 ≥1 字符 ⇒ `@router.get("")` 整条抽不出 ⇒ 前端那条调用
// 明明在册却报"不在册"。修后:空路径交给 normalizePath(prefix, '') ⇒ 注册面有
// `GET /api/model-pricing` ⇒ 0 死调用。
//
// ⚠️ 夹具必须带一个 `apps/api/src/routes/*.ts` 锚路由(下面那行 `anchor.ts`):
// `extractBackendRoutes` 开头有一句 `if (files.length === 0) return { routes: [], prefixes }`
// —— FastAPI 段在**它后面**。FastAPI-only 的夹具会让整段不跑,注册面为空,
// 读数变成"空注册面 ⇒ 一切都是死调用",于是**修前修后读数一样**,用例钉不住任何东西
// (实测踩过:`@router.get("")` 的修与不修都是 1 处死调用,因为压根没进 FastAPI 段)。
test('② FastAPI @router.get("") 空路径:端点在册,不再报"不在册"', () => {
  const dir = root()
  try {
    put(dir, 'scripts/api-routes-baseline.json', BASELINE)
    // 锚:让 FastAPI 段真的被执行(见上)
    put(dir, 'apps/api/src/routes/anchor.ts', "server.get('/api/anchor', async () => ({}))\n")
    put(
      dir,
      'apps/ai-service/app/routers/model_pricing_api.py',
      [
        'from fastapi import APIRouter',
        "router = APIRouter(prefix='/api/model-pricing', tags=['pricing'])",
        '',
        '@router.get("")',
        'async def list_pricing():',
        '    return {"items": []}',
        '',
        '@router.get("/{model_id}")',
        'async def get_pricing(model_id: str):',
        '    return {}',
        '',
      ].join('\n'),
    )
    put(dir, 'apps/web/src/pricing.ts', "export const f = () => api('/api/model-pricing')\n")
    const r = run(dir, ['--warn-only', '--dump-missing', join(dir, 'missing.json')])
    const missing = JSON.parse(readFileSync(join(dir, 'missing.json'), 'utf8'))
    assert.equal(calls(r.out, 'web'), 1, `调用点必须仍在调用集\n${r.out}`)
    assert.deepEqual(
      missing,
      [],
      `@router.get("") 必须进注册面(修前此处为 1 处死调用)\n${JSON.stringify(missing, null, 1)}`,
    )
    assert.equal(r.status, 0, `在册端点不得判红\n${r.out}`)
  } finally {
    rmScratch(dir)
  }
})

// 防过度收紧:空路径那一档**不得**把非空路径也一起收窄。
// 同一个 router 里同时有 `@router.get("")` 与 `@router.get("/health")`,
// 前端调两条 —— 两条都必须进注册面、0 死调用。
// 若把路径组改成 `*`(贪婪)或可空后误配,`/health` 那条会丢。
//
// ⚠️ 刻意用 `/health` 而不是 `/{id}`:FastAPI 的路径参数是**花括号**(`/{item_id}`),
// 而 `matchSegs` 的 `:param` 分支只认**冒号**前缀(`bParts[i].startsWith(':')`),
// 且 pathRe 的字符类也不含 `{`/`}` ⇒ `/api/two/abc` 对不上 `/api/two/{item_id}` 是
// **既有局限**(FastAPI 花括号参数本门结构上看不见),不在本票 5 个机制射程内。
// 这里不写成 `/{id}` 是因为那会让本用例去钉一条本票没修的判据 ⇒ 变异验证会说谎。
test('② 防过度收紧:同 router 内非空路径 @router.get("/health") 不受影响', () => {
  const dir = root()
  try {
    put(dir, 'scripts/api-routes-baseline.json', BASELINE)
    // 锚:FastAPI 段在 `if (files.length === 0) return` 之后,必须有 ts 路由才会跑到(见上)
    put(dir, 'apps/api/src/routes/anchor.ts', "server.get('/api/anchor', async () => ({}))\n")
    put(
      dir,
      'apps/ai-service/app/routers/two.py',
      [
        'from fastapi import APIRouter',
        "router = APIRouter(prefix='/api/two')",
        '@router.get("")',
        'async def list_two():',
        '    return []',
        '@router.get("/health")',
        'async def two_health():',
        '    return {}',
        '',
      ].join('\n'),
    )
    put(
      dir,
      'apps/web/src/two.ts',
      [
        "export const a = () => api('/api/two')",
        "export const b = () => api('/api/two/health')",
        '',
      ].join('\n'),
    )
    const r = run(dir, ['--warn-only', '--dump-missing', join(dir, 'missing.json')])
    const missing = JSON.parse(readFileSync(join(dir, 'missing.json'), 'utf8'))
    assert.equal(calls(r.out, 'web'), 2, `两条调用点都该进调用集\n${r.out}`)
    assert.deepEqual(
      missing,
      [],
      `空路径与非空路径都要在册\n${JSON.stringify(missing, null, 1)}`,
    )
  } finally {
    rmScratch(dir)
  }
})

// ─────────────────────────────────────────────────────────────────────────
// 机制 ③`isPathConstDecl` 覆盖面从 cli 扩到全部端
// ─────────────────────────────────────────────────────────────────────────
//
// ⚠️ 判据选型(实测踩过):这一机制**不改变调用点数**,也不改变"路径"——
// 它改的是那一条调用点的 **method**:`GET`(猜的)→ `ANY`(认片段)。
// 所以第一版夹具(后端不注册 `/api/registry`)钉不住它:修前修后调用点数都是 1。
//
// 有区分度的夹具:后端**只注册 POST** `/api/registry`(3 段)。
// 修前:声明行被猜成 GET ⇒ 3 段 GET 桶里没有它 ⇒ 判死 1;
// 修后:判 ANY ⇒ 遍历该段数下所有 method 桶 + star ⇒ 命中 POST ⇒ 不判死。
test('③ 纯路径常量声明行在 web 端也认片段(不再猜成 GET 打到 method 不符的注册)', () => {
  const dir = root()
  try {
    put(dir, 'scripts/api-routes-baseline.json', BASELINE)
    // 只注册 **POST** /api/registry(3 段)—— 猜成 GET 就对不上,判 ANY 就对得上
    put(dir, 'apps/api/src/routes/reg.ts', "server.post('/api/registry', async () => ({}))\n")
    put(
      dir,
      'apps/web/src/lib/api-registry.ts',
      [
        "import { fetchApi } from '@/lib/api'",
        "const BASE = '/api/registry'",
        'async function api<T>(path: string) {',
        '  return fetchApi<T>(`${BASE}${path}`)',
        '}',
        "export const list = () => api('/items')",
        '',
      ].join('\n'),
    )
    const r = run(dir, ['--warn-only', '--dump-missing', join(dir, 'missing.json')])
    const missing = JSON.parse(readFileSync(join(dir, 'missing.json'), 'utf8'))
    assert.equal(calls(r.out, 'web'), 1, `声明行仍是一条调用点,只是 method 该是 ANY\n${r.out}`)
    assert.deepEqual(
      missing,
      [],
      `声明行认片段(ANY)后不该判死;判死清单非空 = 它仍被猜成 GET 打到了 method 不符的注册上\n${JSON.stringify(missing, null, 1)}`,
    )
  } finally {
    rmScratch(dir)
  }
})

// 防过度收紧:判定放宽到全部端后,**非**常量声明行不能被顺带认成片段。
// 夹具:后端注册 **GET** `/api/keep/me`;前端同一文件里
//   ① `const MAP = { get: '/api/keep/me' }` —— **不是**纯路径常量声明行
//      (赋值右侧是对象字面量,不是裸字符串)⇒ 必须仍按 inferMethodAtLine 走 GET 并对上;
//   ② 若判据被写成"整行含 `/api/` 就算片段",① 会被认成 ANY,而 ANY 也能命中 GET
//      ⇒ 这条仍绿 ⇒ 钉不住。所以再加一条**后端只注册 POST** 的对照(见下),
//      让"被误认成 ANY"与"正常 GET"在死调用读数上分开。
// 拆成两个用例(本条 + 下一条)是为了让两种过度修法各自有一处现形。
test('③ 防过度收紧:非"纯路径常量声明行"的字面量仍按 method 推断对上注册', () => {
  const dir = root()
  try {
    put(dir, 'scripts/api-routes-baseline.json', BASELINE)
    put(dir, 'apps/api/src/routes/keep.ts', "server.get('/api/keep/me', async () => ({}))\n")
    put(
      dir,
      'apps/web/src/keep.ts',
      [
        // 这一行**不是**纯路径常量声明行(赋值右侧是对象字面量,不是裸字符串)
        "const MAP = { me: '/api/keep/me' }",
        'export const go = () => api(MAP.me)',
        '',
      ].join('\n'),
    )
    const r = run(dir, ['--warn-only', '--dump-missing', join(dir, 'missing.json')])
    const missing = JSON.parse(readFileSync(join(dir, 'missing.json'), 'utf8'))
    assert.equal(
      calls(r.out, 'web'),
      1,
      `对象属性里的路径字面量仍算调用点(判据只认"右侧是裸字符串"的声明行)\n${r.out}`,
    )
    assert.deepEqual(
      missing,
      [],
      `它对得上后端 GET 注册;判死 = 判据把对象属性行也认成了片段\n${JSON.stringify(missing, null, 1)}`,
    )
  } finally {
    rmScratch(dir)
  }
})

// ③ 防过度收紧(第二腿 · 显式 method):真调用带**显式 method 字面量**时不受判据影响。
// 前一条钉的是"对象属性形态不被误认成片段";这一条钉的是"显式 method 的真调用不被
// 判据动" —— 收窄 isPathConstDecl 的正则(例如误把 `=` 右侧含引号的都算片段)会连它
// 一起打成 ANY,而这条的 method 前后台对得上,要让差异**可见**就得让 method 两侧不同:
// 后端只注册 POST,前端显式 POST ⇒ 命中;若被判成 ANY,ANY 也会命中 ⇒ 仍绿。
// ⇒ 老实说:ANY 覆盖面太宽,凡"ANY 也能命中"的场景都测不出它。
// 真正能测出的只有**计数**(剔掉不该剔的 ⇒ 调用点变少),而 ③ 不影响计数。
// 所以这一条的作用是**留痕**:把"③ 的过度收紧探针在计数上无效"这个事实钉在测试里,
// 免得下一个人以为还有更狠的探针而白花时间(实测过:GET/POST/ANY 三种配对全绿)。
test('③ 防过度收紧(留痕):显式 method 的真调用不受判据影响', () => {
  const dir = root()
  try {
    put(dir, 'scripts/api-routes-baseline.json', BASELINE)
    put(dir, 'apps/api/src/routes/keep.ts', "server.post('/api/keep/me', async () => ({}))\n")
    put(
      dir,
      'apps/web/src/keep.ts',
      [
        "const MAP = { me: '/api/keep/me' }",
        "export const go = () => fetchApi(MAP.me, { method: 'POST' })",
        '',
      ].join('\n'),
    )
    const r = run(dir, ['--warn-only', '--dump-missing', join(dir, 'missing.json')])
    const missing = JSON.parse(readFileSync(join(dir, 'missing.json'), 'utf8'))
    assert.equal(calls(r.out, 'web'), 1, `显式 POST 的真调用必须在调用集里\n${r.out}`)
    assert.deepEqual(
      missing,
      [],
      `显式 POST 的真调用对得上后端 POST 注册\n${JSON.stringify(missing, null, 1)}`,
    )
  } finally {
    rmScratch(dir)
  }
})

// ─────────────────────────────────────────────────────────────────────────
// 机制 ④嵌套 `sub.register(..., { prefix })` 的 prefix 未参与拼接
// ─────────────────────────────────────────────────────────────────────────

// 复刻 apps/api/src/routes/admin-sys/role-routes.ts:98-197 的真实形态:
//   `s.register(async (sub) => { sub.put('/cancel', …) }, { prefix: '/authUser' })`
// 修前:methodRe 只拿到 localPath `/cancel`,丢掉 prefix `/authUser`
//       ⇒ 注册面里没有 `/authUser/cancel` ⇒ 拼不出 `/api/admin/role/authUser/cancel`
//       ⇒ 前端那条调用被判死(改前靠 .check-api-routes-ignore.json 的一条豁免挂着)。
// 修后:prefix 参与拼接 ⇒ `/authUser/cancel` 进注册面 ⇒ 0 死调用。
test('④ 嵌套 register 的 prefix 参与拼接(两级相对前缀链不再断)', () => {
  const dir = root()
  try {
    put(dir, 'scripts/api-routes-baseline.json', BASELINE)
    put(
      dir,
      'apps/api/src/routes/admin-sys/index.ts',
      "export const adminSys = async (server) => { server.register(roleRoutes, { prefix: '/role' }) }\n",
    )
    put(
      dir,
      'apps/api/src/routes/admin-sys/role-routes.ts',
      [
        'export const roleRoutes = async (s) => {',
        '  s.register(',
        '    async (sub) => {',
        "      sub.put('/cancel', async () => ({}))",
        "      sub.get('/allocatedList', async () => ({}))",
        '    },',
        "    { prefix: '/authUser' },",
        '  )',
        '}',
        '',
      ].join('\n'),
    )
    put(dir, 'apps/api/src/routes/index.ts', "server.register(adminSys, { prefix: '/api/admin' })\n")
    put(
      dir,
      'apps/web/src/roles.ts',
      [
        // 两条都**显式**带 method:显式 method 不会被 inferMethodAtLine 猜错,
        // 让读数只反映"prefix 有没有参与拼接"这一个变量。
        // (第一版第二条写成 `api(...)` 无 method,被猜成 PUT ⇒ 即使 prefix 修好了
        //  也仍判死 —— 那是 method 推断的问题,会把本用例的归因带偏。)
        "export const cancel = () => fetchApi('/api/admin/role/authUser/cancel', { method: 'PUT' })",
        "export const list = () => fetchApi('/api/admin/role/authUser/allocatedList', { method: 'GET' })",
        '',
      ].join('\n'),
    )
    const r = run(dir, ['--warn-only', '--dump-missing', join(dir, 'missing.json')])
    const missing = JSON.parse(readFileSync(join(dir, 'missing.json'), 'utf8'))
    assert.equal(calls(r.out, 'web'), 2, `两条调用点都该进调用集\n${r.out}`)
    assert.deepEqual(
      missing,
      [],
      `嵌套 prefix 参与拼接后不得判死(修前 /cancel 与 /allocatedList 两条都是死调用)\n${JSON.stringify(missing, null, 1)}`,
    )
    assert.equal(r.status, 0, `在册端点不得判红\n${r.out}`)
  } finally {
    rmScratch(dir)
  }
})

// 防过度收紧:无 prefix 的 `server.register(fn)` 必须**不产出任何额外条目**
// (6 处这样的调用在真实面上是 HEAD 面 10 处嵌套 register 里的其余 6 处)。
// 判据一旦"见 register 就拼一个空前缀",会凭空造出一批 `/…` 路由把真死调用吃掉。
test('④ 防过度收紧:无 prefix 的 register 不产出额外条目(不臆造路由)', () => {
  const dir = root()
  try {
    put(dir, 'scripts/api-routes-baseline.json', BASELINE)
    put(dir, 'apps/api/src/routes/plain.ts', "server.get('/api/plain/ok', async () => ({}))\n")
    put(
      dir,
      'apps/api/src/routes/nested.ts',
      [
        'export const nested = async (s) => {',
        '  s.register(',
        '    async (sub) => {',
        // 后端**不存在**的端点:若实现臆造出条目,这条死调用会被吃掉
        "      sub.get('/ghost-endpoint', async () => ({}))",
        '    },',
        '  )',
        '}',
        '',
      ].join('\n'),
    )
    put(dir, 'apps/web/src/ghost.ts', "export const g = () => api('/api/ghost-endpoint')\n")
    const r = run(dir)
    // 判红是**期望**:证明"无 prefix 不产出条目",真死调用仍被抓住
    assert.notEqual(r.status, 0, `无 prefix 的 register 不得臆造路由(死调用应仍判红)\n${r.out}`)
    assert.match(r.out, /ghost-endpoint/, `必须点名这条死调用\n${r.out}`)
  } finally {
    rmScratch(dir)
  }
})

// ─────────────────────────────────────────────────────────────────────────
// 机制 ⑤`.includes('/api/...')` 子串匹配不是调用点
// ─────────────────────────────────────────────────────────────────────────

// 复刻 apps/web/e2e/responsive.spec.ts:43 与 publish-scan-login.spec.ts:41 的真实形态:
// e2e 白名单 / 拦截器里的 `!e.includes('/api/a2a/')` —— 只是在"看有没有调某前缀",
// 从不发请求。修前:被当成调用点(还猜成 GET)⇒ 后端不存在该端点时判死。
// 修后:不进调用集 ⇒ 调用点读数为 0。
test('⑤ e2e 里的 includes 子串白名单不是调用点', () => {
  const dir = root()
  try {
    put(dir, 'scripts/api-routes-baseline.json', BASELINE)
    // 后端**不注册** /api/a2a/anything ⇒ 修前那行会被判死调用
    put(dir, 'apps/api/src/routes/other.ts', "server.get('/api/zzz/other', async () => ({}))\n")
    put(
      dir,
      'apps/web/e2e/responsive.spec.ts',
      [
        'test("no errors", async ({ page }) => {',
        '  const realErrors = serverErrors.filter(',
        '    (e) =>',
        "      !e.includes('favicon') &&",
        "      !e.includes('/api/a2a/'),",
        '  )',
        '  expect(realErrors).toHaveLength(0)',
        '})',
        '',
      ].join('\n'),
    )
    const r = run(dir)
    assert.equal(r.status, 0, `子串匹配不得判红\n${r.out}`)
    assert.equal(calls(r.out, 'web'), 0, `白名单行不是调用点\n${r.out}`)
    assert.doesNotMatch(r.out, /a2a/, `子串匹配的行不得出现在任何报数里\n${r.out}`)
  } finally {
    rmScratch(dir)
  }
})

// 防过度收紧(票面点名的另一半):**同一个文件里**,子串匹配那行被剔,
// 真发请求那行必须仍在调用集。这是"按文件跳过"那种过度修法的死穴 ——
// 两种形态分落两个文件时,"整份跳过"也能让各自通过;同文件并存才测得出来。
// 另外顺带钉住**泛型形态**的传输口 `fetchApi<T>(` 也算数(量表实测 2,623 条真调用
// 走本地 wrapper,连泛型带法都要认,否则会误剔一大批)。
test('⑤ 防过度收紧:同文件内 includes 那行被剔、真发请求那行仍在(含泛型 fetchApi<T>)', () => {
  const dir = root()
  try {
    put(dir, 'scripts/api-routes-baseline.json', BASELINE)
    put(dir, 'apps/api/src/routes/real.ts', "server.post('/api/real/do', async () => ({}))\n")
    put(
      dir,
      'apps/web/e2e/mixed.spec.ts',
      [
        "import { fetchApi } from '@/lib/api'",
        'test("mixed", async () => {',
        // 真调用:泛型形态传输口,必须进调用集
        "  await fetchApi<{ ok: boolean }>('/api/real/do', { method: 'POST' })",
        '  const hits = urls.filter((u) => u.includes("/api/never/registered"))',
        '  expect(hits).toHaveLength(0)',
        '})',
        '',
      ].join('\n'),
    )
    const r = run(dir, ['--warn-only'])
    assert.equal(
      calls(r.out, 'web'),
      1,
      `只有真发请求那条进调用集(读数 1);读数 2 = 子串白名单没剔掉,读数 0 = 泛型传输口被误伤\n${r.out}`,
    )
    assert.equal(deadCalls(r.out, 'web'), 0, `真调用对得上后端\n${r.out}`)
  } finally {
    rmScratch(dir)
  }
})

// 防过度收紧(第三腿):同一行里**既有**子串匹配**又有**传输口时,那一行的字面量全部保留。
// 判据是「字符串谓词实参 **且** 同行无传输口」—— 只盯谓词不盯传输口的实现会在这里现形
// (它会把这一行整行剔掉,连真的那次请求一起丢)。
// 读数 3 是**判据的设计后果**,不是缺陷:判据按**行**判、不按字面量判,所以同一行的
// 三个 `/api/…` 字面量(1 个白名单 + 2 个真路径实参)同进同退。要更细就得逐字面量判
// "这个字面量在不在 fetch 实参位",那是另一个量级的解析器,本票不做 —— 这里把
// 「按行判」这条口径钉住,免得下一个人以为读数 3 是漏修。
test('⑤ 防过度收紧:同一行既有 includes 又有 fetch( ⇒ 判有传输口,整行字面量全保留', () => {
  const dir = root()
  try {
    put(dir, 'scripts/api-routes-baseline.json', BASELINE)
    put(dir, 'apps/api/src/routes/both.ts', "server.get('/api/both/real', async () => ({}))\n")
    put(
      dir,
      'apps/web/src/both.ts',
      [
        "import { fetchApi } from '@/lib/api'",
        // 同一行:一个 includes 白名单 + 一次真 fetch(两个实参都是同一路径)
        "export const go = (urls: string[]) => fetchApi(urls.includes('/api/never/x') ? '/api/both/real' : '/api/both/real')",
        '',
      ].join('\n'),
    )
    const r = run(dir, ['--warn-only', '--dump-missing', join(dir, 'missing.json')])
    assert.equal(
      calls(r.out, 'web'),
      3,
      `同行有传输口 ⇒ 整行字面量都保留(读数 3);读数 0 = 真请求被误剔\n${r.out}`,
    )
    // 死调用读数不能用「· web:死调用 N 处」那行取:web 是零容忍端,该行只在**豁免后归零**时
    // 打印(见 check-api-routes 的 ratchet 分支)。改读 --dump-missing 的逐条清单 ——
    // 唯一判死的必须是 /api/never/x,两个 /api/both/real 都得对上后端。
    const missing = JSON.parse(readFileSync(join(dir, 'missing.json'), 'utf8'))
    assert.equal(
      missing.length,
      1,
      `唯一判死的应是 /api/never/x\n${JSON.stringify(missing, null, 1)}`,
    )
    assert.equal(missing[0].path, '/api/never/x', `判死的应是白名单里那个不存在的路径`)
  } finally {
    rmScratch(dir)
  }
})

// 遮罩面(第五腿):机制⑤ 判"这一行有没有传输口"时,必须看 **maskComments 遮罩后**的行。
//
// 失败形态(钉的就是它):一行里同时有**注释掉的**传输口字样与一个字符串谓词实参 ——
//   `/* 旧写法:fetch('/api/x') *\/ const ok = u.includes('/api/y')`
// 看原文会认定"这行有 fetch(" ⇒ 保留 ⇒ `/api/y` 进了调用集(误报照旧);
// 用遮罩面则注释被抹掉、这行无传输口 ⇒ 剔掉(正确)。
// 同文件另有一条**真** fetch(未被注释遮住的)必须仍在调用集 —— 防"整份跳过"式修法。
//
// ⚠️ 口径说明(实测,不掩盖):**注释里的 `/api/…` 字面量本身仍会被 pathRe 抽成调用点**
// (`pathRe` 走原文 `lines`,不读遮罩面;这是既有行为,不在本票 5 个机制射程内)。
// 所以本例刻意**不**断言"注释里的字面量不算调用点" —— 那会要求一条本票没做的判据。
// 本例只钉 ⑤ 自己的那条:遮罩面**参与传输口判定**。
test('⑤ 遮罩面:传输口判定走 maskComments(注释里的 fetch 字样不算这行有传输口)', () => {
  const dir = root()
  try {
    put(dir, 'scripts/api-routes-baseline.json', BASELINE)
    put(dir, 'apps/api/src/routes/cm.ts', "server.get('/api/cm/live', async () => ({}))\n")
    put(
      dir,
      'apps/web/src/cm.ts',
      [
        "import { fetchApi } from '@/lib/api'",
        '/* 旧写法:fetch("/api/cm/in-comment") */',
        "const hits = urls.filter((u) => u.includes('/api/cm/only-substring'))",
        // 同文件里没被注释遮住的真 fetch —— 必须仍在调用集
        "export const live = () => fetchApi('/api/cm/live')",
        '',
      ].join('\n'),
    )
    const r = run(dir, ['--warn-only', '--dump-missing', join(dir, 'missing.json')])
    const missing = JSON.parse(readFileSync(join(dir, 'missing.json'), 'utf8'))
    const paths = missing.map((m) => m.path)
    assert.ok(
      !paths.includes('/api/cm/only-substring'),
      `注释里的 fetch 字样不得让这行被当成"有传输口"而保留子串匹配\n判死清单: ${JSON.stringify(paths)}`,
    )
    assert.ok(
      !paths.includes('/api/cm/live'),
      `真 fetch 那条对得上后端,不该判死\n判死清单: ${JSON.stringify(paths)}`,
    )
    // 真调用必须仍在调用集(防"整份跳过")
    assert.ok(
      calls(r.out, 'web') >= 1,
      `未被注释遮住的真调用必须仍在调用集\n${r.out}`,
    )
  } finally {
    rmScratch(dir)
  }
})

// ─────────────────────────────────────────────────────────────────────────
// 源码锁:五个判据不得被静默删掉(判据失效的表现永远是安静)
// ─────────────────────────────────────────────────────────────────────────

test('S1 源码锁:五个机制各自的判据入口都在,且未被静默去掉', () => {
  // ① params 否定前瞻
  assert.match(
    SRC,
    /params\(\?!\\s\*\(\?:\\\?\\\.\|\\\.\|\\\[\)\)/,
    '① 的 `params` 否定前瞻不见了 —— 退回即 params.id 又被整段丢弃',
  )
  // ② FastAPI 空路径
  assert.match(
    SRC,
    /@router\\\.\(get\|post\|put\|patch\|delete\|options\)\\\(\\s\*\['"`\]\(\[\^'"`\]\+\)\?\['"`\]/,
    '② 的可空路径组不见了 —— 退回即 @router.get("") 抽不出',
  )
  assert.match(
    SRC,
    /fm\[2\] === undefined \? '' : fm\[2\]/,
    '② 必须把可空组归一成 \'\' 再交给 normalizePath',
  )
  // ③ isPathConstDecl 不再被 cliShapes 限死
  const declLine = SRC.split(/\r?\n/).find((l) => l.includes('const isPathConstDecl'))
  assert.ok(declLine, '找不到 isPathConstDecl')
  assert.ok(
    !declLine.includes('cliShapes'),
    `③ 的 cliShapes 限死回来了(判据本体不该变,覆盖面才放开)\n${declLine}`,
  )
  // ④ 嵌套 register 展开
  assert.match(SRC, /function expandNestedRegisterRoutes\(/, '④ 的展开函数不见了')
  assert.match(
    SRC,
    /routes\.push\(\.\.\.expandNestedRegisterRoutes\(src, rel\)\)/,
    '④ 必须真的在取材主循环里被调用(只定义不用 = 静默失效)',
  )
  // ⑤ 子串匹配
  assert.match(SRC, /const STRING_PREDICATE_RE =/, '⑤ 的字符串谓词判据不见了')
  assert.match(SRC, /const LINE_TRANSPORT_RE =/, '⑤ 的同行传输口判据不见了')
  assert.match(
    SRC,
    /if \(STRING_PREDICATE_RE\.test\(maskedLine\) && !LINE_TRANSPORT_RE\.test\(maskedLine\)\) continue/,
    '⑤ 必须用遮罩后的行判定,且两条件都要在',
  )
  assert.match(SRC, /const maskedLines = maskComments\(src\)\.split\('\\n'\)/, '⑤ 必须用 maskComments 遮罩面')
})

test('S2 源码锁:五个机制的判据依据注释不得被删(否则下一个人要重查一遍)', () => {
  assert.match(SRC, /形态 B/, '① 必须留着两种形态的实测统计指针')
  assert.match(SRC, /形态 A 影响面为 0/, '① 必须留着"独立 params 影响面为 0"这个立判依据')
  assert.match(SRC, /全仓 7 处 `?@router\.get\(""`?/, '② 必须点名 7 处空路径')
  assert.match(SRC, /与端无关/, '③ 必须点明"片段不是调用点"与端无关这条依据')
  assert.match(SRC, /尾部带 `?\{ prefix \}`? 的 \*\*4 处\*\*/, '④ 必须留着 4 处同型形态的实测数')
  assert.match(
    SRC,
    /会把 \*\*2,623 条\*\*判成非调用点/,
    '⑤ 必须留着"只用无传输口当判据会剔掉 2,623 条真调用"这个否证理由',
  )
})
