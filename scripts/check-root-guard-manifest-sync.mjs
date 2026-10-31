// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 根护栏清单同批对账(**守护巡检轮,不进提交链**)：清单绑定的规则文件是否与清单本身一致。
 *
 * 为什么不挂提交链(§12e)：它判的是「仓库当前状态是否自洽」,不是「本次提交做错了什么」。
 * 挂成 blocking 就会把上一席落下的漂移定责给下一席 —— 而下一席结构上无法满足
 * (改 README 补点名会撞门 173 的活性声明开放集合,改 AGENTS 会撞门 207 的体积预算)。
 * 判机器状态 ⇒ 挂守护 tick + 到人邮件,才是能落地的档。
 *
 * 立因(2026-10-31 实测,同型停摆两次)：
 * `scripts/root-guard.mjs` 的清单(scripts/data/root-guard-manifest.json)按 sha256 绑定
 * `scripts/guardian-runner.mjs` 等规则文件;部署环每轮在 **fetch/对齐之前** 跑
 * `root-guard --check`,非 0 即 fail-closed。于是「改了 guardian-runner 但没同批 --seal」的
 * 提交一旦进 main,prod 签出对齐到那枚就永远过不去(重封又是一枚新提交,墙不会自己倒)：
 *   · 11:28 一轮(漂移源自 10790ffb22 07:17)⇒ 02:00 之后所有提交没上线;
 *   · 13:30 又一轮(并发会话再次改 guardian-runner 未重封)⇒ 同型停摆复发。
 * 两次都是 root-guard 自己的差面判读在喊「把清单与规则文件同枚提交并推送」,但**没有任何器物
 * 在无人敲的时候发现它** —— 判据在、工具在、调度缺(§0.9 同型)。本器补的就是这一环。
 *
 * 判定三态(不并桶)：
 *   ① drift(不自洽)⇒ 派发到到人邮件,给可执行下一步(seal 出口 + 同枚提交);
 *   ② ok(自洽)⇒ 静默,零写盘零派生;
 *   ③ undetermined(清单/目标/基线面读不到)⇒ 显式未判定,**不记绿**(§0.3)。
 *
 * 判据零复写(§0.6/§22c)：sha 算法、清单形状、advisory 集合全部 import `root-guard.mjs` 本体;
 * 本器只做「按面取材 + 三态归桶」。取材面纪律同 §0.4：全量判 HEAD blob、--staged 判索引 blob、
 * --worktree 仅人工逃生舱,取不到不回落另一个面。
 *
 * 用法：node scripts/check-root-guard-manifest-sync.mjs [--staged|--worktree|--self-test|--json]
 * 调度器：scripts/git-guardian.mjs 的 `auditRootGuardManifestSync()`(守护 tick,节流 + 跨档重报)
 */
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { catBatch, readWorktreeFile } from './lib/face-reader.mjs'
import {
  ADVISORY_TARGET_IDS,
  MANIFEST_PATH,
  hashTarget,
  loadManifest,
  sha256Of,
} from './root-guard.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const MANIFEST_REL = path.relative(ROOT, MANIFEST_PATH).split(path.sep).join('/')
const norm = (p) => path.relative(ROOT, path.isAbsolute(p) ? p : path.join(ROOT, p)).split(path.sep).join('/')

/** §12g:派生 git 必须显式接管 stdio;§5b:本机任何派生进程一律 windowsHide。 */
function git(args) {
  return execFileSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
}

/**
 * 判据核心(纯函数,可注入)：给定清单正文与「按相对路径取正文」的 reader,算出自洽性。
 * @param manifestRaw 清单正文;null/抛错 ⇒ 未判定
 * @param readRel (rel:string)=>string|null  取不到必须返回 null,不得回落另一个面
 */
export function judge({ manifestRaw, readRel }) {
  if (typeof manifestRaw !== 'string') {
    return { state: 'undetermined', reason: '清单正文取不到(面上无该文件或读失败)' }
  }
  let manifest
  try {
    manifest = loadManifest(manifestRaw)
  } catch (e) {
    return { state: 'undetermined', reason: `清单解析失败:${e.message}` }
  }
  const reader = (absPath) => {
    const text = readRel(norm(absPath))
    if (text === null) throw new Error('面上取不到')
    return text
  }
  const drift = []
  const advisory = []
  const unknown = []
  for (const t of manifest.targets) {
    let got
    try {
      got = hashTarget(t, reader, ROOT)
    } catch (e) {
      unknown.push(`${t.id}:取不到正文(${e.message})`)
      continue
    }
    if (!got.ok) {
      unknown.push(`${t.id}:${got.reason ?? '哈希未判定'}`)
      continue
    }
    if (got.sha256 === t.sha256) continue
    const row = { id: t.id, path: t.path, expected: t.sha256.slice(0, 12), actual: got.sha256.slice(0, 12) }
    if (ADVISORY_TARGET_IDS.has(t.id)) advisory.push(row)
    else drift.push(row)
  }
  // 一个都没判成 ⇒ 不是「没问题」,是「没判」(§0.3)
  if (drift.length === 0 && advisory.length === 0 && unknown.length > 0) {
    return { state: 'undetermined', reason: unknown.join(' / ') }
  }
  return { state: drift.length > 0 ? 'drift' : 'ok', drift, advisory, unknown }
}

