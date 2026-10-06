// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-1058646(2026-10-06 立):`pnpm --filter @ihui/ai-service run test:py` 的真身。
 *
 * ## 立因(为什么这条命令必须有一具"不会静默"的身体)
 *
 * `apps/ai-service/package.json` 里从来没有 `test` 脚本,而 pnpm 对"没有该脚本的包"
 * 是**跳过而不是报错**(守门 72 记的同一条型:`pnpm --filter <spec> run <script>` 静默跳过)。
 * 于是台账里 9 条引用 `pnpm --filter @ihui/ai-service test` 作为验收口径的待办,
 * 它们的"绿"读起来像跑过,实际是**根本没跑到**。
 * **脚本名刻意叫 `test:py` 而不是 `test`**:根 `pnpm test` = `turbo run test`,而 CI 那条
 * "Unit tests" job 里**没有 Python venv** —— 一台"取不到解释器即未判定(exit 2)"的尺子被
 * 挂进 CI 的通用测试档,等于把环境缺失变成全队恒红(§12e 同型)。静默跳过这一族缺陷与
 * 脚本叫什么无关:`test:py` 存在 ⇒ `pnpm --filter @ihui/ai-service run test:py` 真跑;
 * 引用旧名的台账行需另行改写(该 9 行不在本文件射程,归台账持有人)。
 * 2026-10-06 现读实证:`scripts/run-evidence.mjs` 封存的那一次 `#EVIDENCE-RC=0`,
 * 证据文件里**连一行命令输出都没有**(152 B,只有 4 行 `#EVIDENCE-*` 头尾)。
 *
 * ## 判据(三态分立,永不合并)
 *
 * 主判据 = **收集到的用例数 > 0 且无收集期失败**。两档执行:
 *   档一 `--collect-only`:证明"这一面真的收集到了 N 条用例、且收集期没有失败"。
 *     收集到 0 条 ⇒ **非零**并点名"未跑到";`no tests ran` / `no tests collected`
 *     这种形态**绝不允许**被读成通过。
 *   档二 实跑:只有"跑成功且 0 失败 0 错误"才落 0。
 * 断言失败与收集期失败**分开计数**:pytest 把两类放在不同的桶里(实测锚点见
 * `parsePytestSummary` 注),本脚本按文本信号分类,rc 只做辅助 —— 分类判据写在这里,
 * 被问得住。
 * 解释器 / venv 取不到、派生本身失败、超时、输出无可解析总结行 ⇒ **exit 2「未判定」**,
 * 不得冒绿。"未跑到"与"没判成"不是一回事,所以 1 与 2 不合并。
 *
 * ## 本机事实(现读,不抄文档)
 *
 * `python` 在 PATH 上是 Microsoft Store 别名(实测 rc=9009、"Python was not found"),
 * `py` 不存在(ENOENT);可用的解释器只有 `apps/ai-service/.venv` 那一份
 * (实测 `.venv/Scripts/python.exe -m pytest --version` ⇒ pytest 9.1.1)。
 * 因此**只认 venv**,不回退 PATH 上的裸 `python` —— 回退等于换一套依赖,
 * 收集期必然报错,那是"我们的脚本自己造的假红",不是被测面的红。
 * 候选表与 `scripts/check-egress-facts.mjs` / `check-principal-consumed.mjs` /
 * `check-load-state-loaded-marks.mjs` 的 `findPython` 同形(仓内既有惯例:各自内联两臂)。
 *
 * ## 派生纪律(§5b / 守门 52 / 守门 80)
 *
 * 每一次派生都带 `windowsHide: true`(控制台程序弹窗)、显式 `stdio`(漏 stdio 在本机
 * 是确定性 EBUSY)、有界 `timeout`(热路径子进程不得无界)、有界 `maxBuffer`。
 *
 * ## 用法
 *   node scripts/run-ai-service-tests.mjs [--collect-only] [--app-dir=<p>]
 *        [--python=<p>] [--timeout=<ms>] [-- <透传给 pytest 的参数>]
 *
 * 退出码:0 = 真绿;1 = 业务失败(未跑到 / 收集期失败 / 断言失败);
 * 2 = 本脚本自身判不成(未判定,**不是**通过)。
 */

