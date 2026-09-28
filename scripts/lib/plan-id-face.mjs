// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 计划编号的**占用面** —— 台账 ⊕ 归档件,一份实现,两个取号出口共用(2026-09-28 立)。
 *
 * 为什么存在(缺陷本体):`scripts/archive-completed-tasks.mjs` 把已完成条目从 `PROJECT_PLAN.md`
 * 整块搬到 `.ihui-agent/archive/PROJECT_PLAN_*.md`,台账里只留一行 HTML 注释占位。而**取号器只看
 * 台账那一个文件** —— 于是每搬走一批,`max(编号)` 就回落一次,新任务会拿到**已经用过的编号**。
 * 本仓 2026-09-28 一天内真的重发过两次号(登记在提交 `6b812de31` 正文,`git log -1 --format=%B 6b812de31`
 * 可复核)。立门前现读(HEAD 面,O 族):台账 max=88,台账⊕归档件 max=**90**,而
 * `scripts/next-plan-id.mjs` 当时按条目标题给的是 **O87** —— O87/O89/O90 三个号在当日归档件里都已
 * 存在,即"下一个可用号"其实已被占用。
 *
 * 三条设计前提(照抄别重新发明):
 *  ① **同一被审面、同一轮取数**。台账 blob 与归档件清单/正文都从同一个 `source` 读;清单读 HEAD
 *     而正文读磁盘(或反之)会在并行会话推进的瞬间产出自洽却错位的尺子 —— 与本仓 face-reader 那一族
 *     记过的"表读磁盘 + 用量读 HEAD"同型。所以本层**不读磁盘**,一个字节都不读。
 *  ② **三态不并桶**:"枚举成功且为 0 份" / "枚举失败" / "取到了清单但有归档件读不到" 是三件事。
 *     后两种一律进 `undetermined` 且 `ok:false`,调用方必须**大声打印并拒绝发号**。按窄面发号正是本
 *     缺陷的症状,而把"没枚举到"当成"没有归档件"就是把"没判"写成"判过了"(本仓最高频失效型)。
 *  ③ **拼接顺序必须确定**。`text` 是按路径码点字典序拼出来的:归档件之间谁先谁后若不固定,同一份
 *     内容两次跑会产出不同的 `text` ⇒ 任何对它做**行级/位置级**判断的下游(以及 diff 取证、幂等比对)
 *     都不可复现;`parseTaskRows` 还会给出行号,顺序不定就等于行号不定。
 *
 * 为什么住在 lib 而不是各出口里写一遍:本仓纪律"两处算同一件事必漂移"(AGENTS §3 / 守门 103 /
 * `scripts/lib/code-mask.mjs` 那一条)。取号出口现有两处(`next-plan-id.mjs` 的条目标题扫描、
 * `live-doc-edit.mjs` 喂给 `usedIdsOfPrefix` 的底稿),各写一份归档件枚举必然有一份先漂。
 * **"什么算一个编号"仍然只有一份** —— 住在 `scripts/lib/plan-task-index.mjs` 的 `usedIdsOfPrefix`;
 * 本层只负责**把面铺宽**,不重抄编号语法、不重抄编号族表(行首裸编号不占号段那条口径也不在这)。
 * 自检也用那同一把尺子量,不用第二份判据(否则"面铺宽了"这件事本身无从证明)。
 *
 * 归档件形态只认文件名 `PROJECT_PLAN*.md`:归档器的搬运目标就是这一形状,而 `.ihui-agent/archive/`
 * 按设计还放着别的跟踪件(守门 13c 的 A2 记过"按形状筛会把已入库读成落空",反过来不加筛就会把无关
 * 内容当台账喂进取号器)。
 *
 * 只对 `PROJECT_PLAN.md` 生效:`.ihui-agent/archive/` 里存的是**台账**内容。AGENTS.md / README.md
 * 同样是活文档、同样由 `live-doc-edit.mjs` 编辑,把台账归档件顶进它们的号段既无依据也会改变既有行为。
 * 非台账文档 ⇒ `archivesApplicable:false` 且 `text === ledgerText`,**与改动前逐字同形**。
 *
 * 用法:
 *   node scripts/lib/plan-id-face.mjs                 # 现读 HEAD 面(只报数,不改任何东西)
 *   node scripts/lib/plan-id-face.mjs --source origin/main
 *   node scripts/lib/plan-id-face.mjs --json
 *   node scripts/lib/plan-id-face.mjs --self-test     # 临时 git 仓夹具,零副作用于真仓
 *
 * 退出码:0 = 面可用(含"枚举到 0 份")/ 1 = 面判不出(台账取不到、枚举失败、有归档件取不到)
 *        ⇒ 这正是取号出口该拒绝发号的那一档 / 2 = 用法错或脚本自身异常。
 *
 * §5c 溯源水印:本文件受 `scripts/watermark.mjs` 管理。
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { git } from './bypass-git.mjs'
import { mkScratch, rmScratch } from './scratch-dir.mjs'
import { usedIdsOfPrefix } from './plan-task-index.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..', '..')

