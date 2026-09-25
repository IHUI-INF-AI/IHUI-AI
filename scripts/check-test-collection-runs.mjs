// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-test-collection-runs.mjs —— 测试「收集阶段」存续性对账(**warn 级**)
 *
 * 立门理由(本仓实测到的结构性失明,不是假想):
 *   `cd apps/mobile-rn && pnpm vitest run tests/` 曾长期报 `Test Files 15 failed | 37 passed`,
 *   其中 14 个是**收集阶段就失败**(transform / import 解析报错),内含 131 条 it 声明(展开 137 枚用例)
 *   **一条都没跑**。端内约三分之一覆盖被静默削掉,而全仓 130+ 道守门里**没有任何一道跑 vitest**:
 *   check-staged-typecheck 走 tsc,结构上看不见 transform / 解析期失败;CI 会红(vitest 收集失败即
 *   exit 1),但**提交链不拦**,于是本机可以永远"看着绿"。本门把"收集失败套件数 == 0"变成机器判据。
 *
 * 为什么定级 warn、绝不 blocking(AGENTS §12e / §4 反复记过的教训):
 *   本门判的是**端内测试能不能被收集**,而一次提交完全可能与它无关(改文档、改另一端)。
 *   与改动无关的恒红门只会逼人 `--no-verify`,而一次绕过等于约 134 道门对该提交**全部作废** ——
 *   那道真正该防丢 commit 的门也会一起被绕过。定级 warn = 把故障喊出来,但不替提交链做决定。
 *   要问责请用 `--strict`(CI / 巡检):未判定在 strict 下同样计红。
 *
 * 为什么只接 JS 系(vitest),不顺手把 pytest 接进来:
 *   判据依赖"从输出里认出 Failed Suites / Test Files 汇总行"这套 vitest 版式;pytest 的收集期故障是
 *   `ERROR tests/x.py - ModuleNotFoundError` + `no tests ran`,是**另一套语法**,照抄判据必然空转
 *   (本仓记过多次"缺一条该语言的语法锚点,整条判据空转")。真要管 pytest 得单写一套收集判据,
 *   那是独立一票,不在本门范围。非 vitest 入口的端一律**判"未判定"并写明原因**,不冒绿。
 *
 * 三条不可动摇的口径:
 *   ① **绝不把"零测试文件"当绿** —— 空扫就是本门要防的同一型故障(覆盖静默归零),判红。
 *   ② **绝不把断言失败与收集失败混计** —— `Test Files 1 failed` 两种故障都会出现,所以文件级计数
 *      **不能**作判据;只有 "Failed Suites" 区块与 `FAIL <file> [ <file> ]` 带方括号的套件级形态才是
 *      收集失败。断言失败如实报数并明写"不计入本门"。
 *   ③ **取不到结论必须显式"无法判定"并给原因** —— vitest 入口不可解析 / 超时 / 输出里没有汇总行 /
 *      该端没有 test script,四类全部 exit 2(strict 下 exit 1),既不冒红也不记绿。
 *
 * 派生纪律(AGENTS §5b):一律 `execFileSync(<绝对路径 node>, [<绝对路径 vitest 入口>, …])`,
 *   带 `windowsHide: true`(钩子/GUI 宿主无控制台时漏了必弹窗)与 `timeout`(漏了会把提交挂死)。
 *   不走 `pnpm test` —— 那依赖 PATH,服务与钩子进程下必失。
 *
 * 用法:
 *   node scripts/check-test-collection-runs.mjs                 # 默认只跑 apps/mobile-rn
 *   node scripts/check-test-collection-runs.mjs --end apps/web  # 扩端(该端须是 vitest 入口)
 *   node scripts/check-test-collection-runs.mjs --strict        # CI/巡检:未判定也计红
 *   node scripts/check-test-collection-runs.mjs --self-test     # 临时目录构造六态,零副作用可重复
 *
 * 紧急跳过(提交链):HUSKY_SKIP_TEST_COLLECTION=1 git commit ...
 * 自检:`node scripts/check-test-collection-runs.mjs --self-test`
 *      `node --test scripts/tests/check-test-collection-runs.test.mjs`
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** 默认受检端:只有它被**实测证明**会静默削覆盖;扩端须显式 `--end`(不擅自替别人做决定)。 */
export const DEFAULT_ENDS = ['apps/mobile-rn']

