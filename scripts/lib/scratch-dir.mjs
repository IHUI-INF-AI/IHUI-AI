// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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

import { spawnSync } from 'node:child_process'
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, parse, resolve, sep } from 'node:path'
import { tmpdir } from 'node:os'
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
 * 为什么落点必须"git 面不可见":夹具需要模拟"非 git 目录",若 `git rev-parse
 * --show-toplevel` 能向上逃逸到真仓库,该用例恒红(已 A/B 实证,落点曾因此禁在
 * .ihui-agent/tmp/)。G-158 后新址 `<repoRoot>/.DevEnv` 在工作树**目录**内但不在
 * git **面**内:该根已入 .gitignore,且 `mkScratch` 在 `.DevEnv` 层维护一枚坏 gitfile
 * 边界(见 ensureDevEnvGitBoundary),discovery 停在该层 fatal ⇒ 逃逸性质与旧盘根选址同值。
 *
 * 结论:落点 = §15b 批准的 DevEnv/Temp(不写死盘符)。**该结论只对 Windows 成立**,
 * 非 win32 的那一臂见下方 `chooseScratchRoot` 的注(GitHub runner 实测 EACCES)。
 *
 * G-286:推导不得按「脚本位置向上两级」跟着闭包拷贝走(见文件头注),副本必须
 * 回到与真仓同一个 scratch 根 —— 夹具与真仓同盘,这正是选址的本意。
 *
 * G-158(2026-10-23 补刀):DevEnv 实体已搬入仓内 `<repoRoot>/.DevEnv`(G-814433 立,
 * `seal-c-root-stray.mjs` 的 `devEnvRoot()` 双形态为既定模式)。scratch 根随之改为
 * `<DevEnv>/Temp/ihui-scratch`,优先级 `IHUI_SCRATCH_DIR` > `IHUI_DEVENV_ROOT` > 仓内
 * `.DevEnv`(worktree 席各自成立;被拷进夹具的副本回落盘根 `<盘>:/IHUI-AI/.DevEnv`)。
 * 旧「盘根 DevEnv」臂就此退役 —— 旧根 g:\DevEnv 不再有任何程序化写入者。
 * 新址在工作树目录内,但 `.gitignore:590` 在册、守门 208 对 `.DevEnv` 整枝剪除,且
 * `mkScratch` 会在 `.DevEnv` 层落一枚坏 gitfile 边界阻断 `git rev-parse` 向上逃逸
 * (实测无边界时 toplevel=真仓、有边界时 fatal RC=128 ⇒ "非 git 目录"夹具性质保留)。
 */
/**
 * 纯函数:落点的**唯一**推导处,输入全部显式给出(moduleDir / platform / env),
 * 所以两条平台臂都能用构造面证明,不必赌本机此刻是什么系统(§22c「证明行为只能用
 * 纯函数 + 构造面」)。`scratchRoot()` 只是它的一个绑定。
 *
 * 非 win32 为什么退回 `os.tmpdir()`:上面那套「盘根 + DevEnv/Temp」的选址理由**只在
 * Windows 成立**(§15b 批准的 D 盘落点 + §26 的 C 盘污染),而 Linux/macOS 上
 * `parse(dir).root` 就是 `/` ⇒ 推导出 `<fs根>/DevEnv/Temp/ihui-scratch`,根目录不可写。
 * 实测:GitHub runner 上 i18n 工作流整个 CLI 入口测试组挂在
 * `EACCES: permission denied, mkdir '/DevEnv/Temp/ihui-scratch'`(hookFailed ⇒ 子用例
 * 全被 cancelledByParent,账面读起来像"测试自己坏了")。`/tmp` 在 runner 上必然在仓库树外,
 * 所以两条硬约束里"不得落在仓库内"仍然成立,"不跟随进程 TEMP"那一条本来就是 Windows 病灶。
 */
