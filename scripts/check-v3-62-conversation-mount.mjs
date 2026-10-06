// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 守门「V3 #62 侧栏搜索与批量选择 装载对账」(2026-09-27 立)
//
// 立因就是第 62 票那一型:`ChatSearchBar` / `useChatSearch` 组件与 hook 都写完了,
// 生产面零调用方 ⇒ 界面上永远不出现,而 typecheck / 单测 / 纯函数测试全都绿
// (同型见守门 64 适配器接线 / 70 硬编码中文 / 81 邮件通道 / 115 入参校验器)。
// 本门把票面那句规矩变成尺子:**孤儿件要么接、要么删,并登记**。
//
// 判据(提交链跑的只有前三条,面小、跑得起):
//   W0 登记表自身的时效性 —— 每个登记出口的 `ownFile` 必须在被审面上存在。
//      实现被删/改名而台账还写着它,是最安静的腐烂;这条在**任何面**(含默认 HEAD 档)都有牙。
//   W1 登记出口符号必须有**调用/渲染点**(`Foo(` 或 `<Foo`)。
//      **定义行与注释里的提及都不算装车** —— 本仓最高频的失效型就是"看起来有、其实没接"。
//   W2 `apps/web/src/components/sidebar/` 下每个源文件都必须被别处按模块名 import 到;
//      锚点 = 该文件在 HEAD 面自身是否已是孤儿 ⇒ **存量只报数、新增才判红**(防恒红门)。
//   W3 全量孤儿文件普查 —— 默认档**不算**,`--strict` 才算红(手工/CI 问责入口)。
//      为什么不当默认:components/+hooks/ 一次要读上千个文件,且必然扫到与本票无关的
//      存量孤儿 —— 与改动无关的 blocking 红只会逼人跳门,连带废掉全部守门。
//
// 已知覆盖面限制(如实登记,不得读成"全仓孤儿已归零"):
//   判据按**被审面**(HEAD 树 / 索引)枚举文件。仓库里 `ChatSearchBar` 与
//   `useChatSearch` 两份源码在 HEAD 面**根本不存在**(仅作为未跟踪文件躺在某台机的
//   工作树里),所以本门看不见它们、也不会因为它们报红 —— 它守的是"入了库的出口被摘线",
//   不是"某台机的磁盘残留"。工作树残留的清理属删除安全判定(AGENTS §7),不属门能判的事。
//
// 取材口径(同 70/77/83/98/101/103/115):全量判 **HEAD blob**、`--staged` 判**索引 blob**、
//   `--worktree` 只作人工逃生舱;两面旗同给 ⇒ exit 2;任一面取不到 ⇒ **exit 2 无法判定**
//   (不冒红也不记绿);W2 枚举到 0 个文件 ⇒ 判死不记绿(空扫描就是它要防的那一型)。
//
// 用法:
//   node scripts/check-v3-62-conversation-mount.mjs              # 全量(HEAD 面)
//   node scripts/check-v3-62-conversation-mount.mjs --staged     # 索引面
//   node scripts/check-v3-62-conversation-mount.mjs --worktree   # 磁盘(人工排查)
//   node scripts/check-v3-62-conversation-mount.mjs --strict     # 追加 W3 全量普查并判红
//   node scripts/check-v3-62-conversation-mount.mjs --self-test  # 临时独立仓正反成对自检
//   --root <dir>  显式仓库根(测试通道;生产不带)
// 退出码:0 通过 / 1 判据违规 / 2 无法判定或脚本自身异常
// 【接线状态:已接入】注册条目已落在 scripts/guardian-runner.mjs(id 以 runner 现值为准,
// 勿照抄本行数字):blocking + skipEnv:HUSKY_SKIP_V362_CONV_MOUNT,带 stagedTriggers。
// 应急跳过环境变量名:见 SKIP_ENV_NAME —— 该 env 现有**两个**读点(本脚本 line 866 自读 +
// runner 注册项 skipEnv),不是"只由本脚本自读"。
// —— 本段原写"应急跳过环境变量名:见 SKIP_ENV_NAME(尚未接线 ⇒ 该 env 目前只由本脚本自读,
//   runner 侧的 skipEnv 需与注册同笔落地,不得先声称已接)",那是立项时的实况,已过期(门早已装车)。

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  FACE_LABEL,
  Undetermined,
  assertRepoRoot,
  catBatch,
  gitRaw,
  readWorktreeFile,
  selectFace,
} from './lib/face-reader.mjs'
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'

const DEFAULT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

export const SKIP_ENV_NAME = 'HUSKY_SKIP_V362_CONV_MOUNT'

/** 证据面:只认端内生产代码里的装载证据(packages/ 里若将来复用同样算,故一起收)。 */
const EVIDENCE_ROOTS = ['apps/', 'packages/']
/** W2 管辖目录:本票新增子组件的落点。 */
const SIDEBAR_DIR = 'apps/web/src/components/sidebar/'
/** W3 普查目录:侧栏/会话相关的组件与 hook 面。 */
const AUDIT_DIRS = ['apps/web/src/components/', 'apps/web/src/hooks/']

/** 本门与它的镜像测试必然逐字含有下列符号名与路径串,不参与对账。 */
const SELF_EXEMPT_BASENAMES = ['check-v3-62-conversation-mount.mjs']

