// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * commit-rewrite-safety.mjs — 「重写一枚提交前,有没有别人正以它为父」的判据单源(2026-11-06 立)。
 *
 * 立因(一手证据,当日现读复跑过):主会话用纯对象空间方式重写一枚**尚未推送**的本地提交的提交信息
 * (`git commit-tree <同树> -p <同父>` + `git update-ref refs/heads/main`),两枚 `git patch-id --stable`
 * 逐字相同(`6baf2771521b6f72ec788298eba9b6739d6c688e`),树未变。并发别席当时已经基于**旧枚**继续提交,
 * 于是 update-ref 之后 HEAD 走回旧链,带声明的新枚反而成了孤儿 —— 结果是结构性死锁:
 * 未声明的旧枚永远留在 push 区间里,挡住 11 枚(含别席成果),而 `--ack` 追认档需要签名钥(三源全空 ⇒ fail-closed)。
 * 这条纪律靠人记必然再踩(这一次踩它的是执行者本人),所以必须做成牙。
 *
 * 判据一句话:**一枚提交有没有后代**。有 ⇒ 它正在被别人(或自己的后续工作)踩着,重写它就是把别人的
 * 现场挂在半空;没有 ⇒ 重写只影响它自己。
 *
 * 三态(§0.3:取不到输入一律「未判定」,既不记绿也不冒红):
 *   0 `safe`         —— 该 sha 在本机无任何后代提交 ⇒ 可安全重写;
 *   1 `danger`       —— 存在**在飞**后代(见下 `classify`)⇒ 禁止重写,必须逐条点名;
 *   2 `undetermined` —— rev-list / for-each-ref / 祖先判定任一把不到、sha 不存在、候选清单为空。
 *
 * 后代的两种归属(§9b/§22 的既有豁免口径,本层不另立一套):
 *   · `active`     —— 后代在 HEAD 祖先闭包内,或落在非豁免 ref(分支/远端跟踪/普通 tag)上 ⇒ 判阻塞;
 *   · `backup-only`—— 后代**只**挂在 `backup/*`、`ihui-backup/*`(前缀单源 = check-single-branch.mjs 的
 *                    `BACKUP_REF_PREFIXES`,并复用其 `inFlightExempt` 认 `origin/` 镜像形)与
 *                    `lost-commit/*`(命名族单源 = orphan-backup.mjs 的 `ORPHAN_TAG_PREFIX`)上 ⇒ 不判阻塞。
 *                    理由:这些引用按 §5b/§22 **永不判红、永不许删**,它们承载的正是「已经没人踩着、
 *                    只留个证据」的现场;喊用户去动它们等于替他犯 §5b 的禁令。
 *   · `unknown`    —— 后代既不在 HEAD 闭包、也查不到任何直接指向它的 ref(它必然躺在某条链的中段)
 *                    ⇒ 按更严方向算 `active`(宁误拦,不静默放行,§0.10)。
 *
 * 诚实边界(不许读者以为无死角):
 *   ① 本层只看**直接子代**。这是充分的:没有直接子代 = 没有后代;有后代 = 至少有一枚直接子代。
 *   ② `backup-only` 的判定按「有没有 ref **直接指向**这枚后代」问,不做全量包含遍历(本仓 27484 枚 ref,
 *      `for-each-ref --contains` 单条就要数十秒)。若某枚后代本身不是任何 ref 的尖端、又不是 HEAD 的祖先,
 *      它落进 `unknown` ⇒ 判阻塞(更严方向),不会因为「链尾恰好挂在 backup tag 上」而被整体放过。
 *   ③ 判据看不到「意图」:它答的是「这枚提交现在有没有人踩着」,不答「你这次要不要重写」。
 *
 * 取材纪律:`git rev-list --all --children` 一次成图(本仓实测 11.4 万行 / 约 3.6s),
 *   `git for-each-ref --format=%(objectname)%09%(refname)` 一次成表,`merge-base --is-ancestor` 逐枚问三态。
 *   全部子进程经 `scripts/lib/face-reader.mjs` 的 `gitRaw`(§12g 显式 stdio + timeout + 重试归一)。
 */

