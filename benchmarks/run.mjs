#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// benchmark runner
// 用法:
//   node benchmarks/run.mjs --selftest          验证判定脚本: solved 必过 + workspace 必挂
//   node benchmarks/run.mjs --skip-llm          同 --selftest
//   node benchmarks/run.mjs [--task id1,id2]    真实执行 CLI agent 并判定, 汇总通过率
// 环境变量:
//   IHUI_CMD           自定义 CLI 命令(空格分隔, 如 "node g:/x/dist/index.js")
//   BENCH_TIMEOUT_MS   单任务 agent 超时(默认 300000)。超时杀掉子进程树。
//   BENCH_TRIALS       每任务重复次数(默认 1)。报告保留每一次成败，不折叠成 best-of-N。
//   BENCH_MODEL        agent 模型(如 agnes/agnes-2.5-flash),缺省用 CLI 默认模型
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnCaptured } from './lib/proc-tree.mjs';
import { assembleReport, exitCodeForPassRate, gateLogin, parseTrialCount } from './lib/report.mjs';

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
async function runVerify(taskDir, workDir) {
  const r = await spawnCaptured(process.execPath, [join(taskDir, 'verify.mjs')], { cwd: workDir, timeout: 60000 });
  return { pass: r.status === 0, output: (r.stdout || '') + (r.stderr || '') };
}

// ---- selftest: solved 必过, workspace 必挂 ----
async function selftest(ids) {
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
      const onSolved = await runVerify(taskDir, solvedDir);
      const onWorkspace = await runVerify(taskDir, wsDir);
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
  // 每次 agent 执行前自动 login（确保 token 有效;密码经 BENCH_ADMIN_PASSWORD 注入,不入仓库）
  const benchPwd = process.env.BENCH_ADMIN_PASSWORD;
  if (!benchPwd) { console.error('[LOGIN] 缺少 BENCH_ADMIN_PASSWORD'); process.exit(1); }
  const trialsParsed = parseTrialCount(process.env.BENCH_TRIALS);
  if (!trialsParsed.ok) {
    console.error(trialsParsed.error);
    return 2;
  }
  const trialCount = trialsParsed.value;
  const loginExe = cmd[0];
  const loginArgs = [...cmd.slice(1), 'login', '-a', 'admin', '-p', benchPwd];
  const loginR = await spawnCaptured(loginExe, loginArgs, { timeout: 30000 });
  const loginGate = gateLogin(loginR.status);
  if (loginGate.abort) {
    const detail = (loginR.stderr || loginR.stdout || loginR.error?.message || '').split('\n').slice(0, 5).join('\n');
    console.error('[LOGIN] 失败 status=' + String(loginR.status) + (detail ? '\n' + detail : ''));
    return loginGate.code;
  }
  console.log('[LOGIN] admin token 刷新成功');
  // 任务间隔。重复次数由 BENCH_TRIALS 决定，每一次都写入报告；失败不会被后一次成功替换掉。
  const gapMs = Number(process.env.BENCH_GAP_MS || 5000);
  const cooldownMs = Number(process.env.BENCH_COOLDOWN_MS || 15000);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function runOne(id) {
    const taskDir = join(TASKS_DIR, id);
    const prompt = readFileSync(join(taskDir, 'task.md'), 'utf8').trim();
    const workDir = mkdtempSync(join(tmpdir(), 'bench-'));
    try {
      const prepStart = Date.now();
      cpSync(join(taskDir, 'workspace'), workDir, { recursive: true });
      const prepMs = Date.now() - prepStart;
      // BENCH_MODEL: 指定 agent 模型(如 agnes/agnes-2.5-flash)。IHUI_DEFAULT_MODEL 环境变量
      // 在一次性 agent 命令路径不生效(settings.json defaultModel 优先),故显式传 -m。
      const modelArgs = process.env.BENCH_MODEL ? ['-m', process.env.BENCH_MODEL] : [];
      const agentStart = Date.now();
      const r = await spawnCaptured(
        cmd[0],
        [...cmd.slice(1), 'agent', prompt, ...modelArgs, '--output-format', 'json', '--permission-mode', 'bypassPermissions', '--allow-dangerous'],
        {
          cwd: workDir,
          timeout: timeoutMs,
          env: { ...process.env, IHUI_YOLO: '1' },
        },
      );
      const agentMs = Date.now() - agentStart;
      if (r.status !== 0) console.log(`[${id}] agent 异常退出, stderr:\n` + String(r.stderr || '').split('\n').slice(0, 10).join('\n'));
      const verifyStart = Date.now();
      const verify = await runVerify(taskDir, workDir);
      const verifyMs = Date.now() - verifyStart;
      return {
        agentExit: r.status,
        verifyPass: verify.pass,
        prepMs,
        agentMs,
        verifyMs,
        verifyOutput: verify.pass ? '' : verify.output.split('\n').slice(0, 8).join('\n'),
      };
    } finally {
      rmSync(workDir, { recursive: true, force: true });
    }
  }
  const taskRuns = [];
  for (const id of ids) {
    const trials = [];
    for (let attempt = 1; attempt <= trialCount; attempt += 1) {
      if (attempt > 1) {
        const prevFailed = !trials[trials.length - 1].verifyPass;
        await sleep(prevFailed ? Math.max(gapMs, cooldownMs) : gapMs);
      }
      console.log(`\n=== [${id}] 试验 ${attempt}/${trialCount} ===`);
      const trial = await runOne(id);
      trials.push(trial);
      console.log(
        `[${id}] 第${attempt}次 agentExit=${trial.agentExit} verify=${trial.verifyPass ? 'PASS' : 'FAIL'} agent=${trial.agentMs}ms prep=${trial.prepMs}ms verifyTime=${trial.verifyMs}ms`,
      );
      if (!trial.verifyPass && trial.verifyOutput) console.log(trial.verifyOutput);
    }
    const passCount = trials.filter((trial) => trial.verifyPass).length;
    const failCount = trials.length - passCount;
    console.log(`[${id}] 成功 ${passCount} 次 / 失败 ${failCount} 次`);
    taskRuns.push({ id, trials });
    await sleep(gapMs);
  }
  const report = assembleReport({ date: new Date().toISOString(), cmd, taskRuns });
  mkdirSync(REPORTS_DIR, { recursive: true });
  const reportPath = join(REPORTS_DIR, 'benchmark-report.json');
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n===== 汇总: ${report.trialPassed}/${report.trialTotal} 次试验通过 (通过率 ${report.passRate}%) =====`);
  console.log(`报告: ${reportPath}`);
  return exitCodeForPassRate(report.passRate);
}

// ---- main ----
async function main() {
  const args = process.argv.slice(2);
  const ids = discover();
  if (ids.length === 0) {
    console.error('无任务: 先运行 node benchmarks/gen.mjs');
    return 2;
  }
  let filtered = ids;
  const taskIdx = args.indexOf('--task');
  if (taskIdx !== -1 && args[taskIdx + 1]) {
    const want = new Set(args[taskIdx + 1].split(',').map((s) => s.trim()).filter(Boolean));
    filtered = ids.filter((i) => want.has(i));
    if (filtered.length === 0) {
      console.error('未匹配任务, 可用: ' + ids.join(', '));
      return 2;
    }
  }
  if (args.includes('--selftest') || args.includes('--skip-llm')) return selftest(filtered);
  return run(filtered);
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  main()
    .then((code) => process.exit(code))
    .catch((error) => {
      console.error(error?.stack || error?.message || error);
      process.exit(2);
    });
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
