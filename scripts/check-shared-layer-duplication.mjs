// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 共享层重复检测守门脚本 (AGENTS.md S3 "shared-layer-first" 配套)
// 检测 apps/*/src 下是否有文件重新实现了 packages/shared 已提供的 hook/util
// 原理: 扫描 apps/*/src 下的 export 语句, 与 packages/shared/src 的 export 做交集
// 用法: node scripts/check-shared-layer-duplication.mjs            全量档(判 HEAD blob)
//       node scripts/check-shared-layer-duplication.mjs --staged   提交档(判索引 blob)
//       node scripts/check-shared-layer-duplication.mjs --worktree 人工逃生舱(判磁盘)
//       node scripts/check-shared-layer-duplication.mjs --help     显示帮助
// 退出码: 0=通过, 1=发现重复, 2=无法判定(被审面取不到 / 枚举到 0,不冒红也不记绿)
//
// 判定面(AGENTS §0.4):全量判 HEAD blob、`--staged` 判索引 blob、`--worktree` 仅人工逃生舱;
// 清单(git ls-tree / ls-files)与正文(同面 blob)取自**同一个**被审面,取不到绝不回落另一面。
// 旧版按磁盘 walk + `readFileSync`:共享工作树常年滞后 HEAD,判的可能是别人没提交的半编辑态。
//
// §22d:模块顶层零副作用、零 exit —— CLI 直跑(底部 isDirectRun)与被镜像测试 import(`__test__`)两用。
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Undetermined, assertRepoRoot, listFaceFiles, selectFace } from './lib/face-reader.mjs'
import { readSources } from './lib/face-scan.mjs'

/** ROOT 由脚本自身位置推导(AGENTS §15:不得用 process.cwd() 定根) */
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const HELP_TEXT = `
check-shared-layer-duplication.mjs — 共享层重复检测(端内不得重写 shared 已提供的 hook/util)

用法:
  node scripts/check-shared-layer-duplication.mjs            全量档:判 HEAD blob
  node scripts/check-shared-layer-duplication.mjs --staged   提交档:判索引 blob
  node scripts/check-shared-layer-duplication.mjs --worktree 人工逃生舱:判磁盘(不作提交门禁)
  node scripts/check-shared-layer-duplication.mjs --help     显示本帮助

判定:
  apps/<端>/src 下的 export 与 packages/shared|types/src 的 export 同名 ⇒ 违规
  例外:re-export wrapper(命中 from '@ihui/shared' 且 < 50 行)、export 行自带 from、
        WHITELIST 登记的深度集成/平台 adapter
`

/** 共享层取源顺序 = 采集顺序(同名 export 以先出现者为准,与旧 walk 的注册序一致) */
const SHARED_ROOTS = ['packages/shared/src', 'packages/types/src']

/** ===== 收集 shared 的 export 名称(5 条式样,与旧实现逐字一致) ===== */
const SHARED_EXPORT_PATTERNS = [
  /export\s+function\s+([A-Za-z_$][\w$]*)/g,
  /export\s+const\s+([A-Za-z_$][\w$]*)\s*[:=]/g,
  /export\s+\{[^}]*\b([A-Za-z_$][\w$]*)\b[^}]*\}/g,
  /export\s+type\s+([A-Za-z_$][\w$]*)/g,
  /export\s+interface\s+([A-Za-z_$][\w$]*)/g,
]

/** 只收 .ts/.tsx 且排除测试文件(文件名判,与旧 walk 同口径) */
function isSharedCandidate(rel) {
  const base = rel.slice(rel.lastIndexOf('/') + 1)
  return /\.(ts|tsx)$/.test(base) && !base.includes('.test.') && !base.includes('.spec.')
}

/**
 * @param {{rel:string,text:string}[]} sources 按采集序(shared/src 在前,types/src 在后)
 * @returns {Map<string,string>} exportName → 相对仓库根的路径(**先出现者为准**,同名不覆盖)
 */
function collectExports(sources) {
  const map = new Map()
  for (const { rel, text } of sources) {
    for (const pattern of SHARED_EXPORT_PATTERNS) {
      pattern.lastIndex = 0
      let match
      while ((match = pattern.exec(text)) !== null) {
        const name = match[1]
        if (name && !map.has(name)) map.set(name, rel)
      }
    }
  }
  return map
}

