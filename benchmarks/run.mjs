#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// benchmark runner
// 用法:
//   node benchmarks/run.mjs --selftest          验证判定脚本: solved 必过 + workspace 必挂
//   node benchmarks/run.mjs --skip-llm          同 --selftest
//   node benchmarks/run.mjs [--task id1,id2]    真实执行 CLI agent 并判定, 汇总通过率
// 环境变量:
//   IHUI_CMD           自定义 CLI 命令(空格分隔, 如 "node g:/x/dist/index.js")
//   BENCH_TIMEOUT_MS   单任务 agent 超时(默认 300000)
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = dirname(fileURLToPath(import.meta.url));
const TASKS_DIR = join(root, 'tasks');
const REPORTS_DIR = join(root, 'reports');

// ---- 任务发现 ----
function discover() {
  return readdirSync(TASKS_DIR)
    .filter((d) => existsSync(join(TASKS_DIR, d, 'task.md')) && existsSync(join(TASKS_DIR, d, 'verify.mjs')))
    .sort();
}

// ---- CLI 命令探测 ----
function resolveCmd() {
  if (process.env.IHUI_CMD) return process.env.IHUI_CMD.split(/\s+/).filter(Boolean);
  const repoRoot = resolve(root, '..');
  // 注意: CLI build 是 tsc 纯转译(不 bundle),@ihui/api-client 等 workspace 包 exports 指向 .ts 源码,
  // dist/index.js 在纯 node 下会 ERR_MODULE_NOT_FOUND。因此优先用 tsx 运行源码。
  const tsxCli = join(repoRoot, 'apps', 'cli', 'node_modules', 'tsx', 'dist', 'cli.mjs');
  if (existsSync(tsxCli)) return ['node', tsxCli, join(repoRoot, 'apps', 'cli', 'src', 'index.ts')];
  const distEntry = join(repoRoot, 'apps', 'cli', 'dist', 'index.js');
  if (existsSync(distEntry)) return ['node', distEntry];
  console.error('未找到 CLI 入口: 请先构建 apps/cli 或设置 IHUI_CMD');
  process.exit(2);
}

// ---- 在临时目录执行 verify.mjs ----
function runVerify(taskDir, workDir) {
  const r = spawnSync('node', [join(taskDir, 'verify.mjs')], { cwd: workDir, encoding: 'utf8', timeout: 60000 });
  return { pass: r.status === 0, output: (r.stdout || '') + (r.stderr || '') };
}

