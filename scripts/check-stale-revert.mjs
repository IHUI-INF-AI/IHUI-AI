// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// scripts/check-stale-revert.mjs
/**
 * 反回退守门:block「把 HEAD 内容写回某个历史提交版本」的静默回退。
 *
 * 成因(2026-09-23 实测):多会话共享工作区,而 §12d 的 converge 走
 * merge-tree/commit-tree 只推进 HEAD 与 index、**不 checkout**,工作区于是长期落后
 * HEAD(实测 503 个文件落后 486 个提交)。此时任何会话 `git add <file>` 提交的都是旧
 * 内容 —— 对该文件等价于把别人这一路径上的后续改动整体回滚,而 diff 看上去"只动了几行",
 * 无人能察觉。守门 71 只护 PROJECT_PLAN.md 的登记行,源码/配置面完全无闸,故补此闸。
 *
 * R1(blocking):暂存内容 != HEAD 内容,且**字节级等于该路径某个祖先提交的版本**
 *   → 本次提交不是新工作,而是把历史版本原样写回。真新编辑不可能恰好等于历史 blob,误报率极低。
 * R2(warn,不计失败):暂存删除了 HEAD 里存在的路径。宿主层会静默删工作区文件(实测一次
 *   137 个),这类删除被顺手提交同样是回滚;但删除也可能是真意图(`git rm` 合法),
 *   按「宁漏不误报」只告警。
 *
 * 合并上下文(2026-09-25 由"整轮豁免"收窄):旧口径因"merge/cherry-pick/revert 的解析结果
 * 本就可能是历史内容"而整轮跳过 R1,于是**本门自己的豁免**成了这一族的无人看守区(登记在
 * 第四十二批未闭环④,本轮机制化)。收窄后只对 merge 上下文跑 R1m:两父在某路径上逐字节
 * 一致 ⇒ 合并对它无事可做 ⇒ 索引里与两父都不同的内容不可能来自本次合并,再要求它恰等于
 * 该路径某历史版本才判红(人工解冲突写进的新内容不满足该条,放过 —— 那是正当形态)。
 * cherry-pick / revert / rebase 仍整轮豁免:那三种操作取历史内容本就是其语义。
 *
 * 用法:
 *   node scripts/check-stale-revert.mjs --staged      # pre-commit(runner 自动下发)
 *   node scripts/check-stale-revert.mjs               # 全量:比对工作区 vs HEAD
 *   node scripts/check-stale-revert.mjs --self-test   # 独立临时仓端到端演练
 * 紧急跳过:HUSKY_SKIP_STALE_REVERT_GUARD=1(确属有意回退请改用 git revert 生成前向提交)
 */
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { Undetermined, catBatchOids, gitRaw } from './lib/face-reader.mjs'

export const SKIP_ENV = 'HUSKY_SKIP_STALE_REVERT_GUARD'
export const ANCESTOR_WINDOW = 40
// 每文件一次 `git log` + 一次批量 cat-file;超大暂存集(整仓重排)按上限跳过,
// 避免把 pre-commit 拖到分钟级 —— 那只会逼人 --no-verify 把所有守门一起关掉。
export const MAX_FILES = 300
/** "乘数级"路径:被写回旧版时**不会**表现为"少了一个功能",而是让一批守门/钩子静默失效,
 *  所以它们不得吃上面的性能护栏。立因(2026-09-24 同日两次实测):共享工作区对 HEAD 的
 *  拼合式滞后常年有 500+ 个文件,`--align-drift` 的形状面只管 style/import 那一种,于是
 *  `guardian-runner.mjs` 的工作树副本落后 61 行(别人刚落地的守门 78 五维升级)而无人报 ——
 *  任何人一次 `git add` 就替全队摘门。判据要能在**它自己那把尺子被改短**时还响。 */
export const MULTIPLIER_RE = [
  /^scripts\/guardian-runner\.mjs$/,
  /^scripts\/check-[^/]+\.mjs$/,
  /^scripts\/lib\//,
  /^\.husky\//,
  /^package\.json$/,
  /^pnpm-(workspace|lock)\.yaml$/,
  /^\.github\/workflows\//,
  /^scripts\/tests\//,
]

