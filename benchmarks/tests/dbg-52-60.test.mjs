// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { strict as assert } from 'node:assert';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import test from 'node:test';

import { generateOwnedTasks, tasks } from '../gen.mjs';
import { judgeExtractDry, judgeRenameDry } from '../lib/dry-judge.mjs';
import { alivePid, killProcessTree, spawnCaptured } from '../lib/proc-tree.mjs';
import { probePython, pythonCandidatesFrom, resolvePinnedPython } from '../lib/python-pin.mjs';
import { assembleReport, gateLogin, parseTrialCount } from '../lib/report.mjs';
import { judgeWrittenTests, utilsBehaviorMismatches } from '../lib/test-author-judge.mjs';
import { mkScratch, rmScratch } from '../../scripts/lib/scratch-dir.mjs';

const benchRoot = fileURLToPath(new URL('..', import.meta.url));
const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

function readTask(id, side, name) {
  return readFileSync(join(benchRoot, 'tasks', id, side, name), 'utf8');
}

test('DBG-52 生成器只删自己的目录，README 任务数与数组一致', () => {
  const genSrc = readFileSync(join(benchRoot, 'gen.mjs'), 'utf8');
  assert.equal(genSrc.includes('rmSync(TASKS_DIR'), false);
  const readme = readFileSync(join(benchRoot, 'README.md'), 'utf8');
  const matched = readme.match(/生成器定义 \*\*(\d+)\*\* 个任务/);
  assert.ok(matched, 'README 应写明生成器任务数');
  assert.equal(Number(matched[1]), tasks.length);
  assert.equal(tasks.length, 20);

  const dir = mkScratch('bench-gen-');
  try {
    const tasksDir = join(dir, 'tasks');
    mkdirSync(join(tasksDir, '21-hand'), { recursive: true });
    writeFileSync(join(tasksDir, '21-hand', 'keep.txt'), 'stay');
    mkdirSync(join(tasksDir, '01-fix-sum-off-by-one'), { recursive: true });
    writeFileSync(join(tasksDir, '01-fix-sum-off-by-one', 'old.txt'), 'gone');
    const result = generateOwnedTasks(tasksDir, tasks);
    assert.equal(existsSync(join(tasksDir, '21-hand', 'keep.txt')), true);
    assert.equal(existsSync(join(tasksDir, '01-fix-sum-off-by-one', 'old.txt')), false);
    assert.equal(existsSync(join(tasksDir, '01-fix-sum-off-by-one', 'verify.mjs')), true);
    assert.equal(result.generated, 20);
    assert.ok(result.preserved.includes('21-hand'));
    assert.equal(result.removed.includes('21-hand'), false);
  } finally {
    rmScratch(dir);
  }
});

test('DBG-53/54/55 报告保留首次失败、写出成败次数，且 durationMs 不含准备和校验', () => {
  assert.deepEqual(parseTrialCount(undefined), { ok: true, value: 1 });
  assert.deepEqual(parseTrialCount('3'), { ok: true, value: 3 });
  assert.equal(parseTrialCount('0').ok, false);
  assert.equal(parseTrialCount('1.5').ok, false);
  const report = assembleReport({
    date: '2026-11-10T00:00:00.000Z',
    cmd: ['node', 'fake'],
    taskRuns: [
      {
        id: 'sample',
        trials: [
          { verifyPass: false, agentExit: 1, prepMs: 40, agentMs: 10, verifyMs: 30, verifyOutput: 'first failed' },
          { verifyPass: true, agentExit: 0, prepMs: 41, agentMs: 12, verifyMs: 31, verifyOutput: 'should hide' },
        ],
      },
    ],
  });
  assert.equal(report.results[0].trials.length, 2);
  assert.equal(report.results[0].trials[0].verifyPass, false);
  assert.equal(report.results[0].trials[0].verifyOutput, 'first failed');
  assert.equal(report.results[0].trials[1].verifyPass, true);
  assert.equal(report.results[0].passCount, 1);
  assert.equal(report.results[0].failCount, 1);
  assert.equal(report.trialPassed, 1);
  assert.equal(report.trialTotal, 2);
  assert.equal(report.passRate, 50);
  assert.equal(report.results[0].trials[0].durationMs, 10);
  assert.equal(report.results[0].trials[0].prepMs, 40);
  assert.equal(report.results[0].trials[0].verifyMs, 30);
  assert.equal(Object.hasOwn(report.results[0], 'verifyPass'), false);
  assert.equal(/confidence|置信区间|stddev|ci95/i.test(JSON.stringify(report)), false);
});

