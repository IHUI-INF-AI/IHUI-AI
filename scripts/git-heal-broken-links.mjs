// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 对象库断链的只读定性与按需恢复出口(2026-10-09 立,票 G-1105312 的落地件)。
 *
 * 为什么需要它:本机 .git 被宿主清理层整片删过多次(AGENTS §5b),事后按远端重建时**部分对象没补齐**
 * —— 表现为 `git fsck --connectivity-only` 报 broken link。2026-10-09 实测 40 条,全部只住在
 * `lost-commit/*` 备份标签的闭包里,main 一根都不需要(判据见 classifyNeeds),而**从发现到修复隔了三周**,
 * 期间全链没有一处现问"对象图完不完整"——本仓最高频的失效形态就是"安静"。本器把两件当时靠人肉推出来的事
 * 固定成一条命令:① 定性(断链住在哪些 ref 的闭包里、当前检出的树要不要它们);② 按需补齐(全程只做加法)。
 *
 * 三条不可漂的写法:
 *  ① **绝不删 ref、绝不跑 gc/prune、绝不动工作树**。"让 fsck 变绿"的两种捷径(删掉指向断链的标签 /
 *     `gc --prune=now`)都是**销毁证据**,AGENTS §22 明令 lost-commit 语料不得丢,§5b 明令禁手工 gc。
 *  ② **先核对再落库**:先用 `hash-object`(不带 `-w`)现算 oid 核对一致,才用 `hash-object -w` 落库;
 *     `算出的 oid != fsck 点名的 oid` 即判 mismatch 并计入失败 —— 只有内容地址一致才叫"补回了那一枚",
 *     否则是往库里塞了个冒名件(冒名件连写都不写)。
 *     **空取回是"没取到"不是"内容不符"**:空 blob / 空 tree 都是合法目标(各有确定的 oid),
 *     判据是"字节为空 且 期望 oid 不是该 kind 的空对象 oid",不得用"长度>0"一刀切。
 *     ⚠️ 而"实得 = 空对象 oid e69de29…"**最常见的成因是根本没喂进去**(`git()` 只拿 `opts.input` 算
 *     stdio 却没把它转发给 `execFileSync`,子进程对空 stdin 算出空对象)—— 与"取回为空"在日志里同形,
 *     所以由自检 H27 直接钉"喂非空字节必须得到非空对象 oid"。
 *  ③ **"对端没有"与"没问到"必须分开**:`absent`(远端 ls-remote 现读确认该 ref 不存在 ⇒ 确属已丢,
 *     按 §22 建 tag 并如实登记)与 `undetermined`(网络/派生/解析失败 ⇒ 不得读成"没有",也不得读成"有")
 *     是两个档,合起来会把"这台机没问到"洗成"内容不存在"(与守门 153/164 同一条禁令)。
 *
 * 恢复机制的原理(为什么不必整仓重拉):本地已有断链对象的**父 tree**,缺的只是 blob。git 的传输协商按
 * "我有哪些对象"决定是否发送,所以对同一枚标签再 `git fetch` 永远拿不回来(fetch rc=0 而 broken link 数
 * 一字不变 —— 实测过)。正解是在**同盘临时落点**起一枚空仓,用 `--filter=blob:none --depth=N` 只要
 * 提交与 tree(2026-10-09 实测:6 枚标签最深 14 代,六次 fetch 合计约 13 秒、探针仓 2MB),然后按 oid
 * `cat-file blob` 触发**按需单对象取回**,把字节 `hash-object -w` 写进主仓对象库。
 *
 * 用法:`node scripts/git-heal-broken-links.mjs [--check|--apply|--json|--self-test] [--keep-probe]`
 * 缺省 = `--check`(零副作用,只出定性与计划)。`--apply` 才会派生网络与写对象库。
 * 定级:常驻**出口**不是守门,不在提交链,因此没有紧急跳过变量(它不在钩子链上)。
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const SELF_DIR = dirname(fileURLToPath(import.meta.url))
// 仓库锚点:缺省由脚本自身位置推导(§15),IHUI_HEAL_ROOT 只作**测试通道**(镜像测试要在临时仓里跑端到端,
// 靠 cwd 定位夹具是守门 70 记过的恒红那一型:脚本按定义忽略 cwd,13/14 例其实在审真仓)。
const ROOT = resolve(process.env.IHUI_HEAL_ROOT || resolve(SELF_DIR, '..'))
const GIT = process.env.IHUI_GIT_BIN || 'git'
const GIT_BASE = ['-c', 'safe.directory=*']

