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
//      真因是**派生方持有同文件日志句柄**(同步 open 拿到句柄后跨 spawn 不关),不是
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
// 2026-10-31 静默失败修复(wscript 被安全策略拦截):
//   本机安全中心把 wscript 列入 LOLBin 黑名单:spawn 不抛错、pid 文件照写、日志停在
//   上一次内容 —— 整条链静默不出进程,dev-stack 只报 start-timeout,hint 还把人往
//   「服务自己起不来」上引(真实事故:本地 API 长期无人拉起,号池巡检停摆 7 天)。
//   现在 spawn 后不再 800ms 就走,而是先做**启动链自检**:按 PID 轮询 tasklist 判
//   wscript 是否真活(被拦截时它 100% 立即退出),活 ⇒ wscript 模式;死 ⇒ 降级 cmd。
//   降级形态:cmd.exe /d /s /c ""exe" "args" >> "out" 2>> "err"" + windowsHide
//   (= CREATE_NO_WINDOW,cmd 持一条隐藏控制台,服务及其自派 worker 继承它,结构上仍
//   不会弹窗);此跳不能 detached(否则日志丢 + 弹窗,见 spawnCmdChain 注释),故
//   降级时本进程不退出,原地当树根陪到服务结束。两条路径都不持日志 fd。
//   强制模式:DEV_STACK_LAUNCH_MODE=wscript|cmd(其它取值一律视为未指定)。
//
// 用法: node dev-stack-launch.mjs <name> <logDir> <cwd> <exe> [args...]
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// 隐藏控制台发射器(与本脚本同目录,按自身位置推导,不跟 cwd 走)。
const HIDDEN_RUN_VBS = path.join(path.dirname(fileURLToPath(import.meta.url)), 'dev-stack-hidden-run.vbs');

// —— 纯判据(导出到 __test__ 供 scripts/tests/dev-stack-launch-fallback.test.mjs
//    直接 import;§22c:测试禁止复制判据,否则判据漂移两处各说各话)——
const LAUNCH_MODES = ['pipe', 'wscript', 'cmd'];
const ENV_LAUNCH_MODE = 'DEV_STACK_LAUNCH_MODE';
// 自检窗口:被拦截的 wscript 立即退出,活过该窗口即判可用(实测拦截时 <100ms 就没了;
// 1.5s 留足 tasklist 单次查询耗时,又不至于让降级路径白等)
const PROBE_BUDGET_MS = 1500;
const PROBE_INTERVAL_MS = 150;

/** 环境变量取值归一:只认 pipe / wscript / cmd(大小写与首尾空白宽容),其余 ⇒ null(未指定) */
function normalizeForced(forced) {
  const f = typeof forced === 'string' ? forced.trim().toLowerCase() : '';
  return LAUNCH_MODES.includes(f) ? f : null;
}

/**
 * 启动模式判定(2026-10-31 改判,立因见 spawnPipeChain 注释):
 * 默认走 `pipe`;只有显式 DEV_STACK_LAUNCH_MODE=wscript|cmd 才走旧的两条链。
 * 保留 wscriptUsable 形参是为了让镜像测试能锁住"旧链只在被显式点名时启用"这一事实。
 */
function resolveLaunchMode({ forced, wscriptUsable } = {}) {
  void wscriptUsable;
  return normalizeForced(forced) ?? 'pipe';
}

/**
 * Windows 参数引号包裹(纯函数,CommandLineToArgvW 规则):
 *   - 恒用 ASCII 直引号(中文全角引号 cmd/vbs 都不认);
 *   - 内部 " 转义成 \"(其前方 \ 按 2n+1 加倍);
 *   - 结尾的 \ 加倍,免得吃掉闭合引号;
 *   - 空串 ⇒ "",不加引号会被 cmd 当没这个参数吞掉;
 *   - & ^ | < > 空格 ( ) 等 cmd 元字符被引号包裹后对 cmd 就是字面量。
 * 未覆盖 %VAR% 与 ! :cmd 在引号内仍会展开这两个;本脚本的参数是路径/模块名,
 * 真出现属上游传参问题,本层不静默改写(改坏比报错更难查)。
 */