/** 唯一台账(§1:项目唯一任务计划文档)。 */
export const LEDGER_DOC = 'PROJECT_PLAN.md'
/** 归档件目录 —— §1 归档机制的落点,受版本控制(AGENTS:归档锚点必须受版本控制)。 */
export const ARCHIVE_DIR = '.ihui-agent/archive'
/**
 * 归档件形态:**台账归档件的直接子文件** `<ARCHIVE_DIR>/PROJECT_PLAN*.md`。
 * 归档器只往这一层写(`scripts/archive-completed-tasks.mjs:678` 等三处同一形状),AGENTS §1 承诺的
 * 锚点也是这一层(`.ihui-agent/archive/PROJECT_PLAN_*.md`)。所以:
 *  - `PROJECT_PLAN_2026-09-28_auto-archive.md` / `PROJECT_PLAN_dedup-2026-09-23.md` /
 *    `PROJECT_PLAN_2026-07-23_archive_v4.md` 都算;
 *  - `hollow-backup-tags-2026-09-24.txt`、`audit-reports-2026-07-21/`(子目录)里的东西都**不算**。
 * 但"不算"不等于"没看见":名字长得像台账归档件却在子目录里的,一律进 `lookAlikeFiles` 并**报名**
 * (守门 128 那条"射程边界必须报名、不得只报数"同型)—— 归档器一旦改布局,这一行就是唯一的哨兵。
 */
export const ARCHIVE_SHAPE = /^PROJECT_PLAN.*\.md$/

/** 取号用的族(本仓台账的主号段;不在别处再抄一份 —— 判不出就是判不出)。 */
export const PRIMARY_FAMILY = 'O'

const LS_TREE_TIMEOUT_MS = 60_000
const SHOW_TIMEOUT_MS = 60_000

/** 归一分隔符并剥掉仓库相对前缀用不到的一切 —— `git ls-tree` 恒给正斜杠,但调用方可能传反斜杠。 */
function normPath(p) {
  return String(p).replace(/\\/g, '/')
}

/** 路径的最后一段(两种分隔符都拆)。 */
export function baseNameOf(p) {
  return normPath(p).split('/').filter(Boolean).pop() ?? ''
}

/** 是否落在归档目录的**第一层**(直接子文件)。 */
export function isDirectArchiveChild(p) {
  const n = normPath(p)
  if (!n.startsWith(`${ARCHIVE_DIR}/`)) return false
  return !n.slice(ARCHIVE_DIR.length + 1).includes('/')
}

/** 是不是台账归档件:目录第一层 + 形状匹配(纯函数;镜像测试直接喂真仓现读的路径清单)。 */
export function isArchivePath(p) {
  return isDirectArchiveChild(p) && ARCHIVE_SHAPE.test(baseNameOf(p))
}

/** 长得像台账归档件、却在子目录更深处 ⇒ 不进占用面,但必须**报名**。 */
export function isLookAlikePath(p) {
  const n = normPath(p)
  if (!n.startsWith(`${ARCHIVE_DIR}/`)) return false
  if (isDirectArchiveChild(n)) return false
  return ARCHIVE_SHAPE.test(baseNameOf(n))
}

/** NUL 分隔清单 ⇒ 路径数组;输入不是字符串 ⇒ null(= 判不出,不是零份)。 */
export function parseZList(z) {
  if (typeof z !== 'string') return null
  return z
    .split('\0')
    .map((s) => s.trim())
    .filter((s) => s !== '')
}

/**
 * 从 `git ls-tree -r --name-only -z` 的输出里挑出台账归档件路径。
 * 判不出(输入不是字符串)⇒ `null` —— 调用方必须把它当"清单没读到",**不得**当"没有归档件"。
 * 返回**已按码点字典序排好**的数组(顺序确定性见文件头 ③)。
 */
export function pickArchivePaths(z) {
  const all = parseZList(z)
  return all === null ? null : all.filter(isArchivePath).sort()
}

/** 同一次解析的第二类落点(不参与取数,只参与报告)。 */
export function pickLookAlikePaths(z) {
  const all = parseZList(z)
  return all === null ? null : all.filter(isLookAlikePath).sort()
}

/**
 * 拼接占用面(纯函数)。台账恒在最前,归档件按传入顺序(= 排好序的路径序)依次接在后面。
 * 每两份之间**强制隔一个换行**:被搬走的正文末尾不一定带换行,首尾直接相接会把"上一份最后一行"
 * 和"下一份第一行"并成一行 —— 那一条登记行就谁也不认识了(静默少一个编号,比报错更糟)。
 */
