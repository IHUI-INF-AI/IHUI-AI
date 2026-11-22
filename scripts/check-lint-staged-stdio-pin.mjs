#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 本工具是只读盯针门,机器读数必须走 stdout */
/**
 * check-lint-staged-stdio-pin — lint-staged stdio 三针的只读盯针门(2026-10-27 立，票「lint-staged stdio 三针补丁打在 node_modules 内,重装依赖即失效且无人盯」出路②的门本体;接线归主席,本文件不接提交链)。
 *
 * 病理:scripts/lib/patch-lint-staged-stdio.mjs 的三针(execGit.js 的 replace-nodeOptions 与
 * inject-giterr-visible、getSpawnedTask.js 的 inject-tinyExecOptions)注在 node_modules 里。
 * postinstall 不重打、无任何守门盯针 ⇒ 一次重装依赖就把 G-53/G-63 刚消解的 lint-staged 死法
 * 放回原状,且**失效方向是安静的**(钩子照样跑,只在下次提交时以 errno 面目复现)。
 *
 * 判据单一真相源(§0.6):本器**不实现任何"针在不在"的判断**——判据唯一实现住在
 * patch-lint-staged-stdio.mjs 的 `--check` 档里(其顶层直接执行、无导出,import 会当场跑它的
 * 主流程并 process.exit,故只能 spawn、不能 import)。本器只 spawn 它一次、把它的
 * rc/输出翻成三档退出码。想改判据请改那个脚本,不要在这里抄第二份。
 * (夹具里出现的上游原始形态字符串是"未打针的文件素材",不是判据;它与生产脚本脱节时
 * 夹具在 apply 档当场抛错、自检翻红——失效方向 = 多要一次说明,不是静默放行,§0.10。)
 *
 * 三档退出码(§0.3:没判不许写成判过,也不许冒红):
 *  - 0 green        判据脚本产出了一针或多针读数,且全部 ALREADY-PATCHED(针齐);
 *  - 1 gap          产出读数里有 NEEDS-PATCH(逐条点名 file+mode);
 *  - 2 undetermined 取不到输入 ⇒ 显式「未判定」并点名原因,不记绿也不冒红:
 *      · 判据脚本本身读不到(源脚本缺失/被挪走);
 *      · lint-staged 安装副本缺失(node_modules 不在 / 依赖没装 / 版本目录漂移 ⇒ 子进程 rc=2 MISSING);
 *      · 子进程崩溃或一枚针都没枚举出来(判据跑死 ⇒ 枚举到 0 个候选判死不记绿);
 *      · rc 与读数互相矛盾(如 rc≠0 却报全齐)。
 *
 * 用法:node scripts/check-lint-staged-stdio-pin.mjs [--patch-script <path>] [--self-test]
 *   --patch-script 仅供夹具/自检覆盖判据脚本落点;默认取仓内 scripts/lib/patch-lint-staged-stdio.mjs。
 *   派生进程的 ROOT 由判据脚本**自身位置**推导(§15 禁 cwd 定根),故把生产脚本逐字节拷进
 *   <夹具>/scripts/lib/ 后,它读的就是 <夹具>/node_modules/... —— 测的是同一份生产判据,零复制。
 *
 * --self-test 变异证明(缺一条不算交付):
 *   ① 三针全打齐 ⇒ green;② 摘掉一针(还原 getSpawnedTask.js)⇒ gap 且恰好点到该针;
 *   ③ 摘掉 node_modules 里的安装目录 ⇒ undetermined(rc 2);④ 判据脚本不存在 ⇒ undetermined;
 *   ⑤ 子进程 rc=1 却无任何针读数(判据中途抛错)⇒ undetermined,不得读成 gap。
 *
 * 档位建议(交付说明同文):本门判的是**机器状态**(node_modules 里针的存续),不是提交内容
 * ⇒ 按 §12e 不得挂 blocking 进提交链(重装依赖后、有人跑 apply 重打前,它会把与本次提交无关
 * 的红天天推给提交者 ⇒ 恒红门 ⇒ 逼人 --no-verify)。正解 = 只读巡检/守护派发(同
 * check-gate-rot / check-temp-landing 一族的登记口径)。
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { mkScratch, rmScratch } from './lib/scratch-dir.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..');

/** 生产判据脚本的仓内唯一落点(路径事实,不是判据;票面上写的 scripts/ 根下是旧称,现读在 lib/ 下)。 */
export const PATCH_SCRIPT_REL = join('scripts', 'lib', 'patch-lint-staged-stdio.mjs');

