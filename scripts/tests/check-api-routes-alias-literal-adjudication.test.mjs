// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试:守门 8(check-api-routes)「未判定(改写前缀字面量)」那一格从**无归属**收口为**逐条有判据**
//
// 病根(2026-10-04 实测):这一格原先只把站点**列出来**,既不说每处属哪一型、也不说能不能静态判,
// 于是它在读数里"看得见名字、看不见归属"—— 与既有的「未判定(有传输口却抽不出路径)」桶并列,
// 却没有归属、没人负责;措辞里"这一格没有判据"是实情。
//
// 本票做两件事,**都不新增判红路径**(§12e):
//  ① 给每处站点加 `kind`(前缀常量声明/路径片段/真调用点)+ `adjudicable`(能不能判)+ 逐条依据;
//  ② 对**可判**的那几处,把"归一后路径在后端在册与否"一并算出来报名(与主对账共用 backendHasRoute)。
//
// **取材扩展已被实测否证,所以本票不扩面**:把这类字面量抽进调用集会让死调用 0→4,
// 而那 4 条**全是误报**(误报率 100%):WS 四条归一后是"谁都没发过的路径"
// (buildWsUrl 不过 normalizeUrl,后端亦用裸 /cozeZhsApi 注册),另两条真错但归因不同。
// 误报率 100% ⇒ 不扩面(守门 skill §3b:形态可疑 ≠ 形态异常,先找反例)。
//
// 覆盖面(每条都盯住一种"修过头/修漏/静默失效"的方向):
//   T1 三型各自归入正确的类,且**逐条可判的都在输出里被点名**(不许再"既不判死也不落桶")
//   T2 防过度收紧:不属这一形态的路径**不得**被吸进这个桶(仓里满是普通 `/api/` 调用)
//   T3 可判型的"归一后路径在册与否"必须真的算出来(在册/不在册两向都要能区分)
//   T4 源码锁:分类判据的入口不得被静默删掉(退回"只列名字"⇒ T1/T3 翻红)
//   T5 死调用读数**逐条不变**(本票只报名不判死;判红路径一条都不许新增)
//
// 不重写判据实现(重写就是第二份真相,会跟着源一起漂绿);只锁"装上了 / 有牙 / 不静默 / 不过度"。
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
  const dir = mkScratch('ihui-api-routes-alias-adj-')
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

/**
 * 改写档的**唯一事实源**是 transport 的 `normalizeUrl` 函数体(门内不得有第二张前缀表)。
 * 临时根里必须铺这个文件,否则 `readUrlAliasRules` 读不出前缀集合,这一格会走成
 * 「改写档本身读不出」的第三态 —— 那样测的就不是分类,而是"前提缺失"(实测踩过:T1 5 条全红在
 * `未判定 …… 改写档本身读不出`,不是红在分类上)。写法照抄生产 client.ts:458-464 的形态。
 */
function seedAliasSource(dir) {
  put(
    dir,
    'packages/api-client/src/client.ts',
    [
      'export function normalizeUrl(url: string, useStreamBase = false): string {',
      "  if (/^https?:\\/\\//i.test(url)) return url",
      '  const normalized = (() => {',
      "    if (url.startsWith('/api/') || url.startsWith('/uploads/') || url.startsWith('/ws/'))",
      '      return url',
      "    if (url.startsWith('/cozeZhsApi')) {",
      "      return url.replace(/^\\/cozeZhsApi/, '/api')",
      '    }',
      '    return url',
      '  })()',
      '  return normalized',
      '}',
      '',
    ].join('\n'),
  )
}

/** 某一端「死调用」总数(读死调用自己的行,不用调用点数代替 —— 两者不是一回事)。
 *  注意:零容忍端(web)死调用为 0 时**不打印**那一行,读不到行就是 0。 */
