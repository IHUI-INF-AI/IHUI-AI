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
 *   ④ **受检形态必须等于该端真实跑法**(2026-10-19 加,起因是实测到的假红):派生时原样带上
 *      该端 `scripts.test` 里 vitest 那一次调用的全部参数,不再固定 `[入口, 'run']`。
 *      实测反例:`packages/app` 的 script 带 `--environment jsdom`,丢旗标后 5 枚套件
 *      31 条用例以 `document is not defined` 红,按该端跑法复跑 22/22 绿。取不到调用点
 *      (script 里 vitest 不在命令位)、多于一次调用、裸 `vitest` 无子命令 —— 三型一律未判定。
 *
 * 派生纪律(AGENTS §5b):一律 `execFileSync(<绝对路径 node>, [<绝对路径 vitest 入口>, …])`,
 *   带 `windowsHide: true`(钩子/GUI 宿主无控制台时漏了必弹窗)与 `timeout`(漏了会把提交挂死)。
 *   不走 `pnpm test` —— 那依赖 PATH,服务与钩子进程下必失。
 *
 * 用法:
 *   node scripts/check-test-collection-runs.mjs                 # 默认只跑 apps/mobile-rn(提交链那一条窄腿)
 *   node scripts/check-test-collection-runs.mjs --end apps/web  # 指定端(该端须是 vitest 入口)
 *   node scripts/check-test-collection-runs.mjs --all-ends      # 受检面 = HEAD 面枚举出的全部端(实测 20 分钟量级,只给巡检/CI,不进提交链)
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
import { flagValue, describeFlagToken } from './lib/flag-value.mjs'
// 取材走 face-reader(§0.4:清单取被审面,不 readdir 磁盘;派生 git 的 stdio/超时纪律也住在那里)
import { gitRaw } from './lib/face-reader.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** 默认受检端:只有它被**实测证明**会静默削覆盖;扩端须显式 `--end`,或用 `--all-ends` 现读枚举。 */
export const DEFAULT_ENDS = ['apps/mobile-rn']

/**
 * **全端枚举**(2026-10-20 立,G-29 那一格的器物):"全端"必须是量出来的,不是手敲出来的。
 *
 * 立因是现读到的一个假绿形态:票面 G-29 把升档前置写成"**全端**收集失败数现读归零",而本门默认档
 * 只有 `apps/mobile-rn` 一枚端(2026-10-20 实测:单端跑 19s,16 端跑 20 分钟,塞进提交链就是恒红门,
 * 所以窄腿是对的 —— 但**账面上写"全端"而尺子只量一端**,那是把没量写成量过)。要拿全端读数,
 * 此前必须手敲 16 个 `--end`;漏敲一个端、或将来新增第 17 个端没人敲,汇总行照样打"收集失败端 0"。
 * 枚举口径:`apps/*` 与 `packages/*` 下有 `package.json` 的目录 —— 只回答"有哪些端",
 * **不回答"哪些端算数"**(后者由 `resolveEnd` 那一份判据管,本文件不另写第二把 vitest 尺子,§0.6)。
 *
 * 取材面纪律(§0.4 / 守门 118):清单取自 **HEAD 面**(`git ls-tree`),列不出 ⇒ 返回 `error`,
 * 调用方必须显式未判定;绝不回落 `readdir`(那会把"这台机盘上有什么"读成"仓库里有什么"),
 * 也绝不把 0 个端读成"没有端要跑"—— 枚举到 0 判死(§0.3)。
 *
 * @param {string} root 仓库根
 * @param {{run?:Function}} deps 注入口(自检用假 `ls-tree` 输出喂,真跑走 face-reader)
 * @returns {{ends:string[], error:string|null}}
 */
export function listHeadEnds(root = ROOT, { run = gitRaw } = {}) {
  let out
  try {
    out = run(['ls-tree', '-r', '--name-only', 'HEAD', '--', 'apps', 'packages'], root)
  } catch (e) {
    return { ends: [], error: `HEAD 面列不出端清单:${String(e?.message ?? e).split('\n')[0]}` }
  }
  const ends = []
  for (const line of String(out ?? '').split('\n')) {
    const seg = line.trim().split('/')
    // 只收 `apps/<端>/package.json` 与 `packages/<包>/package.json` 这一层:
    // 更深位置的 package.json(夹具、vendored 依赖)不是"端",收进来就是拿噪声冒充覆盖面。
    if (seg.length !== 3 || seg[2] !== 'package.json') continue
    if (seg[0] !== 'apps' && seg[0] !== 'packages') continue
    ends.push(`${seg[0]}/${seg[1]}`)
  }
  return { ends: ends.sort(), error: null }
}

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

