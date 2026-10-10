// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 台账（PROJECT_PLAN.md）里 sha 形态引用能不能真的解析 —— 一把**只读**尺子。
 *
 * 立票理由（PROJECT_PLAN 票面 `G-246`）：台账里大量 `提交 \`abc123456\`` 式引用是给后来人当
 * 「可核验出处」用的。引用解析不到，后来人就会把"找不到的证据"当成"曾经成立的证据"来推下一步。
 * 所以本尺子的产出**不是**一个数，而是一份「要么可修、要么必须明写无从找回」的清单。
 * 本门**不改台账**：逐条怎么处置（改指针 / 补出处 / 明写"无从找回"）要人判断。
 *
 * 三态（不可混计）：
 *   1. `resolvable`   —— 对象库里解析得到（commit / tree / blob / tag 任一都算存在）
 *   2. `unresolvable` —— git 明确回答 `missing` ⇒ 指针已腐烂
 *   3. `undetermined` —— **形态歧义**：既不是"能解析"也不是"不存在"，不得并进任何一侧
 *      子因 A 形状：长度不属于 git 缩写档(7–12)也不等于全量档(40) / 全数字(日期·计数·CI run id 同形)
 *                     / 紧跟 `#`(色值) —— 本仓实测这两族都是**真存在的噪声**，见 --self-test 的 U3–U5
 *      子因 B 探测：git 自己回答 `ambiguous`。这不是假想：本仓对象库 25.7 万条，7 位前缀实测
 *                     有 124 组碰撞（`git cat-file --batch-all-objects` 现算），短引用确实会撞。
 *
 * 形态是**先现读台账再定的**，不是按想象写的（本仓记过"按想象的格式搜富文本必得 0 处，还被写进
 * 台账当成结论"）：`FORM_SAMPLES` 每种形态的样例逐字取自 HEAD 面，镜像测试
 * `scripts/tests/check-plan-sha-resolvable.test.mjs` 反向核对"真台账里出现的每个 form 标签都在本表
 * 内、且本表每种形态在真面上都至少命中一次"。
 *
 * 口径（照抄本仓既有门）：全量判 **HEAD blob**、`--staged` 判**索引 blob**、`--worktree` 仅人工逃生舱、
 * 两面旗同给 exit 2、取不到判"无法判定"**不记绿**、枚举到 0 条判死。正文一律走
 * `scripts/lib/face-reader.mjs` 的 `catBatch` / `readWorktreeFile`（守门 118 把"import 了层却自己
 * git show / 读磁盘"判成半接线红）。对象存在性探测走同层 `catBatchStates` / `catBatchEcho` 出口 —— 它**不产生 blob 正文**，
 * 属"枚举"不属"读内容"，与 118 那条精度修正（`cat-file -e` / `ls-tree` 不得算读内容）同形；
 * 但派生与三态头解析同样只许有层那一份 —— face-reader 镜像的型 C 棘轮基线为 0，本门入库时把它顶成过
 * 1，收口方式是把解析搬进层，而不是抬高基线。
 *
 * 定级 **warn**（默认档恒 exit 0，除脚本异常 / 判死）：台账存量腐烂与"本次改了什么"无关，
 * 当场判红就是一台恒红门，唯一结局是逼人 `--no-verify` 连带废掉全部守门（§12e 同型）。
 * 人工问责跑 `--strict`：有腐烂 ⇒ exit 1；无腐烂但仍有未判定 ⇒ exit 2（拒绝出具合格证）。
 *
 * **未接提交链**（刻意）：不注册进 `scripts/guardian-runner.mjs`，常驻入口是根 package.json 的
 * `check:plan-sha`。不要把"门存在"读成"每次提交都在判"。
 *
 * 用法：node scripts/check-plan-sha-resolvable.mjs [--staged|--worktree|--strict|--json|--top N]
 *                                                 [--root <dir>] [--self-test]
 */

import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  catBatch,
  catBatchEcho,
  catBatchStates,
  parseBatchCheckStates,
  readWorktreeFile,
  selectFace,
  Undetermined,
  FACE_LABEL,
} from './lib/face-reader.mjs'

const SELF = 'check-plan-sha-resolvable.mjs'
const DEFAULT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PLAN_PATH = 'PROJECT_PLAN.md'

/** git 缩写档：HEAD 面台账里真实出现的是 9/10/11/12 位；判据下限取 git 默认 7。 */
const ABBREV_MIN = 7
const ABBREV_MAX = 12
const FULL_LEN = 40
/** 单次 batch 探测的 token 上限（输出按行对齐，切块防"一次挂起换成整门失明"）。 */
const PROBE_CHUNK = 400

