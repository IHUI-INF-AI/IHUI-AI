// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 提示注入段登记(Prompt Injection Registry)—— 与 `prompt-boundary.ts` 同层协作。
 *
 * 解决的问题:本仓最高频失效型是「声明了但没人生产 / 没人消费」。
 * 进模型提示的每一段上下文此前**没有一张表**,因此没有任何判据能回答
 * 「这一段这次到底进没进提示」—— 它腐烂的表现形式永远是**安静**(提示变短了,没人喊)。
 *
 * 分工(不得合并、不得互为第二真相源):
 *   - `prompt-boundary.ts` 管**怎么写**(宿主块的结构、第三方内容的中和、字节预算);
 *   - 本模块管**写了没有**(登记 + 本轮生产/跳过记账 + 未注入必须可见)。
 *
 * 三条纪律:
 *   1) 任何「以宿主名义进提示」的段必须先在 `PROMPT_INJECTION_ENTRIES` 登记 id/kind/生产者/消费者,
 *      再经 `recordInjection*` 出口产出 —— 静默省略等于伪造完整性。
 *   2) 本轮没产出内容的登记项,必须留一行可见计数(`renderInjectionNotice` 由生产面调用),
 *      与 §5e「失败必须响」、守门 77「绝不静默成看起来全绿」同一条禁令。
 *   3) `kind` 是封闭集:新增一档必须同时改这里与 `scripts/check-prompt-injection-registry.mjs` 的
 *      判据面,否则 `tsc` 与门两侧不同时认。
 */

import { buildSkillPromptSection, frameSystemReminder, neutralizeBoundaries } from './prompt-boundary.js';

/** 注入段种类(封闭集)。`host_reminder` 走 frameSystemReminder,`reference_data` 走技能段包装。 */
export const PROMPT_INJECTION_KINDS = ['reference_data', 'host_reminder', 'host_directive'] as const;
export type PromptInjectionKind = (typeof PROMPT_INJECTION_KINDS)[number];

export interface PromptInjectionEntry {
  /** 稳定 id:门的判据对象,改名即视为「摘线」。 */
  readonly id: string;
  readonly kind: PromptInjectionKind;
  /** 生产者:`<仓库相对路径>#<导出符号>`,该文件必须真的对本 id 记账。 */
  readonly producer: string;
  /** 消费者:`<仓库相对路径>#<导出符号>`(把该段放进发给模型的消息的位置)。 */
  readonly consumer: string;
  /** 给人看的段名,用于未注入时的可见行。 */
  readonly title: string;
}

/**
 * 登记面:判据的输入。刻意**只登记已改接的项** ——
 * 登记了没人生产就是门的 R1 红,而"表上先占个位"的写法正是本仓反复出现的第二真相源。
 *
 * 尚未入库的注入面(AGENTS.md / memory / 工具目录 / plan-first 段 / fs 事件 / 工具连续失败 /
 * 压缩摘要 / subagent persona)在案待接,清单与阻塞原因见交付报告,不得把本表读成"已全部收口"。
 */