/**
 * 把一段 test script 里 **vitest 那一次调用**的参数原样取出来。
 *
 * 为什么必须有这一格(2026-10-19 实测到的假红):本门原先固定派生 `[入口, 'run']`,
 * 把该端 script 自带的旗标整片丢掉。`packages/app` 的 test script 是
 * `vitest run --environment jsdom --passWithNoTests`,少了 `--environment jsdom`
 * 之后 5 个套件里的 31 条用例全部以 `ReferenceError: document is not defined` 失败 ——
 * 而按该端真实跑法复跑是 22/22 绿。门判的是"这一端能不能收集到用例",拿**另一种跑法**
 * 去量它,读到的红与该端真实交付面无关(与 §0.4 同面同轮同一条理由)。
 * 更危险的是反方向:若某端靠旗标才让套件可被收集,丢旗标会造出**根本不存在的收集失败**。
 *
 * 口径:
 *  - 按 shell 连接符(`&&` / `||` / `;` / 管道)切段,只认**命令位上是 vitest** 的那一段
 *    (前面允许 `node` / `pnpm` / `npx` / `yarn` / `tsx` 这类 runner 前缀);
 *  - 0 段命中 ⇒ 取不到调用点(`\bvitest\b` 只是出现在别处,如旗标值或注释)⇒ **未判定**,不猜;
 *  - ≥2 段命中 ⇒ 无从判断哪一次才是受检的那一轮 ⇒ **未判定**,不猜;
 *  - 命中段里 `vitest` 之后的全部词元原样透传(含 `run` 与其余旗标),引号形态按成对引号切词。
 *
 * @param {string} testScript
 * @returns {{argv?: string[], reason?: string}}
 */
/**
 * "这一条 test script 是不是 vitest 入口"的**唯一**判据(2026-10-20 提出共用)。
 * `resolveEnd` 用它定射程,`--all-ends` 的枚举面也用它 —— 两处各写一遍 `\bvitest\b`
 * 就是两把尺子(§0.6/§22c:枚举侧放宽而判据侧没放宽,漏掉的端会静默不进账)。
 */
export function hasVitestEntry(testScript) {
  return typeof testScript === 'string' && /\bvitest\b/.test(testScript)
}

export function vitestArgvOf(testScript) {
  const segments = String(testScript)
    .split(/&&|\|\||[;|]/)
    .map((s) => s.trim())
    .filter(Boolean)
  const hits = []
  for (const seg of segments) {
    const tokens = tokenizeShellWords(seg)
    const i = tokens.findIndex(
      (t, idx) => t === 'vitest' && (idx === 0 || RUNNER_PREFIXES.has(tokens[idx - 1])),
    )
    if (i >= 0) hits.push(tokens.slice(i + 1))
  }
  if (hits.length === 0) {
    return { reason: `test script 里找不到 vitest 的调用点(实为 "${oneLine(testScript, 80)}")⇒ 本门无法按该端跑法派生` }
  }
  if (hits.length > 1) {
    return { reason: `test script 里有 ${hits.length} 次 vitest 调用 ⇒ 无法判定该量哪一轮,请人工拆成单一入口` }
  }
  if (hits[0].length === 0) {
    return { reason: `test script 只有 vitest 命令词而无子命令 ⇒ 子命令取不到(裸 vitest 是 watch 形态),不替该端猜` }
  }
  return { argv: hits[0] }
}

/** runner 前缀白名单:只有这些词紧跟 vitest 时,vitest 才算命令位(否则 `--config vitest` 之类会误认)。 */
const RUNNER_PREFIXES = new Set(['node', 'pnpm', 'npx', 'yarn', 'tsx', 'ts-node', 'bun', 'deno'])

