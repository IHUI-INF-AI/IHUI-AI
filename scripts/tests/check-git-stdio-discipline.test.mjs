// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 守门(check-git-stdio-discipline.mjs)的 §22c 镜像测试。
//
// 为什么每例都存在:本门守的是"派生面 EBUSY"这一型 —— 它**没有任何编译期症状**
// (typecheck / lint / 测试全绿),表现是运行时 0/30 的 EBUSY。而门自身有四种
// "看起来正常其实失明"的方式,且它们**全都只表现为报绿**:
//   ① 注册块被摘线(门存在但没人调度 = 没有);
//   ② 判据退回逐行匹配(prettier 一折行就失明 —— 本仓已吃过这个大亏);
//   ③ 射程退回静态清单(只扫登记过的文件 = 假绿);
//   ④ 豁免通道被换成行内注释(看不见的通道必然被当成"已经解决过")。
// 所以必须用源码锁把每一格钉住。
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

import {
  EXEMPTIONS_FILE,
  SCAN_ROOTS,
  SELF_EXEMPT,
  STDIO_PROP,
  callSpan,
  exemptedBy,
  evaluate,
  isGitLikeName,
  isSelfExempt,
  isSourceFile,
  isStringCommand,
  judgeSpan,
  listScoped,
  loadExemptions,
  markHidden,
  maskComments,
  scanSource,
  splitArgs,
  verdictText,
} from '../check-git-stdio-discipline.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const RUNNER = join(REPO, 'scripts', 'guardian-runner.mjs')
const SRC = join(REPO, 'scripts', 'check-git-stdio-discipline.mjs')

// id 189:注册前实测 `id:` 已用集合的最大值是 188(已被 check-authorization-column-isolation 占用),
// 189..215 空闲。刻意不沿用"最大 id + 1"的想当然 —— 188 就是这么被占的,
// 而撞号会把 skipEnv 语义与"哪道门失败"的归因搅在一起(runner 自身的 id 唯一性自检已记过这件事)。
const GATE_ID = '193' // 2026-10-07 现读对齐:runner 里本门现行编号 193(曾为 189,门重编号后镜像测试未跟上,T1 失步)