export const PROMPT_INJECTION_ENTRIES: readonly PromptInjectionEntry[] = [
  {
    id: 'context_fs_events',
    kind: 'reference_data',
    producer: 'apps/cli/src/commands/agent.ts#formatFsEventsForPrompt',
    consumer: 'apps/cli/src/commands/agent.ts#buildMessages',
    title: '工作区文件变更段',
  },
  {
    id: 'reminder_tool_failure',
    kind: 'host_reminder',
    producer: 'apps/cli/src/commands/agent.ts#runToolLoop',
    consumer: 'apps/cli/src/commands/agent.ts#runToolLoop',
    title: '工具连续失败反思提醒',
  },
  {
    id: 'skill_list',
    kind: 'reference_data',
    producer: 'apps/cli/src/skills/index.ts#formatSkillsForPrompt',
    consumer: 'apps/cli/src/commands/agent.ts#setupAgentTools',
    title: '技能清单段',
  },
  {
    id: 'reminder_context_budget',
    kind: 'host_reminder',
    producer: 'apps/cli/src/reminders.ts#generateReminders',
    consumer: 'apps/cli/src/commands/agent.ts#runToolLoop',
    title: '上下文预算提醒',
  },
  {
    id: 'reminder_iteration_progress',
    kind: 'host_reminder',
    producer: 'apps/cli/src/reminders.ts#generateReminders',
    consumer: 'apps/cli/src/commands/agent.ts#runToolLoop',
    title: '迭代进度提醒',
  },
  {
    // 用户仓库里的 AGENTS.md 与跨会话落盘的 memory 条目都是**第三方内容**
    // (不是宿主在说话),必须落 reference_data 档,由出口过 neutralizeBoundaries。
    id: 'context_agents_md',
    kind: 'reference_data',
    producer: 'apps/cli/src/commands/agent.ts#setupAgentTools',
    consumer: 'apps/cli/src/tools/index.ts#buildSystemPrompt',
    title: '工作区 AGENTS.md 上下文段',
  },
  {
    id: 'context_memory',
    kind: 'reference_data',
    producer: 'apps/cli/src/commands/agent.ts#setupAgentTools',
    consumer: 'apps/cli/src/tools/index.ts#buildSystemPrompt',
    title: '跨会话记忆段',
  },
  {
    // 与上面两档相反:强制规划段是宿主自己下的指令,不是被转述的事实。
    id: 'directive_plan_first',
    kind: 'host_directive',
    producer: 'apps/cli/src/tools/index.ts#buildSystemPrompt',
    consumer: 'apps/cli/src/commands/agent.ts#setupAgentTools',
    title: '强制任务规划指令段',
  },
  {
    id: 'subagent_persona',
    kind: 'host_directive',
    producer: 'apps/cli/src/tools/subagent.ts#createSubagentTool',
    consumer: 'apps/cli/src/tools/subagent.ts#createSubagentTool',
    title: '子代理角色人格段',
  },
];

const INDEX: ReadonlyMap<string, PromptInjectionEntry> = new Map(
  PROMPT_INJECTION_ENTRIES.map((entry) => [entry.id, entry] as const),
);

export function getInjectionEntry(id: string): PromptInjectionEntry | undefined {
  return INDEX.get(id);
}

/** 记账结果。`unregistered` 不判红但必须可见 —— 它说明有人在绕登记面产出。 */
export interface InjectionRecord {
  readonly id: string;
  readonly status: 'injected' | 'skipped';
  readonly bytes: number;
  readonly reason?: string;
}

let ledger = new Map<string, InjectionRecord>();
/** 未登记但调了出口的 id:只报数,绝不静默。 */
let unregisteredIds = new Set<string>();

/**
 * 清空台账。**当前生产面零调用点**,这是实测后的结论而不是漏接线:
 * ① 台账按 id 覆盖(`ledger` 是 Map),跨轮不会把同一段数成两遍;
 * ② repl 与 `server/agent-core` 的 `setupAgentTools` 一个会话只跑一次并缓存,
 *    此后服务的 system prompt 就是那一次装配的产物 —— 上一轮记的"无内容"对这一轮**依然为真**;
 * ③ 所以任何"每轮清一次"的调用点只会把仍然成立的账擦掉(本票实测过放在 `runToolLoop` 开头,
 *    结果连带擦掉 `context_memory` / `skill_list` 的降级记录),那比不清更糟。
 * 保留导出的用途:测试隔离 + 将来若引入"每次请求重装配 system prompt"的宿主,由那个装配点调用。
 */
export function resetInjectionLedger(): void {
  ledger = new Map();
  unregisteredIds = new Set();
}

export function injectionLedger(): readonly InjectionRecord[] {
  return Array.from(ledger.values());
}

export function unregisteredInjectionIds(): readonly string[] {
  return Array.from(unregisteredIds);
}

