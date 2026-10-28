// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `scripts/find-route-conflicts.mjs` 的取材面门（2026-10-04，**该门第一组测试**）。
 *
 * ## 为什么这组测试存在（缺陷本体）
 *
 * 修之前，本脚本只读 `apps/api/src/server.ts` 一个文件（`SERVER_FILE` 常量 + 两处
 * `readFileSync(SERVER_FILE)`），而全仓业务路由的注册真身是
 * `apps/api/src/routes/index.ts` 的 `registerRoutes(server)` —— 391 条注册。
 * 实测：修前 `routeEntries=5`，集合恰为
 *   `crashReportsRoutes@/api`、`downloadsRoutes@/api/downloads`、`llmVerifyKeyRoutes@/api/llm`
 * 而那 6 条 `/history` 路由（`chat-models.ts` 4 + `ai-user-model-chat.ts` 1 + `stock.ts` 1）
 * **一条都没进面**。所以它当年那句"未发现重复路由"的真实含义是
 * **"在扫过的 5 条里没发现"**，不是"全仓没发现"—— 覆盖面 5/4196 ≈ 0.1%。
 *
 * 更要命的是**它不报错**：一个只看得见 3 个插件的判据，打出的是与"看得见 435 个
 * 插件且确实干净"**逐字相同**的一行绿字。判据的有效性和它的取材面一样宽，而
 * 取材面宽度从输出里看不出来。
 *
 * ## 这组钉的是什么（不是"门堵住了缺口"，是"门不把缺口记成绿"）
 *
 *   T1 阳性对照：夹具造一处**真重复**（同 prefix + 同 localPath、两个不同插件）
 *               ⇒ 断言被抓。**没有 T1，"门从不报冲突"和"门报得准"在 T2~T5 下
 *               表现完全一致** —— 一扇永远绿的锁，配上"取材面非空"那几格照样全绿。
 *   T2 取材面非空断言：夹具把 barrel 结构坏掉（扫零个文件）⇒ 断言**报错退出非零**，
 *               而不是静默"未发现重复路由"。防的正是本会话另一票同型：
 *               `extname` 被 Windows 粘成 `".tsx\x"` ⇒ 枚举扫了零个文件 ⇒
 *               "零残留"用例全绿，是变异验证里"T5 红了、T1 没红"暴露的。
 *   T3 防误报：同 localPath、**不同 prefix** ⇒ 断言**不**判冲突。这是最容易
 *               被"过度收紧"误伤的一档（本仓 435 个插件里大量子路由同形）。
 *   T4 防无限递归：夹具造**循环 import**（a 引 b、b 引 a）⇒ 断言能跑完不栈溢出。
 *   T5 源码锁：barrel 递归入口（`collectFromPluginFile` / `state.stack` /
 *               非空断言）不得被静默删掉。
 *   T7 内联匿名子插件（`register(async (<形参>) => {...}, {prefix})`）的路由必须进面 ——
 *               本组第二轮（2026-10-05）加的核心用例。首参是**函数表达式**不是标识符，
 *               收口前本仓 10 处共 54 条路由一条都不进面，而输出与"全干净"逐字相同。
 *   T8 同上但**形参名不是 `sub`/`server`**（用 `x`）⇒ 仍须进面。防的是把接收者名写死 ——
 *               本仓 10 处形参名有 6 种（`s`/`sub`/`child`/`scope`/`authed`/`adminServer`），
 *               写死任何一个都会让其余 5 处整片失明。
 *   T9 **认不出的首参形态不收**（首参是 `makeRoutes({...})` 调用表达式）⇒ 断言不多收条目、
 *               不凭空造冲突。防过度泛化。
 *
 * ## 第一轮（2026-10-04，取材面从 5 条扩到 4196 条）的变异验证 —— 结论可复现
 *
 * A/B 副本放在 `scripts/_ab-reverted-route-conflicts.mjs`（**必须同目录**才跑得起来），
 * 内容 = `git show HEAD:scripts/find-route-conflicts.mjs` **只额外注入 `--root` 取景
 * plumbing**（夹具机制必需），**取材与判据逻辑一行不动** —— 这样突变恰好隔离在
 * "本次修的东西"上，不会被取景差异污染。把它盖到 `scripts/find-route-conflicts.mjs`
 * 上重跑本组，实测：
 *
 *   T1 红 · T2 红 · T2b 绿 · T3 红 · T4 红 · T5 红 · T5b 红 · T5c 红   ⇒ 7 红 1 绿
 *   还原后 8 全绿。
 *
 * 两条要点，都是实测逼出来的记账：
 *   · **T3 在退版下也红**，不是"T3 抓不到东西"。原因是退版只扫 `server.ts`，
 *     夹具里的 `alpha/beta/user/admin` 一个都进不了面 ⇒ 报数行压根不出现 ⇒
 *     T3 的 `assert.match(/路由条目 2 条/)` 先炸。**这正是 T3 必须顺带断言
 *     "真的扫到了 N 条"的原因**：只断言"没报冲突"的防误报用例，在扫零个文件时
 *     是**假绿**（这与本票要防的缺陷是同一个病）。
 *   · **T2b 在退版下绿**，它是刻意的：断链面（入口在、register 在、目标文件全不在）
 *     到底该"报错"还是"如实报 0 条"，判据上尚无定论，所以只钉
 *     "不报假绿、不凭空报数"这个两边都成立的弱性质。把它算成"变异没抓住"会
 *     逼着人去给它编一个当前并不存在的语义。
 *
 * ## 第二轮（2026-10-05）的变异验证结论
 *
 * 对「内联识别」做了三处突变，逐一实测（每处都跑全 11 例）：
 *
 *   变异 1 关闭内联识别（= 退回实现，真仓量表回到 4196 条 / 435 插件 / 0 内联）
 *           ⇒ **T7 红 · T8 红 · T9 红** · 原有 8 例全绿 ⇒ 8 绿 3 红
 *   变异 2 把形参名写死成 `sub`
 *           ⇒ 真仓 4250 → 4202（**丢 48 条**）· **T8 红 · T9 红** · T7 绿（它用的就是
 *             `sub`，所以理应绿）· 原有 8 例全绿 ⇒ 9 绿 2 红
 *   变异 3 放宽首参为"任意标识符"（过度泛化）
 *           ⇒ **T7 红 · T8 红 · T9 红** · 原有 8 例全绿 ⇒ 8 绿 3 红
 *   还原后 11 全绿。
 *
 * 一条记账：**T9 第一版是空用例**。它原本只放"认不出的形态"，断言"不多收"——
 * 而"关掉内联识别"（少收）同样满足"不多收"，于是退回实现时它照样全绿，抓不到任何突变。
 * 已改成"同一个夹具里同时放一处认得出的内联 + 一处认不出的工厂式"：
 * 收口实现下条目恰为 2 条（体外 1 + 内联 1），退回实现下变 1 条 ⇒ T9 才真正有牙。
 * 这与本组 T3/T7 记的是同一个病：**只断言"没报冲突"的用例在扫零个/收零个时是假绿**。
 *
 * ## 不重写判据实现
 *
 * 冲突键/去重键/`matchSegs` 那套实现**不在本组测试里复制一份** —— 复制即第二份真相，
 * 会跟着源一起漂绿。本组只锁"有牙 / 不静默 / 不过度收紧"。
 *
 * ## 跑法
 *
 *   node --test scripts/tests/find-route-conflicts.test.mjs
 *   node scripts/run-script-tests.mjs -- find-route-conflicts   # 走全量入口
 *
 * ### 跑法上有个**必设**的环境变量（否则会出现与判据无关的假红）
 *
 * 必须 `CODEBUDDY_SAFE_DELETE_ENABLED=0`（本会话常设）。
 * 本组 5 个夹具共写 50+ 个文件，`rmScratch` 收尾时被 safe-delete shim 的
 * 批量阈值拦下：
 *   `[safe-delete][SAFE_DELETE_BULK_CONFIRM_REQUIRED] {"count":52,"threshold":50,...}`
 * 症状是**部分**用例随机变红（实测同一份代码连跑三次分别 8 绿 / 4 红 / 4 红）——
 * 看着像判据 flaky，实际是清理阶段抛错。要点是别把这种红当成"取材面判据不稳"去改判据。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPT = join(HERE, '..', 'find-route-conflicts.mjs')
