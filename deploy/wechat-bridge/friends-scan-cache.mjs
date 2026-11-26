// © 2026 IHUI AI (智汇AI) · 版权所有: 李春川 (Li Chunchuan) · https://aizhs.top
// [IHUI-AI-PROVENANCE]: 好友申请扫描缓存口径：成功即刷新；窗口收起时回上次成功快照并标注 stale。

import fs from 'node:fs'
import path from 'node:path'

/**
 * 决定本次扫描结果如何入缓存。
 * @param {{ ok?: boolean, window?: { visible?: boolean }, requests?: unknown[], rawCount?: number }} body 桥脚本返回体
 * @param {{ at: number, body: object } | null} cache 现有缓存（内存，通常与磁盘同源）
 * @param {number} now
 * @returns {{ cache: object|null, body: object|undefined }} 应写入的缓存与最终对外返回体
 */
export function applyScanResult(body, cache, now = Date.now()) {
  if (body && body.ok === true) {
    return { cache: { at: now, body }, body }
  }
  const windowHidden = Boolean(body && body.window && body.window.visible === false)
  if (windowHidden && cache && cache.body) {
    // 微信窗口收在托盘/隐藏时 Qt 不渲染界面树，读不到任何元素。这不是故障，
    // 而是「此刻没有可读界面」：回上次成功快照并标注过期，不谎报失败。
    return {
      cache,
      body: {
        ...cache.body,
        cached: true,
        cacheAgeMs: now - cache.at,
        stale: true,
        staleReason: 'window-hidden',
      },
    }
  }
  return { cache: cache ?? null, body }
}

/** 读出上次成功快照（进程重启后仍可用）；坏文件当作没有。 */
export function loadSnapshot(file) {
  try {
    const raw = fs.readFileSync(file, 'utf8')
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed.at !== 'number' || !parsed.body || parsed.body.ok !== true) return null
    return { at: parsed.at, body: parsed.body }
  } catch {
    return null
  }
}

/** 落盘上次成功快照；失败只忽略，不影响扫描主流程。 */
export function saveSnapshot(file, cache) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, JSON.stringify(cache), 'utf8')
  } catch {
    /* 磁盘不可写时退化为纯内存缓存 */
  }
}
