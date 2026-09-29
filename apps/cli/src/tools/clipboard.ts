// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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

/**
 * 一次裁剪的产出:留下的文本 **+ 丢掉了多少字**。
 *
 * 立票理由(2026-09-29,票 B):本文件原有 5 处 `.slice(0, MAX_CLIPBOARD_CHARS)`
 * (读 4 处 / 写 1 处),剪完就丢,**不报丢了多少** —— 而"被裁"与"本来就这么长"在
 * 消费方(模型与操作员)眼里长得一模一样。上游同一维的做法是直接打印
 * `bytesRead/sizeBytes (truncated)`(`commands-command.ts:167`、`skills-command.ts:162`)。
 * 现在裁剪只有一个出口,溢出量随结果一起返回;未溢出时 `droppedChars` 恒为 0,
 * 提示语按 0 早退 ⇒ **不裁就不报**(成对用例各钉一条)。
 */
export interface ClipboardClipOutcome {
  readonly text: string;
  readonly droppedChars: number;
  readonly truncated: boolean;
}

/** 裁剪的**唯一**出口:截到上限并如实回报丢弃量(绝不再在别处手搓 slice)。 */
export function clipToClipboardBudget(raw: string): ClipboardClipOutcome {
  const text = raw.slice(0, MAX_CLIPBOARD_CHARS);
  const droppedChars = Math.max(0, raw.length - text.length);
  return { text, droppedChars, truncated: droppedChars > 0 };
}

/**
 * 裁剪提示语的唯一模板(读/写两路共用一份)。`droppedChars === 0` 时返回空串 ⇒ 不报。
 * 只留这一句中文常量:两处各写一遍必然漂开,而本文件的硬编码中文额度(守门 70)也只容得下一句。
 */
export function clipboardTruncationNote(originalChars: number, droppedChars: number): string {
  if (droppedChars <= 0) return '';
  return `\n[已截断,原始长度 ${originalChars} 字符,保留 ${MAX_CLIPBOARD_CHARS} 字符,丢弃 ${droppedChars} 字]`;
}

/** 读剪贴板的完整结果(含丢弃量);失败/无内容 ⇒ 空文本、零丢弃。 */
export type ClipboardReadOutcome = ClipboardClipOutcome;

const EMPTY_CLIP: ClipboardReadOutcome = { text: '', droppedChars: 0, truncated: false };

/** 跨平台读取剪贴板内容(同步,失败返回空字符串)+ 如实回报被裁掉的字数 */
export function readClipboardExcerpt(): ClipboardReadOutcome {
  try {
    const platform = currentPlatform();
    if (platform === 'win32') {
      // PowerShell Get-Clipboard 返回纯文本(-Format Text 避免 RTF)
      // PowerShell 会附加尾部 \r\n,需 trimEnd 保持往返一致
      const r = spawnSync('pwsh.exe', ['-NoProfile', '-Command', 'Get-Clipboard -Format Text'], {
        encoding: 'utf-8',
        windowsHide: true,
        timeout: 5000,
      });
      if (r.error || r.status !== 0) return EMPTY_CLIP;
      return clipToClipboardBudget((r.stdout ?? '').replace(/\r\n$/, ''));
    }
    if (platform === 'darwin') {
      const r = spawnSync('pbpaste', [], {
        encoding: 'utf-8',
        windowsHide: true,
        timeout: 5000,
      });
      if (r.error || r.status !== 0) return EMPTY_CLIP;
      return clipToClipboardBudget(r.stdout ?? '');
    }
    if (platform === 'linux') {
      // 优先 xclip,fallback xsel
      const r = spawnSync('xclip', ['-selection', 'clipboard', '-o'], {
        encoding: 'utf-8',
        windowsHide: true,
        timeout: 5000,
      });
      if (!r.error && r.status === 0) {
        return clipToClipboardBudget(r.stdout ?? '');
      }
      const r2 = spawnSync('xsel', ['--clipboard', '--output'], {
        encoding: 'utf-8',
        windowsHide: true,
        timeout: 5000,
      });
      if (!r2.error && r2.status === 0) {
        return clipToClipboardBudget(r2.stdout ?? '');
      }
      return EMPTY_CLIP;
    }
    return EMPTY_CLIP;
  } catch {
    return EMPTY_CLIP;
  }
}

/** 跨平台读取剪贴板内容(同步,失败返回空字符串)—— 签名逐字不变,细节走 `readClipboardExcerpt` */
export function readClipboard(): string {
  return readClipboardExcerpt().text;
}

