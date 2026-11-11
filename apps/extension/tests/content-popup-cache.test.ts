// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * DBG-67 / DBG-68 回归锁: 内容脚本选区弹层与译文缓存。
 * - DBG-67: 缓存 key 曾只取原文前 32 字符 ⇒ 同前缀不同长句互相污染(串词)。
 *   现在 key 必须是完整原文,且容量有界(满则 FIFO 淘汰)。
 * - DBG-68: TTL 曾按 document.getElementById(CTX_POPUP_ID) 删"当前"节点 ⇒
 *   定时器到点误删别的弹层;且旧定时器不清理,多个 TTL 叠加。
 *   现在定时器句柄模块级持有、重建前 clearTimeout、到期删闭包捕获的本次节点。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const content = readFileSync(
  fileURLToPath(new URL('../entrypoints/content.ts', import.meta.url)),
  'utf8',
)

// 注释里会复述旧实现字样(如 `text.slice(0, 32)`),负断言必须先剥整行注释
const code = content
  .split('\n')
  .filter((line) => !line.trim().startsWith('//'))
  .join('\n')

describe('译文缓存 key 全文化 (DBG-67)', () => {
  it('key 取完整原文,不再截前 32 字符', () => {
    expect(code).toContain('const key = text')
    expect(code).not.toContain('slice(0, 32)')
    expect(code).not.toContain('slice(0,32)')
  })

  it('缓存容量有界且满时 FIFO 淘汰最早键', () => {
    expect(content).toContain('TRANSLATION_CACHE_MAX')
    expect(content).toContain('translationCache.keys().next().value')
    expect(content).toContain('translationCache.delete(oldest)')
  })
})

describe('弹层 TTL 句柄级管理 (DBG-68)', () => {
  it('定时器句柄模块级持有,创建新弹层前先清旧定时器', () => {
    expect(content).toContain('let ctxPopupTimer')
    expect(content).toContain('clearTimeout(ctxPopupTimer)')
  })

  it('TTL 回调删除的是闭包捕获的本次节点,而非按 id 找"当前"', () => {
    const start = content.indexOf('ctxPopupTimer = setTimeout')
    expect(start).toBeGreaterThan(-1)
    const end = content.indexOf('}, CTX_POPUP_TTL_MS)', start)
    expect(end).toBeGreaterThan(start)
    const timerBody = content.slice(start, end)
    expect(timerBody).toContain('popup.remove()')
    expect(timerBody).toContain('ctxPopupTimer = null')
    expect(timerBody).not.toContain('getElementById')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
