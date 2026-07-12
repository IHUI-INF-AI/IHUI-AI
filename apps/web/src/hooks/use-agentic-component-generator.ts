'use client'

import * as React from 'react'
import { useMutation } from '@tanstack/react-query'

import { fetchApi } from '@/lib/api'

export interface ComponentGenInput {
  prompt: string
  framework?: 'react' | 'vue' | 'svelte'
  styling?: 'tailwind' | 'css' | 'styled'
  typescript?: boolean
}

export interface GeneratedComponent {
  id: string
  name: string
  code: string
  language: string
  preview?: string
}

export interface UseAgenticComponentGeneratorReturn {
  generate: (input: ComponentGenInput) => Promise<GeneratedComponent | null>
  generating: boolean
  error: Error | null
  reset: () => void
}

async function generateComponent(input: ComponentGenInput): Promise<GeneratedComponent> {
  const res = await fetchApi<GeneratedComponent>('/api/workspace/generate-component', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  if (!res.success) throw new Error(res.error)
  return res.data
}

/** Agentic 组件生成 Hook，封装 useMutation */
export function useAgenticComponentGenerator(): UseAgenticComponentGeneratorReturn {
  const mutation = useMutation({
    mutationFn: generateComponent,
  })

  const generate = React.useCallback(
    async (input: ComponentGenInput): Promise<GeneratedComponent | null> => {
      try {
        return await mutation.mutateAsync(input)
      } catch {
        return null
      }
    },
    [mutation],
  )

  return {
    generate,
    generating: mutation.isPending,
    error: mutation.error as Error | null,
    reset: mutation.reset,
  }
}
