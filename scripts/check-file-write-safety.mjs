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
    anchorNotes: [
      { rel: EXIT_MODULE, ...pickFace(exitAnchor) },
      { rel: TOOL_MODULE, ...pickFace(toolAnchor) },
    ],
  }
}

function pickFace(a) {
  return { usedFace: a.usedFace, downgraded: a.downgraded }
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
  EXIT_IMPORT_RE,
  maskComments,
  maskCommentsAndStrings,
  analyzeFile,
  evaluateBareWrites,
  evaluateWiring,
  assertNonEmptyScan,
  inScope,
  listToolFiles,
  runAudit,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
