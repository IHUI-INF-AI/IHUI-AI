// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D117:RN 斜杠命令注册表(id 命名对齐 apps/web `command-registry.ts` 的 slash* 体系;
// RN 自包含,不 import web 代码)。注册表零副作用零网络 —— 命令真实动作由上层按 id 接线。

/** 一条斜杠命令(本地化后的形态:面板展示用 + 上层执行分发用) */
export interface SlashCommand {
  /** 命令唯一 id(命名对齐 web slash* 体系,如 'slashModel') */
  id: string
  /** 斜杠字面量(输入框里敲的触发词,如 '/model') */
  trigger: string
  /** 命令名(面板主文案,由 i18n 键解析而来,端内不落硬编码中文) */
  title: string
  /** 命令说明(面板次文案) */
  description?: string
  /** lucide-react-native 图标名(如 'Cpu') */
  icon?: string
  /** 内容模板类命令:选中后填充到输入框的引导语(对齐 web SLASH_COMMAND_IDS / promptTemplates) */
  promptTemplate?: string
}

/** 命令定义(纯数据:零 i18n、零 React、零网络)—— 文案一律登记 i18n 键 */
interface SlashCommandDef {
  id: string
  trigger: string
  /** 命令名 i18n 键 */
  titleKey: string
  /** 命令说明 i18n 键 */
  descKey: string
  icon?: string
  /** 内容模板 i18n 键(选中后填充到输入框) */
  templateKey?: string
}

/** i18n 取词签名(与端内 `useI18n().t` 同形) */
type SlashTranslate = (key: string) => string

/**
 * 命令注册表(定义面:只声明,不执行 —— 真实动作由上层按 id 接线)。
 * 文案全走 i18n 键,装配点用 `resolveSlashCommands(t)` 解析;模板类七条与 web
 * `slash-command-data.ts` 的 `SLASH_COMMAND_IDS` 逐条同序,新增命令必须两侧同批登记。
 */
const SLASH_COMMAND_DEFS: readonly SlashCommandDef[] = [
  // ── 动作型(本端可真执行) ──
  { id: 'slashNew', trigger: '/new', titleKey: 'slashCmd.new', descKey: 'slashCmd.newDesc', icon: 'MessageSquarePlus' },
  { id: 'slashClear', trigger: '/clear', titleKey: 'slashCmd.clear', descKey: 'slashCmd.clearDesc', icon: 'Eraser' },
  { id: 'slashModel', trigger: '/model', titleKey: 'slashCmd.model', descKey: 'slashCmd.modelDesc', icon: 'Cpu' },
  // D117 工具型:对齐 web `CHAT_TOOL_COMMANDS` 的 /compact /status。
  // /diff 与 /mcp 不上架 —— 前者要本地 git 工作区、后者是 IDE 面板路由,移动端皆无宿主
  // (豁免依据见 PROJECT_PLAN.md 对齐登记,不上架也不进文案)。
  { id: 'slashCompact', trigger: '/compact', titleKey: 'slashCmd.compact', descKey: 'slashCmd.compactDesc', icon: 'Minimize2' },
  { id: 'slashStatus', trigger: '/status', titleKey: 'slashCmd.status', descKey: 'slashCmd.statusDesc', icon: 'Info' },
  { id: 'slashHelp', trigger: '/help', titleKey: 'slashCmd.help', descKey: 'slashCmd.helpDesc', icon: 'CircleHelp' },
  // ── 内容模板类:选中后填充模板到输入框(顺序与 web SLASH_COMMAND_IDS 一致) ──
  { id: 'summary', trigger: '/summary', titleKey: 'slashCmd.summary', descKey: 'slashCmd.summaryDesc', icon: 'FileText', templateKey: 'slashTemplate.summary' },
  { id: 'translate', trigger: '/translate', titleKey: 'slashCmd.translate', descKey: 'slashCmd.translateDesc', icon: 'Languages', templateKey: 'slashTemplate.translate' },
  { id: 'explain', trigger: '/explain', titleKey: 'slashCmd.explain', descKey: 'slashCmd.explainDesc', icon: 'BookOpen', templateKey: 'slashTemplate.explain' },
  { id: 'code', trigger: '/code', titleKey: 'slashCmd.code', descKey: 'slashCmd.codeDesc', icon: 'Code', templateKey: 'slashTemplate.code' },
  { id: 'polish', trigger: '/polish', titleKey: 'slashCmd.polish', descKey: 'slashCmd.polishDesc', icon: 'PenLine', templateKey: 'slashTemplate.polish' },
  { id: 'wechat-article', trigger: '/wechat-article', titleKey: 'slashCmd.wechatArticle', descKey: 'slashCmd.wechatArticleDesc', icon: 'Newspaper', templateKey: 'slashTemplate.wechatArticle' },
  { id: 'koubo-script', trigger: '/koubo-script', titleKey: 'slashCmd.kouboScript', descKey: 'slashCmd.kouboScriptDesc', icon: 'Mic', templateKey: 'slashTemplate.kouboScript' },
]

/** 把定义解析成本地化命令(面板与执行侧统一吃这一份) */
export function resolveSlashCommands(t: SlashTranslate): SlashCommand[] {
  return SLASH_COMMAND_DEFS.map((def) => {
    const cmd: SlashCommand = {
      id: def.id,
      trigger: def.trigger,
      title: t(def.titleKey),
      description: t(def.descKey),
    }
    if (def.icon !== undefined) cmd.icon = def.icon
    if (def.templateKey !== undefined) cmd.promptTemplate = t(def.templateKey)
    return cmd
  })
}

/**
 * `/help` 文案:由命令表现场拼,不另立一份手写清单 ——
 * 新增命令只要进注册表就会自动出现在帮助里,不会留一条与面板不一致的旧文案。
 */
export function formatSlashHelp(t: (key: string, params?: Record<string, string | number>) => string): string {
  const list = resolveSlashCommands(t)
    .map((cmd) => `${cmd.trigger} ${cmd.title}`)
    .join(' · ')
  return t('slashCmd.helpPrefix', { list })
}

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
 * - commands 由调用方传 `resolveSlashCommands(t)` 的结果(匹配要打在本地化文案上,
 *   否则中文用户按「总结」筛不出 /summary)。
 */
export function matchSlashCommands(input: string, commands: readonly SlashCommand[]): SlashCommand[] {
  const trimmed = input.trim()
  if (!trimmed.startsWith('/')) return []
  const token = (trimmed.split(/\s+/)[0] ?? '').toLowerCase()
  const q = token.slice(1)
  const scored: Array<{ cmd: SlashCommand; score: number; index: number }> = []
  commands.forEach((cmd, index) => {
    const score = scoreCommand(cmd, token, q)
    if (score >= 0) scored.push({ cmd, score, index })
  })
  return scored
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .map((item) => item.cmd)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
