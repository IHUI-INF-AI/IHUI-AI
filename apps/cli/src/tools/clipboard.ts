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
import { existsSync } from 'node:fs';
import * as path from 'node:path';
import type { Tool, ToolResult } from './index.js';
import { readRichClipboard, writeRichClipboard, isRichFormat } from './clipboard-rich.js';

/**
 * Windows 上可用的 PowerShell 引擎绝对路径(PS7 优先,Windows PowerShell 5.1 兜底)。
 * 判定与读写**同源**:isClipboardAvailable / readClipboardExcerpt /
 * writeClipboardWithOutcome 都只认这一个出口,不再出现"判定放行 powershell、
 * 执行只 spawn 'pwsh.exe'"导致只装 5.1 的机器上功能静默全灭。
 * 全绝对路径 + existsSync 预筛,不落 PATH 短名(防 PATH 被顶替)。
 */
export function resolvePowerShell(): string | null {
  const localAppData = process.env.LOCALAPPDATA ?? '';
  const candidates = [
    'C:\\Program Files\\PowerShell\\7\\pwsh.exe',
    ...(localAppData !== '' ? [path.join(localAppData, 'Microsoft', 'WindowsApps', 'pwsh.exe')] : []),
    'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return null;
}

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
      const ps = resolvePowerShell();
      if (ps === null) return EMPTY_CLIP;
      const r = spawnSync(ps, ['-NoProfile', '-Command', 'Get-Clipboard -Format Text'], {
        // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
        stdio: ['ignore', 'pipe', 'pipe'],
        encoding: 'utf-8',
        windowsHide: true,
        timeout: 5000,
      });
      if (r.error || r.status !== 0) return EMPTY_CLIP;
      return clipToClipboardBudget((r.stdout ?? '').replace(/\r\n$/, ''));
    }
    if (platform === 'darwin') {
      const r = spawnSync('pbpaste', [], {
        // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
        stdio: ['ignore', 'pipe', 'pipe'],
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
        // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
        stdio: ['ignore', 'pipe', 'pipe'],
        encoding: 'utf-8',
        windowsHide: true,
        timeout: 5000,
      });
      if (!r.error && r.status === 0) {
        return clipToClipboardBudget(r.stdout ?? '');
      }
      const r2 = spawnSync('xsel', ['--clipboard', '--output'], {
        // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
        stdio: ['ignore', 'pipe', 'pipe'],
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
      const ps = resolvePowerShell();
      if (ps === null) return fail();
      const r = spawnSync(ps, ['-NoProfile', '-Command', '$input | Set-Clipboard'], {
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
    // 判定与执行同源:只认 resolvePowerShell() 真正会 spawn 的那个引擎绝对路径。
    // 旧写法用 `where` 判 "pwsh 或 powershell"、执行却只 spawn 'pwsh.exe',
    // 只装 5.1 的机器判定 true、执行 ENOENT,剪贴板功能静默全灭。
    return resolvePowerShell() !== null;
  }
  if (platform === 'darwin') return true;
  if (platform === 'linux') {
    // 检测 xclip 或 xsel 是否存在
    const xclip = spawnSync('which', ['xclip'], {
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf-8',
      windowsHide: true,
      timeout: 2000,
    });
    if (!xclip.error && xclip.status === 0 && (xclip.stdout ?? '').trim().length > 0) return true;
    const xsel = spawnSync('which', ['xsel'], {
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf-8',
      windowsHide: true,
      timeout: 2000,
    });
    if (!xsel.error && xsel.status === 0 && (xsel.stdout ?? '').trim().length > 0) return true;
    return false;
  }
  return false;
}

/**
 * 剪贴板变更序号(Win32 `GetClipboardSequenceNumber`)。
 *
 * 立票理由(2026-11-14,逆向-复现-超越 对位 Qoder CN 0.5.6 的 `bin/native_clipboard.node`):
 * 对方原生件导出三接口 readClipboard / writeClipboard / getClipboardToken —— 第三枚对应
 * Win32 的剪贴板**变更序号**(每次剪贴板被改写都 +1),用于"不搬运全文就能判断内容变没变",
 * 让 Agent 轮询等用户复制新内容成为可能。本仓此前只有纯文本读写,缺这一格。
 *
 * 逆向四步:
 *   ③ 复现 —— 不引第三方包、不编译原生件(§0.12 红线):走 PowerShell 内置 `Add-Type`
 *      P/Invoke 调 user32,与本文件既有的 PS 引擎同源(`resolvePowerShell`),零新依赖。
 *   ④ 超越 —— 对方的 getClipboardToken 只藏在编译型 .node 里(要分发原生件);
 *      本仓做成独立工具 + 纯托管 P/Invoke,跨端可判定(非 Windows 返回 null 点名不支持),
 *      与 clipboard_read/write 共用同一引擎判定,可在 CI 里跑可用性断言。
 *
 * 返回:null = 当前平台无此能力(macOS/Linux 暂不实现,不冒绿);number = 当前序号。
 */
export function readClipboardToken(): number | null {
  const platform = currentPlatform();
  if (platform !== 'win32') return null;
  try {
    const ps = resolvePowerShell();
    if (ps === null) return null;
    // 序号源与读写同源:只认 resolvePowerShell 会 spawn 的那个引擎绝对路径。
    // Add-Type P/Invoke 调 user32!GetClipboardSequenceNumber(无参,返回 uint)。
    const r = spawnSync(
      ps,
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        "$s='[DllImport(\"user32.dll\")] public static extern uint GetClipboardSequenceNumber();';" +
          '$t=Add-Type -MemberDefinition $s -Name IHUIClipSeq -Namespace IHUI -PassThru;' +
          '$t::GetClipboardSequenceNumber()',
      ],
      { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf-8', windowsHide: true, timeout: 5000 },
    );
    if (r.error || r.status !== 0) return null;
    const n = Number.parseInt((r.stdout ?? '').trim(), 10);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
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

/** clipboard_token 工具:读剪贴板变更序号(不搬运全文,用于判断内容变没变/轮询等用户复制)。 */
export const clipboard_token: Tool = {
  name: 'clipboard_token',
  description:
    '读取系统剪贴板的变更序号(token):每次剪贴板被改写都 +1。用于不搬运全文就判断"内容变没变"或轮询等待用户复制新内容。当前仅 Windows 可用。',
  dangerLevel: 'read',
  parameters: {},
  required: [],
  async execute(): Promise<ToolResult> {
    // 平台不支持 ⇒ 点名返回,不冒绿(§0.3/§0.10)
    const token = readClipboardToken();
    if (token === null) {
      return {
        success: false,
        output: '',
        error: '当前平台不支持剪贴板变更序号(仅 Windows 可用;macOS/Linux 暂未实现)',
      };
    }
    return { success: true, output: String(token) };
  },
};

/** clipboard_rich_read 工具:读剪贴板富格式(HTML/RTF 富文本 或 文件拖放路径列表)。 */
export const clipboard_rich_read: Tool = {
  name: 'clipboard_rich_read',
  description:
    '读取系统剪贴板的富格式内容。format=html|rtf 返回富文本字符串;format=files 返回文件拖放路径列表(每行一个绝对路径)。当前仅 Windows 可用。',
  dangerLevel: 'read',
  parameters: {
    format: {
      type: 'string',
      description: '要读取的富格式:html(默认) | rtf | files',
    },
  },
  required: [],
  async execute(args): Promise<ToolResult> {
    const fmt = args.format === undefined ? 'html' : args.format;
    if (!isRichFormat(fmt)) {
      return { success: false, output: '', error: 'format 必须是 html | rtf | files 之一' };
    }
    const out = readRichClipboard(fmt);
    if (!out.ok) {
      // 平台不支持 / 引擎缺失 / 该格式不在剪贴板 / 执行失败,一律点名 reason,不冒绿
      return { success: false, output: '', error: `读取富格式失败(${out.reason ?? 'unknown'})` };
    }
    const value = out.value;
    if (value === '') return { success: true, output: '(剪贴板该格式为空)' };
    return { success: true, output: value };
  },
};

/** clipboard_rich_write 工具:写富格式到剪贴板(HTML/RTF 富文本 或 文件拖放路径列表)。 */
export const clipboard_rich_write: Tool = {
  name: 'clipboard_rich_write',
  description:
    '写入富格式到系统剪贴板。format=html|rtf 时 value 为富文本字符串;format=files 时 value 为换行分隔的绝对路径(路径必须存在)。当前仅 Windows 可用。',
  dangerLevel: 'write',
  parameters: {
    format: { type: 'string', description: '要写入的富格式:html(默认) | rtf | files' },
    value: { type: 'string', description: '富文本内容(format=html|rtf)或换行分隔的绝对路径(format=files)' },
  },
  required: ['value'],
  async execute(args): Promise<ToolResult> {
    const fmt = args.format === undefined ? 'html' : args.format;
    const value = args.value as string;
    if (!isRichFormat(fmt)) {
      return { success: false, output: '', error: 'format 必须是 html | rtf | files 之一' };
    }
    if (typeof value !== 'string' || value.trim() === '') {
      return { success: false, output: '', error: '缺少 value 参数(必须是字符串)' };
    }
    const out = writeRichClipboard(fmt, value);
    if (!out.ok) {
      return { success: false, output: '', error: `写入富格式失败(${out.reason ?? 'unknown'})` };
    }
    return { success: true, output: `已写入 ${fmt} 到剪贴板` };
  },
};

export const CLIPBOARD_TOOLS: Tool[] = [
  clipboard_read,
  clipboard_write,
  clipboard_token,
  clipboard_rich_read,
  clipboard_rich_write,
];// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
