#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * SSE 帧「端内 dispatch 层漏接」守门(PROJECT_PLAN.md D107,2026-09-23 立)
 *
 * 与 `check-sse-parser-parity.mjs`(守门 63)的分工:
 *   63 管**解析层** —— 同一份协议的两个解析器(api-client/client.ts 与 shared/sse-parse.ts)覆盖是否齐;
 *   本闸管**注册层** —— 帧被解析出来后,各端 `streamChat` 的回调表里到底有没有人接。
 *   63 的注释自己写明"帧到了各端 dispatch 表仍会二次静默丢弃,不在本闸覆盖范围内",本条补的正是这一层。
 *
 * 为什么需要它(实证而非推测):第 44 / 68 轮逐端复查发现 `citations` / `onSteer` / `onInjectionApplied`
 * 这类帧在部分端**既不注册也不声明** —— 既不是"该端不需要",也不是"已接",而是没人发现。
 * 本闸把这种状态从"运行时静默"变成"提交时清单",并要求**每一个未注册的帧都必须显式写理由**
 * (可复用分组理由,见数据文件 groups),不允许沉默。
 *
 * 帧清单**不写在数据文件里**,而是每次运行从 `client.ts` 的 `onXxx` 成员自动提取(减去 toolCallbacks),
 * 因此数据文件不可能与代码脱节;新增帧会自动进入判据并要求各端显式处理。
 *
 * 四类判定:
 *  ① 判据自洽:抽不到帧回调名 / 数据文件缺端 / toolCallbacks 里的名字在 client.ts 不存在 = 判据失效,
 *     **按失败**(不许"解析不出来就当全绿")。
 *  ② ratchet:每端命中帧数 **不得低于 baseline**(只挡倒退不挡增长 —— 否则未接的端一提交就恒红)。
 *  ③ 唯一真源:数据文件 `missing[端]` 的键集合 **必须精确等于**实测未命中集合。
 *     - 实测未命中却没登记 → 红(这正是"静默丢弃"本身);
 *     - 登记了却实际已命中 → 红(该删的删,登记项不得变成掩盖真相的墓志铭)。
 *  ④ 理由完备:每条 missing 必须解析到非空理由(直接写,或指向 `groups` 里的复用分组)。
 *
 * 刻意**不**判"命中即注册":各端写法不一(对象属性 / 解构 / import 类型),按形状区分会大量误报。
 * 本闸口径是**出现即算已处理**,精度靠 ③ 的"精确等于"兜住 —— 既不放过漏接,也不冤枉已接。
 *
 * 用法:
 *   node scripts/check-sse-dispatch-parity.mjs [--json] [--self-test] [--report] [--staged]
 *   --report 打印逐端矩阵与缺口清单(可直接当补接工单)
 *   --staged 由 guardian-runner 在 pre-commit 模式下自动下发(改判暂存区,见下)
 *
 * **取材基准:提交树,绝不按磁盘读。** 命中侧走 `git grep HEAD`(手动 / CI)或
 * `git grep --cached`(pre-commit),帧清单同口径取 `git show HEAD:...` / `git show :...`。
 * 两侧必须**同一修订**:若帧清单改读工作树的 `client.ts`,并发会话刚加进去、尚未提交的
 * `onNewFrame` 会让**五端同时**判"静默丢弃" —— 红点与本票改动毫无关系,却只逼人
 * `--no-verify`(连带废掉其余全部守门,与守门 57/77 今日同一取向)。读不到即按
 * **判据失效 exit 2**,不回退工作树、不静默放行。
 *
 * 为什么 pre-commit 必须切到暂存区而不是 HEAD:本闸的 ratchet 要求"代码与台账**同票**"——
 * 补接一帧就要在同一张票里删 `missing` 条目并上调 `baseline`。只看 HEAD 时,提交那一刻台账
 * 已写明 12 而 HEAD 仍是 11 ⇒ "命中低于 baseline" 判红,**正常推进被自己的门卡死**。
 *
 * 集成位置:scripts/guardian-runner.mjs 第 90 项(blocking,pre-commit)
 * 紧急跳过:HUSKY_SKIP_SSE_DISPATCH_PARITY=1 git commit ...
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolveGitBin } from './lib/gitdir.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const API_CLIENT_PATH = ['packages', 'api-client', 'src', 'client.ts'].join('/')
const API_CLIENT_FILE = join(ROOT, API_CLIENT_PATH)
const DATA_FILE = join(ROOT, 'scripts', 'data', 'sse-dispatch-coverage.json')
const SKIP_ENV = 'HUSKY_SKIP_SSE_DISPATCH_PARITY'

