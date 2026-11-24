// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 工具面切分(Tool Surface) —— 把"注册表里的全部工具"切成
 * 「常驻 schema 集」与「延迟目录集」,并产出目录文本。
 *
 * 判据单一来源:`shouldDeferTool`(defer-policy.ts)。本文件只做形状投影,
 * 不另写第二套"哪些工具算低频"的判断。
 */

import type { Tool } from './index.js';
import { shouldDeferTool } from './defer-policy.js';

/** `tool_search` 自身不允许被延迟:它是延迟目录的**唯一开口**,延迟它等于把钥匙锁进箱子。 */
const TOOL_SEARCH_NAME = 'tool_search';

/** 目录单行描述的最大字符数。取 60:一行目录只承担"要不要进一步检索"的判断,超出的细节由命中后的完整 schema 提供。 */
const CATALOGUE_DESCRIPTION_MAX = 60;

export interface ToolSurface {
  /** 常驻 prompt 的工具(完整 schema 会逐条渲染) */
  promptTools: Tool[];
  /** 延迟工具(只出现在目录里,不带参数 schema) */
  deferred: Tool[];
  /** 目录文本:每行「名字 — 一句话描述」,不含参数 schema */
  catalogueText: string;
}

export interface ToolSurfaceOptions {
  /** 会话级已揭示集合(命中即回到常驻面) */
  revealed?: ReadonlySet<string>;
}

/**
 * 稳定前缀 —— 与工具集合**无关**的固定文本。
 *
 * 它刻意不列举任何工具名/参数:工具集只会改变前缀**之后**的段落,
 * 于是同一会话里插件/MCP 增删工具不会移动前缀字节(缓存友好)。
 */
export function renderStablePrefix(): string {
  return `你是一个强大的编码助手。你可以使用工具来完成任务。

## 工具调用格式

当需要使用工具时,在回复中输出以下格式的代码块:

\`\`\`tool_call
{"name":"工具名","arguments":{"参数名":"参数值"}}
\`\`\`

可以连续调用多个工具(每个占一个代码块)。工具执行后,结果会以 user 消息形式返回,你可以继续处理。

当任务完成或无需工具时,正常回复即可(不包含 tool_call 块)。

## 注意事项

- 优先使用工具获取信息,不要猜测文件内容
- 文件路径相对于工作区根目录
- 一次只调用必要的工具,避免冗余操作
- 修改/创建文件必须使用 edit_file / write_file 工具,禁止通过 run_command 执行内嵌脚本(如 node -e / sed -i)改文件——跨 shell 引号转义极易失败且错误不易察觉
- 声称完成前,用 read_file 复核关键改动确实落盘`;
}

/** 一句话描述:取第一句,截断到上限;不含参数 schema。 */
function oneLineDescription(description: string): string {
  const firstLine = description.split(/\r?\n/, 1)[0] ?? '';
  const firstSentence = firstLine.split(/[。.!?！？]/, 1)[0] ?? firstLine;
  const text = firstSentence.trim();
  if (text.length <= CATALOGUE_DESCRIPTION_MAX) return text;
  return `${text.slice(0, CATALOGUE_DESCRIPTION_MAX - 1)}…`;
}

/**
 * 切分工具面。
 *
 * @param tools  注册表顺序(保持原序:常驻集的渲染顺序与注册顺序一致,便于人读核对)
 * @param opts   `revealed` 命中者回到 promptTools
 */
export function buildToolSurface(
  tools: readonly Tool[],
  opts: ToolSurfaceOptions = {},
): ToolSurface {
  const revealed = opts.revealed ?? new Set<string>();
  const promptTools: Tool[] = [];
  const deferred: Tool[] = [];
  for (const tool of tools) {
    const mustStay = tool.name === TOOL_SEARCH_NAME;
    if (mustStay || !shouldDeferTool(tool.name, tool, revealed)) {
      promptTools.push(tool);
    } else {
      deferred.push(tool);
    }
  }
  const catalogueText = deferred
    .map((tool) => `- ${tool.name} — ${oneLineDescription(tool.description)}`)
    .join('\n');
  return { promptTools, deferred, catalogueText };
}

/** 单枚工具的完整 schema 文本(与 buildSystemPrompt 的渲染同形,供 tool_search 命中后返回)。 */
export function renderToolSchema(tool: Tool): string {
  const params = Object.entries(tool.parameters)
    .map(([name, p]) => {
      const req = tool.required.includes(name) ? ' (必填)' : '';
      const enumStr = p.enum ? ` 可选值: ${p.enum.join('|')}` : '';
      return `    - ${name}: ${p.type}${req} — ${p.description}${enumStr}`;
    })
    .join('\n');
  return `### ${tool.name}\n${tool.description}\n参数:\n${params}`;
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
