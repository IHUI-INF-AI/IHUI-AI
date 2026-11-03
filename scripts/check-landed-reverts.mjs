// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// scripts/check-landed-reverts.mjs
//
/**
 * 提交面「内容整片退回更早版本」只读尺(2026-11-01 立,票:深度分析并修复项目bug 的洞 A 收口)。
 *
 * 为什么要有它(现读事故,不是推测):本会话已量的三起损失里,两起是**绕过钩子**的提交把别人刚入库的
 * 内容原样写回旧版 —— `9fdbc207ba`(摘掉告警身份去重 G-44 那一腿)与 `b41b9fdce8`(摘掉部署预期窗口那一腿)。
 * 既有防线都管不到这一格:
 *   · 门 30c / 门 84 判的是**暂存面与索引面**,提交早已入库就再也不被问;
 *   · 门 100 / 168 只判**合并**(A1/A2/DR1/DR2 全按父子集算),普通提交不落射程;
 *   · 收编器的 partitionStaleCopies 只在"它自己要收编"那一刻判工作树,替不了别人提交的提交。
 * ⇒ 提交面(已落 HEAD 的历史)今天零复查,而这恰好是"编辑器旧缓冲 + --no-verify / VBS 直提"唯一的落点。
 *
 * 判据两条(非合并提交 C 的路径 P):
 *   臂一(整片)blob **逐字等于** P 在 C 的某个**更早祖先**提交上的 blob,且不等于父提交上的 blob
 *     ⇒ "这一枚把 P 整片写回了某个旧版本"。实测能认出 9fdbc207ba2ea5536812f8b965d7a9218bb28785。
 *   臂二(部分)正文按行的多重集呈"批量删、几乎不增"(尺 = 收编器的 isPartialRevert,import 不复制)
 *     ⇒ 混血副本(滞后缓冲⊕自身改动)既不等于旧版也不等于新版,臂一看不见。
 *     实测能认出 b41b9fdce8 的 harness 腿(删 88/仅补 1);同一枚的 ihui-monitor 腿(删 58/补 12)
 *     与"合法批量删除"落在同一区间 ⇒ 记进 KNOWN_REVERT_COMMITS 的在册盲区,由 proof 当场翻脸提醒。
 *   · 只认逐字 blob 等值(与门 30c 的复现口径 `--find-object` 同一把尺的语义),不做行级相似度判断,
 *     所以"重写式重构""改回一半"都不在本尺射程内 —— 那些有别的器物管,本尺不冒充全能。
 *   · 合并提交一律跳过并计数:取一侧是合并的正常结果,按本判据会把每一次合并都念成回退(§12e 恒红同型)。
 *
 * 档位:**只读、不进提交链**(§12e —— 它判的是"历史",提交者结构上无法满足"把过去改掉";挂成
 * blocking 门就是逼人 --no-verify)。红了能做什么:复核被点名的那一枚,该回补的回补(§5e-1 准入)。
 * 三态出口:ok=0 / flagged=1 / unjudged=2;枚举到 0 枚候选一律判**未判定**,不用 0 冒充"没回退"(§0.3)。
 *
 * 用法:
 *   node scripts/check-landed-reverts.mjs                      # 游标之后的新提交(默认限 60 枚)
 *   node scripts/check-landed-reverts.mjs --from <sha> --limit 400   # 指定区间(取证/阳性对照用)
 *   node scripts/check-landed-reverts.mjs --json               # 机读汇总(守护派发用)
 *   node scripts/check-landed-reverts.mjs --self-test          # 自检(含正控/反控/形状锁)
 *   node scripts/check-landed-reverts.mjs --mark               # 判定成功后推进游标
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
// 派生 git 一律走脚本层唯一出口(§12g 显式 stdio + windowsHide + 绝对路径与 safe.directory;
// 裸 execFileSync('git') 会被 scripts/tests/face-reader.test.mjs 那条"新增者棘轮"记一笔)。
import { gitRaw, catBatchOids, catBatch } from './lib/face-reader.mjs'
// 部分回退判据**不在这份文件里重写**(§0.6):删占比那一把尺唯一的家住在收编器,
// 两臂(工作树面 / 提交面)量的是同一种损坏,分叉成两份判据迟早会一面拦一面放。
import { isPartialRevert, minusCount } from './auto-commit-quiet.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const STATE_DIR = join(ROOT, '.ihui-agent', 'state')
const CURSOR_FILE = join(STATE_DIR, 'landed-revert-audit.cursor')
const LEDGER_FILE = join(STATE_DIR, 'landed-revert-audit.jsonl')
// 祖先回溯窗口按**提交数**取,现读定档(2026-11-01 实测,不是拍的):
//   已知事故枚 9fdbc207ba 的受害路径 deploy/win/alert-dedup.ps1,窗口 200 时可见写手 **0 个**(尺子失明),
//   窗口 800 时可见 1 个,单条 `log --name-only` 分别 0.17s / 0.44s(9294 行也才 0.86s)⇒ 取 800。
//   这条同时解释了为什么不能按"每路径各问一次 log":事故枚单枚动了 996 条路径,逐路径起进程 = 33 分钟。
const ANCESTOR_WINDOW = Number(process.env.IHUI_LANDED_REVERT_WINDOW || 800)
const DEFAULT_LIMIT = Number(process.env.IHUI_LANDED_REVERT_LIMIT || 60)

function git(args) {
  return gitRaw(args, ROOT).trim()
}

/**
 * `git log --format=%H --name-only` 的输出 ⇒ `[{sha, paths[]}]`。纯函数,镜像测试直接喂字面量。
 * 约定:40 位十六进制的一行是新一个提交的头,其后直到下一个头之间的行都是该提交改过的路径。
 */
