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
 * - --target=web|extension|shared|cli|mobile-rn|miniapp-taro|api: 切换扫描目标
 *   目标 → 语言包目录的映射只有一张表(TARGET_CONFIG,见下方实现注释)。
 *   **未登记 / 拼错的 target 一律 exit 2 并点名可用清单**,不再静默按 web 扫一遍
 *   (2026-09-28 G-304:此前 `--target=api` 与 `--target=nosuch-xyz` 打印的是 web 那一族的
 *    读数,账面像"扫过了";api 族在门 [2] 上因此一直没有 parity 覆盖。i18n-diff / i18n-apply
 *    在 2026-09-25 已按同一口径修过,本门随本次补上)
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
// G-1079148(2026-10-09):键流追踪的唯一实现层。本门原先只认 `t('字面量')`,所以"键作为一个值
// 穿过 helper、存进 state、再由渲染处 `t(变量)` 取用"这一族整族隐身(票面那 4 个键即此型:
// 组件真实消费 8 个键而门只报 4 个,并且 UI 上真的显示了裸键名而门一路报绿)。
// ⚠ traceKeyFlow 要吃的是**汇点**(state setter `setX`)而不是源函数名(`flashNotice`)——
// 喂错不报错,只会永远返回空,于是门对着同一个文件继续报绿。所以汇点由本门从源码自己派生,
// 不留给调用方手传(2026-10-09 接线前置实测 ② 的原文)。
import { traceKeyFlow, deriveStatePairs } from './lib/i18n-key-flow.mjs'

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
// 调用方是否**显式**传了 --target —— 决定"该判定面上这一族一个语言包都没有"是否判死
// (口径同 scripts/i18n-diff.mjs 的 resolveTarget:点了名还沉默就是撒谎)。
const TARGET_IS_EXPLICIT = targetArg !== undefined
const TARGET = targetArg ? targetArg.split('=')[1] : 'web'

/**
 * target → 语言包目录 + 各判据落点的**唯一一张表**(2026-09-28 G-304)。
 *
 * 立因:此前这一族目录靠一串嵌套三元挑,末支**无条件落回 web** ⇒ `--target=api` 与
 * `--target=nosuch-xyz` 都在原地重扫 web 那一族、把 web 的读数原样打印第二遍,账面读起来
 * 像"这个端扫过了"(最坏的失效形态:安静)。同族的 i18n-diff.mjs / i18n-apply.mjs 在
 * 2026-09-25 已按同一口径修过(未知 target 直接 exit 2),本门没跟上 ⇒ packages/i18n/
 * messages/api/** 在门 [2] 上一直没有 parity 覆盖。现改成表驱动 + 未登记即拒,
 * 结构上取消"回落"那一支:目录只能从表里来,表里没有就没有"下一档默认值"可落。
 *
 * 为什么 api 归本门管(实测,不是猜):`scripts/check-i18n-messages-exist.mjs` 的 ENDPOINTS
 * 已把 api 列为第 7 个语言包端,但那道门只判**存在与可解析**,不判键集 parity;
 * `i18n-diff` / `i18n-apply` 又只做"检测 + 写回"。⇒ parity 这一格此前全仓无人看守。
 * 如实登记 api 的不完整处:apps/api 目前不加载 @ihui/i18n(预算告警模板在
 * budget-alert-service.ts 内联中文,注释自述这份 JSON 是"翻译单一来源…供未来 i18n-loader
 * 接入"),所以它按 cli 同构走 parity-only —— 只比这五份 JSON 彼此的键集,**不做**端内引用键
 * 检测(没有消费方就没有可查的引用点)。
 */
