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
 *   node scripts/check-sse-dispatch-parity.mjs [--json] [--self-test] [--report] [--staged] [--worktree]
 *   --report 打印逐端矩阵与缺口清单(可直接当补接工单)
 *   --staged 由 guardian-runner 在 pre-commit 模式下自动下发(改判暂存区,见下)
 *   --worktree 显式人工磁盘档(2026-09-26 补;此前未知开关会被**静默忽略**仍按 head 判);
 *   --staged 与 --worktree 同给 ⇒ exit 2 —— 两个判定面互斥,取哪一面都会让另一面成为假绿。
 *
 * **取材基准:提交面(HEAD / 索引),按面判,绝不悄悄按磁盘读。** 命中侧走 `git grep HEAD`(手动 / CI)、
 * `git grep --cached`(pre-commit)或 `git grep`(显式 --worktree 人工档),帧清单与台账同口径经
 * `scripts/lib/face-reader.mjs` 的 `catBatch` 取 `HEAD:<path>` / `:<path>` 的 blob 正文
 * (2026-09-26 迁,原先是自己派生 `git show` / `readFileSync` 磁盘)。
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
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolveGitBin } from './lib/gitdir.mjs'
// 判定面取材的唯一出口(2026-09-26 迁):帧清单那份 blob 正文改由共用层读 ——
// git 绝对路径 / stdio[0]='pipe' / 一次 batch 读完 / maxBuffer 给足,这四件事各门自己写必错。
// 命中侧仍是一次 `git grep <rev>`:那是"在指定修订上检索"的原语,不把 blob 正文读进 JS。
// ⚠️ 本段原先还写着"台账与帧清单同面,不存在'表读磁盘 + 内容读 HEAD'的错面" —— 那句是**假的**:
// readData() 一直是裸 readFileSync(磁盘),而并发会话改这个台账不需要碰任何被审代码。
// 2026-09-26 由 readLedger() 收口,台账现与帧清单同面同轮取。
import { catBatch, readWorktreeFile, selectFace } from './lib/face-reader.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const API_CLIENT_PATH = ['packages', 'api-client', 'src', 'client.ts'].join('/')
const API_CLIENT_FILE = join(ROOT, API_CLIENT_PATH)
/** 台账在仓内的**相对**路径:判定面按它取 blob(见 readLedger),磁盘路径只作诊断文案用。 */
const DATA_PATH = ['scripts', 'data', 'sse-dispatch-coverage.json'].join('/')
const DATA_FILE = join(ROOT, DATA_PATH)
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
      errors.push(
        `toolCallbacks 声明的非帧成员 ${name} 在 packages/api-client/src/client.ts 中不存在 —— 数据文件与代码脱节`,
      )
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
      warnings.push(
        `端 ${ep} 命中 ${hits.size} 已超过 baseline ${baseline},请把 baseline 上调(ratchet 随增长维护)`,
      )
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
      errors.push(
        `端 ${ep} 的 missing 声明了其实已注册的帧:${stale.join(', ')} —— 该删的删,登记项不得掩盖真相`,
      )
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
      : basis === 'worktree'
        ? // 人工磁盘档:不带 --cached 也不带修订 = grep 工作树(仅 --worktree 可达,提交链永走此档即面纪律失守)
          ['grep', '-o', '-E', alt, '--', ...paths]
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
 * 帧清单的取材源:**提交面**(不是工作树磁盘),除非显式走 `--worktree` 人工档。
 * basis='head' → HEAD blob;basis='index' → 索引 blob(暂存区);basis='worktree' → 磁盘逃生舱。
 * 经 `scripts/lib/face-reader.mjs` 的 `catBatch` 取正文(2026-09-26 迁,原先是自己派生 `git show`)。
 * 返回 { source, error } —— error 非空即判据失效,调用方必须 exit 2 而非回退另一个面。
 *
 * @param batch 注入点:自检用它**构造**「同一条路径在索引面与 HEAD 面内容不同」的现场,
 *   不真改仓库、不依赖并发会话此刻往索引里放了什么。
 */