test('DBG-56 恒真断言失败，参考测试与真实函数行为通过', async () => {
  const solved = readTask('19-write-tests', 'solved', 'utils.test.mjs');
  const judged = judgeWrittenTests(solved);
  assert.equal(judged.ok, true, judged.reason);
  const tautology = `import { strict as assert } from "node:assert";\n${'assert.equal(1, 1);\n'.repeat(6)}`;
  const taut = judgeWrittenTests(tautology);
  assert.equal(taut.ok, false);
  assert.match(taut.reason, /恒真/);
  const sameCall = `import { strict as assert } from "node:assert";
import { capitalize, isBlank, countVowels } from "./utils.mjs";
assert.equal(capitalize("hello"), capitalize("hello"));
assert.equal(isBlank("a"), isBlank("a"));
assert.equal(countVowels("a"), countVowels("a"));
assert.ok(true);
assert.ok(true);
assert.ok(true);
`;
  assert.equal(judgeWrittenTests(sameCall).ok, false);
  const utils = await import(pathToFileURL(join(benchRoot, 'tasks', '19-write-tests', 'workspace', 'utils.mjs')).href);
  assert.deepEqual(utilsBehaviorMismatches(utils), []);
  const broken = utilsBehaviorMismatches({
    capitalize: () => 'no',
    isBlank: () => true,
    countVowels: () => 1,
  });
  assert.ok(broken.length > 0);
});

test('DBG-57 解释器版本不符就点名失败，不改用下一个大版本', () => {
  const calls = [];
  const wrong = resolvePinnedPython(['py311', 'py312'], (candidate) => {
    calls.push(candidate);
    if (candidate === 'py311') return { status: 0, stdout: '3.11.2\n', stderr: '' };
    return { status: 0, stdout: '3.12.1\n', stderr: '' };
  });
  assert.equal(wrong.ok, false);
  assert.match(wrong.message, /py311/);
  assert.match(wrong.message, /3\.11\.2/);
  assert.match(wrong.message, /3\.12/);
  assert.deepEqual(calls, ['py311']);

  const skipped = resolvePinnedPython(['missing', 'ok312'], (candidate) => {
    if (candidate === 'missing') return { status: 1, stdout: '', stderr: 'not found' };
    return { status: 0, stdout: '3.12.10', stderr: '' };
  });
  assert.equal(skipped.ok, true);
  assert.equal(skipped.python, 'ok312');

  const verifyUrl = pathToFileURL(join(benchRoot, 'tasks', '08-py-fix-fizzbuzz', 'verify.mjs')).href;
  const resolved = resolvePinnedPython(pythonCandidatesFrom(verifyUrl, {}), probePython);
  assert.equal(resolved.ok, true, resolved.message);
  assert.match(resolved.version, /^3\.12\./);
});