export function joinFace(ledgerText, bodies) {
  const parts = [typeof ledgerText === 'string' ? ledgerText : '']
  for (const b of Array.isArray(bodies) ? bodies : []) if (typeof b === 'string') parts.push(b)
  return parts.join('\n')
}

const oneLine = (e) =>
  String(e?.stderr ?? e?.message ?? e)
    .split(/\r?\n/)[0]
    .slice(0, 200)

/**
 * 唯一的派生层(两次 git 调用:清单 + 正文)。绝对路径 git、`windowsHide`、数字 `timeout` 都由
 * `lib/bypass-git.mjs` 那一份 `git()` 负责 —— 本层不抄第二份派生(守门 52/80 判的就是抄第二份)。
 * `ls-tree -z`:路径以 NUL 分隔且**不经 core.quotePath 转义**(带非 ASCII 的跟踪件按默认形态会被
 * 打成 `"\346\226\207…"`,那份正文就永远取不到 —— 而"取不到"在本层是判不出,不是零份)。
 */
export const ID_FACE_TRANSPORT = {
  /** 一次派生,两类落点都从同一份输出里筛(两次 ls-tree 会在别人推进的瞬间给出互不相干的清单)。 */
  listArchives({ root, source }) {
    const z = git(['ls-tree', '-r', '--name-only', '-z', source, '--', ARCHIVE_DIR], {
      root,
      raw: true,
      timeout: LS_TREE_TIMEOUT_MS,
    })
    const paths = pickArchivePaths(z)
    if (paths === null) return null
    return { paths, lookAlikes: pickLookAlikePaths(z) ?? [] }
  },
  show({ root, source, path }) {
    return git(['show', `${source}:${path}`], { root, raw: true, timeout: SHOW_TIMEOUT_MS })
  },
}

/**
 * 取号占用面的唯一出口。
 *
 * @param root       仓库根(必填;本层不猜"调用方站在哪")
 * @param source     被审面(缺省 'HEAD';可传任意 commit-ish)
 * @param doc        被编辑的活文档;只有 `LEDGER_DOC` 才叠归档件
 * @param ledgerText 调用方本轮**已从同一面**读到的台账正文(传了就不再读第二次 —— 同面同轮由构造保证)
 * @param transport  派生层(测试注入用;缺省走 `lib/bypass-git.mjs` 那一份)
 * @returns `{ok, source, doc, ledgerText, text, archiveFiles[], archivesApplicable,
 *            enumeratedEmpty, undetermined[], notes[]}`
 */
