#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 注册表文件「工作树/索引副本必须 ⊇ HEAD 已有条目」对账(票面 G-1058643,2026-10-06 立)
 *
 * ── 立因(现读复核过的前提,不是抄票面)──────────────────────────────
 * 本仓有两类**注册表**:根与各级 `package.json` 的 pnpm `scripts` 键、`scripts/guardian-runner.mjs`
 * 的守门注册块(`id:` + `script:` …)。它们同样是多会话共写的追加式清单,而**磁盘副本在这台机上
 * 会滞后 HEAD**。取版的两条路都吃工作树字节(`safe-commit.mjs` 的无 pathspec 步、旁路落地按工作树
 * 取版本),于是"我只加一条"的一次提交会把别人**刚入库的那条**写回旧形态。
 * 2026-10-06 当天症状:`check:percent-clamp` 在 HEAD 里,而 `pnpm run check:percent-clamp` 报
 * `ERR_PNPM_NO_SCRIPT` —— 工作树副本已经没有这一行。
 *
 * ── 为什么现有三道门都看不见这一格(逐条现读)────────────────────────
 * ① 守门 166 `check-live-doc-pathspec.mjs`:注册块 `stagedTriggers` 现值只有
 *    `PROJECT_PLAN.md / AGENTS.md / README.md` 三份活文档 ⇒ 两份注册表**不在它射程内**。
 * ② `check-stale-revert.mjs` 的 R1 判据是"**暂存 blob 逐字节等于该路径某个祖先提交的版本**"
 *    (源码 L15),而真实事故是"旧副本 ⊕ 别人的新行"= 混合体,逐字节永不等于任何祖先 ⇒ 结构上失明;
 *    它的 R1r 补的是**反方向**(HEAD 已删、祖先写过又被搬回),对"HEAD 有、候选面没有"同样不判。
 * ③ `heal-worktree-tracked.mjs --check` 现读输出"✅ 工作区已跟踪文件存续正常"(RC=0),
 *    它的三条判据里第二条是"**索引里的 blob == HEAD 里的 blob**" ⇒ 只要有人暂过存,这一格就整体
 *    不成立;而且它只恢复"文件被删",对"文件在、少几行"没有判据。
 * ⇒ 这一格此前只有散文(AGENTS §12),没有尺子。本票只交付尺子,**不修工作树滞后那一格**
 *    (那是 `heal-worktree-tracked.mjs --align-drift` 的活,副本属于别人 ⇒ 顺手去改是越权)。
 *
 * ── 判什么(两类,分开报数,绝不折叠成一个数)──────────────────────────
 *   **P1 缺失**:HEAD 有的条目行,候选面没有(pnpm `scripts` 键 / runner 注册块)。
 *   **P2 改写**:候选面把那一行改成了另一种写法 ⇒ 判据是**逐行等值**(条目行数组逐元素比);
 *     刻意不用"行数相等"糊过去 —— 行数等而正文漂开正是这一型最常见的形状(自检 S15 钉住:
 *     把这条判据换成行数比较,S15 必须变红)。
 *   **未判定**:逐行不等**但语义等值**(JSON 键序变化、prettier 缩进/引号重排)⇒ 落"未判定"
 *     并逐条点名,**既不算 P2 也不算通过**。出路是语义等值比较器(本门的 JSON 值比较 /
 *     runner 字段归一化比较),而不是放松判据。
 *   覆盖面如实登记:只判 `scripts` 映射与 runner 注册块;`devDependencies` 等其它 JSON 映射、
 *     以及 runner 里非注册块的改动**不在射程**(未覆盖 ≠ 通过)。
 *
 * ── 取材(基准恒为 HEAD blob;候选面 = 下一次提交真正会交付的那一份)──────
 *   缺省(全量/人工审计)候选面 = **工作树磁盘副本**:它正是"无 pathspec 提交会交付的东西"。
 *   `--staged`(提交链)候选面 = **索引 blob**:本次提交的内容,归本提交人负责。
 *   `--worktree` = 显式指名磁盘档(与缺省同面,供人工取证);两面旗同给 ⇒ **exit 2**。
 *   清单取自**基准面(HEAD 树)** —— 要存续的行住在 HEAD,候选面的存在性再按候选面自身核验
 *     (索引档查 `ls-files`,磁盘档查落盘可读),**不靠"盘上大概有"猜,也不 readdir 当凭据**;
 *     两侧正文各一次批量读满 ⇒ 清单与内容同面同轮,不混面。
 *   台账同理(守门 118 判的正是"管子共用不等于面共用"这一型):**正文只按候选面取**
 *     (索引档 `:${EXEMPT_LEDGER}`、磁盘档 `readWorktreeFile(root, EXEMPT_LEDGER)`),
 *     HEAD 那一条规格**只问"出口在不在基准面上"**(用于 ④ 的归因措辞分岔),
 *     绝不用 HEAD 的内容去兜候选面的正文 ⇒ 取不到就是取不到,不回落另一个面。
 *   ⚠️ 枚举到 0 个注册表文件 ⇒ **exit 2 判死**,绝不记绿(空扫与"都没违规"同形)。
 *
 * ── 定级(失效方向只能是"多要一次定向说明",绝不是"多放一次跳门")────────
 *   缺省(磁盘档)**只报数不判红**:工作树副本此刻属于别的会话,当场判红就是把别人的在飞状态
 *     算成本提交人的账 ⇒ 结局是每个会话 `--no-verify`,连带链上约 190 道门对该提交作废(§12e)。
 *   `--strict` = 问责档:同一判据、同一计数,只是让磁盘档也判红(人工巡检/追责时用)。
 *   `--staged` = 提交链档:索引是**本次提交自己的内容**,P1/P2 即判红。
 *   唯一的"有意删除"出口(与 §12 同向,要求的是说明而不是放行):候选面上落一份
 *     `scripts/data/registry-superset-exemptions.json`(受版本控制的 JSON 台账,与
 *     credential-presence / deletion-survival 两份同侪同形、同字段风格),逐条
 *     `{"path":…,"entry":…,"reason":"成句","reviewBy":"YYYY-MM-DD"}` —— 被豁免的条目**仍然点名**
 *     并计入 `豁免` 维。为什么不给行内标记:要豁免的那一行**正是消失的那一行**,把标记挂在它身上
 *     等于让出口随证据一起消失。
 *   ⚠️ 台账自身的五型判据(2026-10-06 补,现读复核过的前提):台账此前住在 `.ihui-agent/` 下,
 *     被本仓 `.gitignore` 的 `.ihui-agent/*` 整条吞掉 ⇒ 干净签出拿不到它,门的行为随机器而变
 *     ("这台机上有豁免、那台机上没有"),而换机那一次的红**没有可查出处**。守门 13c(可核验指针
 *     必须真住在被审面上)与守门 107 的 P5(可审计锚点必须受版本控制)教的就是同一课:
 *     凡被 blocking 门要求必须存在的文件,其路径要先过面判据或至少过 `git check-ignore`;
 *     写进 `.ihui-agent/` 的引用不叫证据,叫机器-local 巧合。搬进 `scripts/data/` 之后补五型:
 *       ① 条目缺 path/entry/reason/reviewBy 任一 ⇒ **红**(不得当空表用,该条同时不生效);
 *       ② `reviewBy` 过期 ⇒ **红**且豁免即时失效(出路只有"补证据续期"或"删条目并修好实现");
 *       ③ 登记了、而被审面上并没有"HEAD 有、候选面无"的这一条 ⇒ **红(清单腐烂)**:台账是债清单
 *          不是豁免清单,债已清仍挂账就是腐烂;该路径本轮根本没被审到 ⇒ 落**未判定**,不判腐烂
 *          (把"没看"写成"看了没命中"是本仓最高频的失效型);
 *       ④ 候选面取不到整份台账 ⇒ **红**并点名"出口不在被审面",绝不折成"零豁免"记绿 —— 这一型
 *          正是本格要治的病,镜像测试与自检各钉一条,拿不到文件必须响亮认错而不是安静通过;
 *       ⑤ JSON 解析失败/形状不对 ⇒ **无法判定**(既不记绿也不判红),坏 JSON 静默当空台账不行。
 *   定级(台账维):①—④ 计入 `台账` 维,**只随 `--strict` 判红**(见 `ledgerBlocking()`),
 *     缺省档与 `--staged` 档逐条点名但不判红。为什么:这四型都是**面的状态**而不是本提交的动作 ——
 *     台账还没被 `git add`(或并行会话正在编辑它)时当场判红,就是把别人的在飞状态算成本提交人的
 *     账,唯一结局仍是人人 `--no-verify`(§12e,连带链上约 190 道门对该提交作废)。⑤ 是"读不出输入",
 *     `--staged`/`--strict` 档直接 exit 2 拒绝开清洁单,缺省档点名后仍只报数。
 *     **升 blocking 的前置(写在代码里,别只写在票面上)**:(a) 本台账已进 HEAD(落地本改动即成立,
 *     由主会话同轮 `git add` 这份 JSON),(b) 真仓 `--worktree --strict` 档的 `台账` 维 = 0,
 *     (c) 两条都成立后把 `ledgerBlocking()` 改成 `res.face === 'staged' || !!res.strict`,
 *     并取消 ⑤ 在缺省档的豁免。做到之前,任何"台账判据已进提交链"的措辞都不得写进本文与报告。
 *     现值如实登记:真仓 entries = 0(旧 jsonl 从未落盘、从未入库 ⇒ 迁移条目数 0,不是清空债)。
 *   紧急跳过仍走 runner 的 skipEnv(不在本门里),但编号/旗名一律以 `guardian-runner.mjs` 现值为准。
 *
 * 用法:node scripts/check-registry-worktree-superset.mjs [--staged|--worktree|--strict|--self-test|--json]
 * 退出码:0 通过或只报数 / 1 检出 P1|P2(提交链档,或缺省档叠加 `--strict`)/
 *         2 无法判定(枚举到 0 个注册表文件、两面旗同给、取材失败、自检之外的脚本异常)
 *
 * 注册状态:**本门尚未接线**(注册表由主会话单写者接线)。任何声称"已经进提交链"的措辞都不得
 *   写进本文 —— 那是守门 89 R2 的恒红形态。
 */
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { catBatch, gitRaw, readWorktreeFile, selectFace, Undetermined } from './lib/face-reader.mjs'
import { maskComments } from './lib/code-mask.mjs'