/** 按判定面读单文件正文;取不到返回 null(不回落另一个面,§0.4)。 */
function readFace(face, rel) {
  if (face === 'worktree') return readWorktreeFile(ROOT, rel)
  const key = face === 'staged' ? `:${rel}` : `HEAD:${rel}`
  return catBatch(ROOT, [key]).get(key) ?? null
}

const faceReader = (face) => (rel) => readFace(face, rel)

/** 点名「是谁把清单落下的」:取该规则文件最近一次改动(读不到就写未判定,不猜)。 */
function blameLastCommit(rel) {
  try {
    return (git(['log', '-1', '--format=%h %s', '--', rel]).trim().split('\n')[0] ?? '').trim()
  } catch {
    return ''
  }
}

/** 主判定:--staged 比「索引 vs HEAD」两面;全量档只判 HEAD(⇒ 存量档,报数不拦)。 */
export function decide(face = 'head') {
  if (face !== 'staged' && face !== 'head' && face !== 'worktree') {
    return { exit: 2, lines: [`未知判定面 ${face}(只认 staged / head / worktree)`] }
  }
  const lines = []
  const cur = judge({ manifestRaw: readFace(face, MANIFEST_REL), readRel: faceReader(face) })
  if (cur.state === 'undetermined') {
    return { exit: 2, lines: [`未判定:${cur.reason}`, '不冒绿也不冒红(§0.3):取不到输入不是「没问题」。'] }
  }
  for (const a of cur.advisory) {
    lines.push(`⚠ advisory 漂移(与 root-guard 同口径,不拦):${a.id} 清单绑 ${a.expected} / 面上 ${a.actual}`)
  }
  if (cur.state === 'ok') {
    return { exit: 0, lines: [`✅ 根护栏清单与规则文件同面自洽(${face} 面)`, ...lines] }
  }
  const detail = cur.drift.map((d) => `  ✗ ${d.id} (${d.path}) 清单绑 ${d.expected} / 面上 ${d.actual}`)
  if (face === 'head' || face === 'worktree') {
    const blame = cur.drift.map((d) => `  · ${d.id} 最近一次改动:${blameLastCommit(d.path) || '(未判定)'}`)
    return {
      exit: 0,
      lines: [
        `⚠ 存量漂移(${face} 面本就自洽性不成立,不拦;§12e):`,
        ...detail,
        ...blame,
        '但这堵墙正挡着部署:请尽快 `node scripts/root-guard.mjs --seal --reason "<复核结论>"` 并单独成枚提交推送。',
        ...lines,
      ],
    }
  }
  const base = judge({ manifestRaw: readFace('head', MANIFEST_REL), readRel: faceReader('head') })
  if (base.state === 'undetermined') {
    return { exit: 2, lines: [`未判定:基线(HEAD)面读不动(${base.reason}),无法差分定责`, ...lines] }
  }
  if (base.state === 'drift') {
    const blame = cur.drift.map((d) => `  · ${d.id} 最近一次改动:${blameLastCommit(d.path) || '(未判定)'}`)
    return {
      exit: 0,
      lines: [
        '⚠ 存量漂移(HEAD 面已不自洽,本次没让它更坏 ⇒ 只报数不拦,§12e):',
        ...detail,
        ...blame,
        ...lines,
      ],
    }
  }
  return {
    exit: 1,
    lines: [
      '❌ 本次改动让根护栏清单与规则文件脱钩(HEAD 面自洽,索引面不自洽)。',
      ...detail,
      '出路(两条,都不许削判据):① 回退规则文件的改动;② 确属有意改规则 ⇒ 跑 `node scripts/root-guard.mjs --seal --reason "<复核结论>"`,并把清单与本枚规则文件**同枚提交**。',
      '为什么必须同枚:部署环在拉取更新**前**判根护栏 ⇒ 清单落后于内容时,prod 签出一对齐就永远 fail-closed,整条自愈部署停摆(2026-10-31 一天内两次实测)。',
      ...lines,
    ],
  }
}

