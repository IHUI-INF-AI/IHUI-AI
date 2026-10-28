#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// scripts/dev-stack-launch.mjs — dev-stack 的启动中间层(由 dev-stack.mjs 调用,勿手动跑)
//
// 启动形态(2026-10-12 零弹窗第四阶段定型):隐藏控制台链 ——
//   本脚本(无控制台)→ wscript(GUI 子系统)→ cmd(SW_HIDE,持一条隐藏控制台)→ 服务
//   → 服务内部自派的 worker(tsx watch / next dev / expo 的子进程)。
//   服务及其 worker 全部继承 cmd 的隐藏控制台,结构上不可能再分配可见控制台;
//   日志走 cmd 的 >> / 2>> 重定向写回同一批 dev-stack 日志文件。
//   详见下方 spawn 处注释与 dev-stack-hidden-run.vbs 头注。
//
// 两条历史结论的更正(2026-10-12 2x2 矩阵实证,勿再照旧结论写代码):
//   1) 2026-09-22「cmd 层 >> 重定向对外部 exe 输出继承损坏、日志恒 0 字节」——
//      真因是**派生方持有同文件日志句柄**(openSync 后跨 spawn 不关),不是
//      detached、也不是 cmd 重定向本身:持 fd 派生,2s 内整树必灭且日志全空;
//      不持 fd,父子两级日志齐全。⇒ 本脚本严禁持有日志 fd 跨 spawn,错误上报
//      一律按需 appendFileSync(即开即写即关)。
//   2) 「node→node fd stdio 直传可靠」仍然成立,但它正是可见窗口的病根之一:
//      链上人人 windowsHide(CREATE_NO_WINDOW)⇒ 无人持有控制台 ⇒ tsx / next /
//      expo 内部 spawn worker 时(不带 windowsHide,那个 spawn 点在 node_modules
//      里不可改),Windows 给每个 worker 新分配一个**可见控制台** —— 实测 dev
//      api 每 30s 被看守重拉一次,就多弹一扇 "C:\Program Files\nodejs\node.exe"
//      黑窗(pid 逐次翻新)。fd 直传治的是日志,治不了窗;两者在此形态下同时成立。
//
// 用法: node dev-stack-launch.mjs <name> <logDir> <cwd> <exe> [args...]
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [, , name, logDir, cwd, exe, ...rest] = process.argv;
if (!name || !logDir || !cwd || !exe) {
  console.error('usage: dev-stack-launch.mjs <name> <logDir> <cwd> <exe> [args...]');
  process.exit(2);
}

// 隐藏控制台发射器(与本脚本同目录,按自身位置推导,不跟 cwd 走)。
const HIDDEN_RUN_VBS = path.join(path.dirname(fileURLToPath(import.meta.url)), 'dev-stack-hidden-run.vbs');

const outPath = path.join(logDir, `dev-stack-${name}.log`);
const errPath = path.join(logDir, `dev-stack-${name}.err.log`);
fs.mkdirSync(logDir, { recursive: true });
// 2026-10-12 关键修正:本脚本**绝不持有日志文件的 fd 跨 spawn**。旧实现
// (openSync 持 out/err 两个句柄再派生)在隐藏控制台链下整树必死且日志恒空——
// 2x2 矩阵实证(G:/tmp-probe,持 fd 的 D/E 两组 2s 内全灭、日志 0 字节;
// 不持 fd 的 F 组存活且父子两级日志齐全)。2026-09-22 记的「cmd 层 >> 重定向
// 对外部 exe 输出继承损坏、日志恒 0 字节」真因即此(父进程持有同文件句柄),
// 不是 detached 本身 —— 结论在此更正,勿再照旧结论回避 cmd 重定向。
// 错误上报改用按需 appendFileSync(即开即写即关),不留下跨进程句柄。

// 2026-10-12 零弹窗第四阶段(根治 tsx/next/expo 内部自派 worker 弹窗):
// 旧写法直启服务(detached + windowsHide = CREATE_NO_WINDOW)——链上任何进程都
// 不持有控制台,而 tsx watch / next dev / expo 这类 supervisor 内部 spawn worker
// 时**不带** windowsHide(那个 spawn 点在 node_modules 里,不可改),Windows 便给
// 每个 worker 分配一个**新可见控制台**:实测 dev api 的 tsx 链每被看守重拉一次,
// 就多一扇标题为 "C:\Program Files\nodejs\node.exe" 的黑窗(pid 逐次翻新)。
// 解法不是继续加 windowsHide(诱爆点不在我们代码里),而是给整棵树换一条
// **隐藏控制台**:wscript(GUI 子系统,自身无控制台)以 SW_HIDE 起 cmd ⇒ cmd 持有
// 一条隐藏控制台 ⇒ 服务及其内部自派的全部 worker 继承它,结构上再无可见控制台
// 可分配。与 hook-run-hidden.vbs(git hooks)/各 guardian 任务同款已验证技术,
// 2026-10-12 实证(父子两级进程零可见窗口 + 两级日志均落盘)后接线。
// 日志全走 cmd 的 >> / 2>> 重定向;本进程不持有任何日志句柄(见上)。
let child;
try {
  child = spawn('wscript.exe', ['//nologo', HIDDEN_RUN_VBS, exe, cwd, outPath, errPath, ...rest], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
} catch (e) {
  fs.appendFileSync(errPath, `[dev-stack-launch:${name}] spawn 异常: ${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(1);
}
child.on('error', (e) => {
  fs.appendFileSync(errPath, `[dev-stack-launch:${name}] spawn error: ${e instanceof Error ? e.message : String(e)}\n`);
});
// 记录树根 PID(2026-09-22 根治「假死进程堆积」;2026-10-12 起改记隐藏控制台链的
// 树根):tsx watch / expo / next 这类 supervisor 型入口,子服务崩掉后父进程仍活着
// 且不占端口 → dev-stack 重拉前读本文件 taskkill /T /F 清掉旧树,否则僵尸父进程
// 无限堆积(实测 API 挂后残留到次日)。零弹窗第四阶段后,本文件记的不再是服务
// node 本体,而是 wscript(它 Run 等待服务退出,生命周期=整棵树);killStale 对
// wscript.exe 与 node.exe 两种形态都认,才杀得到存量旧直启树。
if (child.pid) {
  try {
    fs.writeFileSync(path.join(logDir, `dev-stack-${name}.pid`), String(child.pid));
  } catch {
    /* pid 记录失败不阻塞启动 */
  }
}
child.unref();
// 给 spawn error 一点暴露窗口后退出;服务树由 cmd 的重定向句柄持日志,不受本进程退出影响
setTimeout(() => process.exit(0), 800);
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