import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..')
const TAG = '[run-ai-service-tests]'

/** 默认被测面:仓内固定的 ai-service 位置(由本脚本自身位置锚定,不依赖 cwd)。 */
export const DEFAULT_APP_DIR = join(REPO_ROOT, 'apps', 'ai-service')

/**
 * 单次派生的有界超时(守门 80)。取 30 分钟:全量档本机实测是分钟级
 * (`pyproject.toml` 的 `-n auto` 把 12.4k 用例从 29.5min 压到 ~3min),
 * 留一个数量级的余量,但仍然**有界** —— 有界才是判据,无界是运气。
 */
export const DEFAULT_TIMEOUT_MS = 1800000

/** 输出缓冲上限:`--collect-only` 逐条打印用例 id,全量面实测约 1.5 MB 量级。 */
export const MAX_BUFFER_BYTES = 64 * 1024 * 1024

/** 只认 venv 两臂(Windows / POSIX);刻意不含裸 `python` —— 见文件头注。 */
export function pythonCandidates(appDir) {
  return [
    join(appDir, '.venv', 'Scripts', 'python.exe'),
    join(appDir, '.venv', 'bin', 'python'),
  ]
}

/**
 * 纯函数:解释器选址。`exists` 可注入 ⇒ 三条臂都能用构造面证明(§22c),
 * 不必赌本机有没有 venv。
 *
 * `--python=` 指到不存在的路径 ⇒ 返回 null(未判定),**不回退**默认候选:
 * 显式指定的解释器拿不到,是"判定环境没备好",静默换一份解释器等于偷换被测面。
 */
export function resolvePython({ appDir = DEFAULT_APP_DIR, pythonOverride = null, exists = existsSync } = {}) {
  if (pythonOverride) return exists(pythonOverride) ? pythonOverride : null
  for (const c of pythonCandidates(appDir)) if (exists(c)) return c
  return null
}

function toNum(s) {
  return Number(String(s).replace(/,/g, ''))
}

/**
 * 纯函数:把 pytest 的 `-q` 输出拆成**分立**的桶。
 *
 * 锚点全是本机现读固化(见下方注释里的实测原文),不是照抄 pytest 文档:
 *  - 收集档有错:`3 tests collected, 1 error in 0.16s` + `ERROR collecting tests/test_imp.py`
 *    + `Interrupted: 1 error during collection`,rc=2;
 *  - 实跑档有收集期错:`1 error in 0.14s`,rc=2(此时**一条用例都没执行**,所以它绝不能算成断言失败);
 *  - 断言失败:`1 failed in 0.11s`,rc=1 —— 桶名是 `failed`,与 `error` 天然分家;
 *  - 空面:`no tests collected in 0.00s` / `no tests ran in 0.00s`,rc=5;
 *  - 正常:`1 test collected in 0.00s` / `1 passed in 0.01s`,rc=0。
 * 总结行是**唯一**带 `in <秒>s` 的行,所以取最后一条这种行做计数面。
 *
 * @returns {{summary:string,parsed:boolean,collected:number|null,passed:number,failed:number,
 *   errors:number,skipped:number,deselected:number,noTestsCollected:boolean,noTestsRan:boolean,
 *   collectionSignals:string[],errorSignals:string[]}}
 */
