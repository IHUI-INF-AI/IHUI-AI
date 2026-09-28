#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * mypy 类型检查守门(2026-07-26 立;2026-09-29 补"判定面 vs 机器现场")
 *
 * 防止 ai-service Python 代码类型错误回退:
 *   项目刚完成 mypy 全库清零(4 批次累计 256→0 errors,226 source files),
 *   但当前 mypy 检查只在 `pnpm typecheck:full` 中手工运行,没有 pre-commit 守门。
 *   一旦有 agent 改 Python 代码引入类型错误,typecheck:full 可能被 --no-verify 跳过,
 *   导致 mypy errors 回退。本脚本在 staged 涉及 apps/ai-service 下任意 .py 文件时触发
 *   mypy 检查,0 errors 才通过。
 *
 * 判定面(2026-09-29 改,与守门 70/77/83/98/103/118 同口径):
 *   全量档   ⇒ **HEAD 面**;`--staged` ⇒ **索引面**;`--worktree` ⇒ 磁盘(仅人工逃生舱)
 *   两个面旗同给 ⇒ exit 2(互斥,取哪一面都会让另一面成为假绿)。
 *   面内容经 `scripts/lib/face-reader.mjs` 的 catBatch 取,再**物化**到 `scripts/lib/scratch-dir.mjs`
 *   的临时目录里跑 mypy —— mypy 是外部工具,它只能看见磁盘,所以"判被审面"必须先物化。
 *
 * 为什么要物化(实测,不是假想):
 *   旧版把 mypy 跑在**共享工作树**上,于是邻居未提交的在飞文件被算成本仓类型债。本仓 2026-09-29
 *   现读到的形态:工作树里并存 `app/services/sandbox.py`(已跟踪)与 `app/services/sandbox/`
 *   (**未跟踪**包)⇒ Python 包遮蔽同名模块,mypy 解到那一份未跟踪包,报出 2 条 attr-defined;
 *   而这两条报错的**语句本身**在 HEAD 与索引面逐字相同 —— 被审代码无罪,红的是机器现场。
 *   后果是 AGENTS §12e 那一型:任何人暂存 ai-service 的 .py 都被这道与己无关的红挡住,
 *   一次绕过 = 该提交全部守门作废。
 *   同一轮对照:HEAD 面另有 2 条**真**已入库错误(`app/routers/llm.py` 的 arg-type),
 *   物化后照旧判红 ⇒ 本次改动只关掉误红,没有削弱对已入库代码的判红能力。
 *
 * 用法:
 *   node scripts/check-mypy.mjs             全量档:判 HEAD 面(物化后跑 mypy)
 *   node scripts/check-mypy.mjs --staged    仅 staged 涉及 apps/ai-service 下 .py 时判索引面
 *   node scripts/check-mypy.mjs --worktree  人工复现工作树跑法(结论不得作为提交门禁)
 *   node scripts/check-mypy.mjs --help      打印帮助
 *
 * 退出码:
 *   0  判定面 0 errors;或 --staged 无 Python 改动;或本机拿不到 mypy(环境缺失,非代码问题)
 *   1  判定面确有 mypy 类型错误
 *   2  **无法判定**:取材/物化取不到、面上枚举到 0 个可检文件、mypy 自身以 rc≠0/1 退出、两面旗同给
 *      —— 既不冒红也不记绿(把没判写成判过了是本仓最高频失效型)
 *
 * 跳过方式(紧急场景):
 *   HUSKY_SKIP_MYPY=1 git commit ...
 *
 * 与 guardian-runner.mjs 集成位置:
 *   guardian-runner 第 35 项(blocking),在 30a(check-commit-loss-guard)之后、
 *   2d(warn-only 区)之前。原任务描述要求 id '31',但 '31' 已被 verify-auth-shell.mjs
 *   占用(同日 2026-07-26 新增),'34' 也被 check-ts-ignore.mjs 占用,故用下一个可用
 *   编号 '35'。
 *
 * 依赖:apps/ai-service/pyproject.toml 的 [tool.mypy] 配置(已就绪,不修改)。
 *   mypy 命令继承 pyproject.toml 配置 + --ignore-missing-imports 兼容第三方库
 *   + --strict 强制严格模式(防止 pyproject.toml strict 被改回 false 降级)。
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  Undetermined,
  assertRepoRoot,
  catBatch,
  gitRaw,
  selectFace,
} from './lib/face-reader.mjs'
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'

