'use client'

import * as React from 'react'
import type { GenerationType, ImageProvider, VideoProvider } from '@/components/ai/types'
import { ResourceLibrary } from '@/components/ai-generation/resource-library'

import { AiGenerationHeader } from './AiGenerationHeader'
import { AiGenerationContent } from './AiGenerationContent'
import { AiGenerationPreview } from './AiGenerationPreview'
import { callApi } from './helpers'
import type { ResourceType } from './types'

export default function AiGenerationPage() {
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
    callApi('/api/ai/dashscope/chat', { prompt, model: 'qwen-max' }, 'text')

  const onGenerateImage = async (prompt: string, provider: ImageProvider, size: string) => {
    const url = await (provider === 'qwen'
      ? callApi('/api/ai/dashscope/image', { prompt, model: 'wanx-v1', size, n: 1 }, 'media')
      : provider === 'doubao'
        ? callApi('/api/ai/doubao/image', { prompt, model: 'doubao-pro', size }, 'media')
        : callApi('/api/ai/jimeng4/image', { prompt, width: 1024, height: 1024 }, 'media'))
    setLastImage(url)
    return url
  }

  const onGenerateVideo = async (prompt: string, provider: VideoProvider) => {
    const url = await (provider === 'kling'
      ? callApi(
          '/api/ai/kling/video/generate',
          { prompt, duration: '5', resolution: '720p' },
          'media',
        )
      : callApi('/api/ai/dashscope/video', { prompt, model: 'wanx2.1-t2v-turbo' }, 'media'))
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
  const currentMode = modes[type] ?? ''

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4">
      <AiGenerationHeader
        type={type}
        setType={setType}
        currentMode={currentMode}
        onSubTabClick={(v) => setters[type]?.(v)}
      />

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
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
        <div className="lg:col-span-2">
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
