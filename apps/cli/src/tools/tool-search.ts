// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 工具检索(Tool Search) —— 延迟工具目录的唯一开口。
 *
 * 设计取向:
 *   - 不引第三方检索库:工具名与描述都是**短文本**,大小写不敏感的子串 + 分词打分
 *     足够覆盖"我记得有个叫 xxx 的工具"这种真实查询;引入 BM25/向量库会把启动成本
 *     和离线可用性拖进反方向。
 *   - 命中即揭示:`revealed` 是**会话局部** Set,由调用方(setupAgentTools)持有,
 *     不落盘、不做全局单例 —— 否则同一进程里的两个会话会互相污染工具面。
 *   - 空结果不报错:列出可检索的延迟工具名,让模型改词再试(报错只会让它放弃)。
 */

import { listTools, type Tool, type ToolResult, type ToolContext } from './index.js';
import { renderToolSchema } from './tool-surface.js';
import { shouldDeferTool } from './defer-policy.js';

const TOOL_SEARCH_TOOL_NAME = 'tool_search';

/**
 * `top_k` 默认 5 的理由:
 * 命中工具的完整 schema 平均 200-600 字符,5 枚约 1-3k 字符,在单轮预算内可接受;
 * 再高会把"检索"变成"又塞一份小工具表",延迟装载的收益被抵消。
 */
const DEFAULT_TOP_K = 5;
const MAX_TOP_K = 20;

export interface ToolSearchOptions {
  /** 会话级已揭示集合(命中后写入) */
  revealed: Set<string>;
  /** 工具来源(测试注入用;缺省取全局注册表 `listTools()`) */
  tools?: () => readonly Tool[];
}

export interface ToolSearchHit {
  tool: Tool;
  score: number;
}

const NAME_EXACT_SCORE = 100;
const NAME_SUBSTRING_SCORE = 60;
const DESCRIPTION_SUBSTRING_SCORE = 25;
const NAME_TOKEN_SCORE = 10;
const DESCRIPTION_TOKEN_SCORE = 4;

/** 分词:空白与常见标点切开;保留原词,便于中文整词子串命中。 */
function tokenizeQuery(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[\s,，;；:：/|()[\]{}"'`]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

/** 单条查询对单枚工具的得分(大小写不敏感)。 */
function scoreTool(tool: Pick<Tool, 'name' | 'description'>, query: string): number {
  const q = query.trim().toLowerCase();
  if (q === '') return 0;
  const name = tool.name.toLowerCase();
  const description = tool.description.toLowerCase();
  let score = 0;
  if (name === q) score += NAME_EXACT_SCORE;
  else if (name.includes(q)) score += NAME_SUBSTRING_SCORE;
  if (description.includes(q)) score += DESCRIPTION_SUBSTRING_SCORE;
  for (const token of tokenizeQuery(q)) {
    if (name.includes(token)) score += NAME_TOKEN_SCORE;
    if (description.includes(token)) score += DESCRIPTION_TOKEN_SCORE;
  }
  return score;
}

/** 纯检索:查询串与精确名并集打分,按分数降序、同分按名字升序(结果可复现)。 */
export function searchTools(
  tools: readonly Tool[],
  queries: readonly string[],
  toolNames: readonly string[],
  topK: number,
): ToolSearchHit[] {
  const hits = new Map<string, ToolSearchHit>();
  const pick = (tool: Tool, score: number): void => {
    if (score <= 0) return;
    const prev = hits.get(tool.name);
    if (prev === undefined || prev.score < score) hits.set(tool.name, { tool, score });
  };
  for (const tool of tools) {
    const name = tool.name.toLowerCase();
    for (const rawName of toolNames) {
      const wanted = rawName.trim().toLowerCase();
      if (wanted === '') continue;
      if (name === wanted) pick(tool, NAME_EXACT_SCORE);
      else if (name.startsWith(wanted)) pick(tool, NAME_SUBSTRING_SCORE);
    }
    for (const query of queries) pick(tool, scoreTool(tool, query));
  }
  return Array.from(hits.values())
    .sort((a, b) => (b.score - a.score) || a.tool.name.localeCompare(b.tool.name))
    .slice(0, topK);
}

function readStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function readTopK(value: unknown): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(n)) return DEFAULT_TOP_K;
  return Math.min(MAX_TOP_K, Math.max(1, Math.floor(n)));
}

/** 可用延迟工具名列表(空结果提示用):只列名字,不带 schema。 */
function availableDeferredNames(tools: readonly Tool[], revealed: ReadonlySet<string>): string[] {
  return tools
    .filter((tool) => tool.name !== TOOL_SEARCH_TOOL_NAME)
    .filter((tool) => shouldDeferTool(tool.name, tool, revealed))
    .map((tool) => tool.name);
}

export function createToolSearchTool(opts: ToolSearchOptions): Tool {
  const provider = opts.tools ?? listTools;
  return {
    name: TOOL_SEARCH_TOOL_NAME,
    description: '按关键词或工具名检索工具,返回命中工具的完整参数 schema;用于按需揭示延迟装载的工具。',
    dangerLevel: 'read',
    // 显式声明:它是延迟目录的开口,自身永远常驻。
    deferLoading: false,
    parameters: {
      queries: {
        type: 'array',
        description: '关键词列表(按工具名与描述做大小写不敏感匹配)',
        items: { type: 'string', description: '关键词' },
      },
      tool_names: {
        type: 'array',
        description: '精确或前缀工具名列表(优先于关键词)',
        items: { type: 'string', description: '工具名' },
      },
      top_k: {
        type: 'number',
        description: `返回条数上限(默认 ${DEFAULT_TOP_K},最多 ${MAX_TOP_K})`,
      },
    },
    required: [],
    async execute(args: Record<string, unknown>, _ctx: ToolContext): Promise<ToolResult> {
      const tools = provider();
      const queries = readStringList(args.queries);
      const toolNames = readStringList(args.tool_names);
      const topK = readTopK(args.top_k);
      if (queries.length === 0 && toolNames.length === 0) {
        return {
          success: true,
          output: `未提供检索条件。可检索的延迟工具:\n${availableDeferredNames(tools, opts.revealed).join('\n') || '(当前没有可检索的延迟工具)'}`,
        };
      }
      const hits = searchTools(tools, queries, toolNames, topK);
      if (hits.length === 0) {
        return {
          success: true,
          output: `未命中任何工具。可检索的延迟工具:\n${availableDeferredNames(tools, opts.revealed).join('\n') || '(当前没有可检索的延迟工具)'}`,
        };
      }
      for (const hit of hits) opts.revealed.add(hit.tool.name);
      return {
        success: true,
        output: `已揭示 ${hits.length} 个工具,本轮起参数 schema 常驻:\n\n${hits.map((hit) => renderToolSchema(hit.tool)).join('\n\n')}`,
      };
    },
  };
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
