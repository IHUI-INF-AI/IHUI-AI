// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 镜像测试:`scripts/lib/outbound-route-registrations.mjs`(§22c 模式 —— 直接 import 源实现的导出函数,
 * 不在测试里复制第二份判据)。
 *
 * 打的是 O87g 第①步「把提取式扩到 helper 注册形态」这一格,每条都带**正反面**:
 *   H1/H2  工厂(helper)调用点按实参解析 —— 名字不写死(夹具里的工厂叫 `mountThings`,故意不叫
 *          registerCrud,证明是「按实现体推导」不是「按名字猜」)+ 旧式字面注册一条不许丢(⊇ 构造面锁);
 *   H3     工厂路径实参是解不出的标识符 ⇒ 不产出该路径 **且** 必须点名(未判定 ≠ 不存在);
 *   H4/H5/H5b 模板前缀子树:反引号无插值 = 定值前缀(先前整棵丢)、带插值可按同文件常量解、解不出照旧未判定;
 *   H6     矩阵模板:补出具体值,且**旧通配必须仍在**(只增不减);矩阵求交为 false 的行不得被臆造出来;
 *   H7     裸标识符路径常量 ⇒ 补出;
 *   H8     别名实例子树:本层**不读** ⇒ 既不产出也不判红,只点名(反向牙:产出即红);
 *   H9     注释里的工厂调用不算注册(遮噪在位);
 *   H10    前缀归因不可证(barrel re-export 那一型)⇒ helper 层不产出,而该节点的历史粗口径字面条目照旧保留;
 *   H11    动态 import 边(`const { default: X } = await import('./p.js')`)可解 ⇒ 子树读到(纯增可达性)。
 *
 * 与 `scripts/tests/check-declared-outbound-routes.test.mjs` 的分工:那件打**门**的 CLI 契约与取材面;
 * 本件打**挂载图提取式**本身。真值面的「精确集 ⊇ 现有真值」对照由仓内可复跑判据出凭据(见 progress 记录),
 * 不在这里读 git(测试必须构造输入,不复制判据也不碰磁盘)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { FASTIFY_ENTRY } from '../lib/outbound-route-facts.mjs'
import { collectFactoryNames } from '../lib/route-registration-extract.mjs'
import {
  analyzeHelperForms,
  analyzeTsFile,
  buildFastApiRegistrations,
  buildFastifyRegistrations,
  buildGraphInfos,
  mountedFunctionNames,
  runSelfTest,
} from '../lib/outbound-route-registrations.mjs'

/** 工厂实现体(名字刻意不是 registerCrud):路径形参 + `${形参}/:id` 两型 */
const SHARED_FACTORY = [
  'export function mountThings(server, basePath, table, opts) {',
  '  server.get(basePath, async () => ([]))',
  '  server.get(`${basePath}/:id`, async () => ({}))',
  '  server.post(basePath, async () => ({}))',
  '  server.delete(basePath, async () => ({}))',
  '}',
  '',
].join('\n')

const map = (entries) => new Map(entries)

test('H1 工厂(helper)注册调用点:按实参解析前缀,方法集来自实现体(名字不写死)', () => {
  const files = map([
    [FASTIFY_ENTRY, "import { thingsRoutes } from './routes/things.js'\nserver.register(thingsRoutes, { prefix: '/api' })\n"],
    [
      'apps/api/src/routes/things.ts',
      "import { mountThings } from './_shared.js'\nexport const thingsRoutes = async (server) => {\n  mountThings(server, '/things', thingsTable, { map: (b) => b })\n}\n",
    ],
    ['apps/api/src/routes/_shared.ts', SHARED_FACTORY],
  ])
  const reg = buildFastifyRegistrations(files)
  assert.ok(reg.paths.has('api/things'), `工厂调用点的 basePath 实参必须解出:got ${[...reg.paths].join(', ')}`)
  assert.ok(reg.paths.has('api/things/*'), '`${basePath}/:id` 腿必须随实参代入')
  assert.ok(!reg.paths.has('api/basePath'), '不得把工厂形参名本身当成注册路径(臆造)')
})

