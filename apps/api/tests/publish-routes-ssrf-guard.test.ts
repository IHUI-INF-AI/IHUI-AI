// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan)
// SSRF 回归锁:publish-routes 的上游地址必须由 buildPublishUpstream 构造,且拒绝任何带 host/scheme 的 path。
// 任何让 fetch 目标主机脱离 config.AI_SERVICE_URL 的改动都会让这些用例变红。
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { buildPublishUpstream } from '../src/routes/publish-routes.js'

describe('buildPublishUpstream SSRF 闸', () => {
  it('正常相对路径 → 落在固定内部主机下', () => {
    const url = buildPublishUpstream('/platforms')
    expect(url).toContain('/api/publish/platforms')
    // 主机必须是 config.AI_SERVICE_URL,绝不能是其它主机
    expect(url).toMatch(/^https?:\/\//)
    expect(url).not.toContain('//evil.com')
    expect(url).not.toContain('169.254.169.254')
  })

  it('带查询串的相对路径放行', () => {
    const url = buildPublishUpstream('/tasks?status=running')
    expect(url).toContain('/api/publish/tasks?status=running')
  })

  it('变异自证://host 注入被拒', () => {
    expect(() => buildPublishUpstream('//evil.com/x')).toThrow(/SSRF/)
  })

  it('带 scheme 的 path 被拒', () => {
    expect(() => buildPublishUpstream('http://169.254.169.254/latest/meta-data/')).toThrow(/SSRF/)
  })

  it('path 内嵌 :// 被拒', () => {
    expect(() => buildPublishUpstream('/x/http://evil.com')).toThrow(/SSRF/)
  })

  it('变异自证:源文件中 SSRF 判据必须始终在位', () => {
    const src = readFileSync(new URL('../src/routes/publish-routes.ts', import.meta.url), 'utf8')
    const hasGuard =
      /export function buildPublishUpstream/.test(src) &&
      /possible SSRF/.test(src) &&
      /new URL\(config\.AI_SERVICE_URL\)/.test(src)
    expect(hasGuard, 'buildPublishUpstream 的 SSRF 判据应始终在位').toBe(true)
  })
})