export function parseLogNameOnly(out) {
  const blocks = []
  let cur = null
  for (const raw of String(out ?? '').split('\n')) {
    const line = raw.trim()
    if (!line) continue
    if (/^[0-9a-f]{40}$/.test(line)) {
      cur = { sha: line, paths: [] }
      blocks.push(cur)
      continue
    }
    if (cur) cur.paths.push(line)
  }
  return blocks
}

/**
 * 一枚提交的取材两面(oidOf / ancestorOf),**固定 3 次派生,与路径数无关**。
 *
 * 为什么必须成批(2026-11-01 实测,这条决定本尺能不能进守护):已知事故枚之一单枚就动了 996 条路径,
 * 按"每路径 × 每祖先"起进程 ⇒ 单枚 33 分钟,巡检出结论这件事结构上不可能成立。
 * 三趟各自不换的取法:① 路径清单 `show --name-only`;② 窗口内"每个祖先改过哪些路径"一条
 * `log --name-only` 全拿到(它天然给出 path→祖先写手,不必逐路径再问一次 log);
 * ③ 所有 `<rev>:<path>` 一次 `catBatchOids`(取材层的批量 oid 出口,§0.6 —— 不在这里再写一份
 *   cat-file 解析;注意不是 `resolveSpecOids`,那出口只做离线规格归一,不解析 blob,见函数内注记)。
 * 缺项 ⇒ null,不触发失败退避,也不冒充"判过了"。
 */
function makeFaces(sha, parent, pathList, { window = ANCESTOR_WINDOW } = {}) {
  const want = new Set(pathList)
  let blocks = []
  let logOk = true
  try {
    blocks = parseLogNameOnly(
      gitRaw(['log', '--format=%H', '--name-only', '-n', String(window), parent], ROOT),
    )
  } catch {
    logOk = false
  }
  const specs = []
  for (const p of pathList) {
    specs.push(`${sha}:${p}`)
    specs.push(`${parent}:${p}`)
  }
  const ancByPath = new Map()
  for (const b of blocks) {
    for (const p of b.paths) {
      if (!want.has(p)) continue
      specs.push(`${b.sha}:${p}`)
      if (!ancByPath.has(p)) ancByPath.set(p, [])
      ancByPath.get(p).push(b.sha)
    }
  }
  let oids = new Map()
  try {
    // ⚠ 不是 resolveSpecOids:那一出口只做**离线**规格归一,`<sha>:<path>` 会被原样映射成它自己
    //   (实测:两侧都拿到"规格字符串本身"⇒ 永不相等 ⇒ 本尺对已知事故整批失明,2026-11-01 栽在这一格)。
    //   真做批量 oid 解析的是 catBatchOids(行对齐回填、missing/空行归 null,解析尺住在层里,§0.6)。
    oids = catBatchOids(ROOT, specs)
  } catch {
    oids = new Map()
  }
  // 第二臂的输入:先按 `--numstat` 筛出"以删为主"的候选,再**一次** cat-file 把它们的正文取回。
  // 不这么筛的话,996 路径的大提交要为每条路径物化两版正文(实测会把单枚拖进分钟级);
  // numstat 只当**筛子**用,最终判据仍是 isPartialRevert 按真文本的行的多重集算(两臂同尺)。
  const numstat = parseNumstat(safeGit(['show', '--numstat', '--format=', sha]))
  const candSpecs = []
  for (const p of pathList) {
    const ns = numstat.get(p)
    if (!ns) continue
    if (!(ns.deleted >= 15) || ns.added * 8 > ns.deleted) continue
    if (oids.get(`${sha}:${p}`) && oids.get(`${parent}:${p}`))
      candSpecs.push(`${sha}:${p}`, `${parent}:${p}`)
  }
  let contents = new Map()
  try {
    contents = candSpecs.length ? catBatch(ROOT, candSpecs) : new Map()
  } catch {
    contents = new Map()
  }
  return {
    oidOf: (rev, p) => oids.get(`${rev}:${p}`) ?? null,
    ancestorOf: (p) => ancByPath.get(p) ?? [],
    contentOf: (rev, p) => {
      const v = contents.get(`${rev}:${p}`)
      return typeof v === 'string' ? v : null
    },
    faceOk: logOk && oids.size > 0,
    contentsOk: candSpecs.length === 0 || contents.size > 0,
  }
}

