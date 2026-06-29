/**
 * 国际化配置 - 支持按需加载语言包
 * 
 * 核心模块会在应用启动时加载
 * 异步模块会在需要时按需加载
 */

import { createI18n } from 'vue-i18n'
import { StorageManager, STORAGE_KEYS } from '@/utils/storage'
import { logger } from '@/utils/logger'
// 2026-06-25 修复: Element Plus 语言包改为静态 import
// 历史: 顶层 import 5 个 EP 语言包 (~30KB) -> 改为 dynamic import (按需, 但触发 Vite optimizeDeps hash 失效循环)
// 问题: 每次 Vite HMR / dev server 重启, optimizeDeps 重新生成 element-plus_es_locale_lang_*.js?v=<新hash>,
//       但 App.vue 的 watch(locale, immediate:true) 仍持有旧 hash 引用, 触发
//       "Failed to fetch dynamically imported module: .../element-plus_es_locale_lang_zh-cn__mjs.js?v=<旧hash>"
//       循环报错 (设置 → 模型记录页面 88 条日志主因).
// 修复: 改为 static import, 一次打入 chunk, 加载后不存在 hash 失效.
// 成本: 5 个 EP locale 总计 ~12KB (gzip 后 ~5KB), 可接受.

// Element Plus 5 个语言包 — 静态导入，避免 dynamic import 命中 Vite optimizeDeps hash 失效
import zhCn from 'element-plus/es/locale/lang/zh-cn.mjs'
import zhTw from 'element-plus/es/locale/lang/zh-tw.mjs'
import enUs from 'element-plus/es/locale/lang/en.mjs'
import jaJp from 'element-plus/es/locale/lang/ja.mjs'
import koKr from 'element-plus/es/locale/lang/ko.mjs'

// 支持的语言列表
export const languages = [
  { code: 'zh-CN', name: '简体中文' },
  { code: 'zh-TW', name: '繁體中文' },
  { code: 'en', name: 'English' },
  { code: 'ja', name: '日本語' },
  { code: 'ko', name: '한국어' },
]

export type SupportedLocale = 'zh-CN' | 'zh-TW' | 'en' | 'ja' | 'ko'

// 核心模块列表 - 应用启动时加载
// 2026-06-24 修复: 增加 'login' 核心模块, 修复首屏 Login.vue 品牌区翻译键名裸露
// (login.worldFirst / login.oneStopAI / login.aiModels / login.users500k / login.users / login.availability)
// 注意: login.json 仅存在于 full/{locale}/, 实际从 full/{locale}/login.json 加载 (见 loadCoreMessages)
// 2026-06-26 修复: 增加 'commandPalette' 核心模块, 修复 GlobalCommandPalette 打开时
// 键名裸露 (commandPalette.commands.home 等). 该面板在 header 全局可见, 用户随时可触发,
// 必须保证启动时翻译就绪. 体积仅 ~800B/locale, 5 语言共 ~4KB, 可接受.
// 2026-06-26 新增: 增加 'api' 核心模块. 解决 src/api/ 下 296 个 t('api.xxx.yyy') 调用键名裸露.
// api.* key 是项目历史欠账: key 本身用中文字面量 (e.g. api.agents.操作成功),
// 未走标准 i18n 流程. 一并迁到 modules/{locale}/api.json, zh-CN 值=中文键名, 其他 4 语言用
// [ZH:xxx] 占位 (后续翻译). 体积: zh-CN ~7KB, 其他 4 语言 ~10KB (含 [ZH:] 标记), 启动期加载 0 影响.
// 2026-06-26 修复: 'footer' 加入首屏同步加载
// 历史: footer 模块原本在 App.vue 的 preloadFirstScreenI18n 中通过 queueMicrotask 异步加载,
// 经常赶不上 Footer 组件挂载, 导致 t('footer.companyContact') 短暂返回字面量
// "footer.companyContact:". 改为在 initI18n 阶段与核心模块一起同步加载,
// 体积 ~777B/locale, 5 语言共 ~3.9KB, 可接受.
// 同时 'home' / 'title' 也加入 (Home.vue / useNews.ts 强依赖, 键名裸露同样有损体验).
// 2026-06-26 修复: 增加 'core' 和 'app', 保留原来显式 import core.json / app.json 的行为,
// 避免 portalNav.protocolExit / app.skipToMain / app.offlineWarning 等键丢失.
// 2026-06-26 修复: 增加 'homePage3' / 'homePage4', HomePage3.vue / HomePage4.vue 是首页核心子模块,
// 之前因 homePage4.* 键值未填 + 模块未核心加载, 切语言后显示 'homePage4.subscribe' 字面量.
// 2026-06-26 修复: 增加 'cmpErrorBoundary' 核心模块. Error.vue / common/ErrorBoundary.vue 顶层使用
// t('cmpErrorBoundary.pageError'), 模块 JSON 存在但未注册导致键名裸露 ('cmpErrorBoundary.pageError:')
// 触发 ErrorBoundary 兜底页文案错误. 体积 ~80B/locale, 5 语言共 ~400B, 可接受.
// 2026-06-29 修复: 增加 'floatingChat' 核心模块. 桌面端 AI 面板默认开启, 首屏即渲染空状态
// (floatingChat.emptyWorkspace.title/description/selectModel/selectAgent), 模块未加载时显示 key 字面量.
// 体积 ~30KB/locale (gzip ~8KB), 桌面端核心功能, 必须首屏就绪.
const coreModules = ['common', 'navigation', 'header', 'auth', 'routes', 'errorBoundary', 'core', 'app', 'login', 'commandPalette', 'api', 'footer', 'home', 'title', 'homePage3', 'homePage4', 'cmpErrorBoundary', 'floatingChat'] as const

