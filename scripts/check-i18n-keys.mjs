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
const EXCLUDE_DIRS = new Set(['.git', '.next', '.trae-cn', '.turbo', '.worktrees', 'build', 'dist', 'node_modules', 'tests', '__tests__', 'e2e'])
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
    if (EXCLUDE_DIRS.has(entry)) continue
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

function loadMessages() {
  const langs = {}
  if (!existsSync(MESSAGES_DIR)) return langs
  // shared 模式:仅读 MESSAGES_DIR(=== SHARED_DIR),不合并
  if (isShared || isCli) {
    for (const entry of readdirSync(MESSAGES_DIR)) {
      if (!entry.endsWith('.json')) continue
      try {
        langs[entry.replace('.json', '')] = JSON.parse(
          readFileSync(join(MESSAGES_DIR, entry), 'utf8'),
        )
      } catch {
      }
    }
    return langs
  }
  // web/extension 非 shared 模式:读 shared + 端合并集(shared base,端 override)
  // 端的 key 覆盖 shared 同名 key,shared 提供跨端共享基础 key
  for (const entry of readdirSync(MESSAGES_DIR)) {
    if (!entry.endsWith('.json')) continue
    let targetMsg
    try {
      targetMsg = JSON.parse(readFileSync(join(MESSAGES_DIR, entry), 'utf8'))
    } catch {
      continue
    }
    // 读 shared/<lang>.json 作为 base
    let sharedMsg = {}
    if (existsSync(SHARED_DIR)) {
      const sharedPath = join(SHARED_DIR, entry)
      if (existsSync(sharedPath)) {
        try {
          sharedMsg = JSON.parse(readFileSync(sharedPath, 'utf8'))
        } catch {
        }
      }
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
  } catch {
  }
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
  if (
    words.length > 0 &&
    words.length <= 5 &&
    words.every((w) => /^[A-Z][A-Z0-9\-&]*$/.test(w))
  ) {
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
  return (
    passesGate1(value) &&
    passesGate2(value) &&
    passesGate3(value) &&
    passesGate4(value)
  )
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
  const re = new RegExp(
    `\\b${escaped}(?:\\.(?:rich|raw|format|has))?\\(\\s*['"]([^'"]+)['"]`,
    'g',
  )
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

const messages = loadMessages()
const langNames = Object.keys(messages).sort()

if (langNames.length === 0 || !messages[BASE_LANG]) {
  console.log(`${C.yellow}[i18n 键检查] messages 文件不存在或不完整,跳过${C.reset}`)
  process.exit(0)
}

const baseLeaves = new Set(collectLeafKeys(messages[BASE_LANG]))

let sourceFiles = []
let messagesChanged = false

if (isStaged) {
  try {
    const output = execSync('git diff --cached --name-only --diff-filter=ACM', {
      encoding: 'utf8',
      cwd: REPO_ROOT,
    })
    const staged = output.split('\n').filter(Boolean)
    messagesChanged = staged.some(
      (f) =>
        f.endsWith('.json') &&
        STAGED_MESSAGES_PREFIXES.some((p) => f.startsWith(p)),
    )
    if (isParityOnly) {
      // parity-only 模式跳过源码使用检测(extension useI18n() 不适用;shared 无源码消费方)
      sourceFiles = []
    } else if (messagesChanged) {
      sourceFiles = APP_SRC_DIR ? collectSourceFiles(APP_SRC_DIR) : collectSourceFiles(WEB_DIR)
    } else {
      sourceFiles = staged
        .filter(
          (f) =>
            f.startsWith(STAGED_SOURCE_PREFIX) &&
            (f.endsWith('.ts') || f.endsWith('.tsx')),
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
        .filter((f) => existsSync(f))
    }
  } catch {
    sourceFiles = []
  }
} else if (!isParityOnly) {
  sourceFiles = APP_SRC_DIR ? collectSourceFiles(APP_SRC_DIR) : collectSourceFiles(WEB_DIR)
}
// parity-only 非 staged 模式:sourceFiles 保持 [] (跳过源码使用检测,只做 key parity)

// parity-only 模式无源码扫描,仅靠 parity 校验驱动,不能因 sourceFiles 空 + messagesChanged 假就跳过
if (!isParityOnly && sourceFiles.length === 0 && !messagesChanged) {
  console.log(`${C.green}[i18n 键检查] 无源文件变更,跳过${C.reset}`)
  process.exit(0)
}

// parity-only 暂存区无 i18n JSON 改动时跳过(避免无关 commit 触发 parity 校验)
// 例外: --parity-only 显式标记必须跑(guardian-runner 2n-web 项,即使没改 i18n JSON 也要验)
if (isParityOnly && isStaged && !messagesChanged && !isParityOnlyFlag) {
  console.log(`${C.green}[i18n 键检查] ${TARGET} 模式:暂存区无 i18n JSON 改动,跳过${C.reset}`)
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
    const file = join(REPO_ROOT, rel)
  if (!existsSync(file)) return null
  try {
    const src = readFileSync(file, 'utf8')
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
  // 匹配 const { t } = useI18n(...) / const { tt } = useAppTheme(...) 解构,取变量名
  const destructureRe =
    /const\s*\{\s*(t|tt)(?:\s*:\s*(\w+))?\s*\}\s*=\s*(?:useI18n|useAppTheme)\s*\(/g
  const varNames = new Set()
  let m
  while ((m = destructureRe.exec(src)) !== null) {
    varNames.add(m[2] || m[1])
  }
  const keys = []
  for (const v of varNames) {
    const escaped = v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    // key 必须是引号字面量;模板字符串/动态拼接跳过(无法静态判定)
    const re = new RegExp(`\\b${escaped}\\(\\s*['"]([^'"]+)['"]`, 'g')
    let k
    while ((k = re.exec(src)) !== null) keys.push(k[1])
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
let checkedFiles = 0
let checkedKeys = 0

for (const file of sourceFiles) {
  let src
  try {
    src = readFileSync(file, 'utf8')
  } catch {
    continue
  }

  // 端内模式(mobile-rn/miniapp-taro):用 hook 解构提取 + 合并词典/兜底词典双查
  if (isMobileRn || isMiniappTaro) {
    const keys = extractHookKeys(src)
    if (keys.length === 0) continue
    checkedFiles++
    checkedKeys += keys.length
    const relPath = relative(REPO_ROOT, file)
    for (const key of keys) {
      if (!hasKeyInMergedOrDict(key)) {
        missingKeyIssues.push({ file: relPath, ns: '(hook)', key, varName: 't/tt' })
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

  if (usedKeys.length === 0) continue
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
        missingKeyIssues.push({
          file: relPath,
          ns,
          key,
          varName,
        })
      }
    } else {
      // 多命名空间同名变量:宽松检查,key 在任一 namespace 下存在即通过
      const existsInAny = [...nsSet].some(n => hasKey(messages[BASE_LANG], n, key))
      if (!existsInAny) {
        // 在所有 ns 中都不存在,报告所有缺失的 ns
        for (const n of nsSet) {
          if (!hasKey(messages[BASE_LANG], n, key)) {
            missingKeyIssues.push({
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
  console.log(
    `${color}[i18n 键检查] Parity 问题(${parityIssues.length}个) [${label}]:${C.reset}`,
  )
  for (const issue of parityIssues) {
    if (issue.direction === 'base-only') {
      console.log(
        `${color}  ${BASE_LANG} 有但 ${issue.lang} 缺失的键(${issue.total}个):${C.reset}`,
      )
    } else {
      console.log(
        `${color}  ${issue.lang} 有但 ${BASE_LANG} 无的键(${issue.total}个):${C.reset}`,
      )
    }
    console.log(`${color}    ${issue.keys.join('\n    ')}${issue.total > 20 ? '\n    ...' : ''}${C.reset}`)
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
      console.log(
        `${color}    命名空间 [${ns}] 缺失 ${keys.length} 键:${C.reset}`,
      )
      console.log(`${color}      ${keys.map((k) => `'${k}'`).join(', ')}${C.reset}`)
    }
  }
  console.log('')
}

// 翻译完整性:未翻译键(值 === en,非阻塞 WARNING,仅信息)
if (untranslatedValueIssues.length > 0) {
  const totalUntranslated = untranslatedValueIssues.reduce(
    (s, i) => s + i.count,
    0,
  )
  console.log(
    `${C.yellow}[i18n 翻译] 未翻译键(值===en,仅 ASCII) — ${totalUntranslated} 处待人工补译:${C.reset}`,
  )
  for (const issue of untranslatedValueIssues) {
    console.log(
      `${C.yellow}  ${issue.lang}: ${issue.count} 个未翻译键${C.reset}`,
    )
    for (const s of issue.samples) {
      console.log(
        `${C.dim}    ${s.key} = "${s.value}"${C.reset}`,
      )
    }
    if (issue.count > issue.samples.length) {
      console.log(
        `${C.dim}    ... 还有 ${issue.count - issue.samples.length} 个${C.reset}`,
      )
    }
  }
  console.log(
    `${C.dim}  → 修复:为这些键添加非英文翻译(或保留 en fallback 如有意为之)${C.reset}`,
  )
  console.log('')
}

// 2026-08-20: missing key 收紧为 blocking(历史 194 个 missing 已清零,见 2026-07-30 遗留说明)
// 背景:此前 missing key 只 warning 不阻塞(pre-commit 形同虚设),导致
//   common.tools.categoryEfficiency 等"源码引用但消息缺失"的键漏到浏览器才暴露。
//   full 扫描确认当前 0 个 missing key,收紧为 blocking 不再误伤历史 commit。
// 策略:missing key + parity 均 blocking(源码引用的 key 必须在消息中定义,这是硬性契约)。
//   full 模式(CI)与 staged 模式(pre-commit)都会阻塞,防止新引入未定义 i18n 键。
const shouldBlock = parityIssues.length > 0 || missingKeyIssues.length > 0

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
      parityIssues.length > 0 ? 'parity 问题' : '缺失键问题'
    },拒绝提交/CI失败!${C.reset}`,
  )
  console.log(`${C.yellow}修复方法:${C.reset}`)
  console.log(`  1. 在 ${messagesRelPath} 对应命名空间补齐缺失键`)
  console.log(`  2. 确保所有语言文件的键集与 ${BASE_LANG} 一致(parity)`)
  if (!isParityOnly) {
    console.log(`  3. 多命名空间文件用不同变量名(t/tc/te)避免冲突`)
  }
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
console.log(
  `${C.green}[i18n 键检查] ${targetLabel}通过,已检查 ${checkedFiles} 文件, ${checkedKeys} 键, ${langNames.length} 语言 parity OK${C.reset}`,
)
process.exit(0)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
