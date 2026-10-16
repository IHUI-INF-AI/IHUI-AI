#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-parent-pollution.mjs — 项目父目录污染巡查(运行时项目外文件创建禁令)
 *
 * [judges-external-fs-state] 本门判的是**仓库之外**的磁盘状态(项目父目录 / 盘根里的运行时产物),
 * 不是本枚提交的内容面 —— 提交链归因层(`lib/commit-gate-attribution.mjs`)据此走「未差分」:
 * 2026-10-14 实测,另一会话 23:16 写入的 live 复现探针 `G:/tmp-probe/ars-live-repro.mjs` 让本门红,
 * 而差分档拿"基线面 exit 0 / 我的面 exit 1"当成"本枚引入"的证据 —— 两跑之间读的是同一块盘,
 * 差别只在别人那时候写了什么 ⇒ 把他人现场定责给无关提交者(假红死锁,G-1018220 同族的另一面)。
 * 红照旧报、不读成"不存在";修法是查清外部现场的归属(或等对方自删),不是改本枚内容。
 *
 * 触发背景(2026-07-24 立):
 *   历史教训:2026-07-19 agent 用 RunCommand 直接在项目父目录(原 D:\桌面\项目\,
 *   现 g:\,项目从 D 盘迁至 G 盘后路径已动态推导)创建了
 *   search_uuyc.ps1 + uuyc_search_result.txt,违反 AGENTS.md §15 项目外路径禁令。
 *   原 check-workspace-hygiene.mjs 只能扫项目内代码引用,无法检测 agent
 *   在项目外**直接创建**的运行时产物,存在盲区。
 *
 * 守门策略(反向巡查):
 *   1. 扫描项目父目录及父目录的所有非项目子目录中的"可执行脚本 + 文本文件"
 *   2. 命中条件(满足任一即判定为污染):
 *      a. 文件名匹配 agent 临时产物命名模式(search_*.ps1 / *_result.txt /
 *         *_search*.ps1 / tmp_*.ps1 / ihui-*.ps1 / test_*.ps1 / debug_*.txt 等)
 *      b. 文件内容同时包含项目路径引用(IHUI-AI / 历史路径 d:\桌面\项目) +
 *         agent 操作痕迹(Get-ChildItem / Out-File / Write-Output / Remove-Item 等)
 *      c. 文件内容包含本仓库敏感路径(apps/web / apps/api / packages/)且文件
 *         不在项目内
 *   3. 用户合法脚本不会同时满足"项目路径引用 + agent 操作痕迹"两条
 *
 * 扫描范围(均通过 dirname(ROOT) 动态推导,符合 AGENTS.md §15):
 *   - 项目父目录(dirname(ROOT))的所有非 IHUI-AI 文件
 *   - 项目祖父目录(dirname(dirname(ROOT)))下扩展名为 .ps1/.txt/.log/.bat/.sh/.py/.js/.mjs/.cjs
 *     的根级文件(不递归到子目录,避免误伤其他项目)
 *   - 跳过用户合法的快捷方式(.lnk)、Office 文档等
 *
 * 用法:
 *   node scripts/check-parent-pollution.mjs          # 阻塞模式(exit 1)
 *   node scripts/check-parent-pollution.mjs --warn   # warn-only(不阻塞)
 *   node scripts/check-parent-pollution.mjs --scan-root <dir>  # 夹具档:只扫这一棵树(判定本体不变)
 *
 * 退出码:0 = 无污染;1 = 发现项目外污染(阻塞 commit);2 = 未判定(夹具档拿不到目录)。
 */

import { readFileSync, existsSync, readdirSync, unlinkSync, statSync } from 'node:fs'
import * as os from 'node:os'
import { execSync } from 'node:child_process'
import { join, resolve, relative, dirname, basename, extname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createLogger } from './lib/logger.mjs'
import { isRootLinkedWorktree } from './lib/worktree.mjs'

const log = createLogger()

