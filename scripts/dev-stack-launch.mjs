#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// scripts/dev-stack-launch.mjs — dev-stack 的启动中间层(由 dev-stack.mjs 调用,勿手动跑)
//
// 背景(2026-09-22 实测):Windows 上 detached + 隐藏窗口启动链路里,
//   1) cmd 层 `>>` 重定向对【外部 exe】(node/pnpm/tsx/next)的输出继承损坏,
//      子进程输出凭空消失(日志恒 0 字节,exit code 却正常);
//   2) 而 node→node 的 fd stdio 直传(spawn + openSync 日志句柄)完全可靠。
// 本脚本即第 2 条链路:以独立中间进程身份,用 fd 直传拉起真正的服务进程后立即退出,
// 服务进程继承日志句柄继续写同一文件。
//
// 用法: node dev-stack-launch.mjs <name> <logDir> <cwd> <exe> [args...]
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const [, , name, logDir, cwd, exe, ...rest] = process.argv;
if (!name || !logDir || !cwd || !exe) {
  console.error('usage: dev-stack-launch.mjs <name> <logDir> <cwd> <exe> [args...]');
  process.exit(2);
}

const outPath = path.join(logDir, `dev-stack-${name}.log`);
const errPath = path.join(logDir, `dev-stack-${name}.err.log`);
fs.mkdirSync(logDir, { recursive: true });
const out = fs.openSync(outPath, 'a');
const err = fs.openSync(errPath, 'a');

let child;
try {
  child = spawn(exe, rest, { cwd, detached: true, stdio: ['ignore', out, err], windowsHide: true });
} catch (e) {
  fs.writeSync(err, `[dev-stack-launch:${name}] spawn 异常: ${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(1);
}
child.on('error', (e) => {
  fs.writeSync(err, `[dev-stack-launch:${name}] spawn error: ${e instanceof Error ? e.message : String(e)}\n`);
});
// 记录服务进程 PID(2026-09-22 根治「假死进程堆积」):tsx watch / expo / next 这类
// supervisor 型入口,子服务崩掉后父进程仍活着且不占端口 → dev-stack 重拉前读本文件
// taskkill /T /F 清掉旧树,否则僵尸父进程无限堆积(实测 API 挂后残留到次日)。
if (child.pid) {
  try {
    fs.writeFileSync(path.join(logDir, `dev-stack-${name}.pid`), String(child.pid));
  } catch {
    /* pid 记录失败不阻塞启动 */
  }
}
child.unref();
// 给 spawn error 一点暴露窗口后退出;服务进程已持有日志句柄,不受本进程退出影响
setTimeout(() => process.exit(0), 800);
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