// git 二进制不得依赖环境(§5b:服务账户与交互账户的 PATH / safe.directory 互不相通)
const GIT_BIN = process.env.IHUI_GIT_BIN || resolveGitBin() || 'git'

function git(args, opts = {}) {
  return execFileSync(GIT_BIN, ['-c', 'safe.directory=*', '-C', ROOT, ...args], {
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
    timeout: 120000,
    ...opts,
  })
}

/** 从 client.ts 源码里取出现的 onXxx 候选(权威帧清单 = 本集合 - toolCallbacks) */
export function extractCallbackNames(source) {
  const names = new Set()
  const re = /\b(on[A-Z][A-Za-z]*)\b/gu
  let m
  while ((m = re.exec(source)) !== null) names.add(m[1])
  return names
}

/** 帧清单 = client.ts 回调名 - 非帧成员(如 onAbort) */
export function resolveFrameCallbacks(source, toolCallbacks) {
  const excluded = new Set(toolCallbacks ?? [])
  return [...extractCallbackNames(source)].filter((n) => !excluded.has(n)).sort()
}

/**
 * 纯判据(可离线自测):喂"每端命中集合"与数据文件,输出违规。
 * @param {{ hit: Record<string, Set<string>>, callbacks: string[], known: Set<string>, data: object }} input
 */
export function evaluateDispatchParity({ hit, callbacks, known, data }) {
  const errors = []
  const warnings = []
  const endpoints = Object.keys(data.endpoints ?? {})

  if (endpoints.length === 0) {
    errors.push('数据文件未声明任何端(endpoints 为空)—— 判据失效,按失败处理')
  }
  if (callbacks.length === 0) {
    errors.push('从 client.ts 抽不到任何帧回调名 —— 判据失效,按失败处理(不许"解析不出来就当全绿")')
  }

  // ① 自洽:被排除的"非帧成员"必须真的存在于 client.ts
  for (const name of data.toolCallbacks ?? []) {
    if (!known.has(name)) {
      errors.push(`toolCallbacks 声明的非帧成员 ${name} 在 packages/api-client/src/client.ts 中不存在 —— 数据文件与代码脱节`)
    }
  }

  for (const ep of endpoints) {
    const hits = hit[ep]
    if (!hits) {
      errors.push(`端 ${ep} 未参与统计(源码路径可能在数据文件里写错)—— 判据失效,按失败处理`)
      continue
    }
    const baseline = data.baseline?.[ep]
    if (typeof baseline !== 'number') {
      errors.push(`端 ${ep} 缺 baseline(ratchet 无下限,失去防倒退作用)`)
      continue
    }
    if (hits.size < baseline) {
      errors.push(
        `端 ${ep} 命中的帧数 ${hits.size} 低于 baseline ${baseline} —— 有帧的注册被移除或改名(ratchet 只挡倒退)`,
      )
    }
    if (hits.size > baseline) {
      warnings.push(`端 ${ep} 命中 ${hits.size} 已超过 baseline ${baseline},请把 baseline 上调(ratchet 随增长维护)`)
    }

    // ③ 唯一真源:实测未命中集合 === 登记的 missing 键集合
    const measuredMissing = callbacks.filter((c) => !hits.has(c)).sort()
    const declaredMissing = Object.keys(data.missing?.[ep] ?? {}).sort()
    const undeclared = measuredMissing.filter((c) => !declaredMissing.includes(c))
    const stale = declaredMissing.filter((c) => !measuredMissing.includes(c))
    if (undeclared.length > 0) {
      errors.push(
        `端 ${ep} 有 ${undeclared.length} 个帧未注册且未声明理由(静默丢弃):${undeclared.join(', ')} —— 要么补接,要么在 scripts/data/sse-dispatch-coverage.json 的 missing.${ep} 写明理由`,
      )
    }
    if (stale.length > 0) {
      errors.push(`端 ${ep} 的 missing 声明了其实已注册的帧:${stale.join(', ')} —— 该删的删,登记项不得掩盖真相`)
    }

    // ④ 理由完备
    for (const [cb, reason] of Object.entries(data.missing?.[ep] ?? {})) {
      if (typeof reason !== 'string' || reason.trim() === '') {
        errors.push(`端 ${ep} 的 ${cb} 理由为空`)
        continue
      }
      if (Object.hasOwn(data.groups ?? {}, reason) && String(data.groups[reason]).trim() === '') {
        errors.push(`端 ${ep} 的 ${cb} 指向的分组理由 ${reason} 为空`)
      }
    }
  }

  return { ok: errors.length === 0, errors, warnings }
}