const ROOT = resolve(fileURLToPath(new URL('../', import.meta.url)))
const PROJECT_NAME = basename(ROOT) // IHUI-AI
// 盘判门的自我定位一律从模块 URL 直接推导(一层目录 = URL 里一个 '..'),不再绕 ROOT 二次拼装:
//   本门一处仓库 blob 都不读,读的全是仓库外的盘;而绕经 ROOT 再 dirname 会让门 118 的**文件级**
//   合取把它误标成"按磁盘判仓库内容"(该假阳 118 自己登记在头注,真修 = 认识 gitignore 语义,是另一票)。
//   同型三道盘判门 `check-c-drive-pollution` / `check-disk-root-hygiene` / `check-temp-landing` 现读都是
//   `unknown`(读文件但找不到仓库锚点);118 对自己这条假阳印的出路也正是「判的不是仓库内容 ⇒ 改成不读
//   ROOT 锚点即可」。判定行为一字未变(新旧门体 stdout/stderr/RC 对账见本枚提交说明)。
const PARENT_DIR = resolve(fileURLToPath(new URL('../../', import.meta.url))) // 项目父目录(§15 动态推导)
const GRANDPARENT_DIR = resolve(fileURLToPath(new URL('../../../', import.meta.url))) // 项目祖父目录
/** `<仓库>/.git` 的位置(同样直接从模块 URL 推导,等价于旧的 `join(ROOT, '.git')`)。 */
const DOT_GIT = resolve(fileURLToPath(new URL('../.git', import.meta.url)))

/**
 * 主仓真实 gitdir(兼容 separate-git-dir 布局)。
 * 2026-09-12 起本仓 `.git` 是 28 字节指针文件(`gitdir: D:/IHUI-AI-git-repo`),
 * 真 gitdir 在工作区之外;若将来改回 `.git` 目录形态,这里同样返回 `<仓库>/.git`。
 */
function resolveRealGitDir() {
  try {
    if (!existsSync(DOT_GIT)) return null
    if (!statSync(DOT_GIT).isFile()) return DOT_GIT
    const m = readFileSync(DOT_GIT, 'utf8')
      .trim()
      .match(/^gitdir:\s*(.+)$/i)
    // 指针里的相对路径按 git 自己的规则**相对 .git 文件所在目录**解析(旧写法拿仓库根当基准,
    // 本仓两者同址 ⇒ 实测等值;而"相对 .git 所在目录"才是 git 定义的那一条)。
    return m ? resolve(dirname(DOT_GIT), m[1].trim()) : null
  } catch {
    return null
  }
}
const REAL_GIT_DIR = resolveRealGitDir()

// ===== 可疑扩展名(agent 临时产物典型格式) =====
const SUSPICIOUS_EXTS = new Set([
  '.ps1',
  '.psm1',
  '.bat',
  '.cmd',
  '.sh',
  '.py',
  '.js',
  '.mjs',
  '.cjs',
  '.ts',
  '.txt',
  '.log',
  '.tmp',
])

// ===== 文件名 agent 临时产物模式(强信号,直接判定) =====
const AGENT_FILENAME_PATTERNS = [
  /^search_.*\.(ps1|py|sh|bat|txt|js|mjs)$/i,
  /_search_.*\.(ps1|py|sh|bat|txt)$/i,
  /_search_result.*\.txt$/i,
  /^search_result.*\.txt$/i,
  /^uuyc.*\.(ps1|txt|log)$/i,
  /^tmp_.*\.(ps1|py|sh|bat|txt|js|mjs)$/i,
  /^ihui[-_].*\.(ps1|py|sh|bat|txt|js|mjs|json)$/i,
  /^test_.*\.(ps1|py|sh|bat)$/i,
  /^debug_.*\.(txt|log|ps1)$/i,
  /^cleanup.*\.(ps1|py|sh|bat)$/i,
  /^fix_.*\.(ps1|py|sh|bat)$/i,
  /^migrate.*\.(ps1|py|sh|bat)$/i,
  /^scan_.*\.(ps1|py|sh|bat|txt)$/i,
  /_result\.txt$/i,
  /_output\.txt$/i,
  /_list\.txt$/i,
]

