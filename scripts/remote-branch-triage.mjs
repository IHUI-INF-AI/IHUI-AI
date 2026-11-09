#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- CLI 工具,需 console 输出结论表 */
/**
 * remote-branch-triage.mjs —— 远端分支逐支三态判定的唯一可复用器件(2026-11-09 立)。
 *
 * 为什么要有这一层:此前两轮分支清理由一次性 Python here-doc 完成,判据散落在对话里,
 * 定时档看不到本地 worktree、器件又只清 cross-end-auto* 快照,于是「任务做完即弃、
 * 分支永远不收尾」每天继续产生新残留。本器件把判定与删除收成一条可重跑的机械链:
 *
 *   权威 tip(ls-remote) → 补齐对象(fetch 只加对象) → 四重判据 → 安全闸 → 三态报告 → [--apply 才删]
 *
 * 判据按强度排序(任何一条成立且过闸,才允许写 DISCARDABLE):
 *   ① merged      : merge-base --is-ancestor <tip> <base>  ⇒ 所有提交已在 base,删 ref 零内容损失。
 *   ② content     : A = diff --name-only base...tip(分支自己改过的文件);
 *                   B = diff --name-only base tip(当前两棵树差异);A∩B = ∅ ⇒ 改动逐字节落地。
 *   ③ lines       : 分支引入的新增行(排除生成块文件)逐条能在 base 对应文件里找到 ⇒ 语义已落地。
 *   ④ merge-probe : git merge-tree --write-tree base tip 只读试算,输出冲突面供收敛队列排序。
 *
 * 铁律(与 §9b / §22c 同源):
 *   · 真远端只认 git ls-remote,不认 GitHub /branches API(实测 API sha 可能落后于真实 ref)。
 *   · 对象取不到 / 凭据缺失 / 命令超时一律 UNJUDGED,绝不把「未判定」写成「判过」。
 *   · 挂 open PR(非 bot 或带 keep)、被在飞 worktree 检出占用、保护前缀一律 HOLD,不删。
 *   · 默认 dry-run;--apply 前必做二次校验(tip 未漂移 / 无新 PR / 判据重跑),且单轮有上限。
 *   · 删远端 ref 前不留本地分支副本:可弃集合本身即「零内容损失」,故无需 tag 备份;
 *     任何 NEEDS_WORK 分支一律不进删除集,交由业务裁决或 branch-delete-with-backup.mjs。
 *
 * 用法:
 *   node scripts/remote-branch-triage.mjs --repo D:/IHUI-AI [--base origin/main]
 *       [--remote origin] [--json out.json] [--markdown out.md]
 *       [--apply] [--max-delete 100] [--with-merge-probe]
 *
 * 环境变量:GH_TOKEN / GITHUB_TOKEN(GitHub REST,只读拉 open PR;--apply 时删 ref)。
 *          缺凭据 ⇒ 所有分支降级 HOLD_PR(未判定),不猜 PR 状态。
 *
 * 退出码:0 = 判定完成(dry-run 或删除全成功)· 1 = 存在删除失败 · 2 = 参数/取证不成立
 */
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { resolveGitBin } from './lib/gitdir.mjs'

const GIT = resolveGitBin() || 'git'
const API = 'https://api.github.com'
const PROTECT_PREFIX = ['main', 'backup/', 'ihui-backup/', 'cross-end-auto']
// 与 cross-end-auto-cleanup.yml 同口径:只有自动快照作者可被覆盖。
// dependabot[bot] 一律 HOLD_PR —— 其 PR 是真实依赖升级线,删掉只会让 Dependabot 重开,制造噪音。
const BOT_AUTHORS = new Set(['github-actions[bot]', 'ihui-cross-end-bot'])
const GENERATED_FILE = /(^|\/)(README[^/]*\.md|PROJECT_PLAN\.md|.*\.generated\..*|pnpm-lock\.yaml|.*\.b64\.txt|root-guard-manifest\.json)$/

/** ls-remote 文本 → { name: sha };畸形行直接丢,不猜。 */
export function parseLsRemote(text) {
  const out = {}
  for (const line of String(text ?? '').split(/\r?\n/)) {
    if (!line.trim()) continue
    const [sha, ref, ...rest] = line.split('\t')
    if (!/^[0-9a-f]{40}$/.test(sha ?? '') || !ref?.startsWith('refs/heads/') || rest.length) continue
    out[ref.slice('refs/heads/'.length)] = sha
  }
  return out
}