export function isMultiplierPath(p) {
  const rel = String(p).replace(/\\/g, '/').replace(/^\.\//, '')
  return MULTIPLIER_RE.some((re) => re.test(rel))
}

// 这些操作进行中允许取旧版本(merge/cherry-pick/revert 的解析结果本就可能是历史内容)
const REVERT_CONTEXT_FILES = ['MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'REBASE_HEAD']

function git(args, opts = {}) {
  // 调用点沿用旧形状 `git(['-C', repoRoot, …])`;层自己会带 `-C <root>`,所以在这里剥掉这两个
  // token —— 同一参数出现两份时 git 取后者,那是一个"两份不一致就静默换仓"的隐性来源。
  // ⚠️ stdio 由**层**统一接管(两态:无 input 时 ignore / 有 input 时 pipe)。下面几个调用点
  // 仍带着迁移前的 `stdio: ['ignore','pipe','ignore']`,那在此已**不再生效** —— 留着是因为
  // 删它要动 5 处零宽载荷文件里的行,收益不抵风险;新写调用点不要再传 stdio。
  const [cFlag, root, ...rest] = args
  if (cFlag !== '-C' || !root) throw new Error('本门 git() 的调用必须带 -C <repoRoot>')
  return gitRaw(rest, root, { maxBuffer: 1 << 28, ...opts })
}

/** 一次 cat-file --batch-check 解出所有对象规格 → Map(spec -> blob|null) */
export function resolveBlobs(repoRoot, specs) {
  return catBatchOids(repoRoot, specs)
}

/** 该路径在 HEAD 上前 ANCESTOR_WINDOW 个"动过它"的提交 */
export function ancestorCommits(repoRoot, path) {
  try {
    return git(['-C', repoRoot, 'log', `--max-count=${ANCESTOR_WINDOW}`, '--format=%H', 'HEAD', '--', path])
      .split('\n')
      .filter(Boolean)
  } catch (e) {
    // 迁移到层之后本门多了一个原先没有的失败态:只读派生现在**有 60s 上限**(层的默认值,
    // 本门原先无界 —— 那正是守门 80 拦的那一型)。既然引入了"可能超时",就绝不能把它折成
    // `[]`:"没有祖先提交"与"这次没读到"是两件事,后者会被判成"没有回写"= 把红洗成绿。
    // 真·无历史(`git log` 对无匹配路径)是 exit 0 + 空输出,不走这条。
    if (e instanceof Undetermined) throw e
    return []
  }
}

/** 暂存区改动路径(删除项单列给 R2) */
export function stagedPaths(repoRoot) {
  const all = git(['-C', repoRoot, 'diff', '--cached', '--name-only', '--no-renames'])
    .split('\n')
    .filter(Boolean)
  const deleted = new Set(
    git(['-C', repoRoot, 'diff', '--cached', '--name-only', '--no-renames', '--diff-filter=D'])
      .split('\n')
      .filter(Boolean),
  )
  return { modified: all.filter((p) => !deleted.has(p)), deleted: [...deleted] }
}

/** 工作树 vs HEAD 的漂移路径清单。导出是为了让守门「开工前基线新鲜度自检(三轴)」的③轴
 *  复用同一形状,而不是在别处再抄一份 `git diff --name-only HEAD`(两处算同一件事必须共用一份实现)。 */
export function worktreeDirtyPaths(repoRoot) {
  return git(['-C', repoRoot, 'diff', '--name-only', 'HEAD', '--no-renames'], {
    stdio: ['ignore', 'pipe', 'ignore'],
  })
    .split('\n')
    .filter(Boolean)
}

/** 工作区内容 blob(批量;数量不齐则放弃比对,宁漏不误报) */
function worktreeBlobs(repoRoot, paths) {
  if (!paths.length) return new Map()
  const out = git(['-C', repoRoot, 'hash-object', '--stdin-paths'], {
    input: paths.map((p) => resolve(repoRoot, p)).join('\n') + '\n',
  })
    .split('\n')
    .filter(Boolean)
  if (out.length !== paths.length) return new Map()
  return new Map(paths.map((p, i) => [p, out[i]]))
}

/**
 * 核心判据。source='index' 比对暂存内容;source='worktree' 比对工作区内容。
 * 返回 [{path, commit}] —— commit 为被写回的那个历史版本。
 */
/**
 * 判"该路径的**工作树**副本处于哪种形态",用来决定失败提示能安全地建议什么。
 *
 * 起因(2026-09-26 实测):本门原有出口 ① 写着 `git restore --source=HEAD --worktree -- <文件>`,
 * 而我当场遇到的一格是「索引==祖先版本,而工作树是一份**不等于任何祖先**的真新内容」——
 * 也就是有人正在写这个文件、还没 add。那时执行出口 ① 会**直接抹掉别人未提交的内容**。
 * 一道给出会造成损失的出路的红门,和恒红门同罪(后者逼人跳门,前者逼人删数据)。
 *
 * 分类:
 *  - 'same-as-index'     工作树 == 索引 ⇒ 两者一样旧,对齐工作树无损;
 *  - 'ahead-of-index'    工作树 == HEAD 而索引旧 ⇒ 只需 `--staged` 对齐索引,动工作树是空操作;
 *  - 'lagging-ancestor'  工作树等于某祖先版本 ⇒ 属共享工作区滞后,可安全对齐;
 *  - 'uncommitted-novel' 工作树不等于索引/HEAD/任何祖先 ⇒ **他人在写**,禁止动工作树;
 *  - 'missing'           工作树没有该文件(删除态,本门只 warn)。
 */
export function classifyWorktree(repoRoot, p) {
  const idxSpec = `:${p}`
  const headSpec = `HEAD:${p}`
  const blobs = resolveBlobs(repoRoot, [idxSpec, headSpec])
  const idxB = blobs.get(idxSpec)
  const headB = blobs.get(headSpec)
  const wtB = worktreeBlobs(repoRoot, [p]).get(p)
  if (!wtB) return 'missing'
  if (wtB === idxB) return 'same-as-index'
  if (wtB === headB) return 'ahead-of-index'
  const anc = ancestorCommits(repoRoot, p)
  if (anc.length) {
    const ab = resolveBlobs(repoRoot, anc.map((c) => `${c}:${p}`))
    for (const v of ab.values()) if (v === wtB) return 'lagging-ancestor'
  }
  return 'uncommitted-novel'
}

export function analyze(repoRoot, paths, { source = 'index' } = {}) {
  const present =
    source === 'worktree' ? paths.filter((p) => existsSync(join(repoRoot, p))) : paths
  if (!present.length) return []

  const wt = source === 'worktree' ? worktreeBlobs(repoRoot, present) : new Map()
  if (source === 'worktree' && wt.size !== present.length) return []

  const ancestry = new Map(present.map((p) => [p, ancestorCommits(repoRoot, p)]))
  const specs = []
  for (const p of present) {
    specs.push(source === 'index' ? `:${p}` : `HEAD:${p}`) // [i*2] 当前内容(或再次 HEAD,略)
    specs.push(`HEAD:${p}`)
    for (const c of ancestry.get(p)) specs.push(`${c}:${p}`)
  }
  const blobs = resolveBlobs(repoRoot, specs)

  const violations = []
  let idx = 0
  for (const p of present) {
    const curSpec = specs[idx]
    const headSpec = specs[idx + 1]
    idx += 2
    const cur = source === 'index' ? blobs.get(curSpec) : wt.get(p)
    const head = blobs.get(headSpec)
    if (cur === undefined) continue
    if (!cur || !head) continue // 新增/取不到 → 不判
    if (cur === head) continue // 与 HEAD 一致,无回退
    const hit = ancestry.get(p).find((c) => blobs.get(`${c}:${p}`) === cur)
    if (hit) violations.push({ path: p, commit: hit.slice(0, 9) })
  }
  return violations
}

export function gitDirOf(repoRoot) {
  const d = git(['-C', repoRoot, 'rev-parse', '--git-dir']).trim()
  return /^[A-Za-z]:[\\/]/.test(d) || d.startsWith('/') ? d : resolve(repoRoot, d)
}

export function inRevertContext(repoRoot) {
  const gd = gitDirOf(repoRoot)
  return REVERT_CONTEXT_FILES.some((f) => existsSync(join(gd, f)))
}

/** 合并中取 theirs(MERGE_HEAD)的 sha;取不到返回 null(则退回整轮豁免) */
export function mergeHeadSha(repoRoot) {
  try {
    return (
      git(['-C', repoRoot, 'rev-parse', '--verify', 'MERGE_HEAD'], {
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim() || null
    )
  } catch {
    return null
  }
}

/**
 * 合并上下文里的窄判据 —— 取代旧的"整轮豁免"(2026-09-25)。
 *
 * 为什么旧口径必须收窄:R1 在 merge/cherry-pick/revert 上下文里被整轮跳过,是因为"这些
 * 操作的解析结果本就可能是历史内容";但**合并**恰好有一种形态不成立 —— 两父在某路径上
 * 逐字节一致时,合并对它无事可做,索引里那条与两父都不同的内容**不可能来自本次合并**。
 * 那一型正是共享工作区落后 HEAD 时最容易发生的事(本轮实测:合并期 `PROJECT_PLAN.md`
 * 的索引停在旧基线),而当时全链无人看守:守门 30c 判红是对的却只说"取 theirs",
 * 守门 84 自己豁免。
 *
 * 只判一种,且刻意保守:
 *   ① ours(P) == theirs(P)                 (两父一致 ⇒ 合并无事可做)
 *   ② index(P) != ours(P)                  (存在外来内容)
 *   ③ index(P) == P 的某个历史祖先版本      (= 回写;人工解冲突写进的新内容不满足 ③,放过)
 * 一侧缺该路径(add/delete 冲突)不判 —— 那本身就是需要人决定的形态。
 */
export function analyzeMerge(repoRoot, paths, mergeHead, { source = 'index' } = {}) {
  if (!mergeHead || !paths.length) return []
  const present = source === 'worktree' ? paths.filter((p) => existsSync(join(repoRoot, p))) : paths
  if (!present.length) return []
  const wt = source === 'worktree' ? worktreeBlobs(repoRoot, present) : new Map()
  if (source === 'worktree' && wt.size !== present.length) return []

  const ancestry = new Map(present.map((p) => [p, ancestorCommits(repoRoot, p)]))
  const specs = []
  for (const p of present) {
    specs.push(`:${p}`, `HEAD:${p}`, `${mergeHead}:${p}`)
    for (const c of ancestry.get(p)) specs.push(`${c}:${p}`)
  }
  const blobs = resolveBlobs(repoRoot, specs)

  const violations = []
  let i = 0
  for (const p of present) {
    const idxSpec = specs[i]
    const ours = blobs.get(specs[i + 1])
    const theirs = blobs.get(specs[i + 2])
    i += 3
    const cur = source === 'index' ? blobs.get(idxSpec) : wt.get(p)
    if (!cur || !ours || !theirs) continue // 删除/取不到/一侧无此路径 → 不判
    if (ours !== theirs) continue // 两父本就不同 → 合并产出任一或融合结果都正当
    if (cur === ours) continue // 与两父一致 → 无外来内容
    const hit = ancestry.get(p).find((c) => blobs.get(`${c}:${p}`) === cur)
    if (hit) violations.push({ path: p, commit: hit.slice(0, 9) })
  }
  return violations
}

function audit(repoRoot, { staged }) {
  const { modified, deleted } = staged
    ? stagedPaths(repoRoot)
    : { modified: worktreeDirtyPaths(repoRoot), deleted: [] }
  const lines = []
  let failed = false

  if (!modified.length) {
    if (deleted.length) lines.push(...deleteWarn(deleted))
    lines.push('✅ 反回退守门通过(无可判定文件)')
    return { code: 0, lines }
  }
  // 护栏只管普通文件;乘数级路径恒照判(见 MULTIPLIER_RE 上方实测成因)。
  const always = modified.filter(isMultiplierPath)
  const rest = modified.filter((p) => !isMultiplierPath(p))
  let judged = modified
  if (rest.length > MAX_FILES) {
    lines.push(
      `ℹ️  普通文件 ${rest.length} 个 > 上限 ${MAX_FILES} ⇒ 本轮只判**乘数级** ${always.length} 个(它们的回写不会表现为少一个功能,而是让一批守门静默失效)`,
    )
    judged = always
    if (!judged.length) {
      if (deleted.length) lines.push(...deleteWarn(deleted))
      lines.push('✅ 反回退守门通过(超限跳过普通文件,无乘数级路径待判)')
      return { code: 0, lines }
    }
  }

  const exempt = inRevertContext(repoRoot)
  const mergeHead = exempt ? mergeHeadSha(repoRoot) : null
  const src = staged ? 'index' : 'worktree'
  let violations = []
  if (!exempt) violations = analyze(repoRoot, judged, { source: src })
  else if (mergeHead) {
    violations = analyzeMerge(repoRoot, judged, mergeHead, { source: src })
    lines.push(
      `⚠️  合并上下文中:R1 未整轮豁免,改判"两父一致而暂存内容等于历史版本"(theirs=${mergeHead.slice(0, 9)}) —— 待判 ${judged.length} 个路径,命中 ${violations.length} 枚`,
    )
  } else lines.push('⚠️  处于 cherry-pick/revert/rebase 上下文,R1 本轮豁免')
  if (violations.length) {
    failed = true
    lines.push(
      `❌ 检出 ${violations.length} 个文件的暂存内容等于其**历史提交版本**(= 把别人的改动写回旧态):`,
    )
    for (const v of violations.slice(0, 30)) lines.push(`   - ${v.path}  ==  ${v.commit}`)
    if (violations.length > 30) lines.push(`   ... 另有 ${violations.length - 30} 个`)
    lines.push('')
    lines.push('   最常见成因:共享工作区落后 HEAD(converge 只推进 index 不 checkout)→ 提交的是旧基线。')
    /**
     * 出口按**工作树形态**分流。原提示无条件先建议 `git restore --source=HEAD --worktree`,
     * 而"索引旧 / 工作树是别人未提交的真新内容"这一格里,照它做就是替别人删掉未提交的工作。
     * 判错的代价不是多一行报告,是丢内容 —— 所以这一格必须被识别出来并给出不同的出路。
     */
    const novel = new Set(
      violations
        .filter((v) => classifyWorktree(repoRoot, v.path) === 'uncommitted-novel')
        .map((v) => v.path),
    )
    lines.push('   正确做法:')
    if (novel.size < violations.length) {
      lines.push('     ① 先对齐该文件(仅当其中没有你自己的未提交改动):')
      lines.push('        git restore --source=HEAD --worktree -- <文件>')
      lines.push('        再重新施加你的改动;')
    }
    if (novel.size) {
      lines.push(
        `     ⚠️ 其中 ${novel.size} 个路径的**工作树副本不等于该文件任何祖先版本** ——`,
      )
      lines.push(
        '        那不是工作区滞后,是有人正在写、还没 `add`。这一格**禁止** --worktree:',
      )
      lines.push(
        '        那等于替别人把工作树里未提交的新内容抹掉。安全出口只有两条:',
      )
      lines.push('          · 只对齐索引、不动工作树:git restore --staged -- <文件>')
      lines.push('          · 或等该文件持有者自己 add 新版本再提交(活文档走这条)')
      for (const p of [...novel].slice(0, 8)) lines.push(`          ! ${p}`)
      if (novel.size > 8) lines.push(`          … 另有 ${novel.size - 8} 个`)
    }
    lines.push('     ② 确属有意回退 → 改用 `git revert <commit>` 生成前向提交,')
    lines.push(`        或 ${SKIP_ENV}=1 并在提交信息里写明理由。`)
  }
  if (deleted.length) lines.push(...deleteWarn(deleted))
  if (!failed)
    lines.push(`✅ 反回退守门通过(判定 ${modified.length} 个文件,无历史版本回写)`)
  return { code: failed ? 1 : 0, lines }
}

function deleteWarn(deleted) {
  return [
    `⚠️  [warn] 本次暂存删除 ${deleted.length} 个 HEAD 中存在的路径`,
    '   (宿主层会静默删工作区文件 —— 提交前逐个确认是有意的 `git rm`,不是在役文件被外部清掉)',
    '   ' + deleted.slice(0, 15).join(', ') + (deleted.length > 15 ? ' …' : ''),
  ]
}

/** 独立临时仓端到端演练:真造一次「旧内容被暂存」,必须判红并点名 */
function selfTestRun() {
  const root = mkdtempSync(join(dirname(fileURLToPath(import.meta.url)), '..', '.ihui-agent', 'tmp', 'stale-revert-drill-'))
  const repo = join(root, 'repo')
  mkdirSync(repo, { recursive: true })
  const g = (args) => git(['-C', repo, ...args])
  const results = []
  const check = (name, ok) => results.push({ name, ok })
  try {
    g(['init', '-q', '--initial-branch=main'])
    // 演练仓必须关掉 autocrlf,否则全局配置会把 LF 改写并在 stderr 刷噪音
    g(['config', 'core.autocrlf', 'false'])
    g(['config', 'user.email', 't@t'])
    g(['config', 'user.name', 't'])
    writeFileSync(join(repo, 'a.ts'), 'v1\n')
    writeFileSync(join(repo, 'keep.ts'), 'keep\n')
    g(['add', '-A'])
    g(['commit', '-qm', 'A: v1'])
    writeFileSync(join(repo, 'a.ts'), 'v2\n')
    g(['commit', '-qam', 'B: v2'])
    g(['add', '-A'])

    writeFileSync(join(repo, 'a.ts'), 'v3-new\n')
    g(['add', '-A'])
    check('1 真新编辑不误报', analyze(repo, ['a.ts']).length === 0)

    writeFileSync(join(repo, 'a.ts'), 'v1\n')
    g(['add', '-A'])
    const v = analyze(repo, ['a.ts'])
    check('2 写回 v1 判红且点名', v.length === 1 && v[0].path === 'a.ts')

    /**
     * 5e–5h 工作树形态分类。它决定失败提示**敢不敢**建议 `--worktree`:
     * 对"索引旧、工作树是别人未提交的真新内容"那一格建议对齐工作树,等于替别人删掉未提交的工作。
     * 四条各占一个真实形态,缺一即说明分类有一格没被证明。
     */
    check('5e 索引与工作树同为旧版 ⇒ same-as-index(可安全对齐工作树)', classifyWorktree(repo, 'a.ts') === 'same-as-index')
    writeFileSync(join(repo, 'a.ts'), 'v4-never-committed\n')
    check(
      '5f 工作树不等于索引/HEAD/任何祖先 ⇒ uncommitted-novel(禁止建议 --worktree)',
      classifyWorktree(repo, 'a.ts') === 'uncommitted-novel',
    )
    writeFileSync(join(repo, 'a.ts'), 'v2\n')
    check(
      '5g 工作树==HEAD 而索引仍旧版 ⇒ ahead-of-index(只该对齐索引,动工作树是空操作)',
      classifyWorktree(repo, 'a.ts') === 'ahead-of-index',
    )
    g(['add', '-A']) // 索引追平 HEAD=v2,为下一条造"只有工作树落后"的形态
    writeFileSync(join(repo, 'a.ts'), 'v1\n')
    check(
      '5h 工作树等于祖先而索引仍是 HEAD ⇒ lagging-ancestor(共享工作区滞后,可安全恢复)',
      classifyWorktree(repo, 'a.ts') === 'lagging-ancestor',
    )
    writeFileSync(join(repo, 'a.ts'), 'v2\n')
    g(['add', '-A'])

    writeFileSync(join(repo, 'a.ts'), 'v2\n')
    g(['add', '-A'])
    check('3 等于 HEAD 当前版本不判', analyze(repo, ['a.ts']).length === 0)

    writeFileSync(join(repo, 'n.ts'), 'brand-new\n')
    g(['add', '-A'])
    check('4 新增文件不判', analyze(repo, ['n.ts']).length === 0)

    g(['commit', '-qm', 'C'])
    writeFileSync(join(repo, 'a.ts'), 'v1\n')
    g(['add', '-A'])
    const gd = gitDirOf(repo)
    const headSha = g(['rev-parse', 'HEAD']).trim()

    // ── 合并上下文三对照(旧口径是"整轮豁免",2026-09-25 收窄后必须能分辨这三种)──
    // 先造一枚真正的 theirs 分支(它的 a.ts 与 ours 不同),再造回"旧基线回写"的暂存态。
    g(['checkout', '-q', 'HEAD', '--', 'a.ts']) // 暂存复位到 HEAD(v2),丢弃演练态
    g(['checkout', '-qb', 'theirs'])
    writeFileSync(join(repo, 'a.ts'), 'theirs-v9\n')
    g(['commit', '-qam', 'T: v9'])
    const theirsSha = g(['rev-parse', 'HEAD']).trim()
    g(['checkout', '-q', 'main'])
    writeFileSync(join(repo, 'a.ts'), 'v1\n') // 又一回写:索引=v1,而 ours=v2
    g(['add', '-A'])

    writeFileSync(join(gd, 'MERGE_HEAD'), theirsSha + '\n')
    check(
      '5a 合并中且两父本就不同 ⇒ 放过(合并有权产出任一/融合结果)',
      inRevertContext(repo) && audit(repo, { staged: true }).code === 0,
    )

    writeFileSync(join(gd, 'MERGE_HEAD'), headSha + '\n')
    const m1 = audit(repo, { staged: true })
    check('5b 两父一致而索引等于历史版本 ⇒ 判红(旧口径在这里整轮豁免,即盲区)', m1.code === 1)
    check('5c 命中时点名该路径与回到的版本', m1.lines.join('\n').includes('a.ts'))

    writeFileSync(join(repo, 'a.ts'), 'hand-resolved-fresh\n') // 人工解冲突写进的新内容
    g(['add', '-A'])
    check(
      '5d 两父一致而索引是**新写的内容**(非任何历史版本)⇒ 放过(正当解冲突)',
      audit(repo, { staged: true }).code === 0,
    )
    rmSync(join(gd, 'MERGE_HEAD'), { force: true })
    writeFileSync(join(repo, 'a.ts'), 'v1\n')
    g(['add', '-A'])
    check('6 清理后同一暂存判红', audit(repo, { staged: true }).code === 1)

    writeFileSync(join(gd, 'CHERRY_PICK_HEAD'), headSha + '\n')
    check(
      '6b cherry-pick 上下文仍整轮豁免(收窄只针对 merge)',
      audit(repo, { staged: true }).code === 0,
    )
    rmSync(join(gd, 'CHERRY_PICK_HEAD'), { force: true })

    g(['rm', '-q', '--cached', 'keep.ts'])
    const { modified, deleted } = stagedPaths(repo)
    check('7 删除走 warn 不入 R1', !modified.includes('keep.ts') && deleted.includes('keep.ts'))

    writeFileSync(join(repo, 'a.ts'), 'v3-new\n')
    g(['add', '-A'])
    check('8 worktree 源同样判新编辑', analyze(repo, ['a.ts'], { source: 'worktree' }).length === 0)

    let fail = 0
    for (const r of results) {
      console.log(`${r.ok ? '✅' : '❌'} ${r.name}`)
      if (!r.ok) fail++
    }
    console.log(
      fail ? `self-test FAILED ${fail}/${results.length}` : `✅ check-stale-revert self-test 全部通过(${results.length} 例)`,
    )
    return fail ? 1 : 0
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

async function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) return selfTestRun()
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  if (process.env[SKIP_ENV]) {
    console.log(`⚠️  已跳过反回退守门(${SKIP_ENV}=1)`)
    return 0
  }
  const { code, lines } = audit(repoRoot, { staged: argv.includes('--staged') })
  if (lines.length) console.log(lines.join('\n'))
  return code
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main().then((code) => {
    if (code) process.exit(code)
  }).catch((e) => {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  })
}

export const __test__ = {
  analyze,
  analyzeMerge,
  classifyWorktree,
  mergeHeadSha,
  stagedPaths,
  resolveBlobs,
  inRevertContext,
  audit,
  isMultiplierPath,
  MULTIPLIER_RE,
  SKIP_ENV,
  ANCESTOR_WINDOW,
  MAX_FILES,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