// ===== 内容 agent 操作痕迹(PowerShell/Node 自动化命令) =====
const AGENT_OP_TRACES = [
  /Get-ChildItem/i,
  /Write-Output/i,
  /Out-File/i,
  /Set-Content/i,
  /Add-Content/i,
  /Remove-Item/i,
  /Copy-Item/i,
  /Move-Item/i,
  /New-Item/i,
  /Select-Object/i,
  /Format-Table/i,
  /Format-List/i,
  /\$ErrorActionPreference/i,
  /\[Console\]::OutputEncoding/i,
  /WriteAllBytes|WriteAllText/i,
  /require\(['"]fs['"]\)/,
  /import.*from\s+['"]node:fs['"]/,
]

// ===== 项目路径引用(同时命中即判定污染) =====
const PROJECT_REF_PATTERNS = [
  /IHUI[-_]?AI/i,
  /d:\\桌面\\项目/i,
  /D:\\桌面\\项目/i,
  /桌面\\项目/i,
  /apps[\\/]web[\\/]/,
  /apps[\\/]api[\\/]/,
  /apps[\\/]ai-service[\\/]/,
  /apps[\\/]extension[\\/]/,
  /apps[\\/]desktop[\\/]/,
  /apps[\\/]miniapp-taro[\\/]/,
  /apps[\\/]mobile-rn[\\/]/,
  /apps[\\/]cli[\\/]/,
  /packages[\\/]database[\\/]/,
  /packages[\\/]auth[\\/]/,
  /packages[\\/]types[\\/]/,
  /packages[\\/]ui([-_]?react)?[\\/]/,
  /@ihui\//i,
  /@ihui[-_]/i,
]

// ===== 用户合法文件名模式(白名单,不算污染) =====
const USER_LEGIT_PATTERNS = [
  /\.lnk$/i, // 快捷方式
  /\.url$/i, // URL 快捷方式
  /\.(docx?|xlsx?|pptx?|pdf|odt|ods|odp)$/i, // Office 文档
  /\.(jpg|jpeg|png|gif|bmp|webp|svg|ico|tiff?)$/i, // 图片
  /\.(mp4|mp3|wav|avi|mkv|flv|mov|wma|flac)$/i, // 音视频
  /\.(zip|rar|7z|tar|gz|bz2|xz)$/i, // 压缩包
  /\.(exe|msi|dmg|pkg|deb|rpm|appimage)$/i, // 安装包(用户下载)
  /^desktop\.ini$/i,
  /^Thumbs\.db$/i,
  /^项目端口分析与维护成本优化\.md$/i, // 已迁移到 docs/port-cost-analysis.md
  /^check-stale-dist\.old\.mjs$/i, // 历史遗留脚本,已不在项目内
  /^inject_wb_i18n\.mjs$/i, // 历史遗留脚本,已不在项目内
  // 用户自有的 Android 发布签名说明(网盘 密钥/ 目录内,与 ihui-release.keystore 配套)。
  // 2026-09-12 立:文件名 `ihui-` 前缀会命中强信号规则,但它不是 agent 产物,
  // 且 `pnpm hygiene:parent:clean` 会把强信号命中当作可自动清理目标 → 必须显式豁免,防止误删用户文件。
  /^ihui-release\.keystore\.说明\.txt$/i,
  // 用户自有的应用密码表(位于 D:/DevEnv/secrets/,与 admin-2fa.html / admin-mfa-qr.png /
  // .pybcrypt 同目录,是有意的凭据库而非 agent 产物)。同类陷阱第二次命中:2026-09-22 实测
  // 它被 `ihui-` 前缀强信号判为污染,而 auto-clean 走 unlinkSync 且无二次确认 → 跑一次
  // `pnpm hygiene:parent:clean` 就会把凭据库整体删掉。改前必须先补本豁免。
  /^ihui-app-password\.txt$/i,
]

/**
 * 凭据库目录名:整目录不扫、不判污染、不 auto-clean(结构性豁免,2026-09-22 立)。
 *
 * 为什么必须做到目录层:USER_LEGIT_PATTERNS 只按 filename 判定,一个目录里有多少把
 * 密钥就得逐条列举多少回。实测已两次命中同一陷阱(2026-09-12 ihui-release.keystore.说明.txt、
 * 2026-09-22 D:/DevEnv/secrets/ihui-app-password.txt),而 --auto-clean 分支
 * (本文件 unlinkSync 处)对强信号命中**无任何二次确认** —— 逐文件名打补丁 = 等着第三把
 * 密钥被无声删除。`密钥/`(AGENTS.md §5d 模型密钥唯一权威源)一旦被扫到同样是整体蒸发。
 *
 * 代价(有意接受):往名为 secrets/密钥 的目录里塞垃圾可绕过本守门。数据蒸发风险
 * 远高于漏检,且漏检仍可被 §25/§28 等其他守门兜住。
 */
const CREDENTIAL_DIR_NAMES = new Set([
  'secrets',
  'secret',
  'credentials',
  'credential',
  '密钥',
  'certs',
  'certificates',
  '.pybcrypt',
])

/**
 * 备份 / 存档 / gitdir 快照目录:同样整目录不扫(2026-09-23 立,配 AGENTS.md §15「项目外唯一备份目录」)。
 *
 * 动机很直接:用户要求把散落的备份集中到 `D:\DevEnv\backups\` 与 `pg_archives\`,而这两个目录
 * 恰好落在本守门的 2 层扫描深度内(D:/ → DevEnv → backups → 文件会被扫)。备份里的
 * `*.txt` / `*.log` / `*.tmp` 一旦命中文件名强信号,`--auto-clean` 就会把它们当 agent 垃圾实删 ——
 * 「卫生守门删掉数据备份」是不可接受的失效模式,和上面凭据库那次是同一类。
 *
 * 前缀表覆盖 AGENTS.md §5b 明令禁删的真 gitdir 及其各类快照/归档(`.broken-*`、`git-backup`、
 * `_workbak`、`Bak-inflight-*`),它们同样带 `IHUI-` 前缀,天然命中强信号。
 *
 * 代价(与凭据库同源,有意接受):往这些名字的目录里塞垃圾可绕过本守门;仍由 §25/§28 兜。
 */
const BACKUP_DIR_NAMES = new Set(['backups', 'pg_archives', 'archives', 'archive', 'quarantine'])
const BACKUP_DIR_PREFIXES = [
  'ihui-ai-git-repo',
  'ihui-ai.git-backup',
  'ihui-ai-backup',
  'ihui-ai_workbak',
  'ihui-ai-out-of-tree-artifacts',
  'bak-inflight',
]

function isBackupDataDir(name) {
  const n = name.toLowerCase()
  if (BACKUP_DIR_NAMES.has(n)) return true
  return BACKUP_DIR_PREFIXES.some((p) => n.startsWith(p))
}

/**
 * 获取用户真实桌面路径(跨驱动器场景)。
 *
 * 历史教训(2026-07-25):用户桌面被重定向到 E:\桌面(跨驱动器,项目在 G:\IHUI-AI),
 * 原守门脚本只扫项目父目录(G:\)和祖父目录(G:\),无法检测 agent 在 E:\桌面\
 * 创建的污染文件(如 E:\桌面\项目端口分析与维护成本优化.md)。本函数通过
 * PowerShell [Environment]::GetFolderPath('Desktop') 获取真实桌面路径,兜底
 * 扫描所有驱动器根的"桌面"/"Desktop"文件夹。
 */
function getRealDesktopPaths() {
  const paths = new Set()

  // 1. PowerShell 获取真实桌面路径(最可靠,处理重定向)
  try {
    const out = execSync('pwsh -NoProfile -Command "[Environment]::GetFolderPath(\'Desktop\')"', {
      encoding: 'utf8',
      timeout: 3000,
      stdio: ['ignore', 'pipe', 'ignore'],
    windowsHide: true,    }).trim()
    if (out) paths.add(resolve(out))
  } catch {
    // PowerShell 失败(非 Windows / 超时),走兜底
  }

  // 2. 兜底:用户主目录下的 Desktop / 桌面
  const home = os.homedir()
  paths.add(join(home, 'Desktop'))
  paths.add(join(home, '桌面'))

  // 3. 兜底:所有驱动器根的"桌面"/"Desktop"文件夹(跨驱动器重定向场景)
  for (let code = 65; code <= 90; code++) {
    const drive = String.fromCharCode(code) + ':\\'
    for (const name of ['桌面', 'Desktop']) {
      paths.add(join(drive, name))
    }
  }

  // 过滤不存在的路径,避免无意义扫描
  return [...paths].filter((p) => existsSync(p))
}

// 预计算桌面路径(模块加载时一次性计算,避免每次 main() 重复调用 PowerShell)
const DESKTOP_PATHS = getRealDesktopPaths()

function isUserLegit(filename) {
  return USER_LEGIT_PATTERNS.some((p) => p.test(filename))
}

/**
 * 判断目录是否为本仓库的关联 git worktree(2026-09-07 立)。
 *
 * 背景:既定并行协作流程会在项目父目录创建 detached worktree
 * (如 G:\IHUI-final-wt,worktree 内含本仓库完整检出)。worktree 的 .git
 * 是一个文件,内容为 "gitdir: <主仓>/.git/worktrees/<名>"。此前本守门把
 * worktree 内所有 scripts/*.mjs 误判为污染(内容含项目引用 + 操作痕迹),
 * 阻塞一切 commit——但 worktree 是并行会话的合法工作区,绝不可清理。
 *
 * 判定:dir/.git 存在且为文件,且其 gitdir 指向本仓库 ROOT/.git → 豁免。
 */
function isLinkedWorktree(dir) {
  const gitPath = join(dir, '.git')
  try {
    if (!existsSync(gitPath)) return false
    const stat = statSync(gitPath)
    if (!stat.isFile()) return false // .git 目录 = 独立主仓,不属于本守门豁免
    const content = readFileSync(gitPath, 'utf8').trim()
    const normalizedGitDir = content
      .replace(/^gitdir:\s*/i, '')
      .replace(/\\/g, '/')
      .toLowerCase()
    // 指向本仓库真实 gitdir(含 worktrees 子目录)才豁免;指向别的仓库不算。
    // 分隔符与大小写归一化:worktree .git 文件常写正斜杠,而 join(ROOT) 产生反斜杠,
    // Windows 盘符大小写也可能漂移。
    // ⚠️ 2026-09-12:本仓改为 separate-git-dir 布局后,`.git` 只是 28 字节**指针文件**,
    // 真 gitdir 在工作区之外(现为 D:/IHUI-AI-git-repo),worktree 的 .git 指向
    // `<真实gitdir>/worktrees/<名>`,旧实现硬拼 ROOT/.git 会恒不匹配 →
    // 合法 worktree 会被误判为污染、阻塞一切提交。故改为解析真实 gitdir。
    const baseGitDir = REAL_GIT_DIR || DOT_GIT
    const expectedPrefix = baseGitDir.replace(/\\/g, '/').toLowerCase()
    return normalizedGitDir.startsWith(expectedPrefix)
  } catch {
    return false
  }
}

// 2026-09-13:判定逻辑提取到共享层 scripts/lib/worktree.mjs(守门 [15] 有同类需求),
// 行为不变:worktree 的 `.git` 是指针文件且指向 `<真实gitdir>/worktrees/<名>`。
// 主工作区自身(独立 gitdir)与普通子目录的巡查行为完全不变。

function matchesAgentFilenamePattern(filename) {
  return AGENT_FILENAME_PATTERNS.some((p) => p.test(filename))
}

// 双信号判定的两个分量(§22c:判据只写一份 —— 镜像测试经 __test__ 调用它,不得再抄一遍清单)
const hasProjectRefSignal = (content) => PROJECT_REF_PATTERNS.some((p) => p.test(content))
const hasAgentOpSignal = (content) => AGENT_OP_TRACES.some((p) => p.test(content))

function scanFileContent(filePath) {
  let content
  try {
    content = readFileSync(filePath, 'utf8')
  } catch {
    return null
  }

  // 截断前 50KB,避免大文件耗时
  if (content.length > 50 * 1024) {
    content = content.slice(0, 50 * 1024)
  }

  return {
    hasProjectRef: hasProjectRefSignal(content),
    hasAgentOp: hasAgentOpSignal(content),
    content,
  }
}

function findPollution(dir, recursive = false, depth = 0) {
  const pollutions = []
  if (!existsSync(dir) || depth > 2) return pollutions

  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return pollutions
  }

  for (const entry of entries) {
    // 跳过项目目录自身
    if (dir === PARENT_DIR && entry.name === PROJECT_NAME) continue
    // 跳过系统隐藏目录
    if (entry.name === 'System Volume Information' || entry.name === '$RECYCLE.BIN') continue
    // 跳过凭据库目录:整目录不扫(见 CREDENTIAL_DIR_NAMES 注释——必须目录级,逐文件名豁免已被证明会漏)
    if (entry.isDirectory() && CREDENTIAL_DIR_NAMES.has(entry.name.toLowerCase())) continue
    // 跳过备份/存档/gitdir 快照目录:同上理由,防"卫生守门删掉数据备份"
    if (entry.isDirectory() && isBackupDataDir(entry.name)) continue

    const full = join(dir, entry.name)
    const relPath = relative(ROOT, full).replace(/\\/g, '/')

    if (entry.isDirectory()) {
      // 豁免本仓库的关联 git worktree(并行会话合法工作区,2026-09-07 立)
      if (isLinkedWorktree(full)) continue
      if (recursive && depth < 2) {
        pollutions.push(...findPollution(full, recursive, depth + 1))
      }
      continue
    }

    if (!entry.isFile()) continue

    const ext = extname(entry.name).toLowerCase()
    if (!SUSPICIOUS_EXTS.has(ext)) continue
    if (isUserLegit(entry.name)) continue

    // 强信号:文件名匹配 agent 临时产物模式 → 直接判定
    if (matchesAgentFilenamePattern(entry.name)) {
      pollutions.push({
        file: full,
        relPath: `[项目外] ${relPath}`,
        reason: `文件名匹配 agent 临时产物模式(${entry.name})`,
        level: 'blocking',
      })
      continue
    }

    // 弱信号:内容同时包含项目路径引用 + agent 操作痕迹
    const scan = scanFileContent(full)
    if (scan && scan.hasProjectRef && scan.hasAgentOp) {
      pollutions.push({
        file: full,
        relPath: `[项目外] ${relPath}`,
        reason: '内容同时包含项目路径引用 + agent 自动化操作痕迹',
        level: 'blocking',
      })
    }
  }

  return pollutions
}

function main() {
  const args = process.argv.slice(2)
  const isWarn = args.includes('--warn')
  const isAutoClean = args.includes('--auto-clean')
  // --quiet 由共享 logger 处理(见 ./lib/logger.mjs),无需在此手动解析

  // 0. linked worktree 场景跳过(2026-09-13 立)  // worktree 的 ROOT 是 worktree 路径,其 PARENT_DIR 通常正是主工作区所在盘
  // (如 G:/IHUI-AI),巡查会把主工作区里的历史 agent 临时文件误判为本 worktree
  // 的父目录污染 → 每次 worktree 提交都被 [26] 阻塞。此前只能临时改脚本绕过,
  // 现固化为正式判定(仅豁免指针式 .git 且指向 <真实gitdir>/worktrees/ 的情形;
  // 主工作区自身的巡查行为完全不变)。
  if (isRootLinkedWorktree()) {
    log.info('✅ parent-pollution: 当前运行于 linked worktree,项目父目录巡查不适用,跳过')
    process.exit(0)
  }

  // 夹具档(2026-10-16 立):`--scan-root <dir>` 只替换**扫哪棵树**,判定本体(findPollution 的双信号、
  // 凭据库/备份目录整目录不扫、深度 ≤2)一字不动。存在它的理由是本门的镜像曾把"这台机此刻的父目录
  // 恰好干净"当成 exit 0 的前提 ⇒ 任何会话往 G:/ 扔一个探针,镜像三条用例连带本门一起红(§12e 同型,
  // 与 check-workspace-hygiene.test.mjs 记过的"基线干净判的是内容面不是磁盘"同源)。
  // 该档不是消红通道:① 生效时必喊话(上面那句 + 末行读数点名根目录);② 目录取不到 ⇒ exit 2「未判定」,
  // 既不记绿也不冒红(§0.3);③ 只在显式带旗时生效,缺省档仍然扫真实四面,提交链读的是缺省档。
  const scanRootIdx = args.indexOf('--scan-root')
  const scanRootGiven = scanRootIdx >= 0
  const scanRoot = scanRootGiven ? args[scanRootIdx + 1] : undefined
  if (scanRootGiven && (!scanRoot || scanRoot.startsWith('--'))) {
    log.error(
      '❌ parent-pollution [未判定]: --scan-root 后面没给目录 ⇒ 不回落真实根(那会把夹具档读成缺省档)',
    )
    process.exit(2)
  }

  const allPollutions = []

  if (scanRoot) {
    if (!existsSync(scanRoot)) {
      log.error(`❌ parent-pollution [未判定]: 夹具根取不到 ${scanRoot} ⇒ 不记绿也不冒红`)
      process.exit(2)
    }
    log.info(`⚠️ parent-pollution [夹具档]: 本轮只扫 ${scanRoot}(真实四面未读,不得当成装机证明)`)
    allPollutions.push(...findPollution(scanRoot, true, 0))
  } else {
    // 1. 扫描项目父目录(递归到 2 层,捕获父目录根级 *.ps1 和子目录中的污染)
    allPollutions.push(...findPollution(PARENT_DIR, true, 0))

    // 2. 扫描项目祖父目录(桌面)的根级文件(不递归,避免误伤其他项目)
    allPollutions.push(...findPollution(GRANDPARENT_DIR, false, 0))

    // 3. 扫描用户主目录根级(只扫 agent 临时产物命名模式的文件,不递归)
    //    覆盖 agent 误写到 ~/ 的情况(如 ~/*.ps1 / ~/*.txt 调试日志)
    const homeDir = os.homedir()
    allPollutions.push(...findPollution(homeDir, false, 0))

    // 4. 扫描用户真实桌面路径(跨驱动器场景,2026-07-25 立)
    //    历史教训:用户桌面重定向到 E:\桌面,原守门脚本只扫 G:\ 父目录,盲区!
    //    本扫描覆盖所有可能的桌面路径(PowerShell 获取 + 驱动器兜底),
    //    根级不递归(避免误伤桌面合法子目录),捕获 agent 在桌面创建的污染文件。
    for (const desktopPath of DESKTOP_PATHS) {
      allPollutions.push(...findPollution(desktopPath, false, 0))
    }
  }

  // --auto-clean: 自动清理强信号命中(文件名匹配 agent 临时产物模式)的污染
  // 只清理文件名强信号命中,不清理内容双信号命中(避免误删用户合法脚本)
  if (isAutoClean && allPollutions.length > 0) {
    const cleaned = []
    const remaining = []
    for (const p of allPollutions) {
      if (p.reason.includes('文件名匹配 agent 临时产物模式')) {
        try {
          unlinkSync(p.file)
          cleaned.push(p)
        } catch (_e) {
          remaining.push(p)
        }
      } else {
        remaining.push(p)
      }
    }

    if (cleaned.length > 0) {
      log.info(`🧹 parent-pollution [auto-clean]: 已自动清理 ${cleaned.length} 个 agent 污染文件`)
      for (const p of cleaned) {
        log.info(`  ✓ 已删除 ${p.relPath}`)
      }
    }

    if (remaining.length === 0) {
      log.info('✅ parent-pollution: 清理完成,无剩余污染')
      process.exit(0)
    }

    // 剩余的是内容双信号命中,需要人工确认(警告级别,--quiet 时静默)
    log.warn(
      `⚠️  parent-pollution: ${remaining.length} 个文件需人工确认(内容双信号命中,不自动删除)`,
    )
    for (const p of remaining) {
      log.warn(`  ${p.relPath}`)
      log.warn(`    原因: ${p.reason}`)
      log.warn(`    手动删除: Remove-Item "${p.file}" -Force`)
    }
    process.exit(1)
  }

  if (allPollutions.length === 0) {
    log.info('✅ parent-pollution: 项目父目录及桌面根目录无 agent 污染')
    process.exit(0)
  }

  const mode = isWarn ? 'WARN' : 'BLOCK'
  const prefix = isWarn ? '⚠️ ' : '❌ '
  // 主报告(BLOCK/WARN 概要)始终输出(error 级别,--quiet 不静默)
  log.error(`${prefix}parent-pollution [${mode}]: 发现 ${allPollutions.length} 个项目外污染文件`)
  log.error('')
  log.error('违反 AGENTS.md §15 项目外路径禁令 + §15 运行时禁令:')
  log.error('  agent 不得在项目目录外用 RunCommand / PowerShell 创建任何文件。')
  log.error('  所有临时脚本必须放 .ihui-agent/tmp/<脚本名>,所有产物必须放项目内。')
  log.error('')
  for (const p of allPollutions.slice(0, 30)) {
    log.error(`  ${p.relPath}`)
    log.error(`    原因: ${p.reason}`)
  }
  log.error('')
  log.error('清理方法:')
  log.error('  自动清理: pnpm hygiene:parent:clean  (只清文件名强信号命中)')
  log.error('  手动清理: Remove-Item "<文件路径>" -Force')
  log.error('')

  if (isWarn) {
    log.info('(warn-only 模式,不阻塞 commit)')
    process.exit(0)
  }
  process.exit(1)
}

// §22d:CLI 直接执行才跑主流程(主流程要扫盘,有副作用);被镜像测试 import 时不得触发扫描。
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) main()

// §22c:镜像测试经此导出口裁定判据 —— 清单与判定在本门体只写一份(守门 191 命中项收口)。
export const __test__ = {
  SUSPICIOUS_EXTS,
  CREDENTIAL_DIR_NAMES,
  BACKUP_DIR_NAMES,
  BACKUP_DIR_PREFIXES,
  isBackupDataDir,
  isUserLegit,
  matchesAgentFilenamePattern,
  contentTriggers: (content) => hasProjectRefSignal(content) && hasAgentOpSignal(content),
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