/** ROOT 由脚本自身位置推导(AGENTS §15)。旧写法按调用者的当前目录取根,让"扫哪棵树"随站位漂 —— 守门 70 的镜像测试 13/14 恒红就是这一型。 */
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const AI_REL = 'apps/ai-service'
const AI_PREFIX = 'apps/ai-service/'
const GIT_TIMEOUT = 120000
const BATCH_TIMEOUT = 240000
/** 一次全量 mypy 实测 43–60s(物化面没有热缓存);环境变量只用于放宽,不用于关掉判定。 */
const MYPY_TIMEOUT = Number(process.env.IHUI_MYPY_GATE_TIMEOUT_MS || 900000)
const argv = process.argv.slice(2)
const showHelp = argv.includes('--help') || argv.includes('-h')

// === 颜色(对齐 guardian-runner.mjs 的 C 对象) ===
const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
}

// === Help ===
if (showHelp) {
  console.log(`
check-mypy.mjs — mypy 类型检查守门(防 ai-service Python 类型回退)

判定面(先选面,再跑工具):
  默认        判 **HEAD 面** —— 先把该面上的 Python 文件物化到临时目录,再在那里跑 mypy
  --staged    判 **索引面** —— 即"这次会被提交进去的那一份内容";邻居在工作树里改的、
              以及未跟踪的在飞文件都不参与,因此不会被算成本仓类型债
  --worktree  判磁盘(仅人工复现用,结论不得作为提交门禁)
  --staged 与 --worktree 同给 ⇒ exit 2(两面互斥,取哪一面都会让另一面成为假绿)

用法:
  node scripts/check-mypy.mjs             全量档(判 HEAD 面)
  node scripts/check-mypy.mjs --staged    提交链档(判索引面,无 ai-service .py 暂存则跳过)
  node scripts/check-mypy.mjs --worktree  人工:在工作树复现旧行为
  node scripts/check-mypy.mjs --help      打印此帮助

退出码:
  0  判定面 0 errors(或 --staged 无 Python 改动 / 本机拿不到 mypy:环境缺失,非代码问题)
  1  判定面确有 mypy 类型错误
  2  无法判定(取材或物化取不到、面上枚举到 0 个可检文件、mypy 以 rc∉{0,1} 退出、两面旗同给)

跳过方式(紧急场景,不推荐):
  HUSKY_SKIP_MYPY=1 git commit ...

执行命令(在**物化出来的判定面**里):
  mypy app --ignore-missing-imports --strict
  (继承该面上的 pyproject.toml [tool.mypy] 配置 + --strict 双保险)

背景:
  项目刚完成 mypy 全库清零(4 批次 256→0 errors,226 source files),
  本守门防止后续 agent 改 Python 代码引入类型错误回退。
  集成位置:guardian-runner.mjs 第 35 项(blocking,pre-commit 一律带 --staged)。
`)
  process.exit(0)
}

// ===========================================================================
// 纯判据(§22c:导出给镜像测试,测试里不得再抄一份)
// ===========================================================================

/**
 * 哪些路径进物化集合。
 * `.py`/`.pyi` **整个 apps/ai-service 子树都取**(不只 app/ 下面):mypy 虽然只检 `app`,
 * 但会顺着 import 走;少物化一个兄弟模块 + `ignore_missing_imports=true` = 静默少检,
 * 那等于给判定面发一张假合格证。`pyproject.toml` 是 mypy 的配置源,必须在面内。
 */
