// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 应用更新检测面(2026-11-17 立)。
 *
 * `GET /api/admin/system/update-check` —— 本机版本 vs GitHub 最新 release。
 *
 * 判据全部在 `update-check-service.ts`(纯函数,可单测);本文件只做三件事:
 * 取本机版本、取远端 release、按 6 小时缓存。
 *
 * 取不到远端(未配 repo / 网络不通 / 无 release)一律交回 `determined:false`,
 * 由判据层给 `reason` —— 绝不把「没问到」说成「已是最新」。
 */
import { readFileSync } from 'node:fs'
import type { FastifyPluginAsync } from 'fastify'
import { requireAdmin } from '../../plugins/require-permission.js'
import { success } from '../../utils/response.js'
import {
  decideUpdate,
  type ReleaseLike,
  type UpdateCheckResult,
} from '../../services/update-check-service.js'

const CACHE_TTL_MS = 6 * 60 * 60 * 1000
const DEFAULT_REPO = 'IHUI-INF-AI/IHUI-AI'
const FETCH_TIMEOUT_MS = 5_000

let cache: { at: number; result: UpdateCheckResult } | null = null

/** 本机版本:读 apps/api/package.json 的 version;读不到返回空串(判据层会点名原因)。 */
function readAppVersion(): string {
  try {
    const raw = readFileSync(new URL('../../../package.json', import.meta.url), 'utf8')
    const parsed = JSON.parse(raw) as { version?: unknown }
    return typeof parsed.version === 'string' ? parsed.version : ''
  } catch {
    return ''
  }
}

/** 取 GitHub 最新 release;任何失败返回 { release: null, reason }。 */
async function fetchLatestRelease(
  repo: string,
): Promise<{ release: ReleaseLike | null; reason?: string }> {
  const url = `https://api.github.com/repos/${repo}/releases/latest`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  timer.unref?.()
  try {
    const resp = await fetch(url, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'ihui-api-update-check' },
      signal: controller.signal,
    })
    if (!resp.ok) return { release: null, reason: `GitHub 返回 ${resp.status}` }
    const body = (await resp.json()) as ReleaseLike
    return { release: body }
  } catch (e) {
    return {
      release: null,
      reason: `取 release 失败:${e instanceof Error ? e.message : String(e)}`,
    }
  } finally {
    clearTimeout(timer)
  }
}

export const systemUpdateCheckRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  server.get('/admin/system/update-check', async (_request, reply) => {
    const now = Date.now()
    if (cache && now - cache.at < CACHE_TTL_MS) {
      return reply.send(success({ ...cache.result, cached: true }))
    }

    const repo = (process.env.IHUI_UPDATE_CHECK_REPO ?? '').trim() || DEFAULT_REPO
    const current = readAppVersion()
    const fetched = await fetchLatestRelease(repo)
    const result = decideUpdate(current, fetched.release)
    // 远端取不到时把失败原因并进 reason(判据层只负责「没 release」这一格)
    const merged: UpdateCheckResult =
      result.determined || fetched.reason === undefined
        ? result
        : { ...result, reason: fetched.reason }

    // 只缓存**判定成功**的结果:未判定时缓存会把一次网络故障固化 6 小时
    if (merged.determined) cache = { at: now, result: merged }
    return reply.send(success({ ...merged, repo, cached: false }))
  })
}

export default systemUpdateCheckRoutes
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