// 异步模块列表 - 按需加载
// 2026-06-26 修复: 补充前台活跃页面缺失的 i18n 模块注册
// 之前 forgotPassword/ranking/chat/agents 等模块有 JSON 文件但未注册，
// 导致路由进入时 t('xxx') 直接返回 key 字面量（键名裸露）
const asyncModules = [
  'home', 'open', 'openPlatform', 'openPlatformDocs', 'dashboard',
  'agentCategory', 'agentExamine', 'settlement', 'agentIncome', 'agentDetail',
  'orderDetail', 'orders', 'models', 'knowledgeDetail', 'toolsStore',
  'aiWorld', 'aiCommunity', 'community', 'voiceInput', 'wxUserCenter',
  'wxMiniprogram', 'wxLogin', 'webOnlyFeature', 'desktopExperience',
  'qrScanner', 'mobileOptimized', 'systemTray', 'desktopSettings',
  'qrCode', 'unifiedQRLogin', 'register', 'app', 'errorBoundary', 'cmpErrorBoundary',
  'connectionStatus', 'pwa', 'tour', 'progress', 'markdown',
  'commandPalette', 'aiGeneration', 'footer', 'developer', 'workspace',
  'purchase', 'apiTest', 'cmpindex', 'vip', 'search',
  'dramaScript',
  // 前台活跃页面缺失模块（2026-06-26 补充）
  'forgotPassword', 'ranking', 'chat', 'agents', 'plaza', 'xuqiu',
  'about', 'share', 'feedback', 'agenticAI', 'aiManagement',
  'knowledgeBase', 'memberPoint', 'wallet', 'distribution',
  'myCommission', 'withdrawal', 'supportTickets',
  'chatHistory', 'chatInput1', 'chatMode',
  'settings', 'user', 'userCenter',
  'learn', 'courses', 'exam', 'live', 'edu',
  'circle', 'ask', 'newsCenter',
  'pointCenter', 'messageCenter', 'notificationCenter',
  'toolsPage', 'mcp', 'imageGen', 'videoGen',
  'buyConfirm', 'payment', 'recharge',
  'floatingChat', 'loginPopup', 'thirdPartyLogin',
  'themeSettings', 'designSystem',
  // 2026-06-28 修复: member 用户中心 17 个页面 + Menu 组件键名全面裸露
  // memberMenu/memberPersonal/memberXxx 翻译原本只在 full/ 下(首屏不加载),
  // 现迁到 modules/member.json, member/Layout.vue onMounted 触发 loadModule
  'member',
] as const

// 2026-06-26 修复: 暴露预取函数, App.vue 在空闲时调用预热常用 i18n 模块
// 解决 asyncModule 竞态 (键名裸露). 这里用 requestIdleCallback 调度避免阻塞首屏关键渲染.
// 之前仅在 App.vue 顶层 import 但未 export, 触发 'does not provide an export named
// prefetchCommonI18nModules' 语法错误, 整个 app setup 失败白屏.
const _prefetchScheduled = new Set<SupportedLocale>()

// 常用预取模块: 用户高频访问的页面 (非首屏, 但打开概率高, 提前加载避免键名裸露)
// 列表根据实际页面分布选取, 控制在 12 个以内避免一次性加载过大
const COMMON_PREFETCH_MODULES: readonly string[] = [
  'commandPalette',  // Cmd+K 命令面板, 用户随时打开
  'footer',          // 页面底部 (首屏已预加载, 此处冗余作为 fallback)
  'agentDetail',     // AI 应用详情 (首页点击进入)
  'orders',          // 订单页 (登录态)
  'dashboard',       // 控制台 (登录态)
  'search',          // 搜索结果页
  'purchase',        // 套餐购买
  'vip',             // VIP 页面
  'developer',       // 开发者中心
  'workspace',       // 工作台
] as const

