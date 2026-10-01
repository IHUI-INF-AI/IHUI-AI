// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 用户消息正文的"拍平附件"拆分(D129)。
 *
 * 病灶:发送侧 `apps/web/src/hooks/use-message-send.ts` 的 `doSend` 把附件拍平成四种文本形态
 * (`![label](url)` / `<video src="…" controls></video>` / fenced code block / `> 📎 label`),
 * 而用户气泡一直是 `<p className="whitespace-pre-wrap">{m.content}</p>` 纯文本渲染
 * ⇒ 用户自己上传的图片在他自己的气泡里显示成一行 `![photo.png](/uploads/…)` 源码。
 *
 * **2026-10-01 S15 拍板翻转**(承 V4 #87 止血步,取代上面"正文一律纯文本"的旧立场):
 * 正文(text)改走与助手侧**同一套 MarkdownStream**,但危险项天然关闭(该渲染器本就不用 rehype-raw,
 * 裸 HTML 不执行)。代价是 react-markdown 会**静默丢弃**裸 HTML —— 因此"判不出/不安全"的行
 * **不能再留在 text 里**(它们多是 `<video …>` 形态,留在 text 里等于消失):拆分层把它们
 * 收进 `rejectedLines` 返回,由调用方以**字面文本**渲染,"绝不静默消失"由这条新通道兑现。
 * 附件四类形态照旧从正文拆出各自渲染 —— 本层的职责没有变,变的是 text 的去向。
 *
 * 三条不可漂的判据:
 *  ① **只认整行的确切形态** —— 用户正文里讨论 `<video src="x" controls></video>` 写法的那段散文
 *     不许被动(那是替用户改稿);fenced block 必须是"整行 ``` 开 + 整行 ``` 闭"的配对块。
 *  ② URL 先过协议白名单;不合法(javascript: / data: / 其它协议)、URL 为空、标签为空、fence 不配对
 *     ⇒ **不摘**,原文留在正文里可见可寻,并计入 `rejected` —— 宁可不美化,也绝不把用户的东西变没了。
 *  ③ 拆出的顺序保留(界面按原顺序显示),四类各有计数,供用例断言"没有被吞"。
 *
 * 与发送侧形态的对应由本目录 `__tests__/user-message-parts.test.ts` 与
 * `apps/web/src/components/chat/__tests__/d129-user-message-body.test.tsx` 钉住:那边改形态这边必须同改。
 * 剩下的根治(另票):发送侧带**结构化附件字段**(渲染端不再从正文反解)+ 图片点开复用 D41 预览器。
 */

/** 发送侧产出的四种确切形态(全部按整行匹配)。 */
const IMAGE_LINE = /^!\[([^\]]*)\]\(([^)\s]+)\)[ \t]*$/
const VIDEO_LINE = /^<video src="([^"]*)" controls><\/video>[ \t]*$/
const FILE_REF_LINE = /^> 📎 (.+)$/
const FENCE = /^```[ \t]*$/

/** 引用回复块的起始行:`> 💬 {角色标签}:`(发送侧在正文末尾追加,角色标签已本地化)。
 *  标签用 `(.*)` 而非 `(.+?)`:发送侧理论上可能给出空标签(词包缺键时),那一块仍必须被摘出来
 *  而不是以 `> 💬 :` 的源码示人 —— 归到引用块并回落成兜底标签,比"看起来像坏掉的 Markdown"好。 */
const QUOTE_OPEN = /^> 💬 (.*):[ \t]*$/
const QUOTE_LINE = /^> ?(.*)$/

export interface UserMessageQuote {
  /** 发送侧写入的角色标签(如「用户」「助手」),本身来自词包,这里只透传不翻译。 */
  label: string
  lines: string[]
}

export interface UserMessageImage {
  alt: string
  url: string
}

export interface UserMessageParts {
  /** 摘走安全附件行之后剩下的用户正文(仍是纯文本,**不进 markdown 边界**)。 */
  text: string
  images: UserMessageImage[]
  videos: string[]
  /** 超长粘贴展开的 fenced block 正文(不含围栏本身)。 */
  codeBlocks: string[]
  /** 普通文件/文本引用的标签(`> 📎 label` 里的 label)。 */
  fileRefs: string[]
  /** 引用回复(D22 的 quotedMessage)整块;不拆则它会以 `> 💬 …` 的 Markdown 源码露在气泡里。 */
  quote?: UserMessageQuote
  /**
   * 命中形态但**没被摘走**的行数(协议不合法 / URL 空 / 标签空 / fence 不配对)。
   * 必须"看得见",不得被读成"没有附件"。
   */
  rejected: number
  /**
   * 上面那些被拒行的**字面原文**(与 `rejected` 一一对应,顺序保留)。
   * 2026-10-01 S15 起它们**不再留在 `text` 里**:text 要交给 MarkdownStream 渲染,
   * 而裸 HTML 会被 react-markdown 静默丢弃 —— 原文可见性改由调用方对本数组按字面渲染兑现。
   * (未命中任何确切形态的散文**不进**这里,照旧留在 `text`。)
   */
  rejectedLines: string[]
}

/** 只放行 `blob:`、同源绝对路径、http(s);其余一律不渲染成元素(原文留作可见文本)。 */
export function safeMediaUrl(raw: string): string | null {
  const url = raw.trim()
  if (url.length === 0) return null
  if (url.startsWith('blob:')) return url
  if (url.startsWith('/')) return url
  if (/^https?:\/\//i.test(url)) return url
  return null
}

export function splitUserMessageParts(content: string): UserMessageParts {
  const images: UserMessageImage[] = []
  const videos: string[] = []
  const codeBlocks: string[] = []
  const fileRefs: string[] = []
  const rejectedLines: string[] = []
  let quote: UserMessageQuote | undefined
  let rejected = 0

  const lines = content.split('\n')
  const kept: string[] = []
  let i = 0
  while (i < lines.length) {
    // `noUncheckedIndexedAccess` 下 `lines[i]` 是 `string | undefined`;循环条件已保证存在,
    // 这里显式收成 string 而不是加非空断言(本仓类型层禁止用 `!` 糊推断)。
    const line = lines[i] ?? ''

    if (FENCE.test(line)) {
      const closeIdx = lines.findIndex((l, k) => k > i && FENCE.test(l))
      if (closeIdx < 0) {
        // 不配对的围栏不猜它到哪儿结束 ⇒ 摘出待字面渲染(可见),只记一笔未摘
        rejected += 1
        rejectedLines.push(line)
        i += 1
        continue
      }
      codeBlocks.push(lines.slice(i + 1, closeIdx).join('\n'))
      i = closeIdx + 1
      continue
    }

    const img = IMAGE_LINE.exec(line)
    if (img) {
      const url = safeMediaUrl(img[2] ?? '')
      if (!url) {
        rejected += 1
        rejectedLines.push(line)
      } else images.push({ alt: (img[1] ?? '').trim(), url })
      i += 1
      continue
    }

    const vid = VIDEO_LINE.exec(line)
    if (vid) {
      const url = safeMediaUrl(vid[1] ?? '')
      if (!url) {
        rejected += 1
        rejectedLines.push(line)
      } else videos.push(url)
      i += 1
      continue
    }

    // 引用回复块:起始行 `> 💬 角色:` + 其后连续 `> …` 行(D22 的 quotedMessage 拍平形态)。
    // 刻意不吞 `> 📎` 那类附件/参考行(语义不同,混进来会让两块互相伪装),也不跨空行合并。
    const qopen = QUOTE_OPEN.exec(line)
    if (qopen) {
      // 一条消息按发送侧只会有一个引用块;**第二个块不再摘**(只保留第一块),
      // 否则后写覆盖前写 = 用户引用的内容静默消失(比"显示成源码"更糟)。
      if (quote !== undefined) {
        kept.push(line)
        i += 1
        continue
      }
      const rawLabel = (qopen[1] ?? '').trim()
      const collected: string[] = []
      let k = i + 1
      while (k < lines.length) {
        const nl = lines[k] ?? ''
        if (FILE_REF_LINE.test(nl) || QUOTE_OPEN.test(nl)) break
        const m = QUOTE_LINE.exec(nl)
        if (!m) break
        collected.push(m[1] ?? '')
        k += 1
      }
      quote = { label: rawLabel.length > 0 ? rawLabel : '引用', lines: collected }
      i = k
      continue
    }

    const ref = FILE_REF_LINE.exec(line)
    if (ref) {
      const label = (ref[1] ?? '').trim()
      if (label.length === 0) {
        rejected += 1
        rejectedLines.push(line)
      } else fileRefs.push(label)
      i += 1
      continue
    }

    kept.push(line)
    i += 1
  }

  const extractedSomething =
    images.length + videos.length + codeBlocks.length + fileRefs.length > 0 ||
    rejectedLines.length > 0 ||
    quote !== undefined
  // 摘走行会留下连续空行;只在确实摘走过时收敛,不碰用户自己写的空行。
  const text = extractedSomething
    ? kept
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/^\n+/, '')
        .replace(/\n+$/, '')
    : content

  return { text, images, videos, codeBlocks, fileRefs, quote, rejected, rejectedLines }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
