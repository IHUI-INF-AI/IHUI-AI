#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * check-test-paths.mjs — 测试目录与误忽略路径守门(AGENTS.md §23 配套)
 *
 * 背景(2026-07-25 立,真实事故):
 *   .gitignore 第 154 行 `__*` 规则会静默忽略所有以 `__` 开头的路径,
 *   包括合法的 `__tests__/` 目录。阶段 13 集成测试 subagent
 *   在 `apps/web/__tests__/storage-adapter.test.ts` 写了测试文件,
 *   `git status` 完全不显示(untracked 都被忽略),险些导致整个 stage 13
 *   测试丢失,直到最后 `git check-ignore -v` 才被发现。
 *
 * 检查项:
 *   1. **__tests__/ 目录(主项)**:扫描项目内所有 `__tests__/` 目录
 *      - 含 `.gitkeep` → 通过(明确"目录内全部文件被故意 ignore")
 *      - 不含 `.gitkeep` → 阻断 + 建议改用 `tests/`(避开 `__*` 规则)
 *   2. **临时/备份目录**:`*.tmp` / `*.bak` 结尾的目录(常见误忽略源)
 *   3. **隐藏目录白名单**:`.vscode` / `.idea` / `.git` 等合法隐藏目录
 *      之外的纯 `.xxx` 目录(可能是误忽略)
 *   4. **git check-ignore 复核**:对发现的每个 `__tests__/` 目录调
 *      `git check-ignore -v`,确认是否被 `__*` 规则命中
 *
 * 判定面(2026-09-27 立,G-268 同型 —— 与守门 44 的归属面 / 同门 49 的 B10 同一套口径,不另立第三套规矩):
 *   本门三条发现全部来自**磁盘递归**(readdirSync),所以它天生判的是"共享工作树"这一面。
 *   而提交链是带 pathspec 的:safe-commit 只声明我这枚提交的文件,别人在飞的文件既进不了本次内容、
 *   又照样躺在盘上被本门扫到 ⇒ 基线面(HEAD 隔离检出,**物理上没有未跟踪文件**)绿、我的面红
 *   ⇒ 归因层按差分正确地喊"这枚提交把跑绿的东西改红了" —— 那个结论是错的,而唯一"修法"是去删
 *   别人的目录(§12 明令的事故)。实测代价与守门 44 同一批:92 分钟内 12 次拒跳门。
 *   立项实测(2026-09-27;夹具已固化进 scripts/tests/check-test-paths.test.mjs 的 F 型):
 *     apps/web/__tests__/ 被 `__*` 吞、无 .gitkeep、索引与 HEAD 零在册
 *     ⇒ 全量档 exit 1(本应如此)/ 旧 `--staged` 同样 exit 1(错:本枚提交根本没带它)。
 *   现在 `--staged` 按**归属**分流,严重度只跟着"在册"走:
 *     · 在册(该目录自身或其下有任何条目出现在**索引或 HEAD**)⇒ 严重度一字不改(BLOCK 仍 exit 1);
 *     · 只在盘上、两处都不在册 ⇒ **照逐条点名、照留 git rule 证据,但记为「未判定 N 处」并退成 exit 2**:
 *       它不对本枚提交下结论 ⇒ 归因层不得据差分定责(commit-gate-attribution 态①b);
 *       它仍非零 ⇒ runner 对 blocking 门按"非 0 即失败"处理,§28"跑绿才算完成"照样拦得住 ——
 *       失效方向永远是"多要一次定向说明",绝不是"多放一条检测"。
 *     · 归属面问不到(非 git 仓 / 无 HEAD / git 派生失败)⇒ **fail-tight**:全部按在册处理,
 *       等于修复前的行为,并显式写明"归属取证失败 ⇒ 不降档"。绝不把"取不到清单"读成"都是别人的"。
 *   全量档(不带 --staged)输出与退出码**逐字不变**(真仓实测 sha1 见提交说明)—— 那就是给人和
 *   CI 的问责面;要让"未判定"也判红,请跑全量档,本门刻意不加第四种旗。
 *
 * 退出码:
 *   0 — 通过(无阻断;`--staged` 档另有未判定档时不给 0)
 *   1 — 阻断(存在误忽略风险,需修复)
 *   2 — 无法判定(仅 `--staged` 档:确有发现,但没有一条落在本枚提交的面里)
 *
 * 用法:
 *   node scripts/check-test-paths.mjs
 *   node scripts/check-test-paths.mjs --strict
 *   node scripts/check-test-paths.mjs --staged        # 提交链档:按归属分流
 *   node scripts/check-test-paths.mjs --root <dir>    # 仅镜像测试通道(临时 git 仓夹具)
 *
 * 集成位置: CI / guardian-runner / pre-commit 后续项
 * 历史案例: 见 .ihui-agent/archive/AGENTS_history.md
 */