// 2026-06-28 修复: 一次性 glob 加载 modules/{locale}/ 下所有 JSON, 根除 B 类未注册模块裸露
// 背景: modules/ 下有 200+ 文件, 但 coreModules(18) + asyncModules(80) 只覆盖 98 个,
//       其余 100+ 文件虽存在但从未被 loadModule 调用, 对应 t() 前缀首屏裸露.
// 方案: 空闲时用 import.meta.glob 一次性加载所有 modules/ 文件并 merge.
//       生产环境 glob 拆成独立 chunk 按需 import, 不会打成大包; dev 即时加载.
//       跳过已加载模块 (isModuleLoaded) 避免重复 merge.
const _allModulesGlobLoaded = new Set<string>()
export async function loadAllModulesFromGlob(locale: SupportedLocale): Promise<void> {
  if (_allModulesGlobLoaded.has(locale)) return
  _allModulesGlobLoaded.add(locale)
  try {
    const allModules = import.meta.glob('./modules/*/*.json')
    const entries = await Promise.all(
      Object.entries(allModules)
        .filter(([p]) => p.startsWith(`./modules/${locale}/`))
        .map(async ([p, loader]) => {
          const moduleName = p.split('/').pop()!.replace('.json', '')
          // 跳过已加载模块 (coreModules/asyncModules 已加载的), 避免重复 merge
          if (isModuleLoaded(locale, moduleName)) return null
          try {
            const entry = await (loader as () => Promise<Record<string, unknown>>)()
            markModuleLoaded(locale, moduleName)
            return entry
          } catch {
            return null
          }
        }),
    )
    const merged: Record<string, unknown> = {}
    let count = 0
    for (const entry of entries) {
      if (entry) {
        const msg = (entry as { default?: Record<string, unknown> }).default || (entry as Record<string, unknown>)
        deepMergeInto(merged, msg)
        count++
      }
    }
    if (Object.keys(merged).length > 0) {
      mergeI18nMessages(locale, merged)
      if (import.meta.env.DEV) {
        logger.debug(`[i18n] All modules glob loaded for ${locale}, ${count} files merged`)
      }
    }
  } catch (error) {
    _allModulesGlobLoaded.delete(locale)
    if (import.meta.env.DEV) {
      logger.warn(`[i18n] Failed to load all modules for ${locale}:`, error)
    }
  }
}

/**
 * 2026-06-26 修复: 空闲预取常用 i18n 模块, 解决 asyncModule 竞态导致的键名裸露
 * 用 requestIdleCallback (fallback setTimeout 100ms) 调度, 避开首屏关键渲染期
 * 同一 locale 重复调用仅调度一次; 切换语言时通过 resetPrefetchFlag 重新启用
 * 2026-06-28 增强: 高频模块优先加载后, 追加 loadAllModulesFromGlob 全量补齐 B 类未注册模块
 */