export function parsePytestSummary({ stdout = '', stderr = '', tier = 'run' } = {}) {
  const text = `${stdout}\n${stderr}`
  const lines = text.split(/\r?\n/)
  const summaryLines = lines.filter((l) => /\bin\s+\d[\d.,]*s\b/.test(l))
  const summary = summaryLines.length > 0 ? summaryLines[summaryLines.length - 1] : ''

  // collected:收集档的总结行写 `N tests collected`;`1 test collected` 单数也要吃到。
  const mCollected = summary.match(/(\d[\d,]*)\s+tests?\s+collected/)
  const collected = mCollected ? toNum(mCollected[1]) : /no tests collected/.test(summary) ? 0 : null

  const bucket = (name) => {
    const m = summary.match(new RegExp(`(\\d[\\d,]*)\\s+${name}\\b`))
    return m ? toNum(m[1]) : 0
  }

  const trimmed = lines.map((l) => l.trim())
  // 收集期信号(不是断言失败):pytest 自己点名"collecting / during collection / Interrupted"。
  const collectionSignals = trimmed.filter(
    (l) =>
      /^ERROR collecting\b/.test(l) ||
      /\berror[s]? during collection\b/.test(l) ||
      /^Interrupted:/.test(l) ||
      /^ImportError while importing\b/.test(l)
  )
  // 非断言错误桶(short test summary 里的 `ERROR …` 行:收集期与 setup/teardown 共用这一形状,
  // 由 collectionSignals 再分一层;两者都与 `FAILED`(断言失败)不同桶)。
  const errorSignals = trimmed.filter((l) => /^ERROR\b/.test(l))

  return {
    summary,
    parsed: Boolean(summary),
    tier,
    collected,
    passed: bucket('passed'),
    failed: bucket('failed'),
    errors: bucket('errors?'),
    skipped: bucket('skipped'),
    deselected: bucket('deselected'),
    noTestsCollected: /no tests collected/.test(summary),
    noTestsRan: /no tests ran/.test(summary),
    collectionSignals,
    errorSignals,
  }
}

/**
 * 纯函数:把一档的结果折成**三态之一**。判据本体只在这里定义一次。
 *
 * 顺序是刻意的(每条都对应一种会被读错的形态):
 *  1. 派生本身出问题(超时 / spawn 失败 / 解释器起不来 / 无总结行)⇒ `undetermined` exit 2。
 *     这一条排在最前:判不成就不许引用被测面的任何计数,否则"脚本坏了"会被伪装成"用例红了"。
 *  2. 收集面为空(`no tests collected` / `no tests ran` / `collected === 0`)⇒ `no-tests` exit 1,
 *     文案必须点名**未跑到** —— 这正是本票要消灭的形态,它是业务结论而不是脚本异常。
 *  3. 有收集期信号 ⇒ `collection-error`;只有 `ERROR` / `errors` 桶而无收集期信号 ⇒ `nonassertion-error`;
 *     `FAILED` 桶 ⇒ `test-failure`。三者都非零,但**各自计数、分列打印**,不合并成一个"失败数"。
 *  4. `failed > 0` ⇒ `test-failure` exit 1。
 *  5. rc=0 且各桶干净 ⇒ `pass`。
 *  6. 其余(例如 rc=3/4 内部错误、用法错误)⇒ `undetermined` exit 2,不冒绿也不冒充红。
 *
 * @param {{tier:'collect'|'run',rc:number|null,parsed:boolean,collected:number|null,passed:number,
 *   failed:number,errors:number,deselected:number,noTestsCollected:boolean,noTestsRan:boolean,
 *   collectionSignals:string[],errorSignals:string[],timedOut:boolean,spawnErrorCode:string|null,
 *   timeoutMs:number,appDir:string,python:string|null}} o
 */
