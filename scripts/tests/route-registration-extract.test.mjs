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

import { extractApiRegistrations, maskRegexLiterals, __test__ } from '../lib/route-registration-extract.mjs'

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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
