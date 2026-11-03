// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * read_file 输出 token 预算测试(吸收 G-937972)。
 *
 * 钉住七件事:
 *  ① 预算常量:READ_MAX_OUTPUT_TOKENS=25_000,partial 目标 = floor(×0.85)=21_250;
 *  ② 整读超预算 ⇒ 降级部分视图(不报错):system-reminder 的 partialViewNotice 在正文前,
 *     带 "lines a-b of N" 与续读坐标 `offset X and limit Y`;
 *  ③ 按 notice 里的 offset/limit 续读 ⇒ success 且读到后续内容(续读坐标真的能用);
 *  ④ 带 offset/limit 的 range 读超预算 ⇒ **硬错** errorType=read_output_too_many_tokens
 *     (点名窗口被静默改小等于改答,必须让模型自己改参数);
 *  ⑤ 空文件 ⇒ EMPTY_FILE_REMINDER;offset 越过 EOF ⇒ 真实行数警示(都不报错);
 *  ⑥ 预算内小文件不出现 system-reminder(截断不是常态报警);
 *  ⑦ 字节闸截断的文件**不叠加** token 部分视图 —— 一次只有一种截断故事。
 *
 * 夹具自适应:用 estimateReadTokens 实测单行 token 再放大到超预算,
 * 不硬编码"BPE 对这串字符给多少 token"的猜测(tokenizer 升级不会把夹具打回预算内)。
 * 二分/高亮较慢,逐用例放宽 timeout。
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { read_file } from '../src/tools/builtins.js';
import {
  EMPTY_FILE_REMINDER,
  READ_MAX_OUTPUT_TOKENS,
  READ_TOKEN_BUDGET_PARTIAL_TARGET,
  buildOffsetBeyondEofReminder,
  buildReadOutputTooManyTokensMessage,
  createTokenCapPartialView,
  estimateReadTokens,
  findLargestPrefixWithinTokenBudget,
} from '../src/tools/read-text-budget.js';
import type { ToolContext } from '../src/tools/index.js';

const SAMPLE_LINE =
  'The quick brown fox jumps over the lazy dog near the riverbank at dawn. ';

/**
 * 造一份**整读必超 token 预算、但不惊动行数闸(500 行)与字节闸(512KB)**的多行文本。
 * 关键约束:行数必须 ≤ 500,所以只能把 token 摊进行长(每行 ≥ ~55 token),
 * 而不是堆行数 —— 行数一超 500,整读会先被行数闸切到 9500 token,token 预算层根本轮不到。
 * 行长从 SAMPLE_LINE×4 起步自适应,直到"预算+余量 ÷ 单行 token"算出的行数能压在 490 行内。
 */
function makeOverBudgetText(): { text: string; lines: number } {
  for (let rep = 4; rep <= 16; rep += 1) {
    const body = SAMPLE_LINE.repeat(rep);
    const perLineTokens = estimateReadTokens(body) + 1; // +1 换行
    const lines = Math.ceil((READ_MAX_OUTPUT_TOKENS + 2000) / perLineTokens);
    if (lines <= 490) {
      return {
        text: Array.from({ length: lines }, (_, i) => `L${i} ${body}`).join('\n'),
        lines,
      };
    }
  }
  throw new Error('makeOverBudgetText: cannot fit under the line cap');
}