function deadCalls(out, end) {
  const m = out.match(new RegExp(`· ${end}:死调用 (\\d+) 处`))
  return m ? Number(m[1]) : 0
}
/** 「未判定(改写前缀字面量)」那一整段(表头行 + 逐条 + 可能有的尾巴说明) */
function aliasSection(out) {
  const lines = out.split('\n')
  const i = lines.findIndex((l) => l.includes('未判定(改写前缀字面量'))
  if (i < 0) throw new Error(`输出里没有「未判定(改写前缀字面量)」这一格\n${out}`)
  const seg = [lines[i]]
  for (let k = i + 1; k < lines.length; k++) {
    if (!/^ {4}\S/.test(lines[k])) break // 逐条都是 4 空格缩进
    seg.push(lines[k])
  }
  return seg.join('\n')
}
/** 这一格里逐条点名的站点(只取带 file:line 的那些行) */
function aliasEntries(out) {
  return aliasSection(out)
    .split('\n')
    .filter((l) => /:\d+\s/.test(l))
    .map((l) => l.trim())
}

// ─── T1 三型各自归类,且逐条都被点名 ───
// 复刻本仓 HEAD 面三处真实现场(形态照抄,路径改成夹具值):
//   ① apps/web/src/config/backend-paths.ts:10  `const COZE = '/cozeZhsApi'`  ⇒ 前缀常量声明
//   ② apps/web/src/hooks/use-ai-websocket.ts:15 `qwen: '/cozeZhsApi/ws/…'`   ⇒ 片段/表项(无传输口)
//   ③ packages/api-client/src/endpoints/agent.ts:97 `fetchApi('/cozeZhsApi/cache/…')` ⇒ 真调用点
// 后端注册 `/api/ws/qwen/stream` 与 `/api/cache/…` 各一条,好让 T3 能区分在册/不在册。
test('T1 三型各自归类(前缀常量声明/路径片段/真调用点)且逐条被点名', () => {
  const dir = root()
  try {
    put(dir, 'scripts/api-routes-baseline.json', BASELINE)
    seedAliasSource(dir)
    put(dir, 'apps/api/src/routes/x.ts', "server.get('/api/ok', async () => ({}))\n")
    // ① 前缀常量声明:整行只有"前缀 = 字面量",**后面没有续段** ⇒ 不是一条路径
    put(
      dir,
      'apps/web/src/config/paths.ts',
      ["const COZE = '/cozeZhsApi'", "export const P = { login: `${COZE}/login` }", ''].join('\n'),
    )
    // ② 路径片段/表项:是条路径但**本行没有传输口** ⇒ 片段,真调用在别处
    put(
      dir,
      'apps/web/src/hooks/ws.ts',
      [
        'export const PROVIDER_PATHS = {',
        "  qwen: '/cozeZhsApi/ws/qwen/stream',",
        '}',
        "export function pick(p: string) { return p }",
        '',
      ].join('\n'),
    )
    // ③ 真调用点:本行有传输口
    put(
      dir,
      'packages/api-client/src/endpoints/agent.ts',
      [
        "import { fetchApi } from '@ihui/api-client'",
        'export async function getDict() {',
        "  return fetchApi<unknown>('/cozeZhsApi/cache/dict')",
        '}',
        '',
      ].join('\n'),
    )
    const r = run(dir, ['--warn-only'])
    assert.equal(r.status, 0, `本用例不该判红\n${r.out}`)
    const sec = aliasSection(r.out)
    const entries = aliasEntries(r.out)
    assert.equal(entries.length, 3, `三处站点都必须在这一格里被逐条点名\n${sec}`)

    // 逐条断言"哪一型" —— 这是本票的核心:不许再只有路径没有归属。
    // 行号按**夹具**数(临时根里没有仓里那 8 行水印/import 头,前缀声明落在第 1 行)。
    const decl = entries.find((e) => e.includes('paths.ts:1'))
    assert.ok(decl, `前缀常量声明那处必须被点名\n${sec}`)
    assert.match(decl, /前缀常量声明/, `① 应判为前缀常量声明(它不是一次请求)\n${sec}`)
    assert.match(decl, /不可判/, `① 不可判(归一后只是前缀,不是路径)\n${sec}`)

    const frag = entries.find((e) => e.includes('ws.ts:2'))
    assert.ok(frag, `片段那处必须被点名\n${sec}`)
    assert.match(frag, /路径片段/, `② 应判为路径片段/表项(本行无传输口)\n${sec}`)
    assert.match(frag, /不可判/, `② 不可判(WS 出口不过 normalizeUrl,改写不成立)\n${sec}`)

    const call = entries.find((e) => e.includes('agent.ts:3'))
    assert.ok(call, `真调用点那处必须被点名\n${sec}`)
    assert.match(call, /真调用点/, `③ 应判为真调用点(本行有传输口)\n${sec}`)
    assert.match(call, /可判/, `③ 可判(归一后路径即运行期真实 URL)\n${sec}`)

    // 表头必须报出"可判/不可判"的分布,而不是只报一个总数
    assert.match(sec, /可判 1 处 \/ 不可判 2 处/, `表头须报可判分布\n${sec}`)
  } finally {
    rmScratch(dir)
  }
})

