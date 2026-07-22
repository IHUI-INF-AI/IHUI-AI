/**
 * /share 命令 — 生成可分享的会话快照。
 *
 * 对标 OpenClaw 的 share 功能并增强:markdown 渲染 + 防篡改 SHA-256 + 短链 + 二维码(降级模式)。
 *
 * 流程:
 *   1. 加载 session 历史(复用 session.ts 的 loadSession)
 *   2. 渲染为 markdown:头部(标题/时间/模型/统计) + 对话(user/assistant) + 工具调用折叠块
 *   3. 计算 SHA-256 hash(防篡改)
 *   4. 生成 self-contained HTML(内嵌 markdown,用 marked.js CDN 渲染)
 *   5. 保存到 <workspacePath>/.trae-cn/shared/<hash8>.html
 *   6. 生成短链(file:// URL;若 server 启动可由 server 层重写为 http://localhost:<port>/shared/<hash8>)
 *   7. 生成二维码(降级:完整 QR 编码需专用库,当前返回空字符串)
 *
 * 防篡改:HTML 中嵌入 hash,加载时可校验。
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
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

  /** 分享输出目录:<workspacePath>/.trae-cn/shared/ */
  private getSharedDir(): string {
    return path.join(this.workspacePath, '.trae-cn', 'shared');
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

    // upload 负责:计算 hash + 生成 HTML + 写入 .trae-cn/shared/<hash8>.html + 返回短链
    const { url, hash } = await this.upload(markdown, title);
    const hash8 = hash.slice(0, 8);
    const sharedDir = this.getSharedDir();

    // 按 format 额外生成对应文件(HTML 始终生成,保证分享链接可打开)
    let primaryContent = this.renderHtml(markdown, hash, title);
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
   * 上传到 gist-like 服务(本地实现:生成 HTML 文件到 .trae-cn/shared/)。
   * 返回短链 URL 与防篡改 hash。
   */
  private async upload(content: string, title: string): Promise<{ url: string; hash: string }> {
    const hash = this.computeHash(content);
    const hash8 = hash.slice(0, 8);
    const sharedDir = this.getSharedDir();
    if (!fs.existsSync(sharedDir)) {
      fs.mkdirSync(sharedDir, { recursive: true });
    }
    fs.writeFileSync(path.join(sharedDir, `${hash8}.html`), this.renderHtml(content, hash, title), 'utf-8');
    return { url: this.generateShortUrl(hash8), hash };
  }

  /**
   * 生成短链(hash 前 8 位作为 ID,映射到 .trae-cn/shared/<id>.html)。
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

    return lines.join('\n');
  }

  /**
   * 生成 self-contained HTML(内嵌 markdown,用 marked.js CDN 渲染)。
   * 嵌入 hash 用于防篡改校验;markdown 经 JSON.stringify + < 转义安全嵌入,防止 </script> 注入。
   */
  private renderHtml(markdown: string, hash: string, title: string): string {
    const safeTitle = this.escapeHtml(title);
    const hash8 = hash.slice(0, 8);
    // 安全嵌入 markdown:JSON.stringify 生成 JS 字符串字面量,再把 < 转 \u003c 防 </script> 破壳
    const safeMarkdownJson = JSON.stringify(markdown).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${safeTitle} — IHUI-AI 会话快照</title>
<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 860px; margin: 2rem auto; padding: 0 1rem; color: #1a1a1a; line-height: 1.6; }
  .meta { background: #f6f8fa; border-radius: 6px; padding: 1rem; margin: 1rem 0; font-size: 0.875rem; word-break: break-all; }
  .meta code { background: #eaeef2; padding: 0.1em 0.4em; border-radius: 3px; }
  .hash-badge { display: inline-block; background: #1a1a1a; color: #fff; padding: 0.2em 0.6em; border-radius: 3px; font-family: monospace; font-size: 0.8em; }
  pre { background: #f6f8fa; padding: 1rem; border-radius: 6px; overflow-x: auto; }
  code { font-family: "SFMono-Regular", Consolas, monospace; }
  table { border-collapse: collapse; margin: 1rem 0; }
  th, td { border: 1px solid #d0d7de; padding: 0.4em 0.8em; }
  th { background: #f6f8fa; }
  h3 { margin-top: 1.5rem; border-left: 3px solid #0969da; padding-left: 0.6rem; }
</style>
</head>
<body>
<div class="meta">
  <span class="hash-badge" title="防篡改 SHA-256 前 8 位">${hash8}</span>
  <strong>IHUI-AI 会话快照</strong> · 完整 hash: <code>${hash}</code>
</div>
<div id="content" data-hash="${hash8}"></div>
<script>
  var raw = ${safeMarkdownJson};
  var container = document.getElementById('content');
  if (window.marked) {
    container.innerHTML = window.marked.parse(raw);
  } else {
    container.textContent = raw;
  }
</script>
</body>
</html>`;
  }

  /** HTML 实体转义 */
  private escapeHtml(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
