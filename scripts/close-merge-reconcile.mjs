#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import fs from 'node:fs'
import path from 'node:path'
import { gitRaw } from './lib/face-reader.mjs'

const argv = process.argv.slice(2)
const MODE = argv[0] && !argv[0].startsWith('--') ? argv[0] : 'plan'
const arg = (k, d) => {
  const i = argv.indexOf(`--${k}`)
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : d
}
const has = (k) => argv.includes(`--${k}`)
const CWD = process.cwd()

function git(args, cwd = CWD, allowFail = false) {
  try {
    return String(gitRaw(args, cwd, { maxBuffer: 1 << 26 }) ?? '').trim()
  } catch (e) {
    if (allowFail) return null
    const detail = String(e?.stderr || e?.message || e).trim()
    console.error(`✖ git ${args.join(' ')} 失败: ${detail || '(无 stderr)'}`)
    process.exit(2)
  }
}

const body = (sha, cwd) => {
  const subject = git(['log', '-1', '--format=%s', sha], cwd, true) || '(取不到)'
  const when = git(['log', '-1', '--format=%aI', sha], cwd, true) || '(取不到)'
  return `${sha.slice(0, 12)} ${when} ${subject}`
}

// ---------------------------------------------------------------- plan
// 2026-11-12 重写:旧指引教"建隔离 worktree 做 close merge",与 §12d(owner 定案禁用 worktree
// 新建)直接冲突,且实测是 worktree 乱象的指引型源头之一(会话照本宣科 ⇒ 检出被建出来)。
// 新指引只走对象空间:union-converge(CAS 落地,零检出零写工作区)→ 滞后回写 → 派生重生成 →
// 门复跑 → push。verify/race/post 子命令保留,一律在主树目录运行。
function plan() {
  const repo = path.resolve(arg('repo', CWD))
  const mainRef = arg('main', 'refs/heads/main')
  const originRef = arg('origin', 'origin/main')
  const mainSha = git(['rev-parse', `${mainRef}^{commit}`], repo)
  const originSha = git(['rev-parse', `${originRef}^{commit}`], repo)
  const base = git(['merge-base', mainSha, originSha], repo)
  const counts = git(['rev-list', '--left-right', '--count', `${mainSha}...${originSha}`], repo).split('\t')
  const onlyMain = counts[0]
  const onlyOrigin = counts[1]

  const out = []
  const p = (s = '') => out.push(s)

  p('══ 收口计划(只读生成;本工具不执行任何推送/提交) ══')
  p(`仓           : ${repo}`)
  p(`本地 main    : ${body(mainSha, repo)}`)
  p(`上游 tip     : ${body(originSha, repo)}`)
  p(`merge-base   : ${body(base, repo)}`)
  p(`分叉         : 仅 main ${onlyMain} 笔 / 仅上游 ${onlyOrigin} 笔`)
  p('')
  p('── 0. 铁律前提(§12d/§12h) ──')
  p('禁 worktree 新建(含 --detach);禁 stash;禁 reset --hard;禁 git add -A;禁 --no-verify。')
  p('主工作树只允许"滞后回写"一种写:git restore --source=HEAD --worktree -- <逐路径>,')
  p('且回写前逐路径核盘 blob ∈ 该路径祖先 blob 集(真改/他人面一律跳过并点名)。')
  p('')
  p('── 1. 取上游 + 对象空间收敛合并(唯一出口 = union-converge) ──')
  p(`git -C ${repo} fetch origin main`)
  p(`git -C ${repo} rev-parse refs/heads/main origin/main          # 记录两侧 tip(后续所有步骤以此为准)`)
  p('  node scripts/union-converge.mjs                             # 报告模式:零副作用,先看结论')
  p('  node scripts/union-converge.mjs --apply                     # 落地:临时索引+commit-tree+CAS,不碰工作区')
  p('  · 卡点出口(全部声明式,逐条带理由,写进合并提交信息):')
  p('    --fold-keep \'PROJECT_PLAN.md=<json [{fp,keep,why}]>\'     # 同题多版台账唯一裁决')
  p('    --resolve \'<path>=<人工判定全文文件>\'                     # 真三方报冲突后的回灌出口')
  p('    --declare-side-loss \'<path>=<json [{line,why}]>\'          # 有意少带对侧行(生成数字行等)')
  p('    --supersede \'<path>=<json [{dropped,kept,why}]>\'          # 语义搬家声明')
  p('  · 远端滚动 ⇒ 重新 fetch 重跑(CAS 失败即重来,最多 3 次);绝不 checkout、绝不建检出。')
  p('')
  p('── 2. 活文档与派生件(落地后在主树按规程回写/重生成) ──')
  p('· PROJECT_PLAN.md/AGENTS.md/README×4:union-converge 行级 union 已在面上;工作区滞后按 §0 规程回写。')
  p('· README 数字块收口规程(先回基线再整块重生成,不许手改数字/日期):')
  p('    git restore --source=HEAD --staged --worktree -- README.md README.zh-CN.md(如在册)')
  p('    node scripts/sync-readme-numbers.mjs && node scripts/auto-update-readme-recent.mjs')
  p('· 派生件(i18n 压缩/ui-routes/tokens/离线包):')
  p('    node scripts/heal-derived-in-checkout.mjs                 # 按 HEAD 面重生成+复量+落 blob')
  p('· 三本判定台账并集去重(本工具 union 子命令,先 git show 出两侧副本到临时件):')
  p('    node scripts/close-merge-reconcile.mjs union --ours <f> --theirs <f> --keys <k1,k2> --out <f> --apply')
  p('    # rn-host-shell-manual.json:--keys shared --array entries;web-rn-screen-map.jsonl:--keys web')
  p('· 门编号撞号:取上游编号为权威;本侧独有门按现读最大 +1 顺延,并同步 AGENTS.md / docs/GATEKEEPERS.md。')
  p('')
  p('── 3. 零丢失自证(union-converge 落地前已内置;复跑守门 100 A1 复核新合并) ──')
  p(`  node scripts/check-merge-addition-loss.mjs                  # 或 union-converge 落地后的自带复核`)
  p('')
  p('── 4. 阻塞门(任一红先判存量/本轮引入;本轮引入就地修;存量红按 §12e 处置不逼 --no-verify) ──')
  for (const c of [
    'node scripts/check-web-rn-gap-ratchet.mjs',
    'node scripts/decide-style-tier-forks.mjs --check --gate',
    'node scripts/check-rn-host-shell-coverage.mjs',
    'node scripts/check-miniapp-tokens-sync.mjs',
    'node scripts/check-cross-end-tokens.mjs',
    'node scripts/check-cross-end-ui-parity.mjs',
    'node scripts/check-retry-aliases.mjs',
    'node scripts/check-host-port-equivalence.mjs',
    'node scripts/check-plan-line-loss.mjs --staged',
    'node scripts/check-plan-fields.mjs --strict',
    'node scripts/check-plan-closed-stock.mjs',
    'node scripts/check-plan-deferred-expiry.mjs',
    'node scripts/check-staged-downgrade.mjs --staged',
    'node scripts/check-worktree-status.mjs --gate',
    'node scripts/check-worktree-dev-banned.mjs',
  ]) p(`  ${c}`)
  p('')
  p('── 5. 三包测试(主树依赖已在位;若合并触及 RN/小程序输入则复跑) ──')
  p('  pnpm --filter @ihui/mobile-rn test')
  p('  pnpm --filter @ihui/rn-app test')
  p('  pnpm --filter @ihui/miniapp-taro test')
  p('  · 部分测试按 HEAD 面读源码:落地前会假红;落地后 HEAD 面即合并树,须复跑。')
  p('')
  p('── 6. 推送前竞态闸(在主树运行,缺一不可) ──')
  p(`  ① node scripts/close-merge-reconcile.mjs race --pending .ihui-agent/tmp/pending-local-commits.txt`)
  p('     内含:ls-remote 读回远端 tip;逐笔比对 origin/main..HEAD 与「本席 pending 清单」;')
  p('     另检 refs/heads/main 是否已越过 HEAD(他席又落笔)。任一不成立 ⇒ exit 3 + 打印清单 ⇒ 停发。')
  p('  ② 本席 pending 清单按 hash 或题面一行一条,注释以 # 开头。')
  p('  ③ 推送: node scripts/git-push-guard.mjs   (或 git push origin main —— 非 force、不带 --no-verify)')
  p(`  ④ push 后: node scripts/close-merge-reconcile.mjs post`)
  p('     期望 origin/main...HEAD = 0/0;非 0/0 判红。')
  p('')
  p('── 7. 收尾(§12h 五步的本地侧) ──')
  p('历史检出:已并入 ⇒ git worktree remove + prune;未并入 ⇒ 先打 lost-commit/worktree-<name>-<sha7> 再回收。')
  p('已并入分支删除;stash 一律不保留(全局禁用),历史 stash 逐路径判吸收后打 lost-stash tag 再 drop。')

  console.log(out.join('\n'))
}

