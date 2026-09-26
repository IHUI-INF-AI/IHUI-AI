#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * i18n 键完整性检查守门脚本。
 *
 * 改进点(相比旧版):
 * - 全语言覆盖: 动态扫描 apps/web/messages/*.json 全部语言文件,以 zh-CN 为基准做 parity
 * - 扩大扫描范围: 扫描 apps/web/ 下所有 .ts/.tsx(含 app/、src/components/、src/lib/ 等)
 *   排除 messages/、.next/、node_modules/、.git/
 * - 识别 getTranslations: 同时识别 useTranslations('ns') 和 getTranslations('ns')(含 await)
 * - 单文件多命名空间: 基于变量名精确归属,覆盖 t/tc/te 等变量;多 ns 时宽松检查(任一 ns 存在即通过)
 * - --staged 双模式: 暂存区报 error(exit 1) / 全量报 warning(exit 0)
 * - --target=web|extension|shared|cli|mobile-rn|miniapp-taro: 切换扫描目标
 *   (web 默认 apps/web/messages/; extension packages/i18n/messages/extension/; shared packages/i18n/messages/shared/)
 *   extension / shared 模式只做 key parity 校验,跳过源码使用检测与翻译完整性检测
 *   (extension 用 useI18n(),namespace 提取逻辑不适用;shared 为跨端共享基础 key 无源码消费方)
 *   mobile-rn / miniapp-taro 模式(2026-09):除 parity 外还做「端内 t()/tt() 引用键缺失检测」——
 *   从端内 lib/i18n.ts(useI18n)或 lib/theme.ts(useAppTheme + tt)的 zh-CN 兜底词典取 namespace,
 *   对 src 下 .ts/.tsx 提取 t('key') / tt('key', ...) 引用并查合并集(shared+端),
 *   防止"依赖中文兜底但词典静默缺键"(Agent A 2026-09 报告的风险)。
 * - --parity-only: 仅做 5 语言 key parity 校验,跳过源码使用检测
 *   (用于 guardian-runner 2n-web 项,即使暂存区无 i18n JSON 改动也强制跑 parity 校验,
 *    防止"5 语言 parity 漂移但 commit 漏检"——item 2 现有逻辑只在 messages 改动时跑 parity)
 * - 方案 A(2026-07-26):web/extension 非 shared 模式下 loadMessages() 返回
 *   mergeMessages(shared[lang], target[lang]),parity 校验在合并集上进行,
 *   源码缺失键检测也查合并集。这样把 common.save 等基础 key 迁移到 shared 后,
 *   web 端不会误报"缺失键 common.save"。shared 模式保持 parity-only 不变。
 *
 * 用法: node scripts/check-i18n-keys.mjs [--staged] [--target=web|extension|shared] [--parity-only]
 *   --staged:      只检查 git 暂存区涉及的文件(pre-commit 用, 有问题则 exit 1)
 *   --target:      扫描目标,web(默认)、extension、shared 或 cli
 *   --parity-only: 仅做 5 语言 parity 校验,跳过源文件扫描;与 --staged 一起用时强制跑 parity
 *   无参数:        全量检查(CI 用, 历史遗留问题标 warning, exit 0)
 */
import { execSync } from 'node:child_process'
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { createRequire } from 'node:module'
import { isExcludedDirName } from './lib/exclude-dirs.mjs'
// 判定面取材的唯一出口(2026-09-26 迁)。语言包是这道门唯一的"内容输入",
// 清单与正文必须经同一面、同一次取材拿到 —— 各写一遍必然不同形(守门 118 的 half-wired 档)。
import { catBatch, gitRaw, readWorktreeFile } from './lib/face-reader.mjs'

const ROOT = process.cwd()
// 2026-09:解析端内 lib/*.ts 的 messagesZhCN TS 对象字面量。
// json5 用 createRequire 运行时解析(脚本可能由子代理在任意 workspace 包 cwd 下执行,
// ESM 静态 import 按脚本位置解析会找不到包;createRequire 按 cwd 逐级向上找可用副本)
const require_ = createRequire(import.meta.url)
let JSON5
try {
  JSON5 = require_('json5')
} catch {
  JSON5 = null
}
// 脚本可能由子代理在包目录下执行:向上找含 packages/i18n 的仓库根,保证路径与 git cwd 一致
function findRepoRoot() {
  let dir = ROOT
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(dir, 'packages', 'i18n'))) return dir
    const parent = join(dir, '..')
    if (parent === dir) break
    dir = parent
  }
  return ROOT
}
const REPO_ROOT = findRepoRoot()
const isStaged = process.argv.includes('--staged')
const targetArg = process.argv.find((a) => a.startsWith('--target='))
const TARGET = targetArg ? targetArg.split('=')[1] : 'web'
const isExtension = TARGET === 'extension'
const isShared = TARGET === 'shared'
const isCli = TARGET === 'cli'
// 2026-08-19 立:mobile-rn 端 parity 守门(原 ID 2f-mobile-rn fall through 到 web,实际检查 web 而非 mobile-rn)
const isMobileRn = TARGET === 'mobile-rn'
// 2026-09 新增:miniapp-taro 端 parity + tt() 引用键缺失检测(与 mobile-rn 同构)
const isMiniappTaro = TARGET === 'miniapp-taro'
// 2026-07-26: --parity-only 强制仅做 5 语言 parity 校验(不扫描源文件)
// 用途:guardian-runner 2n-web 项,即使暂存区无 i18n JSON 改动也强制跑 parity
const isParityOnlyFlag = process.argv.includes('--parity-only')
// parity-only 模式:仅做 5 语言 key parity 校验,跳过源码使用检测与翻译完整性检测
// (extension / mobile-rn / cli 用各自 namespace 提取不适用;shared 为跨端共享基础 key 无源码消费方;
//  --parity-only 用于 guardian-runner 2n-web 项兜底,防止 i18n JSON 没动时 parity 漂移漏检)
const isParityOnly = isExtension || isShared || isCli || isParityOnlyFlag
const WEB_DIR = join(REPO_ROOT, 'apps/web')
// 2026-07-25 i18n 单一来源:web 翻译迁移到 packages/i18n/messages/web/
// 2026-08-19:补充 mobile-rn 分支(原 fall through 到 web,守护形同虚设)
const MESSAGES_DIR = isExtension
  ? join(REPO_ROOT, 'packages/i18n/messages/extension')
  : isShared
    ? join(REPO_ROOT, 'packages/i18n/messages/shared')
    : isCli
      ? join(REPO_ROOT, 'packages/i18n/messages/cli')
      : isMobileRn
        ? join(REPO_ROOT, 'packages/i18n/messages/mobile-rn')
        : isMiniappTaro
          ? join(REPO_ROOT, 'packages/i18n/messages/miniapp-taro')
          : join(REPO_ROOT, 'packages/i18n/messages/web')
// shared 目录:web/extension 非 shared 模式下与 MESSAGES_DIR 合并校验(方案 A)
// shared 模式下 MESSAGES_DIR === SHARED_DIR,二者相同
const SHARED_DIR = join(REPO_ROOT, 'packages/i18n/messages/shared')
// extension / shared / mobile-rn / cli 模式:暂存区路径前缀(extension 同时识别 apps/extension/)
// 非 shared 模式同时识别 shared/(合并集的一部分,shared 改动需触发 parity 校验)
// shared 模式只识别 shared/
const STAGED_MESSAGES_PREFIXES = isShared
  ? ['packages/i18n/messages/shared/']
  : isCli
    ? ['packages/i18n/messages/cli/']
    : isMobileRn
      ? ['packages/i18n/messages/mobile-rn/', 'packages/i18n/messages/shared/']
      : isMiniappTaro
        ? ['packages/i18n/messages/miniapp-taro/', 'packages/i18n/messages/shared/']
        : isExtension
          ? ['packages/i18n/messages/extension/', 'packages/i18n/messages/shared/']
          : ['packages/i18n/messages/web/', 'packages/i18n/messages/shared/']
// 2026-08-19:补充 mobile-rn 前缀(staged mode 下识别 apps/mobile-rn/ 源码改动)
const STAGED_SOURCE_PREFIX = isExtension
  ? 'apps/extension/'
  : isCli
    ? 'apps/cli/'
    : isMobileRn
      ? 'apps/mobile-rn/'
      : isMiniappTaro
        ? 'apps/miniapp-taro/'
        : 'apps/web/'
const EXCLUDE_DIRS = new Set([
  '.git',
  '.next',
  '.ihui-agent',
  '.turbo',
  '.worktrees',
  'build',
  'dist',
  'node_modules',
  'tests',
  '__tests__',
  'e2e',
])
const BASE_LANG = 'zh-CN'

const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  reset: '\x1b[0m',
}

