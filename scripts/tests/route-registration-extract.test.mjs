// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试:route-registration-extract 挂载图提取式的五个缺口(O87g 收尾,2026-10-22 实证)。
// 立因:门 8 接线工作树版报假红 —— 前端真打的 PATCH/POST /api/plugins/:id/*、GET /api/vip/benefits、
// GET /api/categories/list、POST/PUT /api/dict/data 全部在册,却因提取式读不到而被判死/降级。
// 五组夹具各钉一缺口:R1 泛型动词、R2 动态 import 挂载、R3 re-export barrel 追链、
// R4 正则字面量遮噪(引号态级联)、R5 空串 localPath。库是纯函数层(rel→源码 Map,不读盘不碰 git),
// 夹具全部内存态 —— 连 os.tmpdir()/mkScratch 都不需要,§26 从根上满足。
// 另带两条源码形状锁:管线顺序(遮正则必须嵌在遮注释之内)与三处"牙"的形态。这两条是
// 隐形设计决定,没有形状锁,下一个"整理代码"的人会原样改回去(2026-10-22 本会话已错过一次)。

import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { extractApiRegistrations, maskRegexLiterals, skipQuoted, __test__ } from '../lib/route-registration-extract.mjs'

const ENTRY = 'apps/api/src/server.ts'
const files = (obj) => new Map(Object.entries(obj))
const hasEntry = (out, method, path, file) =>
  out.entries.some((e) => e.method === method && e.path === path && (!file || e.file === file))

/** 最小 Fastify 入口:实例名 server 由 `const server = Fastify()` 供上 */
const serverTs = (body) =>
  [
    "import Fastify from 'fastify'",
    'const server = Fastify()',
    body,
    'server.listen({ port: 3000 })',
    '',
  ].join('\n')

// ─── R1 泛型动词:server.patch<{…}>('/x', h) ───────────────────────────────
test('R1 泛型动词注册必须计入(旧式只认 verb( 紧邻 ⇒ plugins.ts 的 :id/preferences 整族漏读被判死)', () => {
  const out = extractApiRegistrations(
    files({
      [ENTRY]: serverTs(
        "import { pluginsRoutes } from './routes/plugins.js'\n" +
          "server.register(pluginsRoutes, { prefix: '/api/plugins' })",
      ),
      'apps/api/src/routes/plugins.ts':
        'export const pluginsRoutes = async (server) => {\n' +
        "  server.patch<{ Body: { pinned: boolean } }>('/:id/preferences', async (req) => req.body)\n" +
        "  server.post<{ Params: { id: string } }>('/:id/click', async (req) => req.params)\n" +
        '}\n',
    }),
  )
  assert.ok(
    hasEntry(out, 'PATCH', '/api/plugins/:id/preferences', 'apps/api/src/routes/plugins.ts'),
    `带泛型的 PATCH 必须进图\nentries: ${JSON.stringify(out.entries)}`,
  )
  assert.ok(
    hasEntry(out, 'POST', '/api/plugins/:id/click', 'apps/api/src/routes/plugins.ts'),
    `带泛型的 POST 必须进图\nentries: ${JSON.stringify(out.entries)}`,
  )
})

// ─── R2 动态 import 挂载边 ────────────────────────────────────────────────
test('R2 动态 import 默认导出解构 ⇒ 边解到目标文件(admin-missing-routes.ts 整族挂载型)', () => {
  const out = extractApiRegistrations(
    files({
      [ENTRY]: serverTs(
        "const { default: adminUsersRoutes } = await import('./routes/admin/users.js')\n" +
          "server.register(adminUsersRoutes, { prefix: '/api/admin' })",
      ),
      'apps/api/src/routes/admin/users.ts':
        'export default async function adminUsersRoutes(server) {\n' +
        "  server.get('/users', async () => null)\n" +
        '}\n',
    }),
  )
  assert.ok(
    hasEntry(out, 'GET', '/api/admin/users', 'apps/api/src/routes/admin/users.ts'),
    `动态 import 的边必须走通到 users.ts\nentries: ${JSON.stringify(out.entries)}`,
  )
  assert.ok(
    !out.undetermined.some((u) => /adminUsersRoutes/.test(u.detail || '')),
    '动态 import 边不得再落 edge-unresolved 兜底档报名',
  )
})