/** 单端 vitest 上限:真仓 mobile-rn 实测 19s;留 20 分钟余量给 web 这类大端。 */
const DEFAULT_TIMEOUT_MS = 20 * 60 * 1000

const ANSI_RE = /\u001b\[[0-9;]*[A-Za-z]/g

function stripAnsi(s) {
  return String(s ?? '').replace(ANSI_RE, '')
}

function oneLine(s, max = 220) {
  const t = String(s ?? '').trim()
  return t.length > max ? `${t.slice(0, max)}…` : t
}

/**
 * 纯函数:把一份 vitest 输出判成 ok / violation / undetermined。
 * 本门唯一的判据出口,镜像测试与 --self-test 都只认它(不得依赖仓库瞬时状态)。
 */
export function parseVitestOutput(raw, { exitCode } = {}) {
  const text = stripAnsi(raw)
  const lines = text.split(/\r?\n/)

  if (text.trim() === '') {
    return {
      verdict: 'undetermined',
      reason: `vitest 无任何输出(exit=${exitCode ?? '?'}),无法判定是"没跑起来"还是"跑完没打印"`,
      collectionFailures: [],
    }
  }

  // ① 空扫:vitest 自己宣布"一个测试文件都没找到" —— 覆盖静默归零,判红(绝不当绿)
  const zeroFiles =
    /No test files found/i.test(text) || /^\s*Test Files\s+.*\(0\)\s*$/m.test(text)

  // ② 收集失败信号 A:"Failed Suites N" 区块头(vitest 用它专指套件级/收集期故障)
  const suitesHeader = text.match(/Failed Suites\s+(\d+)/)
  const suitesHeaderCount = suitesHeader ? Number(suitesHeader[1]) : 0

  // ③ 收集失败信号 B:`FAIL <file> [ <file> ]` —— 方括号后缀是套件级形态;
  //    `FAIL <file> > <test> > <test>` 是断言形态,二者必须分开(口径②)。
  const collectionFailures = []
  let assertionFailures = 0
  let inSuitesSection = false
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    if (/Failed Suites\s+\d+/.test(line)) inSuitesSection = true
    else if (/Failed Tests\s+\d+/.test(line) || /Unhandled Errors/.test(line)) inSuitesSection = false
    const fail = line.match(/^\s*FAIL\s+(.+)$/)
    if (!fail) continue
    const tail = fail[1].trim()
    const bracket = tail.match(/^(.*?)\s*\[\s*(.*?)\s*\]\s*$/)
    if (bracket || inSuitesSection) {
      // 报错首行 = 该 FAIL 之后第一条实质内容行(跳过空行 / 分隔线 / [n/m] 进度行)
      let firstErrorLine = ''
      for (let j = i + 1; j < lines.length && !firstErrorLine; j += 1) {
        const cand = lines[j].trim()
        if (cand === '' || /^[\u2500\s]+$/.test(cand) || /^\[\d+\/\d+\]$/.test(cand)) continue
        firstErrorLine = cand
      }
      collectionFailures.push({
        file: oneLine(bracket ? bracket[1] : tail.replace(/\s*>.*$/, '')),
        firstErrorLine: oneLine(firstErrorLine),
      })
    } else {
      assertionFailures += 1
    }
  }

  // 计数对账:区块头声明的数与逐行数出的数不一致 ⇒ 两个都报,取大值作红点计数
  // (只取其一会在版式换人时静默少报,而"少报"就是本门存在的理由)
  const count = Math.max(suitesHeaderCount, collectionFailures.length)
  const countDrift = suitesHeaderCount !== collectionFailures.length

  const hasSummary = /^\s*Test Files\s+\S/m.test(text)
  const unhandled = text.match(/Unhandled Errors\s+(\d+)/)
  // "0 test" 文件 = 被收集到却一条用例都没注册的第三种形态(空文件 / describe 被注释掉)。
  // 它既不是收集失败也不是断言失败,但同样是"覆盖看着在、实际不在" ⇒ 只报数不判红
  // (判红会误伤刻意占位的文件;不报数就会静默 —— 本门的立场是"绝不静默成看起来全绿")。
  const emptyCollected = [...text.matchAll(/^\s*[✓❯×]\s+(\S+\.\w+)\s*\(\s*0 test(s)?\)/gm)].map(
    (m) => m[1],
  )

  const detail = {
    count,
    countDrift,
    suitesHeaderCount,
    collectedSuiteFailures: collectionFailures.length,
    collectionFailures,
    assertionFailures,
    emptyCollected,
    unhandledErrors: unhandled ? Number(unhandled[1]) : 0,
    summaryLine: (text.match(/^\s*Test Files\s+(.+)$/m) || [, ''])[1].trim(),
    testsLine: (text.match(/^\s*Tests\s+(.+)$/m) || [, ''])[1].trim(),
  }

  if (zeroFiles) {
    return { verdict: 'violation', reason: '空扫:该端一个测试文件都没收集到 ⇒ 覆盖静默归零', ...detail }
  }
  if (count > 0) {
    return { verdict: 'violation', reason: `${count} 个套件在收集阶段就失败(其中的用例一条都没跑)`, ...detail }
  }
  if (!hasSummary) {
    return {
      verdict: 'undetermined',
      reason: '输出里没有 `Test Files` 汇总行 ⇒ 无法判定 vitest 是否真的跑完',
      ...detail,
    }
  }
  return { verdict: 'ok', reason: '', ...detail }
}