const SELF_DIR = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(dirname(SELF_DIR))

/** runner 注册表(唯一一份,按路径点名)。 */
export const RUNNER_PATH = 'scripts/guardian-runner.mjs'
/**
 * 有意删除的唯一出口,住在**候选面**上 —— 因此它必须受版本控制。
 * 旧值住在 `.ihui-agent/` 下,被 `.gitignore` 的 `.ihui-agent/*` 整条吞掉:干净签出拿不到 ⇒
 * 豁免只在作者机上生效,门换机变红且红无出处(2026-10-06 收口,见文件头"台账五型判据")。
 */
export const EXEMPT_LEDGER = 'scripts/data/registry-superset-exemptions.json'
/** 台账必填字段:path+entry 定"免哪一条",reason 定"替谁免检",reviewBy 定"这笔债何时必须重裁"。 */
export const LEDGER_FIELDS = ['path', 'entry', 'reason', 'reviewBy']

/** 射程枚举:各级 package.json(排除 node_modules)与 runner 注册表。 */
export function isRegistryPath(p) {
  const s = String(p ?? '').replace(/\\/g, '/')
  if (s === RUNNER_PATH) return true
  if (s.includes('node_modules/')) return false
  return s === 'package.json' || s.endsWith('/package.json')
}

/** 枚举过滤(唯一入口;`collect` 只把它作用在 **HEAD 面**清单上 ⇒ 未被跟踪的文件不参与)。 */
export function filterRegistry(paths) {
  return [...paths].filter(isRegistryPath)
}

const indentOf = (l) => (String(l).match(/^\s*/) || [''])[0].length
const splitLines = (t) => String(t ?? '').split(/\r?\n/)

/**
 * `package.json` 的 `scripts` 条目提取:键 → {lines(逐字行), value(解析后的命令串)}。
 * 行组靠"同级键行定界"取,所以多行值也会整段落进同一条目;解析失败只报 error,不返回空表
 * (空表会被下游读成"没有条目"= 通过)。
 */
export function extractPkgEntries(text) {
  const lines = splitLines(text)
  let parsed = null
  let parseError = ''
  try {
    parsed = JSON.parse(text)
  } catch (e) {
    parseError = `JSON 解析失败:${String(e.message).split(/\r?\n/)[0].slice(0, 90)}`
  }
  // 解析不了就是"读不出",不许退化成"没有条目"(那会把坏文件判成整表 P1 或整表通过)
  if (parseError) return { ok: false, entries: new Map(), order: [], hasScripts: false, error: parseError }
  let head = null
  for (let i = 0; i < lines.length; i++) {
    const m = /^(\s*)"scripts"\s*:\s*\{/.exec(lines[i])
    if (m && (head === null || m[1].length < head.indent.length)) head = { i, indent: m[1] }
  }
  if (!head) return { ok: true, entries: new Map(), order: [], hasScripts: false, error: '' }
  let end = -1
  for (let j = head.i + 1; j < lines.length; j++) {
    if (indentOf(lines[j]) === head.indent.length && /^\s*\}/.test(lines[j])) {
      end = j
      break
    }
  }
  if (end < 0) return { ok: false, entries: new Map(), order: [], hasScripts: true, error: 'scripts 块右边界未定位' }
  const keyRe = new RegExp(
    `^\\s{${head.indent.length + 2},}"((?:[^"\\\\]|\\\\.)*)"\\s*:`,
  )
  const marks = []
  for (let j = head.i + 1; j < end; j++) {
    const m = keyRe.exec(lines[j])
    if (m) marks.push({ j, key: JSON.parse(`"${m[1]}"`) })
  }
  const scripts = parsed && parsed.scripts && typeof parsed.scripts === 'object' ? parsed.scripts : null
  const entries = new Map()
  const order = []
  marks.forEach((mk, idx) => {
    const stop = idx + 1 < marks.length ? marks[idx + 1].j : end
    entries.set(mk.key, {
      lines: lines.slice(mk.j, stop),
      value: scripts && Object.prototype.hasOwnProperty.call(scripts, mk.key) ? scripts[mk.key] : null,
    })
    order.push(mk.key)
  })
  return {
    ok: parseError === '',
    entries,
    order,
    hasScripts: true,
    error: parseError,
  }
}