function quoteWinArg(value) {
  const s = String(value ?? '');
  let out = '"';
  let backslashes = 0;
  for (const ch of s) {
    if (ch === '\\') {
      backslashes += 1;
      continue;
    }
    if (ch === '"') {
      out += '\\'.repeat(backslashes * 2 + 1) + '"';
      backslashes = 0;
      continue;
    }
    if (backslashes) {
      out += '\\'.repeat(backslashes);
      backslashes = 0;
    }
    out += ch;
  }
  if (backslashes) out += '\\'.repeat(backslashes * 2);
  return `${out}"`;
}

/**
 * cmd 模式的 /c 实参:内层命令行 + /s 需要的最外层一对引号。
 * 形态:`""<exe>" "<arg1>" ... >> "<out>" 2>> "<err>""`
 * cmd /s 只剥**最外层一对**引号,内层 exe/参数/日志路径的引号原样交给 CreateProcess
 * (与 dev-stack-hidden-run.vbs 的 cmd 形态同源,勿改成单层)。
 */
function buildCmdInvocation(exe, args, outPath, errPath) {
  const parts = [quoteWinArg(exe), ...(args || []).map((a) => quoteWinArg(a))];
  const inner = `${parts.join(' ')} >> ${quoteWinArg(outPath)} 2>> ${quoteWinArg(errPath)}`;
  return `"${inner}"`;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// 2026-10-12 关键修正:本脚本**绝不持有日志文件的 fd 跨 spawn**。旧实现
// (先同步 open 拿 out/err 两个句柄再派生)在隐藏控制台链下整树必死且日志恒空——
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
// —— 启动链自检与两条启动路径(2026-10-31:静默失败 → 可判定 + 自动降级)—— //

// 按 PID 判活:只认 tasklist CSV 首个引号段是否等于进程名,不解析 INFO 文案
// (中文系统那句 "信息: 没有运行的任务…" 是本地化的,按文案判会假活/假死)。
function pidAlive(pid, expectName) {
  const p = Number(pid);
  if (!Number.isInteger(p) || p <= 0) return false;
  try {
    const r = spawnSync('tasklist', ['/FI', `PID eq ${p}`, '/FO', 'CSV', '/NH'], {
      windowsHide: true,
      encoding: 'utf8',
      timeout: 5000,
      // §12g:不吃的子进程必须显式接管 stdio(否则本机报 spawnSync EBUSY)
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const m = (r.stdout || '').match(/^\s*"([^"]+)"/m);
    return !!m && m[1].toLowerCase() === expectName.toLowerCase();
  } catch {
    return false;
  }
}

// 自检:budget 内进程一直活着 ⇒ 可用;**一发现它没了就立刻返回 false**(不等满预算),
// 被拦截的 wscript 几十毫秒就退出,降级路径几乎零额外延迟。
async function waitAlive(pid, expectName, budgetMs) {
  const deadline = Date.now() + budgetMs;
  for (;;) {
    if (!pidAlive(pid, expectName)) return false;
    if (Date.now() >= deadline) return true;
    await sleep(PROBE_INTERVAL_MS);
  }
}

// 诊断一律即开即写即关,不留下跨进程句柄(见上:持 fd 派生整树必死)。
function appendErr(errPath, line) {
  try {
    fs.appendFileSync(errPath, line.endsWith('\n') ? line : `${line}\n`);
  } catch {
    /* 诊断写不进不阻塞启动 */
  }
}

const fmtExit = (code) => (Number.isInteger(code) ? String(code) : 'null');

// 日志在「本轮启动之后」被写过 ⇒ 启动链确实把目标进程拉起来过(被策略拦截时整条链
// 一步都不走,日志不会动)。比对 mtime 而不是"非空":旧日志非空会把拦截误判成跑通。
function wroteSince(file, startedAt) {
  try {
    const st = fs.statSync(file);
    return st.size > 0 && st.mtimeMs >= startedAt;
  } catch {
    return false;
  }
}

// 记录树根 PID(2026-09-22 根治「假死进程堆积」):tsx watch / expo / next 这类
// supervisor 型入口,子服务崩掉后父进程仍活着且不占端口 → dev-stack 重拉前读本文件
// taskkill /T /F 清掉旧树,否则僵尸父进程无限堆积(实测 API 挂后残留到次日)。
// 两条路径记的都是「整棵树的根」:wscript 模式记 wscript(它 Run …,True 等整树退出);
// cmd 模式记 cmd(它 >> 重定向、等 exe 退出,启动器在它上面陪跑)。killStale 的白名单
// 两者都认(wscript.exe / cmd.exe / node.exe),/T 一定杀得到服务本体。
function writePid(pidPath, pid) {
  try {
    fs.writeFileSync(pidPath, String(pid));
  } catch {
    /* pid 记录失败不阻塞启动 */
  }
}

// 默认链(2026-10-31 立,替代 wscript/cmd 的「外部重定向」形态):父进程自己 spawn 服务,
// 用 **stdio 管道**接住它的 stdout/stderr,再同步写进 .tmp-sync/dev-stack-<name>.log。
//
// 为什么必须换(本机实测,决定性):
//   `node --import tsx src/index.ts` 在 stdout 被**重定向到文件**时(无论 cmd `>>` 还是
//   Start-Process -RedirectStandardOutput),API 会卡在加载阶段:进程活着、CPU 很低、
//   日志恒 0 字节、端口永不监听,表现为「启动链静默失败」。同一条命令把 stdout 换成
//   **管道**(bash 的 `| tee`),12 秒就 /health 200。
//   这就是本地 API 长期起不来、号池巡检停摆 7 天的**最底层根因** —— 既不是 wscript 被拦,
//   也不是端口冲突,更不是 node 版本(WScript/cmd/Start-Process 三种文件重定向都复现)。
//   机制推断:pino/tsx 在非 TTY 文件 stdio 上的写路径会阻塞(管道则不会),但无论机制如何,
//   判据是稳定的:**stdio 用管道 ⇒ 起来;用文件 ⇒ 卡死**。
//
// 代价与取舍:
//   · 本进程必须**常驻**当转发器(服务生命周期 = 本进程生命周期),这是拿「一条常驻 node」
//     换「服务能起来」。pid 文件记**服务本体**的 pid(killStale /T 从父树杀得干净)。
//   · session 0 / 无桌面下也不弹窗:node 的 windowsHide=CREATE_NO_WINDOW,整条链无可见控制台;
//     服务内部自派 worker 即使新分配控制台,在 session 0 也没有桌面可显示(与 S4U 任务同源)。
//   · 历史注释里「持日志 fd 跨 spawn 整树必灭」说的是**把 fd 直接塞给 spawn 的 stdio**;
//     本实现是 spawn 用 `pipe`,只在本进程里 fs.writeSync 追加,不跨进程传句柄 ⇒ 不踩那条坑。
function spawnPipeChain({ name, exe, cwd, outPath, errPath, rest }) {
  let outFd;
  let errFd;
  try {
    outFd = fs.openSync(outPath, 'w');
    errFd = fs.openSync(errPath, 'w');
  } catch (e) {
    appendErr(errPath, `[dev-stack-launch:${name}] 日志句柄打开失败: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
  let child;
  try {
    child = spawn(exe, rest, {
      cwd,
      // 管道而非文件:见上,文件 stdio 会让 api 卡死
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
  } catch (e) {
    appendErr(errPath, `[dev-stack-launch:${name}] spawn 异常: ${e instanceof Error ? e.message : String(e)}`);
    try {
      fs.closeSync(outFd);
      fs.closeSync(errFd);
    } catch {
      /* 关不掉不影响退出 */
    }
    return null;
  }
  child.stdout.on('data', (d) => {
    try {
      fs.writeSync(outFd, d);
    } catch {
      /* 写日志失败不杀服务 */
    }
  });
  child.stderr.on('data', (d) => {
    try {
      fs.writeSync(errFd, d);
    } catch {
      /* 同上 */
    }
  });
  const closeFds = () => {
    for (const fd of [outFd, errFd]) {
      try {
        fs.closeSync(fd);
      } catch {
        /* 已关 */
      }
    }
  };
  child.on('error', (e) => {
    appendErr(errPath, `[dev-stack-launch:${name}] spawn error: ${e instanceof Error ? e.message : String(e)}`);
  });
  child.on('exit', (code, signal) => {
    try {
      fs.writeSync(errFd, `[dev-stack-launch-exit:${name}] 服务退出 code=${fmtExit(code)} signal=${signal ?? 'null'}时=${new Date().toISOString()}\n`);
    } catch {
      /* 写不进去就算了 */
    }
    closeFds();
  });
  return child;
}

// 原链:wscript(GUI 子系统,无控制台)→ vbs 以 SW_HIDE 起 cmd → 服务。
// 返回值里的 exitCode/spawnError 只用于降级诊断(被拦截时 exitCode 恒 0 或 null)。
function spawnWscriptChain({ name, exe, cwd, outPath, errPath, rest }) {
  const state = { child: null, pid: 0, exitCode: null, spawnError: null };
  try {
    state.child = spawn('wscript.exe', ['//nologo', HIDDEN_RUN_VBS, exe, cwd, outPath, errPath, ...rest], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });
  } catch (e) {
    state.spawnError = e instanceof Error ? e.message : String(e);
    appendErr(errPath, `[dev-stack-launch:${name}] spawn 异常: ${state.spawnError}`);
    return state;
  }
  state.pid = state.child.pid || 0;
  state.child.on('exit', (code) => {
    state.exitCode = Number.isInteger(code) ? code : null;
  });
  state.child.on('error', (e) => {
    state.spawnError = e instanceof Error ? e.message : String(e);
    appendErr(errPath, `[dev-stack-launch:${name}] spawn error: ${state.spawnError}`);
  });
  return state;
}

// 降级链:cmd 隐藏控制台直启服务。windowsHide ⇒ CREATE_NO_WINDOW,cmd 自己持一条
// **不可见**控制台,服务与它内部自派的 worker 全部继承它 —— 与 wscript 链同样没有
// 可再分配的可见控制台,结构上不弹窗(flag 层面看不出区别,区别只在谁起 cmd)。
//
// 两处「反直觉但实测必须」的派生属性(2026-10-31 本机矩阵,勿照直觉改):
//   1) windowsVerbatimArguments: node 默认会给含空格/引号/元字符的实参做 Windows
//      转义,把 /s /c 那一整串里的 " 全改成 \" ⇒ cmd 认不出引号,直接报「系统找不到
//      指定的路径」exit 1,日志一个字节都不写 —— 又是一次静默失败。必须原样交给
//      CreateProcess。
//   2) **不能 detached**:detached 在 Windows 上等于 DETACHED_PROCESS(新进程没有
//      控制台),此时 cmd 虽然自己照跑(内建 echo 的 >> 仍然落盘),但它派生的
//      **子进程会新分配一个控制台**,stdout 不再是重定向的文件 —— 实测 node 子进程
//      process.stdout.isTTY=true、日志恒 0 字节,而且那个新控制台是**可见窗口**,
//      正好撞碎本仓的零弹窗铁律。同一份命令去掉 detached 后日志立刻正常。
//      代价:非 detached 的 cmd 会随父进程退出被带走(实测启动器一 exit,cmd 就没了,
//      只剩服务自己变成孤儿),所以 main() 在这一跳**不退出**,原地当树根陪到 cmd
//      结束 —— 与 wscript 的 Run …,True 同构,pid 文件记的仍是 cmd(killStale /T 杀
//      整树后 cmd 退,本进程随即自然退出)。
function spawnCmdChain({ name, exe, outPath, errPath, rest }) {
  const invocation = buildCmdInvocation(exe, rest, outPath, errPath);
  let child;
  try {
    child = spawn('cmd.exe', ['/d', '/s', '/c', invocation], {
      detached: false,
      stdio: 'ignore',
      windowsHide: true,
      windowsVerbatimArguments: true,
    });
  } catch (e) {
    appendErr(errPath, `[dev-stack-launch:${name}] cmd spawn 异常: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
  child.on('error', (e) => {
    appendErr(errPath, `[dev-stack-launch:${name}] cmd spawn error: ${e instanceof Error ? e.message : String(e)}`);
  });
  return child;
}

async function main() {
  const [name, logDir, cwd, exe, ...rest] = process.argv.slice(2);
  if (!name || !logDir || !cwd || !exe) {
    console.error('usage: dev-stack-launch.mjs <name> <logDir> <cwd> <exe> [args...]');
    return 2;
  }
  const outPath = path.join(logDir, `dev-stack-${name}.log`);
  const errPath = path.join(logDir, `dev-stack-${name}.err.log`);
  const pidPath = path.join(logDir, `dev-stack-${name}.pid`);
  fs.mkdirSync(logDir, { recursive: true });

  // 强制模式 DEV_STACK_LAUNCH_MODE=wscript|cmd;拼错/空串 ⇒ 未指定(不猜用户意图)
  const forcedRaw = process.env[ENV_LAUNCH_MODE];
  const forcedMode = normalizeForced(forcedRaw);

  // —— 默认形态:pipe 转发(见 spawnPipeChain 的立因) ——
  // 不探 wscript:探测本身会白拉一条链、把日志截断两次,还会把真错误埋在假诊断后面。
  const mode = resolveLaunchMode({ forced: forcedRaw });
  if (mode === 'pipe') {
    const child = spawnPipeChain({ name, exe, cwd, outPath, errPath, rest });
    if (!child) return 1;
    // pid 记**服务本体**:killStale 按它 /T 杀整树,本转发器随子进程退出自然收场
    if (child.pid) writePid(pidPath, child.pid);
    await new Promise((resolve) => {
      child.once('exit', resolve);
      child.once('error', resolve);
    });
    return 0;
  }

  // —— 以下为显式 DEV_STACK_LAUNCH_MODE=wscript|cmd 时的旧链(保留可回退,不再是默认) ——
  // forced=cmd 不必探测(省 1.5s);wscript 先试,由自检结果决定去向
  const startedAt = Date.now();
  const probe = forcedMode === 'cmd' ? null : spawnWscriptChain({ name, exe, cwd, outPath, errPath, rest });
  const wscriptAlive = probe && probe.pid ? await waitAlive(probe.pid, 'wscript.exe', PROBE_BUDGET_MS) : false;
  // 辅证(2026-10-31 实测补):自检判死 ≠ 链没跑。目标自己秒退(EADDRINUSE / 首编译
  // 直接失败)时 wscript 同样会退,而**被策略拦截时整条链一步都没走**,日志停在 0 字节。
  // 「本轮启动后日志被写过」⇒ 链已跑通,就不能当拦截处理:否则诊断把人往安全策略上引,
  // 而真因(端口冲突 / 启动报错)明明就写在那份日志里 —— 与本次要修的病同源。
  const chainRanThenExited = !wscriptAlive && probe ? wroteSince(outPath, startedAt) || wroteSince(errPath, startedAt) : false;

  if (forcedMode) {
    // 前缀用 `-mode:`,刻意**不**写成 `[dev-stack-launch:`,免得被 dev-stack.mjs 的
    // 「启动链自检失败」判定误命中(强制 cmd 是主动选择,不是故障)
    appendErr(
      errPath,
      `[dev-stack-launch-mode:${name}] 强制模式 ${ENV_LAUNCH_MODE}=${forcedMode} 已生效(不探测/不改变)时=${new Date().toISOString()}`,
    );
  }

  if (mode === 'wscript' && wscriptAlive) {
    if (probe.pid) writePid(pidPath, probe.pid);
    probe.child?.unref();
    await sleep(120); // 自检已耗掉 1.5s,spawn error 早有了暴露窗口
    return 0;
  }

  if (mode === 'wscript' && chainRanThenExited) {
    // 链跑通但目标秒退:树已经没了,不写 pid(写了也只是个死号),留一行可查痕迹。
    // 前缀同样避开 `[dev-stack-launch:`,这是「目标自己退」而非「链没起来」。
    if (probe.exitCode === null) await sleep(80);
    appendErr(
      errPath,
      `[dev-stack-launch-exit:${name}] 启动链已跑通,目标进程在自检窗口内自行退出(日志已落盘,勿当安全策略拦截)时=${new Date().toISOString()} wscriptExit=${fmtExit(
        probe?.exitCode,
      )}`,
    );
    return 0;
  }

  if (mode === 'wscript') {
    // 强制 wscript 但链不可用:不降级(强制模式必须生效),把真实原因留在 err 日志,
    // 让 dev-stack 的 start-timeout hint 能指出「不是服务起不来」。
    appendErr(
      errPath,
      `[dev-stack-launch:${name}] 强制模式 wscript 下启动链自检失败(疑似安全策略拦截)时=${new Date().toISOString()} wscriptExit=${fmtExit(
        probe?.exitCode,
      )}${probe?.spawnError ? ` spawnError=${probe.spawnError}` : ''}`,
    );
    probe?.child?.unref();
    return 1;
  }

  // —— 降级:cmd 隐藏控制台直启 ——
  if (probe) {
    // tasklist 先于 'exit' 事件判死,给事件一点落地时间,诊断里就能写出真实退出码
    // 而不是 null(wscriptExit 是排查「被拦 vs 自己崩」的第一手信息)
    if (probe.exitCode === null) await sleep(80);
    appendErr(
      errPath,
      `[dev-stack-launch:${name}] wscript 链不可用(疑似安全策略拦截),已自动降级 cmd 隐藏控制台直启时=${new Date().toISOString()} wscriptExit=${fmtExit(
        probe.exitCode,
      )}`,
    );
  }
  const child = spawnCmdChain({ name, exe, outPath, errPath, rest });
  if (!child) return 1;
  if (child.pid) writePid(pidPath, child.pid);
  // 不 unref、不 sleep 后退出:本跳不能 detached(理由见 spawnCmdChain),cmd 会随父进程
  // 退出被带走 ⇒ 启动器必须**留在这里当树根**(与 wscript 的 Run …,True 同构),服务的
  // 生命周期 = 本进程的生命周期。killStale 按 pid 文件(记的是 cmd)/T 杀整树后,cmd 退出,
  // 本进程随即自然退出,不留孤儿。
  await new Promise((resolve) => {
    child.once('exit', resolve);
    child.once('error', resolve);
  });
  return 0;
}

// §22d 双形态守卫:被 import(镜像测试/工具)时零副作用 —— 少了它,测试一 import
// 就会真的派生服务树(会占端口、会改 pid 文件),测完还得收拾残局。
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  process.exitCode = await main();
}

export const __test__ = {
  resolveLaunchMode,
  quoteWinArg,
  buildCmdInvocation,
  wroteSince,
  LAUNCH_MODES,
  ENV_LAUNCH_MODE,
  PROBE_BUDGET_MS,
};
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
