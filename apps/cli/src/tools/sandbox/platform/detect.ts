// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/**
 * 平台能力探测 — 探测当前 OS 可用的沙箱后端。
 *
 * 对标 Codex CLI:
 *   - Linux:   Landlock(内核 5.13+) / bubblewrap(bwrap) / seccomp
 *   - macOS:   sandbox-exec(Seatbelt 前端)
 *   - Windows: 受限令牌 / icacls ACL / JOB 对象(Node 无原生 API 时降级)
 *
 * 探测结果用于选择执行后端与降级链路,并向上层如实报告"真隔离 vs 降级策略"。
 */

import { execFile } from 'node:child_process';
import { platform } from 'node:os';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/** 沙箱后端类型(按隔离强度从强到弱排序) */
export type SandboxBackend =
  | 'landlock'          // Linux 内核级文件访问控制(真隔离)
  | 'bwrap'             // bubblewrap 挂载命名空间(真隔离)
  | 'sandbox-exec'      // macOS Seatbelt profile(真隔离)
  | 'restricted-token'  // Windows 受限令牌(降级:进程级弱隔离)
  | 'prlimit'           // POSIX prlimit 资源限制(降级:仅资源上限,无文件系统隔离)
  | 'plain';            // 无隔离(降级:仅策略层过滤)

export interface PlatformCapabilities {
  /** 当前平台: linux / darwin / win32 */
  platform: NodeJS.Platform;
  /** 选中的最佳后端(降级链路选择结果) */
  backend: SandboxBackend;
  /** 各后端可用性明细(诊断用) */
  available: Partial<Record<SandboxBackend, boolean>>;
  /** 探测过程中的说明(哪些是真隔离、哪些是降级) */
  notes: string[];
}

/** 探测结果缓存(进程级,避免重复 spawn 探测命令) */
let cached: PlatformCapabilities | undefined;

/** 运行探测命令,退出码 0 视为可用;任何错误视为不可用 */
async function probeCommand(cmd: string, args: string[]): Promise<boolean> {
  try {
    await execFileAsync(cmd, args, { timeout: 5000, windowsHide: true });
    return true;
  } catch {
    return false;
  }
}

/** 清空缓存(仅供测试使用) */
export function resetCapabilityCache(): void {
  cached = undefined;
}

/**
 * 探测平台沙箱能力(结果进程级缓存)。
 * 降级链路:
 *   Linux:   landlock → bwrap → prlimit → plain
 *   macOS:   sandbox-exec → prlimit → plain
 *   Windows: restricted-token → plain
 */
export async function detectPlatformCapabilities(): Promise<PlatformCapabilities> {
  if (cached) return cached;

  const notes: string[] = [];
  const available: Partial<Record<SandboxBackend, boolean>> = {};
  const plat = platform();

  if (plat === 'win32') {
    // Windows:Node 无受限令牌/JOB 对象原生 API,采用 PowerShell Start-Process 方案
    const psOk = await probeCommand('powershell.exe', ['-NoProfile', '-Command', '$PSVersionTable.PSVersion.Major']);
    available['restricted-token'] = psOk;
    notes.push(
      psOk
        ? 'Windows: 通过 PowerShell Start-Process -NoNewWindow 启动(降级:环境变量过滤 + 超时/输出限制,非内核级隔离)'
        : 'Windows: 未检测到 PowerShell,后端降级为 plain(仅策略层过滤)',
    );
    const backend: SandboxBackend = psOk ? 'restricted-token' : 'plain';
    cached = { platform: plat, backend, available, notes };
    return cached;
  }

  // POSIX 平台通用:探测 prlimit(资源限制降级层)
  available.prlimit = await probeCommand('prlimit', ['--version']);

  if (plat === 'linux') {
    // Landlock:内核 5.13+ 且 glibc 支持;这里通过探测 lsev 或直接检测内核版本近似判断
    const kernelOk = await probeLinuxLandlockKernel();
    available.landlock = kernelOk;
    // bubblewrap:独立二进制,存在即可用
    available.bwrap = await probeCommand('bwrap', ['--version']);
    if (available.landlock) {
      notes.push('Linux: 检测到 Landlock 能力内核(≥5.13),但 Node 无原生 syscall 封装,实际走 bwrap 优先');
    }
    if (available.bwrap) {
      notes.push('Linux: bubblewrap 可用,采用挂载命名空间隔离(真隔离:文件系统 + 可选 unshare-net)');
    }
    let backend: SandboxBackend = 'plain';
    if (available.bwrap) backend = 'bwrap';
    else if (available.landlock) {
      // 有 Landlock 内核但无 bwrap 时,Node 侧无法直接调用 Landlock syscall,降级
      notes.push('Linux: 有 Landlock 内核但无 bwrap 二进制,Node 侧降级为 prlimit/plain');
      backend = available.prlimit ? 'prlimit' : 'plain';
    } else {
      backend = available.prlimit ? 'prlimit' : 'plain';
      notes.push(available.prlimit
        ? 'Linux: 无 bwrap,降级为 prlimit(仅资源上限:地址空间/CPU 时间,无文件系统隔离)'
        : 'Linux: 无 bwrap 且无 prlimit,降级为 plain(仅策略层过滤)');
    }
    cached = { platform: plat, backend, available, notes };
    return cached;
  }

  // darwin(及其他 POSIX)
  available['sandbox-exec'] = await probeCommand('sandbox-exec', ['-h']);
  if (available['sandbox-exec']) {
    notes.push('macOS: sandbox-exec(Seatbelt)可用,采用 profile 沙箱(真隔离)');
  } else {
    notes.push('macOS: 无 sandbox-exec,降级为 prlimit/plain');
  }
  const backend: SandboxBackend = available['sandbox-exec']
    ? 'sandbox-exec'
    : available.prlimit ? 'prlimit' : 'plain';
  cached = { platform: plat, backend, available, notes };
  return cached;
}

/** 探测 Linux 内核版本是否 ≥ 5.13(Landlock 最低要求) */
async function probeLinuxLandlockKernel(): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync('uname', ['-r'], { timeout: 3000 });
    const m = /(\d+)\.(\d+)/.exec(stdout.trim());
    if (!m) return false;
    const major = Number(m[1]);
    const minor = Number(m[2]);
    return major > 5 || (major === 5 && minor >= 13);
  } catch {
    return false;
  }
}