/**
 * 抽取式：maximal hex run，且**不得嵌在更长的字母数字词里**。
 * 之所以要边界：台账里有 npm integrity 串、图片文件名、UUID 片段这类"内含合法十六进制子串"的东西
 * （实测 `97fef424f841ab997b161bc4ead93cbe` 就是文件名里的一段），允许子串匹配会凭空造出一批假腐烂。
 */
const HEX_RUN_RE = /(^|[^0-9a-zA-Z_])([0-9a-f]{7,64})(?=($|[^0-9a-zA-Z_]))/g

/**
 * 消歧标注档(G-1079146 存量清偿配套,2026-10-10):行内 `〔sha消歧:…〕` / `〔sha无从找回:…〕`
 * 注记**逐一列名**本行被消歧的 token(`〔sha消歧:c12617dd=adb设备序列号,非commit〕`),
 * 只有**被列名的 token** 归第四态 `disambigued`(不探测、不计腐不计未判) —— 列名制而非行级制:
 * 同一行可能同时有可解析的真 sha(L4890 实证),行级判定会把它们误挪出"可解析"。
 * 标注未列名的 token 一律照旧探测;未标注的行照旧 —— 宁多报不漏报。
 */
const DISAMBIG_NOTE_RE = /〔sha(?:消歧|无从找回)[:：]([^\〕]*)〕/g

/** 抽一行内消歧注记列名的 token 集合。 */
export function disambigTokensOf(line) {
  const ids = new Set()
  DISAMBIG_NOTE_RE.lastIndex = 0
  let m
  while ((m = DISAMBIG_NOTE_RE.exec(line)) !== null) {
    const body = m[1]
    const hex = /[0-9a-f]{7,40}/g
    let h
    while ((h = hex.exec(body)) !== null) ids.add(h[0])
  }
  return ids
}

/**
 * 形态登记表。`sample` 逐字取自 HEAD 面台账，`token` 是该片段里应当被抽出的那一枚，
 * `form`（省略 = 与键名同）是抽取式应当给出的归类；`full40` 按**长度档**而非句法位置归类，故 form:null。
 */
const FORM_SAMPLES = {
  // 反引号包裹的缩写 sha —— 台账里的绝对主力（HEAD 面实测 1300+ 处）
  backtick: { sample: '1. `fd595ae2c33` **提示词边界完整性**(A9D-1+A9D-4)', token: 'fd595ae2c33' },
  // 「提交/入库 + 反引号 sha」
  commit_word: { sample: '第 62 轮,提交 `2236c92f68`,origin=ALREADY', token: '2236c92f68' },
  // 散文里裸写的 sha（无反引号、无关键词、无后缀）
  bare: { sample: '**3 次**(075e56ee39→c08c71f7e7 抹、', token: '075e56ee39' },
  // 带 `^` 后缀（父提交形态）
  caret: { sample: '`git diff 32f821e76^ ddb78b1ca -- ChatScreen.tsx`', token: '32f821e76' },
  // 带 `:path` 后缀（对象内路径形态）
  path_suffix: {
    sample: '(`git cat-file -e e070fb273:scripts/check-statusbar-single-source.mjs` 失败',
    token: 'e070fb273',
  },
  // git 子命令的参数位
  git_arg: { sample: '`git show --name-only e9dfd3dbd21 3b0170fa176', token: 'e9dfd3dbd21' },
  // 一条命令里并列多枚（第二枚起）
  arg_list: {
    sample: '`git show --name-only e9dfd3dbd21 3b0170fa176 706fe99e200 de4008a5b86',
    token: '706fe99e200',
  },
  // 全量 40 位（台账里几乎都来自 git 错误输出被原样抄回来的 blob oid）
  full40: {
    sample: "复现:`fatal: missing blob object '08abe3d76346cd927a6038c059e421ace1f9611f'",
    token: '08abe3d76346cd927a6038c059e421ace1f9611f',
    form: null,
  },
}

// ---------------------------------------------------------------------------
// 纯判据层（镜像测试直接 import；不打 git、不碰磁盘）
// ---------------------------------------------------------------------------

/**
 * token 的**形状**判定：它像一枚 git oid 吗？
 * @returns {{kind:'candidate'}|{kind:'ambiguous',reason:string}}
 */