// 2026-09:mobile-rn / miniapp-taro 端源码目录(全量模式扫描 src,而非 apps/web)
const APP_SRC_DIR = isMobileRn
  ? join(REPO_ROOT, 'apps/mobile-rn/src')
  : isMiniappTaro
    ? join(REPO_ROOT, 'apps/miniapp-taro/src')
    : null

function collectSourceFiles(dir, result = []) {
  if (!existsSync(dir)) return result
  for (const entry of readdirSync(dir)) {
    if (EXCLUDE_DIRS.has(entry) || isExcludedDirName(entry)) continue
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) {
      collectSourceFiles(full, result)
    } else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
      result.push(full)
    }
  }
  return result
}

/**
 * 源文件清单的**按面**枚举(2026-09-26 收口)。
 * 旧写法在所有模式下都是 `collectSourceFiles`(磁盘遍历)—— 语言包已改按面判之后,
 * 它就成了同一把尺子的另一半错位:并行会话在磁盘新写一个引用未登记键的组件,
 * HEAD 面上"源码 × 词表"两头都干净的仓被它顶红(实测 `sideQueued` 型)。
 * 过滤规则与 collectSourceFiles 逐字同形(扩展名 + EXCLUDE_DIRS + isExcludedDirName 按段判),
 * 只换取材面、不改判据覆盖 —— 少一段就是放宽判据,多一段就是另造一台门。
 */
function listSourceFilesOnFace(dirAbs) {
  if (FACE === 'worktree') return collectSourceFiles(dirAbs)
  const relDir = relOf(dirAbs)
  let out
  try {
    out =
      FACE === 'index'
        ? gitRaw(['ls-files', '--', `${relDir}/`], REPO_ROOT)
        : gitRaw(['ls-tree', '-r', '--name-only', 'HEAD', '--', `${relDir}/`], REPO_ROOT)
  } catch (e) {
    throw new Error(
      `${FACE_LABEL[FACE]} 列不到 ${relDir} 的源文件清单:${String((e && e.message) || e).split('\n')[0]}`,
    )
  }
  return out
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((p) => p.replace(/\\/g, '/'))
    .filter((p) => p.endsWith('.ts') || p.endsWith('.tsx'))
    .filter((p) => !p.split('/').some((seg) => EXCLUDE_DIRS.has(seg) || isExcludedDirName(seg)))
    .map((p) => join(REPO_ROOT, p))
}

// 语言包的判定面唯一出口在下方 `FACE` / `listPackJsonEntries` / `readPackText`(2026-09-26 收口)。
// 此前这里是两套已废弃的口径,都实测过它们的失效形态,留名以免被"顺手改回去":
//  · `stagedI18nFiles` = 按 `git diff --cached` 列"哪些文件在暂存区",其余一律读**磁盘** ——
//    那句"不在暂存区 ⇒ 工作区与 HEAD 一致"在共享工作区里根本不成立(2026-09-24 记过一次);
//  · `gitBlob(spec)` = 自己 `execFileSync(git show …)`,正是守门 118 的 `loose-git` 档,
//    且它只读正文、不读清单,于是"清单来自 readdirSync(磁盘) + 正文来自提交面"这种
//    自洽却错位的尺子一直成立。两者现由 face-reader 的 catBatch / gitRaw 统一代劳。

/** 读不出/解析失败的语言包 ⇒ 记名,末尾**判红**。
 *  为什么必须记:两处调用点原本 `catch {}` / `catch { continue }` 静默跳过,parity 于是
 *  只比对"剩下的那几门"却照样打印 `通过, N 语言 parity OK`。变异测试实测:一个 `::path`
 *  拼错的 revspec 就让五语言变成四语言而全绿 —— 少一门就少一门的漏检,绝不能算通过。 */
const unreadablePacks = []

/**
 * 语言包的判定面(2026-09-26 收口)。
 *
 * 收口前两处不同面,都实测过:
 *  ① 「同层重复 key / 含点键」那一段一直是裸 `readFileSync`(磁盘) —— 连 `--staged` 也一样,
 *     于是并发会话往 `packages/i18n/messages/**` 写的半成品(本次实测 124 处重复键)
 *     把**完全不含 i18n 改动**的提交钉红 ⇒ 只能 --no-verify ⇒ 约 156 道门一起被跳过(§12e 同型)。
 *  ② 语言包**清单**来自 `readdirSync`(磁盘),**正文**来自提交面 —— 别人在磁盘上新建一个
 *     `xx.json` 就进清单而读不到正文,少一门语言时旧代码会 `catch{continue}` 静默跳过,
 *     parity 于是"四语言也打印通过"(本文件 :212 记过的同型假绿)。
 * 现:清单与正文同面同轮;默认 **HEAD**、`--staged` **索引**、`--worktree` 只作人工/CI
 * 想看磁盘时的逃生舱;两面旗同给 ⇒ exit 2;该面取不到 ⇒ 记 unreadablePacks 并判红,**不回落**另一个面。
 */
const FACE = (() => {
  const staged = process.argv.includes('--staged')
  const worktree = process.argv.includes('--worktree')
  if (staged && worktree) return 'conflict'
  if (staged) return 'index'
  if (worktree) return 'worktree'
  return 'head'
})()
const FACE_LABEL = {
  index: '索引 blob(git ls-files + :<path>)',
  head: 'HEAD blob(git ls-tree HEAD + HEAD:<path>)',
  worktree: '工作树(磁盘,人工逃生舱)',
  conflict: '两面包旗冲突',
}
if (FACE === 'conflict') {
  console.error(
    `${C.red}[i18n 键检查] ❌ --staged 与 --worktree 不得同用(两个判定面互斥,取哪一面都会让另一面成为假绿)${C.reset}`,
  )
  process.exit(2)
}

/** 绝对路径 → 仓内相对路径(git 只认正斜杠形态) */
function relOf(absPath) {
  return relative(REPO_ROOT, absPath).replace(/\\/g, '/')
}

// ---------- 判定面正文取材(2026-09-26 补源面;同面同轮,一次 batch) ----------
// 语言包**与源文件**的正文都从这一层走:清单算出规格 → `prefetchFaceTexts` 一次
// `cat-file --batch` 装满缓存 → 各判据只查缓存。此前源文件扫描(1577 个 .ts/.tsx)在
// 所有模式下都是磁盘 `readFileSync`,而语言包已按面判 —— 于是"清单/正文都来自 HEAD 的包"
// × "引用了并行会话未提交 WIP 键的磁盘源码"会造出**HEAD 面上根本不存在的红**
// (2026-09-26 实测:`sideQueued`/`sideAnswerNow` 只在脏工作树的 message-input.tsx 里,
// HEAD 的源码与五语言包两侧都没有,门却按混合面判红 —— 归因层量到的正是这一型)。
// `--worktree` 档才允许磁盘直读;两个提交面一律不回退磁盘(把"没判"写成"判过了"是守门 94 同型)。
const faceTextCache = new Map()
// 冒号必须在三元**外面**(index 规格是 `:path`,不是裸路径):写成 `? '' : 'HEAD:'` 时
// 索引面产出裸路径,`cat-file --batch` 按对象名解析它并回 missing ⇒ 暂存区永远"读不到"。
// 这个坑在守门 90 的 readLedger 注释里被逐字描述过,本枚改动第一版又踩了一遍,
// 由镜像 F 组(索引面必须读到内容)抓出 —— 判据只能被跑,不能被抄。
const faceSpecOf = (rel) => `${FACE === 'index' ? '' : 'HEAD'}:${rel}`
function prefetchFaceTexts(relList) {
  if (FACE === 'worktree') return
  const specs = [...new Set(relList.filter(Boolean).map(faceSpecOf))].filter(
    (s) => !faceTextCache.has(s),
  )
  if (specs.length === 0) return
  const got = catBatch(REPO_ROOT, specs, { maxBuffer: 1 << 29, timeout: 120000 })
  for (const [k, v] of got) faceTextCache.set(k, typeof v === 'string' ? v : null)
}
/** 按面读一份正文;取不到返回 null(调用方按"该面没有此对象"处置,绝不换面凑)。 */
function faceReadText(rel) {
  if (FACE === 'worktree') return readWorktreeFile(REPO_ROOT, rel)
  const spec = faceSpecOf(rel)
  if (!faceTextCache.has(spec)) prefetchFaceTexts([rel]) // 清单漏算的兜底:仍走层,不派生裸 git show
  const v = faceTextCache.get(spec)
  return typeof v === 'string' ? v : null
}

/**
 * 按判定面列某个语言包目录下的 `.json`。
 * 返回空数组有两种,处置动作不同,所以必须分开说:
 *  · **该面根本没有这个目录**(某个端的语言包尚未入库 / 夹具里就没这目录)⇒ 真的无事可查;
 *  · 目录在而列到 0 个包 ⇒ git 根本表示不了空目录,所以在两个提交面上这两种形态同形,
 *    本函数不区分,交给调用方按"0 语言"走 skip —— **不**把它冒充成"5 语言 parity OK"。
 * git 自身问不到(非仓库 / 超时 / 该面不可达)⇒ 抛 `Undetermined`,由调用方折成 exit 2「无法判定」。
 */