export function isMaterializable(rel) {
  if (!rel.startsWith(AI_PREFIX)) return false
  if (rel === `${AI_PREFIX}pyproject.toml`) return true
  return rel.endsWith('.py') || rel.endsWith('.pyi')
}

/** 面上的 blob 规格前缀:索引面 `:path`、HEAD 面 `HEAD:path`(与守门 105/118 同一条写法)。 */
export function faceSpecPrefix(face) {
  if (face === 'staged') return ':'
  if (face === 'head') return 'HEAD:'
  return null
}

/**
 * mypy 的"实检 N 个源文件" —— 两种版式都要认(纯函数):
 *   Success: no issues found in 571 source files
 *   Found 2 errors in 1 file (checked 571 source files)
 * 只写后一种的旧判据会把成功跑读成 `?`,而"实检数"正是覆盖面自证唯一的那个数 ——
 * 读不到它,那条防线等于没有。
 */
export function checkedCount(text) {
  const s = String(text || '')
  const found = /\(checked (\d+) source files?\)/.exec(s) || /checked (\d+) source files?/.exec(s)
  if (found) return Number(found[1])
  const ok = /no issues found in (\d+) source files?/.exec(s)
  return ok ? Number(ok[1]) : null
}

/**
 * mypy 的退出码分流(纯函数)。
 * 旧版把 rc∉{0} 一律说成"Python 代码有 mypy 类型错误",而 rc=2 是 mypy **自身**(配置错/内部错误)
 * 的退出码 —— 那不是一个类型结论。把工具故障说成代码回归,与 2026-09-12 修掉的"环境缺失伪装成
 * 代码回归"是同一条禁令的另一半。
 */
export function classifyMypyStatus(status, signal) {
  if (signal) return 'killed'
  if (status === null || status === undefined) return 'killed'
  if (status === 0) return 'pass'
  if (status === 1) return 'errors'
  return 'broken'
}

/** 面标签(每一行结论都要带上它,免得读报告的人把某一面当成仓库事实)。 */
export function faceLabelOf(face) {
  if (face === 'staged') return '索引 blob(物化后判定)'
  if (face === 'head') return 'HEAD blob(物化后判定)'
  return '工作树磁盘(人工逃生舱,不得作为提交门禁)'
}

/** 在一个面上枚举可检文件清单(只做路径枚举,内容一律经 catBatch)。 */
export function listFacePaths(root, face) {
  const args =
    face === 'staged'
      ? ['ls-files', '-z', '--', AI_REL]
      : ['ls-tree', '-r', '--name-only', '-z', 'HEAD', '--', AI_REL]
  return gitRaw(args, root, { timeout: GIT_TIMEOUT })
    .split('\0')
    .filter(Boolean)
    .filter(isMaterializable)
}

/**
 * 把一个面物化成临时目录里的 `apps/ai-service/...`,返回 {dir, written, missing, appPyOnFace}。
 * 内容只来自 `catBatch`(取材层),所以"枚举"与"内容"同面同轮 —— 混着取会产出自洽却错位的尺子。
 */
export function materializeFace(root, face, paths) {
  const prefix = faceSpecPrefix(face)
  if (!prefix) throw new Undetermined(`面 ${face} 不经物化通道(worktree 走磁盘)`)
  const map = catBatch(root, paths.map((p) => `${prefix}${p}`), {
    timeout: BATCH_TIMEOUT,
    maxBuffer: 1 << 29,
  })
  const dir = mkScratch(`check-mypy-${face}-`)
  const missing = []
  let appPyOnFace = 0
  try {
    for (const rel of paths) {
      const text = map.get(`${prefix}${rel}`)
      if (typeof text !== 'string') {
        missing.push(rel)
        continue
      }
      if (rel.startsWith(`${AI_PREFIX}app/`) && rel.endsWith('.py')) appPyOnFace += 1
      const abs = join(dir, ...rel.split('/'))
      mkdirSync(dirname(abs), { recursive: true })
      writeFileSync(abs, text, 'utf8')
    }
  } catch (e) {
    rmScratch(dir)
    throw e
  }
  return { dir, written: paths.length - missing.length, missing, appPyOnFace }
}