/** 读某端的 test 入口与 vitest 可执行文件绝对路径;任一环节取不到 ⇒ 返回 { reason }(未判定)。 */
export function resolveEnd(endDir) {
  const pkgPath = join(endDir, 'package.json')
  if (!existsSync(pkgPath)) return { reason: `该目录下没有 package.json:${endDir}` }
  let pkg
  try {
    pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
  } catch (e) {
    return { reason: `package.json 解析失败:${endDir}(${e.message})` }
  }
  const testScript = pkg?.scripts?.test
  if (!testScript) return { reason: `该端没有 test script:${endDir}` }
  if (!/\bvitest\b/.test(testScript)) {
    return {
      reason: `test 入口不是 vitest(实为 "${oneLine(testScript, 80)}")⇒ 本门只认 JS 系收集判据,该端未判定`,
    }
  }
  // 候选:端内直链 → 根 hoist。读各自 package.json 的 bin 字段拿**入口文件绝对路径**,
  // 不猜文件名(不同大版本 bin 名不同),也不靠 PATH。
  for (const pkgDir of [join(endDir, 'node_modules', 'vitest'), join(ROOT, 'node_modules', 'vitest')]) {
    const manifest = join(pkgDir, 'package.json')
    if (!existsSync(manifest)) continue
    try {
      const m = JSON.parse(readFileSync(manifest, 'utf8'))
      const binRel = typeof m.bin === 'string' ? m.bin : m.bin?.vitest
      if (!binRel) continue
      const entry = resolve(pkgDir, binRel)
      if (existsSync(entry)) return { entry, vitestVersion: m.version }
    } catch {
      /* 清单坏了 ⇒ 换下一个候选,但绝不静默当成"没有 vitest" */
    }
  }
  return { reason: `vitest 入口不可解析(${endDir}/node_modules/vitest 与根 node_modules/vitest 都没有可执行入口)` }
}