/**
 * 真跑:用 git grep 统计每端命中(出现即算已处理)。
 * @param {object} data 台账
 * @param {string[]} callbacks 帧清单
 * @param {'head'|'index'} basis 与帧清单**同一修订**(head = HEAD 提交树,index = 暂存区)
 */
export function collectHitMap(data, callbacks, basis = 'head') {
  const hit = {}
  for (const ep of Object.keys(data.endpoints ?? {})) hit[ep] = new Set()
  for (const { name, ep } of grepFrameHits(data, callbacks, basis)) hit[ep].add(name)
  return hit
}

/**
 * 承接面归属:`--report` 用,把"某帧已覆盖"落到**具体文件**上。
 * 起因(本会话登记在 PROJECT_PLAN 的盲区):本门只按端聚合命中,所以 mobile-rn 的
 * `budget` 只在 N8n 助手屏注册过、主聊天屏仍一帧不接,矩阵上却与"全端已接"同形。
 * 判据不变(不计红),只把归因摊开给人看。
 */
export function collectSurfaceMap(data, callbacks, basis = 'head') {
  const surfaces = {}
  for (const ep of Object.keys(data.endpoints ?? {})) surfaces[ep] = new Map()
  for (const { file, name, ep } of grepFrameHits(data, callbacks, basis)) {
    if (!surfaces[ep].has(file)) surfaces[ep].set(file, new Set())
    surfaces[ep].get(file).add(name)
  }
  return surfaces
}

/** 共享同一次 grep 与同一套失败口径 —— 两张图不允许各自跑一遍再出现分歧 */
function* grepFrameHits(data, callbacks, basis) {
  const alt = callbacks.join('|')
  const paths = Object.values(data.endpoints ?? {}).flat()
  // ⚠️ 修订位置不是可选风格:`git grep -o -E <pat> --cached` 会把 `--cached` 当**修订名**
  // 解析并 `unable to resolve revision` 退出,届时五端命中全为 0 —— 门会报一堆
  // "低于 baseline / 静默丢弃"的红,而真相是 grep 根本没跑。选项必须在模式串之前。
  const args =
    basis === 'index'
      ? ['grep', '--cached', '-o', '-E', alt, '--', ...paths]
      : ['grep', '-o', '-E', alt, 'HEAD', '--', ...paths]
  let raw = ''
  try {
    raw = git(args)
  } catch (e) {
    // git grep:0=有匹配 / 1=无匹配 / ≥128=自身失败(fatal)
    if (e?.status === 1) raw = typeof e?.stdout === 'string' ? e.stdout : ''
    else {
      throw new Error(
        `git grep 未能真正运行(exit ${e?.status}):${String(e?.stderr ?? e?.message ?? e).split('\n')[0]}` +
          ' —— 判据失效按失败处理,不许把"没跑成"当成"没命中"',
      )
    }
  }
  const dirsByEp = Object.entries(data.endpoints ?? {})
  for (const line of raw.split('\n')) {
    if (!line) continue
    const idx = line.lastIndexOf(':')
    if (idx === -1) continue
    const file = line.slice(0, idx).replace(/^HEAD:/u, '')
    const name = line.slice(idx + 1)
    for (const [ep, dirs] of dirsByEp) {
      if (dirs.some((d) => file.startsWith(`${d}/`))) {
        yield { file, name, ep }
        break
      }
    }
  }
}

