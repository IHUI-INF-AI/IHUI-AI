/**
 * 视频处理工具集(迁移自旧架构 Python 工具类)
 *
 * - ChatImageDrawer → drawChatImage:在图片上绘制聊天对话气泡
 * - VideoWatermarkUtil → addVideoWatermark:视频加水印(ffmpeg)
 * - ImageWatermarkUtil → addImageWatermark:图片加水印(sharp)
 */
export { drawChatImage } from './chat-image-drawer'
export type { ChatMessage, DrawChatImageOptions } from './chat-image-drawer'

export { addVideoWatermark } from './video-watermark-util'
export type {
  VideoWatermarkOptions,
  VideoWatermarkResult,
  WatermarkPosition,
} from './video-watermark-util'

export { addImageWatermark } from './image-watermark-util'
export type { ImageWatermarkOptions, ImageWatermarkResult } from './image-watermark-util'