// ─── R3 re-export barrel 追链 ─────────────────────────────────────────────
test('R3 挂载符号顺 re-export barrel 追到定义文件(barrel 无函数声明 ⇒ 整棵子图不得停在 barrel)', () => {
  const out = extractApiRegistrations(
    files({
      [ENTRY]: serverTs(
        "import { vipRoutes } from './routes/index.js'\n" +
          "server.register(vipRoutes, { prefix: '/api' })",
      ),
      'apps/api/src/routes/index.ts': "export { vipRoutes } from './user/vip.js'\n",
      'apps/api/src/routes/user/vip.ts':
        'export const vipRoutes = async (server) => {\n' +
        "  server.get('/vip/benefits', async () => null)\n" +
        '}\n',
    }),
  )
  assert.ok(
    hasEntry(out, 'GET', '/api/vip/benefits', 'apps/api/src/routes/user/vip.ts'),
    `barrel 追链失败时此条只会以 /vip/benefits 落兜底档 ⇒ 带前缀调用被假红\nentries: ${JSON.stringify(out.entries)}`,
  )
})

// ─── R4 正则字面量遮噪级联(agents.ts 实证事故源)──────────────────────────
test('R4 含引号正则不得打乱遮噪:一条 escapeCsv 正则不得让 agentsRoutes 整族丢图', () => {
  const agents = [
    'export const agentsRoutes: FastifyPluginAsync = async (server) => {',
    '  const escapeCsv = (safe: string) => {',
    "    return /[\",\\n]/.test(safe) ? `\"${safe.replace(/\"/g, '\"\"')}\"` : safe",
    '  }',
    '  const url = `https://api.coze.cn/v1/list`',
    "  server.get('/categories/list', async () => url)",
    '}',
    '',
  ].join('\n')
  const out = extractApiRegistrations(
    files({
      [ENTRY]: serverTs(
        "import { agentsRoutes } from './routes/agents.js'\n" +
          "server.register(agentsRoutes, { prefix: '/api' })",
      ),
      'apps/api/src/routes/agents.ts': agents,
    }),
  )
  assert.ok(
    hasEntry(out, 'GET', '/api/categories/list', 'apps/api/src/routes/agents.ts'),
    `agentsRoutes 必须被图走到并带 /api 前缀;丢图时只会以 /categories/list 落 (module) 兜底档\nentries: ${JSON.stringify(out.entries)}`,
  )
})

// ─── R5 空串 localPath ────────────────────────────────────────────────────
test('R5 空串 localPath 挂在节点前缀本身:s.post("", h) ⇒ POST /api/dict/data(admin-sys/dict 族实证)', () => {
  const out = extractApiRegistrations(
    files({
      [ENTRY]: serverTs(
        "import { dictDataRoutes } from './routes/admin-sys/dict-data.js'\n" +
          "server.register(dictDataRoutes, { prefix: '/api/dict/data' })",
      ),
      'apps/api/src/routes/admin-sys/dict-data.ts':
        'export const dictDataRoutes = async (s) => {\n' +
        "  s.get('/list', async () => null)\n" +
        "  s.post('', async () => null)\n" +
        "  s.put('', async () => null)\n" +
        '}\n',
    }),
  )
  assert.ok(hasEntry(out, 'GET', '/api/dict/data/list', 'apps/api/src/routes/admin-sys/dict-data.ts'))
  assert.ok(
    hasEntry(out, 'POST', '/api/dict/data'),
    `空串注册必须落在节点前缀本身\nentries: ${JSON.stringify(out.entries)}`,
  )
  assert.ok(hasEntry(out, 'PUT', '/api/dict/data'))
})

// ─── M 组:maskRegexLiterals 单元正反双向 ─────────────────────────────────
test('M1 含引号正则被遮:内容打空格,定界符/长度/行数不变', () => {
  const code = 'function esc(s: string) {\n  return /[",\\n]/.test(s) ? s : s\n}'
  const masked = maskRegexLiterals(code)
  assert.equal(masked.length, code.length, '遮噪不得改变长度(行号/列号必须原样)')
  assert.equal(masked.split('\n').length, code.split('\n').length)
  assert.ok(masked.includes('/      /'), `正则内容应被打成 6 个空格\nmasked: ${masked}`)
  assert.ok(!masked.includes('["'), '引号不得残留在遮后文本里(否则 maskComments 引号态被带偏)')
})