/**
 * 帧清单的取材源:**提交树**(不是工作树)。
 * basis='head' → `git show HEAD:<path>`;basis='index' → `git show :<path>`(暂存区)。
 * 返回 { source, error } —— error 非空即判据失效,调用方必须 exit 2 而非回退工作树。
 */
export function readFrameSource(basis = 'head') {
  const spec = `${basis === 'index' ? '' : 'HEAD'}:${API_CLIENT_PATH}`
  try {
    return { source: git(['show', spec]), error: null }
  } catch (e) {
    const reason = String(e?.stderr ?? e?.message ?? e).split('\n')[0]
    return {
      source: '',
      error:
        `读不到 ${basis === 'index' ? '暂存区' : 'HEAD'} 版 ${API_CLIENT_PATH}(${reason})。` +
        `工作树侧${existsSync(API_CLIENT_FILE) ? '存在该文件' : '也不存在该文件'}` +
        ' —— 不回退工作树取帧清单(会把并发会话未提交的新帧算成五端"静默丢弃")',
    }
  }
}

function readData() {
  return JSON.parse(readFileSync(DATA_FILE, 'utf8'))
}

function selfTest() {
  const callbacks = ['onAlpha', 'onBeta', 'onGamma']
  const data = {
    toolCallbacks: ['onAbort'],
    endpoints: { web: ['apps/web/src'], cli: ['apps/cli'] },
    baseline: { web: 2, cli: 1 },
    groups: { 'no-ui': '该端无对应 UI。' },
    missing: { web: { onGamma: 'no-ui' }, cli: { onBeta: 'no-ui', onGamma: 'no-ui' } },
  }
  const known = new Set([...callbacks, 'onAbort'])
  const baseHit = { web: new Set(['onAlpha', 'onBeta']), cli: new Set(['onAlpha']) }
  const run = (over) => evaluateDispatchParity({ hit: over.hit ?? baseHit, callbacks, known, data: over.data ?? data })
  const cases = []

  cases.push(['正例:登记与实测一致必须放行', run({}).ok === true])

  cases.push([
    '反演:某端命中数低于 baseline 必须判红',
    run({ hit: { web: new Set(['onAlpha']), cli: new Set(['onAlpha']) } }).ok === false,
  ])

  const undeclared = run({
    data: { ...data, missing: { web: {}, cli: { onGamma: 'no-ui' } } },
  })
  cases.push([
    '反演:实测未命中却未登记(静默丢弃)必须判红',
    undeclared.ok === false && undeclared.errors.some((e) => e.includes('静默丢弃')),
  ])

  const stale = run({
    data: {
      ...data,
      missing: { web: {}, cli: { onBeta: 'no-ui', onGamma: 'no-ui' } },
    },
    hit: { web: new Set(['onAlpha', 'onBeta']), cli: new Set(['onAlpha', 'onBeta']) },
  })
  cases.push([
    '反演:登记了其实已注册的帧必须判红',
    stale.ok === false && stale.errors.some((e) => e.includes('其实已注册')),
  ])

  const emptyReason = run({ data: { ...data, missing: { web: { onGamma: '' }, cli: {} } } })
  cases.push(['反演:空理由必须判红', emptyReason.ok === false])

  const missingBaseline = run({ data: { ...data, baseline: { web: 2 } } })
  cases.push(['反演:某端缺 baseline 必须判红', missingBaseline.ok === false])

  const noCallbacks = evaluateDispatchParity({ hit: baseHit, callbacks: [], known, data })
  cases.push(['反演:抽不到帧清单必须判红(判据失效不得当全绿)', noCallbacks.ok === false])

  const unknownTool = run({ data: { ...data, toolCallbacks: ['onGhost'] } })
  cases.push(['反演:toolCallbacks 里有 client.ts 不存在的名字必须判红', unknownTool.ok === false])

  let failed = 0
  for (const [name, pass] of cases) {
    console.log(`${pass ? '✅' : '❌'} ${name}`)
    if (!pass) failed += 1
  }
  console.log(`\n[self-test] ${cases.length - failed}/${cases.length} 通过`)
  return failed === 0
}