test('H2 ⊇ 构造面锁:同一个文件里旧式字面注册一条不许因 helper 层而丢', () => {
  const files = map([
    [FASTIFY_ENTRY, "import { thingsRoutes } from './routes/things.js'\nserver.register(thingsRoutes, { prefix: '/api' })\n"],
    [
      'apps/api/src/routes/things.ts',
      "import { mountThings } from './_shared.js'\nexport const thingsRoutes = async (server) => {\n  server.get('/things/list', async () => ([]))\n  mountThings(server, '/things', thingsTable, { map: (b) => b })\n}\n",
    ],
    ['apps/api/src/routes/_shared.ts', SHARED_FACTORY],
  ])
  const reg = buildFastifyRegistrations(files)
  assert.ok(reg.paths.has('api/things/list'), '旧通道(TS_ROUTE_RE)读到的字面注册必须仍在')
  assert.ok(reg.paths.has('api/things'), '新通道读到的工厂注册必须在')
})

test('H3 工厂路径实参解不出 ⇒ 不产出该路径,但必须点名(未判定 ≠ 不存在)', () => {
  const files = map([
    [FASTIFY_ENTRY, "import { thingsRoutes } from './routes/things.js'\nserver.register(thingsRoutes, { prefix: '/api' })\n"],
    [
      'apps/api/src/routes/things.ts',
      "import { mountThings } from './_shared.js'\nexport const thingsRoutes = async (server) => {\n  mountThings(server, runtimePath, thingsTable, { map: (b) => b })\n}\n",
    ],
    ['apps/api/src/routes/_shared.ts', SHARED_FACTORY],
  ])
  const reg = buildFastifyRegistrations(files)
  const named = reg.unresolved.filter((l) => /runtimePath|路径实参不可解/.test(l))
  assert.ok(named.length >= 1, `解不出的工厂实参必须逐条点名,实得 unresolved=${JSON.stringify(reg.unresolved)}`)
  assert.ok(!reg.paths.has('api/runtimePath'), '解不出不得硬造路径')
})

test('H4 模板前缀子树:反引号但无插值 = 定值前缀(旧式把整棵子树当"模板"丢掉)', () => {
  const files = map([
    [FASTIFY_ENTRY, "import { subRoutes } from './routes/sub.js'\nserver.register(subRoutes, { prefix: `/api/literal` })\n"],
    ['apps/api/src/routes/sub.ts', "export const subRoutes = async (server) => {\n  server.get('/ping', async () => ({}))\n}\n"],
  ])
  const reg = buildFastifyRegistrations(files)
  assert.ok(reg.paths.has('api/literal/ping'), `定值反引号前缀必须解析成真边,got ${[...reg.paths].join(', ')}`)
})

test('H5 模板前缀子树:带插值按同文件字符串常量解出 ⇒ 子树读到,不透明出口同时保留', () => {
  const files = map([
    [
      FASTIFY_ENTRY,
      "import { subRoutes } from './routes/sub.js'\nconst SCOPE = '/api/scope'\nserver.register(subRoutes, { prefix: `${SCOPE}/v1` })\n",
    ],
    ['apps/api/src/routes/sub.ts', 'export const subRoutes = async (server) => {\n  server.get(\'/ping\', async () => ({}))\n}\n'],
  ])
  const reg = buildFastifyRegistrations(files)
  assert.ok(reg.paths.has('api/scope/v1/ping'), '模板前缀解得出 ⇒ 必须成真边(票面点名的第二族)')
  assert.ok([...reg.opaque].includes('/__template_prefix__'), '不透明前缀的「未判定」出口不得被摘掉(第②步的前置)')
})