/** 真跑一端:派生纪律见文件头(绝对路径 + windowsHide + timeout)。 */
export function runEnd(endDir, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const resolved = resolveEnd(endDir)
  if (resolved.reason) return { verdict: 'undetermined', reason: resolved.reason }

  let stdout = ''
  let stderr = ''
  let exitCode = 0
  try {
    stdout = execFileSync(process.execPath, [resolved.entry, 'run'], {
      cwd: endDir,
      encoding: 'utf8',
      windowsHide: true,
      timeout: timeoutMs,
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
    })
  } catch (e) {
    if (e?.signal) {
      return {
        verdict: 'undetermined',
        reason: `vitest 在 ${timeoutMs}ms 内没跑完就被终止(signal=${e.signal})⇒ 无法判定,请查是卡死还是机器过载`,
      }
    }
    stdout = e?.stdout ?? ''
    stderr = e?.stderr ?? ''
    if (typeof e?.status !== 'number') {
      return { verdict: 'undetermined', reason: `派生 vitest 失败:${oneLine(e?.message)}` }
    }
    exitCode = e.status
  }
  const parsed = parseVitestOutput(`${stdout}\n${stderr}`, { exitCode })
  return { ...parsed, vitestVersion: resolved.vitestVersion }
}

/** 退出码:判红 1 > 未判定(strict 计红 1 / 默认 2)> 达标 0。 */
export function decideExit(results, { strict } = {}) {
  const violated = results.filter((r) => r.verdict === 'violation')
  const undetermined = results.filter((r) => r.verdict === 'undetermined')
  if (violated.length > 0) return 1
  if (undetermined.length > 0) return strict ? 1 : 2
  return 0
}

export function report(results, { strict }) {
  const out = []
  for (const r of results) {
    out.push(`\n· 端 ${r.end}${r.vitestVersion ? ` (vitest ${r.vitestVersion})` : ''}`)
    if (r.verdict === 'undetermined') {
      out.push(`  ⚪ 未判定:${r.reason}`)
      out.push('     说明:未判定 **不等于** 达标。本门没有看到结论,也不替它记绿。')
      continue
    }
    out.push(
      `  ${r.verdict === 'violation' ? '🔴 判红' : '🟢 达标'}:${r.reason || '收集失败套件 0 个'}${r.summaryLine ? ` ｜ Test Files ${r.summaryLine}` : ''}`,
    )
    for (const f of r.collectionFailures) {
      out.push(`    - ${f.file}`)
      if (f.firstErrorLine) out.push(`        ↳ ${f.firstErrorLine}`)
    }
    if (r.countDrift) {
      out.push(
        `    ⚠ 计数对账:"Failed Suites" 区块头写 ${r.suitesHeaderCount},逐条数到 ${r.collectedSuiteFailures} ⇒ 红点数取两者之大`,
      )
    }
    if (r.assertionFailures > 0) {
      out.push(
        `    ℹ 另有断言失败 ${r.assertionFailures} 处 —— **不计入本门**(那是用例自己的红,与"收集阶段"是两种故障)`,
      )
    }
    if (r.unhandledErrors > 0) {
      out.push(`    ℹ Unhandled Errors ${r.unhandledErrors} 处(只报数,不混计进收集失败)`)
    }
    if (r.emptyCollected?.length > 0) {
      out.push(
        `    ℹ 收集到却一条用例都没有的文件 ${r.emptyCollected.length} 个(只报数不判红 —— 占位文件合法,但静默归零必须可见):${r.emptyCollected.slice(0, 8).join(', ')}`,
      )
    }
  }
  const violated = results.filter((r) => r.verdict === 'violation')
  const undetermined = results.filter((r) => r.verdict === 'undetermined')
  out.push('')
  out.push(
    `收集失败端 ${violated.length} / 未判定端 ${undetermined.length} / 达标端 ${
      results.length - violated.length - undetermined.length
    }(共 ${results.length} 端)`,
  )
  out.push(
    violated.length > 0
      ? '  上面这些端的收集失败套件里,**每一条 it 声明都没有执行过** —— 覆盖看着在、实际不在。'
      : '  本门为 warn 级:判红不阻塞提交(与改动无关的恒红门只会逼人 --no-verify,连带废掉全部守门)。',
  )
  if (strict) out.push('  (--strict:未判定亦计红 —— CI/巡检要求必须有结论。)')
  console.log(out.join('\n'))
}

