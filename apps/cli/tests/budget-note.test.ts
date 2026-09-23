// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 守门 90 台账 D106/D107 系列:cli 端此前对 budget 帧 0 命中(额度看不见)。
// 锁住四条性质:措辞出自本端词表、可选字段缺失时**不替后端编造**、数字不用「万」、
// 以及 critical 与 warning 两档必须分得出。
import { describe, expect, it } from 'vitest';

import { budgetNoteText } from '../src/commands/task-status-line.js';

const FULL = {
  level: 'warning' as const,
  percent: 85.3,
  usedTokens: 85300,
  limitTokens: 100000,
  tier: '个人版',
  resetAt: '2026-09-25T16:00:00.000Z',
};

describe('budgetNoteText(额度分档告警)', () => {
  it('warning 档出本端词表措辞,并带上用量/百分比/重置/档位', () => {
    const line = budgetNoteText(FULL);
    expect(line).toContain('今日 AI 用量较高');
    expect(line).toContain('已用 85,300 / 100,000 tokens');
    expect(line).toContain('85.3%');
    expect(line).toContain('明日 0 点重置');
    expect(line).toContain('个人版');
    // 取词键名不得漏到界面上
    expect(line).not.toContain('budgetUsedTokens');
  });

  it('critical 档与 warning 档措辞可区分(不是同一句加个感叹号)', () => {
    expect(budgetNoteText({ ...FULL, level: 'critical' })).toContain('即将耗尽');
    expect(budgetNoteText({ ...FULL, level: 'critical' })).not.toContain('今日 AI 用量较高');
  });

  it('数字不用「万」缩写(该单位在 en/ja/ko 都不成立,web 端的历史写法在此不复制)', () => {
    expect(budgetNoteText(FULL)).not.toContain('万');
  });

  it('缺 resetAt 时不说「明日 0 点重置」—— 没有字段就不替后端承诺时间', () => {
    const { resetAt: _resetAt, ...noReset } = FULL;
    expect(budgetNoteText(noReset)).not.toContain('明日 0 点重置');
  });

  it('缺 usedTokens/limitTokens 时不出 tokens 段,也不得出现 undefined', () => {
    const { usedTokens: _u, limitTokens: _l, ...noTokens } = FULL;
    const line = budgetNoteText(noTokens);
    expect(line).not.toContain('tokens');
    expect(line).not.toContain('undefined');
  });

  it('全字段皆缺(只有 level)仍能出一行完整措辞,不崩不空', () => {
    const line = budgetNoteText({ level: 'warning' });
    expect(line).toContain('今日 AI 用量较高');
    expect(line).not.toMatch(/[:：]\s*$/u);
    expect(line).not.toContain('undefined');
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
