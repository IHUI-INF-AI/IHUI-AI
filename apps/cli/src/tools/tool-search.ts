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

/**
 * 揭示预算(字节,2026-11-28 立)。
 *
 * 立因:`revealed` 只增不减 —— 实测 15 次检索揭示 63 枚后，默认面从 15,475B 涨到 25,378B
 * (+64%)，延迟装载的收益被"越检索越常驻"吃掉一半。长会话里这条曲线没有上限。
 *
 * 口径:只对**本来就会被延迟**的工具计费(`deferLoading`/dangerous 决定);常驻工具被命中
 * 不占额度、留着也不花钱。预算满时按**最久未命中**回收，当前这次命中的一律不动。
 * 被回收的工具**仍可按名直接调用**(注册表里没删)，只是参数 schema 不再占前缀。
 */
export const REVEAL_BUDGET_BYTES = 6000;

/**
 * 按字节预算回收最久未命中的揭示项。
 *
 * @param revealed 会话级已揭示集合(原地修改)
 * @param keep     本次刚命中的名字:无论如何不许回收 —— 回收刚给出去的 schema 等于白检索
 * @param budget   预算字节数(缺省即 `REVEAL_BUDGET_BYTES`)
 * @returns 被回收的工具名(供回给模型一句可核对的说明)
 */
function pruneRevealed(
  revealed: Set<string>,
  tools: readonly Tool[],
  keep: ReadonlySet<string>,
  budget: number,
): string[] {
  const byName = new Map(tools.map((tool) => [tool.name, tool] as const));
  const costOf = (name: string): number => {
    const tool = byName.get(name);
    return tool === undefined ? 0 : renderToolSchema(tool).length;
  };
  const isDeferred = (name: string): boolean => {
    const tool = byName.get(name);
    return tool === undefined ? false : shouldDeferTool(tool.name, tool);
  };
  let total = 0;
  for (const name of revealed) total += isDeferred(name) ? costOf(name) : 0;
  const evicted: string[] = [];
  if (total <= budget) return evicted;
  for (const name of [...revealed]) {
    if (total <= budget) break;
    if (keep.has(name)) continue;
    if (!isDeferred(name)) {
      // 常驻工具本来就不花钱:顺手清掉，避免集合无限长。
      revealed.delete(name);
      continue;
    }
    revealed.delete(name);
    total -= costOf(name);
    evicted.push(name);
  }
  return evicted;
}

