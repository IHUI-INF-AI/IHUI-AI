'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Sparkles } from 'lucide-react'

import { Card, CardContent } from '@ihui/ui'
import { fetchApi } from '@/lib/api'
import { extractText, extractMediaUrls } from '@/lib/ai-media'
import { cn } from '@/lib/utils'
import type { GenerationType, ImageProvider, VideoProvider } from '@/components/ai/types'

import { GenerationTypeSelector } from '@/components/ai-generation/generation-type-selector'
import { TextGenerator } from '@/components/ai-generation/text-generator'
import { ImageGenerator } from '@/components/ai-generation/image-generator'
import { VideoGenerator } from '@/components/ai-generation/video-generator'
import { AudioGenerator } from '@/components/ai-generation/audio-generator'
import { MusicGenerator } from '@/components/ai-generation/music-generator'
import { CodeGenerator } from '@/components/ai-generation/code-generator'
import { VisionAnalysis } from '@/components/ai-generation/vision-analysis'
import { Model3DGenerator } from '@/components/ai-generation/model-3d-generator'
import { ImageGenQwen } from '@/components/ai-generation/image-gen-qwen'
import { ImageGenDoubao } from '@/components/ai-generation/image-gen-doubao'
import { ImageGenJimeng } from '@/components/ai-generation/image-gen-jimeng'
import { ImageEditQwen } from '@/components/ai-generation/image-edit-qwen'
import { VideoGenKling } from '@/components/ai-generation/video-gen-kling'
import { VideoGenQwen } from '@/components/ai-generation/video-gen-qwen'
import { VideoGenOneClick } from '@/components/ai-generation/video-gen-one-click'
import { VideoGenSora2 } from '@/components/ai-generation/video-gen-sora2'
import { MusicGenSuno } from '@/components/ai-generation/music-gen-suno'
import { Model3dGenHunyuan } from '@/components/ai-generation/model-3d-gen-hunyuan'
import { ResourceLibrary } from '@/components/ai-generation/resource-library'

type ResourceType = 'image' | 'video' | 'audio' | '3d'

async function callApi(
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

const SUB_TABS: Partial<Record<GenerationType, Array<{ value: string; labelKey: string }>>> = {
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

export default function AiGenerationPage() {
  const t = useTranslations('aiGeneration')
  const [type, setType] = React.useState<GenerationType>('auto')
  const [autoMode, setAutoMode] = React.useState('text')
  const [imageMode, setImageMode] = React.useState('generic')
  const [videoMode, setVideoMode] = React.useState('generic')
  const [musicMode, setMusicMode] = React.useState('generic')
  const [model3DMode, setModel3DMode] = React.useState('generic')

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
    callApi('/api/ai/dashscope/chat', { prompt, model: 'qwen-max' }, 'text')

  const onGenerateImage = (prompt: string, provider: ImageProvider, size: string) => {
    if (provider === 'qwen')
      return callApi('/api/ai/dashscope/image', { prompt, model: 'wanx-v1', size, n: 1 }, 'media')
    if (provider === 'doubao')
      return callApi('/api/ai/doubao/image', { prompt, model: 'doubao-pro', size }, 'media')
    return callApi('/api/ai/jimeng4/image', { prompt, width: 1024, height: 1024 }, 'media')
  }

  const onGenerateVideo = (prompt: string, provider: VideoProvider) => {
    if (provider === 'kling')
      return callApi(
        '/api/ai/kling/video/generate',
        { prompt, duration: '5', resolution: '720p' },
        'media',
      )
    return callApi('/api/ai/dashscope/video', { prompt, model: 'wanx2.1-t2v-turbo' }, 'media')
  }

  const onGenerateAudio = (prompt: string, voice: string) =>
    callApi('/api/ai/audio/speech', { text: prompt, voice }, 'media')

  const onGenerateMusic = (prompt: string, genre: string, duration: number) =>
    callApi('/api/ai/suno/generate', { prompt: `${genre} ${prompt}`, duration }, 'media')

  const onGenerateCode = (prompt: string, language: string) =>
    callApi(
      '/api/ai/dashscope/chat',
      { prompt: `Generate ${language} code: ${prompt}`, model: 'qwen-max' },
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
  const subTabs = SUB_TABS[type] ?? null
  const currentMode = modes[type] ?? ''

  const renderGenerator = () => {
    switch (type) {
      case 'auto':
        return autoMode === 'code' ? (
          <CodeGenerator onGenerate={onGenerateCode} />
        ) : (
          <TextGenerator onGenerate={onGenerateText} />
        )
      case 'image':
        switch (imageMode) {
          case 'qwen':
            return <ImageGenQwen />
          case 'doubao':
            return <ImageGenDoubao />
          case 'jimeng':
            return <ImageGenJimeng />
          case 'edit':
            return <ImageEditQwen />
          default:
            return <ImageGenerator onGenerate={onGenerateImage} />
        }
      case 'video':
        switch (videoMode) {
          case 'kling':
            return <VideoGenKling />
          case 'qwen':
            return <VideoGenQwen />
          case 'one-click':
            return <VideoGenOneClick />
          case 'sora2':
            return <VideoGenSora2 />
          default:
            return <VideoGenerator onGenerate={onGenerateVideo} />
        }
      case 'audio':
        return <AudioGenerator onGenerate={onGenerateAudio} />
      case 'music':
        return musicMode === 'suno' ? (
          <MusicGenSuno />
        ) : (
          <MusicGenerator onGenerate={onGenerateMusic} />
        )
      case 'vision':
        return <VisionAnalysis />
      case '3d':
        return model3DMode === 'hunyuan' ? (
          <Model3dGenHunyuan />
        ) : (
          <Model3DGenerator onGenerate={onGenerate3D} />
        )
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 shrink-0 text-primary" />
        <div>
          <h1 className="text-xl font-bold tracking-tight">{t('pageTitle')}</h1>
          <p className="text-sm text-muted-foreground">{t('pageSubtitle')}</p>
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 pt-4">
          <GenerationTypeSelector value={type} onChange={setType} />
          {subTabs && (
            <div className="flex flex-wrap gap-1.5">
              {subTabs.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setters[type]?.(tab.value)}
                  className={cn(
                    'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
                    tab.value === currentMode
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-card text-muted-foreground hover:bg-accent',
                  )}
                >
                  {t(tab.labelKey)}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">{renderGenerator()}</div>
        <div className="lg:col-span-2">
          <ResourceLibrary type={resourceType} />
        </div>
      </div>
    </div>
  )
}