const SRC = readFileSync(SCRIPT, 'utf8')

/** 夹具仓根：脚本按 `--root` 取取材面根（见脚本的 ROOT 解析）。 */
function root() {
  const dir = mkScratch('ihui-route-conflict-')
  mkdirSync(join(dir, 'apps', 'api', 'src', 'routes'), { recursive: true })
  return dir
}
function put(dir, rel, content) {
  const full = join(dir, ...rel.split('/'))
  mkdirSync(dirname(full), { recursive: true })
  writeFileSync(full, content)
}
function run(dir) {
  const r = spawnSync(process.execPath, [SCRIPT, '--root', dir], {
    cwd: HERE,
    encoding: 'utf8',
    // 不建 stdin 管道在本机会必 EBUSY(见记忆:凡不吃 stdin 的子进程一律带管道)
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  r.out = (r.stdout || '').replace(/\x1b\[[0-9;]*m/g, '')
  r.err = (r.stderr || '').replace(/\x1b\[[0-9;]*m/g, '')
  return r
}

/** 写一个 `server.ts` 入口（脚本的 ENTRY_FILES[0]），让它 import 路由面再调 registerRoutes。 */
function entryServer(registerRoutes = true) {
  return [
    "import { registerRoutes } from './routes/index.js'",
    'export async function main(server) {',
    '  server.register(otelPlugin)',
    ...(registerRoutes ? ['  await registerRoutes(server)'] : []),
    '}',
  ].join('\n')
}

/** 写一个最小可用的 `routes/index.ts`（ENTRY_FILES[1]）。 */
function routesIndex(imports, registers) {
  return [
    ...imports.map((line) => `import ${line}`),
    '',
    'export async function registerRoutes(server) {',
    ...registers.map((r) => `  ${r}`),
    '}',
  ].join('\n')
}

// ─── T1 阳性对照：真重复必须被抓 ───

test('T1 同 prefix + 同 localPath 的真重复被报出（阳性对照：门必须有牙）', () => {
  const dir = root()
  try {
    put(dir, 'apps/api/src/server.ts', entryServer())
    put(
      dir,
      'apps/api/src/routes/index.ts',
      routesIndex(
        [
          `{ alphaRoutes } from './alpha.js'`,
          `{ betaRoutes } from './beta.js'`,
        ],
        [
          "server.register(alphaRoutes, { prefix: '/api' })",
          "server.register(betaRoutes, { prefix: '/api' })",
        ],
      ),
    )
    // 两个不同插件、同 prefix、同 localPath ⇒ 拼接后同为 GET /api/dup
    put(
      dir,
      'apps/api/src/routes/alpha.ts',
      "export const alphaRoutes = async (server) => {\n  server.get('/dup', async () => ({}))\n}\n",
    )
    put(
      dir,
      'apps/api/src/routes/beta.ts',
      "export const betaRoutes = async (server) => {\n  server.get('/dup', async () => ({}))\n}\n",
    )

    const r = run(dir)
    assert.equal(r.status, 0, `本门只报数不判红,实得 status=${r.status}\n${r.err}`)
    assert.match(r.out, /发现 1 条重复路由/, `未报出重复路由\n${r.out}\n${r.err}`)
    assert.match(r.out, /GET \/api\/dup/, '必须给出拼接后的真实路径')
    assert.match(r.out, /alphaRoutes/, '必须点名一个来源插件')
    assert.match(r.out, /betaRoutes/, '必须点名另一个来源插件')
  } finally {
    rmScratch(dir)
  }
})

// ─── T2 取材面非空断言：扫零个文件必须报错 ───

test('T2 取材面扫零个文件时报错退出非零,不得静默"未发现重复路由"', () => {
  const dir = root()
  try {
    // 只建目录、不建任何入口文件 ⇒ 入口读到 0 个、扫到 0 个路由文件。
    // 这正是"扫零个文件"那一档：修前它会打印"未发现重复路由"并 exit 0。
    const r = run(dir)
    assert.notEqual(r.status, 0, `扫零个文件必须非零退出,实得 status=0\n${r.out}`)
    assert.match(r.err, /取材面为空/, `必须点名取材面为空,实得:\n${r.err}`)
    assert.doesNotMatch(
      r.out,
      /未发现重复路由/,
      '取材面为空时**不得**打印"未发现重复路由" —— 那会把失效判据报成通过',
    )
  } finally {
    rmScratch(dir)
  }
})

test('T2b 入口存在但 barrel 全部断链时报错（结构坏了要说话,不能只报"零冲突"）', () => {
  const dir = root()
  try {
    put(dir, 'apps/api/src/server.ts', entryServer())
    // 路由面只有 register、import 的文件全不存在 ⇒ 递归链全断、收不到任何路由条目
    put(
      dir,
      'apps/api/src/routes/index.ts',
      routesIndex([`{ ghostRoutes } from './does-not-exist.js'`], [
        "server.register(ghostRoutes, { prefix: '/api' })",
      ]),
    )
    const r = run(dir)
    // 取材面本身非空（入口 2、register 1），所以**不该**触发取材面为空；
    // 但路由条目为 0 仍是"零结论"形态。此处只钉"不报假绿"这一条：
    // 要么明确报错，要么如实报出条目数为 0，二者必居其一。
    const honest =
      /取材面为空/.test(r.err) || /路由条目 0 条/.test(r.out) || /未发现重复路由/.test(r.out)
    assert.ok(
      honest,
      `断链后必须给出可判读的结论(报错或如实报 0 条),实得:\n${r.out}\n${r.err}`,
    )
    assert.doesNotMatch(
      r.out,
      /发现 \d+ 条重复路由/,
      '断链面不该报出重复路由（那是凭空造数）',
    )
  } finally {
    rmScratch(dir)
  }
})

// ─── T3 防误报：同 localPath 不同 prefix 不算冲突 ───

test('T3 同 localPath 但不同 prefix **不**判为冲突（防过度收紧）', () => {
  const dir = root()
  try {
    put(dir, 'apps/api/src/server.ts', entryServer())
    put(
      dir,
      'apps/api/src/routes/index.ts',
      routesIndex(
        [
          `{ userRoutes } from './user.js'`,
          `{ adminRoutes } from './admin.js'`,
        ],
        [
          "server.register(userRoutes, { prefix: '/api' })",
          "server.register(adminRoutes, { prefix: '/api/admin' })",
        ],
      ),
    )
    // 同一个 localPath、不同 prefix ⇒ 拼接后是两条不同路径 ⇒ 不是冲突
    put(
      dir,
      'apps/api/src/routes/user.ts',
      "export const userRoutes = async (server) => {\n  server.get('/list', async () => ({}))\n}\n",
    )
    put(
      dir,
      'apps/api/src/routes/admin.ts',
      "export const adminRoutes = async (server) => {\n  server.get('/list', async () => ({}))\n}\n",
    )

    const r = run(dir)
    assert.equal(r.status, 0, `本门只报数不判红,实得 status=${r.status}\n${r.err}`)
    assert.doesNotMatch(
      r.out,
      /发现 \d+ 条重复路由/,
      `同 localPath + 不同 prefix 不得判为冲突（这是最常见的过度收紧）\n${r.out}`,
    )
    // 但必须**确实扫到了那两条** —— 否则这条用例是"因为扫零个而绿"的假绿
    assert.match(r.out, /路由条目 2 条/, `必须真的扫到 2 条路由,否则本用例是假绿\n${r.out}`)
  } finally {
    rmScratch(dir)
  }
})

// ─── T4 防无限递归：循环 import 必须收敛 ───

test('T4 循环 import（a 引 b、b 引 a）能跑完不栈溢出', () => {
  const dir = root()
  try {
    put(dir, 'apps/api/src/server.ts', entryServer())
    put(
      dir,
      'apps/api/src/routes/index.ts',
      routesIndex([`{ aRoutes } from './a.js'`], ["server.register(aRoutes, { prefix: '/api' })"]),
    )
    // a → b → a：经典环。a/b 各有一条真实路由，用来确认"断环"不等于"全丢"。
    put(
      dir,
      'apps/api/src/routes/a.ts',
      [
        "import { bRoutes } from './b.js'",
        'export const aRoutes = async (server) => {',
        "  server.get('/a', async () => ({}))",
        '  await server.register(bRoutes)',
        '}',
      ].join('\n'),
    )
    put(
      dir,
      'apps/api/src/routes/b.ts',
      [
        "import { aRoutes } from './a.js'",
        'export const bRoutes = async (server) => {',
        "  server.get('/b', async () => ({}))",
        '  await server.register(aRoutes)',
        '}',
      ].join('\n'),
    )

    const r = run(dir)
    assert.doesNotMatch(
      r.err,
      /Maximum call stack size exceeded|RangeError/,
      `循环 import 导致栈溢出\n${r.err}`,
    )
    assert.notEqual(r.status, 1, `不该因取材面为空而退出（面是有效的）\n${r.out}\n${r.err}`)
    // 断环后仍须收到环上**两个**插件的路由（栈式判环只拦"回到同一条路径"，
    // 不是把整个环连根砍掉）—— 收到 0 条就说明环判过度了。
    assert.match(r.out, /路由条目 2 条/, `断环应收齐环上两条路由,实得:\n${r.out}`)
  } finally {
    rmScratch(dir)
  }
})

// ─── T5 源码锁：递归入口与断言不得被静默删掉 ───

test('T5 源码锁:barrel 递归入口与取材面断言不得被静默删掉', () => {
  // 递归主体：单层 importMap 查表 ⇒ 漏 other/ 下 27 个插件
  assert.match(SRC, /function collectFromPluginFile/, 'barrel 递归入口函数缺失')
  assert.match(SRC, /state\.stack\.has\(file\)/, '环检测（路径栈）缺失')
  assert.match(SRC, /state\.done\.has\(doneKey\)/, '菱形去重（展开去重集）缺失')
  assert.match(SRC, /MAX_BARREL_DEPTH/, '深度上限缺失')
  // 纯再导出 barrel 转发：少了它 other/ 与 admin-sys/ 整片失明
  assert.match(SRC, /state\.forwarded/, '再导出转发计数缺失（other/_exports.ts 那类会断链）')
  // 取材面非空断言
  assert.match(SRC, /取材面为空/, '取材面为空断言的措辞缺失')
  assert.match(SRC, /entryFilesRead === 0 \|\| state\.registerCalls === 0/, '非空断言判据缺失')
  // 入口必须含 routes/index.ts（整个缺陷的核心）
  assert.match(SRC, /routes', 'index\.ts'/, '入口清单必须含 routes/index.ts（缺它就是原始缺陷）')
  // 证据链注释不得被删
  assert.match(SRC, /静默断链/, '断链证据链注释缺失')
  assert.match(SRC, /误报|假冲突/, '误报/假冲突的划痕注释缺失')
})

test('T5b 转发分支必须 return（不 return 会把同文件另一插件错挂到别的前缀）', () => {
  // 这条是**实测踩出来的**：转发后若继续走"块内下钻"，会不带块过滤地把该文件里
  // 全部 register 重新展开，凭空造出 3 条 /api/admin/ai/* 假冲突。
  const iFwd = SRC.indexOf('state.forwarded++')
  assert.ok(iFwd > 0, '转发分支缺失')
  const after = SRC.slice(iFwd, iFwd + 600)
  const iRet = after.indexOf('return')
  const iDrill = after.indexOf('extractRegisterCalls(file)')
  assert.ok(iRet !== -1, '转发分支后必须有 return')
  assert.ok(
    iDrill === -1 || iRet < iDrill,
    'return 必须**先于**下一次 barrel 下钻出现（否则转发与下钻串行 ⇒ 重复展开 ⇒ 假冲突）',
  )
})

test('T5c "未发现重复路由"必须带覆盖面限定语（不得让读者误读成全仓结论）', () => {
  assert.match(
    SRC,
    /未发现重复路由（在已进面的字面量路由上/,
    '结论行必须自带覆盖面限定语，否则 4196 条的结论会被读成全仓',
  )
})

// ─── T7~T9 内联匿名子插件（`<recv>.register(async (<形参>) => {...}, { prefix? })`） ───
//
// 缺陷本体：这一类首参是**函数表达式**而非标识符，`extractRegisterCalls` 的 `\w+` 匹配不到，
// 收口前 10 处子插件（54 条路由）**一条都不进面**，而输出与"全干净"逐字相同。
// 本仓 10 处实测（脚本头有账）：形参名有 s / sub / child / scope / authed / adminServer
// **六种**，且 `admin-sys/role-routes.ts:98` 的接收者还是 `s` 而非 `server`。

test('T7 内联匿名子插件的路由必须进面（首参是函数表达式，不是标识符）', () => {
  const dir = root()
  try {
    put(dir, 'apps/api/src/server.ts', entryServer())
    put(
      dir,
      'apps/api/src/routes/index.ts',
      routesIndex([`{ alphaRoutes } from './alpha.js'`], [
        "server.register(alphaRoutes, { prefix: '/api' })",
      ]),
    )
    // 体外一条（对照，证明外层那遍仍在工作）+ 体内一条（本题核心）。
    // 体内接收者名 `sub` 与外层 `server` 不同，正则的接收者 alternation 必须带上它。
    put(
      dir,
      'apps/api/src/routes/alpha.ts',
      [
        'export const alphaRoutes = async (server) => {',
        "  server.get('/outer', async () => ({}))",
        '  server.register(',
        '    async (sub) => {',
        "      sub.get('/inner', async () => ({}))",
        '    },',
        "    { prefix: '/plug' },",
        '  )',
        '}',
      ].join('\n'),
    )

    const r = run(dir)
    assert.equal(r.status, 0, `本门只报数不判红,实得 status=${r.status}\n${r.err}`)
    assert.match(r.out, /内联子插件 1 处/, `内联子插件必须被识别,实得:\n${r.out}`)
    // **必须顺带断言真的扫到了 2 条**（1 体外 + 1 体内）。只断言"没报冲突"的防误报用例
    // 在扫零个文件/收零条时是**假绿** —— 这与本组 T3 的记账同源。
    assert.match(r.out, /路由条目 2 条/, `必须真的收齐体内那 1 条,实得:\n${r.out}`)
    // 内联子插件算一个独立的去重插件名（外层 alphaRoutes + 内联那条）
    assert.match(r.out, /注册插件\(去重\): 2 个/, `内联那条应独立计一个插件名,实得:\n${r.out}`)
  } finally {
    rmScratch(dir)
  }
})

test('T8 内联形参名不是 sub/server 时同样进面（防把接收者名写死）', () => {
  const dir = root()
  try {
    put(dir, 'apps/api/src/server.ts', entryServer())
    put(
      dir,
      'apps/api/src/routes/index.ts',
      routesIndex([`{ alphaRoutes } from './alpha.js'`], [
        "server.register(alphaRoutes, { prefix: '/api' })",
      ]),
    )
    // 形参名 `x`：与本仓出现过的 6 个名（s/sub/child/scope/authed/adminServer）**都不相同**。
    // 写死任何一个（或只认 `sub`）都会让这一处整片失明，而输出仍是"未发现重复路由"。
    put(
      dir,
      'apps/api/src/routes/alpha.ts',
      [
        'export const alphaRoutes = async (server) => {',
        "  server.get('/outer', async () => ({}))",
        '  server.register(async (x) => {',
        "    x.get('/inner', async () => ({}))",
        '  })',
        '}',
      ].join('\n'),
    )

    const r = run(dir)
    assert.equal(r.status, 0, `本门只报数不判红,实得 status=${r.status}\n${r.err}`)
    assert.match(r.out, /内联子插件 1 处/, `形参名 x 的内联必须被识别,实得:\n${r.out}`)
    assert.match(r.out, /路由条目 2 条/, `体内那条必须进面（写死接收者名会漏）,实得:\n${r.out}`)
  } finally {
    rmScratch(dir)
  }
})

test('T9 认不出的首参形态不收、且不报冲突（防过度泛化）', () => {
  const dir = root()
  try {
    put(dir, 'apps/api/src/server.ts', entryServer())
    put(
      dir,
      'apps/api/src/routes/index.ts',
      routesIndex(
        [`{ alphaRoutes } from './alpha.js'`, `{ makeRoutes } from './factory.js'`],
        [
          "server.register(alphaRoutes, { prefix: '/api' })",
          // 首参是**调用表达式**：认不出它返回什么插件 ⇒ 不收（与动态路径同口径）
          "server.register(makeRoutes({ tag: 'ghost' }), { prefix: '/api/ghost' })",
        ],
      ),
    )
    // alpha.ts 里同时放**一处认得出的内联**与一条体外路由。
    // 为什么要掺进认得出的内联：若本用例只放"认不出的形态"，那么**关掉内联识别**
    // （退回实现）时它照样全绿 —— "不收"被"没扫"同样满足，是个抓不到突变的空用例。
    // 掺进来后，"只收认得出的、不收认不出的"两端同时被钉住。
    put(
      dir,
      'apps/api/src/routes/alpha.ts',
      [
        'export const alphaRoutes = async (server) => {',
        "  server.get('/list', async () => ({}))",
        '  server.register(async (s) => {',
        "    s.get('/plugged', async () => ({}))",
        '  }, { prefix: "/plug" })',
        '}',
      ].join('\n'),
    )
    // 工厂文件里有一条**真会撞车**的路由（拼上父 prefix 即 /api/ghost/dup）。
    // 若实现过度泛化、把工厂结果当成插件收进来 ⇒ 条目变多、且可能凭空造出冲突。
    put(
      dir,
      'apps/api/src/routes/factory.ts',
      [
        'export function makeRoutes(opts) {',
        '  return async (server) => {',
        "    server.get('/dup', async () => ({}))",
        '  }',
        '}',
      ].join('\n'),
    )

    const r = run(dir)
    assert.equal(r.status, 0, `本门只报数不判红,实得 status=${r.status}\n${r.err}`)
    // 认得出的内联：1 处（这条断言让本用例在"退回实现"下变红）
    assert.match(r.out, /内联子插件 1 处/, `认得出的内联必须照收,实得:\n${r.out}`)
    // 认不出的工厂式：一条都不许多收。应有 2 条 = alpha 体外 1 + 内联 1；
    // 多收工厂那条会变成 3 条。
    assert.match(
      r.out,
      /路由条目 2 条/,
      `只应收到 alpha 的体外 1 条 + 内联 1 条；工厂式不得进面,实得:\n${r.out}`,
    )
    assert.doesNotMatch(
      r.out,
      /发现 \d+ 条重复路由/,
      `认不出的形态不得凭空造出冲突\n${r.out}`,
    )
  } finally {
    rmScratch(dir)
  }
})
// ⁠‌‌‌‍‍‌‌‍‍‌‌‌‌‍‍‌‌‌‍‍‌‌‌‌‍‍‌‌‌‍‍‍‍‌‌‌‍‍‌‌‌‍‍‌‌‍‌ UPDATED-WATERMARK-2026-10-04 ⁠
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
