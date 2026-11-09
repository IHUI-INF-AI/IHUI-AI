// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 欢迎模式 × 交互模式的数据矩阵。
 *
 * 两个正交轴:
 *   - WelcomeMode:开场面(用户"来干什么") —— code(写代码)/ work(处理工作事务)/ design(做设计)
 *   - InteractionMode:互动强度 —— ask(只问不改)/ craft(边问边做)/ plan(先规划)/ expert(专家自治)/ quick(一问一答)
 *
 * 矩阵只回答三件事:注入哪些片段、工具面收到什么约束、要不要强制规划。
 * **判据单一来源**:工具过滤与 planFirst 都从这里取,调用方不得再写第二份分支。
 *
 * fail-closed:未知模式/未知组合一律抛错,绝不回落成 'all' ——
 * 回落成 all 等于把一个拼错的模式名静默升权,而用户以为自己处在只读档。
 */

export type WelcomeMode = 'code' | 'work' | 'design';
export type InteractionMode = 'ask' | 'craft' | 'plan' | 'expert' | 'quick';

export const WELCOME_MODES: readonly WelcomeMode[] = ['code', 'work', 'design'];
export const INTERACTION_MODES: readonly InteractionMode[] = ['ask', 'craft', 'plan', 'expert', 'quick'];

export type ModeToolPolicyMode = 'all' | 'read-only' | 'none' | 'plan';

export interface ModeToolPolicy {
  /** all = 全部工具;read-only = 只留 dangerLevel==='read';none = 清空;plan = 只读 + 强制规划 */
  mode: ModeToolPolicyMode;
  /** 即使在 read-only/none 档也额外放行的工具名(当前矩阵不使用,保留给后续按模式补齐) */
  extraAllowed?: string[];
}

export interface ModeProfile {
  /** 片段 id(顺序即注入顺序,稳定可复现) */
  fragmentIds: string[];
  toolPolicy: ModeToolPolicy;
  /** 是否注入强制规划段 */
  planFirst: boolean;
}

// 片段 id 常量。与 prompts/fragments.ts 的 FRAGMENT_IDS 同源(那里是定义,这里只引用)。
const F_TASK = 'fragment_task_management';
const F_PRESENT = 'fragment_result_presentation';
const F_TOOL = 'fragment_tool_discipline';
const F_STYLE = 'fragment_interaction_style';

const WELCOME_FRAGMENTS: Readonly<Record<WelcomeMode, readonly string[]>> = {
  // code:先把"怎么用工具"和"怎么交付"钉住,任务管理交给 plan/expert 轴补。
  code: [F_TOOL, F_PRESENT, F_STYLE],
  // work:事务型任务更依赖清单推进,任务管理片段默认在场。
  work: [F_TASK, F_PRESENT, F_STYLE],
  // design:结果呈现权重最高(视觉与结构都要交代),不默认塞工具纪律。
  design: [F_PRESENT, F_STYLE],
};

const INTERACTION_FRAGMENTS: Readonly<Record<InteractionMode, readonly string[]>> = {
  // ask:只读问答,工具纪律必须说清"不要改文件"。
  ask: [F_TOOL],
  // craft:默认档,只补风格片段(其余由 welcome 轴决定)。
  craft: [],
  // plan:强制规划段之外,再给一份任务管理片段(清单化推进)。
  plan: [F_TASK],
  // expert:自治度高,工具纪律与任务管理都保留,便于连续多步执行。
  expert: [F_TASK, F_TOOL],
  // quick:一问一答,只要风格片段,不注入规划、不铺任务管理。
  quick: [F_STYLE],
};

const INTERACTION_TOOL_POLICY: Readonly<Record<InteractionMode, ModeToolPolicyMode>> = {
  ask: 'read-only',
  craft: 'all',
  plan: 'plan',
  expert: 'all',
  quick: 'none',
};

function isWelcomeMode(value: unknown): value is WelcomeMode {
  return typeof value === 'string' && (WELCOME_MODES as readonly string[]).includes(value);
}

function isInteractionMode(value: unknown): value is InteractionMode {
  return typeof value === 'string' && (INTERACTION_MODES as readonly string[]).includes(value);
}

/** 解析模式字符串:未设置(undefined/'')返回 undefined;非法值抛错(fail-closed)。 */
export function parseWelcomeMode(value: unknown): WelcomeMode | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (!isWelcomeMode(value)) {
    throw new Error(`welcome mode 非法:'${String(value)}'(合法值:${WELCOME_MODES.join('|')})`);
  }
  return value;
}

export function parseInteractionMode(value: unknown): InteractionMode | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (!isInteractionMode(value)) {
    throw new Error(`interaction mode 非法:'${String(value)}'(合法值:${INTERACTION_MODES.join('|')})`);
  }
  return value;
}

/** 合并片段并按首次出现顺序去重(顺序稳定,便于断言与缓存)。 */
function mergeFragments(...lists: readonly (readonly string[])[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of lists) {
    for (const id of list) {
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

/**
 * 矩阵求值。非法模式或未知组合直接抛错(fail-closed)。
 *
 * 语义(与测试一一对应):
 *   quick         → 工具面 none,不注入计划段
 *   ask           → 只读
 *   plan          → 只读 + 强制规划(planFirst=true)
 *   craft / expert→ 全部工具
 */
export function resolveModeProfile(welcome: unknown, interaction: unknown): ModeProfile {
  if (!isWelcomeMode(welcome)) {
    throw new Error(`未知 welcome mode:'${String(welcome)}'(合法值:${WELCOME_MODES.join('|')})`);
  }
  if (!isInteractionMode(interaction)) {
    throw new Error(`未知 interaction mode:'${String(interaction)}'(合法值:${INTERACTION_MODES.join('|')})`);
  }
  const policyMode = INTERACTION_TOOL_POLICY[interaction];
  // quick 是一问一答档:连 welcome 轴的任务/工具片段都不铺,只留最短的交互风格约束。
  const welcomeFragments = interaction === 'quick' ? [] : WELCOME_FRAGMENTS[welcome];
  const fragmentIds = mergeFragments(welcomeFragments, INTERACTION_FRAGMENTS[interaction]);
  return {
    fragmentIds,
    toolPolicy: { mode: policyMode },
    // 只有 plan 轴强制规划;quick 明确不注入计划段(见文件头语义)。
    planFirst: policyMode === 'plan',
  };
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
