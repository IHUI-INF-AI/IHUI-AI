// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 用户气泡的正文渲染(D129,2026-09-29 立;2026-10-01 S15 按 V4 #87 止血步翻转)。
//
// 病灶:发送侧把附件拍平成四种文本形态,而用户气泡是 `<p>{m.content}</p>` 纯文本
// ⇒ 用户自己上传的图在自己的气泡里显示成 `![photo.png](/uploads/…)` 源码。
//
// 2026-10-01 拍板(V4 #87 止血步):正文改走与助手侧**同一套** MarkdownStream ——
// 同一屏不再有两种保真度。危险项天然关闭:MarkdownStream 本就不挂 rehype-raw,
// 用户贴的裸 HTML 不执行、不渲染。拆分逻辑仍在 `@ihui/shared/chat` 的
// `splitUserMessageParts`(单一实现,RN/小程序将来接同一份,不在端内各算一遍)。
//
// 安全边界:URL 协议白名单在共享层判;**被判不安全的行由共享层摘进 `rejectedLines`**、
// 不再留在 text 里 —— 因为 react-markdown 会静默丢弃裸 HTML,留在 text 里等于消失。
// 这里把它们按字面文本渲染(可见、不解释、不可执行),并保留 `user-message-attachment-rejected`
// 记号供用例断言"没有被吞"。正文里"讨论这些写法"的散文不命中确切形态,随 text 一起
// 进 MarkdownStream —— 裸 HTML 片段在散文里的显示行为与助手侧完全一致(同渲染器)。
//
// 剩余半格(另票,已写在台账 D129 行):图片点开设 `onPreviewImage` 复用 D41 预览器 —— 目前
// 预览器宿主状态在 MessageItem 内按工具调用记账,还没有"用户附件"这一路;先渲染成可见图片,
// 不做"看不见的可点击"。
'use client'