/**
 * W1 登记出口符号表。`symbol` 是必须被**别处**用上的标识符,`ownFile` 是它的定义文件
 * (定义文件自身出现该名字不算装车)。新增登记须同时新增消费点 —— 否则 W1 当场红,
 * 这正是本门存在的理由。
 *
 * `lane` 不是装饰:本门的立论是"web 侧栏的装载点",而镜像测试里那些"拿真实侧栏源码
 * 逐字判"的用例(T3/T3b/T4)只在 lane='ui' 上成立 —— 服务侧出口的装载证据在 Python 文件里,
 * 拿侧栏文本去判它会**恒红**。分道之后两条腿各自有真源码可判,不得合并成一条宽松判据。
 */
export const MOUNT_EXITS = [
  {
    lane: 'ui',
    symbol: 'filterConversationsByKeyword',
    ownFile: 'apps/web/src/components/sidebar-chat-history.tsx',
    why: 'V3 #62 判据 1:侧栏搜索的过滤出口(标题/文件夹/标签三面匹配)',
  },
  {
    lane: 'ui',
    symbol: 'useConversationSelection',
    ownFile: 'apps/web/src/components/sidebar/use-conversation-selection.ts',
    why: 'V3 #62 判据 2:批量选择选中集的唯一持有者',
  },
  {
    lane: 'ui',
    symbol: 'ConversationBatchBar',
    ownFile: 'apps/web/src/components/sidebar/conversation-batch-bar.tsx',
    why: 'V3 #62 判据 2:批量动作条(不持选中集,只读 props)',
  },
  {
    lane: 'service',
    symbol: 'build_form_request_frame',
    ownFile: 'apps/ai-service/app/services/mcp_server.py',
    why: 'V3 #63:下行 form_request 帧的唯一组帧权威。生产点在 llm.py 工具循环的 request_business_form 拦截位 —— 谁把那条生产者摘掉,本条即红(定义行不算装车,Python 的 `def` 支已配正反自检)',
  },
]

// ==================== 判据输入:噪声遮蔽 ====================

/**
 * 抹注释、按档决定是否保留字符串字面量(逐字符状态机,行结构不变 ⇒ 行号对得上)。
 *
 * 两档不是风格选择,是两条判据的取材方向相反:
 * - 默认档(保留字符串)给 **W2/W3** 用 —— 跨文件装载的唯一证据就是 import 说明符那串
 *   `'./conversation-batch-bar'`,把字符串一起抹掉等于该判据整条失明(门 134 记过同型)。
 * - `keepStrings:false` 给 **W1** 用 —— 调用点判据认 `Foo(` / `<Foo`,若字符串还看得见,
 *   串里写一句 `filterConversationsByKeyword(` 就能给孤儿发合格证(自检 A3 就是这么抓的)。
 * 混用任一档 ⇒ 一道判据失明或另一道判据满天假阳。
 *
 * 已知限制:状态机不认正则字面量,`/'/` 这类写法会让它多抹一段。失误方向是
 * "把真装载抹掉 ⇒ 假红(会逼人来看门)",不是"把注释当装载 ⇒ 假绿"。
 * 注:并行另一票计划把遮罩收进 `scripts/lib/code-mask.mjs` 供全部门共用(本仓"同一判据
 * 两处实现必漂移"记过最多次)。该 lib 在本门落地当刻盘面上**不存在**,所以这里带一份;
 * 它入库后本门应改为 import 那一份,不得长期两份并存。
 *
 * `keepStrings:false` 是给 W1 用的第二档:调用点判据必须看不见**字符串里**的
 * `foo(` —— 自检 A3 就是拿这个形态把第一版判据咬红的(串里写 `filterConversationsByKeyword(`
 * 会被当成调用点)。两层遮罩方向不同、不得混用:W2 找 import 说明符**必须**看得见字符串。
 */
export function maskNoise(text, { keepStrings = true, hashLineComments = false } = {}) {
  const out = []
  let state = 'code' // code | line | block | sq | dq | tpl
  let i = 0
  while (i < text.length) {
    const c = text[i]
    const next = text[i + 1]
    if (state === 'code') {
      // Python 的行注释是 `#`。少了这一档,把服务侧调用点**注释掉**的变异在遮蔽层上
      // 完全无效(遮罩照旧看得见那行) ⇒ "生产者被临时停掉"这一格无人喊。
      if (hashLineComments && c === '#') {
        state = 'line'
        out.push(' ') // `#` 只有一个字符,推两格会让遮蔽面与原文列错位(行号仍对齐)
        i += 1
        continue
      }
      if (c === '/' && next === '/') {
        state = 'line'
        out.push(' ', ' ')
        i += 2
        continue
      }
      if (c === '/' && next === '*') {
        state = 'block'
        out.push(' ', ' ')
        i += 2
        continue
      }
      if (c === "'") state = 'sq'
      else if (c === '"') state = 'dq'
      else if (c === '`') state = 'tpl'
      out.push(c)
      i += 1
      continue
    }
    if (state === 'line') {
      if (c === '\n') {
        state = 'code'
        out.push(c)
      } else out.push(' ')
      i += 1
      continue
    }
    if (state === 'block') {
      if (c === '*' && next === '/') {
        state = 'code'
        out.push(' ', ' ')
        i += 2
        continue
      }
      out.push(c === '\n' ? c : ' ')
      i += 1
      continue
    }
    // 字符串态:默认整段保留(W2/W3 的证据在说明符里);W1 档抹内容、留引号与换行
    if (c === '\\') {
      out.push(...(keepStrings ? [c, next ?? ' '] : [' ', ' ']))
      i += 2
      continue
    }
    const closer = state === 'sq' ? "'" : state === 'dq' ? '"' : '`'
    if (c === closer) state = 'code'
    out.push(keepStrings ? c : c === closer || c === '\n' ? c : ' ')
    i += 1
  }
  return out.join('')
}

