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
import { spawnSync, execFileSync } from 'node:child_process'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

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
  let text = null
  try {
    text = readFace
      ? readFace(PLAN_REL)
      : execFileSync('git', ['-C', resolve(String(root)), 'show', `HEAD:${PLAN_REL}`], {
          encoding: 'utf8',
          windowsHide: true,
          timeout: 120000,
          maxBuffer: 256 * 1048576,
          stdio: ['ignore', 'pipe', 'pipe'],
        })
  } catch {
    return null
  }
  if (typeof text !== 'string' || text === '') return null
  try {
    const m = require(join(HERE, '..', 'check-plan-dup-pointer-ratchet.mjs'))
    return m.countPointerRows(text)
  } catch {
    return null
  }
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
 * 三条不变:①存量 0 ⇒ 完全不派生(不给每一轮收敛加常数成本,也不产生噪声);
 * ②未判定 ⇒ 不派生且必须报名(绝不把"没量到"读成"已归零");
 * ③失败只喊一行、不改本轮收敛成败(与第一条自愈同一条纪律),但 `ok:false` 必须如实回传。
 */
function runPurgeResettle({ root, log = (s) => console.log(s), spawnFn, readFace }) {
  const n = ledgerNoteResidue({ root, readFace })
  if (n === null) {
    log('⚠️ [G-32] 注记存量未判定(取不到被审面或判据模块不可用)⇒ 本轮不复清;不得读成"已归零"')
    return { ran: false, ok: false, residue: null, why: '未判定' }
  }
  if (n === 0) return { ran: false, ok: true, residue: 0, why: '' }
  const run = spawnFn || spawnSync
  const abs = resolve(String(root || ''), PURGE_REL)
  let r
  try {
    r = run(process.execPath, [abs, '--apply'], {
      cwd: resolve(String(root || '')),
      encoding: 'utf8',
      windowsHide: true,
      timeout: 600000,
    })
  } catch (e) {
    const why = String((e && (e.stderr || e.message)) || e).slice(0, 200)
    log(`⚠️ [G-32] 复清未派生成功(面上 ${n} 行注记待清;不阻断本轮收敛):${why}`)
    return { ran: false, ok: false, residue: n, why }
  }
  if (!r || r.status !== 0) {
    const why = String((r && (r.stderr || r.stdout)) || (r && r.error && r.error.message) || '未知').slice(0, 200)
    log(`⚠️ [G-32] 复清未完成(面上 ${n} 行注记待清,rc=${r ? r.status : '取不到'},不阻断本轮收敛):${why}`)
    return { ran: true, ok: false, residue: n, why }
  }
  const out = String((r && r.stdout) || '')
  const named = out.split(/\r?\n/).filter((x) => x.includes('落地') || x.includes('守恒断言'))
  log(`🩹 [G-32] 本轮带回 ${n} 行重复登记副本 ⇒ 已复清;逐行处置见上面`)
  for (const l of named.slice(0, 4)) log(`  ${l.trim()}`)
  return { ran: true, ok: true, residue: n, why: '', lines: named }
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
