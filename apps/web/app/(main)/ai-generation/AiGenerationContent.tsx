// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
import { ImageGenAgnes } from '@/components/ai-generation/image-gen-agnes'
import { ImageGenX5m5x } from '@/components/ai-generation/image-gen-x5m5x'
import { ImageGenGemini } from '@/components/ai-generation/image-gen-gemini'
import { ImageGenZhipu } from '@/components/ai-generation/image-gen-zhipu'
import { ImageGenIdeogram } from '@/components/ai-generation/image-gen-ideogram'
import { ImageGenRecraft } from '@/components/ai-generation/image-gen-recraft'
import { ImageGenFal } from '@/components/ai-generation/image-gen-fal'
import { ImageGenFreepik } from '@/components/ai-generation/image-gen-freepik'
import { ImageEditQwen } from '@/components/ai-generation/image-edit-qwen'
import { VideoGenKling } from '@/components/ai-generation/video-gen-kling'
import { VideoGenQwen } from '@/components/ai-generation/video-gen-qwen'
import { VideoGenJimeng } from '@/components/ai-generation/video-gen-jimeng'
import { VideoGenVidu } from '@/components/ai-generation/video-gen-vidu'
import { VideoGenRunway } from '@/components/ai-generation/video-gen-runway'
import { VideoGenLuma } from '@/components/ai-generation/video-gen-luma'
import { VideoGenPixverse } from '@/components/ai-generation/video-gen-pixverse'
import { VideoGenZhipu } from '@/components/ai-generation/video-gen-zhipu'
import { VideoGenVeo } from '@/components/ai-generation/video-gen-veo'
import { VideoGenOneClick } from '@/components/ai-generation/video-gen-one-click'
import { VideoGenSora2 } from '@/components/ai-generation/video-gen-sora2'
import { VideoGenAgnes } from '@/components/ai-generation/video-gen-agnes'
import { ChatGenAgnes } from '@/components/ai-generation/chat-gen-agnes'
import { ChatGenX5m5x } from '@/components/ai-generation/chat-gen-x5m5x'
import { ChatGenX5m5xSubscribe } from '@/components/ai-generation/chat-gen-x5m5x-subscribe'
import { ChatGenOpenAICompat } from '@/components/ai-generation/chat-gen-openai-compat'
import { MusicGenSuno } from '@/components/ai-generation/music-gen-suno'
import { MusicGenMureka } from '@/components/ai-generation/music-gen-mureka'
import { MusicGenElevenlabs } from '@/components/ai-generation/music-gen-elevenlabs'
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
      if (autoMode === 'code') return <CodeGenerator onGenerate={onGenerateCode} />
      if (autoMode === 'agnes-chat') return <ChatGenAgnes />
      if (autoMode === 'x5m5x-chat') return <ChatGenX5m5x />
      if (autoMode === 'x5m5x-subscribe') return <ChatGenX5m5xSubscribe />
      if (autoMode === 'openai-compat') return <ChatGenOpenAICompat />
      return <TextGenerator onGenerate={onGenerateText} />
    case 'image':
      switch (imageMode) {
        case 'qwen':
          return <ImageGenQwen />
        case 'doubao':
          return <ImageGenDoubao />
        case 'jimeng':
          return <ImageGenJimeng />
        case 'gemini':
          return <ImageGenGemini />
        case 'zhipu':
          return <ImageGenZhipu />
        case 'ideogram':
          return <ImageGenIdeogram />
        case 'recraft':
          return <ImageGenRecraft />
        case 'fal':
          return <ImageGenFal />
        case 'freepik':
          return <ImageGenFreepik />
        case 'agnes':
          return <ImageGenAgnes />
        case 'x5m5x':
          return <ImageGenX5m5x />
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
        case 'jimeng':
          return <VideoGenJimeng />
        case 'vidu':
          return <VideoGenVidu />
        case 'runway':
          return <VideoGenRunway />
        case 'luma':
          return <VideoGenLuma />
        case 'pixverse':
          return <VideoGenPixverse />
        case 'zhipu-video':
          return <VideoGenZhipu />
        case 'veo':
          return <VideoGenVeo />
        case 'one-click':
          return <VideoGenOneClick />
        case 'sora2':
          return <VideoGenSora2 />
        case 'agnes':
          return <VideoGenAgnes />
        default:
          return <VideoGenerator onGenerate={onGenerateVideo} />
      }
    case 'audio':
      return <AudioGenerator onGenerate={onGenerateAudio} />
    case 'music':
      return musicMode === 'suno' ? (
        <MusicGenSuno />
      ) : musicMode === 'mureka' ? (
        <MusicGenMureka />
      ) : musicMode === 'elevenlabs' ? (
        <MusicGenElevenlabs />
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