/** 测试面识别:mock/夹具不能当"生产装载"证据。 */
export function isTestSurface(rel) {
  return (
    /(^|\/)(tests?|__tests__|e2e|spec)\//.test(rel) ||
    /\.(test|spec)\.[cm]?[jt]sx?$/.test(rel) ||
    rel.startsWith('.github/')
  )
}

function selfExempt(rel) {
  const base = rel.split('/').pop() ?? ''
  return SELF_EXEMPT_BASENAMES.some((b) => base.startsWith(b))
}

function normLines(text) {
  return String(text)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
}

/** git grep 在 head 面的输出带 `HEAD:` 前缀,其余面是裸路径。 */
function stripRevPrefix(line) {
  return line.replace(/^[^:\s]+:/, '')
}

// ==================== 取材 ====================

function listFilesUnder(root, face, dir) {
  const args =
    face === 'head'
      ? ['ls-tree', '-r', '--name-only', 'HEAD', '--', dir]
      : face === 'staged'
        ? ['ls-files', '--', dir]
        : ['ls-files', '--', dir]
  return normLines(gitRaw(args, root))
    .filter((p) => p.startsWith(dir))
    .filter((p) => /\.tsx?$/.test(p))
    .sort()
}

/** 一次 git grep 把候选名当**固定串**捞一遍(候选超集,判据自己会否证)。 */
function grepCandidates(root, face, names) {
  if (names.length === 0) return []
  const pats = names.flatMap((n) => ['-e', n])
  const paths = ['--', ...EVIDENCE_ROOTS]
  const base =
    face === 'head'
      ? ['grep', '-I', '-l', '-F', ...pats, 'HEAD']
      : face === 'staged'
        ? ['grep', '-I', '-l', '-F', '--cached', ...pats]
        : ['grep', '-I', '-l', '-F', ...pats]
  let out
  try {
    out = gitRaw([...base, ...paths], root)
  } catch (e) {
    // git grep 无命中是 exit 1 —— 那是"git 说没有",与"git 没跑成"必须分开
    if (e instanceof Undetermined && (e.status === 1 || /^\s*$/.test(e.captured ?? ''))) return []
    throw e
  }
  const rows = []
  for (const line of normLines(out)) {
    // head 面的 git grep 输出形如 HEAD:apps/web/...,其余面是裸路径
    const rel = stripRevPrefix(line)
    if (rel) rows.push(rel)
  }
  return [...new Set(rows)].sort()
}

function readFace(root, face, files) {
  if (face === 'worktree') {
    const map = new Map()
    for (const rel of files) map.set(rel, readWorktreeFile(root, rel))
    return map
  }
  const specs = files.map((f) => `${face === 'staged' ? ':' : 'HEAD:'}${f}`)
  const bySpec = catBatch(root, specs, { maxBuffer: 128 << 20 })
  const map = new Map()
  files.forEach((rel, i) => map.set(rel, bySpec.get(specs[i]) ?? null))
  return map
}

/** 生产面(非测试、非本门自身)的文件清单。 */
function productionOnly(files) {
  return files.filter((p) => !isTestSurface(p) && !selfExempt(p))
}

function escapeForRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * 定义行 / 类型位行**不算**调用点 —— 孤儿组件的自身声明不得给自己发合格证。
 * (实测:`export function ChatSearchBar({` 若被算成装载,本门对立项那一型直接失明。)
 */
export function isDeclarationLine(line, symbol) {
  const t = line.trim()
  if (!t) return false
  const esc = escapeForRe(symbol)
  if (
    new RegExp(
      `^(export\\s+)?(default\\s+)?(async\\s+)?(function|const|let|var|class)\\s+${esc}\\b`,
    ).test(t)
  )
    return true
  if (
    new RegExp(
      `^(export\\s+)?(declare\\s+)?(abstract\\s+)?(interface|type|enum)\\s+${esc}\\b`,
    ).test(t)
  )
    return true
  // 再导出行(export { A } from './x' / export default A)是"名字在场",不是"被调用"
  if (new RegExp(`^export\\s+(default\\s+)?\\{[^}]*\\b${esc}\\b`).test(t)) return true
  // Python 的 def / async def 与 class 同属"定义在场"。本门的证据面含 ai-service 的 .py,
  // 少了这一支,登记一个 Python 出口会被**它自己的定义行**判成已装车 ⇒ 这条判据恒绿,
  // 而"生产者被摘掉"恰恰是它唯一要抓的事(2026-09-27 加,随 V3 #63 的组帧出口登记)。
  if (new RegExp(`^(?:async\\s+)?def\\s+${esc}\\b`).test(t)) return true
  return false
}

/** 调用/渲染点:必须跟一个 `(`(函数式调用)或以 JSX 开标签出现(组件渲染)。 */
export function isUseLine(line, symbol) {
  if (isDeclarationLine(line, symbol)) return false
  const esc = escapeForRe(symbol)
  // JSX 分支的 `(?:[\s/>]|$)` 不是多余的:多行属性写法下开标签就是**行尾**,
  // 只写 [\s/>] 会要求后面还有一个字符 ⇒ 侧栏那种
  //   <ConversationBatchBar
  //     selectedCount={…}
  // 的写法整条看不见(镜像测试 T3 用真仓源码抓到的一次:夹具用调用形态写,所以自检漏网)。
  return new RegExp(`${esc}\\s*\\(`).test(line) || new RegExp(`<\\s*${esc}(?:[\\s/>]|$)`).test(line)
}

/** 找出一份文件里某个符号的调用点行数(只为报告可读,判据看 >=1)。 */
function useLineCount(maskedText, symbol) {
  let n = 0
  for (const line of maskedText.split(/\r?\n/)) if (isUseLine(line, symbol)) n += 1
  return n
}