/** `git show --numstat` ⇒ Map<path,{added,deleted}>(`-` 代表二进制,不当候选)。 */
export function parseNumstat(out) {
  const map = new Map()
  for (const raw of String(out ?? '').split('\n')) {
    const line = raw.trim()
    if (!line) continue
    const m = line.match(/^(\d+|-)\t(\d+|-)\t(.+)$/)
    if (!m) continue
    const added = m[1] === '-' ? Number.POSITIVE_INFINITY : Number(m[1])
    const deleted = m[2] === '-' ? Number.POSITIVE_INFINITY : Number(m[2])
    map.set(m[3].trim(), { added, deleted })
  }
  return map
}

function safeGit(args) {
  try {
    return gitRaw(args, ROOT)
  } catch {
    return ''
  }
}

/**
 * 纯判据(§22c:镜像测试直接用它,不复制判据)。全部输入由调用方注入,本函数不碰 git。
 * 返回 null = 与回退无关;返回对象 = 命中"整片退回更早版本"。
 */
export function revertVerdict({ changedPath, commitBlob, parentBlob, ancestorBlobs }) {
  if (!changedPath || !commitBlob) return null // 该枚把此路径删了:不是"写回旧版"
  if (parentBlob && commitBlob === parentBlob) return null // 没动这个路径(不应进候选)
  const hits = (ancestorBlobs || []).filter((a) => a && a.blob === commitBlob)
  if (hits.length === 0) return null
  return { path: changedPath, blob: commitBlob, via: hits.map((h) => h.commit) }
}

/**
 * 一枚提交的全部路径判定。取材由调用方注入(oidOf / ancestorOf,见 makeFaces)⇒ 本函数是纯的,
 * 镜像测试能证"两路都真被问到",而不是只在测试里自己递一把(2026-11-01 收编器 T16 那一型:
 * 包装器漏递探针 ⇒ 生产臂恒空转,测试全绿)。
 */
export function auditCommit(
  sha,
  { parents, pathList, oidOf, ancestorOf, contentOf, faceOk = true } = {},
) {
  const parent = parents?.[0] ?? null
  if (!parent) return { sha, skipped: 'merge-or-root', hits: [] }
  if (!faceOk || typeof oidOf !== 'function')
    // 取材面拿不到 ⇒ 这一枚**没判**,不等于"这枚干净"(§0.3)
    return { sha, unjudged: '取材面取不到(oidOf/ancestorOf 未就绪)', hits: [] }
  const hits = []
  for (const p of pathList || []) {
    const cb = oidOf(sha, p)
    const pb = oidOf(parent, p)
    if (pb && cb === pb) continue
    const ancestors = (typeof ancestorOf === 'function' ? ancestorOf(p) || [] : []).map((c) => ({
      commit: String(c).slice(0, 10),
      blob: oidOf(c, p),
    }))
    const v = revertVerdict({
      changedPath: p,
      commitBlob: cb,
      parentBlob: pb,
      ancestorBlobs: ancestors,
    })
    if (v) {
      hits.push({ ...v, kind: 'whole' })
      continue
    }
    // 臂二:整片等值看不见"滞后编辑器缓冲 ⊕ 自身少量改动"的混血(b41b9fdce8 实测 +12/−58,
    // blob 不等于任何祖先 ⇒ 臂一结构性失明)。尺子不在这里重写 —— import 收编器那个 isPartialRevert,
    // 两臂量同一种损坏,分两份判据迟早一面拦一面放(§0.6)。取不到正文 ⇒ 不判(§0.3)。
    if (typeof contentOf !== 'function') continue
    const ct = contentOf(sha, p)
    const pt = contentOf(parent, p)
    if (ct === null || pt === null) continue
    const delta = {
      removed: minusCount(pt, ct),
      added: minusCount(ct, pt),
      headLines: pt.split('\n').length,
    }
    if (isPartialRevert(delta)) hits.push({ path: p, blob: cb, via: [], kind: 'partial', ...delta })
  }
  return { sha, hits }
}

