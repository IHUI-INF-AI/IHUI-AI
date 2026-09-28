// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

// 临时夹具唯一落点。两条选址硬约束见 scratchRoot() 注释,均由实测踩坑固化而来。
// G-286(2026-09-27):scratch 根改为**盘根锚定**并加二阶嵌套守卫 —— 旧推导按
// 「脚本自身位置向上两级」取盘根,而 scratch-module-closure 会把整条 import 闭包拷进
// 演练仓,拷进去之后"向上两级"跟着夹具走:夹具一层深 ⇒ `G:/DevEnv/Temp/DevEnv/Temp/
// ihui-scratch`,两层深 ⇒ `<scratch 根>/DevEnv/Temp/ihui-scratch`(二阶嵌套,实测在盘,
// 由 plan-union-merge / plan-tasks-merge 的闭包拷贝测试每轮复现一层深那份)。
//
// 同票现读还量到**第二条**二阶落点生产者,它不在本模块射程内、只登记不代裁:
// `scripts/lib/gitdir.mjs` 的 `gitArchiveDir()` 同样按「工作树向上两级」推导
// (`resolve(wt,'..','..')`),而演练仓的工作树落在 `<scratch 根>/<前缀>/wt` 时,
// 向上两级正好等于 scratch 根本身 ⇒ 现场归档落进 `<scratch 根>/DevEnv/backups/git/`。
// 2026-09-27 现读:`G:/DevEnv/Temp/ihui-scratch/DevEnv/backups/git` 下 5 个
// `ihui-git-write.lock.stale-*` 归档(10 文件 / 2,311 B),meta 的 unitId 是
// `post-commit-*` ⇒ 由提交链上的 git-lock 抢占在夹具工作树里跑出来的。
// 判据(只读、不判红、绝不代删)= `scripts/check-scratch-root-no-nesting.mjs`。

import { lstatSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { dirname, join, parse, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..', '..')

/**
 * scratch 落点的**目录名**,全仓唯一一份。任何"这算不算二阶 scratch 根"的判断都必须用它,
 * 不得在别处再写一遍字面量 —— 名字一改,抄的那份就静默对整族失明(AGENTS §3「两处实现必漂移」)。
 */
export const SCRATCH_DIR_NAME = 'ihui-scratch'

/** 有界枚举的默认闸(见 scanForNestedScratchRoot)。 */
export const NEST_SCAN_DEFAULTS = { maxDepth: 4, entryBudget: 1500 }

/**
 * 为什么不沿用 os.tmpdir():活进程的 %TEMP% 可能仍钉在 C 盘(HKCU 已于 2026-09-23
 * 改指 D:\DevEnv\Temp,但环境块只对重启后的新进程生效),实测 C 盘 Temp 单日因此
 * 长出 45 个 git 夹具目录。
 *
 * 为什么不落在仓库内(.ihui-agent/tmp/):夹具需要模拟"非 git 目录",放在仓库树内时
 * `git rev-parse --show-toplevel` 会向上逃逸到真仓库,使该用例恒红(已 A/B 实证)。
 *
 * 结论:与 scripts/lib/gitdir.mjs 的 gitArchiveDir() 同族推导 —— 工作树所在盘的
 * DevEnv/Temp(§15b 批准的临时物落点),不写死盘符。
 *
 * G-286:盘根一律取 `parse(HERE).root`(**模块所在盘的盘根本身**),不再由
 * 「脚本位置向上两级」推导 —— 旧推导只对「仓库恰在 `<盘>:/IHUI-AI`」这一种布局成立,
 * 本模块一旦被闭包拷贝进演练仓,向上两级就落到夹具的祖先上去(见文件头注)。
 * 对真实布局两者逐字同值(换机/换盘语义不变);对被拷进夹具的副本,盘根锚定
 * 始终回到同一个盘级 scratch 根 —— 夹具与真仓同盘,这正是选址的本意。
 */
export function scratchRoot() {
  const override = process.env.IHUI_SCRATCH_DIR
  if (override) return normalize(override)
  return normalize(join(parse(HERE).root, 'DevEnv', 'Temp', 'ihui-scratch'))
}

function normalize(p) {
  return p.replace(/[\\/]+$/, '')
}

/**
 * 纯函数:路径里 `ihui-scratch` **目录段**的个数(大小写不敏感,两种分隔符都拆)。
 * ≥2 就是二阶嵌套。判据只在这一个地方定义,守卫、删除闸、告警门共用它。
 */
export function countScratchSegments(p) {
  if (typeof p !== 'string' || p === '') return 0
  return p.split(/[\\/]+/).filter((s) => s.toLowerCase() === SCRATCH_DIR_NAME).length
}

/**
 * G-286 守卫:scratch 根内不得再出现 scratch 根。落点路径里出现第二层 `ihui-scratch`
 * 段 ⇒ 抛错点名,绝不静默换路径 —— 换路径等于把"推导已经歪了"藏起来,下一个调用方
 * 继续在错的位置建夹具。守卫放在 mkdir 之前:抛错时不得留下任何目录。
 */
function assertNoNestedScratchRoot(root) {
  if (countScratchSegments(root) > 1) {
    throw new Error(
      `scratch 落点出现二阶嵌套(路径里有两层 ${SCRATCH_DIR_NAME} 段):${root} —— ` +
        `推导链被拷进了夹具仓或 IHUI_SCRATCH_DIR 指歪,先修生产者再跑;` +
        `盘根锚定推导见 scripts/lib/scratch-dir.mjs 头注(G-286)`,
    )
  }
}

/**
 * 有界 + 不穿重解析点的子树枚举:dir **之内**是否藏着第二层 scratch 根。
 *
 * 为什么"有界"与"判重解析点"是这条的硬约束(§26 junction 穿透清空事故同型):
 * 二阶嵌套一旦形成,父目录里就装着**别的进程/别的时刻**的落点;任何按递归枚举做的
 * 动作(清理、删除、统计)只要顺着自己造出的那层走下去,就会吞掉别人的现场,或在
 * "枚举 → 产出 → 再枚举"里永不收敛。所以这里:
 *   · 深度上限 maxDepth、条目预算 entryBudget,超限置 `truncated`(调用方必须把它
 *     当"没判完",不得当成"没发现");
 *   · `dirent.isSymbolicLink()` 直接跳过(Windows junction 在 Node 侧同样报 true)——
 *     只断链不穿透,穿过链接去动真实落点属越权删除;
 *   · readdir 的结果是**快照**,枚举期间同树的新增不影响本轮,所以本函数自己
 *     不产出任何目录 ⇒ 不存在"顺着自己的产物加深"。
 *
 * @returns {{hits:Array<{path:string,depth:number}>,scannedEntries:number,truncated:boolean,unreadable:string[],skippedReparse:number}}
 */
export function scanForNestedScratchRoot(dir, opts = {}) {
  const maxDepth = opts.maxDepth ?? NEST_SCAN_DEFAULTS.maxDepth
  const budget = opts.entryBudget ?? NEST_SCAN_DEFAULTS.entryBudget
  const res = {
    hits: [],
    scannedEntries: 0,
    truncated: false,
    unreadable: [],
    skippedReparse: 0,
  }
  let stop = false
  const walk = (parent, depth) => {
    if (stop) return
    let entries
    try {
      entries = readdirSync(parent, { withFileTypes: true })
    } catch (e) {
      res.unreadable.push(`${parent} :: ${e && e.code ? e.code : String(e)}`)
      return
    }
    for (const d of entries) {
      if (res.scannedEntries >= budget) {
        stop = true
        res.truncated = true
        return
      }
      res.scannedEntries += 1
      const q = join(parent, d.name)
      if (d.isSymbolicLink()) {
        res.skippedReparse += 1
        continue
      }
      if (!d.isDirectory()) continue
      if (d.name.toLowerCase() === SCRATCH_DIR_NAME) res.hits.push({ path: q, depth })
      if (depth < maxDepth) walk(q, depth + 1)
    }
  }
  walk(dir, 1)
  return res
}

function isReparsePath(p) {
  try {
    return lstatSync(p).isSymbolicLink()
  } catch {
    return false
  }
}

function samePath(a, b) {
  const norm = (x) => String(x).replace(/[\\/]+$/, '')
  return norm(a).toLowerCase() === norm(b).toLowerCase()
}

/** target 是否落在 scratch 根之内(只有落在里面才值得为"嵌套"付一次枚举成本)。 */
function isWithinScratchRoot(target, root) {
  const t = resolve(target)
  const r = resolve(root)
  return t === r || t.startsWith(r + sep)
}

/**
 * 纯函数:递归删除前的准入判定 —— 返回**拒绝理由**(字符串)或 null(放行)。
 * 输入全部是已观测事实,所以三种拒绝都能用构造面证明,不必赌本机此刻的目录形态。
 *
 * 三条拒绝的方向都是"宁可漏一个目录,不可吞别人的现场":
 *   D1 目标就是 scratch 根本身(删它 = 把所有并发会话的夹具一锅端);
 *   D2 目标本身是符号链接/junction(rmSync 对链接只断链,但调用方给的若是"看起来是目录"
 *      的改道入口,§26 的教训是穿过它递归 = 清空真实目标);
 *   D3 目标子树里藏着第二层 scratch 根(那是别的落点/别的时刻的现场,不是本次夹具)。
 */
export function evaluateDeleteTarget({ target, scratchRoot: root, isReparseTarget, nested }) {
  if (!target) return 'rmScratch 需要一个明确目录路径,收到空值'
  if (root && samePath(target, root))
    return `目标就是 scratch 根本身(${target}),递归删会波及全部并发夹具`
  if (isReparseTarget) return `目标是符号链接/junction(${target}),不得顺着重解析点递归删除(§26)`
  if (nested && nested.hits.length > 0) {
    const listed = nested.hits
      .slice(0, 5)
      .map((h) => `${h.path}(depth ${h.depth})`)
      .join(', ')
    return (
      `子树里存在第二层 scratch 根 ⇒ 递归删等于替别的落点做删除决定:` +
      `${listed}${nested.hits.length > 5 ? ` … 共 ${nested.hits.length} 处` : ''}`
    )
  }
  return null
}

function isInsideRepo(dir) {
  const rel = dirname(resolve(dir))
  return rel === REPO_ROOT || rel.startsWith(REPO_ROOT + sep)
}

const live = new Set()

export function mkScratch(prefix) {
  const root = scratchRoot()
  if (isInsideRepo(root)) {
    throw new Error(`scratch 落点不得在仓库树内: ${root}`)
  }
  // G-286:嵌套守卫必须在 mkdir 之前 —— 抛错本身就是结论,不得先建目录再报。
  assertNoNestedScratchRoot(root)
  mkdirSync(root, { recursive: true })
  const dir = mkdtempSync(join(root, prefix))
  live.add(dir)
  return dir
}

// git 对象是只读文件,Windows 上首删常撞 EPERM,故带重试。
//
// G-286(删除侧):递归删之前先过 evaluateDeleteTarget。二阶嵌套树的父目录里装着**别的
// 落点**,顺着它 rmSync 就等于替别人做删除决定(§26 的 junction 穿透清空同型 —— 那次是
// "按名字递归删"顺着链接把 D 盘真实目标清掉了)。方向刻意是**宁可漏删**:夹具留在盘上
// 有 §26 的每日 Temp 体检兜,吞掉别人的现场没有任何兜底。
// 紧急出口 IHUI_SCRATCH_RM_FORCE=1(真读、真打印,不是文档里的假出路):跳过 D3 那次
// 枚举并放行 D3,**不**放行 D1(删 scratch 根本身任何情况下都不该发生)。
export function rmScratch(dir, opts = {}) {
  const root = scratchRoot()
  const forced = process.env.IHUI_SCRATCH_RM_FORCE === '1'
  const within = isWithinScratchRoot(dir, root)
  // 只在"目标确实落在 scratch 根之内"时付这次枚举成本:其余调用点(临时 index、
  // 归档落点等)本就与 scratch 无关,深扫等于给每一次 rmScratch 加一次目录遍历。
  const scan =
    within && !forced && opts.skipNestedScan !== true
      ? scanForNestedScratchRoot(dir, opts.nestedScan ?? NEST_SCAN_DEFAULTS)
      : null
  const reason = evaluateDeleteTarget({
    target: dir,
    scratchRoot: root,
    isReparseTarget: isReparsePath(dir),
    nested: forced ? null : scan,
  })
  if (reason) {
    if (forced && reason.startsWith('子树里存在第二层')) {
      console.warn(`⚠ IHUI_SCRATCH_RM_FORCE=1 放行递归删,尽管:${reason}`)
    } else {
      throw new Error(`rmScratch 拒绝递归删除:${reason}`)
    }
  }
  rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  live.delete(dir)
}

/**
 * 进程退出前回收**本进程创建且未被显式删除**的夹具。
 *
 * 为什么放在共用层而不是要求各调用方写 try/finally:实测 `scripts/` 里 30 处 mkScratch 调用点
 * 中,把 `rmScratch` 写在断言之后的比比皆是 —— 一条断言失败就把夹具永久留在 Temp
 * (2026-09-25 一天漏 3 个,合计约 750KB,来自 `check-cross-end-tokens` 的端到端用例)。
 * 靠"人人都记得写 finally"是散文约束,已经被证明会漏;这里让它结构上不可能漏。
 *
 * 边界(为什么不会误删别人的东西):注册表只含**本进程本次运行** mkScratch 出来的路径,
 * 显式 rmScratch 过即出表;SIGKILL / 断电不在此列(那种残留由 §26 的每日 Temp 体检兜)。
 */
process.on('exit', () => {
  for (const dir of [...live]) {
    try {
      rmScratch(dir)
    } catch (e) {
      // 退出路径上不得因清理失败而改写结论 —— 判据的红要留在断言里,不是留在这里。
      // 但**也不得静默**:rmScratch 现在会因"子树里有二阶 scratch 根"拒绝递归删,
      // 那种残留必须喊出来(沉默的泄漏与沉默的成功在日志里长得一样)。
      try {
        console.error(`⚠ 退出清理未执行 ${dir}:${e && e.message ? e.message : String(e)}`)
      } catch {
        /* 连 stderr 都写不出去时,至少不改写退出码 */
      }
    }
  }
})
