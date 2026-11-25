// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 微信 4.x 本地 DB sidecar 驱动（默认关闭，显式授权才启用）。
 *
 * 边界：
 * - 只有 BRIDGE_DB_SIDECAR=on 才允许执行；
 * - 通过 BRIDGE_DB_PYTHON 指向独立 venv 里的 python，不 vendor 第三方包；
 * - 每次只读 sns.db，stdout 输出 JSON；不写微信目录、不点 UI、不发消息；
 * - 失败时返回 failed/unsupported，绝不回填假图片、假点赞或假作者。
 */

import { execFile } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(fileURLToPath(import.meta.url))
const SCRIPT =
  process.env.BRIDGE_DB_SCRIPT ?? join(ROOT, '..', '..', 'wechat-db-sidecar', 'fetch_moments.py')
const PYTHON = process.env.BRIDGE_DB_PYTHON ?? process.env.PYTHON ?? 'python'

function enabled() {
  return String(process.env.BRIDGE_DB_SIDECAR ?? '').toLowerCase() === 'on'
}

function runPython(extraArgs) {
  const args = [SCRIPT, ...extraArgs]
  const env = {
    ...process.env,
    BRIDGE_DB_DIR: process.env.BRIDGE_DB_DIR ?? '',
    BRIDGE_DB_ACCOUNT: process.env.BRIDGE_DB_ACCOUNT ?? '',
    BRIDGE_DB_WORKDIR: process.env.BRIDGE_DB_WORKDIR ?? '',
    BRIDGE_DB_MEDIA_DIR: process.env.BRIDGE_DB_MEDIA_DIR ?? '',
  }
  return new Promise((resolve, reject) => {
    execFile(
      PYTHON,
      args,
      { env, timeout: 120_000, maxBuffer: 32 * 1024 * 1024, windowsHide: true },
      (error, stdout, stderr) => {
        if (error) {
          reject(
            new Error(
              `DB sidecar 进程失败：${error.message}${stderr ? ` / ${stderr.slice(0, 300)}` : ''}`,
            ),
          )
          return
        }
        try {
          resolve(JSON.parse(stdout))
        } catch {
          reject(new Error(`DB sidecar 返回非 JSON：${stdout.slice(0, 200)}`))
        }
      },
    )
  })
}

export async function createDriver() {
  return {
    name: 'db',
    async status() {
      if (!enabled()) {
        return {
          online: false,
          status: 'db-sidecar-disabled',
          reason: 'BRIDGE_DB_SIDECAR 未设为 on，DB sidecar 保持关闭',
        }
      }
      return { online: true, status: 'db-sidecar-ready', reason: null }
    },
    async action(action, body) {
      if (action !== 'moment.fetch') {
        return { status: 'unsupported', reason: 'DB sidecar 只支持朋友圈只读导出' }
      }
      if (!enabled()) {
        return {
          status: 'unsupported',
          reason: 'DB sidecar 默认关闭；显式设置 BRIDGE_DB_SIDECAR=on 后才可读取本地库',
        }
      }
      const limit = Number(body?.limit ?? process.env.BRIDGE_DB_LIMIT ?? 0)
      const args = ['--limit', String(Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 0)]
      if (process.env.BRIDGE_DB_MEDIA_DOWNLOAD === '1') args.push('--download-media')
      let data
      try {
        data = await runPython(args)
      } catch (e) {
        return {
          status: 'failed',
          reason: e instanceof Error ? e.message : 'DB sidecar 失败',
          data: { stopReason: 'error', source: 'db' },
        }
      }
      if (!data || data.ok !== true) {
        return {
          status: 'failed',
          reason: data?.reason || 'DB sidecar 未返回 ok',
          data: { stopReason: 'error', source: 'db' },
        }
      }
      return {
        status: 'accepted',
        data: {
          ...data,
          source: 'db',
          driver: 'db',
          paging: 'driver',
          pages: 1,
          maxPages: 1,
          fetched: Array.isArray(data.moments) ? data.moments.length : 0,
          total: Number(data.total ?? 0),
          stopReason: 'no-more-data',
          limitReached: false,
        },
      }
    },
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