export function prefetchCommonI18nModules(locale: SupportedLocale): void {
  if (_prefetchScheduled.has(locale)) return
  _prefetchScheduled.add(locale)

  const schedule = (cb: () => void): void => {
    if (typeof (globalThis as { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback === 'function') {
      ;(globalThis as { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(cb)
    } else {
      setTimeout(cb, 100)
    }
  }

  schedule(async () => {
    // 静默加载, 失败不阻塞 (预取为优化项, 非必需)
    try {
      // 1. 高频模块优先 (用户最可能立即访问的页面)
      await loadModules(locale, [...COMMON_PREFETCH_MODULES])
      // 2. 全量补齐 B 类未注册模块 (modules/ 下所有文件一次性 glob 加载)
      await loadAllModulesFromGlob(locale)
    } catch (e) {
      if (import.meta.env.DEV) {
        logger.debug(`[i18n] Prefetch modules for ${locale} failed:`, e)
      }
    }
  })
}

/**
 * 2026-06-26 修复: 切换语言后重置预取标志, 下次 prefetchCommonI18nModules 重新调度
 * 因为 setLanguage 已加载完整语言包, 这里只是允许后续再次预取 (例如用户主动再切回)
 * 2026-06-28: 同步重置 glob 加载标志
 */
export function resetPrefetchFlag(): void {
  _prefetchScheduled.clear()
  _allModulesGlobLoaded.clear()
}

// 已加载的模块缓存
const loadedModules = new Map<string, Set<string>>()

// 已加载完整语言包的 locale 缓存（用于按当前语言从对应文件反显翻译）
const fullLocaleLoaded = new Set<string>()

// 按当前语言加载拆分后的语言包 chunk 并合并到 i18n
// 完整语言包已按顶级键前缀拆分到 full/{locale}/*.json, 避免单个 674KB 大 chunk
// 2026-06-25 修复: 导出 loadFullLocaleMessages, 修复 I18nDashboard.vue 的 MISSING_EXPORT 构建错误
const _fullLocaleLoading = new Map<string, Promise<void>>()
export async function loadFullLocaleMessages(locale: SupportedLocale): Promise<void> {
  if (fullLocaleLoaded.has(locale)) return
  // 竞态保护：并发调用时复用同一个 Promise
  const pending = _fullLocaleLoading.get(locale)
  if (pending) return pending
  const task = (async () => {
    try {
      const allModules = import.meta.glob('./full/*/*.json')
      const entries = await Promise.all(
        Object.entries(allModules)
          .filter(([p]) => p.startsWith(`./full/${locale}/`))
          .map(([, loader]) => loader())
      )
      const merged: Record<string, unknown> = {}
      for (const entry of entries) {
        const msg = (entry as { default?: Record<string, unknown> }).default || entry as Record<string, unknown>
        deepMergeInto(merged, msg)
      }
      if (Object.keys(merged).length > 0) {
        mergeI18nMessages(locale, merged)
        fullLocaleLoaded.add(locale)
        if (import.meta.env.DEV) {
          // 2026-06-26 修复: 降级为 debug, 减少 dev 控制台噪音 (每切一次语言输出一行)
          logger.debug(`[i18n] Full locale messages loaded for ${locale} from ${entries.length} chunks`)
        }
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        logger.warn(`[i18n] Failed to load full locale for ${locale}:`, error)
      }
    }
  })()
  _fullLocaleLoading.set(locale, task)
  try {
    await task
  } finally {
    _fullLocaleLoading.delete(locale)
  }
}

// 2026-06-26 修复: coreModules 改为按 路径前缀 加载, 彻底解决 ja/ko 切语言 fallback 英文
// 历史 bug 链:
//   (1) 原实现 coreModules 列表里有 12 个模块, 但 loadCoreMessages 只显式 import 3-4 个
//       (extraCoreModules + coreMod + appMod + errorBoundaryMod + loginMod),
//       其余 9 个 (common/navigation/header/auth/routes/commandPalette/api 等)
//       只 markModuleLoaded, 不读 JSON. t() 因此 fallback 到 fallbackLocale='zh-CN',
//       而 zh-CN 也没有翻译, 最终落到 en (vue-i18n 默认 locale 字符串返回).
//   (2) 切语言时 setLanguage -> loadFullLocaleMessages 才补全 700+ chunk,
//       但 5 个语言共有 3500+ chunk, 首屏只在切语言后才拼, 时间窗口内显示英文.
// 修复: coreModules 全部走同一加载路径, 区分 modules/{locale}/*.json vs full/{locale}/*.json,
//       每个 import 缺模块 fallback 到 zh-CN. 启动即同步 import 12 个核心模块,
//       5 语言 ~30KB gzip, 可接受.
// 重要: 这里的 CORE_MODULE_SOURCE 维护的是「coreModules 中每个模块的物理文件位置」,
//       必须与 coreModules 数组一一对应. login 在 full/ 下, 其余在 modules/ 下.
const CORE_MODULE_SOURCE: Record<string, 'modules' | 'full'> = {
  common: 'modules',
  navigation: 'modules',
  header: 'modules',
  auth: 'modules',
  routes: 'modules',
  errorBoundary: 'modules',
  core: 'modules',
  app: 'modules',
  login: 'full',
  commandPalette: 'modules',
  api: 'modules',
  footer: 'modules',
  home: 'modules',
  title: 'modules',
  homePage3: 'modules',
  homePage4: 'modules',
  cmpErrorBoundary: 'modules',
  floatingChat: 'modules',
}

// 2026-06-26 修复: 递归把 [ZH:xxx] 占位符替换为 zh-CN 同名 key 的实际值
// 背景: 多个 i18n 文件中翻译未填时, 4 语言用 '[ZH:keyName]' 作为占位符, 直接 t() 会显示
//       "[ZH:keyName]" 字面量. 在 i18n 加载时一次性把占位符替换为 zh-CN 的实际值,
//       保证 ja/ko 等 4 语言不出现 [ZH:...] 残留, 同时保留 5 语言键集合一致.
function resolveZhPlaceholders(
  target: Record<string, unknown>,
  zhTemplate: Record<string, unknown>,
  visited: WeakSet<object> = new WeakSet(),
): Record<string, unknown> {
  if (visited.has(target)) return target
  visited.add(target)
  for (const key of Object.keys(target)) {
    const value = target[key]
    if (typeof value === 'string') {
      const match = /^\[ZH:([^\]]+)\]$/.exec(value)
      if (match) {
        const zhValue = resolveKeyPath(zhTemplate, match[1])
        if (typeof zhValue === 'string') {
          target[key] = zhValue
          continue
        }
      }
      target[key] = value
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      resolveZhPlaceholders(value as Record<string, unknown>, zhTemplate, visited)
    }
  }
  return target
}

// 从 nested obj 中按点分 key 路径取值
function resolveKeyPath(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.')
  let cur: unknown = obj
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p]
    } else {
      return undefined
    }
  }
  return cur
}

// 深度合并 source 的所有 key 到 target (修改 target).
// - 若 target[key] 和 source[key] 都是普通对象 (非数组), 递归合并
// - 否则用 source[key] 覆盖 target[key] (与 Object.assign 一致)
// 用于 i18n 模块合并, 避免多个模块共享同一顶层 key (如 common) 时浅覆盖丢子 key.
// 2026-06-27: export 以便单元测试覆盖 (deepMergeInto.test.ts).
export function deepMergeInto(target: Record<string, unknown>, source: Record<string, unknown> | null | undefined): void {
  if (!source || typeof source !== 'object') return
  for (const key of Object.keys(source)) {
    const srcVal = source[key]
    const tgtVal = target[key]
    if (
      srcVal && typeof srcVal === 'object' && !Array.isArray(srcVal) &&
      tgtVal && typeof tgtVal === 'object' && !Array.isArray(tgtVal)
    ) {
      deepMergeInto(tgtVal as Record<string, unknown>, srcVal as Record<string, unknown>)
    } else {
      target[key] = srcVal
    }
  }
}