test('H5b 模板前缀解不出 ⇒ 该子树一条不产出,只点名', () => {
  const files = map([
    [
      FASTIFY_ENTRY,
      "import { subRoutes } from './routes/sub.js'\nserver.register(subRoutes, { prefix: `${NO_SUCH_SCOPE}/v1` })\n",
    ],
    ['apps/api/src/routes/sub.ts', 'export const subRoutes = async (server) => {\n  server.get(\'/ping\', async () => ({}))\n}\n'],
  ])
  const reg = buildFastifyRegistrations(files)
  assert.ok(!reg.paths.has('api/v1/ping') && !reg.paths.has('ping'), '解不出的前缀不得回落成"空前缀"硬拼路径')
  assert.ok(
    reg.unresolved.some((l) => /模板前缀/.test(l)),
    `解不出的模板前缀必须点名,实得 ${JSON.stringify(reg.unresolved)}`,
  )
})

test('H6 矩阵模板:补出具体值,旧通配仍在(只增不减),求交为 false 的行不得被臆造', () => {
  const files = map([
    [FASTIFY_ENTRY, "import { vendorRoutes } from './routes/vendors.js'\nserver.register(vendorRoutes, { prefix: '/api/ai' })\n"],
    [
      'apps/api/src/routes/vendors.ts',
      [
        "const VENDORS = [{ name: 'alpha', chat: true }, { name: 'beta', chat: false }]",
        'export const vendorRoutes = async (server) => {',
        '  for (const cap of VENDORS) {',
        '    const vendor = cap.name',
        '    if (cap.chat) {',
        "      server.post(`/${vendor}/chat`, async () => ({}))",
        '    }',
        "    server.get(`/${vendor}/models`, async () => ({}))",
        '  }',
        '}',
        '',
      ].join('\n'),
    ],
  ])
  const reg = buildFastifyRegistrations(files)
  assert.ok(reg.paths.has('api/ai/*/chat'), '旧通配条目必须原样保留(⊇ 锁)')
  assert.ok(reg.paths.has('api/ai/alpha/chat'), '矩阵展开的具体值必须读到')
  assert.ok(reg.paths.has('api/ai/alpha/models'))
  assert.ok(!reg.paths.has('api/ai/beta/chat'), `矩阵求交后 chat=false 的行不得被造出来:got ${[...reg.paths].join(', ')}`)
})

test('H7 裸标识符路径实参(同文件常量)⇒ 补出', () => {
  const files = map([
    [FASTIFY_ENTRY, "import { ghRoutes } from './routes/gh.js'\nserver.register(ghRoutes, { prefix: '/api' })\n"],
    [
      'apps/api/src/routes/gh.ts',
      "export const ghRoutes = async (server) => {\n  const HEALTH_PATH = '/health'\n  server.get(HEALTH_PATH, async () => ({}))\n}\n",
    ],
  ])
  const reg = buildFastifyRegistrations(files)
  assert.ok(reg.paths.has('api/health'), `裸标识符实参按同文件常量代入,got ${[...reg.paths].join(', ')}`)
})

test('H8 别名实例子树:本层不读 ⇒ 不产出、不判红,只点名(反向牙)', () => {
  const files = map([
    [
      FASTIFY_ENTRY,
      "server.register(async (child) => {\n  child.get('/admin/exam/papers', async () => ([]))\n}, { prefix: '/api/exam' })\n",
    ],
  ])
  const reg = buildFastifyRegistrations(files)
  assert.ok(!reg.paths.has('api/exam/admin/exam/papers'), '别名实例(child)子树不得被本层读成在册')
  assert.ok([...reg.opaque].includes('/api/exam'), '该前缀必须仍记不透明(未判定出口)')
  assert.ok(
    reg.unresolved.some((l) => /内联子树/.test(l)),
    `整棵读不到必须点名,实得 ${JSON.stringify(reg.unresolved)}`,
  )
})