test('DBG-58 超时杀掉子进程树', async () => {
  const dir = mkScratch('bench-kill-');
  try {
    const childScript = join(dir, 'child.mjs');
    const parentScript = join(dir, 'parent.mjs');
    writeFileSync(childScript, 'setInterval(() => {}, 1000);\n');
    writeFileSync(
      parentScript,
      [
        "import { spawn } from 'node:child_process';",
        'const child = spawn(process.execPath, [process.argv[2]], { windowsHide: true, stdio: "ignore" });',
        "process.stdout.write(JSON.stringify({ child: child.pid }) + '\\n');",
        'setInterval(() => {}, 1000);',
        '',
      ].join('\n'),
    );
    const result = await spawnCaptured(process.execPath, [parentScript, childScript], { timeout: 2500 });
    assert.equal(result.timedOut, true);
    const line = result.stdout.trim().split(/\r?\n/).filter(Boolean).pop();
    assert.ok(line, `父进程没有写出子 pid: ${result.stderr}`);
    const info = JSON.parse(line);
    let parentDead = false;
    let childDead = false;
    const deadline = Date.now() + 3000;
    while (Date.now() < deadline) {
      parentDead = !alivePid(result.pid);
      childDead = !alivePid(info.child);
      if (parentDead && childDead) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (!parentDead || !childDead) {
      killProcessTree({ pid: result.pid, exitCode: null, signalCode: null, kill() {} });
      killProcessTree({ pid: info.child, exitCode: null, signalCode: null, kill() {} });
    }
    assert.equal(parentDead, true, `父进程 ${result.pid} 仍在`);
    assert.equal(childDead, true, `子进程 ${info.child} 仍在`);
  } finally {
    rmScratch(dir);
  }
});

test('DBG-59 登录失败立即非零退出', async () => {
  const dir = mkScratch('bench-login-');
  try {
    const fake = join(dir, 'fake-cli.mjs');
    writeFileSync(fake, "process.stderr.write('login-rejected\\n'); process.exit(3);\n");
    assert.equal(fake.includes(' '), false, `夹具路径含空格，IHUI_CMD 无法拆分: ${fake}`);
    const reportPath = join(benchRoot, 'reports', 'benchmark-report.json');
    const before = existsSync(reportPath) ? statSync(reportPath).mtimeMs : null;
    const child = spawn(process.execPath, [join(benchRoot, 'run.mjs'), '--task', '01-fix-sum-off-by-one'], {
      cwd: repoRoot,
      windowsHide: true,
      env: {
        ...process.env,
        IHUI_CMD: `node ${fake}`,
        BENCH_ADMIN_PASSWORD: 'not-a-real-password',
      },
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    const code = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        killProcessTree(child);
        reject(new Error(`登录失败路径超时\n${stdout}\n${stderr}`));
      }, 20000);
      child.on('close', (status) => {
        clearTimeout(timer);
        resolve(status);
      });
      child.on('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
    const combined = `${stdout}\n${stderr}`;
    assert.equal(code, 1, combined);
    assert.match(combined, /\[LOGIN\] 失败/);
    assert.equal(combined.includes('试验'), false, combined);
    assert.equal(combined.includes('汇总'), false, combined);
    const after = existsSync(reportPath) ? statSync(reportPath).mtimeMs : null;
    assert.equal(after, before);
    assert.deepEqual(gateLogin(0), { abort: false, code: 0 });
    assert.deepEqual(gateLogin(3), { abort: true, code: 1 });
    assert.deepEqual(gateLogin(null), { abort: true, code: 1 });
  } finally {
    rmScratch(dir);
  }
});

test('DBG-60 有 import 字符串但留着重复实现不得通过', () => {
  const muSolved = readTask('16-multi-rename', 'solved', 'mathUtils.mjs');
  const appSolved = readTask('16-multi-rename', 'solved', 'app.mjs');
  const renamed = judgeRenameDry(muSolved, appSolved);
  assert.equal(renamed.ok, true, renamed.reason);
  const muWorkspace = readTask('16-multi-rename', 'workspace', 'mathUtils.mjs');
  const appWorkspace = readTask('16-multi-rename', 'workspace', 'app.mjs');
  assert.equal(judgeRenameDry(muWorkspace, appWorkspace).ok, false);
  const cheatAdd = [
    'import { sum } from "./mathUtils.mjs";',
    'function plus(a, b) { return a + b; }',
    'export function total(a, b, c) { return plus(a, plus(b, c)); }',
    '',
  ].join('\n');
  const cheat = judgeRenameDry(muSolved, cheatAdd);
  assert.equal(cheat.ok, false);
  assert.match(cheat.reason, /重复/);

  const aSolved = readTask('17-multi-extract', 'solved', 'a.mjs');
  const bSolved = readTask('17-multi-extract', 'solved', 'b.mjs');
  const extracted = judgeExtractDry(aSolved, bSolved);
  assert.equal(extracted.ok, true, extracted.reason);
  const aWorkspace = readTask('17-multi-extract', 'workspace', 'a.mjs');
  const bWorkspace = readTask('17-multi-extract', 'workspace', 'b.mjs');
  assert.equal(judgeExtractDry(aWorkspace, bWorkspace).ok, false);
  const commented = [
    '// import { slugify } from "./shared.mjs"',
    'export function slugify(s) {',
    '  return s.toLowerCase().trim().replace(/\\s+/g, "-");',
    '}',
    '',
  ].join('\n');
  assert.equal(judgeExtractDry(commented, commented).ok, false);
  const stringOnly = [
    'const text = "import { slugify } from \'./shared.mjs\'";',
    'export function slugify(s) {',
    '  return s.toLowerCase().trim().replace(/\\s+/g, "-");',
    '}',
    '',
  ].join('\n');
  assert.equal(judgeExtractDry(stringOnly, stringOnly).ok, false);
  const keptImpl = [
    'import { slugify } from "./shared.mjs";',
    'export function slugify(s) {',
    '  return s.toLowerCase().trim().replace(/\\s+/g, "-");',
    '}',
    '',
  ].join('\n');
  const kept = judgeExtractDry(keptImpl, keptImpl);
  assert.equal(kept.ok, false);
  assert.match(kept.reason, /重复|仍定义/);
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