test('M2 除法不得冒判:标识符/数字/)/]/. 之后的 / 一律不碰', () => {
  const div = [
    'const half = total / 2',
    'const ratio = a / b / c',
    'const avg = (x + y) / 2',
    'const idx = arr[i] / n',
    'const p = obj.key / 2',
  ].join('\n')
  assert.equal(maskRegexLiterals(div), div, '冒判会把真代码遮成空格 —— 只许漏判退回旧行为,不许冒判')
})

test('M3 关键字后的正则计入并吞 flags;不跨行的未闭合 / 按除法处理', () => {
  const kw = 'function f(s: string) {\n  return /ab+/gi.test(s)\n}'
  const masked = maskRegexLiterals(kw)
  assert.ok(masked.includes('/   /gi.test'), `return 后的正则内容须被遮且 flags 保留\nmasked: ${masked}`)
  const un = 'const y = /abc\nnext'
  assert.equal(maskRegexLiterals(un), un, '裸换行未闭合 ⇒ 中止按除法处理(漏判不咬人)')
})

test('M4 注释与字符串整段跳过:其中的 / 不触发正则判定、内容一字不动', () => {
  const safe = [
    "// it's a path / with slash",
    "const s = 'a / b'",
    'const t = "/* not a comment */"',
    'const u = `x / y`',
  ].join('\n')
  assert.equal(maskRegexLiterals(safe), safe)
})

// ─── R7 反向锁:注释里的注册依旧不算 ──────────────────────────────────────
test('R7 反向锁:遮噪管线换序不得破坏 maskComments —— 注释里的 server.get 不算注册', () => {
  const out = extractApiRegistrations(
    files({
      [ENTRY]: serverTs(
        "import { silentRoutes } from './routes/silent.js'\n" +
          "server.register(silentRoutes, { prefix: '/api' })",
      ),
      'apps/api/src/routes/silent.ts':
        'export const silentRoutes = async (server) => {\n' +
        "  // server.get('/fake', async () => null)\n" +
        "  /* server.post('/fake2', async () => null) */\n" +
        "  server.get('/real', async () => null)\n" +
        '}\n',
    }),
  )
  assert.ok(!out.entries.some((e) => e.path === '/api/fake' || e.path === '/api/fake2'))
  assert.ok(hasEntry(out, 'GET', '/api/real'))
})

// ─── L 组:源码形状锁(隐形设计决定必须有牙)─────────────────────────────
const libSrc = readFileSync(new URL('../lib/route-registration-extract.mjs', import.meta.url), 'utf8')

test('L1 形状锁:管线顺序是牙 —— maskRegexLiterals 必须嵌在 maskComments 之内', () => {
  assert.ok(
    libSrc.includes("maskComments(maskRegexLiterals(raw), 'ts')"),
    'analyzeTsFile 首行管线:先遮正则再遮注释;反序时 maskComments 被正则里的引号带偏 ⇒ 级联遮噪 ⇒ 插件族丢图',
  )
  assert.ok(
    !libSrc.includes('maskRegexLiterals(maskComments('),
    '反序形态不得回来(2026-10-22 O87g 实测反序时 escapeCsv 修好了但 agentsRoutes 仍丢)',
  )
})

test('L2 形状锁:泛型动词段 / shaped 空串 / emit 侧空串,三处牙不得被拔', () => {
  assert.ok(libSrc.includes('(?:<[^()]*>)?'), 'VERB_CALL_SRC 的泛型段是 R1 的牙')
  assert.ok(libSrc.includes("arg.value === ''"), 'shaped 判据的空串臂是 R5 的牙(扫描侧)')
  assert.ok(libSrc.includes("v !== '' && !v.startsWith('/')"), 'emit 侧空串放行是 R5 的牙(产出侧,两处必须成对)')
})

// ─── Q 组:嵌套模板插值(G-962 实证,workspace-ai.ts:445 形态)────────────
// 插值里套内层反引号 + 带裸引号的正则 + 三元:旧式 skipQuoted 把内层反引号当闭合 ⇒
// 花括号失衡 ⇒ findTopLevelFunctions bodyEnd=-1 ⇒ 整文件 0 条入图,25 条前端真调用落桶。
const WS_LINE =
  '    return `git ${args.map((a) => (a.includes(\' \') ? `"${a.replace(/"/g, \'\\\\"\')}"` : a)).join(\' \')}`'

