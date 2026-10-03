// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 文件写盘安全对账(实现票 o75 / 机制票 A8-4 + A8-5 的守门面)。
//
// 钉的是同一条线上的三格:"改了但不是我以为的那份"。可达性已实测(见下),所以这不是投机守卫:
//   ① 裸 writeFileSync 非原子 —— 2.5s 并发读写探针里 5,095 次读有 4,646 次读到"既非旧版也非新版"
//      的内容(含 len=0 全空读),即半截文件在用户侧是**常态**不是边角;
//   ② 读后写(stale)覆盖 —— 两进程交错"读 A → 写 B / 写 C"实测双方都退出 0、C 被静默抹掉;
//      仓内并行子代理(parallel_fork 共享工作树)与用户保存落在同一个窗口里,形态同 AGENTS §12;
//   ③ rename 到"已被别的句柄打开"的目标在 Windows 实测回 **EPERM**(不是 EEXIST),
//      所以原子替换必须带重试,且失败路径不得留 tmp —— 本门判"接线在位",行为有牙由
//      `apps/cli/tests/file-edit-atomic-write.test.ts` 证明(静态门只能判形态,判不了语义)。
//
// 三条判据:
//   R1 工作区写面(= import 了 checkPathWritePermission 的工具文件)不得有裸 writeFileSync /
//      appendFileSync。**棘轮锚点 = 该文件 HEAD 自身违规数**(与守门 77/83/98 同取向):
//      只拦"这次改动把裸写加回来",不把别人欠的债钉红 —— 与改动无关的恒红门只会逼人
//      --no-verify 并连带废掉全部守门(§12e 同型)。
//   R2 唯一出口 `apps/cli/src/util/atomic-write.ts` 在位且导出齐备(被摘线即红)。
//   R3 落盘方 `apps/cli/src/tools/file-edit.ts` 必须真用它(防"造好没装车",守门 64/97 同型):
//      已入库的接线不得回退;import 了却不调用(半个接线)同判红。
//
// **新维度 F(故障注入面,起步 warn —— 刻意不接 blocking)**:R1/R2/R3 全是静态形态判据,它们能证明
// "接线在位",证明不了**失败时会不会留半个文件**。而失败路径恰是这台机器上最易坏的一格:
// `scripts/lib/atomic-write.mjs:16-18` 记着实测 rename 撞"目标已被别的句柄打开"在 Windows 回
// **EPERM**(不是 EEXIST),同族 EBUSY/EACCES/ENOENT。那份实现的失败语义("重试用尽 ⇒ 清自己的
// 临时文件并抛,磁盘上仍是完整旧内容")目前**只是一段注释,不是一次证明** —— 而本仓反复记过的
// 失效型正是"把没做成写成做过了"。
// ⇒ G-815961 立 `scripts/lib/fs-fault-injection.mjs`(判据单份的所在地),把它挂进本门 `--self-test`
//   的 F 组(正反成对),并在默认档**只报数**:F 维度不入 `total`、不影响 rc,取不到 loudly 报"未判定"。
//   **为什么不接 blocking**:故障注入面是**给测试用的生产面**,它"在位"与否与"这枚提交是否安全"
//   无关;接成 blocking 立刻产生恒红门(端内 `apps/cli/src` 目前一个注入点都没有),而恒红门逼人
//   `--no-verify`、连带废掉全部守门 —— 与 R1 棘轮同一条理由,故新维度一律 warn 起步。
//   F 维度的**牙在自检臂**:F20(双条件兜底被拆 ⇒ 注入器在非 test 环境也生效 ⇒ 生产面可被打穿)与
//   F21(rename 注入一次 EPERM ⇒ 目标保持旧内容、临时文件被清)都在 `--self-test` 里,红即 rc=1。
//
// 口径同守门 70/77/83/98/101/103:全量判 **HEAD blob**、--staged 判**索引 blob**、
// --worktree 仅人工逃生舱;两个面旗同给 ⇒ exit 2;取不到 ⇒ exit 2「无法判定」,不冒红也不记绿。
// **例外(R2/R3 的固定锚点文件)**:按 HEAD→索引→工作树**降级**取,退到下一档会在输出里大声点名 ——
// 因为"同一枚提交里既新建出口又接上调用方"是正确姿势,只读 HEAD 会让立项那枚提交被自己判红
// (守门 89 的文档面、守门 103 的策略表面同为这个取舍,理由一样)。
//
// 紧急跳过 HUSKY_SKIP_FILE_WRITE_SAFETY=1(接线 id 由主会话统一登记,本票不自取编号)。

import path from 'node:path'
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
// ↓ F 维度(G-815961)的判据**只从这一份取** —— 门里不得另抄一份注入器实现(§22c)。
// 原子写出口也只从它取:自检臂要真跑一次失败分支,拿一个注释里写着"失败会清临时文件"的
// 承诺当证据,就是本仓最会骗自己的那种写法。
import {
  FAULT_ERROR_FIELDS,
  FAULT_OPERATIONS,
  FAULTS_ALLOW_ENV,
  FAULTS_ENV,
  FAULTS_ENV_GUARD,
  createFaultInjector,
  createFaultInjectorFromEnv,
  isFaultInjectionEnabled,
  parseFaultRules,
  ruleMatches,
} from './lib/fs-fault-injection.mjs'
import { atomicWriteFileSync } from './lib/atomic-write.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SKIP_ENV = 'HUSKY_SKIP_FILE_WRITE_SAFETY'

/** 唯一出口(运行时 helper 必须在端内:apps/cli/tsconfig 写死 rootDir=src,且发布包不含 scripts/) */
export const EXIT_MODULE = 'apps/cli/src/util/atomic-write.ts'
/** 已收口的落盘方(本票范围内) */
export const TOOL_MODULE = 'apps/cli/src/tools/file-edit.ts'
/** 扫描面:模型可调用的写盘面 */
const SCAN_DIR = 'apps/cli/src/tools'
const SCAN_EXTS = ['.ts']

/** 名单:每条都必须在 --self-test 里有"输入取自名单本身"的正向用例(守门 120 的要求) */
export const BARE_WRITE_APIS = ['writeFileSync', 'appendFileSync']
/** 名单:"有写用户工作区资格"的机器证据 —— 端内统一的路径权限闸 */
export const WORKSPACE_GATE_SYMBOL = 'checkPathWritePermission'
/** 名单:出口必须导出的三件(捕获 / 提交 / 冲突类型),缺任一即"半个出口" */
export const REQUIRED_EXIT_EXPORTS = ['captureWriteBaseline', 'commitAtomicWrite', 'WriteConflictError']

/**
 * F 维度(G-815961):故障注入面本体。与 R1/R2/R3 的锚点不同,它**不参与 default 档的 findings**
 * (见头注「为什么不接 blocking」),只在默认档报一行数、并在 `--self-test` 里承重。
 */