/** 成对引号感知的空白切词(单引号内原样、双引号内不展开 —— 本仓 test script 无转义需求)。 */
function tokenizeShellWords(s) {
  const out = []
  let cur = ''
  let quote = null
  let has = false
  for (const ch of s) {
    if (quote) {
      if (ch === quote) quote = null
      else cur += ch
      continue
    }
    if (ch === '"' || ch === "'") {
      quote = ch
      has = true
      continue
    }
    if (/\s/.test(ch)) {
      if (has || cur) out.push(cur)
      cur = ''
      has = false
      continue
    }
    cur += ch
  }
  if (has || cur) out.push(cur)
  return out
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
  // 以下两格是**按定义不在射程**(out-of-scope),不是"该跑而没跑成"(undetermined):
  // 本门只认 JS 系 vitest 的收集版式(文件头),没有 test script、或 test 入口根本不是 vitest 的端,
  // 按定义拿不到这份证据 —— 把它计成未判定再配 --strict,就是给一台跑得通的机器造恒红门(§12e)。
  // 但**绝不静默丢弃**:两者都带 reason 逐条点名,且与"vitest 声明了却解不出口"那一型分色。
  if (!testScript)
    return {
      scope: 'out-of-scope',
      reason: `该端没有 test script:${endDir} ⇒ 本门射程外(不是"没跑到",也不是"没有测试")`,
    }
  if (!hasVitestEntry(testScript)) {
    return {
      scope: 'out-of-scope',
      reason: `test 入口不是 vitest(实为 "${oneLine(testScript, 80)}")⇒ 本门只认 JS 系收集判据,该端射程外`,
    }
  }
  // 派生形态必须与该端真实跑法同形:取该端 script 里 vitest 那一次调用的参数原样透传。
  const spec = vitestArgvOf(testScript)
  if (spec.reason) return { reason: `${spec.reason}(端 ${endDir})` }
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
      if (existsSync(entry)) return { entry, vitestVersion: m.version, argv: spec.argv }
    } catch {
      /* 清单坏了 ⇒ 换下一个候选,但绝不静默当成"没有 vitest" */
    }
  }
  return { reason: `vitest 入口不可解析(${endDir}/node_modules/vitest 与根 node_modules/vitest 都没有可执行入口)` }
}