async function loadCoreMessages(locale: SupportedLocale): Promise<Record<string, unknown>> {
  // 2026-06-26 修复: 真正 import 全部 coreModules, 每个模块按 CORE_MODULE_SOURCE 定位物理路径
  // 缺模块时 fallback 到 zh-CN 同名文件, 再失败则跳过该模块 (后续按 fallbackLocale 兜底)
  const coreImports = await Promise.all(
    coreModules.map(async (m) => {
      const source = CORE_MODULE_SOURCE[m] || 'modules'
      const primary = import(`./${source}/${locale}/${m}.json`).catch(() => null)
      const fallback = (source === 'modules' && locale !== 'zh-CN')
        ? import(`./modules/zh-CN/${m}.json`).catch(() => null)
        : null
      const result = await primary
      if (result) return result
      return fallback ? await fallback : null
    }),
  )

  // 标记所有 coreModules 已加载 (不再尝试重新 import)
  coreModules.forEach(module => markModuleLoaded(locale, module))

  // 合并所有 coreModules 的 JSON 内容到顶层
  // 2026-06-27 修复: 改用深度合并, 解决多个模块共享同一顶层 key (如 common) 时
  // 后加载模块覆盖前者的子 key 问题. 例: common.json 有 common.learnAIHome,
  // core.json 也有 common 顶层 key 但没有 learnAIHome, Object.assign 浅合并会
  // 用 core.json 的 common 整体覆盖 common.json 的 common, 导致 learnAIHome 丢失.
  const merged: Record<string, unknown> = {}
  for (let i = 0; i < coreImports.length; i++) {
    const mod = coreImports[i]
    if (mod) {
      const data = (mod as { default?: Record<string, unknown> }).default || (mod as Record<string, unknown>)
      deepMergeInto(merged, data)
    }
  }

  // 兼容旧 app 模块的标记 (项目其他地方依赖此标记)
  markModuleLoaded(locale, 'app')

  // 2026-06-26 修复: 把 [ZH:xxx] 占位符替换为 zh-CN 实际值
  // 只对非 zh-CN locale 执行, 避免循环引用. zh-CN 的 [ZH:] 占位符原样保留 (项目里没有)
  if (locale !== 'zh-CN') {
    try {
      // 用与目标 locale 相同的 CORE_MODULE_SOURCE 列表加载 zh-CN 模板
      const zhImports = await Promise.all(
        coreModules.map(async (m) => {
          const source = CORE_MODULE_SOURCE[m] || 'modules'
          return import(`./${source}/zh-CN/${m}.json`).catch(() => null)
        }),
      )
      const zhTemplate: Record<string, unknown> = {}
      for (const mod of zhImports) {
        if (mod) {
          const data = (mod as { default?: Record<string, unknown> }).default || (mod as Record<string, unknown>)
          Object.assign(zhTemplate, data)
        }
      }
      resolveZhPlaceholders(merged, zhTemplate)
    } catch (e) {
      if (import.meta.env.DEV) {
        logger.warn(`[i18n] resolveZhPlaceholders failed for ${locale}:`, e)
      }
    }
  }

  return merged
}

// P6-5：缺失模块时回退到 zh-CN（避免英/日/韩部分页面键名裸露）
// 2026-06-25 修复: 改为 export，让按需加载组件 (如 GlobalCommandPalette) 能在
// onMounted 中主动调用，避免首屏异步组件挂载时 i18n key 未加载导致键名裸露
// 2026-06-26 修复: 返回前做 [ZH:xxx] 占位符清理, 避免 asyncModules (按需加载) 中的
// [ZH:xxx] 残留显示在 ja/ko/zh-TW/en 界面. 同步模块的清理在 loadCoreMessages 内部做.
const _zhTemplateCache: { value: Record<string, unknown> | null } = { value: null }
async function getZhTemplate(): Promise<Record<string, unknown>> {
  if (_zhTemplateCache.value) return _zhTemplateCache.value
  // 按需 lazy 加载 zh-CN coreModules 作为模板
  try {
    const zhImports = await Promise.all(
      coreModules.map(async (m) => {
        const source = CORE_MODULE_SOURCE[m] || 'modules'
        return import(`./${source}/zh-CN/${m}.json`).catch(() => null)
      }),
    )
    const template: Record<string, unknown> = {}
    for (const mod of zhImports) {
      if (mod) {
        const data = (mod as { default?: Record<string, unknown> }).default || (mod as Record<string, unknown>)
        Object.assign(template, data)
      }
    }
    _zhTemplateCache.value = template
    return template
  } catch (e) {
    if (import.meta.env.DEV) {
      logger.warn('[i18n] getZhTemplate failed:', e)
    }
    return {}
  }
}