/**
 * "机器现场遮蔽判定面"的检测:未跟踪的**包**目录与面上已跟踪的**同名模块**并存时,
 * 在工作树里跑的 mypy 会把 import 解到那份未跟踪包上(本仓 2026-09-29 现读到的形态),
 * 报出来的错误不属于任何一面被审内容。本门判的是面,所以这里**只点名不判红** ——
 * 让下一个人看见"为什么我手跑红、门绿",而不是替他裁那批未跟踪文件该不该留(§12)。
 */
export function findShadowedModules(root, facePaths, face) {
  const refSet = new Set(
    face === 'worktree'
      ? gitRaw(['ls-files', '-z', '--', AI_REL], root, { timeout: GIT_TIMEOUT })
          .split('\0')
          .filter(Boolean)
      : facePaths,
  )
  const others = gitRaw(
    ['ls-files', '--others', '--exclude-standard', '-z', '--', AI_REL],
    root,
    { timeout: GIT_TIMEOUT },
  )
    .split('\0')
    .filter(Boolean)
  const shadowed = []
  let untrackedPy = 0
  for (const p of others) {
    if (p.endsWith('.py')) untrackedPy += 1
    if (!p.endsWith('/__init__.py')) continue
    const modulePath = `${p.slice(0, -'/__init__.py'.length)}.py`
    if (refSet.has(modulePath)) shadowed.push({ pkg: p, module: modulePath })
  }
  return { shadowed, untrackedPy }
}

/**
 * mypy 二进制解析。绝对路径(仓内 venv)走 shell:false —— 带空格的路径进 shell 会被拆;
 * 裸名 `mypy`(走 PATH,Windows 上常是 .cmd shim)必须走 shell:true,否则派生直接失败。
 */
export function resolveMypy(root) {
  const aiDir = join(root, 'apps', 'ai-service')
  const candidates = [
    join(aiDir, '.venv', 'Scripts', 'mypy.exe'), // Windows venv
    join(aiDir, '.venv', 'bin', 'mypy'), // Unix/macOS venv
  ]
  const venv = candidates.find((p) => existsSync(p))
  return { candidates, executable: venv || 'mypy' }
}

