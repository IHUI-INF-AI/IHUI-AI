// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * autonomy-runner 镜像测试(§22c:判据一律 import 源实现,本文件零复算)。
 *
 * 接线锁的对象 = 自开发发起腿 2026-11-01 实测的三格病灶:
 *   ① 入库模板钉死他机盘符(`G:/IHUI-AI`)⇒ 归一到当次仓根;
 *   ② 归一后仍可能指向本机不存在的产物层(`apps/cli/npm-dist`)⇒ preflight 点名 missing;
 *   ③ 环境级失败被按票面失败计数 ⇒ 连败封票把好票冤杀 ⇒ classify 必须分出 environment。
 * 每条放行档都配反证(变异自证):摘掉对应判据即翻红,否则锁不住。
 */
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  repoRootVariants,
  expandRepoRootTemplate,
  rewriteForeignRepoRoot,
  resolveSessionCommand,
  extractAbsPathTokens,
  preflightSessionRunner,
  classifySessionFailure,
  isNonTicketFailure,
  UNDETERMINED_FAILURE_SIGNS,
  REPO_ROOT_TOKEN,
} from '../lib/autonomy-runner.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
let pass = 0
let fail = 0
const ok = (name, cond) => {
  if (cond) {
    pass++
  } else {
    fail++
    console.log(`  ❌ ${name}`)
  }
}

