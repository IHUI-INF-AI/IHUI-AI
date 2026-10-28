// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * reclaim 的"信封保护"必须**留下账面信号** —— 判据对账。
 *
 * 台账那一格(`reclaim` 改写信封内容的边界)的治本两半是
 *   ① 命中信封内容 ⇒ 跳过改写(已由 `9f404d034` 落在 reclaim.ts);
 *   ② 跳过这件事与原因**如实可见**(此前无人做:`isEnvelopeResult` 那一支
 *      `return null` 在账面上什么都留不下,而"静默跳过等于没跳过"是本仓最高频失效型)。
 * 本文件钉的是第②半,并把第①半的两个方向各锁一次。
 *
 * 三条判据(各防一种失效):
 *  A 真信封 ⇒ 必须跳过，且**证明确实跳过** —— 断言的是"产物指针逐字节仍在原处"
 *    与 `envelopeSkipped === 1`(而不是"没抛错":没抛错与"一律跳过"在账面上同形)。
 *  B 普通内容 ⇒ 必须照改(反向对照) —— 防"把整条改写路径关掉"被读成修复。
 *  C 计数不得虚报 —— 体积门槛没过的信封**不计**进 envelopeSkipped,
 *    否则那个数字读起来像"我们保护了三条",实际一条都不会被动。
 *
 * 判据的输入不是手搓的假想格式:A 组里的信封样本由 `buildEnvelope`(真实序列化函数)
 * 现场生成,并先断言它能被两侧共用的那一份判据 `isEnvelopeContent` 认出来 ——
 * 手搓格式一旦与序列化侧漂移,本文件就会绿着看守一个不存在的形态。
 */

import { describe, expect, it, vi } from 'vitest';

import { buildEnvelope, isEnvelopeContent } from '../src/tools/result-envelope/index.js';
import { reclaimStaleToolResults, type ChatMessage, type ReclaimOptions } from '../src/context.js';

/** 与 reclaim 白名单同族、体积达标的普通正文(对照组用) */
function plainBody(lines: number): string {
  const out: string[] = [];
  for (let i = 0; i < lines; i++) {
    out.push(`ROW-${String(i).padStart(5, '0')}: the quick brown fox jumps over the lazy dog ${i}`);
  }
  return out.join('\n');
}

/**
 * 用**真实序列化出口**造一条信封(不手搓格式)。
 * preview 无空行 ⇒ 归一化前后同形,信封恒为单个完整段(见 envelope.ts 的空行注释)。
 */
function realEnvelope(toolName: string, artifactPath: string, previewLines: number): string {
  const preview = plainBody(previewLines);
  return buildEnvelope({
    toolName,
    artifact: { relativePath: artifactPath, chars: preview.length },
    totalLines: previewLines,
    budgetChars: 2_000,
    preview,
    sourcePath: 'src/some/file.ts',
  });
}

/** OpenAI 兼容形态的一轮:assistant 的 tool_call + 配对的 role='tool' 结果 */
function toolRound(name: string, id: string, body: string): ChatMessage[] {
  return [
    {
      role: 'assistant',
      content: `调用 ${name}`,
      tool_calls: [{ id, type: 'function', function: { name, arguments: '{}' } }],
    },
    { role: 'tool', content: body, tool_call_id: id },
  ];
}

/** IHUI 内嵌形态的一轮:assistant 文本 + user 消息里的 `[工具结果 ✓] name\n正文` 分段 */
function embeddedRound(chunks: Array<{ name: string; body: string }>): ChatMessage[] {
  return [
    { role: 'assistant', content: '我来查一下' },
    {
      role: 'user',
      content: chunks.map((c) => `[工具结果 ✓] ${c.name}\n${c.body}`).join('\n\n'),
    },
  ];
}

