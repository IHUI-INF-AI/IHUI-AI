// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * WP-3 工具结果预算信封 + 压缩后重建已读状态。
 *
 * 覆盖(逐条对应规格):
 *   1. 超限结果**不得整段进上下文** → 落盘 + 信封(路径/预览/截断说明);
 *   2. 落盘必须在项目内(禁 os.tmpdir()),且会话恢复时找得到(按 sessionId 分片 + 内容哈希幂等);
 *   3. 信封幂等:已封装的结果不得二次封装,也不会重复产生产物文件;
 *   4. 端到端一次:超限 → 落盘 → 信封 → 压缩 → 重建提醒(指针必须在压缩后仍然可用);
 *   5. 提醒段的单文件上限与总量上限,超限降级为"读过但体积过大,需要时重新分块读"。
 *
 * 夹具工作区落在仓库内 `.ihui-agent/tmp/`(§15b:临时物不得写出项目;该目录整目录 gitignore)。
 */

import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  envelopeToolResult,
  resolveToolOutputBudget,
  declareToolOutputBudget,
  DEFAULT_TOOL_OUTPUT_BUDGET,
  isEnvelopeContent,
  countEnvelopes,
  parseEnvelope,
  takePreview,
  buildEnvelope,
  isInsideToolArtifactDir,
  readToolArtifact,
  toolArtifactDir,
  sanitizeSessionSegment,
  ReadStateTracker,
  READ_STATE_REMINDER_HEADER,
  READ_STATE_OVERSIZED_HINT,
} from '../src/tools/result-envelope/index.js';
import { compressContextV2, type ChatMessage, type CompactionSampler } from '../src/compaction-v2.js';
import { RECLAIM_PLACEHOLDER } from '../src/context.js';

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../../..');
const FIXTURE_ROOT = path.join(REPO_ROOT, '.ihui-agent', 'tmp');

/** 造一段确定性的超长输出(每行不同,便于验证预览取的是头部) */
function bigOutput(lines: number): string {
  const out: string[] = [];
  for (let i = 0; i < lines; i++) out.push(`LINE-${String(i).padStart(5, '0')} ${'x'.repeat(40)}`);
  return out.join('\n');
}

let workspace = '';
let created: string[] = [];

beforeEach(() => {
  fs.mkdirSync(FIXTURE_ROOT, { recursive: true });
  workspace = fs.mkdtempSync(path.join(FIXTURE_ROOT, 'env-fixture-'));
  created = [];
});