export function readFrameSource(basis = 'head', batch = null) {
  if (basis === 'worktree') {
    try {
      const text = readWorktreeFile(ROOT, API_CLIENT_PATH)
      if (typeof text !== 'string')
        return {
          source: '',
          error: describeUnreadable('worktree', '磁盘上没有此文件 / 含 NUL 非文本'),
        }
      return { source: text, error: null }
    } catch (e) {
      return {
        source: '',
        error: describeUnreadable('worktree', String(e?.message ?? e).split('\n')[0]),
      }
    }
  }
  const spec = `${basis === 'index' ? '' : 'HEAD'}:${API_CLIENT_PATH}`
  let got
  try {
    // 显式调用层的读取入口 `catBatch(...)` —— 把它写成默认参数值**不算**调用
    // (守门 118 的判据是"真用了层的读取入口取过内容",半接线正是它这一档要抓的形态)。
    got = batch
      ? batch(ROOT, [spec], { maxBuffer: 1 << 29, timeout: 120000 })
      : catBatch(ROOT, [spec], { maxBuffer: 1 << 29, timeout: 120000 })
  } catch (e) {
    const reason = String(e?.stderr ?? e?.message ?? e).split('\n')[0]
    return { source: '', error: describeUnreadable(basis, reason) }
  }
  const text = got.get(spec)
  if (typeof text !== 'string')
    return {
      source: '',
      error: describeUnreadable(basis, '该面没有此对象(missing / unmerged / 非 blob)'),
    }
  return { source: text, error: null }
}

function describeUnreadable(basis, reason) {
  const label = basis === 'index' ? '暂存区' : basis === 'worktree' ? '工作树' : 'HEAD'
  return (
    `读不到 ${label} 版 ${API_CLIENT_PATH}(${reason})。` +
    `磁盘侧${existsSync(API_CLIENT_FILE) ? '存在该文件' : '也不存在该文件'}` +
    ` —— 不回退另一个面取帧清单(把"没判"写成"判过了"是守门 94 同型;非 --worktree 档绝不读磁盘)`
  )
}

/**
 * 台账的取材源:**与帧清单同一个修订**(head = HEAD blob,index = 索引 blob)。
 *
 * 为什么必须同面:本门原有的两处判据各自取面 —— 命中侧与帧清单走 git 修订,台账走磁盘。
 * 于是并发会话对 `scripts/data/sse-dispatch-coverage.json` 的**未暂存**改动会直接改写在飞
 * 提交的结论:别人把某帧从 missing 里删掉(尚未提交),我的提交就被判成"登记项掩盖真相";
 * 反过来别人误删的一行也能替我把一条真敞目洗成"已登记"。守门 93 R6 把这条写成过判据
 * ("登记表与用量必须同面 —— 表读磁盘 + 用量读 HEAD 会在并行会话刚补行的瞬间产出假红/假绿"),
 * 本门此前只在头注里**否认**存在这一型,而 readData() 一直是裸 readFileSync。
 *
 * 取不到(该面没有此对象 / JSON 解析失败)⇒ error 非空,调用方必须 exit 2,
 * **绝不回退磁盘** —— 那等于把"没判"写成"判过了"(守门 94 同型)。
 *
 * @param basis 'head' | 'index'
 * @param batch 注入点:自检用它构造"同一路径两面不同"的现场,不真改仓库
 */
