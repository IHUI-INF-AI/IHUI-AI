#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

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
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'], // §12g:派生 git 必须显式接管 stdio,否则本机稳定 EBUSY
      windowsHide: true,
      maxBuffer: 1 << 26,
    }).trim()
  } catch (e) {
    if (allowFail) return null
    const detail = (e.stderr || e.message || '').toString().trim()
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
function plan() {
  const repo = path.resolve(arg('repo', CWD))
  const wt = arg('worktree', 'D:/IHUI-AI-wt-close')
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
  p(`隔离 worktree: ${wt}`)
  p('')
  p('── 0. 冻结前提 ──')
  p('主工作树零写操作:不 checkout / reset / stash / restore / add;所有写操作只出现在隔离 worktree。')
  p('撞 .git/index.lock 就等,不抢锁。')
  p('')
  p('── 1. 取上游 + 建隔离树 ──')
  p(`git -C ${repo} fetch origin main`)
  p(`git -C ${repo} rev-parse refs/heads/main origin/main          # 记录两侧 tip(后续所有步骤以此为准)`)
  p(`git -C ${repo} worktree add --detach ${wt} ${mainSha}`)
  p(`git -C ${wt} merge --no-ff ${originSha}                        # 绝不快进;MERGE_HEAD 必须等于上游 tip`)
  p('')
  p('── 2. 冲突分诊 ──')
  p(`git -C ${wt} diff --name-only --diff-filter=U                  # 先拿到冲突清单再分类`)
  p('· PROJECT_PLAN.md:走 union 工具,不许整份取对侧。')
  p(`    preview : node scripts/plan-union-merge.mjs --base ${base} --ours ${mainSha} --theirs ${originSha}`)
  p(`    apply   : 同上加 --apply(严格档默认生效);需声明删除用 --attest-id-drop <登记键>=<理由>`)
  p('    若冲突面不止 PLAN(C1 会拒绝 --apply),按等价步骤:')
  p('      git checkout -m -- PROJECT_PLAN.md                       # 重放冲突块')
  p('      每个冲突块: 结果 = ours 行 + theirs 中未出现过的行(逐字、保序)')
  p('      登记行去重键 = (登记编号, 题面前 60 字);同键保留 ours')
  p('      只对冲突块内去重;禁止全文去重(CRLF 尾 \\r 曾导致误删 4 条 base 行)')
  p('      上游清算删除的登记行:逐字抄进 .ihui-agent/archive/PROJECT_PLAN_<seat>-<日期>.md 留证')
  p('· README×4:取对侧(git checkout-index -f --stage=3 -- <paths>,冲突态 git checkout --theirs 不生效),再:')
  p('      node scripts/sync-readme-numbers.mjs && node scripts/auto-update-readme-recent.mjs')
  p('    README 不许手改数字/日期。')
  p('· 生成件:取对侧后按生成器重生成/重封(不手工归并 b64):')
  p('      node scripts/gen-i18n-compressed.mjs')
  p('      node apps/miniapp-taro/scripts/generate-ui-routes.mjs')
  p('      node apps/mobile-rn/scripts/generate-ui-routes.mjs')
  p('      node apps/web/scripts/generate-ui-routes.mjs')
  p('      node scripts/gen-rn-host-shell.mjs')
  p('      node scripts/check-root-guard-manifest-sync.mjs          # 红则按其提示重生成')
  p('      node scripts/check-cross-end-component-props-parity.mjs --update-baseline')
  p('· 三本判定台账:按唯一键并集去重,dup=0(用本工具 union 子命令,先 git show 出两侧副本):')
  p('      git show <ours>:scripts/data/style-tier-fork-decisions.jsonl > $TMP/ours-a.jsonl')
  p('      git show <theirs>:scripts/data/style-tier-fork-decisions.jsonl > $TMP/theirs-a.jsonl')
  p('      node scripts/close-merge-reconcile.mjs union --ours $TMP/ours-a.jsonl --theirs $TMP/theirs-a.jsonl --keys side,kind,prop,value --out scripts/data/style-tier-fork-decisions.jsonl --apply')
  p('      # rn-host-shell-manual.json:--keys shared --array entries')
  p('      # web-rn-screen-map.jsonl   :--keys web')
  p('· 门编号撞号:取上游编号为权威;本侧独有门按现读最大 +1 顺延,并同步 AGENTS.md / docs/GATEKEEPERS.md / 测试注释。')
  p('· 旧 blob 回写(292/293):禁止把祖先档搬回索引。上游取来的修复版若与更早祖先逐字相同,是上游修复而非回写:')
  p('    在提交正文写一行 intentional-revert: <逐件依据>(本门放行并留痕);其余一律取 HEAD 形态重做改动。')
  p('· 收尾一律 git add <具体路径>(不许 git add -A);git checkout --theirs 在冲突态无效果时用 checkout-index。')
  p('')
  p('── 3. 零丢失自证(必须 missing=0 才继续) ──')
  p(`node scripts/close-merge-reconcile.mjs verify --worktree ${wt} --origin ${originSha}`)
  p('   判据:本地独有改动路径(origin...HEAD)在合并索引里逐条 cat-file -e;本地删除的路径不计 missing。')
  p('')
  p('── 4. 阻塞门(任一红先判存量/本轮引入;本轮引入就地修) ──')
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
  ]) p(`  ${c}`)
  p('  · worktree-status 在隔离树提交时会把主树残量判红(主树属他人的在飞面):')
  p('    该门自带应急口 HUSKY_SKIP_WORKTREE_STATUS=1(留痕),不得用 --no-verify。')
  p('')
  p('── 5. 三包测试(新树先装依赖并构建工作区包,否则 @ihui/i18n/loader 解析失败) ──')
  p('  pnpm install --frozen-lockfile --offline')
  p('  pnpm -r --filter "@ihui/mobile-rn..." build')
  p('  pnpm -r --filter "@ihui/rn-app..." build')
  p('  pnpm --filter @ihui/mobile-rn test')
  p('  pnpm --filter @ihui/rn-app test')
  p('  pnpm --filter @ihui/miniapp-taro test')
  p('  · 注意:部分测试按 HEAD 面读源码(如上传白名单),合并提交前会假红;提交后 HEAD 面即合并树,须复跑。')
  p('')
  p('── 6. 合并提交 ──')
  p(`git -C ${wt} commit   # 钩子全开;正文写 intentional-revert / immutable-exempt 留证`)
  p('提交后补跑 node scripts/auto-update-readme-recent.mjs(基线随提交前移),派生件另起一笔 chore(gen)。')
  p('')
  p('── 7. 推送前竞态闸(三条,缺一不可) ──')
  p(`  ① node scripts/close-merge-reconcile.mjs race --worktree ${wt} --pending .ihui-agent/tmp/pending-local-commits.txt`)
  p('     内含:ls-remote 读回远端 tip;逐笔比对 origin/main..HEAD 与「本席 pending 清单」;')
  p('     另检 refs/heads/main 是否已越过 HEAD(他席又落笔)。任一不成立 ⇒ exit 3 + 打印清单 ⇒ 停发。')
  p('  ② 同上(①即含②);本席 pending 清单按 hash 或题面一行一条,注释以 # 开头。')
  p(`  ③ push 后: node scripts/close-merge-reconcile.mjs post --worktree ${wt}`)
  p('     期望 origin/main...HEAD = 0/0;非 0/0 判红。')
  p('')
  p(`推送: git -C ${wt} push origin HEAD:main     # 非 force、不带 --no-verify`)
  p('')
  p('── 8. 收尾 ──')
  p('主树 git status 行数与开工快照一致;worktree 保留或按裁定删除(git worktree remove --force 仅在被裁定删除时用)。')

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