function put(id: string, record: InjectionRecord): void {
  if (!INDEX.has(id)) unregisteredIds.add(id);
  // 同 id 多次记账:后一次覆盖前一次(本轮事实以最后一次为准),但不静默丢计数。
  ledger.set(id, record);
}

/**
 * 登记项「本轮确实产出了内容」。空串按「未注入」记,不得记成 injected ——
 * 这正是本模块存在的理由:把"表上有一段而实际没写"变成一条看得见的账。
 */
export function recordInjectionInjected(id: string, text: string): string {
  if (text.trim() === '') {
    put(id, { id, status: 'skipped', bytes: 0, reason: '正文为空' });
    return text;
  }
  put(id, { id, status: 'injected', bytes: Buffer.byteLength(text, 'utf8') });
  return text;
}

/** 登记项「本轮没有产出内容」,带原因。返回空串,便于调用方直接放进拼接位。 */
export function recordInjectionSkipped(id: string, reason: string): '' {
  put(id, { id, status: 'skipped', bytes: 0, reason });
  return '';
}

/**
 * 唯一产出出口:按登记的 kind 选包装方式,并把结果记账。
 * 未登记的 id 会落进 `unregisteredIds` 并在可见行里点名(而不是抛错打断会话)。
 */
export function injectHostSection(
  id: string,
  body: string,
  opts: { readonly kind?: PromptInjectionKind } = {},
): string {
  const entry = INDEX.get(id);
  const kind = opts.kind ?? entry?.kind ?? 'host_directive';
  const trimmed = body.trim();
  if (trimmed === '') return recordInjectionSkipped(id, '正文为空');
  let text = '';
  if (kind === 'host_reminder') {
    // 提醒必须是带 kind 的结构块。运行时无法从正文推出语义 kind,故这里只兜底成
    // `context_budget` 一档;真正的提醒生产者应直接调 `frameSystemReminder` + `injectReminderSection`。
    text = frameSystemReminder('context_budget', trimmed);
  } else if (kind === 'reference_data') {
    text = buildSkillPromptSection([{ name: id, body: trimmed }]).text;
  } else {
    text = neutralizeBoundaries(trimmed);
  }
  return recordInjectionInjected(id, text);
}

/** 供 host_reminder 直接复用 prompt-boundary 的带 kind 出口(不重复包一层)。 */
export function injectReminderSection(id: string, text: string): string {
  return recordInjectionInjected(id, text);
}

/** 登记项里"到现在一次都没被记账"的 id。刻意**不进**可见行 —— 见 `renderInjectionNotice` 的说明。 */
export function unaccountedInjectionIds(): readonly string[] {
  return PROMPT_INJECTION_ENTRIES.filter((e) => !ledger.has(e.id)).map((e) => e.id);
}

/**
 * 未注入的可见行。**任何**生产面调用它并把结果拼进消息即可(门只问有没有调用点,
 * 否则「登记了却没生产」只对读代码的人可见、对模型与使用者都不可见。
 *
 * 只报两类账:① 明确记了"跳过"的;② 未登记就产出的。
 * 刻意不报"登记项未被记账" —— 提醒类段落本来就在第 N 轮才可能出现,
 * 把"还没到那一轮"写成"丢了"会让这行沦为噪声,而噪声行的下场是被删掉。
 * 「从未有人生产」属**静态**事实,由守门的 R1 判据负责,不在这里重复。
 */
export function renderInjectionNotice(): string {
  const skipped = injectionLedger().filter((r) => r.status === 'skipped');
  if (skipped.length === 0 && unregisteredIds.size === 0) return '';
  const parts: string[] = [];
  if (skipped.length > 0) {
    parts.push(`${skipped.length} 段已登记上下文本轮无内容(${skipped.map((r) => `${r.id}:${r.reason ?? '未说明'}`).join('、')})`);
  }
  if (unregisteredIds.size > 0) {
    parts.push(`${unregisteredIds.size} 段未登记即产出(${Array.from(unregisteredIds).join('、')})`);
  }
  return `另有 ${parts.length} 类上下文注入异常:${parts.join(';')}。`;
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