// ── 内联自检:成对夹具(摘掉同批 seal 即翻红 / 补上 seal 即转绿)──────────────
function runSelfTest() {
  const results = []
  const t = (name, pass) => results.push({ name, pass })

  const RULE = 'scripts/guardian-runner.mjs'
  const ruleV1 = '// runner v1\n'
  const ruleV2 = '// runner v2 changed\n'
  const manifestFor = (sha) =>
    JSON.stringify({
      version: 1,
      targets: [{ id: 'guardian-runner', path: RULE, mode: 'file', sha256: sha }],
    })

  // 1 自洽 ⇒ ok
  const s1 = sha256Of(ruleV1)
  t('S1 清单与内容一致 ⇒ ok', judge({ manifestRaw: manifestFor(s1), readRel: () => ruleV1 }).state === 'ok')
  // 2 内容变了没重封 ⇒ drift(这是本门存在的理由)
  t('S2 内容改动未重封 ⇒ drift', judge({ manifestRaw: manifestFor(s1), readRel: () => ruleV2 }).state === 'drift')
  // 3 同批 seal ⇒ ok(与 S2 成对:摘掉 seal 即翻红)
  t('S3 同批重封 ⇒ ok', judge({ manifestRaw: manifestFor(sha256Of(ruleV2)), readRel: () => ruleV2 }).state === 'ok')
  // 4 清单缺失 ⇒ 未判定(不得冒绿)
  t('S4 清单取不到 ⇒ 未判定', judge({ manifestRaw: null, readRel: () => ruleV1 }).state === 'undetermined')
  // 5 目标文件不在面上 ⇒ 未判定(一个都没判成 ≠ 没问题)
  t(
    'S5 目标取不到 ⇒ 未判定',
    judge({ manifestRaw: manifestFor(s1), readRel: () => null }).state === 'undetermined',
  )
  // 6 advisory 漂移不进 drift 集(与 root-guard 同集合)
  const advManifest = JSON.stringify({
    version: 1,
    targets: [{ id: 'agents-ironlaw', path: 'AGENTS.md', mode: 'section', start: '## 0. 全局铁律', sha256: s1 }],
  })
  const adv = judge({ manifestRaw: advManifest, readRel: () => '## 0. 全局铁律\n\nchanged\n' })
  t('S6 advisory 漂移 ⇒ 不判红(只报数)', adv.state === 'ok' && adv.advisory.length === 1)
  // 7 形状坏(loadManifest 抛)⇒ 未判定
  t(
    'S7 清单形状坏 ⇒ 未判定',
    judge({ manifestRaw: '{"version":9,"targets":[]}', readRel: () => ruleV1 }).state === 'undetermined',
  )
  // 8 面参数非法 ⇒ 未判定,不默认放行
  t('S8 未知判定面 ⇒ exit 2', decide('nonsense').exit === 2)

  for (const r of results) console.log(`${r.pass ? '✔' : '✘'} ${r.name}`)
  const bad = results.filter((r) => !r.pass).length
  console.log(`自检 ${results.length - bad}/${results.length} 通过`)
  return bad === 0 ? 0 : 1
}

export async function main(argv = process.argv.slice(2)) {
  if (argv.includes('--self-test')) return runSelfTest()
  const face = argv.includes('--staged') ? 'staged' : argv.includes('--worktree') ? 'worktree' : 'head'
  if (argv.includes('--json')) {
    // 守护派发档:结论走 stdout 的一行 JSON(形状由镜像测试钉住,不在派发侧复写)
    const cur = judge({ manifestRaw: readFace(face, MANIFEST_REL), readRel: faceReader(face) })
    const base =
      face === 'head' ? cur : judge({ manifestRaw: readFace('head', MANIFEST_REL), readRel: faceReader('head') })
    const out = {
      state: cur.state === 'undetermined' ? 'unjudged' : cur.state === 'drift' ? 'drift' : 'ok',
      face,
      drift: cur.drift ?? [],
      advisory: cur.advisory ?? [],
      baseState: base.state === 'undetermined' ? 'unjudged' : base.state,
      reason: cur.reason ?? null,
    }
    process.stdout.write(JSON.stringify(out) + '\n')
    return out.state === 'drift' ? 1 : out.state === 'unjudged' ? 2 : 0
  }
  const r = decide(face)
  for (const l of r.lines) console.log(l)
  console.log(
    `判定面:${face === 'staged' ? '索引 blob(git ls-files + :<path>)' : face === 'head' ? 'HEAD blob' : '工作树(仅人工逃生舱)'}`,
  )
  return r.exit
}

export const __test__ = { judge, decide, MANIFEST_REL, blameLastCommit }

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main().then((code) => process.exit(code))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