const TARGET_CONFIG = {
  web: {
    dir: 'packages/i18n/messages/web',
    parityOnly: false,
    mergeShared: true,
    stagedMessages: ['packages/i18n/messages/web/', 'packages/i18n/messages/shared/'],
    stagedSource: 'apps/web/',
    srcDir: null, // null = apps/web
    label: '',
  },
  extension: {
    dir: 'packages/i18n/messages/extension',
    parityOnly: true,
    mergeShared: true,
    stagedMessages: ['packages/i18n/messages/extension/', 'packages/i18n/messages/shared/'],
    stagedSource: 'apps/extension/',
    srcDir: null,
    label: '[extension] ',
  },
  shared: {
    dir: 'packages/i18n/messages/shared',
    parityOnly: true,
    mergeShared: false,
    stagedMessages: ['packages/i18n/messages/shared/'],
    // shared 无源码消费方(parity-only 模式下不会用到),留这一格只为让"为什么是它"可查
    stagedSource: 'apps/web/',
    srcDir: null,
    label: '[shared] ',
  },
  cli: {
    dir: 'packages/i18n/messages/cli',
    parityOnly: true,
    mergeShared: false,
    stagedMessages: ['packages/i18n/messages/cli/'],
    stagedSource: 'apps/cli/',
    srcDir: null,
    label: '[cli] ',
  },
  'mobile-rn': {
    dir: 'packages/i18n/messages/mobile-rn',
    parityOnly: false,
    mergeShared: true,
    stagedMessages: ['packages/i18n/messages/mobile-rn/', 'packages/i18n/messages/shared/'],
    stagedSource: 'apps/mobile-rn/',
    srcDir: 'apps/mobile-rn/src',
    label: '[mobile-rn] ',
    // 端内翻译函数走 hook 解构(t/tt)而非 useTranslations('ns'),且词典可在端内 .ts 兜底
    hookExtract: true,
  },
  'miniapp-taro': {
    dir: 'packages/i18n/messages/miniapp-taro',
    parityOnly: false,
    mergeShared: true,
    stagedMessages: ['packages/i18n/messages/miniapp-taro/', 'packages/i18n/messages/shared/'],
    stagedSource: 'apps/miniapp-taro/',
    srcDir: 'apps/miniapp-taro/src',
    label: '[miniapp-taro] ',
    hookExtract: true,
  },
  api: {
    dir: 'packages/i18n/messages/api',
    parityOnly: true,
    mergeShared: false,
    stagedMessages: ['packages/i18n/messages/api/'],
    stagedSource: 'apps/api/',
    srcDir: null,
    label: '[api] ',
  },
}
const VALID_TARGETS = Object.keys(TARGET_CONFIG)

/**
 * 解析 --target,**绝不回落到 web**(本门与 i18n-diff 同一条修复)。
 * 值不在表里(含 `mobile_rn`、`Miniapp-Taro`、`--target=` 空值这类拼错)⇒ exit 2 并点名
 * 可用清单:打错一个字母就把"A 端的语言包"报成"B 端已通过",而报告看起来一切正常。
 * @param {string} given     --target= 的原始值
 * @param {(msg: string[]) => void} onFatal 判死出口(CLI 传进程退出包装,便于子进程断言)
 */
function resolveTarget(given, onFatal) {
  const cfg = TARGET_CONFIG[given]
  if (!cfg) {
    onFatal([
      `[i18n 键检查] ❌ --target=${JSON.stringify(given ?? '')} 不是受支持的端,已拒绝执行(未读任何语言包、未做任何判定)。`,
      `   可用目标(须与 packages/i18n/messages/ 下的目录名逐字相同): ${VALID_TARGETS.join(' / ')}`,
      `   拼写陷阱:连字符不是下划线、大小写敏感 —— "mobile_rn"、"Miniapp-Taro" 都会被拒。`,
      `   为什么不再容忍:此前未匹配的 target 会静默按 web 处理,于是打错一个字母`,
      `            看到的就是"web 那一族的读数",而真正想查的那一端一次也没被扫过。`,
    ])
    return null
  }
  return cfg
}
function fatalTargetLines(lines) {
  for (const line of lines) console.error(line)
  process.exit(2)
}
// 判死必须发生在读任何语言包之前 —— 与 i18n-diff 同一位置约束(形状锁由镜像测试钉)。
const CFG = resolveTarget(TARGET, fatalTargetLines)
if (!CFG) process.exit(2) // resolveTarget 已 exit;这一行只给控制流一个显式终点,不另立结论

