// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 深化P(2026-11-17):工具调用参数一句话摘要 —— 纯逻辑模块(单一真相源)。
// 痛点:子代理内嵌工具清单(Checklist)只显示工具名("读取文件 ×N"),用户不知道
//       具体读了哪个文件、跑了什么命令、搜了什么关键词。
// 解法:从 tool.args 提取一句**参数摘要**,与工具名并排显示,折叠态即可见"在干嘛"。
// 单一真相源:摘要提取规则只在本文件定义;渲染层(sub-agent-task-tree)import 使用。
// 设计:不复制 tool-call-card.tsx 的 extractEffectSummary(那是副作用分类,口径不同),
//       本模块是"展示用一句话摘要",覆盖读/写/改/删/搜/命令/预览等常见族;取不到返回 null 不造残标。

/** 工具入参形状(宽松,兼容 path/file_path/filePath/filename 等别名键) */
type ToolArgs = Record<string, unknown>

/** 从 args 里按候选键取第一个非空字符串 */
function pickStr(args: ToolArgs, keys: readonly string[]): string {
  for (const k of keys) {
    const v = args[k]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return ''
}

/** 文件路径候选键(各端命名不统一,逐个试) */
const PATH_KEYS = ['path', 'file_path', 'filePath', 'filename', 'target'] as const
/** 搜索词候选键 */
const QUERY_KEYS = ['query', 'pattern', 'keyword', 'search', 'q'] as const
/** 命令候选键 */
const COMMAND_KEYS = ['command', 'cmd', 'script', 'shell_command'] as const

/** 把多行命令压成一行 + 截断(摘要不展示全文) */
function compactCommand(cmd: string): string {
  const oneLine = cmd.replace(/\s+/g, ' ').trim()
  return oneLine.length > 80 ? `${oneLine.slice(0, 80)}…` : oneLine
}

/** 把路径压成尾段(只显示文件名,长路径不撑爆一行) */
function compactPath(p: string): string {
  const segs = p.split(/[\\/]/).filter(Boolean)
  return segs[segs.length - 1] ?? p
}

/**
 * 工具参数一句话摘要(展示用)。
 * 返回 null 表示该工具/入参取不到有意义的摘要,调用方不造残标。
 * 覆盖族:命令、文件读/写/改/删、搜索、预览;其余返回 null。
 */
export function toolArgsSummary(toolName: string, args: ToolArgs | undefined): string | null {
  if (!args) return null

  // 命令族:显示将执行的命令(压一行 + 截断)
  if (COMMAND_KEYS.some((k) => k in args) || /command|shell|bash|exec/i.test(toolName)) {
    const cmd = pickStr(args, COMMAND_KEYS)
    if (cmd) return compactCommand(cmd)
  }

  // 文件族:读/写/改/删/预览 —— 显示目标文件名
  const path = pickStr(args, PATH_KEYS)
  if (path) return compactPath(path)

  // 搜索族:显示搜索词
  const query = pickStr(args, QUERY_KEYS)
  if (query) {
    return query.length > 40 ? `${query.slice(0, 40)}…` : query
  }

  return null
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
