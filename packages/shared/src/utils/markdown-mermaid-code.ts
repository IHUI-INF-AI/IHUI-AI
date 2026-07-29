/**
 * 判断 react-markdown 代码块 className 是否为 mermaid 语言。
 *
 * react-markdown v9 会将 ```mermaid 块的 className 渲染为 "language-mermaid"，
 * 这里以大小写不敏感方式匹配，避免各渲染器中硬编码字符串。
 */
export function isMermaidLanguage(className?: string): boolean {
  return /^language-mermaid$/i.test(className ?? '')
}