/**
 * runner 注册块提取:`id:` 行 → 上溯最近的裸 `{` 行定界,块尾取同缩进的 `}` 行。
 * 结构性比较读**遮注释后**的文本(注释漂开不该算改写),逐字行仍取原文 —— 报告里要点名的是原文。
 * 缩进众数过滤:嵌套对象里的 `id:` 不是注册块,众数之外的一律记"定位失败"而不是悄悄丢掉。
 */
export function extractRunnerEntries(text) {
  const raw = splitLines(text)
  const masked = splitLines(maskComments(text))
  const idRe = /^\s*id:\s*['"]([^'"]+)['"]\s*,?\s*$/
  const hits = []
  for (let i = 0; i < raw.length; i++) {
    const m = idRe.exec(raw[i])
    if (m) hits.push({ i, id: m[1] })
  }
  const blocks = []
  const failed = []
  for (const h of hits) {
    let open = -1
    for (let j = h.i - 1; j >= 0; j--) {
      const t = (masked[j] ?? '').trim()
      if (!t) continue
      if (t === '{') {
        open = j
        break
      }
      break
    }
    if (open < 0 || indentOf(raw[h.i]) <= indentOf(raw[open])) {
      failed.push(h.id)
      continue
    }
    let close = -1
    for (let j = h.i + 1; j < raw.length; j++) {
      if (
        indentOf(masked[j]) === indentOf(raw[open]) &&
        (masked[j].trim() === '}' || masked[j].trim() === '},')
      ) {
        close = j
        break
      }
    }
    if (close < 0) {
      failed.push(h.id)
      continue
    }
    blocks.push({ id: h.id, open, close, indent: indentOf(raw[open]) })
  }
  const hist = new Map()
  for (const b of blocks) hist.set(b.indent, (hist.get(b.indent) || 0) + 1)
  let dom = null
  for (const [ind, c] of hist) if (dom === null || c > hist.get(dom)) dom = ind
  const kept = blocks.filter((b) => b.indent === dom)
  for (const b of blocks) if (b.indent !== dom) failed.push(b.id)
  const entries = new Map()
  const order = []
  const dup = []
  for (const b of kept) {
    const lines = raw.slice(b.open, b.close + 1)
    if (entries.has(b.id)) dup.push(b.id)
    entries.set(b.id, { lines, value: normalizeBlock(masked.slice(b.open, b.close + 1)) })
    if (!dup.includes(b.id)) order.push(b.id)
  }
  return {
    ok: kept.length > 0,
    entries,
    order,
    failed: [...new Set(failed)],
    dup: [...new Set(dup)],
    error: kept.length > 0 ? '' : '未定位到任何注册块(缩进判据不成立)',
  }
}