// 当次实测仓根(不写死盘符,§0 现读):从本文件自身位置推到仓根
const liveRoot = ROOT.replace(/\\/g, '/')
const liveRootBack = ROOT.replace(/\//g, '\\')
const BASE = ROOT.split(/[\\/]/).pop()

ok(
  'T1 repoRootVariants 合法仓根给两形且长形优先',
  (() => {
    const v = repoRootVariants(liveRootBack)
    return v.length === 2 && v[0].includes('\\') && v[1].includes('/')
  })(),
)

ok(
  'T2 变异:形态坏的仓根(丢了分隔符)一律不收,交上层判未判定',
  (() => {
    const bad = repoRootVariants(`${liveRoot.slice(0, 2)}${BASE}`)
    const none = repoRootVariants('')
    const rel = repoRootVariants('relative/path')
    return bad.length === 0 && none.length === 0 && rel.length === 0
  })(),
)

ok(
  'T3 令牌展开吃进仓根',
  expandRepoRootTemplate(`node ${REPO_ROOT_TOKEN}/a.js`, liveRootBack) ===
    `node ${liveRootBack}/a.js`,
)

ok(
  'T4 他机钉死归一:同仓根基名的他盘符前缀 → 当次仓根',
  (() => {
    const foreign = `node Q:/${BASE}/apps/cli/dist/index.js --workspace Q:\\${BASE}`
    const out = rewriteForeignRepoRoot(foreign, liveRootBack)
    return (
      out.includes(`${liveRootBack}/apps/cli/dist/index.js`) &&
      !out.includes(`Q:/`) &&
      !out.includes(`Q:\\`)
    )
  })(),
)

ok(
  'T5 变异:盘外路径(node.exe 在别处)不得被改写 —— 改了就是把执行体搬到错地方',
  (() => {
    const out = rewriteForeignRepoRoot(
      `C:\\Users\\someone\\node.exe ${REPO_ROOT_TOKEN}\\x.js`,
      liveRootBack,
    )
    return out.includes('C:\\Users\\someone\\node.exe')
  })(),
)

ok(
  'T6 变异:基名不同名的他机根不得被误当本仓根(仓根改名/同盘他目录不受侵蚀)',
  rewriteForeignRepoRoot(`D:\\Other-Repo\\a.js`, liveRootBack) === `D:\\Other-Repo\\a.js`,
)

ok(
  'T7 resolve 顺序:先救他机钉死再展开令牌,两形同归一个命令',
  (() => {
    const cmd = resolveSessionCommand(
      `node ${REPO_ROOT_TOKEN}/apps/cli/dist/index.js -w G:/${BASE}`,
      liveRootBack,
    )
    return (
      cmd.includes(`${liveRootBack}/apps/cli/dist/index.js`) &&
      cmd.includes(`${liveRootBack}`) &&
      !cmd.includes(REPO_ROOT_TOKEN)
    )
  })(),
)

ok(
  'T8 token 抽取去重且不把 file:/// 咬错位',
  (() => {
    const t = extractAbsPathTokens(
      `node ${liveRootBack}/a.js --w ${liveRootBack}/a.js --url file:///${liveRoot}/b.js`,
    )
    return t.length === 2 && t.every((x) => /(^|\s)[A-Za-z]:/.test(x) || x.startsWith('/'))
  })(),
)

ok(
  'T9 preflight 在本机真实入口上 = ready(病灶①②已修的直接凭据)',
  (() => {
    const pf = preflightSessionRunner(
      `node ${REPO_ROOT_TOKEN}/apps/cli/dist/index.js -w ${REPO_ROOT_TOKEN}`,
      liveRootBack,
    )
    return pf.state === 'ready' && pf.missing.length === 0 && pf.checked.length >= 2
  })(),
)

// 夹具必须是「结构性不存在」的一层,而不是某台机上恰好没建出来的产物目录:
// 2026-11-02 实测本机 apps/cli/npm-dist/ 已被别的会话真建出来,原写法当场翻红 ——
// 判"缺不缺在位"的用例若靠机器偶然状态,换一台机/建一次产物就自锁(§0.1 现读同义)。
ok(
  'T10 病灶②:归一后仍指向本机不存在的产物层 ⇒ missing 并点名(不是 ready)',
  (() => {
    const pf = preflightSessionRunner(
      `node ${REPO_ROOT_TOKEN}/apps/cli/__ihui-absent-fixture__/dist/index.js`,
      liveRootBack,
    )
    return (
      pf.state === 'missing' &&
      pf.missing.length === 1 &&
      pf.missing[0].includes('__ihui-absent-fixture__')
    )
  })(),
)

ok(
  'T11 病灶①:他机盘符钉死经归一后落到本机在位入口 ⇒ ready',
  (() => {
    const pf = preflightSessionRunner(
      `node Z:/${BASE}/apps/cli/dist/index.js --workspace Z:/${BASE}`,
      liveRootBack,
    )
    return pf.state === 'ready'
  })(),
)

ok(
  'T12 枚举到 0 个可核验路径判死不记绿(§0.3)',
  preflightSessionRunner('ihui --json', liveRootBack).state === 'undetermined',
)

ok(
  'T13 仓根取不到 ⇒ 未判定,不回落放行',
  preflightSessionRunner(`node ${REPO_ROOT_TOKEN}/a.js`, '').state === 'undetermined',
)

ok(
  'T14 空模板 = dry-run 档,不算缺也不算过',
  preflightSessionRunner('   ', liveRootBack).state === 'template-empty',
)

ok(
  'T15 病灶③:模块级失败分型为 environment(不计票连败)',
  (() => {
    const c = classifySessionFailure({
      status: 1,
      stderr:
        "Error [ERR_MODULE_NOT_FOUND]: Cannot find module 'G:/IHUI-AI/apps/cli/npm-dist/dist/index.js'",
    })
    return c.kind === 'environment' && c.sign === 'ERR_MODULE_NOT_FOUND'
  })(),
)

ok(
  'T16 变异:真·会话失败仍归 session —— 分型不得把票的失败也一并免掉(否则封票机制形同虚设)',
  classifySessionFailure({ status: 1, stderr: 'typecheck failed in 3 files' }).kind === 'session',
)

ok(
  'T17 退出码取不到 ⇒ undetermined,不冒充成功也不记票失败',
  classifySessionFailure({ status: null, stderr: '' }).kind === 'undetermined',
)

ok('T18 exit=0 ⇒ ok', classifySessionFailure({ status: 0, stderr: '' }).kind === 'ok')

ok(
  'T19 活配置自证:gates.json 的模板经 preflight 必须 ready(病灶真除,不是只在测试里好)',
  (() => {
    const gates = JSON.parse(
      readFileSync(join(ROOT, 'scripts', 'data', 'auto-evolve-gates.json'), 'utf8'),
    )
    const pf = preflightSessionRunner(gates.sessionCommandTemplate, liveRootBack)
    if (pf.state !== 'ready')
      console.log(`     现读 state=${pf.state} missing=${pf.missing.join(',')} why=${pf.why}`)
    return pf.state === 'ready'
  })(),
)

// ---------------------------------------------------------------------------
// /goal R2(2026-11-04):判据「我量不动」不得被读成「票没推进」
// ---------------------------------------------------------------------------
// 立因(.ihui-agent/state/auto-evolve-ledger.jsonl 219/222/223 行):安全审查因 git 派生
// ENOBUFS/ETIMEDOUT/untracked 超上限落 status=undetermined,旧分型兜底成 session ⇒
// 同班次 session-failed + dispatched 双写,空转阶梯把工具故障算成票不推进。
//
// 2026-11-05 判序改向(带实测,不是重写故事):把 rc=3 判成 undetermined 的那一版**误诊了**。
// 当天用调度器原样命令跑一次最小真会话,原读证据:
//   rc=0、stdout 两条 `write_file success=true`、complete.stopReason=end_turn,
//   而 stderr 里同样有那句 `⚠ [security-scan] … status=undetermined … untracked-files-over-cap`。
// 旧分类器对这份 stderr 的四臂(把真 stderr 原样喂进去,只换退出码):
//   status=0 ⇒ undetermined  status=3 ⇒ undetermined  status=1 ⇒ undetermined  status=null ⇒ undetermined
// 四臂同色 = 一行诊断劫持了终态。后果不是难看:rc=0 的成功会话被记成 runner-unavailable(台账 41 条),
// 而"零产出"永远归因给"调度器自己的腿"。
// 现判序:退出码有契约含义的(0/3/130)先按含义判;只有非零且含义不明确(1/2/4/其它)才扫签名;
// 签名命中而终态已定 ⇒ 收进 diagnostics 如实报数,不参与判定。保护意图(工具故障别算到票头上)原样保留。
const LEDGER_222 =
  'workspace-aggregate-diff|status=undetermined | not-judged-safe | ' +
  'missing=untracked-files-over-cap(total=75, scanned=30);' +
  'git-diff-HEAD-unavailable: spawnSync git ENOBUFS'

ok(
  'T20 /goal R2 修正:rc=3 + 那行诊断 ⇒ no-progress,签名进 diagnostics 而不改判',
  (() => {
    const c = classifySessionFailure({ status: 3, stderr: LEDGER_222 })
    return (
      c.kind === 'no-progress' &&
      c.sign === 'exit=3' &&
      Array.isArray(c.diagnostics) &&
      c.diagnostics.includes('ENOBUFS') &&
      c.diagnostics.includes('untracked-files-over-cap')
    )
  })(),
)

ok(
  'T21 /goal R2:签名表逐枚在"含义不明确的非零码"(rc=1)下仍归 undetermined 且 nonTicketFailure',
  (() => {
    return UNDETERMINED_FAILURE_SIGNS.every((s) => {
      const c = classifySessionFailure({ status: 1, stderr: `scan: ${s}` })
      return c.kind === 'undetermined' && isNonTicketFailure(c.kind)
    })
  })(),
)

ok(
  'T22 /goal R2:ETIMEDOUT 在 rc=1 下仍归 transport(既有分型不回归)',
  (() => {
    const c = classifySessionFailure({ status: 1, stderr: 'spawnSync git ETIMEDOUT' })
    return c.kind === 'transport' && c.sign === 'ETIMEDOUT' && isNonTicketFailure(c.kind)
  })(),
)

ok(
  'T23 变异反向锁①:泛化 failed/error 在 rc=1 下不得被免掉,仍归 session',
  (() => {
    const a = classifySessionFailure({ status: 1, stderr: 'ERROR: task failed' })
    const b = classifySessionFailure({ status: 1, stderr: 'exit 3: command failed' })
    return a.kind === 'session' && b.kind === 'session' && !isNonTicketFailure(a.kind)
  })(),
)

ok(
  'T24 变异反向锁②:真会话失败仍归 session,封票机制不得形同虚设',
  (() => {
    const c = classifySessionFailure({ status: 1, stderr: 'typecheck failed in 3 files' })
    return c.kind === 'session' && !isNonTicketFailure(c.kind)
  })(),
)

ok(
  'T25 变异反向锁③:签名表不空且不含泛化词(防恒真门 / 防收 0 枚记绿)',
  (() => {
    const generic = ['failed', 'error', 'exit', 'no_progress', 'session']
    return (
      UNDETERMINED_FAILURE_SIGNS.length >= 5 &&
      !UNDETERMINED_FAILURE_SIGNS.some((s) => generic.includes(s.toLowerCase()))
    )
  })(),
)

ok(
  'T26 这次实测的正主:rc=0 + 那行劫持诊断 ⇒ ok(旧版四臂同色就是红在这格)',
  (() => {
    const c = classifySessionFailure({ status: 0, stderr: LEDGER_222 })
    return c.kind === 'ok' && c.diagnostics.length > 0 && c.why.includes('只报数不改判')
  })(),
)

ok(
  'T27 成对正向:rc=0 且 stderr 干净 ⇒ ok 且 why 不编造诊断数',
  (() => {
    const c = classifySessionFailure({ status: 0, stderr: '一切正常' })
    return c.kind === 'ok' && c.diagnostics.length === 0 && c.why === ''
  })(),
)

ok(
  'T28 rc=130 ⇒ cancelled 且不进票连败;rc=null ⇒ undetermined(取不到不猜)',
  (() => {
    const a = classifySessionFailure({ status: 130, stderr: '' })
    const b = classifySessionFailure({ status: null, stderr: LEDGER_222, signal: 'SIGTERM' })
    return a.kind === 'cancelled' && isNonTicketFailure(a.kind) && b.kind === 'undetermined'
  })(),
)

ok(
  'T29 判序形状锁:契约含义必须先于签名扫描(把签名表挪到前面 ⇒ 本锁红,§0.3 失效方向不许是"多给一个借口")',
  (() => {
    const src = readFileSync(join(ROOT, 'scripts', 'lib', 'autonomy-runner.mjs'), 'utf8')
    const iMeaning = src.indexOf('SESSION_EXIT_MEANINGS[status]')
    const iEnv = src.indexOf('ENV_FAILURE_SIGNS.find')
    return iMeaning > 0 && iEnv > 0 && iMeaning < iEnv
  })(),
)

// T30–T32 发起腿断裂的结构分型(2026-11-05 立)。
// 立因:台账 2026-11-04T23:04:28.835Z 那条 session-failed 的 stderr 是 cmd.exe 的
// 「'node' 不是内部或外部命令…」经错误码页解出的**乱码**,中英文字面签名都命中不了,
// 于是被算成这张票的连败 ⇒ 无辜票被封。三条成对锁:乱码正例、中文正例、
// 以及"跑起来了的失败不得被吞"两条反例(有事件帧 / 超出一行报错的长度)。
ok(
  'T30 /goal 台账乱码原文回放 ⇒ environment 且不烧票(旧读数 session 是这一格的病)',
  (() => {
    const ledged = "'node' ڲⲿ⣬Ҳǿеĳ ļ"
    const c = classifySessionFailure({ status: 1, stderr: ledged })
    return (
      c.kind === 'environment' && c.sign === 'launch-unresolvable-exe' && isNonTicketFailure(c.kind)
    )
  })(),
)

ok(
  'T31 同型但码页正常(中文原文)⇒ 仍 environment(签名表里并无这条中文,靠结构接住)',
  (() => {
    const zh = "'node' 不是内部或外部命令，也不是可运行的程序或批处理文件。"
    const c = classifySessionFailure({ status: 1, stderr: zh })
    return c.kind === 'environment' && isNonTicketFailure(c.kind)
  })(),
)

ok(
  'T32 反向锁①:会话真起来过(带事件帧)而报错首行仍像系统报错 ⇒ 仍归 session,不许吞',
  (() => {
    const t = '\'node\' ⲿ\n{"type":"tool_result","ok":true,"content":"编译失败于 3 个文件"}'
    const c = classifySessionFailure({ status: 1, stderr: t })
    return c.kind === 'session' && !isNonTicketFailure(c.kind)
  })(),
)

ok(
  'T32b 反向锁②:超出"一行系统报错"长度上限(600 字)⇒ 不吃结构档,仍归 session',
  (() => {
    const t = `'node' ${'详'.repeat(700)}`
    const c = classifySessionFailure({ status: 1, stderr: t })
    return c.kind === 'session' && !isNonTicketFailure(c.kind)
  })(),
)

ok(
  'T32c 判序形状锁:结构档必须排在契约含义之后、签名扫描之前(挪到前面会吞 exit=3/130)',
  (() => {
    const src = readFileSync(join(ROOT, 'scripts', 'lib', 'autonomy-runner.mjs'), 'utf8')
    const iMeaning = src.indexOf('SESSION_EXIT_MEANINGS[status]')
    const iLaunch = src.indexOf('isLaunchFailureText(blob)')
    const iEnv = src.indexOf('ENV_FAILURE_SIGNS.find')
    return iMeaning > 0 && iLaunch > 0 && iEnv > 0 && iMeaning < iLaunch && iLaunch < iEnv
  })(),
)

console.log(
  fail === 0 ? `autonomy-runner: ${pass} 例全绿` : `autonomy-runner: ${pass} 绿 / ${fail} 红`,
)
process.exitCode = fail === 0 ? 0 : 1
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