// ==================== 判据 ====================

/**
 * 一轮取证:把 W1 的符号与 W2 的模块名合并成**一次** git grep + 一次 readFace,
 * 同时产出两档遮蔽(串可见档给 W2/W3 找说明符,抹串档给 W1 找调用点)。
 * 合并前是两轮全仓 grep + 两轮 catBatch,实测单跑 23s —— 对 blocking 门太贵。
 */
export function collectEvidence(root, face, patterns) {
  const candidates = grepCandidates(root, face, patterns)
  const texts = readFace(root, face, candidates)
  const loose = new Map()
  const strict = new Map()
  for (const rel of candidates) {
    const raw = texts.get(rel)
    if (raw === null || raw === undefined) {
      // grep 报了它、内容却取不到 ⇒ 清单与内容不同轮或 blob 损坏:不猜,判无法判定
      throw new Undetermined(
        `${FACE_LABEL[face] ?? face} 取到候选 ${rel} 的内容失败 —— 清单与内容不同轮 ⇒ 不猜`,
      )
    }
    const py = /\.py$/.test(rel)
    loose.set(rel, maskNoise(raw, { hashLineComments: py }))
    strict.set(rel, maskNoise(raw, { keepStrings: false, hashLineComments: py }))
  }
  return { candidates, loose, strict }
}

/**
 * W1:每个登记出口符号必须真有**调用/渲染点**(自有定义文件也算 —— 侧栏的过滤helper
 * 就与它同文件被调;定义行本身不算)。
 */
export function checkMountExits(root, face, ev) {
  const e =
    ev ??
    collectEvidence(
      root,
      face,
      MOUNT_EXITS.map((x) => x.symbol),
    )
  const prod = productionOnly(e.candidates)
  const violations = []
  for (const exit of MOUNT_EXITS) {
    const users = prod.filter((rel) => useLineCount(e.strict.get(rel) ?? '', exit.symbol) > 0)
    if (users.length === 0) violations.push({ ...exit })
  }
  return { violations, checked: MOUNT_EXITS.length }
}

/**
 * W2:sidebar/ 下每个源文件都必须被**别的**生产文件按模块名 import 到。
 *
 * 棘轮锚点 = 该文件在 **HEAD 面自身**是否已经是孤儿(与 77/83/98/102/113 同族):
 * 存量孤儿只报数,新增才判红 —— 当场把全目录判红就是一台与任何改动都无关的恒红门,
 * 唯一结局是逼人 `--no-verify` 连带废掉全部守门。
 * 如实登记该锚点的构造后果:默认档(判 HEAD 面)锚点与被审面同面 ⇒ "新增"位恒为 0,
 * 这一档的实际牙齿在 W0/W1;有牙的是 `--staged`(锚 HEAD、审索引)。
 */
export function checkSidebarWiring(root, face, ctx) {
  const now = ctx
    ? { orphans: orphansFromFiles(ctx.sidebarFiles, ctx.ev), files: ctx.sidebarFiles }
    : orphanSidebarFiles(root, face)
  const anchor = face === 'head' ? now : orphanSidebarFiles(root, 'head')
  const fresh = now.orphans.filter((f) => !anchor.orphans.includes(f))
  const existing = now.orphans.filter((f) => anchor.orphans.includes(f))
  return { violations: fresh.map((f) => ({ file: f })), existing, checked: now.files.length }
}

/** 枚举某面 sidebar/ 的源文件(空面 ⇒ 判死,不记绿)。 */
export function listSidebarFiles(root, face) {
  const files = listFilesUnder(root, face, SIDEBAR_DIR).filter((p) => !isTestSurface(p))
  if (files.length === 0) {
    // 枚举到 0 个 = 判据失效的那一型(目录改名/搬走),绝不表现为 exit 0 的绿
    throw new Undetermined(
      `${FACE_LABEL[face] ?? face} 面在 ${SIDEBAR_DIR} 下枚举到 0 个源文件 —— 扫描面判空不等于通过`,
    )
  }
  return files
}

/** 给定文件清单 + 取证,算出其中无人 import 的那些。 */
function orphansFromFiles(files, ev) {
  const prod = productionOnly(ev.candidates)
  // 判据认的是**说明符尾段**,不是"文件里出现过这个名字"。
  // 两重理由:① 松判据下 `Sidebar` 这种高频词会让全仓几百个文件都成候选(实测单跑 23s→60s),
  //    成本全花在读无关 blob 上;② 更糟的是松判据会把注释以外的**任意**提及当装载 ——
  //    而"接了没有"问的就是有没有人 import 它。预筛串 `/base` 是说明符的严格超集。
  const tailsByFile = new Map()
  for (const rel of prod) tailsByFile.set(rel, importedTails(ev.loose.get(rel) ?? ''))
  return files.filter((file) => {
    const base = baseOf(file)
    return !prod.some((rel) => rel !== file && tailsByFile.get(rel)?.has(base))
  })
}