// ===== 白名单:端内允许的独立实现(有合理理由不和 shared 共享) =====
// 格式: {app, name, reason, reviewBy} — 这些 export 虽与 shared 同名,但是合理的深度集成/平台 adapter。
// 形态仿 scripts/fixture-tmpdir-exemptions.json(G-880 判据③,2026-10-23 立):
//   每条必须带非空 reason(可复核的事实)与 reviewBy(ISO 日期);
//   **到期(reviewBy < 当刻本地日)⇒ 不再豁免且照计违规** —— 须按当刻现读重新评估:
//   改 import shared,或带新理由续期;形态坏(缺 reason / reviewBy 非法)同样不豁免(fail-closed)。
const WHITELIST = [
  {
    app: 'web',
    name: 'useAgentRuntime',
    reason: 'web 深度集成版(集成 applyDiff/工具调用),shared 是依赖注入抽象',
    reviewBy: '2027-03-31',
  },
  {
    app: 'web',
    name: 'useAuth',
    reason: 'web 深度集成版(集成 next/navigation/react-query),shared 是纯逻辑层',
    reviewBy: '2027-03-31',
  },
  {
    app: 'web',
    name: 'useChat',
    reason: 'web 1678 行深度集成版(集成 store/router/applyDiff),shared 是依赖注入抽象',
    reviewBy: '2027-03-31',
  },
  {
    app: 'web',
    name: 'useClipboard',
    reason: '工厂模式: createUseClipboard + 浏览器 adapter,不是独立实现',
    reviewBy: '2027-03-31',
  },
  {
    app: 'web',
    name: 'useNotificationStore',
    reason: 'web 特有 notification store(集成浏览器 Notification API)',
    reviewBy: '2027-03-31',
  },
  {
    app: 'mobile-rn',
    name: 'useAuth',
    reason: 'RN AuthContext wrapper(集成 AsyncStorage),shared 是纯逻辑层',
    reviewBy: '2027-03-31',
  },
  {
    app: 'mobile-rn',
    name: 'useNotificationStore',
    reason:
      'RN 薄封装:re-export @ihui/shared/notifications/notification-store;另在 addFromWs 上只过滤 agent-control 指令帧(agent.action),其余字段原样透传。属 AGENTS.md §3 允许的"re-export wrapper + 平台 adapter",非端内独立实现;本守门的 re-export 判定只看 export 那一行有没有 from,故函数型 wrapper 必须显式登记。',
    reviewBy: '2027-03-31',
  },
]

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * 白名单命中判定(纯函数,now 可注入 ⇒ 镜像测试能构造"到期前/到期后/形态坏"三态)。
 * 未登记 / 已过期 / 形态坏(reason 空或 reviewBy 非 ISO)⇒ 一律不豁免(fail-closed)。
 */
function isWhitelisted(whitelist, appName, exportName, now = new Date()) {
  const entry = whitelist.find((e) => e && e.app === appName && e.name === exportName)
  if (!entry) return false
  if (!entry.reason || !ISO_DATE_RE.test(String(entry.reviewBy))) return false
  const today = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-')
  return String(entry.reviewBy) >= today
}

// ===== re-export wrapper 检测标识 =====
const RE_EXPORT_INDICATORS = [
  "from '@ihui/shared",
  'from "@ihui/shared',
  "export * from",
  'createUse', // 工厂模式
  'createAuth',
  'createTheme',
  'createAsyncStorage',
  'createSyncTransport',
]

// ===== 端内 export 句式(与旧实现逐字一致) =====
const APP_EXPORT_PATTERNS = [
  /export\s+function\s+(use[A-Z]\w*)/g,
  /export\s+const\s+(use[A-Z]\w*)\s*[:=]/g,
]

const APPS = ['web', 'mobile-rn', 'miniapp-taro', 'extension', 'cli']
/** 端内扫描剪枝(与旧 walk 同名同序) */
const APP_EXCLUDED_DIRS = ['node_modules', '.next', 'dist', '__tests__', 'tests']

/** 路径 → 端名(只认 `apps/<APPS>/src/` 前缀;不在射程内返回 null) */
function appOf(rel) {
  const m = /^apps\/([^/]+)\/src\//.exec(rel)
  return m && APPS.includes(m[1]) ? m[1] : null
}

/** 端内候选:apps/<端>/src 下的 .ts/.tsx,排除测试文件与构建/夹具目录(同旧 walk 口径) */
function isAppCandidate(rel) {
  const parts = rel.split('/')
  const base = parts[parts.length - 1] ?? ''
  if (!/\.(ts|tsx)$/.test(base)) return false
  if (base.includes('.test.') || base.includes('.spec.')) return false
  return !parts.some((p) => APP_EXCLUDED_DIRS.includes(p))
}

/**
 * 单文件判定(判据本体,与旧 scanAppDir 内联逻辑逐字同序):
 *   ① re-export wrapper(命中 indicator 且 < 50 行)⇒ 放过;
 *   ② export 名不在 shared 里 ⇒ 放过;
 *   ③ 白名单登记 ⇒ 放过;
 *   ④ export 那一行自带 `from ` ⇒ 是 re-export,放过;
 *   ⑤ 其余 ⇒ 违规。
 * @returns {{appName:string,file:string,exportName:string,sharedLocation:string,line:number}[]}
 */
