// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
      { value: 'agnes-chat', labelKey: 'tabAgnes' },
      { value: 'x5m5x-chat', labelKey: 'tabX5m5x' },
      { value: 'x5m5x-subscribe', labelKey: 'tabX5m5xSubscribe' },
      { value: 'openai-compat', labelKey: 'tabOpenAICompat' },
      { value: 'code', labelKey: 'tabCode' },
    ],
    image: [
      { value: 'generic', labelKey: 'tabGeneric' },
      { value: 'qwen', labelKey: 'tabQwen' },
      { value: 'doubao', labelKey: 'tabDoubao' },
      { value: 'jimeng', labelKey: 'tabJimeng' },
      { value: 'gemini', labelKey: 'tabGeminiImage' },
      { value: 'zhipu', labelKey: 'tabZhipuImage' },
      { value: 'ideogram', labelKey: 'tabIdeogram' },
      { value: 'recraft', labelKey: 'tabRecraft' },
      { value: 'fal', labelKey: 'tabFal' },
      { value: 'freepik', labelKey: 'tabFreepik' },
      { value: 'agnes', labelKey: 'tabAgnes' },
      { value: 'x5m5x', labelKey: 'tabX5m5x' },
      { value: 'edit', labelKey: 'tabEdit' },
    ],
    video: [
      { value: 'generic', labelKey: 'tabGeneric' },
      { value: 'kling', labelKey: 'tabKling' },
      { value: 'qwen', labelKey: 'tabQwen' },
      { value: 'jimeng', labelKey: 'tabJimeng' },
      { value: 'vidu', labelKey: 'tabVidu' },
      { value: 'runway', labelKey: 'tabRunway' },
      { value: 'luma', labelKey: 'tabLuma' },
      { value: 'pixverse', labelKey: 'tabPixverse' },
      { value: 'zhipu-video', labelKey: 'tabZhipuVideo' },
      { value: 'veo', labelKey: 'tabVeo' },
      { value: 'one-click', labelKey: 'tabOneClick' },
      { value: 'sora2', labelKey: 'tabSora2' },
      { value: 'agnes', labelKey: 'tabAgnes' },
    ],
    music: [
      { value: 'generic', labelKey: 'tabGeneric' },
      { value: 'suno', labelKey: 'tabSuno' },
      { value: 'mureka', labelKey: 'tabMureka' },
      { value: 'elevenlabs', labelKey: 'tabElevenlabs' },
    ],
    '3d': [
      { value: 'generic', labelKey: 'tabGeneric' },
      { value: 'hunyuan', labelKey: 'tabHunyuan' },
    ],
  }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