test('Q1 skipQuoted 单元:嵌套模板插值(内层反引号/带引号正则/三元)必须解到真正的尾反引号', () => {
  const end = skipQuoted(WS_LINE, WS_LINE.indexOf('`'))
  assert.equal(WS_LINE[end], '`', '返回位必须是反引号')
  assert.equal(end, WS_LINE.length - 1, '闭合位必须是行尾最后一个反引号(旧式停在内层)')
})

test('Q2 全链:嵌套模板之后的注册必须照常入图并带挂载前缀(workspaceAiRoutes 整族丢图锁)', () => {
  const ws = [
    'export const workspaceAiRoutes = async (server) => {',
    '  function buildGitCmd(args: string[]): string {',
    WS_LINE,
    '  }',
    "  server.post('/git/status', async () => null)",
    '}',
    '',
  ].join('\n')
  const out = extractApiRegistrations(
    files({
      [ENTRY]: serverTs(
        "import { workspaceAiRoutes } from './routes/workspace-ai.js'\n" +
          "server.register(workspaceAiRoutes, { prefix: '/api/workspace' })",
      ),
      'apps/api/src/routes/workspace-ai.ts': ws,
    }),
  )
  assert.ok(
    hasEntry(out, 'POST', '/api/workspace/git/status', 'apps/api/src/routes/workspace-ai.ts'),
    `模板失衡时 bodyEnd=-1 ⇒ 插件函数整个被 findTopLevelFunctions 静默丢弃\nentries: ${JSON.stringify(out.entries)}`,
  )
})

// ─── P 组:FastAPI 前缀拼接(G-962 实证,connectors/computer-use/cost-ledger 形态)──
test('P1 py 拼接:include /api ⊕ 文件内 /computer-use ⇒ /api/computer-use/*(旧「二选一」判真挂载链为死)', () => {
  const out = __test__.extractFastApiRegistrations(
    files({
      'apps/ai-service/app/main.py': 'app.include_router(computer_use.router, prefix="/api")\n',
      'apps/ai-service/app/routers/computer_use.py':
        "from fastapi import APIRouter\nrouter = APIRouter(prefix='/computer-use')\n@router.get('/sessions')\nasync def h():\n    return {}\n",
    }),
  )
  assert.ok(
    out.entries.some((e) => e.method === 'GET' && e.path === '/api/computer-use/sessions'),
    `FastAPI 真实路径 = include 前缀 + 自有前缀 + localPath\nentries: ${JSON.stringify(out.entries)}`,
  )
})

test('P2 防双 /api:文件内 prefix 已含 /api ⇒ 不叠 include 前缀', () => {
  const out = __test__.extractFastApiRegistrations(
    files({
      'apps/ai-service/app/main.py': 'app.include_router(checkin.router, prefix="/api")\n',
      'apps/ai-service/app/routers/checkin.py':
        "from fastapi import APIRouter\nrouter = APIRouter(prefix='/api/checkin')\n@router.get('/summary')\nasync def h():\n    return {}\n",
    }),
  )
  assert.ok(
    out.entries.some((e) => e.path === '/api/checkin/summary'),
    `自有前缀已含 /api 时取 Q 不叠 P\nentries: ${JSON.stringify(out.entries)}`,
  )
  assert.ok(!out.entries.some((e) => e.path.startsWith('/api/api/')), '双 /api 形态不得出现')
})

test('P3 二级聚合器(killer_extras 型 include 行不在 main.py)+ 模块别名(browser_hub_router 型)都解到挂载前缀', () => {
  const out = __test__.extractFastApiRegistrations(
    files({
      'apps/ai-service/app/main.py':
        'from app.routers import browser_hub as browser_hub_router\napp.include_router(browser_hub_router.router, prefix="/api")\n',
      'apps/ai-service/app/routers/killer_extras.py':
        "from . import cost_ledger\napp.include_router(cost_ledger.router, prefix='/api')\ndef register(app):\n    pass\n",
      'apps/ai-service/app/routers/cost_ledger.py':
        "from fastapi import APIRouter\nrouter = APIRouter(prefix='/cost-ledger')\n@router.get('/summary')\nasync def h():\n    return {}\n",
      'apps/ai-service/app/routers/browser_hub.py':
        "from fastapi import APIRouter\nrouter = APIRouter(prefix='/browser-hub')\n@router.get('/tools')\nasync def h():\n    return {}\n",
    }),
  )
  assert.ok(
    out.entries.some((e) => e.path === '/api/cost-ledger/summary'),
    `二级聚合器文件里的 include 行必须进挂载面(旧式只读 main.py 整族失明)\nentries: ${JSON.stringify(out.entries)}`,
  )
  assert.ok(
    out.entries.some((e) => e.path === '/api/browser-hub/tools'),
    `include 键是模块别名时也必须解到文件\nentries: ${JSON.stringify(out.entries)}`,
  )
})

