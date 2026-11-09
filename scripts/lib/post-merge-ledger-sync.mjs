// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// scripts/lib/post-merge-ledger-sync.mjs —— 旁路合并落地后的"登记行自愈"唯一出口。

/**
 * 为什么要有它(不是"再包一层 shell"):
 * `commit-tree` + CAS 这条旁路**结构上不跑任何钩子**,所以守门 71 挂在 post-commit 上的
 * "计划登记行自愈"永远不会触发。本仓实测两次(2026-09-22 / 09-23)一枚收敛合并把并发会话
 * 已入库的登记行合掉而无人知晓。因此**每一枚**旁路合并落地后都必须就地补跑一次自愈。
 *
 * 原先这件事只在 `git-sync-converge.mjs` 里有一份内联实现,而
 *  `union-converge.mjs --apply`(被 converge 当冲突归并出口调用,也可人工跑)同样落合并提交,
 *  却**没有**这一层 —— 两条落地路径共用一本台账,只有一条补跑,等于该型缺陷的一半从未被兜住。
 *  现在两条路径都调本函数:判据/措辞/派生参数只有一份(§"两处算同一件事必漂移"同族)。
 *
 * 三条不可漂的写法:
 *  1. **派生一律 `process.execPath` + 绝对脚本路径**。裸 `node` 依赖 PATH,而本仓写死过:
 *     守护/服务/钩子上下文里 PATH 与交互终端不通(AGENTS §5c、§5b)。旧内联实现就是裸 `node`,
 *     由本层一并收掉,并由镜像 T3 反向钉住"调用面不得再出现裸 node 派生这一族"。
 *  2. **失败只喊一行,不改落地成败**:自愈是"只加不减"的补账动作,它没跑成不该把一枚已经
 *     零丢失自证通过的合并提交判成失败(那会把红推给与故障无关的一侧)。但它**必须被喊出来** ——
 *     静默的自愈等于没有自愈(§22c"判据失效的表现永远是安静")。
 *  3. 只读地回读 stdout 里点名登记行的那些行,不改写、不重解释判据。
 *
 * 退出码/返回:永不抛。`{ ok, ran, lines, why }` —— `ran` 是"这次到底派生成了没有",
 * 与 `ok`(派生成且脚本 0 退出)分开计,是为了让调用方能区分"跑过且没问题"与"没跑成"。
 */
import { spawnSync } from 'node:child_process'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { gitRaw } from './face-reader.mjs'

const require = createRequire(import.meta.url)
// 判据实现按**自身位置**取(§15:ROOT 由脚本自身推导)。`root` 参数是"被落地的仓库根",
// 只用于 git 取面与派生工作目录 —— 拿它去 require 判据会让换仓通道/测试夹具直接取不到尺子。
const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPT_REL = join('scripts', 'check-plan-line-loss.mjs')
/** 复清器(G-32):存量清偿 + 守恒断言 + 台账 + 自带推送,全在那一件器物里,本层只决定"要不要叫它"。 */
const PURGE_REL = join('scripts', 'plan-pointer-purge.mjs')
const PLAN_REL = 'PROJECT_PLAN.md'

/**
 * 当前被审面(HEAD blob)上还剩几条"重复登记副本"指针注记。
 *
 * 判据只许有一份:计数走守门 13d 的 `countPointerRows`(它自己就是 `plan-task-index` 那两条
 * 正则的唯一消费者),本层**不**再抄一份正则 —— 抄了就会漂开,而漂开的表现是"这里说 0 条、
 * 13d 说 9 条"这种自洽却错位的读数。
 *
 * 返回 `null` = **未判定**(面取不到 / 判据模块加载不了 / 判据抛错)。未判定绝不是"0 条":
 * 按 §0.3,拿不到输入时既不能记绿也不能冒红,调用方必须跳过复清并大声报名。
 *
 * `readFace` 仅供镜像测试注入(生产调用点一律走默认 git 取面)。
 */
export function ledgerNoteResidue({ root = '', readFace } = {}) {
  const text = readPlanFaceText({ root, readFace })
  if (text === null) return null
  const m = loadRatchet()
  if (!m) return null
  try {
    return m.countPointerRows(text)
  } catch {
    return null
  }
}