function judgeAppSource(rel, content, sharedExports, whitelist = WHITELIST) {
  const appName = appOf(rel)
  if (!appName) return []
  const violations = []
  // 跳过 re-export wrapper(内容主要是 from '@ihui/shared')
  const isReExport = RE_EXPORT_INDICATORS.some((indicator) => content.includes(indicator))
  // 进一步检查:如果文件 < 50 行且包含 re-export indicator,肯定是 wrapper
  const lineCount = content.split('\n').length
  if (isReExport && lineCount < 50) return violations

  for (const pattern of APP_EXPORT_PATTERNS) {
    pattern.lastIndex = 0
    let match
    while ((match = pattern.exec(content)) !== null) {
      const exportName = match[1]
      if (!sharedExports.has(exportName)) continue
      // 白名单跳过(已确认是合理的深度集成/平台 adapter)
      if (whitelist.has(`${appName}/${exportName}`)) continue
      // 确认不是 re-export(检查 export 语句附近是否有 from)
      const lineStart = content.lastIndexOf('\n', match.index) + 1
      const lineEnd = content.indexOf('\n', match.index)
      const exportLine = content.slice(lineStart, lineEnd > 0 ? lineEnd : undefined)
      if (exportLine.includes('from ')) continue
      violations.push({
        appName,
        file: rel,
        exportName,
        sharedLocation: sharedExports.get(exportName),
        line: content.slice(0, match.index).split('\n').length,
      })
    }
  }
  return violations
}

/**
 * 取样 + 判定。清单与正文取自**同一个**被审面(AGENTS §0.4);任一侧枚举到 0 ⇒ `Undetermined`
 * (调用方折成 exit 2),不把"没扫到"读成"没重复"。
 */
function analyze({ root = ROOT, face = 'head' } = {}) {
  const sharedFiles = listFaceFiles(root, face, { paths: SHARED_ROOTS }).filter(isSharedCandidate)
  if (sharedFiles.length === 0) {
    throw new Undetermined(
      `被审面 ${face} 在 ${SHARED_ROOTS.join(' / ')} 下枚举到 0 个 .ts/.tsx 文件 ⇒ 无法判定(不冒红也不记绿)`,
    )
  }
  const sharedSrc = readSources(root, face, sharedFiles)
  const sharedExports = collectExports(
    sharedFiles.map((rel) => ({ rel, text: sharedSrc.texts.get(rel) ?? '' })),
  )

  const appFiles = listFaceFiles(
    root,
    face,
    { paths: APPS.map((a) => `apps/${a}/src`) },
  )
    .filter((rel) => appOf(rel) !== null)
    .filter(isAppCandidate)
  if (appFiles.length === 0) {
    throw new Undetermined(
      `被审面 ${face} 在 ${APPS.length} 个 apps/*/src 下枚举到 0 个 .ts/.tsx 文件 ⇒ 无法判定(不冒红也不记绿)`,
    )
  }
  const appSrc = readSources(root, face, appFiles)
  const violations = []
  for (const rel of appFiles) {
    if (!appSrc.texts.has(rel)) continue // 只有 worktree 档会缺(并发删除),不得判空串
    violations.push(...judgeAppSource(rel, appSrc.texts.get(rel), sharedExports))
  }
  return { face, sharedFiles: sharedFiles.length, appFiles: appFiles.length, violations }
}

/** CLI 主流程。**返回退出码**而不是 process.exit —— 测试 import 不得打死宿主(§22d)。 */
export async function main(argv = process.argv.slice(2)) {
  if (argv.includes('--help')) {
    console.log(HELP_TEXT)
    return 0
  }
  const picked = selectFace({
    staged: argv.includes('--staged'),
    worktree: argv.includes('--worktree'),
    def: 'head',
  })
  if (picked.error) {
    console.error(`❌ ${picked.error}`)
    return 2
  }
  const { face } = picked
  try {
    assertRepoRoot(ROOT, '共享层重复检测')
  } catch (e) {
    console.error(`❌ 无法判定:${e?.message ?? e}`)
    return 2
  }
  let result
  try {
    result = analyze({ root: ROOT, face })
  } catch (e) {
    console.error(`❌ 无法判定:${e?.message ?? e}`)
    return 2
  }

  const { violations } = result
  if (violations.length === 0) {
    console.log('✅ 共享层重复检测通过:未发现端内独立实现 shared 已提供的 hook')
    return 0
  }
  console.error(`❌ 发现 ${violations.length} 处端内重复实现 shared hook:`)
  for (const v of violations) {
    console.error(`  ${v.appName}/${v.file}:${v.line} — export ${v.exportName}() 与 shared/${v.sharedLocation} 重复`)
  }
  console.error('\n修复:删除端内实现,改为 import { ' + violations[0].exportName + ' } from "@ihui/shared"')
  return 1
}

// §22d:模块加载不得触发主流程(镜像测试 import 判据就是这个姿势)。
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main()
    .then((code) => process.exit(code))
    .catch((e) => {
      console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
      process.exit(2)
    })
}

export const __test__ = {
  appOf,
  isAppCandidate,
  isSharedCandidate,
  collectExports,
  judgeAppSource,
  analyze,
  main,
  SHARED_ROOTS,
  SHARED_EXPORT_PATTERNS,
  RE_EXPORT_INDICATORS,
  APP_EXPORT_PATTERNS,
  APPS,
  APP_EXCLUDED_DIRS,
  WHITELIST,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
