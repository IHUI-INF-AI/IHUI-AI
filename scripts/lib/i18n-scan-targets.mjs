// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * i18n 死键扫描的**端配置唯一出处**:每端的消息包目录 + 代码取材面(2026-10-05 抽成 lib)。
 *
 * 为什么抽:删除器 `clean-dead-i18n-keys.mjs` 要在删一个键之前判"它还有没有消费者",
 * 而那个判据的取材面**必须与审计器同一份** —— 两处各抄一份 scanTargets,
 * 就是"审计器看不见的活键"那一型的复发(实证:2026-09-26 `154f407499` 按清单删掉
 * miniapp-taro 12 个仍被 `tt()` / `t()` 消费的键,历时 9 天无人撞见,
 * 因为 en/ja/ko 界面静默显示中文、单参 `t()` 那条更是直接显示 key 字面量)。
 *
 * 为什么不是从 `scan-dead-i18n-keys.mjs` import:那是一台 CLI,**import 即执行全量审计** ——
 * 删除器每跑一次就白跑一次 4603 文件的扫描,还会把审计输出混进删除日志。
 * 配置与执行分离,配置才能被安全复用。
 *
 * `localeDir` = 该端语言包所在目录(相对仓库根);`scanTargets` = 该端的代码取材面。
 * 取材的目录剪枝与文件类型过滤判据在 `_i18n-scan-helpers.mjs`(walkDir / isScannableRel),
 * 本文件只负责"扫哪儿",不负责"怎么算引用"。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
// §0.6 单一真相源:承载页可达闭包只有一份算式(门 251 / 词包生成器同源),本文件只取它的文件集,
// 不复制任何 import 解析/裸包判定。借它的代价是 typescript 进本模块的静态依赖面(与生成器一致)。
import { carriedKeysFromRepo } from './rn-carried-keys.mjs'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const REPO_FILE_RE = /\.(?:tsx|ts|jsx|js|mjs)$/
const REPO_SKIP_DIRS = new Set(['node_modules', '__tests__', 'tests', 'dist', '.next', '.swc', 'coverage'])

/** 工作树面逐份读(闭包探路用)。取不到 ⇒ null(闭包按"这一支不存在"处理,不回落任何别的东西)。 */
function readRepoFile(rel) {
  try {
    return fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8')
  } catch {
    return null
  }
}

/** 工作树面枚举(仓库相对路径,与闭包算式的 `listFiles(dir)` 契约同形)。 */
function listRepoFiles(dir, out = []) {
  let entries
  try {
    entries = fs.readdirSync(path.join(REPO_ROOT, dir), { withFileTypes: true })
  } catch {
    return out
  }
  for (const e of entries) {
    if (REPO_SKIP_DIRS.has(e.name)) continue
    const rel = `${dir}/${e.name}`
    if (e.isDirectory()) listRepoFiles(rel, out)
    else if (REPO_FILE_RE.test(e.name)) out.push(rel)
  }
  return out
}

let carriedRnCache = null

/**
 * miniapp-taro 承载的 RN 侧文件集(逐文件,不是整目录)。
 *
 * 为什么逐文件:小程序只承载 184 枚 `@rn-shells/*`(现读),而 `apps/mobile-rn/src/screens` 有 344 枚;
 * 整目录实测比承载闭包**少报 119 枚**死键(`login.platformWechat` / `login.sso*` 全族只被端内不承载的
 * LoginScreen 引用)—— 那是为了消红削判据,不是补面。闭包口径与词包生成器/门 251 完全同源。
 *
 * 失效方向:闭包算不出(读盘异常等)⇒ 返回空集,宿主面退化为不含 RN 壳 —— 只会**多报**死键,
 * 结构上不可能少报(与"取不到不许冒绿"同向)。
 */
function miniappCarriedRnFiles() {
  if (carriedRnCache) return carriedRnCache
  try {
    const { files } = carriedKeysFromRepo({ readFile: readRepoFile, listFiles: listRepoFiles })
    carriedRnCache = files
      .filter((f) => f.startsWith('apps/mobile-rn/') && REPO_FILE_RE.test(f))
      .sort()
  } catch (e) {
    carriedRnCache = []
    process.stderr.write(
      `[i18n-scan-targets] 承载闭包取不到(${e?.message ?? e});miniapp-taro 的 RN 宿主面退化为空集(只会多报死键,不会少报)\n`,
    )
  }
  return carriedRnCache
}

/** miniapp-taro 的常驻面:`端内 + shared`(跨包 setError 取词)+ `packages/app`(壳渲染的共享屏)。 */
const MINIAPP_BASE_SCAN_TARGETS = ['apps/miniapp-taro/src', 'packages/shared/src', 'packages/app/src']