export async function loadAsyncModuleWithFallback(
  locale: SupportedLocale,
  module: string
): Promise<Record<string, unknown> | null> {
  if (isModuleLoaded(locale, module)) {
    return null
  }
  try {
    const messages = await import(`./modules/${locale}/${module}.json`)
    const result = (messages.default || messages) as Record<string, unknown>
    // 2026-06-26 修复: 移除 i18n module load messages 结构 dump,
    // 原调试日志会输出每个模块的 topKeys/cmdKeys, 噪音过大且封版无价值
    markModuleLoaded(locale, module)
    if (locale !== 'zh-CN') {
      const template = await getZhTemplate()
      resolveZhPlaceholders(result, template)
    }
    return result
  } catch (primaryError) {
    if (locale === 'zh-CN') return null
    try {
      const fallback = await import(`./modules/zh-CN/${module}.json`)
      markModuleLoaded(locale, module)
      if (import.meta.env.DEV) {
        logger.debug(`[i18n] Module ${module} missing for ${locale}, using zh-CN fallback`)
      }
      const fb = (fallback.default || fallback) as Record<string, unknown>
      // fallback 已是 zh-CN 内容, 不需要 [ZH:] 清理
      return fb
    } catch {
      if (import.meta.env.DEV) {
        logger.warn(`[i18n] Failed to load module ${module} for ${locale}:`, primaryError)
      }
      return null
    }
  }
}

// 检查模块是否已加载
function isModuleLoaded(locale: SupportedLocale, module: string): boolean {
  const loaded = loadedModules.get(locale)
  return loaded ? loaded.has(module) : false
}

// 标记模块为已加载
function markModuleLoaded(locale: SupportedLocale, module: string): void {
  if (!loadedModules.has(locale)) {
    loadedModules.set(locale, new Set())
  }
  loadedModules.get(locale)!.add(module)
}

// 获取浏览器默认语言
function getBrowserLanguage(): SupportedLocale {
  const savedLanguage = typeof window !== 'undefined' ? localStorage.getItem('language') : null
  if (savedLanguage && languages.some(l => l.code === savedLanguage)) {
    return savedLanguage as SupportedLocale
  }
  
  try {
    const stored = StorageManager.getItem<string>(STORAGE_KEYS.LANGUAGE)
    if (stored) {
      const mapped = stored === 'zh' ? 'zh-CN' : stored === 'en' ? 'en' : stored
      if (languages.some(l => l.code === mapped)) {
        return mapped as SupportedLocale
      }
    }
  } catch (error) {
    if (import.meta.env.DEV) {
      logger.warn('[locales] Failed to read language from localStorage:', error)
    }
  }
  
  const browserLang = navigator.language
  if (languages.some(l => l.code === browserLang)) {
    return browserLang as SupportedLocale
  }
  
  const langPrefix = browserLang.split('-')[0]
  for (const lang of languages) {
    if (lang.code.startsWith(langPrefix)) {
      return lang.code as SupportedLocale
    }
  }
  
  return 'zh-CN'
}

// 创建i18n实例 - 初始时只加载核心模块
// 2026-06-25 修复: 移除 compilerOptions.isCustomElement = tag.startsWith('el-')
// 原设置会让 vue-i18n 9.x (legacy: false) 把 el-* 标签当 HTML 自定义元素,
// 误传到 Vue 编译器后 EP 组件无法解析, 触发 el-config-provider 内部 renderSlot(null) 错误
// "Cannot read properties of null (reading 'ce')".
// EP 组件由 unplugin-vue-components + ElementPlusResolver 自动按需导入,
// 正确做法: vite.config.ts 已设置 isCustomElement: () => false (line 730),
//           vue-i18n 不应再覆盖此设置.
const i18n = createI18n({
  legacy: false,
  locale: getBrowserLanguage(),
  messages: {},
  compilerOptions: {
    whitespace: 'condense',
  },
  fallbackWarn: false,
  missingWarn: false,
} as Parameters<typeof createI18n>[0])

// P6-5：缺翻译时回退中文，避免键名裸露
;(i18n.global as unknown as { fallbackLocale: { value: string } }).fallbackLocale = { value: 'zh-CN' }

// 类型定义：i18n全局实例
type _I18nGlobal = typeof i18n.global & {
  messages: { value: Record<string, Record<string, unknown>> }
  setLocaleMessage: (locale: string, messages: Record<string, unknown>) => void
  mergeLocaleMessage: (locale: string, messages: Record<string, unknown>) => void
}

// 获取i18n全局实例的类型安全访问
function getI18nMessages(locale: string): Record<string, unknown> {
  const global = i18n.global as unknown as _I18nGlobal
  if (typeof global.messages === 'object' && 'value' in global.messages) {
    return global.messages.value[locale] || {}
  }
  return {}
}

function setI18nMessages(locale: string, messages: Record<string, unknown>): void {
  const global = i18n.global as unknown as _I18nGlobal
  if (typeof global.setLocaleMessage === 'function') {
    global.setLocaleMessage(locale, messages)
  } else if (typeof global.messages === 'object' && 'value' in global.messages) {
    global.messages.value[locale] = messages
  }
}

