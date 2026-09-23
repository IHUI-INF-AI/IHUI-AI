// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 平台特有:依赖 react-navigation 容器 ref 与 RN 端 zustand themeStore,不适合共享
import type { AgentActionErrorCode, AppUiActionType, AppUiSnapshot } from '@ihui/types'

import { themeStore } from '../context/ThemeContext'
import {
  pressField,
  setFieldGroupProvider,
  setValueOnField,
  snapshotFields,
  submitForm,
} from './ui-field-registry'
import { RN_UI_ROUTES, type RnUiRouteEntry } from '../constants/ui-routes.generated'
import { navigationRef } from '../navigation/navigation-ref'
import { requestLocaleChange } from '../i18n'
import type { Locale } from '@ihui/i18n/types'

/**
 * AI 对话操控 RN 端的执行注册表(2026-09-21 立,与 web / 小程序端同一条 agent-control 链路)。
 *
 * 只有 describe / navigate / read / invoke 四个动作。**没有 click / fill / submit**:
 * React Native 渲染的是原生视图,没有 DOM,拿不到"可点元素"的稳定定位符,也没有
 * 任何"给任意控件派发一次点击"的公开 API —— 那三件事只能由业务组件逐个开 setter
 * 通道才成立(且每个 setter 都是一次真实的用户意图提交),不在本次范围。与其让模型
 * 拿到一个永远 SELECTOR_NOT_FOUND 的动作,不如在协议层就不声明它。
 *
 * 本文件是纯逻辑(非 hook):不依赖 React 上下文。需要 React/Provider 才拿得到的能力
 * (登录态)由 use-ui-control-bridge.ts 注入,理由见 configureRnUiBridge 注释。
 */

/** 动作执行结果 —— 由桥层补齐 requestId/durationMs/executedBy 后转成 AgentActionResponse */
export interface RnUiActionResult {
  ok: boolean
  data?: Record<string, unknown>
  error?: string
  errorCode?: AgentActionErrorCode
}

