// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// scripts/tests/dev-stack-launch-fallback.test.mjs — wscript 被安全策略拦截时的降级链镜像锁
//
// 立因(2026-10-31):本机安全中心把 wscript 列入 LOLBin 黑名单,spawn 不抛错、pid 文件
// 照写,但整条启动链静默不出进程 ⇒ 日志停在上一次内容,dev-stack 只报 start-timeout,
// hint 还把人往「服务自己起不来」上引(真实事故:本地 API 长期无人拉起,号池巡检停摆 7 天)。
//
// 本镜像直接 import 生产判据(§22c:禁止在测试里复制判据,否则两处各说各话),并锁:
//   · resolveLaunchMode 的强制/回落四象限 + 非法值回落;
//   · quoteWinArg 的输出形状(含空格/中文/空串/cmd 元字符/内嵌引号);
//   · 两条启动路径的实现形状(cmd.exe 只一处、绝不持日志 fd、cmd 跳必须非 detached +
//     windowsVerbatimArguments —— 这两条都是 2026-10-31 在本机实测撞出来的硬约束);
//   · dev-stack.mjs 的 killStale 白名单认 cmd.exe(否则降级形态的旧树永远杀不到)。
// import 本模块零副作用:dev-stack-launch.mjs 有 isDirectRun 守卫,不会真派生服务树。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { __test__ } from '../dev-stack-launch.mjs';
import { __test__ as stackTest } from '../dev-stack.mjs';

const { resolveLaunchMode, quoteWinArg, buildCmdInvocation, wroteSince, ENV_LAUNCH_MODE, PROBE_BUDGET_MS } = __test__;

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(path.resolve(HERE, '..', 'dev-stack-launch.mjs'), 'utf8');
const STACK_SRC = readFileSync(path.resolve(HERE, '..', 'dev-stack.mjs'), 'utf8');

// —— resolveLaunchMode:强制优先;未指定时默认 pipe(2026-10-31 判据变更) ——
// 依据:本机实测「stdio 用管道 ⇒ api 12s 就绪;重定向到文件 ⇒ 永久卡死」,
// 默认形态必须是 pipe;wscript/cmd 只在显式点名时回退可用。

test('resolveLaunchMode: 强制 cmd ⇒ cmd(即便 wscript 自检可用)', () => {
  assert.equal(resolveLaunchMode({ forced: 'cmd', wscriptUsable: true }), 'cmd');
});

test('resolveLaunchMode: 强制 wscript ⇒ wscript(即便自检判不可用,强制模式不降级)', () => {
  assert.equal(resolveLaunchMode({ forced: 'wscript', wscriptUsable: false }), 'wscript');
});

test('resolveLaunchMode: 强制 pipe 也认(默认形态当然可显式点名)', () => {
  assert.equal(resolveLaunchMode({ forced: 'pipe', wscriptUsable: false }), 'pipe');
});

test('resolveLaunchMode: 未指定 ⇒ pipe(与 wscript 可用性无关:文件 stdio 会卡死 api)', () => {
  assert.equal(resolveLaunchMode({ forced: undefined, wscriptUsable: true }), 'pipe');
  assert.equal(resolveLaunchMode({ wscriptUsable: true }), 'pipe');
  assert.equal(resolveLaunchMode({ forced: undefined, wscriptUsable: false }), 'pipe');
  assert.equal(resolveLaunchMode({ forced: '', wscriptUsable: false }), 'pipe');
});

test('resolveLaunchMode: 非法 forced 值回落 pipe(拼错不猜意图,也不掉进会卡死的旧链)', () => {
  assert.equal(resolveLaunchMode({ forced: 'powershell', wscriptUsable: true }), 'pipe');
  assert.equal(resolveLaunchMode({ forced: 'powershell', wscriptUsable: false }), 'pipe');
  assert.equal(resolveLaunchMode({ forced: 'CMDD', wscriptUsable: false }), 'pipe');
  // 大小写/首尾空白宽容 = 有效强制值
  assert.equal(resolveLaunchMode({ forced: ' CMD ', wscriptUsable: true }), 'cmd');
  assert.equal(resolveLaunchMode({ forced: 'WScript', wscriptUsable: false }), 'wscript');
});