/** 被审面(HEAD blob)取文;取不到 ⇒ null。**只读一次**,两个存量维度共用同一份面(同面同轮)。 */
function readPlanFaceText({ root = '', readFace } = {}) {
  let text = null
  try {
    text = readFace
      ? readFace(PLAN_REL)
      : gitRaw(['show', `HEAD:${PLAN_REL}`], resolve(String(root)), {
          timeout: 120000,
          maxBuffer: 256 * 1048576,
        })
  } catch {
    return null
  }
  if (typeof text !== 'string' || text === '') return null
  return text
}

/** 判据模块 = 守门 13d 那一份;加载不了 ⇒ null(调用方折成"未判定",不冒充 0)。 */
function loadRatchet() {
  try {
    return require(join(HERE, '..', 'check-plan-dup-pointer-ratchet.mjs'))
  } catch {
    return null
  }
}

/** 第三存量维(2026-10-16 立,机主令"一号一行"):同号多行组数。判据 = plan-task-index 的
 *  parseTaskRows(台账唯一解析层,§22c 不抄第二份);数"同 key 出现 ≥2 次的组数"。
 *  与注记/可折两维并列进 runPurgeResettle 的派生条件:任一 >0 就派生折并。 */
function sameKeyGroupResidue({ root = '', readFace }) {
  const text = readPlanFaceText({ root, readFace })
  if (text === null) return null
  try {
    const idx = require(join(HERE, '..', 'lib', 'plan-task-index.mjs'))
    const rows = idx.parseTaskRows(text).filter((r) => r.state === 'open' && r.key)
    const seen = new Map()
    for (const r of rows) seen.set(r.key, (seen.get(r.key) || 0) + 1)
    let n = 0
    for (const [, c] of seen) if (c > 1) n++
    return n
  } catch {
    return null
  }
}

/**
 * 第二个存量维(2026-10-15 立,G-32 复清的触发缺口):同题不同编号**可折**行数。
 *
 * 立因(实测,不是预防):10-15 那轮 absorb 档折掉 143 行之后,旁路合并的行级 union 把副本带回,
 * 现读注记维 = 0 条而可折维 = 136 行 ⇒ 只看注记的触发闸**永不派生复清**,带回的那一型
 * ("无注记的真副本")只能靠人工再跑一遍器物。这一维的判据同样只许有一份 = 13d 的 `twinFoldCount`
 * (它自己转 `plan-tasks-merge.foldTwins`,与报告口径同源),本层不另写相似度/前缀正则。
 *
 * 返回 `null` = 未判定(面取不到 / 判据装不上 / 判据抛错),语义与注记维一致。
 */
export function twinFoldResidue({ root = '', readFace } = {}) {
  const text = readPlanFaceText({ root, readFace })
  if (text === null) return null
  const m = loadRatchet()
  if (!m) return null
  try {
    return m.twinFoldCount(text)
  } catch {
    return null
  }
}

/** 复清器的处置判据**只许问,不许搬**(2026-10-25 立,判据住在本器 §0.6)。 */
function loadPurgeTool() {
  try {
    return require(join(HERE, '..', 'plan-pointer-purge.mjs'))
  } catch {
    return null
  }
}

/**
 * **触发集 = 处置集**那一格(2026-10-25 立,治 73 枚自增提交)。
 *
 * 立因(全部真档实测):派生闸原来读的是三个**外围存量维**(注记 / 可折 / 同号组),
 * 而复清器真正会动的行由它自己的分层判据决定 —— 两把尺不同源,账面存量就永不为 0。
 * 现读 23eadba0af^ 那一轮:注记 0 / 可折 0 / 同号组 1 ⇒ 每轮都派生 `--apply --absorb`;
 * 而器物在该面上的真实处置是 0 行 ⇒ 落地的 blob 只比父面多一行空行,累计 73 枚。
 * 正解不是给外围维补白名单,是让触发条件直接问器物那把尺(渲染前后逐字差)。
 *
 * **为什么走子进程而不是 `require()` 器物(第二次实测,差点把修法做成瞎法)**:
 * 首版在这里 require 器物,而器物有一条环回到本层
 * (purge → plan-tasks-merge → … → lib/bypass-git → 本层)。生产入口
 * `node scripts/plan-tasks-merge.mjs --heal --commit`(post-commit 的 plan-state-heal 那一步)
 * 正是从环的另一侧进来的 —— 此刻 require 一个**尚未求值完毕的环内 ESM** 会抛
 * ERR_REQUIRE_CYCLE_MODULE,被 catch 折成 null,于是现读日志
 * (`post-commit-plan-state-heal.log`)每一轮都是「处置维未判定 / 注记未判定 / 可折未判定 /
 * 同号组=1」⇒ 复清**永不再派生**。循环是掐死了,代价是把眼睛蒙上:真副本来了也不会清,
 * 这违反 §12e「修红不得顺手削判据」。子进程里器物自己是入口,环不存在 ⇒ 读数可信。
 *
 * 返回 `null` = **未判定**(器物 rc=2 / 结论行读不出 / 数字形态坏)⇒ 不派生且必须报名,
 * 绝不把"没量到"读成"已归零"(§0.3)。
 */