/**
 * 端目录 ↔ TARGET_CONFIG 漂移对账(2026-09-28 G-304 的另一半;承另一路实现的判据)。
 *
 * 表是"target → 目录"的**唯一出口**(不能再把 argv 校验挂回目录清单,否则两处算同一件事必漂移),
 * 但一张静态表会腐烂:`packages/i18n/messages/` 下多出一个没进表的目录 = 那一族在本门上**零覆盖**,
 * 而账面读起来仍是"七个端都扫过了" —— 与 G-304 立因同型。所以这里用端目录的**实际清单**反查表:
 *   · 清单取不到 ⇒ **按有没有显式 --target 分两手**:没指名 ⇒ 只喊"漂移对账未判定"(空仓 / 部分
 *     checkout / 尚未建 messages 目录是合法形态,判死就是一台与本次提交无关的恒红门,AGENTS §12e);
 *     指名了要查哪一端而根目录读不到 ⇒ exit 2 —— 那正是 G-304 立因的那一型("没扫过却打印通过"),
 *     另一路实现把它整片判死、本路整片放过,合并不得把两者折成一个开关(此格两侧原为待拍板分歧,
 *     现按"分歧的两半各归其位"收口:处置动作不同的两种输入,不许共用一个结论)。
 *   · 目录不在表里 ⇒ 默认档大声点名 + 计数(它可能正是别人在飞的新端),`--strict` 才 exit 2。
 *
 * 这一块的输出**刻意不用**下面的颜色常量 `C`:`reportEndpointDrift` 在模块装载期就被调用,
 * 而 `C` 声明在更下方 —— 引它就是给门自己的初始化路径埋 TDZ(语法能过、装载即炸)。
 */
