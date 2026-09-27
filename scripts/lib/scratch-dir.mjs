// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 临时夹具唯一落点。两条选址硬约束见 scratchRoot() 注释,均由实测踩坑固化而来。
// G-286(2026-09-27):scratch 根改为**盘根锚定**并加二阶嵌套守卫 —— 旧推导按
// 「脚本自身位置向上两级」取盘根,而 scratch-module-closure 会把整条 import 闭包拷进
// 演练仓,拷进去之后"向上两级"跟着夹具走:夹具一层深 ⇒ `G:/DevEnv/Temp/DevEnv/Temp/
// ihui-scratch`,两层深 ⇒ `<scratch 根>/DevEnv/Temp/ihui-scratch`(二阶嵌套,实测在盘,
// 由 plan-union-merge / plan-tasks-merge 的闭包拷贝测试每轮复现一层深那份)。

import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { dirname, join, parse, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..', '..')

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
 * G-286 守卫:scratch 根内不得再出现 scratch 根。落点路径里出现第二层 `ihui-scratch`
 * 段 ⇒ 抛错点名,绝不静默换路径 —— 换路径等于把"推导已经歪了"藏起来,下一个调用方
 * 继续在错的位置建夹具。守卫放在 mkdir 之前:抛错时不得留下任何目录。
 */
function assertNoNestedScratchRoot(root) {
  const segs = normalize(root).split(/[\\/]+/).filter(Boolean)
  const hits = segs.filter((s) => s.toLowerCase() === 'ihui-scratch')
  if (hits.length > 1) {
    throw new Error(
      `scratch 落点出现二阶嵌套(路径里有两层 ihui-scratch 段):${root} —— ` +
        `推导链被拷进了夹具仓或 IHUI_SCRATCH_DIR 指歪,先修生产者再跑;` +
        `盘根锚定推导见 scripts/lib/scratch-dir.mjs 头注(G-286)`,
    )
  }
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
export function rmScratch(dir) {
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
    } catch {
      // 退出路径上不得因清理失败而改写结论 —— 判据的红要留在断言里,不是留在这里
    }
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