function listCommits(from, limit) {
  const args = ['log', '--no-merges', '--first-parent', '--format=%H\x1f%P\x1f%s']
  if (from) args.push(`${from}..HEAD`)
  args.push('-n', String(limit))
  return git(args)
    .split('\n')
    .filter(Boolean)
    .map((l) => {
      const [sha, parents, subject] = l.split('\x1f')
      return { sha, parents: (parents || '').split(' ').filter(Boolean), subject }
    })
}

function pathsOf(sha) {
  try {
    return git(['-c', 'core.quotePath=false', 'show', '--name-only', '--format=', sha])
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
  } catch {
    return []
  }
}

function readCursor() {
  try {
    return readFileSync(CURSOR_FILE, 'utf8').trim() || null
  } catch {
    return null
  }
}

export function run({ from = null, limit = DEFAULT_LIMIT, mark = false } = {}) {
  const base = from ?? readCursor()
  const commits = listCommits(base, limit)
  if (commits.length === 0) {
    // 枚举到 0 枚候选 ⇒ 未判定(§0.3):不拿"没量到"冒充"历史是干净的"
    return {
      state: 'unjudged',
      reason: `枚举到 0 枚提交(base=${base ?? '(游标缺失/首轮)'})`,
      audited: 0,
      findings: [],
    }
  }
  const findings = []
  let skippedMerges = 0
  let judged = 0
  const unjudgedCommits = []
  for (const c of commits) {
    const paths = pathsOf(c.sha)
    if (paths.length === 0 && c.sha) continue // 空提交/纯改名:没有可判的 blob
    const faces = makeFaces(c.sha, c.parents[0] ?? '', paths)
    const r = auditCommit(c.sha, { parents: c.parents, pathList: paths, ...faces })
    if (r.skipped) {
      skippedMerges += 1
      continue
    }
    if (r.unjudged) {
      // 取材面取不到 ⇒ 这一枚"没判",既不许冒绿也不许冒红(§0.3),逐条点名而不是并桶
      unjudgedCommits.push(`${c.sha.slice(0, 10)}:${r.unjudged}`)
      continue
    }
    judged += 1
    for (const h of r.hits) {
      findings.push({ commit: c.sha.slice(0, 10), subject: c.subject, ...h })
    }
  }
  const state = findings.length ? 'flagged' : judged === 0 ? 'unjudged' : 'ok'
  const out = {
    state,
    base,
    audited: commits.length,
    judged,
    skippedMerges,
    unjudged: unjudgedCommits,
    findings,
    ...(state === 'unjudged'
      ? { reason: `${commits.length} 枚候选无一判得成(取材面全取不到)` }
      : {}),
  }
  if (mark && out.state !== 'unjudged') {
    try {
      mkdirSync(STATE_DIR, { recursive: true })
      writeFileSync(CURSOR_FILE, `${commits[0].sha}\n`, 'utf8')
      const line = out.findings
        .map((f) => JSON.stringify({ at: new Date().toISOString(), kind: 'landed-revert', ...f }))
        .join('\n')
      if (line) writeFileSync(LEDGER_FILE, `${line}\n`, { flag: 'a' })
      out.cursorAdvanced = commits[0].sha.slice(0, 10)
    } catch (e) {
      out.markError = String(e?.message ?? e).slice(0, 120)
    }
  }
  return out
}