const TRIGGER: ReclaimOptions = {
  // contextLimit 小到让比例触发(0.6)必然成立;收益门槛放到 1,免被"收益不足"那一支吞掉
  contextLimit: 1_000,
  minSavedTokens: 1,
  // 只保护最近 1 轮 ⇒ 前两轮都进回收射程
  keepRecentRounds: 1,
};

function toolResultOf(messages: ChatMessage[], id: string): ChatMessage | undefined {
  return messages.find((m) => m.tool_call_id === id);
}

describe('reclaim 信封保护:跳过必须如实可见(ReclaimResult.envelopeSkipped)', () => {
  it('样本自检:真实序列化出口产出的信封,必须被两侧共用的那一份判据认出', () => {
    const sample = realEnvelope('read_file', 'artifacts/out-1.txt', 40);
    // 判据与格式同源(否则本文件的输入就是"想象中的格式")
    expect(isEnvelopeContent(sample)).toBe(true);
    // 必须保护的那一行确实写在里面 —— 它是"指针丢了"这件事的可观测锚点
    expect(sample).toContain('完整输出: artifacts/out-1.txt');
    // 分段切分劈不开它(envelope.ts 的空行归一化在位)
    expect(sample).not.toContain('\n\n');
  });

  it('A OpenAI 形态:真信封 ⇒ 跳过改写，产物指针逐字节留在原位 + 计数点名这条放弃', () => {
    const envelope = realEnvelope('read_file', 'artifacts/env-openai.txt', 40);
    const messages: ChatMessage[] = [
      { role: 'system', content: 'sys' },
      ...toolRound('read_file', 'e1', envelope),
      ...toolRound('grep', 'e2', plainBody(40)),
      { role: 'user', content: '继续' },
    ];

    const out = reclaimStaleToolResults(messages, TRIGGER);

    // 改写确实发生过(否则"没动信封"可能只是"什么都没动"的假象)
    expect(out.applied).toBe(true);
    // 两条达标正文里只动了非信封那一条
    expect(out.reclaimedCount).toBe(1);
    // 第②半:放弃这件事进账面了,不再是 `return null` 之后的沉默
    expect(out.envelopeSkipped).toBe(1);

    // 「确实跳过」的证据:整条信封正文逐字节不变,而不是"没报错"
    expect(toolResultOf(out.messages, 'e1')?.content).toBe(envelope);
    // 反面对照:同一条历史里普通正文确实被换成占位串 ⇒ 保护不是全量短路
    expect(toolResultOf(out.messages, 'e2')?.content).toContain('[工具结果已回收');
    // 指针行没被回收(它是冷启动找回产物正文的唯一线索)
    expect(
      out.messages.some((m) => m.content.includes('完整输出: artifacts/env-openai.txt')),
    ).toBe(true);
  });

  it('A2 内嵌形态:信封分段同样跳过并计数,另一条消息里的普通分段照改', () => {
    const envelope = realEnvelope('read_file', 'artifacts/env-embedded.txt', 40);
    const messages: ChatMessage[] = [
      { role: 'system', content: 'sys' },
      ...embeddedRound([{ name: 'read_file', body: envelope }]),
      ...embeddedRound([{ name: 'grep', body: plainBody(40) }]),
      { role: 'user', content: '继续' },
    ];

    const out = reclaimStaleToolResults(messages, TRIGGER);

    expect(out.applied).toBe(true);
    expect(out.reclaimedCount).toBe(1);
    expect(out.envelopeSkipped).toBe(1);

    const envelopeCarrier = out.messages.find((m) => m.content.includes('artifacts/env-embedded.txt'));
    expect(envelopeCarrier).toBeDefined();
    // 信封那一段逐字节还在,且这条消息里没有任何占位串
    expect(envelopeCarrier?.content).toContain(envelope);
    expect(envelopeCarrier?.content).not.toContain('[工具结果已回收');
    // 被改写的是另一条消息:分段头保留、正文换占位串
    const rewrittenCarrier = out.messages.find((m) => m.content.includes('[工具结果已回收'));
    expect(rewrittenCarrier?.content).toContain('[工具结果 ✓] grep');
  });

  it('B 反向对照:没有信封时两条达标正文必须都被改写(防"一律跳过"伪装成修复)', () => {
    const messages: ChatMessage[] = [
      { role: 'system', content: 'sys' },
      ...toolRound('read_file', 'p1', plainBody(40)),
      ...toolRound('grep', 'p2', plainBody(40)),
      { role: 'user', content: '继续' },
    ];

    const out = reclaimStaleToolResults(messages, TRIGGER);

    expect(out.applied).toBe(true);
    expect(out.reclaimedCount).toBe(2);
    expect(out.envelopeSkipped).toBe(0);
    expect(toolResultOf(out.messages, 'p1')?.content).toContain('[工具结果已回收');
    expect(toolResultOf(out.messages, 'p2')?.content).toContain('[工具结果已回收');
  });

  it('C 计数不虚报:体积门槛没过的信封不算"放弃了一次改写"', () => {
    const envelope = realEnvelope('read_file', 'artifacts/env-small.txt', 40);
    const messages: ChatMessage[] = [
      { role: 'system', content: 'sys' },
      ...toolRound('read_file', 's1', envelope),
      ...toolRound('grep', 's2', plainBody(40)),
      { role: 'user', content: '继续' },
    ];

    // 门槛抬到任何一条都够不着 ⇒ 本轮既不改写,也不该声称"保护了什么"
    const out = reclaimStaleToolResults(messages, { ...TRIGGER, minResultTokens: 100_000 });

    expect(out.applied).toBe(false);
    expect(out.reason).toBe('nothing-reclaimable');
    expect(out.reclaimedCount).toBe(0);
    expect(out.envelopeSkipped).toBe(0);
  });

  it('D 日志出口:本轮**只**遇到信封时,' + "'nothing-reclaimable' 必须被一句点名原因的告警陪着", () => {
    const envelope = realEnvelope('read_file', 'artifacts/env-only.txt', 40);
    const messages: ChatMessage[] = [
      { role: 'system', content: 'sys' },
      ...toolRound('read_file', 'o1', envelope),
      { role: 'user', content: '继续' },
    ];
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const out = reclaimStaleToolResults(messages, TRIGGER);
      // 改写没发生,但**不是**因为"没有达标正文" —— 这一格最容易被读反
      expect(out.applied).toBe(false);
      expect(out.reason).toBe('nothing-reclaimable');
      expect(out.envelopeSkipped).toBe(1);
      // 计数之外还得喊出来:零改写的静默 = 读报告的人以为历史里没东西可回收
      const calls = warn.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(calls).toContain('reclaim-skipped-envelope');
      expect(calls).toContain('1');
    } finally {
      warn.mockRestore();
    }
  });

  it('D2 反向对照:真的什么都没遇到时不得喊信封(防告警变成无条件噪音)', () => {
    const messages: ChatMessage[] = [
      { role: 'system', content: 'sys' },
      { role: 'assistant', content: '只有对话文本' },
      { role: 'user', content: '继续' },
      { role: 'assistant', content: '还是文本' },
      { role: 'user', content: '好' },
    ];
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      // currentTokens 显式抬高:让**触发成立、扫描真跑过**,才能证明"没喊"是因为
      // 什么都没放弃,而不是因为压根没进扫描(前者才是本用例要判的东西)
      const out = reclaimStaleToolResults(messages, { ...TRIGGER, currentTokens: 900 });
      expect(out.applied).toBe(false);
      expect(out.reason).toBe('nothing-reclaimable');
      expect(out.envelopeSkipped).toBe(0);
      expect(warn.mock.calls.map((c) => c.join(' ')).join('\n')).not.toContain(
        'reclaim-skipped-envelope',
      );
    } finally {
      warn.mockRestore();
    }
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
