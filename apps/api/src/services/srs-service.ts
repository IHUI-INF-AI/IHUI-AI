/**
 * SRS 媒体服务器管理服务 (迁移自旧架构 services/srs_manager.py)。
 *
 * 功能：
 * - 生成推流密钥和推/拉流 URL（RTMP/WebRTC/HLS/FLV）
 * - 通过 SRS HTTP API 管理流（查询状态、踢出流）
 * - 健康检查 SRS 服务器实例
 * - 录制文件管理
 */

import { randomBytes, createHmac } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { srsStreams, srsServers } from '@ihui/database'

/**
 * 生成推流密钥 — HMAC-SHA256 随机串。
 */
export function generateStreamKey(channelId?: string): string {
  const raw = randomBytes(16).toString('hex')
  const hmac = createHmac('sha256', raw)
    .update(channelId ?? '')
    .digest('hex')
  return `stream_${raw.slice(0, 8)}${hmac.slice(0, 8)}`
}

/**
 * 根据 SRS 服务器配置生成推/拉流 URL。
 */
export function generateStreamUrls(
  server: { host: string; rtmpPort: number; httpPort: number; webrtcPort: number },
  streamKey: string,
): { pushUrl: string; playUrl: string; webrtcUrl: string; hlsUrl: string; flvUrl: string } {
  const { host, rtmpPort, httpPort, webrtcPort } = server
  const app = 'live'

  return {
    pushUrl: `rtmp://${host}:${rtmpPort}/${app}/${streamKey}`,
    playUrl: `rtmp://${host}:${rtmpPort}/${app}/${streamKey}`,
    webrtcUrl: `webrtc://${host}:${webrtcPort}/${app}/${streamKey}.flv`,
    hlsUrl: `http://${host}:${httpPort}/${app}/${streamKey}.m3u8`,
    flvUrl: `http://${host}:${httpPort}/${app}/${streamKey}.flv`,
  }
}

/**
 * 获取活跃的 SRS 服务器。
 */
export async function getActiveServer() {
  const [server] = await db.select().from(srsServers).where(eq(srsServers.isActive, true)).limit(1)
  return server ?? null
}

/**
 * 创建新流 — 生成密钥 + URL + 持久化。
 */
export async function createStream(params: {
  title: string
  channelId?: string
  serverId?: string
}): Promise<{ stream: typeof srsStreams.$inferSelect }> {
  let server = await getActiveServer()
  if (!server) {
    server = {
      id: '00000000-0000-0000-0000-000000000000',
      name: 'default',
      host: process.env.SRS_HOST ?? '127.0.0.1',
      rtmpPort: 1935,
      httpPort: 8080,
      webrtcPort: 1985,
      apiPort: 1985,
      apiSecret: null,
      maxStreams: 100,
      isActive: true,
      healthCheckUrl: null,
      lastHealthCheck: null,
      status: 'online',
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  }

  const streamKey = generateStreamKey(params.channelId)
  const urls = generateStreamUrls(server, streamKey)

  const [stream] = await db
    .insert(srsStreams)
    .values({
      streamKey,
      channelId: params.channelId ?? null,
      title: params.title,
      pushUrl: urls.pushUrl,
      playUrl: urls.playUrl,
      webrtcUrl: urls.webrtcUrl,
      hlsUrl: urls.hlsUrl,
      flvUrl: urls.flvUrl,
      status: 'inactive',
    })
    .returning()

  return { stream: stream! }
}

/**
 * 通过 SRS HTTP API 查询流状态。
 */
export async function getStreamStatusFromSRS(
  server: { host: string; apiPort: number; apiSecret?: string | null },
  streamKey: string,
): Promise<Record<string, unknown> | null> {
  const apiUrl = `http://${server.host}:${server.apiPort}/api/v1/streams`
  try {
    const headers: Record<string, string> = {}
    if (server.apiSecret) {
      headers.Authorization = `Bearer ${server.apiSecret}`
    }
    const resp = await fetch(apiUrl, { headers, signal: AbortSignal.timeout(5_000) })
    if (!resp.ok) return null
    const data = (await resp.json()) as { streams?: Array<{ name: string; [k: string]: unknown }> }
    const found = data.streams?.find((s) => s.name === streamKey)
    return found ?? null
  } catch {
    return null
  }
}

/**
 * 通过 SRS HTTP API 踢出推流。
 */
export async function kickStream(
  server: { host: string; apiPort: number; apiSecret?: string | null },
  streamKey: string,
): Promise<boolean> {
  const apiUrl = `http://${server.host}:${server.apiPort}/api/v1/streams/${streamKey}/terminate`
  try {
    const headers: Record<string, string> = {}
    if (server.apiSecret) {
      headers.Authorization = `Bearer ${server.apiSecret}`
    }
    const resp = await fetch(apiUrl, {
      method: 'DELETE',
      headers,
      signal: AbortSignal.timeout(5_000),
    })
    return resp.ok || resp.status === 404
  } catch {
    return false
  }
}

/**
 * SRS 服务器健康检查。
 */
export async function healthCheckServer(server: {
  host: string
  apiPort: number
  healthCheckUrl?: string | null
}): Promise<{ healthy: boolean; latency: number }> {
  const url = server.healthCheckUrl ?? `http://${server.host}:${server.apiPort}/api/v1/versions`
  const start = Date.now()
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(3_000) })
    const latency = Date.now() - start
    return { healthy: resp.ok, latency }
  } catch {
    return { healthy: false, latency: Date.now() - start }
  }
}