/**
 * 解析 `--check` 的针读数行。形状(生产脚本逐针打印):
 *   `<file>.js <mode>: ALREADY-PATCHED` / `<file>.js <mode>: NEEDS-PATCH`
 * 只认这两种收尾;apply 档的 `: PATCHED` 行不该出现在 --check 输出里,出现也不计数(读数面从窄)。
 */
const PIN_LINE_RE = /^(\S+\.js)\s+(\S+): (ALREADY-PATCHED|NEEDS-PATCH)$/;

/** 从 stdout 抽针读数(纯函数,不依赖 spawn,镜像测试可直接喂构造面)。 */
export function parsePinLines(stdout) {
  const pins = [];
  for (const line of String(stdout ?? '').split(/\r?\n/)) {
    const m = line.match(PIN_LINE_RE);
    if (m) pins.push({ file: m[1], mode: m[2], state: m[3] });
  }
  return pins;
}

/**
 * 三档裁决(纯函数):输入 = 子进程 rc + stdout + stderr,输出 = { verdict, reason?, pins?, needs? }。
 * verdict ∈ 'green' | 'gap' | 'undetermined'。
 */
export function interpretCheckRun({ code, stdout = '', stderr = '' }) {
  const out = String(stdout ?? '');
  const err = String(stderr ?? '');
  const missingHit = /MISSING /.test(out) || /MISSING /.test(err);
  if (code === 2 || missingHit) {
    return {
      verdict: 'undetermined',
      reason: '读不到 lint-staged 安装副本(node_modules 不在 / 依赖没装 / 版本目录漂移)——未判定,不记绿也不冒红',
      rc: code,
    };
  }
  const pins = parsePinLines(out);
  if (pins.length === 0) {
    const firstErr = err
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find((l) => l.length > 0);
    return {
      verdict: 'undetermined',
      reason: `判据脚本没枚举出任何一针(rc=${code}${firstErr ? `;stderr 首行: ${firstErr}` : ''})——判据跑死/中途抛错,未判定,不得读成缺口也不得读成全齐`,
      rc: code,
    };
  }
  const needs = pins.filter((p) => p.state === 'NEEDS-PATCH');
  if (needs.length > 0) return { verdict: 'gap', pins, needs, rc: code };
  // 全 ALREADY-PATCHED:还要求 rc 与收尾行同轮自证,否则是"读数齐但进程不认账"的矛盾态。
  if (code !== 0) {
    return { verdict: 'undetermined', reason: `针读数全齐但子进程 rc=${code},读数与退出码矛盾——未判定`, rc: code };
  }
  if (!out.includes('check done')) {
    return { verdict: 'undetermined', reason: `子进程 rc=0 但输出缺收尾行「check done」(判据未跑完整轮)——未判定`, rc: code };
  }
  return { verdict: 'green', pins, rc: code };
}

