import { fetchApi } from '@/lib/api'
import { extractText, extractMediaUrls } from '@/lib/ai-media'
import type { GenerationType } from '@/components/ai/types'

export async function callApi(
  endpoint: string,
  body: Record<string, unknown>,
  mode: 'text' | 'media',
): Promise<string> {
  const res = await fetchApi<unknown>(endpoint, { method: 'POST', body: JSON.stringify(body) })
  if (!res.success) throw new Error(res.error || 'Request failed')
  if (!res.data) throw new Error('No data in response')
  if (mode === 'media') {
    const url = extractMediaUrls(res.data)[0]
    if (!url) throw new Error('No media URL in response')
    return url
  }
  const text = extractText(res.data)
  if (!text) throw new Error('No text in response')
  return text
}

export const SUB_TABS: Partial<Record<GenerationType, Array<{ value: string; labelKey: string }>>> =
  {
    auto: [
      { value: 'text', labelKey: 'tabText' },
      { value: 'code', labelKey: 'tabCode' },
    ],
    image: [
      { value: 'generic', labelKey: 'tabGeneric' },
      { value: 'qwen', labelKey: 'tabQwen' },
      { value: 'doubao', labelKey: 'tabDoubao' },
      { value: 'jimeng', labelKey: 'tabJimeng' },
      { value: 'edit', labelKey: 'tabEdit' },
    ],
    video: [
      { value: 'generic', labelKey: 'tabGeneric' },
      { value: 'kling', labelKey: 'tabKling' },
      { value: 'qwen', labelKey: 'tabQwen' },
      { value: 'one-click', labelKey: 'tabOneClick' },
      { value: 'sora2', labelKey: 'tabSora2' },
    ],
    music: [
      { value: 'generic', labelKey: 'tabGeneric' },
      { value: 'suno', labelKey: 'tabSuno' },
    ],
    '3d': [
      { value: 'generic', labelKey: 'tabGeneric' },
      { value: 'hunyuan', labelKey: 'tabHunyuan' },
    ],
  }