export function readLedger(basis = 'head', batch = null) {
  const label = basis === 'index' ? '暂存区' : basis === 'worktree' ? '工作树' : 'HEAD'
  if (basis === 'worktree') {
    try {
      const text = readWorktreeFile(ROOT, DATA_PATH)
      if (typeof text !== 'string')
        return {
          data: null,
          error: `读不到 ${label} 版台账 ${DATA_PATH}(磁盘上没有此文件 / 含 NUL 非文本)—— 不回退提交面`,
        }
      try {
        return { data: JSON.parse(text), error: null }
      } catch (e) {
        return { data: null, error: `${label} 版台账 ${DATA_PATH} 不是合法 JSON:${e.message}` }
      }
    } catch (e) {
      return {
        data: null,
        error: `读不到 ${label} 版台账 ${DATA_PATH}:${String(e?.message ?? e).split('\n')[0]}`,
      }
    }
  }
  // 冒号必须在两种面都保留(索引规格是 `:path`,不是 `path`)—— 写成
  // `${basis === 'index' ? '' : 'HEAD:'}${DATA_PATH}` 会让 index 面变成一个裸路径,
  // `cat-file --batch` 把它当对象名解析而回 missing,于是暂存区永远"读不到"。
  // 这个坑是本枚改动自己踩出来的,由上面第 3 条自检(index 面必须读到 onIndexOnly)钉住。
  const spec = `${basis === 'index' ? '' : 'HEAD'}:${DATA_PATH}`
  let got
  try {
    got = batch
      ? batch(ROOT, [spec], { maxBuffer: 1 << 29, timeout: 120000 })
      : catBatch(ROOT, [spec], { maxBuffer: 1 << 29, timeout: 120000 })
  } catch (e) {
    const reason = String(e?.stderr ?? e?.message ?? e).split('\n')[0]
    return { data: null, error: `读不到 ${label} 版台账 ${DATA_PATH}(${reason})` }
  }
  const text = got.get(spec)
  if (typeof text !== 'string') {
    return {
      data: null,
      error:
        `读不到 ${label} 版台账 ${DATA_PATH}(该面没有此对象 —— missing / unmerged / 非 blob)。` +
        `工作树侧${existsSync(DATA_FILE) ? '存在该文件' : '也不存在该文件'} —— 不回退磁盘`,
    }
  }
  try {
    return { data: JSON.parse(text), error: null }
  } catch (e) {
    return { data: null, error: `${basis} 版台账 ${DATA_PATH} 不是合法 JSON:${e.message}` }
  }
}

/**
 * 纯四态取材面选择(判据的**入口**,不是调用方各写一遍的 if):
 * 默认 head;`--staged` → index;`--worktree` → worktree;两面旗同给 → 判死,不猜哪一面。
 * 由 face-reader 的 selectFace 兜语义,这里只做 index 命名映射(与 readLedger/readFrameSource 同词)。
 */
export function pickBasis(argv) {
  const picked = selectFace({
    staged: argv.includes('--staged'),
    worktree: argv.includes('--worktree'),
    def: 'head',
  })
  if (picked.error) return { basis: null, error: picked.error }
  return { basis: picked.face === 'staged' ? 'index' : picked.face, error: null }
}

