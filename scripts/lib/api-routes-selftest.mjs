// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * check-api-routes 的 --self-test 判据自测体(从 check-api-routes.mjs 抽出,守门 103 C1;行为与原文逐字同形)。
 * 事实常量与判据函数由主文件经 deps 注入,本文件不持有第二份真相。
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { mkScratch, rmScratch } from './scratch-dir.mjs'
import { expandTemplatedRoutes } from './api-route-registration-expand.mjs'
import { classifyRouteCoverage } from './route-registration-extract.mjs'

function runSelfTestSuite(deps) {
  const { HERE, BASELINE_FILE_REL, CHANNEL_EQUIV_BASELINE_REL, CLIENT_TRANSPORT_FILE, BARE_LEG_BASELINE_REL, readUrlAliasRules, classifyBareLiteral, classifyBareLegVerdict } = deps// --self-test:判据有效性自查(2026-09-22 模板串展开配套)。
// 铁律:结果必须反映在**真实退出码**上(失败 exit 1),不允许"打印 FAIL 却 exit 0"。
const SELF_MATRIX_FIXTURE = [
  'const VENDOR_MATRIX = [',
  "  { vendor: 'zhipu', chat: true, embeddings: true, images: true },",
  "  { vendor: 'deepseek', chat: true, embeddings: false, images: false },",
  ']',
  'export async function vendorRoutes(server) {',
  '  for (const cap of VENDOR_MATRIX) {',
  '    const vendor = cap.vendor',
  '    server.get(`/${vendor}/models`, async () => ({}))',
  '    if (cap.chat) {',
  '      server.post(`/${vendor}/chat`, async () => ({}))',
  '    }',
  '    if (cap.images) {',
  '      server.post(`/${vendor}/images`, async () => ({}))',
  '    }',
  '    if (canUse(vendor)) {',
  '      server.post(`/${vendor}/secret`, async () => ({}))',
  '    }',
  '  }',
  '}',
].join('\n')

/** 建临时 monorepo 根(供 --self-test 端到端跑真实退出码) */
function makeSelfTestRoot(files) {
  const dir = mkScratch('ihui-api-routes-self-')
  for (const [rel, content] of Object.entries(files)) {
    const full = join(dir, ...rel.split('/'))
    mkdirSync(dirname(full), { recursive: true })
    writeFileSync(full, content)
  }
  return dir
}

/**
 * 跑本脚本自身一次,返回 { status, out(去 ANSI) }。
 * 夹具经**显式 `--root` + `--worktree`** 通道进入(2026-09-26):ROOT 由脚本自身位置推导后,
 * "只靠 cwd 定位夹具"的调用形态结构上失效 —— 13 例里 11 例其实在审真仓、账面全绿而结论与夹具无关
 * (守门 70 / 13c 同型事故)。`--worktree` 是夹具唯一合法档:临时根不是 git 仓,按 HEAD 读必然全空。
 */
function runGateIn(cwd, extraArgs = []) {
  const r = spawnSync(
    process.execPath,
    [process.argv[1], '--worktree', '--root', cwd, ...extraArgs],
    {
      cwd: HERE,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    },
  )
  return { status: r.status, out: (r.stdout || '').replace(/\x1b\[[0-9;]*m/g, '') }
}

/** 端到端夹具:后端只有"模板串 + 矩阵"注册,前端调用路径由参数决定 */
function selfTestRoot(calledPath) {
  return makeSelfTestRoot({
    // O87g:夹具必须是**真实形态**(§22c)—— import + 注册符号与导出名一致,
    // 精确挂载图才解得到这条边(旧笛卡尔档不需要解边,所以早期夹具写成不存在的
    // aiVendorRoutes 也"绿");解不到边时 /api/ai 会落不透明前缀,矩阵哨兵就判不红了。
    'apps/api/src/server.ts':
      "import { vendorRoutes } from './routes/ai-vendors'\nserver.register(vendorRoutes, { prefix: '/api/ai' })\n",
    'apps/api/src/routes/ai-vendors.ts': SELF_MATRIX_FIXTURE,
    'apps/web/call.ts': `fetchApi('${calledPath}', { method: 'POST' })\n`,
  })
}

/** --self-test 主体:返回 {failures, assertions}(空 failures = 全部通过;断言数由计数器得出,不写死) */
function runSelfTest() {
  const failures = []
  let assertions = 0
  const eq = (name, expected, actual) => {
    assertions++
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      failures.push(
        `${name}\n    期望 ${JSON.stringify(expected)}\n    实际 ${JSON.stringify(actual)}`,
      )
    }
  }
  const got = expandTemplatedRoutes(SELF_MATRIX_FIXTURE, 'fixture.ts').map(
    (r) => `${r.method} ${r.localPath}`,
  )
  // 1. 无 if 包裹的模板串 → 对矩阵所有行注册
  eq(
    '未门控模板串对全部厂商行展开',
    ['GET /zhipu/models', 'GET /deepseek/models'].sort(),
    got.filter((p) => p.endsWith('/models')).sort(),
  )
  // 2. 能力矩阵求交:images 只在 true 的行注册(deepseek images:false 不得出现)
  eq(
    'if (cap.images) 与矩阵求交,只展开真实支持生图的厂商',
    ['POST /zhipu/images'],
    got.filter((p) => p.endsWith('/images')),
  )
  // 3. 门控条件命中多行时按行展开
  eq(
    'if (cap.chat) 对 chat:true 的两行都展开',
    ['POST /deepseek/chat', 'POST /zhipu/chat'].sort(),
    got.filter((p) => p.endsWith('/chat')).sort(),
  )
  // 4. 判据不可靠的条件包裹(非 ITEM.列 的 if)→ 整条跳过,绝不臆造
  eq(
    '非矩阵成员条件的 if 包裹一律不展开',
    [],
    got.filter((p) => p.endsWith('/secret')),
  )
  // 5. 文件级字符串常量前缀可展开
  eq(
    '循环外 ${PREFIX} 字符串常量前缀展开',
    ['POST /n8n/workflows'],
    expandTemplatedRoutes(
      "const PREFIX = '/n8n'\nasync function r(server) {\n  server.post(`${PREFIX}/workflows`, async () => ({}))\n}",
      'n8n.ts',
    ).map((x) => `${x.method} ${x.localPath}`),
  )
  // 6. 形参插值(registerCrud 的 basePath)解析不出 → 不臆造(既有 ignore 条目语义不变)
  eq(
    '形参插值不展开(不臆造路由)',
    [],
    expandTemplatedRoutes(
      'export function registerCrud(server, basePath) {\n  server.get(`${basePath}/:id`, async () => ({}))\n}',
      'shared.ts',
    ),
  )
  // 7. 端到端:展开后的真实注册路由 → 前端调用不再假阳性(exit 0)
  const okRoot = selfTestRoot('/api/ai/zhipu/images')
  try {
    const r = runGateIn(okRoot)
    eq(
      '端到端:矩阵展开后 POST /api/ai/zhipu/images 判定为已注册(exit 0)',
      [0, true],
      [r.status, /通过/.test(r.out)],
    )
  } finally {
    rmScratch(okRoot)
  }
  // 8. 反向哨兵 A:后端确实不存在的探针路由必须仍报违规 exit 1(门没被改瞎)
  const probeRoot = selfTestRoot('/api/__probe_no_such_route__')
  try {
    const r = runGateIn(probeRoot)
    eq(
      '端到端反向哨兵:真缺失路由 /api/__probe_no_such_route__ 仍 exit 1 且点名',
      [1, true, true],
      [r.status, /__probe_no_such_route__/.test(r.out), /发现 1 处前端调用无后端路由/.test(r.out)],
    )
  } finally {
    rmScratch(probeRoot)
  }
  // 9. 反向哨兵 B:矩阵中 images:false 的厂商端点必须仍报违规(证明是"求交"而非"全展开")
  const gateRoot = selfTestRoot('/api/ai/deepseek/images')
  try {
    const r = runGateIn(gateRoot)
    eq(
      '端到端反向哨兵:矩阵 flag=false 的端点仍 exit 1',
      [1, true],
      [r.status, /POST \/api\/ai\/deepseek\/images/.test(r.out)],
    )
  } finally {
    rmScratch(gateRoot)
  }

  // ===== 三端棘轮(2026-09-26 扩面):存量只报数、新增判红、缺锚点判"无法判定" =====
  const rnDeadCall = "fetchApi('/api/rn/legacy-thing', { method: 'POST' })\n"
  const rnFixture = (baselineContent) => {
    const files = {
      'apps/api/src/routes/x.ts': `server.get('/api/nothing', async () => ({}))\n`,
      'apps/mobile-rn/src/dead.ts': rnDeadCall,
    }
    if (baselineContent !== undefined) files[BASELINE_FILE_REL] = baselineContent
    return makeSelfTestRoot(files)
  }
  const baseAt = (n) =>
    JSON.stringify({ version: 1, perFileCount: { 'apps/mobile-rn/src/dead.ts': n } })
  // 10. 存量 = 基线额度 ⇒ exit 0,但必须**报出**存量读数(绝不静默成"看起来全绿")
  const ratchetRoot = rnFixture(baseAt(1))
  try {
    const r = runGateIn(ratchetRoot)
    eq(
      '棘轮:mobile-rn 存量 1 处等于基线额度 ⇒ exit 0 且如实报存量',
      [0, true, true],
      [r.status, /存量/.test(r.out), /apps\/mobile-rn/.test(r.out)],
    )
  } finally {
    rmScratch(ratchetRoot)
  }
  // 11. 同一文件比基线多一处 ⇒ 判红并点名"新增"(拦的正是"这次把死调用加回来")
  const overRoot = rnFixture(baseAt(0))
  try {
    const r = runGateIn(overRoot)
    eq('棘轮:超出基线额度 ⇒ exit 1 且点名新增', [1, true], [r.status, /新增/.test(r.out)])
  } finally {
    rmScratch(overRoot)
  }
  // 12. 有存量而锚点不在面里 ⇒ **未判定**:逐条列出、不判红也不记绿(exit 0 + 大声点名)。
  //     当场判红/exit 2 会把与本次改动无关的提交钉住 —— 门脚本从磁盘执行,别人一提交就撞上
  //     "我这枚没带基线",唯一结局是 --no-verify 连带废掉全部守门(§12e;手法照守门 110/105)。
  const noBaseRoot = rnFixture(undefined)
  try {
    const r = runGateIn(noBaseRoot)
    eq(
      '缺基线而有死调用 ⇒ exit 0 且如实喊"未判定"并逐条列出',
      [0, true, true],
      [r.status, /未判定/.test(r.out), /apps\/mobile-rn\/src\/dead\.ts/.test(r.out)],
    )
  } finally {
    rmScratch(noBaseRoot)
  }
  // 13. web 零容忍不因本次扩面被放宽:基线只兜三端,不兜 web
  const webRoot = makeSelfTestRoot({
    [BASELINE_FILE_REL]: baseAt(1),
    'apps/web/dead.ts': "fetchApi('/api/web/legacy-thing', { method: 'POST' })\n",
  })
  try {
    const r = runGateIn(webRoot)
    eq('web 仍是零容忍(棘轮不覆盖 web)', 1, r.status)
  } finally {
    rmScratch(webRoot)
  }
  // 14. 不透明挂载前缀下的调用 ⇒ 计「未判定」而非死调用:exit 0 且必须点名依据
  //     (真实动因:`AI_SERVICE_EDGE_ROUTES` 两条 `/api/mcp/export/*` 由 `mount_to_app` 挂载,
  //      静态注册面看不见 —— 判红就是把别人的正确实现钉成缺陷)
  const opaqueRoot = makeSelfTestRoot({
    'apps/web/opaque.ts':
      "fetchApi('/api/mcp/export/streamable', { method: 'POST' })\nfetchApi('/api/mcp/export/sse')\n",
  })
  try {
    const r = runGateIn(opaqueRoot)
    eq(
      '不透明挂载前缀 ⇒ 未判定(不判红)且点名',
      [0, true, true],
      [r.status, /不透明挂载/.test(r.out), /\/api\/mcp\/export\/streamable/.test(r.out)],
    )
  } finally {
    rmScratch(opaqueRoot)
  }
  // 15. 反向锁:台账不是无条件放行 —— 同前缀家族**外**的一条仍必须判红
  const opaqueNeighborRoot = makeSelfTestRoot({
    'apps/web/opaque.ts': "fetchApi('/api/mcp/export-x/streamable', { method: 'POST' })\n",
  })
  try {
    const r = runGateIn(opaqueNeighborRoot)
    eq('台账外的近邻路径必须照判死调用(不得连片放行)', 1, r.status)
  } finally {
    rmScratch(opaqueNeighborRoot)
  }

  // ===== CLI 端形态提取(2026-09-28 随 apps/cli 纳入)=====
  // 空基线 = "该端存量为 0",所以夹具里任何被判红的 cli 调用都会 exit 1(棘轮有牙)。
  const EMPTY_BASELINE = JSON.stringify({ version: 1, perFileCount: {} })
  const cliFixture = (files) =>
    makeSelfTestRoot({
      [BASELINE_FILE_REL]: EMPTY_BASELINE,
      'apps/api/src/routes/none.ts': "server.get('/api/nothing', async () => ({}))\n",
      ...files,
    })
  // 16. `createApiRequest(API_PREFIX,…)` + `apiRequest(baseUrl,'/ghost')`:
  //     路径住在**第二个实参**,裸 pathRe 只会看见那行前缀常量 ⇒ 不补提取式就等于没扩面。
  const cliComposeRoot = cliFixture({
    'apps/cli/src/commands/probe.ts': [
      "const API_PREFIX = '/api/probe';",
      'const apiRequest = createApiRequest(API_PREFIX, 1000);',
      "const r = await apiRequest(baseUrl, '/ghost', { method: 'POST' });",
      '',
    ].join('\n'),
  })
  try {
    const r = runGateIn(cliComposeRoot)
    eq(
      'CLI 前缀拼接:apiRequest(baseUrl, \'/ghost\') 必须被拼成 /api/probe/ghost 并判红',
      [1, true],
      [r.status, /POST \/api\/probe\/ghost/.test(r.out)],
    )
  } finally {
    rmScratch(cliComposeRoot)
  }
  // 17. 正例对照(证明拼接是对的,不是"造出路径就判红"):后端真注册 /api/probe/list ⇒ 不得报
  const cliComposeOkRoot = makeSelfTestRoot({
    [BASELINE_FILE_REL]: EMPTY_BASELINE,
    'apps/api/src/routes/probe.ts': "server.post('/api/probe/list', async () => ({}))\n",
    'apps/cli/src/commands/probe.ts': [
      "const API_PREFIX = '/api/probe';",
      'const apiRequest = createApiRequest(API_PREFIX, 1000);',
      "const r = await apiRequest(baseUrl, '/list', { method: 'POST' });",
      '',
    ].join('\n'),
  })
  try {
    const r = runGateIn(cliComposeOkRoot)
    eq('CLI 前缀拼接的正例:已注册的 /api/probe/list 不得判红', [0, true], [
      r.status,
      /通过/.test(r.out),
    ])
  } finally {
    rmScratch(cliComposeOkRoot)
  }
  // 18. `${base}/api/x` 模板前缀插值:引号不紧邻路径 ⇒ 旧判据整型隐身(实测 21 处)
  const cliTplRoot = cliFixture({
    'apps/cli/src/lib/tpl.ts':
      "const res = await fetch(`${cfg.apiUrl}/api/tpl/ghost`, { method: 'POST' })\n",
  })
  try {
    const r = runGateIn(cliTplRoot)
    eq(
      'CLI 模板前缀插值必须被抽出并判红',
      [1, true],
      [r.status, /POST \/api\/tpl\/ghost/.test(r.out)],
    )
  } finally {
    rmScratch(cliTplRoot)
  }
  // 19. 位置实参 method:`memorySend('POST', path)` —— 不认它就把真存在的 POST 端点报成 GET 缺失
  const cliPosMethodRoot = makeSelfTestRoot({
    [BASELINE_FILE_REL]: EMPTY_BASELINE,
    'apps/api/src/routes/pos.ts': "server.post('/api/pos/save', async () => ({}))\n",
    'apps/cli/src/tools/pos.ts': [
      'async function call(body) {',
      '  const r = await memorySend(',
      "    'POST',",
      "    '/api/pos/save',",
      '    body,',
      '  );',
      '  return r',
      '}',
      '',
    ].join('\n'),
  })
  try {
    const r = runGateIn(cliPosMethodRoot)
    eq('位置实参 method:后端只有 POST 时不得把该调用报成 GET', 0, r.status)
  } finally {
    rmScratch(cliPosMethodRoot)
  }
  // 19b. 同一条判据的反向:实参写 'DELETE' 而后端只有 POST ⇒ 必须点名 DELETE 并判红
  const cliPosMethodBadRoot = makeSelfTestRoot({
    [BASELINE_FILE_REL]: EMPTY_BASELINE,
    'apps/api/src/routes/pos.ts': "server.post('/api/pos/save', async () => ({}))\n",
    'apps/cli/src/tools/pos.ts': [
      "const r = await memorySend('DELETE', '/api/pos/save', body)",
      '',
    ].join('\n'),
  })
  try {
    const r = runGateIn(cliPosMethodBadRoot)
    eq(
      '位置实参 method 反向:DELETE 调用不得被算成已注册',
      [1, true],
      [r.status, /DELETE \/api\/pos\/save/.test(r.out)],
    )
  } finally {
    rmScratch(cliPosMethodBadRoot)
  }
  // 20. 变量路径(`apiRequest(baseUrl, qs, …)`)⇒ **未判定**并点名,既不判红也不记通过
  const cliVarPathRoot = cliFixture({
    'apps/cli/src/commands/var.ts': [
      "const API_PREFIX = '/api/vartest';",
      'const apiRequest = createApiRequest(API_PREFIX, 1000);',
      'const qs = buildQs()',
      "const r = await apiRequest(baseUrl, qs, { apiKey })",
      '',
    ].join('\n'),
  })
  try {
    const r = runGateIn(cliVarPathRoot)
    eq(
      '变量路径 ⇒ 未判定 + 点名(不得静默算通过)',
      [0, true, true],
      [
        r.status,
        /未判定\(CLI 变量路径调用点\)/.test(r.out),
        /apps\/cli\/src\/commands\/var\.ts:4/.test(r.out),
      ],
    )
  } finally {
    rmScratch(cliVarPathRoot)
  }

  // ===== CLI 变量路径「一跳常量解析」(2026-09-27 判据扩面票;正反成对) =====
  // 21. 正例:同文件三元两条分支都注册 ⇒ 不得再落未判定、不得判红
  //     (夹具逐字取自 HEAD 面 context.ts 的 listContext/clearContext 形态)
  const cliTernaryOkRoot = makeSelfTestRoot({
    [BASELINE_FILE_REL]: EMPTY_BASELINE,
    'apps/api/src/routes/ter.ts': [
      "server.get('/api/tertest/list', async () => ({}))",
      "server.get('/api/tertest/session/:sessionId', async () => ({}))",
      '',
    ].join('\n'),
    'apps/cli/src/commands/ter.ts': [
      "const API_PREFIX = '/api/tertest';",
      'const apiRequest = createApiRequest(API_PREFIX, 1000);',
      'async function listT(baseUrl, session, apiKey) {',
      '  const path = session',
      '    ? `/session/${encodeURIComponent(session)}`',
      '    : `/list?pageSize=${LIST_PAGE_SIZE}`;',
      '  const resp = await apiRequest(baseUrl, path, { apiKey });',
      '  return resp',
      '}',
      '',
    ].join('\n'),
  })
  try {
    const r = runGateIn(cliTernaryOkRoot)
    /**
     * 第三条判据必须按**计数 ≥1** 判,不能按"这一行出不出现"判 —— 本条断言从写下起就恒红:
     * `6a5a53658` 在同一次提交里既写了它,又给门加了「0 也要出声」那两档输出行(区分"全部解析
     * 成功"与"一条都没枚举到",防空扫型假绿),于是门**总是**打印
     * `ℹ️ 未判定(CLI 变量路径调用点)0 处 —— …`,而这条断言要求它不出现。
     * 账面表现:HEAD 面 `--self-test` 与镜像的「--self-test 端到端 exit 0」一起红,与本票无关的
     * 每一次提交都被这台门自身钉住(§12f:恒红 ⇒ 各会话合法 --no-verify ⇒ 链上全部守门作废)。
     * 两档 0 形态的行文都以 `0 处` 开头,`[1-9]` 天然不匹配;真未判定那一档是
     * `未判定(CLI 变量路径调用点)<n> 处`,n≥1 ⇒ 匹配。**反向对照**由下一条(22)与 case 24/26 提供:
     * 那几条只注册一条分支 / 解析不到,必须仍然判出"1 处" —— 所以这一改不会把门改成恒绿。
     */
    eq(
      '三元两分支(都注册)⇒ 判红 0 且不再落未判定',
      [0, true, false],
      [r.status, /通过/.test(r.out), /未判定\(CLI 变量路径调用点\)[1-9]/.test(r.out)],
    )
  } finally {
    rmScratch(cliTernaryOkRoot)
  }
  // 22. 反例:三元只注册一条分支 ⇒ 另一条必须被点名判红(证明**每条分支都进对账**,不是挑一条)
  const cliTernaryBadRoot = makeSelfTestRoot({
    [BASELINE_FILE_REL]: EMPTY_BASELINE,
    'apps/api/src/routes/ter.ts': "server.get('/api/tertest/list', async () => ({}))\n",
    'apps/cli/src/commands/ter.ts': [
      "const API_PREFIX = '/api/tertest';",
      'const apiRequest = createApiRequest(API_PREFIX, 1000);',
      'async function listT(baseUrl, session, apiKey) {',
      '  const path = session',
      '    ? `/session/${encodeURIComponent(session)}`',
      '    : `/list?pageSize=${LIST_PAGE_SIZE}`;',
      '  const resp = await apiRequest(baseUrl, path, { apiKey });',
      '  return resp',
      '}',
      '',
    ].join('\n'),
  })
  try {
    const r = runGateIn(cliTernaryBadRoot)
    eq(
      '三元未注册分支必须逐条判红并点名(GET /api/tertest/session/:param)',
      [1, true],
      [r.status, /GET \/api\/tertest\/session\/:param/.test(r.out)],
    )
  } finally {
    rmScratch(cliTernaryBadRoot)
  }
  // 23. 单行 const 模板 + 第三个实参 method:'POST' ⇒ 拼前缀、认 POST、判红点名
  const cliVarDeadRoot = makeSelfTestRoot({
    [BASELINE_FILE_REL]: EMPTY_BASELINE,
    'apps/api/src/routes/none.ts': "server.get('/api/nothing', async () => ({}))\n",
    'apps/cli/src/commands/deadv.ts': [
      "const API_PREFIX = '/api/deadvar';",
      'const apiRequest = createApiRequest(API_PREFIX, 1000);',
      'async function go(baseUrl, x) {',
      '  const path = `/thing/${encodeURIComponent(x)}`;',
      "  const resp = await apiRequest(baseUrl, path, { method: 'POST' });",
      '  return resp',
      '}',
      '',
    ].join('\n'),
  })
  try {
    const r = runGateIn(cliVarDeadRoot)
    eq(
      '单值 const 模板解析后必须带真 method 参与对账(POST /api/deadvar/thing/:param)',
      [1, true],
      [r.status, /POST \/api\/deadvar\/thing\/:param/.test(r.out)],
    )
  } finally {
    rmScratch(cliVarDeadRoot)
  }
  // 23b. 反向锁:声明与调用之间出现重赋值 ⇒ 不许按初始化式判(回到未判定 + 点名原因)
  const cliVarReassignRoot = cliFixture({
    'apps/cli/src/commands/reas.ts': [
      "const API_PREFIX = '/api/reas';",
      'const apiRequest = createApiRequest(API_PREFIX, 1000);',
      'const path = `/one`;',
      'path = other();',
      'const r = await apiRequest(baseUrl, path, { apiKey })',
      '',
    ].join('\n'),
  })
  try {
    const r = runGateIn(cliVarReassignRoot)
    eq(
      '声明后被重赋值的变量必须留在未判定(初始化式不再决定调用值)',
      [0, true, true],
      [r.status, /未判定\(CLI 变量路径调用点\)/.test(r.out), /重赋值/.test(r.out)],
    )
  } finally {
    rmScratch(cliVarReassignRoot)
  }
  // 23c. 形参不归因:函数签名的形参名与别处的 const 同名,不许把别人的常量算到这一站
  const cliVarParamRoot = cliFixture({
    'apps/cli/src/commands/prm.ts': [
      "const API_PREFIX = '/api/prm';",
      'const apiRequest = createApiRequest(API_PREFIX, 1000);',
      "async function outer() { const path = '/inner-const-not-mine'; }",
      'async function inner(baseUrl, path) {',
      '  const resp = await apiRequest(baseUrl, path, { apiKey });',
      '  return resp',
      '}',
      '',
    ].join('\n'),
  })
  try {
    const r = runGateIn(cliVarParamRoot)
    eq(
      '形参 path 的调用点 ⇒ 未判定(跨函数边界不猜),且不得拼出 /api/prm/inner-const-not-mine',
      [0, true, false],
      [
        r.status,
        /未判定\(CLI 变量路径调用点\)/.test(r.out),
        /prm\/inner-const-not-mine/.test(r.out),
      ],
    )
  } finally {
    rmScratch(cliVarParamRoot)
  }
  // 24. import 一跳:目标文件 export const = 绝对路径字面量 ⇒ 拼进对账(正反成对)
  const impFiles = {
    'apps/cli/src/lib/impv.ts': "export const STATUS_PATH = '/api/impv/status';\n",
    'apps/cli/src/commands/imp.ts': [
      "import { STATUS_PATH } from '../lib/impv.js';",
      "const API_PREFIX = '/api/impv';",
      'const apiRequest = createApiRequest(API_PREFIX, 1000);',
      'async function go(baseUrl, apiKey) {',
      '  const resp = await apiRequest(baseUrl, STATUS_PATH, { apiKey });',
      '  return resp',
      '}',
      '',
    ].join('\n'),
  }
  const cliImportOkRoot = makeSelfTestRoot({
    [BASELINE_FILE_REL]: EMPTY_BASELINE,
    'apps/api/src/routes/impv.ts': "server.get('/api/impv/status', async () => ({}))\n",
    ...impFiles,
  })
  try {
    const r = runGateIn(cliImportOkRoot)
    eq(
      'import 一跳解析 + 已注册 ⇒ exit 0 且该站不落未判定',
      [0, false],
      [r.status, /imp\.ts:5/.test(r.out) && /未判定\(CLI 变量路径调用点\)/.test(r.out)],
    )
  } finally {
    rmScratch(cliImportOkRoot)
  }
  const cliImportBadRoot = makeSelfTestRoot({
    [BASELINE_FILE_REL]: EMPTY_BASELINE,
    'apps/api/src/routes/none.ts': "server.get('/api/nothing', async () => ({}))\n",
    ...impFiles,
  })
  try {
    const r = runGateIn(cliImportBadRoot)
    eq(
      'import 一跳解析 + 未注册 ⇒ 必须判红点名(证明 import 面真的进了对账)',
      [1, true],
      [r.status, /GET \/api\/impv\/status @ apps\/cli\/src\/commands\/imp\.ts:5/.test(r.out)],
    )
  } finally {
    rmScratch(cliImportBadRoot)
  }
  // 25. import 目标不在面上(路径写歪)⇒ 仍是未判定并点名原因,不得静默也不得造路径
  const cliImportMissRoot = cliFixture({
    'apps/cli/src/commands/impmiss.ts': [
      "import { GONE_PATH } from '../lib/nope.js';",
      "const API_PREFIX = '/api/impmiss';",
      'const apiRequest = createApiRequest(API_PREFIX, 1000);',
      'const r = await apiRequest(baseUrl, GONE_PATH, { apiKey })',
      '',
    ].join('\n'),
  })
  try {
    const r = runGateIn(cliImportMissRoot)
    eq(
      'import 目标解析不到 ⇒ 未判定 + 点名(import 目标),不判红不记通过',
      [0, true, true],
      [
        r.status,
        /未判定\(CLI 变量路径调用点\)1 处/.test(r.out),
        /import 目标/.test(r.out),
      ],
    )
  } finally {
    rmScratch(cliImportMissRoot)
  }
  // 26. 注释里的示例声明不得被当真声明(端到端证明一跳解析确实工作**在遮罩面**上):
  //     块注释里放一条**行首即 `const qs = '/api/...'`** 的示例 —— 若解析器按原文扫,它会命中这条
  //     "声明"并把站点判掉;遮罩生效时该行整行变空白,站点必须仍落未判定。
  //     (注释行本身会被通用 pathRe 当 ANY 字面量,所以后端注册该路径,保证退出码只由这一格决定)
  const cliVarCommentRoot = makeSelfTestRoot({
    [BASELINE_FILE_REL]: EMPTY_BASELINE,
    'apps/api/src/routes/cmt.ts': "server.get('/api/cmt/from-comment', async () => ({}))\n",
    'apps/cli/src/commands/cmt.ts': [
      "const API_PREFIX = '/api/cmt';",
      'const apiRequest = createApiRequest(API_PREFIX, 1000);',
      '/*',
      "const qs = '/api/cmt/from-comment';",
      '*/',
      'const r = await apiRequest(baseUrl, qs, { apiKey })',
      '',
    ].join('\n'),
  })
  try {
    const r = runGateIn(cliVarCommentRoot)
    eq(
      '块注释形态的 const 不得被一跳解析命中(该站仍是未判定 1 处)',
      [0, true],
      [r.status, /未判定\(CLI 变量路径调用点\)1 处/.test(r.out)],
    )
  } finally {
    rmScratch(cliVarCommentRoot)
  }
  // ===== 通道等价(CE)族(2026-09-29,G-466 换维;正反成对)=====
  /**
   * 夹具逐字照 HEAD 面 `packages/api-client/src/client.ts:404-416` 的 normalizeUrl 形态写,
   * 只把改写档换成票面那一型(`/admin`→`/console`),守卫形态照 Fastify preHandler 真写法。
   * 门读的是**这些文件的内容**,不是自带的第二张表(反向锁见镜像 T-CE-1)。
   */
  const CE_TRANSPORT = [
    'export async function fetchApi<T>(url: string): Promise<T> {',
    '  const normalizedUrl = normalizeUrl(url)',
    '  return normalizedUrl as T',
    '}',
    'function normalizeUrl(url: string): string {',
    '  if (/^https?:\\/\\//i.test(url)) return url',
    '  const normalized = (() => {',
    "    if (url.startsWith('/api/') || url.startsWith('/uploads/') || url.startsWith('/ws/')) return url",
    "    if (url.startsWith('/admin')) {",
    "      return url.replace(/^\\/admin/, '/console')",
    '    }',
    "    if (url.startsWith('/')) return `/api${url}`",
    '    return `/api/${url}`',
    '  })()',
    '  return normalized',
    '}',
    '',
  ].join('\n')
  const CE_GUARD_EXEMPT = [
    'export async function clientChannelGuard(server) {',
    "  server.addHook('preHandler', async (req, reply) => {",
    "    const channel = req.headers['x-client-channel']",
    "    const enforce = process.env.CHANNEL_ENFORCE === '1'",
    '    if (!enforce) return',
    "    if (req.method === 'GET') return",
    "    if (channel !== 'admin') {",
    "      return reply.code(403).send({ message: 'forbidden channel' })",
    '    }',
    '  })',
    '}',
    '',
  ].join('\n')
  /** 同一个守卫,但**没有**按方法放行的那一档 ⇒ ② 不成立 ⇒ 该维必须落未判定而不是判红 */
  const CE_GUARD_NO_EXEMPT = [
    'export async function clientChannelGuard(server) {',
    "  server.addHook('preHandler', async (req, reply) => {",
    "    const channel = req.headers['x-client-channel']",
    "    if (channel !== 'admin') {",
    "      return reply.code(403).send({ message: 'forbidden channel' })",
    '    }',
    '  })',
    '}',
    '',
  ].join('\n')
  const CE_ROUTES = [
    // 这条 2 段路由是给**夹具自己**的:transport 夹具里的 `return \`/api${url}\`` 会被既有的
    // 字面量提取式收成一处 `GET /api/:param` 调用(真仓里它命中成百条 2 段路由所以不报),
    // 临时根里若没有一条 2 段路由,夹具自己就会先冒一枚与 CE 维无关的死调用红。
    "server.get('/api/nothing', async () => ({}))",
    "server.get('/api/admin/secret', async () => ({}))",
    "server.get('/api/console/secret', async () => ({}))",
    '',
  ].join('\n')
  const CE_SITE = "export const load = () => fetchApi('/admin/secret')\n"
  const CE_EMPTY_LEDGER = JSON.stringify({ version: 1, declared: [] })
  const ceRoot = (files) =>
    makeSelfTestRoot({
      [BASELINE_FILE_REL]: EMPTY_BASELINE,
      [CHANNEL_EQUIV_BASELINE_REL]: CE_EMPTY_LEDGER,
      [CLIENT_TRANSPORT_FILE]: CE_TRANSPORT,
      'apps/api/src/plugins/ce-guard.ts': CE_GUARD_EXEMPT,
      'apps/api/src/routes/ce.ts': CE_ROUTES,
      'apps/mobile-rn/src/screens/Ce.tsx': CE_SITE,
      ...files,
    })
  // 27. 阳性对照(本票立项那一型):三条件齐备 ⇒ 判红并点名"两种拼写等价"
  const ceLiveRoot = ceRoot({})
  try {
    const r = runGateIn(ceLiveRoot)
    eq(
      '通道等价:改写档+放行档+两侧都在册的站点 ⇒ exit 1 且点名等价对',
      [1, true],
      [r.status, /\/admin\/secret ≡ \/console\/secret/.test(r.out)],
    )
  } finally {
    rmScratch(ceLiveRoot)
  }
  // 28. 反向对照一:守卫对所有方法都执行(没有有意放行)⇒ ②不成立,不得判红
  const ceNoExemptRoot = ceRoot({ 'apps/api/src/plugins/ce-guard.ts': CE_GUARD_NO_EXEMPT })
  try {
    const r = runGateIn(ceNoExemptRoot)
    eq(
      '通道等价:缺② ⇒ 未判定并点名,不判红也不记通过',
      [0, true, false],
      [
        r.status,
        /未判定\(通道等价 CE\):②/.test(r.out),
        /\/admin\/secret ≡ \/console\/secret/.test(r.out),
      ],
    )
  } finally {
    rmScratch(ceNoExemptRoot)
  }
  // 29. 反向对照二(本就合法的一档):台账逐条写明理由 ⇒ 判绿,并且要说清是"已交代"
  const ceDeclaredRoot = ceRoot({
    [CHANNEL_EQUIV_BASELINE_REL]: JSON.stringify({
      version: 1,
      declared: [
        {
          file: 'apps/mobile-rn/src/screens/Ce.tsx',
          path: '/admin/secret',
          reason: '只读公开路由:该入口返回的字段与 /console 侧完全同集合,无租户数据',
        },
      ],
    }),
  })
  try {
    const r = runGateIn(ceDeclaredRoot)
    eq(
      '通道等价:站点已在台账逐条写明理由 ⇒ exit 0 且报"已交代"',
      [0, true],
      [r.status, /已在 .*declared|已交代|逐条写明理由/.test(r.out)],
    )
  } finally {
    rmScratch(ceDeclaredRoot)
  }
  // 30. 反向对照三:只有单侧在册 = 等价不成立(那是既有死调用判据的地盘),本维不得冒红
  const ceOneSideRoot = ceRoot({
    'apps/api/src/routes/ce.ts': [
      "server.get('/api/nothing', async () => ({}))",
      "server.get('/api/admin/secret', async () => ({}))",
      '',
    ].join('\n'),
  })
  try {
    const r = runGateIn(ceOneSideRoot)
    eq(
      '通道等价:单侧在册 ⇒ 未判定③并点名"只有单侧在册",不判红',
      [0, true, true],
      [
        r.status,
        /未判定\(通道等价 CE\):③/.test(r.out),
        /只有单侧在册/.test(r.out),
      ],
    )
  } finally {
    rmScratch(ceOneSideRoot)
  }
  // 31. 遮噪证明:通道头与放行档**只写在注释里** ⇒ ②不成立(注释不得给实现发合格证)
  const ceCommentRoot = ceRoot({
    'apps/api/src/plugins/ce-guard.ts': [
      '/**',
      " * 设计稿(未实现):const channel = req.headers['x-client-channel']",
      " * 曾计划 if (req.method === 'GET') return,现按全方法校验",
      ' */',
      'export async function clientChannelGuard(server) {}',
      '',
    ].join('\n'),
  })
  try {
    const r = runGateIn(ceCommentRoot)
    eq(
      '通道等价:注释里的通道头/放行档不得被当实现 ⇒ 未判定,不判红',
      [0, true, false],
      [
        r.status,
        /未判定\(通道等价 CE\)/.test(r.out),
        /\/admin\/secret ≡ \/console\/secret/.test(r.out),
      ],
    )
  } finally {
    rmScratch(ceCommentRoot)
  }
  // 32. 事实源①取不到 ⇒ 整维未判定并点名"取不到内容",不得静默也不得冒红
  const ceNoTransportRoot = makeSelfTestRoot({
    [BASELINE_FILE_REL]: EMPTY_BASELINE,
    [CHANNEL_EQUIV_BASELINE_REL]: CE_EMPTY_LEDGER,
    'apps/api/src/plugins/ce-guard.ts': CE_GUARD_EXEMPT,
    'apps/api/src/routes/ce.ts': CE_ROUTES,
    'apps/mobile-rn/src/screens/Ce.tsx': CE_SITE,
  })
  try {
    const r = runGateIn(ceNoTransportRoot)
    eq(
      '通道等价:transport 取不到 ⇒ 未判定①点名"取不到内容",不判红不记通过',
      [0, true, true],
      [r.status, /未判定\(通道等价 CE\):①/.test(r.out), /取不到内容/.test(r.out)],
    )
  } finally {
    rmScratch(ceNoTransportRoot)
  }
  // ===== BP 腿(裸路径传输口调用,2026-10-19 立;正反成对 + 计数自洽 + 判序在过程内直打)=====
  /**
   * 夹具共用 transport = 上面 CE_TRANSPORT(它逐字照 client.ts 的 normalizeUrl 写,
   * 含 `if (url.startsWith('/')) return \`/api${url}\`` 这一档 —— 归一事实源读的就是它,
   * 门里没有第二张前缀表)。
   */
  const BP_EMPTY_BASELINE = JSON.stringify({ version: 1, perFileCount: {} })
  const bpRoot = (files) =>
    makeSelfTestRoot({
      [BASELINE_FILE_REL]: BP_EMPTY_BASELINE,
      [BARE_LEG_BASELINE_REL]: BP_EMPTY_BASELINE,
      [CLIENT_TRANSPORT_FILE]: CE_TRANSPORT,
      'apps/api/src/routes/bp.ts':
        "server.get('/api/bp-alive', async () => ({}))\nserver.post('/api/bp-alive', async () => ({}))\n",
      ...files,
    })
  // 33. 阳性对照(本腿立项那一型):**已知在册**的裸路径调用必须被抽出,且判为在册(不判死)
  const bpAliveRoot = bpRoot({
    'apps/mobile-rn/src/screens/BpAlive.tsx': "export const load = () => fetchApi('/bp-alive')\n",
  })
  try {
    const r = runGateIn(bpAliveRoot)
    eq(
      'BP 腿:裸路径 /bp-alive 归一成 /api/bp-alive 后被抽出且判在册 ⇒ exit 0',
      [0, true, true],
      [
        r.status,
        /BP\/mobile-rn:文件 \d+ \/ 候选 1 \/ 可判 1/.test(r.out),
        /BP 桶明细:可判 1 \/ 已在册 1 \/ 死调用 0/.test(r.out),
      ],
    )
  } finally {
    rmScratch(bpAliveRoot)
  }
  // 34. 反向对照:**已知不在册**的裸路径(本轮实测现场那一型,RN 的 /course-qa)必须被抓进死调用集并判红
  const bpDeadRoot = bpRoot({
    'apps/mobile-rn/src/screens/BpDead.tsx':
      "export const send = () => fetchApi('/course-qa', { method: 'POST' })\n",
  })
  try {
    const r = runGateIn(bpDeadRoot)
    eq(
      'BP 腿:未注册的裸路径归一后 POST /api/course-qa ⇒ 进死调用集、棘轮空锚点下 exit 1 并点名',
      [1, true, true],
      [
        r.status,
        /BP 腿\(裸路径传输口调用\)\*\*新增\*\*死调用 1 处/.test(r.out),
        /POST \/api\/course-qa @ apps\/mobile-rn\/src\/screens\/BpDead\.tsx:1\(字面量原文 \/course-qa/.test(
          r.out,
        ),
      ],
    )
    // 抽出条数与门汇总行必须同数(对不上就是尺子坏了,不许把 0 当结论)
    const header = /候选 (\d+) 条/.exec(r.out)
    const rows = [...r.out.matchAll(/BP\/[\w-]+:文件 \d+ \/ 候选 (\d+) \/ 可判 (\d+)/g)]
    const sumCandidates = rows.reduce((a, m) => a + Number(m[1]), 0)
    const sumAdjudicated = rows.reduce((a, m) => a + Number(m[2]), 0)
    eq('BP 腿:逐端候选之和 == 汇总行候选数', [Number(header?.[1]), 1], [sumCandidates, 1])
    eq('BP 腿:逐端可判之和 == 桶明细可判数', [sumAdjudicated, 1], [sumAdjudicated, 1])
  } finally {
    rmScratch(bpDeadRoot)
  }
  // 35. 拼接尾巴不是调用点:`fetchApi(BASE + '/create')` 的 `'/create'` 不在 URL 实参位
  //     (实测现场 packages/api-client/src/endpoints/agent.ts:201)—— 认了就是凭空 /api/create
  const bpConcatRoot = bpRoot({
    'apps/mobile-rn/src/screens/BpConcat.tsx':
      "const BASE = '/withdrawals'\nexport const send = () => fetchApi(BASE + '/create', { method: 'POST' })\n",
  })
  try {
    const r = runGateIn(bpConcatRoot)
    eq(
      'BP 腿:变量拼接尾巴上的裸字面量不进本腿(候选 0,不产出 /api/create)',
      [0, true, false],
      [r.status, /BP\/mobile-rn:文件 \d+ \/ 候选 0 \/ 可判 0/.test(r.out), /\/api\/create/.test(r.out)],
    )
  } finally {
    rmScratch(bpConcatRoot)
  }
  // 36. 改写档那一族不归本腿:`/admin/secret` 命中 transport 的 `/admin`→`/console` 替换档,
  //     按"补前缀"归一就会造一条谁都没发过的 `/api/admin/secret`(2026-09-29 实测否证那一型)
  const bpAliasRoot = bpRoot({
    'apps/mobile-rn/src/screens/BpAlias.tsx': "export const load = () => fetchApi('/admin/secret')\n",
  })
  try {
    const r = runGateIn(bpAliasRoot)
    eq(
      'BP 腿:改写档前缀的字面量落 aliasRewriteFamily 桶,不判死也不静默',
      [0, true, true],
      [
        r.status,
        /改写档那一族\(判权在 CE 与③'\)1/.test(r.out),
        /BP 桶明细:可判 0 \/ 已在册 0 \/ 死调用 0/.test(r.out),
      ],
    )
  } finally {
    rmScratch(bpAliasRoot)
  }
  // 37. 判序在过程内直打(不在测试里复制判据:打的就是生产同一份 classifyBareLiteral)
  const bpAlias = readUrlAliasRules(CE_TRANSPORT)
  eq(
    'BP 腿:归一事实源从 transport 现读到裸路径补前缀档 = /api',
    { parsed: true, barePrefix: '/api' },
    { parsed: bpAlias.parsed, barePrefix: bpAlias.barePrefix },
  )
  // 37. 判序在过程内直打(不在测试里复制判据:打的就是生产同一份 classifyBareLiteral)。
  // 转发面豁免在这里给一个**空豁免面**(corroborated:[])而不是真面 —— 自测夹具里没有
  // next.config.ts 的 ai 面可依赖,而本用例要判的是"归一与分桶",不是豁免。
  const BP_NO_FORWARD = { corroborated: [] }
  const bpClassify = (content) => classifyBareLiteral(content, bpAlias, BP_NO_FORWARD)
  eq('BP:裸路径 ⇒ 归一并可判', { bucket: 'api', path: '/api/course-qa' }, (() => {
    const v = bpClassify('/course-qa')
    return { bucket: v.bucket, path: v.path }
  })())
  eq(
    'BP:主腿射程(/api/ 起头)不重复收',
    'alreadyApi',
    bpClassify('/api/bp-alive').bucket,
  )
  eq('BP:透传档原样返回,补前缀就是造假影', 'passthrough', bpClassify('/uploads/a.png').bucket)
  eq('BP:改写档前缀单列成桶', 'aliasRewriteFamily', bpClassify('/admin/secret').bucket)
  eq('BP:`:param` 假影单列成桶', 'interpPhantom', bpClassify('/x/all${suffix}').bucket)
  eq('BP:整段插值仍是真调用形状(:param)', { bucket: 'api', path: '/api/x/:param' }, (() => {
    const v = bpClassify('/x/${id}')
    return { bucket: v.bucket, path: v.path }
  })())
  eq('BP:不以 / 开头不是裸路径', 'notBarePath', bpClassify('user/me').bucket)
  eq('BP:协议相对 // 不是裸路径', 'notBarePath', bpClassify('//cdn/x.js').bucket)
  eq(
    'BP:事实源取不到 ⇒ 一条都不硬判(factSourceUnread)',
    'factSourceUnread',
    classifyBareLiteral('/course-qa', { parsed: false, rules: [], passthrough: [] }, null).bucket,
  )
  // 38. 三态判序:四种读数各归一格(blind / inconsistent / unadjudged / ok)
  const bpMap = (entries) => new Map(Object.entries(entries))
  eq(
    'BP 判序:整仓面候选 0 ⇒ blind(取材失效,判死不记绿)',
    'blind',
    classifyBareLegVerdict({ scannedFiles: 5269, candidates: 0, census: bpMap({}), repoWide: true })
      .state,
  )
  eq(
    'BP 判序:夹具面候选 0 不判 blind(小树没有裸路径是常态)',
    'ok',
    classifyBareLegVerdict({ scannedFiles: 3, candidates: 0, census: bpMap({}), repoWide: false })
      .state,
  )
  eq(
    'BP 判序:桶加总对不上候选 ⇒ inconsistent(坏的是尺子)',
    'inconsistent',
    classifyBareLegVerdict({
      scannedFiles: 10,
      candidates: 7,
      census: bpMap({ api: 3, alreadyApi: 3 }),
      repoWide: true,
    }).state,
  )
  eq(
    'BP 判序:候选全落在读不出归一档 ⇒ unadjudged',
    'unadjudged',
    classifyBareLegVerdict({
      scannedFiles: 10,
      candidates: 4,
      census: bpMap({ barePrefixUnread: 4 }),
      repoWide: true,
    }).state,
  )
  eq(
    'BP 判序:有可判也有不判的桶 ⇒ ok(不判的那几桶已在读数里报名)',
    'ok',
    classifyBareLegVerdict({
      scannedFiles: 10,
      candidates: 9,
      census: bpMap({ api: 4, alreadyApi: 3, interpPhantom: 1, aliasRewriteFamily: 1 }),
      repoWide: true,
    }).state,
  )
  // 39. 事实源被改窄(裸路径档换成门读不出的写法)⇒ 腿必须显式"归一未读到",而不是把这一族当 0 条放过。
  //     (顺带证一条反向性质:transport 若改成"裸路径原样返回",`/x` 会落 `passthrough` 桶而不是
  //      被硬补成 `/api/x` 判死 —— 腿跟着事实源改口,不自带第二张表。)
  const bpNoBareTransport = [
    'export async function fetchApi<T>(url: string): Promise<T> {',
    '  return request(normalizeUrl(url))',
    '}',
    'function normalizeUrl(url: string): string {',
    "  if (url.startsWith('/api/')) return url",
    "  if (url.startsWith('/')) return ['api', url.slice(1)].join('/')",
    '  return url',
    '}',
    '',
  ].join('\n')
  eq(
    'BP:transport 的裸路径档换成读不出的写法 ⇒ barePrefix=null(而不是猜一个)',
    null,
    readUrlAliasRules(bpNoBareTransport).barePrefix,
  )
  const bpNoBareRoot = makeSelfTestRoot({
    [BASELINE_FILE_REL]: BP_EMPTY_BASELINE,
    [BARE_LEG_BASELINE_REL]: BP_EMPTY_BASELINE,
    [CLIENT_TRANSPORT_FILE]: bpNoBareTransport,
    'apps/api/src/routes/bp.ts': "server.get('/api/bp-alive', async () => ({}))\n",
    'apps/mobile-rn/src/screens/BpNoBare.tsx': "export const load = () => fetchApi('/bp-alive')\n",
  })
  try {
    const r = runGateIn(bpNoBareRoot)
    eq(
      'BP 腿:归一未读到 ⇒ 可判 0 且点名"归一未读到 1"与"未读到裸路径补前缀档",不得读成"没有裸路径"',
      [true, true, true],
      [
        /可判 0/.test(r.out),
        /归一未读到 1/.test(r.out),
        /未读到裸路径补前缀档\(裸路径一条不判\)/.test(r.out),
      ],
    )
  } finally {
    rmScratch(bpNoBareRoot)
  }

  // ===== 参数段覆盖(2026-10-23 立,收「具体静态路径被 :param 路由记成在册」的假绿)=====
  // 判据本体在共享 lib(`classifyRouteCoverage`),镜像测试直接 import `__test__`(§22c);
  // 这里钉两件事:**该分档的判据正确** + **门真的按它分流**(不记在册 / 不判红 / 正例仍绿)。
  eq(
    '路由覆盖分类:具体字面段被 :param 吞掉 ⇒ param',
    'param',
    classifyRouteCoverage(['', 'api', 'asks', 'my'], ['', 'api', 'asks', ':id']),
  )
  eq(
    '路由覆盖分类:逐段字面相等 ⇒ literal',
    'literal',
    classifyRouteCoverage(['', 'api', 'asks', 'my'], ['', 'api', 'asks', 'my']),
  )
  eq(
    '路由覆盖分类:前端动态段对后端参数段 ⇒ literal(同一路由形状,不误伤)',
    'literal',
    classifyRouteCoverage(['', 'api', 'asks', ':param'], ['', 'api', 'asks', ':id']),
  )
  eq(
    '路由覆盖分类:段数不等 ⇒ null',
    null,
    classifyRouteCoverage(['', 'api', 'asks', 'my'], ['', 'api', 'asks', ':id', 'answers']),
  )
  const paramFixture = (asksBody, webCall) =>
    makeSelfTestRoot({
      [BASELINE_FILE_REL]: EMPTY_BASELINE,
      'apps/api/src/server.ts':
        "import { asksRoutes } from './routes/asks'\nserver.register(asksRoutes, { prefix: '/api' })\n",
      'apps/api/src/routes/asks.ts': `export async function asksRoutes(server) {\n${asksBody}}\n`,
      'apps/web/call.ts': webCall,
    })
  // 反例:后端只有 `/asks/:id`(参数路由),前端调具体路径 `/asks/my` —— 旧口径记成「已在册」,
  // 现在必须落「未判定(参数段覆盖)」并点名,但仍然不判红(存量口径,§12e)。
  const paramHitRoot = paramFixture(
    "  server.get('/asks/:id', async () => ({}))\n",
    "fetch('/api/asks/my')\n",
  )
  try {
    const r = runGateIn(paramHitRoot)
    eq(
      '参数段覆盖:具体路径只被 :param 接住 ⇒ 不记在册、不判红、逐条点名',
      [0, true, true],
      [
        r.status,
        /未判定\(参数段覆盖\)1 处/.test(r.out),
        /\/api\/asks\/my/.test(r.out),
      ],
    )
  } finally {
    rmScratch(paramHitRoot)
  }
  // 正例:后端真有字面静态注册 ⇒ 同一条调用必须回到 literal,不得被误打进未判定桶。
  const paramOkRoot = paramFixture(
    "  server.get('/asks/:id', async () => ({}))\n  server.get('/asks/my', async () => ({}))\n",
    "fetch('/api/asks/my')\n",
  )
  try {
    const r = runGateIn(paramOkRoot)
    eq(
      '参数段覆盖:字面静态注册优先 ⇒ 同一条调用仍判在册(未判定桶 0)',
      [0, true],
      [r.status, /未判定\(参数段覆盖\)0 处/.test(r.out)],
    )
  } finally {
    rmScratch(paramOkRoot)
  }
  // 防过度收紧:前端本身是动态段(`:param`)对后端参数段 ⇒ 同一路由形状,不得进未判定桶。
  const paramDynRoot = paramFixture(
    "  server.get('/asks/:id/answers', async () => ({}))\n",
    'fetch(`/api/asks/${encodeURIComponent(id)}/answers`)\n',
  )
  try {
    const r = runGateIn(paramDynRoot)
    eq(
      '参数段覆盖:前端动态段 ↔ 后端参数段不误判(未判定桶 0 且 exit 0)',
      [0, true],
      [r.status, /未判定\(参数段覆盖\)0 处/.test(r.out)],
    )
  } finally {
    rmScratch(paramDynRoot)
  }
  return { failures, assertions }
}
  return runSelfTest()
}

export { runSelfTestSuite as runSelfTest }