import { gitRaw } from './face-reader.mjs'
import { ORPHAN_TAG_PREFIX } from './orphan-backup.mjs'
// §0.6/§22c:备份引用命名空间的豁免口径**不在本层重抄** —— 前缀表与 origin/ 镜像识别全部
// 复用守门 41(check-single-branch.mjs)的既有实现;它自己只 import face-reader,无环。
import { inFlightExempt } from '../check-single-branch.mjs'

const EMPTY_TIP_TIMES = new Map()
/** inFlightExempt 的其它两类豁免(in-flight / bot-pr)与「永不判红」无关,只认 backup 这一档。 */
const BACKUP_KIND = 'backup'

/** `lost-commit/wip-…` 的**命名空间**(不是命名族):整族都归 §22 的备份 tag,永不判红。 */
export const LOST_COMMIT_NAMESPACE = `${ORPHAN_TAG_PREFIX.split('/')[0]}/`

/** refs/heads|tags|remotes 全名 → 可比较的裸名(与 check-single-branch 喂给 inFlightExempt 的形态一致)。 */
export function bareRefName(refname) {
  const s = String(refname ?? '').trim()
  const m = /^refs\/(?:heads|tags|remotes)\/(.+)$/.exec(s)
  return m ? m[1] : s
}

/**
 * 这枚 ref 是否属于「永不判红」的备份命名空间。
 * backup/ihui-backup 两族**逐字走**守门 41 的 `inFlightExempt`(它已含 `origin/` 镜像剥离);
 * lost-commit 一族按命名空间前缀认(§29 的 wip-* 命名族、§12h 的 worktree-* 命名族都在射程内)。
 */
export function backupExemptKind(refname) {
  const bare = bareRefName(refname)
  if (inFlightExempt(bare, EMPTY_TIP_TIMES, Number.NaN, 0) === BACKUP_KIND) return BACKUP_KIND
  const stripped = bare.startsWith('origin/') ? bare.slice('origin/'.length) : bare
  return stripped.startsWith(LOST_COMMIT_NAMESPACE) ? 'lost-commit' : null
}

/** `git rev-list --all --children` 的文本 → Map(父 sha → [子 sha…]);坏行跳过不猜。 */
export function parseChildrenMap(raw) {
  const map = new Map()
  for (const line of String(raw ?? '').split(/\r?\n/)) {
    const parts = line.trim().split(/\s+/)
    if (parts.length < 2 || !parts[0]) continue
    const [parent, ...kids] = parts
    map.set(parent, kids.filter((k) => /^[0-9a-f]{40}$/.test(k)))
  }
  return map
}

/** `git for-each-ref --format=%(objectname)%09%(refname)` 的文本 → Map(sha → [ref 全名…])。 */
export function parseRefTips(raw) {
  const map = new Map()
  for (const line of String(raw ?? '').split(/\r?\n/)) {
    const s = line.trim()
    if (!s) continue
    const sp = s.indexOf('\t')
    if (sp <= 0) continue
    const oid = s.slice(0, sp).trim()
    const ref = s.slice(sp + 1).trim()
    if (!/^[0-9a-f]{40}$/.test(oid) || !ref) continue
    if (!map.has(oid)) map.set(oid, [])
    map.get(oid).push(ref)
  }
  return map
}

/**
 * 单枚后代的归属分类(纯函数,输入全部由调用方现读后喂进来 —— self-test 与镜像测试走的就是这一层,
 * 不复制判据,§22c)。
 * @returns {{kind:'active'|'backup-only', refs:string[], note:string}}
 */
export function classifyChild(child, { ancestorOfHead, refTips }) {
  const refs = refTips.get(child) ?? []
  if (ancestorOfHead === true)
    return { kind: 'active', refs, note: '在 HEAD 祖先闭包内(它已经在主干上)' }
  if (ancestorOfHead !== false)
    return { kind: 'active', refs, note: '祖先关系问不到 ⇒ 按更严方向算在飞(§0.10)' }
  if (refs.length === 0)
    return { kind: 'active', refs, note: '不在 HEAD 链上且没有直接指向它的 ref ⇒ 躺在某条链中段,按在飞算' }
  const nonExempt = refs.filter((r) => backupExemptKind(r) === null)
  if (nonExempt.length > 0) return { kind: 'active', refs: nonExempt, note: '落在在飞的 ref 上' }
  return { kind: 'backup-only', refs, note: '只挂在永不判红的备份引用上(§9b/§22)' }
}