function listPackJsonEntries(dirAbs) {
  const relDir = relOf(dirAbs)
  if (FACE === 'worktree') {
    if (!existsSync(dirAbs)) return []
    return readdirSync(dirAbs).filter((f) => f.endsWith('.json'))
  }
  const depth = relDir.split('/').length
  const out =
    FACE === 'index'
      ? gitRaw(['ls-files', '--', `${relDir}/`], REPO_ROOT)
      : gitRaw(['ls-tree', '--name-only', 'HEAD', '--', `${relDir}/`], REPO_ROOT)
  return (
    out
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((p) => p.replace(/\\/g, '/'))
      // `ls-tree --name-only` 回的是裸名、`ls-files` 回的是全路径,统一成"直接子"两层判据:
      // 只收深度恰好等于 dir+1 的路径,以及 ls-tree 的裸名 —— 漏判会把子目录当成语言包列进来。
      .filter((p) => p.split('/').length === depth + 1 || !p.includes('/'))
      .map((p) => p.split('/').pop())
      .filter((n) => n.endsWith('.json'))
  )
}

/** 按判定面读某个语言包的**原文**(重复键判据要的是字节级文本,不能是 JSON.parse 之后的)。
 *  @param optional 该包允许在此面不存在(shared 基础包按语言可选)⇒ 返回 null;
 *                  必填包取不到一律抛,由调用方记 unreadablePacks 判红 —— 绝不静默少比一门语言。 */
function readPackText(repoRel, { optional = false } = {}) {
  let text = null
  try {
    text = faceReadText(repoRel)
  } catch (e) {
    if (optional) return null
    throw new Error(
      `${FACE_LABEL[FACE]} 取不到 ${repoRel}:${String((e && e.message) || e).split('\n')[0]}(不回落另一个面)`,
    )
  }
  if (text === null) {
    if (optional) return null
    throw new Error(`${FACE_LABEL[FACE]} 取不到 ${repoRel}(该面没有此对象 —— 不回落另一个面)`)
  }
  return text
}

function readMessageJson(absPath) {
  return JSON.parse(readPackText(relOf(absPath)))
}

/** shared 基础包:某一语言可以只有端包没有 shared 包(现状如此),所以是 optional 读。 */
function readSharedBaseJson(absPath) {
  const t = readPackText(relOf(absPath), { optional: true })
  return t === null ? null : JSON.parse(t)
}

/** 原文出口(重复键 / 含点键判据用):同一次判定面、同一个"取不到就记名"口径。 */
function readMessageRaw(absPath) {
  return readPackText(relOf(absPath))
}

// 2026-09-07: staged 模式缺失键降级判定——工作区(含并行会话未暂存 WIP)消息。
// 场景:并行会话往工作区 zh-CN 加了新键(未暂存)且其组件(也未暂存)引用了它们;
// 本脚本 staged 模式 parity/缺失键以暂存 blob 为准(正确),但源码扫描读工作区(保护
// key 删除场景),会把"WIP 键 + WIP 组件"误判为缺失键,阻塞无关 commit。
// 规则:键存在于工作区 base 语言消息、但不在暂存 blob → 键由未暂存 WIP 新增,
// 非本 commit 范畴 → 从 ERROR 降级为 WARNING(不阻断);两边都缺 → 真缺失,照常 ERROR。
let _worktreeMerged = null
function worktreeBaseHas(ns, key) {
  if (!isStaged) return false
  if (_worktreeMerged === null) {
    _worktreeMerged = {}
    if (existsSync(MESSAGES_DIR)) {
      for (const entry of readdirSync(MESSAGES_DIR)) {
        if (!entry.endsWith('.json')) continue
        let targetMsg = {}
        try {
          targetMsg = JSON.parse(readFileSync(join(MESSAGES_DIR, entry), 'utf8'))
        } catch {
          continue
        }
        let sharedMsg = {}
        if (existsSync(SHARED_DIR)) {
          const sharedPath = join(SHARED_DIR, entry)
          if (existsSync(sharedPath)) {
            try {
              sharedMsg = JSON.parse(readFileSync(sharedPath, 'utf8'))
            } catch {}
          }
        }
        _worktreeMerged[entry.replace('.json', '')] = deepMerge(sharedMsg, targetMsg)
      }
    }
  }
  const base = _worktreeMerged[BASE_LANG]
  return Boolean(base && hasKey(base, ns, key))
}

function loadMessages() {
  const langs = {}
  // 清单与正文同一判定面(见 listPackJsonEntries 的理由)。旧写法是 `existsSync` + `readdirSync`
  // —— 磁盘列清单、提交面读正文,那把尺子自洽却基准错位。
  const entries = listPackJsonEntries(MESSAGES_DIR)
  if (entries.length === 0) return langs
  // 一次 batch 装满本面所有语言包正文(目标包 + 非 shared 模式下的 shared base)——
  // 逐包 catBatch 是 N 次派生;清单此刻已全部在手,必须同轮读满。
  {
    const rels = entries
      .filter((e) => e.endsWith('.json'))
      .flatMap((entry) =>
        isShared || isCli
          ? [relOf(join(MESSAGES_DIR, entry))]
          : [relOf(join(MESSAGES_DIR, entry)), relOf(join(SHARED_DIR, entry))],
      )
    prefetchFaceTexts(rels)
  }
  // shared 模式:仅读 MESSAGES_DIR(=== SHARED_DIR),不合并
  if (isShared || isCli) {
    for (const entry of entries) {
      if (!entry.endsWith('.json')) continue
      try {
        langs[entry.replace('.json', '')] = readMessageJson(join(MESSAGES_DIR, entry))
      } catch (e) {
        unreadablePacks.push({
          file: `shared/<${entry}>`,
          why: String((e && e.message) || e).slice(0, 130),
        })
      }
    }
    return langs
  }
  // web/extension 非 shared 模式:读 shared + 端合并集(shared base,端 override)
  // 端的 key 覆盖 shared 同名 key,shared 提供跨端共享基础 key
  for (const entry of entries) {
    if (!entry.endsWith('.json')) continue
    let targetMsg
    try {
      targetMsg = readMessageJson(join(MESSAGES_DIR, entry))
    } catch (e) {
      unreadablePacks.push({ file: entry, why: String((e && e.message) || e).slice(0, 130) })
      continue
    }
    // 读 shared/<lang>.json 作为 base。某一语言可以只有端包没有 shared 包(现状如此),
    // 所以是 optional 读:该面没有此对象 ⇒ 空 base,而不是"读不到就判红"。
    let sharedMsg = {}
    try {
      const base = readSharedBaseJson(join(SHARED_DIR, entry))
      if (base !== null) sharedMsg = base
    } catch (e) {
      unreadablePacks.push({
        file: `base:${entry}`,
        why: String((e && e.message) || e).slice(0, 130),
      })
    }
    langs[entry.replace('.json', '')] = deepMerge(sharedMsg, targetMsg)
  }
  return langs
}

// 深合并:shared 作为 base,端 override 优先(端版本的 key 覆盖 shared 同名 key)
// 用于 web/extension 非 shared 模式与 shared 合并校验(方案 A)
// 自己实现,不引入新依赖(check-i18n-keys.mjs 是 .mjs 脚本,不能直接 import TS loader)
// 2026-09-04 修复:string→object 类型冲突时 override 必须整体替换 base
// (原 `if (!base) return override` 只判 falsy;当 base 为 shared 的字符串 leaf、
//  override 为端上的对象子树时,会走 Object.entries(字符串) 分支把
//  "0","1","2"… 字符索引误当作键,产生 wallet.recharge.2..7 之类的假 parity 漂移)
function deepMerge(base, override) {
  if (override === undefined) return base
  if (base === undefined || base === null) return override
  const bothObjects =
    typeof base === 'object' &&
    !Array.isArray(base) &&
    typeof override === 'object' &&
    !Array.isArray(override)
  if (!bothObjects) return override
  const result = { ...base }
  for (const key of Object.keys(override)) {
    result[key] = deepMerge(base[key], override[key])
  }
  return result
}

// 加载 brand-glossary.json 的 brands / fonts / terms / commonTech 全部 value
// 用于 Gate 3 过滤已知品牌/技术术语(大小写不敏感)
const GLOSSARY_VALUES = new Set()
function loadGlossary() {
  try {
    const path = join(REPO_ROOT, 'scripts/brand-glossary.json')
    if (!existsSync(path)) return
    const data = JSON.parse(readFileSync(path, 'utf8'))
    for (const section of ['brands', 'fonts', 'terms', 'commonTech']) {
      if (data[section]) {
        for (const v of Object.values(data[section])) {
          GLOSSARY_VALUES.add(String(v).toLowerCase())
        }
      }
    }
  } catch {}
}
loadGlossary()