export function collectIdFace({
  root = null,
  source = 'HEAD',
  doc = LEDGER_DOC,
  ledgerText = null,
  transport = ID_FACE_TRANSPORT,
} = {}) {
  const out = {
    ok: false,
    source,
    doc,
    ledgerText: '',
    text: '',
    archiveFiles: [],
    lookAlikeFiles: [],
    archivesApplicable: false,
    enumeratedEmpty: false,
    undetermined: [],
    notes: [],
  }
  const refuse = (reason, narrowText) => {
    out.undetermined.push(reason)
    out.text = typeof narrowText === 'string' ? narrowText : ''
    out.ok = false
    return out
  }
  if (!root) return refuse('collectIdFace 必须显式传 root(不猜调用方位置)')

  // ── 第一步:台账本体。取不到 ⇒ 整个面判不出(与既有出口"取不到权威版本 ⇒ 拒绝发号"同一档) ──
  let ledger = typeof ledgerText === 'string' ? ledgerText : null
  if (ledger === null) {
    try {
      ledger = transport.show({ root, source, path: doc })
    } catch (e) {
      return refuse(`台账 ${source}:${doc} 取不到:${oneLine(e)}`)
    }
  }
  if (typeof ledger !== 'string')
    return refuse(`台账 ${source}:${doc} 没读到正文(transport 未给出文本)⇒ 不判成"空台账"`)
  out.ledgerText = ledger

  // ── 第二步:非台账文档 ⇒ 归档件不适用,面 = 该文档自身(与改动前逐字同形) ──
  if (doc !== LEDGER_DOC) {
    out.archivesApplicable = false
    out.text = ledger
    out.ok = true
    out.notes.push(
      `被编辑文档是 ${doc} 而非 ${LEDGER_DOC} ⇒ 归档件不适用(${ARCHIVE_DIR}/ 存的是台账内容),占用面 = 该文档自身`,
    )
    return out
  }
  out.archivesApplicable = true

  // ── 第三步:枚举归档件(与被审正文**同面同轮**)。抛错=失败;空清单=该面确实零份 ──
  let listed
  try {
    listed = transport.listArchives({ root, source })
  } catch (e) {
    return refuse(
      `归档件清单枚举失败(${source} 上的 ${ARCHIVE_DIR}/):${oneLine(e)} ⇒ 占用面不完整,拒绝按窄面发号`,
      ledger,
    )
  }
  if (!listed || !Array.isArray(listed.paths))
    return refuse(
      '归档件清单读不出结果(transport 没返回路径数组)⇒ 不得把"没枚举到"当成"没有归档件"',
      ledger,
    )
  const paths = listed.paths
  out.lookAlikeFiles = Array.isArray(listed.lookAlikes) ? listed.lookAlikes : []
  if (out.lookAlikeFiles.length > 0)
    out.notes.push(
      `射程外但同名形态的件 ${out.lookAlikeFiles.length} 份(在 ${ARCHIVE_DIR}/ 的子目录里,归档器不往那儿写 ⇒ 不进占用面):${out.lookAlikeFiles.slice(0, 5).join(', ')}${out.lookAlikeFiles.length > 5 ? ' …' : ''}`,
    )
  if (paths.length === 0) {
    out.enumeratedEmpty = true
    out.text = ledger
    out.ok = true
    out.notes.push(
      `枚举到 0 份归档件(${source} 的 ${ARCHIVE_DIR}/ 里没有 PROJECT_PLAN*.md 形态的跟踪件)⇒ 本轮占用面只有台账`,
    )
    return out
  }

  // ── 第四步:逐份取正文。任何一份取不到 ⇒ 进 undetermined 点名该路径,**绝不静默跳过** ──
  const bodies = []
  for (const p of paths) {
    let body
    try {
      body = transport.show({ root, source, path: p })
    } catch (e) {
      out.undetermined.push(`归档件 ${source}:${p} 取不到:${oneLine(e)}`)
      continue
    }
    if (typeof body !== 'string') {
      out.undetermined.push(`归档件 ${source}:${p} 没读到正文(transport 未给出文本)`)
      continue
    }
    out.archiveFiles.push({ path: p, bytes: Buffer.byteLength(body, 'utf8') })
    bodies.push(body)
  }

  out.text = joinFace(ledger, bodies)
  // 列出了 N 份而只吃到 M 份 ⇒ 交出去的是窄面,哪怕已点名也不得判 ok。
  out.ok = out.undetermined.length === 0
  if (out.ok)
    out.notes.push(
      `占用面 = 台账 + ${out.archiveFiles.length} 份归档件(按路径字典序拼接,清单与正文同面同轮)`,
    )
  return out
}

/**
 * 该族在给定文本上的 max —— **只走 `usedIdsOfPrefix` 那一个出口**,自检与生产同一把尺子。
 * null = 该族一条都没有(判不出),不是 0。
 */
export function familyMaxOn(text, family = PRIMARY_FAMILY) {
  const used = usedIdsOfPrefix(text, family)
  return used === null ? null : used.max
}