export function judgeTier(o) {
  const {
    tier,
    rc = null,
    parsed,
    collected,
    passed = 0,
    failed = 0,
    errors = 0,
    skipped = 0,
    deselected = 0,
    noTestsCollected,
    noTestsRan,
    collectionSignals = [],
    errorSignals = [],
    timedOut,
    spawnErrorCode,
    timeoutMs,
    appDir,
  } = o

  if (timedOut) {
    return {
      state: 'undetermined',
      exitCode: 2,
      detail: `${tier} 档派生 pytest 超时(${timeoutMs} ms 未回),子进程被杀 ⇒ 这一档未判定`,
    }
  }
  if (spawnErrorCode) {
    return {
      state: 'undetermined',
      exitCode: 2,
      detail: `${tier} 档派生 pytest 失败(${spawnErrorCode}):解释器跑不起来 ⇒ 未判定,不记绿也不记红`,
    }
  }
  if (!parsed) {
    return {
      state: 'undetermined',
      exitCode: 2,
      detail: `${tier} 档 pytest 输出里没有可解析的总结行(面被换掉了?cwd=${appDir})⇒ 未判定`,
    }
  }

  if (noTestsCollected || noTestsRan || collected === 0) {
    return {
      state: 'no-tests',
      exitCode: 1,
      detail:
        `${tier} 档收集到 0 条用例 ⇒ 未跑到(` +
        `${noTestsRan ? 'no tests ran' : 'no tests collected'},rc=${rc})。` +
        '未跑到不记绿:这条命令什么都没判定 —— 别把「没跑到」读成「跑过了」。',
    }
  }

  if (collectionSignals.length > 0) {
    return {
      state: 'collection-error',
      exitCode: 1,
      detail:
        `${tier} 档有 ${collectionSignals.length} 条**收集期**失败` +
        `(pytest 的 errors 桶 ${errors} 条、断言失败桶 ${failed} 条,分列不合并):` +
        `${collectionSignals.slice(0, 3).join(' | ')}`,
    }
  }

  if (errors > 0 || errorSignals.length > 0) {
    return {
      state: 'nonassertion-error',
      exitCode: 1,
      detail:
        `${tier} 档有 ${errors || errorSignals.length} 条**非断言**错误` +
        `(收集期信号 0 条、断言失败桶 ${failed} 条)⇒ 同样非零:${errorSignals.slice(0, 3).join(' | ') || `${errors} error(s)`}`,
    }
  }

  if (failed > 0 || rc === 1) {
    return {
      state: 'test-failure',
      exitCode: 1,
      detail: `${tier} 档断言失败 ${failed} 条(另有 ${passed} 条跑成功、跳过 ${skipped} 条)⇒ 非零`,
    }
  }

  if (rc === 0) {
    const ranNote =
      tier === 'run' ? `跑成功 ${passed} 条,0 失败 0 错误` : `只判定收集面(未执行用例),收集到 ${collected} 条`
    const desel = deselected > 0 ? `;另有 ${deselected} 条被 deselect(计入跑过的那一侧没有意义,如实登记)` : ''
    return { state: 'pass', exitCode: 0, detail: `${tier} 档结论:通过 —— ${ranNote}${desel}` }
  }

  return {
    state: 'undetermined',
    exitCode: 2,
    detail: `${tier} 档 rc=${rc} 且不落在任何可辨认的桶里(内部错误/用法错误/中断)⇒ 未判定,不冒绿`,
  }
}

/** 纯函数:拼两档的 pytest 参数。`--collect-only` 与实跑各一档,透传参数两档共用。 */
export function buildPytestArgs({ collectOnly = false, extra = [] } = {}) {
  const passthrough = extra.filter((a) => a !== '--collect-only' && a !== '-q' && a !== '--')
  const tiers = [{ tier: 'collect', args: ['--collect-only', '-q', ...passthrough] }]
  if (!collectOnly) tiers.push({ tier: 'run', args: ['-q', ...passthrough] })
  return tiers
}

/** 纯函数:参数解析。未知参数一律透传给 pytest(`pnpm test -- -k foo` 要能穿透)。 */
export function parseArgv(argv = []) {
  const opts = {
    collectOnly: false,
    appDir: DEFAULT_APP_DIR,
    pythonOverride: null,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    extra: [],
  }
  for (const a of argv) {
    if (a === '--collect-only') opts.collectOnly = true
    else if (a === '--') continue
    else if (a.startsWith('--app-dir=')) opts.appDir = resolve(a.slice('--app-dir='.length))
    else if (a.startsWith('--python=')) opts.pythonOverride = a.slice('--python='.length)
    else if (a.startsWith('--timeout=')) opts.timeoutMs = Number(a.slice('--timeout='.length))
    else opts.extra.push(a)
  }
  return opts
}

