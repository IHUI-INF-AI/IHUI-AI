// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 组合式 system prompt 装配。
 *
 * 判据分工(刻意不在这里复制拼装逻辑):
 *   - `mode-matrix.ts` 决定片段与工具面约束;
 *   - `tool-surface.ts` 决定常驻/延迟切分与目录文本;
 *   - `tools/index.ts#buildSystemPrompt` 是**唯一**拼装出口(稳定前缀、上下文、
 *     规划段、常驻 schema、延迟目录、调用格式一句提示都在那里)。
 *
 * 本文件只做三件事:按模式过滤工具 → 经登记出口注入片段 → 调用 buildSystemPrompt。
 */

import { buildSystemPrompt, type Tool } from '../tools/index.js';
import { buildToolSurface } from '../tools/tool-surface.js';
import { injectHostSection } from '../utils/prompt-injection-registry.js';
import { renderFragments } from './fragments.js';
import { resolveModeProfile, type ModeToolPolicy } from './mode-matrix.js';

export interface ComposeSystemPromptOptions {
  welcome: string;
  interaction: string;
  tools: readonly Tool[];
  extraContext?: string;
  /** 会话级已揭示集合(tool_search 命中后写入) */
  revealed?: ReadonlySet<string>;
}

/**
 * 工具面按模式收窄。
 * 语义与 `mode-matrix.ts` 的 toolPolicy 一一对应:
 *   - all      → 原样
 *   - read-only/plan → 只留 dangerLevel === 'read'
 *   - none     → 清空
 * `extraAllowed` 命中者无论 dangerLevel 都保留(矩阵当前未使用,留作后续按模式补齐)。
 */
export function filterToolsByPolicy(
  tools: readonly Tool[],
  policy: ModeToolPolicy,
): Tool[] {
  if (policy.mode === 'all') return [...tools];
  if (policy.mode === 'none') return [];
  const allowed = new Set(policy.extraAllowed ?? []);
  return tools.filter((tool) => tool.dangerLevel === 'read' || allowed.has(tool.name));
}

export function composeSystemPrompt(opts: ComposeSystemPromptOptions): string {
  const profile = resolveModeProfile(opts.welcome, opts.interaction);
  const modeTools = filterToolsByPolicy(opts.tools, profile.toolPolicy);
  const revealed = opts.revealed ?? new Set<string>();
  // 先完成延迟切分(命中 revealed 者回到常驻面),再把结果交给唯一拼装出口。
  const surface = buildToolSurface(modeTools, { revealed });

  const fragments = profile.fragmentIds.length > 0
    ? injectHostSection('directive_mode_fragments', renderFragments(profile.fragmentIds), { kind: 'host_directive' })
    : '';
  const extraContext = [fragments, opts.extraContext].filter((part): part is string => Boolean(part)).join('\n\n');

  return buildSystemPrompt(
    surface.promptTools,
    extraContext || undefined,
    profile.planFirst,
    {
      // 显式给出目录文本 = 声明"工具面已由本函数切好",buildSystemPrompt 不再二次延迟。
      deferredCatalogue: surface.deferred.length > 0 ? surface.catalogueText : undefined,
      revealed,
    },
  );
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