/** 派生 git:显式接管 stdio(AGENTS §12g —— 本机宿主下不写 stdio 会稳定 spawnSync git EBUSY)。
 *  带 input 时 stdin 必须是 pipe:'ignore' 会让喂进去的清单被静默丢弃,表现为"每个对象都取不到"。
 *  **input 本身也必须转发**:只拿它算 stdio 而不交给 execFileSync,子进程会对着一个立刻关闭的
 *  空 stdin 跑出"合法但为空"的结果(实测 `hash-object --stdin` 回空 blob 的 oid e69de29…,
 *  看起来像"内容不符",实际是"根本没喂进去")。 */
function git(args, opts = {}) {
  const stdio = opts.input === undefined ? ['ignore', 'pipe', 'pipe'] : ['pipe', 'pipe', 'pipe']
  return execFileSync(GIT, [...GIT_BASE, ...args], {
    cwd: opts.cwd || ROOT,
    stdio,
    input: opts.input,
    windowsHide: true,
    encoding: opts.encoding ?? 'utf8',
    maxBuffer: opts.maxBuffer || 256 * 1024 * 1024,
    timeout: opts.timeout || 180000,
    env: opts.env,
  })
}

/** 解析 `git fsck --connectivity-only --name-objects` 的输出,产出断链三元组。
 *  fsck 有**两种书写形态**,都必须认(只认一种会把"有病"读成"对象图完整" = 本器最坏的失效方向):
 *   ① `broken link from  tree <oid> (refs/tags/x~4:dir/)` + 下一行 `to blob <oid> (…:file)` —— 父对象可读;
 *   ② `missing blob <oid> (:a.txt)` —— 直查缺失,名字里常常**没有 ref 前缀**,归属要靠 resolveOwner 补问。 */
export function parseBrokenLinks(text) {
  const rows = []
  const undetermined = []
  let pending = null
  for (const line of String(text).split(/\r?\n/)) {
    const from = line.match(/^broken link from\s+(\w+)\s+(\w+)(?:\s+\(([^)]*)\))?/)
    if (from) {
      pending = { parentKind: from[1], parentOid: from[2], parentName: from[3] || '' }
      continue
    }
    const to = line.match(/^\s+to\s+(\w+)\s+(\w+)(?:\s+\(([^)]*)\))?/)
    if (to && pending) {
      rows.push(
        finalizeRow({
          missingKind: to[1],
          missingOid: to[2],
          missingName: to[3] || '',
          parentKind: pending.parentKind,
          parentOid: pending.parentOid,
          parentName: pending.parentName,
        }),
      )
      pending = null
      continue
    }
    const miss = line.match(/^missing\s+(\w+)\s+(\w+)(?:\s+\(([^)]*)\))?/)
    if (miss) {
      rows.push(
        finalizeRow({
          missingKind: miss[1],
          missingOid: miss[2],
          missingName: miss[3] || '',
          parentKind: 'missing-direct',
          parentOid: '',
          parentName: miss[3] || '',
        }),
      )
    }
  }
  if (pending) undetermined.push({ note: '落单的一条 broken link from(没有配对的 to 行)' })
  for (const r of rows) if (!r.refExpr) undetermined.push({ oid: r.missingOid, path: r.path, note: '名字里没有 ref 归属,需 resolveOwner 补问' })
  return { rows, undetermined }
}