/** 自检:正控(已知两枚必须被本尺认出)+ 反控(等父 blob / 合并 / 全新内容一律不命中)。 */
export function selfTest() {
  const results = []
  const t = (name, fn) => {
    try {
      fn()
      results.push(`✔ ${name}`)
    } catch (e) {
      results.push(`✖ ${name} :: ${String(e?.message ?? e)}`)
      process.exitCode = 1
    }
  }
  const assert = (c, m) => {
    if (!c) throw new Error(m || '断言失败')
  }
  // S1 正控:旧版 blob 逐字重现 ⇒ 命中,且点名是哪些祖先
  t('S1 正控:提交 blob 等于祖先 blob ⇒ 判"整片退回更早版本"', () => {
    const v = revertVerdict({
      changedPath: 'deploy/win/alert-dedup.ps1',
      commitBlob: 'OLD',
      parentBlob: 'NEW',
      ancestorBlobs: [
        { commit: 'aaaa1111', blob: 'NEW' },
        { commit: 'bbbb2222', blob: 'OLD' },
      ],
    })
    assert(v && v.via.length === 1 && v.via[0] === 'bbbb2222', `实得 ${JSON.stringify(v)}`)
  })
  // S2 反控:与父提交逐字相同 = 根本没动这个路径,不许命中
  t('S2 反控:提交 blob == 父 blob ⇒ 不命中(没动它)', () => {
    assert(
      revertVerdict({
        changedPath: 'x',
        commitBlob: 'A',
        parentBlob: 'A',
        ancestorBlobs: [{ commit: 'c', blob: 'A' }],
      }) === null,
    )
  })
  // S3 反控:重写式内容(既不等于父,也不等于任何祖先)不在本尺射程 —— 本尺不冒充全能
  t('S3 反控:新内容不等于任何祖先 ⇒ 不命中', () => {
    assert(
      revertVerdict({
        changedPath: 'x',
        commitBlob: 'MIXED',
        parentBlob: 'NEW',
        ancestorBlobs: [{ commit: 'c', blob: 'OLD' }],
      }) === null,
    )
  })
  // S4 反控:删除档(blob 取不到)不许当"写回旧版"
  t('S4 反控:该枚把路径删了 ⇒ 不命中', () => {
    assert(
      revertVerdict({
        changedPath: 'x',
        commitBlob: null,
        parentBlob: 'NEW',
        ancestorBlobs: [{ commit: 'c', blob: null }],
      }) === null,
    )
  })
  // S5 合并/根提交一律跳过并按数报出(否则每次合并都被念成回退 = §12e 恒红同型)
  t('S5 合并提交被跳过且计数,不参与判定', () => {
    const r = auditCommit('m', { parents: [], pathList: ['x'], oidOf: () => 'A' })
    assert(r.skipped === 'merge-or-root' && r.hits.length === 0, JSON.stringify(r))
  })
  // S6 形状锁:真历史正控必须存在且点名已知两枚(它自己跑起来慢,刻意放在 --proof,不塞进自检 —— §12e:
  //     自检不该按仓库规模计时,否则这道尺子自己就成了"跑不动的那一环"。)
  t('S6 形状锁:--proof 的已知事故清单在位且逐条带出处', () => {
    assert(
      Array.isArray(KNOWN_REVERT_COMMITS) && KNOWN_REVERT_COMMITS.length >= 2,
      '已知事故枚不得为空',
    )
    const src = readFileSync(join(ROOT, 'scripts', 'check-landed-reverts.mjs'), 'utf8')
    assert(/--proof/.test(src), 'proof 档必须真在 CLI 上可达(造好没装车 = 没有,§0.9)')
    for (const k of KNOWN_REVERT_COMMITS) {
      assert(/^[0-9a-f]{40}$/.test(k.sha), `sha 必须 40 位全量(§1 禁 7-12 位短 sha),实得 ${k.sha}`)
      assert(k.what && k.what.length >= 6, `枚 ${k.sha} 缺"它摘掉了什么"的出处`)
      assert(
        typeof k.expectHit === 'boolean',
        `枚 ${k.sha.slice(0, 10)} 缺 expectHit 声明(不许把"没量到"留成空档)`,
      )
      if (k.expectHit === false)
        assert(
          k.blindReason && k.blindReason.length >= 8,
          `盲区条目 ${k.sha.slice(0, 10)} 必须写清为什么量不到`,
        )
    }
  })
  // S7 形状锁:枚举到 0 枚 ⇒ 必须是 unjudged(不许用 0 冒充"干净")
  t('S7 形状锁:run() 取不到候选 ⇒ state=unjudged 而非 ok', () => {
    const src = readFileSync(join(ROOT, 'scripts', 'check-landed-reverts.mjs'), 'utf8')
    const fn = src.match(/\nexport function run\([\s\S]*?\n\}\n/)?.[0] ?? ''
    assert(fn.length > 100, '必须取到 run 函数体本身(防空串假绿)')
    assert(/state: 'unjudged'/.test(fn) && /commits\.length === 0/.test(fn), '0 枚候选必须落未判定')
    assert(!/state:\s*'ok'[\s\S]{0,80}commits\.length === 0/.test(fn), '不得在 0 枚那一格冒 ok')
  })
  return results
}