describe('预算常量与提示语构造(纯函数)', () => {
  it('① READ_MAX_OUTPUT_TOKENS=25000;partial 目标 = floor(×0.85)', () => {
    expect(READ_MAX_OUTPUT_TOKENS).toBe(25_000);
    expect(READ_TOKEN_BUDGET_PARTIAL_TARGET).toBe(21_250);
  });

  it('⑤a 空文件警示是 system-reminder 形态', () => {
    expect(EMPTY_FILE_REMINDER).toContain('system-reminder');
    expect(EMPTY_FILE_REMINDER).toContain('empty');
  });

  it('⑤b offset 越界警示带请求值与真实行数', () => {
    const s = buildOffsetBeyondEofReminder(99, 10);
    expect(s).toContain('shorter than the provided offset (99)');
    expect(s).toContain('The file has 10 lines');
  });

  it('④a range 超限硬错文案带实测 token 数、上限与改参指引', () => {
    const s = buildReadOutputTooManyTokensMessage(30_001, 'big.txt');
    expect(s).toContain('30001 tokens');
    expect(s).toContain('25000');
    expect(s).toContain('offset and limit parameters');
  });
});

describe('createTokenCapPartialView(0.85 预算内二分截取)', () => {
  it('② 行前缀档:截到 ≤0.85 预算的最大行数,notice 带续读 offset/limit', () => {
    const { text, lines } = makeOverBudgetText();
    const tokenCount = estimateReadTokens(text);
    expect(tokenCount).toBeGreaterThan(READ_MAX_OUTPUT_TOKENS);

    const pv = createTokenCapPartialView({ content: text, startLine: 1, totalLines: lines, tokenCount });
    expect(pv).toBeDefined();
    expect(pv!.numLines).toBeGreaterThan(0);
    expect(pv!.numLines).toBeLessThan(lines);
    expect(estimateReadTokens(pv!.content)).toBeLessThanOrEqual(READ_TOKEN_BUDGET_PARTIAL_TARGET);
    expect(pv!.nextOffset).toBe(pv!.endLine + 1);
    expect(pv!.partialViewNotice).toContain(`lines 1-${pv!.numLines} of ${lines}`);
    expect(pv!.partialViewNotice).toContain(`offset ${pv!.nextOffset} and limit ${pv!.numLines}`);
    // 与独立二分函数的一致性(结果可由 findLargestPrefixWithinTokenBudget 复算)
    expect(pv!.numLines).toBe(findLargestPrefixWithinTokenBudget(text.split('\n')));
  }, 60_000);

  it('②b 字符前缀档:单行巨文件(第一行就爆预算)退到字符前缀', () => {
    const unit = 'word another phrase sentence line. ';
    const perUnit = Math.max(1, estimateReadTokens(unit));
    let single = unit.repeat(Math.ceil((READ_MAX_OUTPUT_TOKENS * 1.2) / perUnit));
    if (estimateReadTokens(single) <= READ_MAX_OUTPUT_TOKENS) single = single.repeat(2);
    const tokenCount = estimateReadTokens(single);
    expect(tokenCount).toBeGreaterThan(READ_MAX_OUTPUT_TOKENS);

    const pv = createTokenCapPartialView({ content: single, startLine: 1, totalLines: 1, tokenCount });
    expect(pv).toBeDefined();
    expect(pv!.numLines).toBe(1);
    expect(pv!.content.length).toBeLessThan(single.length);
    expect(estimateReadTokens(pv!.content)).toBeLessThanOrEqual(READ_TOKEN_BUDGET_PARTIAL_TARGET);
    expect(pv!.partialViewNotice).toContain('first line');
  }, 60_000);
});