test('P4 py 反向锁:注释里的假 include 不得参与拼接;无 prefix 的 include 不得叠不相干前缀', () => {
  const out = __test__.extractFastApiRegistrations(
    files({
      'apps/ai-service/app/main.py':
        '# app.include_router(ghost.router, prefix="/api")\n' +
        'from app.routers import plain\napp.include_router(plain.router)\n',
      'apps/ai-service/app/routers/ghost.py':
        "from fastapi import APIRouter\nrouter = APIRouter(prefix='/ghost')\n@router.get('/x')\nasync def h():\n    return {}\n",
      'apps/ai-service/app/routers/plain.py':
        "from fastapi import APIRouter\nrouter = APIRouter(prefix='/plain')\n@router.get('/y')\nasync def h():\n    return {}\n",
    }),
  )
  assert.ok(
    !out.entries.some((e) => e.path === '/api/ghost/x'),
    `注释假 include 若被当挂载边,会把 /ghost/x 拼成 /api/ghost/x(假路径入面=假绿源)\nentries: ${JSON.stringify(out.entries)}`,
  )
  assert.ok(
    out.entries.some((e) => e.path === '/plain/y'),
    `include 不带 prefix ⇒ 自有前缀原样,不得叠任何东西\nentries: ${JSON.stringify(out.entries)}`,
  )
})

// ─── F 组:deferredTemplate(O87g 先决①,registerCrud 族 :id 腿整族隐身实证)──
const SHARED_REL = 'apps/api/src/routes/_shared.ts'
const CRUD_SHARED = [
  'export function registerCrud(server, basePath, table, opts) {',
  '  server.get(basePath, async () => null)',
  '  server.get(`${basePath}/:id`, async () => null)',
  '  server.put(`${basePath}/:id`, async () => null)',
  '  server.delete(`${basePath}/:id`, async () => null)',
  '}',
  '',
].join('\n')

test('F1 deferredTemplate 正例:工厂体 `${basePath}/:id` 腿必须在调用点按实参代入入图(旧式 shaped 静默丢 ⇒ 整族 45 条隐身)', () => {
  const out = extractApiRegistrations(
    files({
      [ENTRY]: serverTs(
        "import { consoleRoutes } from './routes/console.js'\n" +
          "server.register(consoleRoutes, { prefix: '/api/admin' })",
      ),
      [SHARED_REL]: CRUD_SHARED,
      'apps/api/src/routes/console.ts':
        "import { registerCrud } from './_shared.js'\n" +
        'export const consoleRoutes = async (server) => {\n' +
        "  registerCrud(server, '/courses', {}, {})\n" +
        '}\n',
    }),
  )
  const factoryVia = (e) => String(e.via || '').startsWith('factory:')
  assert.ok(
    out.entries.some((e) => e.method === 'GET' && e.path === '/api/admin/courses' && factoryVia(e)),
    `bare 形参腿 basePath 必须代入 '/courses'(via 须标 factory 溯源)\nentries: ${JSON.stringify(out.entries)}`,
  )
  for (const m of ['GET', 'PUT', 'DELETE']) {
    assert.ok(
      out.entries.some(
        (e) => e.method === m && e.path === '/api/admin/courses/:id' && factoryVia(e),
      ),
      `${m} 模板 :id 腿必须经工厂调用点代入入图\nentries: ${JSON.stringify(out.entries)}`,
    )
  }
})

