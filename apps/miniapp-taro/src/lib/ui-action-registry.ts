// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 平台特有:依赖 Taro API(小程序运行时),不适合共享
import Taro from '@tarojs/taro'
import type { AgentActionErrorCode, AppUiSnapshot, TaroUiActionType } from '@ihui/types'

import {
  TARO_APP_WINDOW_TITLE,
  TARO_UI_ROUTES,
  type TaroUiRouteEntry,
} from '@/constants/ui-routes.generated'
import { setThemePreference } from '@/lib/theme'
import { requestLocaleChange } from '@/i18n'

/**
 * AI 对话操控小程序端的执行注册表(2026-09-21 立,与 web/RN 端同链路的降级形态)。
 *
 * 只暴露 describe / navigate / read / invoke 四个动作(协议见 @ihui/types TaroUiActionType):
 * 小程序没有 DOM,click/fill/submit 不成立,因此**不做**任何"猜测元素并点一下"的能力,
 * 导航目标必须命中 generate-ui-routes.mjs 生成的页面白名单。
 *
 * 本文件是纯逻辑(非 hook):依赖 Taro 运行时 API,不依赖 React 上下文。
 * 需要 React/Provider 才能生效的能力(如登录态)由 use-ui-control-bridge.ts 注入。
 */

/** 动作执行结果 —— 由桥层补齐 requestId/durationMs/executedBy 后转成 AgentActionResponse */
export interface TaroUiActionResult {
  ok: boolean
  data?: Record<string, unknown>
  error?: string
  errorCode?: AgentActionErrorCode
}

const fail = (errorCode: AgentActionErrorCode, error: string): TaroUiActionResult => ({
  ok: false,
  errorCode,
  error,
})

/* ────────────────────────── 桥接依赖注入 ────────────────────────── */

type IsAuthed = () => boolean

let isAuthed: IsAuthed | null = null

/**
 * 注入无法模块级访问的能力。
 *
 * 登录态必须注入而非直接 import '@/utils/auth':auth.ts 在模块加载时就会读 storage,
 * 会让本注册表在非小程序环境(如 vitest node 环境、SSR 预检)下 import 即崩。
 */
export function configureTaroUiBridge(deps: { isAuthed?: IsAuthed }): void {
  isAuthed = deps.isAuthed ?? null
}

export function resetTaroUiBridge(): void {
  isAuthed = null
}

/* ────────────────────────── 路由白名单 ────────────────────────── */

const ROUTE_BY_PATH: ReadonlyMap<string, TaroUiRouteEntry> = new Map(
  TARO_UI_ROUTES.map((route) => [route.path, route]),
)

/** AI 给的页面名归一化为 '/a/b'(是否带前导斜杠都接受,Taro 两种写法都合法) */
export function normalizeRoutePath(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}

/** 拆出 path 与 query:允许 AI 直接给 '/pkg-ai/ai/chat?id=1',query 再并回 url */
function splitQuery(name: string): { path: string; query: string } {
  const i = name.indexOf('?')
  if (i < 0) return { path: name, query: '' }
  return { path: name.slice(0, i), query: name.slice(i + 1) }
}

/* ────────────────────────── 敏感信息打码 ────────────────────────── */

/**
 * 参数键命中即打码:小程序页面 query 常见 token/code,注册表与回传都不得带出真值。
 * 除协议要求的凭据类(token/password/secret/code)外,再并一层个人身份信息(手机号/邮箱/证件),
 * 因为 read/describe 只是"给 AI 看现状",打码不损失任何可执行能力。
 */
const CREDENTIAL_KEY_RE = /token|password|secret|code/i
const PII_KEY_RE = /phone|mobile|email|idcard|passport|身份/i
const MASKED_VALUE = '***'

export function maskParams(params: Record<string, unknown> | undefined): Record<string, unknown> {
  const masked: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(params ?? {})) {
    if (CREDENTIAL_KEY_RE.test(key) || PII_KEY_RE.test(key)) {
      masked[key] = MASKED_VALUE
      continue
    }
    // 对象/数组不回传:页面参数结构由实现决定,可能裹着用户数据,只回传原始类型
    masked[key] =
      value === null || value === undefined ? '' : typeof value === 'object' ? '[complex]' : value
  }
  return masked
}

/* ────────────────────────── 当前页面 ────────────────────────── */

interface CurrentPageInfo {
  path: string
  title: string
  params: Record<string, unknown>
}

interface RawPageInstance {
  route?: string
  __route__?: string
  options?: Record<string, unknown>
}