/** 注册块的语义指纹:剥注释、并空白、统一引号 ⇒ 只有真改了字段值才会变。 */
export function normalizeBlock(lines) {
  return lines
    .map((l) =>
      String(l)
        .replace(/\/\/[^\n]*/g, '')
        .replace(/['"]/g, '')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter((l) => l !== '')
    .join(' ')
}

export function extract(path, text) {
  return path === RUNNER_PATH ? extractRunnerEntries(text) : extractPkgEntries(text)
}

/**
 * 豁免台账(JSON,与 credential-presence / deletion-survival 两份同侪同形)。
 * **逐字段严取,绝不把坏文件当空表**:解析失败/形状不对 ⇒ `broken`(调用方判"无法判定");
 * 条目缺必填字段 ⇒ 进 `bad`(台账判据①,红)且该条**不生效**(照计 P1),但绝不静默丢弃。
 * `entries: []` 是合法状态 = 如实的零豁免(与"读不到台账"在判据④里分开,后者是红)。
 * 为什么改成 JSON 而不是留着逐行式:一行一个对象的格式里坏一行只让那一行失去凭据,其余豁免
 * 照样生效 —— 那正是"没人发现自己台账已经烂了一半"的形状;JSON 坏了整份读不出,只能报"无法判定"。
 */
export function parseLedger(text) {
  if (text === null || text === undefined) return { ok: new Map(), bad: [], present: false, broken: null }
  let parsed = null
  try {
    parsed = JSON.parse(text)
  } catch (e) {
    return {
      ok: new Map(),
      bad: [],
      present: true,
      broken: `台账 JSON 解析失败:${String(e.message).split(/\r?\n/)[0].slice(0, 90)}`,
    }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || !Array.isArray(parsed.entries)) {
    return {
      ok: new Map(),
      bad: [],
      present: true,
      broken: '台账形状不对:顶层必须是对象且 `entries` 必须是数组 ⇒ 无法判定(坏 JSON 不得当空台账用)',
    }
  }
  const ok = new Map()
  const bad = []
  for (const rec of parsed.entries) {
    const p = String(rec?.path ?? '').replace(/\\/g, '/')
    const entry = String(rec?.entry ?? '')
    const reason = String(rec?.reason ?? '').trim()
    const reviewBy = String(rec?.reviewBy ?? '').trim()
    const miss = []
    if (!p) miss.push('path')
    if (!entry) miss.push('entry')
    if (!reason) miss.push('reason')
    if (!reviewBy) miss.push('reviewBy')
    const key = `${p}#${entry}`
    if (miss.length) {
      bad.push({ key, path: p, why: `条目字段不齐:缺 ${miss.join('/')}(四字段都必填,裸标记不生效)` })
      continue
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(reviewBy)) {
      bad.push({ key, path: p, why: `reviewBy 不是 YYYY-MM-DD:${reviewBy.slice(0, 24)}` })
      continue
    }
    if (ok.has(key)) {
      bad.push({ key, path: p, why: '同一 path#entry 重复登记 ⇒ 键轴不唯一,交人工(不判绿)' })
      continue
    }
    ok.set(key, { path: p, entry, reason, reviewBy })
  }
  return { ok, bad, present: true, broken: null }
}

/** 复核日是否还活着(判据②:过期即失效,不再放行任何写回)。纯函数 ⇒ 镜像与自检都直接调它。 */
export function entryLive(rec, today) {
  return String(rec?.reviewBy ?? '') >= String(today)
}

/**
 * 台账判据核心(判据①②③④,纯函数 ⇒ 全部可构造,不靠真仓状态)。
 * `p1Keys` = 被审面上**真的**"HEAD 有、候选面无"的那些 key(含已被豁免的)⇒ 腐烂只对没站上车的
 * 条目判;`scopePaths` = 本轮真被审到的文件 ⇒ 路径没进射程时判不出腐烂,落未判定(不把"没看"写成
 * "看了没命中")。返回 { defects(红), unjudged(未判定), broken(无法判定), absent }。
 */
export function judgeLedger({ ledger, p1Keys, scopePaths, today, presentOnBase }) {
  const defects = []
  const unjudged = []
  if (!ledger.present) {
    defects.push({
      key: '(整份台账)',
      path: EXEMPT_LEDGER,
      why: presentOnBase
        ? '台账在 HEAD 面有、候选面上取不到 ⇒ 本提交把唯一出口删掉了:要么把文件加回来,要么逐条写明为什么不再需要出口(空表不等于没有出口)'
        : `候选面取不到台账 ${EXEMPT_LEDGER}(未 add / 已删 / 干净签出拿不到)⇒ 本轮**没有任何豁免可被核验**,不得折成"零豁免"记绿`,
    })
    return { defects, unjudged, broken: null, absent: true }
  }
  if (ledger.broken) return { defects, unjudged, broken: ledger.broken, absent: false }
  for (const b of ledger.bad) defects.push({ key: b.key, path: b.path, why: b.why })
  for (const [key, rec] of ledger.ok) {
    if (!entryLive(rec, today))
      defects.push({
        key,
        path: rec.path,
        why: `复核日 ${rec.reviewBy} 已过(基准日 ${today})⇒ 豁免即时失效,必须重新裁一次(补证据续期)或删条目并修好实现`,
      })
  }
  for (const [key, rec] of ledger.ok) {
    if (!entryLive(rec, today)) continue // 过期另有判据②,不在同一行上叠第二层红
    if (p1Keys.has(key)) continue
    if (!scopePaths.has(rec.path)) {
      unjudged.push({ key, path: rec.path, why: '该路径本轮不在射程内(没被审到)⇒ 判不出腐烂,落未判定' })
      continue
    }
    defects.push({
      key,
      path: rec.path,
      why: '清单腐烂:登记了豁免,而被审面上并没有"HEAD 有、候选面无"的这一条 ⇒ 台账是债清单不是豁免清单,债已清仍挂账',
    })
  }
  return { defects, unjudged, broken: null, absent: false }
}

/** 台账维的问责档(见文件头"升 blocking 的前置")。改这一行就是升档,别在调用处各写一份。 */
export function ledgerBlocking(res) {
  return !!res.strict
}

/**
 * 单文件判定核心(纯函数,与取材分开 ⇒ 自检能构造)。
 * 三态严格分开:p1 / p2 / und;pass 只统计"逐字等值"的条目,绝不与 und 合并。
 */
export function judgeFile({ path, headText, candText, candAbsent, ledger }) {
  const r = { path, p1: [], p2: [], und: [], exempted: [], pass: 0, headEntries: 0, candEntries: 0 }
  if (candAbsent) {
    r.und.push({ entry: '(整个文件)', why: '候选面取不到该路径(文件被删/未暂存),不判绿' })
    return r
  }
  const H = extract(path, headText)
  const C = extract(path, candText)
  if (!H.ok) {
    r.und.push({ entry: '(整个文件)', why: `HEAD 面抽取失败:${H.error}` })
    return r
  }
  if (!C.ok) {
    r.und.push({ entry: '(整个文件)', why: `候选面抽取失败:${C.error}` })
    return r
  }
  r.headEntries = H.entries.size
  r.candEntries = C.entries.size
  // 抽取器自己"看不见"的条目不许蒸发:定位失败/重号一律点名成未判定。
  if (H.failed && H.failed.length) {
    r.und.push({ entry: '(HEAD 侧)', why: `${H.failed.length} 个注册块定位失败:${H.failed.slice(0, 5).join(',')}` })
  }
  for (const f of C.failed || []) {
    if (H.entries.has(f)) r.und.push({ entry: f, why: '候选面该注册块定位失败 ⇒ 无法判定(不得当成通过)' })
  }
  for (const d of [...new Set([...(C.dup || []), ...(H.dup || [])])]) {
    r.und.push({ entry: d, why: '同一 id 出现多块 ⇒ 键轴不唯一,交人工(不判绿)' })
  }
  const linesEqual = (a, b) => {
    if (!a || !b) return false
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
    return true
  }
  for (const [key, h] of H.entries) {
    if (key === '(未定位)') continue
    if (!C.entries.has(key)) {
      const why = 'HEAD 有该条目,候选面整条不见(P1 型写回)'
      const rec = ledger && ledger.ok ? ledger.ok.get(`${path}#${key}`) : null
      if (rec && String(rec.reason || '').trim())
        r.exempted.push({
          entry: key,
          why: `${why};豁免理由:${rec.reason}(复核至 ${rec.reviewBy})`,
        })
      else r.p1.push({ entry: key, why })
      continue
    }
    const c = C.entries.get(key)
    if (linesEqual(h.lines, c.lines)) {
      r.pass += 1
      continue
    }
    if (String(h.value) === String(c.value)) {
      r.und.push({
        entry: key,
        why: '逐行不等但语义等值(键序/缩进/引号重排)⇒ 未判定,不算 P2 也不算通过',
      })
      continue
    }
    const diff = []
    const max = Math.max(h.lines.length, c.lines.length)
    for (let i = 0; i < max; i++) {
      const a = h.lines[i] ?? '(无)'
      const b = c.lines[i] ?? '(无)'
      if (a !== b) diff.push(`L${i + 1} HEAD「${String(a).trim().slice(0, 70)}」↔ 候选「${String(b).trim().slice(0, 70)}」`)
    }
    r.p2.push({
      entry: key,
      why: `逐行不等(行数 ${h.lines.length}↔${c.lines.length}):${diff.slice(0, 3).join(' | ')}`,
    })
  }
  const headOrderKey = H.order.join('\u0000')
  const candOrderKey = C.order.filter((k) => H.entries.has(k)).join('\u0000')
  if (headOrderKey !== candOrderKey && r.p1.length === 0) {
    r.und.push({ entry: '(条目顺序)', why: 'HEAD 与候选面的条目排列不同 ⇒ 未判定(逐行集合等值不解释顺序漂开)' })
  }
  // 台账里指向**本文件**的畸形条目就地点名(不再按注册表份数把同一句刷 N 遍;
  // 台账整体判据①②③④住在 judgeLedger,由 run() 汇总 ⇒ 镜像测的 und 计数不双记)。
  for (const b of ledger && ledger.bad ? ledger.bad : []) {
    if (b.path === path) r.und.push({ entry: '(豁免账)', why: b.why })
  }
  return r
}

/** 清单(基准面=HEAD 树)+ 存在性按候选面核验 + 两侧正文各一次批量读满。 */
export function collect({ root, face }) {
  const headPaths = String(
    gitRaw(['ls-tree', '-r', '--name-only', 'HEAD'], root, { timeout: 60000 }) ?? '',
  )
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((p) => p)
  // 清单只按 HEAD 面 ⇒ 候选面(盘上/索引)里"HEAD 没有"的注册表文件不参与判定
  const listed = filterRegistry(headPaths)
  if (listed.length === 0) {
    return { paths: [], enumerated: 0, error: 'HEAD 面枚举到 0 个注册表文件' }
  }
  let present = listed
  if (face === 'staged') {
    const idx = new Set(
      String(gitRaw(['ls-files', '--'], root, { timeout: 60000 }) ?? '')
        .split(/\r?\n/)
        .map((s) => s.trim()),
    )
    present = listed.filter((p) => idx.has(p))
  }
  const headSpecs = listed.map((p) => `HEAD:${p}`)
  const candSpecs = face === 'staged' ? present.map((p) => `:${p}`) : []
  const headMap = catBatch(root, headSpecs, { timeout: 120000 })
  const candIndex = face === 'staged' ? catBatch(root, candSpecs, { timeout: 120000 }) : null
  const files = listed.map((p) => {
    const headText = headMap.get(`HEAD:${p}`)
    let candText = null
    if (headText === undefined || headText === null) {
      return { path: p, headText: null, candText: null, headAbsent: true }
    }
    if (face === 'staged') candText = present.includes(p) ? candIndex.get(`:${p}`) ?? null : null
    else candText = readWorktreeFile(root, p)
    return { path: p, headText, candText, headAbsent: false }
  })
  // 台账与注册表同轮取样,但**各按各自的面**:
  //   候选面正文 = 索引档 `:path` / 磁盘档 readWorktreeFile(与上面 candText 同一档,不混面);
  //   HEAD 规格只用来问"出口在不在基准面上"(判据④ 的归因措辞分岔),绝不拿它兜候选面正文。
  const ledgerSpecs =
    face === 'staged' ? [`HEAD:${EXEMPT_LEDGER}`, `:${EXEMPT_LEDGER}`] : [`HEAD:${EXEMPT_LEDGER}`]
  const lm = catBatch(root, ledgerSpecs, { timeout: 60000 })
  const baseBlob = lm.get(`HEAD:${EXEMPT_LEDGER}`)
  let ledgerText = null
  if (face === 'staged') ledgerText = lm.get(`:${EXEMPT_LEDGER}`) ?? null
  else ledgerText = readWorktreeFile(root, EXEMPT_LEDGER)
  return {
    paths: listed,
    files,
    enumerated: listed.length,
    ledgerText,
    ledgerOnBase: baseBlob !== null && baseBlob !== undefined,
    error: null,
  }
}

/** 一次完整审计(纯口径 + 取材 + 台账判据都在此,镜像测试与自检都走它)。 */
export function run({ root = REPO_ROOT, face = 'worktree', strict = false, today = null } = {}) {
  const res = {
    face,
    strict,
    day: String(today || new Date().toISOString().slice(0, 10)),
    docs: [],
    p1: 0,
    p2: 0,
    und: 0,
    exempted: 0,
    led: 0,
    ledDefects: [],
    ledUnjudged: [],
    ledgerAbsent: false,
    ledgerBroken: null,
    enumerated: 0,
    error: null,
  }
  let got
  try {
    got = collect({ root, face })
  } catch (e) {
    res.error = e instanceof Undetermined ? e.message : `取材异常:${String(e && e.message).slice(0, 120)}`
    return res
  }
  if (got.error) {
    res.error = got.error
    return res
  }
  res.enumerated = got.enumerated
  const ledger = parseLedger(got.ledgerText)
  // 判据②:过期即失效 —— 过期的复核日不再豁免任何写回(失效本身另由 judgeLedger 记一条红)。
  const active = new Map([...ledger.ok].filter(([, rec]) => entryLive(rec, res.day)))
  const ledgerForFile = { ok: active, bad: ledger.bad, present: ledger.present }
  for (const f of got.files) {
    if (f.headAbsent) {
      res.docs.push({
        path: f.path,
        p1: [],
        p2: [],
        und: [{ entry: '(整个文件)', why: 'HEAD 面取不到该路径 ⇒ 无法判定(不判绿)' }],
        exempted: [],
        pass: 0,
        headEntries: 0,
        candEntries: 0,
      })
      continue
    }
    res.docs.push(
      judgeFile({
        path: f.path,
        headText: f.headText,
        candText: f.candText,
        candAbsent: f.candText === null,
        ledger: ledgerForFile,
      }),
    )
  }
  // 台账判据①②③④:p1Keys = 被审面上真的"HEAD 有、候选面无"(含被豁免的);scopePaths = 本轮真审到的路径
  const p1Keys = new Set()
  const scopePaths = new Set()
  for (const d of res.docs) {
    if (d.headEntries > 0 || d.candEntries > 0 || d.p1.length || d.p2.length) scopePaths.add(d.path)
    for (const x of d.p1) p1Keys.add(`${d.path}#${x.entry}`)
    for (const x of d.exempted) p1Keys.add(`${d.path}#${x.entry}`)
  }
  const lj = judgeLedger({
    ledger,
    p1Keys,
    scopePaths,
    today: res.day,
    presentOnBase: got.ledgerOnBase,
  })
  res.ledDefects = lj.defects
  res.ledUnjudged = lj.unjudged
  res.ledgerAbsent = lj.absent
  res.ledgerBroken = lj.broken
  res.led = lj.defects.length
  if (lj.broken) {
    // 判据⑤:读不出输入。问责档(staged/strict)= 拒绝开清洁单 exit 2;
    // 缺省(磁盘)档只报数:盘上这一份可能正被并行会话编辑(§12e 同型),但必须点名,绝不静默。
    if (face === 'staged' || strict) res.error = lj.broken
    else res.ledUnjudged.push({ key: '(整份台账)', path: EXEMPT_LEDGER, why: lj.broken })
  }
  for (const d of res.docs) {
    res.p1 += d.p1.length
    res.p2 += d.p2.length
    res.und += d.und.length
    res.exempted += d.exempted.length
  }
  res.und += res.ledUnjudged.length
  return res
}

/** 结论行(永远最后打印,一行读完五个维度)。 */
export function conclusion(res, { blocking }) {
  const faceLabel = res.face === 'staged' ? '候选=索引 blob' : '候选=工作树磁盘'
  const tier = blocking ? '问责(判红)' : '只报数(不判红)'
  const ledTier = ledgerBlocking(res) ? '问责(判红)' : '只报数(不判红)'
  return (
    `结论:${faceLabel},基准=HEAD blob,档=${tier}(台账维档=${ledTier}) ⇒ ` +
    `P1 缺失 ${res.p1} 条 / P2 改写 ${res.p2} 条 / 未判定 ${res.und} 条 / 豁免 ${res.exempted} 条 / ` +
    `台账判据 ${res.led || 0} 条 / 注册表文件 ${res.enumerated} 份`
  )
}

export function report(res, { json = false } = {}) {
  const blocking = res.face === 'staged' || res.strict
  const ledBlocking = ledgerBlocking(res)
  if (res.error) {
    console.error(`❌ 无法判定:${res.error}(既不记绿也不判红)`)
    return 2
  }
  if (!res.enumerated) {
    console.error('❌ 枚举到 0 个注册表文件 ⇒ 判死(空扫与"都没违规"同形,不得记通过)')
    return 2
  }
  if (json) {
    console.log(JSON.stringify({ ...res, blocking, ledBlocking }))
    if (blocking && res.p1 + res.p2 > 0) return 1
    return ledBlocking && res.led > 0 ? 1 : 0
  }
  for (const d of res.docs) {
    if (!d.p1.length && !d.p2.length && !d.und.length) continue
    console.log(`📄 ${d.path}(HEAD 条目 ${d.headEntries} 条,候选条目 ${d.candEntries} 条)`)
    for (const x of d.p1) console.log(`   ❌ [P1 缺失] ${x.entry}:${x.why}`)
    for (const x of d.p2) console.log(`   ❌ [P2 改写] ${x.entry}:${x.why}`)
    for (const x of d.exempted) console.log(`   ✅ [豁免] ${x.entry}:${x.why}`)
    for (const x of d.und) console.log(`   ❓ [未判定] ${x.entry}:${x.why}`)
  }
  // 台账判据(①字段 ②过期 ③腐烂 ④不在面 ⑤坏 JSON):任何一档都逐条点名,缺省档只是不判红。
  if (res.led > 0 || (res.ledUnjudged && res.ledUnjudged.length)) {
    console.log(
      `📗 台账判据(${EXEMPT_LEDGER},档=${ledBlocking ? '问责(判红)' : '只报数(不判红)'},基准日 ${res.day || '?'})`,
    )
    for (const x of res.ledDefects || []) console.log(`   ❌ [台账] ${x.key}:${x.why}`)
    for (const x of res.ledUnjudged || []) console.log(`   ❓ [台账·未判定] ${x.key}:${x.why}`)
  }
  if (res.p1 + res.p2 > 0 && !blocking) {
    console.log(
      'ℹ️ 缺省档只报数:工作树副本此刻属于别的会话,当场判红 = 把别人的在飞状态算成本提交人的账 ⇒',
    )
    console.log('   唯一结局是每个会话 --no-verify(§12e,连带约 190 道门作废)。要问责请用 --strict。')
    console.log(
      `   确属有意删除:在候选面落 ${EXEMPT_LEDGER} 的一条 {path,entry,reason,reviewBy}` +
        '(四字段必填,不带原因/复核日不生效;过期即失效;登记了却没用上=清单腐烂)。',
    )
  }
  console.log(conclusion(res, { blocking }))
  if (blocking && res.p1 + res.p2 > 0) return 1
  return ledBlocking && res.led > 0 ? 1 : 0
}

/* ------------------------------------------------------------------ 自检 */

const PKG_A = [
  '{',
  '  "name": "x",',
  '  "scripts": {',
  '    "check:a": "node 1",',
  '    "check:b": "node 2",',
  '    "check:c": "node 3",',
  '    "check:d": "node 4",',
  '    "check:e": "node 5"',
  '  },',
  '  "deps": {}',
  '}',
].join('\n')
/** 中间两键互换:每一条目的逐字行(含行尾逗号)都没变,只有排列变了 ⇒ 纯换序夹具。 */
const PKG_REORDER = [
  '{',
  '  "name": "x",',
  '  "scripts": {',
  '    "check:a": "node 1",',
  '    "check:c": "node 3",',
  '    "check:b": "node 2",',
  '    "check:d": "node 4",',
  '    "check:e": "node 5"',
  '  },',
  '  "deps": {}',
  '}',
].join('\n')
/** 键与值一字未改,只有缩进被重排(prettier 型) ⇒ 逐行不等、语义等值。 */
const PKG_REFLOW = PKG_A.replace('    "check:b": "node 2",', '      "check:b": "node 2",')
const PKG_DROP_B = PKG_A.replace('    "check:b": "node 2",\n', '')
const RUNNER_A = [
  'const gates = [',
  '  {',
  "    id: '10',",
  "    script: 'a.mjs',",
  "    mode: 'blocking',",
  '    args: [],',
  '  },',
  '  {',
  "    id: '11',",
  "    script: 'b.mjs',",
  "    mode: 'blocking',",
  '  },',
  ']',
].join('\n')

const led = (recs) => parseLedger(JSON.stringify({ entries: recs }))
/** 台账判据的构造入口(判据住在 judgeLedger,自检只喂面、不抄判据)。 */
const ledJudge = (recs, { p1Keys = [], scope = ['package.json'], today = '2026-10-06', presentOnBase = true } = {}) =>
  judgeLedger({
    ledger: parseLedger(recs === null ? null : typeof recs === 'string' ? recs : JSON.stringify({ entries: recs })),
    p1Keys: new Set(p1Keys),
    scopePaths: new Set(scope),
    today,
    presentOnBase,
  })

/** 成对正反例:每一条都指定"应该看见什么",不看感觉。 */
export function selfTest() {
  const rows = []
  const ok = (name, cond, why = '') => rows.push({ name, ok: !!cond, why })
  const j = (path, head, cand, ledger = { ok: new Map(), bad: [], present: false }) =>
    judgeFile({ path, headText: head, candText: cand, candAbsent: false, ledger })

  // S1 干净面:候选==HEAD ⇒ 四维全 0,pass==HEAD 条目数
  const s1 = j('package.json', PKG_A, PKG_A)
  ok('S1 候选==HEAD ⇒ P1/P2/未判定全 0', s1.p1.length === 0 && s1.p2.length === 0 && s1.und.length === 0 && s1.pass === 5, JSON.stringify(s1))
  // S2 与 S1 成对:整条键被抹掉 ⇒ 必须点名该键
  const s2 = j('package.json', PKG_A, PKG_DROP_B)
  ok('S2 少一行 ⇒ P1 恰好点名 check:b', s2.p1.length === 1 && s2.p1[0].entry === 'check:b' && s2.p2.length === 0)
  // S3 与 S2 成对:仅仅换序 ⇒ 不得算 P1
  const s3 = j('package.json', PKG_A, PKG_REORDER)
  ok('S3 纯换序(行内容一致)⇒ 不算 P1 也不算 P2', s3.p1.length === 0 && s3.p2.length === 0 && s3.pass === 5, JSON.stringify(s3.p1.concat(s3.p2).map((x) => x.entry)))
  ok('S3b 与 S3 成对:换序必须落"未判定"并点名,不许静默', s3.und.length === 1 && s3.und[0].entry === '(条目顺序)')
  // S4 未被跟踪的文件不参与:枚举只住在 HEAD 面,候选面多出的注册表进不了射程
  const s4 = filterRegistry([
    'package.json',
    'apps/api/package.json',
    'node_modules/left-pad/package.json',
    RUNNER_PATH,
    'src/a.ts',
  ])
  ok('S4 射程枚举只收 package.json 与 runner(排除 node_modules)', s4.length === 3 && !s4.includes('node_modules/left-pad/package.json') && !s4.includes('src/a.ts'), s4.join(','))
  const ownSrc = String(readWorktreeFile(REPO_ROOT, 'scripts/check-registry-worktree-superset.mjs') ?? '')
  // 自指导出的字面量:把要禁的东西拆开写,否则这条锁会被自己的源码点亮(2026-10-06 实测踩过)。
  const fsImport = ['from ', "'node:", "fs'"].join('')
  ok(
    'S4b 枚举源必须是 HEAD 面(不 readdir 磁盘 ⇒ 未跟踪文件没有入场券)',
    /ls-tree[^\n]*'HEAD'/.test(ownSrc) && !ownSrc.includes(fsImport),
  )
  // S5 语义等值而逐行不等 ⇒ 落未判定,并点名,绝不并到 P2 里
  const s5 = j('package.json', PKG_A, PKG_REFLOW)
  ok('S5 prettier 重排 ⇒ 未判定(不是 P2)', s5.p2.length === 0 && s5.und.length >= 1 && s5.und[0].entry === 'check:b', JSON.stringify(s5))
  // S6 与 S5 成对:命令真改了 ⇒ P2,带行级差异
  const s6 = j('package.json', PKG_A, PKG_A.replace('"check:b": "node 2"', '"check:b": "node 9"'))
  ok('S6 值改写 ⇒ P2 点名 check:b', s6.p2.length === 1 && s6.p2[0].entry === 'check:b')
  // S7 runner:整块被抹 ⇒ P1 点名 id
  const s7 = j(RUNNER_PATH, RUNNER_A, RUNNER_A.replace(/ {2}\{\n {4}id: '11',[\s\S]*?\n {2}\},\n/, ''))
  ok('S7 runner 少一块 ⇒ P1 点名 id 11', s7.p1.length === 1 && s7.p1[0].entry === '11', JSON.stringify(s7.p1))
  // S8 与 S7 成对:字段值漂开 ⇒ P2
  const s8 = j(RUNNER_PATH, RUNNER_A, RUNNER_A.replace("mode: 'blocking',\n    args: []", "mode: 'advisory',\n    args: []"))
  ok('S8 runner 改 mode ⇒ P2 点名 id 10', s8.p2.length === 1 && s8.p2[0].entry === '10')
  // S9 与 S8 成对:引号/缩进写法换了、字段值没换 ⇒ 未判定
  const s9 = j(RUNNER_PATH, RUNNER_A, RUNNER_A.replace("    id: '10',", "    id: \"10\","))
  ok('S9 引号换形而语义等值 ⇒ 未判定,不得算 P2', s9.p2.length === 0 && s9.und.length >= 1, JSON.stringify(s9.und))
  // S10 P2 判据是**逐行等值**而不是行数等值:行数同、内容漂 ⇒ 必须 P2
  const s10 = j(RUNNER_PATH, RUNNER_A, RUNNER_A.replace("    script: 'a.mjs',", "    script: 'z.mjs',"))
  ok('S10 行数相等而正文漂开 ⇒ P2(换成行数比较就看不见)', s10.p2.length === 1 && s10.p2[0].entry === '10')
  // S11 候选面 JSON 坏了 ⇒ 未判定,不许静默
  const s11 = j('package.json', PKG_A, '{"scripts": {,}')
  ok('S11 候选面解析失败 ⇒ 未判定并点名', s11.p2.length === 0 && s11.p1.length === 0 && s11.und.length === 1)
  // S12 候选面整份文件没了 ⇒ 未判定(不是 P1 汇总,也不判绿)
  const s12 = judgeFile({ path: 'package.json', headText: PKG_A, candText: null, candAbsent: true, ledger: led([]) })
  ok('S12 候选面缺文件 ⇒ 未判定,绝不记通过', s12.und.length === 1 && s12.p1.length === 0)
  // S13 豁免账成对:带原因 ⇒ 豁免并点名;裸原因 ⇒ 照红
  const s13a = j('package.json', PKG_A, PKG_DROP_B, led([{ path: 'package.json', entry: 'check:b', reason: 'G-1 归档两步走', reviewBy: '2027-01-01' }]))
  const s13b = j('package.json', PKG_A, PKG_DROP_B, led([{ path: 'package.json', entry: 'check:b', reason: '  ', reviewBy: '2027-01-01' }]))
  ok('S13 豁免带原因 ⇒ 从 P1 转入豁免维(仍点名)', s13a.p1.length === 0 && s13a.exempted.length === 1)
  ok('S13b 与 S13 成对:裸标记不生效 ⇒ 照计 P1', s13b.p1.length === 1 && s13b.exempted.length === 0)
  // S13c 判据①:缺必填字段(这里缺 reviewBy)⇒ 条目不生效 + 点名,绝不静默当不存在
  const s13c = j('package.json', PKG_A, PKG_DROP_B, led([{ path: 'package.json', entry: 'check:b', reason: '有原因但没复核日' }]))
  ok('S13c 缺 reviewBy ⇒ 条目不生效(照计 P1)并落未判定点名', s13c.p1.length === 1 && s13c.und.some((x) => x.entry === '(豁免账)' && /reviewBy/.test(x.why)))
  // S13d 判据②在 judgeFile 这一侧的形状:过期条目**不再放行**(失效由 run/judgeLedger 记红)
  const s13d = j('package.json', PKG_A, PKG_DROP_B, { ok: new Map(), bad: [], present: true })
  ok('S13d 过期条目被 run() 摘出 active 后 ⇒ P1 回来(过期即失效,不是继续豁免)', s13d.p1.length === 1 && s13d.exempted.length === 0)
  // S14 三档定级:同一判据,只有 blocking 换 ⇒ 退出码换,计数不换
  const mk = (face, strict) => ({
    face,
    strict,
    p1: 1,
    p2: 0,
    und: 0,
    exempted: 0,
    led: 0,
    ledDefects: [],
    ledUnjudged: [],
    enumerated: 3,
    error: null,
    docs: [],
  })
  ok('S14 缺省(磁盘档)只报数 ⇒ exit 0', report(mk('worktree', false), { json: true }) === 0)
  ok('S14b --strict 同一计数判红 ⇒ exit 1', report(mk('worktree', true), { json: true }) === 1)
  ok('S14c 提交链档(索引)判红 ⇒ exit 1', report(mk('staged', false), { json: true }) === 1)
  // S14d 台账维的定级(§12e 安全网):台账判据只随 --strict 判红,提交链档不得因"面状态"卡人
  const mkLed = (face, strict, ledN) => ({ ...mk(face, strict), p1: 0, led: ledN, ledDefects: [{ key: 'k', path: 'package.json', why: '构造' }] })
  ok('S14d 台账判据 1 条 + 缺省档 ⇒ exit 0(只点名不判红)', report(mkLed('worktree', false, 1), { json: true }) === 0)
  ok('S14e 台账判据 1 条 + --strict ⇒ exit 1', report(mkLed('worktree', true, 1), { json: true }) === 1)
  ok('S14f 与 S14e 成对:台账判据 1 条但只 --staged ⇒ 仍 exit 0(升档前置未满足前不得卡提交链)', report(mkLed('staged', false, 1), { json: true }) === 0)
  ok('S14g ledgerBlocking() 与上面三档口径一致', ledgerBlocking({ strict: true }) === true && ledgerBlocking({ face: 'staged', strict: false }) === false)
  // S15 空枚举判死(不记绿)
  const s15 = report({ face: 'worktree', strict: false, docs: [], p1: 0, p2: 0, und: 0, exempted: 0, enumerated: 0, error: null }, { json: false })
  ok('S15 枚举到 0 个注册表文件 ⇒ exit 2,绝不记绿', s15 === 2)
  // S16 两面旗同给 ⇒ 判死
  ok('S16 --staged 与 --worktree 同给 ⇒ 判死', selectFace({ staged: true, worktree: true, def: 'worktree' }).error !== null)
  // S17 真仓射程:两份注册表必须都被枚举到
  ok('S17 射程含根 package.json 与 runner', isRegistryPath('package.json') && isRegistryPath(RUNNER_PATH) && !isRegistryPath('node_modules/x/package.json') && !isRegistryPath('src/a.ts'))

  // ── S18–S24:台账面判据(台账搬进受版本控制的一面时补的牙)──────────────────────
  // S18 形状锁:旧的那条 gitignored 路径永远不得回潮(字面量按段拼,否则这条锁会被自己的源码点亮)
  const OLD_LEDGER = ['.ihui-agent/', 'registry-superset-exempt', '.jsonl'].join('')
  ok(
    'S18 台账必须住在受版本控制的一面(旧 jsonl 路径不得再出现在源码里)',
    !ownSrc.includes(OLD_LEDGER) &&
      EXEMPT_LEDGER.startsWith('scripts/data/') &&
      EXEMPT_LEDGER.endsWith('.json') &&
      !EXEMPT_LEDGER.includes(['.ihui', '-agent/'].join('')),
    EXEMPT_LEDGER,
  )
  // S19 判据⑤:坏 JSON / 形状不对 ⇒ broken(无法判定),绝不折成"空台账 = 零豁免"
  const s19a = parseLedger('{"entries": [')
  const s19b = parseLedger('{"entries": {}}')
  const s19c = parseLedger(JSON.stringify({ entries: [] }))
  ok('S19 坏 JSON ⇒ broken 点名(present 仍为真,不当成空表放行)', !!s19a.broken && s19a.present === true && s19a.ok.size === 0)
  ok('S19b 与 S19 成对:entries 不是数组也判 broken', !!s19b.broken && /形状/.test(s19b.broken))
  ok('S19c 与 S19 成对:`entries: []` 是合法的如实零豁免', s19c.present === true && !s19c.broken && s19c.ok.size === 0)
  // S20 判据④:候选面取不到整份台账 ⇒ 红(点名),HEAD 有/没有两种归因都要点出来
  const s20a = ledJudge(null, { presentOnBase: false })
  const s20b = ledJudge(null, { presentOnBase: true })
  ok('S20 台账不在候选面 ⇒ 1 条台账判据(绝不折成零豁免记绿)', s20a.absent === true && s20a.defects.length === 1 && /候选面取不到/.test(s20a.defects[0].why))
  ok('S20b 与 S20 成对:HEAD 有、候选面没有 ⇒ 归因写成"本提交把唯一出口删掉了"', s20b.defects.length === 1 && /唯一出口删掉了/.test(s20b.defects[0].why))
  // S21 判据①:缺任一必填字段 ⇒ 红并点名缺哪个
  const s21 = ledJudge([
    { path: 'package.json', entry: 'check:b', reason: '有' },
    { path: 'package.json', entry: 'check:c', reviewBy: '2027-01-01' },
  ])
  ok('S21 条目缺 reason / 缺 reviewBy ⇒ 两条台账判据并点名缺的字段', s21.defects.length === 2 && s21.defects.some((x) => /缺 reviewBy/.test(x.why)) && s21.defects.some((x) => /缺 reason/.test(x.why)))
  // S22 判据②:过期 ⇒ 红;与"未过期且真被用上"成对(后者零判据)
  const s22a = ledJudge([{ path: 'package.json', entry: 'check:b', reason: '有', reviewBy: '2025-01-01' }], { p1Keys: ['package.json#check:b'] })
  const s22b = ledJudge([{ path: 'package.json', entry: 'check:b', reason: '有', reviewBy: '2027-01-01' }], { p1Keys: ['package.json#check:b'] })
  ok('S22 复核日过期 ⇒ 台账判据红且豁免即时失效', s22a.defects.length === 1 && /复核日/.test(s22a.defects[0].why) && entryLive({ reviewBy: '2025-01-01' }, '2026-10-06') === false)
  ok('S22b 与 S22 成对:未过期且这条豁免真被用上 ⇒ 零台账判据', s22b.defects.length === 0 && s22b.unjudged.length === 0)
  // S23 判据③:登记了而没被用上 ⇒ 清单腐烂红;路径没进射程 ⇒ 未判定(不把"没看"写成"看了没命中")
  const s23a = ledJudge([{ path: 'package.json', entry: 'check:ghost', reason: '有', reviewBy: '2027-01-01' }])
  const s23b = ledJudge([{ path: 'apps/api/package.json', entry: 'build', reason: '有', reviewBy: '2027-01-01' }], { scope: ['package.json'] })
  ok('S23 登记了而被审面没命中 ⇒ 清单腐烂红', s23a.defects.length === 1 && /腐烂/.test(s23a.defects[0].why))
  ok('S23b 与 S23 成对:路径本轮没被审到 ⇒ 未判定,不判腐烂', s23b.defects.length === 0 && s23b.unjudged.length === 1)
  // S24 键轴唯一性:同一 path#entry 重复登记不生效(交人工),且不产生第二条假豁免
  const s24 = ledJudge(
    [
      { path: 'package.json', entry: 'check:b', reason: '甲', reviewBy: '2027-01-01' },
      { path: 'package.json', entry: 'check:b', reason: '乙', reviewBy: '2027-01-01' },
    ],
    { p1Keys: ['package.json#check:b'] },
  )
  ok(
    'S24 同一 path#entry 重复登记 ⇒ 台账判据红(键轴不唯一)且只留一条生效',
    s24.defects.length === 1 && /重复登记/.test(s24.defects[0].why) && s24.absent === false && s24.unjudged.length === 0,
    JSON.stringify(s24.defects.map((x) => x.why)),
  )

  const bad = rows.filter((x) => !x.ok)
  console.log(`—— 自检 ${rows.length - bad.length}/${rows.length} 通过${bad.length ? ' ✗' : ' ✅'}`)
  for (const x of bad) console.log(`   ✗ ${x.name} ${x.why}`)
  return bad.length ? 1 : 0
}

function main(argv) {
  const has = (f) => argv.includes(f)
  if (has('--self-test')) return selfTest()
  const picked = selectFace({ staged: has('--staged'), worktree: has('--worktree'), def: 'worktree' })
  if (picked.error) {
    console.error(`❌ ${picked.error} ⇒ 无法判定`)
    return 2
  }
  const res = run({ root: REPO_ROOT, face: picked.face, strict: has('--strict') })
  return report(res, { json: has('--json') })
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    process.exitCode = main(process.argv.slice(2))
  } catch (e) {
    console.error(`❌ 脚本自身异常:${String(e && e.message).split(/\r?\n/)[0]}`)
    process.exitCode = 2
  }
}

export const __test__ = {
  run,
  collect,
  judgeFile,
  judgeLedger,
  entryLive,
  ledgerBlocking,
  extract,
  filterRegistry,
  extractPkgEntries,
  extractRunnerEntries,
  parseLedger,
  conclusion,
  report,
  selfTest,
  isRegistryPath,
  RUNNER_PATH,
  EXEMPT_LEDGER,
  LEDGER_FIELDS,
  PKG_A,
  PKG_REORDER,
  PKG_REFLOW,
  PKG_DROP_B,
  RUNNER_A,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