test('F2 deferredTemplate 反向锁:调用点解不出的 `${x}` 模板必须落 undetermined 报名,不得静默丢也不得造条目', () => {
  const out = extractApiRegistrations(
    files({
      [ENTRY]: serverTs(
        "import { consoleRoutes } from './routes/console.js'\n" +
          "server.register(consoleRoutes, { prefix: '/api/admin' })",
      ),
      [SHARED_REL]: CRUD_SHARED,
      'apps/api/src/routes/console.ts':
        "import { registerCrud } from './_shared.js'\n" +
        'export const consoleRoutes = async (server) => {\n' +
        '  registerCrud(server, pickBase(), {}, {})\n' +
        '}\n',
    }),
  )
  assert.ok(
    !out.entries.some((e) => /\$\{|pickBase/.test(e.path)),
    '解不出的模板绝不许带 "${" 入图\nentries: ' + JSON.stringify(out.entries),
  )
  assert.ok(
    out.undetermined.some((u) => /factory|模板|deferred|pickBase/i.test(`${u.kind} ${u.detail}`)),
    `工厂路径实参不可解必须逐条报名(三态纪律:看不见≠没有)\nundetermined: ${JSON.stringify(out.undetermined)}`,
  )
})

test('F3 deferredTemplate 反向锁(非工厂上下文):普通插件里以 `${` 开头且无常量可解的模板注册必须报名,不得回到修复前的静默丢', () => {
  const out = extractApiRegistrations(
    files({
      [ENTRY]: serverTs(
        "import { looseRoutes } from './routes/loose.js'\n" +
          "server.register(looseRoutes, { prefix: '/api' })",
      ),
      'apps/api/src/routes/loose.ts':
        'export const looseRoutes = async (server) => {\n' +
        '  server.get(`${dynamic}/:id`, async () => null)\n' +
        '}\n',
    }),
  )
  assert.ok(
    !out.entries.some((e) => e.path.includes('${') || e.path === '/:id'),
    `不可解模板不得造出畸形条目\nentries: ${JSON.stringify(out.entries)}`,
  )
  assert.ok(
    out.undetermined.some((u) => /:id|dynamic|模板/.test(`${u.kind} ${u.detail}`)),
    `修复前的病灶正是"shaped=false ⇒ 整条静默丢弃";报名是它唯一的合法出口\nundetermined: ${JSON.stringify(out.undetermined)}`,
  )
})
// ─── K1 无花括号箭头函数作用域(G-962,2026-10-22 实证)────────────────────
// 病根:findTopLevelFunctions 旧式一律 indexOf('{') 找体起点,`const f = (x) => expr`
// 于是把下一个函数的花括号当自己的体 ⇒ 插件体内紧随其后的注册被 enclosingFn 归给该
// 辅助箭头函数(图上走不到)⇒ 落 via=fallback 裸路径,前端带前缀的真调用永判不死不活
// (apps/api/src/routes/workspace-permissions.ts:210 GET /permission-default 实证:
// readWireMode 单行箭头吞掉 L210 注册 ⇒ 前端 GET /api/workspace/permission-default 落桶)。
test('K1 无花括号箭头函数不得吞后续注册:紧随的 server.get 归插件函数、带前缀入图', () => {
  const out = extractApiRegistrations(
    files({
      [ENTRY]: serverTs(
        "import { wspRoutes } from './routes/wsp.js'\n" +
          "server.register(wspRoutes, { prefix: '/api/workspace' })",
      ),
      'apps/api/src/routes/wsp.ts':
        'export const wspRoutes = async (server) => {\n' +
        '  const readWireMode = (raw: unknown): string | null => permissionModeWire(raw)\n' +
        "  server.get('/permission-default', async () => null)\n" +
        '}\n',
    }),
  )
  assert.ok(
    hasEntry(out, 'GET', '/api/workspace/permission-default', 'apps/api/src/routes/wsp.ts'),
    `注册必须带挂载前缀入图(修前落 fallback 裸路径 /permission-default)\nentries: ${JSON.stringify(out.entries)}`,
  )
  assert.ok(
    !out.entries.some((e) => e.path === '/permission-default'),
    `不得再产出无前缀的 fallback 裸路径\nentries: ${JSON.stringify(out.entries)}`,
  )
})

// 防过度收紧:无花括号箭头函数**自身**不得被当成注册宿主 —— 表达式体里若真有注册调用
// (反模式,但形态合法),它仍应被抽出(归到箭头函数名下,走 fallback 口径),不得整条消失。
test('K1b 防过度收紧:表达式体内出现的注册形态仍要抽出,不得随作用域收窄一起消失', () => {
  const out = extractApiRegistrations(
    files({
      [ENTRY]: serverTs(
        "import { oneRoutes } from './routes/one.js'\n" +
          "server.register(oneRoutes, { prefix: '/api' })",
      ),
      'apps/api/src/routes/one.ts':
        'export const oneRoutes = async (server) => {\n' +
        "  const reg = (s) => s.get('/inline-expr', async () => null)\n" +
        '  reg(server)\n' +
        '}\n',
    }),
  )
  assert.ok(
    out.entries.some((e) => e.path.includes('inline-expr')),
    `表达式体里的注册不得整条静默丢\nentries: ${JSON.stringify(out.entries)}`,
  )
})
// ─── R8 bare 标识符注册(G-962 批1,2026-10-22 github-app.ts:266/277/302 实证)─────────
// 病根:`server.get(HEALTH_PATH, …)`(同文件 export const 单引号常量)整族落 identifier-path 桶 ⇒
// 精确图无这三条,前端真打的 GET /api/github-app/installations 在册路由反被台账代裁误判死。
// 修复口径:先查 pathConsts(与模板串展开同一份),解不到退工厂调用点同款绑定正则(认双引号/
// 反引号/类型注记);解到按 literal 同守卫产出,解不到仍逐条报名 —— 运行时变量/成员表达式/
// 带括号实参一律不冒判(实测全仓 11 条此类一条不吞)。
test('R8 bare 常量注册带挂载前缀入图:同文件常量 + 多行带 options 第二实参(github-app 三型)', () => {
  const out = extractApiRegistrations(
    files({
      [ENTRY]: serverTs(
        "import { ghRoutes } from './routes/github-app.js'\n" +
          "server.register(ghRoutes, { prefix: '/api/github-app' })",
      ),
      'apps/api/src/routes/github-app.ts':
        "export const HEALTH_PATH = '/health'\n" +
        "export const INSTALLATIONS_PATH = '/installations'\n" +
        "export const WEBHOOK_PATH = '/webhook'\n" +
        'export const ghRoutes = async (server) => {\n' +
        '  server.get(HEALTH_PATH, async () => null)\n' +
        '  server.get(\n' +
        '    INSTALLATIONS_PATH,\n' +
        '    { preHandler: adminGuard },\n' +
        '    async (req, reply) => reply.status(200).send(null),\n' +
        '  )\n' +
        '  server.post(WEBHOOK_PATH, async () => null)\n' +
        '}\n',
    }),
  )
  assert.ok(
    hasEntry(out, 'GET', '/api/github-app/health', 'apps/api/src/routes/github-app.ts'),
    `单行 bare 常量必须代入入图并带挂载前缀\nentries: ${JSON.stringify(out.entries)}`,
  )
  assert.ok(
    hasEntry(out, 'GET', '/api/github-app/installations', 'apps/api/src/routes/github-app.ts'),
    `多行调用 + options 对象第二实参不得挡住首参解析(277 实形)\nentries: ${JSON.stringify(out.entries)}`,
  )
  assert.ok(
    hasEntry(out, 'POST', '/api/github-app/webhook', 'apps/api/src/routes/github-app.ts'),
    `POST bare 常量同样必须入图\nentries: ${JSON.stringify(out.entries)}`,
  )
  assert.ok(
    !out.undetermined.some(
      (u) => u.kind === 'identifier-path' && /HEALTH_PATH|INSTALLATIONS_PATH|WEBHOOK_PATH/.test(u.detail || ''),
    ),
    `解到定值的常量不得再落 identifier-path 报名\nundetermined: ${JSON.stringify(out.undetermined)}`,
  )
})

test('R8b 反向锁:运行时变量/成员表达式/带括号实参仍逐条报名,不得被常量代入冒判吞进图', () => {
  const out = extractApiRegistrations(
    files({
      [ENTRY]: serverTs(
        "import { looseRoutes } from './routes/loose.js'\n" +
          "server.register(looseRoutes, { prefix: '/api' })",
      ),
      'apps/api/src/routes/loose.ts':
        'export const looseRoutes = async (server) => {\n' +
        '  const key = redisKey(userId)\n' +
        '  server.get(key, async () => null)\n' +
        '  server.get(PATHS.health, async () => null)\n' +
        '  server.get(indexKey(owner), async () => null)\n' +
        '}\n',
    }),
  )
  for (const frag of ['key', 'PATHS.health', 'indexKey']) {
    assert.ok(
      out.undetermined.some((u) => u.kind === 'identifier-path' && (u.detail || '').includes(frag)),
      `${frag} 静态解不到必须仍报名(报数不报名=把这格锁死)\nundetermined: ${JSON.stringify(out.undetermined)}`,
    )
  }
  assert.equal(
    out.entries.filter((e) => e.file === 'apps/api/src/routes/loose.ts').length,
    0,
    `报名档三条一条都不许被冒判成注册条目\nentries: ${JSON.stringify(out.entries)}`,
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
