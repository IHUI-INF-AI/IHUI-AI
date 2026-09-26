// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

 
/**
 * §22c 镜像测试:scripts/check-auth-refresh-singleton.mjs
 *
 * 本票要证明的是**取材面**这一件事(2026-09-26 收口,同 36/124/93/118 口径):
 *   旧门走磁盘(readdirSync 递归 apps/packages + readFileSync),于是任何人留一个
 *   **未跟踪的构建副本**就可能被判成本仓违规;而它是 pre-commit 的**批外 blocking 步骤**,
 *   一红就把 runner 那 150+ 道门的结论整块跳过 ⇒ 一次误红的代价是全部守门对该提交作废。
 *   "回落就是把没判写成判过了"那一型也一并钉住(任一面取不到 ⇒ exit 2,不得借另一份凑数)。
 *
 * 取证方式(§22c 最后一条红线):判据的对象是"某个真实文件的形态",所以既有
 *   ① 临时 git 仓里**构造**出的三面现场(head/index/worktree 三份内容互异),
 *   ② 也有逐字取自真实形态的夹具文本,
 *   ③ 还有真仓的装车证明(候选数 > 0 才算预筛真跑过,否则"一切正常"可以是恒绿的空转)。
 *
 * 退出码口径:0 通过 / 1 判据红 / **2 无法判定**(两面旗同给、面取不到、枚举到 0 个源文件、
 * 预筛把判据字面量整类筛空)—— 2 既不冒红也不记绿。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { copyScriptWithClosure } from '../lib/scratch-module-closure.mjs'
import { gitBinary } from '../lib/face-reader.mjs'
import { __test__ as gate } from '../check-auth-refresh-singleton.mjs'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
// `__dirname` 由 `new URL('.', …)` 得来,**带尾斜杠**,所以 join(__dirname,'..') 已经是 scripts/
const SCRIPTS_DIR = join(__dirname, '..')
const GATE_FILE = 'check-auth-refresh-singleton.mjs'
const CLOSURE = ['lib/face-reader.mjs', 'lib/gitdir.mjs']

// ───────────────────────── 夹具文本(逐字贴近真实形态,不是自造语法) ─────────────────────────
/** 合法的端点定义处(白名单路径,整文件免判) */
const ENDPOINT_DEF = `export async function refreshAccessToken(rt: string) {
  return fetchApiShared('/auth/refresh', { rt })
}
`
/** 走单例的正常代码(含 refreshAccessTokenOnce,规则 3 明确放过) */
const SINGLETON_USE = `const next = await refreshAccessTokenOnce(currentRefreshToken)
export async function refreshAccessToken(rt: string) { return null }
`
/** 违规形态 A:直发 /auth/refresh(规则 1/2) */
const BAD_DIRECT = `export async function forceRefresh() {
  return fetchApi('/auth/refresh', { method: 'POST' })
}
`
/** 违规形态 B:裸调 endpoint 函数(规则 3) */
const BAD_BARE = `export async function retry() {
  return refreshAccessToken(rt)
}
`
/** extension 合法刷新域:doRefresh 内的裸调用(自带 inFlight 去重) */
const EXT_DO_REFRESH = `export async function doRefresh() {
  const t = await refreshAccessToken(rt)
  return t
}
export async function otherThing() {
  const u = await refreshAccessToken(rt)
  return u
}
`

const CLEAN_TREE = {
  'packages/api-client/src/endpoints/auth.ts': ENDPOINT_DEF,
  'apps/web/src/hooks/use-auth.ts': SINGLETON_USE,
}

// ───────────────────────── 临时 git 仓 ─────────────────────────
function git(cwd, ...args) {
  return execFileSync(
    gitBinary(),
    [
      '-c', 'safe.directory=*',
      '-c', 'core.quotepath=false',
      '-c', 'core.autocrlf=false',
      '-c', 'user.name=gate-fixture',
      '-c', 'user.email=gate-fixture@invalid',
      '-C', cwd,
      ...args,
    ],
    { encoding: 'utf8', windowsHide: true, timeout: 120000, stdio: ['ignore', 'pipe', 'pipe'] }
  )
}