/** 写剪贴板的完整结果:成功位 + 因超出上限而被丢弃的字数 */
export interface ClipboardWriteOutcome {
  readonly ok: boolean;
  readonly droppedChars: number;
  readonly truncated: boolean;
}

/** 跨平台写入剪贴板内容(同步,失败返回 false)+ 如实回报被裁掉的字数 */
export function writeClipboardWithOutcome(text: string): ClipboardWriteOutcome {
  // 裁剪只走唯一出口:先算出丢弃量,再把它随结果一起带出去(写路径同样是"静默变短"的发生地)
  const clip = clipToClipboardBudget(text);
  const input = clip.text;
  const fail = (): ClipboardWriteOutcome => ({ ok: false, droppedChars: clip.droppedChars, truncated: clip.truncated });
  try {
    const platform = currentPlatform();
    if (platform === 'win32') {
      // PowerShell Set-Clipboard 接受 stdin 管道输入
      const r = spawnSync('pwsh.exe', ['-NoProfile', '-Command', '$input | Set-Clipboard'], {
        input,
        encoding: 'utf-8',
        windowsHide: true,
        timeout: 5000,
      });
      return { ok: !r.error && r.status === 0, droppedChars: clip.droppedChars, truncated: clip.truncated };
    }
    if (platform === 'darwin') {
      const r = spawnSync('pbcopy', [], {
        input,
        encoding: 'utf-8',
        windowsHide: true,
        timeout: 5000,
      });
      return { ok: !r.error && r.status === 0, droppedChars: clip.droppedChars, truncated: clip.truncated };
    }
    if (platform === 'linux') {
      // 优先 xclip,fallback xsel
      const r = spawnSync('xclip', ['-selection', 'clipboard'], {
        input,
        encoding: 'utf-8',
        windowsHide: true,
        timeout: 5000,
      });
      if (!r.error && r.status === 0) return { ok: true, droppedChars: clip.droppedChars, truncated: clip.truncated };
      const r2 = spawnSync('xsel', ['--clipboard', '--input'], {
        input,
        encoding: 'utf-8',
        windowsHide: true,
        timeout: 5000,
      });
      return { ok: !r2.error && r2.status === 0, droppedChars: clip.droppedChars, truncated: clip.truncated };
    }
    return fail();
  } catch {
    return fail();
  }
}

/** 跨平台写入剪贴板内容(同步,失败返回 false)—— 签名逐字不变,细节走 `writeClipboardWithOutcome` */
export function writeClipboard(text: string): boolean {
  return writeClipboardWithOutcome(text).ok;
}

/** 检测当前平台是否有可用的剪贴板工具(用于测试跳过 + 友好错误) */
export function isClipboardAvailable(): boolean {
  const platform = currentPlatform();
  if (platform === 'win32') {
    // Windows 需要 pwsh.exe(PowerShell Core) 或 powershell.exe(标准 Windows PowerShell)
    // 优先检测 pwsh.exe, 再检测 powershell.exe
    const pwsh = spawnSync('where', ['pwsh.exe'], { encoding: 'utf-8', windowsHide: true, timeout: 2000 });
    if (!pwsh.error && pwsh.status === 0) return true;
    const ps = spawnSync('where', ['powershell.exe'], { encoding: 'utf-8', windowsHide: true, timeout: 2000 });
    return !ps.error && ps.status === 0;
  }
  if (platform === 'darwin') return true;
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
    const clip = readClipboardExcerpt();
    const text = clip.text;
    if (!text) {
      return {
        success: true,
        output: '(剪贴板为空或读取失败)',
      };
    }
    // 裁剪必须自报丢了多少(票 B):未溢出时 note 为空串 ⇒ 输出与改前逐字相同
    const originalChars = text.length + clip.droppedChars;
    const note = clipboardTruncationNote(originalChars, clip.droppedChars);
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
    const written = writeClipboardWithOutcome(text);
    if (!written.ok) {
      return { success: false, output: '', error: '写入剪贴板失败(可能无权限或工具异常)' };
    }
    // 裁剪必须自报丢了多少(票 B):写路径也在唯一裁剪出口上,超长部分同样要点名。
    // 未溢出 ⇒ note 为空串 ⇒ 输出与改前逐字相同(既有回归以 toContain('已写入') 断言)。
    const note = clipboardTruncationNote(text.length, written.droppedChars);
    return {
      success: true,
      output: `已写入 ${text.length} 字符到剪贴板${note}`,
    };
  },
};

export const CLIPBOARD_TOOLS: Tool[] = [clipboard_read, clipboard_write];
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