function spawnMypy(exe, args, cwd, timeout) {
  return spawnSync(exe, args, {
    cwd,
    encoding: 'utf8',
    shell: !isAbsolute(exe),
    windowsHide: true, // AGENTS §5b:缺它必弹可见 cmd 窗口
    timeout,
    maxBuffer: 32 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}


// ===========================================================================
// 主流程
// ===========================================================================

function printMypyOutput(text) {
  const combined = String(text || '').trim()
  if (!combined) return
  console.log(`${C.dim}--- mypy 输出 ---${C.reset}`)
  const lines = combined.split('\n')
  if (lines.length > 150) {
    console.log(`${C.dim}(输出超长,仅显示最后 100 行,共 ${lines.length} 行)${C.reset}`)
    console.log(lines.slice(-100).join('\n'))
  } else {
    console.log(combined)
  }
  console.log(`${C.dim}--- end ---${C.reset}`)
}

function main() {
  // === HUSKY_SKIP_MYPY 跳过(紧急场景) ===
  if (process.env.HUSKY_SKIP_MYPY === '1') {
    console.log(`${C.yellow}⚠️  mypy 守门已跳过(HUSKY_SKIP_MYPY=1,紧急场景,不推荐)${C.reset}`)
    return 0
  }

  const { face, error } = selectFace({
    staged: argv.includes('--staged'),
    worktree: argv.includes('--worktree'),
    def: 'head',
  })
  if (error) {
    console.log(`${C.red}${C.bold}❌ mypy 守门无法判定(exit 2):${error}${C.reset}`)
    return 2
  }

  // === --staged 档:先判"这次提交够不够得着本门",够不着就跳过 ===
  let pyChanges = []
  if (face === 'staged') {
    let listed
    try {
      listed = gitRaw(
        ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z', '--', AI_REL],
        ROOT,
        { timeout: GIT_TIMEOUT },
      )
    } catch (e) {
      // 旧写法在这里 catch 后按"无改动"跳过 —— 那是把"没看见"写成"判过了"。
      // 取不到暂存清单就是没有结论:exit 2 并给出路,既不冒红也不记绿。
      console.log(
        `${C.red}${C.bold}❌ mypy 守门无法判定(exit 2):取不到索引面的改动清单(${e?.message ?? e})${C.reset}`,
      )
      console.log(`${C.dim}   出路:确认在 git 仓库内跑;或应急 HUSKY_SKIP_MYPY=1 git commit ...${C.reset}`)
      return 2
    }
    pyChanges = listed.split('\0').filter(Boolean).filter((f) => f.endsWith('.py'))
    if (pyChanges.length === 0) {
      console.log(`${C.dim}⏭  mypy 类型检查守门(无 apps/ai-service/**/*.py staged 改动, 跳过)${C.reset}`)
      return 0
    }
    console.log(
      `${C.cyan}${C.bold}[mypy 守门] staged 检测到 ${pyChanges.length} 个 Python 文件改动,触发 mypy 检查:${C.reset}`,
    )
    for (const f of pyChanges.slice(0, 10)) console.log(`${C.dim}  - ${f}${C.reset}`)
    if (pyChanges.length > 10) {
      console.log(`${C.dim}  ... 及其他 ${pyChanges.length - 10} 个文件${C.reset}`)
    }
    console.log('')
  }

  console.log(
    `${C.cyan}${C.bold}[mypy 守门] 判定面=${faceLabelOf(face)};命令 mypy app --ignore-missing-imports --strict${C.reset}`,
  )

  // === 解释器探测(机器态:拿不到 mypy ⇒ 不是代码问题,放行但明说) ===
  const { candidates, executable: mypyExecutable } = resolveMypy(ROOT)
  const probe = spawnMypy(mypyExecutable, ['--version'], ROOT, 60000)
  if (probe.error || probe.status !== 0) {
    console.log(
      `${C.yellow}${C.bold}⚠️  mypy 守门跳过:本机未安装 mypy(环境缺失,非代码问题)${C.reset}`,
    )
    console.log(`${C.dim}   探测命令: ${mypyExecutable} --version → ${probe.error ? probe.error.code || probe.error.message : `rc=${probe.status}`}${C.reset}`)
    console.log(`${C.dim}   已尝试候选:${C.reset}`)
    for (const p of candidates) console.log(`${C.dim}     - ${p}${C.reset}`)
    console.log(`${C.dim}     - mypy(本机 PATH)${C.reset}`)
    console.log(`${C.dim}   启用方式: cd apps/ai-service && uv sync${C.reset}`)
    console.log(`${C.dim}   注:本次放行**不代表**类型检查通过,只是本机无工具可跑。${C.reset}`)
    return 0
  }

  const startTime = Date.now()
  let materialized = null
  try {
    assertRepoRoot(ROOT, 'mypy 守门')
    // === 取判定面:先物化再跑(mypy 只看得见磁盘,所以"判被审面"= 把面物化到临时目录) ===
    let runDir
    if (face === 'worktree') {
      runDir = join(ROOT, 'apps', 'ai-service')
      const { shadowed, untrackedPy } = findShadowedModules(ROOT, [], 'worktree')
      printShadowNotice(shadowed, untrackedPy, face)
    } else {
      const paths = listFacePaths(ROOT, face)
      if (paths.length === 0) {
        // 枚举到 0 个可检文件 = 尺子失效,不是"仓里没有错误"
        console.log(
          `${C.red}${C.bold}❌ mypy 守门无法判定(exit 2):${face} 面在 ${AI_REL}/ 下枚举到 0 个 Python/pyproject 文件 —— 判据失效不出具合格证${C.reset}`,
        )
        return 2
      }
      materialized = materializeFace(ROOT, face, paths)
      if (materialized.missing.length > 0) {
        console.log(
          `${C.red}${C.bold}❌ mypy 守门无法判定(exit 2):${face} 面有 ${materialized.missing.length} 个文件取不到内容,判定面不完整,不判红也不记绿${C.reset}`,
        )
        for (const p of materialized.missing.slice(0, 10)) console.log(`${C.dim}   - ${p}${C.reset}`)
        return 2
      }
      runDir = join(materialized.dir, 'apps', 'ai-service')
      console.log(
        `${C.dim}   物化 ${materialized.written} 个文件到临时判定面(app/ 下 .py = ${materialized.appPyOnFace}),面内不含任何未跟踪/在飞文件${C.reset}`,
      )
      const { shadowed, untrackedPy } = findShadowedModules(ROOT, paths, face)
      printShadowNotice(shadowed, untrackedPy, face)
    }

    const r = spawnMypy(mypyExecutable, ['app', '--ignore-missing-imports', '--strict'], runDir, MYPY_TIMEOUT)
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    const combined = `${r.stdout || ''}\n${r.stderr || ''}`.trim()
    const kind = classifyMypyStatus(r.status, r.signal)
    const checked = checkedCount(combined)

    if (kind === 'pass') {
      if (combined) console.log(`${C.dim}${combined}${C.reset}`)
      // 覆盖面自证:mypy 实检数 vs 面上的 app/**/*.py 数。
      // 刻意**不因不等而改退出码** —— pyproject 的 exclude(tests/ 等)会让两侧合法不等,
      // 拿它判红就是一台与任何提交都无关的恒红门(§12e);但"少检"必须看得见。
      if (face !== 'worktree' && checked === 0) {
        console.log(
          `${C.red}${C.bold}❌ mypy 守门无法判定(exit 2):Success 但实检 0 个源文件 —— 空扫不得当合格证${C.reset}`,
        )
        return 2
      }
      console.log(`${C.green}${C.bold}✅ mypy 守门通过(0 errors, ${elapsed}s)${C.reset}`)
      console.log(`${C.dim}   判定面=${faceLabelOf(face)},mypy 实检 ${checked ?? '?'} 个源文件${C.reset}`)
      if (face !== 'worktree' && checked !== null && checked !== (materialized?.appPyOnFace ?? checked)) {
        console.log(
          `${C.yellow}   ⚠️ 覆盖面不闭合:mypy 实检 ${checked} vs 面内 app/**/*.py ${materialized?.appPyOnFace} —— 差额通常是 pyproject 的 exclude 命中,请人工确认不是漏物化${C.reset}`,
        )
      }
      return 0
    }

    console.log('')
    if (kind === 'errors') {
      console.log(`${C.red}${C.bold}❌ mypy 守门失败(${elapsed}s)${C.reset}`)
    } else if (kind === 'broken') {
      console.log(
        `${C.red}${C.bold}❌ mypy 守门无法判定(exit 2):mypy 以 rc=${r.status} 退出 —— 工具自身故障/配置错误,不构成类型结论${C.reset}`,
      )
    } else {
      console.log(
        `${C.red}${C.bold}❌ mypy 守门无法判定(exit 2):mypy 被 ${r.signal || `rc=${r.status}`} 终止 —— 没有结论,不判红也不记绿${C.reset}`,
      )
    }
    printMypyOutput(combined)
    console.log('')
    console.log(`${C.bold}修复方法:${C.reset}`)
    console.log(
      `  1. 复现本门的判定面(邻居在飞文件不参与): ${C.cyan}node scripts/check-mypy.mjs${face === 'staged' ? ' --staged' : ''}${C.reset}`,
    )
    console.log(`     要复现"工作树里手跑"的旧行为(仅人工诊断): ${C.cyan}node scripts/check-mypy.mjs --worktree${C.reset}`)
    console.log(`  2. 根据 mypy 输出修复类型错误(常见:缺类型注解 / Optional / Union / return type)`)
    console.log(`  3. 详细 mypy 配置见 apps/ai-service/pyproject.toml [tool.mypy](本门不修改它,也不放宽 --strict)`)
    console.log('')
    console.log(`${C.dim}紧急跳过(不推荐): HUSKY_SKIP_MYPY=1 git commit ...${C.reset}`)
    console.log(`${C.dim}背景: 项目刚完成 mypy 全库清零(4 批次 256→0 errors, 226 files),本守门防止回退${C.reset}`)
    return kind === 'errors' ? 1 : 2
  } catch (e) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    const isUndetermined = e instanceof Undetermined
    console.log(
      `${C.red}${C.bold}❌ mypy 守门无法判定(exit 2,${elapsed}s):${isUndetermined ? e.message : (e?.message ?? String(e))}${C.reset}`,
    )
    if (!isUndetermined) console.log(`${C.dim}${e?.stack ?? ''}${C.reset}`)
    console.log(`${C.dim}   "判不出"不是"通过",也不是"仓库有类型债" —— 先修取材链路,或应急 HUSKY_SKIP_MYPY=1。${C.reset}`)
    return 2
  } finally {
    if (materialized?.dir) rmScratch(materialized.dir)
  }
}

function printShadowNotice(shadowed, untrackedPy, face) {
  if (face === 'worktree') {
    if (!shadowed.length && !untrackedPy) return
    console.log(
      `${C.yellow}   ⚠️ 本档判的是磁盘:工作树里有 ${shadowed.length} 处"未跟踪包遮蔽已跟踪模块"、${untrackedPy} 个未跟踪 .py —— 它们的错误会被算进这次结论,但该形态不属于任何一面被审内容。${C.reset}`,
    )
    for (const s of shadowed.slice(0, 10)) {
      console.log(`${C.dim}     - ${s.pkg} 遮蔽 ${s.module}${C.reset}`)
    }
    return
  }
  if (!shadowed.length && !untrackedPy) return
  console.log(
    `${C.yellow}   ⚠️ 机器现场与判定面不同形(以下未跟踪内容**不参与**本次判定,故手跑 mypy 可能与本门结论不一致):${C.reset}`,
  )
  for (const s of shadowed.slice(0, 10)) {
    console.log(
      `${C.dim}     - 未跟踪包 ${s.pkg} 遮蔽已跟踪模块 ${s.module}(工作树跑 mypy 会把 import 解到那一份包上)${C.reset}`,
    )
  }
  if (shadowed.length > 10) console.log(`${C.dim}     ... 另 ${shadowed.length - 10} 处${C.reset}`)
  console.log(
    `${C.dim}     - 工作树另有 ${untrackedPy} 个未跟踪 .py;这些路径由各自的在飞会话处置(本门只点名、不代裁,AGENTS §12)${C.reset}`,
  )
}

// §22d:被 import 时不得触发 CLI 副作用(镜像测试要 import 上面的判据函数)
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  process.exit(main())
}

export const __test__ = {
  ROOT,
  AI_REL,
  isMaterializable,
  faceSpecPrefix,
  listFacePaths,
  materializeFace,
  findShadowedModules,
  classifyMypyStatus,
  checkedCount,
  faceLabelOf,
  resolveMypy,
  spawnMypy,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