test('H9 注释里的工厂调用不算注册(遮噪在位)', () => {
  const files = map([
    [FASTIFY_ENTRY, "import { thingsRoutes } from './routes/things.js'\nserver.register(thingsRoutes, { prefix: '/api' })\n"],
    [
      'apps/api/src/routes/things.ts',
      "import { mountThings } from './_shared.js'\nexport const thingsRoutes = async (server) => {\n  // mountThings(server, '/fake', t, { map: (b) => b })\n  server.get('/real', async () => ({}))\n}\n",
    ],
    ['apps/api/src/routes/_shared.ts', SHARED_FACTORY],
  ])
  const reg = buildFastifyRegistrations(files)
  assert.ok(!reg.paths.has('api/fake'), '注释里的调用点不得被当成注册')
  assert.ok(reg.paths.has('api/real'))
})

test('H10 前缀归因不可证(barrel re-export)⇒ helper 层不产出,历史粗口径字面条目照旧保留', () => {
  const files = map([
    [
      FASTIFY_ENTRY,
      "import { aiVendorRoutes, adminAiVendorRoutes } from './routes/ai-vendors.js'\nserver.register(aiVendorRoutes, { prefix: '/api/ai' })\nserver.register(adminAiVendorRoutes, { prefix: '/api/admin/ai' })\n",
    ],
    [
      'apps/api/src/routes/ai-vendors.ts',
      "import { vendorSub } from './ai-vendors/sub.js'\nexport const aiVendorRoutes = async (server) => {\n  await server.register(vendorSub)\n}\nexport { adminAiVendorRoutes } from './ai-vendors/admin.js'\n",
    ],
    [
      'apps/api/src/routes/ai-vendors/admin.ts',
      "export const adminAiVendorRoutes = async (server) => {\n  server.get('/own', async () => ({}))\n}\n",
    ],
    [
      'apps/api/src/routes/ai-vendors/sub.ts',
      "export const vendorSub = async (server) => {\n  const VP = '/vsub'\n  server.get('/lit', async () => ([]))\n  server.get(`${VP}/models`, async () => ({}))\n}\n",
    ],
  ])
  const reg = buildFastifyRegistrations(files)
  assert.ok(reg.paths.has('api/ai/vsub/models'), `归因可证的链必须产出 helper 条目,got ${[...reg.paths].join(', ')}`)
  assert.ok(reg.paths.has('api/admin/ai/lit'), '同一子树的历史字面条目仍按旧口径保留(⊇ 锁,本层不收紧既有)')
  assert.ok(
    !reg.paths.has('api/admin/ai/vsub/models'),
    `归因不可证的节点上 helper 层不得产出(那会把一条粗通配放大成上百条"确切在册"= 假绿),got ${[...reg.paths].join(', ')}`,
  )
  assert.ok(
    reg.unresolved.some((l) => /前缀归因不可证/.test(l)),
    `被搁置的 helper 候选必须点名,实得 ${JSON.stringify(reg.unresolved)}`,
  )
})

