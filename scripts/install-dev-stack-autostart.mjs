// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// scripts/install-dev-stack-autostart.mjs — 把 dev-stack 开机自启守护安装进 Windows「启动」目录
//
// 用途(2026-09-22 根治「网络不通/不起服务」的一部分):
//   Windows 登录后隐藏启动 dev-stack.mjs --watch --device,每 30s 体检自愈 + 周期重建
//   adb reverse。npm script: pnpm dev:stack:autostart
//
// 为什么由本脚本生成 VBS 而不是手工放一份:
//   VBS 里必须写 node.exe 与本仓库的绝对路径;手工版仓库移动/换机器即失效。
//   本脚本每次运行按当前环境重写,幂等,重跑一次即修复路径。
//
// 链路: 登录 → VBS(隐藏窗口) → dev-stack-launch.mjs(node→node fd 直传,日志可靠落盘,
//       cmd 重定向在 detached 链路对外部 exe 会丢输出,勿改回) → dev-stack --watch --device
// 日志: .tmp-sync/dev-stack-watcher.log(.err.log);服务自身日志 .tmp-sync/dev-stack-<名>.log

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STARTUP_DIR = path.join(
  os.homedir(),
  'AppData',
  'Roaming',
  'Microsoft',
  'Windows',
  'Start Menu',
  'Programs',
  'Startup',
);
const VBS_PATH = path.join(STARTUP_DIR, 'ihui-dev-stack.vbs');
const NODE_EXE = process.execPath;

// VBS 字符串字面量内的 " 需翻倍转义
const q = (s) => `"${s}"`;
const vbsLiteral = (s) => `"${s.replaceAll('"', '""')}"`;

const command = [
  q(NODE_EXE),
  q(path.join(ROOT, 'scripts', 'dev-stack-launch.mjs')),
  'watcher',
  q(path.join(ROOT, '.tmp-sync')),
  q(ROOT),
  q(NODE_EXE),
  q(path.join(ROOT, 'scripts', 'dev-stack.mjs')),
  '--watch',
  '--device',
].join(' ');

const vbs = [
  `' IHUI-AI 本地开发栈开机自启——由 scripts/install-dev-stack-autostart.mjs 生成,勿手改`,
  `' 仓库移动/换机器后重跑: pnpm dev:stack:autostart`,
  `' 链路: 登录 → 本 VBS(隐藏窗口) → dev-stack-launch.mjs(fd 直传日志) → dev-stack.mjs --watch --device`,
  `' 日志: ${path.join(ROOT, '.tmp-sync', 'dev-stack-watcher.log')} 与同名 .err.log`,
  'Set sh = CreateObject("WScript.Shell")',
  `sh.Run ${vbsLiteral(command)}, 0, False`,
  '',
].join('\r\n');

fs.mkdirSync(STARTUP_DIR, { recursive: true });
fs.writeFileSync(VBS_PATH, vbs, 'utf8');
console.log(`[dev-stack:autostart] 已安装: ${VBS_PATH}`);
console.log('[dev-stack:autostart] 下次 Windows 登录自动生效;当前会话立即启用可运行:');
console.log(`  wscript.exe ${q(VBS_PATH)}`);

// 冒烟校验:确认链路两端的文件都在,避免装了个跑不起来的空壳
for (const f of [NODE_EXE, path.join(ROOT, 'scripts', 'dev-stack-launch.mjs'), path.join(ROOT, 'scripts', 'dev-stack.mjs')]) {
  if (!fs.existsSync(f)) {
    console.error(`[dev-stack:autostart] ⚠️ 依赖缺失: ${f}`);
    process.exitCode = 1;
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
