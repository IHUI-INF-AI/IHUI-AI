// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D117:RN 斜杠命令注册表(id 命名对齐 apps/web `command-registry.ts` 的 slash* 体系;
// RN 自包含,不 import web 代码)。注册表零副作用零网络 —— 命令真实动作由上层按 id 接线。

/** 一条斜杠命令(纯数据:面板展示用 + 上层执行分发用) */
export interface SlashCommand {
  /** 命令唯一 id(命名对齐 web slash* 体系,如 'slashModel') */
  id: string
  /** 斜杠字面量(输入框里敲的触发词,如 '/model') */
  trigger: string
  /** 命令中文名(面板主文案) */
  title: string
  /** 命令说明(面板次文案) */
  description?: string
  /** lucide-react-native 图标名(如 'Cpu') */
  icon?: string
}

/** 命令匹配/执行的上下文(执行侧唯一入口:命令动作一律由上层读取本上下文后接线) */
export interface SlashContext {
  /** 输入框当前文本(含开头的 '/') */
  input: string
}

/**
 * 最小命令集(D117 首批:新会话 / 清空当前 / 切换模型 / 帮助)。
 * 只登记声明,不含动作 —— 真实动作(开新会话、清上下文、开模型列表、开帮助)由上层接线。
 */
export const SLASH_COMMANDS: readonly SlashCommand[] = [
  {
    id: 'slashNew',
    trigger: '/new',
    title: '新会话',
    description: '开始一个新的会话',
    icon: 'MessageSquarePlus',
  },
  {
    id: 'slashClear',
    trigger: '/clear',
    title: '清空当前',
    description: '清空当前输入与上下文',
    icon: 'Eraser',
  },
  {
    id: 'slashModel',
    trigger: '/model',
    title: '切换模型',
    description: '打开模型列表切换当前模型',
    icon: 'Cpu',
  },
  {
    id: 'slashHelp',
    trigger: '/help',
    title: '帮助',
    description: '查看可用斜杠命令与用法',
    icon: 'CircleHelp',
  },
]

/** 相关度档:0 = trigger 全等 > 前缀(带 '/')> 前缀(不带 '/')> title 前缀 > 子串 > 说明子串 */
function scoreCommand(cmd: SlashCommand, token: string, q: string): number {
  const trigger = cmd.trigger.toLowerCase()
  const title = cmd.title.toLowerCase()
  if (trigger === token) return 0
  if (trigger.startsWith(token)) return 1
  if (q === '') return -1
  if (trigger.slice(1).startsWith(q)) return 2
  if (title.startsWith(q)) return 3
  if (trigger.includes(q)) return 4
  if (title.includes(q)) return 5
  if ((cmd.description ?? '').toLowerCase().includes(q)) return 6
  return -1
}

/**
 * 按输入文本匹配候选命令(纯函数)。
 * - 非 '/' 开头 ⇒ 返回 [](普通聊天文本不触发命令面板);
 * - '/' 开头 ⇒ 取首个空白前的一段做匹配,对 trigger / title(及说明)大小写不敏感
 *   前缀或子串匹配,按相关度档排序(同档保持注册表顺序)。
 */
export function matchSlashCommands(input: string): SlashCommand[] {
  const trimmed = input.trim()
  if (!trimmed.startsWith('/')) return []
  const token = (trimmed.split(/\s+/)[0] ?? '').toLowerCase()
  const q = token.slice(1)
  const scored: Array<{ cmd: SlashCommand; score: number; index: number }> = []
  SLASH_COMMANDS.forEach((cmd, index) => {
    const score = scoreCommand(cmd, token, q)
    if (score >= 0) scored.push({ cmd, score, index })
  })
  return scored
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .map((item) => item.cmd)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