import { useMemo, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

import { MarkdownStream } from '@/components/ai/markdown-stream'
import { splitUserMessageParts } from '@ihui/shared/chat'
import { maskSecretsForDisplay } from '@ihui/shared/utils/redact'

// 点开图片的唯一出口(与助手侧共用一份"外链开新窗 / 其余进面板"的判断)
import { openImageSource } from '@/lib/open-image-source'
// 外部 http(s) 图片经同源代理走 /api/media/image,满足收窄后的 CSP img-src
import { toMediaImageUrl, toMediaStreamUrl } from '@/lib/media-proxy'

export interface UserMessageBodyProps {
  content: string
  /** 供宿主与用例定位气泡内容区;命名沿用本目录 `message-*-${id}` 形态。 */
  testId?: string
  /**
   * 显示面凭据遮挡的展开/收起按钮文案(由宿主注入 i18n)。
   * 不传 = 只遮挡、不提供展开 —— 组件自身不读 intl,既有纯渲染用例无需 Provider。
   */
  secretMaskLabels?: { show: string; hide: string }
}

export function UserMessageBody({ content, testId, secretMaskLabels }: UserMessageBodyProps) {
  const parts = useMemo(() => splitUserMessageParts(content), [content])
  const [secretsRevealed, setSecretsRevealed] = useState(false)
  const maskedText = useMemo(() => maskSecretsForDisplay(parts.text), [parts.text])
  const maskedCodeBlocks = useMemo(
    () => parts.codeBlocks.map((code) => maskSecretsForDisplay(code)),
    [parts.codeBlocks],
  )
  const maskedQuoteLines = useMemo(
    () => parts.quote?.lines.map((line) => maskSecretsForDisplay(line)) ?? [],
    [parts.quote],
  )
  const maskedRejectedLines = useMemo(
    () => parts.rejectedLines.map((line) => maskSecretsForDisplay(line)),
    [parts.rejectedLines],
  )
  const hasSecrets =
    maskedText !== parts.text ||
    maskedCodeBlocks.some((code, index) => code !== parts.codeBlocks[index]) ||
    maskedQuoteLines.some((line, index) => line !== parts.quote?.lines[index]) ||
    maskedRejectedLines.some((line, index) => line !== parts.rejectedLines[index])
  const reveal = secretsRevealed && hasSecrets
  const visibleText = reveal ? parts.text : maskedText
  const hasBody = visibleText.trim().length > 0
  const nothingVisible =
    !hasBody &&
    parts.quote === undefined &&
    parts.images.length === 0 &&
    parts.videos.length === 0 &&
    parts.codeBlocks.length === 0 &&
    parts.fileRefs.length === 0 &&
    parts.rejected === 0

  return (
    <div className="space-y-2" data-testid={testId}>
      {hasBody ? (
        // 2026-10-01 拍板:与助手侧同一渲染件(危险项天然关闭 —— 无 rehype-raw,裸 HTML 不执行)。
        // 完成态渲染,无流式;代码折叠沿用助手侧默认阈值,长粘贴不撑爆气泡。
        <MarkdownStream content={visibleText} />
      ) : null}

      {hasSecrets && secretMaskLabels ? (
        <button
          type="button"
          data-testid="user-message-secret-toggle"
          aria-pressed={secretsRevealed}
          onClick={() => setSecretsRevealed((value) => !value)}
          className="inline-flex items-center gap-1 rounded-sm px-2 py-1 text-label leading-none text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-stroke-focus"
        >
          {secretsRevealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          <span>{secretsRevealed ? secretMaskLabels.hide : secretMaskLabels.show}</span>
        </button>
      ) : null}

      {parts.quote ? (
        // 引用回复(D22 的 quotedMessage 拍平形态)。不拆的话它会以 `> 💬 角色:` + `> …` 的
        // Markdown 源码露在气泡里 —— 与"附件显示成 ![...]" 是同一型缺陷,只是发送侧生产的另一种形态。
        // 左边框是**语义强调**(§4 允许的 border-l 情形),不是分割线;不新增文案,角色标签由发送侧本地化后带过来。
        <blockquote
          data-testid="user-message-quote"
          className="border-l-2 border-brand-accent-deep pl-3 text-body leading-relaxed text-muted-foreground"
        >
          <div className="mb-0.5 text-label font-medium">{parts.quote.label}</div>
          {parts.quote.lines.map((l, i) => (
            <div key={`q-${i}`}>{l.length > 0 ? (reveal ? l : (maskedQuoteLines[i] ?? l)) : ' '}</div>
          ))}
        </blockquote>
      ) : null}

      {parts.images.map((im, i) => (
        // 可点开:行为走唯一出口 `openImageSource`(与助手侧同一份判断),来源档位自带 'user-attachment-image'。
        // 无障碍名交给内层 <img alt>(不新增文案,也不在端内硬编码中文)。
        <button
          key={`${im.url}-${i}`}
          type="button"
          data-testid="user-message-image-button"
          onClick={() => openImageSource(im.url, 'user-attachment-image')}
          className="block max-w-full overflow-hidden rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-stroke-focus"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- 用户附件图是任意来源 URL(点开走 openImageSource 看原图),next/image 需要逐 host 配远程域名白名单,不属本处范围 */}
          <img
            data-testid="user-message-image"
            src={toMediaImageUrl(im.url)}
            alt={im.alt}
            className="max-h-64 w-full bg-muted object-contain"
          />
        </button>
      ))}

      {parts.videos.map((url, i) => (
        <video
          key={`${url}-${i}`}
          data-testid="user-message-video"
          src={toMediaStreamUrl(url)}
          controls
          className="max-h-64 w-full rounded-lg bg-muted"
        >
          {/* 用户上传视频无字幕源:空 captions track 仅为 a11y 合规,不改变播放行为 */}
          <track kind="captions" />
        </video>
      ))}

      {parts.codeBlocks.map((code, i) => (
        <pre
          key={`code-${i}`}
          data-testid="user-message-code"
          className="overflow-x-auto rounded-lg bg-muted p-3 text-[13px] leading-relaxed"
        >
          <code>{reveal ? code : (maskedCodeBlocks[i] ?? code)}</code>
        </pre>
      ))}

      {parts.fileRefs.map((label, i) => (
        <span
          key={`file-${label}-${i}`}
          data-testid="user-message-file"
          className="inline-flex max-w-full items-center rounded-md bg-muted px-2 py-1 text-label leading-none tabular-nums"
        >
          {label}
        </span>
      ))}

      {/* 命中了附件形态但被判不安全/判不出:共享层已把它们摘出 text(否则 MarkdownStream 会把
          裸 HTML 静默丢掉),这里按**字面文本**渲染 —— 可见、不解释、不可执行。 */}
      {parts.rejectedLines.map((line, i) => (
        <p
          key={`rejected-${i}`}
          data-testid="user-message-rejected"
          className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-muted-foreground"
        >
          {reveal ? line : (maskedRejectedLines[i] ?? line)}
        </p>
      ))}

      {/* 记号供用例断言"没有被吞" */}
      {parts.rejected > 0 ? (
        <span data-testid="user-message-attachment-rejected" className="sr-only">
          {String(parts.rejected)}
        </span>
      ) : null}

      {/* 完全空的正文(只有一条被摘走的确切形态且无其它内容)也要留锚点:整块空着会被读成
          "用户这条消息不见了",而不是"这条只有附件"。 */}
      {nothingVisible ? <span data-testid="user-message-empty" className="sr-only" /> : null}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