/**
 * 已知真历史对照枚(本会话一手取证)。`expectHit` 是**声明**,不是愿望:
 *   true  ⇒ 本尺必须认出该枚里点名的那条路径;认不出 = proof 判红(尺子失明)。
 *   false ⇒ 本尺**明知量不到**这一型,把它钉成在册盲区:哪天阈值改动把它认出来了,proof 会反过来
 *           提醒"盲区已缩小,该更新这一行"。盲区写进台账不是放弃,而是不让自己把"没量到"说成"判过了"。
 */
export const KNOWN_REVERT_COMMITS = [
  {
    sha: 'b41b9fdce8c87fa3afb0c04ee88999d6591ac1da',
    what: '摘掉 G-44 监控腿的 harness(行级删 88 / 仅补 1)',
    pathHint: 'deploy/tests/alert-stall-dedup-harness.ps1',
    expectHit: true,
  },
  {
    sha: '9fdbc207ba2ea5536812f8b965d7a9218bb28785',
    what: '清理那枚摘掉 G-44 告警身份单源的 alert-dedup.ps1 那一腿',
    pathHint: 'deploy/win/alert-dedup.ps1',
    // 现读盲区(2026-11-01 量出来的,不是"还没想到办法"):
    //   行级 删 85 / 补 14 ⇒ 增删比 16%;窗口(800 枚)内该路径只有 1 个祖先写手 714efaa191,
    //   而"到那个祖先的行距"与"到父提交的行距"**一模一样(85/14)** ⇒ 行级没有任何可分信号;
    //   放宽"增 ≤ 删/8"到 1/2 会把"删一半也补 300 行 = 新工作"那一档反例一起放进来(镜像 M11)。
    // ⇒ 这一型今天交给"复核被点名枚"的人通道(§5e-1),本尺不假装能分辨它。
    expectHit: false,
    blindReason:
      '增删比 16% 落在与合法批量删除重叠的区间;且到最近祖先的行距 = 到父的行距,行级无信号',
  },
  {
    sha: 'b41b9fdce8c87fa3afb0c04ee88999d6591ac1da',
    what: '同一枚里的 ihui-monitor.ps1 那一腿(删 58 也补了 12,增删比 21%)',
    pathHint: 'deploy/win/ihui-monitor.ps1',
    // 同上一型的第二个现场:窗口内 3 个祖先写手,最近那个的行距同样 = 到父的行距(58/12)。
    expectHit: false,
    blindReason: '增删比 21% 与"大规模重写"在这一维上不可分,放宽即误伤(镜像 M11 反例)',
  },
]

/**
 * 一次性真历史正控(慢,按需跑):`node scripts/check-landed-reverts.mjs --proof`
 * 每一枚已知事故都必须在真仓库上被点名,认不出 ⇒ exit 1(尺子对已知事故失明就是它自己坏了)。
 */
