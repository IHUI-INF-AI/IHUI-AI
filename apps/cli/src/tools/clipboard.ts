/**
 * 剪贴板工具 — 跨平台 read/write 系统剪贴板。
 *
 * 灵感来源:参考行业 Agent 框架的 clipboard 工具(Agent 可读写用户剪贴板,
 * 用于"把我刚复制的错误贴上来分析"等场景)。
 * 简化策略(做减法):
 *   - 不引入第三方 npm 包(clipboardy / copy-paste 等),纯 Node 内置 + 系统 CLI
 *   - Windows:Set-Clipboard / Get-Clipboard(PowerShell 内置)
 *   - macOS:pbcopy / pbpaste(系统内置)
 *   - Linux:xclip -selection clipboard(用户需自行安装;缺失时返回友好错误)
 *   - dangerLevel='read'(clipboard_read) / 'write'(clipboard_write,需确认)
 *
 * Feature flag:settings.clipboard.enabled 默认 false。
 * 关闭时 setupAgentTools 不注册这两个工具(零回归)。
 */

import { spawnSync } from 'node:child_process';
import type { Tool, ToolResult } from './index.js';

/** 最大支持的剪贴板文本长度(避免超大内容塞爆 LLM 上下文) */
const MAX_CLIPBOARD_CHARS = 32_000;

type Platform = 'win32' | 'darwin' | 'linux' | 'other';

function currentPlatform(): Platform {
  return process.platform as Platform;
}

/** 跨平台读取剪贴板内容(同步,失败返回空字符串) */
export function readClipboard(): string {
  try {
    const platform = currentPlatform();
    if (platform === 'win32') {
      // PowerShell Get-Clipboard 返回纯文本(-Format Text 避免 RTF)
      // PowerShell 会附加尾部 \r\n,需 trimEnd 保持往返一致
      const r = spawnSync('powershell.exe', ['-NoProfile', '-Command', 'Get-Clipboard -Format Text'], {
        encoding: 'utf-8',
        windowsHide: true,
        timeout: 5000,
      });
      if (r.error || r.status !== 0) return '';
      return (r.stdout ?? '').replace(/\r\n$/, '').slice(0, MAX_CLIPBOARD_CHARS);
    }
    if (platform === 'darwin') {
      const r = spawnSync('pbpaste', [], {
        encoding: 'utf-8',
        windowsHide: true,
        timeout: 5000,
      });
      if (r.error || r.status !== 0) return '';
      return (r.stdout ?? '').slice(0, MAX_CLIPBOARD_CHARS);
    }
    if (platform === 'linux') {
      // 优先 xclip,fallback xsel
      const r = spawnSync('xclip', ['-selection', 'clipboard', '-o'], {
        encoding: 'utf-8',
        windowsHide: true,
        timeout: 5000,
      });
      if (!r.error && r.status === 0) {
        return (r.stdout ?? '').slice(0, MAX_CLIPBOARD_CHARS);
      }
      const r2 = spawnSync('xsel', ['--clipboard', '--output'], {
        encoding: 'utf-8',
        windowsHide: true,
        timeout: 5000,
      });
      if (!r2.error && r2.status === 0) {
        return (r2.stdout ?? '').slice(0, MAX_CLIPBOARD_CHARS);
      }
      return '';
    }
    return '';
  } catch {
    return '';
  }
}

