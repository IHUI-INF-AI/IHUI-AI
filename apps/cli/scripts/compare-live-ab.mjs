// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 合并两次真实模型 live-ab 结果，按**同名任务**做同集对比。
 *
 * 为什么必须同集：native 全量 35 条里 prompt 只跑了一部分时，直接拿两边的
 * passRate 比是拿不同分母骗自己。这里只取交集，逐条列出差异，并明确打印被排除的任务。
 *
 * 用法：
 *   node apps/cli/scripts/compare-live-ab.mjs <native.json> <prompt.json>
 *   node apps/cli/scripts/compare-live-ab.mjs <native.json> <prompt.json> --json
 */
import fs from 'node:fs';

function readRuns(file) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  // 单臂跑时 runner 仍会回填另一臂的空壳（tasks=0），不能按第一个 key 取 arm。
  const arm = Object.keys(data.arms ?? {}).find((name) => Number(data.arms[name]?.tasks) > 0);
  if (!arm) throw new Error(`${file} 没有非空 arms`);
  const runs = new Map();
  for (const run of data.runs ?? []) {
    if (run.arm !== arm) continue;
    runs.set(run.task, run);
  }
  return { file, arm, runs, meta: data };
}

function summarize(runs) {
  const list = [...runs.values()];
  const passed = list.filter((r) => r.passed).length;
  const sum = (key) => list.reduce((acc, r) => acc + (Number(r[key]) || 0), 0);
  return {
    tasks: list.length,
    passed,
    passRate: list.length ? Number((passed / list.length).toFixed(4)) : 0,
    avgIterations: list.length ? Number((sum('iterations') / list.length).toFixed(2)) : 0,
    avgPromptTokens: list.length ? Math.round(sum('promptTokens') / list.length) : 0,
    avgCompletionTokens: list.length ? Math.round(sum('completionTokens') / list.length) : 0,
    avgWallMs: list.length ? Math.round(sum('wallMs') / list.length) : 0,
    toolFailures: sum('toolFailures'),
  };
}

function pct(n) {
  return `${(n * 100).toFixed(1)}%`;
}

const [nativeFile, promptFile] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (!nativeFile || !promptFile) {
  console.error('用法: node compare-live-ab.mjs <native.json> <prompt.json> [--json]');
  process.exit(2);
}

const native = readRuns(nativeFile);
const prompt = readRuns(promptFile);
const commonTasks = [...native.runs.keys()].filter((t) => prompt.runs.has(t));
const nativeSet = new Map(commonTasks.map((t) => [t, native.runs.get(t)]));
const promptSet = new Map(commonTasks.map((t) => [t, prompt.runs.get(t)]));
const onlyNative = [...native.runs.keys()].filter((t) => !prompt.runs.has(t));
const onlyPrompt = [...prompt.runs.keys()].filter((t) => !native.runs.has(t));

const result = {
  model: native.meta.model,
  nativeFile,
  promptFile,
  commonTasks,
  excluded: { onlyNative, onlyPrompt },
  native: summarize(nativeSet),
  prompt: summarize(promptSet),
  delta: {
    passRate: Number((summarize(nativeSet).passRate - summarize(promptSet).passRate).toFixed(4)),
    avgIterations: Number((summarize(nativeSet).avgIterations - summarize(promptSet).avgIterations).toFixed(2)),
    avgPromptTokens: summarize(nativeSet).avgPromptTokens - summarize(promptSet).avgPromptTokens,
    avgWallMs: summarize(nativeSet).avgWallMs - summarize(promptSet).avgWallMs,
    toolFailures: summarize(nativeSet).toolFailures - summarize(promptSet).toolFailures,
  },
  perTask: commonTasks.map((task) => {
    const n = nativeSet.get(task);
    const p = promptSet.get(task);
    return {
      task,
      nativePassed: n.passed,
      promptPassed: p.passed,
      nativeIterations: n.iterations,
      promptIterations: p.iterations,
      nativeTokens: n.promptTokens + n.completionTokens,
      promptTokens: p.promptTokens + p.completionTokens,
      nativeWallMs: n.wallMs,
      promptWallMs: p.wallMs,
    };
  }),
};

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

console.log(`model: ${result.model}`);
console.log(`同集任务: ${commonTasks.length} / native ${native.runs.size}, prompt ${prompt.runs.size}`);
if (onlyNative.length) console.log(`仅 native 有: ${onlyNative.join(', ')}`);
if (onlyPrompt.length) console.log(`仅 prompt 有: ${onlyPrompt.join(', ')}`);
console.log('');
console.log('arm      pass     rate    iter    promptTok  wallMs   toolFail');
for (const [name, s] of [['native', result.native], ['prompt', result.prompt]]) {
  console.log(
    `${name.padEnd(8)} ${String(`${s.passed}/${s.tasks}`).padEnd(6)} ${pct(s.passRate).padEnd(6)} ` +
      `${String(s.avgIterations).padEnd(6)} ${String(s.avgPromptTokens).padEnd(9)} ${String(s.avgWallMs).padEnd(7)} ${s.toolFailures}`,
  );
}
console.log('');
console.log(`ΔpassRate=${pct(result.delta.passRate)} Δiter=${result.delta.avgIterations} ` +
  `ΔpromptTokens=${result.delta.avgPromptTokens} ΔwallMs=${result.delta.avgWallMs} ΔtoolFail=${result.delta.toolFailures}`);
console.log('');
console.log('task                              native  prompt  Δiter  Δtokens  ΔwallMs');
for (const row of result.perTask) {
  const iter = row.nativeIterations - row.promptIterations;
  const tokens = row.nativeTokens - row.promptTokens;
  const wall = row.nativeWallMs - row.promptWallMs;
  const mark = row.nativePassed === row.promptPassed ? ' ' : (row.nativePassed ? 'N' : 'P');
  console.log(
    `${row.task.padEnd(34)}${mark} ${row.nativePassed ? '✓' : '✗'}      ${row.promptPassed ? '✓' : '✗'}     ` +
      `${String(iter).padStart(4)}  ${String(tokens).padStart(7)}  ${String(wall).padStart(7)}`,
  );
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
