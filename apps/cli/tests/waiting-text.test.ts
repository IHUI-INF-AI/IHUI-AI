// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D79 cli 端等待态接线用例:钉住"渲染位真的走了文案池",而不是固定串。
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { resolveWaitingText, waitingPoolSize } from '@ihui/shared/chat';

import { buildWaitingSpinnerText } from '../src/commands/waiting-text.js';
import { getLocale } from '../src/i18n/index.js';

const FIXED_LEGACY_TEXT = 'glm-4.5 · 正在思考...';

describe('buildWaitingSpinnerText 走 D79 等待池(非固定串)', () => {
  it('保留 modelId 前缀', () => {
    const text = buildWaitingSpinnerText({
      modelId: 'glm-4.5',
      prompt: '你好',
      historyLength: 0,
    });
    expect(text.startsWith('glm-4.5 · ')).toBe(true);
  });

  it('不再是旧的单一固定串', () => {
    const prompts = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const texts = prompts.map((prompt) =>
      buildWaitingSpinnerText({ modelId: 'glm-4.5', prompt, historyLength: 0 }),
    );
    expect(texts).not.toContain(FIXED_LEGACY_TEXT);
    // 变异取证:回退成固定串时这里只会剩 1 个唯一值
    expect(new Set(texts).size).toBeGreaterThan(1);
  });

  it('同 seed 确定性(可复现,禁随机)', () => {
    const input = { modelId: 'm', prompt: '同一句话', historyLength: 0 };
    expect(buildWaitingSpinnerText(input)).toBe(buildWaitingSpinnerText(input));
  });

  it('阶段区分:首轮与追问取到不同池', () => {
    const common = { modelId: 'm', prompt: '继续' };
    const first = buildWaitingSpinnerText({ ...common, historyLength: 0 });
    const followup = buildWaitingSpinnerText({ ...common, historyLength: 2 });
    // 变异取证:接线退回固定串 → 两者恒等 → 本断言红
    expect(first).not.toBe(followup);
  });
});

// avoidSeed 接线取证:共享池的"相邻不撞同一条"只有调用点真把上一轮 seed 传下去才生效。
// 期望值一律用 shared 的同一个纯函数反查(不手抄下标),否则断言退化成常量比对。
const LOCALE = getLocale();
const POOL_SIZE = waitingPoolSize(LOCALE, 'agent', 'followup');
/** followup 池内第 index 条(与渲染位同一取词路径) */
const entryAt = (index: number): string =>
  resolveWaitingText({ quadrant: 'agent', phase: 'followup', locale: LOCALE, seed: index });
/** 不传 avoidSeed 时该 prompt 应当命中的文案 = 接线前的行为 */
const plain = (prompt: string): string =>
  resolveWaitingText({ quadrant: 'agent', phase: 'followup', locale: LOCALE, seed: prompt });
const wrap = (text: string): string => `m · ${text}`;
const indexOfPrompt = (prompt: string): number => {
  const base = plain(prompt);
  for (let index = 0; index < POOL_SIZE; index += 1) {
    if (entryAt(index) === base) return index;
  }
  throw new Error(`池内找不到 seed=${prompt} 的条目`);
};

describe('buildWaitingSpinnerText avoidSeed 接线', () => {
  it('自检:池长 ≥2(否则顺移无解、约束形同虚设)', () => {
    expect(POOL_SIZE).toBeGreaterThanOrEqual(2);
  });

  it('不传 previousPrompt ⇒ 与接线前逐字节一致', () => {
    const legacy = { modelId: 'm', prompt: '同一句话', historyLength: 3 };
    expect(buildWaitingSpinnerText(legacy)).toBe(wrap(plain('同一句话')));
    // 显式传 undefined 与不传必须等价(共享池按 === undefined 判)
    expect(buildWaitingSpinnerText({ ...legacy, previousPrompt: undefined })).toBe(
      buildWaitingSpinnerText(legacy),
    );
  });

  it('上一轮与本轮同一句 ⇒ 本轮顺移一位,两条文案不同', () => {
    const index = indexOfPrompt('同一句话');
    const shifted = (index + 1) % POOL_SIZE;
    const text = buildWaitingSpinnerText({
      modelId: 'm',
      prompt: '同一句话',
      historyLength: 3,
      previousPrompt: '同一句话',
    });
    expect(text).not.toBe(wrap(plain('同一句话')));
    expect(text).toBe(wrap(entryAt(shifted)));
  });

  it('上一轮本就不同条 ⇒ 不顺移(约束只在撞车时介入)', () => {
    const candidates = ['继续', '换个说法', '再查一下', '总结一下', '不对', '重来'];
    const current = '本轮输入';
    const prev = candidates.find((p) => indexOfPrompt(p) !== indexOfPrompt(current));
    expect(prev, '候选里找不到不同条的上一轮输入,用例失效').toBeTruthy();
    expect(
      buildWaitingSpinnerText({
        modelId: 'm',
        prompt: current,
        historyLength: 3,
        previousPrompt: prev,
      }),
    ).toBe(wrap(plain(current)));
  });

  it('repl 调用点真的传了 previousPrompt,且源自既有 history(静态取证)', () => {
    const src = readFileSync(fileURLToPath(new URL('../src/commands/repl.ts', import.meta.url)), 'utf8');
    const call = /buildWaitingSpinnerText\(\{[\s\S]*?\}\)/.exec(src);
    expect(call, '未找到 buildWaitingSpinnerText 调用点').not.toBeNull();
    expect(call![0]).toContain('previousPrompt');
    // 不得新增状态源:只允许从既有 state.history 派生
    expect(src).toMatch(
      /const previousPrompt = state\.history\.findLast\(\(m\) => m\.role === 'user'\)\?\.content/,
    );
    expect(src).not.toMatch(/previousPrompt\s*[:=]\s*['"`]/);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
