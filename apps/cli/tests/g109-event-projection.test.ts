// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 票 G-109 事件面补锁(2026-10-18/g-triproj)。
 *
 * 票面验收①的原文是「**事件/落库**的 display 必须仍含被截掉那一段」,而
 * `apps/cli/src/tools/__tests__/result-tri-projection.test.mjs` 证的是生产点与落库往返
 * ⇒ 事件载荷那一维当时没有臂钉着。本档补两件事:
 *  ① 行为面:人读排版优先取有界 display;没有 display(未触发裁剪)时逐字节回落到 output,
 *     原有的 1000 字符规则与 `...(truncated)` 散文注记一字不变 —— 这样"接上投影"不会
 *     反过来改掉已经有人在解析的 markdown 形态。
 *  ② 出口真实性(源锁):事件联合体、headless emit、HTTP/SSE 三处必须真把 display 带出去。
 *     只测渲染函数而漏了搬运线,就是"造好没装车"(AGENTS §0.9)——本仓这类坑记过不止一次。
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { eventToMarkdown, type HeadlessEvent } from '../src/headless-format';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const read = (rel: string): string => readFileSync(repoRoot + rel, 'utf8');

const longText = 'X'.repeat(1200) + 'TAIL-MARKER';

describe('G-109 事件面:人读排版取有界 display', () => {
  it('有 display ⇒ markdown 用 display 的那一份(而不是被预算裁过的 output)', () => {
    const evt: HeadlessEvent = {
      type: 'tool_result',
      name: 'read_file',
      success: true,
      output: '[tool-result-budget] output truncated: …' + 'm'.repeat(50),
      display: {
        text: 'HUMAN-VIEW-FULL-SEGMENT-' + 'a'.repeat(2000),
        truncated: true,
        originalBytes: 2026,
        returnedBytes: 2000,
        budgetStrategy: 'truncate',
      },
    };
    const md = eventToMarkdown(evt);
    expect(md).toContain('HUMAN-VIEW-FULL-SEGMENT-');
    expect(md).not.toContain('[tool-result-budget] output truncated');
  });

  it('无 display ⇒ 与接入前逐字节同形(1000 字符规则与散文注记一字未动)', () => {
    const evt: HeadlessEvent = {
      type: 'tool_result',
      name: 'read_file',
      success: true,
      output: longText,
    };
    const md = eventToMarkdown(evt);
    expect(md).toContain(longText.slice(0, 1000));
    expect(md).toContain('\n...(truncated)');
    // 断言要用**有辨识度**的尾标记:全同字符的正文里取"第 1000 个之后"仍是同样的字符,
    // 拿 slice(1000,1100) 判"不含"会恒成立(我第一版就栽在这 —— 假绿比假红更坏)。
    expect(md).not.toContain('TAIL-MARKER');
  });

  it('短结果不截不断:display 缺席时原文照出', () => {
    const md = eventToMarkdown({
      type: 'tool_result',
      name: 'ls',
      success: true,
      output: 'a\nb',
    });
    expect(md).toContain('a\nb');
    expect(md).not.toContain('...(truncated)');
  });
});

describe('G-109 事件面:三处出口真实性源锁(不得"造好没装车")', () => {
  it('headless 出口把 display 带进事件对象', () => {
    const src = read('apps/cli/src/commands/agent.ts');
    expect(src).toContain('onToolResult?.(call.name, result.success, result.output, result.display)');
    expect(src).toContain("emit({ type: 'tool_result', name, success, output, ...(display ? { display } : {}) })");
  });

  it('HTTP/SSE 出口同样带上 display,且两处事件联合体都登记了该字段', () => {
    const core = read('apps/cli/src/server/agent-core.ts');
    expect(core).toContain('onToolResult: async (name, success, output, display) => {');
    expect(core).toContain('...(display ? { display } : {})');
    for (const rel of ['apps/cli/src/server/agent-core.ts', 'apps/cli/src/headless-format.ts']) {
      const src = read(rel);
      expect(src).toMatch(/display\?: ToolResultDisplaySource/);
      expect(src).toContain("from '@ihui/types'");
    }
  });

  it('类型线索只有一个来源:shared 的 ToolResultDisplaySource,端内不得自立同形类型', () => {
    for (const rel of ['apps/cli/src/headless-format.ts', 'apps/cli/src/server/agent-core.ts']) {
      expect(read(rel)).not.toMatch(/interface ToolResultDisplay|type ToolResultDisplay =/);
    }
    expect(read('packages/types/src/tool-result-metadata.ts')).toContain('export interface ToolResultDisplaySource');
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