/**
 * 造一个**已提交**的临时仓(默认档判 HEAD,夹具不提交就每条用例都红在"HEAD 取不到",
 * 那是夹具失效不是门坏了)。返回仓根目录。
 */
function createRepo(files, { commit = true } = {}) {
  const dir = mkScratch('auth-refresh-gate')
  copyScriptWithClosure(SCRIPTS_DIR, GATE_FILE, join(dir, 'scripts'), CLOSURE)
  for (const [rel, text] of Object.entries(files)) {
    const abs = join(dir, rel)
    mkdirSync(abs.slice(0, abs.lastIndexOf('/')), { recursive: true })
    writeFileSync(abs, text, 'utf8')
  }
  git(dir, 'init', '-q')
  git(dir, 'add', '-A')
  if (commit) git(dir, 'commit', '-q', '-m', 'fixture')
  return dir
}

function runScript(dir, args = []) {
  return spawnSync(process.execPath, [join(dir, 'scripts', GATE_FILE), ...args], {
    cwd: dir,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 240000,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

function assertGreen(r, label) {
  assert.equal(r.status, 0, `${label}:应 exit 0,实得 ${r.status}\nstdout:${r.stdout}\nstderr:${r.stderr}`)
  assert.match(r.stdout, /✅ 无绕过单例的裸 refresh 调用/, `stdout:${r.stdout}`)
}

function assertRed(r, label, expectText) {
  assert.equal(r.status, 1, `${label}:应 exit 1,实得 ${r.status}\nstdout:${r.stdout}\nstderr:${r.stderr}`)
  assert.match(r.stderr, /发现 \d+ 处绕过单例的裸 refresh 调用/, `stderr:${r.stderr}`)
  assert.match(r.stderr, /合计 \d+ 处违规\(.*取材面:/, `末行必须写明取材面\nstderr:${r.stderr}`)
  if (expectText) assert.ok(r.stderr.includes(expectText), `必须点名 ${expectText}\nstderr:${r.stderr}`)
}

function assertUndetermined(r, label, re) {
  assert.equal(r.status, 2, `${label}:应 exit 2(无法判定),实得 ${r.status}\nstdout:${r.stdout}\nstderr:${r.stderr}`)
  assert.match(r.stderr, /无法判定/, `stderr:${r.stderr}`)
  assert.doesNotMatch(r.stdout, /✅/, '"无法判定"那一轮绝不许同时打出通过消息\nstdout:' + r.stdout)
  if (re) assert.match(r.stderr, re, `stderr:${r.stderr}`)
}

// ════════════════════════ T1 纯函数:默认面必须是 head ════════════════════════
test('T1 faceFromArgv 默认必须是 head,四态齐全(把默认面改回磁盘的那一刻本条必红)', () => {
  assert.equal(gate.faceFromArgv([]).face, 'head', '默认档回到磁盘 = 本门又在判滞后工作树/未跟踪副本')
  assert.equal(gate.faceFromArgv(['--staged']).face, 'staged')
  assert.equal(gate.faceFromArgv(['--worktree']).face, 'worktree')
  const both = gate.faceFromArgv(['--staged', '--worktree'])
  assert.equal(both.face, null)
  assert.match(String(both.error), /互斥/)
  assert.ok(gate.FACE_TXT.head && gate.FACE_TXT.staged && gate.FACE_TXT.worktree, '三面文案都得在位')
})

// ════════════════════ T2 预筛命令形状(--cached 位置) ════════════════════
test('T2 grepArgsFor:--cached 必须排在模式串之前(写反 ⇒ fatal: unable to resolve revision,而兜底把它吞成"慢但绿")', () => {
  const staged = gate.grepArgsFor('staged')
  const iCached = staged.indexOf('--cached')
  const iPat = staged.indexOf(gate.PREFILTER_PATTERN)
  assert.ok(iCached >= 0, '索引面必须带 --cached')
  assert.ok(iPat >= 0 && iCached < iPat, `--cached(${iCached}) 必须在模式串(${iPat}) 之前: ${staged.join(' ')}`)
  const head = gate.grepArgsFor('head')
  assert.ok(head.indexOf('HEAD') >= 0, 'HEAD 面必须显式给 rev')
  assert.ok(head.indexOf('--cached') === -1, 'HEAD 面不许混进 --cached(那是索引的 rev 形态)')
  // 构造反例:把 --cached 挪到 pattern 之后就是那个真实写错的形状
  const wrong = gate.grepArgsFor('staged').slice()
  wrong.splice(wrong.indexOf('--cached'), 1)
  wrong.splice(wrong.indexOf(gate.PREFILTER_PATTERN) + 1, 0, '--cached')
  assert.ok(wrong.indexOf('--cached') > wrong.indexOf(gate.PREFILTER_PATTERN))
  const dir = createRepo(CLEAN_TREE)
  try {
    // 真实 git 在错误形状下会 exit 128(不是 1),这正是要被形状锁拦住的形态
    assert.throws(() => git(dir, ...wrong), (e) => /unable to resolve revision/.test(String(e?.stderr ?? e)))
  } finally {
    rmScratch(dir)
  }
})

// ════════════════════ T3 预筛模式串必须是判据字面量的超集 ════════════════════
test('T3 预筛超集对账:每条判据能命中的行,预筛也必看得见(漏一个 ⇒ 门对自己立项那一型全盲)', () => {
  const superset = new RegExp(gate.PREFILTER_PATTERN)
  const samples = [
    ["  return fetchApi('/auth/refresh', { method: 'POST' })", 'direct-fetch'],
    ['  return refreshAccessToken(rt)', 'bare-refreshAccessToken'],
    ['  return fetchApiShared("/api/auth/refresh")', 'direct-fetch'],
  ]
  for (const [line, rule] of samples) {
    const hits = gate.findViolations('apps/mobile-rn/src/lib/x.ts', line)
    assert.ok(hits.some((h) => h.rule === rule), `判据看不见这一行,夹具无效:${line}`)
    assert.ok(superset.test(line), `预筛模式串漏了这一行的字面量(${rule}) ⇒ 该形态会在预筛那一步被筛掉:${line}`)
  }
})

// ════════════════════ T4 纯判据:三条规则 + 白名单 ════════════════════
test('T4 findViolations 阳性对照:直发 /auth/refresh 与裸调 endpoint 函数都判红并点名行号', () => {
  const a = gate.findViolations('apps/mobile-rn/src/lib/token.ts', BAD_DIRECT)
  assert.equal(a.length, 1, JSON.stringify(a))
  assert.equal(a[0].rule, 'direct-fetch')
  assert.equal(a[0].line, 2)
  const b = gate.findViolations('apps/web/src/hooks/use-auth.ts', BAD_BARE)
  assert.equal(b.length, 1, JSON.stringify(b))
  assert.equal(b[0].rule, 'bare-refreshAccessToken')
})

test('T4b findViolations 白名单:注释行/单例/定义处/MCP OAuth/tokenProvider 注入/后端/测试 全放过', () => {
  const exempt = [
    ['// 以前这里 fetch(  /auth/refresh ) 过,现已收口', '注释行'],
    ['  await refreshAccessTokenOnce(rt)', '单例'],
    ['export async function refreshAccessToken(rt) {}', '定义行不是调用'],
    ['  const t = await refreshAccessToken(oauthConfig, refreshToken)', 'MCP OAuth 两参签名(裸标识符首参)'],
    ['  const t = await refreshAccessToken(config, rt)', 'MCP OAuth config 首参'],
  ].map(([line, why]) => [gate.findViolations('apps/web/src/a.ts', line).length, why])
  for (const [n, why] of exempt) assert.equal(n, 0, `${why} 不该判红`)
  // 已知豁免边界(如实登记,不当成"已修"):豁免只认「首参是裸标识符 + 逗号」这一形状。
  // `makeOAuthConfig(), rt`(先调用再传)不在豁免内 ⇒ 若有人这么写会被判红。
  // 现网 HEAD/index 两面实测 0 处,所以它不是存量债;真出现时要么带理由补豁免、要么改走单例。
  assert.equal(
    gate.findViolations('apps/cli/src/tools/mcp-oauth.ts', '  const t = await refreshAccessToken(makeOAuthConfig(), rt)').length,
    1,
    '豁免形状收窄了 ⇒ 这一格会从"判红"变成"放过",本条把收窄动作变成可见的决定'
  )
  // tokenProvider 注入回调(web api.ts 的单例实现载体)
  assert.equal(gate.findViolations('apps/web/src/lib/api.ts', '  refreshAccessToken: async () => fetchApiShared("/auth/refresh")').length, 0)
  // 路径白名单:后端 / 测试 / 端点定义处
  assert.equal(gate.findViolations('apps/api/src/routes/auth.ts', BAD_DIRECT).length, 0, 'apps/api 属服务端风暴域外')
  assert.equal(gate.findViolations('packages/auth/src/refresh.ts', BAD_BARE).length, 0, 'packages/auth 同上')
  assert.equal(gate.findViolations('apps/web/tests/mock.ts', BAD_DIRECT).length, 0, 'tests 目录放过')
  assert.equal(gate.findViolations('apps/web/src/a.spec.ts', BAD_DIRECT).length, 0, '*.spec.* 放过')
  assert.equal(gate.findViolations('packages/api-client/src/endpoints/auth.ts', BAD_DIRECT).length, 0, '端点定义处整文件免判')
  // extension doRefresh 自带 inFlight 去重:体内放过、体外仍判
  const within = gate.findViolations('apps/extension/lib/token-utils.ts', EXT_DO_REFRESH)
  assert.equal(within.length, 1, `doRefresh 体外那一处必须仍判红:${JSON.stringify(within)}`)
  assert.equal(within[0].line, 6, `必须点名 otherThing 里的那一行:${JSON.stringify(within)}`)
})

// ═════════════ 核心:未跟踪的构建副本不得被判违规(本票立项那一型) ═════════════
test('T5 反恒红对照:未跟踪的构建副本三面全绿,而同一份内容一进索引立刻判红(证明判据看得见)', () => {
  const dir = createRepo(CLEAN_TREE)
  try {
    // ① 未跟踪副本:RN 的 .expo 缓存 + 一份备份目录 + 一份"从别处拷回来的旧源码"
    const copies = {
      'apps/mobile-rn/.expo/index.js': BAD_DIRECT,
      'apps/web/.next-rollback/src/lib/old.ts': BAD_BARE,
      'packages/shared/dist/bundle.js': BAD_DIRECT,
    }
    for (const [rel, text] of Object.entries(copies)) {
      const abs = join(dir, rel)
      mkdirSync(abs.slice(0, abs.lastIndexOf('/')), { recursive: true })
      writeFileSync(abs, text, 'utf8')
    }
    // 旧门(readdirSync 磁盘遍历)在这里必判红;收口后三档都必须绿
    assertGreen(runScript(dir), '默认档(HEAD)')
    assertGreen(runScript(dir, ['--staged']), '--staged(索引)')
    assertGreen(runScript(dir, ['--worktree']), '--worktree(清单仍按索引,磁盘副本不进视野)')

    // ② 有牙证明:同一份内容一旦进索引,--staged 必须当场判红 ——
    //    "副本被放过"的原因是**它不进判定面**,不是判据看不见这类代码。
    git(dir, 'add', '-f', '--', 'apps/mobile-rn/.expo/index.js')
    const staged = runScript(dir, ['--staged'])
    assertRed(staged, '已入索引的同款违规', 'apps/mobile-rn/.expo/index.js:2')
    // 而默认档(HEAD)不受索引里这一份影响:两面各判各的
    assertGreen(runScript(dir), '同瞬间默认档仍判 HEAD(未进 HEAD 的内容不许被算进 HEAD 的结论)')

    // ③ 与旧磁盘遍历的**目录名黑名单**保持同形:真把构建产物提交了也不判(那是产物不是源码)。
    //    登记这一条是因为它同时是一道已知边界 —— 有人把源码藏进 dist/ 提交,本门刻意看不见。
    git(dir, 'rm', '--cached', '-q', '-f', '--', 'apps/mobile-rn/.expo/index.js')
    git(dir, 'add', '-f', '--', 'packages/shared/dist/bundle.js')
    assertGreen(runScript(dir, ['--staged']), 'dist/ 形态即便入面也按旧黑名单放过(边界,如实登记)')
  } finally {
    rmScratch(dir)
  }
})

// ═════════════ 三面三答:仅磁盘脏 / 索引脏而磁盘干净 ═════════════
test('T6 取材面证明:仅磁盘脏⇒--staged 绿而 worktree 红;索引脏(磁盘已改回干净)⇒--staged 红而 HEAD/worktree 绿', () => {
  const REL = 'apps/web/src/hooks/use-auth.ts'
  const dir = createRepo(CLEAN_TREE)
  try {
    // —— 现场 B(先做):只躺在磁盘上的半编辑态,没有 add
    writeFileSync(join(dir, REL), BAD_DIRECT, 'utf8')
    assertGreen(runScript(dir, ['--staged']), '只躺在磁盘上的改动不是这次提交的内容 —— 不得钉红无关提交')
    assertGreen(runScript(dir), 'HEAD 面同样不受磁盘影响')
    assertRed(runScript(dir, ['--worktree']), '逃生舱档读磁盘', REL + ':2')

    // —— 现场 A:索引脏(这次提交会带走违规),磁盘随后被改回干净
    git(dir, 'add', '--', REL)
    writeFileSync(join(dir, REL), SINGLETON_USE, 'utf8')
    assertRed(runScript(dir, ['--staged']), '索引脏', REL + ':2')
    assertGreen(runScript(dir), 'HEAD 面(索引脏不影响它)')
    assertGreen(runScript(dir, ['--worktree']), '磁盘已被改回干净 ⇒ 逃生舱档判绿')
  } finally {
    rmScratch(dir)
  }
})

// ═════════════ 两面旗同给 / 无提交 / 空清单:一律判死,不记绿 ═════════════
test('T7 两面旗同给 ⇒ exit 2(两个判定面互斥,任选一面都是冒充)', () => {
  const dir = createRepo(CLEAN_TREE)
  try {
    assertUndetermined(runScript(dir, ['--staged', '--worktree']), '两面旗同给', /互斥/)
  } finally {
    rmScratch(dir)
  }
})

test('T8 有仓无提交 ⇒ 默认档 exit 2 无法判定;同瞬间 --staged 照常可判(判死精确绑定缺失的那一面)', () => {
  const dir = createRepo(CLEAN_TREE, { commit: false })
  try {
    assertUndetermined(runScript(dir), '无 HEAD 的默认档', /HEAD/)
    assertGreen(runScript(dir, ['--staged']), '索引在位时 --staged 仍可判')
  } finally {
    rmScratch(dir)
  }
})

test('T9 空清单判死:面里一个源文件都没有 ⇒ exit 2,绝不打"✅ 无违规"(空扫不是通过)', () => {
  const dir = createRepo({ 'README.md': '# 只有文档,没有任何 apps/packages 源文件\n' })
  try {
    assertUndetermined(runScript(dir), '默认档空清单', /枚举到 0 个/)
    assertUndetermined(runScript(dir, ['--staged']), '索引面空清单', /枚举到 0 个/)
    assertUndetermined(runScript(dir, ['--worktree']), '逃生舱档空清单', /枚举到 0 个/)
  } finally {
    rmScratch(dir)
  }
})

test('T9b 预筛筛空也判死:文件在面上却一个字面量都不含 ⇒ 判据失明,不是"没有违规"', () => {
  const dir = createRepo({ 'apps/web/src/nothing.ts': 'export const a = 1\n', 'README.md': '# x\n' })
  try {
    assertUndetermined(runScript(dir), '面上有文件却零命中', /判据失明/)
  } finally {
    rmScratch(dir)
  }
})

// ═════════════ 形状锁:磁盘管子不得回来 ═════════════
/**
 * 形状锁的匹配面 = **剥注释后的代码面**。头注必须能解释"旧门为什么错",而说明性文字
 * 会把这些标识符原样写出来(本仓记过同型:注释里逐字写出块注释序列,把 `node --check` 炸了)。
 * 只在代码面上判回潮,才既拦得住真管子、又不逼作者把注释删掉。
 */
function codeFace(src) {
  return src
    .split('\n')
    .filter((l) => {
      const t = l.trim()
      return !(t.startsWith('//') || t.startsWith('*') || t.startsWith('/*') || t.startsWith('<!--'))
    })
    .join('\n')
}

test('T10 形状锁:门本体的代码面不得再出现磁盘遍历/磁盘直读,取材必须走共用层的 batch + readWorktreeFile', () => {
  const src = codeFace(readFileSync(join(SCRIPTS_DIR, GATE_FILE), 'utf8'))
  assert.doesNotMatch(src, /readdirSync/, '磁盘目录遍历又被写回来了(未跟踪副本进视野的那条路)')
  assert.doesNotMatch(src, /statSync/, '磁盘 stat 同上')
  assert.doesNotMatch(src, /readFileSync\(/, '门本体不得自带磁盘读取 —— 磁盘面只走层的 readWorktreeFile')
  assert.doesNotMatch(src, /from 'node:fs'/, 'node:fs 一旦回来,磁盘判据就有第二次机会')
  assert.match(src, /from '\.\/lib\/face-reader\.mjs'/, '取材必须走共用层(绝对路径 git/超时/截断都由层兜)')
  assert.match(src, /catBatch\(/, '清单与正文必须一次 batch 同面同轮读完(混面会产出假红/假绿)')
  assert.match(src, /readWorktreeFile\(/, '逃生舱档的内容也必须走层,不许自己开磁盘句柄')
  assert.match(src, /def: 'head'/, '默认档必须钉在 head,不许各写各的')
  assert.match(src, /assertRepoRoot\(/, '根必须是仓库根(子目录当根会让清单与相对路径基准错位,产出"自洽却错位"的绿)')
  // 反向对照:代码面锁不是恒真式 —— 同一把尺子量到旧形态(磁盘遍历)时必须红。
  assert.match(codeFace("import { readdirSync } from 'node:fs'\nconst d = readdirSync(x)\n"), /readdirSync/)
})

// ═════════════ 守门 118 的分类:本门必须被分到 face ═════════════
test('T12 取材面纪律对账:守门 118 把本门判为 face(改回磁盘判料就会被它点名)', async () => {
  const mod = await import('../check-gate-face-discipline.mjs')
  const src = readFileSync(join(SCRIPTS_DIR, GATE_FILE), 'utf8')
  const verdict = mod.classify('scripts/check-auth-refresh-singleton.mjs', src)
  assert.equal(
    verdict.kind,
    'face',
    `本门必须走取材层的读取入口,实得 ${verdict.kind} / ${verdict.why}`
  )
  // 反向对照:同一把尺子量**迁移前**的形状必须不是 face —— 否则"判到 face"这条断言恒真。
  const oldShape = [
    "import { readFileSync, readdirSync } from 'node:fs'",
    "const root = join(dirname(fileURLToPath(import.meta.url)), '..')",
    'function collect(dir){for(const n of readdirSync(dir)){readFileSync(join(dir,n),"utf8")}}',
  ].join('\n')
  const oldVerdict = mod.classify('scripts/check-auth-refresh-singleton.mjs', oldShape)
  assert.notEqual(oldVerdict.kind, 'face', `磁盘判料的旧形状不该被判 face:${JSON.stringify(oldVerdict)}`)
})

// ═════════════ 真仓装车证明(不依赖夹具:证明这条链在真仓上真跑) ═════════════
test('T11 真仓装车:默认面与索引面都跑得出非空候选集,且此刻结论为绿(候选为 0 就是空转)', () => {
  const scriptPath = join(SCRIPTS_DIR, GATE_FILE)
  for (const extra of [[], ['--staged']]) {
    const r = spawnSync(process.execPath, [scriptPath, ...extra], {
      cwd: join(SCRIPTS_DIR, '..'),
      encoding: 'utf8',
      windowsHide: true,
      timeout: 240000,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    assert.equal(r.status, 0, `${extra.join(' ') || '(默认档)'} 实得 ${r.status}\nstderr:${r.stderr}`)
    const m = /扫描 (\d+) 个候选 \/ 枚举 (\d+) 个源文件/.exec(r.stdout)
    assert.ok(m, `结论行必须带候选/枚举计数(没有计数就无法区分"扫过"与"空转")\nstdout:${r.stdout}`)
    assert.ok(Number(m[1]) > 0 && Number(m[2]) >= Number(m[1]), `候选集必须非空且不大于枚举集:${m[0]}`)
    assert.match(r.stdout, /取材面:(HEAD blob|索引 blob)/, `结论行末必须写明取材面\nstdout:${r.stdout}`)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