/** 真跑一端:派生纪律见文件头(绝对路径 + windowsHide + timeout)。 */
export function runEnd(endDir, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const resolved = resolveEnd(endDir)
  if (resolved.reason)
    return {
      // 三态分色:射程外 ≠ 未判定 ≠ 达标。把"按定义不在这条规则射程"计成未判定,
      // 配上 --strict 就是一台恒红门(§12e);把它静默丢掉则是把没量写成量过(§0.3)。
      verdict: resolved.scope === 'out-of-scope' ? 'out-of-scope' : 'undetermined',
      reason: resolved.reason,
    }

  let stdout = ''
  let stderr = ''
  let exitCode = 0
  try {
    stdout = execFileSync(process.execPath, [resolved.entry, ...resolved.argv], {
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
  return { ...parsed, vitestVersion: resolved.vitestVersion, argv: resolved.argv }
}

/** 退出码:判红 1 > 未判定(strict 计红 1 / 默认 2)> 达标 0。 */
export function decideExit(results, { strict } = {}) {
  const violated = results.filter((r) => r.verdict === 'violation')
  const undetermined = results.filter((r) => r.verdict === 'undetermined')
  const judged = results.filter((r) => r.verdict === 'ok' || r.verdict === 'violation')
  if (violated.length > 0) return 1
  // 全批都在射程外 ⇒ 这一轮等于没量(不得读成"全部达标")。判死,不记绿(§0.3)。
  if (results.length > 0 && judged.length === 0 && undetermined.length === 0) return 2
  if (undetermined.length > 0) return strict ? 1 : 2
  return 0
}

export function report(results, { strict }) {
  const out = []
  for (const r of results) {
    out.push(
      `\n· 端 ${r.end}${r.vitestVersion ? ` (vitest ${r.vitestVersion})` : ''}${r.argv ? ` · 跑法: vitest ${r.argv.join(' ')}` : ''}`,
    )
    if (r.verdict === 'out-of-scope') {
      out.push(`  🚪 射程外:${r.reason}`)
      out.push('     说明:这一格按**定义**不在本门射程(vitest 的收集版式只存在于 JS 系端),')
      out.push('     它既不是"没跑到"也不是"没有测试"——逐条点名,不计红也不冒充跑过。')
      continue
    }
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
  const scoped = results.filter((r) => r.verdict === 'out-of-scope')
  out.push('')
  out.push(
    `收集失败端 ${violated.length} / 未判定端 ${undetermined.length} / 达标端 ${
      results.length - violated.length - undetermined.length - scoped.length
    } / 射程外端 ${scoped.length}(共 ${results.length} 端)`,
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
      // `script: null` = 这一枚端**没有** test script(A30 的那一格);undefined 仍走默认值
      JSON.stringify({ name: `fake-${name}`, scripts: script === null ? {} : { test: script } }, null, 2),
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
  ok(
    // 〔改判@2026-10-20,原句"A9 非 vitest 端(pytest)⇒ 未判定并说明"逐字留档只作改判留痕读〕:
    // 这一格按定义不在射程,不是"该跑而没跑成"。计成未判定再配 --strict,就是给一台跑得通的机器
    // 造恒红门(§12e);而 --all-ends 的枚举面里 25 端只有 16 端是 vitest 入口,不分色就是 9 端恒红。
    // 真·未判定仍由 A8/A11/A12/A32 钉住(摘掉分色不会把那些一起放掉)。
    'A9 改判:非 vitest 端(pytest)⇒ 射程外并点名,不再计未判定',
    a6.verdict === 'out-of-scope' && /不是 vitest/.test(a6.reason),
    JSON.stringify(a6),
  )
  const a7 = runEnd(mkEnd('notest', { script: '' }))
  ok(
    // 〔改判@2026-10-20,原句"A10 该端无 test script ⇒ 未判定"逐字留档,理由同 A9〕
    'A10 改判:该端无 test script ⇒ 射程外(逐条点名,不静默丢弃)',
    a7.verdict === 'out-of-scope' && /test script/.test(a7.reason),
    JSON.stringify(a7),
  )

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

  // A19–A22(2026-10-19 立):派生形态必须与该端 test script 同形。
  //   立因实测:本门原先固定 `[入口, 'run']`,而 packages/app 的 script 带
  //   `--environment jsdom` ⇒ 5 枚套件 31 条用例以 `document is not defined` 假红,
  //   按该端真实跑法复跑 22/22 绿。丢旗标既会造假红,也会造**根本不存在的收集失败**。
  const echoOut = ' Test Files  1 passed (1)\n      Tests  1 passed (1)\n'
  const flagDir = mkEnd('flagged', {
    script: 'vitest run --environment jsdom --passWithNoTests',
    output: echoOut,
  })
  writeFileSync(
    join(flagDir, 'node_modules', 'vitest', 'vitest.mjs'),
    `import fs from 'node:fs'\nfs.writeFileSync(${JSON.stringify(join(scratch, 'flagged-argv.txt'))}, JSON.stringify(process.argv.slice(2)))\nprocess.stdout.write(${JSON.stringify(echoOut)})\n`,
  )
  const a19 = runEnd(flagDir)
  let gotArgv = null
  try {
    gotArgv = JSON.parse(readFileSync(join(scratch, 'flagged-argv.txt'), 'utf8'))
  } catch (e) {
    gotArgv = `读取失败:${e.message}`
  }
  ok(
    'A19 该端 script 的旗标必须原样透传(装到真派生层,不是只判字符串)',
    (Array.isArray(gotArgv) ? gotArgv.join(' ') : String(gotArgv)) ===
      'run --environment jsdom --passWithNoTests',
    JSON.stringify(gotArgv),
  )
  ok(
    'A20 透传后判据仍按输出定性 ⇒ 达标,且自述跑法等于实测 argv',
    a19.verdict === 'ok' && JSON.stringify(a19.argv) === JSON.stringify(gotArgv),
    JSON.stringify(a19),
  )
  const a21 = runEnd(mkEnd('multi', { script: 'vitest run && vitest run --coverage', output: echoOut }))
  ok(
    'A21 两次 vitest 调用 ⇒ 未判定(不替该端挑一轮)',
    a21.verdict === 'undetermined' && /无法判定该量哪一轮/.test(a21.reason),
    JSON.stringify(a21),
  )
  const a22 = runEnd(mkEnd('bare', { script: 'vitest', output: echoOut }))
  ok(
    'A22 裸 vitest(无子命令)⇒ 未判定,不猜 run 也不落 watch',
    a22.verdict === 'undetermined' && /子命令取不到/.test(a22.reason),
    JSON.stringify(a22),
  )

  // A23–A25:vitestArgvOf 纯函数面(命令位才算数;旗标值里的 "vitest" 不算;带引号的值原样成一个词)
  ok(
    'A23 vitest 只出现在旗标值 ⇒ 取不到调用点',
    /找不到 vitest 的调用点/.test(vitestArgvOf('--config vitest.json run').reason || ''),
  )
  ok(
    'A24 runner 前缀 + 带引号参数:命令位认出,值不被拆碎',
    JSON.stringify(vitestArgvOf('pnpm vitest run -t "a b"')) === JSON.stringify({ argv: ['run', '-t', 'a b'] }),
  )
  ok(
    'A25 正例对照:连接符后那一段才是 vitest 调用(与 apps/web 实测形态同形)',
    JSON.stringify(vitestArgvOf('node scripts/clean-vite-temp.mjs && vitest run --passWithNoTests')) ===
      JSON.stringify({ argv: ['run', '--passWithNoTests'] }),
  )

  // A26–A29(2026-10-20 立,G-29):全端枚举。立因是"账面上写全端、尺子只量一端"——
  //   票面前置是"全端归零",而拿全端读数此前要手敲 16 个 --end:漏敲一个端,汇总行照样打 0。
  const fakeRun = (out) => () => out
  const lsOut = [
    'apps/web/package.json',
    'packages/app/package.json',
    'apps/mobile-rn/package.json',
    'apps/desktop/src-tauri/Cargo.toml',
    // 真仓实测形态:apps/zcode-cli 里嵌着上游包的 package.json,它不是"端"。
    // 收进来就是拿噪声冒充覆盖面(更深位置一律排除)。
    'apps/zcode-cli/packages/core/package.json',
    'packages/i18n/messages/zh/package.json',
    'README.md',
  ].join('\n')
  const a26 = listHeadEnds(ROOT, { run: fakeRun(lsOut) })
  ok(
    `A26 只收 apps/<端>/package.json 与 packages/<包>/package.json 这一层(实测得 ${a26.ends.join(',')})`,
    JSON.stringify(a26.ends) ===
      JSON.stringify(['apps/mobile-rn', 'apps/web', 'packages/app']) && a26.error === null,
  )
  const a27 = listHeadEnds(ROOT, {
    run: () => {
      throw new Error('模拟:HEAD 不可解析')
    },
  })
  ok(
    'A27 列不出清单 ⇒ error 非空且 ends 为空(调用方必须 exit 2,不得回落磁盘)',
    a27.ends.length === 0 && /HEAD 不可解析/.test(a27.error || ''),
    JSON.stringify(a27),
  )
  const a28 = listHeadEnds(ROOT, { run: fakeRun('') })
  ok(
    'A28 空清单 ⇒ ends 0 枚(这一枚就是"枚举到 0 判死"的前置,不得读成"没有端要跑")',
    a28.ends.length === 0 && a28.error === null,
  )
  const a29 = listHeadEnds(ROOT)
  ok(
    `A29 真仓 HEAD 面现读枚举到 ${a29.ends.length} 端,且默认腿每一枚都在枚举里(端被改名/删除 ⇒ 这一条先响)`,
    a29.error === null &&
      a29.ends.length >= 15 &&
      DEFAULT_ENDS.every((e) => a29.ends.includes(e)),
    JSON.stringify(a29).slice(0, 260),
  )

  // A30–A32(2026-10-20 立,G-929 三态分色):"射程外"不得被计成未判定(配 --strict 就是恒红门),
  // 也不得被丢出账面(那等于把没量写成量过)。
  const a30 = runEnd(mkEnd('notest', { script: null }))
  ok(
    `A30 无 test script ⇒ 射程外(不是未判定):${a30.verdict}`,
    a30.verdict === 'out-of-scope' && /没有 test script/.test(a30.reason || ''),
    JSON.stringify(a30),
  )
  const a31 = runEnd(mkEnd('jestish', { script: 'jest --ci' }))
  const okEnd = runEnd(mkEnd('greenish', { output: GREEN_OUT }))
  ok(
    'A31 非 vitest 入口 ⇒ 射程外,且不连累同批达标的端(strict 档也 0)',
    a31.verdict === 'out-of-scope' &&
      decideExit([{ end: 'a', ...a31 }, { end: 'b', ...okEnd }], { strict: true }) === 0,
    JSON.stringify({ a31, exit: decideExit([a31, okEnd], { strict: true }) }),
  )
  // 阳性对照:该跑而没跑成(vitest 声明了却取不到子命令)⇒ 仍是未判定,strict 档必须计红。
  const a32 = runEnd(mkEnd('noargv', { script: 'vitest' }))
  ok(
    'A32 阳性对照:声明 vitest 而跑法取不到 ⇒ 未判定,strict 下计红(射程外那一档没把真故障一起放掉)',
    a32.verdict === 'undetermined' &&
      decideExit([{ end: 'x', ...a32 }], { strict: true }) === 1 &&
      decideExit([{ end: 'x', ...a32 }], { strict: false }) === 2,
    JSON.stringify(a32),
  )
  ok(
    'A33 全批射程外 ⇒ 判死(2),不得读成"全部达标"',
    decideExit([{ end: 'a', ...a30 }, { end: 'b', ...a31 }], { strict: true }) === 2,
  )

  rmScratch(scratch)
  console.log(`\n${fail === 0 ? '✅' : '❌'} self-test:${pass} 通过 / ${fail} 失败`)
  return fail === 0 ? 0 : 1
}

async function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) {
    process.exitCode = await selfTest()
    return
  }
  const KNOWN = new Set(['--strict', '--staged', '--end', '--all-ends', '--timeout', '--self-test'])
  for (const a of argv) {
    if (a.startsWith('--') && !KNOWN.has(a)) {
      console.error(`❌ 未知开关:${a}(可用:${[...KNOWN].join(' ')})`)
      process.exitCode = 2
      return
    }
  }
  const ends = []
  // G-322:--end 给旗标不给值(结尾漏值)一律 exit 2 点名 —— 旧写法只查 truthy,漏值静默退
  // DEFAULT_ENDS;`--end --strict` 会把 "--strict" 吞成端目录名。多次给 --end 仍全部收进。
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] !== '--end') continue
    const next = argv[i + 1]
    if (next === undefined || next === '' || next.startsWith('-')) {
      console.error(
        `❌ --end 需要一个端目录 —— 紧邻的 token 实得:${next === undefined ? '(其后没有任何参数)' : JSON.stringify(next)}(不得静默退回默认端)`,
      )
      process.exitCode = 2
      return
    }
    ends.push(next)
    i += 1
  }
  const targets = (ends.length > 0 ? ends : DEFAULT_ENDS).map((e) => resolve(ROOT, e))
  /**
   * `--all-ends`(2026-10-20,G-29):受检面 = **HEAD 面枚举出的全部端** ∪ 默认腿。
   * 三条不许打折:枚举失败 ⇒ exit 2 未判定(不回落磁盘、不退回默认腿冒充"跑过了");
   * 枚举到 0 枚 ⇒ exit 2(判死不记绿);默认腿永远并在里面 ⇒ 账面上不会出现"默认那端今天没跑"。
   */
  const allEnds = argv.includes('--all-ends')
  let finalTargets = targets
  let enumerated = null
  if (allEnds) {
    const { ends: found, error } = listHeadEnds(ROOT)
    if (error) {
      console.error(`❌ ${error} ⇒ 未判定(不得回落磁盘枚举,也不得读成"没有端")`)
      process.exitCode = 2
      return
    }
    if (found.length === 0) {
      console.error('❌ HEAD 面枚举到 0 个端目录 ⇒ 判死,不记绿(枚举空不是"没有测试可跑")')
      process.exitCode = 2
      return
    }
    enumerated = found
    finalTargets = [...new Set([...DEFAULT_ENDS, ...found])].map((e) => resolve(ROOT, e))
  }
  // G-322:--timeout 给旗标不给值(结尾漏值/被下一旗标顶值)一律 exit 2 点名,不静默落默认超时。
  const timeoutFlag = flagValue(argv, '--timeout')
  if (timeoutFlag.present && !timeoutFlag.valid) {
    console.error(
      `❌ --timeout 需要一个正整数毫秒 —— 紧邻的 token 实得:${describeFlagToken(timeoutFlag)}(不得静默退回默认)`,
    )
    process.exitCode = 2
    return
  }
  const rawTimeout = timeoutFlag.present ? timeoutFlag.value : null
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

  console.log(
    `测试收集存续性对账 · 受检端 ${finalTargets.join(', ') || '(无)'}${
      allEnds ? ` [枚举自 HEAD 面:${enumerated.length} 端 + 默认腿并集 ${finalTargets.length} 端]` : ''
    }`,
  )
  const results = finalTargets.map((dir) => ({ end: dir, ...runEnd(dir, { timeoutMs }) }))
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
  vitestArgvOf,
  hasVitestEntry,
  listHeadEnds,
  decideExit,
  stripAnsi,
  DEFAULT_ENDS,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