// ---------------------------------------------------------------- verify
function verify() {
  const wt = path.resolve(arg('worktree', CWD))
  const originSha = git(['rev-parse', `${arg('origin', 'origin/main')}^{commit}`], wt)
  const raw = git(['diff', '--name-only', `${originSha}...HEAD`], wt)
  const paths = raw ? raw.split('\n').filter(Boolean) : []
  let checked = 0
  const localDeleted = []
  const droppedByUpstream = []
  const missing = []
  for (const p of paths) {
    if (git(['cat-file', '-e', `HEAD:${p}`], wt, true) === null) {
      localDeleted.push(p)
      continue
    }
    checked++
    if (git(['cat-file', '-e', `:${p}`], wt, true) !== null) continue
    // 索引里没有:若对侧树里也早已没有该路径,那是上游删除(merge 的删除语义正确),
    // 不算丢失;只有「对侧还在、合并树却没了」才是真丢。
    if (git(['cat-file', '-e', `${originSha}:${p}`], wt, true) === null) droppedByUpstream.push(p)
    else missing.push(p)
  }
  const state = git(['ls-files', '-u'], wt, true) || ''
  const unmerged = state ? state.split('\n').filter(Boolean).length : 0
  console.log(
    `paths=${paths.length} checkedInHead=${checked} localDeleted=${localDeleted.length} ` +
      `droppedByUpstream=${droppedByUpstream.length} missing=${missing.length} unmerged=${unmerged}`,
  )
  for (const p of droppedByUpstream) console.log(`UPSTREAM-DELETED ${p}`)
  for (const p of missing) console.log(`MISSING ${p}`)
  if (unmerged) console.log('✖ 仍有未合并项:先解决冲突再谈零丢失')
  process.exit(missing.length || unmerged ? 1 : 0)
}

