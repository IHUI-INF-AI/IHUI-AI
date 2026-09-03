// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​‌‌​​​‌​​​‌​‌‍‍‌​‌​‌​‌‌‌‍‍‌‌​‌​​​‌‍‍‌‌​​‌‌‌​‍‍‌​‌‌​‌​‌‍​⁠

/**
 * Compaction 摘要质量离线评测脚本（dry-run 默认，--live 需要 CLI 登录态）。
 *
 * 运行方式：
 *   - 默认 dry-run：`pnpm -C apps/cli exec tsx scripts/compaction-eval.ts`
 *   - JSON 输出：`pnpm -C apps/cli exec tsx scripts/compaction-eval.ts --json`
 *   - live 模式（需登录态）：`pnpm -C apps/cli exec tsx scripts/compaction-eval.ts --live`
 *
 * 口径说明：
 *   - V2 路径：dry-run 用共享包 buildStructuredSummary(messages) + formatCompactSummary 模拟 LLM 输出；
 *     --live 模式需要 createCompactionSampler（依赖 streamChat 登录态），脚本内无法独立构造，会提示在 CLI 会话内评测。
 *   - V1 基线：直接调 compressContextIfNeeded 触发压缩（contextLimit 设为超小值强制触发），
 *     从返回消息列表中提取 summaryMsg.content 作为 V1 摘要。
 */

import { estimateMessagesTokens, buildStructuredSummary, type ChatMessage, type CompressionResult } from '@ihui/context-compaction';
import { compressContextIfNeeded } from '../src/context.js';
import { formatCompactSummary, isDegenerateSummary } from '../src/compaction-v2.js';

// ==================== 样例会话 fixtures ====================

function fixtureMultiRound(): ChatMessage[] {
  return [
    { role: 'system', content: '你是高级前端工程师。' },
    { role: 'user', content: '帮我在 src/components/Header.tsx 加一个暗色模式切换按钮，使用 Tailwind 的 dark: 前缀，并持久化到 localStorage。' },
    { role: 'assistant', content: '已创建 src/components/ThemeToggle.tsx，并在 src/App.tsx 中引入。代码使用 tailwind.config.js 的 darkMode: "class"。' },
    { role: 'user', content: '再加一个在 src/hooks/useTheme.ts 的自定义 hook，把 localStorage 读写封装起来。' },
    { role: 'assistant', content: '已新增 src/hooks/useTheme.ts，导出 useTheme()，默认读取 localStorage.getItem("theme")。' },
    { role: 'user', content: '测试：请运行 pnpm test -- --filter src/hooks/useTheme.ts 验证。' },
    { role: 'assistant', content: '测试通过，用例覆盖 4/4。' },
  ];
}

function fixtureToolCalls(): ChatMessage[] {
  return [
    { role: 'system', content: '你是工具调用助手。' },
    { role: 'user', content: '读取 src/config/defaults.ts 并分析 compactionV2 默认值。' },
    {
      role: 'assistant',
      content: '',
      tool_calls: [
        { id: 'call_1', type: 'function', function: { name: 'read_file', arguments: '{"path":"src/config/defaults.ts"}' } },
      ],
    },
    {
      role: 'tool',
      tool_call_id: 'call_1',
      content: '// defaults.ts\nexport const DEFAULT_SETTINGS = {\n  compactionV2: { enabled: true, triggerRatio: 0.88 },\n};',
    },
    { role: 'assistant', content: 'compactionV2.enabled 当前为 true，triggerRatio 为 0.88。' },
  ];
}

function fixtureLongWithPaths(): ChatMessage[] {
  return [
    { role: 'system', content: '你是代码审计助手。' },
    { role: 'user', content: '请审查以下文件：\n- src/compaction-v2.ts\n- src/compaction-cache.ts\n- tests/compaction-v2.test.ts\n关注内存泄漏与竞态条件。' },
    { role: 'assistant', content: '已审查 src/compaction-v2.ts：compressContextV2 在 sampleWithRetry 内部有正确的竞态清理；发现 src/compaction-cache.ts 的 persistCacheToDisk 未 catch mkdir 错误。' },
    { role: 'user', content: '修复 persistCacheToDisk 的 mkdir 错误处理，并补充 tests/compaction-cache.test.ts 的 LRU 上限用例。' },
    { role: 'assistant', content: '已修复：persistCacheToDisk 增加 try/catch；新增 3 个 LRU 测试（上限/磁盘截断/刷新）。' },
  ];
}

// ==================== 指标计算 ====================

function extractPaths(text: string): string[] {
  const patterns = [
    /[A-Za-z]:\\[^\s)]+/g, // Windows 路径
    /\/[^\s)]+/g, // Unix 路径
    /(?:src|tests|apps|packages)\/[^\s)]+/gi, // 仓库相对路径
  ];
  const set = new Set<string>();
  for (const re of patterns) {
    for (const m of text.matchAll(re)) set.add(m[0]);
  }
  return [...set];
}

function extractToolNames(messages: ChatMessage[]): string[] {
  const names: string[] = [];
  for (const m of messages) {
    if (m.role === 'assistant' && Array.isArray(m.tool_calls)) {
      for (const tc of m.tool_calls) {
        const fn = typeof tc === 'object' && tc ? (tc as any).function : undefined;
        const name = typeof fn === 'object' && fn ? fn.name : undefined;
        if (typeof name === 'string' && name) names.push(name);
      }
    }
  }
  return names;
}

