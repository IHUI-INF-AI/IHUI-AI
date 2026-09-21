// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 「用户在要求操作我们自己的程序」意图探测(2026-09-21 立,跨端单一事实源)。
 *
 * 为什么在共享层而不是各端各写一份:web / desktop / RN / 小程序四端都要在同一处闸门上
 * 做同一个判断 —— `llm.py` 的 tool loop 只在请求带 `agentTools` 时才进,而各端为保
 * 打字机流式又刻意"普通问答不带工具"(apps/web 2026-08-29 的修复)。于是必须由这句
 * 判断决定"这一条消息到底要不要带操控工具"。关键词表一旦各端复制,四端语义必然漂移。
 *
 * 边界:本模块只判**信号**与**映射机制**,不写死任何工具名 —— 各端族名前缀不同
 * (web_ui_* / mobile_ui_* / taro_ui_*),端用 `createAppControlToolSelector` 注入本端
 * 名字(工厂 + 依赖注入,与 §3 约定一致)。
 * 与 ai-service `conversation._app_control_intent_tools` 同思路:那是 REST 链的兜底,
 * 这里是聊天主链(客户端侧)的正门。
 */

export interface AppControlIntent {
  /** 要求操作自家界面(打开/跳转/点击/填写/提交/读页面…) */
  ui: boolean
  /** 要求走后端能力或查业务数据(接口/列出所有/有多少…) */
  api: boolean
}

/** UI 操控强信号。刻意包含"面板/侧边栏"这类界面名词:用户说"收起侧边栏"就是在要求操作界面。 */
const UI_CONTROL_KEYWORDS: readonly string[] = [
  '打开',
  '跳转',
  '切到',
  '切换到',
  '进入',
  '回到',
  '导航到',
  '带我到',
  '点击',
  '点一下',
  '按下',
  '按一下',
  '填写',
  '填入',
  '填一下',
  '填成',
  '输入框',
  '表单',
  '下拉框',
  '提交表单',
  '保存表单',
  '这个页面',
  '当前页面',
  '页面上',
  '页面显示',
  '可操控',
  '能操作',
  '操控',
  '操作这个',
  '操作我们',
  '操作本站',
  '新建会话',
  '命令面板',
  '侧边栏',
  '面板',
]

const API_CONTROL_KEYWORDS: readonly string[] = [
  '接口',
  'api',
  '端点',
  '后端',
  '服务端',
  '列出所有',
  '查一下所有',
  '有多少',
  '统计一下',
  '用户列表',
  '订单列表',
  '后台数据',
  '调用',
]

function includesAny(text: string, keywords: readonly string[]): boolean {
  for (const kw of keywords) {
    if (text.includes(kw)) return true
  }
  return false
}

/** 判定一条用户消息是否属于"操控本站"意图(大小写不敏感,中文关键词原样匹配)。 */
export function detectAppControlIntent(content: string): AppControlIntent {
  if (!content) return { ui: false, api: false }
  const text = content.toLowerCase()
  return {
    ui: includesAny(text, UI_CONTROL_KEYWORDS),
    api: includesAny(text, API_CONTROL_KEYWORDS),
  }
}

/** 一个端的工具族:命中哪类信号就带哪组名字(前缀各端不同,由端注入)。 */
export interface AppControlToolFamily {
  /** 本端 UI 操控工具名,如 web_ui_* / mobile_ui_* / taro_ui_* */
  ui: readonly string[]
  /** 后端能力入口工具名,各端同名(api_endpoints_search / api_endpoint_call) */
  api: readonly string[]
}

/**
 * 意图 → 本端工具名选择器工厂(§3 工厂 + 依赖注入:判断在共享层,名字在端内)。
 *
 * 为什么要有它:web / RN / 小程序三端"命中后带哪些名字"的逻辑**逐字相同**,
 * 只有名字不同。复制三份必然漂移(曾经就漂过:web 版关键词表改一改,另两端悄悄不一致)。
 *
 * 未命中返回空数组 —— 调用方据此**完全不传 agentTools**,而不是传 []。
 * 这不是洁癖:`llm.py` 的 tool loop 只在 agent_tools 非空时进入,而普通问答恒带工具会把
 * 首字延迟拖进一整轮 tool 往返(web 端 2026-08-29 正是为此改成按需携带)。
 */
export function createAppControlToolSelector(
  family: AppControlToolFamily,
): (content: string) => string[] {
  return (content: string): string[] => {
    const { ui, api } = detectAppControlIntent(content)
    if (!ui && !api) return []
    const out = new Set<string>()
    // 动作类工具依赖 describe 返回的 name/参数形状,整族一起带(拆细会让模型拿不到定位符)
    if (ui) for (const t of family.ui) out.add(t)
    // 入口工具必须成对:只给 search,模型搜到了却调不动
    if (api) for (const t of family.api) out.add(t)
    return [...out]
  }
}

/**
 * 取最后一条 user 消息正文(结构化最小约束,各端 message 类型都能传进来)。
 *
 * 只看当前这一句:翻历史既慢又会被上文带偏(上一轮聊到"打开面板"不该让这一轮"谢谢"也带工具)。
 */
export function lastUserContent(
  messages: ReadonlyArray<{ role: string; content: unknown }>,
): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (!m) continue
    if (m.role === 'user') return typeof m.content === 'string' ? m.content : ''
  }
  return ''
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