function finalizeRow(r) {
  const refExpr = r.missingName || r.parentName
  const colon = refExpr.indexOf(':')
  const out = { ...r }
  out.refExpr = colon < 0 ? refExpr : refExpr.slice(0, colon)
  out.path = colon < 0 ? '' : refExpr.slice(colon + 1)
  return out
}

/** 给"名字里没有 ref 归属"的 missing 行补问owner:`owns(refExpr, path, oid)` 由调用方给(通常是
 *  `git rev-parse <ref>:<path>` 逐候选问一遍)。问不到就返回 '' ⇒ 上层落未判定,**绝不猜 HEAD**。 */
export function resolveOwner(row, refCandidates, owns) {
  if (row.refExpr) return row.refExpr
  if (!row.path) return ''
  for (const ref of refCandidates || []) {
    try {
      if (owns(ref, row.path, row.missingOid)) return ref
    } catch {
      /* 这一枚候选问不动,继续下一枚 */
    }
  }
  return ''
}

/** 该 ref 表达式需要抓到第几代:`~13` ⇒ 14,`^`/`^^` ⇒ 代数,裸 ref ⇒ 1。
 *  深度算少了会拿不到那一层的 tree,算多了只是白花时间 —— 两种都比"猜"好,所以按字面量算而不放宽。 */
export function depthOf(refExpr) {
  const tilde = refExpr.match(/~(\d+)$/)
  if (tilde) return Number(tilde[1]) + 1
  const caret = (refExpr.match(/\^/g) || []).length
  return caret > 0 ? caret + 1 : 1
}

/** 基 ref(剥掉 ~N / ^)与按基 ref 的取回计划。 */
export function planFetches(rows) {
  const plan = new Map()
  for (const r of rows) {
    if (!r.refExpr) continue
    const base = r.refExpr.replace(/(~\d+|\^+)$/, '')
    const d = depthOf(r.refExpr)
    if (!plan.has(base) || plan.get(base) < d) plan.set(base, d)
  }
  return [...plan.entries()].map(([ref, depth]) => ({ ref, depth }))
}

/** 断链对象里"当前检出的树需要"的那一部分:命中即属仓库内容级损坏(必须马上处理),
 *  没命中的只是备份标签里的历史版本(可延后,但仍要登记)。判据由调用方注入 `inCheckout(oid)`。 */
export function classifyNeeds(rows, inCheckout) {
  const needed = []
  const backupOnly = []
  const seen = new Set()
  for (const r of rows) {
    if (seen.has(r.missingOid)) continue
    seen.add(r.missingOid)
    ;(inCheckout(r.missingOid) ? needed : backupOnly).push(r)
  }
  return { needed, backupOnly, distinct: seen.size }
}

/** 三态分流:`restored`(算出的 oid 与点名一致)/ `mismatch`(内容不符,计入失败)/
 *  `failed`(取回或写库动作本身没成)。纯函数,便于不联网就证明判读正确。 */
export function decideWrite(expectedOid, writtenOid, err) {
  if (err) return { state: 'failed', oid: expectedOid, detail: String(err && err.message ? err.message : err).slice(0, 160) }
  const got = String(writtenOid || '').trim()
  if (!got) return { state: 'failed', oid: expectedOid, detail: 'hash-object 没给出行(未判定,不读成成功)' }
  if (got === expectedOid) return { state: 'restored', oid: expectedOid }
  return { state: 'mismatch', oid: expectedOid, got, detail: `期望 ${expectedOid} 实得 ${got}` }
}

// 空对象是合法目标:判据必须是"字节为空 且 期望 oid 不是该 kind 的空对象 oid",不得用长度一刀切。
const EMPTY_OID_BY_KIND = {
  blob: 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391',
  tree: '4b825dc642cb6eb9a060e54bf8d69288fbee4904',
}