function runNode(args, timeout = 600000) {
  // ⚠️ `stdio` 不是可选的:本机派生面 EBUSY 病灶(不写 stdio ⇒ 0/30 成功)对 **node 自身**同样成立。
  // 本helper 最初漏了它,于是 T14 在写这一行的地方直接 `spawnSync node.exe EBUSY` ——
  // 被本门判的那个病,先在判门的人身上发作了。这也是为什么本门坚持"门自己不许踩自己判的坑"。
  return execFileSync(process.execPath, args, {
    cwd: REPO,
    encoding: 'utf8',
    maxBuffer: 1 << 28,
    windowsHide: true,
    timeout,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

// ── T1 装车证明:runner 里必须有本门,且 blocking + skipEnv 齐备 ──────────────────
test('T1 装车证明:runner 里必须有本门,且 blocking + skipEnv 齐备', () => {
  const src = readFileSync(RUNNER, 'utf8')
  const at = src.indexOf(`id: '${GATE_ID}'`)
  assert.ok(at >= 0, `守门 ${GATE_ID} 不在 runner 里 —— 门存在但没人调度 = 没有(§22c 反复记过)`)
  const block = src.slice(at, at + 3000)
  assert.ok(
    block.includes("script: 'check-git-stdio-discipline.mjs'"),
    `id ${GATE_ID} 指向的不是本门`,
  )
  assert.ok(
    block.includes("mode: 'blocking'"),
    '必须 blocking:本门判的是 EBUSY 病灶, warn 等于不判',
  )
  assert.ok(
    /skipEnv: 'HUSKY_SKIP_GIT_STDIO_DISCIPLINE'/.test(block),
    '缺 skipEnv:红起来就没有逃生舱',
  )
})

// ── T2 摘线必红(变异自证)──────────────────────────────────────────────────────
// 判据:把注册块整段拿掉,断言"装车检查"这一格确实依赖它存在。
test('T2 摘线变异必红:注册块不在 runner 里时 T1 的前提不成立', () => {
  const src = readFileSync(RUNNER, 'utf8')
  const stripped = src.replace(new RegExp(`\\{\\s*id: '${GATE_ID}'[\\s\\S]*?\\n  \\},\\n`), '')
  assert.ok(
    !stripped.includes(`id: '${GATE_ID}'`),
    '变异未生效:注册块没被摘掉(正则与 runner 现状不符,本用例已失去意义)',
  )
  assert.ok(
    stripped.includes("script: 'check-git-read-timeout.mjs'"),
    '旁证:门 80 的注册块仍在,说明只摘了本门这一块',
  )
})

// ── T3 判据有牙:三类缺陷形态各自必须判红 ──────────────────────────────────────
test('T3 判据有牙:A / C / viaCmd 三族各判红,合规形态归零', () => {
  const EF = 'execFileSync'
  const ES = 'execSync'
  const j = (src) => judgeSpan(callSpan(src, src.indexOf('(')), src.includes(`${ES}(`))
  // A 类
  assert.equal(j(`${EF}('git', ['ls-files'], { encoding: 'utf8' })`).verdict, 'noStdio')
  // C 类 —— 绝对路径形态不是豁免
  for (const bin of [
    'GIT_BIN',
    'GIT',
    'gitBin',
    'gitPath',
    'gitExe',
    'gitBinary()',
    'resolveGitBin()',
  ]) {
    assert.equal(
      j(`${EF}(${bin}, ['status'], { encoding: 'utf8' })`).verdict,
      'noStdio',
      `${bin} 漏判`,
    )
  }
  // viaCmd(另一副面孔)
  assert.equal(j(`${ES}('git status', { encoding: 'utf8' })`).verdict, 'viaCmd')
  // 合规:两种取值都合规(判据只认属性名)
  assert.equal(j(`${EF}('git', ['ls-files'], { stdio: ['ignore', 'pipe', 'pipe'] })`).verdict, 'ok')
  assert.equal(
    j(`${EF}('git', ['ls-files'], { input: 'x', stdio: ['pipe', 'pipe', 'pipe'] })`).verdict,
    'ok',
    '喂 stdin 的 pipe 三元必须合规(face-reader:94 的两态)',
  )
  // 反向对照(证明不是恒红):同一形态补上 stdio 归零
  assert.equal(
    j(`${EF}('git', ['ls-files'], { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' })`)
      .verdict,
    'ok',
  )
})

// ── T4 设计命门:prettier 折行不改判据(两个方向)──────────────────────────────
// 这是本门存在的**第一原则**。本仓吃过"源码正则自检判据被 prettier 折行改瞎"的大亏,
// 所以这一格必须双向钉:折行不得把合规改成判红,也不得把判红改成合规。
test('T4prettier 折行不改判据:合规向与判红向双向成立', () => {
  const EF = 'execFileSync'
  const okOne = `${EF}('git', ['ls-files'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })`
  const okFolded = [
    `${EF}(`,
    `  'git',`,
    `  ['ls-files'],`,
    `  {`,
    `    encoding: 'utf8',`,
    `    stdio: ['ignore', 'pipe', 'pipe'],`,
    `  },`,
    `)`,
  ].join('\n')
  const badOne = `${EF}('git', ['ls-files'], { encoding: 'utf8', windowsHide: true })`
  const badFolded = [
    `${EF}(`,
    `  'git',`,
    `  ['ls-files'],`,
    `  {`,
    `    encoding: 'utf8',`,
    `    windowsHide: true,`,
    `  },`,
    `)`,
  ].join('\n')
  assert.equal(scanSource(okOne).misses.length, 0, '单行合规形态应 0')
  assert.equal(scanSource(okFolded).misses.length, 0, '折行后合规形态结论变了 ⇒ 判据被折行改瞎')
  assert.equal(scanSource(badOne).misses.length, 1, '单行判红形态应 1')
  assert.equal(scanSource(badFolded).misses.length, 1, '折行后漏判 ⇒ 逐行匹配的旧病复发')
})

// ── T5 判据落在该次调用的 options 内,不被同文件另一处合规洗白 ──────────────────
// 依据:scripts/check-root-dir-clean.mjs 现存该形态(:265/:281 合规而 :75 裸奔)。
test('T5 同文件内合规调用不得洗白裸奔调用', () => {
  const src = [
    `const good = execFileSync('git', ['ls-files'], { stdio: ['ignore', 'pipe', 'pipe'] })`,
    `const bad = execFileSync('git', ['status'], { encoding: 'utf8' })`,
  ].join('\n')
  const r = scanSource(src)
  assert.equal(r.misses.length, 1, `期望恰好 1 处判红,实得 ${JSON.stringify(r.misses)}`)
  assert.equal(r.misses[0].line, 2, '判红的必须是第 2 行那处裸奔,不是第 1 行')
  // 顺序颠倒也不得改变结论(判据不是"文件里有没有 stdio")
  const rev = scanSource([src.split('\n')[1], src.split('\n')[0]].join('\n'))
  assert.equal(rev.misses.length, 1)
  assert.equal(rev.misses[0].line, 1, '顺序颠倒后判红应落在第 1 行那处')
})

// ── T6 注释/字符串里的 stdio 不算数(否则违规被静默洗白)───────────────────────
test('T6 注释与字符串字面量里的 stdio 都不算数', () => {
  const EF = 'execFileSync'
  // 注释里
  const withComment = `${EF}('git', ['x'], { encoding: 'utf8' /* stdio: ['pipe'] */ })`
  assert.equal(scanSource(withComment).misses.length, 1, '注释里的 stdio 被误当属性')
  // 行注释里
  const withLineComment = [
    `${EF}('git', ['x'], {`,
    `  encoding: 'utf8', // stdio: 'pipe'`,
    `})`,
  ].join('\n')
  assert.equal(scanSource(withLineComment).misses.length, 1, '行注释里的 stdio 被误当属性')
  // 字符串值里(键名是 stdio 但整体是字符串)
  const strKey = `${EF}('git', ['x'], { env: { NOTE: 'stdio: pipe' }, encoding: 'utf8' })`
  assert.equal(scanSource(strKey).misses.length, 1, '字符串内容里的 stdio 被误当属性')
  // 反向:真属性放行
  assert.equal(
    scanSource(`${EF}('git', ['x'], { stdio: ['ignore', 'pipe', 'pipe'] })`).misses.length,
    0,
  )
  // maskComments 不得吃掉字符串(首参仍要可读)
  assert.equal(
    isStringCommand(maskComments(`('git status', {})`)),
    true,
    'maskComments 吃掉了字符串',
  )
  assert.equal(isStringCommand(`('git status', {})`), true)
})

// ── T7 GIT_BASH 是 bash 不是 git(错归因比漏判更坏)─────────────────────────────
test('T7 GIT_BASH 不得判红也不得进 unknownBinary', () => {
  const src = `const a = spawnSync(GIT_BASH, ['/c', 'mklink', '/J', x, y], { windowsHide: true })`
  const r = scanSource(src)
  assert.equal(r.misses.length, 0, `bash 被当成 git 派生判红:${JSON.stringify(r.misses)}`)
  assert.equal(r.skipped.length, 0, `bash 被计入 unknownBinary:${JSON.stringify(r.skipped)}`)
  assert.equal(isGitLikeName('GIT_BASH'), false)
  assert.equal(isGitLikeName('gitBin'), true)
  assert.equal(isGitLikeName('myGitRunner'), true)
  // 反向对照:真 git 变量形态仍判红(证明不是把整个 GIT_ 族放行)
  assert.equal(
    scanSource(`const a = spawnSync(GIT_BIN, ['status'], { windowsHide: true })`).misses.length,
    1,
  )
})

// ── T8 射程不得退回静态清单,且必须覆盖 scripts 与 scripts/lib ─────────────────
test('T8 射程是目录前缀,覆盖 scripts 与 scripts/lib,且含两面的跟踪文件', () => {
  assert.ok(Array.isArray(SCAN_ROOTS) && SCAN_ROOTS.length > 0, 'SCAN_ROOTS 为空 ⇒ 射程塌陷')
  for (const r of SCAN_ROOTS) {
    assert.ok(
      !isSourceFile(r),
      `SCAN_ROOTS 的 ${r} 带源码扩展名 ⇒ 这是文件清单不是目录前缀(清单会漏)`,
    )
  }
  const files = listScoped(REPO, 'head')
  assert.ok(files.length > 500, `HEAD 面只枚举到 ${files.length} 个文件,射程疑似塌陷`)
  assert.ok(
    files.some((f) => f.startsWith('scripts/lib/')),
    '射程未覆盖 scripts/lib/',
  )
  assert.ok(
    files.some((f) => f.startsWith('scripts/') && !f.startsWith('scripts/lib/')),
    '射程未覆盖 scripts/ 根下',
  )
  // 必须真含 lib 文件(不只是路径前缀对)
  assert.ok(
    files.includes('scripts/lib/face-reader.mjs'),
    'scripts/lib/face-reader.mjs 不在射程内 —— lib 面前缀形同虚设',
  )
})

// ── T9 豁免通道只能是具名数据文件;行内注释不是通道 ───────────────────────────
test('T9 豁免只认具名数据文件,且坏形态/ 已过期一律不豁免', () => {
  assert.ok(
    EXEMPTIONS_FILE.endsWith('.json') && EXEMPTIONS_FILE.includes('scripts/'),
    `豁免通道必须是 scripts/ 下的具名 JSON 数据文件,实得 ${EXEMPTIONS_FILE}`,
  )
  // 门源码里不得出现"读行内豁免注释"的实现(判据本体不得消费源码注释)。
  // ⚠️ 只看**代码区**(`__test__` 之前的实现段)之外的注释不算 —— 门文件头**必须**把
  // "为什么禁行内豁免"写在注释里(那是本票的交付项之一),而那段文字里出现
  // `stdio-ok` 这类**被禁标记的名字**是应该的(它在说明"这种标记不被读")。
  // 所以这里断言的是**没有读取实现**:全文件不得出现把该标记取出来当豁免判据的代码形态。
  const src = readFileSync(SRC, 'utf8')
  assert.ok(
    !/\b(?:match|test|search|includes)\s*\([^)]*\b(?:stdio-ok|allow-stdio)\b/.test(src),
    '门本体出现了读取行内豁免标记的代码 —— 行内豁免严禁(见文件头)',
  )
  assert.ok(
    src.includes('行内豁免注释通道') || src.includes('行内注释豁免'),
    '门文件头必须写明"为什么禁行内豁免"(票面交付项)',
  )
  const future = '2999-12-31'
  const good = { file: 'scripts/a.mjs', reason: 'r', owner: 'o', reviewBy: future }
  // 字段缺失/ 过期 / 形态坏 ⇒ 不豁免
  assert.equal(
    exemptedBy([{ file: 'scripts/a.mjs', line: null }], 'scripts/a.mjs', 999) !== null,
    true,
  )
  assert.equal(
    exemptedBy([{ file: 'scripts/a.mjs', line: 7 }], 'scripts/a.mjs', 8),
    null,
    '按行豁免不得跨行',
  )
  assert.equal(
    exemptedBy([], 'scripts/a.mjs', 7),
    null,
    '空台账不得豁免任何站点(裁决账不是豁免通道)',
  )
  assert.deepEqual(
    Object.keys(good).sort(),
    ['file', 'owner', 'reason', 'reviewBy'],
    '台账字段形态被改了',
  )
  // 缺失台账必须报 absent,不得静默当"已加载"
  const miss = loadExemptions(REPO, 'scripts/definitely-absent-exemptions.json')
  assert.equal(miss.absent, true)
  assert.equal(miss.entries.length, 0)
})

// ── T10 自豁免只对SELF_EXEMPT 两个精确路径生效 ─────────────────────────────────
test('T10 自豁免不得前缀通配(否则整个 scripts/tests 变成盲区)', () => {
  assert.deepEqual(SELF_EXEMPT, [
    'scripts/check-git-stdio-discipline.mjs',
    'scripts/tests/check-git-stdio-discipline.test.mjs',
  ])
  assert.equal(isSelfExempt('scripts/check-git-stdio-discipline.mjs'), true)
  assert.equal(isSelfExempt('scripts/tests/check-git-stdio-discipline.test.mjs'), true)
  for (const rel of [
    'scripts/tests/anything-else.test.mjs',
    'scripts/tests/check-git-read-timeout.test.mjs',
    'scripts/check-git-read-timeout.mjs',
  ]) {
    assert.equal(isSelfExempt(rel), false, `${rel} 被误豁免 —— 射程出现盲区`)
  }
  // 自豁免文件里的命中不得进 misses
  const dirty = `const a = execFileSync('git', ['ls-files'], { encoding: 'utf8' })`
  assert.equal(scanSource(dirty, { selfExempt: true }).misses.length, 0)
  assert.equal(scanSource(dirty, { selfExempt: false }).misses.length, 1)
})

// ── T11 门自身的调用点形态合规(门不得踩自己判的坑)────────────────────────────
test('T11 门本体不得含"派生 git 而 options 无 stdio"的调用点', () => {
  const src = readFileSync(SRC, 'utf8')
  const r = scanSource(src, { selfExempt: true })
  assert.equal(
    r.misses.length,
    0,
    `门本体有 ${r.misses.length} 处不合规派生:${JSON.stringify(r.misses.slice(0, 3))}`,
  )
  // 镜像测试同样(SELF_EXEMPT 的第二个路径必须真的存在且被豁免)
  const testSrc = readFileSync(fileURLToPath(import.meta.url), 'utf8')
  assert.equal(
    scanSource(testSrc, { selfExempt: true }).misses.length,
    0,
    '镜像测试本体有不合规派生',
  )
})

// ── T12 遮罩与实参切分是纯函数,且配平不吃掉字符串内的括号 ──────────────────────
test('T12 callSpan / markHidden / maskComments / splitArgs 的配平边界', () => {
  const src = `f('a)b', { k: '(' })`
  assert.equal(callSpan(src, 1), `('a)b', { k: '(' })`, '字符串内的 ) 不得结束配平')
  assert.deepEqual(
    splitArgs(`('git', ['x'], { a: 1, b: 2 })`),
    [`'git'`, `['x']`, `{ a: 1, b: 2 }`],
    '对象字面量内的逗号不得被当成顶层分隔',
  )
  // markHidden:注释与字符串都遮,真实代码不遮
  const msrc = '// c\nconst a = "s"\nconst b = 1'
  const h = markHidden(msrc)
  assert.equal(h[0], 1, '行注释未遮')
  const strStart = msrc.indexOf('"s"')
  assert.equal(h[strStart], 1, '字符串起始引号未遮')
  assert.equal(h[strStart + 1], 1, '字符串内容未遮')
  const codeStart = msrc.indexOf('const b')
  assert.equal(h[codeStart], 0, '真实代码被误遮')
  assert.equal(h[codeStart + 6], 0, '真实代码被误遮')
})

// ── T13 三面读数:缺省= HEAD,--staged 走索引,--worktree 走盘 ─────────────────
test('T13 三面各自给出读数,且 HEAD 与索引不同面时结论不同(证明真在跟面走)', () => {
  const head = evaluate(REPO, 'head')
  const staged = evaluate(REPO, 'staged')
  const disk = evaluate(REPO, 'worktree')
  for (const [name, o] of [
    ['head', head],
    ['staged', staged],
    ['worktree', disk],
  ]) {
    assert.ok(o.sources > 500, `${name} 面只枚举到 ${o.sources} 个源码文件`)
    assert.equal(o.unread.length, 0, `${name} 面有取不到内容的文件:${o.unread.slice(0, 3)}`)
    assert.equal(typeof o.misses, 'number')
  }
  // "判据没瞎"这条本意要保,但**不能在台账在位时断言**:台账生效后零判红是设计结果,
  // 不是判据失明。改成**把台账搬走**再断言 HEAD 面确有判红 —— 顺手钉住
  // "豁免只能来自具名台账,不是判据自己变宽了"(实测:搬走后台账前 306 / 304 / 304 处)。
  const LEDGER = 'scripts/check-git-stdio-exemptions.json'
  const ledgerBefore = existsSync(LEDGER) ? readFileSync(LEDGER) : null
  if (ledgerBefore !== null) writeFileSync(LEDGER, '[]\n')
  let headNoLedger
  try {
    headNoLedger = evaluate(REPO, 'head')
  } finally {
    if (ledgerBefore !== null) writeFileSync(LEDGER, ledgerBefore)
  }
  assert.ok(
    headNoLedger.misses > 0,
    '无台账时 HEAD 面零判红 —— 判据已经瞎了(EBUSY 病灶在真仓是实测存在的)',
  )
  // 台账在位时判红必须**不多于**无台账时(豁免只能减少命中,不能凭空造出命中)
  assert.ok(
    head.misses <= headNoLedger.misses,
    `台账在位时判红(${head.misses})多于无台账时(${headNoLedger.misses})⇒ 豁免反而造出了命中`,
  )
  assert.ok(head.libFiles > 0, 'lib 面文件数必须是 0 才说明 lib 没进射程')
  // verdictText 四态都要有话可说(不判与判红同样要能被引用)
  for (const v of ['noStdio', 'viaCmd', 'noOptions']) {
    assert.ok(verdictText(v).length > 0, `${v} 没有可读文案`)
  }
})

// ── T15 ES6 属性简写必须算"已接管 stdio",且不得放宽成恒绿 ────────────────────
// 依据:真仓 scripts/git-heal-broken-links.mjs 的 git() 包装器 options 里写的是 `stdio,`
// (值先算好再简写),而旧判据只认冒号 ⇒ 已合规的调用被报成「options 内无 stdio 属性名」。
// 这一族是门自身的**误判**方向:门把没坏的代码报成红,逼人去改对的地方,最终逼人关掉整条守门链。
test('T15 属性简写合规(正例四形态),而名字里带 stdio 的反例一律仍判红', () => {
  const EF = 'execFileSync'
  const j = (src) => judgeSpan(callSpan(src, src.indexOf('(')), src.includes('execSync('))
  // 正例:简写就是"名为 stdio 的属性名",与口径第 3 条同形
  for (const opts of [
    '{ stdio }',
    '{ stdio, cwd: R }',
    '{ cwd: R, stdio }',
    // 真仓同型的多行折行形态(本门第一原则:折行不改判据)
    '{ cwd: opts.cwd || ROOT,\n    stdio,\n    input: opts.input,\n  }',
  ]) {
    assert.equal(
      j(`${EF}('git', ['ls-files'], ${opts})`).verdict,
      'ok',
      `简写形态 ${JSON.stringify(opts)} 竟被判红 —— 门自身的误判`,
    )
  }
  // 反向对照(牙):前缀/后缀粘住、值位置、嵌套值位置、字符串里 —— 都必须仍判红。
  // 这一格是本例的**关键**:判据没被放成"看到 stdio 字样就放过"。
  for (const opts of [
    '{ xstdio: 1 }',
    '{ my_stdio: 1 }',
    '{ mystdio: 1 }',
    '{ stdioX: 1 }',
    '{ stdioX }',
    '{ stdioX, y: 1 }',
    '{ encoding: stdio }',
    '{ env: { A: stdio }, cwd: R }',
    "{ NOTE: 'stdio', cwd: R }",
    '{ cwd: R, A: [stdio] }',
  ]) {
    assert.equal(
      j(`${EF}('git', ['ls-files'], ${opts})`).verdict,
      'noStdio',
      `${opts} 竟判成合规(简写支不得放宽成恒绿)`,
    )
  }
  // 简写合规的那一次调用不得洗白同文件的裸奔调用(判据仍落在**该次调用**的 options 内)
  const two = [
    `const a = ${EF}('git', ['ls-files'], { stdio })`,
    `const b = ${EF}('git', ['status'], { encoding: 'utf8' })`,
  ].join('\n')
  const r = scanSource(two)
  assert.equal(r.misses.length, 1, `期望恰好 1 处判红:${JSON.stringify(r.misses)}`)
  assert.equal(r.misses[0].line, 2, '判红的必须是第 2 行那处裸奔')
})

// ── T16 判据口径必须与实现同形(注释与实现漂开 = 下一个人的错源)────────────────
test('T16 文件头口径与 STDIO_PROP 注释必须写明"两种形态",且实现确有两支', () => {
  const src = readFileSync(SRC, 'utf8')
  // ① 实现确有两支:显式属性 + 简写。用**正/反例**证明,不复读正则源码(复读实现 = 复读机)。
  const ok = STDIO_PROP.test('{ stdio: 1 }') && STDIO_PROP.test('{ stdio }')
  assert.ok(ok, 'STDIO_PROP 缺显式属性或缺简写的一支')
  for (const bad of ['{ xstdio: 1 }', '{ my_stdio: 1 }', '{ stdioX }', '{ encoding: stdio }']) {
    assert.equal(STDIO_PROP.test(bad), false, `${bad} 被 STDIO_PROP 算成合规 —— 判据被放宽过头`)
  }
  // ② 口径文本必须提到简写:口径与实现不同形时,注释就成了下一个人的错源
  //    (本仓反复记过:"日志说 N 个,交给裁决的是另外 N 个"同型)。
  assert.ok(
    src.includes('属性简写') && src.includes('stdio\\s*:|(?:^|[{,])\\s*stdio\\s*[,}]'),
    '文件头口径第 3 条 / STDIO_PROP 注释未与实现同形(缺简写支或未写明)',
  )
})
test('T14 CLI:self-test 全绿且例数 ≥5(票面下界),默认面 exit 1(存量未修),两面旗互斥判死', () => {
  const out = runNode(['scripts/check-git-stdio-discipline.mjs', '--self-test'])
  // 不断言精确例数:门加用例是**应该**的,把它写成硬编码会让"补一条用例"变成一次红。
  // 断的是两件要紧的事:① 全绿;② 例数不低于票面下界 5(否则"至少 5 例"这条要求被悄悄撤销)。
  const m = /--self-test (\d+)\/(\d+) 通过/.exec(out)
  assert.ok(m, `self-test 未报告通过:\n${out}`)
  assert.equal(m[1], m[2], `self-test 有失败用例:\n${out}`)
  assert.ok(Number(m[1]) >= 5, `self-test 只有 ${m[1]} 例,票面要求至少 5 例`)
  assert.ok(!out.includes('❌'), `self-test 有失败用例:\n${out}`)
  // 默认面:判红 ⇒ exit 1,**不是** exit 2(能判出结论)也不是 0
  // 默认面:**先把豁免台账搬走**,再断言它判红。
  // 原断言是"默认面必 exit 1",那是台账还不存在时写的;台账落地后默认面理应转绿,
  // 照原样断言会把"台账生效"读成"门失灵"。而"门必须有牙"这条本意不能丢,
  // 所以改成**在无台账前提下**验证判红 —— 顺手也钉住"台账是唯一豁免通道,
  // 搬走它就没人替这些点挡着"这条设计(实测:台账清空后三面 306/304/304 处判红)。
  const LEDGER = 'scripts/check-git-stdio-exemptions.json'
  const ledgerBefore = existsSync(LEDGER) ? readFileSync(LEDGER) : null
  if (ledgerBefore !== null) writeFileSync(LEDGER, '[]\n')
  let code = 0
  let defaultOut = ''
  try {
    defaultOut = runNode(['scripts/check-git-stdio-discipline.mjs'])
  } catch (e) {
    code = e.status
    // 门判红时 exit≠0,输出在 e.stdout 上而不是返回值上 —— 漏了这一手会读到空串,
    // 断言"必须有实打实的判红处数"就会因拿不到文本而误报(看着像门坏了,实则取错了字段)。
    defaultOut = String(e.stdout ?? '') + String(e.stderr ?? '')
  } finally {
    if (ledgerBefore !== null) writeFileSync(LEDGER, ledgerBefore)
  }
  assert.equal(code, 1, `无台账时默认面应 exit 1(判红),实得 ${code}\n${defaultOut}`)
  // 台账搬走期间不得"因判红而顺带丢判据":判红处数必须 > 0,不能是"扫不到所以 0 处绿"
  assert.match(defaultOut, /判红 [1-9]\d* 处/, `无台账时必须有实打实的判红处数:\n${defaultOut}`)
  // 面旗互斥 ⇒ exit 2「无法判定」(绝不静默挑一面)
  let code2 = 0
  let err = ''
  try {
    runNode(['scripts/check-git-stdio-discipline.mjs', '--staged', '--worktree'])
  } catch (e) {
    code2 = e.status
    err = String(e.stderr ?? '')
  }
  assert.equal(code2, 2, `两面同给应 exit 2,实得 ${code2}`)
  assert.match(err, /无法判定/, '互斥面必须报「无法判定」')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