/** spawn 生产判据脚本的 --check 档并裁决(唯一取判据通道;§12g 显式 stdio,§5b windowsHide)。 */
export function runPinCheck({ scriptPath } = {}) {
  const p = scriptPath ?? join(REPO_ROOT, PATCH_SCRIPT_REL);
  if (!existsSync(p)) {
    return { verdict: 'undetermined', reason: `读不到盯针判据脚本: ${p}(源脚本缺失/被挪走 ⇒ 本器无判据可借,未判定)`, scriptPath: p };
  }
  const r = spawnSync(process.execPath, [p, '--check'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  if (r.error) {
    return { verdict: 'undetermined', reason: `无法派生判据脚本进程: ${r.error.message}——未判定`, scriptPath: p };
  }
  return { ...interpretCheckRun({ code: r.status, stdout: r.stdout, stderr: r.stderr }), scriptPath: p };
}

/**
 * 夹具素材:未打针的上游原始形态(逐字节不含任何 stdio 注针、不含 GITERR 标记)。
 * 这是构造"针未打"状态的**文件素材**;三针的判据仍在生产脚本里(本文件的任何函数都不判针)。
 * 生产脚本的 needle 与本素材脱节时,apply 档当场抛错 ⇒ 自检/gap 用例翻红点名,不会静默绿。
 */
export function pristineExecGit() {
  return [
    "import { exec } from 'tinyexec'",
    '',
    'export const execGit = async (cmd, options) => {',
    '  const result = await exec("git", cmd, {',
    '    nodeOptions: {',
    '      env: options?.env,',
    '      cwd: options?.cwd,',
    '    },',
    '  })',
    '',
    '  if (result.exitCode > 0) {',
    '    throw new Error(result.stderr.trimEnd(), { cause: result })',
    '  }',
    '',
    '  return result.stdout.trimEnd()',
    '}',
    '',
  ].join('\n');
}

export function pristineGetSpawnedTask() {
  return [
    "import { exec } from 'tinyexec'",
    '',
    'export function getSpawnedTask(command, args, ctx) {',
    '  const tinyExecOptions = {',
    '    throwOnError: false,',
    '  }',
    '  return exec(command, args, { cwd: process.cwd(), ...tinyExecOptions })',
    '}',
    '',
  ].join('\n');
}

/** 夹具的 lint-staged 安装落点(必须与生产脚本自身的 LINT_DIR 同形;脱节 ⇒ 子进程 MISSING ⇒ 自检翻红点名)。 */
export const FIXTURE_LINT_LIB_REL = join('node_modules', '.pnpm', 'lint-staged@17.3.0', 'node_modules', 'lint-staged', 'lib');

/**
 * 在 dir 里搭一个"伪仓"夹具:生产判据脚本**逐字节拷贝**到 <dir>/scripts/lib/(其 ROOT 由脚本
 * 自身位置推导 ⇒ 射程自动落到 <dir>/node_modules),并铺上未打针的两个源文件。
 * 返回 { scriptPath, libDir } 供 runPinCheck({ scriptPath }) 使用。
 */
export function buildPinFixture(dir) {
  const real = join(REPO_ROOT, PATCH_SCRIPT_REL);
  if (!existsSync(real)) throw new Error(`夹具构建失败:生产判据脚本不存在 ${real}`);
  const scriptPath = join(dir, PATCH_SCRIPT_REL);
  mkdirSync(dirname(scriptPath), { recursive: true });
  writeFileSync(scriptPath, readFileSync(real)); // Buffer 原样落盘 ⇒ 与生产判据逐字节同形
  const libDir = join(dir, FIXTURE_LINT_LIB_REL);
  mkdirSync(libDir, { recursive: true });
  writeFileSync(join(libDir, 'execGit.js'), pristineExecGit(), 'utf8');
  writeFileSync(join(libDir, 'getSpawnedTask.js'), pristineGetSpawnedTask(), 'utf8');
  return { scriptPath, libDir };
}

/** 夹具 apply 档:直接跑生产脚本(不带 --check)把三针打满。返回子进程 rc。 */
export function applyFixturePins(scriptPath) {
  const r = spawnSync(process.execPath, [scriptPath], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  return r.error ? `spawn-error:${r.error.message}` : r.status;
}

/** 退出码映射(三档;新增 verdict 取值必须显式落档,不许静默 0)。 */
export function exitCodeOf(verdict) {
  if (verdict === 'green') return 0;
  if (verdict === 'gap') return 1;
  return 2;
}

async function selfTest() {
  let pass = 0;
  let fail = 0;
  const check = (name, cond, extra = '') => {
    if (cond) {
      pass++;
      console.log(`  ✔ ${name}`);
    } else {
      fail++;
      console.log(`  ✖ ${name}${extra ? ` —— ${extra}` : ''}`);
    }
  };

  // ⑤(纯构造面)rc=1 却无任何针读数 ⇒ 判据中途抛错,是未判定不是缺口
  const crashed = interpretCheckRun({ code: 1, stdout: '', stderr: 'Error: nodeOptions marker not found' });
  check('⑤ 判据跑死(rc=1 零读数)⇒ undetermined,不冒充 gap', crashed.verdict === 'undetermined', JSON.stringify(crashed));
  const contradicted = interpretCheckRun({ code: 3, stdout: 'execGit.js replace-nodeOptions: ALREADY-PATCHED\ncheck done\n', stderr: '' });
  check('⑤b 读数齐但 rc 非 0(矛盾态)⇒ undetermined', contradicted.verdict === 'undetermined', JSON.stringify(contradicted));

  // 真夹具三条硬证明(摘一针必红 / 三针齐必绿 / 缺 node_modules 必 exit 2)
  const dir = mkScratch('lint-staged-pin-selftest-');
  try {
    const { scriptPath, libDir } = buildPinFixture(dir);
    // 前置:未打针的夹具起步 ⇒ 三针全 NEEDS-PATCH ⇒ gap
    const before = runPinCheck({ scriptPath });
    check('夹具起步(零针)⇒ gap 且三针全点名', before.verdict === 'gap' && (before.needs || []).length === 3, JSON.stringify(before));
    // 用生产脚本自身把三针打满(apply 档 rc=0)
    check('夹具 apply 档 rc=0(三针注满)', applyFixturePins(scriptPath) === 0);
    const green = runPinCheck({ scriptPath });
    check('① 三针齐 ⇒ green', green.verdict === 'green', JSON.stringify(green));
    check('①b green 读数含收尾行自证(check done 已由裁决要求)', (green.pins || []).every((p) => p.state === 'ALREADY-PATCHED'));
    // ② 摘掉一针:还原 getSpawnedTask.js(execGit 两针不动 ⇒ 恰好少一针)
    writeFileSync(join(libDir, 'getSpawnedTask.js'), pristineGetSpawnedTask(), 'utf8');
    const gap = runPinCheck({ scriptPath });
    check(
      '② 摘掉一针 ⇒ gap 且只点名该针',
      gap.verdict === 'gap' && (gap.needs || []).length === 1 && gap.needs[0].mode === 'inject-tinyExecOptions' && gap.needs[0].file === 'getSpawnedTask.js',
      JSON.stringify(gap),
    );
    // 复原三针齐(为③留一个"针本来齐"的现场)
    applyFixturePins(scriptPath);
    check('③ 前置:复原后仍 green', runPinCheck({ scriptPath }).verdict === 'green');
    // ③ 缺 node_modules(重装依赖把安装副本洗掉的形态)⇒ 未判定 exit 2,不记绿也不冒红
    rmSync(libDir, { recursive: true, force: true });
    const missing = runPinCheck({ scriptPath });
    check('③ 缺 node_modules 安装副本 ⇒ undetermined(对应本器 exit 2)', missing.verdict === 'undetermined', JSON.stringify(missing));
    // ④ 判据脚本本身读不到 ⇒ 未判定并点名
    rmSync(scriptPath, { force: true });
    const noScript = runPinCheck({ scriptPath });
    check('④ 判据脚本缺失 ⇒ undetermined', noScript.verdict === 'undetermined', JSON.stringify(noScript));
    // 形状锁:夹具脚本必须与生产脚本逐字节同形(证明"测的就是装车的那份判据")
    const rebuilt = buildPinFixture(join(dir, 'hash-check'));
    const sameBytes = readFileSync(rebuilt.scriptPath).equals(readFileSync(join(REPO_ROOT, PATCH_SCRIPT_REL)));
    check('夹具脚本与生产判据逐字节同形(零复制判据)', sameBytes);
  } finally {
    rmScratch(dir, { bestEffort: true });
  }

  console.log(`PIN-SELFTEST pass ${pass} / fail ${fail}`);
  return fail === 0 ? 0 : 1;
}

async function main(argv) {
  const args = argv.slice(2);
  if (args.includes('--self-test')) return selfTest();

  let scriptPath;
  const si = args.indexOf('--patch-script');
  if (si !== -1) {
    scriptPath = args[si + 1];
    if (!scriptPath) {
      console.log('PIN-CHECK-RESULT state=undetermined reason=--patch-script 后面没给路径——未判定');
      return 2;
    }
  }

  const r = runPinCheck({ scriptPath });
  for (const p of r.pins || []) console.log(`  针读数 ${p.file} ${p.mode}: ${p.state}`);
  if (r.verdict === 'green') {
    console.log(`PIN-CHECK-RESULT state=green pins=${(r.pins || []).length} script=${r.scriptPath}`);
  } else if (r.verdict === 'gap') {
    console.log(`PIN-CHECK-RESULT state=gap missing=${(r.needs || []).map((n) => `${n.file}:${n.mode}`).join(',')} script=${r.scriptPath}`);
    console.log('  出路:node scripts/lib/patch-lint-staged-stdio.mjs (apply 档重打三针);本门只读不修。');
  } else {
    console.log(`PIN-CHECK-RESULT state=undetermined reason=${r.reason} script=${r.scriptPath ?? '(默认落点)'}`);
  }
  return exitCodeOf(r.verdict);
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  main(process.argv)
    .then((code) => {
      process.exitCode = code;
    })
    .catch((e) => {
      console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`);
      process.exit(2);
    });
}

export const __test__ = {
  PATCH_SCRIPT_REL,
  FIXTURE_LINT_LIB_REL,
  parsePinLines,
  interpretCheckRun,
  runPinCheck,
  pristineExecGit,
  pristineGetSpawnedTask,
  buildPinFixture,
  applyFixturePins,
  exitCodeOf,
};
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
