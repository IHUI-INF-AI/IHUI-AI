#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 旁路落地声明面对账(守门 170,blocking)。
 *
 * 立因 = PROJECT_PLAN G-978069 的事实链:枚 45cb17e2b0 经旁路通道入库,把**票面射程外的 4 个
 * 路径**按磁盘旧副本整文件写回(吞掉了别人刚入库的圆角统一),链上三道防回退门全部拦不住 ——
 * 守门 84 R1 只跑提交链的 --staged 面、守门 100 管合并吞并、守门 30c 只跑 --staged,而旁路通道
 * (object-space-land / live-doc-edit / commit-tree+CAS)**结构上不跑钩子**。G-725 起旁路落地必须
 * 在 .workbuddy/safe-commit-attestation.jsonl 留痕(声明路径 + landedSha),本门把这份留痕当成
 * 「提交意图」的唯一机器可读面,事后逐枚复量:
 *
 *   S1 射程:只审 kind=bypass-landing 且带 landedSha 的记录;其余 kind(not-ours/mine/…)与缺
 *      landedSha 的旁路行只按类计数(它们没有可绑定的落地提交,不属于本门判定面)。
 *   S2 记录形状:landedSha 非空而 declaredFiles 为空 ⇒ 未判定,逐条点名(G-725 要求两者必填,
 *      空声明面说明留痕写坏了,不是"什么都没声明")。整份日志不可读/不可解析 ⇒ exit 2。
 *   S3 红判据(本门唯一的牙):landedSha 从 HEAD 可达 ∧ 实际改动路径集 ⊄ 声明路径集 ∧
 *      射程外路径中存在「该枚提交后的 blob == 该路径某个祖先提交的 blob」⇒ 红。
 *      这就是"票面射程外的路径被整文件写回旧态",按 G-978069 复裁判据逐条点名:
 *      landedSha / 落地来源 / 路径 / 等值祖先提交(内容锚点,不写行号)。
 *   S4 报数档:射程外路径但**无**写回形态(新内容 / 新增文件 / 删除)⇒ 只报数不判红 ——
 *      本门只认领"写回旧态"这一型(与守门 84 的 R1 同一判据形状,但判在已落地的提交面上);
 *      纯"声明面不全"的混提由落地器自身的 extras 提醒负责。
 *   S5 未判定档:landedSha 取材失败 / 是合并提交(多父)/ 祖先窗口截断仍无命中 ⇒ 逐条点名;
 *      --strict 下 exit 2,不静默绿。
 *   S6 增量台账:.workbuddy/bypass-landing-scope-audited.json 记 landedSha → 判定,每枚记录
 *      **只判一次**(判红不许反复红 —— 修复动作是前向回补,不是让每次提交都陪葬;门 168 同款
 *      设计)。台账是"已判"不是"豁免":红被点名一次后进台账,损坏内容仍须人修。
 *
 * 面:留痕日志是本地运行时记录(.gitignore 内) —— 这是刻意且必然的:"声明"只存在于落地那一刻,
 * 不进提交树。日志读不到 ⇒ exit 2(未判定),绝不静默绿;git 侧取 landedSha 的实际改动面与祖先
 * blob,取材一律走 lib/face-reader.mjs(绝对 git 路径 / safe.directory / 数字 timeout / 显式 stdio)。
 * 台账读写失败不改变判定(幂等,最坏是下次重判),绝不把红洗成绿。
 *
 * 判据与 --staged 无关(本门不读暂存面;runner 给每道门统一追加 --staged 时本门接受并忽略)。
 *
 * 用法:
 *   node scripts/check-bypass-landing-scope.mjs              # 审计留痕日志里未判过的 bypass 记录
 *   node scripts/check-bypass-landing-scope.mjs --strict     # 出现任何未判定 ⇒ exit 2
 *   node scripts/check-bypass-landing-scope.mjs --root <dir> # 换仓/夹具通道(自检与镜像测试用)
 *   node scripts/check-bypass-landing-scope.mjs --self-test  # 判据正反例取证
 * 镜像测试:node --test scripts/tests/check-bypass-landing-scope.test.mjs
 * 接线:guardian-runner checks 表(与 AGENTS.md 守门速查同笔登记;紧急跳过 HUSKY_SKIP_BYPASS_LANDING_SCOPE=1)。
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { gitRaw, catBatchOids, gitBinary } from './lib/face-reader.mjs'
import { readLedgerRecords, BYPASS_KIND, LEDGER_REL } from './lib/commit-attestation.mjs'
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const DEFAULT_ROOT = resolve(SCRIPT_DIR, '..')

