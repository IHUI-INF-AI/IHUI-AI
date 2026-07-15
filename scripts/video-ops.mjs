#!/usr/bin/env node
/**
 * 视频下载与 OSS 上传工具（迁移自历史项目 scripts/download_videos.ps1 + upload_to_oss.ps1）
 * 用法:
 *   node scripts/video-ops.mjs download          # 下载所有视频到 ./videos
 *   node scripts/video-ops.mjs upload             # 上传 ./videos 到 OSS
 *   node scripts/video-ops.mjs download --filter=mcp  # 仅下载 MCP 分类
 *   node scripts/video-ops.mjs upload --bucket=yjs-learning  # 指定 bucket
 * 依赖: yt-dlp (下载), aliyun CLI (上传) 或 OSS SDK
 */

import { execSync } from 'child_process'
import { mkdirSync, readdirSync, statSync, existsSync } from 'fs'
import { join, resolve } from 'path'

const VIDEOS_DIR = resolve(process.cwd(), 'videos')
const args = process.argv.slice(2)
const action = args[0]
const filter = args.find((a) => a.startsWith('--filter='))?.split('=')[1]
const bucket = args.find((a) => a.startsWith('--bucket='))?.split('=')[1] || 'yjs-learning'
const region = 'cn-guangzhou'

const videoSources = [
  { category: 'mcp', url: 'https://www.bilibili.com/video/BV1B14y1Y7gM/' },
  { category: 'mcp', url: 'https://www.bilibili.com/video/BV1aS411w7cP/' },
  { category: 'clawdbot', url: 'https://www.bilibili.com/video/BV1Lm421L7TQ/' },
  { category: 'vibe-coding', url: 'https://www.bilibili.com/video/BV1Hr421L7cM/' },
  { category: 'claude-code', url: 'https://www.bilibili.com/video/BV1NE421w7cP/' },
  { category: 'prompt', url: 'https://www.bilibili.com/video/BV1Rx421r7cM/' },
  { category: 'ai-agent', url: 'https://www.bilibili.com/video/BV1NE421w7cP/' },
]

function downloadVideos() {
  mkdirSync(VIDEOS_DIR, { recursive: true })
  const sources = filter ? videoSources.filter((s) => s.category === filter) : videoSources

  console.log(`[download] ${sources.length} 个视频待下载到 ${VIDEOS_DIR}`)
  for (const { category, url } of sources) {
    const categoryDir = join(VIDEOS_DIR, 'courses', category)
    mkdirSync(categoryDir, { recursive: true })
    console.log(`[download] ${category}: ${url}`)
    try {
      execSync(`yt-dlp -o "${join(categoryDir, '%(title)s.%(ext)s')}" "${url}"`, {
        stdio: 'inherit',
      })
    } catch {
      console.error(`[download] 失败: ${url}`)
    }
  }
  console.log('[download] 完成')
}

function uploadToOss() {
  if (!existsSync(VIDEOS_DIR)) {
    console.error(`[upload] 视频目录不存在: ${VIDEOS_DIR}`)
    process.exit(1)
  }
  const files = collectFiles(VIDEOS_DIR)
  if (files.length === 0) {
    console.log('[upload] 无文件可上传')
    return
  }
  console.log(`[upload] ${files.length} 个文件待上传到 OSS bucket: ${bucket} (${region})`)
  for (const file of files) {
    const key = file.replace(VIDEOS_DIR + '\\', '').replace(VIDEOS_DIR + '/', '')
    console.log(`[upload] ${key}`)
    try {
      execSync(`aliyun oss cp "${file}" oss://${bucket}/courses/${key} -f`, {
        stdio: 'inherit',
      })
    } catch {
      console.error(`[upload] 失败: ${file}`)
    }
  }
  console.log('[upload] 完成')
}

function collectFiles(dir) {
  const results = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      results.push(...collectFiles(full))
    } else if (/\.(mp4|webm|mkv|mov|avi)$/i.test(entry)) {
      results.push(full)
    }
  }
  return results
}

if (action === 'download') {
  downloadVideos()
} else if (action === 'upload') {
  uploadToOss()
} else {
  console.log('用法: node scripts/video-ops.mjs <download|upload> [--filter=分类] [--bucket=bucket名]')
  process.exit(1)
}