async function selfTest() {
  const { mkScratch, rmScratch } = await import('./lib/scratch-dir.mjs')
  const scratch = mkScratch('test-collection-gate')
  let pass = 0
  let fail = 0
  const ok = (name, cond, extra = '') => {
    if (cond) {
      pass += 1
      console.log(`  ✅ ${name}`)
    } else {
      fail += 1
      console.log(`  ❌ ${name}${extra ? ` — ${extra}` : ''}`)
    }
  }
  /** 造一个"假端":真文件(不用 junction,避免相对 symlink 在改道后解析错位),
   *  其 vitest 入口原样打印一段真实捕获的输出并以给定码退出。 */
  const mkEnd = (name, { script = 'vitest run', output = null, code = 0 } = {}) => {
    const dir = join(scratch, name)
    mkdirSync(join(dir, 'node_modules', 'vitest'), { recursive: true })
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ name: `fake-${name}`, scripts: { test: script } }, null, 2),
    )
    writeFileSync(
      join(dir, 'node_modules', 'vitest', 'package.json'),
      JSON.stringify({ name: 'vitest', version: '0.0.0-fake', bin: { vitest: 'vitest.mjs' } }, null, 2),
    )
    if (output !== null) {
      writeFileSync(
        join(dir, 'node_modules', 'vitest', 'vitest.mjs'),
        `process.stdout.write(${JSON.stringify(output)})\nprocess.exit(${code})\n`,
      )
    } else {
      writeFileSync(join(dir, 'node_modules', 'vitest', 'vitest.mjs'), 'process.exit(0)\n')
    }
    return dir
  }

  // 真实捕获的 vitest 4.1.10 输出(收集失败 / 断言失败 / 全绿 / 空扫),含 ANSI 转义
  const COLLECT_OUT =
    '\x1b[31m⎯⎯⎯⎯⎯⎯\x1b[39m\x1b[1m\x1b[41m Failed Suites 1 \x1b[49m\x1b[22m\x1b[31m⎯⎯⎯⎯⎯⎯\x1b[39m\n' +
    '\n FAIL \x1b[22m\x1b[49m tests/broken.test.ts\x1b[2m [ tests/broken.test.ts ]\x1b[22m\n' +
    'Error: Transform failed with 1 error:\nbroken.test.ts:1:17: ERROR: Unexpected ";"\n\n' +
    '\x1b[31m Test Files  \x1b[39m\x1b[31m1 failed\x1b[39m\x1b[90m (1)\x1b[39m\n' +
    '\x1b[31m      Tests \x1b[39m no tests\n'
  const ASSERT_OUT =
    '\x1b[31m⎯⎯⎯ Failed Tests 1 ⎯⎯⎯\x1b[39m\n FAIL  tests/f.test.ts \x1b[2m>\x1b[22m a \x1b[2m>\x1b[22m b\n' +
    'AssertionError: expected 1 to be 2\n\n' +
    ' Test Files  1 failed (1)\n      Tests  1 failed (1)\n'
  const GREEN_OUT = ' ✓ tests/p.test.ts (1 test) 2ms\n Test Files  1 passed (1)\n      Tests  1 passed (1)\n'
  const EMPTY_OUT = 'No test files found, exiting with code 1\n\ninclude: **/*.{test,spec}.?(c|m)[jt]s?(x)\n'

  console.log('check-test-collection-runs --self-test')

  // A1/A2:收集失败 ⇒ 判红,且必须报出文件与**报错首行**(首行是判据的核心产出)
  const a1 = runEnd(mkEnd('collect', { output: COLLECT_OUT, code: 1 }))
  ok('A1 有收集失败 ⇒ violation', a1.verdict === 'violation', JSON.stringify(a1))
  ok(
    'A2 报出套件名与报错首行(不是只报个数)',
    a1.collectionFailures?.length === 1 &&
      a1.collectionFailures[0].file === 'tests/broken.test.ts' &&
      a1.collectionFailures[0].firstErrorLine.startsWith('Error: Transform failed'),
    JSON.stringify(a1.collectionFailures),
  )

  // A3/A4:全绿 ⇒ 达标(反向对照,证明本门不是恒红)
  const a2 = runEnd(mkEnd('green', { output: GREEN_OUT, code: 0 }))
  ok('A3 全绿 ⇒ ok(不是恒红门)', a2.verdict === 'ok', JSON.stringify(a2))
  ok('A4 全绿时收集失败计数为 0', a2.count === 0)

  // A5/A6:断言失败**不得**混计为收集失败(两种文件级形态都写 `Test Files 1 failed`)
  const a3 = runEnd(mkEnd('assert', { output: ASSERT_OUT, code: 1 }))
  ok('A5 只有断言失败 ⇒ 不判红', a3.verdict === 'ok', JSON.stringify(a3))
  ok('A6 断言失败如实报数且与收集失败分离', a3.assertionFailures === 1 && a3.count === 0)

  // A7:空扫绝不记绿
  const a4 = runEnd(mkEnd('empty', { output: EMPTY_OUT, code: 1 }))
  ok('A7 零测试文件 ⇒ 判红(空扫不得当绿)', a4.verdict === 'violation', JSON.stringify(a4))

  // A8/A9:取不到入口 / 非 vitest / 无 test script ⇒ 未判定并给原因,绝不记绿
  const noVitest = join(scratch, 'novitest')
  mkdirSync(noVitest, { recursive: true })
  writeFileSync(join(noVitest, 'package.json'), JSON.stringify({ scripts: { test: 'vitest run' } }))
  const a5 = runEnd(noVitest)
  ok('A8 vitest 入口不可解析 ⇒ 未判定', a5.verdict === 'undetermined' && /入口不可解析/.test(a5.reason))
  const a6 = runEnd(mkEnd('pytest', { script: 'pytest -q' }))
  ok('A9 非 vitest 端(pytest)⇒ 未判定并说明', a6.verdict === 'undetermined' && /不是 vitest/.test(a6.reason))
  const a7 = runEnd(mkEnd('notest', { script: '' }))
  ok('A10 该端无 test script ⇒ 未判定', a7.verdict === 'undetermined' && /test script/.test(a7.reason))

  // A11:输出解析不到汇总行 ⇒ 未判定(不得因为"没看到红"就记绿)
  const a8 = runEnd(mkEnd('nosummary', { output: 'some runner started...\n', code: 0 }))
  ok('A11 无汇总行 ⇒ 未判定', a8.verdict === 'undetermined' && /Test Files/.test(a8.reason), JSON.stringify(a8))

  // A12:超时 ⇒ 未判定(判据:timeoutMs 远小于 sleep)
  const slowDir = mkEnd('slow')
  writeFileSync(
    join(slowDir, 'node_modules', 'vitest', 'vitest.mjs'),
    'setTimeout(() => process.exit(0), 15000)\n',
  )
  const a9 = runEnd(slowDir, { timeoutMs: 1500 })
  ok('A12 超时 ⇒ 未判定而非判红/记绿', a9.verdict === 'undetermined' && /没跑完/.test(a9.reason), JSON.stringify(a9))

  // A13/14:退出码语义(默认未判定 2;strict 计红 1;判红恒 1)
  ok('A13 未判定默认 exit 2(不记绿)', decideExit([{ verdict: 'undetermined' }], { strict: false }) === 2)
  ok('A14 未判定在 --strict 下计红 exit 1', decideExit([{ verdict: 'undetermined' }], { strict: true }) === 1)
  ok(
    'A15 判红优先于未判定恒 1',
    decideExit([{ verdict: 'undetermined' }, { verdict: 'violation' }], { strict: false }) === 1,
  )

  // A16:计数对账 —— 区块头与逐条数不一致时取大值并点名(绝不静默少报)
  const drift = parseVitestOutput(
    'Failed Suites 3\n FAIL  a.test.ts [ a.test.ts ]\nError: x\n Test Files  3 failed (3)\n',
    { exitCode: 1 },
  )
  ok('A16 区块头 3 而逐条 1 ⇒ count 取大且点名漂移', drift.count === 3 && drift.countDrift === true, JSON.stringify(drift))

  // A17:同一份输出喂两遍结论一致(判据不得依赖状态)
  ok('A17 纯函数幂等', parseVitestOutput(ASSERT_OUT, { exitCode: 1 }).verdict === 'ok')

  // A18:文件被收集到却 0 用例 ⇒ 不判红(占位文件合法),但必须如实计数(静默归零要可见)
  const a18 = parseVitestOutput(
    ' ✓ tests/placeholder.test.ts (0 test)\n\n Test Files  1 passed (1)\n      Tests  no tests\n',
    { exitCode: 0 },
  )
  ok(
    'A18 收集到却 0 用例 ⇒ 不判红但计数可见',
    a18.verdict === 'ok' && a18.emptyCollected.length === 1 && a18.emptyCollected[0] === 'tests/placeholder.test.ts',
    JSON.stringify({ v: a18.verdict, e: a18.emptyCollected }),
  )

  rmScratch(scratch)
  console.log(`\n${fail === 0 ? '✅' : '❌'} self-test:${pass} 通过 / ${fail} 失败`)
  return fail === 0 ? 0 : 1
}