test('H12 判据单源:工厂名与函数归因都来自 route-registration-extract,不是本层第二份实现', () => {
  const files = map([
    ['apps/api/src/routes/_shared.ts', SHARED_FACTORY],
    ['apps/api/src/routes/other.ts', 'export function notAFactory(cfg) {\n  return cfg\n}\n'],
  ])
  const infos = buildGraphInfos(files)
  const names = collectFactoryNames(infos)
  assert.deepEqual([...names].sort(), ['mountThings'], '工厂名单由实现体推导,写死的名单不算')

  // 归因窄口径打在**图形层**那份 info 上(本层的 info 没有 fnByName,拿错了就是 undefined)
  const graphInfo = buildGraphInfos(
    map([['apps/api/src/routes/two.ts', 'export const aRoutes = async (server) => {}\nexport const bRoutes = async (server) => {}\n']]),
  ).get('apps/api/src/routes/two.ts')
  assert.equal(graphInfo.fnByName.has('aRoutes'), true, '图形层那份 info 才带函数表')
  assert.equal(mountedFunctionNames(graphInfo, 'aRoutes').has('aRoutes'), true)
  assert.equal(mountedFunctionNames(graphInfo, 'unresolvableSymbol').size, 0, '两个函数又定不出符号 ⇒ 空集(不收窄,交回旧口径)')

  const oneFn = buildGraphInfos(map([['apps/api/src/routes/one.ts', 'export const onlyRoutes = async (server) => {}\n']])).get('apps/api/src/routes/one.ts')
  assert.deepEqual([...mountedFunctionNames(oneFn, 'whateverSymbol')], ['onlyRoutes'], '全文件只有一个函数 ⇒ 按该函数归因')

  const barrel = buildGraphInfos(
    map([['apps/api/src/routes/barrel.ts', "export { onlyRoutes } from './real.js'\n"]]),
  ).get('apps/api/src/routes/barrel.ts')
  assert.equal(mountedFunctionNames(barrel, 'onlyRoutes').size, 0, 'barrel re-export 的符号定义不在本文件 ⇒ 归因不可证')

  const helperInfo = analyzeTsFile('app/x.ts', 'server.register(async (child) => {\n  child.get("/y", async () => ({}))\n})\n')
  assert.equal(helperInfo.inlineSubtrees.length, 1, 'analyzeTsFile 必须把读不到的形态登记出来(供点名)')
  // FastAPI 侧不得被本次扩展波及:未挂载的 router 仍不进注册集,挂载了的照常拼前缀
  assert.equal(
    buildFastApiRegistrations(map([['app/x.py', "@router.get('/y')\nasync def y():\n    pass\n"]])).paths.has('y'),
    false,
    '未被 include_router 挂载的 router 不得进注册集(与本层既有口径一致)',
  )
  const pyMounted = buildFastApiRegistrations(
    map([
      ['apps/ai-service/app/main.py', "from app.routers import hooks\napp.include_router(hooks.router, prefix='/api')\n"],
      ['apps/ai-service/app/routers/hooks.py', "router = APIRouter(prefix='/hooks')\n\n@router.post('/auto-orchestrate')\nasync def a():\n    pass\n"],
    ]),
  )
  assert.ok(pyMounted.paths.has('api/hooks/auto-orchestrate'), 'FastAPI 挂载图仍走通')
  assert.equal(typeof analyzeHelperForms, 'function')
})

test('H11 动态 import 边可解 ⇒ 先前解析不到文件的子树读到(纯增可达性)', () => {
  const files = map([
    [
      FASTIFY_ENTRY,
      "const { default: dynRoutes } = await import('./routes/dyn.js')\nawait server.register(dynRoutes, { prefix: '/api' })\n",
    ],
    ['apps/api/src/routes/dyn.ts', "export default async (server) => {\n  server.get('/dyn/x', async () => ({}))\n}\n"],
  ])
  const reg = buildFastifyRegistrations(files)
  assert.ok(reg.paths.has('api/dyn/x'), `动态导入的挂载目标必须走到,got ${[...reg.paths].join(', ')}`)
})

/* ── O87g 先决补格@2026-10-26:同文件本地插件函数的挂载边(真仓六档 17 条 unresolved 的成因) ── */

test('L1 同文件直调型本地函数(`auditRoutes(server)`):体内工厂调用按累积前缀产出(摘掉识别式即翻红)', () => {
  const files = map([
    [FASTIFY_ENTRY, "import { r } from './routes/t.js'\nserver.register(r, { prefix: '/api' })\n"],
    [
      'apps/api/src/routes/t.ts',
      "import { mountThings } from './_shared.js'\nexport const r = async (server) => {\n  registerAudit(server)\n}\nfunction registerAudit(server) {\n  mountThings(server, '/audit', audits, {})\n}\n",
    ],
    ['apps/api/src/routes/_shared.ts', SHARED_FACTORY],
  ])
  const reg = buildFastifyRegistrations(files)
  assert.ok(reg.paths.has('api/audit'), `本地函数体内工厂必须读到,got ${[...reg.paths].join(', ')}`)
  assert.ok(reg.paths.has('api/audit/*'), '`${basePath}/:id` 腿同样代入')
  assert.ok(
    !reg.unresolved.some((l) => /register\(registerAudit\) 解析不到文件/.test(l)),
    '该型不得再落「解析不到文件」误报名(真边取代盲区)',
  )
})