const BASIS_LABEL = {
  head: 'HEAD blob(git grep HEAD + git cat-file HEAD:<path>)',
  index: '索引 blob(暂存区,git grep --cached + :<path>)',
  worktree: '工作树(磁盘,--worktree 人工逃生舱)',
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
  const run = (over) =>
    evaluateDispatchParity({ hit: over.hit ?? baseHit, callbacks, known, data: over.data ?? data })
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

  /**
   * 取材面迁移的两条构造面证明(2026-09-26)+ 一条"取不到即判据失效"。
   * 注入假 batch 而不是跑真仓:索引/HEAD 此刻由并发会话决定,拿它当夹具就是一台时红时绿的尺子;
   * 而"同一批路径两面内容不同"是唯一能区分两面的情形 —— 若 readFrameSource 忽略 basis,
   * 下面前两条必有一条翻红,所以它们不是恒真式。
   */
  // 一把**校验规格形态**的假 batch,而不是"按前缀二选一"的宽松夹具。
  // 真 `cat-file --batch` 对裸路径(没有 `<rev>:` 前缀)是按对象名解析并回 missing 的;
  // 若夹具写成 `s.startsWith('HEAD:') ? A : B`,那么"索引面把冒号丢了"这种错法会被
  // 静默归到 B 臂 ⇒ 两条认面用例双双通过,判据没有牙。
  // 实测:本枚改动的第一版正是丢了那个冒号,而旧夹具一路报绿,只有真跑 --staged 才炸出来。
  const makeSpecCheckingBatch = (headValue, indexValue) => (root, specs) =>
    new Map(
      specs.map((s) => {
        if (s.startsWith('HEAD:')) return [s, headValue]
        if (s.startsWith(':')) return [s, indexValue]
        // 既不是 `HEAD:<path>` 也不是 `:<path>` —— git 读不到,层也不许"顺手当索引面"
        return [s, null]
      }),
    )

  const fakeBatch = makeSpecCheckingBatch('HEAD-SIDE-SOURCE', 'INDEX-SIDE-SOURCE')
  cases.push([
    '正例:--staged(index 面)必须跟**索引 blob** 走(规格是 `:path`,冒号不可缺)',
    readFrameSource('index', fakeBatch).source === 'INDEX-SIDE-SOURCE',
  ])
  cases.push([
    '反演(同输入不同面):head 面必须取 **HEAD blob**,与上一条给出不同结论 ⇒ 判据认面',
    readFrameSource('head', fakeBatch).source === 'HEAD-SIDE-SOURCE',
  ])
  // 直接把生产代码**发出的规格**钉成字面量。
  // 实测:本枚改动第一版就是发了裸路径(少一个冒号),而"只看结论"的用例一律察觉不到 ——
  // 少冒号 ⇒ git 回 missing ⇒ 门在暂存区永远"读不到",而任何断言 error/结果的用例在
  // 夹具宽松时都照旧绿。规格形状只能按字面量锁。
  const frameSpecs = []
  readFrameSource('index', (root, specs) => {
    specs.forEach((s) => frameSpecs.push(s))
    return new Map(specs.map((s) => [s, 'S']))
  })
  readFrameSource('head', (root, specs) => {
    specs.forEach((s) => frameSpecs.push(s))
    return new Map(specs.map((s) => [s, 'S']))
  })
  cases.push([
    '装车:帧清单两面发出的规格必须逐字是 `:path` 与 `HEAD:path`(冒号在两边都不得缺)',
    frameSpecs[0] === `:${API_CLIENT_PATH}` && frameSpecs[1] === `HEAD:${API_CLIENT_PATH}`,
  ])
  cases.push([
    '反演:该面取不到正文 ⇒ error 非空(exit 2),绝不静默回退工作树',
    readFrameSource('head', () => new Map()).error !== null,
  ])

  /**
   * 台账同面取材的三条(2026-09-26)。此前 readData() 走磁盘,所以并发会话不必碰任何
   * 被审代码就能改写在飞提交的结论 —— 而本门口头一直声称没有这一型。
   * 夹具用**构造面**(假 batch 两面给不同 JSON),不依赖索引此刻被谁放过什么。
   */
  const ledgerBatch = makeSpecCheckingBatch(
    JSON.stringify({ toolCallbacks: ['onAbort'], baseline: { web: 1 } }),
    JSON.stringify({ toolCallbacks: ['onIndexOnly'], baseline: { web: 2 } }),
  )
  cases.push([
    '正例:台账 index 面必须跟索引 blob(规格是 `:path`,冒号不可缺)',
    readLedger('index', ledgerBatch).data?.toolCallbacks?.[0] === 'onIndexOnly',
  ])
  cases.push([
    '反演(同输入不同面):台账 head 面必须取 HEAD blob,与上一条给出不同结论 ⇒ 判据认面',
    readLedger('head', ledgerBatch).data?.toolCallbacks?.[0] === 'onAbort' &&
      readLedger('head', ledgerBatch).data?.baseline?.web === 1,
  ])
  const ledgerSpecs = []
  readLedger('index', (root, specs) => {
    specs.forEach((s) => ledgerSpecs.push(s))
    return new Map(specs.map((s) => [s, '{}']))
  })
  readLedger('head', (root, specs) => {
    specs.forEach((s) => ledgerSpecs.push(s))
    return new Map(specs.map((s) => [s, '{}']))
  })
  cases.push([
    '正例:台账实际发出的规格逐字为 `:path` 与 `HEAD:path`(这条就是那个冒号的看守)',
    ledgerSpecs.length === 2 &&
      ledgerSpecs[0] === `:${DATA_PATH}` &&
      ledgerSpecs[1] === `HEAD:${DATA_PATH}`,
  ])
  cases.push([
    '反演:台账该面取不到 ⇒ error 非空且 data 为 null,绝不回退磁盘凑一份',
    readLedger('head', () => new Map()).error !== null &&
      readLedger('head', () => new Map()).data === null,
  ])
  cases.push([
    '反演:该面台账不是合法 JSON ⇒ error 非空(把"读到一半坏了"报成无法判定,不是"台账为空")',
    readLedger('head', () => new Map([[`HEAD:${DATA_PATH}`, '{ not json ']])).error !== null,
  ])

  /** 面选择四态(纯函数,构造 argv 证明;两面旗同给必须判死而非"顺手挑一个")。 */
  cases.push([
    '正例:pickBasis 默认 head;--staged→index;--worktree→worktree',
    pickBasis([]).basis === 'head' &&
      pickBasis(['--staged']).basis === 'index' &&
      pickBasis(['--json', '--worktree']).basis === 'worktree',
  ])
  cases.push([
    '反演:pickBasis 两面旗同给 ⇒ basis 为 null 且带原因(不许选出一个面)',
    pickBasis(['--staged', '--worktree']).basis === null &&
      typeof pickBasis(['--staged', '--worktree']).error === 'string',
  ])
  cases.push([
    '装车:worktree 档必须真换面 —— 走磁盘 readWorktreeFile 且**绝不派生 git batch**(用一枚会抛的 batch 证明不经它)',
    (() => {
      const r = readFrameSource('worktree', () => {
        throw new Error('worktree 档竟派生了 batch')
      })
      return r.error === null && typeof r.source === 'string' && r.source.length > 0
    })(),
  ])

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
  // pre-commit(runner 下发 --staged)判暂存区,手动 / CI 判 HEAD —— 台账与代码同票时
  // 只看 HEAD 会把自己的正常推进判成"baseline 倒退",门就成了拦进步的那道,只能靠 --no-verify。
  // --worktree 是显式人工档(2026-09-26 补):此前它会被**静默忽略**而落进 head 面 ——
  // "未知开关不判死也不改面"与"面旗被接受"是两回事,静默吞旗正是守门 118 要点名的形态。
  const { basis, error: basisError } = pickBasis(argv)
  if (basisError) {
    console.log(`❌ ${basisError}(两个判定面互斥,取哪一面都会让另一面成为假绿)`)
    process.exit(2)
  }
  // 台账与帧清单**同面同轮**取(见 readLedger 的理由):两个面各取一份就是一把自洽却错位的尺子。
  const { data, error: ledgerError } = readLedger(basis)
  if (ledgerError) {
    console.log(`❌ ${ledgerError}`)
    process.exit(2)
  }
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
      console.log(
        `${ep.padEnd(14)} ${hits.size}/${callbacks.length}  缺: ${miss.join(', ') || '-'}`,
      )
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
      JSON.stringify(
        {
          basis,
          basisLabel: BASIS_LABEL[basis],
          result,
          callbacks,
          hit: Object.fromEntries(Object.entries(hit).map(([k, v]) => [k, [...v]])),
        },
        null,
        2,
      ),
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
  console.log(`判定面:${BASIS_LABEL[basis]}`)
  process.exit(result.ok ? 0 : 1)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main()
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