// ---------------------------------------------------------------- race
function race() {
  const wt = path.resolve(arg('worktree', CWD))
  const pendingFile = arg('pending')
  const allowDrift = has('allow-main-drift')
  const remoteLine = git(['ls-remote', 'origin', 'refs/heads/main'], wt, true)
  if (!remoteLine) {
    console.error('✖ ① ls-remote 取不到远端 tip(网络/鉴权/仓库不可达) ⇒ 不判绿')
    process.exit(2)
  }
  const remoteSha = remoteLine.split(/\s+/)[0]
  git(['fetch', 'origin', 'main'], wt)
  const headSha = git(['rev-parse', 'HEAD'], wt)
  const mainSha = git(['rev-parse', 'refs/heads/main'], wt, true)
  const src = git(['rev-list', '--left-right', '--count', 'HEAD...refs/heads/main'], wt, true)

  console.log(`① 远端 origin/main = ${remoteSha}`)
  console.log(`   HEAD            = ${headSha}`)
  console.log(`   本地 main       = ${mainSha || '(无)'}`)

  const listRaw = git(['log', '--format=%H%x09%an%x09%aI%x09%s', 'origin/main..HEAD'], wt)
  const list = (listRaw ? listRaw.split('\n') : []).filter(Boolean).map((l) => {
    const [sha, author, when, ...rest] = l.split('\t')
    return { sha, author, when, subject: rest.join('\t') }
  })

  let pending = null
  if (pendingFile && fs.existsSync(pendingFile)) {
    pending = fs
      .readFileSync(pendingFile, 'utf8')
      .replace(/^\uFEFF/, '')
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter((s) => s && !s.startsWith('#'))
      .map((line) => {
        const m = /^([0-9a-f]{7,40})\s+(.*)$/i.exec(line) // "<hash> <题面>" 或单行题面
        return m ? { sha: m[1].toLowerCase(), text: m[2].trim() } : { sha: null, text: line }
      })
  }
  const unknown = list.filter((c) => {
    if (!pending) return true
    return !pending.some((p) => (p.sha && c.sha.toLowerCase().startsWith(p.sha)) || (p.text && c.subject.includes(p.text)))
  })

  console.log(`② origin/main..HEAD 共 ${list.length} 笔;本席清单 ${pending ? pending.length : 0} 条;非本席 ${unknown.length} 笔`)
  if (unknown.length) {
    console.log('   ✖ 非本席提交清单:')
    for (const c of unknown) console.log(`     ${c.sha.slice(0, 12)} ${c.when} ${c.author} | ${c.subject}`)
  }
  const drift = src ? src.split('\t')[1] : null
  if (drift && Number(drift) > 0) {
    console.log(`   ${allowDrift ? '⚠' : '✖'} 本地 main 已越过 HEAD ${drift} 笔(他席仍在落笔)`)
  }
  const stop = unknown.length > 0 || (drift && Number(drift) > 0 && !allowDrift)
  console.log(stop ? 'STOP:不满足「HEAD 只含本席提交且未与他席分叉」⇒ 停发并把这批清单交回主会话' : 'PASS:满足推送前竞态闸')
  process.exit(stop ? 3 : 0)
}

