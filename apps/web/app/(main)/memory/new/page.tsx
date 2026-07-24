'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Brain } from 'lucide-react'
import { Button } from '@ihui/ui-react'
import { createMemory } from '@/lib/memory-api'
import type { MemoryCreateInput } from '@/lib/memory-api'
import { MemoryForm } from '@/components/memory/MemoryForm'

export default function NewMemoryPage() {
  const router = useRouter()

  async function handleSubmit(input: MemoryCreateInput) {
    await createMemory(input)
    router.push('/memory')
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <header className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link href="/memory">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold tracking-tight">新建记忆</h1>
        </div>
      </header>

      <div className="rounded-lg border bg-card p-5">
        <MemoryForm onSubmit={handleSubmit} submitLabel="创建记忆" />
      </div>
    </div>
  )
}