/** 祖先窗口(G-806 同款纪律):log 取 41 条用第 41 条判截断;截断仍无命中 ⇒ 未判定,不静默绿 */
const ANC_WINDOW = 40
/** 增量台账(每枚 bypass 记录只判一次;S6) */
const AUDITED_LEDGER_REL = join('.workbuddy', 'bypass-landing-scope-audited.json')
const AUDITED_VERSION = 1
const GIT_TIMEOUT = 120_000

/** 一枚提交的实际改动路径集(diff-tree 对非合并提交 = 对第一父的差;-z 免引号转写) */
export function pathsOfCommit(root, sha) {
  const out = gitRaw(['diff-tree', '-r', '--root', '--no-commit-id', '--name-only', '--no-renames', '-z', sha], root, {
    timeout: GIT_TIMEOUT,
  })
  return out.split('\0').map((s) => s.trim()).filter(Boolean)
}

/** 父提交数(>1 = 合并提交,本门不判) */
export function parentsOf(root, sha) {
  const out = gitRaw(['rev-list', '--parents', '-n', '1', sha], root, { timeout: GIT_TIMEOUT }).trim()
  return out.split(/\s+/).slice(1)
}

/** 该路径在 sha^ 侧的改写历史(新→旧),带截断标记 */
export function ancestorCommits(root, sha, path) {
  const out = gitRaw(['log', '--format=%H', '-n', String(ANC_WINDOW + 1), `${sha}^`, '--', path], root, {
    timeout: GIT_TIMEOUT,
  })
  const commits = out.split('\n').map((s) => s.trim()).filter(Boolean)
  return { commits, truncated: commits.length > ANC_WINDOW }
}

function shortErr(e) {
  const msg = String(e?.message ?? e)
  return msg.length > 90 ? msg.slice(0, 90) + '…' : msg
}

/**
 * 判一枚 bypass 记录。三态绝不并桶:red / reportOnly / undetermined 的计数与样本同源。
 * 记录标识 = landedSha + source(内容锚点);git 取材失败一律落 undetermined,不静默绿。
 */
export function judgeRecord(root, rec) {
  const sha = rec.landedSha
  const declared = rec.declaredFiles ?? []
  if (!sha) return { verdict: 'out-of-scope', why: '缺 landedSha' }
  if (!Array.isArray(declared) || declared.length === 0)
    return { verdict: 'undetermined', why: '声明面为空(G-725 要求必填非空)' }
  let actual
  let parents
  try {
    parents = parentsOf(root, sha)
    actual = pathsOfCommit(root, sha)
  } catch (e) {
    return { verdict: 'undetermined', why: `landedSha 取材失败:${shortErr(e)}` }
  }
  if (parents.length > 1) return { verdict: 'undetermined', why: `合并提交(${parents.length} 个父)不在本门射程` }
  const declaredSet = new Set(declared)
  const extras = actual.filter((p) => !declaredSet.has(p))
  if (extras.length === 0) return { verdict: 'clean', extras: [], stale: [], reportOnly: [] }

  const oids = catBatchOids(root, extras.map((p) => `${sha}:${p}`))
  const stale = []
  const undetermined = []
  const reportOnly = []
  for (const p of extras) {
    const oid = oids.get(`${sha}:${p}`) ?? null
    if (!oid) {
      reportOnly.push({ path: p, kind: '新增或删除(该路径无落地 blob)' })
      continue
    }
    let anc
    try {
      anc = ancestorCommits(root, sha, p)
    } catch (e) {
      undetermined.push({ path: p, why: `祖先历史取不到:${shortErr(e)}` })
      continue
    }
    if (anc.commits.length === 0) {
      reportOnly.push({ path: p, kind: '全新文件(该路径无祖先历史)' })
      continue
    }
    const ancOids = catBatchOids(root, anc.commits.map((c) => `${c}:${p}`))
    const hit = anc.commits.find((c) => ancOids.get(`${c}:${p}`) === oid)
    if (hit) stale.push({ path: p, ancestor: hit })
    else if (anc.truncated) undetermined.push({ path: p, why: `祖先窗口 ${ANC_WINDOW} 截断仍无命中` })
    else reportOnly.push({ path: p, kind: '新内容(窗口内无同字节祖先)' })
  }
  if (stale.length > 0) return { verdict: 'red', extras, stale, undetermined, reportOnly }
  if (undetermined.length > 0)
    return { verdict: 'undetermined', extras, stale: [], undetermined, reportOnly }
  return { verdict: 'report-only', extras, stale: [], undetermined: [], reportOnly }
}

