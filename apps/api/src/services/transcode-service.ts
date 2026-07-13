/**
 * 文件转码服务（FFmpeg 子进程封装）。
 *
 * 设计原则（按 AGENTS.md "做减法"）：
 * - 不引入 fluent-ffmpeg 等封装库，直接 spawn ffmpeg 子进程
 * - 任务状态使用内存 Map（无 DB schema 变更，重启清空）
 * - 支持视频（mp4/webm/mkv→mp4/hls）、音频（各格式→mp3/aac）、视频缩略图
 * - 转码输出到 uploads/transcoded/{jobId}/ 目录
 *
 * 前置依赖：系统需安装 ffmpeg 并在 PATH 中可用。
 */

import { spawn } from 'node:child_process'
import { mkdir, stat, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { env } from 'node:process'
import { randomUUID } from 'node:crypto'

// =============================================================================
// 类型定义
// =============================================================================

export type TranscodeStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'

export type TranscodePreset =
  'video/mp4' | 'video/hls' | 'video/webm' | 'audio/mp3' | 'audio/aac' | 'thumbnail'

export interface TranscodeJob {
  id: string
  inputPath: string
  outputDir: string
  outputPath: string
  preset: TranscodePreset
  status: TranscodeStatus
  progress: number
  error?: string
  createdAt: Date
  startedAt?: Date
  completedAt?: Date
  /** 转码结果文件大小（字节） */
  outputSize?: number
}

export interface TranscodeInput {
  inputPath: string
  preset: TranscodePreset
  /** 自定义输出文件名（不含扩展名），默认用 jobId */
  outputName?: string
  /** 视频分辨率缩放，如 720p/1080p，仅 video/* preset 生效 */
  resolution?: string
}

// =============================================================================
// 内存任务表
// =============================================================================

const jobs = new Map<string, TranscodeJob>()
const childProcesses = new Map<string, ReturnType<typeof spawn>>()

const UPLOAD_DIR = env.UPLOAD_DIR ?? join(process.cwd(), 'uploads')
const TRANSCODE_DIR = join(UPLOAD_DIR, 'transcoded')

// =============================================================================
// FFmpeg 参数构建
// =============================================================================

function buildFfmpegArgs(input: TranscodeInput, outputPath: string): string[] {
  const args: string[] = ['-i', input.inputPath, '-y']

  const scaleFilter = input.resolution ? `scale=-2:${input.resolution.replace('p', '')}` : null

  switch (input.preset) {
    case 'video/mp4':
      args.push('-c:v', 'libx264', '-preset', 'fast', '-crf', '23')
      if (scaleFilter) args.push('-vf', scaleFilter)
      args.push('-c:a', 'aac', '-b:a', '128k')
      args.push('-movflags', '+faststart')
      args.push(outputPath)
      break
    case 'video/hls':
      args.push('-c:v', 'libx264', '-preset', 'fast', '-crf', '23')
      if (scaleFilter) args.push('-vf', scaleFilter)
      args.push('-c:a', 'aac', '-b:a', '128k')
      args.push('-f', 'hls', '-hls_time', '6', '-hls_list_size', '0')
      args.push('-hls_segment_filename', join(dirname(outputPath), 'segment_%03d.ts'))
      args.push(outputPath)
      break
    case 'video/webm':
      args.push('-c:v', 'libvpx-vp9', '-b:v', '1M', '-c:a', 'libopus')
      if (scaleFilter) args.push('-vf', scaleFilter)
      args.push(outputPath)
      break
    case 'audio/mp3':
      args.push('-c:a', 'libmp3lame', '-b:a', '192k')
      args.push(outputPath)
      break
    case 'audio/aac':
      args.push('-c:a', 'aac', '-b:a', '128k')
      args.push(outputPath)
      break
    case 'thumbnail':
      args.push('-ss', '00:00:01', '-frames:v', '1', '-f', 'image2')
      args.push(outputPath)
      break
  }

  return args
}

function getOutputExtension(preset: TranscodePreset): string {
  switch (preset) {
    case 'video/mp4':
      return '.mp4'
    case 'video/hls':
      return '.m3u8'
    case 'video/webm':
      return '.webm'
    case 'audio/mp3':
      return '.mp3'
    case 'audio/aac':
      return '.m4a'
    case 'thumbnail':
      return '.jpg'
  }
}

// =============================================================================
// 核心转码逻辑
// =============================================================================

export async function createTranscodeJob(input: TranscodeInput): Promise<TranscodeJob> {
  const jobId = randomUUID()
  const outputDir = join(TRANSCODE_DIR, jobId)
  await mkdir(outputDir, { recursive: true })

  const ext = getOutputExtension(input.preset)
  const outputName = input.outputName ?? jobId
  const outputPath = join(outputDir, `${outputName}${ext}`)

  // 校验输入文件存在
  if (!existsSync(input.inputPath)) {
    throw new Error(`输入文件不存在: ${input.inputPath}`)
  }

  const job: TranscodeJob = {
    id: jobId,
    inputPath: input.inputPath,
    outputDir,
    outputPath,
    preset: input.preset,
    status: 'pending',
    progress: 0,
    createdAt: new Date(),
  }
  jobs.set(jobId, job)
  return job
}

export async function startTranscodeJob(jobId: string): Promise<TranscodeJob> {
  const job = jobs.get(jobId)
  if (!job) throw new Error(`任务不存在: ${jobId}`)
  if (job.status === 'processing') throw new Error('任务正在处理中')
  if (job.status === 'completed') throw new Error('任务已完成')

  const jobWithResolution: TranscodeInput = {
    inputPath: job.inputPath,
    preset: job.preset,
  }
  const args = buildFfmpegArgs(jobWithResolution, job.outputPath)

  job.status = 'processing'
  job.startedAt = new Date()
  job.progress = 0

  return new Promise<TranscodeJob>((resolve) => {
    const child = spawn('ffmpeg', args, { stdio: ['pipe', 'pipe', 'pipe'] })
    childProcesses.set(jobId, child)

    let stderrBuffer = ''
    child.stderr.on('data', (chunk: Buffer) => {
      stderrBuffer += chunk.toString()
      // 解析 FFmpeg 进度（time=HH:MM:SS）
      const timeMatch = stderrBuffer.match(/time=(\d{2}):(\d{2}):(\d{2})/)
      if (timeMatch) {
        const seconds =
          Number(timeMatch[1]) * 3600 + Number(timeMatch[2]) * 60 + Number(timeMatch[3])
        // 简易进度估算（无法精确，因不知总时长）
        job.progress = Math.min(99, Math.max(job.progress, seconds))
      }
    })

    child.on('close', async (code) => {
      childProcesses.delete(jobId)
      job.completedAt = new Date()

      if (code === 0) {
        try {
          const stats = await stat(job.outputPath)
          job.outputSize = stats.size
          job.status = 'completed'
          job.progress = 100
        } catch {
          job.status = 'failed'
          job.error = '输出文件不存在'
        }
      } else {
        job.status = 'failed'
        job.error = `FFmpeg 退出码 ${code}: ${stderrBuffer.slice(-500)}`
      }
      resolve(job)
    })

    child.on('error', (err) => {
      childProcesses.delete(jobId)
      job.status = 'failed'
      job.error = `启动 FFmpeg 失败: ${err.message}（请确认系统已安装 ffmpeg）`
      job.completedAt = new Date()
      resolve(job)
    })
  })
}

export function getTranscodeJob(jobId: string): TranscodeJob | undefined {
  return jobs.get(jobId)
}

export function listTranscodeJobs(): TranscodeJob[] {
  return Array.from(jobs.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
}

export async function cancelTranscodeJob(jobId: string): Promise<TranscodeJob | undefined> {
  const job = jobs.get(jobId)
  if (!job) return undefined
  const child = childProcesses.get(jobId)
  if (child) {
    child.kill('SIGKILL')
    childProcesses.delete(jobId)
  }
  job.status = 'cancelled'
  job.completedAt = new Date()
  // 清理输出目录
  try {
    await rm(job.outputDir, { recursive: true, force: true })
  } catch {
    // 忽略清理失败
  }
  return job
}

export async function deleteTranscodeJob(jobId: string): Promise<boolean> {
  const job = jobs.get(jobId)
  if (!job) return false
  await cancelTranscodeJob(jobId)
  jobs.delete(jobId)
  try {
    await rm(job.outputDir, { recursive: true, force: true })
  } catch {
    // 忽略
  }
  return true
}

/** 检查 ffmpeg 是否可用。 */
export async function isFfmpegAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn('ffmpeg', ['-version'], { stdio: 'ignore' })
    child.on('close', (code) => resolve(code === 0))
    child.on('error', () => resolve(false))
  })
}
