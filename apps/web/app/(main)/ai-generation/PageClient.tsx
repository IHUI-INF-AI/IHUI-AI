// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import type { GenerationType, ImageProvider, VideoProvider } from '@/components/ai/types'
import { ResourceLibrary } from '@/components/ai-generation/resource-library'

import { AiGenerationHeader } from './AiGenerationHeader'
import { AiGenerationContent } from './AiGenerationContent'
import { AiGenerationPreview } from './AiGenerationPreview'
import { callApi } from './helpers'
import type { ResourceType } from './types'
import { BackButton } from '@/components/common'
import { fetchApi } from '@/lib/api'
import { extractMediaUrls } from '@/lib/ai-media'

export default function AiGenerationPageClient() {
  const [type, setType] = React.useState<GenerationType>('auto')
  const [autoMode, setAutoMode] = React.useState('text')
  const [imageMode, setImageMode] = React.useState('generic')
  const [videoMode, setVideoMode] = React.useState('generic')
  const [musicMode, setMusicMode] = React.useState('generic')
  const [model3DMode, setModel3DMode] = React.useState('generic')
  const [lastImage, setLastImage] = React.useState<string | null>(null)
  const [lastVideo, setLastVideo] = React.useState<string | null>(null)

  const resourceType: ResourceType | undefined =
    type === 'image'
      ? 'image'
      : type === 'video'
        ? 'video'
        : type === 'audio' || type === 'music'
          ? 'audio'
          : type === '3d'
            ? '3d'
            : undefined

  const onGenerateText = (prompt: string) =>
    callApi('/api/ai/dashscope/chat', { prompt, model: 'qwen3-max' }, 'text')

  const onGenerateImage = async (prompt: string, provider: ImageProvider, size: string) => {
    const url = await (provider === 'qwen'
      ? callApi('/api/ai/dashscope/image', { prompt, model: 'wan2.6-t2i', size, n: 1 }, 'media')
      : provider === 'doubao'
        ? callApi(
            '/api/ai/doubao/image',
            { prompt, model: 'doubao-seedream-3-0-t2i-250415', size },
            'media',
          )
        : provider === 'agnes'
          ? callApi('/api/ai/agnes/image', { prompt, size }, 'media') // method: POST
          : callApi('/api/ai/jimeng4/image', { prompt, width: 1024, height: 1024 }, 'media'))
    setLastImage(url)
    return url
  }

  // Kling 文生视频真腿:POST /api/chat/kling/video/generate 为异步任务(返回 task_id),
  // 需轮询 GET /api/chat/kling/task/:taskId 至终态再取产物 URL。
  // resolution 不在后端 klingVideoSchema 在册字段,按 zod strip 语义不发送。
  const generateKlingVideo = async (prompt: string): Promise<string> => {
    const submit = await fetchApi<{ task_id?: string }>('/api/chat/kling/video/generate', {
      method: 'POST',
      body: JSON.stringify({ prompt, duration: '5' }),
    })
    if (!submit.success) throw new Error(submit.error || 'Request failed')
    const taskId = submit.data?.task_id
    if (!taskId) throw new Error('No task_id in response')
    for (let attempt = 0; attempt < 100; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 3000))
      const poll = await fetchApi<unknown>(`/api/chat/kling/task/${taskId}`)
      if (!poll.success) throw new Error(poll.error || 'Request failed')
      const status = (poll.data as { task_status?: string } | undefined)?.task_status
      if (status === 'succeed') {
        const url = extractMediaUrls(poll.data)[0]
        if (!url) throw new Error('No media URL in response')
        return url
      }
      if (status === 'fail') throw new Error('Kling 视频生成失败')
    }
    throw new Error('Kling 视频生成超时')
  }

  const onGenerateVideo = async (prompt: string, provider: VideoProvider) => {
    const url = await (provider === 'kling'
      ? generateKlingVideo(prompt)
      : callApi('/api/ai/dashscope/video', { prompt, model: 'wan2.5-t2v-plus' }, 'media'))
    setLastVideo(url)
    return url
  }

  const onGenerateAudio = (prompt: string, voice: string) =>
    callApi('/api/ai/audio/speech', { text: prompt, voice }, 'media')

  const onGenerateMusic = (prompt: string, genre: string, duration: number) =>
    callApi('/api/ai/suno/generate', { prompt: `${genre} ${prompt}`, duration }, 'media')

  const onGenerateCode = (prompt: string, language: string) =>
    callApi(
      '/api/ai/dashscope/chat',
      { prompt: `Generate ${language} code: ${prompt}`, model: 'qwen3-max' },
      'text',
    )

  const onGenerate3D = (prompt: string, format: string) =>
    callApi('/api/ai/tencent/hunyuan3d/submit', { Prompt: prompt, ResultFormat: format }, 'media')

  const setters: Partial<Record<GenerationType, (v: string) => void>> = {
    auto: setAutoMode,
    image: setImageMode,
    video: setVideoMode,
    music: setMusicMode,
    '3d': setModel3DMode,
  }
  const modes: Partial<Record<GenerationType, string>> = {
    auto: autoMode,
    image: imageMode,
    video: videoMode,
    music: musicMode,
    '3d': model3DMode,
  }
  const currentMode = modes[type] ?? ''

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 px-4 py-4">
      <BackButton />
      <AiGenerationHeader
        type={type}
        setType={setType}
        currentMode={currentMode}
        onSubTabClick={(v) => setters[type]?.(v)}
      />

      <div className="grid grid-cols-1 gap-4 min-[1024px]:grid-cols-5">
        <div className="min-[1024px]:col-span-3">
          <AiGenerationContent
            type={type}
            autoMode={autoMode}
            imageMode={imageMode}
            videoMode={videoMode}
            musicMode={musicMode}
            model3DMode={model3DMode}
            onGenerateText={onGenerateText}
            onGenerateImage={onGenerateImage}
            onGenerateVideo={onGenerateVideo}
            onGenerateAudio={onGenerateAudio}
            onGenerateMusic={onGenerateMusic}
            onGenerateCode={onGenerateCode}
            onGenerate3D={onGenerate3D}
          />
        </div>
        <div className="min-[1024px]:col-span-2">
          <ResourceLibrary type={resourceType} />
        </div>
      </div>

      <AiGenerationPreview
        lastImage={lastImage}
        lastVideo={lastVideo}
        onClear={() => {
          setLastImage(null)
          setLastVideo(null)
        }}
      />
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