// ─── T2 防过度收紧:不属这一形态的路径**不得**被吸进这个桶 ───
// 这一格若实现成"扫描面里凡是有点像前缀的就报",就会把仓里绝大多数普通 `/api/` 调用
// 全吸进来(实测本仓 2,752 个调用点)。本用例在**同一个文件**里并存:
//   一条普通 `/api/` 调用 + 一处改写前缀字面量 ⇒ 只有后者进这个桶。
// 同文件是关键:取材是逐行判的,分落两个文件时"按文件跳过"这种过度修法也能让各自通过。
test('T2 防过度收紧:普通 /api/ 调用不得被吸进改写前缀这一桶', () => {
  const dir = root()
  try {
    put(dir, 'scripts/api-routes-baseline.json', BASELINE)
    seedAliasSource(dir)
    put(dir, 'apps/api/src/routes/x.ts', "server.get('/api/agents/list', async () => ({}))\n")
    put(
      dir,
      'apps/web/src/mixed.ts',
      [
        "import { fetchApi } from '@ihui/api-client'",
        'export function real() {',
        "  return fetchApi('/api/agents/list')",
        '}',
        'export function aliased() {',
        "  return fetchApi('/cozeZhsApi/agents/list')",
        '}',
        '',
      ].join('\n'),
    )
    const r = run(dir, ['--warn-only'])
    assert.equal(r.status, 0, `后端已注册 ⇒ 不得判红\n${r.out}`)
    const entries = aliasEntries(r.out)
    assert.equal(
      entries.length,
      1,
      `只有改写前缀那一条该进这个桶;普通 /api/ 调用被吸进来就是过度收紧\n${r.out}`,
    )
    assert.match(entries[0], /mixed\.ts:6/, `进桶的应是改写前缀那条(mixed.ts:6)\n${r.out}`)
    // 反向:普通那条必须仍在调用集里正常对账(没被顺手剔掉)
    assert.doesNotMatch(
      r.out,
      /agents\/list[^\n]*未判定\(改写前缀/,
      `普通 /api/ 调用不得出现在改写前缀这一格里\n${r.out}`,
    )
  } finally {
    rmScratch(dir)
  }
})

// ─── T3 可判型必须真的算出"归一后路径在册与否"(两向都可区分) ───
// 只报名不判死,但**报名必须是真的**:如果 `registered` 恒为 undefined 或恒 false,
// 这一格就成了新的"静默"—— 那与本票要修的病同型。
// 本用例给两条真调用点:一条归一后**在册**、一条**不在册**,要求输出能把两者区分开。
test('T3 可判型逐条算出归一后路径的在册与否(在册/不在册两向可区分)', () => {
  const dir = root()
  try {
    put(dir, 'scripts/api-routes-baseline.json', BASELINE)
    seedAliasSource(dir)
    // 组合前缀的事实源是 `apps/api/src/server.ts` 顶层的 `{ prefix: '/api' }`;
    // 不铺它 ⇒ 组合前缀 0 个 ⇒ 只剩裸 localPath,`/api/agents/list` 永远查不到在册
    // (实测踩过:注册面 1 条、组合前缀 0 个,T3 红在"在册"那一向而不是红在逻辑上)。
    put(dir, 'apps/api/src/server.ts', "void register({ prefix: '/api' })\n")
    // 后端**只**注册 /api/agents/list(POST),故意不给 /api/cache/dict
    put(
      dir,
      'apps/api/src/routes/agents.ts',
      "server.post('/agents/list', async () => ({}))\n",
    )
    put(
      dir,
      'apps/web/src/calls.ts',
      [
        "import { fetchApi } from '@ihui/api-client'",
        'export async function hit() {',
        "  return fetchApi<unknown>('/cozeZhsApi/agents/list', { method: 'POST' })",
        '}',
        'export async function miss() {',
        "  return fetchApi<unknown>('/cozeZhsApi/cache/dict')",
        '}',
        '',
      ].join('\n'),
    )
    const r = run(dir, ['--warn-only'])
    assert.equal(r.status, 0, `本轮按 §12e 不判红,退出码须为 0\n${r.out}`)
    const entries = aliasEntries(r.out)
    assert.equal(entries.length, 2, `两条真调用点都要被点名\n${r.out}`)
    const hit = entries.find((e) => e.includes('calls.ts:3'))
    const miss = entries.find((e) => e.includes('calls.ts:6'))
    assert.ok(hit && miss, `两条都要逐条点名\n${r.out}`)
    assert.match(hit, /后端在册/, `归一后 /api/agents/list 在册(POST 已注册)\n${r.out}`)
    assert.match(miss, /后端\*\*不在册\*\*/, `归一后 /api/cache/dict 不在册(后端没注册)\n${r.out}`)
    // 不在册的那几条必须**另起一句**点名"这是 404 风险、只是不判红"——
    // 少这句,读者会把"不判红"读成"没关系"。
    const sec = aliasSection(r.out)
    assert.match(sec, /404 风险/, `不在册的站点必须被明确标成 404 风险(不判红 ≠ 没关系)\n${sec}`)
  } finally {
    rmScratch(dir)
  }
})

// ─── T4 源码锁:分类判据的入口不得被静默删掉 ───
// 退回"只列名字、不分类"时 T1/T3 会一起翻红;但那两处红是**间接**的(依赖读输出),
// 这里再加一道直接锁:判据函数、分类调用点、以及"为何不扩面"的否证理由都必须还在源码里。
test('T4 源码锁:分类判据入口与"不扩面"的否证理由不得被静默删掉', () => {
  assert.match(
    SRC,
    /function classifyAliasLiteralSite\(/,
    '必须保留 classifyAliasLiteralSite 判据(否则 T1 翻红成"只有名字没有归属"的静默)',
  )
  // 判据必须在取材处被真正消费,而不是只定义不用
  assert.match(
    SRC,
    /const cls = classifyAliasLiteralSite\(line, raw, rule\)/,
    'collectAliasLiteralBlindSites 必须消费该判据(定义即用,不许留一个死函数)',
  )
  // 三个 kind 值逐个钉住:少一个就有一型退回"无名"
  for (const kind of ['prefixConstant', 'pathFragment', 'callSite']) {
    assert.ok(SRC.includes(`'${kind}'`), `分类缺了 ${kind} 这一型`)
  }
  // 三型的依据都要在(少一条就有型变成"没判据")
  for (const reason of [
    '这一行是**前缀常量声明本身**',
    '本行无传输口 ⇒ 是路径片段/表项',
    '本行有传输口 ⇒ 真调用点',
  ]) {
    assert.ok(SRC.includes(reason), `缺少这一型的判据说明:${reason}`)
  }
  // 共享的传输口判据必须**只有一份**(两处各抄一遍必然漂移)
  const transportDefs = SRC.match(/const LINE_TRANSPORT_RE\s*=/g) || []
  assert.equal(
    transportDefs.length,
    1,
    `LINE_TRANSPORT_RE 出现了 ${transportDefs.length} 处定义 —— 必须文件级唯一,否则两处消费者会漂移`,
  )
  // 否证理由必须留着(否则下一个人会当成分疏漏顺手把取材扩了面)
  assert.match(
    SRC,
    /取材扩展:\*\*实测否证\*\*/,
    '缺少"取材扩展已实测否证"的注释 —— 后人会把死调用 0→4 那 4 条误报重新引进来',
  )
  assert.match(
    SRC,
    /误报率 100%/,
    '缺少误报率结论 —— 这是"不扩面"的唯一依据,必须留在源码里',
  )
  // 措辞纪律:本格的**运行时措辞**不得再宣称"没有判据"(本票已逐条给出判据,留着就是失效措辞)。
  // ⚠️ 只锁"紧跟在这一格标记之后的那句",不要全文件搜这六个字 ——
  //   别的桶(枚举失效那档,见 check-api-routes.mjs 的 faceEmptyEnds)说"本轮对这一格没有判据"
  //   是**它自己**的正确措辞,一锅端会把无关判据的合法输出判红(实测踩过)。
  const aliasBlock = SRC.slice(SRC.indexOf("未判定(改写前缀字面量"))
  assert.doesNotMatch(
    aliasBlock,
    /但这一格\*\*没有判据\*\*/,
    '本格的运行时措辞仍宣称"没有判据" —— 本票已逐条给出判据,这句已失效必须改掉',
  )
})

// ─── T5 死调用读数逐条不变,且退出码为 0(不新增判红路径) ───
// 本票只让这一格"有归属、有判据",**不得**让任何"死调用 0 处"的判定发生变化(§12e)。
// 注意:这里刻意**不**用"调用点数"当判据 —— 本票没改取材,调用点数理应不变,
// 但真正要钉的是死调用读数与退出码(那才是"有没有新增判红路径"的直接证据)。
test('T5 死调用读数不变、退出码 0(本票不新增任何判红路径)', () => {
  const dir = root()
  try {
    put(dir, 'scripts/api-routes-baseline.json', BASELINE)
    seedAliasSource(dir)
    // 故意**不注册**任何被调用的路径 ⇒ 归一后那几条在册面全无;
    // 若本票偷偷把它们放进了死调用桶,web/api-client 的读数会从 0 变正数 ⇒ 这里立刻红。
    put(dir, 'apps/api/src/routes/x.ts', "server.get('/api/unrelated', async () => ({}))\n")
    put(
      dir,
      'apps/web/src/calls.ts',
      [
        "import { fetchApi } from '@ihui/api-client'",
        'export async function gone() {',
        "  return fetchApi<unknown>('/cozeZhsApi/definitely/missing')",
        '}',
        '',
      ].join('\n'),
    )
    const r = run(dir, ['--warn-only'])
    assert.equal(r.status, 0, `本票不判红,退出码须为 0(§12e)\n${r.out}`)
    assert.equal(deadCalls(r.out, 'web'), 0, `web 死调用读数不得因本票变化\n${r.out}`)
    assert.equal(deadCalls(r.out, 'api-client'), 0, `api-client 死调用读数不得因本票变化\n${r.out}`)
    assert.doesNotMatch(
      r.out,
      /发现 \d+ 处前端调用无后端路由/,
      `不得出现 web 判红块(本票只报名)\n${r.out}`,
    )
    // 但那一处**必须**出现在未判定格里(报名的意义就在这里)
    assert.match(
      aliasSection(r.out),
      /calls\.ts:3/,
      `归一后不在册的那处必须仍在未判定格里被点名\n${r.out}`,
    )
  } finally {
    rmScratch(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