// ---------------------------------------------------------------- post
function post() {
  const wt = path.resolve(arg('worktree', CWD))
  git(['fetch', 'origin', 'main'], wt)
  const remoteLine = git(['ls-remote', 'origin', 'refs/heads/main'], wt, true)
  if (!remoteLine) {
    console.error('✖ ③ ls-remote 读回失败 ⇒ 无法判定')
    process.exit(2)
  }
  const remoteSha = remoteLine.split(/\s+/)[0]
  const localSha = git(['rev-parse', 'HEAD'], wt)
  const c = git(['rev-list', '--left-right', '--count', 'origin/main...HEAD'], wt).split('\t')
  console.log(`③ 远端 origin/main = ${remoteSha}`)
  console.log(`   HEAD            = ${localSha}`)
  console.log(`   origin/main...HEAD = ${c[1]}/${c[0]} (期望 0/0)`)
  const ok = Number(c[0]) === 0 && Number(c[1]) === 0 && remoteSha === localSha
  console.log(ok ? 'PASS:推送已追上(0/0)' : 'FAIL:未达 0/0 或远端 tip 与 HEAD 不一致')
  process.exit(ok ? 0 : 1)
}

// ---------------------------------------------------------------- union
function union() {
  const oursPath = arg('ours')
  const theirsPath = arg('theirs')
  const outPath = arg('out')
  const keys = (arg('keys') || '').split(',').map((s) => s.trim()).filter(Boolean)
  const arrayKey = arg('array')
  const apply = has('apply')
  if (!oursPath || !theirsPath || !outPath || !keys.length) {
    console.error('✖ union 需要 --ours --theirs --out --keys')
    process.exit(2)
  }
  const read = (f) => fs.readFileSync(f, 'utf8')
  const parse = (text) => {
    const t = text.replace(/^\uFEFF/, '').trim()
    let obj = null
    try { obj = JSON.parse(t) } catch { obj = null } // 单行 JSONL 也能被 JSON.parse 成功 ⇒ 必须再要求"有数组"才认 JSON
    if (obj && typeof obj === 'object') {
      const arr = arrayKey ? obj[arrayKey] : Object.values(obj).find((v) => Array.isArray(v))
      if (Array.isArray(arr)) return { obj, rows: arr, kind: 'json' }
      if (arrayKey) throw new Error(`${arrayKey} 不是数组`)
    }
    return { obj: null, rows: t.split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l)), kind: 'jsonl' }
  }
  let ours
  let theirs
  try {
    ours = parse(read(oursPath))
    theirs = parse(read(theirsPath))
  } catch (e) {
    console.error(`✖ 解析失败: ${e.message}`)
    process.exit(2)
  }
  const keyOf = (r) => JSON.stringify(keys.map((k) => r[k]))
  const seen = new Set()
  const kept = []
  let dupOurs = 0
  let dupCross = 0
  for (const r of ours.rows) {
    const k = keyOf(r)
    if (seen.has(k)) { dupOurs++; continue }
    seen.add(k)
    kept.push(r)
  }
  for (const r of theirs.rows) {
    const k = keyOf(r)
    if (seen.has(k)) { dupCross++; continue }
    seen.add(k)
    kept.push(r)
  }
  console.log(`ours=${ours.rows.length} theirs=${theirs.rows.length} kept=${kept.length} dupOurs=${dupOurs} dupCross=${dupCross}`)
  if (!apply) {
    console.log('(dry-run:未写盘;确认后加 --apply)')
    return
  }
  let payload
  if (ours.kind === 'json') {
    const obj = { ...ours.obj }
    obj[arrayKey || Object.keys(ours.obj).find((k) => Array.isArray(ours.obj[k]))] = kept
    payload = JSON.stringify(obj, null, 2) + '\n'
  } else {
    payload = kept.map((r) => JSON.stringify(r)).join('\n') + '\n'
  }
  fs.writeFileSync(outPath, payload, 'utf8')
  console.log(`已写 ${outPath}(keep=${kept.length},dup=${dupOurs + dupCross})`)
}

const modes = { plan, verify, race, post, union }
if (!modes[MODE]) {
  console.error(`✖ 未知子命令 ${MODE};可用: ${Object.keys(modes).join(' / ')}`)
  process.exit(2)
}
modes[MODE]()
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