/** 空取回 = "没取到",不是"内容不符"。空 blob/空 tree 各有确定的 oid,只有期望 oid 不是那个空对象 oid 时才算空取回。 */
export function isEmptyFetch(buf, kind, expectedOid) {
  const len = buf && typeof buf.length === 'number' ? buf.length : -1
  return len === 0 && expectedOid !== EMPTY_OID_BY_KIND[kind]
}

/** 探针仓(空仓 + origin)的建法与清理,抽成一对便于 self-test 不碰网络。 */
export function makeProbe(keep) {
  const dir = mkdtempSync(join(process.env.IHUI_HEAL_PROBE_DIR || tmpdir(), 'ihui-git-heal-'))
  return {
    dir,
    cleanup() {
      if (keep) return
      try {
        rmSync(dir, { recursive: true, force: true })
      } catch {}
    },
  }
}

/** 远端是否**确认**没有这个 ref:ls-remote 现读为空 ⇒ absent(可作"确属已丢"的依据);
 *  派生失败 ⇒ undetermined(绝不返回 absent)。 */
export function refOnRemote(url, ref) {
  try {
    const out = git(['ls-remote', url, ref], { timeout: 120000 })
    const t = String(out).trim()
    if (!t) return { state: 'absent' }
    return { state: 'present', line: t.split(/\r?\n/)[0] }
  } catch (e) {
    return { state: 'undetermined', detail: String(e && e.message ? e.message : e).slice(0, 160) }
  }
}

function runFsck() {
  try {
    // stderr 与 stdout 都要:fsck 的对象图结论打在 stdout,报错打在 stderr
    const out = git(['fsck', '--connectivity-only', '--name-objects', '--no-progress'], {
      timeout: 900000,
      maxBuffer: 512 * 1024 * 1024,
    })
    return { ok: true, text: String(out) }
  } catch (e) {
    // fsck 发现缺失对象时非零退出,而 stdout 仍是有效结论 —— 只有拿不到 stdout 才判"未跑到"
    const partial = e && e.stdout ? String(e.stdout) : ''
    if (partial) return { ok: true, text: partial }
    return { ok: false, detail: String(e && e.message ? e.message : e).slice(0, 200) }
  }
}

/** 判每个缺失 oid 是否在 HEAD 的树里:一次 `ls-tree -r -t HEAD` 取 "oid<TAB>path" 全集。 */
function headOidSet() {
  try {
    const out = git(['ls-tree', '-r', '-t', 'HEAD'], { maxBuffer: 512 * 1024 * 1024 })
    const set = new Set()
    for (const line of String(out).split(/\r?\n/)) {
      const m = line.match(/^\w+ \w+ (\w+)\t/)
      if (m) set.add(m[1])
    }
    if (set.size === 0) return null
    return set
  } catch {
    return null
  }
}

/** 给 fsck 里"名字没带 ref"的行补问 owner:候选 = 当前分支 ref(HEAD 所指向的那一枚)。
 *  刻意**不拿 HEAD 当候选**、也不遍历所有 ref:真实仓有数千枚 lost-commit 标签,逐枚问一遍是把一次
 *  4 秒的定性变成几十分钟;而"该 ref:该路径 的 oid 恰等于缺失 oid"这条判据,问不动就落未判定。 */
function ownerCandidates() {
  try {
    const ref = String(git(['symbolic-ref', '-q', 'HEAD'])).trim()
    return ref ? [ref] : []
  } catch {
    return []
  }
}

function refOwns(ref, path, oid) {
  try {
    return String(git(['rev-parse', `${ref}:${path}`])).trim() === oid
  } catch {
    return false
  }
}

