// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * /share 命令 — 生成可分享的会话快照。
 *
 * 对标 OpenClaw 的 share 功能并增强:markdown 渲染 + 防篡改 SHA-256 + 短链 + 二维码(降级模式)。
 *
 * 流程:
 *   1. 加载 session 历史(复用 session.ts 的 loadSession)
 *   2. 渲染为 markdown:头部(标题/时间/模型/统计) + 对话(user/assistant) + 工具调用折叠块
 *   3. 计算 SHA-256 hash(防篡改)
 *   4. 生成 self-contained HTML:markdown 在**导出时**由本地受控子集渲染器转成 HTML 正文,
 *      页面零外部脚本 / 零外部样式 / 零外部图片(离线断网可读,见 utils/markdown-to-html.ts)
 *   5. 保存到 <workspacePath>/.ihui-agent/shared/<hash8>.html
 *   6. 生成短链(file:// URL;若 server 启动可由 server 层重写为 http://localhost:<port>/shared/<hash8>)
 *   7. 生成二维码(降级:完整 QR 编码需专用库,当前返回空字符串)
 *
 * 防篡改:HTML 内嵌页面自述的 SHA-256,加载时由页内脚本对「原始 Markdown」原文重算摘要并三态展示
 * (一致 / 不匹配 / **未判定**——无 WebCrypto 或输入缺失时不记绿也不冒红)。
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import {
  DOC_BG_CARD,
  DOC_BG_DARK,
  DOC_BG_HOVER,
  DOC_BORDER,
  DOC_BRAND,
  DOC_TEXT_BODY,
  DOC_TEXT_DARK,
  DOC_TEXT_MUTED,
  DOC_TEXT_STRONG,
  DOC_DANGER,
  RADIUS_CSS_PX,
} from '@ihui/design-tokens';
import { escapeHtml, renderMarkdownToHtml } from '../utils/markdown-to-html.js';
import { loadSession, type Session } from './session.js';

/** /share 选项 */
export interface ShareOptions {
  /** 输出格式,默认 markdown(仍会生成 HTML 用于分享链接) */
  format?: 'markdown' | 'html' | 'json';
  /** 是否包含工具调用块,默认 true */
  includeToolCalls?: boolean;
  /** 是否包含文件内容,默认 false(可能泄露敏感内容) */
  includeFiles?: boolean;
  /** 自定义标题 */
  title?: string;
}

/** /share 返回 */
export interface ShareResult {
  /** 本地短链 file:// 或 http://localhost:<port>/shared/<id> */
  url: string;
  /** 防篡改 SHA-256(完整 64 位 hex) */
  hash: string;
  /** 二维码 data URL(降级模式返回空字符串) */
  qrCode: string;
  /** 渲染好的 markdown 内容 */
  markdown: string;
  /** 生成的文件字节数 */
  sizeBytes: number;
}

/**
 * 生成 self-contained HTML。
 *
 * 零外链口径(与 WorkBuddy 自包含报告同型,并更进一步):
 *   - markdown 在**导出时**由 `utils/markdown-to-html.ts` 渲染成 HTML 正文,页面无需外部脚本即可读到内容;
 *   - 输出不含 `<script src=`、不含 `<link `,唯一的那段脚本是页内完整性自检(离线,不发请求);
 *   - 图片语法降级为文字引用,故分享页打开时对外零请求。
 *
 * 完整性:正文区携带 `data-sha256`(= 传入 markdown 的摘要),页内脚本对「原始 Markdown」文本重算比对;
 * 取不到输入或宿主无 WebCrypto 时显式显示「未判定」,不记绿也不冒红。
 */
export function renderShareHtml(markdown: string, hash: string, title: string): string {
  const safeTitle = escapeHtml(title);
  const safeMarkdown = escapeHtml(markdown);
  const hash8 = hash.slice(0, 8);
  const bodyHtml = renderMarkdownToHtml(markdown, { collapseLanguages: ['tool_call'] });
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${safeTitle} — IHUI-AI 会话快照</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 860px; margin: 2rem auto; padding: 0 1rem; color: ${DOC_TEXT_STRONG}; line-height: 1.6; }
  .meta { background: ${DOC_BG_CARD}; border-radius: ${RADIUS_CSS_PX.md}; padding: 1rem; margin: 1rem 0; font-size: 0.875rem; word-break: break-all; }
  .meta code { background: ${DOC_BG_HOVER}; padding: 0.1em 0.4em; border-radius: ${RADIUS_CSS_PX.xs}; }
  .hash-badge { display: inline-block; background: ${DOC_BG_DARK}; color: ${DOC_TEXT_DARK}; padding: 0.2em 0.6em; border-radius: ${RADIUS_CSS_PX.xs}; font-family: monospace; font-size: 0.8em; }
  .integrity { display: inline-block; margin-left: 0.5rem; font-size: 0.8em; color: ${DOC_TEXT_MUTED}; }
  .integrity-ok { color: ${DOC_BRAND}; }
  .integrity-fail { color: ${DOC_DANGER}; }
  pre { background: ${DOC_BG_CARD}; padding: 1rem; border-radius: ${RADIUS_CSS_PX.md}; overflow-x: auto; }
  code { font-family: "SFMono-Regular", Consolas, monospace; }
  table { border-collapse: collapse; margin: 1rem 0; }
  th, td { border: 1px solid ${DOC_BORDER}; padding: 0.4em 0.8em; }
  th { background: ${DOC_BG_CARD}; }
  .md-cell-center { text-align: center; }
  .md-cell-right { text-align: right; }
  h1, h2 { color: ${DOC_TEXT_STRONG}; }
  h3 { margin-top: 1.5rem; border-left: 3px solid ${DOC_BRAND}; padding-left: 0.6rem; }
  p, .md-list, .md-quote, .md-table { color: ${DOC_TEXT_BODY}; }
  .md-list { padding-left: 1.5rem; }
  .md-quote { background: ${DOC_BG_HOVER}; border-radius: ${RADIUS_CSS_PX.sm}; padding: 0.6rem 0.9rem; margin: 1rem 0; }
  .md-link { color: ${DOC_BRAND}; }
  .md-media-ref { color: ${DOC_TEXT_MUTED}; font-size: 0.9em; }
  .md-collapse summary { cursor: pointer; color: ${DOC_TEXT_MUTED}; font-size: 0.85rem; }
  .raw { margin-top: 2rem; }
  .raw summary { cursor: pointer; color: ${DOC_TEXT_MUTED}; font-size: 0.85rem; }
  .foot { margin: 2rem 0 1rem; color: ${DOC_TEXT_MUTED}; font-size: 0.8rem; }
</style>
</head>
<body>
<div class="meta">
  <span class="hash-badge">SHA-256 ${hash8}</span>
  <strong>IHUI-AI 会话快照</strong> · 完整 hash: <code>${escapeHtml(hash)}</code>
  <span class="integrity" id="integrity">完整性:未判定(等待校验)</span>
</div>
<main id="content" class="markdown" data-sha256="${escapeHtml(hash)}">${bodyHtml}</main>
<details class="raw"><summary>原始 Markdown(离线可读,亦是完整性校验基准)</summary><pre id="raw-markdown">${safeMarkdown}</pre></details>
<footer class="foot">离线自包含 · 无外部脚本 / 无外部样式 / 无外部图片请求(正文由本地受控子集渲染器在导出时生成)</footer>
<script>
(function () {
  var badge = document.getElementById('integrity');
  var content = document.getElementById('content');
  var raw = document.getElementById('raw-markdown');
  var expected = content ? String(content.getAttribute('data-sha256') || '') : '';
  function say(cls, text) { if (badge) { badge.className = 'integrity ' + cls; badge.textContent = text; } }
  if (!badge || !raw || !expected || !window.crypto || !window.crypto.subtle || !window.TextEncoder) {
    say('integrity', '完整性:未判定(此环境缺少校验输入或 WebCrypto)');
    return;
  }
  var digest = window.crypto.subtle.digest('SHA-256', new window.TextEncoder().encode(raw.textContent));
  window.Promise.resolve(digest).then(function (buf) {
    var bytes = new Uint8Array(buf), hex = '', i;
    for (i = 0; i < bytes.length; i += 1) { hex += (bytes[i] < 16 ? '0' : '') + bytes[i].toString(16); }
    if (hex === expected.toLowerCase()) { say('integrity-ok', '完整性:校验通过(SHA-256 一致)'); }
    else { say('integrity-fail', '完整性:不匹配(内容与快照 hash 不同,勿作为凭据)'); }
  }).catch(function () { say('integrity', '完整性:未判定(摘要计算失败)'); });
})();
</script>
</body>
</html>`;
}

/**
 * ShareManager — 生成可分享的会话快照。
 *
 * 用法:
 *   const mgr = new ShareManager(process.cwd());
 *   const result = await mgr.share(sessionId, { format: 'html' });
 *   console.info(result.url, result.hash);
 */
export class ShareManager {
  private readonly workspacePath: string;

  constructor(workspacePath: string) {
    this.workspacePath = workspacePath;
  }

  /** 分享输出目录:<workspacePath>/.ihui-agent/shared/ */
  private getSharedDir(): string {
    return path.join(this.workspacePath, '.ihui-agent', 'shared');
  }

  /**
   * /share [format=markdown] — 生成可分享的会话快照。
   * 无论 format 为何,都会额外生成 HTML 用于分享链接(file:// 短链指向 HTML)。
   */
  async share(sessionId: string, opts: ShareOptions = {}): Promise<ShareResult> {
    const format = opts.format ?? 'markdown';
    const includeToolCalls = opts.includeToolCalls !== false;
    const includeFiles = opts.includeFiles === true;

    const session = loadSession(sessionId);
    if (!session) {
      throw new Error(`会话不存在: ${sessionId}`);
    }

    const title = opts.title ?? this.deriveTitle(session);
    const markdown = this.renderMarkdown(session, title, includeToolCalls, includeFiles);

    // upload 负责:计算 hash + 生成 HTML + 写入 .ihui-agent/shared/<hash8>.html + 返回短链
    const { url, hash } = await this.upload(markdown, title);
    const hash8 = hash.slice(0, 8);
    const sharedDir = this.getSharedDir();

    // 按 format 额外生成对应文件(HTML 始终生成,保证分享链接可打开)
    let primaryContent = renderShareHtml(markdown, hash, title);
    if (format === 'markdown') {
      primaryContent = markdown;
      fs.writeFileSync(path.join(sharedDir, `${hash8}.md`), markdown, 'utf-8');
    } else if (format === 'json') {
      const json = JSON.stringify(
        { title, hash, session: { id: session.id, createdAt: session.createdAt, modelId: session.modelId }, markdown },
        null,
        2,
      );
      primaryContent = json;
      fs.writeFileSync(path.join(sharedDir, `${hash8}.json`), json, 'utf-8');
    }

    const qrCode = this.generateQRCode(url);

    return {
      url,
      hash,
      qrCode,
      markdown,
      sizeBytes: Buffer.byteLength(primaryContent, 'utf-8'),
    };
  }

  /**
   * 上传到 gist-like 服务(本地实现:生成 HTML 文件到 .ihui-agent/shared/)。
   * 返回短链 URL 与防篡改 hash。
   */
  private async upload(content: string, title: string): Promise<{ url: string; hash: string }> {
    const hash = this.computeHash(content);
    const hash8 = hash.slice(0, 8);
    const sharedDir = this.getSharedDir();
    if (!fs.existsSync(sharedDir)) {
      fs.mkdirSync(sharedDir, { recursive: true });
    }
    fs.writeFileSync(path.join(sharedDir, `${hash8}.html`), renderShareHtml(content, hash, title), 'utf-8');
    return { url: this.generateShortUrl(hash8), hash };
  }

  /**
   * 生成短链(hash 前 8 位作为 ID,映射到 .ihui-agent/shared/<id>.html)。
   * 本地实现返回 file:// URL;若 server 启动,server 层可重写为 http://localhost:<port>/shared/<id>。
   */
  private generateShortUrl(hash8: string): string {
    const filePath = path.join(this.getSharedDir(), `${hash8}.html`);
    return `file://${filePath.replace(/\\/g, '/')}`;
  }

  /**
   * 生成二维码(data URL)。
   * 完整 QR 编码(Reed-Solomon 纠错 + 掩码评估)需要专用 qr 库,当前不引入依赖,
   * 降级返回空字符串。主 agent 集成时若引入 qr 库可在此替换为真实 PNG data URL。
   */
  private generateQRCode(_url: string): string {
    // 二维码生成需要 qr 库,当前降级返回空字符串
    return '';
  }

  /** 计算内容 SHA-256(防篡改) */
  private computeHash(content: string): string {
    return crypto.createHash('sha256').update(content, 'utf-8').digest('hex');
  }

  /** 从会话首条 user 消息推导标题 */
  private deriveTitle(session: Session): string {
    const firstUser = session.history.find((m) => m.role === 'user');
    if (firstUser) {
      const preview = firstUser.content.replace(/\s+/g, ' ').trim().slice(0, 48);
      return preview || `会话 ${session.id}`;
    }
    return `会话 ${session.id}`;
  }

  /**
   * 渲染会话为 markdown。
   * 结构:头部信息表 + 对话(user/assistant)+ 工具调用折叠块。
   */
  private renderMarkdown(
    session: Session,
    title: string,
    includeToolCalls: boolean,
    includeFiles: boolean,
  ): string {
    const lines: string[] = [];
    const created = new Date(session.createdAt).toLocaleString('zh-CN');
    const updated = new Date(session.updatedAt).toLocaleString('zh-CN');
    const userCount = session.history.filter((m) => m.role === 'user').length;
    const assistantCount = session.history.filter((m) => m.role === 'assistant').length;
    const toolCallCount = session.history.filter((m) => m.content.includes('```tool_call')).length;

    // 头部
    lines.push(`# ${title}`);
    lines.push('');
    lines.push('> IHUI-AI 会话快照 · 防篡改 SHA-256 校验');
    lines.push('');
    lines.push('| 属性 | 值 |');
    lines.push('| --- | --- |');
    lines.push(`| 会话 ID | \`${session.id}\` |`);
    lines.push(`| 创建时间 | ${created} |`);
    lines.push(`| 更新时间 | ${updated} |`);
    lines.push(`| 模型 | ${session.modelId} |`);
    lines.push(`| 工作区 | \`${session.workspacePath}\` |`);
    lines.push(`| 消息数 | user: ${userCount} / assistant: ${assistantCount} |`);
    if (toolCallCount > 0) {
      lines.push(`| 工具调用 | ${toolCallCount} 次 |`);
    }
    lines.push('');
    lines.push('---');
    lines.push('');

    // 对话
    for (const msg of session.history) {
      // 系统消息默认不展示(避免泄露 system prompt)
      if (msg.role === 'system') continue;
      const roleLabel =
        msg.role === 'user' ? '🧑 **User**' : msg.role === 'assistant' ? '🤖 **Assistant**' : `**${msg.role}**`;
      let content = msg.content;
      // 工具调用折叠块:includeToolCalls=false 时隐藏
      if (!includeToolCalls && content.includes('```tool_call')) {
        content = content.replace(/```tool_call[\s\S]*?```/g, '_[工具调用已隐藏]_');
      }
      lines.push(`### ${roleLabel}`);
      lines.push('');
      lines.push(content);
      lines.push('');
    }

    if (!includeFiles) {
      lines.push('---');
      lines.push('');
      lines.push('_文件内容已省略(默认不包含,使用 includeFiles: true 开启)_');
      lines.push('');
    }

    // 换行归一:哈希、`.md` 文件、HTML 内 `<pre>` 原文三者必须逐字节同一,
    // 否则页内完整性校验会因 CRLF/LF 差异报"不匹配"(浏览器解析时已把 CRLF 归成 LF)。
    return lines.join('\n').replace(/\r\n?/g, '\n');
  }

}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