// ── 自检:真临时 git 仓夹具 ⇒ 确定性,不依赖真仓瞬时状态(§22c:判据的对象是"面"的形态,输入必须像真件) ──
function selfTest() {
  const results = []
  const ok = (name, cond, detail = '') => results.push({ name, pass: !!cond, detail })

  const LEDGER = [
    '# 台账',
    '',
    '## O5 台账里还在的条目',
    '- [x] O5 已完成 ✅(2026-09-20)',
    '- [ ] O13 别的会话写的(O 族不带连字符)',
    '',
  ].join('\n')
  const ARCHIVE = [
    '# 归档件(从台账搬出)',
    '',
    '### O9 已归档条目(已完成 ✅)',
    '- [x] O9 搬走了 ✅(2026-09-28)',
    '- [x] O90 同族更大号,台账里已经看不见了',
  ].join('\n')
  const NOISE_TXT = '- [x] O9999 同目录的无关跟踪件,不该进占用面'

  const commitAll = (dir) => {
    git(['add', '-A'], { root: dir })
    git(['commit', '-q', '-m', 'init'], { root: dir })
  }
  const initRepo = () => {
    const dir = mkScratch('pid-face-')
    git(['init', '-q'], { root: dir })
    git(['config', 'user.email', 't@e2e.local'], { root: dir })
    git(['config', 'user.name', 'e2e'], { root: dir })
    git(['config', 'core.autocrlf', 'false'], { root: dir })
    return dir
  }
  const put = (dir, rel, text) => {
    const abs = join(dir, rel)
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, text, { encoding: 'utf8' })
  }

  // ① 阳性对照(本票全部意义):号在被搬走的那一侧 ⇒ 宽面必须看得见,窄面看不见
  {
    const dir = initRepo()
    try {
      put(dir, LEDGER_DOC, LEDGER)
      // AGENTS.md 必须真在面上:A1 判的是"编辑另一份活文档",文件不在 ⇒ 那是"取不到",
      // 不是"归档件不适用" —— 夹具缺能力会把一条判据伪造成另一条结论。
      put(
        dir,
        'AGENTS.md',
        ['# AGENTS', '', '- [ ] AG13 另一本账上的编号,不该被台账归档件顶掉', ''].join('\n'),
      )
      put(dir, join(ARCHIVE_DIR, 'PROJECT_PLAN_2026-09-28_auto-archive.md'), ARCHIVE)
      put(dir, join(ARCHIVE_DIR, 'hollow-backup-tags-2026-09-24.txt'), NOISE_TXT)
      put(dir, join(ARCHIVE_DIR, 'audit-reports-2026-07-21', 'PROJECT_PLAN_sneaky.md'), NOISE_TXT)
      commitAll(dir)
      const face = collectIdFace({ root: dir, source: 'HEAD' })
      ok(
        'P1 面可用,且只吃到形状匹配的那一份(同目录 .txt 与子目录件都不算)',
        face.ok === true &&
          face.archiveFiles.length === 1 &&
          face.archiveFiles[0].path === `${ARCHIVE_DIR}/PROJECT_PLAN_2026-09-28_auto-archive.md`,
        `ok=${face.ok} n=${face.archiveFiles.length} paths=${JSON.stringify(face.archiveFiles.map((x) => x.path))} undet=${JSON.stringify(face.undetermined)}`,
      )
      const narrow = familyMaxOn(face.ledgerText)
      const wide = familyMaxOn(face.text)
      ok(
        'P2 **取号必须给 O91 而不是 O14** —— 台账面 max=13 / 台账⊕归档件 max=90',
        narrow === 13 && wide === 90,
        `台账面 max=${narrow} / 宽面 max=${wide}(差 ${wide === null || narrow === null ? '?' : wide - narrow})`,
      )
      ok(
        'P2b 那条 O9 只在归档件里(证明"被搬走的号"这一维真被看见,而不是靠台账残行蒙对)',
        /O9\b/.test(face.text) && !/O9\b/.test(face.ledgerText),
      )
      ok(
        'P3 枚举成功且结果非空 ⇒ 不得记 enumeratedEmpty、不得留未判定',
        face.enumeratedEmpty === false && face.undetermined.length === 0,
      )
      ok(
        'P4 形状筛住的无关件不得混进占用面(O9999 只活在 .txt 与子目录件里)',
        !face.text.includes('O9999'),
      )
      ok('P5 archiveFiles 要带字节数(报告得说清吃了多少内容)', face.archiveFiles[0].bytes > 0)
      ok(
        'P6 子目录里同名形态的件:不进占用面,但必须**报名**(不得静默排除 —— 归档器一改布局这就是唯一哨兵)',
        face.lookAlikeFiles.length === 1 &&
          face.lookAlikeFiles[0] ===
            `${ARCHIVE_DIR}/audit-reports-2026-07-21/PROJECT_PLAN_sneaky.md` &&
          !face.text.includes('O9999') &&
          face.notes.some((n) => n.includes('射程外但同名形态')),
        `lookAlikes=${JSON.stringify(face.lookAlikeFiles)} notes=${JSON.stringify(face.notes)}`,
      )
      ok(
        'P7 报名不影响面的可用性(它是射程边界声明,不是"没判到")',
        face.ok === true && face.undetermined.length === 0,
      )

      // ② 反向对照:两面都找不到 Z 族 ⇒ 不凭空报错,按既有行为交回"判不出"(null)
      ok(
        'R1 Z 族两面都零成员 ⇒ null(判不出),而不是"面坏了"也不是 0',
        familyMaxOn(face.ledgerText, 'Z') === null && familyMaxOn(face.text, 'Z') === null,
      )
      ok('R2 该族零成员不影响面本身可用', face.ok === true)

      // ③ 非台账文档 ⇒ 与改动前逐字同形
      const agents = collectIdFace({ root: dir, source: 'HEAD', doc: 'AGENTS.md' })
      ok(
        'A1 编辑 AGENTS.md 时归档件不适用,占用面 = 该文档自身(不得被台账顶号)',
        agents.archivesApplicable === false &&
          agents.archiveFiles.length === 0 &&
          agents.ok === true &&
          agents.text.includes('AG13') &&
          !agents.text.includes('O90') &&
          agents.notes.some((n) => n.includes('不适用')),
        `applicable=${agents.archivesApplicable} ok=${agents.ok} undet=${JSON.stringify(agents.undetermined)}`,
      )
      ok(
        'A2 同面同轮:调用方传进来自读正文时,本层不再二次派生(结果逐字等于传入值)',
        collectIdFace({
          root: dir,
          source: 'HEAD',
          doc: 'AGENTS.md',
          ledgerText: 'X\n- [ ] AG1 手工底稿',
        }).text === 'X\n- [ ] AG1 手工底稿',
      )

      // ④ 调用方本轮已读到的正文 ⇒ 传入后不再二次派生(同面同轮由构造保证)
      const reused = collectIdFace({ root: dir, source: 'HEAD', ledgerText: LEDGER })
      ok(
        'S1 传 ledgerText 时台账不再重读,而归档件仍从同一面取(max 仍是 90)',
        reused.ok === true && reused.ledgerText === LEDGER && familyMaxOn(reused.text) === 90,
        `ok=${reused.ok} max=${familyMaxOn(reused.text)}`,
      )
    } finally {
      rmScratch(dir)
    }
  }

  // ⑤ 合法零份:仓里有台账、没有归档件目录
  {
    const dir = initRepo()
    try {
      put(dir, LEDGER_DOC, LEDGER)
      commitAll(dir)
      const f = collectIdFace({ root: dir, source: 'HEAD' })
      ok(
        'E1 归档件目录不在 ⇒ 枚举成功且零份 = 合法,面可用',
        f.ok === true && f.enumeratedEmpty === true && f.undetermined.length === 0,
        `ok=${f.ok} empty=${f.enumeratedEmpty} undet=${JSON.stringify(f.undetermined)}`,
      )
      ok(
        'E2 零份时必须有"枚举到 0 份"这句话可打印(不得静默成"看起来完整")',
        f.notes.some((n) => n.includes('0 份')),
      )
      ok(
        'E3 零份 ⇒ 面 = 台账(max 仍是 13,不是 90)',
        familyMaxOn(f.text) === 13,
        `max=${familyMaxOn(f.text)}`,
      )
    } finally {
      rmScratch(dir)
    }
  }

  // ⑥ 枚举失败必须**喊出来**,且绝不按窄面发号
  {
    const bad = collectIdFace({ root: REPO_ROOT, source: 'definitely-not-a-rev-9e3f1a' })
    ok(
      'F1 真派生层:被审面问不到 ⇒ ok=false 且 undetermined 点名原因(绝不返回"完整面")',
      bad.ok === false && bad.undetermined.length >= 1,
      `ok=${bad.ok} undet=${JSON.stringify(bad.undetermined.slice(0, 1))}`,
    )

    const dir = initRepo()
    try {
      put(dir, LEDGER_DOC, LEDGER)
      put(dir, join(ARCHIVE_DIR, 'PROJECT_PLAN_2026-09-28_auto-archive.md'), ARCHIVE)
      commitAll(dir)
      const good = ID_FACE_TRANSPORT
      const f2 = collectIdFace({
        root: dir,
        source: 'HEAD',
        transport: {
          listArchives: () => {
            throw new Error('模拟:ls-tree 非零退出')
          },
          show: (a) => good.show(a),
        },
      })
      ok(
        'F2 枚举抛错 ⇒ 判不出(而不是退化成"零份"继续发号)',
        f2.ok === false &&
          f2.enumeratedEmpty === false &&
          f2.undetermined.some((n) => n.includes('枚举失败')),
        `ok=${f2.ok} empty=${f2.enumeratedEmpty} undet=${JSON.stringify(f2.undetermined)}`,
      )
      ok(
        'F3 枚举失败时交出的 text 就是窄面 ⇒ 只能靠 ok=false 拦住发号(text 本身不构证据)',
        f2.text.includes('O13') && !f2.text.includes('O90') && f2.ok === false,
      )
      const f3 = collectIdFace({
        root: dir,
        source: 'HEAD',
        transport: { listArchives: () => null, show: (a) => good.show(a) },
      })
      ok(
        'F4 清单返回 null(读不出)≠ 零份:判不出,且不得记 enumeratedEmpty',
        f3.ok === false && f3.enumeratedEmpty === false && f3.archiveFiles.length === 0,
      )
      // 列了 2 份只吃到 1 份
      const f4 = collectIdFace({
        root: dir,
        source: 'HEAD',
        transport: {
          listArchives: () => ({
            paths: [
              `${ARCHIVE_DIR}/PROJECT_PLAN_2026-09-28_auto-archive.md`,
              `${ARCHIVE_DIR}/PROJECT_PLAN_ghost.md`,
            ],
            lookAlikes: [],
          }),
          show: ({ root, source, path }) =>
            path.endsWith('PROJECT_PLAN_ghost.md') ? null : good.show({ root, source, path }),
        },
      })
      ok(
        'F5 列出了 2 份只吃到 1 份 ⇒ 点名那份路径并判不出(禁止静默跳过)',
        f4.ok === false && f4.undetermined.some((n) => n.includes('PROJECT_PLAN_ghost.md')),
        `ok=${f4.ok} n=${f4.archiveFiles.length} undet=${JSON.stringify(f4.undetermined)}`,
      )
      ok('F6 吃到的那一份仍进 archiveFiles(报告要说清吃到了哪几份)', f4.archiveFiles.length === 1)
      // 台账自己取不到 ⇒ 面判不出,且不去看归档件
      const f7 = collectIdFace({
        root: dir,
        source: 'HEAD',
        transport: { listArchives: (a) => good.listArchives(a), show: () => null },
      })
      ok(
        'F7 台账取不到 ⇒ 直接判不出,不产出"只有归档件的半张面"',
        f7.ok === false && f7.undetermined.some((n) => n.includes('台账')),
        `undet=${JSON.stringify(f7.undetermined)}`,
      )
    } finally {
      rmScratch(dir)
    }
  }

  // ⑦ 纯函数面:拼接顺序、换行隔离、清单解析
  ok(
    'J1 两份之间必须隔开(末行无换行时不得并成一行)',
    joinFace('a', ['b', 'c']) === 'a\nb\nc',
    JSON.stringify(joinFace('a', ['b', 'c'])),
  )
  ok('J2 台账在最前、归档件按传入序', joinFace('L', ['1', '2']) === 'L\n1\n2')
  ok('J3 bodies 非数组 ⇒ 只回台账(不猜)', joinFace('L', null) === 'L')
  ok(
    'J4 路径必须排序(顺序确定性是硬要求,不是审美)',
    JSON.stringify(
      pickArchivePaths(`${ARCHIVE_DIR}/PROJECT_PLAN_B.md\0${ARCHIVE_DIR}/PROJECT_PLAN_A.md\0\0`),
    ) === JSON.stringify([`${ARCHIVE_DIR}/PROJECT_PLAN_A.md`, `${ARCHIVE_DIR}/PROJECT_PLAN_B.md`]),
  )
  ok('J5 非字符串输入 ⇒ null(判不出),不是空数组(零份)', pickArchivePaths(undefined) === null)
  ok(
    'J6 形状筛:目录第一层的 PROJECT_PLAN*.md 收,其余不收',
    isArchivePath(`${ARCHIVE_DIR}/PROJECT_PLAN_x.md`) === true &&
      isArchivePath(`${ARCHIVE_DIR}/notes.txt`) === false &&
      isArchivePath(`${ARCHIVE_DIR}/audit-reports-2026-07-21/PROJECT_PLAN_sneaky.md`) === false &&
      isArchivePath('PROJECT_PLAN.md') === false,
  )
  ok(
    'J7 同名但更深一层 ⇒ 算 look-alike(报名而不取数),两者不得同时为真',
    isLookAlikePath(`${ARCHIVE_DIR}/audit-reports-2026-07-21/PROJECT_PLAN_sneaky.md`) === true &&
      isLookAlikePath(`${ARCHIVE_DIR}/PROJECT_PLAN_x.md`) === false &&
      isLookAlikePath('docs/PROJECT_PLAN_x.md') === false,
  )
  ok(
    'J8 两类落点必须来自同一次解析:同一份输入各自筛一次,互不吞并对侧',
    JSON.stringify(
      pickArchivePaths(`${ARCHIVE_DIR}/PROJECT_PLAN_A.md\0${ARCHIVE_DIR}/sub/PROJECT_PLAN_B.md\0`),
    ) === JSON.stringify([`${ARCHIVE_DIR}/PROJECT_PLAN_A.md`]) &&
      JSON.stringify(
        pickLookAlikePaths(
          `${ARCHIVE_DIR}/PROJECT_PLAN_A.md\0${ARCHIVE_DIR}/sub/PROJECT_PLAN_B.md\0`,
        ),
      ) === JSON.stringify([`${ARCHIVE_DIR}/sub/PROJECT_PLAN_B.md`]),
  )
  ok('J9 baseNameOf 两种分隔符都拆', baseNameOf('a\\b/PROJECT_PLAN_x.md') === 'PROJECT_PLAN_x.md')
  ok(
    'J10 反斜杠输入也必须认成第一层(Windows 调用方拼的路径)',
    isArchivePath(`${ARCHIVE_DIR}\\PROJECT_PLAN_x.md`) === true,
  )

  const fail = results.filter((x) => !x.pass)
  for (const x of results)
    console.log(
      `  ${x.pass ? '✅' : '❌'} ${x.name}${x.detail && !x.pass ? ` —— ${x.detail}` : ''}`,
    )
  console.log(`\n取号占用面自检:${results.length - fail.length} 通过 / ${fail.length} 失败`)
  return fail.length ? 1 : 0
}