/** 增量台账读(损坏 ⇒ 按空台账重判,幂等且绝不洗绿;S6) */
export function loadAudited(root) {
  const p = resolve(root, AUDITED_LEDGER_REL)
  if (!existsSync(p)) return { map: new Map(), state: 'missing' }
  try {
    const o = JSON.parse(readFileSync(p, 'utf8'))
    if (o?.version !== AUDITED_VERSION || typeof o.judged !== 'object' || o.judged === null)
      return { map: new Map(), state: 'discarded(形状不符,按空台账重判)' }
    return { map: new Map(Object.entries(o.judged)), state: 'read' }
  } catch (e) {
    return { map: new Map(), state: `discarded(${shortErr(e)},按空台账重判)` }
  }
}

export function saveAudited(root, map) {
  const p = resolve(root, AUDITED_LEDGER_REL)
  writeFileSync(p, JSON.stringify({ version: AUDITED_VERSION, judged: Object.fromEntries(map) }, null, 1) + '\n', 'utf8')
  return p
}

/**
 * 全量审计。返回结构化结论;main 负责打印与退出码。
 * journal 不可读 ⇒ { status:'exit2' };其余 ⇒ { status:'ok'|'exit2(--strict)', ... }。
 */
export function audit(root, { strict = false, now = new Date().toISOString() } = {}) {
  const ledger = readLedgerRecords(root)
  if (!ledger.ok) return { status: 'exit2', why: `留痕日志不可读(${ledger.state}):${ledger.why}` }

  const audited = loadAudited(root)
  const counts = {
    totalLines: ledger.records.length + ledger.badLines.length,
    badLines: ledger.badLines.length,
    byKind: {},
    bypass: 0,
    bypassNoSha: 0,
    skipped: 0,
    clean: 0,
    reportOnlyRecords: 0,
    red: 0,
    undetermined: 0,
  }
  for (const r of ledger.records) counts.byKind[r.kind] = (counts.byKind[r.kind] || 0) + 1

  const reds = []
  const undetermined = []
  const reportOnly = []
  const newJudged = []
  for (const rec of ledger.records) {
    if (rec.kind !== BYPASS_KIND) continue
    if (!rec.landedSha) {
      counts.bypassNoSha++
      continue
    }
    counts.bypass++
    if (audited.map.has(rec.landedSha)) {
      counts.skipped++
      continue
    }
    const v = judgeRecord(root, rec)
    const anchor = { landedSha: rec.landedSha, source: rec.source || '(缺 source)', ts: rec.ts }
    newJudged.push({ sha: rec.landedSha, verdict: v.verdict, ts: now })
    if (v.verdict === 'red') {
      counts.red++
      reds.push({ ...anchor, stale: v.stale, extras: v.extras, reportOnly: v.reportOnly })
    } else if (v.verdict === 'undetermined') {
      counts.undetermined++
      undetermined.push({ ...anchor, why: v.why, detail: v.undetermined ?? [] })
    } else if (v.verdict === 'report-only') {
      counts.reportOnlyRecords++
      reportOnly.push({ ...anchor, reportOnly: v.reportOnly })
    } else {
      counts.clean++
    }
  }
  // 台账写入失败不改变结论(幂等:下次重判;绝不因写台账失败而洗绿/洗红)
  if (newJudged.length > 0) {
    for (const j of newJudged) audited.map.set(j.sha, { ts: j.ts, verdict: j.verdict })
    try {
      saveAudited(root, audited.map)
    } catch (e) {
      counts.ledgerSaveError = shortErr(e)
    }
  }

  const exit2 = strict && undetermined.length > 0
  return {
    status: exit2 ? 'exit2' : 'ok',
    why: exit2 ? `存在 ${undetermined.length} 条未判定(--strict)` : null,
    counts,
    reds,
    undetermined,
    reportOnly,
    ledgerState: audited.state,
    badLines: ledger.badLines,
  }
}