const MESSAGES_ROOT_REL = 'packages/i18n/messages'
const MESSAGES_ROOT = join(REPO_ROOT, MESSAGES_ROOT_REL)
const isStrictFlag = process.argv.includes('--strict')
function readEndpointDirs(root) {
  try {
    return readdirSync(root, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
  } catch {
    return null
  }
}
/**
 * @param {string[]|null} endpointDirs messages 根下的实际端目录名;null = 取不到(不判红、不称已对账)
 * @returns {{kind: 'undetermined'|'drift'|'ok', unlisted: string[]}}
 */
function classifyEndpointDrift(endpointDirs) {
  if (endpointDirs === null) return { kind: 'undetermined', unlisted: [] }
  const unlisted = endpointDirs.filter((d) => !VALID_TARGETS.includes(d))
  return { kind: unlisted.length ? 'drift' : 'ok', unlisted }
}
function reportEndpointDrift(endpointDirs, opts = {}) {
  const drift = classifyEndpointDrift(endpointDirs)
  if (drift.kind === 'undetermined') {
    // 两条分支的处置动作不同,所以分开判(这是两侧实现真正的分歧点,收敛成一条就把另一侧的修复关掉):
    //   · **没有**显式 --target ⇒ 空仓 / 部分 checkout / messages 目录尚未建立是合法形态,判死就是一台
    //     与本次提交无关的恒红门(AGENTS §12e),所以只喊"漂移对账未判定",不声称已对账;
    //   · **有**显式 --target(2026-09-28 G-304 的另一半)⇒ 调用方指名要查那一端,而根目录都读不到,
    //     等于"那一族一次也没被扫过"却回身打印通过 —— 回落就是把没判写成判过了,故按"无法判定"判死。
    if (opts.explicitTarget && !opts.help && !opts.selfTest) {
      console.error(
        `[i18n 键检查] ❌ 显式指定了 --target 却取不到 ${MESSAGES_ROOT_REL}/ 的端目录 ⇒ 无法判定,不冒绿也不回落到 web(问责口径同 i18n-diff)。`,
      )
      process.exit(2)
    }
    if (!opts.quiet)
      console.log(
        `[i18n 键检查] ⚠️ 端目录漂移对账未判定:${MESSAGES_ROOT_REL}/ 取不到 ⇒ 不据此判红,也不声称已对账`,
      )
    return drift
  }
  for (const d of drift.unlisted) {
    console.error(
      `[i18n 键检查] ❌ ${MESSAGES_ROOT_REL}/${d} 未登记进 TARGET_CONFIG ⇒ 这一族语言包在本门上零覆盖(表是 target→目录 的唯一出口)。`,
    )
    console.error(
      `   出路只有一条:在 TARGET_CONFIG 补一行(dir / parityOnly / mergeShared / stagedMessages / stagedSource / label),` +
        `不得为了让本门闭嘴而删目录或把该端从清单里抹掉。`,
    )
  }
  if (drift.kind === 'drift') {
    if (opts.strict) {
      console.error(`[i18n 键检查] --strict ⇒ 端目录未进表,按"未判定"判死(exit 2)。`)
      process.exit(2)
    }
    console.error(
      `[i18n 键检查] ⚠️ 端目录未进表:${drift.unlisted.join(' / ')} —— 默认档只点名不判红(可能是别人的在飞新端),问责跑 --strict`,
    )
  }
  return drift
}
reportEndpointDrift(readEndpointDirs(MESSAGES_ROOT), {
  strict: isStrictFlag,
  explicitTarget: TARGET_IS_EXPLICIT,
  help: process.argv.includes('--help'),
  selfTest: process.argv.includes('--self-test'),
})

// 端形态判据全部由表给(2026-09-28 G-304):此前这里是 5 个 `TARGET === 'x'` 布尔 +
// 两处 `isMobileRn || isMiniappTaro` 的手写端名单 —— 加一端忘改 if 链,正是 api 静默落回 web
// 的同一型成因,所以一个布尔都不留。
const isParityOnlyFlag = process.argv.includes('--parity-only')
// parity-only 模式:仅做 5 语言 key parity 校验,跳过源码使用检测与翻译完整性检测
// 唯一真相是表里的 parityOnly 列(不得在别处再抄一份端名单 —— 那正是 G-304 的成因:
// 表加了一端而 if 链没加,那一端就静默落回默认档)
const isParityOnly = CFG.parityOnly || isParityOnlyFlag
const WEB_DIR = join(REPO_ROOT, 'apps/web')
// 2026-07-25 i18n 单一来源:web 翻译迁移到 packages/i18n/messages/web/
// 2026-08-19:补充 mobile-rn 分支(原 fall through 到 web,守护形同虚设)
const MESSAGES_DIR = join(REPO_ROOT, CFG.dir)
// shared 目录:mergeShared 为真的端与它合并校验(方案 A)
// shared 模式下 MESSAGES_DIR === SHARED_DIR,二者相同
const SHARED_DIR = join(REPO_ROOT, 'packages/i18n/messages/shared')
// 暂存区语言包前缀:表里逐端登记 —— 只有 mergeShared 的端才把 shared/ 也算"本端相关改动"
// (不合并就不为它开触发口,否则 shared 改动会去触发一根本不看它的 parity)
const STAGED_MESSAGES_PREFIXES = CFG.stagedMessages
// 暂存区源码前缀:staged mode 下识别 apps/<端>/ 源码改动
const STAGED_SOURCE_PREFIX = CFG.stagedSource
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

// 2026-09:端内源码目录(mobile-rn / miniapp-taro 全量模式扫自己的 src,而非 apps/web)
// 表里的 srcDir 列为 null ⇒ 落回 WEB_DIR 的调用点见下方 `APP_SRC_DIR ? … : …`。
const APP_SRC_DIR = CFG.srcDir ? join(REPO_ROOT, CFG.srcDir) : null

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
        CFG.mergeShared
          ? [relOf(join(MESSAGES_DIR, entry)), relOf(join(SHARED_DIR, entry))]
          : [relOf(join(MESSAGES_DIR, entry))],
      )
    prefetchFaceTexts(rels)
  }
  // 不合并 shared 的端(shared 自身 / cli / api):仅读 MESSAGES_DIR,端内没有可查的引用点
  // 判据是表里的 mergeShared 列,不是手写的端名单 —— 名单加一端忘加一条 if 就是 G-304 本身。
  if (!CFG.mergeShared) {
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

// 2026-10-09 G-1079148:汇点(reader/sink)对的派生**不在本门重写** —— 用 lib 的
// deriveStatePairs。本票接线当天在门里抄了一份写窄的同名函数(`use` 与 `State` 之间漏了
// `(?:…)?`,于是最常见的 `useState` 整族不匹配),门对着同一个文件继续报 4 键 —— 恰好复现
// 了本票立项的那一型。教训照抄:**同一件事只许有一份实现**(§22c 同一条理由)。

// 该翻译变量是否以"整个实参恰为 reader"的形态被调用:`t(notice)` / `t.rich(notice)`。
// 只认整实参:`t(`a.${notice}`)` 与 `t('x' + notice)` 都属于"拼接型",本票不猜其键名(动态前缀
// 那一维另有 extractDynamicPrefixes 管),把它们算成流键的汇点会凭空造出归属。
function varConsumesReader(src, varName, reader) {
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(
    `\\b${esc(varName)}(?:\\.(?:rich|raw|format|has))?\\(\\s*${esc(reader)}\\s*[,)]`,
  ).test(src)
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
  // 显式点了名而这一族在该面上一个语言包都没有 ⇒ **无法判定**,不按"无事可查"跳过。
  // 判死只对显式 --target 生效(与 scripts/i18n-diff.mjs 的 resolveTarget 同一非对称):
  // 不带 --target 走默认 web,而"仓库尚无 messages 目录"是空仓 / 部分 checkout 的合法形态
  // (由镜像测试第 1 条钉着)。点了端还报绿,就是把"没扫"写成了"扫过"。
  if (TARGET_IS_EXPLICIT) {
    console.error(
      `${C.red}[i18n 键检查] ❌ --target=${TARGET} 在${FACE_LABEL[FACE]}上一个语言包都没枚举到(${relOf(MESSAGES_DIR)})⇒ 无法判定,不按"无事可查"跳过${C.reset}`,
    )
    console.error('   枚举到 0 个候选不是"这一端很干净",而是"这一端根本没被扫" —— 拒绝报绿。')
    console.error(`判定面:${FACE_LABEL[FACE]}`)
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
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
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
const FALLBACK_DICT = CFG.hookExtract ? loadFallbackDict(TARGET) : null

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
// G-1079148:键流族里"看得见站点但判不出归属/来源"的那些 —— 逐条报名,既不冒红也不记绿,
// 更不得被读成"这一族已覆盖"(§12e:把没量到写成量到了是本仓最高频失效型)。
const flowUndetermined = []
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

  // 端内模式(mobile-rn/miniapp-taro,由表里的 hookExtract 列点名):
  // 用 hook 解构提取 + 合并词典/兜底词典双查
  if (CFG.hookExtract) {
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

  // G-1079148:键流追踪族 —— 与字面量族取**并集**,不替换任何一条既有判据。
  // 归属规则(刻意保守):reader 恰好被一个翻译变量当整实参 ⇒ 记在那个 var 的 namespace 上,
  // 之后与字面量键走同一条严格/宽松检查;被 ≥2 个 var 用 ⇒ 落 flowUndetermined 报名(多 ns 时猜
  // 一个归属会把别人命名空间里的同键算成"这里在用",那是造假账);没有任何 var 用 ⇒ 该 state 与
  // 翻译无关(如 copied/fullscreen 这类布尔位),按定义不是流键,不报名也不计。
  for (const { reader, sink } of deriveStatePairs(srcNoComment)) {
    const owners = nsPairs.filter(({ varName }) => varConsumesReader(srcNoComment, varName, reader))
    if (owners.length === 0) continue
    if (owners.length > 1) {
      flowUndetermined.push(
        `${relative(REPO_ROOT, file)} | state ${reader} 同时被 ${owners
          .map((o) => o.varName)
          .join(' / ')} 当整实参用,流键归属不猜`,
      )
      continue
    }
    const varName = owners[0].varName
    const traced = traceKeyFlow(src, [sink])
    for (const item of traced.keys) {
      const dedupe = `${varName}::${item.key}`
      if (seen.has(dedupe)) continue
      seen.add(dedupe)
      usedKeys.push({ key: item.key, varName })
    }
    for (const u of traced.undetermined) {
      flowUndetermined.push(
        `${relative(REPO_ROOT, file)}:${u.line ?? '?'} [${u.kind ?? 'flow'}] ${u.why ?? u.snippet ?? ''}`.trim(),
      )
    }
  }

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
// G-1079148:键流族的「未判定」必须响 —— 它不是红(多 ns 归属不能猜),但"没判"与"判过了"
// 在账面上必须不同形。放在循环刚结束处,使它在后续任何退出路径上都已被打印。
if (flowUndetermined.length > 0) {
  console.log(
    `${C.yellow}[i18n 键检查] ⚠ 键流未判定 ${flowUndetermined.length} 处(站点看得见、归属或来源判不出;默认档只点名,问责跑 --strict):${C.reset}`,
  )
  for (const l of flowUndetermined.slice(0, 20)) console.log(`${C.yellow}   · ${l}${C.reset}`)
  if (flowUndetermined.length > 20)
    console.log(
      `${C.yellow}   · …其余 ${flowUndetermined.length - 20} 条(同一口径逐条计)${C.reset}`,
    )
  console.log('')
}

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
    `${C.red}[i18n 键检查] ❌ 发现 ${dottedKeyIssues.length} 个含点键 —— next-intl 按 "." 解析路径,这类 key 永不渲染,UI 会回显原始键名${C.reset}`,
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
    `${C.red}[i18n 键检查] ❌ 发现 ${dupKeyIssues.length} 处同层重复 key —— JSON.parse 静默保留最后一个,前面的值被遮蔽(AGENTS.md §18)${C.reset}`,
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
    `${C.red}[i18n 键检查] ❌ 发现 ${dynamicPrefixIssues.length} 处动态键的静态前缀不可达 —— t(\`prefix.\${x}\`) 会走 MISSING_MESSAGE,UI 上直接回显键名${C.reset}`,
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

// ---------- KR:语言包相对**其父提交**丢键(2026-09-27 立,实测逼出) ----------
/**
 * 五语言**一致地**缩水,本门全部横向判据一条都不响 —— parity 比的是"语言之间",
 * missing-key 判的是"源码引用有没有键",死键审计判的是"键有没有人用";
 * 没有一条**纵向**比"这一门语言相对它自己的上一个入库版本少了什么"。
 * 实测本机此刻的在飞副本:`packages/i18n/messages/cli/zh-CN.json` 工作树只剩 102 / HEAD 422 键,
 * extension 五语言各丢 23 键,其中 `chat.branchDone` / `chat.steerNoticeTitle` /
 * `ai.pane.inputNotices.queue.denied.reorder` 都是端上会**直接回显键名**的 UI 文案
 * (队列条渲染产物里实测到裸串 `ai.pane.inputNotices.queue.denied.reorder`)。
 *
 * 判据定义就是跨两面:被审面(索引)vs 该文件的父提交(HEAD)。这与"混面取数"不是一回事 ——
 * 混面是把两个不该比的来源当成同一个事实,而这里比较的两面正是命题本身。
 * 因此**只在 `--staged` 档判**:全量档的"父"只能是 HEAD^,那会把历史上每一次正当清理
 * 天天重判成违规 ⇒ 与任何提交都无关的恒红门,唯一结局是逼人跳门、约 156 道门一起作废(§12e 同型)。
 *
 * 出口只有两条,都不许靠削判据:① 把键补回;② 在 `scripts/data/i18n-key-removals.json`
 * 按文件逐条声明(file + keys + reason + until)—— **到期由本判据自己判**(镜像 KR-3 钉死),
 * 不经守门 108(它管的是源码里的行内豁免标记,不是 JSON 台账)。删除是允许的,静默删除不行。
 */
const KR_LEDGER_REL = 'scripts/data/i18n-key-removals.json'
const KR_ISO = /^\d{4}-\d{2}-\d{2}$/
/** 键路径扁平化:嵌套对象取点号路径,数组按"值存在"计一个键(与本门 parity 同口径)。 */
function flatKeyPaths(obj, pfx = '', out = new Set()) {
  for (const [k, v] of Object.entries(obj ?? {})) {
    const key = pfx + k
    if (v && typeof v === 'object' && !Array.isArray(v)) flatKeyPaths(v, `${key}.`, out)
    else out.add(key)
  }
  return out
}
const removalIssues = []
let krDeclaredHits = 0
let krWholeFileGone = 0
let krUndetermined = null
/** git 问"有没有"用:失败回 null(不当异常抛),区别于内容取不到 */
function gRaw(args) {
  try {
    return gitRaw(args, REPO_ROOT)
  } catch {
    return null
  }
}
if (FACE === 'index') {
 try {
  // 首次提交(仓库还没有任何 commit)是**可判定的边界**而不是"取不到面":没有父就没有旧键可比。
  // 不这么分开,每个新仓的第一枚 i18n 提交都会被本判据判成"无法判定 exit 2"。
  const parentRev = gRaw(['rev-parse', '--verify', 'HEAD'])
  if (parentRev === null) {
    console.log(`${C.dim}  ⓘ KR 不适用:该面没有父提交(首次提交)⇒ 没有"旧键集"可比${C.reset}`)
  } else {
  const today = new Date().toISOString().slice(0, 10)
  const relDir = relOf(MESSAGES_DIR)
  // 父提交侧的文件清单(本档 FACE 是索引,故不能复用 listPackJsonEntries)
  const headNames = new Set(
    (gitRaw(['ls-tree', '--name-only', 'HEAD', '--', `${relDir}/`], REPO_ROOT) || '')
      .split('\n')
      .map((l) => l.trim().split('/').pop())
      .filter((n) => n.endsWith('.json')),
  )
  const indexNames = new Set(listPackJsonEntries(MESSAGES_DIR))
  // 台账取材走被审面(索引优先):同一枚提交里"补声明 + 删键"是正当形态,只读 HEAD 会让它自我判红
  const ledgerText = faceReadText(KR_LEDGER_REL)
  const declared = new Map()
  let ledgerProblem = null
  if (ledgerText === null || ledgerText === undefined) {
    ledgerProblem = '台账不在被审面 ⇒ 按零声明判'
  } else {
    try {
      const parsed = JSON.parse(ledgerText)
      for (const e of Array.isArray(parsed?.removals) ? parsed.removals : []) {
        const f = typeof e?.file === 'string' ? e.file : ''
        const expired = typeof e?.until !== 'string' || !KR_ISO.test(e.until) || e.until < today
        const badReason = typeof e?.reason !== 'string' || e.reason.trim().length < 6
        const keys = Array.isArray(e?.keys) ? e.keys : []
        if (!f || expired || badReason) {
          removalIssues.push(
            `KR 台账声明本身不可用(${f || '(缺 file 字段)'}):${expired ? `until 缺失/非 ISO/已过期(${e?.until})` : 'reason 缺失或过短'} ⇒ 过期声明不得继续放行`,
          )
          continue
        }
        if (!declared.has(f)) declared.set(f, new Set())
        for (const k of keys) declared.get(f).add(k)
      }
    } catch {
      ledgerProblem = '台账 JSON 解析失败 ⇒ 按零声明判'
    }
  }
  const specs = [...headNames].map((n) => `HEAD:${relDir}/${n}`)
      const headTexts = specs.length
        ? catBatch(REPO_ROOT, specs, { maxBuffer: 1 << 29, timeout: 120000 })
        : new Map()
  for (const name of [...headNames].sort()) {
    const rel = `${relDir}/${name}`
    const headText = headTexts.get(`HEAD:${rel}`)
    const indexText = indexNames.has(name) ? faceReadText(rel) : null
    if (typeof headText !== 'string') continue // 父提交侧取不到 ⇒ 该文件在 HEAD 没有,无旧键可比
    if (indexText === null || indexText === undefined) {
      krWholeFileGone += 1 // 整包删除属守门 99(暂存删除存续性)的地盘,本判据不重复计债、只点名
      continue
    }
    let headKeys, indexKeys
    try {
      headKeys = flatKeyPaths(JSON.parse(headText))
      indexKeys = flatKeyPaths(JSON.parse(indexText))
    } catch {
      continue // 解析失败由本门既有的 unreadablePacks 路径判红,这里不重复报
    }
    const removed = [...headKeys].filter((k) => !indexKeys.has(k))
    if (!removed.length) continue
    const allowed = declared.get(rel) ?? new Set()
    const undeclared = removed.filter((k) => !allowed.has(k))
    krDeclaredHits += removed.length - undeclared.length
    if (undeclared.length)
      removalIssues.push(
        `${rel} 相对 HEAD 少了 ${undeclared.length} 个键(已声明放过 ${removed.length - undeclared.length} 个)：${undeclared.slice(0, 8).join(', ')}${undeclared.length > 8 ? ` … 另 ${undeclared.length - 8} 个` : ''}`,
      )
  }
  if (ledgerProblem)
        console.log(
          `${C.yellow}  ⓘ KR:${ledgerProblem}(不因此判红,但"没有声明"不等于"没有丢键")${C.reset}`,
        )
  }
 } catch (e) {
  // git 问不到时**不得**以未捕获异常 exit 1 冒充判据红(守门 94 那一型),也不得静默当成"没丢键"。
  krUndetermined = e && e.message ? String(e.message).slice(0, 160) : String(e)
 }
} else {
  console.log(
    `${C.dim}  ⓘ KR(语言包相对父提交丢键)在全量档不判:它的定义需要"被审面 vs 其父"两个面,只有 --staged 档成立;` +
      `全量档若照判,历史上每次正当清理都会天天重判成违规(恒红门)${C.reset}`,
  )
}
if (krUndetermined) {
  console.log(
    `${C.red}[i18n 键检查] ❌ KR(语言包相对父提交丢键)**无法判定**:取不到被审面或其父提交 ⇒ 不冒红也不记绿${C.reset}`,
  )
  console.log(`${C.dim}   原因:${krUndetermined}${C.reset}`)
  console.log(`判定面:${FACE_LABEL[FACE]}`)
  process.exit(2)
}
if (removalIssues.length) {
  console.log(
    `${C.red}[i18n 键检查] ❌ 发现 ${removalIssues.length} 处**语言包相对其父提交丢键**(五语言一致缩水时 parity 完全看不见):${C.reset}`,
  )
  for (const line of removalIssues.slice(0, 12)) console.log(`  ${C.yellow}${line}${C.reset}`)
  if (removalIssues.length > 12)
    console.log(`  ${C.yellow}… 还有 ${removalIssues.length - 12} 处${C.reset}`)
  console.log(
    `${C.yellow}两条出口(不得靠削判据):① 把键补回该语言包;② 确属有意清理 ⇒ 在 ${KR_LEDGER_REL} 按文件逐条声明 file+keys+reason+until${C.reset}`,
  )
  if (krWholeFileGone)
    console.log(
      `${C.dim}  ⓘ 另有 ${krWholeFileGone} 个语言包整包不在索引(删除由守门 99 判,本判据不重复计债)${C.reset}`,
    )
  console.log(`判定面:${FACE_LABEL[FACE]}`)
  process.exit(1)
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
  // 提示落点由表推导(2026-09-28 G-304):旧的 isXxx 三元链末支同样落回 web,
  // 只是这条只在判红时打印、不像 MESSAGES_DIR 那样决定"扫谁",所以危害小 —— 但一并收口,
  // 免得留下"第二处端名单"等着下一个人忘加一端。带端内兜底词典的两端把词典列出来就够,
  // 不同时列 shared(保持既有对外文案一字不变)。
  const fallbackDictRel = FALLBACK_DICTS[TARGET]
  const messagesRelPath =
    `${CFG.dir}/${BASE_LANG}.json` +
    (CFG.mergeShared && !fallbackDictRel
      ? ` 或 packages/i18n/messages/shared/${BASE_LANG}.json`
      : '') +
    (fallbackDictRel ? ` 或 ${fallbackDictRel}(messagesZhCN)` : '')
  console.log(
    `${C.dim}[i18n 键检查] 统计: 检查 ${checkedFiles} 文件, ${checkedKeys} 键, ${langNames.length} 语言 (${langNames.join(', ')})${C.reset}`,
  )
  console.log(
    `${C.red}[i18n 键检查] ❌ 发现 ${
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

// 末行前缀 = 表里的 label(证明这份读数是**被点名那一族**的,不是 web 的复读)。
// web 的 label 为空:带 --parity-only 时仍打 [parity-only](现状口径,一字未改)。
const targetLabel = CFG.label || (isParityOnlyFlag ? '[parity-only] ' : '')
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
// G-1079148:键流族的「未判定」在循环结束处已逐条点名;这里只在问责档拒绝出合格证。
// 刻意排在"通过"之前、也只在其它判据都不红时生效 —— 真有缺失键时那条 exit 1 更该先被看到。
if (isStrictFlag && flowUndetermined.length > 0) {
  console.error(
    `${C.red}[i18n 键检查] ❌ --strict:键流未判定 ${flowUndetermined.length} 处 ⇒ 拒绝出具"引用键已全部覆盖"的合格证${C.reset}`,
  )
  console.log(`判定面:${FACE_LABEL[FACE]}`)
  process.exit(2)
}
console.log(
  `${C.green}[i18n 键检查] ${targetLabel}通过,${parityScope}, ${langNames.length} 语言 parity OK${C.reset}`,
)
if (FACE === 'index')
  console.log(
    `${C.dim}  ⓘ KR 已核(索引 vs 父提交):0 处未声明丢键,已声明放过 ${krDeclaredHits} 键${C.reset}`,
  )
if (sourceUnread > 0)
  console.log(
    `${C.yellow}  ⚠ 另有 ${sourceUnread} 个清单内源文件在 ${FACE_LABEL[FACE]} 取不到正文,已跳过(报数不静默)${C.reset}`,
  )
console.log(`判定面:${FACE_LABEL[FACE]}`)
process.exit(0)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