export const FAULT_INJECTION_MODULE = 'scripts/lib/fs-fault-injection.mjs'

const SELF_EXEMPT_PREFIX = 'scripts/check-file-write-safety'

/** 由出口文件名派生 import 正则 —— 判据与"规定写法"必须同一构造,否则门看不见自己让人怎么写的那一型 */
function importRegexOf(modulePath) {
  const base = path.basename(modulePath, path.extname(modulePath))
  return new RegExp(`from\\s*['"][^'"]*\\/${base}\\.(?:js|ts)['"]`)
}
export const EXIT_IMPORT_RE = importRegexOf(EXIT_MODULE)

/**
 * 遮注释、**保留字符串**:模块说明符本身就是字符串,连字符串一起抹会让 import 判据永远看不见
 * 自己要找的那一行(守门 118 记过的方向性教训)。
 */
export function maskComments(src) {
  const out = []
  let inBlock = false
  for (const rawLine of String(src).split(/\r?\n/)) {
    let line = ''
    let i = 0
    while (i < rawLine.length) {
      if (inBlock) {
        const end = rawLine.indexOf('*/', i)
        if (end < 0) i = rawLine.length
        else {
          inBlock = false
          i = end + 2
        }
        continue
      }
      if (rawLine.startsWith('/*', i)) {
        inBlock = true
        i += 2
        continue
      }
      if (rawLine.startsWith('//', i)) break
      line += rawLine[i]
      i += 1
    }
    out.push(line)
  }
  return out
}

/** 遮注释 + 遮单引号字符串内容:判"真的调用了某个写盘 API"要用这一档,否则门会在自己的说明里红。 */
export function maskCommentsAndStrings(src) {
  return maskComments(src).map((line) => {
    let out = ''
    for (let k = 0; k < line.length; k++) {
      const c = line[k]
      if (c === "'" || c === '"') {
        const quote = c
        let j = k + 1
        while (j < line.length && line[j] !== quote) {
          if (line[j] === '\\') j++
          j++
        }
        out += quote + ' '.repeat(Math.max(0, j - k - 1)) + (j < line.length ? quote : '')
        k = j
        continue
      }
      out += c
    }
    return out
  })
}