import { existsSync, readdirSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { isExcludedDirName } from './lib/exclude-dirs.mjs'
import { assertRepoRoot, gitRaw } from './lib/face-reader.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))

/**
 * 仓库根。生产路径 = 本文件上一级(§15:**不得**按 process.cwd() 推导 —— 从子目录调用本门时,
 * cwd 面既扫不到 apps/packages/scripts 也扫不到任何东西,那是"把没判写成判过了")。
 * `--root <dir>` 是**镜像测试通道**,让测试能在临时 git 仓上跑端到端:加它的原因不是便利,
 * 而是"守门 70 的镜像测试恒红"那一型 —— 脚本按定义忽略 cwd 时,靠 cwd 定位夹具的测试其实
 * 全在审真仓,账面绿而结论与夹具无关。
 */
function resolveRoot(argv) {
  const i = argv.indexOf('--root')
  if (i >= 0) {
    const p = argv[i + 1]
    if (!p || p.startsWith('--')) throw new Error('--root 需要一个目录参数')
    return resolve(p)
  }
  return resolve(HERE, '..')
}

const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
}

const ARGS = process.argv.slice(2)
// 扫描根(仓库根;本门只扫下面三个源码区)
const ROOT = resolveRoot(ARGS)
const isStrict = ARGS.includes('--strict')
const isStaged = ARGS.includes('--staged')
/** git 派生超时:归属面/ignore 探查都只是"问一次",取不到一律显式落未判定,绝不静默 */
const GIT_TIMEOUT_MS = Number(process.env.IHUI_B85_GIT_TIMEOUT_MS) || 30000

// 只扫描源码区,跳过产物/依赖/审计
const SCAN_ROOTS = ['apps', 'packages', 'scripts']
// 排除目录(产物/依赖/审计/版本控制)
const EXCLUDE_DIRS = new Set([
  'node_modules',
  '.next',
  '.turbo',
  '.output',
  'dist',
  'build',
  'coverage',
  '.ihui-agent',
  '.git',
  '.swc',
  '.cache',
  '.pnpm-store',
  '.husky',
  'storybook-static',
  '.vercel',
  '.nitro',
  '.angular',
])
// 合法隐藏目录白名单
const ALLOWED_DOT_DIRS = new Set([
  '.vscode',
  '.idea',
  '.git',
  '.github',
  '.husky',
  '.changeset',
  '.vs',
  '.devcontainer',
  '.editorconfig',
  '.gitattributes',
  '.npmrc',
  '.nvmrc',
  '.node-version',
  '.env',
  '.env.example',
  '.env.local',
])

function header(label) {
  return `\n${C.cyan}${C.bold}── ${label} ──${C.reset}`
}

/**
 * 逐条发现的状态标记。owner==='foreign' 只在 `--staged` 档可能出现,全量档恒为 owned
 * ⇒ 打印形状与修复前逐字相同(这是"全量档是问责面"的形式保证)。
 */
function markOf(level, owner) {
  if (isStaged && owner === 'foreign') return `${C.yellow}[未判定·不计本枚提交]${C.reset}`
  return level === 'block' ? `${C.red}[BLOCK]${C.reset}` : `${C.dim}[WARN]${C.reset}`
}

/**
 * 递归扫描目录,返回指定 basename 的目录绝对路径列表
 */
function findDirsByName(root, basename) {
  const results = []
  const stack = [root]
  while (stack.length > 0) {
    const dir = stack.pop()
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const name = entry.name
      if (EXCLUDE_DIRS.has(name) || isExcludedDirName(name)) continue
      const full = join(dir, name)
      if (name === basename) {
        results.push(full)
        // __tests__/ 子目录不再下钻(避免重复扫内部 fixtures 里的 __tests__)
        continue
      }
      // 跳过明显 . 开头隐藏目录
      if (name.startsWith('.') && !ALLOWED_DOT_DIRS.has(name)) continue
      stack.push(full)
    }
  }
  return results
}

/**
 * 扫描所有以 .tmp / .bak 结尾的目录
 */