function readTopPage(): RawPageInstance | null {
  try {
    const pages = Taro.getCurrentPages()
    if (!Array.isArray(pages) || pages.length === 0) return null
    return pages[pages.length - 1] as unknown as RawPageInstance | null
  } catch {
    return null
  }
}

function readRouterFallback(): { path: string; params: Record<string, unknown> } | null {
  try {
    const router = Taro.getCurrentInstance().router
    if (!router?.path) return null
    return {
      path: router.path,
      params: (router.params ?? {}) as Record<string, unknown>,
    }
  } catch {
    return null
  }
}

/**
 * 当前页 = 页面栈顶;栈空(启动早期 / H5)时才回落 Taro router。
 * 标题不取运行时 API(小程序没有"读导航栏标题"的 API),而是回查生成清单里的
 * navigationBarTitleText —— 它与页面 config 同源,不会出现两处不一致。
 */
export function readCurrentPage(): CurrentPageInfo {
  const top = readTopPage()
  const routePath = top?.route ?? top?.__route__ ?? ''
  const raw = routePath
    ? { path: routePath, params: top?.options ?? {} }
    : (readRouterFallback() ?? { path: '', params: {} })
  const path = normalizeRoutePath(raw.path)
  const route = ROUTE_BY_PATH.get(path)
  return {
    path,
    title: route?.title ?? TARO_APP_WINDOW_TITLE,
    params: maskParams(raw.params),
  }
}

/* ────────────────────────── invoke 白名单 ────────────────────────── */

interface TaroInvokeCommand {
  id: string
  label: string
  group: string
  /**
   * 同步命令(主题)直接返回数据;要等平台 API 落定(switchTab / pageScrollTo)的返回 Promise,
   * 由 executeInvoke 统一 await —— 否则 rejection 逃不出 try/catch,会把失败报成成功。
   */
  run: () => Record<string, unknown> | Promise<Record<string, unknown>>
}

const THEME_COMMANDS: readonly TaroInvokeCommand[] = [
  {
    id: 'theme:light',
    label: '切换为浅色主题',
    group: 'appearance',
    run: () => ({ theme: setThemePreference('light') }),
  },
  {
    id: 'theme:dark',
    label: '切换为深色主题',
    group: 'appearance',
    run: () => ({ theme: setThemePreference('dark') }),
  },
  {
    id: 'theme:auto',
    label: '主题跟随系统',
    group: 'appearance',
    run: () => ({ theme: setThemePreference('auto') }),
  },
]

/**
 * tabBar 切换命令(2026-09-21 扩)。
 *
 * 为什么"navigate 已经能到 tab 页"还要单独登记一份:用户说的是"切到 AI agent 那个 tab",
 * 模型得先 describe 拿 routes、自己判 tab、自己保证不带 query —— 每一步都可能错。
 * 这里把"五个常驻 tab"钉成五个语义命令,幂等(switchTab 到当前 tab 是空操作)、可逆、零副作用。
 * path 必须回查 app.config.ts 生成的白名单:页面哪天不再是 tab,命令自动从清单里消失,
 * 不给模型一个会失败的"可调用面"。
 */
const TAB_COMMAND_SPECS: readonly { id: string; label: string; path: string }[] = [
  { id: 'tab:home', label: '切到「智汇社区」首页 tab', path: '/pages/index/index' },
  { id: 'tab:agent', label: '切到「AI agent」tab', path: '/pages/community/index' },
  { id: 'tab:square', label: '切到「广场」tab', path: '/pages/plaza/index/index' },
  { id: 'tab:mine', label: '切到「我的」tab', path: '/pages/user/index' },
  { id: 'tab:share', label: '切到「分享星球」tab', path: '/pages/share/index' },
]

const TAB_COMMANDS: readonly TaroInvokeCommand[] = TAB_COMMAND_SPECS.flatMap((spec) => {
  const route = ROUTE_BY_PATH.get(spec.path)
  if (!route?.tab) return []
  return [
    {
      id: spec.id,
      label: spec.label,
      group: 'navigation',
      // switchTab 不收 query(微信硬约束),故只给 url,不拼参数
      run: async () => {
        await Taro.switchTab({ url: route.path })
        return { navigatedTo: route.path, title: route.title, via: 'switchTab' }
      },
    },
  ]
})

/**
 * 页面级命令:滚回顶部。小程序没有 DOM 可枚举,scroll 是 invoke 独有的能力 ——
 * 效果只作用于当前页面(描述里写明),重复执行不叠加。
 */