function printReport(r) {
  if (r.status === 'exit2') {
    console.error(`❌ [bypass-landing-scope] 无法判定:${r.why}`)
    console.error('   声明面不存在就无从对账 —— 这是未判定,不是通过。排查为何本机没有留痕日志。')
    return
  }
  const c = r.counts
  console.log(
    `[bypass-landing-scope] 留痕 ${c.totalLines} 行(坏行 ${c.badLines})|按 kind ${JSON.stringify(c.byKind)}|bypass 可审 ${c.bypass}(缺 sha 不审 ${c.bypassNoSha} / 已判过跳过 ${c.skipped} / clean ${c.clean} / 只报数 ${c.reportOnlyRecords})|增量台账 ${r.ledgerState}`,
  )
  if (c.ledgerSaveError) console.log(`⚠️ 增量台账写入失败(判定不受影响,下次会重判):${c.ledgerSaveError}`)
  for (const b of r.badLines.slice(0, 5)) console.log(`   · 坏行 L${b.n}:${b.err}`)
  for (const u of r.undetermined) {
    console.log(`? 未判定 ${u.landedSha.slice(0, 10)} (${u.source} @${u.ts}) —— ${u.why}`)
    for (const d of (u.detail ?? []).slice(0, 4)) console.log(`    · ${d.path}:${d.why}`)
  }
  for (const ro of r.reportOnly) {
    console.log(`ℹ️ 只报数 ${ro.landedSha.slice(0, 10)} (${ro.source}) —— 射程外但无写回形态(本门只认领写回旧态这一型):`)
    for (const it of (ro.reportOnly ?? []).slice(0, 6)) console.log(`    · ${it.path} —— ${it.kind}`)
  }
  if (r.reds.length > 0) {
    for (const red of r.reds) {
      console.log(`❌ 旁路落地写回旧态:${red.landedSha.slice(0, 10)} (${red.source} @${red.ts})`)
      for (const s of red.stale) console.log(`    · ${s.path} == 祖先 ${s.ancestor.slice(0, 10)} 的版本(声明面之外,整文件写回)`)
      for (const it of (red.reportOnly ?? []).slice(0, 4))
        console.log(`    · (同枚另有无写回形态的射程外路径,只报数)${it.path} —— ${it.kind}`)
    }
    console.error('  💡 这是 G-978069 那一型:旁路入库的提交把票面射程外的路径按旧副本写回,吞掉了别人已入库的内容。')
    console.error('     修复只有前向回补(§22 不重写历史):按被吞内容的原 blob 重新落地,参照 cfabf3128a 的形态。')
    console.error('     本枚已在增量台账里判过一次,不会反复红;但损坏内容仍须修,台账不是豁免。')
  } else {
    console.log('✅ 旁路落地声明面对账通过(射程外路径无写回旧态;未判定与只报数均已逐条点名)')
  }
}