function mergeI18nMessages(locale: string, messages: Record<string, unknown>): void {
  const global = i18n.global as unknown as _I18nGlobal
  if (typeof global.mergeLocaleMessage === 'function') {
    global.mergeLocaleMessage(locale, messages)
  } else {
    const existing = getI18nMessages(locale)
    setI18nMessages(locale, { ...existing, ...messages })
  }
}

function getI18nLocale(): string {
  const locale = i18n.global.locale
  return typeof locale === 'string' ? locale : locale.value
}

function setI18nLocale(locale: string): void {
  const globalLocale = i18n.global.locale
  if (typeof globalLocale === 'object' && globalLocale !== null && 'value' in globalLocale) {
    globalLocale.value = locale
  }
}

// 初始化核心模块
async function initializeCoreMessages(): Promise<void> {
  const locale = getI18nLocale() as SupportedLocale

  try {
    const coreMessages = await loadCoreMessages(locale)

    // 使用 mergeLocaleMessage 合并消息
    mergeI18nMessages(locale, coreMessages)

    // 2026-06-24 优化：启动时不再加载完整语言包
    // 原行为: await loadFullLocaleMessages(locale)
    // 问题: loadFullLocaleMessages 会在首屏强制 import 564+KB 的 zh-CN full/* JSON
    //      导致 dist 出现 5 个 locale-full-*.js 大 chunk (gzipped 后 ~840KB)
    // 新行为: 只在用户主动切换语言时 (setLanguage) 才加载完整语言包
    // 影响: 缺失的键会回退到 fallbackLocale (zh-CN)，首屏翻译依然完整
    //      特殊页面 (如 I18nDashboard) 需要全量键时可显式调用 loadFullLocaleMessages
    if (import.meta.env.DEV) {
      logger.info(`[i18n] Core messages loaded for ${locale} (full locale deferred)`)
    }
  } catch (error) {
    logger.error(`[i18n] Failed to load core messages for ${locale}:`, error)
  }
}

// 设置语言并加载对应的核心模块
// 2026-06-25 修复: 竞态保护，快速连续切换语言时串行执行，避免 locale 和 messages 不一致
let _setLanguagePromise: Promise<void> | null = null
export async function setLanguage(lang: string): Promise<void> {
  const target = languages.some(l => l.code === lang) ? lang : 'zh-CN'
  // 串行化：等待上一次 setLanguage 完成
  if (_setLanguagePromise) await _setLanguagePromise
  
  const task = (async () => {
    try {
      localStorage.setItem('language', target)
      try {
        StorageManager.setItem(STORAGE_KEYS.LANGUAGE, target)
      } catch (storageError) {
        if (import.meta.env.DEV) {
          logger.debug('[Locales] StorageManager setItem failed:', storageError)
        }
      }
    } catch (langError) {
      if (import.meta.env.DEV) {
        logger.debug('[Locales] Language set failed:', langError)
      }
    }
    
    try {
      const targetLocale = target as SupportedLocale
      // 加载目标语言的核心模块
      if (!isModuleLoaded(targetLocale, 'common')) {
        const coreMessages = await loadCoreMessages(targetLocale)
        mergeI18nMessages(target, coreMessages)
      }
      // 加载目标语言的完整语言包，保证切换语言后 t() 从对应语言文件取键值反显
      await loadFullLocaleMessages(targetLocale)
      // 2026-06-28 修复: 补齐 modules/ 下 full/ 未覆盖的 B 类未注册模块, 避免切语言后裸露
      await loadAllModulesFromGlob(targetLocale)

      // 设置locale
      setI18nLocale(target)
      // 2026-06-26: 切换语言后重置预取标志, 下次 prefetchCommonI18nModules 重新调度
      resetPrefetchFlag()

      document.documentElement.setAttribute('lang', target.startsWith('zh') ? 'zh-CN' : 'en')
      document.documentElement.setAttribute('dir', 'ltr')
      window.postMessage({ type: 'SET_LANGUAGE', lang: target }, '*')
    } catch (error) {
      logger.error('Language setting failed:', error)
    }
  })()
  _setLanguagePromise = task
  try {
    await task
  } finally {
    if (_setLanguagePromise === task) _setLanguagePromise = null
  }
}

// 按需加载模块
export async function loadModule(locale: SupportedLocale, module: string): Promise<void> {
  if (isModuleLoaded(locale, module)) {
    return
  }

  try {
    const messages = await loadAsyncModuleWithFallback(locale, module)
    if (messages) {
      mergeI18nMessages(locale, messages)

      if (import.meta.env.DEV) {
        logger.debug(`[i18n] Module ${module} loaded for ${locale}`)
      }
    }
  } catch (error) {
    if (import.meta.env.DEV) {
      logger.warn(`[i18n] Failed to load module ${module}:`, error)
    }
  }
}