export function chooseScratchRoot({ moduleDir = HERE, platform = process.platform, env = process.env } = {}) {
  const override = env && env.IHUI_SCRATCH_DIR
  if (override) return normalize(override)
  if (platform !== 'win32') return normalize(join(tmpdir(), SCRATCH_DIR_NAME))
  const devEnvOverride = env && env.IHUI_DEVENV_ROOT
  if (devEnvOverride) return normalize(join(devEnvOverride, 'Temp', SCRATCH_DIR_NAME))
  return normalize(join(deriveDevEnvRoot(moduleDir), 'Temp', SCRATCH_DIR_NAME))
}

/**
 * G-158 双形态推导(保持纯函数:零 fs 探测,§22c 构造面可证):
 *   · 常规模块:repoRoot = moduleDir 向上两级 ⇒ `<repoRoot>/.DevEnv`
 *     (真仓、worktree 席、任意盘任意深度都成立,不写死盘符);
 *   · 被 `scratch-module-closure` 拷进夹具的副本:repoRoot 含 `ihui-scratch` 段 ⇒
 *     回到同盘根 `<盘>:/IHUI-AI/.DevEnv`,与真仓逐字同根(G-286 解耦不变量,
 *     旧「盘根 + DevEnv」的同族写法,只是根名换成搬迁后的新址)。
 */
function deriveDevEnvRoot(moduleDir) {
  const repoRoot = resolve(moduleDir, '..', '..')
  if (countScratchSegments(repoRoot) === 0) return join(repoRoot, '.DevEnv')
  return join(parse(moduleDir).root, 'IHUI-AI', '.DevEnv')
}