export const TARGETS = {
  web: {
    localeDir: 'packages/i18n/messages/web',
    scanTargets: [
      'apps/web/src',
      'apps/web/app', // Next.js 15 App Router(2026-07-26 漏扫 bug 修复)
      'apps/miniapp-taro/src', // React Native 端,2026-07-26 mobile-rn 子任务补扫(与 web 共享部分 leaf key)
      'apps/mobile-rn/src', // React Native 端,2026-07-26 mobile-rn 子任务补扫(与 web 共享部分 leaf key)
      'packages/app/src', // @ihui/rn-app 共享屏,web/mobile-rn/miniapp-taro 共用 messages/web(2026-08-20 修假阳性 bug: 此前漏扫导致 865 误报)
    ],
  },
  'miniapp-taro': {
    localeDir: 'packages/i18n/messages/miniapp-taro',
    // packages/shared/src = @ihui/shared 的 useLoginForm/useRegisterForm 被 miniapp-taro
    // login/register 页消费,其内部 setError('auth.xxx') 返回的 key 由本端 t() 渲染,
    // 2026-09-12 修复跨包引用漏检(auth.ssoFailed 等误判为死 key的同类模式)
    //
    // 2026-10-30 补两腿宿主面(同一失效型第 5 次,先例同形:web 面含 packages/app/src、
    // mobile-rn 面含 packages/app/src、cli 面含 packages/types/src):
    //   小程序页已壳化 —— `@rn-shells/*` 经 apps/miniapp-taro/tsconfig.json:29 与
    //   config/index.ts:348 落到 apps/mobile-rn/src/screens/*,壳再经 `@ihui/rn-app` 渲染
    //   packages/app/src/features/*;运行时 config/index.ts:437-440 的 rnShellReplacePlugin
    //   把 RN 侧的 `../i18n` 换成本端 `@/i18n`(落点 src/rn-compat/i18n.ts 转出口 `@/i18n`)
    //   ⇒ 这两处文件里的 t('x') 取的是**本端词包**,旧面里没有它们。
    //   失效实证:CI run 41059553644 上 2505 枚报名里 2100 枚有活消费者(83.8%)。
    //
    // 口径(2026-10-30 实测,刻意**不是**"把 RN 全塞进来"):
    //   · packages/app/src 整片 = 与词包生成器同一条上界(rn-carried-keys.mjs 的 featureFiles 段:
    //     "承载页只可能渲染共享屏,多补的键只是词包体积,漏补的键是用户可见的破相")。
    //   · RN 侧逐文件取「承载闭包」,不取整目录:`apps/mobile-rn/src/screens` 现读 344 枚而端内只承载
    //     184 枚;整目录会把 RN 专属屏的真死键(实测 197 枚,如 login.platformWechat / login.sso*)
    //     算成本端存活 —— 那是削判据不是补面。闭包算式与门 251/词包生成器同源,本文件不复制判据。
    get scanTargets() {
      return MINIAPP_BASE_SCAN_TARGETS.concat(miniappCarriedRnFiles())
    },
  },
  'mobile-rn': {
    localeDir: 'packages/i18n/messages/mobile-rn',
    // packages/app = @ihui/rn-app 共享屏,由 mobile-rn wrapper 传入本端 t 消费其 key
    // packages/shared/src = @ihui/shared 的 useLoginForm/useRegisterForm 被 mobile-rn
    // LoginScreen/RegisterScreen 消费(2026-09-12 修复跨包引用漏检:
    // setError('auth.ssoFailed') 的 key 在 shared 包内,原 scanTargets 不含它,被误判为死 key)
    scanTargets: ['apps/mobile-rn/src', 'packages/app/src', 'packages/shared/src'],
  },
  cli: {
    localeDir: 'packages/i18n/messages/cli',
    // 2026-09-24 补 `packages/shared/src/chat`:与上面 extension 同一先例同形 —— cli 的等待语只是
    // `apps/cli/src/commands/waiting-text.ts` 把取词函数 t 注入进 shared 的
    // `resolveWaitingText()`,真正拼键(`waiting.<象限>.<阶段>.<下标>` 与 `waiting.vividTail`)
    // 发生在 packages/shared/src/chat/waiting-pool.ts;端 scanTargets 不含它 ⇒ 76 枚 waiting.* 恒被判死。
    // 窄口径:只加 chat,不加 packages/app(照 extension 那条实测教训)。
    // 2026-10-09 补 `packages/types/src`(同一失效型第二次发生,不是新机制):后台任务终止词汇表
    // `BACKGROUND_TERMINATION_VOCAB` 按 §3「跨端类型住 packages/types」搬进
    // `packages/types/src/agent-runtime.ts`,其中 4 枚 `guidanceKey`(cli.bgNoticeStoppedByUser /
    // ByModel / BySuperseded / StopInitiatorUnknown)是**真被消费**的 ——
    // `apps/cli/src/tools/background-registry.ts:1097/1145` 逐行把 `row.guidanceKey` 喂给
    // `resolveNoticeGuidance()`,:1118 还拿它做"词汇表与语料不得分叉"的自证;但字面量住在 types 侧,
    // 端 scanTargets 不含它 ⇒ CI 的 i18n Dead Key Audit 在干净检出上判这 4 枚为死键并 exit 1
    // (本机同判,因为两侧都不是在飞改动:语言包与 agent-runtime.ts 此刻都 clean)。
    // 先实测窄口径:加 `packages/types/src` 后被"救回"的键**恰好只有这 4 枚**(改前后差集实测写在
    // 台账该行),即没有把别端专属键倒灌成本端假 wire;真正没人引用的键照旧判死。
    scanTargets: ['apps/cli/src', 'packages/shared/src/chat', 'packages/types/src'],
  },
  extension: {
    localeDir: 'packages/i18n/messages/extension',
    // 2026-09-23 补 `packages/shared/src/chat`:该目录下的等待语池(waiting-pool.ts)与权限档词表
    // (permission-tier.ts)按"跨端共享"设计被 extension 真实消费(MessageContent.tsx:682-683 等),
    // 但端 scanTargets 不含它 ⇒ 76 枚 waiting.* + 10 枚 permissionTier.mode.* 恒被判死。
    // 与 2026-09-12 给 taro / mobile-rn 加 `packages/shared/src` 的同一先例同形(窄口径:只加 chat,
    // 不加 packages/app —— taro 票实测会把别端专属键倒灌成本端假 wire)。
    scanTargets: ['apps/extension/entrypoints', 'apps/extension/src', 'apps/extension/lib', 'packages/shared/src/chat'],
  },
  desktop: {
    localeDir: 'packages/i18n/messages/desktop',
    scanTargets: [], // desktop 是 Rust/Tauri 包装,无 JS 代码可扫描;messages 目录未建立,自动跳过 exit 0
  },
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