function findTempDirs(root) {
  const results = []
  const stack = [root]
  while (stack.length > 0) {
    const dir = stack.pop()
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const name = entry.name
      if (EXCLUDE_DIRS.has(name) || isExcludedDirName(name)) continue
      if (/\.(tmp|bak)$/i.test(name)) {
        results.push(join(dir, name))
        continue
      }
      if (name.startsWith('.') && !ALLOWED_DOT_DIRS.has(name)) continue
      stack.push(join(dir, name))
    }
  }
  return results
}

/**
 * 扫描不在白名单中的隐藏目录(可能是误忽略源)
 */
function findUnknownDotDirs(root) {
  const results = []
  const stack = [root]
  while (stack.length > 0) {
    const dir = stack.pop()
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const name = entry.name
      if (EXCLUDE_DIRS.has(name) || isExcludedDirName(name)) continue
      if (name.startsWith('.') && !ALLOWED_DOT_DIRS.has(name)) {
        results.push(join(dir, name))
        continue
      }
      stack.push(join(dir, name))
    }
  }
  return results
}

/**
 * 检查目录内是否有 .gitkeep 文件
 */
function hasGitkeep(dir) {
  return existsSync(join(dir, '.gitkeep'))
}

/**
 * 解析 `git check-ignore -v <path>` 的输出 ⇒ { ignored, rule }。
 *
 * 输出形态:`<来源>:<行号>:<模式>\t<路径>`。⚠️ 带 -v 时 git 对**否定规则**(`!pattern`)
 * 同样打印命中行,所以"输出非空 = 被忽略"是错的:实测 .gitignore 第 245 行那条以 `!` 开头的
 * 反忽略规则会把 apps/web/src/components/billing/__tests__/ 判成 BLOCK(假阳性,会卡死无关提交)。
 * 反忽略的 `apps/web/src/components/billing/__tests__/` 判成 BLOCK(假阳性,会卡死无关提交)。
 * 判据只能是"命中的模式本身不以 `!` 开头"。来源路径在 Windows 下含盘符冒号,故按**最后一个**
 * 冒号段取模式,不按固定下标。
 */
export function parseCheckIgnoreLine(line) {
  if (!line || !line.trim()) return { ignored: false, rule: '' }
  const head = line.split('\t')[0]
  const pattern = head.split(':').pop() ?? ''
  return { ignored: !pattern.startsWith('!'), rule: head.trim() }
}

/**
 * git check-ignore -v 复核单个路径(目录或文件)。
 * exit 1 = 无任何规则命中 ⇒ 不被忽略;exit 0 = 命中某条规则 ⇒ 再看是否否定。
 *
 * 走 face-reader 的 gitRaw(绝对 git 二进制 + windowsHide + 数字 timeout + 显式 stdio),
 * 不再自己散写裸 'git':裸名在 GUI 宿主/服务账户的 PATH 里可能取不到(§5b),而这里一旦
 * 取不到就走下面的 git-error 分支 ⇒ "不被忽略" ⇒ 该目录静默放过。共用层把"派生失败"与
 * "git 说没有"用 e.status 分开后,这一族误判只剩一条路。
 */
function probeIgnore(absPath, { asDir = true } = {}) {
  const rel = relative(ROOT, absPath).split(sep).join('/')
  // 目录探查要带尾斜杠(否则 git 按文件模式匹配,结论相反);文件探查**不得**带
  const target = asDir ? (rel.endsWith('/') ? rel : `${rel}/`) : rel
  let out = ''
  try {
    out = gitRaw(['check-ignore', '-v', '--', target], ROOT, { timeout: GIT_TIMEOUT_MS })
  } catch (e) {
    if (e && e.status === 1) return { ignored: false, rule: '' }
    // status 128(不在 git 环境)/ 超时 / 其他异常:宁可不判红,由"不被忽略"分支放过并如实报
    // ⚠️ 这是本门**既有**的失效方向(不在本次修复范围内,已如实登记):git-error 文本只在
    //    BLOCK 分支打印,走"未命中"分支时它不会被显示 —— 要收这一格得改全量档输出,那属另一票。
    return { ignored: false, rule: `git-error:${e?.status ?? e?.message ?? 'unknown'}` }
  }
  return parseCheckIgnoreLine(out.split('\n').find((l) => l.trim()))
}