const fail = (errorCode: AgentActionErrorCode, error: string): RnUiActionResult => ({
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
 * 登录态必须注入而非直接 import '../stores/auth-store':那条链会经 tokenStore 在模块
 * 加载期读 SecureStore/AsyncStorage,让本注册表在非 RN 环境(vitest node / 预检)下
 * import 即崩;真机上也会在 AuthProvider 尚未 hydrate 时读到空值,给出假的 authed=false。
 */
export function configureRnUiBridge(deps: { isAuthed?: IsAuthed }): void {
  isAuthed = deps.isAuthed ?? null
}

export function resetRnUiBridge(): void {
  isAuthed = null
}

/* ────────────────────────── 通用小工具 ────────────────────────── */

/** 只接受"字符串键 + 普通对象"这一种形态,数组/null/标量一律视作无参数 */
export function asPlainObject(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {}
}

function readString(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim() : ''
}

/**
 * 参数键命中即打码:路由 params 里可能带着 token / 手机号 / 邮箱(如 ChangePhone: { uuid }
 * 之后回跳带的联系方式),而 read/describe 只是"给 AI 看现状",打码不损失任何可执行能力。
 */
const CREDENTIAL_KEY_RE = /token|password|secret|code|uuid|ticket/i
const PII_KEY_RE = /phone|mobile|email|idcard|passport|身份/i
const MASKED_VALUE = '***'

export function maskParams(params: Record<string, unknown> | undefined): Record<string, unknown> {
  const masked: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(params ?? {})) {
    if (CREDENTIAL_KEY_RE.test(key) || PII_KEY_RE.test(key)) {
      masked[key] = MASKED_VALUE
      continue
    }
    // 对象/数组/函数不回传:RN 路由参数允许塞回调(如 PostCreate.onPickTopic),序列化出去
    // 既无意义也可能带走用户数据(JSON.stringify 会直接丢掉函数),统一归一成占位符
    masked[key] =
      value === null || value === undefined
        ? ''
        : typeof value === 'object' || typeof value === 'function'
          ? '[complex]'
          : value
  }
  return masked
}

function describeError(err: unknown): string {
  if (err instanceof Error && err.message) return err.message
  if (typeof err === 'string' && err) return err
  return '未知错误'
}

/* ────────────────────────── 路由白名单 ────────────────────────── */

const ROUTE_BY_NAME: ReadonlyMap<string, RnUiRouteEntry> = new Map(
  RN_UI_ROUTES.map((route) => [route.name, route]),
)
/** 大小写不敏感的兜底索引:模型常把 screen name 写成 wallet / walletscreen */
const ROUTE_BY_LOWER: ReadonlyMap<string, RnUiRouteEntry> = new Map(
  RN_UI_ROUTES.map((route) => [route.name.toLowerCase(), route]),
)

/**
 * 目标名 → 白名单条目。
 * RN 的导航目标是 screen name 而非 URL 路径,但模型按 web 端习惯大概率写成 '/Wallet',
 * 这里剥掉前导斜杠再查;查不到返回 null,由调用方给 ROUTE_NOT_ALLOWED。
 */
export function resolveRoute(raw: string): RnUiRouteEntry | null {
  const name = raw.replace(/^\/+/, '').trim()
  if (!name) return null
  return ROUTE_BY_NAME.get(name) ?? ROUTE_BY_LOWER.get(name.toLowerCase()) ?? null
}

/* ────────────────────────── 当前路由 ────────────────────────── */

interface NavRouteNode {
  name?: string
  key?: string
  index?: number
  routes?: NavRouteNode[]
  state?: NavRouteNode
}

export interface RnCurrentRoute {
  name: string
  key: string | null
  params: Record<string, unknown>
}

/** 容器未就绪(冷启极早期 / 未登录)时返回空信息而非抛错:describe 仍要能报出白名单 */
export function readCurrentRoute(): RnCurrentRoute {
  try {
    if (!navigationRef.isReady()) return { name: '', key: null, params: {} }
    const route = navigationRef.getCurrentRoute()
    return {
      name: typeof route?.name === 'string' ? route.name : '',
      key: typeof route?.key === 'string' ? route.key : null,
      params: maskParams(asPlainObject(route?.params)),
    }
  } catch {
    return { name: '', key: null, params: {} }
  }
}

/**
 * 从根到叶的激活路径(如 ['Main', 'HomeMain'])。
 * RN 是栈 + 嵌套容器,单看 getCurrentRoute 无法判断"能不能返回",故每层只取 index
 * 指向的那条子路由,与用户实际所见一致。
 */
export function readRouteStack(): string[] {
  const out: string[] = []
  try {
    if (!navigationRef.isReady()) return out
    let node = navigationRef.getRootState() as unknown as NavRouteNode | undefined
    let guard = 0
    while (node && guard < 10) {
      guard += 1
      const children = Array.isArray(node.routes) ? node.routes : []
      const index =
        typeof node.index === 'number' && node.index >= 0 ? node.index : children.length - 1
      const active = children[index]
      if (!active || typeof active.name !== 'string') break
      out.push(active.name)
      node = active.state
    }
  } catch {
    // 读栈失败不影响主用途,回传已收集的部分即可
  }
  return out
}

/* ────────────────────────── invoke 白名单 ────────────────────────── */

interface RnInvokeCommand {
  id: string
  label: string
  group: string
  run: () => Record<string, unknown>
}

/** navigate 只在这一处调用:react-navigation 的 navigate 重载按 name 收窄,脱离具体 screen 类型 */
const navigateFn = navigationRef.navigate as (
  name: string,
  params?: Record<string, unknown>,
) => void

/**
 * 容器未就绪(冷启极早期 / 已登出)时 react-navigation 只会 LogBox 警告而不抛错,
 * 不自己判就会把"什么都没发生"回报成成功 —— navigate 动作在 executeNavigate 里已有同款判定,
 * 命令侧必须一致。抛错由 executeInvoke 兜成 EXECUTION_FAILED。
 */
function requireNavigationReady(): void {
  if (!navigationRef.isReady()) {
    throw new Error('导航容器尚未就绪(App 冷启中或已登出),请稍后重试')
  }
}

/**
 * Main(Bottom Tabs)5 个主屏 → 语义命令(2026-09-21 扩)。
 *
 * 为什么"navigate 也能到 tab"还要单独登记:用户说的是"切到课程/回到首页"这类整句意图,
 * 模型自己走 navigate 得先 describe 拿 routes、认出哪些是 tab、再拼 `Main` 嵌套参数 ——
 * navigate('Home') 还会在 RootStack 上另开一份栈外的第二首页。这条坑由命令封装兜住。
 * screen 必须回查生成清单且 tab===true:哪天某个主屏不再是 tab,命令自动消失,
 * 不给模型一个会失败的"可调用面"。幂等(切到当前 tab 是空操作)、可逆、零网络副作用。
 */
const TAB_COMMAND_SPECS: readonly { id: string; label: string; screen: string }[] = [
  { id: 'tab:home', label: '回到首页 tab', screen: 'HomeMain' },
  { id: 'tab:course', label: '切到「课程」tab', screen: 'CourseMain' },
  { id: 'tab:ai', label: '切到「AI 助手」tab', screen: 'AiMain' },
  { id: 'tab:live', label: '切到「直播」tab', screen: 'LiveMain' },
  { id: 'tab:profile', label: '切到「我的」tab', screen: 'ProfileMain' },
]

const TAB_COMMANDS: readonly RnInvokeCommand[] = TAB_COMMAND_SPECS.flatMap((spec) => {
  const route = ROUTE_BY_NAME.get(spec.screen)
  if (!route?.tab) return []
  return [
    {
      id: spec.id,
      label: spec.label,
      group: 'navigation',
      run: () => {
        requireNavigationReady()
        // tab 子路由不是 RootStack 的直接子节点:state-based 容器要求走 navigate('Main', { screen })
        navigateFn('Main', { screen: route.name })
        return { navigatedTo: `Main/${route.name}` }
      },
    },
  ]
})

const THEME_COMMANDS: readonly RnInvokeCommand[] = [
  {
    id: 'theme:light',
    label: '切换为浅色主题',
    group: 'appearance',
    run: () => {
      themeStore.getState().setTheme('light')
      return { theme: 'light' }
    },
  },
  {
    id: 'theme:dark',
    label: '切换为深色主题',
    group: 'appearance',
    run: () => {
      themeStore.getState().setTheme('dark')
      return { theme: 'dark' }
    },
  },
  {
    id: 'theme:system',
    label: '主题跟随系统',
    group: 'appearance',
    run: () => {
      themeStore.getState().setTheme('system')
      return { theme: 'system' }
    },
  },
]

/** invoke 的全部可调用命令(外观 + 导航) */
const LOCALE_COMMANDS: readonly RnInvokeCommand[] = (
  [
    ['zh-CN', '简体中文'],
    ['en', '英文'],
    ['ja', '日文'],
    ['ko', '韩文'],
    ['zh-TW', '繁体中文'],
  ] as const
).map(([locale, label]) => ({
  id: `locale:${locale}`,
  label: `切换到${label}界面`,
  group: 'locale',
  run: () => {
    // 走 Provider 注册的 setter(会 setState 真重渲染);只写 storage 会造成"报成功但界面没动"
    // 的假成功,所以拿不到 setter 就抛错,由 executeInvoke 如实转成 EXECUTION_FAILED。
    if (!requestLocaleChange(locale as Locale)) {
      throw new Error('I18nProvider 未挂载,无法切换界面文案(不谎报成功)')
    }
    return { locale }
  },
}))

const SAFE_COMMANDS: readonly RnInvokeCommand[] = [
  ...THEME_COMMANDS,
  ...TAB_COMMANDS,
  ...LOCALE_COMMANDS,
]

const INVOKE_BY_ID: ReadonlyMap<string, RnInvokeCommand> = new Map(
  SAFE_COMMANDS.map((cmd) => [cmd.id, cmd]),
)

/*
 * 白名单边界(刻意做小,而不是"能调的都放上"):
 * - 主题三项:themeStore 是 zustand 全局单例(见 src/context/ThemeContext.tsx 注释:
 *   "zustand 全局 store 不需要 Provider"),模块级 setState 会真的重渲染,不存在假成功。
 * - tab 五项:走 navigationRef 容器 ref,是 navigation-ref.ts 已确立的跨树跳转方式;
 *   跳转前先 requireNavigationReady(),容器未就绪时如实失败而不是静默假成功。
 * - 语言切换:**不进白名单**。src/i18n/index.tsx 的 setLocale 只活在 I18nProvider 的
 *   React state 里,注册表拿不到 Provider 引用,模块级改 storage 会造成"存了但界面没变"
 *   的假成功。AI 要改语言时用 navigate('Settings') 把人送到设置页自己点。
 * - 回到顶部 / 打开抽屉:RN 没有全局滚动 API(要逐屏拿 ScrollView ref)、抽屉是
 *   components/Drawer.tsx 的组件内 state,均非模块级可达 → 不列入。
 * - 返回上一级:重复执行会连弹多级页面,不幂等,幻觉代价由用户承担 → 不列入。
 * - 退出登录 / 注销账号 / 支付 / 清理缓存:**永不暴露**。AGENTS 与 ai-service 侧
 *   mobile_ui_invoke 的工具描述已声明"破坏性动作刻意不暴露",端侧必须一致 ——
 *   logoutAuth() 一触发即销毁当前会话,AccountCancel/Payment 类页面还会牵连资金,
 *   幻觉成本由用户承担而收益为零。describe 的 commands 里也不出现它们。
 */

/* ────────────────────────── describe / read / navigate / invoke ────────────────────────── */

/**
 * 快照(结构复用 @ihui/types AppUiSnapshot,与 web/taro 同字段)。
 * routes 是**全量**白名单 —— 它就是 navigate 的可选面,截断会让 AI 误判"没这页"。
 * 204 条 × ~55B ≈ 11KB,由 api 侧一次性回传,可接受。
 */
export function buildRnUiSnapshot(): AppUiSnapshot {
  const current = readCurrentRoute()
  // 控件快照:RN 没有 DOM,click/fill 只能打在"组件挂载时主动登记"的控件上。
  // 空数组也要如实返回 —— 模型据此知道"这一屏没有可操控控件",而不是以为没查。
  const fields = snapshotFields()
  return {
    version: 1,
    screen: {
      name: current.name,
      ...(current.key ? { key: current.key } : {}),
      params: current.params,
    },
    routes: RN_UI_ROUTES.map((route) => ({
      name: route.name,
      requiresParams: route.requiresParams,
      tab: route.tab,
    })),
    commands: SAFE_COMMANDS.map(({ id, label, group }) => ({ id, label, group })),
    authed: isAuthed?.() ?? false,
    elements: fields.elements,
    suppressed: fields.suppressed,
  }
}

/** 控件登记表按当前屏分组:注册表不依赖 react-navigation,分组由这里注入 */
setFieldGroupProvider(() => readCurrentRoute().name)

function executeDescribe(): RnUiActionResult {
  const current = readCurrentRoute()
  const stack = readRouteStack()
  return {
    ok: true,
    // title/url 挂在顶层是 AgentActionResponse.data 的既有字段:调用方不解析 registry 也能读
    // RN 没有 URL,url 给"从根到叶的激活路径",它才是本端等价于路径的东西
    data: {
      registry: buildRnUiSnapshot(),
      title: current.name,
      url: stack.join(' > '),
      stack,
    },
  }
}

function executeRead(): RnUiActionResult {
  const current = readCurrentRoute()
  const stack = readRouteStack()
  return {
    ok: true,
    data: {
      screen: {
        name: current.name,
        ...(current.key ? { key: current.key } : {}),
        path: stack.join(' > '),
        params: current.params,
      },
      title: current.name,
      url: stack.join(' > '),
      stack,
      canGoBack: safeCanGoBack(),
    },
  }
}

function safeCanGoBack(): boolean {
  try {
    return navigationRef.isReady() ? navigationRef.canGoBack() : false
  } catch {
    return false
  }
}

async function executeNavigate(params: Record<string, unknown>): Promise<RnUiActionResult> {
  const raw = readString(params.name)
  const route = resolveRoute(raw)
  if (!route) {
    return fail(
      'ROUTE_NOT_ALLOWED',
      `Screen 不在 RootNavigator 白名单内: ${raw || '(空)'};先用 describe 拿 routes`,
    )
  }
  // 容器未就绪就 navigate,react-navigation 会静默 LogBox 警告而不报错,
  // 故必须自己判定并如实失败,否则回给 AI 一个假成功
  if (!navigationRef.isReady()) {
    return fail('EXECUTION_FAILED', '导航容器尚未就绪(App 冷启中或已登出),请稍后重试')
  }

  const args = asPlainObject(params.args)
  const missing = route.requiredParams.filter((key) => !(key in args))
  if (missing.length > 0) {
    // 用 EXECUTION_FAILED 而非 ROUTE_NOT_ALLOWED:目标本身是合法的,缺的是参数,
    // 回 ROUTE_NOT_ALLOWED 会让模型以为"这页不存在"而改试别的页面
    return fail(
      'EXECUTION_FAILED',
      `页面 ${route.name} 需要参数:${missing.join(', ')};请在 args 里补齐后重试`,
    )
  }

  const hasParams = Object.keys(args).length > 0
  try {
    if (route.tab) {
      // tab 子路由不是 RootStack 的直接子节点:state-based 容器要求走 navigate('Main', { screen })
      navigateFn('Main', hasParams ? { screen: route.name, params: args } : { screen: route.name })
    } else {
      navigateFn(route.name, hasParams ? args : undefined)
    }
  } catch (err) {
    return fail('EXECUTION_FAILED', `导航到 ${route.name} 失败:${describeError(err)}`)
  }
  return {
    ok: true,
    data: {
      navigatedTo: route.name,
      via: route.tab ? 'Main.nested' : 'navigate',
      stack: readRouteStack(),
    },
  }
}

async function executeInvoke(params: Record<string, unknown>): Promise<RnUiActionResult> {
  const name = readString(params.name)
  const command = INVOKE_BY_ID.get(name)
  if (!command) {
    return fail(
      'UNSUPPORTED_ACTION',
      `命令不在白名单内: ${name || '(空)'};可用:${SAFE_COMMANDS.map((c) => c.id).join(', ')}`,
    )
  }
  const args = asPlainObject(params.args)
  const hasArgs = Object.keys(args).length > 0
  try {
    return {
      ok: true,
      data: { invoked: command.id, ...command.run(), ...(hasArgs ? { argsIgnored: true } : {}) },
    }
  } catch (err) {
    return fail('EXECUTION_FAILED', `${command.id} 执行失败:${describeError(err)}`)
  }
}

/** 动作分派入口 —— 桥层把 AgentActionRequest.action/params 原样交进来 */
export async function executeRnUiAction(
  action: AppUiActionType,
  params: Record<string, unknown>,
): Promise<RnUiActionResult> {
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
      // 控件级动作一律经注册表执行:它只认"组件挂载时交出的通道",
      // 没有通道就如实 UNSUPPORTED_ACTION,不会回 ok 而界面没动
      case 'click':
        return pressField(readString(params.target))
      case 'fill':
        return setValueOnField(readString(params.target), params.value ?? '')
      case 'submit':
        return submitForm(readString(params.target))
      default:
        return fail('UNSUPPORTED_ACTION', `RN 端不支持的动作: ${String(action)}`)
    }
  } catch (err) {
    return fail('EXECUTION_FAILED', describeError(err))
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
