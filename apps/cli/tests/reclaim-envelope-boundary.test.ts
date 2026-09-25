// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * reclaim 改写信封内容的边界 —— 「产物指针逐字节可回」判据。
 *
 * 背景:reclaim(@ihui/context-compaction)对**内嵌形态**(CLI 实际使用的形态,
 * `[工具结果 ✓] name\n正文` 按 `\n\n` 分段拼接)的段级保护是 `isEnvelopeResult(body)`,
 * 它要求 body 同时含 OPEN/CLOSE 两个标记。而信封的**预览体是原文的逐字节切片** ——
 * 原文里只要有一个空行(`\n\n`)落在预览窗口内,信封就会被 reclaim 的分段逻辑
 * 从中间劈开:首段只带 OPEN 标记与产物路径行、不带 CLOSE 标记 ⇒ 逃过段级保护 ⇒
 * 首段(含 `完整输出: <产物路径>`)被改写成回收占位串。
 *
 * 后果链:改写后 OPEN 标记与路径行一起消失,`parseEnvelope`/`collectFromMessages`
 * 冷启动回捞全部失效 —— 会话恢复时产物指针丢失,只剩内存里的重建提醒(且受
 * 12 条/1600 字符预算限制)。这正是台账「只在 CLI 侧由重建提醒兜回产物指针」
 * 那条边界的洞:提醒是内存态,指针在磁盘历史里必须仍然逐字节可回。
 *
 * 判据(A 案):信封正文(含预览)不得包含任何 `\n\n` —— 保证信封在 reclaim 的
 * 分段切分下恒为一个完整段,段级 `isEnvelopeResult` 保护必然命中;改写前后,
 * `parseEnvelope(消息)` 必须能逐字节取回产物路径。变异对照:把 buildEnvelope 的
 * 预览归一化摘掉(预览含空行)⇒ 下述用例必红(修复前实测:
 * `expect(flat.includes(env.artifactPath)).toBe(true)` 收到 false)。
 */

import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  envelopeToolResult,
  parseEnvelope,
  buildEnvelope,
  ReadStateTracker,
} from '../src/tools/result-envelope/index.js';
import { reclaimStaleToolResults } from '../src/context.js';

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../../..');
const FIXTURE_ROOT = path.join(REPO_ROOT, '.ihui-agent', 'tmp');

let workspace = '';

function mkws(tag: string): string {
  workspace = fs.mkdtempSync(path.join(FIXTURE_ROOT, `reclaim-env-${tag}-`));
  return workspace;
}

/** 造一段"预览窗口内含空行"的超长输出(与真实命令/文件输出同型) */
function bigOutputWithBlankLine(): string {
  const head: string[] = [];
  for (let i = 0; i < 10; i++) head.push(`LINE-${String(i).padStart(5, '0')}: the quick brown fox jumps over the lazy dog, item ${i}`);
  const tail: string[] = [];
  for (let i = 0; i < 900; i++) tail.push(`TAIL-${String(i).padStart(5, '0')} ${'y'.repeat(60)}`);
  // 空行落在 ~950 字符处,在 read_file 预览(前 2000 字符)窗口内
  return [...head, '', ...tail].join('\n');
}

/** 造一段无空行的超长输出(对照组) */
function bigOutputNoBlank(): string {
  const out: string[] = [];
  for (let i = 0; i < 900; i++) out.push(`LINE-${String(i).padStart(5, '0')}: the quick brown fox jumps over the lazy dog, item ${i}`);
  return out.join('\n');
}

const FILLER = 'The quick brown fox jumps over the lazy dog. '.repeat(60);

/**
 * 组装与 agent.ts 完全同形的消息历史:内嵌形态 user 消息在前(挤出最近 3 轮保护),
 * 中间 6 个白名单旧轮次(保证改写收益过 600 token 门槛),尾部 3 个保护轮次,
 * 并让比例触发(0.6)生效。
 */