function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) {
    process.exit(selfTest() ? 0 : 1)
  }
  if (process.env[SKIP_ENV] === '1') {
    console.log(`[check-sse-dispatch-parity] ${SKIP_ENV}=1 已跳过`)
    process.exit(0)
  }
  const data = readData()
  // pre-commit(runner 下发 --staged)判暂存区,手动 / CI 判 HEAD —— 台账与代码同票时
  // 只看 HEAD 会把自己的正常推进判成"baseline 倒退",门就成了拦进步的那道,只能靠 --no-verify。
  const basis = argv.includes('--staged') ? 'index' : 'head'
  const { source, error: sourceError } = readFrameSource(basis)
  if (sourceError) {
    console.log(`❌ ${sourceError}`)
    process.exit(2)
  }
  const known = extractCallbackNames(source)
  const callbacks = resolveFrameCallbacks(source, data.toolCallbacks)
  let hit
  try {
    hit = collectHitMap(data, callbacks, basis)
  } catch (e) {
    console.log(`❌ ${e?.message ?? e}`)
    process.exit(2)
  }
  const result = evaluateDispatchParity({ hit, callbacks, known, data })

  if (argv.includes('--report')) {
    console.log(`=== 端内 dispatch 覆盖矩阵(帧 ${callbacks.length} 个)===`)
    for (const ep of Object.keys(data.endpoints ?? {})) {
      const hits = hit[ep] ?? new Set()
      const miss = callbacks.filter((c) => !hits.has(c))
      console.log(`${ep.padEnd(14)} ${hits.size}/${callbacks.length}  缺: ${miss.join(', ') || '-'}`)
    }
    // 承接面归因:矩阵按端聚合,"该端已覆盖某帧"看不出**是哪块界面**接的 —— 主聊天屏一帧不接
    // 也能靠某个次级屏把端凑成已覆盖。这里把每个端"哪个文件接了哪些帧"摊开(不计红,仅供核工单)。
    let surfaces
    try {
      surfaces = collectSurfaceMap(data, callbacks, basis)
    } catch (e) {
      console.log(`⚠️  承接面归因未能取得:${e?.message ?? e}(矩阵结论不受影响,该项不判红)`)
      surfaces = null
    }
    if (surfaces) {
      console.log(
        '\n=== 帧名出现位置归因(mention 级:该文件文本里出现过这些帧回调名。' +
          '**不校验是否真挂进 dispatch**,故"面数"含类型/透传文件 —— 只用来定位"某帧全仓只有一处在接",不计红)===',
      )
      for (const [ep, files] of Object.entries(surfaces)) {
        const rows = [...files.entries()].sort((a, b) => b[1].size - a[1].size)
        console.log(`\n${ep}:命中文件 ${rows.length} 个`)
        const solo = new Set()
        for (const cb of callbacks) {
          const n = rows.filter(([, s]) => s.has(cb)).length
          if (n === 1) solo.add(cb)
        }
        for (const [file, set] of rows.slice(0, 6)) {
          const only = [...set].filter((c) => solo.has(c))
          console.log(
            `  ${String(set.size).padStart(2)} 帧  ${file}${only.length ? `  ◇仅此面: ${only.join(', ')}` : ''}`,
          )
        }
        if (rows.length > 6) console.log(`  …另 ${rows.length - 6} 个面未列`)
      }
    }
    console.log('')
  }

  if (argv.includes('--json')) {
    console.log(
      JSON.stringify({ result, callbacks, hit: Object.fromEntries(Object.entries(hit).map(([k, v]) => [k, [...v]])) }, null, 2),
    )
    process.exit(result.ok ? 0 : 1)
  }

  for (const w of result.warnings) console.log(`⚠️  ${w}`)
  for (const e of result.errors) console.log(`❌ ${e}`)
  console.log(
    result.ok
      ? `✅ SSE 端内 dispatch 覆盖守门通过(${Object.keys(data.endpoints ?? {}).length} 端,帧 ${callbacks.length} 个)`
      : `🚫 SSE 端内 dispatch 覆盖守门失败:${result.errors.length} 项`,
  )
  process.exit(result.ok ? 0 : 1)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main()
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