/** 单个文件的结构化事实(纯函数,构造面即可证明每一条) */
export function analyzeFile(rel, text) {
  const facts = {
    rel,
    present: typeof text === 'string',
    bareWrites: [],
    usesWorkspaceWriteGate: false,
    importsAtomicExit: false,
    callsCommitAtomic: 0,
    callsCaptureBaseline: 0,
    exports: {},
  }
  if (!facts.present) return facts
  if (rel.replace(/\\/g, '/').startsWith(SELF_EXEMPT_PREFIX)) return facts

  const codeLines = maskComments(text)
  const callLines = maskCommentsAndStrings(text)
  const isExitModule = rel.replace(/\\/g, '/') === EXIT_MODULE
  const code = codeLines.join('\n')

  if (!isExitModule) {
    callLines.forEach((line, idx) => {
      for (const api of BARE_WRITE_APIS) {
        if (line.includes(`${api}(`)) {
          facts.bareWrites.push({ line: idx + 1, api, text: line.trim().slice(0, 120) })
        }
      }
    })
    facts.usesWorkspaceWriteGate = code.includes(WORKSPACE_GATE_SYMBOL)
  }

  facts.importsAtomicExit = EXIT_IMPORT_RE.test(code)
  facts.callsCaptureBaseline = (code.match(/\bcaptureWriteBaseline\s*\(/g) || []).length
  facts.callsCommitAtomic = (code.match(/\bcommitAtomicWrite\s*\(/g) || []).length
  if (isExitModule) {
    for (const name of REQUIRED_EXIT_EXPORTS) {
      const re = new RegExp(`export\\s+(?:async\\s+)?(?:function|class|const|interface|type)\\s+${name}\\b`)
      facts.exports[name] = re.test(text)
    }
  }
  return facts
}

/**
 * R1:工作区写面的裸写盘。allowed = 该文件 **HEAD 自身**的违规数(棘轮锚点)。
 * 出口模块豁免:它写的是同目录 tmp,不是目标文件 —— 判它等于让门咬自己。
 */
export function evaluateBareWrites(files, headCounts) {
  const findings = []
  const ratcheted = []
  for (const f of files) {
    if (!f.present || f.rel === EXIT_MODULE) continue
    if (!f.usesWorkspaceWriteGate) continue
    if (f.bareWrites.length === 0) continue
    const allowed = Number.isInteger(headCounts?.[f.rel]) ? headCounts[f.rel] : 0
    if (f.bareWrites.length > allowed) findings.push({ rel: f.rel, hits: f.bareWrites, allowed })
    else ratcheted.push({ rel: f.rel, n: f.bareWrites.length, allowed })
  }
  return { findings, ratcheted }
}

/** R2 + R3:出口在位 / 落盘方真用。headWiredAndLanded = 出口与接线**是否已入库**的开关。 */
export function evaluateWiring({
  exitFacts,
  toolFacts,
  headExitPresent,
  headToolWired,
  exitStagedDeletion = false,
  toolStagedDeletion = false,
}) {
  const findings = []
  const notices = []
  if (exitStagedDeletion) {
    findings.push({
      rule: 'R2',
      msg: `唯一出口 ${EXIT_MODULE} 被这次提交删掉(HEAD 里有、索引里没有)—— 摘线等价于把机制退回裸写`,
      hits: [],
    })
  }
  if (!exitFacts || !exitFacts.present) {
    if (headExitPresent) {
      if (!exitStagedDeletion) {
        findings.push({ rule: 'R2', msg: `唯一出口 ${EXIT_MODULE} 在判定面上取不到 —— 被摘线`, hits: [] })
      }
    } else {
      notices.push('R2 未收口:出口模块尚未入库(本门立项那枚提交之前),只报数不判红')
    }
  } else {
    const missing = REQUIRED_EXIT_EXPORTS.filter((n) => !exitFacts.exports[n])
    if (missing.length) {
      findings.push({
        rule: 'R2',
        msg: `唯一出口 ${EXIT_MODULE} 缺导出:${missing.join(', ')}(半个出口 = 调用方拿不到冲突类型)`,
        hits: [],
      })
    }
  }

  if (toolFacts && toolFacts.present) {
    const wired = toolFacts.importsAtomicExit && toolFacts.callsCommitAtomic > 0
    if (!wired) {
      if (headToolWired) {
        findings.push({
          rule: 'R3',
          msg: `${TOOL_MODULE} 的原子写接线被回退(import=${toolFacts.importsAtomicExit} commitAtomicWrite 调用数=${toolFacts.callsCommitAtomic})`,
          hits: [],
        })
      } else if (toolFacts.importsAtomicExit) {
        findings.push({
          rule: 'R3',
          msg: `${TOOL_MODULE} import 了出口却一次都没调用(半个接线:造好没装车)`,
          hits: [],
        })
      } else {
        notices.push(`R3 未收口:${TOOL_MODULE} 仍走裸写盘(出口尚未接线),只报数不判红`)
      }
    } else if (toolFacts.callsCaptureBaseline === 0) {
      findings.push({
        rule: 'R3',
        msg: `${TOOL_MODULE} 只调 commitAtomicWrite 却没有 captureWriteBaseline —— 读后写校验被绕开`,
        hits: [],
      })
    }
  } else if (headToolWired) {
    findings.push({
      rule: 'R3',
      msg: toolStagedDeletion
        ? `${TOOL_MODULE} 被这次提交删掉,而 HEAD 上它已接线 —— 落盘方消失等价于退回裸写`
        : `${TOOL_MODULE} 在判定面上取不到,而 HEAD 上已接线 —— 整文件被回退或摘线`,
      hits: [],
    })
  }
  return { findings, notices }
}

/** 反假绿:扫描面枚举到 0 个文件 = 判据没跑起来,不是"仓库干净"。 */
export function assertNonEmptyScan(files, face) {
  if (!Array.isArray(files) || files.length === 0) {
    throw new Undetermined(`${FACE_LABEL[face] ?? face} 面在 ${SCAN_DIR} 内枚举到 0 个文件 ⇒ 无法判定`)
  }
  return files.length
}

function inScope(rel) {
  const norm = rel.replace(/\\/g, '/')
  if (!norm.startsWith(`${SCAN_DIR}/`)) return false
  if (!SCAN_EXTS.includes(path.extname(norm))) return false
  if (norm.includes('/node_modules/')) return false
  return true
}

function listToolFiles(root, face) {
  const args =
    face === 'head'
      ? ['ls-tree', '-r', '--name-only', 'HEAD', '--', SCAN_DIR]
      : face === 'staged'
        ? ['ls-files', '--cached', '--', SCAN_DIR]
        : ['ls-files', '--', SCAN_DIR]
  let out
  try {
    out = gitRaw(args, root)
  } catch (e) {
    if (e instanceof Undetermined && e.status === 128 && face !== 'head') return []
    throw e
  }
  return String(out)
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .filter(inScope)
}

function readFiles(root, face, rels) {
  const m = new Map()
  if (face === 'worktree') {
    for (const rel of rels) m.set(rel, readWorktreeFile(root, rel))
    return m
  }
  const prefix = face === 'head' ? 'HEAD:' : ':'
  const revs = rels.map((r) => `${prefix}${r}`)
  const batch = catBatch(root, revs)
  rels.forEach((rel, i) => m.set(rel, batch.get(revs[i]) ?? null))
  return m
}

/**
 * 固定锚点文件的取材:主面取不到时允许降级,但**降级只服务于"本枚提交新建"**。
 * 「HEAD 里有、索引里没有」不是降级理由 —— 那是暂存删除,必须让它以"取不到"的形态进入判据,
 * 否则 R2/R3 会被自己的兜底逻辑遮掉(写门时想到的第一个版本就是这样,漏的是摘线方向)。
 * 退档一律在输出里点名。
 */
function readAnchorWithFallback(root, face, rel) {
  const onHead = readFiles(root, 'head', [rel]).get(rel) ?? null
  const onIndex = readFiles(root, 'staged', [rel]).get(rel) ?? null
  const onWorktree = readWorktreeFile(root, rel)
  let text = null
  let usedFace = face
  let stagedDeletion = false
  if (face === 'staged') {
    stagedDeletion = onIndex === null && onHead !== null
    text = stagedDeletion ? null : (onIndex ?? onWorktree)
    usedFace = stagedDeletion ? '(索引已删)' : onIndex !== null ? 'staged' : 'worktree'
  } else if (face === 'head') {
    text = onHead ?? onIndex ?? onWorktree
    usedFace = onHead !== null ? 'head' : onIndex !== null ? 'staged' : 'worktree'
  } else {
    text = onWorktree
    usedFace = 'worktree'
  }
  return { text, usedFace, downgraded: usedFace !== face, stagedDeletion }
}

export function runAudit(root, face) {
  const files = listToolFiles(root, face)
  assertNonEmptyScan(files, face)
  const contents = readFiles(root, face, files)
  const facts = files.map((rel) => analyzeFile(rel, contents.get(rel) ?? null))

  // R1 的棘轮锚点:同一批文件在 HEAD 上的裸写计数
  const headForAnchor = face === 'head' ? facts : null
  let headCounts
  if (headForAnchor) {
    headCounts = {}
    for (const f of headForAnchor) if (f.present) headCounts[f.rel] = f.bareWrites.length
  } else {
    const headRels = facts.filter((f) => f.present).map((f) => f.rel)
    const headContents = readFiles(root, 'head', headRels)
    headCounts = {}
    for (const rel of headRels) {
      headCounts[rel] = analyzeFile(rel, headContents.get(rel) ?? null).bareWrites.length
    }
  }

  const exitAnchor = readAnchorWithFallback(root, face, EXIT_MODULE)
  const toolAnchor = readAnchorWithFallback(root, face, TOOL_MODULE)
  const headExit = face === 'head' ? exitAnchor : readAnchorWithFallback(root, 'head', EXIT_MODULE)
  const headTool = face === 'head' ? toolAnchor : readAnchorWithFallback(root, 'head', TOOL_MODULE)

  const exitFacts = analyzeFile(EXIT_MODULE, exitAnchor.text)
  const toolFacts = analyzeFile(TOOL_MODULE, toolAnchor.text)
  const headToolFacts = analyzeFile(TOOL_MODULE, headTool.text)

  const bare = evaluateBareWrites([...facts, exitFacts], headCounts)
  const wiring = evaluateWiring({
    exitFacts,
    toolFacts,
    headExitPresent: Boolean(headExit.text),
    exitStagedDeletion: Boolean(exitAnchor.stagedDeletion),
    toolStagedDeletion: Boolean(toolAnchor.stagedDeletion),
    headToolWired:
      Boolean(headTool.text) && headToolFacts.importsAtomicExit && headToolFacts.callsCommitAtomic > 0,
  })

  const undetermined = facts.filter((f) => !f.present).map((f) => f.rel)
  return {
    face,
    scanned: files.length,
    bare,
    wiring,
    undetermined,
    // F 维度独立成字段:**不进 findings、不进 total**(warn 起步,理由见头注)
    faultInjection: collectFaultInjectionFace(root, face),
    anchorNotes: [
      { rel: EXIT_MODULE, ...pickFace(exitAnchor) },
      { rel: TOOL_MODULE, ...pickFace(toolAnchor) },
    ],
  }
}

function pickFace(a) {
  return { usedFace: a.usedFace, downgraded: a.downgraded }
}

/**
 * F 维度的三态判定,**纯函数**(判据单份的所在地就在这一层)。
 *
 * 为什么要单独抽出来:取材那层 `readAnchorWithFallback` **HEAD→索引→工作树逐级降级**,
 * 所以"面取不到"这一档在真仓上几乎不可达(工作树总有文件)。第一版把 F23b 写成
 * "传一个不存在的仓根进去" —— 提交后实测该项转红:降级链在工作树那一档照样把文件取到了,
 * `present:true`。**那不是判据坏了,是我的用例取不到它要的那一档。**
 * ⇒ 三态判定必须是能单独构造的纯函数,取材的可达性归取材,判定归判定(§22c 同一条纪律)。
 *
 * @param {string|null} text 取材结果(null = 取不到)
 * @param {{usedFace?:string, downgraded?:boolean, reason?:string, probe?:()=>object}} [meta]
 * @returns {{present:boolean, undetermined:boolean}}
 */
export function classifyFaultInjectionFace(text, meta = {}) {
  if (text === null || text === undefined) {
    return { present: false, undetermined: true }
  }
  try {
    meta.probe?.()
  } catch (e) {
    return { present: true, undetermined: true, reason: e?.message ?? String(e) }
  }
  return { present: true, undetermined: false }
}

/**
 * F 维度(故障注入面)在判定面上的**取材 + 报数**,不产 findings。
 *
 * 三态与 R1/R2/R3 同纪律且**不并桶**(头注「新维度 F」):
 *   - 面取不到 / 判据自身抛 ⇒ `undetermined`,默认档大声报"无法判定",**绝不报成通过**;
 *   - 取到 ⇒ 报一行"闭集 N 个 / 规则解析可用",但**不改 rc**。
 * 之所以不并进 `total`:它是 warn 起步的新维度(理由见头注),并进去就等于接成 blocking。
 */
export function collectFaultInjectionFace(root, face) {
  const anchor = readAnchorWithFallback(root, face, FAULT_INJECTION_MODULE)
  const usedFace = anchor.usedFace
  // 判据的"能不能用"用**构造面**证明(闭集非空 + 坏规则必抛),不读被审面的任何文本 ——
  // 这个门要判的是"注入面在位且有牙",不是"注入面里写了什么字"。
  const probe = () => {
    createFaultInjector([{ id: 'probe', code: 'EPERM' }])
    let throwsOnBadRule = false
    try {
      createFaultInjector([{ id: 'probe', code: 'EPERM', operations: ['notAnOperation'] }])
    } catch {
      throwsOnBadRule = true
    }
    return throwsOnBadRule
  }
  const state = classifyFaultInjectionFace(anchor.text, { usedFace, downgraded: anchor.downgraded, probe })
  if (!state.present) {
    return { rel: FAULT_INJECTION_MODULE, usedFace, undetermined: true, rules: 0 }
  }
  if (state.undetermined) {
    return {
      rel: FAULT_INJECTION_MODULE,
      present: true,
      usedFace,
      downgraded: anchor.downgraded,
      undetermined: true,
      reason: state.reason,
      rules: 0,
    }
  }
  return {
    rel: FAULT_INJECTION_MODULE,
    present: true,
    usedFace,
    downgraded: anchor.downgraded,
    undetermined: false,
    ruleCount: createFaultInjector([{ id: 'probe', code: 'EPERM' }]).rules.length,
    throwsOnBadRule: probe(),
    operations: FAULT_OPERATIONS.length,
  }
}

function report(res) {
  const total = res.bare.findings.length + res.wiring.findings.length
  console.log(
    `文件写盘安全对账 · 判定面=${FACE_LABEL[res.face]} · 扫描 ${res.scanned} 个工具文件 · 越线 ${res.bare.findings.length} 个 · 结构红 ${res.wiring.findings.length} 项 · 棘轮内存量 ${res.bare.ratcheted.reduce((a, b) => a + b.n, 0)} 处`,
  )
  for (const a of res.anchorNotes) {
    if (a.downgraded) {
      console.log(`   ⚠️ 锚点 ${a.rel} 从判定面降级取用(实取 ${a.usedFace}):立项期"新建 + 接线"同枚提交才允许`)
    }
  }
  for (const n of res.wiring.notices) console.log(`   · ${n}`)
  // F 维度只报数(warn 起步):**不进 total、不改 rc**。取不到 ⇒ 大声报"无法判定",不报成通过。
  const f = res.faultInjection
  if (f) {
    if (f.undetermined) {
      console.error(
        `⚠️  F 维度无法判定(不计通过,也不判红 —— 该维度为 warn 级):${f.rel} ${f.present ? `判据自身抛错 ${f.reason ?? ''}` : `在判定面${f.usedFace}取不到`}`,
      )
    } else {
      console.log(
        `   · F 故障注入面在位(${f.rel} @${f.usedFace}):规则闭集 ${f.operations} 个 / 探针规则 ${f.ruleCount} 条 / 坏规则解析期抛=${f.throwsOnBadRule} · warn 级,不影响本门 rc`,
      )
    }
  }
  for (const r of res.bare.ratcheted) {
    console.log(`   · 存量(HEAD 自身计数内,只报数不判红):${r.rel} ${r.n} 处(额度 ${r.allowed})`)
  }
  for (const f of res.bare.findings) {
    console.error(`❌ R1 ${f.rel} 有 ${f.hits.length} 处工作区裸写盘(HEAD 额度 ${f.allowed}):`)
    for (const h of f.hits.slice(0, 8)) console.error(`   ${f.rel}:${h.line}  ${h.text}`)
    if (f.hits.length > 8) console.error(`   …另 ${f.hits.length - 8} 处`)
  }
  for (const f of res.wiring.findings) console.error(`❌ ${f.rule} ${f.msg}`)
  if (res.undetermined.length) {
    console.error(`⚠️  ${res.undetermined.length} 个文件在判定面取不到内容(不计通过):`)
    for (const r of res.undetermined.slice(0, 10)) console.error(`   ${r}`)
  }
  return total
}

function main(argv) {
  if (process.env[SKIP_ENV] === '1') {
    console.log(`⏭️  ${SKIP_ENV}=1 ⇒ 跳过文件写盘安全对账(应急,须在提交说明写明原因)`)
    return 0
  }
  const picked = selectFace({ staged: argv.includes('--staged'), worktree: argv.includes('--worktree') })
  if (picked.error) {
    console.error(`❌ ${picked.error}`)
    return 2
  }
  try {
    assertRepoRoot(ROOT, '文件写盘安全对账')
    const res = runAudit(ROOT, picked.face)
    if (argv.includes('--json')) {
      console.log(JSON.stringify(res, null, 2))
      return res.bare.findings.length + res.wiring.findings.length > 0 ? 1 : res.undetermined.length > 0 ? 2 : 0
    }
    const bad = report(res)
    if (bad) {
      console.error(`   出路:工作区写盘一律经 ${EXIT_MODULE} 的 captureWriteBaseline → commitAtomicWrite,` + '不得再裸 writeFileSync。')
      return 1
    }
    if (res.undetermined.length) {
      console.error('❌ 有文件取不到内容 ⇒ 无法判定(既不冒红也不记绿)')
      return 2
    }
    console.log('✅ 文件写盘安全:出口在位、接线未回退、裸写盘未增加')
    return 0
  } catch (e) {
    if (e instanceof Undetermined) {
      console.error(`❓ 无法判定:${e.message}`)
      return 2
    }
    console.error(`❌ 脚本自身异常:${e?.stack ?? e}`)
    return 2
  }
}

/** --self-test 全部走**构造面**(analyzeFile / evaluate* 的纯函数输入),不读仓库瞬时状态。 */
const G = (over = {}) => ({
  rel: TOOL_MODULE,
  present: true,
  bareWrites: [],
  usesWorkspaceWriteGate: true,
  importsAtomicExit: true,
  callsCommitAtomic: 2,
  callsCaptureBaseline: 2,
  exports: {},
  ...over,
})

function selfTest() {
  let pass = 0
  let fail = 0
  const check = (name, ok, extra = '') => {
    if (ok) pass += 1
    else {
      fail += 1
      console.error(`❌ ${name}${extra ? `:${extra}` : ''}`)
    }
  }

  // ---- R1:名单里每个 API 都要有正向命中(守门 120 的要求)----
  const srcW = `import { checkPathWritePermission } from './index.js'\nfs.writeFileSync(abs, content, 'utf-8');\n`
  const srcA = `import { checkPathWritePermission } from './index.js'\nfs.appendFileSync(abs, line);\n`
  const fW = analyzeFile(TOOL_MODULE, srcW)
  const fA = analyzeFile(TOOL_MODULE, srcA)
  check('B1 writeFileSync 命中名单(正向)', fW.bareWrites.length === 1 && fW.bareWrites[0].api === 'writeFileSync')
  check('B5 appendFileSync 命中名单(正向)', fA.bareWrites.length === 1 && fA.bareWrites[0].api === 'appendFileSync')
  check('B1b 该文件被认作工作区写面', fW.usesWorkspaceWriteGate === true)
  check(
    'B6 注释里的 writeFileSync 不判(遮注释方向)',
    analyzeFile(TOOL_MODULE, `// fs.writeFileSync(abs, x)\n${WORKSPACE_GATE_SYMBOL}\n`).bareWrites.length === 0,
  )
  check(
    'B7 字符串里的 writeFileSync 不判(遮串方向)',
    analyzeFile(TOOL_MODULE, `const msg = 'call fs.writeFileSync( here')\n${WORKSPACE_GATE_SYMBOL}\n`).bareWrites.length ===
      0,
  )
  check(
    'B8 没有工作区写闸的文件不参与 R1(判据要的是"有资格写用户文件"这个前提)',
    evaluateBareWrites(
      [analyzeFile('apps/cli/src/tools/todo-write.ts', `const p = cfgPath\nfs.writeFileSync(p, body, 'utf-8');\n`)],
      {},
    ).findings.length === 0,
  )
  check(
    'B9 出口模块自身豁免(门不得咬自己写的 tmp)',
    evaluateBareWrites([analyzeFile(EXIT_MODULE, srcW)], {}).findings.length === 0,
  )
  const ratchet = evaluateBareWrites([G({ bareWrites: [{ line: 1, api: 'writeFileSync' }] })], { [TOOL_MODULE]: 1 })
  check('B2 HEAD 自身存量 ⇒ 不红(反恒红)', ratchet.findings.length === 0)
  const added = evaluateBareWrites([G({ bareWrites: [{ line: 1, api: 'writeFileSync' }, { line: 2, api: 'appendFileSync' }] })], {
    [TOOL_MODULE]: 1,
  })
  check('B3 超出 HEAD 自身计数 ⇒ 红(棘轮有牙)', added.findings.length === 1)
  const reintroduced = evaluateBareWrites([G({ bareWrites: [{ line: 9, api: 'writeFileSync' }] })], { [TOOL_MODULE]: 0 })
  check('B4 归零后被加回来 ⇒ 红(变异对照:把缺陷改回去必红)', reintroduced.findings.length === 1)

  // ---- R2:出口在位性 ----
  const exitOkText = [
    'export function captureWriteBaseline(absPath: string) { return { absPath, content: null } }',
    'export function commitAtomicWrite(b, c: string) { void b; void c }',
    'export class WriteConflictError extends Error {}',
  ].join('\n')
  const exitFacts = analyzeFile(EXIT_MODULE, exitOkText)
  check('E1 三个导出齐备(名单正向,逐名)', REQUIRED_EXIT_EXPORTS.every((n) => exitFacts.exports[n] === true))
  check(
    'E2 缺 WriteConflictError ⇒ 红(半个出口)',
    evaluateWiring({
      exitFacts: analyzeFile(EXIT_MODULE, exitOkText.replace('export class WriteConflictError extends Error {}', '')),
      toolFacts: G(),
      headExitPresent: true,
      headToolWired: true,
    }).findings.some((f) => f.rule === 'R2'),
  )
  check(
    'E3 出口整体缺失 + HEAD 已入库 ⇒ 红(被摘线)',
    evaluateWiring({ exitFacts: null, toolFacts: G(), headExitPresent: true, headToolWired: true }).findings.some(
      (f) => f.rule === 'R2',
    ),
  )
  const birth = evaluateWiring({ exitFacts: null, toolFacts: G(), headExitPresent: false, headToolWired: false })
  check('E4 立项当期(HEAD 也没有)⇒ 只报数不判红(反恒红成对)', birth.findings.length === 0 && birth.notices.length > 0)
  check(
    'E5 出口被本次提交暂存删除(HEAD 有 / 索引无)⇒ 红,且不被降级兜底遮掉',
    evaluateWiring({
      exitFacts: analyzeFile(EXIT_MODULE, null),
      toolFacts: G(),
      headExitPresent: true,
      headToolWired: true,
      exitStagedDeletion: true,
    }).findings.filter((f) => f.rule === 'R2').length === 1,
  )
  check(
    'T6 落盘方被暂存删除 ⇒ R3 红(与 E5 同族,方向是"人删了已入库的文件")',
    evaluateWiring({
      exitFacts,
      toolFacts: analyzeFile(TOOL_MODULE, null),
      headExitPresent: true,
      headToolWired: true,
      toolStagedDeletion: true,
    }).findings.some((f) => f.rule === 'R3'),
  )

  // ---- R3:接线不回退 / 半个接线 ----
  const srcImportOnly = `import { checkPathWritePermission } from './index.js'\nimport { commitAtomicWrite } from '../util/atomic-write.js';\n`
  check('T1 只 import 不调用 ⇒ 红(造好没装车)', evaluateWiring({
    exitFacts: exitFacts,
    toolFacts: analyzeFile(TOOL_MODULE, srcImportOnly),
    headExitPresent: true,
    headToolWired: false,
  }).findings.some((f) => f.rule === 'R3'))
  check(
    'T2 已入库的接线被摘掉 ⇒ 红(变异对照)',
    evaluateWiring({
      exitFacts: exitFacts,
      toolFacts: analyzeFile(TOOL_MODULE, `import { checkPathWritePermission } from './index.js'\n`),
      headExitPresent: true,
      headToolWired: true,
    }).findings.some((f) => f.rule === 'R3'),
  )
  check(
    'T3 有 commit 却没有 capture ⇒ 红(读后写校验被绕开)',
    evaluateWiring({
      exitFacts: exitFacts,
      toolFacts: G({ callsCaptureBaseline: 0 }),
      headExitPresent: true,
      headToolWired: true,
    }).findings.some((f) => f.rule === 'R3'),
  )
  check(
    'T4 齐备 ⇒ 不红(与 T1-T3 成对)',
    evaluateWiring({ exitFacts, toolFacts: G(), headExitPresent: true, headToolWired: true }).findings.length === 0,
  )
  check(
    'T5 import 判据认的是出口文件名(规定写法与判据同一构造)',
    analyzeFile(TOOL_MODULE, srcImportOnly).importsAtomicExit === true,
  )

  // ---- 反假绿 ----
  let threw = false
  try {
    assertNonEmptyScan([], 'head')
  } catch (e) {
    threw = e instanceof Undetermined
  }
  check('R0 空枚举判"无法判定"而非绿', threw)
  let passed = true
  try {
    assertNonEmptyScan([`${SCAN_DIR}/x.ts`], 'head')
  } catch {
    passed = false
  }
  check('R0b 非空枚举不误杀', passed)
  check('R0c 面外文件被排除', inScope('apps/cli/src/index.ts') === false && inScope(`${SCAN_DIR}/x.ts`) === true)

  // ═══════════════ F 维度(G-815961):文件系统故障注入是一等测试面 ═══════════════
  //
  // 这一组要回答的是 R1/R2/R3 回答不了的那一问:**失败时磁盘上剩什么**。
  // 全部走构造面(规则/env/fs 袋都显式给出),不读仓库瞬时状态 —— 真文件系统那一版在
  // `scripts/tests/check-file-write-safety.test.mjs` 的 D 组(同一份判据,不许抄第二遍)。

  /** 一个内存 fs 袋:只实现 atomicWriteFileSync 真正用到的那几个面,其余显式抛"未实现"。 */
  const memFs = () => {
    const files = new Map()
    const fds = new Map() // fd → 路径(writeSync 只知道 fd;不许靠"值是空串"去猜落在哪个文件上)
    let fdSeq = 0
    const enoent = (p) => Object.assign(new Error(`ENOENT: ${p}`), { code: 'ENOENT' })
    return {
      files,
      openSync(p, flags) {
        if (flags === 'wx' && files.has(p)) throw Object.assign(new Error(`EEXIST: ${p}`), { code: 'EEXIST' })
        files.set(p, '')
        const fd = ++fdSeq
        fds.set(fd, p)
        return fd
      },
      writeSync(fd, payload, offset, encoding) {
        const p = fds.get(fd)
        if (p === undefined) throw new Error(`writeSync: 未打开的 fd ${fd}`)
        const n = Buffer.byteLength(payload, encoding)
        files.set(p, files.get(p) + payload)
        return n
      },
      fsyncSync() {},
      closeSync(fd) {
        fds.delete(fd)
      },
      chmodSync() {},
      statSync(p) {
        if (!files.has(p)) throw enoent(p)
        return { mode: 0o100644 }
      },
      lstatSync(p) {
        if (!files.has(p)) throw enoent(p)
        return { isSymbolicLink: () => false, isDirectory: () => false }
      },
      readlinkSync() {
        throw new Error('未实现')
      },
      rmSync(p) {
        files.delete(p)
      },
      renameSync() {
        throw new Error('未实现:由用例覆盖')
      },
    }
  }

  /** 跑一次"注入一次 rename EPERM"的原子替换,返回袋快照与抛出的错误 */
  const runRenameFault = (rules, target, tmp) => {
    const F = memFs()
    F.files.set(target, 'OLD')
    const injector = createFaultInjector(rules)
    // 注入点摆在**真正做事之前**:rename 真被调之前先问一次(与上游 paths.ts:13 同型)
    F.renameSync = (from, to) => {
      injector.maybeThrow({ operation: 'rename', path: to })
      F.files.set(to, F.files.get(from))
      F.files.delete(from)
    }
    let error = null
    try {
      atomicWriteFileSync(target, 'NEW', { fs: F, tmpName: tmp, backoff: [], sleep: () => {} })
    } catch (e) {
      error = e
    }
    return { error, files: F.files, tmpPresent: F.files.has(tmp) }
  }

  // —— 规则闭集:逐个正向(守门 120 的要求:名单成员逐个能命中自己的判据)——
  for (const op of FAULT_OPERATIONS) {
    const inj = createFaultInjector([{ id: `p-${op}`, code: 'EPERM', operations: [op] }])
    let hit = null
    try {
      inj.maybeThrow({ operation: op, path: 'C:/x/a.txt' })
    } catch (e) {
      hit = e
    }
    check(`F1 闭集成员 ${op} 能被自己的判据命中(逐名正向)`, hit !== null && hit.syscall === op)
  }
  check(
    'F2 闭集外 operation ⇒ 解析期抛(不是静默失效成"什么都没注入但一路绿")',
    (() => {
      try {
        createFaultInjector([{ id: 'x', code: 'EPERM', operations: ['sqlite_open'] }])
        return false
      } catch {
        return true
      }
    })(),
  )
  check(
    'F3 坏 JSON / 非数组 ⇒ 解析期抛',
    (() => {
      for (const bad of ['{ not json', '{"a":1}', '42']) {
        try {
          parseFaultRules(bad)
          return false
        } catch {
          /* 抛对了,继续下一条 */
        }
      }
      return true
    })(),
  )
  check(
    'F4 规则必填字段(id/code)缺失或非串 ⇒ 解析期抛',
    (() => {
      for (const bad of [{ code: 'E' }, { id: 'i' }, { id: '', code: 'E' }, { id: 'i', code: '  ' }]) {
        try {
          createFaultInjector([bad])
          return false
        } catch {
          /* 抛对了 */
        }
      }
      return true
    })(),
  )
  check(
    'F5 maxMatches 非非负整数 ⇒ 解析期抛(不许静默当 1)',
    (() => {
      for (const bad of [-1, 1.5, '2', null]) {
        try {
          createFaultInjector([{ id: 'i', code: 'E', maxMatches: bad }])
          return false
        } catch {
          /* 抛对了 */
        }
      }
      return true
    })(),
  )
  check(
    'F6 pathRegex 编译不过 ⇒ 构造期抛(不留到匹配期才炸)',
    (() => {
      try {
        createFaultInjector([{ id: 'i', code: 'E', pathRegex: '([' }])
        return false
      } catch {
        return true
      }
    })(),
  )

  // —— 三条件取与 ——
  const threeCond = createFaultInjector([
    {
      id: 'and3',
      code: 'EPERM',
      operations: ['rename'],
      pathIncludes: 'wt/',
      pathEndsWith: '.json',
      pathRegex: '\\.tmp\\.json$',
    },
  ])
  const allThree = (p) => {
    try {
      threeCond.maybeThrow({ operation: 'rename', path: p })
      return false
    } catch {
      return true
    }
  }
  check('F7 三条件全中 ⇒ 命中', allThree('C:/wt/.a.tmp.json'))
  check('F8 三条件缺一即不命中(取与,不是取或)', !allThree('C:/other/.a.tmp.json') && !allThree('C:/wt/.a.txt'))
  check(
    'F9 路径分隔符归一(Windows 反斜杠形态也能命中同一条 pathEndsWith)',
    (() => {
      const inj = createFaultInjector([{ id: 's', code: 'EPERM', pathEndsWith: 'wt/x.json' }])
      try {
        inj.maybeThrow({ operation: 'writeFile', path: 'C:\\a\\wt\\x.json' })
        return false // 抛了才算命中(归一后 endsWith 成立)
      } catch {
        return true
      }
    })(),
  )

  // —— maxMatches 语义(默认 1)——
  const once = createFaultInjector([{ id: 'one', code: 'EPERM', operations: ['rename'] }])
  let firstThrew = false
  try {
    once.maybeThrow({ operation: 'rename', path: 'C:/a' })
  } catch {
    firstThrew = true
  }
  let secondThrew = false
  try {
    once.maybeThrow({ operation: 'rename', path: 'C:/a' })
  } catch {
    secondThrew = true
  }
  check('F10 maxMatches 缺省 = 1:第一次炸、第二次放行(与票面 :98 同值)', firstThrew && !secondThrew)
  const three = createFaultInjector([{ id: 'three', code: 'EPERM', operations: ['rename'], maxMatches: 3 }])
  let n = 0
  for (let i = 0; i < 5; i++) {
    try {
      three.maybeThrow({ operation: 'rename', path: 'C:/a' })
    } catch {
      n += 1
    }
  }
  check('F11 maxMatches 显式 N ⇒ 恰好炸 N 次', n === 3, `实得 ${n}`)
  check(
    'F12 maxMatches:0 ⇒ 永不炸(登记而不生效是一个合法形态)',
    (() => {
      const zero = createFaultInjector([{ id: 'z', code: 'E', operations: ['any'], maxMatches: 0 }])
      try {
        zero.maybeThrow({ operation: 'writeFile', path: 'C:/a' })
        return true
      } catch {
        return false
      }
    })(),
  )
  check(
    'F13 reset() 把额度归零(可复用同一个注入器跑多轮)',
    (() => {
      const r = createFaultInjector([{ id: 'r', code: 'EPERM', operations: ['rename'] }])
      const hit = () => {
        try {
          r.maybeThrow({ operation: 'rename', path: 'C:/a' })
          return false
        } catch {
          return true
        }
      }
      const a = hit()
      r.reset()
      return a && hit()
    })(),
  )

  // —— 合成错误的四个可断言字段 ——
  const shape = (() => {
    try {
      createFaultInjector([{ id: 'shape', code: 'EPERM', operations: ['rename'] }]).maybeThrow({
        operation: 'rename',
        path: 'C:/x/a.json',
      })
      return null
    } catch (e) {
      return e
    }
  })()
  check(
    `F14 合成错误带 ${FAULT_ERROR_FIELDS.join('/')} 四个字段(缺一个,断言就退化成 match 字符串)`,
    shape !== null && FAULT_ERROR_FIELDS.every((f) => shape[f] !== undefined) && shape.code === 'EPERM',
  )
  check(
    'F15 ruleMatches 与注入器同一条判据(构造面与实际行为不得漂移)',
    ruleMatches(createFaultInjector([{ id: 'm', code: 'E', operations: ['rename'] }]).rules[0], {
      operation: 'rename',
      path: 'C:/a',
    }) === true,
  )

  // ═══ F20 组:双条件兜底(票面点名"不可省"的那条牙 —— 防生产误开)═══
  const RULES_JSON = JSON.stringify([{ id: 'prod', code: 'EPERM', operations: ['rename'], pathEndsWith: '.json' }])
  const onlyRules = { [FAULTS_ENV]: RULES_JSON }
  check(
    'F20 **未设测试环境且无 ALLOW ⇒ 整条不生效**(只有规则串 ⇒ 零规则;这条是防生产误开的锁)',
    isFaultInjectionEnabled(onlyRules) === false &&
      createFaultInjectorFromEnv(onlyRules).rules.length === 0 &&
      (() => {
        try {
          createFaultInjectorFromEnv(onlyRules).maybeThrow({ operation: 'rename', path: 'C:/x/a.json' })
          return true // 不生效 = 不抛 = 正确
        } catch {
          return false
        }
      })(),
  )
  check(
    'F20b 空规则串 ⇒ 不生效(连规则都没有时不得有任何动作)',
    isFaultInjectionEnabled({}) === false && isFaultInjectionEnabled({ [FAULTS_ENV]: '   ' }) === false,
  )
  check(
    `F20c 首个条件(${FAULTS_ENV_GUARD}=test)单独成立 ⇒ 生效(与 F20 成对,防"永远打不开")`,
    isFaultInjectionEnabled({ ...onlyRules, [FAULTS_ENV_GUARD]: 'test' }) === true &&
      createFaultInjectorFromEnv({ ...onlyRules, [FAULTS_ENV_GUARD]: 'test' }).rules.length === 1,
  )
  check(
    `F20d 第二个条件(${FAULTS_ALLOW_ENV}=1)单独成立 ⇒ 生效(逃生阀本身也要能开)`,
    isFaultInjectionEnabled({ ...onlyRules, [FAULTS_ALLOW_ENV]: '1' }) === true &&
      createFaultInjectorFromEnv({ ...onlyRules, [FAULTS_ALLOW_ENV]: '1' }).rules.length === 1,
  )
  check(
    'F20e 非 test 的 ZCODE_ENV 值(如 production)⇒ 仍不生效(条件比的是精确值)',
    isFaultInjectionEnabled({ ...onlyRules, [FAULTS_ENV_GUARD]: 'production' }) === false,
  )
  check(
    'F20f 变体对照:把兜底拆掉(只剩规则串、不问环境)⇒ 本组必红 —— 变异取证用',
    // 这条断言"当前实现确实在问环境";拆掉兜底后 createFaultInjectorFromEnv 会直接武装 ⇒ F20 转红
    isFaultInjectionEnabled(onlyRules) === false,
  )

  // ═══ F21 组:正反成对 —— rename 注入一次 EPERM 的真实失败语义 ═══
  const renameRule = [{ id: 'rename-ep', code: 'EPERM', operations: ['rename'], pathEndsWith: 'target.json' }]
  const faulted = runRenameFault(renameRule, 'C:/d/target.json', 'C:/d/.target.json.tmp')
  check(
    'F21 rename 注入一次 EPERM ⇒ 抛错(证明失败分支被真的走到,不是"看注释以为走到了")',
    faulted.error !== null && faulted.error.code !== undefined,
  )
  check(
    'F21b **目标保持旧内容**(失败不得截目标、不得留半截 —— 票面正反成对第①条的前半)',
    faulted.files.get('C:/d/target.json') === 'OLD',
    `实得 ${JSON.stringify(faulted.files.get('C:/d/target.json'))}`,
  )
  check(
    'F21c **临时文件被清**(失败路径不留半成品 —— 票面正反成对第①条的后半)',
    faulted.tmpPresent === false,
    `实得 tmp 仍在袋里: ${[...faulted.files.keys()].join(',')}`,
  )
  const clean = runRenameFault([], 'C:/d/target.json', 'C:/d/.target.json.tmp')
  check(
    'F21d 与 F21 成对:不注入 ⇒ 正常换上去且不留临时件(否则 F21 的红可能只是"它压根不写")',
    clean.error === null && clean.files.get('C:/d/target.json') === 'NEW' && clean.tmpPresent === false,
  )
  check(
    'F21e maxMatches 默认 1 ⇒ 只炸第一次;第二遍同名注入已放行(证明额度语义接进了真实调用)',
    (() => {
      const F = memFs()
      F.files.set('C:/d/t.json', 'OLD')
      const inj = createFaultInjector(renameRule.map((r) => ({ ...r, pathEndsWith: 't.json' })))
      F.renameSync = (from, to) => {
        inj.maybeThrow({ operation: 'rename', path: to })
        F.files.set(to, F.files.get(from))
        F.files.delete(from)
      }
      let e1 = null
      try {
        atomicWriteFileSync('C:/d/t.json', 'NEW', { fs: F, tmpName: 'C:/d/.t.tmp', backoff: [], sleep: () => {} })
      } catch (e) {
        e1 = e
      }
      let e2 = null
      try {
        atomicWriteFileSync('C:/d/t.json', 'NEW2', { fs: F, tmpName: 'C:/d/.t.tmp', backoff: [], sleep: () => {} })
      } catch (e) {
        e2 = e
      }
      return e1 !== null && e2 === null && F.files.get('C:/d/t.json') === 'NEW2'
    })(),
  )

  // —— F 维度自身的接线:warn 起步,不得接成 blocking ——
  check(
    'F22 F 维度在默认档不产 findings(起步 warn;接成 blocking 就是恒红门)',
    typeof collectFaultInjectionFace === 'function' &&
      !('findings' in collectFaultInjectionFace(ROOT, 'head')) &&
      !('wiring' in collectFaultInjectionFace(ROOT, 'head')),
  )
  const ff = collectFaultInjectionFace(ROOT, 'head')
  check(
    'F23 判定面取到注入面 ⇒ present 且不判未判定(取不到才叫未判定,不许并桶成通过)',
    ff.present === true && ff.undetermined === false,
    JSON.stringify(ff),
  )
  check(
    'F23b 取不到 ⇒ 判未判定、绝不报成通过(在**纯判定层**构造,不靠取材层撞出那一档)',
    // ⚠️ 不可用"传一个不存在的仓根"来撞:取材的降级链会退到工作树照样取到(提交后实测转红)。
    //   三态判定抽成纯函数 `classifyFaultInjectionFace` 后,这一档才能被稳定构造。
    classifyFaultInjectionFace(null).undetermined === true &&
      classifyFaultInjectionFace(null).present === false &&
      // 判据自身抛 ⇒ 也是未判定,不是"取到了就算过"
      classifyFaultInjectionFace('x', {
        probe: () => {
          throw new Error('probe boom')
        },
      }).undetermined === true &&
      // 取到且判据可用 ⇒ 三态里的"已判定"那一档
      classifyFaultInjectionFace('x', { probe: () => 1 }).undetermined === false,
  )

  console.log(`文件写盘安全对账 --self-test:${pass} 通过 / ${fail} 失败(共 ${pass + fail} 条)`)
  return fail ? 1 : 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const argv = process.argv.slice(2)
  try {
    process.exit(argv.includes('--self-test') ? selfTest() : main(argv))
  } catch (e) {
    console.error(`❌ ${e?.stack ?? e}`)
    process.exit(2)
  }
}

export const __test__ = {
  EXIT_MODULE,
  TOOL_MODULE,
  SCAN_DIR,
  SKIP_ENV,
  BARE_WRITE_APIS,
  WORKSPACE_GATE_SYMBOL,
  REQUIRED_EXIT_EXPORTS,
  FAULT_INJECTION_MODULE,
  EXIT_IMPORT_RE,
  maskComments,
  maskCommentsAndStrings,
  analyzeFile,
  evaluateBareWrites,
  evaluateWiring,
  assertNonEmptyScan,
  inScope,
  listToolFiles,
  collectFaultInjectionFace,
  classifyFaultInjectionFace,
  runAudit,
  // ↓ F 维度判据的**转手面**:镜像测试直接 import 生产侧那一份(`scripts/lib/fs-fault-injection.mjs`),
  // 这里只做再导出,免得镜像测试为了拿判据而在本仓里长出第二份注入器实现(§22c)。
  FAULT_OPERATIONS,
  FAULT_ERROR_FIELDS,
  FAULTS_ENV,
  FAULTS_ALLOW_ENV,
  FAULTS_ENV_GUARD,
  isFaultInjectionEnabled,
  createFaultInjector,
  createFaultInjectorFromEnv,
  parseFaultRules,
  ruleMatches,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
