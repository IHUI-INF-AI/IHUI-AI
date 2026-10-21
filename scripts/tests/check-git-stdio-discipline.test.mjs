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
  INPUT_PROP,
  SCAN_ROOTS,
  SELF_EXEMPT,
  STDIO_PROP,
  callSpan,
  decideInput,
  entryKeyValue,
  exemptedBy,
  evaluate,
  isGitLikeName,
  isSelfExempt,
  isSourceFile,
  isStringCommand,
  judgeInputStdin,
  judgeSpan,
  listScoped,
  loadExemptions,
  markHidden,
  maskComments,
  scanSource,
  splitArgs,
  stdinChannelOf,
  ternaryBranches,
  topLevelEntries,
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
  // 2026-10-21 根因回归:markHidden 必须认正则字面量。此前不认 ⇒ L477 的 ESM 匹配式
  // /import\s*\{([^}]*)\}\s*from\s*['"]node:child_process['"]/g 里字符类 ['"] 的引号
  // 被当成字符串引号,跨行贪婪配对吞掉 240 行外的自检夹具 ⇒ 门 193 把夹具里的
  // execFileSync 判成真调用(判红 2 处,台账豁免到期复红阻塞 push)。
  const rsrc = [
    `for (const m of src.matchAll(/import\\s*\\{([^}]*)\\}\\s*from\\s*['"]node:child_process['"]/g)) {`,
    `  found = true`,
    `}`,
    `const fixture = "execFileSync('git', ['x'])"`,
  ].join('\n')
  const rh = markHidden(rsrc)
  assert.equal(rh[rsrc.indexOf('/import')], 1, '正则字面量未被掩 ⇒ 字符类引号将跨行错位')
  assert.equal(rh[rsrc.indexOf('const fixture')], 0, '正则后的真实代码被误遮')
  assert.equal(rh[rsrc.indexOf('"execFileSync')], 1, '字符串字面量里的夹具未被掩')
  // 牙:同一形态里放一个真裸调用,仍判红(证明正则分支不是恒绿口子)
  assert.equal(
    scanSource(`${rsrc}\nexecFileSync(GIT, ['ls-files'], { encoding: 'utf8' })`).misses.length,
    1,
    '正则分支把真裸调用洗绿',
  )
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
  // 2026-10-21:存量已被三批清偿(322337e / a8f285f / 5298350)清到 0 ⇒「无台账必然 >0」这个
  // 前提随存量归零失效(不是判据坏了:阳性牙由 T3/T5/T15/T17 的夹具正控证明)。
  // 改成**等值**:无台账不得比台账在位时多豁免出命中来 —— 少一处就是判据瞎了。
  assert.equal(
    headNoLedger.misses,
    head.misses,
    `无台账时的命中(${headNoLedger.misses})必须等于台账在位时(${head.misses})—— 少就是判据瞎了`,
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
  // 2026-10-21:同上 —— 存量归零后"默认面必 exit 1"不再成立。判据改成**退出码与判红处数一致**:
  // 报了几处就得按几处给码(0 处 ⇒ 0,>0 处 ⇒ 1),这比钉死某个数更能证明"码是算出来的"。
  const redCount = Number(/判红 (\d+) 处/.exec(defaultOut)?.[1] ?? -1)
  assert.ok(redCount >= 0, `无台账时必须有实打实的判红处数(0 也是实读数):\n${defaultOut}`)
  assert.equal(
    code,
    redCount > 0 ? 1 : 0,
    `默认面退出码必须与判红处数一致(${redCount} 处 ⇒ ${redCount > 0 ? 1 : 0}),实得 ${code}\n${defaultOut}`,
  )
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

// ── T17 第 3b 条那一维(input ↔ stdin 通道)成对用例 ────────────────────────────
// 立因:主 agent 用 `spawnSync('git', ['hash-object','-w','--stdin'], { input: <1.67MB>,
// stdio: ['ignore','pipe','pipe'] })` 构造 blob ⇒ git 读到空 stdin ⇒ **安静产出 0 字节空 blob**
// 并返回一个"看着像 sha"的值,那份空 `pnpm-lock.yaml` 就这么进了 main。旧口径只判 `stdio`
// 属性名在不在 ⇒ 这一处它判绿:**排除条款本身就是缺陷候选**("必须显式 stdio"放过了
// "显式写了一个错的 stdio")。判据实现只在门体里有一份,本档 import 消费(§22c)。
test('T17 第3b条成对用例:pipe 档合规 / ignore·inherit·标量非 pipe 判红 / execSync 位序也接住', () => {
  const INC = `const r = spawnSync('git', ['hash-object', '-w', '--stdin'], { input: blob, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })`
  const on = scanSource(INC)
  assert.deepEqual(
    on.inputBad.map((h) => h.got),
    ['ignore'],
    `事故原样必须判红并报出实际首元素:${JSON.stringify(on.inputBad)}`,
  )
  // 反向对照(证明不是恒红):同一处把首元素改成 pipe ⇒ 归零
  const fixed = scanSource(INC.replace("['ignore', 'pipe', 'pipe']", "['pipe', 'pipe', 'pipe']"))
  assert.equal(fixed.inputBad.length, 0, '补成 pipe 后仍判红 ⇒ 这一维是恒红门(§12e)')
  assert.equal(fixed.misses.length, 0)
  // inherit 与标量形态同病:stdin 不是 pipe(实测 10/10 拿不到内容或拿到空 blob)
  for (const [v, got] of [
    ["['inherit', 'pipe', 'pipe']", 'inherit'],
    ["'ignore'", 'ignore'],
    ["'inherit'", 'inherit'],
  ]) {
    const r = scanSource(
      `const x = execFileSync('git', ['hash-object','--stdin'], { input: b, stdio: ${v} })`,
    )
    assert.equal(r.inputBad.length, 1, `stdio: ${v} 漏判`)
    assert.equal(r.inputBad[0].got, got, `stdio: ${v} 未报出实际首元素`)
  }
  // 标量 pipe 合规(三通道皆 pipe)—— 别把正当写法判红
  assert.equal(
    scanSource(`const x = execFileSync('git', ['x'], { input: b, stdio: 'pipe' })`).inputBad.length,
    0,
  )
  // execSync 的 options 在第 2 位:位序弄错,这一族就永远判不到
  const es = scanSource(
    `const x = execSync('git hash-object --stdin', { input: b, stdio: ['ignore', 'pipe', 'pipe'] })`,
  )
  assert.equal(es.inputBad.length, 1, `execSync 位序漏判:${JSON.stringify(es)}`)
  // input 在场而顶层没配 stdio ⇒ 由"缺 stdio 属性名"那一维判红,本维不得重复报同一行
  const onlyOld = scanSource(`const x = execFileSync('git', ['x'], { input: b, encoding: 'utf8' })`)
  assert.equal(onlyOld.misses.length, 1, '旧维必须照红')
  assert.equal(onlyOld.inputBad.length, 0, '同一行两处红会把修法指错方向')
})

// ── T18 第 3b 条:取值取不到 ⇒ 判不出(不记绿也不冒红)+ 形状锁 ──────────────────
test('T18 第3b条:取值取不到归"判不出";摘掉新维(inputDim=false)反向用例应翻绿', () => {
  const INC = `const r = spawnSync('git', ['hash-object','-w','--stdin'], { input: blob, stdio: ['ignore','pipe','pipe'] })`
  // 形状锁(构造开关,不靠注释):新维关掉 ⇒ 这一处不判红 —— 证明红确实是这一维抓的,
  // 而旧维单独对它**是瞎的**(misses 恒 0),这正是本票要补的那一格。
  const off = scanSource(INC, { inputDim: false })
  assert.equal(off.inputBad.length, 0, '开关不干净:关掉新维仍有 inputBad')
  assert.equal(off.misses.length, 0, '旧维不该报这一行(它判的是属性名在不在)')
  const on = scanSource(INC)
  assert.equal(on.inputBad.length, 1, '开着新维却不判红 ⇒ 判据没接进 scanSource')
  assert.equal(judgeSpan(callSpan(INC, INC.indexOf('(')), false).verdict, 'ok')
  // 判不出族:简写 / 变量 / 成员 / 函数返回值 / 空数组 / 混合三元 ⇒ 一律不判红也不判绿
  const und = [
    `const r = execFileSync('git', ['x'], { cwd: R, stdio, input: opts.input })`,
    `const r = execFileSync('git', ['x'], { input: b, stdio: STDIO_OPTS })`,
    `const r = execFileSync('git', ['x'], { input: b, stdio: base.stdio })`,
    `const r = execFileSync('git', ['x'], { input: b, stdio: mkStdio() })`,
    `const r = execFileSync('git', ['x'], { input: b, stdio: [] })`,
    `const r = execFileSync('git', ['x'], { input: b, stdio: input ? ['pipe','pipe','pipe'] : ['ignore','pipe','pipe'] })`,
    `const r = execFileSync('git', ['x'], { input: b, ...base })`,
  ]
  for (const src of und) {
    const r = scanSource(src)
    assert.equal(r.inputBad.length, 0, `取不到取值却判红(误伤):${src}`)
    assert.equal(r.inputUndetermined.length, 1, `未归入"判不出"且必须点名:${src}`)
    // 旧维那一格不得被塞进新维的成因(两维各记各的账)
    for (const m of r.misses) {
      assert.ok(['noStdio', 'noOptions', 'viaCmd'].includes(m.verdict), `旧维格子被污染:${m.verdict}`)
    }
  }
  // 两支皆 pipe 的三元必须算合规:否则正当写法长驻"判不出",那一格很快就没人看
  const bothPipe = scanSource(
    `const r = execFileSync('git', ['x'], { input: b, stdio: withInput ? ['pipe','pipe','pipe'] : ['pipe','ignore','ignore'] })`,
  )
  assert.equal(
    bothPipe.inputBad.length + bothPipe.inputUndetermined.length,
    0,
    '两支 stdin 皆 pipe 应判合规',
  )
  // 真仓现存同型(git-heal-broken-links.mjs 的折行简写形态)不得被误伤
  assert.equal(
    scanSource(
      `const r = execFileSync('git', ['x'], { cwd: ROOT,\n    stdio,\n    input: opts.input,\n  })`,
    ).inputBad.length,
    0,
  )
  // 嵌套 stdio 不是顶层/stdin;值位置与 xinput / my_input 不得触发本维
  for (const src of [
    `const r = execFileSync('git', ['x'], { input: b, env: { stdio: 'ignore' }, stdio: ['pipe','pipe','pipe'] })`,
    `const r = execFileSync('git', [input], { stdio: ['ignore','pipe','pipe'] })`,
    `const r = execFileSync('git', ['x'], { xinput: 1, stdio: ['ignore','pipe','pipe'] })`,
    `const r = execFileSync('git', ['x'], { my_input: 1, stdio: ['ignore','pipe','pipe'] })`,
  ]) {
    const r = scanSource(src)
    assert.equal(r.inputBad.length + r.inputUndetermined.length, 0, `本维被无关形态触发:${src}`)
  }
  // 具名 options 对象里的冲突必须被回捞(不给它发免检通行证)
  const named = scanSource(
    `const FACE_OPTS = { input: blob, stdio: ['ignore','pipe','pipe'] }\nspawnSync(GIT, ['hash-object','-w','--stdin'], FACE_OPTS)`,
  )
  assert.equal(named.inputBad.length, 1, `具名 options 里的冲突漏判:${JSON.stringify(named)}`)
  // 设计命门:prettier 折行不改本维判据(双向)
  const folded = [
    `const r = spawnSync(`,
    `  'git',`,
    `  ['hash-object', '-w', '--stdin'],`,
    `  {`,
    `    input: blob,`,
    `    stdio: ['ignore', 'pipe', 'pipe'],`,
    `  },`,
    `)`,
  ].join('\n')
  assert.equal(scanSource(folded).inputBad.length, 1, '折行后本维漏判 ⇒ 逐行匹配的旧病复发')
  assert.equal(
    scanSource(folded.replace("'ignore'", "'pipe'")).inputBad.length,
    0,
    '折行后的 pipe 档被误判红',
  )
})

// ── T19 第 3b 条定级:差值棘轮(锚点 = 该文件 HEAD 面自身),存量绝不判红 ──────────
// 依据 §12e:本门注册档是 blocking(runner 条目 193 现读),而 HEAD 面存量现读非零
// (`scripts/tests/check-chat-element-coverage.test.mjs` 的 gitIn:带 input 形参而 stdio 首元素
// ignore)。与本次提交内容无关的存量绝对判红 = 恒红门 = 逼人 --no-verify 连带废掉全部守门。
// 所以新维**独立成账**:全量档只报存量、索引档只拦新增、锚点取不到 ⇒ 未判定(调用方出 exit 2)、
// `--strict` 才问责存量。这张构造面钉住四种结局,不许有人回头把它改成绝对档。
test('T19 第3b条定级:全量档存量不判红 / 索引档只拦新增 / 锚点缺=未判定 / --strict 问责', () => {
  const hit = (rel, line) => ({ rel, line, got: 'ignore' })
  const anchor = new Map([['scripts/a.mjs', 1]])
  const head = decideInput({ face: 'head', inputBad: [hit('scripts/a.mjs', 3)], anchor: null })
  assert.equal(head.violations.length, 0, '全量档(HEAD blob)按构造不得判红(§12e 恒红门禁令)')
  assert.equal(head.stock.length, 1, '存量必须报数,不得静默')
  const same = decideInput({ face: 'staged', inputBad: [hit('scripts/a.mjs', 3)], anchor })
  assert.equal(same.violations.length, 0, 'HEAD 已 1 而本面仍 1 ⇒ 存量不担责')
  const added = decideInput({
    face: 'staged',
    inputBad: [hit('scripts/a.mjs', 3), hit('scripts/a.mjs', 9)],
    anchor,
  })
  assert.equal(added.violations.length, 1, '本次加回来一处必须被拦')
  assert.match(added.violations[0].why, /新增 1 处/, `棘轮读数要写明新增几处:${added.violations[0].why}`)
  const fresh = decideInput({ face: 'staged', inputBad: [hit('scripts/new.mjs', 1)], anchor })
  assert.equal(fresh.violations.length, 1, '新文件里的命中(锚点 0)必须判红')
  const noAnchor = decideInput({ face: 'staged', inputBad: [hit('scripts/a.mjs', 3)], anchor: null })
  assert.equal(noAnchor.anchorUndetermined, true, '锚点取不到必须显式"未判定"')
  assert.equal(noAnchor.violations.length, 0, '未判定绝不冒红(也不记绿:调用方据此 exit 2)')
  const strict = decideInput({
    face: 'head',
    inputBad: [hit('scripts/a.mjs', 3)],
    anchor: null,
    strict: true,
  })
  assert.equal(strict.violations.length, 1, '--strict 是存量问责档,必须真能问责')
  const wt = decideInput({ face: 'worktree', inputBad: [hit('scripts/a.mjs', 3)], anchor })
  assert.equal(wt.violations.length, 0, '工作树档 = 人工逃生舱,只报数')
  // 真仓现读:全量档对**实际存量**也必须是零判红(棘轮不是纸面承诺)
  const ev = evaluate(REPO, 'head')
  assert.ok(Array.isArray(ev.inputBad) && Array.isArray(ev.inputUndetermined), 'evaluate 未出这两本账')
  const real = decideInput({ face: 'head', inputBad: ev.inputBad, anchor: null })
  assert.equal(real.violations.length, 0, `存量被绝对判红 = 恒红门(现读 ${ev.inputBad.length} 枚)`)
})

// ── T20 门本体与镜像档自身在这一维上必须干净 ───────────────────────────────────
test('T20 门本体/镜像本体的 input↔stdin 命中为零(自豁免生效且未把红折成绿)', () => {
  for (const [label, p] of [
    ['门本体', SRC],
    ['镜像档', fileURLToPath(import.meta.url)],
  ]) {
    assert.ok(existsSync(p), `${label} 不存在`)
    const r = scanSource(readFileSync(p, 'utf8'), { selfExempt: true })
    assert.equal(r.inputBad.length, 0, `${label} 带出 input↔stdin 判红:${JSON.stringify(r.inputBad)}`)
    assert.equal(r.misses.length, 0, `${label} 带出旧维判红:${JSON.stringify(r.misses)}`)
  }
  // 判据只有一份:新维的四个出口必须是门体导出的同一实现(§22c,禁镜像复制判据)
  for (const fn of [judgeInputStdin, stdinChannelOf, topLevelEntries, entryKeyValue, ternaryBranches]) {
    assert.equal(typeof fn, 'function', '新维出口未从门体导出')
  }
  assert.ok(INPUT_PROP instanceof RegExp, 'INPUT_PROP 未导出')
  assert.equal(INPUT_PROP.test('{ input: 1 }'), true)
  assert.equal(INPUT_PROP.test('{ xinput: 1 }'), false, 'INPUT_PROP 把 xinput 也算成了 input 属性名')
  assert.equal(INPUT_PROP.test('{ cwd: input }'), false, '值位置的 input 被算成属性名')
})

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