export function purgeWorkResidue({ root = '', readFace, absorb = true, spawnFn } = {}) {
  // readFace 是测试注入面:注入了就不派生子进程(夹具面不在任何 git 面上)。
  if (typeof readFace === 'function') {
    const text = readPlanFaceText({ root, readFace })
    if (text === null) return null
    const m = loadPurgeTool()
    if (!m || typeof m.workResidueCount !== 'function') return null
    try {
      return m.workResidueCount(text, { absorb })
    } catch {
      return null
    }
  }
  const run = spawnFn || spawnSync
  const abs = resolve(String(root || ''), PURGE_REL)
  const args = ['--work-count']
  if (absorb) args.push('--absorb')
  let r
  try {
    // §12g:派生 git/node 必须显式 stdio,不写稳定 EBUSY。
    r = run(process.execPath, [abs, ...args], {
      cwd: resolve(String(root || '')),
      encoding: 'utf8',
      windowsHide: true,
      timeout: 300000,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch {
    return null
  }
  if (!r || typeof r.status !== 'number') return null
  const line = String(r.stdout || '')
    .split(/\r?\n/)
    .reverse()
    .find((l) => l.startsWith('PURGE-WORK'))
  if (!line) return null
  const n = line.slice('PURGE-WORK'.length).trim()
  if (!/^\d+$/.test(n)) return null // unjudged / 形态坏 ⇒ 未判定,不冒充 0
  return Number(n)
}

/**
 * 第二步:复清(G-32,2026-10-14 实测立)。
 *
 * 立因(全部真档实测,不是推断):旁路合并落地后,活文档行级 union 会把本侧**已按清偿台账删掉**的
 * 行再带回(21:42 本侧 0 行 ⇒ 21:44 带回 9 行)。带回的机理有两层,量出来才知道哪条能修:
 *  - 那些变体**带着本侧没有的新取证**(实测中段插着 `〔真机复核通过@2026-10-14 本席:…〕`),
 *    所以"在归并器里按前缀/剥注记折掉它"这条路被否 —— 那是把别人刚写的证据少带掉,少带不可恢复;
 *  - 而归并侧唯一安全的出口本来就该是"同一件器物再过一遍":`plan-pointer-purge` 的准入闸会自己
 *    判"正文是否被幸存行逐字承载 / 独有注记段可否移植",判不准就逐行点名交人工、绝不硬删。
 * 本层是旁路落地的唯一自愈出口(union-converge / git-sync-converge / 对象空间落地器都走它),
 * 所以复清接在这里 = 接在判据源头(AGENTS §1「旁路落地不跑钩子,防它必须在判据源头接」)。
 *
 * 三条不变:①**处置维 0 ⇒ 完全不派生**(不给每一轮收敛加常数成本,也不产生噪声);
 * ②未判定 ⇒ 不派生且必须报名(绝不把"没量到"读成"已归零");
 * ③失败只喊一行、不改本轮收敛成败(与第一条自愈同一条纪律),但 `ok:false` 必须如实回传。
 *
 * **触发集必须等于处置集**(2026-10-25 立,治 73 枚自增提交):
 * 派生判据只认 `purgeWorkResidue`(= 复清器自己的 `realWorkRows`,渲染前后逐字差)。
 * 外围三维(注记 / 可折 / 同号组)**降为只报数**:它们是"字样还在台账里"的账,
 * 不是"这一轮真能改掉几行"的账 —— 拿前者当派生闸,后者为 0 时器物照样落地,
 * 实测每一轮往 PROJECT_PLAN.md 文末多灌一枚空行、2–4 分钟一枚提交,累计 73 枚
 * (现读 23eadba0af^ 那一轮:注记 0 / 可折 0 / 同号组 1 / 处置 0 ⇒ 派生了、但只灌进一行空行)。
 * 同轮取面仍是同一份(§0.4 同面同轮)。
 */
function runPurgeResettle({ root, log = (s) => console.log(s), spawnFn, readFace }) {
  const w = purgeWorkResidue({ root, readFace })
  const n = ledgerNoteResidue({ root, readFace })
  const t = twinFoldResidue({ root, readFace })
  const g = sameKeyGroupResidue({ root, readFace })
  const fmt = (v) => (v === null ? '未判定' : v)
  if (w === null) {
    log(
      `⚠️ [G-32] 处置维未判定(取不到被审面,或复清器那把尺装不上;外围读数 注记=${fmt(n)} / 可折=${fmt(t)} / 同号组=${fmt(g)})⇒ 本轮不复清;不得读成"已归零"`,
    )
    return { ran: false, ok: false, residue: n, twinResidue: t, workResidue: null, why: '未判定' }
  }
  if (w === 0) {
    // 外围维仍 >0 而处置维判得出 0 ⇒ 正是当年那型"账面有存量、器物空转"的现场,
    // 必须点名两把尺的分歧(§12f:判据失效的表现永远是安静),但一个进程都不派生。
    if ((n || 0) + (t || 0) + (g || 0) > 0) {
      log(
        `ℹ️ [G-32] 外围存量 注记=${fmt(n)} / 可折=${fmt(t)} / 同号组=${fmt(g)},而复清器本轮真的动 0 行 ⇒ 不派生(空转不落地)`,
      )
    }
    if (g > 0) reportSameKeyGroups(g, log)
    return { ran: false, ok: true, residue: 0, twinResidue: 0, workResidue: 0, why: '' }
  }
  if (g > 0) reportSameKeyGroups(g, log)
  const run = spawnFn || spawnSync
  const abs = resolve(String(root || ''), PURGE_REL)
  // 派生必带 `--absorb`:只有那一档动"无注记的真副本"(候选正文整段挂进幸存行行尾,
  // 由守恒断言 A1–A4 逐条自证零丢失);只带 --apply 的旧口径对这一型一条也折不掉。
  const flags = ['--apply', '--absorb']
  let r
  try {
    r = run(process.execPath, [abs, ...flags], {
      cwd: resolve(String(root || '')),
      encoding: 'utf8',
      windowsHide: true,
      timeout: 600000,
    })
  } catch (e) {
    const why = String((e && (e.stderr || e.message)) || e).slice(0, 200)
    log(`⚠️ [G-32] 复清未派生成功(处置维 ${w} 行待动;不阻断本轮收敛):${why}`)
    return { ran: false, ok: false, residue: n, twinResidue: t, workResidue: w, why }
  }
  // rc=3 是器物自己给的结论「本轮真的动 0 行 ⇒ 不落地不推送」(HEAD 在量与派生之间被别人
  // 推进过,新面上无事可做)。那是**无事**,不是失败:并进失败臂会把"循环已掐死"读成"复清报错",
  // 逼人在日志里逐轮分辨 —— 而 §12f 说的是判据失效必须响,不是随便什么都响。
  if (r && r.status === 3) {
    log(
      `ℹ️ [G-32] 派生后器物判定无需清偿(量时处置维=${w},落地闸 rc=3)⇒ 本轮未产提交,不阻断收敛`,
    )
    return { ran: true, ok: true, residue: n, twinResidue: t, workResidue: w, why: '无需清偿' }
  }
  if (!r || r.status !== 0) {
    const why = String((r && (r.stderr || r.stdout)) || (r && r.error && r.error.message) || '未知').slice(0, 200)
    log(`⚠️ [G-32] 复清未完成(处置维 ${w} 行待动,注记 ${fmt(n)} / 可折 ${fmt(t)},rc=${r ? r.status : '取不到'},不阻断本轮收敛):${why}`)
    return { ran: true, ok: false, residue: n, twinResidue: t, workResidue: w, why }
  }
  const out = String((r && r.stdout) || '')
  const named = out.split(/\r?\n/).filter((x) => x.includes('落地') || x.includes('守恒断言'))
  log(`🩹 [G-32] 本轮带回 处置维 ${w} 行(注记 ${fmt(n)} / 可折 ${fmt(t)})⇒ 已复清(${flags.join(' ')});逐行处置见上面`)
  for (const l of named.slice(0, 4)) log(`  ${l.trim()}`)
  return { ran: true, ok: true, residue: n, twinResidue: t, workResidue: w, why: '', lines: named }
}

/**
 * 同号组维的出路 = 人工裁决出口,**不得自动派生**(2026-10-25 定性,补 73 枚自增提交的第二半根因)。
 *
 * 旧实现自动派生 `plan-tasks-merge --heal --match-prefix-holder --commit`,而该旗标
 * 必须带一个非旗标值(指定持有行片段),plan-tasks-merge 自己的头注写明它是"人工裁决出口,
 * 绝不混进 post-commit 自动档"。没给值 ⇒ 该调用**恒 rc=2**、一行未改 ⇒ 这一维永不清零,
 * 于是"外围存量 >0 ⇒ 派生复清"每轮都被它点着(现读组键 O02 两行分属两席,持有行由人裁)。
 * 自动档 `--heal --commit` 对 F4/F4b/F10 刻意只报数不折叠(机主 2026-10-13 令)⇒ 这里
 * 结构上没有自动出口。正解 = 点名交人工并给出可直接执行的命令,不再派生必然失败的那一枚
 * (§0.10:失效方向必须是"多要一次定向说明",绝不是"多放一次跳门")。
 */
function reportSameKeyGroups(g, log = (s) => console.log(s)) {
  log(
    `ℹ️ [G-32] 同号多行组 ${g} 组待人工裁持有行(自动出口不存在:--match-prefix-holder 需指定持有行片段,` +
      `plan-tasks-merge 的自动档对 F4/F4b/F10 刻意只报数)⇒ 出路:node scripts/plan-tasks-merge.mjs --heal --match-prefix-holder "<持有行原文片段>" --commit`,
  )
}


/**
 * @param root      被落地的仓库根(调用方自己的 ROOT,不得由 cwd 推)
 * @param log       可选:一行一个的输出口(收敛器用它自己的带色 log)
 * @param spawnFn   可选注入:仅供镜像测试证明"失败臂不改落地成败",生产面不传
 * @param readFace  可选注入:仅供镜像测试给"面上有/没有注记"两种现场,生产面不传
 */
function runLineLossHeal({ root, log = (s) => console.log(s), spawnFn } = {}) {
  const run = spawnFn || spawnSync
  const abs = resolve(String(root || ''), SCRIPT_REL)
  let r
  try {
    r = run(process.execPath, [abs, '--heal', '--commit'], {
      cwd: resolve(String(root || '')),
      encoding: 'utf8',
      windowsHide: true,
      timeout: 180000,
    })
  } catch (e) {
    const why = String((e && (e.stderr || e.message)) || e).slice(0, 200)
    log(`⚠️ 计划登记行自愈未派生成功(不阻断本轮收敛):${why}`)
    return { ok: false, ran: false, lines: [], why }
  }
  if (!r || r.status !== 0) {
    const why = String((r && (r.stderr || r.stdout)) || (r && r.error && r.error.message) || '未知').slice(
      0, 200,
    )
    log(`⚠️ 计划登记行自愈未完成(rc=${r ? r.status : '取不到'},不阻断本轮收敛):${why}`)
    return { ok: false, ran: true, lines: [], why }
  }
  const out = String((r && r.stdout) || '')
  const lines = out.split(/\r?\n/).filter((x) => x.includes('登记行'))
  for (const l of lines) log(`  ${l.trim()}`)
  return { ok: true, ran: true, lines, why: '' }
}

/**
 * 旁路合并落地后的台账自愈唯一出口 = **两步**:
 *  ① 守门 71 回捞(只加不减:被合并吞掉的登记行捞回来);
 *  ② G-32 复清(只在面上真有"重复登记副本"注记时派生清偿器,它自带守恒断言/台账/推送)。
 *
 * 返回值**保留第一步的原字段**(ok/ran/lines/why)一字不动 —— 三条调用路径(union-converge /
 * git-sync-converge / 对象空间落地器)与既有镜像测试都按那一份语义读;第二步只新增 `purge` 一维。
 * 第一步"没跑成"不影响第二步照做:两条是各自的账,并桶会把回捞失败读成"整层没跑"。
 */
export function postMergeLedgerSync(opts = {}) {
  const heal = runLineLossHeal(opts)
  const purge = runPurgeResettle(opts)
  return { ...heal, purge }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