const PAGE_COMMANDS: readonly TaroInvokeCommand[] = [
  {
    id: 'page:top',
    label: '把当前页面滚动到顶部',
    group: 'page',
    run: async () => {
      await Taro.pageScrollTo({ scrollTop: 0, duration: 200 })
      return { scrolledTo: 'top' }
    },
  },
]

/** 与 `src/i18n` 里 `LOCALES` 同一套码值(i18n/index.tsx 硬校验这五个,写错就是静默不切)。 */
const LOCALE_IDS = ['zh-CN', 'en', 'ja', 'ko', 'zh-TW'] as const
const LOCALE_LABELS: Record<(typeof LOCALE_IDS)[number], string> = {
  'zh-CN': '简体中文',
  en: '英文',
  ja: '日文',
  ko: '韩文',
  'zh-TW': '繁体中文',
}

/** invoke 的全部可调用命令(不止主题:外观 + 导航 + 页面三类) */
const LOCALE_COMMANDS: readonly TaroInvokeCommand[] = LOCALE_IDS.map(
  (locale): TaroInvokeCommand => ({
    id: `locale:${locale}`,
    label: `切换到${LOCALE_LABELS[locale]}界面`,
    group: 'locale',
    run: () => {
      // 走 Provider 注册进来的 setter(会 setState 真重渲染)。直接写 storage 只会让下一次
      // 渲染用到新值,当前界面不动 —— 那是"报成功但用户什么都没看见"的假成功,故拿不到
      // setter 就抛错,由 executeInvoke 如实转成 EXECUTION_FAILED。
      if (!requestLocaleChange(locale)) {
        throw new Error('I18nProvider 未挂载,无法切换界面文案(不谎报成功)')
      }
      return { locale }
    },
  }),
)

const INVOKE_COMMANDS: readonly TaroInvokeCommand[] = [
  ...THEME_COMMANDS,
  ...TAB_COMMANDS,
  ...PAGE_COMMANDS,
  ...LOCALE_COMMANDS,
]

const INVOKE_BY_ID: ReadonlyMap<string, TaroInvokeCommand> = new Map(
  INVOKE_COMMANDS.map((cmd) => [cmd.id, cmd]),
)

/*
 * 白名单边界(刻意做小,而不是"能调的都放上"):
 * - 只收"模块级就真能生效"的能力。主题走 setThemePreference(内部同步原生导航栏/tabBar
 *   配色并 eventCenter 广播)、tab 走 Taro.switchTab、滚动走 Taro.pageScrollTo —— 三者都是
 *   全局 API,调用后界面确实变了,不存在假成功。
 * - 语言切换:**不进白名单**。src/i18n/index.tsx 的 setLocale 只存在于 I18nProvider 的
 *   React state 里(模块级只有被 Provider 回写的 currentLocale),注册表拿不到 Provider 引用,
 *   模块级改 storage 会造成"storage 变了、界面没变"的假成功 → 不进白名单。AI 需要改语言时用
 *   navigate('/pages/setting/language') 把人送到设置页由用户自己点。
 * - 退出登录:**永不暴露**。clearAuth() 一触发即销毁当前会话且不可逆,而 AI 幻觉的
 *   成本由用户承担(要重新走一遍微信授权),收益为零。describe 的 commands 里也不出现它。
 * - 缓存清理 / 反馈提交 / 支付 / 下单 / 分享:同理,均为不可逆、花钱或对外发声动作,一律不列入。
 * - 打开弹窗类:重复调用会叠层,不满足幂等,亦不列入。
 */

/* ────────────────────────── describe / read / navigate / invoke ────────────────────────── */

/**
 * 快照(协议结构复用 @ihui/types AppUiSnapshot)。
 * routes 是**全量**页面清单 —— 它就是 navigate 的白名单,截断会让 AI 误判可去处;
 * 条数与 app.config.ts 的 pages+subPackages 合计一致(由 generate-ui-routes.mjs 保证),
 * 单条约 40B、总量 ~8KB,由 api 侧一次性回传,可接受。
 */
export function buildTaroUiSnapshot(): AppUiSnapshot {
  const current = readCurrentPage()
  const snapshot: AppUiSnapshot = {
    version: 1,
    screen: {
      name: current.path,
      params: current.params,
    },
    routes: TARO_UI_ROUTES.map((route) => ({
      name: route.path,
      requiresParams: route.requiresParams,
      tab: route.tab,
    })),
    commands: INVOKE_COMMANDS.map(({ id, label, group }) => ({ id, label, group })),
    authed: isAuthed?.() ?? false,
  }
  return snapshot
}

