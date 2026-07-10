import { ref } from 'vue'
import type { Ref } from 'vue'

export interface ReportMetadata {
  title?: string
  author?: string
  createdAt?: string
  generatedAt?: string
  [key: string]: unknown
}

export function useReportGenerator() {
  const generating: Ref<boolean> = ref(false)
  const metadata: Ref<ReportMetadata> = ref({})

  const generate = async (params: Record<string, any>): Promise<void> => {
    generating.value = true
    try {
      metadata.value = {
        title: params.title || '',
        author: params.author || '',
        createdAt: new Date().toISOString(),
      }
    } finally {
      generating.value = false
    }
  }

  const generateReport = async (params: Record<string, any>): Promise<void> => {
    return generate(params)
  }

  return { generating, metadata, generate, generateReport }
}