function spawnPytest({ python, appDir, args, timeoutMs }) {
  const r = spawnSync(python, ['-m', 'pytest', ...args], {
    cwd: appDir,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    maxBuffer: MAX_BUFFER_BYTES,
    timeout: timeoutMs,
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
  })
  const code = r.error ? String(r.error.code || r.error.message) : null
  return {
    rc: r.status,
    stdout: r.stdout || '',
    stderr: r.stderr || '',
    timedOut: code === 'ETIMEDOUT',
    spawnErrorCode: r.error && code !== 'ETIMEDOUT' ? code : null,
  }
}

export function main(argv = process.argv.slice(2)) {
  const opts = parseArgv(argv)

  if (!Number.isFinite(opts.timeoutMs) || opts.timeoutMs <= 0) {
    console.error(`${TAG} 未判定:--timeout= 需要是正整数毫秒,收到 ${opts.timeoutMs}`)
    return 2
  }
  if (!existsSync(opts.appDir)) {
    console.error(`${TAG} 未判定:被测面目录取不到(${opts.appDir})⇒ 没有任何东西被判定`)
    return 2
  }

  const python = resolvePython({ appDir: opts.appDir, pythonOverride: opts.pythonOverride })
  if (!python) {
    const where = opts.pythonOverride
      ? `--python= 指定的解释器不存在:${opts.pythonOverride}`
      : `venv 解释器取不到,候选:${pythonCandidates(opts.appDir).join(' , ')}`
    console.error(
      `${TAG} 未判定(exit 2):${where}。` +
        '解释器/依赖没备好 ⇒ 这一条命令什么都没判成 —— 未判定不记绿,也不记成用例失败。'
    )
    return 2
  }

  let finalRc = 0
  for (const spec of buildPytestArgs({ collectOnly: opts.collectOnly, extra: opts.extra })) {
    console.log(`${TAG} ${spec.tier} 档:在 ${opts.appDir} 派生 ${python} -m pytest ${spec.args.join(' ')}`)
    const spawned = spawnPytest({ python, appDir: opts.appDir, args: spec.args, timeoutMs: opts.timeoutMs })
    const parsed = parsePytestSummary({ stdout: spawned.stdout, stderr: spawned.stderr, tier: spec.tier })
    const verdict = judgeTier({
      tier: spec.tier,
      rc: spawned.rc,
      ...parsed,
      timedOut: spawned.timedOut,
      spawnErrorCode: spawned.spawnErrorCode,
      timeoutMs: opts.timeoutMs,
      appDir: opts.appDir,
      python,
    })
    const counts =
      `collected=${parsed.collected ?? 'n/a'} passed=${parsed.passed} failed=${parsed.failed} ` +
      `errors=${parsed.errors} skipped=${parsed.skipped} rc=${spawned.rc ?? 'n/a'}`
    console.log(`${TAG} ${spec.tier} 档:${counts}`)
    console.log(`${TAG} ${spec.tier} 档结论:${verdict.state}(exit ${verdict.exitCode})—— ${verdict.detail}`)
    if (verdict.state !== 'pass') {
      // 失败面原样转出去,否则收信人只看到结论、看不到是哪一条用例/哪个模块报的错。
      const tail = `${spawned.stdout}\n${spawned.stderr}`.split(/\r?\n/).slice(-120).join('\n')
      console.log(`${TAG} ${spec.tier} 档输出末段:\n${tail}`)
      finalRc = verdict.exitCode
      break
    }
    finalRc = verdict.exitCode
  }
  console.log(`${TAG} RESULT verdict=${finalRc === 0 ? 'GREEN' : finalRc === 1 ? 'FAIL' : 'UNDetermined'} exit=${finalRc}`)
  return finalRc
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main()
}

export const __test__ = {
  pythonCandidates,
  resolvePython,
  parsePytestSummary,
  judgeTier,
  buildPytestArgs,
  parseArgv,
  main,
  TAG,
  DEFAULT_APP_DIR,
  DEFAULT_TIMEOUT_MS,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