function buildHistory(envelopeOutput: string): Array<Record<string, unknown>> {
  const messages: Array<Record<string, unknown>> = [{ role: 'system', content: 'sys' }];
  messages.push({ role: 'user', content: `[工具结果 ✓] read_file\n${envelopeOutput}` });
  for (let i = 1; i <= 6; i++) {
    messages.push({ role: 'assistant', content: `第 ${i} 轮`, tool_calls: [{ id: `c${i}`, type: 'function', function: { name: 'read_file', arguments: '{}' } }] });
    messages.push({ role: 'tool', content: FILLER, tool_call_id: `c${i}` });
  }
  for (let i = 0; i < 3; i++) {
    messages.push({ role: 'assistant', content: `尾轮 ${i}` });
    messages.push({ role: 'user', content: '继续' });
  }
  return messages;
}

describe('reclaim 信封边界:预览含空行 ⇒ 信封被段级切分劈开', () => {
  it('归一化后信封恒为单个完整段:内嵌形态首段同时含 OPEN/CLOSE 双标记,段级保护必然命中', () => {
    const ws = mkws('raw');
    const outcome = envelopeToolResult({
      call: { name: 'read_file', arguments: { path: 'src/blank.ts' } },
      result: { success: true, output: bigOutputWithBlankLine() },
      workspacePath: ws,
      sessionId: 'raw',
      turn: 1,
    });
    expect(outcome.enveloped).toBe(true);
    // 原文预览窗口内确有空行(触发条件在位,不是没造出来)
    expect(bigOutputWithBlankLine().slice(0, 2_000)).toContain('\n\n');
    // 归一化后信封整体不含 '\n\n':reclaim 的分段切分劈不开它
    expect(outcome.output).not.toContain('\n\n');
    // 段级保护命中面:首段(带 [工具结果 ✓] 头)的 body 同时含两个标记
    // ⇒ reclaim 的 isEnvelopeResult(body) 判真 ⇒ 拒绝改写(变异对照:修复前
    //   首段只含 OPEN 不含 CLOSE,保护逃过,产物路径行被改写成占位串)
    const firstSeg = `[工具结果 ✓] read_file\n${outcome.output}`.split('\n\n')[0]!;
    expect(firstSeg).toContain('[[结果信封 v1]]');
    expect(firstSeg).toContain('[[/结果信封 v1]]');
    expect(firstSeg).toContain('完整输出:'); // 产物路径行就在受保护的这段里
  });

  it('判据:信封正文不得含 \\n\\n(信封在分段切分下恒为单个完整段)', () => {
    const ws = mkws('criterion');
    const withBlank = envelopeToolResult({
      call: { name: 'read_file', arguments: { path: 'a.ts' } },
      result: { success: true, output: bigOutputWithBlankLine() },
      workspacePath: ws,
      sessionId: 'crit',
    });
    // A 案落地后:预览被压缩空行,信封整体不再含 \n\n
    expect(withBlank.output).not.toContain('\n\n');
    const noBlank = envelopeToolResult({
      call: { name: 'read_file', arguments: { path: 'b.ts' } },
      result: { success: true, output: bigOutputNoBlank() },
      workspacePath: ws,
      sessionId: 'crit2',
    });
    expect(noBlank.output).not.toContain('\n\n');
  });

  it('A 案主判据:reclaim 改写前后,产物指针在消息历史里逐字节可回(冷启动可回捞)', () => {
    const ws = mkws('roundtrip');
    const tracker = new ReadStateTracker();
    const outcome = envelopeToolResult({
      call: { name: 'read_file', arguments: { path: 'src/huge-with-blank.ts' } },
      result: { success: true, output: bigOutputWithBlankLine() },
      workspacePath: ws,
      sessionId: 'roundtrip',
      turn: 1,
      tracker,
    });
    const env = parseEnvelope(outcome.output)!;
    const history = buildHistory(outcome.output);

    const result = reclaimStaleToolResults(history as never, {
      contextLimit: 10_000,
      currentTokens: 9_999,
    });

    // 改写确实发生过(reclaim 真动了),否则"指针可回"是空验证
    expect(result.applied).toBe(true);
    expect(result.reclaimedCount).toBeGreaterThan(0);
    const flat = JSON.stringify(result.messages);
    expect(flat.includes('[工具结果已回收')).toBe(true);

    // 主判据:产物路径行逐字节存活,冷启动回捞能重建指针
    expect(flat.includes(env.artifactPath)).toBe(true);
    expect(flat.includes('[[结果信封 v1]]')).toBe(true);
    const revived = new ReadStateTracker();
    const recovered = revived.collectFromMessages(
      (result.messages as Array<{ role: string; content: string }>).filter((m) => m.role === 'user'),
    );
    expect(recovered).toBeGreaterThanOrEqual(1);
    const reminder = revived.buildReminder() ?? '';
    expect(reminder.includes(env.artifactPath)).toBe(true);
  });

  it('buildEnvelope 纯函数:压缩空行后同输入逐字节幂等', () => {
    const base = {
      toolName: 'grep',
      artifact: { relativePath: 'a/b.txt', chars: 123 },
      totalLines: 7,
      budgetChars: 100,
      preview: 'line1\n\nline2\n\n\nline3',
    };
    expect(buildEnvelope(base)).toBe(buildEnvelope(base));
    // 预览的空行被压缩为单换行(信息不丢:行结构保留)
    const built = buildEnvelope(base);
    expect(built).not.toContain('\n\n');
    expect(built).toContain('line1\nline2\nline3');
  });

  it('端到端:压缩链(compressContextV2 的 reclaim 腿)过后产物指针仍可回', async () => {
    const { compressContextV2 } = await import('../src/compaction-v2.js');
    type ChatMessage = Parameters<typeof compressContextV2>[0][number];
    const ws = mkws('e2e');
    const tracker = new ReadStateTracker();
    const outcome = envelopeToolResult({
      call: { name: 'read_file', arguments: { path: 'src/e2e-blank.ts' } },
      result: { success: true, output: bigOutputWithBlankLine() },
      workspacePath: ws,
      sessionId: 'e2e',
      turn: 1,
      tracker,
    });
    const env = parseEnvelope(outcome.output)!;
    const messages: ChatMessage[] = [{ role: 'system', content: 'sys' }];
    // 旧轮次(可回收),把信封那条挤出最近 3 轮
    for (let i = 1; i <= 6; i++) {
      messages.push({ role: 'assistant', content: `第 ${i} 轮`, tool_calls: [{ id: `c${i}`, type: 'function' as const, function: { name: 'read_file', arguments: '{}' } }] });
      messages.push({ role: 'tool', content: FILLER, tool_call_id: `c${i}` });
    }
    messages.push({ role: 'user', content: `[工具结果 ✓] read_file\n${outcome.output}` });
    for (let i = 0; i < 3; i++) {
      messages.push({ role: 'assistant', content: `尾轮 ${i}` });
      messages.push({ role: 'user', content: '继续' });
    }
    const result = await compressContextV2(messages, {
      contextLimit: 20_000,
      sampler: { async sampleCompaction() { return { response: '## 摘要\n' + FILLER }; } },
      lastActivityAtMs: 0,
      nowMs: 10 * 60 * 1000,
    });
    expect(result.compressed).toBe(true);
    const flat = JSON.stringify(result.messages);
    // 主判据:无论走到摘要还是只走 reclaim,产物路径必须逐字节留在历史里
    expect(flat.includes(env.artifactPath)).toBe(true);
    const revived = new ReadStateTracker();
    revived.collectFromMessages((result.messages as Array<{ role: string; content: string }>).filter((m) => m.role === 'user'));
    expect((revived.buildReminder() ?? '').includes(env.artifactPath)).toBe(true);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
