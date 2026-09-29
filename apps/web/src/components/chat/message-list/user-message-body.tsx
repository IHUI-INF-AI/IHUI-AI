// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 用户气泡的正文渲染(D129,2026-09-29 立)。
//
// 病灶:发送侧把附件拍平成四种文本形态,而用户气泡是 `<p>{m.content}</p>` 纯文本
// ⇒ 用户自己上传的图在自己的气泡里显示成 `![photo.png](/uploads/…)` 源码。
//
// 为什么不用助手侧那个 markdown 渲染器(票面的"止血"写法):已入库的 G-825「消息级 markdown 边界」
// 有一条负例用例钉死"用户消息正文不经过 markdown 边界"(markdown 渲染异常不得带走整轮消息)。
// 这里因此**只渲染拆出来的附件**,正文一律保持纯文本原样 —— 既不再出现源码,也不把用户写的
// `*`/`_`/`#` 重新解释一遍。拆分逻辑在 `@ihui/shared/chat` 的 `splitUserMessageParts`(单一实现,
// RN/小程序将来接同一份,不在端内各算一遍)。
//
// 安全边界:URL 协议白名单在共享层判;白名单外的形态**不摘**,原文留在下面那个 `<p>` 里
// 照样看得见(计一个 `user-message-attachment-rejected` 记号供用例断言"没有被吞")。
// 本组件不 import 任何 markdown 渲染器 —— 这一条由 d129 用例的源码级锁钉住,防止有人"顺手"
// 把正文塞回 markdown 而把 G-825 的边界拆掉。
//
// 剩余半格(另票,已写在台账 D129 行):图片点开设 `onPreviewImage` 复用 D41 预览器 —— 目前
// 预览器宿主状态在 MessageItem 内按工具调用记账,还没有"用户附件"这一路;先渲染成可见图片,
// 不做"看不见的可点击"。
'use client'

import { useMemo } from 'react'

import { splitUserMessageParts } from '@ihui/shared/chat'

// 点开图片的唯一出口(与助手侧共用一份"外链开新窗 / 其余进面板"的判断)
import { openImageSource } from '@/lib/open-image-source'

export interface UserMessageBodyProps {
  content: string
  /** 供宿主与用例定位气泡内容区;命名沿用本目录 `message-*-${id}` 形态。 */
  testId?: string
}

export function UserMessageBody({ content, testId }: UserMessageBodyProps) {
  const parts = useMemo(() => splitUserMessageParts(content), [content])
  const hasBody = parts.text.trim().length > 0
  const nothingVisible =
    !hasBody &&
    parts.images.length === 0 &&
    parts.videos.length === 0 &&
    parts.codeBlocks.length === 0 &&
    parts.fileRefs.length === 0 &&
    parts.rejected === 0

  return (
    <div className="space-y-2" data-testid={testId}>
      {hasBody ? (
        // 与 G-825 的边界一致:这一行仍是纯文本 `<p>`,不经过任何 markdown 解析。
        <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">{parts.text}</p>
      ) : null}

      {parts.images.map((im, i) => (
        // 可点开:行为走唯一出口 `openImageSource`(与助手侧同一份判断),来源档位自带 'user-attachment-image'。
        // 无障碍名交给内层 <img alt>(不新增文案,也不在端内硬编码中文)。
        <button
          key={`${im.url}-${i}`}
          type="button"
          data-testid="user-message-image-button"
          onClick={() => openImageSource(im.url, 'user-attachment-image')}
          className="block max-w-full overflow-hidden rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
        >
          <img
            data-testid="user-message-image"
            src={im.url}
            alt={im.alt}
            className="max-h-64 w-full bg-muted object-contain"
          />
        </button>
      ))}

      {parts.videos.map((url, i) => (
        <video
          key={`${url}-${i}`}
          data-testid="user-message-video"
          src={url}
          controls
          className="max-h-64 w-full rounded-lg bg-muted"
        />
      ))}

      {parts.codeBlocks.map((code, i) => (
        <pre
          key={`code-${i}`}
          data-testid="user-message-code"
          className="overflow-x-auto rounded-lg bg-muted p-3 text-[13px] leading-relaxed"
        >
          <code>{code}</code>
        </pre>
      ))}

      {parts.fileRefs.map((label, i) => (
        <span
          key={`file-${label}-${i}`}
          data-testid="user-message-file"
          className="inline-flex max-w-full items-center rounded-md bg-muted px-2 py-1 text-xs leading-none tabular-nums"
        >
          {label}
        </span>
      ))}

      {/* 命中了附件形态但被判不安全/判不出:原文仍在上面那个 `<p>` 里可见,这里只留可判定记号 */}
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