// Gate 1: 符号/代码标记 — 含 +/\{}<>*~^=#$%@&_`:| → 跳过
const CODE_SYMBOL_RE = /[+\/\\{}<>*~^=#$%@&_`:\x7c]/
function passesGate1(value) {
  return !CODE_SYMBOL_RE.test(value)
}

// Gate 2: 长度 + 词数 — length < 15 或 词数 ≤ 2 → 跳过
function passesGate2(value) {
  const len = value.length
  const words = value.split(/\s+/).filter(Boolean).length
  return !(len < 15 || words <= 2)
}

// Gate 3: 品牌/专名 — glossary / camelCase / 全大写缩写 → 跳过
const CAMEL_CASE_RE = /^[A-Z][a-z]+(?:[A-Z][a-zA-Z]*)+$/
function passesGate3(value) {
  if (GLOSSARY_VALUES.has(value.toLowerCase())) return false
  if (CAMEL_CASE_RE.test(value)) return false
  const words = value.split(/\s+/).filter(Boolean)
  if (words.length > 0 && words.length <= 5 && words.every((w) => /^[A-Z][A-Z0-9\-&]*$/.test(w))) {
    return false
  }
  return true
}

// Gate 4: 句子结构 — 含自然语言标记词或长度 > 25 → 标记为未翻译
const SENTENCE_MARKER_RE =
  /\b(the|a|an|is|are|was|were|be|been|being|you|your|yours|i|me|my|we|us|our|they|them|their|this|that|these|those|to|for|with|from|in|on|at|by|of|and|or|but|not|no|if|then|else|when|where|why|how|what|which|who|whom|can|could|will|would|should|may|might|must|shall|do|does|did|have|has|had)\b/i
function passesGate4(value) {
  return SENTENCE_MARKER_RE.test(value) || value.length > 25
}

// 综合判断:4 道 gate 全部通过 → 真未翻译(需要人工补译)
function isGenuineUntranslated(value) {
  return passesGate1(value) && passesGate2(value) && passesGate3(value) && passesGate4(value)
}

function getNested(obj, dotPath) {
  return dotPath.split('.').reduce((acc, k) => {
    if (acc && typeof acc === 'object' && k in acc) return acc[k]
    return undefined
  }, obj)
}

function collectLeafKeys(obj, prefix = '') {
  const keys = []
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      keys.push(...collectLeafKeys(v, path))
    } else {
      keys.push(path)
    }
  }
  return keys
}

function collectLeafValues(obj, prefix = '') {
  const map = new Map()
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      for (const [p, val] of collectLeafValues(v, path)) {
        map.set(p, val)
      }
    } else {
      map.set(path, v)
    }
  }
  return map
}

function extractNamespaces(src) {
  const pairs = []
  // 2026-07-30: 支持无参数调用 useTranslations() / getTranslations()(根 namespace,ns='')
  // 原 regex 要求必须有引号参数,导致 PageClient.tsx(const t = useTranslations())被跳过,
  // 其 t('design.saved') / t('design.export.exportSuccess') 等 5 个 missing key 漏检。
  // (?:['"]([^'"]+)['"])? 使引号参数可选,无参数时 ns = ''
  const re =
    /(?:const|let|var)\s+(\w+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\(\s*(?:['"]([^'"]+)['"])?\s*\)/g
  let m
  while ((m = re.exec(src)) !== null) {
    pairs.push({ varName: m[1], ns: m[2] ?? '' })
  }
  return pairs
}

function extractKeysByVar(src, varName) {
  const escaped = varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const keys = new Set()
  // 2026-07-30: 同时匹配 t('xxx') / t.rich('xxx') / t.raw('xxx') / t.format('xxx') / t.has('xxx')
  // 原 regex 只匹配 t('xxx'),导致 t.rich('note5') / t.raw('items') 等 key 漏检
  const re = new RegExp(`\\b${escaped}(?:\\.(?:rich|raw|format|has))?\\(\\s*['"]([^'"]+)['"]`, 'g')
  let m
  while ((m = re.exec(src)) !== null) {
    keys.add(m[1])
  }
  return [...keys]
}

function hasKey(msg, ns, key) {
  // 2026-07-30: ns='' 表示根 namespace(useTranslations() 无参数调用)
  // 原 bug:getNested(msg, '') 返回 undefined(''.split('.')=[''],msg 无 '' key),
  // 导致所有根 namespace 的 t('design.saved') 等 key 误报 missing。
  // 修复:ns='' 时直接用 msg 作为根对象。
  const nsObj = ns === '' ? msg : getNested(msg, ns)
  if (!nsObj || typeof nsObj !== 'object') return false
  if (key.includes('.')) {
    return getNested(nsObj, key) !== undefined
  }
  return key in nsObj
}

// ─── 动态(模板/拼接)键的静态前缀可达性 ─────────────────────
// t(`lane.${x}`) 这类"点分隔"动态键,前面 extractKeysByVar 只看字面量 t('a.b'),
// 完全覆盖不到 —— 2026-09-20 en/ko 那 44 处"UI 直接显示 lane.architect / event.tool.before"
// 就是这么漏掉的(键被写成扁平含点键,前缀根本不是对象)。规则:点分隔的静态前缀
// 必须在**每种语言**里都是对象节点(只查前缀,不猜动态段的取值,避免误报)。
// 2026-09-21 实测全仓 apps/web + packages/ui-react + packages/app 共 76 处点分隔动态键,
// 扣除注释里的历史说明后违规 0,故可直接 blocking。
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')
}

function extractDynamicPrefixes(src, varName) {
  const esc = varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const prefixes = new Set()
  // t(`a.b.${x}`) / t.rich(`a.${x}`) —— 只取以 "." 收尾的静态头部(点分隔型)
  const reTpl = new RegExp(`\\b${esc}(?:\\.(?:rich|raw|format|has))?\\(\\s*\`([^\`$]*)\\\$\{`, 'g')
  let m
  while ((m = reTpl.exec(src)) !== null) {
    const before = m[1]
    if (before.endsWith('.')) prefixes.add(before.replace(/\.$/, ''))
  }
  // t('a.b.' + x)
  const reCat = new RegExp(
    `\\b${esc}(?:\\.(?:rich|raw|format|has))?\\(\\s*(['"])([^'"]*\\.)\\1\\s*\\+`,
    'g',
  )
  while ((m = reCat.exec(src)) !== null) prefixes.add(m[2].replace(/\.$/, ''))
  return [...prefixes]
}

const dynamicPrefixIssues = []

// 判定面问不到(git 失败 / 非仓库 / 该面不可达)= **无法判定**,不是"没有违规"。
// 旧写法这一带是 `catch {}` / `continue`,少一门语言照样打印"5 语言 parity OK" ——
// 本文件 :183 记过的同型假绿,以及守门 70「空暂存恒绿」、守门 78「扫到 0 条一律判红」同族。
let messages
try {
  messages = loadMessages()
} catch (e) {
  console.error(
    `${C.red}[i18n 键检查] ❌ ${FACE_LABEL[FACE]} 无法取材:${String((e && e.message) || e).slice(0, 200)}${C.reset}`,
  )
  console.error('   这不是"没有违规" —— 判据没跑成就不记为通过,也不冒红成判据失败。')
  process.exit(2)
}
const langNames = Object.keys(messages).sort()

if (langNames.length === 0) {
  // 该面没有可比的语言包。两种成因必须分开:清单为空(这个端在该面尚未入库 ⇒ 无事可查,
  // 与迁移前的 skip 语义一致);**清单非空而每一包都读失败**(读不到还"跳过"就是
  // "四语言也打印通过"的同型假绿,本文件 :183 反过来钉过它一次 ⇒ 判"无法判定")。
  if (unreadablePacks.length > 0) {
    console.error(
      `${C.red}[i18n 键检查] ❌ ${FACE_LABEL[FACE]} 一个可比语言包都没取到(${unreadablePacks.length} 处取材失败)⇒ 无法判定,不按"无事可查"跳过${C.reset}`,
    )
    for (const u of unreadablePacks.slice(0, 6)) console.error(`   · ${u.file} — ${u.why}`)
    process.exit(2)
  }
  console.log(
    `${C.yellow}[i18n 键检查] ${FACE_LABEL[FACE]} 无 ${relOf(MESSAGES_DIR)} 语言包,跳过${C.reset}`,
  )
  console.log(`判定面:${FACE_LABEL[FACE]}`)
  process.exit(0)
}