// 批量加载模块
export async function loadModules(locale: SupportedLocale, modules: string[]): Promise<void> {
  const modulesToLoad = modules.filter(m => !isModuleLoaded(locale, m))
  if (modulesToLoad.length === 0) {
    return
  }

  try {
    const results = await Promise.all(
      modulesToLoad.map(module => loadAsyncModuleWithFallback(locale, module))
    )
    const merged: Record<string, unknown> = {}
    for (const messages of results) {
      if (messages) {
        deepMergeInto(merged, messages)
      }
    }
    mergeI18nMessages(locale, merged)

    if (import.meta.env.DEV) {
      logger.debug(`[i18n] ${modulesToLoad.length} modules loaded for ${locale}`)
    }
  } catch (error) {
    if (import.meta.env.DEV) {
      logger.warn(`[i18n] Failed to load modules:`, error)
    }
  }
}

// 获取当前语言
export function getCurrentLocale(): SupportedLocale {
  return getI18nLocale() as SupportedLocale
}

// 获取已加载的模块列表
export function getLoadedModules(locale: SupportedLocale): string[] {
  const loaded = loadedModules.get(locale)
  return loaded ? Array.from(loaded) : []
}

// 导出异步模块列表供外部使用
export { asyncModules }

// 类型辅助函数：获取 i18n.global 的类型安全版本
export function getI18nGlobal() {
  return i18n.global as {
    t: (key: string, params?: Record<string, string | number>) => string
    locale: { value: string } | string
  }
}

// Element Plus 语言包懒加载缓存
const _epLocaleCache = new Map<string, Record<string, unknown>>()
const _epLocaleLoading = new Map<string, Promise<Record<string, unknown>>>()

// 2026-06-25 修复: 改为静态映射表 (模块级常量, 避免每次调用重建)
// 5 个 EP locale 已在文件顶部 static import, 这里直接拿引用
// 之前的 () => import('...') 形式会在每次 dev HMR 后变成失效 hash
const _epLocales: Record<string, Record<string, unknown>> = {
  'zh-cn': zhCn as Record<string, unknown>,
  'zh-tw': zhTw as Record<string, unknown>,
  en: enUs as Record<string, unknown>,
  ja: jaJp as Record<string, unknown>,
  ko: koKr as Record<string, unknown>,
}

function _epKey(lang: string): string {
  const code = (lang || 'zh-CN').toLowerCase()
  if (code.startsWith('zh-tw')) return 'zh-tw'
  if (code.startsWith('zh')) return 'zh-cn'
  if (code.startsWith('en')) return 'en'
  if (code.startsWith('ja')) return 'ja'
  if (code.startsWith('ko')) return 'ko'
  return 'en'
}

/**
 * 2026-06-25 修复：按需加载 Element Plus 语言包（静态导入版）
 * 首次访问某语言时同步取出引用，后续命中缓存
 * 注意: 此函数必须在调用前已通过 loadElementPlusLocale 预加载，
 *       否则返回 en 兜底 (避免阻塞 UI)
 */
export function getElementPlusLocale(lang: string): Record<string, unknown> {
  const key = _epKey(lang)
  return _epLocaleCache.get(key) || _epLocales[key] || _epLocaleCache.get('en') || _epLocales.en || {}
}

/**
 * 2026-06-25 修复：同步预加载 EP 语言包
 * App.vue 在 locale 变化时调用，确保 el-config-provider 能拿到正确语言
 *
 * 历史: 之前是 async + dynamic import, HMR 后 hash 失效会循环报错
 * 现在: 静态 import, 模块加载时即就绪, 函数体直接命中缓存或兜底
 * 仍保持 async 签名以兼容外部调用方 (App.vue 的 watch callback await)
 */
export async function loadElementPlusLocale(lang: string): Promise<Record<string, unknown>> {
  const key = _epKey(lang)
  // 命中缓存：直接返回（clone 避免外部修改内部缓存）
  if (_epLocaleCache.has(key)) {
    return _epLocaleCache.get(key)!
  }
  // 静态导入：模块已在顶部加载完成，直接取引用 + 缓存
  const locale = _epLocales[key] || _epLocales.en
  _epLocaleCache.set(key, locale)
  // 兜底英文：异步启动预热，确保 UI 始终有可用的 EP 语言包
  if (key !== 'en' && !_epLocaleCache.has('en')) {
    _epLocaleCache.set('en', _epLocales.en)
  }
  return locale
}

// 初始化i18n
export async function initI18n(): Promise<void> {
  await initializeCoreMessages()
  // 2026-06-28 修复: 首屏 coreMessages 就绪后, 空闲时 glob 加载 modules/ 所有文件,
  // 根除 B 类未注册模块键名裸露 (100+ 文件从未被 loadModule 调用).
  // idle 调度避开首屏关键渲染; 失败静默 (预取为优化项).
  const idleLocale = getI18nLocale() as SupportedLocale
  const scheduleIdle = (cb: () => void): void => {
    if (typeof (globalThis as { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback === 'function') {
      ;(globalThis as { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(cb)
    } else {
      setTimeout(cb, 200)
    }
  }
  scheduleIdle(() => {
    loadAllModulesFromGlob(idleLocale).catch((e) => {
      if (import.meta.env.DEV) {
        logger.debug(`[i18n] initI18n idle loadAllModulesFromGlob failed for ${idleLocale}:`, e)
      }
    })
  })
}

export default i18n
