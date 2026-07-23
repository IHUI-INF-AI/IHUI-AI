'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { SPEC_BUILTIN_TEMPLATES } from '@ihui/shared/spec/index'
import { TemplateCard } from '@/components/spec/TemplateCard'

export default function SpecTemplatesPage() {
  const router = useRouter()

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/spec"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Spec 模板</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            选择模板快速生成对应规格文档
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {SPEC_BUILTIN_TEMPLATES.map((tpl) => (
          <TemplateCard
            key={tpl.id}
            template={tpl}
            onUse={(t) => router.push(`/spec/generate?template=${t.id}`)}
          />
        ))}
      </div>
    </div>
  )
}