if (!messages[BASE_LANG]) {
  // 有语言包、却拿不到基准语言(zh-CN)⇒ parity 没有可比的那一侧。
  // 旧写法在这里与上一条合并成 exit 0 "跳过",于是"zh-CN 读坏了"与"这个端还没有语言包"
  // 是同一种绿 —— 而前者恰恰是本文件对 ko.json 已经反转过的假绿形态(见 9b)。
  console.error(
    `${C.red}[i18n 键检查] ❌ ${FACE_LABEL[FACE]} 拿不到基准语言 ${BASE_LANG}(已取到 ${langNames.length} 门:${langNames.join(', ')})⇒ 无法判定${C.reset}`,
  )
  process.exit(2)
}

const baseLeaves = new Set(collectLeafKeys(messages[BASE_LANG]))

let sourceFiles = []
let messagesChanged = false

if (isStaged) {
  try {
    const output = execSync('git diff --cached --name-only --diff-filter=ACM', {
      encoding: 'utf8',
      cwd: REPO_ROOT,
      windowsHide: true,
    })
    const staged = output.split('\n').filter(Boolean)
    messagesChanged = staged.some(
      (f) => f.endsWith('.json') && STAGED_MESSAGES_PREFIXES.some((p) => f.startsWith(p)),
    )
    if (isParityOnly) {
      // parity-only 模式跳过源码使用检测(extension useI18n() 不适用;shared 无源码消费方)
      sourceFiles = []
    } else if (messagesChanged) {
      // 按面全量枚举(2026-09-26):旧写法遍历磁盘 —— HEAD 面下它会把并发会话未提交的
      // WIP 组件算进"本提交引用了未登记键",而那份源码根本不进这枚提交(实测 sideQueued 型假红)。
      sourceFiles = APP_SRC_DIR
        ? listSourceFilesOnFace(APP_SRC_DIR)
        : listSourceFilesOnFace(WEB_DIR)
    } else {
      sourceFiles = staged
        .filter(
          (f) => f.startsWith(STAGED_SOURCE_PREFIX) && (f.endsWith('.ts') || f.endsWith('.tsx')),
        )
        .filter((f) => {
          const rel = f.slice(STAGED_SOURCE_PREFIX.length)
          return (
            !rel.startsWith('messages/') &&
            !rel.startsWith('.next/') &&
            !rel.startsWith('node_modules/') &&
            // 2026-08-29 修复:staged 模式与 collectSourceFiles(全量模式)的排除规则
            // 对齐。原实现只排除 messages/.next/node_modules 前缀,漏掉 EXCLUDE_DIRS
            // (tests/__tests__/e2e 等),导致测试 fixture 自造的 t('test.count') 等
            // 假键被误判为 i18n 缺失键而阻断提交(全量模式下这些目录本就被跳过)。
            !rel.split('/').some((seg) => EXCLUDE_DIRS.has(seg))
          )
        })
        .map((f) => join(REPO_ROOT, f))
      // 2026-09-26:去掉 `.filter(existsSync)` —— 它按磁盘判"在不在",而正文按索引读。
      // 暂存后又被并行会话从磁盘删掉的文件,旧写法会整条丢弃(该判的没判),
      // 面口径下它照常进清单,索引取不到正文时由取材循环如实跳过(见 prefetch 处的报数)。
    }
  } catch {
    sourceFiles = []
  }
} else if (!isParityOnly) {
  sourceFiles = APP_SRC_DIR ? listSourceFilesOnFace(APP_SRC_DIR) : listSourceFilesOnFace(WEB_DIR)
}
// parity-only 非 staged 模式:sourceFiles 保持 [] (跳过源码使用检测,只做 key parity)

// parity-only 模式无源码扫描,仅靠 parity 校验驱动,不能因 sourceFiles 空 + messagesChanged 假就跳过
if (!isParityOnly && sourceFiles.length === 0 && !messagesChanged) {
  console.log(`${C.green}[i18n 键检查] 无源文件变更,跳过${C.reset}`)
  console.log(`判定面:${FACE_LABEL[FACE]}`)
  process.exit(0)
}

// parity-only 暂存区无 i18n JSON 改动时跳过(避免无关 commit 触发 parity 校验)
// 例外: --parity-only 显式标记必须跑(guardian-runner 2n-web 项,即使没改 i18n JSON 也要验)
if (isParityOnly && isStaged && !messagesChanged && !isParityOnlyFlag) {
  console.log(`${C.green}[i18n 键检查] ${TARGET} 模式:暂存区无 i18n JSON 改动,跳过${C.reset}`)
  console.log(`判定面:${FACE_LABEL[FACE]}`)
  process.exit(0)
}

const parityIssues = []

// 严格 parity 模式(--parity-only 显式标记):即使 staged + 无 messagesChanged 也跑 parity
if (!isStaged || messagesChanged || isParityOnlyFlag) {
  for (const lang of langNames) {
    if (lang === BASE_LANG) continue
    const langLeaves = new Set(collectLeafKeys(messages[lang]))
    const baseOnly = [...baseLeaves].filter((k) => !langLeaves.has(k))
    const langOnly = [...langLeaves].filter((k) => !baseLeaves.has(k))
    if (baseOnly.length > 0) {
      parityIssues.push({
        lang,
        direction: 'base-only',
        count: baseOnly.length,
        keys: baseOnly.slice(0, 20),
        total: baseOnly.length,
      })
    }
    if (langOnly.length > 0) {
      parityIssues.push({
        lang,
        direction: 'lang-only',
        count: langOnly.length,
        keys: langOnly.slice(0, 20),
        total: langOnly.length,
      })
    }
  }
}