// —— quoteWinArg:输出形状(恒 ASCII 直引号包裹) ——

test('quoteWinArg: 无空格参数也被引号包裹', () => {
  assert.equal(quoteWinArg('node.exe'), '"node.exe"');
});

test('quoteWinArg: 含空格路径整段进一对引号', () => {
  assert.equal(quoteWinArg('C:\\Program Files\\nodejs\\node.exe'), '"C:\\Program Files\\nodejs\\node.exe"');
});

test('quoteWinArg: 中文路径原样保留(只加引号,不做编码转换)', () => {
  assert.equal(quoteWinArg('G:\\项目\\apps\\api'), '"G:\\项目\\apps\\api"');
});

test('quoteWinArg: 空串 ⇒ ""(不加引号会被 cmd 当没这个参数吞掉)', () => {
  assert.equal(quoteWinArg(''), '""');
});

test('quoteWinArg: cmd 元字符 & ^ | < > 进引号即字面量', () => {
  assert.equal(quoteWinArg('a&b^c|d<e>f'), '"a&b^c|d<e>f"');
  assert.equal(quoteWinArg('a b&c'), '"a b&c"');
});

test('quoteWinArg: 内嵌 " 按 2n+1 转义,结尾 \\ 加倍(不吃闭合引号)', () => {
  assert.equal(quoteWinArg('say "hi"'), '"say \\"hi\\""');
  assert.equal(quoteWinArg('C:\\dir\\'), '"C:\\dir\\\\"');
});

// —— buildCmdInvocation:cmd /s /c 需要的最外层一对引号 ——

test('buildCmdInvocation: /s 形态 = ""exe" "arg" >> "out" 2>> "err""', () => {
  const line = buildCmdInvocation('C:\\n\\node.exe', ['-e', 'a b'], 'C:\\l\\out.log', 'C:\\l\\err.log');
  assert.equal(line, '""C:\\n\\node.exe" "-e" "a b" >> "C:\\l\\out.log" 2>> "C:\\l\\err.log""');
  assert.ok(line.startsWith('""') && line.endsWith('""'), '最外层必须恰好一对引号(/s 只剥这一对)');
  assert.equal(line.split('>>').length - 1, 2, 'stdout 与 stderr 各一条重定向');
  assert.equal((line.match(/2>>/g) || []).length, 1, 'stderr 必须是 2>>(追加),不能写成 2>');
});

// —— 源码形状锁 ——