function parseArg(argv, name) {
  const i = argv.indexOf(name)
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : null
}

async function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) {
    process.exitCode = await selfTest()
    return
  }
  const KNOWN = new Set(['--strict', '--staged', '--end', '--timeout', '--self-test'])
  for (const a of argv) {
    if (a.startsWith('--') && !KNOWN.has(a)) {
      console.error(`❌ 未知开关:${a}(可用:${[...KNOWN].join(' ')})`)
      process.exitCode = 2
      return
    }
  }
  const ends = []
  for (let i = 0; i < argv.length; i += 1) if (argv[i] === '--end' && argv[i + 1]) ends.push(argv[++i])
  const targets = (ends.length > 0 ? ends : DEFAULT_ENDS).map((e) => resolve(ROOT, e))
  const rawTimeout = parseArg(argv, '--timeout')
  const timeoutMs = rawTimeout === null ? DEFAULT_TIMEOUT_MS : Number(rawTimeout)
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    console.error(`❌ --timeout 必须是正整数毫秒,收到:${rawTimeout}`)
    process.exitCode = 2
    return
  }
  const strict = argv.includes('--strict')
  // --staged 由 guardian-runner 自动下发。本门判的是"端能不能收集到用例",这是**全端属性**,
  // 按暂存收窄只会漏判(改一个共享包就足以让整端收集失败),所以照全量跑、只如实登记口径。
  if (argv.includes('--staged')) console.log('[staged] 本门不接受按暂存收窄(全端属性),按全量判定。')

  console.log(`测试收集存续性对账 · 受检端 ${targets.join(', ') || '(无)'}`)
  const results = targets.map((dir) => ({ end: dir, ...runEnd(dir, { timeoutMs }) }))
  report(results, { strict })
  process.exitCode = decideExit(results, { strict })
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main().catch((e) => {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  })
}

/** §22c:判据函数一并暴露给镜像测试(测试不得复制一份实现)。 */
export const __test__ = {
  parseVitestOutput,
  resolveEnd,
  runEnd,
  decideExit,
  stripAnsi,
  DEFAULT_ENDS,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
