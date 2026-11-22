// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 接入套件的行为锁(2026-11-18 立)。
 *
 * 钉住:
 *   K1 不猜地址   baseUrl 空/缺协议 ⇒ 拒绝拼装。
 *   K2 默认不带 Key 面板链接默认不含 Key(对照程序默认带,那会进浏览器历史)。
 *   K3 模式与协议对账 LAN+https、public+http 都要告警(不是拦,是点名)。
 *   K4 交付物可用 handoff 必须四行齐(地址/Key/模型/协议),少一行客服就转发不出去。
 */
import { describe, it, expect } from 'vitest'
import { buildAccessKit, shouldOfferKeyLink } from '../src/services/relay-access-kit.js'

const BASE = 'http://192.168.1.10:8790'
const KEY = 'ihui_sk_abcdef1234567890'

describe('relay-access-kit', () => {
  it('K4 正常输入 ⇒ 面板链接 + 四行 handoff', () => {
    const r = buildAccessKit({ baseUrl: BASE, apiKey: KEY, mode: 'lan', model: 'qwen3.8-max' })
    expect(r.ok).toBe(true)
    expect(r.panelLink).toBe(`${BASE}/admin/relay`)
    expect(r.handoff?.split('\n')).toHaveLength(4)
    expect(r.handoff).toContain(KEY)
    expect(r.handoff).toContain('qwen3.8-max')
  })

  it('K2 默认不带 Key:panelLink 里不出现 key 参数', () => {
    const r = buildAccessKit({ baseUrl: BASE, apiKey: KEY, mode: 'lan' })
    expect(r.panelLink).not.toContain('key=')
  })

  it('K2b 显式要求带 Key ⇒ 带并给出泄漏告警', () => {
    const r = buildAccessKit({ baseUrl: BASE, apiKey: KEY, mode: 'lan', includeKeyInLink: true })
    expect(r.panelLink).toContain('key=')
    expect(r.warnings.join('\n')).toContain('浏览器历史')
  })

  it('K1 baseUrl 为空 ⇒ 拒绝并点名两种填法', () => {
    const r = buildAccessKit({ baseUrl: '  ', apiKey: KEY, mode: 'lan' })
    expect(r.ok).toBe(false)
    expect(r.code).toBe('bad-base-url')
    expect(r.reason).toContain('127.0.0.1')
  })

  it('K1b 缺协议 ⇒ 拒绝', () => {
    const r = buildAccessKit({ baseUrl: '192.168.1.10:8790', apiKey: KEY, mode: 'lan' })
    expect(r.ok).toBe(false)
    expect(r.reason).toContain('http://')
  })

  it('K3 LAN + https ⇒ 告警(内网证书问题)', () => {
    const r = buildAccessKit({ baseUrl: 'https://gw.example', apiKey: KEY, mode: 'lan' })
    expect(r.ok).toBe(true)
    expect(r.warnings.join('\n')).toContain('TLS')
  })

  it('K3b public + http ⇒ 告警(明文泄 Key)', () => {
    const r = buildAccessKit({ baseUrl: BASE, apiKey: KEY, mode: 'public' })
    expect(r.warnings.join('\n')).toContain('明文')
  })

  it('panelPath 给空串 ⇒ 不拼面板链接', () => {
    const r = buildAccessKit({ baseUrl: BASE, apiKey: KEY, mode: 'lan', panelPath: '' })
    expect(r.panelLink).toBeUndefined()
    expect(r.handoff).toBeTruthy()
  })

  it('apiKey 缺失 ⇒ 拒绝', () => {
    const r = buildAccessKit({ baseUrl: BASE, apiKey: '', mode: 'lan' })
    expect(r.ok).toBe(false)
    expect(r.code).toBe('missing-key')
  })

  it('尾斜杠归一:带斜杠与不带产出同一结果', () => {
    const a = buildAccessKit({ baseUrl: BASE + '/', apiKey: KEY, mode: 'lan' })
    const b = buildAccessKit({ baseUrl: BASE, apiKey: KEY, mode: 'lan' })
    expect(a).toEqual(b)
  })

  it('纯函数:同输入恒等', () => {
    const input = { baseUrl: BASE, apiKey: KEY, mode: 'lan' as const, model: 'm' }
    expect(buildAccessKit(input)).toEqual(buildAccessKit(input))
  })

  it('只有 LAN 才提示可提供带 Key 链接', () => {
    expect(shouldOfferKeyLink('lan')).toBe(true)
    expect(shouldOfferKeyLink('public')).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