// ---- 自检(夹具走 scratch-dir;判据正反例 + 台账 + 退出码映射) ----
function selfTest() {
  const results = []
  const t = (name, cond, note = '') => {
    results.push(cond)
    console.log(`${cond ? 'ok' : 'FAIL'} —— ${name}${note ? ` (实得:${note})` : ''}`)
  }
  const GIT = gitBinary()
  const repo = (prefix) => {
    const dir = mkScratch(prefix)
    const run = (...a) =>
      execFileSync(GIT, ['-c', 'safe.directory=*', ...a], { cwd: dir, encoding: 'utf8', windowsHide: true, timeout: 300_000 }).toString()
    run('init', '-q', '-b', 'main')
    run('config', 'user.email', 't@t')
    run('config', 'user.name', 't')
    return { dir, run }
  }
  const put = (dir, rel, text) => writeFileSync(join(dir, rel), text, 'utf8')
  const headSha = (run) => run('rev-parse', 'HEAD').trim()
  const bypassCommit = (dir, run, mutate) => {
    mutate()
    run('add', '-A')
    const tree = run('write-tree').trim()
    return run('commit-tree', tree, '-p', headSha(run), '-m', 'bypass (selftest)').trim()
  }
  const writeJournal = (dir, recs) => {
    const journalPath = resolve(dir, LEDGER_REL)
    mkdirSync(dirname(journalPath), { recursive: true })
    writeFileSync(journalPath, recs.map((o) => JSON.stringify(o)).join('\n') + '\n', 'utf8')
  }
  const rec = (sha, declared, source) => ({ ts: '2026-09-30T00:00:00Z', kind: 'bypass-landing', landedSha: sha, declaredFiles: declared, source: source ?? 'selftest' })

  // 1 真写回(阳性对照):声明只含 b,却把 a 写回 v1、另搭车全新 c-new ⇒ red 并点名祖先,c-new 进只报数档
  {
    const { dir, run } = repo('bypass-st-red-')
    try {
      put(dir, 'a.txt', 'v1\n'); put(dir, 'b.txt', 'v1\n'); run('add', '-A'); run('commit', '-qm', 'c1')
      put(dir, 'a.txt', 'v2\n'); put(dir, 'b.txt', 'v2\n'); run('add', '-A'); run('commit', '-qm', 'c2')
      const sha = bypassCommit(dir, run, () => {
        put(dir, 'a.txt', 'v1\n') // 写回 v1
        put(dir, 'c-new.txt', 'brand new\n')
      })
      const v = judgeRecord(dir, rec(sha, ['b.txt']))
      t('1 射程外路径写回祖先版本 ⇒ red', v.verdict === 'red', v.verdict)
      t('1a 点名写回路径与等值祖先', v.stale?.length === 1 && v.stale[0].path === 'a.txt' && !!v.stale[0].ancestor)
      t('1b 同枚无写回形态的射程外路径进只报数档', v.reportOnly?.some((x) => x.path === 'c-new.txt') === true)
    } finally { rmScratch(dir) }
  }
  // 2 干净记录(阴性对照):声明 ⊇ 实际 ⇒ clean
  {
    const { dir, run } = repo('bypass-st-clean-')
    try {
      put(dir, 'a.txt', 'v1\n'); run('add', '-A'); run('commit', '-qm', 'c1')
      put(dir, 'a.txt', 'v2\n'); run('add', '-A'); run('commit', '-qm', 'c2')
      const sha = bypassCommit(dir, run, () => put(dir, 'a.txt', 'v3\n'))
      const v = judgeRecord(dir, rec(sha, ['a.txt']))
      t('2 声明面覆盖实际面 ⇒ clean', v.verdict === 'clean', v.verdict)
    } finally { rmScratch(dir) }
  }
  // 3 射程外但全是新内容 ⇒ 只报数不判红(S4)
  {
    const { dir, run } = repo('bypass-st-new-')
    try {
      put(dir, 'a.txt', 'v1\n'); run('add', '-A'); run('commit', '-qm', 'c1')
      put(dir, 'a.txt', 'v2\n'); run('add', '-A'); run('commit', '-qm', 'c2')
      const sha = bypassCommit(dir, run, () => put(dir, 'c-new.txt', 'new\n'))
      const v = judgeRecord(dir, rec(sha, ['a.txt']))
      t('3 射程外新增文件 ⇒ report-only', v.verdict === 'report-only', v.verdict)
    } finally { rmScratch(dir) }
  }
  // 4 声明面为空 ⇒ 未判定(S2:不是"全都射程外")
  {
    const { dir, run } = repo('bypass-st-empty-')
    try {
      put(dir, 'a.txt', 'v1\n'); run('add', '-A'); run('commit', '-qm', 'c1')
      const v = judgeRecord(dir, rec(headSha(run), []))
      t('4 声明面为空 ⇒ undetermined', v.verdict === 'undetermined', v.verdict)
    } finally { rmScratch(dir) }
  }
  // 5 缺 landedSha ⇒ out-of-scope(不做任何 git 调用)
  {
    const v = judgeRecord('D:/nonexistent-root-must-not-be-touched', { landedSha: '', declaredFiles: ['x'] })
    t('5 缺 landedSha ⇒ out-of-scope', v.verdict === 'out-of-scope')
  }
  // 6 合并提交 ⇒ 未判定(S5)
  {
    const { dir, run } = repo('bypass-st-merge-')
    try {
      put(dir, 'base.txt', 'v1\n'); run('add', '-A'); run('commit', '-qm', 'c1')
      run('checkout', '-qb', 'side')
      put(dir, 'side.txt', 's\n'); run('add', '-A'); run('commit', '-qm', 's1')
      run('checkout', '-q', 'main')
      put(dir, 'main.txt', 'm\n'); run('add', '-A'); run('commit', '-qm', 'm1')
      run('merge', '-q', '--no-edit', 'side')
      const mergeSha = headSha(run)
      t('6a 夹具确为合并提交', parentsOf(dir, mergeSha).length === 2)
      const v = judgeRecord(dir, rec(mergeSha, ['main.txt']))
      t('6 合并提交的记录 ⇒ undetermined', v.verdict === 'undetermined', v.verdict)
    } finally { rmScratch(dir) }
  }
  // 7 landedSha 取不到 ⇒ 未判定(S5)
  {
    const { dir, run } = repo('bypass-st-unreach-')
    try {
      put(dir, 'a.txt', 'v1\n'); run('add', '-A'); run('commit', '-qm', 'c1')
      const v = judgeRecord(dir, rec('0'.repeat(40), ['a.txt']))
      t('7 landedSha 对象不存在 ⇒ undetermined', v.verdict === 'undetermined', v.verdict)
    } finally { rmScratch(dir) }
  }
  // 8 祖先窗口截断 ⇒ 未判定(46 个祖先 > 40 窗口,写回最老版)
  {
    const { dir, run } = repo('bypass-st-window-')
    try {
      put(dir, 'a.txt', 'v0\n'); run('add', '-A'); run('commit', '-qm', 'c0')
      for (let i = 1; i <= 45; i++) {
        put(dir, 'a.txt', `v${i}\n`)
        run('add', '-A'); run('commit', '-qm', `c${i}`)
      }
      const sha = bypassCommit(dir, run, () => put(dir, 'a.txt', 'v0\n'))
      const v = judgeRecord(dir, rec(sha, ['zzz-unused.txt']))
      t('8 窗口截断无命中 ⇒ undetermined(不静默绿)', v.verdict === 'undetermined', v.verdict)
    } finally { rmScratch(dir) }
  }
  // 9 增量台账:同枚只判一次(S6)
  {
    const { dir, run } = repo('bypass-st-ledger-')
    try {
      put(dir, 'a.txt', 'v1\n'); run('add', '-A'); run('commit', '-qm', 'c1')
      const sha = bypassCommit(dir, run, () => put(dir, 'a.txt', 'v2\n'))
      writeJournal(dir, [rec(sha, ['a.txt'])])
      const r1 = audit(dir)
      t('9 首跑 clean 计数 1', r1.counts.clean === 1 && r1.status === 'ok', JSON.stringify(r1.counts))
      const r2 = audit(dir)
      t('9a 二跑只跳过不重判', r2.counts.skipped === 1 && r2.counts.clean === 0, JSON.stringify(r2.counts))
    } finally { rmScratch(dir) }
  }
  // 10 日志缺失 ⇒ exit2(S2:未判定,绝不静默绿)
  {
    const { dir, run } = repo('bypass-st-nojournal-')
    try {
      put(dir, 'a.txt', 'v1\n'); run('add', '-A'); run('commit', '-qm', 'c1')
      const r = audit(dir)
      t('10 日志缺失 ⇒ exit2', r.status === 'exit2', r.status)
    } finally { rmScratch(dir) }
  }
  // 11 审计汇总判红 + 红记录带声明外路径全集
  {
    const { dir, run } = repo('bypass-st-shape-')
    try {
      put(dir, 'a.txt', 'v1\n'); run('add', '-A'); run('commit', '-qm', 'c1')
      put(dir, 'a.txt', 'v2\n'); run('add', '-A'); run('commit', '-qm', 'c2')
      const sha = bypassCommit(dir, run, () => put(dir, 'a.txt', 'v1\n'))
      writeJournal(dir, [rec(sha, ['nope.txt'])])
      const r = audit(dir)
      t('11 审计汇总判红', r.status === 'ok' && r.reds.length === 1, `${r.status}/${r.reds.length}`)
      t('11a 红记录带声明外路径全集', r.reds[0]?.extras.includes('a.txt') === true)
      t('11b 红记录带来源与时间戳锚点', typeof r.reds[0]?.source === 'string' && typeof r.reds[0]?.ts === 'string')
    } finally { rmScratch(dir) }
  }
  // 12 中文路径逐字对账(-z 面,quotePath 不变形)
  {
    const { dir, run } = repo('bypass-st-zh-')
    try {
      put(dir, '组件.txt', 'v1\n'); run('add', '-A'); run('commit', '-qm', 'c1')
      put(dir, '组件.txt', 'v2\n'); run('add', '-A'); run('commit', '-qm', 'c2')
      const sha = bypassCommit(dir, run, () => put(dir, '组件.txt', 'v1\n'))
      const v = judgeRecord(dir, rec(sha, ['别的.txt']))
      t('12 中文路径写回被点名(不乱码不漏判)', v.verdict === 'red' && v.stale[0]?.path === '组件.txt', String(v.stale?.[0]?.path))
    } finally { rmScratch(dir) }
  }
  // 13 坏行计数 + 其余记录照判
  {
    const { dir, run } = repo('bypass-st-badline-')
    try {
      put(dir, 'a.txt', 'v1\n'); run('add', '-A'); run('commit', '-qm', 'c1')
      const sha = bypassCommit(dir, run, () => put(dir, 'a.txt', 'v2\n'))
      const journalPath = resolve(dir, LEDGER_REL)
      mkdirSync(dirname(journalPath), { recursive: true })
      writeFileSync(journalPath, '{broken json\n' + JSON.stringify(rec(sha, ['a.txt'])) + '\n', 'utf8')
      const r = audit(dir)
      t('13 坏行计数不吞记录', r.counts.badLines === 1 && r.counts.clean === 1, JSON.stringify({ bad: r.counts.badLines, clean: r.counts.clean }))
    } finally { rmScratch(dir) }
  }
  const pass = results.filter(Boolean).length
  console.log(`--self-test:${pass} 通过 / ${results.length - pass} 失败(共 ${results.length} 例)`)
  return pass === results.length ? 0 : 1
}

function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) process.exit(selfTest())
  const rootArg = argv.includes('--root') ? argv[argv.indexOf('--root') + 1] : null
  const root = rootArg ? resolve(rootArg) : DEFAULT_ROOT
  const strict = argv.includes('--strict')
  // --staged:runner 统一追加;本门判的是已落地提交与留痕日志,与暂存面无关,接受并忽略。
  const r = audit(root, { strict })
  printReport(r)
  if (r.status === 'exit2') process.exit(2)
  process.exit(r.reds.length > 0 ? 1 : 0)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