function applyCheck(asJson) {
  const f = runFsck()
  if (!f.ok) {
    console.log(`未判定:fsck 跑不出结论(${f.detail})—— 不读成"对象库干净"`)
    return 2
  }
  const parsed = parseBrokenLinks(f.text)
  const cands = ownerCandidates()
  for (const r of parsed.rows) if (!r.refExpr) r.refExpr = resolveOwner(r, cands, refOwns)
  const rows = parsed.rows
  const noOwner = rows.filter((r) => !r.refExpr)
  if (rows.length === 0) {
    console.log('对象图完整:fsck --connectivity-only 现读 0 条断链')
    return 0
  }
  const set = headOidSet()
  const cls = classifyNeeds(rows, (oid) => (set ? set.has(oid) : true))
  const plans = planFetches(rows)
  const distinct = cls.distinct
  console.log(
    `断链:${rows.length} 条(去重 ${distinct} 个缺失对象)· 归属可读 ${rows.length - noOwner.length} 条` +
      (set ? '' : ' · ⚠️ 当前检出 oid 集取不到 ⇒ 全部按"可能需要"从严计'),
  )
  console.log(`  当前检出需要:${cls.needed.length} 个 / 只在备份标签闭包里:${cls.backupOnly.length} 个`)
  if (noOwner.length) console.log(`  补问不到 owner:${noOwner.length} 条 ⇒ 不进计划、不写库(只报名)`)
  if (plans.length) console.log(`  需要抓取的 ref:${plans.length} 枚(最浅 1 代,最深 ${Math.max(...plans.map((p) => p.depth))} 代)`)
  else console.log('  无可进计划的 ref ⇒ 这一轮不做任何网络与写动作')
  if (asJson) {
    writeFileSync(
      join(ROOT, '.workbuddy', 'git-heal-broken-links.json'),
      JSON.stringify({ rows, undetermined: parsed.undetermined, plans, needed: cls.needed.map((r) => r.missingOid) }, null, 2),
    )
    console.log('  清单落盘:.workbuddy/git-heal-broken-links.json')
  }
  for (const p of plans) console.log(`  plan depth=${p.depth}  ${p.ref}`)
  return 1
}