/** 跨平台写入剪贴板内容(同步,失败返回 false) */
export function writeClipboard(text: string): boolean {
  try {
    const platform = currentPlatform();
    const input = text.slice(0, MAX_CLIPBOARD_CHARS);
    if (platform === 'win32') {
      // PowerShell Set-Clipboard 接受 stdin 管道输入
      const r = spawnSync('powershell.exe', ['-NoProfile', '-Command', '$input | Set-Clipboard'], {
        input,
        encoding: 'utf-8',
        windowsHide: true,
        timeout: 5000,
      });
      return !r.error && r.status === 0;
    }
    if (platform === 'darwin') {
      const r = spawnSync('pbcopy', [], {
        input,
        encoding: 'utf-8',
        windowsHide: true,
        timeout: 5000,
      });
      return !r.error && r.status === 0;
    }
    if (platform === 'linux') {
      // 优先 xclip,fallback xsel
      const r = spawnSync('xclip', ['-selection', 'clipboard'], {
        input,
        encoding: 'utf-8',
        windowsHide: true,
        timeout: 5000,
      });
      if (!r.error && r.status === 0) return true;
      const r2 = spawnSync('xsel', ['--clipboard', '--input'], {
        input,
        encoding: 'utf-8',
        windowsHide: true,
        timeout: 5000,
      });
      return !r2.error && r2.status === 0;
    }
    return false;
  } catch {
    return false;
  }
}

/** 检测当前平台是否有可用的剪贴板工具(用于测试跳过 + 友好错误) */
export function isClipboardAvailable(): boolean {
  const platform = currentPlatform();
  if (platform === 'win32' || platform === 'darwin') return true;
  if (platform === 'linux') {
    // 检测 xclip 或 xsel 是否存在
    const xclip = spawnSync('which', ['xclip'], { encoding: 'utf-8', windowsHide: true, timeout: 2000 });
    if (!xclip.error && xclip.status === 0 && (xclip.stdout ?? '').trim().length > 0) return true;
    const xsel = spawnSync('which', ['xsel'], { encoding: 'utf-8', windowsHide: true, timeout: 2000 });
    if (!xsel.error && xsel.status === 0 && (xsel.stdout ?? '').trim().length > 0) return true;
    return false;
  }
  return false;
}

/** clipboard_read 工具:读取系统剪贴板文本 */
export const clipboard_read: Tool = {
  name: 'clipboard_read',
  description: '读取系统剪贴板的纯文本内容(用于"分析用户刚复制的错误"等场景)。',
  dangerLevel: 'read',
  parameters: {},
  required: [],
  async execute(): Promise<ToolResult> {
    if (!isClipboardAvailable()) {
      return {
        success: false,
        output: '',
        error: '当前平台无可用剪贴板工具(Windows/macOS 内置;Linux 需安装 xclip 或 xsel)',
      };
    }
    const text = readClipboard();
    if (!text) {
      return {
        success: true,
        output: '(剪贴板为空或读取失败)',
      };
    }
    const truncated = text.length > MAX_CLIPBOARD_CHARS;
    const note = truncated ? `\n[已截断,原始长度 ${text.length} 字符,显示前 ${MAX_CLIPBOARD_CHARS}]` : '';
    return {
      success: true,
      output: text + note,
    };
  },
};

/** clipboard_write 工具:写入文本到系统剪贴板 */
export const clipboard_write: Tool = {
  name: 'clipboard_write',
  description: '把文本写入系统剪贴板(覆盖现有内容)。',
  dangerLevel: 'write',
  parameters: {
    text: { type: 'string', description: '要写入剪贴板的文本(必填)' },
  },
  required: ['text'],
  async execute(args): Promise<ToolResult> {
    const text = args.text as string;
    if (typeof text !== 'string') {
      return { success: false, output: '', error: '缺少 text 参数(必须是字符串)' };
    }
    if (!isClipboardAvailable()) {
      return {
        success: false,
        output: '',
        error: '当前平台无可用剪贴板工具(Windows/macOS 内置;Linux 需安装 xclip 或 xsel)',
      };
    }
    const ok = writeClipboard(text);
    if (!ok) {
      return { success: false, output: '', error: '写入剪贴板失败(可能无权限或工具异常)' };
    }
    return {
      success: true,
      output: `已写入 ${text.length} 字符到剪贴板`,
    };
  },
};

export const CLIPBOARD_TOOLS: Tool[] = [clipboard_read, clipboard_write];