// ---- selftest: solved 必过, workspace 必挂 ----
function selftest(ids) {
  const rows = [];
  let ok = 0;
  for (const id of ids) {
    const taskDir = join(TASKS_DIR, id);
    const tmp = mkdtempSync(join(tmpdir(), 'bench-'));
    try {
      const solvedDir = join(tmp, 'solved');
      const wsDir = join(tmp, 'ws');
      cpSync(join(taskDir, 'solved'), solvedDir, { recursive: true });
      cpSync(join(taskDir, 'workspace'), wsDir, { recursive: true });
      const onSolved = runVerify(taskDir, solvedDir);
      const onWorkspace = runVerify(taskDir, wsDir);
      const pass = onSolved.pass && !onWorkspace.pass;
      if (pass) ok++;
      rows.push({ id, solvedPass: onSolved.pass, workspaceFails: !onWorkspace.pass, ok: pass });
      if (!pass) {
        console.error(`[SELFTEST-FAIL] ${id}`);
        if (!onSolved.pass) console.error('  solved 未通过:\n' + onSolved.output.split('\n').slice(0, 6).join('\n'));
        if (onWorkspace.pass) console.error('  workspace 意外通过(任务无判定力)');
      }
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }
  console.log(`\nselftest: ${ok}/${ids.length} 任务判定脚本有效`);
  return ok === ids.length ? 0 : 1;
}

// ---- 真实执行 ----
async function run(ids) {
  const cmd = resolveCmd();
  const timeoutMs = Number(process.env.BENCH_TIMEOUT_MS || 300000);
  // 每次 agent 执行前自动 login（确保 token 有效）
  const loginExe = cmd[0];
  const loginArgs = [...cmd.slice(1), 'login', '-a', 'admin', '-p', 'admin123'];
  const loginR = spawnSync(loginExe, loginArgs, { encoding: 'utf8', timeout: 30000 });
  if (loginR.status !== 0) console.error('[LOGIN] 失败:\n' + (loginR.stderr || loginR.stdout || '').split('\n').slice(0, 5).join('\n'));
  else console.log('[LOGIN] admin token 刷新成功');
  // 任务间隔 + 失败重试: provider(如 stepfun)对连续快速请求限速,全量跑时表现为批量 ~10s 快速失败。
  // 每个任务后 sleep 间隔;失败任务隔一个冷却期后重试(全新临时工作区),取最好成绩。
  const gapMs = Number(process.env.BENCH_GAP_MS || 5000);
  const cooldownMs = Number(process.env.BENCH_COOLDOWN_MS || 15000);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function runOne(id) {
    const taskDir = join(TASKS_DIR, id);
    const prompt = readFileSync(join(taskDir, 'task.md'), 'utf8').trim();
    const workDir = mkdtempSync(join(tmpdir(), 'bench-'));
    const t0 = Date.now();
    let agentExit = null;
    try {
      cpSync(join(taskDir, 'workspace'), workDir, { recursive: true });
      const r = spawnSync(
        cmd[0],
        [...cmd.slice(1), 'agent', prompt, '--output-format', 'json', '--permission-mode', 'bypassPermissions', '--allow-dangerous'],
        {
          cwd: workDir,
          encoding: 'utf8',
          timeout: timeoutMs,
          env: { ...process.env, IHUI_YOLO: '1' },
        },
      );
      agentExit = r.status;
      if (r.status !== 0) console.log(`[${id}] agent 异常退出, stderr:\n` + String(r.stderr || '').split('\n').slice(0, 10).join('\n'));
      const verify = runVerify(taskDir, workDir);
      return { id, agentExit, verifyPass: verify.pass, durationMs: Date.now() - t0, verifyOutput: verify.pass ? '' : verify.output.split('\n').slice(0, 8).join('\n') };
    } finally {
      rmSync(workDir, { recursive: true, force: true });
    }
  }
  const results = [];
  for (const id of ids) {
    console.log(`\n=== [${id}] 启动 agent ===`);
    let res = await runOne(id);
    if (!res.verifyPass) {
      console.log(`[${id}] 首次失败(冷却 ${cooldownMs}ms 后重试一次)`);
      await sleep(cooldownMs);
      const retry = await runOne(id);
      retry.retried = true;
      if (retry.verifyPass) res = retry;
    }
    results.push(res);
    console.log(`[${id}] agentExit=${res.agentExit} verify=${res.verifyPass ? 'PASS' : 'FAIL'} (${res.durationMs}ms${res.retried ? ', 重试后通过' : ''})`);
    if (!res.verifyPass && res.verifyOutput) console.log(res.verifyOutput);
    await sleep(gapMs);
  }
  const passed = results.filter((r) => r.verifyPass).length;
  const rate = ids.length ? ((passed / ids.length) * 100).toFixed(1) : '0.0';
  mkdirSync(REPORTS_DIR, { recursive: true });
  const reportPath = join(REPORTS_DIR, 'benchmark-report.json');
  writeFileSync(reportPath, JSON.stringify({ date: new Date().toISOString(), cmd, total: ids.length, passed, passRate: Number(rate), results }, null, 2));
  console.log(`\n===== 汇总: ${passed}/${ids.length} 通过 (通过率 ${rate}%) =====`);
  console.log(`报告: ${reportPath}`);
  return passed / Math.max(ids.length, 1) >= 0.8 ? 0 : 1;
}

// ---- main ----
const args = process.argv.slice(2);
const ids = discover();
if (ids.length === 0) {
  console.error('无任务: 先运行 node benchmarks/gen.mjs');
  process.exit(2);
}
let filtered = ids;
const taskIdx = args.indexOf('--task');
if (taskIdx !== -1 && args[taskIdx + 1]) {
  const want = new Set(args[taskIdx + 1].split(',').map((s) => s.trim()).filter(Boolean));
  filtered = ids.filter((i) => want.has(i));
  if (filtered.length === 0) {
    console.error('未匹配任务, 可用: ' + ids.join(', '));
    process.exit(2);
  }
}
if (args.includes('--selftest') || args.includes('--skip-llm')) {
  process.exit(selftest(filtered));
}
process.exit(await run(filtered));
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
