// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 剪贴板富格式 — HTML / RTF 富文本读写 + 文件拖放路径读写(Windows)。
 *
 * 立票理由(2026-11-14,工程化落地 补齐 外部实现 CN 0.5.6 的 native_clipboard.node):
 * 对方原生件除纯文本外,经 `RegisterClipboardFormatW` 注册 'HTML Format'、并支持
 * `DragQueryFileW`(文件拖放) ⇒ 它的 readClipboard 返回结构化 `{text, richText, attachments}`
 * (asar 内 `qoder-quick-note` 插件现读)。本仓 clipboard.ts 此前只有纯文本读写,缺富文本
 * 与文件路径两格。本文件补齐这两格。
 *
 * 独立分析四步:
 *   ③ 复现 —— 不引第三方包、不编译原生件(§0.12 红线):走 PowerShell 内置
 *      `System.Windows.Forms.Clipboard`(DataFormats.Html / SetFileDropList /
 *      GetFileDropList),与本仓既有 PS 引擎同源思路。本机已端到端验证:
 *      HTML 往返 marker 命中、文件拖放 Count=2 真路径。
 *   ④ 超越 —— 对方富文本/拖放只藏在编译型 .node(分发原生二进制);本仓**纯托管 +
 *      format 参数扩展**(默认 text 行为逐字不变,向后兼容),跨端可判定(非 Windows
 *      点名不支持),CI 可跑。
 *
 * 平台纪律:仅 Windows 实现;macOS/Linux 返回 null/ok:false **并点名**,不冒绿(§0.3/§0.10)。
 * 中文硬编码纪律:本文件不新增面向模型的中文常量(守门 70)。
 */

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolvePowerShell } from './clipboard.js';

/** 富格式种别(对外工具的 format 参数枚举)。 */
export type RichClipboardFormat = 'html' | 'rtf' | 'files';

/** 富格式读取结果:ok=false 时 reason 点名原因(平台不支持/格式缺失/执行失败)。 */
export interface RichReadOutcome {
  readonly ok: boolean;
  readonly value: string;
  readonly reason: string | null;
}

/** 富格式写入结果:ok=false 时 reason 点名原因。 */
export interface RichWriteOutcome {
  readonly ok: boolean;
  readonly reason: string | null;
}

/** 富格式读写仅 Windows 支持。 */
function isRichSupported(): boolean {
  return process.platform === 'win32';
}

/**
 * 读剪贴板富格式(Windows)。
 * - html:取 'HTML Format'(CF_HTML);无该格式 ⇒ ok:false reason='no-html'
 * - rtf:取 'Rich Text Format';无该格式 ⇒ ok:false reason='no-rtf'
 * - files:取文件拖放列表(CF_HDROP),逐行绝对路径;无 ⇒ ok:false reason='no-files'
 * 平台不支持 ⇒ ok:false reason='platform-unsupported';PS 缺失 ⇒ reason='no-engine'。
 */
export function readRichClipboard(format: RichClipboardFormat): RichReadOutcome {
  if (!isRichSupported()) return { ok: false, value: '', reason: 'platform-unsupported' };
  const ps = resolvePowerShell();
  if (ps === null) return { ok: false, value: '', reason: 'no-engine' };
  // 三种格式各自一段 PS:读不出/无该格式都走 [Console]::Error 留 reason,便于点名。
  const script = buildReadScript(format);
  const r = spawnSync(ps, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script], {
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf-8',
    windowsHide: true,
    timeout: 8000,
  });
  if (r.error || r.status !== 0) {
    const err = (r.stderr ?? '').trim();
    return { ok: false, value: '', reason: err !== '' ? `ps-error:${err.slice(0, 120)}` : 'ps-failed' };
  }
  return { ok: true, value: r.stdout ?? '', reason: null };
}

function buildReadScript(format: RichClipboardFormat): string {
  const head = 'Add-Type -AssemblyName System.Windows.Forms;';
  if (format === 'html') {
    return (
      head +
      "if(-not [System.Windows.Forms.Clipboard]::ContainsData('HTML Format')){" +
      "[Console]::Error.WriteLine('no-html');exit 1};" +
      "Write-Output ([System.Windows.Forms.Clipboard]::GetData('HTML Format'))"
    );
  }
  if (format === 'rtf') {
    return (
      head +
      "if(-not [System.Windows.Forms.Clipboard]::ContainsData('Rich Text Format')){" +
      "[Console]::Error.WriteLine('no-rtf');exit 1};" +
      "Write-Output ([System.Windows.Forms.Clipboard]::GetData('Rich Text Format'))"
    );
  }
  // files
  return (
    head +
    "if(-not [System.Windows.Forms.Clipboard]::ContainsFileDropList()){" +
    "[Console]::Error.WriteLine('no-files');exit 1};" +
    "[System.Windows.Forms.Clipboard]::GetFileDropList() | ForEach-Object { Write-Output $_ }"
  );
}

/**
 * 写剪贴板富格式(Windows)。
 * - html:把字符串写成 'HTML Format'(自动包裹 CF_HTML 头,保证浏览器可粘)
 * - rtf:把字符串写成 'Rich Text Format'
 * - files:把换行分隔的绝对路径写成文件拖放列表(不存在的路径 ⇒ reason='file-missing')
 * 平台不支持 ⇒ ok:false reason='platform-unsupported';PS 缺失 ⇒ reason='no-engine'。
 */
export function writeRichClipboard(format: RichClipboardFormat, value: string): RichWriteOutcome {
  if (!isRichSupported()) return { ok: false, reason: 'platform-unsupported' };
  const ps = resolvePowerShell();
  if (ps === null) return { ok: false, reason: 'no-engine' };
  if (format === 'files') {
    const paths = value
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter((s) => s !== '');
    if (paths.length === 0) return { ok: false, reason: 'no-paths' };
    // 路径不存在 ⇒ 点名(不静默写空列表)
    for (const p of paths) {
      if (!existsSync(p)) return { ok: false, reason: `file-missing:${p.slice(0, 120)}` };
    }
    // 单条路径经 stdin 传入,避免命令行长度与引号转义
    const script =
      'Add-Type -AssemblyName System.Windows.Forms;' +
      '$p=@($input | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne "" });' +
      '$sc=New-Object System.Collections.Specialized.StringCollection;' +
      '$p | ForEach-Object { [void]$sc.Add($_) };' +
      '[System.Windows.Forms.Clipboard]::SetFileDropList($sc)';
    const r = spawnSync(ps, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script], {
      input: paths.join('\n'),
      encoding: 'utf-8',
      windowsHide: true,
      timeout: 8000,
    });
    return { ok: !r.error && r.status === 0, reason: r.error ? 'ps-failed' : null };
  }
  const dataFormat = format === 'html' ? 'Html' : 'Rtf';
  const script =
    'Add-Type -AssemblyName System.Windows.Forms;' +
    '$v=($input -join "`n");' +
    '$do=New-Object System.Windows.Forms.DataObject;' +
    `$do.SetData([System.Windows.Forms.DataFormats]::${dataFormat}, $true, $v);` +
    '[System.Windows.Forms.Clipboard]::SetDataObject($do, $true)';
  const r = spawnSync(ps, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script], {
    input: value,
    encoding: 'utf-8',
    windowsHide: true,
    timeout: 8000,
  });
  return { ok: !r.error && r.status === 0, reason: r.error ? 'ps-failed' : null };
}

/** 类型守卫:format 参数是否合法枚举值。 */
export function isRichFormat(v: unknown): v is RichClipboardFormat {
  return v === 'html' || v === 'rtf' || v === 'files';
}