export function classifyShape(token, { precededByHash = false } = {}) {
  if (precededByHash) return { kind: 'ambiguous', reason: '紧跟 # —— 更像 CSS 色值而非 oid' }
  if (/^[0-9]+$/.test(token))
    return { kind: 'ambiguous', reason: '全数字 —— 日期/计数/CI run id 同形，sha 只是一种可能' }
  const n = token.length
  if (n === FULL_LEN) return { kind: 'candidate' }
  if (n >= ABBREV_MIN && n <= ABBREV_MAX) return { kind: 'candidate' }
  return {
    kind: 'ambiguous',
    reason: `长度 ${n} 不属于 git 缩写档(${ABBREV_MIN}–${ABBREV_MAX})也不等于全量档(${FULL_LEN})`,
  }
}

/**
 * 形态归类**只用于报告与覆盖面自证**，不参与三态判据。
 * 顺序即优先级：后缀形态 > 并列（前一枚也是 sha）> 关键词 > 反引号 > git 参数位 > 裸写。
 * `arg_list` 必须排在 `git_arg` 前 —— 否则同一行里并列的第 2..N 枚会被"这行有 git show"整片
 * 归成参数位，把"并列多枚"这一型从账面上抹平（形态标签失真，虽不改判据结论）。
 */
export function formOf(before, after) {
  if (after.startsWith('^')) return 'caret'
  if (/^:[A-Za-z0-9_./-]/.test(after)) return 'path_suffix'
  if (/(提交|入库|落地|落盘|commit|rev|oid|sha)\s*[（(]?\s*`$/.test(before)) return 'commit_word'
  if (/[0-9a-f]{7,12}\s+$/.test(before)) return 'arg_list'
  if (before.endsWith('`')) return 'backtick'
  if (/\bgit\s+[\w-]+(\s+[\w-]+){0,3}\s*$/.test(before)) return 'git_arg'
  return 'bare'
}

/** 从一行文本抽出全部 sha 形态候选。@param {number} lineNo 1-based */
export function extractFromLine(line, lineNo) {
  const out = []
  const disambigIds = disambigTokensOf(line)
  HEX_RUN_RE.lastIndex = 0
  let m
  while ((m = HEX_RUN_RE.exec(line)) !== null) {
    const token = m[2]
    const at = m.index + m[1].length
    const before = line.slice(Math.max(0, at - 40), at)
    const after = line.slice(at + token.length, at + token.length + 12)
    out.push({
      token,
      line: lineNo,
      form: formOf(before, after),
      shape: classifyShape(token, { precededByHash: before.endsWith('#') }),
      // 报告用：所在行原文前 60 字（按码点截，中文不按字节）
      lineText: [...line.trim()].slice(0, 60).join(''),
      // 消歧标注档(G-1079146):本 token 是否被本行消歧注记列名
      disambig: disambigIds.has(token),
    })
  }
  return out
}

/** @param {string} text PROJECT_PLAN.md 的**被审面**正文 */
export function extractCandidates(text) {
  const lines = String(text).split(/\r?\n/)
  const all = []
  for (let i = 0; i < lines.length; i++) all.push(...extractFromLine(lines[i], i + 1))
  return all
}

/**
 * 三态头解析住在取材层（`lib/face-reader.mjs` 的 `parseBatchCheckStates`），这里只留本门读它时用的名字。
 *
 * 为什么不是本门自己写：`--batch-check` 的头解析在本仓已有三份，第四份必然漂开；而"借层的 transport
 * 却自己重写解析"正是守门 118 定性的半接线（管子共用不等于面共用）。face-reader 镜像的型 C 棘轮
 * 基线为 0，这条门入库时把它顶成了 1 —— 修法是把解析收进层，不是把基线抬高。
 * 历史留一句：前缀判序曾写反（把"回显以输入开头"当成失败回显），全仓短 sha 因此静默落未判定，
 * 账面读起来像"探测不可靠"；那段判据现在住在层里，由两边的构造用例各自钉住。
 * @returns {Map<string,'resolvable'|'unresolvable'|'undetermined'>}
 */
export const parseProbeOutput = parseBatchCheckStates

/**
 * 汇总三态。**腐烂与未判定永不合并计数** —— 本仓最高频的失效型就是"把没判写成判过了"。
 */
export function summarize(candidates, statusOf) {
  const res = {
    occurrences: candidates.length,
    tokens: 0,
    resolvable: [],
    unresolvable: [],
    undetermined: [],
    shapeAmbiguous: [],
    probeAmbiguous: [],
    disambigued: [],
  }
  const byToken = new Map()
  for (const c of candidates) {
    if (!byToken.has(c.token)) byToken.set(c.token, [])
    byToken.get(c.token).push(c)
  }
  res.tokens = byToken.size
  for (const [tok, occ] of byToken) {
    // 消歧标注档(G-1079146):全部出现行都带标注 ⇒ 人已裁过,不探测不计腐(部分带 ⇒ 照旧探测)
    if (occ.every((c) => c.disambig)) {
      res.disambigued.push({ token: tok, occurrences: occ })
      continue
    }
    if (occ[0].shape.kind === 'ambiguous') {
      res.shapeAmbiguous.push({ token: tok, reason: occ[0].shape.reason, occurrences: occ })
      continue
    }
    const st = statusOf.get(tok)
    if (st === 'resolvable') res.resolvable.push({ token: tok, occurrences: occ })
    else if (st === 'unresolvable') res.unresolvable.push({ token: tok, occurrences: occ })
    else
      res.probeAmbiguous.push({
        token: tok,
        occurrences: occ,
        reason: 'git 回答 ambiguous 或回显形态不认识',
      })
  }
  res.undetermined = [
    ...res.shapeAmbiguous.map((r) => ({ kind: '形状歧义', ...r })),
    ...res.probeAmbiguous.map((r) => ({ kind: '短前缀歧义', ...r })),
  ]
  return res
}

/**
 * 退出码决策（纯函数 ⇒ 用构造面证明，不依赖仓库瞬时状态）。
 * 优先级：判死 / 无法判定(2) > strict 的合格证拒绝(2) > strict 的腐烂(1) > warn(0)。
 */
export function decideExit({ scanned, found, unresolvable, undetermined, strict, tookFailure }) {
  if (tookFailure) return 2
  if (scanned === 0) return 2 // 一行都没扫到 ⇒ 取材或判死，不记绿
  if (found === 0) return 2 // 抽不到任何 sha 形态 ⇒ 抽取式或台账格式漂了，同样是判死不是通过
  if (strict && unresolvable > 0) return 1
  if (strict && undetermined > 0) return 2
  return 0
}

/**
 * 选面。**`selectFace` 返回的是 `{face, error}` 而不是面名** —— 把返回值当字符串用的话
 * `face === 'staged'` 永不成立，三个面会全部悄悄读 HEAD（本仓"判据失效的表现永远是安静"那一型；
 * 它是被"三面读数完全相同"这条自查抓到的）。
 * @returns {'staged'|'head'|'worktree'|null} null = 判死
 */
export function parseFaces(argv) {
  if (argv.includes('--staged') && argv.includes('--worktree')) return null
  const got = selectFace({
    staged: argv.includes('--staged'),
    worktree: argv.includes('--worktree'),
    def: 'head',
  })
  return got && !got.error ? got.face : null
}

/** 人读面的面名（FACE_LABEL 的值是字符串，不是对象；直接插对象会印成 [object Object]）。 */
function labelOf(face) {
  const v = FACE_LABEL[face]
  return typeof v === 'string' ? v : String(face)
}

// ---------------------------------------------------------------------------
// I/O 层
// ---------------------------------------------------------------------------

/** 取被审面的台账正文（清单与内容同面同轮，不混面、不回落）。 */
export function loadPlan(root, face) {
  if (face === 'worktree') {
    // 工作树面**不套 try**：一个编码错误不得伪装成"取不到内容"（守门 97 的教训）
    return { text: readWorktreeFile(root, PLAN_PATH), note: labelOf('worktree') }
  }
  // 索引档的规格**必须带前导冒号**：`cat-file --batch` 对裸路径回答 missing（实测），它不像
  // `git show` 那样把 path 归一到索引。写成裸路径 = --staged 永远"取不到"，而 --staged 恰是提交链那面。
  const spec = face === 'staged' ? `:${PLAN_PATH}` : `HEAD:${PLAN_PATH}`
  const got = catBatch(root, [spec])
  const text = got.get(spec)
  if (text === null || text === undefined)
    throw new Undetermined(`${labelOf(face)} 取不到 ${PLAN_PATH} ⇒ 无法判定（不回落另一个面）`)
  return { text, note: labelOf(face) }
}

/**
 * 存在性探测：一次 batch-check 问完一批 token（只问"在不在"，不取正文，属枚举）。
 * 派生与三态解析都在层里（`catBatchStates`），本门只定自己的分块与超时 —— 这两个数是本门的运维参数，
 * 不是判据：分块小了只是多问几次，超时短了只是早喊"取不到"。
 */
export function probeTokens(root, tokens) {
  return catBatchStates(root, tokens, { chunkSize: PROBE_CHUNK, timeout: 60_000 })
}

/** 单枚复测，只为在报告里给出 git 的**原话**（不改变判据结论）。 */
function probeEcho(token, root) {
  return catBatchEcho(root, token)
}

function printReport(res, root, face, topN) {
  console.log(`判定面：${labelOf(face)}`)
  console.log(`sha 形态候选：出现 ${res.occurrences} 次 / 去重 ${res.tokens} 枚（${root}/${PLAN_PATH}）`)
  console.log(
    `三态：可解析 ${res.resolvable.length} · **取不到(腐烂) ${res.unresolvable.length}** · ` +
      `未判定 ${res.undetermined.length} · 已消歧(标注档) ${res.disambigued.length}` +
      `（形状歧义 ${res.shapeAmbiguous.length} / 短前缀歧义 ${res.probeAmbiguous.length}）`,
  )
  const occSum = (arr) => arr.reduce((a, r) => a + r.occurrences.length, 0)
  if (res.unresolvable.length) {
    console.log(`\n—— 取不到(腐烂) top ${Math.min(topN, res.unresolvable.length)}（按台账出现顺序）——`)
    let n = 0
    for (const r of res.unresolvable) {
      if (n >= topN) break
      n++
      const o = r.occurrences[0]
      console.log(`  ${String(n).padStart(3)}. ${o.token}  L${o.line}  [${o.form}]  探测: ${probeEcho(o.token, root)}`)
      console.log(`       行原文: ${o.lineText}`)
      if (r.occurrences.length > 1)
        console.log(`       另见 ${r.occurrences.slice(1).map((x) => 'L' + x.line).join(' ')}`)
    }
    console.log(`  （共 ${res.unresolvable.length} 枚去重 / ${occSum(res.unresolvable)} 次出现）`)
  }
  if (res.undetermined.length) {
    console.log(`\n—— 判不出(未判定) top ${Math.min(topN, res.undetermined.length)} ——`)
    let n = 0
    for (const r of res.undetermined) {
      if (n >= topN) break
      n++
      const o = r.occurrences[0]
      console.log(`  ${String(n).padStart(3)}. ${o.token}  L${o.line}  ${r.kind}：${r.reason}`)
      console.log(`       行原文: ${o.lineText}`)
    }
    console.log(`  （共 ${res.undetermined.length} 枚 / ${occSum(res.undetermined)} 次出现）`)
    console.log('  ⚠️ 这一格既不是"通过"也不是"腐烂"。--strict 下有它就不出合格证。')
  }
  if (res.disambigued.length) {
    console.log(`\n—— 已消歧(标注档) top ${Math.min(topN, res.disambigued.length)}（G-1079146:人已裁,不参与探测与腐烂计数）——`)
    let n = 0
    for (const r of res.disambigued) {
      if (n >= topN) break
      n++
      const o = r.occurrences[0]
      console.log(`  ${String(n).padStart(3)}. ${o.token}  L${o.line}`)
      console.log(`       行原文: ${o.lineText}`)
      if (r.occurrences.length > 1)
        console.log(`       另见 ${r.occurrences.slice(1).map((x) => 'L' + x.line).join(' ')}`)
    }
    console.log(`  （共 ${res.disambigued.length} 枚去重 / ${occSum(res.disambigued)} 次出现）`)
  }
}

// ---------------------------------------------------------------------------
// --self-test：构造面 + 真仓各一条阳性对照（判据写完必须拿"应当红"与"应当绿"两面各喂一次）
// ---------------------------------------------------------------------------

function selfTest() {
  const t = []
  const ok = (name, cond, extra = '') => t.push({ name, pass: !!cond, extra })
  const NL = String.fromCharCode(10)

  // 1) 每种登记形态：逐字样例必须被抽出并归到登记的形态上
  for (const [key, spec] of Object.entries(FORM_SAMPLES)) {
    const found = extractCandidates(spec.sample).filter((c) => c.token === spec.token)
    // full40 是**长度档**不是句法形态（它在真实语料里的句法位置就是 bare），
    // 所以那条只断言"抽出 + 落 candidate"，不断言 form 标签。
    const isLengthClass = spec.form === null
    ok(
      `F-${key} 登记形态必须被抽出并归类`,
      found.length === 1 &&
        (isLengthClass
          ? found[0].shape.kind === 'candidate'
          : found[0].form === key),
      `实得 ${found.map((c) => `${c.token}/${c.form}/${c.shape.kind}`).join(',') || '(未抽出)'}`,
    )
  }
  // 2) 真仓：抽取 + 探测各一条阳性对照
  try {
    const { text } = loadPlan(DEFAULT_ROOT, 'head')
    const cands = extractCandidates(text)
    ok('S1 真台账抽取候选数必须非零（抽不到=判据失明）', cands.length > 0, `= ${cands.length}`)
    const probeInput = cands.filter((c) => c.shape.kind === 'candidate').slice(0, 300).map((c) => c.token)
    const st = probeTokens(DEFAULT_ROOT, probeInput)
    const anyResolvable = [...st.values()].includes('resolvable')
    ok('S2 真台账必须至少一枚解析得到（全空=探测通道坏了，不是仓库坏了）', anyResolvable, `探测 ${st.size} 枚`)
    const forms = new Set(cands.map((c) => c.form))
    ok(
      'S4 真面出现的形态标签必须都在登记表内（漂了必须有一边红）',
      [...forms].every((f) => Object.prototype.hasOwnProperty.call(FORM_SAMPLES, f)),
      `真面形态集 ${[...forms].join(',')}`,
    )
    const syntactic = Object.keys(FORM_SAMPLES).filter((k) => FORM_SAMPLES[k].form !== null)
    ok(
      'S5 真面必须命中登记表里的每一种句法形态（少一种=该形态不再被认出，或样例已过期）',
      syntactic.every((f) => forms.has(f)),
      `缺 ${syntactic.filter((f) => !forms.has(f)).join(',') || '无'}`,
    )
  } catch (e) {
    ok('S0 真仓取材可用', false, e?.message ?? String(e))
  }
  // 3) 三态判据成对
  ok('U1 git 回 missing ⇒ 判取不到', parseProbeOutput(`deadbeef missing${NL}`, ['deadbeef']).get('deadbeef') === 'unresolvable')
  ok('U2 git 回 ambiguous ⇒ 判未判定而非腐烂', parseProbeOutput(`033c8a1 ambiguous${NL}`, ['033c8a1']).get('033c8a1') === 'undetermined')
  ok(
    'U2b git 回全量 oid（缩写被展开）⇒ 判可解析（本条是判据自己的假阴位置）',
    parseProbeOutput(`ce261e1a89a06100c9c268d35441b25669fc9317 commit 1693${NL}`, ['ce261e1a89a']).get('ce261e1a89a') === 'resolvable',
  )
  ok(
    'U2c 回显 oid 与输入前缀对不上（行序错位）⇒ 未判定，既不读成存在也不读成不存在',
    (() => {
      const m = parseProbeOutput(`${'f'.repeat(40)} commit 1${NL}nope1234 missing${NL}`, ['nope1234', 'f'.repeat(40)])
      // 两行都"形状合法"却与输入错位 ⇒ 两条都不许给出实质结论
      return m.get('nope1234') === 'undetermined' && m.get('f'.repeat(40)) === 'undetermined'
    })(),
  )
  let threw = false
  try {
    parseProbeOutput(`abc missing${NL}`, ['abc', 'def'])
  } catch (e) {
    threw = e instanceof Undetermined
  }
  ok('U6 输出行数 ≠ 输入 ⇒ 抛"无法判定"，绝不把没看完的当成不存在', threw)
  // 4) 形状歧义族
  ok('U3 长度 32 那一族 ⇒ 形状歧义，不进探测', classifyShape('97fef424f841ab997b161bc4ead93cbe').kind === 'ambiguous')
  ok('U4 全数字 7+ 位 ⇒ 形状歧义（日期/计数/run id 同形）', classifyShape('20260926').kind === 'ambiguous')
  ok('U4b 7–12 位含字母 ⇒ candidate；7 位全数字 ⇒ ambiguous（两侧都得有牙）',
    classifyShape('d6aa506daa').kind === 'candidate' && classifyShape('20260926').kind === 'ambiguous')
  {
    const col = extractFromLine('色板 #abcdef12 与 #a3c4d6ff 同值', 1)
    ok('U5 紧跟 # 的 hex 一律落形状歧义，不得当 sha 判腐烂',
      col.length === 2 && col.every((c) => c.shape.kind === 'ambiguous'),
      `抽出 ${col.map((c) => c.token).join(',')}`)
    const inside = extractFromLine('文件名 930a6481zz.png / 见 930a6481 与 618bc9f8', 1)
    ok('U7 词内子串不抽、独立 token 必抽',
      inside.length === 2 && inside.every((c) => c.token === '930a6481' || c.token === '618bc9f8'),
      `实抽 ${inside.map((c) => c.token).join(',')}`)
    const integ = extractFromLine('integrity sha512-abcdef0123456789', 1)
    ok('U7b 18 位 integrity 尾巴：抽出但只落形状歧义，永不计腐烂',
      integ.length === 1 && integ[0].shape.kind === 'ambiguous',
      integ.map((c) => `${c.token}/${c.shape.kind}`).join(','))
  }
  // 5) 三态不得互相顶替（summarize 层）
  {
    const cands = [
      { token: 'aaaaaaa', line: 1, form: 'bare', shape: { kind: 'candidate' }, lineText: '' },
      { token: '20260926', line: 2, form: 'bare', shape: classifyShape('20260926'), lineText: '' },
      { token: 'bbbbbbb', line: 3, form: 'bare', shape: { kind: 'candidate' }, lineText: '' },
    ]
    const st = new Map([
      ['aaaaaaa', 'resolvable'],
      ['bbbbbbb', 'unresolvable'],
    ])
    const r = summarize(cands, st)
    ok('M1 三态分家：可解析 1 / 腐烂 1 / 未判定 1，任何两态不得合计',
      r.resolvable.length === 1 && r.unresolvable.length === 1 && r.undetermined.length === 1,
      `${r.resolvable.length}/${r.unresolvable.length}/${r.undetermined.length}`)
    ok('M2 未判定的形状歧义子因单独计数（不得混进腐烂清单）',
      r.shapeAmbiguous.length === 1 && r.probeAmbiguous.length === 0)
  }
  // 5b) 消歧标注档(G-1079146,列名制)
  {
    const st = new Map([['aaaaaaa', 'unresolvable']])
    const marked = extractFromLine('真机 c12617dd 连着 〔sha消歧:c12617dd=adb设备序列号,非commit〕', 1)
    const r1 = summarize(marked, st)
    ok('M3 标注列名的 token ⇒ 归已消歧档,不探测不计腐烂',
      marked.length === 2 && marked.every((c) => c.disambig === true) &&
      r1.disambigued.length === 1 && r1.unresolvable.length === 0,
      `cands=${marked.length} dis=${r1.disambigued.length}/rot=${r1.unresolvable.length}`)
    // 同 token 两行:一行带标注一行不带 ⇒ 部分消歧不算,照旧探测(保守方向:少消歧)
    const markedSame = extractFromLine('真机 aaaaaaa 连着 〔sha消歧:aaaaaaa=adb设备序列号,非commit〕', 1)
    const plain = extractFromLine('见 commit aaaaaaa 与后续', 2)
    const r2 = summarize([...markedSame, ...plain], st)
    ok('M4 部分行带标注 ⇒ 不算消歧,照旧进腐烂(宁多报不漏报)',
      r2.disambigued.length === 0 && r2.unresolvable.length === 1,
      `dis=${r2.disambigued.length}/rot=${r2.unresolvable.length}`)
    const forgiven = extractFromLine('枚 aaaaaaa 落地 〔sha无从找回:aaaaaaa=对象库不含,明写无从找回〕', 3)
    const r3 = summarize(forgiven, st)
    ok('M5 sha无从找回 标注同样进消歧档(两族标注一档)',
      r3.disambigued.length === 1 && r3.unresolvable.length === 0)
    // M6 列名制的关键反例:同行另一枚未列名的 token 不得被捎带消歧(L4890 实证型)
    const mixed = extractFromLine('拼的 194f1949955 不是真对象,真值五枚 b36ba44a06 在案 〔sha消歧:194f1949955=凭记忆假串,非commit〕', 4)
    const r4 = summarize(mixed, new Map([['194f1949955', 'unresolvable'], ['b36ba44a06', 'resolvable']]))
    ok('M6 列名制:同行未列名 token 照常走探测(b36ba44a06 计可解析,194f1949955 计消歧)',
      r4.disambigued.length === 1 && r4.disambigued[0].token === '194f1949955' &&
      r4.resolvable.length === 1 && r4.resolvable[0].token === 'b36ba44a06',
      `dis=${r4.disambigued.map((x) => x.token)}/res=${r4.resolvable.map((x) => x.token)}`)
  }
  // 6) 退出码决策
  ok('X1 全量档：有腐烂也 exit 0（warn 级）', decideExit({ scanned: 1, found: 5, unresolvable: 3, undetermined: 0, strict: false }) === 0)
  ok('X2 --strict：有腐烂 ⇒ 1', decideExit({ scanned: 1, found: 5, unresolvable: 3, undetermined: 0, strict: true }) === 1)
  ok('X3 --strict：无腐烂但有未判定 ⇒ 2（拒绝出合格证）', decideExit({ scanned: 1, found: 5, unresolvable: 0, undetermined: 2, strict: true }) === 2)
  ok('X4 枚举 0 条判死 ⇒ 2，不记绿', decideExit({ scanned: 1, found: 0, unresolvable: 0, undetermined: 0, strict: false }) === 2)
  ok('X5 取材失败 ⇒ 2，优先于一切', decideExit({ scanned: 1, found: 0, unresolvable: 0, undetermined: 0, strict: true, tookFailure: true }) === 2)
  // 7) 两面旗同给判死
  ok('F1 --staged 与 --worktree 同给 ⇒ 判死', parseFaces(['--staged', '--worktree']) === null)
  ok('F2 单面旗必须落在正确面上（selectFace 返回对象而非面名，这一条钉住不再漂回去）',
    parseFaces(['--staged']) === 'staged' && parseFaces(['--worktree']) === 'worktree' && parseFaces([]) === 'head')

  let fails = 0
  for (const r of t) {
    if (!r.pass) fails++
    console.log(`${r.pass ? '  ✅' : '  ❌'} ${r.name}${r.extra ? `  — ${r.extra}` : ''}`)
  }
  console.log(`${SELF} --self-test：${t.length - fails}/${t.length} 条通过`)
  return fails === 0 ? 0 : 1
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

async function main(argv) {
  if (argv.includes('--self-test')) return selfTest()
  const face = parseFaces(argv)
  if (face === null) {
    console.error('❌ --staged 与 --worktree 不得同给（要判哪个面就只插哪面旗）')
    return 2
  }
  const ri = argv.indexOf('--root')
  const root = ri >= 0 && argv[ri + 1] ? path.resolve(argv[ri + 1]) : DEFAULT_ROOT
  const strict = argv.includes('--strict')
  const ti = argv.indexOf('--top')
  const topN = ti >= 0 ? Number(argv[ti + 1]) || 10 : 10

  let res = null
  let tookFailure = null
  try {
    const { text } = loadPlan(root, face)
    const candidates = extractCandidates(text)
    const status = probeTokens(
      root,
      candidates.filter((c) => c.shape.kind === 'candidate').map((c) => c.token),
    )
    res = summarize(candidates, status)
    res.lines = text.split(/\r?\n/).length
    res.forms = [...new Set(candidates.map((c) => c.form))].sort()
  } catch (e) {
    tookFailure = e instanceof Undetermined ? e.message : `脚本异常：${e?.message ?? e}`
  }

  if (argv.includes('--json')) {
    console.log(
      JSON.stringify(
        {
          root,
          face,
          tookFailure,
          lines: res?.lines,
          forms: res?.forms,
          occurrences: res?.occurrences,
          tokens: res?.tokens,
          resolvable: res?.resolvable.map((r) => r.token),
          unresolvable: res?.unresolvable.map((r) => ({
            token: r.token,
            occurrences: r.occurrences.map((o) => ({ line: o.line, form: o.form, text: o.lineText })),
          })),
          undetermined: res?.undetermined.map((r) => ({
            token: r.token,
            kind: r.kind,
            reason: r.reason,
            line: r.occurrences[0].line,
            text: r.occurrences[0].lineText,
          })),
        },
        null,
        2,
      ),
    )
  } else if (tookFailure) {
    console.error(`❌ 无法判定：${tookFailure}`)
  } else {
    printReport(res, root, face, topN)
  }

  const rc = decideExit({
    scanned: tookFailure ? 1 : res ? res.lines : 0,
    found: res ? res.occurrences : 0,
    unresolvable: res ? res.unresolvable.length : 0,
    undetermined: res ? res.undetermined.length : 0,
    strict,
    tookFailure,
  })
  // --json 档的 stdout 必须**只有 JSON**（镜像测试与任何脚本化消费方都要能 JSON.parse），
  // 所以读数行改走 stderr：问责信息一条不丢，但不污染机器可读面。
  const say = argv.includes('--json') ? console.error : console.log
  say(
    `末行读数：面=${labelOf(face)} 候选=${res ? res.occurrences : 0} 次/${res ? res.tokens : 0} 枚 · ` +
      `可解析=${res ? res.resolvable.length : 0} · 取不到=${res ? res.unresolvable.length : 0} · ` +
      `判不出=${res ? res.undetermined.length : 0} · strict=${strict ? 'on' : 'off'} · ` +
      `定级=warn(未接提交链) · exit=${rc}`,
  )
  return rc
}

export const __test__ = {
  ROOT: DEFAULT_ROOT,
  PLAN_PATH,
  FORM_SAMPLES,
  classifyShape,
  formOf,
  extractFromLine,
  extractCandidates,
  parseProbeOutput,
  summarize,
  decideExit,
  parseFaces,
  loadPlan,
  probeTokens,
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href

if (isDirectRun) {
  main(process.argv.slice(2))
    .then((rc) => process.exit(rc))
    .catch((e) => {
      console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
      process.exit(2)
    })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
