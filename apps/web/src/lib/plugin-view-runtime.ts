// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 插件视图运行时 `plugin_view_runtime.ts`(2026-11-15 立,对标 Trae 插件视图)。
 *
 * 来源(逆向 T3§F / T4§F)
 * ------------------------
 * Trae 模块化"插件 → 侧边栏 / 视图"运行时:插件注册侧边栏面板 / webview 视图,
 * 宿主把它渲染进隔离容器,插件与宿主之间只走消息桥。
 *
 * 本仓复用铁律(现读 `src/app-tests/design-preview-iframe-sandbox.test.tsx`)
 * ---------------------------------------------------------------
 * 设计器预览 iframe 已立:sandbox 恰为 `allow-scripts`(不给 allow-same-origin ⇒
 * 断源),跨框通信只有 postMessage。插件视图**沿用同一条铁律** —— 不重造第二种
 * 沙箱,把"断源 + postMessage"做成可复用的 manifest 校验 + srcdoc 构造。
 *
 * 单一真相源
 * ----------
 * - 沙箱策略常量 `PLUGIN_VIEW_SANDBOX` 是唯一来源;渲染 iframe 的组件必须引用它,
 *   禁止各处手写字符串(否则某一处漏掉 allow-same-origin 就破源)。
 * - manifest 校验 `validatePluginViewManifest` 是唯一入口,产 `PluginViewManifest`。
 */

/**
 * 插件视图 iframe 的 sandbox 属性。
 * 只给 `allow-scripts`:iframe 内容能跑脚本但**非同源**,读不到
 * window.parent.document / localStorage / 会话 cookie(同设计器预览铁律)。
 */
export const PLUGIN_VIEW_SANDBOX = 'allow-scripts'

/** 插件视图与宿主通信的消息通道字面量(两侧契约,改须同批)。 */
export const PLUGIN_VIEW_MSG = 'ihui-plugin-view' as const

/** 允许插件视图使用的消息 kind(白名单,超出拒绝)。 */
export const PLUGIN_VIEW_KINDS = ['ready', 'resize', 'navigate', 'error'] as const
export type PluginViewKind = (typeof PLUGIN_VIEW_KINDS)[number]

export interface PluginViewManifest {
  /** 插件 id(稳定标识)。 */
  id: string
  /** 展示名。 */
  title: string
  /** 视图入口:完整 HTML(srcdoc)或一个 https URL。二选一,不得混用。 */
  html?: string
  src?: string
  /** 声明该视图需要的能力(仅登记,实际授权由服务端 capability gate 决定)。 */
  capabilities?: string[]
}

export interface PluginViewValidation {
  ok: boolean
  problems: string[]
  manifest?: PluginViewManifest
}

/**
 * 校验插件视图 manifest。
 *
 * 规则(fail-closed,任一不过即整份拒绝):
 * - id 必须非空且匹配 `^[a-zA-Z0-9_-]{1,64}$`;
 * - title 非空;
 * - html 与 src 二选一:都给 ⇒ 拒(歧义);都不给 ⇒ 拒(空视图);
 * - src 只接受 `https:`(插件视图不加载 http 明文,不加载 data:/blob: 内联脚本)。
 *   html 走 srcdoc(沙箱内,非同源),不受此限。
 */
export function validatePluginViewManifest(raw: unknown): PluginViewValidation {
  const problems: string[] = []
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, problems: ['manifest 必须是对象'] }
  }
  const obj = raw as Record<string, unknown>

  const id = typeof obj.id === 'string' ? obj.id : ''
  if (!id) problems.push('id 必须为非空字符串')
  else if (!/^[a-zA-Z0-9_-]{1,64}$/.test(id)) problems.push(`id 形状非法: ${id}`)

  const title = typeof obj.title === 'string' ? obj.title.trim() : ''
  if (!title) problems.push('title 必须为非空字符串')

  const hasHtml = typeof obj.html === 'string' && obj.html.length > 0
  const hasSrc = typeof obj.src === 'string' && obj.src.length > 0
  if (hasHtml && hasSrc) problems.push('html 与 src 二选一,不得同时给出')
  if (!hasHtml && !hasSrc) problems.push('必须提供 html(srcdoc)或 src(URL)之一')

  let src: string | undefined
  if (hasSrc) {
    src = obj.src as string
    let u: URL | null = null
    try {
      u = new URL(src)
    } catch {
      problems.push(`src 不是合法 URL: ${src}`)
    }
    if (u && u.protocol !== 'https:') problems.push(`src 只接受 https:,得到 ${u.protocol}`)
  }

  const capabilities = Array.isArray(obj.capabilities)
    ? (obj.capabilities as unknown[]).filter((c): c is string => typeof c === 'string')
    : undefined

  if (problems.length > 0) return { ok: false, problems }
  const manifest: PluginViewManifest = {
    id,
    title,
    ...(hasHtml ? { html: obj.html as string } : {}),
    ...(src ? { src } : {}),
    ...(capabilities && capabilities.length > 0 ? { capabilities } : {}),
  }
  return { ok: true, problems: [], manifest }
}

export interface PluginViewMessage {
  type: typeof PLUGIN_VIEW_MSG
  pluginId: string
  kind: PluginViewKind
  payload?: Record<string, unknown>
}

/** 类型守卫:是否是一条合法的插件视图消息(校验 type / pluginId / kind 白名单)。 */
export function isPluginViewMessage(data: unknown): data is PluginViewMessage {
  if (typeof data !== 'object' || data === null) return false
  const o = data as Record<string, unknown>
  return (
    o.type === PLUGIN_VIEW_MSG &&
    typeof o.pluginId === 'string' &&
    o.pluginId.length > 0 &&
    typeof o.kind === 'string' &&
    (PLUGIN_VIEW_KINDS as readonly string[]).includes(o.kind)
  )
}

/**
 * 构造宿主 → 插件视图的初始化消息。
 * 插件视图加载后监听 message,收到这条即进入就绪态。
 */
export function hostInitMessage(pluginId: string): PluginViewMessage {
  return { type: PLUGIN_VIEW_MSG, pluginId, kind: 'ready', payload: {} }
}

/**
 * 把 manifest 转成 iframe 属性(srcdoc / src + sandbox)。
 * 返回的 sandbox 恒为 PLUGIN_VIEW_SANDBOX(断源),调用方直接铺到 <iframe>。
 */
export function iframePropsFor(manifest: PluginViewManifest): {
  srcDoc?: string
  src?: string
  sandbox: typeof PLUGIN_VIEW_SANDBOX
} {
  if (manifest.html) return { srcDoc: manifest.html, sandbox: PLUGIN_VIEW_SANDBOX }
  return { src: manifest.src, sandbox: PLUGIN_VIEW_SANDBOX }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