function applyHeal(opts) {
  const f = runFsck()
  if (!f.ok) {
    console.log(`未判定:fsck 跑不出结论(${f.detail}),不做任何写动作`)
    return 2
  }
  const parsed = parseBrokenLinks(f.text)
  const cands = ownerCandidates()
  for (const r of parsed.rows) if (!r.refExpr) r.refExpr = resolveOwner(r, cands, refOwns)
  const rows = parsed.rows.filter((r) => r.refExpr)
  if (parsed.rows.length && !rows.length) {
    console.log(`未判定:${parsed.rows.length} 条缺失全部补问不到 owner ⇒ 不做任何写库动作(只报名)` + `\n  ${parsed.rows.map((r) => `${r.missingOid} ${r.path || '(无路径)'}`).join('\n  ').slice(0, 800)}`)
    return 2
  }
  if (rows.length === 0) {
    console.log('没有断链,不需要补齐(先跑 --check 复核)')
    return 0
  }
  const skipped = parsed.rows.length - rows.length
  let url
  try {
    url = String(git(['remote', 'get-url', 'origin'])).trim()
  } catch (e) {
    console.log(`未判定:origin 地址取不到(${String(e.message || e).slice(0, 80)}),不做任何写动作`)
    return 2
  }
  const probe = makeProbe(opts.keep)
  try {
    git(['init', '-q', probe.dir])
    git(['remote', 'add', 'origin', url], { cwd: probe.dir })
  } catch (e) {
    probe.cleanup()
    console.log(`未判定:探针仓建不起来(${String(e.message || e).slice(0, 120)})`)
    return 2
  }
  const tally = { already: 0, restored: 0, mismatch: 0, failed: 0, absentRef: 0, undeterminedRef: 0 }
  const notes = []
  const plans = planFetches(rows)
  for (const p of plans) {
    const pr = refOnRemote(url, p.ref)
    if (pr.state === 'absent') {
      tally.absentRef++
      notes.push(`ABSENT ${p.ref} —— 对端确认没有这枚 ref:这一组确属已丢,按 AGENTS §22 建 lost-commit tag 并如实登记,禁止用删 ref/gc 让它闭嘴`)
      continue
    }
    if (pr.state === 'undetermined') {
      tally.undeterminedRef++
      notes.push(`未判定 ${p.ref} —— 对端问不到(${pr.detail}),这一组不判"没有",也不做写动作`)
      continue
    }
    const localRef = 'refs/heal/' + p.ref.replace(/^refs\/(tags|heads)\//, '').replace(/[^0-9A-Za-z._-]/g, '_')
    try {
      git(
        ['fetch', '-q', '--filter=blob:none', `--depth=${p.depth}`, '--no-tags', 'origin', `${p.ref}:${localRef}`],
        { cwd: probe.dir, timeout: 900000 },
      )
    } catch (e) {
      tally.undeterminedRef++
      notes.push(`未判定 ${p.ref} —— 探针 fetch 失败(${String(e.message || e).slice(0, 120)});不带 filter 的整片重拉本器不做`)
      continue
    }
    for (const r of rows.filter((x) => x.refExpr.replace(/(~\d+|\^+)$/, '') === p.ref)) {
      let have = true
      try {
        git(['cat-file', '-e', `${r.missingOid}^{${r.missingKind}}`])
      } catch {
        have = false
      }
      if (have) {
        tally.already++
        continue
      }
      let buf = null
      let err = null
      try {
        buf = git(['cat-file', r.missingKind === 'tree' ? 'tree' : 'blob', r.missingOid], {
          cwd: probe.dir,
          encoding: 'buffer',
          maxBuffer: 512 * 1024 * 1024,
        })
      } catch (e) {
        err = e
      }
      if (err) {
        tally.failed++
        notes.push(`按需取回失败 ${r.missingOid} ${r.path}`.slice(0, 200))
        continue
      }
      if (isEmptyFetch(buf, r.missingKind, r.missingOid)) {
        tally.failed++
        notes.push(`取回为空,不写库 ${r.missingOid} ${r.path}(空取回是"没取到",不读成"内容不符")`.slice(0, 200))
        continue
      }
      let computed = null
      try {
        computed = git(['hash-object', '-t', r.missingKind, '--stdin'], { input: buf, maxBuffer: 64 * 1024 * 1024 })
      } catch (e) {
        tally.failed++
        notes.push(`内容地址核对失败 ${r.missingOid}(${String(e && e.message ? e.message : e).slice(0, 120)})`)
        continue
      }
      if (String(computed || '').trim() !== r.missingOid) {
        tally.mismatch++
        notes.push(`内容不符:期望 ${r.missingOid} 实得 ${String(computed || '').trim() || '(空)'} —— 冒名件未写库`)
        continue
      }
      let written = null
      try {
        written = git(['hash-object', '-w', '-t', r.missingKind, '--stdin'], { input: buf, maxBuffer: 64 * 1024 * 1024 })
      } catch (e) {
        err = e
        written = null
      }
      const d = decideWrite(r.missingOid, written, err)
      if (d.state === 'restored') tally.restored++
      else if (d.state === 'mismatch') {
        tally.mismatch++
        notes.push(`写库后回读不符:${d.detail}(内容地址核对已通过,属落库异常)`)
      } else {
        tally.failed++
        notes.push(`写库失败 ${r.missingOid}(${d.detail})`)
      }
    }
  }
  probe.cleanup()
  console.log(
    `补齐结果:已存在 ${tally.already} / 取回落库 ${tally.restored} / 内容不符 ${tally.mismatch} / 动作失败 ${tally.failed} / 对端确认没有 ${tally.absentRef} 组 / 未判定 ${tally.undeterminedRef} 组` +
      (skipped ? ` / 补问不到 owner 而未处理 ${skipped} 条` : ''),
  )
  for (const n of notes) console.log('  ' + n)
  const after = runFsck()
  const rest = after.ok ? parseBrokenLinks(after.text).rows.length : null
  console.log(
    rest === null
      ? '⚠️ 复测 fsck 取不到 ⇒ 收尾读数未判定(不读成"已清零")'
      : `复测:断链余 ${rest} 条(${rest === 0 ? '已清零' : '仍有残留,见上面 notes'})`,
  )
  if (tally.mismatch + tally.failed + tally.absentRef + tally.undeterminedRef > 0) return 1
  if (rest === null) return 2
  return rest === 0 ? 0 : 1
}

/** 自检:全部走构造面与真实 fsck 文本样本,不联网、不写主仓对象库。 */
export function selfTest() {
  let pass = 0
  const fails = []
  const t = (name, cond) => {
    if (cond === true) pass++
    else fails.push(`${name} —— 实得:${String(cond)}`)
  }
  const SAMPLE = [
    'broken link from    tree 400a5971c9a8ea890c6310f5b73f8070e5986134 (refs/tags/lost-commit/wip-batch-7736f5c:packages/i18n/messages/web/en.json)',
    '              to    blob 13ca5eab3892f3bb126bd61aa157433bd9e0306d (refs/tags/lost-commit/wip-batch-7736f5c:packages/i18n/messages/web/en.json)',
    'broken link from    tree 817619624c6b9b74ab7228920ad97e3a47be03c0 (refs/tags/lost-commit/wip-batch-ed81830~4:docs/monetization/)',
    '              to    blob 0736501c95508827f14a6ceb5142e856a13ada50 (refs/tags/lost-commit/wip-batch-ed81830~4:docs/monetization/checklist.md)',
    'broken link from  commit 0000000000000000000000000000000000000000',
    '              to  tree 1111111111111111111111111111111111111111',
  ].join('\n')
  const { rows, undetermined } = parseBrokenLinks(SAMPLE)
  t('H01 解析到 3 条断链', rows.length === 3)
  t('H02 带名字的两条取到 refExpr', rows[0].refExpr === 'refs/tags/lost-commit/wip-batch-7736f5c' && rows[1].refExpr === 'refs/tags/lost-commit/wip-batch-ed81830~4')
  t('H03 无名字归属的行既留在 rows 里也进未判定桶(不静默丢弃)', rows[2].refExpr === '' && undetermined.length === 1)
  t('H04 路径取自 to 行的名字', rows[1].path === 'docs/monetization/checklist.md')
  t('H05 深度:裸 ref ⇒ 1', depthOf('refs/tags/lost-commit/wip-batch-7736f5c') === 1)
  t('H06 深度:~4 ⇒ 5', depthOf('refs/tags/lost-commit/wip-batch-ed81830~4') === 5)
  t('H07 深度:^^ ⇒ 3', depthOf('refs/tags/x^^') === 3)
  const plans = planFetches(rows)
  t('H08 计划按基 ref 合并(无归属的那条不进计划)', plans.length === 2 && plans.every((p) => p.depth >= 1))
  const merged = planFetches([{ refExpr: 'refs/tags/a~4' }, { refExpr: 'refs/tags/a' }, { refExpr: 'refs/tags/a~13' }])
  t('H09 同一基 ref 只留最大深度', merged.length === 1 && merged[0].depth === 14)
  const cls = classifyNeeds(rows, (oid) => oid === '13ca5eab3892f3bb126bd61aa157433bd9e0306d')
  t('H10 检出需要的与只住备份标签的分两桶', cls.needed.length === 1 && cls.backupOnly.length === 2)
  t('H11 去重计数按缺失 oid', classifyNeeds([{ missingOid: 'x' }, { missingOid: 'x' }, { missingOid: 'y' }], () => false).distinct === 2)
  t('H12 oid 一致才算取回', decideWrite('aaa', 'aaa\n', null).state === 'restored')
  t('H13 不一致判内容不符', decideWrite('aaa', 'bbb', null).state === 'mismatch')
  t('H14 空返回判失败而非成功', decideWrite('aaa', '', null).state === 'failed')
  t('H15 派生报错判失败并带原因', decideWrite('aaa', null, new Error('boom')).state === 'failed')
  const empty = parseBrokenLinks('nothing here')
  t('H16 空样本解析出 0 条(供上层判"完整"用,不在此处发合格证)', empty.rows.length === 0)
  t('H17 tree 缺失也按 kind 记账', rows[2].missingKind === 'tree')
  t('H18 归属读不出的行被点名,不吞掉可归属的行', undetermined.length === 1 && rows.length === 3)
  // 阳性对照:fsck 的第二种书写形态(missing 直查)必须同样被解析 —— 只认 broken link 会把"有病"读成"完整"
  const missForm = parseBrokenLinks('missing blob 41b65ea84bd0c62f4b8e58f79eebbc83ab3e8e6f (:a.txt)')
  t('H19 missing 形态也解析成断链条目', missForm.rows.length === 1 && missForm.rows[0].missingOid === '41b65ea84bd0c62f4b8e58f79eebbc83ab3e8e6f')
  t('H20 missing 形态的归属为空,等 resolveOwner 补问', missForm.rows[0].refExpr === '' && missForm.rows[0].path === 'a.txt')
  const owns = (ref, path, oid) => ref === 'refs/heads/main' && path === 'a.txt' && oid === '41b65ea84bd0c62f4b8e58f79eebbc83ab3e8e6f'
  t('H21 resolveOwner 命中候选 ref', resolveOwner(missForm.rows[0], ['refs/heads/x', 'refs/heads/main'], owns) === 'refs/heads/main')
  t('H22 resolveOwner 问不到时返回空串(绝不猜 HEAD)', resolveOwner(missForm.rows[0], ['refs/heads/x'], () => false) === '')
  t('H23 无路径的行不进取主流程(没有可比的东西)', resolveOwner({ refExpr: '', path: '', missingOid: 'z' }, ['refs/heads/main'], () => true) === '')
  t('H24 空字节 + 非空期望 ⇒ 判"空取回"(没取到)', isEmptyFetch(Buffer.alloc(0), 'blob', '41b65ea84bd0c62f4b8e58f79eebbc83ab3e8e6f') === true)
  t('H25 空字节 + 期望恰为空 blob oid ⇒ 不判空取回(空对象是合法目标)', isEmptyFetch(Buffer.alloc(0), 'blob', EMPTY_OID_BY_KIND.blob) === false)
  t('H26 有字节 ⇒ 不判空取回', isEmptyFetch(Buffer.from('x\n'), 'blob', '41b65ea84bd0c62f4b8e58f79eebbc83ab3e8e6f') === false)
  // 阳性对照(H27):包装器必须真把 input 喂进子进程 stdin。本器曾经只用 opts.input 算 stdio
  // 而不转发它 ⇒ `hash-object --stdin` 对着一个立刻关闭的空 stdin 算出**空对象 oid**,
  // 账面读起来是"内容不符",实际是"根本没喂进去"—— 两种失效在日志里同形,所以这一维必须由代码钉。
  let forwarded = ''
  try {
    forwarded = String(git(['hash-object', '-t', 'blob', '--stdin'], { input: Buffer.from('not-empty-for-the-wrapper\n') }) || '').trim()
  } catch {
    forwarded = ''
  }
  t('H27 派生 git 转发了 input(非空字节不得被算成空对象 oid)', forwarded !== '' && forwarded !== EMPTY_OID_BY_KIND.blob)
  console.log(`--self-test:${pass} 通过 / ${fails.length} 失败(共 ${pass + fails.length} 条)`)
  for (const f of fails) console.log('  ❌ ' + f)
  return fails.length === 0 ? 0 : 1
}

function main(argv) {
  const a = argv.slice(2)
  if (a.includes('--self-test')) return selfTest()
  const keep = a.includes('--keep-probe')
  const asJson = a.includes('--json')
  if (a.includes('--apply')) return applyHeal({ keep })
  return applyCheck(asJson)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    process.exitCode = main(process.argv)
  } catch (e) {
    console.error(`❌ ${e && e.message ? e.message : e}`)
    process.exitCode = 2
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