/** 目录内前若干个文件(用于"目录未命中但文件被吞"的第二层复核) */
function sampleFilesIn(dir, limit = 5) {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isFile())
      .slice(0, limit)
      .map((d) => join(dir, d.name))
  } catch {
    return []
  }
}

function toRel(absPath) {
  return relative(ROOT, absPath)
}

/** 路径归一:反斜杠→正斜杠、去首尾空白与尾部斜杠(发现项是目录,在册项是文件) */
export function normRelPath(p) {
  return String(p ?? '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/\/+$/, '')
}

/** `git ls-files -z` / `ls-tree -z` 的 NUL 分隔输出 ⇒ 路径数组(纯函数,可构造面证明) */
export function splitNulPaths(out) {
  return String(out ?? '')
    .split('\0')
    .filter((s) => s.trim())
    .map((s) => normRelPath(s))
    .filter(Boolean)
}

/**
 * "这一路径在不在册":`entries` 里存在该路径本身,或存在以 `路径/` 开头的条目(目录自身从不
 * 进索引,靠子项判定)。数组或 Set 都收(测试构造面用数组更省事)。
 */
export function isOnRecord(relPath, entries) {
  const p = normRelPath(relPath)
  if (!p || !entries) return false
  const prefix = `${p}/`
  for (const e of entries) {
    const n = normRelPath(e)
    if (n === p || n.startsWith(prefix)) return true
  }
  return false
}

/**
 * 归属面(仅 `--staged` 档用):索引 + HEAD 的**在册文件清单**。
 * 只枚举路径、不取任何 blob 正文(所以不走 catBatch —— 守门 118 对"只枚举"不发违规)。
 * 任一侧取不到 ⇒ 该侧留 null,由 ownershipOf() 走 fail-tight(绝不把"取不到清单"读成"都是别人的")。
 */
function readOwnershipFace() {
  const face = { index: null, head: null, why: [] }
  try {
    assertRepoRoot(ROOT, '测试目录守门 --staged 的 ROOT')
  } catch (e) {
    face.why.push(`仓库根对不上:${e?.message ?? e}`)
    return face
  }
  try {
    face.index = new Set(
      splitNulPaths(gitRaw(['ls-files', '-z'], ROOT, { timeout: GIT_TIMEOUT_MS })),
    )
  } catch (e) {
    face.why.push(`索引面取不到:${e?.message ?? e}`)
  }
  try {
    face.head = new Set(
      splitNulPaths(
        gitRaw(['ls-tree', '-r', '--name-only', '-z', 'HEAD'], ROOT, { timeout: GIT_TIMEOUT_MS }),
      ),
    )
  } catch (e) {
    face.why.push(`HEAD 面取不到:${e?.message ?? e}`)
  }
  return face
}

/**
 * 一条发现的归属。'owned' = 在本枚提交面上(索引或 HEAD 在册)⇒ 严重度不变;
 * 'foreign' = 只在盘上、两处都不在册 ⇒ 记「未判定」,不为本枚提交判红。
 * fail-tight:任一侧清单取不到 ⇒ 一律 owned(与修复前完全一致,不放宽任何检测)。
 */
export function ownershipOf(relPath, face) {
  if (!face) return 'owned'
  if (!face.index) return 'owned'
  if (isOnRecord(relPath, face.index)) return 'owned'
  if (!face.head) return 'owned'
  return isOnRecord(relPath, face.head) ? 'owned' : 'foreign'
}

/**
 * `--staged` 档退出码(纯函数,正例/反例都在镜像测试里构造):
 *   自己的红永远优先于"未判定"(失效方向只能是多要一次说明,不是少要一次);
 *   只剩未判定 ⇒ exit 2:非零(runner/§28 照样拦),但不对本枚提交下结论。
 * 全量档不走这一支(它的退出码逐字不变)。
 */
export function decideStagedExit({
  ownedBlock = 0,
  ownedWarn = 0,
  foreignBlock = 0,
  foreignWarn = 0,
  strict = false,
} = {}) {
  if (ownedBlock > 0) return 1
  if (strict && ownedWarn > 0) return 1
  if (foreignBlock > 0) return 2
  if (strict && foreignWarn > 0) return 2
  return 0
}

async function main() {
  console.log(`${C.cyan}${C.bold}🧪 测试目录与误忽略路径守门(AGENTS.md §23 配套)${C.reset}`)
  console.log(`${C.dim}扫描根: ${ROOT}${C.reset}`)
  console.log(`${C.dim}扫描范围: ${SCAN_ROOTS.join(', ')}${C.reset}`)

  // `--staged` 档先取**归属面**(索引 + HEAD 在册清单),后续每条发现按它定严重度。
  // 全量档 face=null ⇒ ownershipOf() 恒返回 'owned' ⇒ 输出与退出码逐字不变。
  const face = isStaged ? readOwnershipFace() : null
  if (isStaged) {
    const n = (s) => (s ? `${s.size} 条在册` : '**取不到**')
    console.log(`${C.dim}判定面: 归属分流(索引 ${n(face.index)} / HEAD ${n(face.head)})${C.reset}`)
    if (face.why.length)
      console.log(
        `${C.yellow}⚠ 归属面取证失败(${face.why.join(' ; ')})⇒ fail-tight:所有发现一律按本枚提交在册处理,` +
          `不降档、不记未判定(与修复前行为一致)${C.reset}`,
      )
    else
      console.log(
        `${C.dim}规则: 目录自身或其下有条目出现在索引或 HEAD ⇒ 严重度不变;只在盘上未跟踪 ⇒ 点名 + 记「未判定」+ exit 2${C.reset}`,
      )
  }

  const issues = []
  let totalScanned = 0

  // ── 1. __tests__/ 目录检测(主项) ──
  console.log(header('1. __tests__/ 目录检测(主项)'))
  const testsDirs = []
  for (const r of SCAN_ROOTS) {
    const abs = join(ROOT, r)
    if (!existsSync(abs)) continue
    testsDirs.push(...findDirsByName(abs, '__tests__'))
  }
  totalScanned += testsDirs.length

  if (testsDirs.length === 0) {
    console.log(`  ${C.green}✅ 未发现 __tests__/ 目录${C.reset}`)
  } else {
    console.log(`  发现 ${C.bold}${testsDirs.length}${C.reset} 个 __tests__/ 目录,逐个核对…`)
    for (const dir of testsDirs) {
      const rel = toRel(dir)
      const gitkeep = hasGitkeep(dir)
      // 两层探查:目录本身 + 目录内实文件。只查目录会漏"目录未命中、里面的 .test.ts 被吞"
      // (`**/__tests__/*.ts` 这类规则);只查非否定又会把反忽略判成红(见 parseCheckIgnoreLine)。
      const dirProbe = probeIgnore(dir, { asDir: true })
      const fileProbes = sampleFilesIn(dir).map((f) => ({ f, ...probeIgnore(f, { asDir: false }) }))
      const hitFile = fileProbes.find((p) => p.ignored)
      const isIgnored = dirProbe.ignored || Boolean(hitFile)
      const ruleText = dirProbe.ignored ? dirProbe.rule : (hitFile?.rule ?? '')
      if (isIgnored && !gitkeep) {
        // 命中 ignore 规则且无 .gitkeep → 阻断(严重度跟着归属走:在册=本枚的红 / 只在盘上=未判定)
        const owner = ownershipOf(rel, face)
        issues.push({
          level: 'block',
          owner,
          path: rel,
          reason:
            `__tests__/ 被 .gitignore 忽略(${ruleText || 'ignore 规则'}),且无 .gitkeep 标记,` +
            (hitFile ? `其中 ${toRel(hitFile.f)} 不会被 git 跟踪` : '测试文件不会被 git 跟踪'),
          fix: '方案 A(推荐):将目录重命名为 tests/; 方案 B:在目录内放 .gitkeep 并接受所有子文件需用 `!` 反忽略',
        })
        console.log(`  ${C.red}✗${C.reset} ${C.bold}${rel}${C.reset}  ${markOf('block', owner)}`)
        console.log(`     ${C.dim}git rule: ${ruleText}${C.reset}`)
        console.log(`     ${C.dim}.gitkeep: ${gitkeep ? '有' : '无'}${C.reset}`)
        if (owner === 'foreign')
          console.log(
            `     ${C.dim}归属: 索引与 HEAD 均无该目录下条目 ⇒ 属并行会话的在飞文件,本枚提交结构上带不进它${C.reset}`,
          )
      } else if (isIgnored && gitkeep) {
        console.log(
          `  ${C.green}✓${C.reset} ${rel}  ${C.dim}(已被 ignore + 含 .gitkeep,显式标记) ${C.reset}`,
        )
      } else {
        // 不被 ignore(含"只被 `!` 反忽略命中")→ 通过
        console.log(`  ${C.green}✓${C.reset} ${rel}  ${C.dim}(未命中 ignore 规则)${C.reset}`)
      }
    }
  }

  // ── 2. 临时/备份目录 ──
  console.log(header('2. 临时/备份目录检测(*.tmp / *.bak)'))
  const tempDirs = []
  for (const r of SCAN_ROOTS) {
    const abs = join(ROOT, r)
    if (!existsSync(abs)) continue
    tempDirs.push(...findTempDirs(abs))
  }
  totalScanned += tempDirs.length

  if (tempDirs.length === 0) {
    console.log(`  ${C.green}✅ 未发现 *.tmp / *.bak 目录${C.reset}`)
  } else {
    for (const dir of tempDirs) {
      const rel = toRel(dir)
      const owner = ownershipOf(rel, face)
      issues.push({
        level: 'warn',
        owner,
        path: rel,
        reason: '存在 *.tmp / *.bak 目录,可能残留构建副本或临时产物',
        fix: '确认是否需要保留;若不需要,删除即可',
      })
      console.log(`  ${C.yellow}⚠${C.reset} ${rel}  ${markOf('warn', owner)}`)
    }
  }

  // ── 3. 未知隐藏目录(白名单外) ──
  console.log(header('3. 隐藏目录白名单检测(非白名单 .xxx 目录)'))
  const dotDirs = []
  for (const r of SCAN_ROOTS) {
    const abs = join(ROOT, r)
    if (!existsSync(abs)) continue
    dotDirs.push(...findUnknownDotDirs(abs))
  }
  totalScanned += dotDirs.length

  if (dotDirs.length === 0) {
    console.log(`  ${C.green}✅ 未发现白名单外隐藏目录${C.reset}`)
  } else {
    for (const dir of dotDirs) {
      const rel = toRel(dir)
      const owner = ownershipOf(rel, face)
      // 仅 warn,不断(blocking 太严)
      issues.push({
        level: 'warn',
        owner,
        path: rel,
        reason: '非白名单隐藏目录,确认是否被 .gitignore 误忽略',
        fix: '在 ALLOWED_DOT_DIRS 加白名单,或重命名为非 . 前缀',
      })
      console.log(`  ${C.yellow}⚠${C.reset} ${rel}  ${markOf('warn', owner)}`)
    }
  }

  // ── 4. 综合判定 ──
  console.log(header('4. 综合判定'))
  const isForeign = (i) => isStaged && i.owner === 'foreign'
  const blockIssues = issues.filter((i) => i.level === 'block' && !isForeign(i))
  const warnIssues = issues.filter((i) => i.level === 'warn' && !isForeign(i))
  const foreignIssues = issues.filter(isForeign)
  const foreignBlock = foreignIssues.filter((i) => i.level === 'block')
  const foreignWarn = foreignIssues.filter((i) => i.level === 'warn')

  console.log(`  扫描总数: ${C.bold}${totalScanned}${C.reset}`)
  console.log(`  阻断项: ${C.red}${C.bold}${blockIssues.length}${C.reset}`)
  console.log(`  警告项: ${C.yellow}${C.bold}${warnIssues.length}${C.reset}`)
  if (isStaged)
    console.log(
      `  未判定: ${C.cyan}${C.bold}${foreignIssues.length}${C.reset} 处(不计本枚提交;其中阻断档 ${foreignBlock.length} / 警告档 ${foreignWarn.length})`,
    )

  if (blockIssues.length === 0 && warnIssues.length === 0 && foreignIssues.length === 0) {
    console.log(`\n  ${C.green}${C.bold}✅ 所有测试路径与目录均合规${C.reset}`)
    process.exit(0)
  }

  if (blockIssues.length > 0) {
    console.log(`\n${C.red}${C.bold}❌ 发现 ${blockIssues.length} 个阻断项:${C.reset}`)
    for (const it of blockIssues) {
      console.log(`  ${C.red}✗${C.reset} ${C.bold}${it.path}${C.reset}`)
      console.log(`     ${C.dim}原因:${C.reset} ${it.reason}`)
      console.log(`     ${C.dim}修复:${C.reset} ${it.fix}`)
    }
  }

  if (warnIssues.length > 0) {
    console.log(`\n${C.yellow}${C.bold}⚠️  发现 ${warnIssues.length} 个警告项:${C.reset}`)
    for (const it of warnIssues) {
      console.log(`  ${C.yellow}⚠${C.reset} ${it.path}`)
      console.log(`     ${C.dim}${it.reason}${C.reset}`)
    }
  }

  // ── 4b. 未判定清单(仅 `--staged` 档;全量档 face=null ⇒ 结构上进不了这一支) ──
  if (foreignIssues.length > 0) {
    console.log(
      `\n${C.yellow}${C.bold}❓ 未判定 ${foreignIssues.length} 处(不在本枚提交面内,故不计本枚的红):${C.reset}`,
    )
    for (const it of foreignIssues) {
      console.log(
        `  ${C.yellow}?${C.reset} ${C.bold}${it.path}${C.reset}  ${C.dim}[${it.level === 'block' ? '按阻断档' : '按警告档'}定级,但归属未判定]${C.reset}`,
      )
      console.log(`     ${C.dim}原因:${C.reset} ${it.reason}`)
      console.log(
        `     ${C.dim}修复:${C.reset} ${it.fix}(由该目录的归属人处理;要求本枚提交作者去动它,就是 §12 明令的事故)`,
      )
    }
    console.log(
      `  ${C.dim}要把它判红请跑问责面:${C.cyan}node scripts/check-test-paths.mjs${C.dim}(全量档,按原判级逐条判)${C.reset}`,
    )
  }

  // blocking 策略:
  //   - 默认(blockIssues > 0 → exit 1)—— 在册发现的处理与修复前逐字相同
  //   - --strict 模式(warnIssues > 0 也 exit 1)
  if (blockIssues.length > 0) {
    console.log(`\n${C.red}💡 建议:${C.reset}`)
    console.log(`   1. ${C.cyan}git check-ignore -v <path>${C.reset}  确认具体 ignore 规则来源`)
    console.log(
      `   2. 将 __tests__/ 重命名为 ${C.cyan}tests/${C.reset}(避开 .gitignore 第 154 行 __* 规则)`,
    )
    console.log(`   3. 详细规则见 ${C.cyan}AGENTS.md §23${C.reset}`)
    process.exit(1)
  }

  if (isStaged) {
    const code = decideStagedExit({
      ownedBlock: blockIssues.length,
      ownedWarn: warnIssues.length,
      foreignBlock: foreignBlock.length,
      foreignWarn: foreignWarn.length,
      strict: isStrict,
    })
    if (code === 2) {
      console.log(
        `\n${C.yellow}${C.bold}❓ 无法判定(exit 2):${foreignIssues.length} 处发现全部在本枚提交面之外${C.reset}`,
      )
      console.log(
        `   ${C.dim}· 这不是"通过":runner 对 blocking 门按"非 0 即失败"处理,§28"跑绿才算完成"照样拦得住;${C.reset}`,
      )
      console.log(
        `   ${C.dim}· 也不得据此给本枚提交定责(归因层态①b)—— 该清偿的是这些目录的归属人,不是本枚提交的作者。${C.reset}`,
      )
    } else if (code === 1) {
      console.log(`\n${C.yellow}💡 --strict 模式下警告项视为阻断,请人工复核${C.reset}`)
    } else {
      console.log(`\n${C.green}✅ 阻断项 0,警告项已提示(不阻塞)${C.reset}`)
    }
    process.exit(code)
  }

  if (isStrict && warnIssues.length > 0) {
    console.log(`\n${C.yellow}💡 --strict 模式下警告项视为阻断,请人工复核${C.reset}`)
    process.exit(1)
  }

  console.log(`\n${C.green}✅ 阻断项 0,警告项已提示(不阻塞)${C.reset}`)
  process.exit(0)
}

// §22d:本模块导出 parseCheckIgnoreLine 供测试直接 import,故入口必须加 isDirectRun 守卫,
// 否则测试一 import 就连带跑全仓扫描(副作用 + 拖慢)。Windows 反斜杠路径须经 pathToFileURL 归一。
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main().catch((e) => {
    console.error(`${C.red}❌ 脚本执行异常:${C.reset}`, e?.message ?? e)
    console.error(e?.stack ?? '(no stack)')
    process.exit(2)
  })
}

/** §22c:核心判据一律经 __test__ 暴露,镜像测试直接 import,不再抄第二份实现。 */
export const __test__ = {
  normRelPath,
  splitNulPaths,
  isOnRecord,
  ownershipOf,
  decideStagedExit,
  isStaged,
  isStrict,
  ROOT,
  SCAN_ROOTS,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