// 翻译完整性检查:对非 en 的语言,值 === en 值 且仅含 ASCII 字母,标记为"未翻译"
// 仅作为 WARNING(不阻塞),用于发现历史上 i18n 复制粘贴导致的英文 fallback
// extension 模式跳过:翻译已人工校对,key 数量少,且 extension 用 useI18n() 不走 next-intl
// 4-gate 过滤:品牌/技术术语/快捷键/单位/代码/营销标题/LLM API 参数不视为未翻译
const untranslatedValueIssues = []
const TRANSLATABLE_LANGS = ['ja', 'ko', 'zh-CN', 'zh-TW']
if (!isParityOnly && (!isStaged || messagesChanged)) {
  const enLeaves = collectLeafValues(messages.en || {})
  for (const lang of TRANSLATABLE_LANGS) {
    if (lang === 'en' || !messages[lang]) continue
    const langValues = collectLeafValues(messages[lang])
    const untranslated = []
    for (const [key, enValue] of enLeaves) {
      if (typeof enValue !== 'string' || enValue.length < 2) continue
      if (!/^[A-Za-z0-9 ._!?'",:;\-/()&+@#$%^*=]+$/.test(enValue)) continue
      const langValue = langValues.get(key)
      if (langValue === enValue) {
        if (isGenuineUntranslated(enValue)) {
          untranslated.push({ key, value: enValue })
        }
      }
    }
    if (untranslated.length > 0) {
      untranslatedValueIssues.push({
        lang,
        count: untranslated.length,
        samples: untranslated.slice(0, 10),
      })
    }
  }
}

// ── 端内 hook(t()/tt())引用键提取(2026-09,mobile-rn/miniapp-taro 专用) ──
// 惯例:const { t } = useI18n()(mobile-rn) / const { tt } = useAppTheme()(miniapp-taro)
// 两者签名均为 (key, zhFallback) —— key 为点分路径,zhFallback 仅词典缺键时兜底显示。
// namespace 由端内 lib/i18n.ts / lib/theme.ts 的 zh-CN 兜底词典顶层键决定。
const FALLBACK_DICTS = {
  'mobile-rn': 'apps/mobile-rn/src/lib/i18n.ts',
  'miniapp-taro': 'apps/miniapp-taro/src/lib/theme.ts',
}

// 从 TS 源文件中提取 `export const messagesZhCN = { ... }` 对象字面量并求值
// (词典是纯字符串字面量对象,用大括号平衡切片 + new Function 安全求值)
function loadFallbackDict(target) {
  const rel = FALLBACK_DICTS[target]
  if (!rel) return null
  // 兜底词典也是被审内容:与源文件/语言包同一判定面读(2026-09-26;旧写法 readFileSync 磁盘,
  // 在 HEAD/staged 面下等于"源码按面判、词典按磁盘判"的第三次错面)。
  let src
  try {
    src = faceReadText(rel)
  } catch {
    return null
  }
  if (src === null) return null
  try {
    const m = /messagesZhCN\s*[:=]/.exec(src)
    if (!m) return null
    let start = src.indexOf('{', m.index)
    // 若声明后首个 { 是类型注解(Record<string, ...>)的字面量,跳过到值对象
    if (/:\s*Record<[^>]*>\s*=\s*\{/.test(src.slice(m.index, start + 1))) {
      start = src.indexOf('{', start + 1)
    }
    if (start < 0) return null
    let depth = 0
    let end = -1
    for (let i = start; i < src.length; i++) {
      const ch = src[i]
      if (ch === '{') depth++
      else if (ch === '}') {
        depth--
        if (depth === 0) {
          end = i
          break
        }
      }
    }
    if (end < 0) return null
    // 词典是 TS 对象字面量:优先 JSON5(单引号/尾逗号合法);不可用则剥注释+尾逗号退 JSON.parse
    const objSrc = src.slice(start, end + 1)
    if (JSON5) {
      try {
        return JSON5.parse(objSrc)
      } catch {}
    }
    const cleaned = objSrc
      .replace(/\/\/[^\n]*/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/,\s*([}\]])/g, '$1')
    return JSON.parse(cleaned)
  } catch {
    return null
  }
}
const FALLBACK_DICT = isMobileRn || isMiniappTaro ? loadFallbackDict(TARGET) : null

function extractHookKeys(src) {
  // 端内翻译函数变量有两大类绑定形态,缺一即整文件漏检(2026-09-21 补盲):
  //  ① 解构式:const { t } = useI18n() / const { tt } = useAppTheme()
  //     旧正则把 `{ t }` 写死成"左花括号后紧跟 t|tt 且立刻右花括号",
  //     于是 const { t, tList } = useI18n()(实测 14 处)整行不匹配 → 这些文件的
  //     t() 引用一个都没被查过。现改为解析解构内部条目,仅取源键 t / tt,
  //     支持重命名(const { t: tr } = useI18n());tList 是列表解析器不是翻译函数,不纳入。
  //  ② 非解构直接赋值:const tt = useTt()(miniapp-taro 带回退翻译 hook,实测 155 文件)
  //     useTt 签名 (key, zhFallback),词典缺键时回退内联简体中文 → en/ko/ja/zh-TW 下
  //     恒显示简体,是真实可见缺陷。命名覆盖 useT / useXxxTt;刻意不匹配 useTts
  //     (text-to-speech),因为 "Tts" 不等于 "Tt",且 useT 分支要求紧跟 "("。
  // 误报防线:全程只在"去注释后的代码"上跑。扩视野后 miniapp-taro 从 91 个文件涨到
  //   212 个,注释里的示例(如 `// 禁止 tt('p1','发') 这种劈词拼接`)会被真 tt 绑定扫到,
  //   把文档注释当成引用键。真实引用一定在代码里,剥注释只会去噪,不会漏检。
  const code = stripComments(src)
  const varNames = new Set()
  let m
  const destructureRe = /const\s*\{([^{}]*)\}\s*=\s*(?:useI18n|useAppTheme)\s*\(/g
  while ((m = destructureRe.exec(code)) !== null) {
    for (const raw of m[1].split(',')) {
      const entry = raw.trim()
      if (!entry) continue
      const [sourceKey, localName] = entry.split(':').map((s) => s.trim())
      if (sourceKey === 't' || sourceKey === 'tt') varNames.add(localName || sourceKey)
    }
  }
  const directAssignRe =
    /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:useT|use[A-Za-z0-9_]*Tt)\s*\(/g
  while ((m = directAssignRe.exec(code)) !== null) varNames.add(m[1])
  const keys = []
  for (const v of varNames) {
    const escaped = v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    // key 必须是引号字面量;模板字符串/动态拼接跳过(无法静态判定)
    const re = new RegExp(`\\b${escaped}\\(\\s*['"]([^'"]+)['"]`, 'g')
    let k
    while ((k = re.exec(code)) !== null) keys.push(k[1])
  }
  return [...new Set(keys)]
}

// 端内模式:key 在「合并词典(shared+端 JSON)」或「zh-CN 兜底词典」任一处存在即通过。
// hasKey(msg, ns='', key) 语义:把完整点分 key 当根对象路径查找——与 next-intl 的扁平/嵌套两种形态兼容。
function hasKeyInMergedOrDict(key) {
  if (hasKey(messages[BASE_LANG], '', key)) return true
  if (FALLBACK_DICT && getNested(FALLBACK_DICT, key) !== undefined) return true
  return false
}

const missingKeyIssues = []
// 2026-09-07:因"键仅存在于工作区 WIP 消息(未暂存)"而降级的缺失键,仅告警不阻断
const wipMissingKeyIssues = []

// 分流:键在工作区 base 消息存在但暂存 blob 缺失 → 并行 WIP 新增键,降级 WARNING;
// 否则照常进 ERROR 清单(真缺失)。
function pushMissingKeyIssue(issue) {
  if (isStaged && worktreeBaseHas(issue.ns, issue.key)) {
    wipMissingKeyIssues.push(issue)
  } else {
    missingKeyIssues.push(issue)
  }
}

let checkedFiles = 0
let checkedKeys = 0
// 该面取不到的源文件数(清单来自面 ⇒ 正文也应来自面;读不到不再假装扫过,末行如实报数)。
let sourceUnread = 0
if (sourceFiles.length > 0) {
  // 同轮批量装满正文(端兜底词典一并预取)。派生失败 ⇒ exit 2「无法判定」,绝不静默少扫。
  try {
    const rels = sourceFiles.map(relOf)
    if (FALLBACK_DICTS[TARGET]) rels.push(FALLBACK_DICTS[TARGET])
    prefetchFaceTexts(rels)
  } catch (e) {
    console.error(
      `${C.red}[i18n 键检查] ❌ ${FACE_LABEL[FACE]} 源文件批量取材失败:${String((e && e.message) || e).slice(0, 200)}${C.reset}`,
    )
    console.error('   这不是"没有违规" —— 判据没跑成就不记为通过,也不冒红成判据失败。')
    process.exit(2)
  }
}

for (const file of sourceFiles) {
  let src
  try {
    src = faceReadText(relOf(file))
    if (src === null) {
      sourceUnread++
      continue
    }
  } catch {
    sourceUnread++
    continue
  }

  // 端内模式(mobile-rn/miniapp-taro):用 hook 解构提取 + 合并词典/兜底词典双查
  if (isMobileRn || isMiniappTaro) {
    // 先去注释:注释里举的反例(如 `禁止 "…后重" + tt('p1','发') 这种拼接`)会被
    // 当成真实调用点提取出 p1,而它本就不是键 —— 注释不参与渲染,不该计入缺失。
    const keys = extractHookKeys(stripComments(src))
    if (keys.length === 0) continue
    checkedFiles++
    checkedKeys += keys.length
    const relPath = relative(REPO_ROOT, file)
    for (const key of keys) {
      if (!hasKeyInMergedOrDict(key)) {
        pushMissingKeyIssue({ file: relPath, ns: '(hook)', key, varName: 't/tt' })
      }
    }
    continue
  }

  const nsPairs = extractNamespaces(src)
  if (nsPairs.length === 0) continue

  const seen = new Set()
  const usedKeys = []

  // 2026-08-16: 多命名空间同名 hook 变量增强
  // 当同一文件内同一 varName 被多个 useTranslations('ns') 调用时,
  // extractKeysByVar 基于文件级正则,无法区分每个 key 属于哪个 ns,
  // 因此对该 varName 的所有 keys 降级为宽松检查(key 在任一 ns 中存在即通过),
  // 避免把 auth 命名空间的键误判为根命名空间缺失。
  const varNsMap = new Map()
  for (const { varName, ns } of nsPairs) {
    if (!varNsMap.has(varName)) varNsMap.set(varName, new Set())
    varNsMap.get(varName).add(ns)
  }

  for (const { varName } of nsPairs) {
    for (const key of extractKeysByVar(src, varName)) {
      const dedupe = `${varName}::${key}`
      if (seen.has(dedupe)) continue
      seen.add(dedupe)
      usedKeys.push({ key, varName })
    }
  }

  // 动态(模板/拼接)键的静态前缀可达性:与字面量键彼此独立,故放在 usedKeys 早退之前
  const srcNoComment = stripComments(src)
  let fileHasDynamicFindings = false
  for (const { varName } of nsPairs) {
    for (const prefix of extractDynamicPrefixes(srcNoComment, varName)) {
      const nsSet = varNsMap.get(varName)
      const langsMissing = []
      for (const [lang, msg] of Object.entries(messages)) {
        const ok = [...nsSet].some((ns) => {
          const node = ns ? getNested(msg, `${ns}.${prefix}`) : getNested(msg, prefix)
          return node && typeof node === 'object' && !Array.isArray(node)
        })
        if (!ok) langsMissing.push(lang)
      }
      if (langsMissing.length > 0) {
        fileHasDynamicFindings = true
        const shown = [...nsSet].map((ns) => (ns ? `${ns}.${prefix}` : prefix)).join(' / ')
        dynamicPrefixIssues.push(
          `${relative(REPO_ROOT, file)} | ${varName}(\`${prefix}.\${…}\`) 静态前缀 "${shown}" 在 ${langsMissing.join(', ')} 不是对象节点`,
        )
      }
    }
  }

  if (usedKeys.length === 0 && !fileHasDynamicFindings) continue
  checkedFiles++
  checkedKeys += usedKeys.length

  const relPath = relative(REPO_ROOT, file)

  for (const { key, varName } of usedKeys) {
    const nsSet = varNsMap.get(varName)
    if (nsSet.size === 1) {
      // 严格检查:key 必须在其唯一的 namespace 下存在
      const ns = [...nsSet][0]
      const existsInBase = hasKey(messages[BASE_LANG], ns, key)
      if (!existsInBase) {
        pushMissingKeyIssue({
          file: relPath,
          ns,
          key,
          varName,
        })
      }
    } else {
      // 多命名空间同名变量:宽松检查,key 在任一 namespace 下存在即通过
      const existsInAny = [...nsSet].some((n) => hasKey(messages[BASE_LANG], n, key))
      if (!existsInAny) {
        // 在所有 ns 中都不存在,报告所有缺失的 ns
        for (const n of nsSet) {
          if (!hasKey(messages[BASE_LANG], n, key)) {
            pushMissingKeyIssue({
              file: relPath,
              ns: n,
              key,
              varName,
            })
          }
        }
      }
    }
  }
}

const label = isStaged ? 'ERROR' : 'WARNING'
const color = isStaged ? C.red : C.yellow

if (parityIssues.length > 0) {
  console.log(`${color}[i18n 键检查] Parity 问题(${parityIssues.length}个) [${label}]:${C.reset}`)
  for (const issue of parityIssues) {
    if (issue.direction === 'base-only') {
      console.log(`${color}  ${BASE_LANG} 有但 ${issue.lang} 缺失的键(${issue.total}个):${C.reset}`)
    } else {
      console.log(`${color}  ${issue.lang} 有但 ${BASE_LANG} 无的键(${issue.total}个):${C.reset}`)
    }
    console.log(
      `${color}    ${issue.keys.join('\n    ')}${issue.total > 20 ? '\n    ...' : ''}${C.reset}`,
    )
  }
  console.log('')
}

if (missingKeyIssues.length > 0) {
  const byFile = new Map()
  for (const issue of missingKeyIssues) {
    if (!byFile.has(issue.file)) byFile.set(issue.file, new Map())
    const nsMap = byFile.get(issue.file)
    if (!nsMap.has(issue.ns)) nsMap.set(issue.ns, [])
    nsMap.get(issue.ns).push(issue.key)
  }

  console.log(
    `${color}[i18n 键检查] 缺失键问题(${missingKeyIssues.length}个) [${label}]:${C.reset}`,
  )
  for (const [file, nsMap] of byFile) {
    console.log(`${color}  ${file}:${C.reset}`)
    for (const [ns, keys] of nsMap) {
      console.log(`${color}    命名空间 [${ns}] 缺失 ${keys.length} 键:${C.reset}`)
      console.log(`${color}      ${keys.map((k) => `'${k}'`).join(', ')}${C.reset}`)
    }
  }
  console.log('')
}

// 翻译完整性:未翻译键(值 === en,非阻塞 WARNING,仅信息)
if (untranslatedValueIssues.length > 0) {
  const totalUntranslated = untranslatedValueIssues.reduce((s, i) => s + i.count, 0)
  console.log(
    `${C.yellow}[i18n 翻译] 未翻译键(值===en,仅 ASCII) — ${totalUntranslated} 处待人工补译:${C.reset}`,
  )
  for (const issue of untranslatedValueIssues) {
    console.log(`${C.yellow}  ${issue.lang}: ${issue.count} 个未翻译键${C.reset}`)
    for (const s of issue.samples) {
      console.log(`${C.dim}    ${s.key} = "${s.value}"${C.reset}`)
    }
    if (issue.count > issue.samples.length) {
      console.log(`${C.dim}    ... 还有 ${issue.count - issue.samples.length} 个${C.reset}`)
    }
  }
  console.log(`${C.dim}  → 修复:为这些键添加非英文翻译(或保留 en fallback 如有意为之)${C.reset}`)
  console.log('')
}

// 2026-08-20: missing key 收紧为 blocking(历史 194 个 missing 已清零,见 2026-07-30 遗留说明)
// 背景:此前 missing key 只 warning 不阻塞(pre-commit 形同虚设),导致
//   common.tools.categoryEfficiency 等"源码引用但消息缺失"的键漏到浏览器才暴露。
//   full 扫描确认当前 0 个 missing key,收紧为 blocking 不再误伤历史 commit。
// 策略:missing key + parity 均 blocking(源码引用的 key 必须在消息中定义,这是硬性契约)。
//   full 模式(CI)与 staged 模式(pre-commit)都会阻塞,防止新引入未定义 i18n 键。
// 2026-09-07:仅存在于工作区 WIP 消息(未暂存)的缺失键降级为 WARNING,不参与 shouldBlock。
if (wipMissingKeyIssues.length > 0) {
  console.log(
    `${C.yellow}[i18n 键检查] WIP 降级键(${wipMissingKeyIssues.length}个,键由未暂存 WIP 消息新增,非本 commit 范畴,仅告警):${C.reset}`,
  )
  const byFile = new Map()
  for (const i of wipMissingKeyIssues) {
    if (!byFile.has(i.file)) byFile.set(i.file, [])
    byFile.get(i.file).push(i.key)
  }
  for (const [file, keys] of byFile) {
    console.log(
      `${C.yellow}  ${file}: ${keys.length} 键(样例 ${keys.slice(0, 3).join(', ')})${C.reset}`,
    )
  }
  console.log('')
}
// next-intl/use-intl 按 "." 路径解析消息,字面含点 key(如 "foldPolicy.title")永远不可达:
// 渲染时走 MISSING_MESSAGE 兜底,UI 上直接回显键名本身。2026-09-20 实测 web 语言包曾有 84 个
// 这类 key,其中 en/ko 各 22 个(subAgentFeed.lane.*、agentHooks.event.*、integrations.event.*)
// 在开发者面板里真的显示成了 "event.tool.before" 这样的原始键名。含点 key 必须改成嵌套结构。
const dottedKeyIssues = []
// 同层重复 key:JSON.parse 静默保留最后一个值(AGENTS.md §18 禁止但此前无闸门)。
// 同日实测:把含点键改成嵌套时,若同层已有真身嵌套块,就会造出重复 key —— 5 个 web
// 语言包各中一处,而 flatten 式 parity 检查按"路径集合"比对,完全看不出值被谁覆盖。
const dupKeyIssues = []
function findDuplicateKeys(text) {
  const dups = []
  let i = 0
  let line = 1
  const ws = () => {
    while (i < text.length) {
      const c = text[i]
      if (c === '\n') {
        line += 1
        i += 1
      } else if (c === ' ' || c === '\t' || c === '\r') i += 1
      else break
    }
  }
  const str = () => {
    i += 1 // 跳过开引号
    let s = ''
    while (i < text.length) {
      const c = text[i]
      if (c === '\\') {
        s += text[i + 1]
        i += 2
        continue
      }
      if (c === '"') {
        i += 1
        return s
      }
      if (c === '\n') line += 1
      s += c
      i += 1
    }
    throw new Error('未闭合字符串')
  }
  const arr = () => {
    i += 1
    let depth = 1
    while (i < text.length && depth > 0) {
      const c = text[i]
      if (c === '[') depth += 1
      else if (c === ']') depth -= 1
      else if (c === '"') {
        str()
        continue
      } else if (c === '\n') line += 1
      i += 1
    }
    i += 1
  }
  const val = (path) => {
    ws()
    if (text[i] === '{') obj(path)
    else if (text[i] === '[') arr()
    else if (text[i] === '"') str()
    else while (i < text.length && ',}]'.indexOf(text[i]) === -1) i += 1
  }
  function obj(path) {
    i += 1 // 跳过 {
    const seen = new Map()
    for (;;) {
      ws()
      if (text[i] === '}') {
        i += 1
        return
      }
      if (text[i] === ',') {
        i += 1
        continue
      }
      if (i >= text.length) return
      const atLine = line
      const k = str()
      ws()
      if (text[i] === ':') i += 1
      if (seen.has(k)) dups.push(`${path || '<root>'}.${k} @L${atLine}(首次 @L${seen.get(k)})`)
      seen.set(k, atLine)
      val(path ? `${path}.${k}` : k)
    }
  }
  ws()
  obj('')
  return dups
}

// 「同层重复 key / 含点键」这两条判据要的是**字节级原文**(JSON.parse 之后重复键已经消失了),
// 所以必须与 parity 用同一个判定面。此前它一直是裸 readFileSync(磁盘),连 --staged 也一样 ——
// 那正是本次交付报告里"`[2n-web]` 先红后绿"的成因:磁盘上的 i18n 半成品在动,索引里没有。
{
  let dupEntries = []
  try {
    dupEntries = listPackJsonEntries(MESSAGES_DIR)
  } catch (e) {
    // 列不到清单时不静默跳过整段判据:记进 unreadablePacks,末尾按"无法判定"处理。
    unreadablePacks.push({
      file: relOf(MESSAGES_DIR),
      why: String((e && e.message) || e).slice(0, 130),
    })
  }
  for (const entry of dupEntries.filter((f) => f.endsWith('.json'))) {
    const file = join(MESSAGES_DIR, entry)
    let raw
    let text
    try {
      text = readMessageRaw(file)
      raw = JSON.parse(text)
    } catch (e) {
      // 旧写法是 `catch { continue }` —— 一个包读不到就少判一个包而账面全绿。
      unreadablePacks.push({
        file: `dup:${entry}`,
        why: String((e && e.message) || e).slice(0, 130),
      })
      continue
    }
    const walkDotted = (node, prefix) => {
      for (const [k, v] of Object.entries(node)) {
        if (k.includes('.')) dottedKeyIssues.push(`${entry}: "${k}" (at ${prefix || '<root>'})`)
        if (v && typeof v === 'object' && !Array.isArray(v))
          walkDotted(v, prefix ? `${prefix}.${k}` : k)
      }
    }
    walkDotted(raw, '')
    try {
      for (const d of findDuplicateKeys(text)) dupKeyIssues.push(`${entry}: ${d}`)
    } catch {
      // 词法解析失败(异常格式)不臆断,交由既有 JSON.parse 通路兜底
    }
  }
}

if (dottedKeyIssues.length > 0) {
  console.log(
    `${C.red}[i18n 键检查] 发现 ${dottedKeyIssues.length} 个含点键 —— next-intl 按 "." 解析路径,这类 key 永不渲染,UI 会回显原始键名${C.reset}`,
  )
  for (const line of dottedKeyIssues.slice(0, 20)) console.log(`  ${C.yellow}${line}${C.reset}`)
  if (dottedKeyIssues.length > 20) {
    console.log(`  ${C.yellow}… 还有 ${dottedKeyIssues.length - 20} 个${C.reset}`)
  }
  console.log(`${C.yellow}修复方法: 把 "a.b": "x" 改写为嵌套结构 "a": { "b": "x" }${C.reset}`)
  console.log('')
}

if (dupKeyIssues.length > 0) {
  console.log(
    `${C.red}[i18n 键检查] 发现 ${dupKeyIssues.length} 处同层重复 key —— JSON.parse 静默保留最后一个,前面的值被遮蔽(AGENTS.md §18)${C.reset}`,
  )
  for (const line of dupKeyIssues.slice(0, 20)) console.log(`  ${C.yellow}${line}${C.reset}`)
  if (dupKeyIssues.length > 20) {
    console.log(`  ${C.yellow}… 还有 ${dupKeyIssues.length - 20} 处${C.reset}`)
  }
  console.log(`${C.yellow}修复方法: 合并同名 key,或改成分支里的不同键名${C.reset}`)
  console.log('')
}

if (dynamicPrefixIssues.length > 0) {
  console.log(
    `${C.red}[i18n 键检查] 发现 ${dynamicPrefixIssues.length} 处动态键的静态前缀不可达 —— t(\`prefix.\${x}\`) 会走 MISSING_MESSAGE,UI 上直接回显键名${C.reset}`,
  )
  for (const line of dynamicPrefixIssues.slice(0, 20)) console.log(`  ${C.yellow}${line}${C.reset}`)
  if (dynamicPrefixIssues.length > 20) {
    console.log(`  ${C.yellow}… 还有 ${dynamicPrefixIssues.length - 20} 处${C.reset}`)
  }
  console.log(
    `${C.yellow}修复方法: 在各语言消息表把 prefix 建成对象("prefix": { "a": … }),或像既有页面那样改成静态映射表消除拼接${C.reset}`,
  )
  console.log('')
}

const shouldBlock =
  parityIssues.length > 0 ||
  missingKeyIssues.length > 0 ||
  dottedKeyIssues.length > 0 ||
  dupKeyIssues.length > 0 ||
  dynamicPrefixIssues.length > 0

if (shouldBlock) {
  // 方案 A:web/extension 模式下 key 可能在 shared/(基础 key 已迁移)
  // 同时提示端文件和 shared 文件,迁移后 key 可能位于其中之一
  const messagesRelPath = isExtension
    ? `packages/i18n/messages/extension/${BASE_LANG}.json 或 packages/i18n/messages/shared/${BASE_LANG}.json`
    : isShared
      ? `packages/i18n/messages/shared/${BASE_LANG}.json`
      : isCli
        ? `packages/i18n/messages/cli/${BASE_LANG}.json`
        : isMobileRn
          ? `packages/i18n/messages/mobile-rn/${BASE_LANG}.json 或 apps/mobile-rn/src/lib/i18n.ts(messagesZhCN)`
          : isMiniappTaro
            ? `packages/i18n/messages/miniapp-taro/${BASE_LANG}.json 或 apps/miniapp-taro/src/lib/theme.ts(messagesZhCN)`
            : isParityOnlyFlag
              ? `packages/i18n/messages/web/${BASE_LANG}.json 或 packages/i18n/messages/shared/${BASE_LANG}.json`
              : `packages/i18n/messages/web/${BASE_LANG}.json 或 packages/i18n/messages/shared/${BASE_LANG}.json`
  console.log(
    `${C.dim}[i18n 键检查] 统计: 检查 ${checkedFiles} 文件, ${checkedKeys} 键, ${langNames.length} 语言 (${langNames.join(', ')})${C.reset}`,
  )
  console.log(
    `${C.red}[i18n 键检查] 发现 ${
      parityIssues.length > 0
        ? 'parity 问题'
        : missingKeyIssues.length > 0
          ? '缺失键问题'
          : dottedKeyIssues.length > 0
            ? '含点键问题'
            : dupKeyIssues.length > 0
              ? '同层重复 key 问题'
              : '动态键前缀不可达问题'
    },拒绝提交/CI失败!${C.reset}`,
  )
  console.log(`${C.yellow}修复方法:${C.reset}`)
  console.log(`  1. 在 ${messagesRelPath} 对应命名空间补齐缺失键`)
  console.log(`  2. 确保所有语言文件的键集与 ${BASE_LANG} 一致(parity)`)
  if (!isParityOnly) {
    console.log(`  3. 多命名空间文件用不同变量名(t/tc/te)避免冲突`)
  }
  console.log(`判定面:${FACE_LABEL[FACE]}`)
  process.exit(1)
}

const targetLabel = isExtension
  ? '[extension] '
  : isShared
    ? '[shared] '
    : isCli
      ? '[cli] '
      : isMobileRn
        ? '[mobile-rn] '
        : isMiniappTaro
          ? '[miniapp-taro] '
          : isParityOnlyFlag
            ? '[parity-only] '
            : ''
// parity-only 路径(shared / extension / cli / --parity-only)不做源码扫描,
// 此时 checkedFiles/checkedKeys 恒为 0 —— 只报 0 会让审阅者误判"这道闸在空转"
// (实测曾据此怀疑 --target=shared 是盲区,注入违规才证伪:它确实会 exit 1)。
// 因此扫描计数为 0 时,改报真正参与 parity 的语言数与键路径数。
const parityScope =
  checkedFiles > 0
    ? `已检查 ${checkedFiles} 文件, ${checkedKeys} 键`
    : `parity 比对 ${langNames.length} 语言 × ${baseLeaves.size} 键路径(该模式按设计跳过源码扫描)`
if (unreadablePacks.length) {
  console.error(
    `${C.red}[i18n 键检查] ❌ ${unreadablePacks.length} 个语言包读不出来 ⇒ parity 实际只比对了 ${langNames.length} 门语言,拒绝当作通过${C.reset}`,
  )
  for (const u of unreadablePacks.slice(0, 8)) console.error(`   · ${u.file} — ${u.why}`)
  console.error(`判定面:${FACE_LABEL[FACE]}`)
  process.exit(1)
}
console.log(
  `${C.green}[i18n 键检查] ${targetLabel}通过,${parityScope}, ${langNames.length} 语言 parity OK${C.reset}`,
)
if (sourceUnread > 0)
  console.log(
    `${C.yellow}  ⚠ 另有 ${sourceUnread} 个清单内源文件在 ${FACE_LABEL[FACE]} 取不到正文,已跳过(报数不静默)${C.reset}`,
  )
console.log(`判定面:${FACE_LABEL[FACE]}`)
process.exit(0)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