/** 抽出一份文件里所有 import/export-from/动态 import 的说明符尾段(不含扩展名)。 */
export function importedTails(maskedText) {
  const tails = new Set()
  const re = /(?:\bfrom|\bimport)\s*\(?\s*['"]([^'"]+)['"]/g
  for (const m of maskedText.matchAll(re)) {
    const spec = m[1] ?? ''
    const last = spec.split('/').pop() ?? ''
    const base = last.replace(/\.[cm]?[jt]sx?$/, '')
    if (base) tails.add(base)
  }
  return tails
}

/** 某面下 sidebar/ 的孤儿文件清单(自带一轮取证)。 */
function orphanSidebarFiles(root, face) {
  const files = listSidebarFiles(root, face)
  const ev = collectEvidence(
    root,
    face,
    files.map((f) => `/${baseOf(f)}`),
  )
  return { orphans: orphansFromFiles(files, ev), files }
}

function baseOf(rel) {
  return (rel.split('/').pop() ?? rel).replace(/\.tsx?$/, '')
}

/**
 * 单文件在面存在性(不做扩展名筛)。W0 用它而不是 listFilesUnder —— 后者的 `.tsx?$` 过滤
 * 是给侧栏枚举用的,拿它问"这个 .py 实现还在不在"会**恒答不在**,于是登记一个服务侧
 * 出口就等于给本门装一台自伤红门(A1 第一次跑就是这样红的)。
 */
function filePresentOnFace(root, face, file) {
  const args =
    face === 'head'
      ? ['ls-tree', '-r', '--name-only', 'HEAD', '--', file]
      : face === 'staged'
        ? ['ls-files', '--', file]
        : ['ls-files', '--', file]
  return normLines(gitRaw(args, root)).includes(file)
}

/**
 * W0:登记表自身的时效性 —— 每个登记出口的 `ownFile` 必须在被审面上存在。
 * 这条在**任何面**都有牙(包括默认 HEAD 档):实现被删或被改名而台账还写着它,
 * 是最安静的腐烂 —— W1 会因为"取不到候选内容"判无法判定或直接看不见,只有 W0 能点名。
 */
export function checkRegistryFreshness(root, face) {
  const missing = []
  for (const exit of MOUNT_EXITS) {
    if (!filePresentOnFace(root, face, exit.ownFile)) missing.push(exit)
  }
  return { violations: missing, checked: MOUNT_EXITS.length }
}

/**
 * W3(--strict 才跑):components/ + hooks/ 全量孤儿普查。
 * 一次读满所有源文件、抽出 import 说明符集合,再按"自己的模块名有没有被引用"判。
 */
export function auditOrphanFiles(root, face) {
  const all = productionOnly(AUDIT_DIRS.flatMap((dir) => listFilesUnder(root, face, dir))).filter(
    (p) => !p.startsWith(SIDEBAR_DIR),
  )
  if (all.length === 0)
    throw new Undetermined(
      `${FACE_LABEL[face] ?? face} 面在 ${AUDIT_DIRS.join(' + ')} 枚举到 0 个文件`,
    )
  const texts = readFace(root, face, all)
  const referenced = new Set()
  for (const rel of all) {
    const raw = texts.get(rel)
    if (raw === null || raw === undefined)
      throw new Undetermined(`${FACE_LABEL[face] ?? face} 取不到 ${rel}(清单与内容不同轮 ⇒ 不猜)`)
    for (const m of maskNoise(raw).matchAll(/from\s+['"]([^'"]+)['"]/g)) {
      const spec = m[1] ?? ''
      const last = spec.split('/').pop() ?? ''
      if (last) referenced.add(last)
    }
  }
  const orphans = []
  for (const rel of all) {
    const base = rel
      .split('/')
      .pop()
      .replace(/\.tsx?$/, '')
    if (base === 'index' || base === 'page' || base === 'layout') continue
    if (!referenced.has(base)) orphans.push(rel)
  }
  return { orphans, checked: all.length }
}

// ==================== 运行 ====================

export function runCheck({ root, face, strict }) {
  // 先确认"这棵树就是它自称的那仓":--root 指错目录时,门会对着一棵无关的仓报绿/报红
  assertRepoRoot(root, 'V3 #62 侧栏装载对账')
  const lines = []
  // 一轮取证喂 W1 + W2: patterns = 登记符号 ∪ sidebar 模块名(两组合并成一次 grep 一次读)
  const sidebarFiles = listSidebarFiles(root, face)
  const patterns = [
    ...new Set([
      ...MOUNT_EXITS.map((e) => e.symbol),
      // 预筛串带前导 `/`:说明符必然写成 `.../base'`,而 `base` 单独当子串会命中全仓
      ...sidebarFiles.map((f) => `/${baseOf(f)}`),
    ]),
  ]
  const ev = collectEvidence(root, face, patterns)

  const w0 = checkRegistryFreshness(root, face)
  for (const v of w0.violations)
    lines.push(`❌ W0 登记出口的实现文件不在被审面上(台账与现实脱节): ${v.symbol} ← ${v.ownFile}`)
  const w1 = checkMountExits(root, face, ev)
  for (const v of w1.violations)
    lines.push(
      `❌ W1 登记出口无调用/渲染点(定义行与注释都不算): ${v.symbol}  定义于 ${v.ownFile}  —— ${v.why}`,
    )
  const w2 = checkSidebarWiring(root, face, { sidebarFiles, ev })
  for (const v of w2.violations)
    lines.push(`❌ W2 sidebar/ 新增无人 import 的源文件(要么接、要么删并登记): ${v.file}`)

  let w3 = null
  if (strict) {
    w3 = auditOrphanFiles(root, face)
    for (const rel of w3.orphans) lines.push(`❌ W3 生产面无引用(孤儿源文件): ${rel}`)
  }

  return {
    lines,
    blocking:
      w0.violations.length +
      w1.violations.length +
      w2.violations.length +
      (strict ? w3.orphans.length : 0),
    summary:
      `面=${FACE_LABEL[face] ?? face} W0/W1 核 ${w0.checked} 个登记出口` +
      ` / W2 核 ${w2.checked} 个 sidebar 文件、存量孤儿 ${w2.existing.length} 个只报数` +
      (strict
        ? ` / W3 普查 ${w3.checked} 文件、孤儿 ${w3.orphans.length}`
        : ' / W3 未算(跑 --strict 才普查)'),
  }
}

function main(argv) {
  const staged = argv.includes('--staged')
  const worktree = argv.includes('--worktree')
  const strict = argv.includes('--strict')
  const rootIdx = argv.indexOf('--root')
  const root = rootIdx >= 0 && argv[rootIdx + 1] ? resolve(argv[rootIdx + 1]) : DEFAULT_ROOT

  const { face, error } = selectFace({ staged, worktree, def: 'head' })
  if (error) {
    console.error(`❌ ${error}`)
    return 2
  }
  try {
    const { lines, blocking, summary } = runCheck({ root, face, strict })
    for (const l of lines) console.log(l)
    console.log(`${blocking === 0 ? '✅' : '❌'} ${summary}`)
    if (blocking > 0) {
      console.log(
        `   修复口径:把出口接到界面上(唯一实现见 apps/web/src/components/sidebar/),或按 AGENTS §7 三问判定后删除并登记 —— 不得用注释保留"看起来接了"。`,
      )
      return 1
    }
    return 0
  } catch (e) {
    if (e instanceof Undetermined) {
      console.error(`⚠️ 无法判定:${e.message}`)
      return 2
    }
    console.error(`❌ 脚本自身异常:${e instanceof Error ? e.stack : String(e)}`)
    return 2
  }
}

// ==================== 自检(临时独立仓,正反成对) ====================

const FIX = {
  bar: `export function ConversationBatchBar(){return null}\nexport default ConversationBatchBar\n`,
  hook: `export function useConversationSelection(ids){return {selectionMode:false,selectedIds:new Set(ids)}}\n`,
  host: `import { ConversationBatchBar } from '@/components/sidebar/conversation-batch-bar'\nimport { useConversationSelection } from '@/components/sidebar/use-conversation-selection'\nimport { NAV } from '@/components/sidebar/nav-data'\nexport function filterConversationsByKeyword(items,q){return items.filter(i=>i.title.includes(q))}\nexport function Sidebar(){const s=useConversationSelection(NAV);const f=filterConversationsByKeyword([], '');return ConversationBatchBar()}\n`,
  // Python 侧:只有 def 行 ⇒ 该符号**没有**装车点(W1 必须红);真装车点必须在别的文件。
  frameDef: `def build_form_request_frame(*, request_id, kind, session_id, message_id):\n    return None\n`,
  frameCall: `from app.services.mcp_server import build_form_request_frame\n\nframe = build_form_request_frame(request_id='frm_1', kind='x', session_id='s', message_id=None)\n`,
}

function writeFiles(root, map) {
  for (const [rel, text] of Object.entries(map)) {
    const abs = join(root, rel)
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, text, 'utf8')
  }
}