describe('read_file 的 token 预算处置(临时工作区)', () => {
  let workDir: string;
  let ctx: ToolContext;

  beforeEach(() => {
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-read-budget-'));
    ctx = { workspacePath: workDir };
  });

  afterEach(() => {
    fs.rmSync(workDir, { recursive: true, force: true });
  });

  it('②c 整读超预算 ⇒ success 部分视图:reminder 在正文前,行号渲染保留', async () => {
    const { text, lines } = makeOverBudgetText();
    fs.writeFileSync(path.join(workDir, 'big.txt'), text);

    const first = await read_file.execute({ path: 'big.txt' }, ctx);
    expect(first.success).toBe(true);
    expect(first.output.startsWith('<system-reminder>')).toBe(true);
    expect(first.output).toContain(`of ${lines}`);
    expect(first.output).toMatch(/offset \d+ and limit \d+/);
    expect(first.output).toContain('   1  '); // 正文带 1-based 行号

    // 971/972 交界:token 部分视图是 partial,重读不短路
    const again = await read_file.execute({ path: 'big.txt' }, ctx);
    expect(again.output).not.toContain('Wasted call');
  }, 60_000);

  it('③ 按 notice 的 offset/limit 续读 ⇒ success 且读到后续内容(坐标真的能用)', async () => {
    const { text } = makeOverBudgetText();
    fs.writeFileSync(path.join(workDir, 'big.txt'), text);

    const first = await read_file.execute({ path: 'big.txt' }, ctx);
    const m = first.output.match(/offset (\d+) and limit (\d+)/);
    expect(m).not.toBeNull();

    const second = await read_file.execute(
      { path: 'big.txt', offset: Number(m![1]), limit: Number(m![2]) },
      ctx,
    );
    expect(second.success).toBe(true);
    expect(second.output).not.toContain('system-reminder'); // 续读窗在预算内,不再截断
    expect(second.output).toContain(String(m![1]).padStart(4)); // 行号从续读点开始
  }, 90_000);

  it('④b range 读超预算 ⇒ 硬错 read_output_too_many_tokens(不静默改小窗口)', async () => {
    const { text, lines } = makeOverBudgetText();
    fs.writeFileSync(path.join(workDir, 'big.txt'), text);

    const r = await read_file.execute({ path: 'big.txt', offset: 1, limit: lines }, ctx);
    expect(r.success).toBe(false);
    expect(r.errorType).toBe('read_output_too_many_tokens');
    expect(r.error).toContain('exceeds maximum allowed tokens');
    expect(r.output).toBe('');
  }, 60_000);

  it('⑤c 空文件 ⇒ EMPTY_FILE_REMINDER;offset 越过 EOF ⇒ 真实行数警示(都不报错)', async () => {
    fs.writeFileSync(path.join(workDir, 'empty.txt'), '');
    const empty = await read_file.execute({ path: 'empty.txt' }, ctx);
    expect(empty.success).toBe(true);
    expect(empty.output).toBe(EMPTY_FILE_REMINDER);

    fs.writeFileSync(
      path.join(workDir, 'ten.txt'),
      Array.from({ length: 10 }, (_, i) => `l${i}`).join('\n'),
    );
    const beyond = await read_file.execute({ path: 'ten.txt', offset: 99 }, ctx);
    expect(beyond.success).toBe(true);
    expect(beyond.output).toContain('shorter than the provided offset (99)');
    expect(beyond.output).toContain('The file has 10 lines');
  });

  it('⑥ 预算内小文件照常回正文,不出现 system-reminder(截断不是常态报警)', async () => {
    fs.writeFileSync(path.join(workDir, 'small.txt'), 'alpha\nbeta');
    const r = await read_file.execute({ path: 'small.txt' }, ctx);
    expect(r.success).toBe(true);
    expect(r.output).toContain('alpha');
    expect(r.output).not.toContain('system-reminder');
  });

  it('⑦ 字节闸截断的文件不叠加 token 部分视图(一次只有一种截断故事)', async () => {
    // 4000 行 × 204 字节 ≈ 816KB > 512KB 字节闸;token 若估算将远超预算
    const line = 'x'.repeat(200);
    const body = Array.from({ length: 4000 }, (_, i) => `${i} ${line}`).join('\n');
    fs.writeFileSync(path.join(workDir, 'huge.txt'), body);

    const r = await read_file.execute({ path: 'huge.txt' }, ctx);
    expect(r.success).toBe(true);
    expect(r.output).toContain('truncated:'); // 字节闸如实标注
    expect(r.output).not.toContain('Showing a partial view'); // token 故事不叠加
    expect(r.output).not.toContain('estimated tokens');
  }, 60_000);
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