test('L2 同文件具名裸 register(`server.register(localFn)`)⇒ 节点走到、工厂产出(反向对照 L3)', () => {
  const files = map([
    [FASTIFY_ENTRY, "import { r } from './routes/t2.js'\nserver.register(r, { prefix: '/api' })\n"],
    [
      'apps/api/src/routes/t2.ts',
      "import { mountThings } from './_shared.js'\nconst sub = async (server) => {\n  mountThings(server, '/sub', rows, {})\n}\nexport const r = async (server) => {\n  server.register(sub)\n}\n",
    ],
    ['apps/api/src/routes/_shared.ts', SHARED_FACTORY],
  ])
  const reg = buildFastifyRegistrations(files)
  assert.ok(reg.paths.has('api/sub') && reg.paths.has('api/sub/*'))
})

test('L3 边界锁(成对反牙):带前缀的同文件具名注册不得被洗成确信(守门 127 F4/F4b 裁决面)', () => {
  const files = map([
    [FASTIFY_ENTRY, 'const crudRoutes = async (app) => {\n  app.get("/crud/:id", async () => ({}))\n}\nserver.register(crudRoutes, { prefix: \'/api/v1\' })\n'],
  ])
  const reg = buildFastifyRegistrations(files)
  assert.ok([...reg.opaque].includes('/api/v1'), '带前缀同文件具名注册的前缀必须仍记不透明')
  assert.ok(!reg.paths.has('api/v1/crud/*'), '其子树不得被本层读成"已注册"(那是门 127 钉住的未判定桶)')
})

test('L4 节点键含挂载符号:同文件两插件函数共用前缀时,归因窄口径不得互相顶掉访问面', () => {
  // (rel, prefix) 旧键会让先到的 X 节点吃掉后到的 Y 节点 ⇒ Y 体内工厂永远不产出。
  // 键加 mountedSymbol 一维后两节点各走各的(纯增访问面;⊇ 由 L1/L2 与既有 H 族共证)。
  const files = map([
    [FASTIFY_ENTRY, "import { aRoutes, bRoutes } from './routes/ab.js'\nserver.register(aRoutes, { prefix: '/api' })\nserver.register(bRoutes, { prefix: '/api' })\n"],
    [
      'apps/api/src/routes/ab.ts',
      "import { mountThings } from './_shared.js'\nexport const aRoutes = async (server) => {\n  registerInlineA(server)\n}\nexport const bRoutes = async (server) => {\n  mountThings(server, '/b-only', rows, {})\n}\nfunction registerInlineA(server) {\n  mountThings(server, '/a-only', rows, {})\n}\n",
    ],
    ['apps/api/src/routes/_shared.ts', SHARED_FACTORY],
  ])
  const reg = buildFastifyRegistrations(files)
  assert.ok(reg.paths.has('api/b-only'), 'bRoutes 直写工厂必须产出')
  assert.ok(reg.paths.has('api/a-only'), 'aRoutes 经本地函数间接的工厂也必须产出(旧键同前缀相撞即丢这一条)')
})

test('L5 lib --self-test 出口成对夹具全绿(无调度点判据=没有:此档即调度点之一)', () => {
  const results = runSelfTest()
  assert.ok(results.length >= 8, `self-test 例数必须 ≥8,实得 ${results.length}`)
  const failed = results.filter((r) => !r.pass)
  assert.deepEqual(failed.map((r) => r.name), [], 'SELF-TEST 不得有未过例')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