function git(root, args) {
  return gitRaw(args, root)
}

function makeFixtureRepo(label, files) {
  const dir = mkScratch(`v362-${label}`)
  git(dir, ['init', '-q'])
  git(dir, ['config', 'user.email', 'gate@example.invalid'])
  git(dir, ['config', 'user.name', 'gate'])
  writeFiles(dir, files)
  git(dir, ['add', '-A'])
  git(dir, ['commit', '-q', '-m', label])
  return dir
}

export async function runSelfTest() {
  const results = []
  const ok = (name, pass, detail = '') => results.push({ name, pass, detail })
  const dirs = []
  const good = () => ({
    [SIDEBAR_DIR + 'conversation-batch-bar.tsx']: FIX.bar,
    [SIDEBAR_DIR + 'use-conversation-selection.ts']: FIX.hook,
    [SIDEBAR_DIR + 'nav-data.ts']: `export const NAV=[]\n`,
    // 刻意留一份无人 import 的文件:它必须被 W2 认成"存量孤儿"而**不判红**,
    // 而在它新增的那一面上必须判红(A5)—— 两头都不对就说明棘轮没牙或造了恒红门。
    [SIDEBAR_DIR + 'Orphan.tsx']: `export const O=1\n`,
    'apps/web/src/components/sidebar-chat-history.tsx': FIX.host,
    // service 车道:定义文件只含 `def`(定义行**不得**被算成装车),调用点在另一个文件。
    // 这一对是"Python 支有没有牙"的最小结构 —— 少了它,登记服务侧出口会被自己的 def 喂绿。
    'apps/ai-service/app/services/mcp_server.py': FIX.frameDef,
    'apps/ai-service/app/routers/llm.py': FIX.frameCall,
  })
  const w1Reds = (r) => r.lines.filter((l) => l.includes('W1'))
  const w2Reds = (r) => r.lines.filter((l) => l.includes('W2'))
  const w0Reds = (r) => r.lines.filter((l) => l.includes('W0'))

  try {
    // A1 正例:登记出口全部被调用 ⇒ W0/W1 全绿;刻意孤儿的 W2 走存量不判红
    const r1 = makeFixtureRepo('wired-good', good())
    dirs.push(r1)
    const g1 = runCheck({ root: r1, face: 'head', strict: false })
    ok('A1 正例:W0/W1 各 0 违规', w0Reds(g1).length === 0 && w1Reds(g1).length === 0, g1.summary)
    ok(
      'A1b 正例:HEAD 面自身的孤儿按存量只报数,不判红(防恒红门)',
      w2Reds(g1).length === 0 && checkSidebarWiring(r1, 'head').existing.length === 1,
    )

    // A2 反面:把 host 里的 import 与用法**注释掉** ⇒ 同一条判据必须变红(票面要求的自证反面)
    const commented = good()
    commented['apps/web/src/components/sidebar-chat-history.tsx'] =
      `// import { ConversationBatchBar } from '@/components/sidebar/conversation-batch-bar'\n` +
      `// import { useConversationSelection } from '@/components/sidebar/use-conversation-selection'\n` +
      `export function filterConversationsByKeyword(items){return items}\nexport function Sidebar(){return null}\n`
    const r2 = makeFixtureRepo('commented-out', commented)
    dirs.push(r2)
    const red2 = w1Reds(runCheck({ root: r2, face: 'head', strict: false }))
    ok(
      'A2 反面:注释掉的调用点不算装车 ⇒ W1 判红并点名两个符号',
      red2.some((l) => l.includes('useConversationSelection')) &&
        red2.some((l) => l.includes('ConversationBatchBar')),
      red2.join(' | '),
    )
    ok(
      'A2b 反面:符号只剩自己的定义行 ⇒ 同样判红(定义行不得给孤儿发合格证)',
      red2.some((l) => l.includes('filterConversationsByKeyword')),
    )

    // A6 反面(service 车道):把 llm.py 那条生产者删掉,只留 mcp_server.py 的 `def` ⇒
    // W1 必须点名组帧出口。**这一条是本次登记的全部理由**:Python 的 def 行若被算成装车点,
    // 本门对"生产者被摘掉"就是恒绿的(镜像 T3c 另判"def 不是调用点"这条词法事实)。
    const noProducer = good()
    delete noProducer['apps/ai-service/app/routers/llm.py']
    const rsvc = makeFixtureRepo('no-producer', noProducer)
    dirs.push(rsvc)
    const redSvc = w1Reds(runCheck({ root: rsvc, face: 'head', strict: false }))
    ok(
      'A6 反面:摘掉服务侧生产者调用点 ⇒ W1 点名 build_form_request_frame(而不是被自己的 def 喂绿)',
      redSvc.some((l) => l.includes('build_form_request_frame')),
      redSvc.join(' | '),
    )
    ok(
      'A6b 正例:生产者在场时同一条判据必须为绿(证明 A6 红的是缺失,不是判据恒红)',
      w1Reds(g1).every((l) => !l.includes('build_form_request_frame')),
    )

    // A3 纯文本提及(串里)不算调用点 —— 靠"必须跟 ( 或 <"这条形状判据,不靠抹串
    const strOnly = good()
    strOnly['apps/web/src/components/sidebar-chat-history.tsx'] =
      `export function filterConversationsByKeyword(items){return items}\n` +
      `const note='本该调用 filterConversationsByKeyword( 与 ConversationBatchBar 与 useConversationSelection 的说明'\n` +
      `export const N=note\n`
    const r3 = makeFixtureRepo('string-only', strOnly)
    dirs.push(r3)
    ok(
      'A3 反面:字符串里的提及不构成装载 ⇒ W1 判红三条',
      w1Reds(runCheck({ root: r3, face: 'head', strict: false })).length === 3,
    )

    // A4 测试面的真调用也不算生产装载
    const testOnly = good()
    testOnly['apps/web/src/components/sidebar-chat-history.tsx'] =
      `export function filterConversationsByKeyword(items){return items}\n`
    testOnly['apps/web/src/components/__tests__/mount.test.tsx'] =
      `import { ConversationBatchBar } from '../sidebar/conversation-batch-bar'\n` +
      `import { useConversationSelection } from '../sidebar/use-conversation-selection'\n` +
      `ConversationBatchBar();useConversationSelection([]);filterConversationsByKeyword([])\n`
    const r4 = makeFixtureRepo('test-only', testOnly)
    dirs.push(r4)
    ok(
      'A4 反面:只有测试面调用 ⇒ W1 判红三条(测试不是生产面)',
      w1Reds(runCheck({ root: r4, face: 'head', strict: false })).length === 3,
    )

    // A5 W2 的牙:索引里新增一份无人 import 的 sidebar 文件 ⇒ 该面判红,而 HEAD 面不红
    const base = good()
    delete base[SIDEBAR_DIR + 'Orphan.tsx']
    const r5 = makeFixtureRepo('w2-teeth', base)
    dirs.push(r5)
    writeFiles(r5, { [SIDEBAR_DIR + 'Orphan.tsx']: `export const O=1\n` })
    git(r5, ['add', '-A'])
    const headG = runCheck({ root: r5, face: 'head', strict: false })
    const stagedG = runCheck({ root: r5, face: 'staged', strict: false })
    ok(
      'A5 W2 新增即红、存量不红:索引里新孤儿必点名,HEAD 同一路径不得判红',
      w2Reds(headG).length === 0 &&
        w2Reds(stagedG).length === 1 &&
        w2Reds(stagedG).some((l) => l.includes('Orphan.tsx')),
    )

    // A6 W2 空面判死:目录里没有源文件 ⇒ 不记绿
    const r6 = makeFixtureRepo('empty-sidebar', { 'apps/web/src/components/README.md': '# x\n' })
    dirs.push(r6)
    let und6 = null
    try {
      runCheck({ root: r6, face: 'head', strict: false })
    } catch (e) {
      und6 = e instanceof Undetermined ? e.message : String(e)
    }
    ok(
      'A6 枚举到 0 个 sidebar 文件 ⇒ 判"无法判定"而非记绿',
      Boolean(und6 && /枚举到 0/.test(und6)),
      und6 ?? '(未抛)',
    )

    // A7 遮罩与调用点判据的各半:放过注释是假绿,抹掉代码/抹掉说明符是假红与失明
    ok(
      'A7a 遮蔽不得抹掉真代码行与 import 说明符(说明符是 W2 的唯一证据通道)',
      maskNoise(`import { A } from './nav-data'\n`).includes('./nav-data'),
    )
    ok(
      'A7b 遮蔽必须抹掉行注释与块注释里的标识符',
      !maskNoise(
        `// ConversationBatchBar 应当被接上\n/* useConversationSelection 也接 */\n`,
      ).includes('ConversationBatchBar') &&
        !maskNoise(`// ConversationBatchBar\n/* useConversationSelection 也接 */\n`).includes(
          'useConversationSelection',
        ),
    )
    ok(
      'A7c 定义行不算调用点、真调用算(成对)',
      isDeclarationLine('export function ChatSearchBar({ show }: Props) {', 'ChatSearchBar') &&
        !isDeclarationLine('const n = ChatSearchBar({ show: true })', 'ChatSearchBar') &&
        isUseLine('const n = ChatSearchBar({ show: true })', 'ChatSearchBar') &&
        isUseLine('  <ConversationBatchBar selectedCount={0} />', 'ConversationBatchBar') &&
        // 多行属性写法:开标签落在**行尾**(真实侧栏就是这一型),后面没有字符
        isUseLine('          <ConversationBatchBar', 'ConversationBatchBar') &&
        !isUseLine('const t = "调 ConversationBatchBar 也行"', 'ConversationBatchBar'),
      !isUseLine("const t = '调 ConversationBatchBar 也行'", 'ConversationBatchBar'),
    )
    ok(
      'A7d 两档遮罩方向不得混用:W1 档必须抹掉串内容,W2 档必须留住说明符',
      !maskNoise(`const s='调 filterConversationsByKeyword( 也不算'\n`, {
        keepStrings: false,
      }).includes('filterConversationsByKeyword(') &&
        maskNoise(`import x from './conversation-batch-bar'\n`).includes(
          './conversation-batch-bar',
        ),
    )

    // A8 同一棵仓两面三答:索引脏而 HEAD 干净 ⇒ --staged 红、全量绿
    const r8 = makeFixtureRepo('two-face', good())
    dirs.push(r8)
    writeFiles(r8, {
      'apps/web/src/components/sidebar-chat-history.tsx': `// 本次提交把侧栏的装载整段删掉\nexport const REMOVED=true\n`,
    })
    git(r8, ['add', '-A'])
    const headSide = runCheck({ root: r8, face: 'head', strict: false })
    const stagedSide = runCheck({ root: r8, face: 'staged', strict: false })
    ok(
      'A8 两面三答:HEAD 绿(W1 0) / 索引红(W1 有)',
      w1Reds(headSide).length === 0 && w1Reds(stagedSide).length > 0,
    )

    // A9 --staged 与 --worktree 同给 ⇒ selectFace 直接判死(不静默选一个面)
    const { error: e9 } = selectFace({ staged: true, worktree: true, def: 'head' })
    ok('A9 两面旗同给 ⇒ 报错而非选一个面', Boolean(e9))

    // A10 W0 的牙:实现文件被删 ⇒ 台账必须点名(此时 W1 仍可因残留引用而绿)
    const gone = good()
    delete gone[SIDEBAR_DIR + 'conversation-batch-bar.tsx']
    const r10 = makeFixtureRepo('impl-deleted', gone)
    dirs.push(r10)
    const g10 = runCheck({ root: r10, face: 'head', strict: false })
    ok(
      'A10 W0 点名"实现已不在面上"的登记出口,且 W1 单独看不见这一格',
      w0Reds(g10).length === 1 &&
        w0Reds(g10).some((l) => l.includes('ConversationBatchBar')) &&
        w1Reds(g10).length === 0,
    )

    // A11 真仓现读:只验"跑通且给出结构化结论",**不钉红绿** —— 本票的实现文件在
    // 落地前只存在于索引面,把某一面的红绿写进自检就是替人做出"已收口"的判断。
    const real = runCheck({ root: DEFAULT_ROOT, face: 'head', strict: false })
    ok(
      'A11 真仓 HEAD 面:结论可解析(含三面计数),不因判据异常而崩',
      /W0\/W1 核 \d+ 个登记出口/.test(real.summary) &&
        /W2 核 \d+ 个 sidebar 文件/.test(real.summary),
      real.summary,
    )
  } finally {
    for (const d of dirs) {
      try {
        rmScratch(d)
      } catch {
        /* 夹具清理失败不影响取证结论 */
      }
    }
  }

  const passed = results.filter((r) => r.pass).length
  for (const r of results)
    console.log(`${r.pass ? '✅' : '❌'} ${r.name}${r.detail ? `  [${r.detail}]` : ''}`)
  console.log(`--self-test: ${passed}/${results.length} 通过`)
  return passed === results.length ? 0 : 1
}

async function entry() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) return runSelfTest()
  if (process.env[SKIP_ENV_NAME] === '1') {
    console.log(`⏭️ 已按 ${SKIP_ENV_NAME}=1 跳过(V3 #62 装载对账)`)
    return 0
  }
  return main(argv)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  entry()
    .then((code) => {
      if (code !== 0) process.exit(code)
    })
    .catch((e) => {
      console.error(`❌ 入口异常:${e instanceof Error ? e.stack : String(e)}`)
      process.exit(2)
    })
}

export const __test__ = {
  MOUNT_EXITS,
  SIDEBAR_DIR,
  maskNoise,
  isTestSurface,
  isDeclarationLine,
  isUseLine,
  checkRegistryFreshness,
  checkMountExits,
  checkSidebarWiring,
  auditOrphanFiles,
  runCheck,
  runSelfTest,
  SKIP_ENV_NAME,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