afterEach(() => {
  for (const dir of [workspace, ...created]) {
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('输出预算表', () => {
  it('未登记工具走默认档(不得"没登记=不限")', () => {
    expect(resolveToolOutputBudget('some_mcp_tool')).toEqual(DEFAULT_TOOL_OUTPUT_BUDGET);
  });

  it('已登记工具走自己的档,预览上限被夹住', () => {
    declareToolOutputBudget('wp3_probe_tool', { maxChars: 500, previewChars: 99_999 });
    const b = resolveToolOutputBudget('wp3_probe_tool');
    expect(b.maxChars).toBe(500);
    // 信封本身必须比被替换掉的正文小得多,否则"省上下文"是假的
    expect(b.previewChars).toBeLessThanOrEqual(4_000);
  });
});

describe('超限 → 落盘 → 信封', () => {
  it('超限结果被换成信封,原文落盘在项目内且能原样读回', () => {
    const tracker = new ReadStateTracker();
    const big = bigOutput(900);
    const outcome = envelopeToolResult({
      call: { name: 'read_file', arguments: { path: 'src/huge.ts' } },
      result: { success: true, output: big },
      workspacePath: workspace,
      sessionId: 'sess-abc',
      turn: 3,
      tracker,
    });

    expect(outcome.enveloped).toBe(true);
    expect(outcome.reason).toBe('applied');
    expect(outcome.originalChars).toBe(big.length);
    expect(outcome.output.length).toBeLessThan(big.length / 3);

    const parsed = parseEnvelope(outcome.output);
    expect(parsed).not.toBeNull();
    expect(parsed!.toolName).toBe('read_file');
    expect(parsed!.totalChars).toBe(big.length);
    expect(parsed!.totalLines).toBe(900);
    // 信封三要素齐备:路径 + 前 K 字符预览 + 已截断说明
    expect(parsed!.artifactPath).toBeTruthy();
    expect(parsed!.preview.startsWith('LINE-00000')).toBe(true);
    expect(outcome.output).toContain('正文未进入上下文');
    expect(outcome.output).toContain('read_file 分块读取');

    // 落盘位置:必须在给定 workspacePath 之内,且绝不在系统临时目录里
    expect(isInsideToolArtifactDir(workspace, parsed!.artifactPath)).toBe(true);
    const abs = path.resolve(workspace, parsed!.artifactPath);
    expect(abs.startsWith(path.resolve(workspace))).toBe(true);
    expect(abs.startsWith(path.resolve(os.tmpdir()))).toBe(false);
    const back = readToolArtifact(workspace, parsed!.artifactPath);
    expect(back.ok).toBe(true);
    if (back.ok) expect(back.content.trimEnd()).toBe(big);
  });

  it('未超限时原样回灌(不得把正常结果也信封化)', () => {
    const small = bigOutput(5);
    const outcome = envelopeToolResult({
      call: { name: 'grep', arguments: { pattern: 'x' } },
      result: { success: true, output: small },
      workspacePath: workspace,
      sessionId: 'sess-small',
    });
    expect(outcome.enveloped).toBe(false);
    expect(outcome.reason).toBe('within-budget');
    expect(outcome.output).toBe(small.replace(/^/, ''));
  });

  it('失败结果的错误信息不被信封吞掉(状态也是事实)', () => {
    const outcome = envelopeToolResult({
      call: { name: 'read_file', arguments: { path: 'a.ts' } },
      result: { success: false, output: '', error: '文件不存在: a.ts' },
      workspacePath: workspace,
      sessionId: 'sess-err',
    });
    expect(outcome.reason).toBe('empty-output');
    expect(outcome.output).toBe('');
  });
});

describe('信封幂等(压缩侧识别的前提)', () => {
  it('已封装的结果不二次封装,也不重复产生产物文件', () => {
    const big = bigOutput(900);
    const first = envelopeToolResult({
      call: { name: 'run_command', arguments: {} },
      result: { success: true, output: big },
      workspacePath: workspace,
      sessionId: 'sess-idem',
    });
    const dir = toolArtifactDir(workspace, 'sess-idem');
    const filesAfterFirst = fs.readdirSync(dir).length;

    const second = envelopeToolResult({
      call: { name: 'run_command', arguments: {} },
      result: { success: true, output: first.output },
      workspacePath: workspace,
      sessionId: 'sess-idem',
    });

    expect(second.enveloped).toBe(false);
    expect(second.reason).toBe('already-enveloped');
    expect(second.output).toBe(first.output);
    expect(countEnvelopes(second.output)).toBe(1);
    expect(fs.readdirSync(dir).length).toBe(filesAfterFirst);
  });

  it('同内容重复落盘命中同一文件(内容哈希即幂等键)', () => {
    const big = bigOutput(900);
    const a = envelopeToolResult({ call: { name: 'grep', arguments: {} }, result: { success: true, output: big }, workspacePath: workspace, sessionId: 's2' });
    const b = envelopeToolResult({ call: { name: 'grep', arguments: {} }, result: { success: true, output: big }, workspacePath: workspace, sessionId: 's2' });
    expect(parseEnvelope(a.output)!.artifactPath).toBe(parseEnvelope(b.output)!.artifactPath);
    expect(fs.readdirSync(toolArtifactDir(workspace, 's2')).length).toBe(1);
  });

  it('残缺信封(缺路径/字符数)不被当成信封解析出来,宁可判无也不猜', () => {
    const broken = '[[结果信封 v1]]\n工具: x\n[[/结果信封 v1]]';
    expect(isEnvelopeContent(broken)).toBe(true);
    expect(parseEnvelope(broken)).toBeNull();
  });
});

describe('端到端:超限 → 落盘 → 信封 → 压缩 → 重建提醒', () => {
  const SESSION = 'sess-e2e';

  function filler(times: number): string {
    return 'The quick brown fox jumps over the lazy dog. '.repeat(times);
  }

  /** 旧轮次(白名单工具,可被 reclaim 改写),把信封那条挤到最近轮次之外 */
  function staleRound(n: number): ChatMessage[] {
    return [
      { role: 'assistant', content: `第 ${n} 次读取`, tool_calls: [{ id: `c${n}`, type: 'function', function: { name: 'read_file', arguments: '{}' } }] },
      { role: 'tool', content: filler(60), tool_call_id: `c${n}` },
    ];
  }

  it('压缩后提醒段仍给出产物路径,信封未被二次封装', async () => {
    const tracker = new ReadStateTracker();
    const big = bigOutput(900);
    const outcome = envelopeToolResult({
      call: { name: 'read_file', arguments: { path: 'apps/web/src/app/page.tsx' } },
      result: { success: true, output: big },
      workspacePath: workspace,
      sessionId: SESSION,
      turn: 1,
      tracker,
    });
    const artifactPath = parseEnvelope(outcome.output)!.artifactPath;

    // 内嵌形态(IHUI 约定):信封作为工具结果正文进 messages
    const messages: ChatMessage[] = [{ role: 'system', content: 'sys' }];
    for (let i = 1; i <= 14; i++) messages.push(...staleRound(i));
    messages.push({
      role: 'user',
      content: `[工具结果 ✓] read_file\n${outcome.output}\n\n请继续`,
    });

    const sampler: CompactionSampler & { calls: number } = {
      calls: 0,
      async sampleCompaction() {
        sampler.calls += 1;
        return { response: `## 任务目标\n${filler(200)}` };
      },
    };
    const result = await compressContextV2(messages, {
      contextLimit: 20_000,
      sampler,
      // 空闲触发:证明 reclaim 的 idle 腿在调用方传了时间戳后确实会动
      lastActivityAtMs: 0,
      nowMs: 10 * 60 * 1000,
    });

    expect(result.compressed).toBe(true);
    const flat = JSON.stringify(result.messages);
    // 信封只有一份(未被再封装/再压一遍后仍留多份标记)
    expect(countEnvelopes(flat)).toBeLessThanOrEqual(1);
    // reclaim 可能把旧轮正文换成占位串 —— 但已读事实必须由提醒段兜回来
    const reminder = tracker.buildReminder();
    expect(reminder).not.toBeNull();
    expect(reminder!).toContain(READ_STATE_REMINDER_HEADER);
    expect(reminder!).toContain('apps/web/src/app/page.tsx');
    expect(reminder!).toContain(artifactPath);
    expect(reminder!.length).toBeLessThan(2_000);
    // 产物文件在压缩后依然可读(路径不是死链)
    expect(readToolArtifact(workspace, artifactPath).ok).toBe(true);
    // 回收占位串确实出现过 = 这一轮压缩真的改写过内容
    const reclaimHappened = flat.includes(RECLAIM_PLACEHOLDER) || flat.includes('上下文摘要');
    expect(reclaimHappened).toBe(true);
  });

  it('冷启动(会话恢复)可从残留信封回捞已读事实', () => {
    const big = bigOutput(900);
    const source = new ReadStateTracker();
    const outcome = envelopeToolResult({
      call: { name: 'read_file', arguments: { path: 'src/recovered.ts' } },
      result: { success: true, output: big },
      workspacePath: workspace,
      sessionId: 'sess-recover',
      turn: 2,
      tracker: source,
    });
    // 模拟进程重启:新 tracker,只有 messages 里那段信封文本
    const revived = new ReadStateTracker();
    const n = revived.collectFromMessages([{ role: 'user', content: `[工具结果 ✓] read_file\n${outcome.output}` }]);
    expect(n).toBe(1);
    const reminder = revived.buildReminder();
    expect(reminder).toContain(parseEnvelope(outcome.output)!.artifactPath);
    expect(reminder).toContain('src/recovered.ts 的完整输出');
  });
});

describe('提醒段预算档位', () => {
  it('单文件超上限 → 降级为"体积过大需重新分块读",不截半截路径', () => {
    const tracker = new ReadStateTracker();
    const longExcerpt = 'y'.repeat(400);
    tracker.record({
      path: 'src/with-a-very-long-relative-path-that-eats-the-budget/board.tsx',
      kind: 'file',
      tool: 'read_file',
      chars: 500_000,
      lines: 12_000,
      enveloped: false,
      excerpt: longExcerpt,
      turn: 1,
    });
    const reminder = tracker.buildReminder({ maxCharsPerEntry: 120 });
    expect(reminder).toContain(READ_STATE_OVERSIZED_HINT);
    // 路径必须完整在位(截断的路径会让模型去读不存在的文件)
    expect(reminder).toContain('src/with-a-very-long-relative-path-that-eats-the-budget/board.tsx');
    expect(reminder).not.toContain(longExcerpt);
  });

  it('总量超上限 → 保留最近的并如实报被略去的条数(不静默丢)', () => {
    const tracker = new ReadStateTracker();
    for (let i = 1; i <= 30; i++) {
      tracker.record({
        path: `src/module-${i}/index.ts`,
        kind: 'file',
        tool: 'read_file',
        chars: 1_000 + i,
        lines: 40,
        enveloped: false,
        excerpt: `export const mod${i}`,
        turn: i,
      });
    }
    const reminder = tracker.buildReminder({ maxTotalChars: 400 })!;
    expect(reminder.length).toBeLessThan(900);
    // 最近一条必须在,最早一条必须被挤掉并计入省略数
    expect(reminder).toContain('src/module-30/index.ts');
    expect(reminder).toContain('因提醒预算上限略去');
    expect(reminder).not.toContain('src/module-1/index.ts');
  });

  it('无任何记录时不注入空提醒段', () => {
    expect(new ReadStateTracker().buildReminder()).toBeNull();
  });

  it('路径参数取不到时退回工具名,不猜目录', () => {
    const tracker = new ReadStateTracker();
    tracker.recordToolCall({ toolName: 'browser_snapshot', args: {}, output: 'Page: Home', turn: 1, enveloped: false });
    expect(tracker.entries()[0]!.path).toBe('browser_snapshot');
  });

  it('sessionId 归一化:含分隔符/空值都不会越出产物根', () => {
    expect(sanitizeSessionSegment('../../etc')).toBe('.._.._etc');
    expect(sanitizeSessionSegment('')).toBe('default');
    const dir = toolArtifactDir(workspace, '../../outside');
    expect(dir.startsWith(path.resolve(workspace))).toBe(true);
    // 归一化后不得再含任何路径分隔符(否则会话目录名本身成了穿越通道)
    expect(/[\\/]/.test(sanitizeSessionSegment('a/b\\c'))).toBe(false);
  });

  it('takePreview 预览恒不超过预算,且能处理 BOM', () => {
    expect(takePreview('﻿abcdef', 3)).toBe('abc');
    expect(takePreview('abc', 10)).toBe('abc');
    expect(takePreview('abc', 0)).toBe('');
  });

  it('buildEnvelope 是纯函数:同输入两次产物逐字节相同', () => {
    const base = { toolName: 'grep', artifact: { relativePath: 'a/b.txt', chars: 123 }, totalLines: 7, budgetChars: 100, preview: 'hello' };
    expect(buildEnvelope(base)).toBe(buildEnvelope(base));
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
