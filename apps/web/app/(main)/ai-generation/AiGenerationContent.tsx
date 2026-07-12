'use client'

import type { GenerationType, ImageProvider, VideoProvider } from '@/components/ai/types'
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

interface Props {
  type: GenerationType
  autoMode: string
  imageMode: string
  videoMode: string
  musicMode: string
  model3DMode: string
  onGenerateText: (prompt: string) => Promise<string>
  onGenerateImage: (prompt: string, provider: ImageProvider, size: string) => Promise<string>
  onGenerateVideo: (prompt: string, provider: VideoProvider) => Promise<string>
  onGenerateAudio: (prompt: string, voice: string) => Promise<string>
  onGenerateMusic: (prompt: string, genre: string, duration: number) => Promise<string>
  onGenerateCode: (prompt: string, language: string) => Promise<string>
  onGenerate3D: (prompt: string, format: string) => Promise<string>
}

export function AiGenerationContent({
  type,
  autoMode,
  imageMode,
  videoMode,
  musicMode,
  model3DMode,
  onGenerateText,
  onGenerateImage,
  onGenerateVideo,
  onGenerateAudio,
  onGenerateMusic,
  onGenerateCode,
  onGenerate3D,
}: Props) {
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