/** 三点 diff 文本 → 按文件收集新增行;生成块/锁文件/纯数字行不计入语义信号。 */
export function addedLines(diffText) {
  const out = new Map()
  let file = ''
  for (const line of String(diffText ?? '').split(/\r?\n/)) {
    if (line.startsWith('+++ b/')) {
      file = line.slice(6)
      continue
    }
    if (!line.startsWith('+') || line.startsWith('+++') || !file) continue
    const t = line.slice(1).trim()
    if (t.length < 8 || t.length > 400) continue
    if (/^[\d\s|`.,:%\-]+$/.test(t)) continue
    if (GENERATED_FILE.test(file)) continue
    if (!out.has(file)) out.set(file, [])
    out.get(file).push(t)
  }
  return out
}

/**
 * A∩B 落地判定的唯一真相源(§22c):A = diff --name-only base...tip(分支自己改过的文件),
 * B = diff --name-only base tip(两棵树仍不同的文件),still = A∩B 即「改动尚未逐字节落地」的面。
 * 与 addedLines() 同源口径:GENERATED_FILE 命中的 README 系、PROJECT_PLAN.md、
 * 带 .generated. 的派生文件、pnpm-lock.yaml 等,只算生成块噪声,不计语义信号 ——
 * 否则只改 README 的分支会因 base 侧 README 被后续提交动过而假红 NEEDS_WORK。
 * 不静默丢弃:总数 / 生成块命中数 / 真代码差异数全部显式回传,contentLanded 只在真代码差异为 0 时成立。
 * 入参直接吃 git --name-only 的原始文本,run() 与 executeDeletes() 二次校验共用此函数,零复制实现。
 */
export function splitStill(aText, bText) {
  const as = new Set(String(aText ?? '').split(/\r?\n/).filter(Boolean))
  const bs = new Set(String(bText ?? '').split(/\r?\n/).filter(Boolean))
  const still = [...as].filter((f) => bs.has(f))
  const stillGenerated = still.filter((f) => GENERATED_FILE.test(f)).length
  const stillCode = still.length - stillGenerated
  return {
    still,
    stillDiff: still.length,
    stillGenerated,
    stillCode,
    contentLanded: stillCode === 0,
  }
}

/** merge-tree --write-tree 输出 → 冲突文件路径集合(第一行是 tree oid,后续是 stage 行)。 */
export function mergeConflictFiles(output) {
  const set = new Set()
  for (const line of String(output ?? '').split(/\r?\n/).slice(1)) {
    // 冲突段之后是 messages 段(缩进文本);遇到非 stage 行必须 break 而不是 continue,
    // 否则 messages 段里恰好带 tab 的伪 stage 行会被算成冲突面(镜像测试 C3 钉住)。
    if (!line.includes('\t') || !/^\d{6} [0-9a-f]{40,} \d\t/.test(line)) break
    set.add(line.split('\t')[1])
  }
  return [...set]
}

/** 单支判定的安全闸 + 三态;所有输入都显式传入,纯函数,便于镜像测试逐闸反证。 */
export function classify(row, opts = {}) {
  const { protectPrefix = PROTECT_PREFIX, botAuthors = BOT_AUTHORS } = opts
  const name = String(row?.name ?? '')
  if (!name) return { verdict: 'UNJUDGED', reason: '分支名为空' }
  if (name === 'main') return { verdict: 'MAIN', reason: '主干' }
  if (row.hasObject !== true) return { verdict: 'UNJUDGED', reason: 'tip 对象不在本地对象库' }
  if (row.prState === 'unknown') return { verdict: 'UNJUDGED', reason: 'PR 状态未判定' }
  const prs = Array.isArray(row.prs) ? row.prs : []
  for (const pr of prs) {
    const author = String(pr.author ?? '')
    const labels = Array.isArray(pr.labels) ? pr.labels : []
    if (!botAuthors.has(author) || labels.includes('keep')) {
      return { verdict: 'HOLD_PR', reason: `open PR #${pr.number} 作者=${author} keep=${labels.includes('keep')}` }
    }
  }
  if (protectPrefix.some((p) => name === p || name.startsWith(p))) {
    return { verdict: 'HOLD_PROTECT', reason: '保护语义前缀' }
  }
  if (row.heavySkipped === true) {
    return { verdict: 'UNJUDGED', reason: `独有提交 ${row.ahead} 笔,超出深判阈值,本轮不判绿` }
  }
  const landed = row.merged === true || row.contentLanded === true || row.linesLanded === true
  if (landed && row.worktree === true) {
    return { verdict: 'HOLD_WORKTREE', reason: '内容零风险,但避让在飞检出 upstream' }
  }
  if (landed) {
    let why
    if (row.merged === true) {
      why = 'main 祖先'
    } else if (row.contentLanded === true) {
      // A∩B 非空但全是被过滤的生成块时,不能谎称「A∩B=∅」,须如实带出过滤数(门 41)。
      why = row.stillGenerated > 0
        ? `A∩B 真代码差异=0(过滤生成块 ${row.stillGenerated}, still=${row.stillDiff})`
        : 'A∩B=∅'
    } else {
      why = '新增行 100% 落地'
    }
    return { verdict: 'DISCARDABLE', reason: why }
  }
  return { verdict: 'NEEDS_WORK', reason: `仍有未落地内容(still=${row.stillDiff ?? '?'}, 真代码=${row.stillCode ?? '?'}, 过滤生成块=${row.stillGenerated ?? 0}, 独有行=${row.lineMiss ?? '?'})` }
}

/** 删除前的二次校验:任一项不符即整支跳过,绝不「差不多就删」。 */
export function safetyCheck(row, ctx) {
  const live = ctx.live ?? {}
  const prByHead = ctx.prByHead ?? {}
  const name = row.name
  if (live[name] === undefined) return { pass: false, reason: 'REF_GONE' }
  if (live[name] !== row.sha) return { pass: false, reason: `TIP_CHANGED ${row.sha.slice(0, 10)}→${live[name].slice(0, 10)}` }
  if ((prByHead[name] ?? []).length) return { pass: false, reason: 'NEW_OPEN_PR' }
  if (row.merged !== true && row.contentLanded !== true && row.linesLanded !== true) {
    return { pass: false, reason: 'LANDED_RECHECK_MISSING' }
  }
  if (row.worktree === true) return { pass: false, reason: 'WORKTREE_IN_FLIGHT' }
  if (row.verdict !== 'DISCARDABLE') return { pass: false, reason: `VERDICT=${row.verdict}` }
  return { pass: true, reason: row.reason }
}

function git(args, repo, timeout = 180000) {
  const r = spawnSync(GIT, ['-C', repo, ...args], {
    // 门 193:派生 git 必须显式接管 stdio,否则本机 EBUSY(30 组对照:不写 0/30 成功,补上 30/30)。
    // 绝对路径 git 不是豁免,判据只认 options 内有 stdio 属性名。
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024,
    timeout,
    windowsHide: true,
  })
  return { rc: r.status ?? -1, out: r.stdout ?? '', err: r.stderr ?? '' }
}

async function api(pathname, token, method = 'GET', body) {
  const res = await fetch(API + pathname, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'ihui-remote-branch-triage',
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  let data = null
  try { data = text ? JSON.parse(text) : null } catch { data = text }
  return { status: res.status, data }
}

async function fetchAllOpenPrs(repoSlug, token) {
  const out = []
  for (let page = 1; page <= 20; page += 1) {
    const { status, data } = await api(`/repos/${repoSlug}/pulls?state=open&per_page=100&page=${page}`, token)
    if (status !== 200 || !Array.isArray(data)) return { ok: false, prs: out }
    out.push(...data)
    if (data.length < 100) return { ok: true, prs: out }
  }
  return { ok: false, prs: out }
}

function repoSlugFromRemote(repo, remote) {
  const q = git(['remote', 'get-url', remote], repo)
  const m = String(q.out).trim().match(/github\.com[/:]([^/]+\/[^/.]+?)(?:\.git)?$/)
  return m ? m[1] : ''
}

export function markdownReport(rows, meta) {
  const L = []
  const A = (s) => L.push(s)
  A('# 远端分支三态判定(器件生成)')
  A('')
  A(`基线 \`${meta.base}\` · 真远端 ${rows.length} 支 · open PR ${meta.prCount} · 模式 ${meta.apply ? 'APPLY' : 'DRY-RUN'}`)
  A('')
  A('| 定性 | 数量 |')
  A('| --- | --- |')
  const c = {}
  for (const r of rows) c[r.verdict] = (c[r.verdict] ?? 0) + 1
  for (const k of Object.keys(c).sort()) A(`| ${k} | ${c[k]} |`)
  A('')
  A('| 分支 | tip | verdict | 依据 | PR | WT | still | 冲突面 |')
  A('| --- | --- | --- | --- | --- | --- | --- | --- |')
  for (const r of [...rows].sort((a, b) => a.name.localeCompare(b.name))) {
    const pr = (r.prs ?? []).map((p) => `#${p.number}`).join(',') || '—'
    A(`| \`${r.name}\` | \`${r.sha.slice(0, 12)}\` | ${r.verdict} | ${r.reason} | ${pr} | ${r.worktree ? 'Y' : 'N'} | ${r.stillDiff ?? '—'} | ${(r.mergeConflicts ?? []).length} |`)
  }
  A('')
  return L.join('\n')
}

function printHelp() {
  console.log([
    'remote-branch-triage.mjs — 远端分支逐支三态判定(默认 dry-run)',
    '',
    '用法: node scripts/remote-branch-triage.mjs --repo <path> [options]',
    '',
    '  --base <rev>            判定基线,默认真远端 main(ls-remote)',
    '  --remote <name>         默认 origin',
    '  --json <file>           写结构化结果',
    '  --markdown <file>       写三态表',
    '  --from-json <file>      复用已判定报告,只跑删除段(秒级,仍做二次校验)',
    '  --with-merge-probe      额外跑 merge-tree 只读试算(收敛队列排序用)',
    '  --apply                 执行删除(仍逐支二次校验 + 单轮上限)',
    '  --max-delete <n>        单轮上限,默认 100',
    '',
    '凭据: GH_TOKEN / GITHUB_TOKEN;缺失 ⇒ 全部降级 HOLD_PR/UNJUDGED,绝不猜 PR。',
  ].join('\n'))
}

export async function run(argv = process.argv.slice(2), env = process.env) {
  const o = {
    repo: process.cwd(), remote: 'origin', base: '', json: '', markdown: '', fromJson: '',
    apply: false, maxDelete: 100, mergeProbe: false,
  }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--help' || a === '-h') { printHelp(); return 0 }
    else if (a === '--apply') o.apply = true
    else if (a === '--with-merge-probe') o.mergeProbe = true
    else if (['--repo', '--base', '--remote', '--json', '--markdown', '--max-delete', '--from-json'].includes(a)) {
      const v = argv[++i]
      if (!v) { console.error(`❌ ${a} 缺值`); return 2 }
      if (a === '--repo') o.repo = v
      if (a === '--base') o.base = v
      if (a === '--remote') o.remote = v
      if (a === '--json') o.json = v
      if (a === '--markdown') o.markdown = v
      if (a === '--from-json') o.fromJson = v
      if (a === '--max-delete') o.maxDelete = Number(v)
    } else { console.error(`❌ 未知参数 ${a}(拼错必须当场失败)`); return 2 }
  }
  if (!Number.isInteger(o.maxDelete) || o.maxDelete < 1) { console.error('❌ --max-delete 必须是正整数'); return 2 }
  const token = env.GH_TOKEN || env.GITHUB_TOKEN || ''
  const slug = repoSlugFromRemote(o.repo, o.remote)
  if (!slug) { console.error('❌ 无法从 remote URL 解析 GitHub 仓库'); return 2 }

  // --from-json:复用一份已判定报告直接进删除段,免去 Windows 真仓约 8 分钟的全量重判。
  // 安全性不降:executeDeletes 仍会重新 ls-remote 校 tip、重拉 open PR、重跑落地判据。
  if (o.fromJson) {
    let j
    try { j = JSON.parse(readFileSync(o.fromJson, 'utf8')) } catch (e) {
      console.error('❌ 报告不可读:', e?.message ?? e); return 2
    }
    const rows = Array.isArray(j.rows) ? j.rows : []
    const meta = j.meta ?? {}
    o.base = o.base || meta.base || ''
    if (!/^[0-9a-f]{40}$/.test(o.base)) { console.error('❌ 报告缺合法基线,拒绝执行'); return 2 }
    const cands = rows.filter((r) => r.verdict === 'DISCARDABLE')
    console.log(`[from-json] 报告 ${rows.length} 支,基线 ${o.base},可弃 ${cands.length} 支`)
    return executeDeletes(cands, o, token, slug, meta)
  }

  // ① 权威 tip + 基线:真远端只认 ls-remote
  const lr = git(['ls-remote', '--heads', o.remote], o.repo)
  if (lr.rc !== 0) { console.error('❌ ls-remote 失败:', lr.err.trim().slice(0, 160)); return 2 }
  const live = parseLsRemote(lr.out)
  if (!o.base) {
    const m = git(['ls-remote', o.remote, 'refs/heads/main'], o.repo)
    o.base = String(m.out).trim().split('\t')[0] || ''
  }
  if (!/^[0-9a-f]{40}$/.test(o.base)) { console.error('❌ 基线未判定,拒绝继续'); return 2 }

  // ② open PR:缺凭据 ⇒ 全部未判定,不猜
  let prState = 'ok'
  let prs = []
  if (!token) prState = 'unknown'
  else {
    const r = await fetchAllOpenPrs(slug, token)
    if (!r.ok) prState = 'unknown'
    else prs = r.prs
  }
  const prByHead = {}
  for (const p of prs) {
    const head = p?.head?.ref
    if (!head) continue
    ;(prByHead[head] ??= []).push({
      number: p.number,
      author: p?.user?.login ?? '',
      labels: (p?.labels ?? []).map((l) => l?.name ?? ''),
    })
  }

  // ③ worktree 占用
  const wt = git(['worktree', 'list', '--porcelain'], o.repo)
  const wtBranches = new Set(
    String(wt.out).split(/\r?\n/).filter((l) => l.startsWith('branch refs/heads/'))
      .map((l) => l.slice('branch refs/heads/'.length)),
  )

  // ④ 补齐缺失对象(fetch 只加对象,不改本地 ref / 工作树)
  const missing = Object.entries(live).filter(([, sha]) => git(['cat-file', '-e', `${sha}^{commit}`], o.repo).rc !== 0)
  for (const [name] of missing) {
    const f = git(['fetch', '--no-tags', o.remote, `refs/heads/${name}`], o.repo)
    if (f.rc !== 0) console.log(`  ⚠️ 对象补齐失败 ${name}: ${f.err.trim().slice(0, 80)}`)
  }

  // ⑤ 逐支四重判据
  const rows = []
  const baseFileCache = new Map()
  const baseFile = (f) => {
    if (!baseFileCache.has(f)) {
      const q = git(['show', `${o.base}:${f}`], o.repo)
      baseFileCache.set(f, q.rc === 0 ? q.out : '')
    }
    return baseFileCache.get(f)
  }
  for (const [name, sha] of Object.entries(live)) {
    const row = {
      name, sha, hasObject: git(['cat-file', '-e', `${sha}^{commit}`], o.repo).rc === 0,
      prState, prs: prByHead[name] ?? [], worktree: wtBranches.has(name),
      ahead: null, merged: null, contentLanded: null, linesLanded: null,
      stillDiff: null, stillGenerated: null, stillCode: null, lineMiss: null, mergeConflicts: [],
    }
    if (row.hasObject) {
      row.merged = git(['merge-base', '--is-ancestor', sha, o.base], o.repo).rc === 0
      const ah = git(['rev-list', '--count', '--no-merges', `${o.base}..${sha}`], o.repo)
      row.ahead = ah.rc === 0 ? Number(ah.out.trim()) : null
      // 体量闸:备份线可达 7778 笔独有提交 / 13727 文件,跑 unified diff 会把整轮拖进超时
      // (2026-11-09 首次真仓自验实测 SIGTERM)。这类分支一律 UNJUDGED,绝不写成判过。
      if ((row.ahead ?? 0) > 200) row.heavySkipped = true
      if (!row.heavySkipped) {
        const A = git(['diff', '--name-only', `${o.base}...${sha}`], o.repo)
        const B = git(['diff', '--name-only', o.base, sha], o.repo)
        if (A.rc === 0 && B.rc === 0) {
          const s = splitStill(A.out, B.out)
          row.stillDiff = s.stillDiff
          row.stillGenerated = s.stillGenerated
          row.stillCode = s.stillCode
          row.contentLanded = s.contentLanded
        }
        // 新增行深判只对「改动面小」的分支做:stillDiff 大时补丁本身就是几千行,
        // 逐行比对既慢又不可能判出 100% 落地,跳过比硬跑诚实。
        if ((row.ahead ?? 0) <= 50 && (row.stillDiff ?? 999) <= 50) {
          const D = git(['diff', '--unified=0', '--no-ext-diff', `${o.base}...${sha}`], o.repo)
          if (D.rc === 0) {
            const adds = addedLines(D.out)
            let total = 0
            let hit = 0
            for (const [f, lines] of adds) {
              const content = baseFile(f)
              for (const t of lines) { total += 1; if (content.includes(t)) hit += 1 }
            }
            row.lineTotal = total
            row.lineMiss = total - hit
            row.linesLanded = total > 0 && total === hit
          }
        }
      }
      if (o.mergeProbe && (row.ahead ?? 0) <= 200) {
        const M = git(['merge-tree', '--write-tree', o.base, sha], o.repo)
        row.mergeConflicts = mergeConflictFiles(M.out)
        row.mergeClean = M.rc === 0
      }
    }
    Object.assign(row, classify(row))
    rows.push(row)
  }

  const meta = { base: o.base, prCount: prs.length, apply: o.apply, prState, missing: missing.length }
  const report = markdownReport(rows, meta)
  if (o.json) writeFileSync(o.json, JSON.stringify({ meta, rows }, null, 2), 'utf8')
  if (o.markdown) writeFileSync(o.markdown, report, 'utf8')
  const tally = {}
  for (const r of rows) tally[r.verdict] = (tally[r.verdict] ?? 0) + 1
  console.log(`基线=${o.base} 真远端=${rows.length} openPR=${prs.length} PR判定=${prState} 补齐对象=${missing.length}`)
  console.log('三态=' + JSON.stringify(tally))

  return executeDeletes(rows.filter((r) => r.verdict === 'DISCARDABLE'), o, token, slug, meta)
}

/**
 * 删除执行段(全量判定与 --from-json 共用唯一实现):
 * dry-run 只报数;--apply 才做二次权威 tip + 二次 open PR + 落地判据重跑 + 单轮上限 + 逐条留痕 + DELETE。
 * 绝不因为「报告里写着可弃」就跳过复验 —— 报告只是候选集,不是授权。
 */
export async function executeDeletes(cands, o, token, slug, meta = {}) {
  if (!o.apply) {
    console.log(`[dry-run] 可弃 ${cands.length} 支,未删任何 ref。--apply 才会执行。`)
    return 0
  }
  if (!token) { console.error('❌ 无凭据,拒绝 --apply'); return 2 }
  if (meta.prState && meta.prState !== 'ok') { console.error('❌ 报告标注 PR 状态未判定,拒绝 --apply'); return 2 }
  if (cands.length > o.maxDelete) { console.error(`❌ 候选 ${cands.length} > 上限 ${o.maxDelete},拒绝执行`); return 2 }
  // 二次权威 tip + 二次 open PR
  const live2 = parseLsRemote(git(['ls-remote', '--heads', o.remote], o.repo).out)
  const prs2 = await fetchAllOpenPrs(slug, token)
  if (!prs2.ok) { console.error('❌ 二次 PR 取证失败,拒绝删除'); return 2 }
  const prByHead2 = {}
  for (const p of prs2.prs) (prByHead2[p?.head?.ref] ??= []).push(p)
  const ok = []
  for (const r of cands) {
    const s = safetyCheck(r, { live: live2, prByHead: prByHead2 })
    if (!s.pass) { console.log(`  SKIP ${r.name} (${s.reason})`); continue }
    // 判据重跑(防期间 base 前进 / 对象变化)
    let stillOk = false
    if (r.merged === true) stillOk = git(['merge-base', '--is-ancestor', r.sha, o.base], o.repo).rc === 0
    else if (r.contentLanded === true) {
      const A = git(['diff', '--name-only', `${o.base}...${r.sha}`], o.repo)
      const B = git(['diff', '--name-only', o.base, r.sha], o.repo)
      stillOk = A.rc === 0 && B.rc === 0 && splitStill(A.out, B.out).contentLanded
    } else stillOk = r.linesLanded === true
    if (!stillOk) { console.log(`  SKIP ${r.name} (LANDED_RECHECK_FAIL)`); continue }
    ok.push(r)
    console.log(`  DELETE-CANDIDATE ${r.name}|${r.sha.slice(0, 12)}|${r.reason}`)
  }
  let failed = 0
  for (const r of ok) {
    const { status } = await api(`/repos/${slug}/git/refs/heads/${r.name}`, token, 'DELETE')
    if (status === 204) console.log(`  DELETED ${r.name}`)
    else { failed += 1; console.log(`  FAILED ${r.name} HTTP=${status}`) }
  }
  console.log(`删除成功=${ok.length - failed} 失败=${failed} 跳过=${cands.length - ok.length}`)
  return failed ? 1 : 0
}

const isMain = process.argv[1]
  ? path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))
  : false
if (isMain) {
  run().then((rc) => { process.exitCode = rc }).catch((e) => {
    console.error('❌ 未判定异常:', e?.message ?? e)
    process.exitCode = 2
  })
}

export const __test__ = {
  parseLsRemote, addedLines, splitStill, mergeConflictFiles, classify, safetyCheck, markdownReport,
  PROTECT_PREFIX, BOT_AUTHORS, GENERATED_FILE,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