/**
 * 核心判定(纯函数 + 注入探针):self-test 用假探针钉判据,生产用下面的 `judgeRewriteSafety`。
 * @param {string[]} shas 待重写的候选枚(40 位)
 * @param {{children:Map<string,string[]>, refTips:Map<string,string[]>,
 *          exists?:(sha:string)=>boolean|null,
 *          ancestorOfHead?:(sha:string)=>boolean|null,
 *          distanceFromHead?:(sha:string)=>number|null}} inputs
 */
export function judgeFromInputs(shas, inputs) {
  const { children, refTips } = inputs
  const exists = inputs.exists ?? (() => true)
  const ancestorOfHead = inputs.ancestorOfHead ?? (() => null)
  const distanceFromHead = inputs.distanceFromHead ?? (() => null)
  const items = []
  if (!Array.isArray(shas) || shas.length === 0)
    return { state: 'undetermined', items: [], reasons: ['候选清单为空 ⇒ 枚举到 0 个候选判死不记绿(§0.3)'] }
  const reasons = []
  for (const sha of shas) {
    if (!/^[0-9a-f]{40}$/.test(String(sha))) {
      reasons.push(`${sha}:不是 40 位全量 sha ⇒ 未判定(短 sha 无法定位唯一对象)`)
      items.push({ sha, state: 'undetermined', kids: [], why: 'sha 形态不合法' })
      continue
    }
    const ex = exists(sha)
    if (ex === null) {
      reasons.push(`${sha}:存在性问不到 ⇒ 未判定`)
      items.push({ sha, state: 'undetermined', kids: [], why: 'rev-parse --verify 取不到' })
      continue
    }
    if (ex === false) {
      reasons.push(`${sha}:本机对象库里没有这枚提交 ⇒ 未判定(不猜「它没有后代」)`)
      items.push({ sha, state: 'undetermined', kids: [], why: 'sha 不存在' })
      continue
    }
    const kids = children.get(sha) ?? []
    if (kids.length === 0) {
      items.push({ sha, state: 'safe', kids: [] })
      continue
    }
    const listed = kids.map((kid) => {
      const anc = ancestorOfHead(kid)
      const c = classifyChild(kid, { ancestorOfHead: anc, refTips })
      return {
        sha: kid,
        ...c,
        ancestorOfHead: anc,
        distance: c.kind === 'active' && anc === true ? distanceFromHead(kid) : null,
      }
    })
    const active = listed.filter((k) => k.kind === 'active')
    const backupOnly = listed.filter((k) => k.kind === 'backup-only')
    items.push({
      sha,
      state: active.length > 0 ? 'danger' : 'safe',
      kids: listed,
      active,
      backupOnly,
    })
  }
  const danger = items.filter((i) => i.state === 'danger')
  const undetermined = items.filter((i) => i.state === 'undetermined')
  const state = danger.length > 0 ? 'danger' : undetermined.length > 0 ? 'undetermined' : 'safe'
  return { state, items, reasons }
}

/** 生产探针:全部经 face-reader 的 gitRaw(§12g);任一把不到 ⇒ null,不折成 false/true。 */
function makeGitProbes(root) {
  return {
    exists(sha) {
      try {
        gitRaw(['rev-parse', '--verify', '--quiet', `${sha}^{commit}`], root, { timeout: 30_000 })
        return true
      } catch (e) {
        // git 对「对象不存在」回 1(合法否);其余(锁、坏仓、超时)是问不到。
        return typeof e?.status === 'number' ? (e.status === 1 ? false : null) : null
      }
    },
    ancestorOfHead(sha) {
      try {
        gitRaw(['merge-base', '--is-ancestor', sha, 'HEAD'], root, { timeout: 60_000 })
        return true
      } catch (e) {
        return typeof e?.status === 'number' ? (e.status === 1 ? false : null) : null
      }
    },
    distanceFromHead(sha) {
      try {
        const n = Number(
          gitRaw(['rev-list', '--count', `${sha}..HEAD`], root, { timeout: 120_000 }).trim(),
        )
        return Number.isFinite(n) ? n : null
      } catch {
        return null
      }
    },
  }
}

