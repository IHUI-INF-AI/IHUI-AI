// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-003:按 pid 回收整棵进程树(只给"手上只有 pid"的清理点用)。
 *
 * 病灶:`child.kill()` / `process.kill(pid)` 只结束直接子 shell,shell 自己派生的
 * 孙进程(dev server、npm 起的 node、后台化的 sleep)继承管道继续活着 —— 端口占着、
 * 任务显示 running 实际已失控、反复调用线性累积残留。
 *
 * 口径(与 util/spawn-isolated.ts 的 `killProcessTree(child)` 同一件事,区别只是入参):
 *   - win32:Windows 没有 POSIX 进程组语义,用 `taskkill /T /F` 杀整棵树;
 *     taskkill 起不来(ENOENT 等)才降级单进程 SIGKILL —— 会漏孙进程,但不泄漏主进程。
 *   - POSIX:先对进程组 `kill(-pid, SIGKILL)`(调用端派生时必须 `detached: true`,
 *     否则 -pid 不是任何组);组信号失败(含 ESRCH)再降级单进程 SIGKILL,
 *     这样未 detached 的历史路径也至少收掉 shell 本身。
 *
 * 两个分支都不抛:清理点都在错误处理收尾里,抛出去会把真正的失败原因盖掉。
 * 参数一律走 argv 数组,不拼 shell 字符串(防注入)。
 */

import { spawn } from 'node:child_process';
import * as os from 'node:os';

/** killProcessTree 的可选项(平台注入口只为单测驱动分支,生产不传)。 */
export interface KillProcessTreeOptions {
  /** 平台判定注入(缺省 os.platform())。 */
  platform?: NodeJS.Platform;
}

/** 单进程补刀(已死 / 无权限一律忽略)。 */
function killSingle(pid: number): void {
  try {
    process.kill(pid, 'SIGKILL');
  } catch {
    /* ESRCH:进程已死;EPERM:无权发信号 —— 都不再放大 */
  }
}

/**
 * 杀掉 pid 及其全部后代。pid 非法(未派生 / 已回收)时结构性 no-op。
 */
export function killProcessTree(pid: number | null | undefined, opts: KillProcessTreeOptions = {}): void {
  if (typeof pid !== 'number' || !Number.isInteger(pid) || pid <= 0) return;
  const platform = opts.platform ?? os.platform();

  if (platform === 'win32') {
    try {
      const taskkill = spawn('taskkill', ['/PID', String(pid), '/T', '/F'], {
        windowsHide: true,
        stdio: 'ignore',
      });
      // taskkill 不可用时降级(异步 ENOENT 走 error 事件,同步抛错走 catch)
      taskkill.on('error', () => killSingle(pid));
    } catch {
      killSingle(pid);
    }
    return;
  }

  // POSIX:detached 派生时 child.pid 即进程组 ID,负号打整组
  try {
    process.kill(-pid, 'SIGKILL');
  } catch {
    killSingle(pid);
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