test('形状锁:dev-stack-launch.mjs 恰好一处 spawn(\'cmd.exe\'(降级路径唯一)', () => {
  assert.equal((SRC.match(/spawn\('cmd\.exe'/g) || []).length, 1);
});

test('形状锁:日志 fd 只允许在 spawnPipeChain 内打开,且绝不塞进 spawn 的 stdio', () => {
  const pipeBody = SRC.match(/function spawnPipeChain\([\s\S]*?\n\}\n/)?.[0] ?? '';
  assert.ok(pipeBody, '源码中必须存在 spawnPipeChain(2026-10-31 起的默认形态)');
  const all = SRC.match(/openSync/g) || [];
  const inPipe = pipeBody.match(/openSync/g) || [];
  assert.equal(all.length, inPipe.length, 'openSync 只允许出现在 spawnPipeChain 内(wscript/cmd 两跳不得持 fd)');
  assert.equal(inPipe.length, 2, 'pipe 模式只开 out/err 两个日志句柄');
  // 关键:sspawn 的 stdio 必须是 'pipe' —— 把日志 fd 直接塞进 stdio 会复现
  // 「持 fd 派生整树必灭 / 日志恒 0 字节」的老坑(见文件头注)
  assert.match(pipeBody, /stdio: \['ignore', 'pipe', 'pipe'\]/, "pipe 模式必须用 'pipe' 而不是文件 fd");
  assert.ok(!/stdio:\s*\[[^\]]*outFd/.test(SRC), '禁止把日志 fd 塞进 spawn 的 stdio');
});

test('形状锁:两条路径的脱离/隐藏形态各自成立(wscript detached;cmd 非 detached + windowsHide)', () => {
  assert.equal((SRC.match(/detached: true/g) || []).length, 1, '只有 wscript 那一跳允许 detached');
  const wscriptBody = SRC.match(/function spawnWscriptChain\([\s\S]*?\n\}/)?.[0] ?? '';
  assert.ok(wscriptBody, '源码中必须存在 spawnWscriptChain');
  assert.ok(wscriptBody.includes('detached: true'), 'wscript 跳必须 detached(GUI 子系统,自身无控制台)');
  const cmdBody = SRC.match(/function spawnCmdChain\([\s\S]*?\n\}/)?.[0] ?? '';
  assert.ok(cmdBody, '源码中必须存在 spawnCmdChain');
  // 2026-10-31 实测:cmd 跳 detached ⇒ DETACHED_PROCESS ⇒ 子进程另分配控制台,
  // stdout 不再是被重定向的文件(日志恒 0 字节)且那个控制台是可见窗口。
  assert.ok(cmdBody.includes('detached: false'), 'cmd 跳必须显式 detached: false(实测 detached 会丢日志 + 弹窗)');
  assert.ok(cmdBody.includes('windowsHide: true'), 'cmd 跳靠 windowsHide 持一条隐藏控制台');
  assert.match(SRC, /stdio: 'ignore'/);
});

test('形状锁:cmd 跳由启动器当树根陪着(cmd 会被父进程退出带走,不能 unref 后就走)', () => {
  assert.match(SRC, /child\.once\('exit', resolve\)/, '必须等 cmd 退出(生命周期=整棵树)');
  assert.ok(!/setTimeout\(\(\) => process\.exit\(0\), 800\)/.test(SRC), '旧的无条件 800ms 退出必须已被替换');
});

test('形状锁:启动链自检窗口与探测间隔存在(不是 800ms 就 exit 0)', () => {
  assert.equal(PROBE_BUDGET_MS, 1500);
  assert.match(SRC, /waitAlive\(probe\.pid, 'wscript\.exe', PROBE_BUDGET_MS\)/);
  assert.match(SRC, /tasklist', \['\/FI', `PID eq \$\{p\}`/);
  assert.ok(!/setTimeout\(\(\) => process\.exit\(0\), 800\)/.test(SRC), '旧的无条件 800ms 退出必须已被替换');
});

test('形状锁:cmd 路径必须带 windowsVerbatimArguments(否则 node 把引号转义成 \\",cmd 直接 exit 1)', () => {
  assert.match(SRC, /spawn\('cmd\.exe'/);
  assert.match(SRC, /windowsVerbatimArguments: true/);
  const cmdSpawnBody = SRC.match(/function spawnCmdChain\([\s\S]*?\n\}/)?.[0] ?? '';
  assert.ok(cmdSpawnBody.includes('windowsVerbatimArguments: true'), '这条只能落在 cmd 派生处,不能只写在注释里');
});

test('形状锁:降级诊断行含必需的判据串(dev-stack.mjs 靠它分支出 hint)', () => {
  assert.match(SRC, /wscript 链不可用\(疑似安全策略拦截\),已自动降级 cmd 隐藏控制台直启时=/);
  assert.match(SRC, /wscriptExit=\$\{fmtExit\(/);
  assert.ok(SRC.includes(ENV_LAUNCH_MODE), '强制模式环境变量必须被读取');
});

test('形状锁:dev-stack.mjs killStale 白名单含 cmd.exe(降级形态的旧树才杀得到)', () => {
  const killStaleBody = STACK_SRC.match(/function killStale\(svc\)[\s\S]*?\n\}/)?.[0] ?? '';
  assert.ok(killStaleBody, '源码中必须存在 function killStale(svc)');
  assert.ok(killStaleBody.includes('STALE_ROOT_NAMES'), 'killStale 必须走白名单常量,不能回退成单名判断');
  assert.match(STACK_SRC, /const STALE_ROOT_NAMES = \[[^\]]*'cmd\.exe'/, '白名单字面量必须含 cmd.exe');
  assert.ok(stackTest.STALE_ROOT_NAMES.includes('cmd.exe'));
  assert.ok(stackTest.STALE_ROOT_NAMES.includes('wscript.exe'));
});

test('形状锁:dev-stack.mjs start-timeout hint 有启动链自检失败分支', () => {
  assert.match(STACK_SRC, /\[dev-stack-launch:/);
  assert.match(STACK_SRC, /可用 DEV_STACK_LAUNCH_MODE=cmd 强制降级/);
  assert.equal(typeof stackTest.errHasLaunchDiag, 'function');
});

// —— wroteSince:区分「链没起来」与「目标自己秒退」的辅证 ——

test('wroteSince: 只有本轮启动后写过且非空才算链真的跑过(0 字节/旧日志均不算)', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ihui-ds-wrote-'));
  try {
    const f = path.join(dir, 'a.log');
    writeFileSync(f, ''); // 被拦截时的形态:文件在,但 0 字节
    assert.equal(wroteSince(f, Date.now() - 60_000), false);
    writeFileSync(f, 'boot ok\n'); // 链跑通且目标写过东西
    assert.equal(wroteSince(f, Date.now() - 60_000), true);
    assert.equal(wroteSince(f, Date.now() + 60_000), false, 'mtime 早于本轮启动 ⇒ 旧日志不算证据');
    assert.equal(wroteSince(path.join(dir, 'nope.log'), 0), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// —— errHasLaunchDiag:纯读文本,判据只看诊断前缀 ——

test('errHasLaunchDiag: 命中降级诊断 ⇒ true;空/缺失/无前缀 ⇒ false', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ihui-ds-diag-'));
  try {
    const hit = path.join(dir, 'hit.err.log');
    writeFileSync(hit, '[dev-stack-launch:api] wscript 链不可用(疑似安全策略拦截),已自动降级 cmd 隐藏控制台直启时=2026-10-31T00:00:00.000Z wscriptExit=0\n');
    assert.equal(stackTest.errHasLaunchDiag(hit), true);

    const clean = path.join(dir, 'clean.err.log');
    writeFileSync(clean, 'Error: listen EADDRINUSE: address already in use :::8802\n');
    assert.equal(stackTest.errHasLaunchDiag(clean), false);

    assert.equal(stackTest.errHasLaunchDiag(path.join(dir, 'nope.err.log')), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// —— healthMatches:端口有人应答 ≠ 那是我们的服务(2026-10-31 8802 假桩事故) ——

test('healthMatches: 未声明 expect ⇒ 恒 true(非 http 服务/无身份要求的服务不受影响)', () => {
  assert.equal(stackTest.healthMatches('anything', undefined), true);
  assert.equal(stackTest.healthMatches('anything', ''), true);
});

test('healthMatches: 应答体带身份标记 ⇒ true;被别的 200 桩占着 ⇒ false', () => {
  const real = JSON.stringify({ status: 'ok', service: '@ihui/api', timestamp: '2026-10-31T12:00:00.000Z' });
  assert.equal(stackTest.healthMatches(real, '@ihui/api'), true);
  // 假桩回的 body:HTTP 200 但没有身份标记 —— 旧探活会判 up,新探活必须判"不是本服务"
  assert.equal(stackTest.healthMatches('ok', '@ihui/api'), false);
  assert.equal(stackTest.healthMatches('{"status":"ok"}', '@ihui/api'), false);
});

test('healthMatches: 非字符串应答(取不到 body)不得当命中', () => {
  assert.equal(stackTest.healthMatches(undefined, '@ihui/api'), false);
  assert.equal(stackTest.healthMatches(null, '@ihui/api'), false);
});

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