export function scratchRoot() {
  return chooseScratchRoot({ moduleDir: HERE, platform: process.platform, env: process.env })
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

/**
 * G-158:仓库树目录内**唯一批准**的落点 = `<repoRoot>/.DevEnv`(§15b 外置根搬入仓内后的形态;
 * .gitignore 在册、守门 208 对该根整枝剪除、git 面由边界阻断 —— 三条都在文件头注)。
 * 其余树内位置(IHUI_SCRATCH_DIR 指歪等)照旧拒建。
 */
function isApprovedDevEnvRoot(root) {
  const approved = resolve(join(REPO_ROOT, '.DevEnv'))
  const r = resolve(root)
  return r === approved || r.startsWith(approved + sep)
}

/**
 * 落点合法性的**唯一判据**:仓外任意位置,或仓内唯一批准的 `.DevEnv`。
 * `mkScratch` 的拒建闸与两处自检/镜像测试共用这一枚,不得各写一份
 * (2026-10-25:check-service-binary-paths 的 F3 仍在用旧判据"不得在仓库树内",
 * G-158 把批准根搬进仓内之后它就恒红了 —— 判据没跟上设计,红在尺子而不是落点)。
 */
export function isAllowedScratchRoot(root) {
  return !isInsideRepo(root) || isApprovedDevEnvRoot(root)
}

/**
 * 「该落点没有逃逸到真仓 git 面」的唯一判据(自检/镜像测试共用;三态,不把没量到写成通过)。
 * 逃逸的实质 = 夹具里 `git rev-parse --show-toplevel` 问得出真仓库 —— 那会让"非 git 目录"
 * 一类用例恒红。G-158 的仓内落点靠 `.DevEnv` 层的坏 gitfile 边界阻断 discovery,本函数就是
 * 那条性质的行为锁(边界没了它当场翻红,而不是等某条夹具下次跑时才红)。
 *  - `measured` + `escapes:false` ⇒ 边界生效(或本来就在仓外);
 *  - `measured` + `escapes:true`  ⇒ 逃逸到真仓,判红;
 *  - `undetermined`               ⇒ git 不可达/退出码形态不认得,不记绿。
 */
export function gitFaceEscapesToRepo(dir, { repoRoot = REPO_ROOT, spawn = spawnSync } = {}) {
  const r = spawn(process.env.IHUI_GIT_BIN || 'git', ['rev-parse', '--show-toplevel'], {
    cwd: dir,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 15_000,
    // §12g:派生 git 必须显式接管 stdio,不留给调用方"顺手删掉"的空间。
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  if (r?.error) return { state: 'undetermined', why: `git 派生失败(${r.error.code ?? r.error.message})` }
  if (r.status === 0) {
    const top = resolve(String(r.stdout || '').trim())
    return { state: 'measured', escapes: top === resolve(repoRoot), top }
  }
  // `rev-parse --show-toplevel` 在非 git 目录(code 128)是**正常结论**:问不出祖先仓。
  if (r.status === 128) return { state: 'measured', escapes: false, top: null }
  return { state: 'undetermined', why: `git rev-parse exit ${r.status}:${String(r.stderr || '').trim().slice(0, 160)}` }
}

/**
 * 在 `.DevEnv` 层维护一枚**坏 gitfile 边界**(内容 = 指向不存在目录的 gitdir: 指针)。
 * 立因:新址在工作树目录内,`git rev-parse` 会向上逃逸到真仓(实测 toplevel=仓根),
 * "非 git 目录"夹具(check-migration-bookkeeping E5a、scan-hardcoded-zh 13 例等)当场翻红;
 * 而 discovery 撞到 gitfile 后**不再继续向上**(实测 fatal RC=128)⇒ 边界把新址的
 * git 面性质拉回与旧盘根选址同值。幂等:只在缺失时写,存在(含他席已写)绝不覆盖;
 * 目录形态的 .git 同样阻断 discovery,但那是"独立仓"形态(守门 208 立门因由),不得造。
 */
function ensureDevEnvGitBoundary(root) {
  const segs = resolve(root).split(sep)
  const i = segs.findIndex((s) => s === '.DevEnv')
  if (i < 0) return
  const devEnvDir = segs.slice(0, i + 1).join(sep)
  const boundary = join(devEnvDir, '.git')
  if (existsSync(boundary)) return
  try {
    writeFileSync(boundary, `gitdir: ${join(devEnvDir, '.no-git-boundary')}\n`)
  } catch {
    /* 只读环境不喊:若边界没落上,"非 git"夹具会自己因逃逸红出来,红在判据而不是这里 */
  }
}

export function mkScratch(prefix) {
  const root = scratchRoot()
  if (!isAllowedScratchRoot(root)) {
    throw new Error(`scratch 落点不得在仓库树内: ${root}`)
  }
  // G-286:嵌套守卫必须在 mkdir 之前 —— 抛错本身就是结论,不得先建目录再报。
  assertNoNestedScratchRoot(root)
  mkdirSync(root, { recursive: true })
  if (isApprovedDevEnvRoot(root)) ensureDevEnvGitBoundary(root)
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
    } else if (opts.bestEffort) {
      // 2026-10-04:`bestEffort` 出口 —— 清理失败**只告警不抛**。
      //
      // 立因:`union-converge.mjs` 的 `selfTest()` 形如
      //   `try { …长报告… } finally { rmScratch(dir) }`
      // 而 `rmScratch` 会因宿主 `node-safe-delete-shim.cjs` 的批量删除闸
      // (`SAFE_DELETE_BULK_CONFIRM_REQUIRED`;实测本机 count 50~977、阈值 50)抛错
      // ⇒ **`finally` 抛错会把 try 块里的整段报告与 `process.exit()` 全吞掉**
      //
      // 为什么要这个出口而不是让调用方各自 try/catch:清理失败**不该改写判据结论** ——
      // 自检的通过/失败由 `cases` 决定,不该由"临时目录删不掉"决定。
      // ⇒ 调用方在**只做清理、且清理失败不影响结论**的位置显式要 `bestEffort`。
      console.warn(`⚠ rmScratch(bestEffort) 未清理:${dir} —— ${reason}`)
      return
    } else {
      throw new Error(`rmScratch 拒绝递归删除:${reason}`)
    }
  }
  // `rmSync` 自己也会抛:宿主的 `node-safe-delete-shim.cjs` 在批量删除闸
  // (`SAFE_DELETE_BULK_CONFIRM_REQUIRED`)命中时**直接把 `rmSync` 打断**,不经过上面的
  // `evaluateDeleteTarget` ⇒ `bestEffort` 必须连这一层一起兜住,否则该出口形同虚设。
  if (opts.bestEffort) {
    try {
      rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
      live.delete(dir)
    } catch (e) {
      console.warn(`⚠ rmScratch(bestEffort) 清理失败:${dir} —— ${String(e.message || e).slice(0, 160)}`)
    }
    return
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