export interface ToolSearchOptions {
  /** 会话级已揭示集合(命中后写入) */
  revealed: Set<string>;
  /** 工具来源(测试注入用;缺省取全局注册表 `listTools()`) */
  tools?: () => readonly Tool[];
  /** 揭示预算(字节);缺省 `REVEAL_BUDGET_BYTES`。测试用注入，生产不传。 */
  revealBudgetBytes?: number;
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
/** CJK 二元组:中文没有空格分词,整串"合并分支"在描述里常不连续出现,用二元组兜住。 */
const CJK_GRAM_SCORE_NAME = 6;
const CJK_GRAM_SCORE_DESCRIPTION = 3;
/** 二元组分数的上限:防止一句长中文(十几个二元组)靠零散命中压过直接命中。 */
const CJK_GRAM_CAP = 12;
/**
 * 参数面(2026-11-28 立):查询里的"超时/偏移/行数"这类词只出现在**参数名/参数描述**里,
 * 名字与工具描述都不含 —— 旧打分对此完全瞎。权重压在描述命中(25/4)之下:
 * 参数只是佐证,不能盖过"名字/描述已明说"的工具。
 */
const PARAM_TOKEN_SCORE = 6;
const PARAM_DESCRIPTION_SCORE = 3;
const PARAM_CJK_GRAM_SCORE = 2;
const PARAM_SCORE_CAP = 10;

const CJK_CHAR = /[\u3400-\u4dbf\u4e00-\u9fff]/;

/**
 * 中文概念 → 英文词根(工具名里的实际用词)。**不是工具清单**,是词法桥:
 * 中文查询"剪贴板读取"里没有空格,整串既不命中名字也不命中描述;但"剪贴板→clipboard"
 * "读取→read"各自命中 `clipboard_read`。表只钉"中文说法 ↔ 英文实现用词"这一层,
 * 新增工具不需要登记;新增说法才需要加一行。
 */
const CJK_NAME_ALIASES: ReadonlyArray<readonly [string, readonly string[]]> = [
  ['读取', ['read']],
  ['读', ['read']],
  ['写入', ['write']],
  ['写', ['write']],
  ['编辑', ['edit']],
  ['修改', ['edit']],
  ['删除', ['delete']],
  ['文件', ['file']],
  ['目录', ['dir', 'list']],
  ['搜索', ['search', 'grep']],
  ['查找', ['find', 'glob', 'search']],
  ['代码', ['code', 'grep']],
  ['合并', ['merge']],
  ['分支', ['branch']],
  ['提交', ['commit']],
  ['暂存', ['stash']],
  ['冲突', ['conflict']],
  ['标签', ['tag']],
  ['远端', ['remote']],
  ['日志', ['log']],
  ['差异', ['diff']],
  ['测试', ['test']],
  ['命令', ['command']],
  ['运行', ['run', 'exec']],
  ['执行', ['run', 'exec']],
  ['调试', ['debug']],
  ['断点', ['breakpoint']],
  ['终端', ['terminal']],
  ['浏览器', ['browser']],
  ['网页', ['browser', 'navigate']],
  ['页面', ['page']],
  ['点击', ['click']],
  ['截图', ['screenshot']],
  ['剪贴板', ['clipboard']],
  ['记忆', ['memory']],
  ['工作树', ['worktree']],
  ['图谱', ['codegraph']],
  ['引用', ['reference']],
  ['定义', ['definition']],
  ['跳转', ['goto']],
  ['批量', ['batch']],
  ['预览', ['preview']],
  ['撤销', ['undo']],
  ['发布', ['release']],
  ['问题', ['issue']],
  ['代理', ['subagent', 'agent']],
  ['待办', ['todo']],
  ['诊断', ['diagnostic']],
  ['重命名', ['rename']],
  ['符号', ['symbol']],
  ['会话', ['session']],
  ['安装', ['install']],
  ['并行', ['parallel']],
  ['子任务', ['subagent']],
  // ==== 业务域族(人事考勤 / 号池 / API 桥)====
  // 这些族默认延迟(见 defer-policy),延迟之后**只能靠检索找回**,所以中文说法必须先命中。
  // 2026-11-28 立:此前这几族无条件常驻,模型的检索退路并不成立;补词法桥才敢延。
  ['考勤', ['attendance']],
  ['打卡', ['check_in', 'punch']],
  ['签到', ['check_in']],
  ['签退', ['check_out']],
  ['补卡', ['punch', 'fix']],
  ['请假', ['leave']],
  ['休假', ['leave']],
  ['审批', ['approval', 'approve']],
  ['部门', ['department']],
  ['员工', ['employee']],
  ['人事', ['hr']],
  ['招聘', ['job']],
  ['岗位', ['job']],
  ['列表', ['list']],
  ['记录', ['records']],
  ['统计', ['stats']],
  ['号池', ['pool']],
  ['账号', ['account']],
  ['巡检', ['sweep']],
  ['重认证', ['reauth']],
  ['端点', ['endpoint']],
  ['接口', ['endpoint', 'api']],
  // ==== 参数语义(2026-11-28):这些词只出现在参数名/参数描述里 ====
  ['超时', ['timeout']],
  ['偏移', ['offset', 'skip']],
  ['行数', ['limit', 'lines']],
  ['限制', ['limit']],
  ['正则', ['pattern', 'regex']],
];

/** 把中文串切成二元组(只保留"两字都是汉字"的相邻对);英文/数字不参与。 */
function cjkBigrams(token: string): string[] {
  const chars = Array.from(token);
  const grams: string[] = [];
  for (let i = 0; i + 1 < chars.length; i += 1) {
    const a = chars[i];
    const b = chars[i + 1];
    if (a !== undefined && b !== undefined && CJK_CHAR.test(a) && CJK_CHAR.test(b)) grams.push(a + b);
  }
  return grams;
}

/** 中文 token 命中的英文词根(去重);纯英文 token 返回空(它自己就是词根)。 */
function aliasTermsFor(token: string): string[] {
  if (!CJK_CHAR.test(token)) return [];
  const terms: string[] = [];
  for (const [zh, en] of CJK_NAME_ALIASES) {
    if (token.includes(zh)) terms.push(...en);
  }
  return Array.from(new Set(terms));
}

/** 分词:空白与常见标点切开;保留原词,便于中文整词子串命中。
 * 中文与英文/数字相邻处也切开("创建PR" → "创建"+"pr"),否则混合串会整体落空。 */
function tokenizeQuery(query: string): string[] {
  const normalized = query
    .toLowerCase()
    .replace(/([\u3400-\u4dbf\u4e00-\u9fff])([a-z0-9])/g, '$1 $2')
    .replace(/([a-z0-9])([\u3400-\u4dbf\u4e00-\u9fff])/g, '$1 $2');
  return normalized
    .split(/[\s,，;；:：/|()[\]{}"'`]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

/** 参数面文本(参数名 + 参数描述):"超时"只出现在 `timeout` 的说明里，靠它才找得到 run_command。 */
function parameterText(tool: Pick<Tool, 'parameters'>): { keys: string; text: string } {
  const keyParts: string[] = [];
  const descParts: string[] = [];
  for (const [key, schema] of Object.entries(tool.parameters ?? {})) {
    keyParts.push(key.toLowerCase());
    const description = (schema as { description?: unknown })?.description;
    if (typeof description === 'string' && description.length > 0) {
      descParts.push(description.toLowerCase());
    }
  }
  return { keys: keyParts.join(' '), text: `${keyParts.join(' ')} ${descParts.join(' ')}` };
}

/** 单条查询对单枚工具的得分(大小写不敏感)。 */
function scoreTool(tool: Pick<Tool, 'name' | 'description' | 'parameters'>, query: string): number {
  const q = query.trim().toLowerCase();
  if (q === '') return 0;
  const name = tool.name.toLowerCase();
  const description = tool.description.toLowerCase();
  const params = parameterText(tool);
  let score = 0;
  if (name === q) score += NAME_EXACT_SCORE;
  else if (name.includes(q)) score += NAME_SUBSTRING_SCORE;
  if (description.includes(q)) score += DESCRIPTION_SUBSTRING_SCORE;
  let paramScore = 0;
  for (const token of tokenizeQuery(q)) {
    const nameHit = name.includes(token);
    const descriptionHit = description.includes(token);
    if (nameHit) score += NAME_TOKEN_SCORE;
    if (descriptionHit) score += DESCRIPTION_TOKEN_SCORE;
    if (!nameHit && !descriptionHit) {
      if (params.keys.includes(token)) paramScore += PARAM_TOKEN_SCORE;
      else if (params.text.includes(token)) paramScore += PARAM_DESCRIPTION_SCORE;
    }
    // 整串不命中时退回二元组:中文查询"合并分支"在描述里找不到整串,但"合并""分支"都在。
    if (!nameHit && !descriptionHit) {
      let gramScore = 0;
      for (const gram of new Set(cjkBigrams(token))) {
        if (name.includes(gram)) gramScore += CJK_GRAM_SCORE_NAME;
        else if (description.includes(gram)) gramScore += CJK_GRAM_SCORE_DESCRIPTION;
        else if (params.text.includes(gram)) paramScore += PARAM_CJK_GRAM_SCORE;
      }
      score += Math.min(gramScore, CJK_GRAM_CAP);
    }
    // 词法桥:中文 token 里的概念词回落到英文词根("剪贴板读取" ⇒ clipboard + read)。
    for (const term of aliasTermsFor(token)) {
      if (name.includes(term)) score += NAME_TOKEN_SCORE;
      else if (description.includes(term)) score += DESCRIPTION_TOKEN_SCORE;
      else if (params.text.includes(term)) paramScore += PARAM_TOKEN_SCORE;
    }
  }
  // 参数面总分封顶:防止"参数多"的工具靠零散词堆分压过真正对口的工具。
  return score + Math.min(paramScore, PARAM_SCORE_CAP);
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
    contract: {
      shape: { visibleToProvider: true, input: { type: 'object' } },
      permission: {
        permissionKey: 'tool.search',
        reason: '只读内存中的工具目录并返回 schema:不碰文件、不触网、不改任何状态',
        riskLevel: 'read',
        effectScope: 'none',
        requiresApproval: false,
      },
      resultBudget: {
        inlineLimitBytes: 32 * 1024,
        providerVisibleLimitBytes: 16 * 1024,
        policy: 'truncate',
        preview: { bytes: 4096, lines: 120, from: 'head' },
      },
    },
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
      // 命中即揭示,并把"最久未命中"的顺序刷新到队尾(Set 的插入顺序就是回收顺序)。
      const hitNames = new Set(hits.map((hit) => hit.tool.name));
      for (const hit of hits) {
        opts.revealed.delete(hit.tool.name);
        opts.revealed.add(hit.tool.name);
      }
      const budgetUsed = opts.revealBudgetBytes ?? REVEAL_BUDGET_BYTES;
      const evicted = pruneRevealed(opts.revealed, tools, hitNames, budgetUsed);
      const budgetNote =
        evicted.length === 0
          ? ''
          : `\n\n(揭示预算 ${budgetUsed}B 已满,回收最早揭示的 ${evicted.length} 个:${evicted.join(', ')};` +
            '它们仍可按名直接调用,需要参数细节时再检索)';
      return {
        success: true,
        output: `已揭示 ${hits.length} 个工具,本轮起参数 schema 常驻:\n\n${hits.map((hit) => renderToolSchema(hit.tool)).join('\n\n')}${budgetNote}`,
      };
    },
  };
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