/**
 * 全图取材(每进程一次,按 root 缓存):`rev-list --all --children` + `for-each-ref`。
 * 本仓现读实测 = 114816 行 / 约 3.6s + 27484 条 ref —— 一次成图后,twin 判定与后代判定共用,
 * 绝不为了省一次调用而改用 `--children -- <parent> ^` 之类写法(git 2.56 实测不接受该形态,
 * 且"取不到"会被误读成"没有后代")。
 */
const graphCache = new Map()
export function loadGraph(root, { refresh = false } = {}) {
  if (!refresh && graphCache.has(root)) return graphCache.get(root)
  const fails = []
  let childrenRaw = null
  let refsRaw = null
  try {
    childrenRaw = gitRaw(['rev-list', '--all', '--children'], root, {
      timeout: 180_000,
      maxBuffer: 256 << 20,
    })
  } catch (e) {
    fails.push(`git rev-list --all --children 取不到:${String(e?.message ?? e).slice(0, 160)}`)
  }
  try {
    refsRaw = gitRaw(['for-each-ref', '--format=%(objectname)%09%(refname)'], root, {
      timeout: 120_000,
      maxBuffer: 64 << 20,
    })
  } catch (e) {
    fails.push(`git for-each-ref 取不到:${String(e?.message ?? e).slice(0, 160)}`)
  }
  const lines = String(childrenRaw ?? '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean).length
  const graph =
    fails.length > 0
      ? { ok: false, reasons: fails, lines: 0 }
      : lines === 0
        ? {
            ok: false,
            reasons: [
              'rev-list --children 输出 0 行 ⇒ 枚举到 0 判死,不记绿(§0.3);仓库当前答不上话(空仓 / 坏 .git / 半恢复态)',
            ],
            lines: 0,
          }
        : {
            ok: true,
            children: parseChildrenMap(childrenRaw),
            refTips: parseRefTips(refsRaw),
            lines,
            reasons: [],
          }
  if (graph.ok) graphCache.set(root, graph)
  return graph
}

/**
 * 生产入口:对给定 sha 集做后代判定。
 * @param {string[]} shas @param {{root?:string}} opts
 * @returns {{state:string, items:object[], reasons:string[], inputs?:{lines:number,refs:number}}}
 */
export function judgeRewriteSafety(shas, opts = {}) {
  const root = opts.root ?? process.cwd()
  const graph = loadGraph(root)
  if (!graph.ok) return { state: 'undetermined', items: [], reasons: graph.reasons, inputs: null }
  const { children, refTips, lines } = graph
  const probes = makeGitProbes(root)
  const out = judgeFromInputs(shas, {
    children,
    refTips,
    exists: probes.exists,
    ancestorOfHead: probes.ancestorOfHead,
    distanceFromHead: probes.distanceFromHead,
  })
  return { ...out, inputs: { lines, refs: refTips.size } }
}

/**
 * 结论行必须自带下一步(§5e-1 可整改性):说清「为什么重写会伤到别人」和「现在能做什么」。
 */
export function describeNextSteps() {
  return [
    '下一步(三选一,不得凭「应该没人基于它」就重写):',
    '  1) 最常用:不改写旧枚 —— 在同一条链的**末尾**叠一枚新提交(该带声明的带声明),',
    '     旧枚与所有基于它继续的现场原地不动;',
    '  2) 确需追认一枚已经推走/已经落在受保护面的旧枚:走 `node scripts/check-immutable-guard.mjs --ack …`',
    '     (需要签名钥:IHUI_IMMUTABLE_GUARD_KEY / IHUI_IMMUTABLE_GUARD_KEY_FILE /',
    '      git config ihui.immutableGuardKeyPath;三源全空 ⇒ fail-closed 拒签,这是设计不是故障);',
    '  3) 先与归属会话协调:确认上面点名的每一枚后代都不再有人在用,由归属会话自己把链收敛后再动。',
    '为什么重写会伤到别人:后代提交把被重写枚记在自己的父链上;update-ref 一指回旧链,',
    '  带声明的新枚立刻成孤儿,而基于旧枚继续提交的那一席毫不知情 —— 事后既补不回声明,',
    '  也没法靠「重写第二遍」收敛(2026-11-06 实测:f48837395…/d6d3d747e… patch-id 相同,',
    '  11 枚未推提交被一枚未声明的旧枚挡住,含别席成果)。',
  ]
}

/**
 * ref/spec → 40 位 sha(三态:取不到回 null,不返回空串冒充"没有")。
 * 提交链档与人类习惯写法(`HEAD`、`main~3`)都从这里过一道,判据面始终只吃全量 sha。
 */
export function resolveToSha(spec, root) {
  try {
    const out = gitRaw(['rev-parse', '--verify', '--quiet', `${spec}^{commit}`], root, {
      timeout: 30_000,
    })
      .trim()
      .split(/\r?\n/)[0]
    return /^[0-9a-f]{40}$/.test(out) ? out : null
  } catch {
    return null
  }
}

/**
 * 提交链侧的「重写形态」探测(守门 302 `--at-commit` 用)。
 *
 * 实测口径(2026-11-06 在临时仓里跑钩子取的真值,不是猜的):
 *  · `git commit --amend` **不会**将 `GIT_REFLOG_ACTION` 传给钩子(实测恒为空),
 *    `GIT_INDEX_FILE` 在普通提交与 amend 下同为 `.git/index` ⇒ 钩子侧拿不到「这是 amend」的直接标记;
 *  · 能拿到的直接标记是**内容面**:消息级 amend 时 `git diff --cached --name-only` 为空,
 *    普通提交与带内容的 amend 都非空。空 = 「这一枚不改变内容」= 只有 `--amend`(仅改消息)
 *    或 `--allow-empty` 能走到这里,而前者正是一次重写 ⇒ 必须问后代。
 *
 * 诚实边界:带内容变化的 amend 在 pre-commit 面上与普通提交同形,本档结构上认不出来 ——
 * 那一型由 casUpdateRef 的丢失集守卫(旁路落地侧)与本 sha 查询出口(人工操作前)分担。
 */
export function detectRewriteShape({ root } = {}) {
  let raw = null
  try {
    raw = gitRaw(['diff', '--cached', '--name-only'], root, { timeout: 120_000 })
  } catch (e) {
    return { shape: 'undetermined', files: [], why: `暂存面取不到:${String(e?.message ?? e).slice(0, 140)}` }
  }
  const files = String(raw)
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
  if (files.length === 0)
    return {
      shape: 'rewrite-candidate',
      files,
      why: '本次提交不改变内容(暂存面为空)⇒ 只有消息级 --amend 或 --allow-empty 走到这里;前者正是一次重写',
    }
  return { shape: 'normal', files, why: `本次提交带来 ${files.length} 个内容变化 ⇒ 新枚叠在 HEAD 之后,不弃任何现场` }
}

/**
 * 落地路径专用:本轮**将要造出的那枚**若与既有提交「同父同树」而消息不同,就是一枚重写孪生
 * (2026-11-06 事故的机器可测指纹:`commit-tree -p <同一父>` + 同一棵树,只换了提交信息)。
 * 孪生的旧枚一旦有在飞后代,落地(或被 update-ref 顶回去)就把别人的父链甩在半空 ⇒ 必须先拒。
 *
 * 取材与 `judgeRewriteSafety` 共用同一次成图(loadGraph,每进程一把),绝不为了"快一点"改用
 * git 不接受的窄面写法(取不到 ≠ 没有孪生,一律走未判定)。
 *
 * @param {{root:string, parentSha:string, treeSha:string, excludeSha?:string}} opts
 * @returns {{state:'ok'|'danger'|'undetermined', twins:object[], reasons:string[], graphLines:number}}
 */
export function judgeRewriteTwin({ root, parentSha, treeSha, excludeSha = '' }) {
  const bad = []
  if (!/^[0-9a-f]{40}$/.test(String(parentSha)))
    bad.push(`父标识不是 40 位全量 sha(${String(parentSha).slice(0, 14)})`)
  if (!/^[0-9a-f]{40}$/.test(String(treeSha)))
    bad.push(`树标识不是 40 位全量 sha(${String(treeSha).slice(0, 14)})`)
  if (bad.length > 0)
    return {
      state: 'undetermined',
      twins: [],
      reasons: [...bad, '⇒ 未判定:输入标识形态不合法,不猜"没有孪生"'],
      graphLines: 0,
    }
  const graph = loadGraph(root)
  if (!graph.ok)
    return { state: 'undetermined', twins: [], reasons: graph.reasons, graphLines: 0 }
  const kids = (graph.children.get(parentSha) ?? []).filter((k) => k !== excludeSha)
  const probes = makeGitProbes(root)
  const twins = []
  const reasons = []
  for (const kid of kids) {
    let kidTree = null
    try {
      kidTree = gitRaw(['rev-parse', `${kid}^{tree}`], root, { timeout: 30_000 }).trim()
    } catch (e) {
      reasons.push(
        `同父候选 ${kid} 的树标识取不到:${String(e?.message ?? e).slice(0, 120)} ⇒ 未判定(不折成"不是孪生")`,
      )
      continue
    }
    if (kidTree !== treeSha) continue
    twins.push({ sha: kid, tree: kidTree })
  }
  if (twins.length === 0)
    return {
      state: reasons.length > 0 ? 'undetermined' : 'ok',
      twins,
      reasons,
      graphLines: graph.lines,
    }
  // 孪生本身不是危险 —— 危险在"有人基于它继续提交"。所以对每枚孪生再问一次后代(同一张图,零复算)。
  const verdict = judgeFromInputs(
    twins.map((x) => x.sha),
    {
      children: graph.children,
      refTips: graph.refTips,
      exists: () => true,
      ancestorOfHead: probes.ancestorOfHead,
      distanceFromHead: probes.distanceFromHead,
    },
  )
  const bySha = new Map(verdict.items.map((i) => [i.sha, i]))
  for (const x of twins) x.result = bySha.get(x.sha) ?? null
  const state =
    reasons.length > 0 && verdict.state !== 'danger'
      ? 'undetermined'
      : verdict.state === 'danger'
        ? 'danger'
        : verdict.state === 'undetermined'
          ? 'undetermined'
          : 'ok'
  return { state, twins, reasons: [...reasons, ...(verdict.reasons ?? [])], graphLines: graph.lines }
}

/** 重写孪生的下一步(措辞与 `describeNextSteps` 同源,落地器直接打进拒绝输出)。 */
export function describeTwinRefusal({ parentSha, treeSha, twins }) {
  const lines = [
    `本轮要落的树 ${treeSha.slice(0, 12)}… 在父 ${String(parentSha).slice(0, 12)}… 之下已有同父同树的既有提交:`,
  ]
  for (const t of twins) {
    const r = t.result ?? {}
    const act = r.active ?? []
    lines.push(`   · 既有孪生 ${t.sha} —— 在飞后代 ${act.length} 枚`)
    for (const k of act)
      lines.push(
        `       - 后代 ${k.sha} —— ${
          k.ancestorOfHead === true
            ? `距 HEAD ${k.distance === null ? '未判定' : `${k.distance} 枚`}`
            : '不在 HEAD 祖先闭包内'
        };ref:${k.refs.length ? k.refs.join(', ') : '(无直接指向,躺在某条链中段)'}`,
      )
    for (const k of r.backupOnly ?? [])
      lines.push(
        `       ℹ️ 后代 ${k.sha} 只挂在备份引用(${k.refs.join(', ')})⇒ 不判阻塞,只报数`,
      )
  }
  lines.push(
    '   这一型就是「重写一枚提交的信息而内容不变」:旧枚还躺在别人的父链上,顶上去 = 把他们已提交的现场甩成孤儿。',
  )
  lines.push(...describeNextSteps())
  return lines
}

export const __test__ = {
  bareRefName,
  backupExemptKind,
  parseChildrenMap,
  parseRefTips,
  classifyChild,
  judgeFromInputs,
  judgeRewriteTwin,
  describeTwinRefusal,
  describeNextSteps,
  resolveToSha,
  LOST_COMMIT_NAMESPACE,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