function executeDescribe(): TaroUiActionResult {
  const current = readCurrentPage()
  return {
    ok: true,
    // title/url 同时挂在顶层:AgentActionResponse.data 的既有字段,方便调用方不解析 registry 也能读
    data: { registry: buildTaroUiSnapshot(), title: current.title, url: current.path },
  }
}

function executeRead(): TaroUiActionResult {
  const current = readCurrentPage()
  return {
    ok: true,
    data: {
      screen: {
        name: current.path,
        path: current.path,
        title: current.title,
        params: current.params,
      },
      title: current.title,
      url: current.path,
    },
  }
}

function buildTargetUrl(routePath: string, query: string, args: Record<string, unknown>): string {
  const parts: string[] = []
  if (query) parts.push(query)
  for (const [key, value] of Object.entries(args)) {
    if (value === null || value === undefined || typeof value === 'object') continue
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
  }
  if (parts.length === 0) return routePath
  // switchTab 分支会丢掉 query(微信禁止 switchTab 带参数),这里只负责拼
  return `${routePath}?${parts.join('&')}`
}

async function executeNavigate(params: Record<string, unknown>): Promise<TaroUiActionResult> {
  const name = typeof params.name === 'string' ? params.name.trim() : ''
  if (!name) return fail('ROUTE_NOT_ALLOWED', 'navigate 缺少字符串参数 name')

  const { path: rawPath, query } = splitQuery(normalizeRoutePath(name))
  const route = ROUTE_BY_PATH.get(rawPath)
  if (!route) {
    return fail('ROUTE_NOT_ALLOWED', `页面不在 app.config.ts 白名单内: ${rawPath}`)
  }

  const args =
    params.args && typeof params.args === 'object' && !Array.isArray(params.args)
      ? (params.args as Record<string, unknown>)
      : {}
  const restart = params.restart === true || args.restart === true

  // 小程序硬约束:tabBar 页只能 switchTab(navigateTo 直接 fail),且 switchTab 不收 query;
  // navigateTo 页面栈超 10 层等失败一律如实回传 errMsg,不做静默重定向或自动 reLaunch
  const url = route.tab ? route.path : buildTargetUrl(route.path, query, args)
  const apiName = restart ? 'reLaunch' : route.tab ? 'switchTab' : 'navigateTo'
  try {
    if (restart) await Taro.reLaunch({ url })
    else if (route.tab) await Taro.switchTab({ url })
    else await Taro.navigateTo({ url })
  } catch (err) {
    return fail('EXECUTION_FAILED', `${apiName} ${url} 失败:${describeError(err)}`)
  }
  return {
    ok: true,
    data: {
      navigatedTo: route.path,
      url,
      via: apiName,
      title: route.title,
      ...(route.tab && query ? { droppedQuery: query } : {}),
    },
  }
}

async function executeInvoke(params: Record<string, unknown>): Promise<TaroUiActionResult> {
  const name = typeof params.name === 'string' ? params.name.trim() : ''
  const command = INVOKE_BY_ID.get(name)
  if (!command) {
    return fail(
      'UNSUPPORTED_ACTION',
      `命令不在白名单内: ${name || '(空)'};可用:${INVOKE_COMMANDS.map((c) => c.id).join(', ')}`,
    )
  }
  const args = params.args
  const hasArgs = !!args && typeof args === 'object' && Object.keys(args).length > 0
  try {
    const result = await command.run()
    return {
      ok: true,
      data: { invoked: command.id, ...result, ...(hasArgs ? { argsIgnored: true } : {}) },
    }
  } catch (err) {
    return fail('EXECUTION_FAILED', `${command.id} 执行失败:${describeError(err)}`)
  }
}

function describeError(err: unknown): string {
  if (err && typeof err === 'object') {
    const e = err as { errMsg?: unknown; message?: unknown }
    if (typeof e.errMsg === 'string' && e.errMsg) return e.errMsg
    if (typeof e.message === 'string' && e.message) return e.message
  }
  return typeof err === 'string' ? err : '未知错误'
}

/** 动作分派入口 —— 桥层把 AgentActionRequest.action/params 原样交进来 */
export async function executeTaroUiAction(
  action: TaroUiActionType,
  params: Record<string, unknown>,
): Promise<TaroUiActionResult> {
  try {
    switch (action) {
      case 'describe':
        return executeDescribe()
      case 'navigate':
        return await executeNavigate(params)
      case 'read':
        return executeRead()
      case 'invoke':
        return await executeInvoke(params)
      default:
        return fail('UNSUPPORTED_ACTION', `小程序端不支持的动作: ${String(action)}`)
    }
  } catch (err) {
    return fail('EXECUTION_FAILED', describeError(err))
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