/**
 * `--source` 取值:紧邻 token 必须**存在、非空且不以 `-` 开头**(照抄枚 380431ffc 那条旗标口径)。
 * 无效 ⇒ 退回默认 HEAD **但必须大声点名**:对取号器来说 `--source --json` 静默当成 HEAD,
 * 就是把"我问的是另一个面"写成"我问的就是这个面"。
 * 返回 `{ source, notice }`,notice 为 null 表示完全按缺省走(调用方不打额外行)。
 */
export function resolveSource(argv) {
  const i = argv.indexOf('--source')
  if (i < 0) return { source: 'HEAD', notice: null }
  const raw = argv[i + 1]
  if (typeof raw === 'string' && raw !== '' && !raw.startsWith('-'))
    return { source: raw, notice: null }
  const got = raw === undefined ? '(其后没有任何参数)' : JSON.stringify(raw)
  return { source: 'HEAD', notice: `忽略无效的 --source 值: ${got},已退回默认 HEAD` }
}

function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) return selfTest()
  const allowed = new Set(['--json', '--self-test', '--source'])
  const iSrc = argv.indexOf('--source')
  for (const [i, a] of argv.entries()) {
    // 只在 --source **真的在场**时跳过它的值 —— `iSrc` 为 -1 时 `iSrc+1 === 0`,
    // 于是"跳过取值行"会把**第一个参数**整颗放过:`--bogus-flag` 曾因此被静默接受并 exit 0
    // (由镜像 T5 抓到;未知旗标必须 exit 2,不得"认不出来就当我没问")。
    if (iSrc >= 0 && i === iSrc + 1) continue
    if (a.startsWith('--') && !allowed.has(a)) {
      console.error(`✗ 未知参数 ${a}(可用:--source <rev> / --json / --self-test)`)
      return 2
    }
    if (!a.startsWith('--')) {
      console.error(`✗ 不接受位置参数 ${a}(可用:--source <rev> / --json / --self-test)`)
      return 2
    }
  }
  const { source, notice } = resolveSource(argv)
  if (notice) console.error(`ℹ ${notice}`)
  let face
  try {
    face = collectIdFace({ root: REPO_ROOT, source })
  } catch (e) {
    console.error(`❌ 脚本自身异常:${e?.message ?? e}`)
    return 2
  }
  if (argv.includes('--json')) {
    // **不打正文**:`text` 是台账 ⊕ 归档件(本轮现读 15 MB),把它塞进 JSON 等于让任何调用方
    // 一次读满内存并把它写进日志/报告 —— 遥测不落被审内容,与本仓"遥测不落任何入参值"同一条。
    console.log(
      JSON.stringify(
        {
          ok: face.ok,
          source: face.source,
          doc: face.doc,
          archivesApplicable: face.archivesApplicable,
          enumeratedEmpty: face.enumeratedEmpty,
          archiveFiles: face.archiveFiles,
          lookAlikeFiles: face.lookAlikeFiles,
          undetermined: face.undetermined,
          notes: face.notes,
          bytes: {
            ledger: Buffer.byteLength(face.ledgerText, 'utf8'),
            text: Buffer.byteLength(face.text, 'utf8'),
          },
          familyMax: { ledger: familyMaxOn(face.ledgerText), wide: familyMaxOn(face.text) },
        },
        null,
        2,
      ),
    )
    return face.ok ? 0 : 1
  }
  for (const n of face.notes) console.log(`ℹ ${n}`)
  for (const n of face.undetermined) console.error(`⚠️ 未判定:${n}`)
  console.log(
    `占用面 = ${source}:${LEDGER_DOC}${face.archivesApplicable ? ` + ${face.archiveFiles.length} 份归档件` : '(归档件不适用)'} / ${Buffer.byteLength(face.text, 'utf8')} B / O 族 max=${familyMaxOn(face.text) ?? '判不出'}`,
  )
  console.log(
    face.ok
      ? `✅ 面完整(未判定 ${face.undetermined.length} 条)`
      : `❌ 面判不出 ⇒ 取号出口必须拒绝发号(按窄面发号可能撞上已存在的号)`,
  )
  return face.ok ? 0 : 1
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    const code = main()
    if (code !== 0) process.exit(code)
  } catch (e) {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  }
}

export const __test__ = {
  collectIdFace,
  parseZList,
  pickArchivePaths,
  pickLookAlikePaths,
  isArchivePath,
  isLookAlikePath,
  isDirectArchiveChild,
  baseNameOf,
  joinFace,
  familyMaxOn,
  resolveSource,
  transport: ID_FACE_TRANSPORT,
  LEDGER_DOC,
  ARCHIVE_DIR,
  ARCHIVE_SHAPE,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