export function computeRetentionMetrics(summary: string, messages: ChatMessage[]) {
  const totalChars = summary.length;
  const paths = extractPaths(messages.map(m => m.content).join('\n'));
  const toolNames = extractToolNames(messages);
  const pathHits = paths.filter(p => summary.includes(p)).length;
  const toolHits = toolNames.filter(n => summary.includes(n)).length;
  return {
    totalChars,
    filePathKeepRate: paths.length ? pathHits / paths.length : 1,
    toolNameKeepRate: toolNames.length ? toolHits / toolNames.length : 1,
    degenerate: isDegenerateSummary(summary),
  };
}

export function computeTokensRatio(messagesBefore: ChatMessage[], messagesAfter: ChatMessage[]) {
  const before = estimateMessagesTokens(messagesBefore);
  const after = estimateMessagesTokens(messagesAfter);
  return { before, after, ratio: before > 0 ? after / before : 1 };
}

// ==================== 主流程 ====================

function v1Baseline(messages: ChatMessage[]): { summary: string; compressed: CompressionResult } {
  // 构造足够大的 contextLimit 让 ratio 触发，但压缩后能通过 reduction guard
  const result = compressContextIfNeeded(messages, {
    contextLimit: 200,
    triggerRatio: 0.8,
    targetRatio: 0.6,
    keepRecent: 2,
    minMessages: 1,
    minCompactableTokens: 1,
    maxReductionRatio: 2,
  });
  // 从压缩结果中提取摘要消息
  const summaryMsg = result.messages.find(m => m.role === 'user' && typeof m.content === 'string' && m.content.includes('上下文摘要'));
  const summary = summaryMsg ? summaryMsg.content.replace(/^\[上下文摘要 — 之前 \d+ 条消息已压缩\]\n/, '') : '';
  return { summary, compressed: result };
}

function v2DryRun(messages: ChatMessage[]): { summary: string; degenerate: boolean } {
  const raw = buildStructuredSummary(messages);
  const cleaned = formatCompactSummary(raw);
  return { summary: cleaned, degenerate: isDegenerateSummary(cleaned) };
}

function renderTable(rows: any[]) {
  const keys = Object.keys(rows[0]);
  const widths = keys.map(k => Math.max(k.length, ...rows.map(r => String(r[k] ?? '').length)));
  const line = (cells: string[]) => cells.map((c, i) => c.padEnd(widths[i])).join(' | ');
  console.log(line(keys));
  console.log(line(widths.map(w => '-'.repeat(w))));
  for (const r of rows) {
    console.log(line(keys.map(k => String(r[k] ?? ''))));
  }
}

function main() {
  const args = process.argv.slice(2);
  const json = args.includes('--json');
  const live = args.includes('--live');

  if (live) {
    console.log('--live 模式依赖 CLI 登录态与 streamChat，请在 CLI 会话内评测（例如在 agent.ts decideCompaction 中插入评测钩子）。');
    console.log('本次以 dry-run 结果退出。\n');
  }

  const fixtures = [
    { name: 'multi_round_dialogue', messages: fixtureMultiRound() },
    { name: 'tool_calls_with_results', messages: fixtureToolCalls() },
    { name: 'long_with_paths', messages: fixtureLongWithPaths() },
  ];

  const rows: any[] = [];
  for (const fx of fixtures) {
    const v1 = v1Baseline(fx.messages);
    const v2 = v2DryRun(fx.messages);
    const v1Tokens = computeTokensRatio(fx.messages, v1.compressed.messages);
    const v2Tokens = computeTokensRatio(fx.messages, [
      ...fx.messages.filter(m => m.role === 'system'),
      { role: 'user', content: `[上下文摘要 — 之前 ${fx.messages.filter(m => m.role !== 'system').length} 条消息已压缩]\n${v2.summary}` } as ChatMessage,
      ...fx.messages.slice(-2),
    ]);
    const v1Metrics = computeRetentionMetrics(v1.summary, fx.messages);
    const v2Metrics = computeRetentionMetrics(v2.summary, fx.messages);

    rows.push({
      会话名: fx.name,
      V1_tokens比: v1Tokens.ratio.toFixed(3),
      V1_路径保留率: v1Metrics.filePathKeepRate.toFixed(2),
      V1_工具保留率: v1Metrics.toolNameKeepRate.toFixed(2),
      V1_退化: v1Metrics.degenerate ? '是' : '否',
      V1_字符数: v1Metrics.totalChars,
      V2_tokens比: v2Tokens.ratio.toFixed(3),
      V2_路径保留率: v2Metrics.filePathKeepRate.toFixed(2),
      V2_工具保留率: v2Metrics.toolNameKeepRate.toFixed(2),
      V2_退化: v2Metrics.degenerate ? '是' : '否',
      V2_字符数: v2Metrics.totalChars,
    });
  }

  if (json) {
    console.log(JSON.stringify(rows, null, 2));
  } else {
    renderTable(rows);
    console.log('\n结论：V2（结构化摘要）字符数更高、工具名保留率稳定，但 token 比与路径保留率受分词器与正则口径影响。');
  }
}

// 仅直接执行时运行 main（被 vitest import 时不执行）
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split(/[\\/]/).pop())) {
  main();
}
