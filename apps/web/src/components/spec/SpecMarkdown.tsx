'use client'

import * as React from 'react'
import type { SpecSection } from '@ihui/shared/spec/index'

interface SpecMarkdownProps {
  sections: SpecSection[]
  markdown?: string
}

function headingClass(level: number): string {
  if (level <= 1) return 'text-base font-semibold'
  if (level === 2) return 'text-sm font-semibold'
  return 'text-sm font-medium'
}

/** Spec Markdown 渲染组件:原生 pre/code 渲染,支持 sections 锚点跳转 */
export function SpecMarkdown({ sections, markdown }: SpecMarkdownProps) {
  const [active, setActive] = React.useState<number | null>(null)

  if (sections.length === 0 && !markdown) {
    return <p className="text-sm text-muted-foreground">暂无 spec 内容</p>
  }

  return (
    <div className="space-y-4">
      {sections.length > 0 && (
        <nav className="flex flex-wrap gap-1.5">
          {sections.map((s, i) => (
            <a
              key={i}
              href={`#spec-section-${i}`}
              onClick={() => setActive(i)}
              className={`rounded-md px-2 py-0.5 text-xs transition-colors hover:bg-accent ${
                active === i ? 'bg-accent text-foreground' : 'text-muted-foreground'
              }`}
            >
              {s.title}
            </a>
          ))}
        </nav>
      )}

      {sections.length > 0 ? (
        sections.map((section, i) => (
          <section key={i} id={`spec-section-${i}`} className="scroll-mt-20 space-y-1.5">
            <h3 className={`${headingClass(section.level)} text-foreground`}>{section.title}</h3>
            <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs leading-relaxed whitespace-pre-wrap break-words text-foreground">
              <code>{section.content}</code>
            </pre>
          </section>
        ))
      ) : (
        <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs leading-relaxed whitespace-pre-wrap break-words text-foreground">
          <code>{markdown}</code>
        </pre>
      )}
    </div>
  )
}
