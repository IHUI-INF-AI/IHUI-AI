// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { Check, Copy } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Button } from '@ihui/ui-react'
import type { Prism as PrismType } from 'react-syntax-highlighter'
// 语法高亮主题(对象常量,体积小,可静态导入;dark/light 两份同批导入,运行时按档切换)
// 形态照 src/components/ai/markdown-stream.tsx:74
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'

export interface CodeBlockProps {
  code: string
  language?: string
}

/**
 * 移除主题里的 background / backgroundColor,避免高亮块自带底色与卡片底色打架。
 * 出处:src/components/ai/markdown-stream.tsx:77-95(该实现是模块私有、未 export,
 * 本仓又禁高亮器自己注入卡片背景)⇒ 这是**第二份**,长期应提到 shared 层单一真相源
 * (AGENTS.md §0.6),交主席裁决;此处逐字同语义,不分叉行为。
 */
function stripBackground(
  style: Record<string, React.CSSProperties>,
): Record<string, React.CSSProperties> {
  const next: Record<string, React.CSSProperties> = {}
  for (const key of Object.keys(style)) {
    const value = style[key]
    if (value && typeof value === 'object') {
      const {
        background: _background,
        backgroundColor: _backgroundColor,
        ...rest
      } = value as React.CSSProperties
      next[key] = { ...rest, background: 'transparent', backgroundColor: 'transparent' }
      continue
    }
    next[key] = value as unknown as React.CSSProperties
  }
  return next
}

const ONE_DARK = stripBackground(oneDark)
const ONE_LIGHT = stripBackground(oneLight)

/**
 * 这些语言用纯文本渲染,不走 SyntaxHighlighter(避免无谓的 tokenize 开销)。
 * 出处:src/components/ai/markdown-stream.tsx:177 `PLAIN_TEXT_LANGS`(模块私有、未 export)
 * ⇒ 这是**第二份**,语义逐字一致;长期应与 `stripBackground` 一并提到 shared 层,交主席裁决。
 */
const PLAIN_TEXT_LANGS = new Set(['', 'text', 'plain', 'txt'])

type PrismComponent = typeof PrismType

// 懒加载(同 markdown-stream.tsx:109-115 的动机):refractor 的语言词法表不能进文档页入口包。
// 与 markdown-stream 的差别只在装载外壳——那边用 next/dynamic(ssr:false + loading:()=>null),
// 这里用裸 import() + 纯文本回退:文档页要 SSR(正文需可被抓取/无首屏空白),
// 且未就绪期间必须留住 <pre><code class="language-xxx"> 这层 DOM(markdown-body.test.tsx ② 钉的就是它)。
let prismLoader: Promise<PrismComponent> | null = null
function loadPrism(): Promise<PrismComponent> {
  if (prismLoader === null) prismLoader = import('react-syntax-highlighter').then((m) => m.Prism)
  return prismLoader
}

/**
 * 暗色档事实源 = `<html>` 的 `.dark` 类(next-themes ThemeProvider `attribute="class"` 写入,
 * 见 src/stores/theme.ts:23 注记)。取 class 而非 `resolvedTheme` 的理由与观察者写法照抄
 * src/hooks/use-desktop.ts:350-362:`resolvedTheme` 在 `theme='system'` 下首帧可能 undefined,
 * 而 class 是三条切题通路共同落到的那一个事实。服务端快照恒 light(水合后再纠偏,不闪空)。
 */
function subscribeHtmlClass(onStoreChange: () => void): () => void {
  const observer = new MutationObserver(onStoreChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  return () => {
    observer.disconnect()
  }
}
function readHtmlDark(): boolean {
  return document.documentElement.classList.contains('dark')
}
function readHtmlDarkOnServer(): boolean {
  return false
}

/**
 * 围栏代码块:语言角标 + 复制按钮 + 语法高亮(Prism,懒加载,亮/暗双档)。
 * props 签名是跨席契约(9 个 docs 页的 37 个裸 <pre> 正换成本组件),只能改内部、不可改签名。
 */
export function CodeBlock({ code, language }: CodeBlockProps): React.ReactElement {
  const tA11y = useTranslations('a11y')
  const [copied, setCopied] = React.useState(false)
  const timerRef = React.useRef<number | null>(null)
  const [Prism, setPrism] = React.useState<PrismComponent | null>(null)
  const isDark = React.useSyncExternalStore(subscribeHtmlClass, readHtmlDark, readHtmlDarkOnServer)

  React.useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    }
  }, [])

  React.useEffect(() => {
    let alive = true
    // 失败分支保持纯文本回退(高亮是可缺省的可读性增强,不是页面能否渲染的前提),故静默
    loadPrism().then(
      (component) => {
        // 存的是组件函数本身:setState(fn) 会被 React 当 updater 调用 ⇒ 必须包一层 () =>
        if (alive) setPrism(() => component)
      },
      () => {},
    )
    return () => {
      alive = false
    }
  }, [])

  // 复制结果在 promise 回调里落地,不读任何事件对象(§42 React 事件闭包陷阱)
  const handleCopy = React.useCallback(() => {
    navigator.clipboard
      ?.writeText(code)
      .then(() => {
        setCopied(true)
        if (timerRef.current !== null) window.clearTimeout(timerRef.current)
        timerRef.current = window.setTimeout(() => setCopied(false), 1500)
      })
      .catch(() => {})
  }, [code])

  const lang = (language ?? '').trim().toLowerCase()
  const isHighlighted = Prism !== null && !PLAIN_TEXT_LANGS.has(lang)

  return (
    <div className="my-4 overflow-hidden rounded-lg border border-border">
      <div className="flex items-center justify-between gap-2 bg-muted/50 px-3 py-1.5">
        <span
          data-testid="code-block-language"
          className="font-mono text-label text-muted-foreground"
        >
          {language ?? 'text'}
        </span>
        <Button size="xs" variant="ghost" onClick={handleCopy} aria-label={tA11y('copyCode')}>
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
      </div>
      <pre className="m-0 overflow-x-auto p-3 font-mono text-body-sm">
        {isHighlighted && Prism ? (
          <Prism
            language={lang}
            style={isDark ? ONE_DARK : ONE_LIGHT}
            // PreTag=div:高亮器自己的 pre 不再嵌进这层 pre(避免 pre-in-pre);
            // 内边距/圆角/底色一律归零,容器圆角只由外层 rounded-lg 决定(§4 圆角单一源头)。
            PreTag="div"
            customStyle={{ margin: 0, padding: 0, borderRadius: 0, background: 'transparent' }}
          >
            {code}
          </Prism>
        ) : (
          <code className={language ? `language-${language}` : undefined}>{code}</code>
        )}
      </pre>
    </div>
  )
}

export default CodeBlock
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