export function proof() {
  const out = []
  let bad = 0
  for (const k of KNOWN_REVERT_COMMITS) {
    let parents = []
    try {
      parents = git(['rev-list', '--parents', '-n', '1', k.sha]).split(/\s+/).slice(1)
    } catch {
      out.push({ sha: k.sha, ok: false, why: '取不到父提交 ⇒ 未判定' })
      bad += 1
      continue
    }
    const paths = pathsOf(k.sha)
    const faces = makeFaces(k.sha, parents[0] ?? '', paths)
    const r = auditCommit(k.sha, { parents, pathList: paths, ...faces })
    // 只认**声明的那条路径**的命中。早先这里写了 `|| r.hits[0]` 兜底,于是同一枚里"另一条被认出的路径"
    // 会把"点名那条没被认出"遮成 ✔ —— 正控一旦能靠兜底变绿,它就不再是正控(本会话栽过的同一型)。
    const hit = r.hits.find((h) => h.path === k.pathHint)
    const caught = !!hit
    if (k.expectHit === true) {
      out.push({
        sha: k.sha,
        what: k.what,
        path: k.pathHint,
        ok: caught,
        caught,
        hits: r.hits.length,
        via: hit?.via ?? [],
        kind: hit?.kind,
      })
      if (!caught) bad += 1
    } else {
      // 在册盲区:量不到 = 符合声明;哪天量到了 = 盲区缩小,要显式更新这一行(而不是悄悄多绿一格)
      out.push({
        sha: k.sha,
        what: k.what,
        path: k.pathHint,
        ok: !caught,
        caught,
        declaredBlind: true,
        reason: k.blindReason,
      })
      if (caught) out[out.length - 1].note = '盲区已被认出 ⇒ 请把该条 expectHit 改 true 并更新出处'
    }
  }
  return { state: bad ? (out.every((o) => o.why) ? 'unjudged' : 'failed') : 'ok', rows: out, bad }
}

function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--proof')) {
    const p = proof()
    for (const r of p.rows)
      console.log(
        r.declaredBlind
          ? `${r.ok ? '✔' : '✖'} ${r.sha.slice(0, 10)} ${r.what} ⇒ 声明盲区(${r.reason})——${r.caught ? '⚠ 今天量到了:' + (r.note ?? '') : '按声明量不到,符合预期'}`
          : `${r.ok ? '✔' : '✖'} ${r.sha.slice(0, 10)} ${r.what ?? ''} 路径 ${r.path ?? ''} ⇒ ${r.ok ? `${r.kind ?? 'whole'} 认出(该枚共 ${r.hits} 处命中${r.via?.length ? `,经祖先 ${r.via.slice(0, 2).join('/')}` : ''})` : (r.why ?? '本尺对它失明 ⇒ 判据需要修')}`,
      )
    console.log(`PROOF state=${p.state} 失明=${p.bad}`)
    process.exitCode = p.state === 'ok' ? 0 : p.state === 'unjudged' ? 2 : 1
    return
  }
  if (argv.includes('--self-test')) {
    const r = selfTest()
    for (const line of r) console.log(line)
    const bad = r.filter((l) => l.startsWith('✖')).length
    console.log(`SELF-TEST 例数=${r.length} 红=${bad}`)
    process.exitCode = bad ? 1 : 0
    return
  }
  const grab = (flag) => {
    const i = argv.indexOf(flag)
    return i >= 0 ? argv[i + 1] : null
  }
  if (argv.includes('--help')) {
    console.log(
      '用法: node scripts/check-landed-reverts.mjs [--from <sha>] [--limit N] [--json] [--mark] [--self-test] [--proof]',
    )
    return
  }
  const out = run({
    from: grab('--from'),
    limit: Number(grab('--limit') || DEFAULT_LIMIT),
    mark: argv.includes('--mark'),
  })
  if (argv.includes('--json')) {
    console.log(JSON.stringify(out))
  } else {
    console.log(
      `提交面回退尺:基准=${out.base ?? '(游标缺失)'} 审=${out.audited} 枚 跳过合并=${out.skippedMerges ?? 0} 命中=${out.findings.length}`,
    )
    for (const f of out.findings)
      console.log(
        `  ⚠ ${f.commit} 「${String(f.subject).slice(0, 60)}」 ${f.path} ⇒ ` +
          (f.kind === 'partial'
            ? `部分回退嫌疑:删 ${f.removed} 行=${((f.removed / f.headLines) * 100).toFixed(1)}% 全文、仅补 ${f.added} 行`
            : `与祖先 ${(f.via ?? []).join('/')} 逐字同形`),
      )
    if (out.state === 'unjudged') console.log(`  未判定:${out.reason}`)
  }
  process.exitCode = out.state === 'ok' ? 0 : out.state === 'flagged' ? 1 : 2
}

export const __test__ = { revertVerdict, auditCommit, selfTest, run, parseLogNameOnly }

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    main()
  } catch (e) {
    console.error(`❌ 尺子自身异常:${String(e?.message ?? e).slice(0, 300)}`)
    process.exitCode = 2
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
