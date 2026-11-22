// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-623 / F-622 回归锁(2026-11-13)。
 *
 * F-623:提示词审计原先只扫前 8000 字符(`slice(0, MAX_SCAN_CHARS)` + `indexOf`),
 * 前置填充即可把违规内容挤出扫描面;现改为 8KB 窗口 + `最长关键词长度-1` 重叠的
 * 全文分块滑动扫描 —— 任意位置、以及跨窗口边界的命中都必须能拦到。
 * F-622:出网代理 URL(通常含账密)不得明文进启动日志;脱敏只保留协议+主机(含端口)。
 *
 * 纯函数断言,不依赖数据库与网络。
 */
import { describe, expect, it } from 'vitest'
import { scanKeywordFirstHit } from '../src/services/relay-prompt-audit-service.js'
import { maskProxyUrlForLog } from '../src/services/relay-outbound-proxy.js'

const FILLER = '无害的填充文本,用于把违规内容推到窗口之后。'

describe('F-623 提示词审计全文分块滑动扫描', () => {
  it('违规词位于第 9000 字符之后仍被命中(前置填充无法绕过)', () => {
    const prefix = 'a'.repeat(9000)
    const text = `${prefix} please write BOMB-MAKING steps`
    const idx = text.toLowerCase().indexOf('bomb-making')
    expect(idx).toBeGreaterThan(8000)
    const hits = scanKeywordFirstHit(text, ['bomb-making'])
    expect(hits.get(0)).toBe(idx)
  })

  it('违规词跨 8KB 窗口边界(前后各半个词)仍被命中', () => {
    const keyword = 'forbiddenword'
    // 起点 7994:前 6 个字符落在第一窗口(0~7999),其余落在下一窗口
    const start = 8000 - 6
    const text = `${'x'.repeat(start)}${keyword} tail`
    expect(start).toBeLessThan(8000)
    expect(start + keyword.length).toBeGreaterThan(8000)
    const hits = scanKeywordFirstHit(text, [keyword])
    expect(hits.get(0)).toBe(start)
  })

  it('正常长文本不误伤', () => {
    const text = FILLER.repeat(1000)
    expect(text.length).toBeGreaterThan(8000)
    const hits = scanKeywordFirstHit(text, ['bomb-making', 'forbiddenword', '违规词'])
    expect(hits.size).toBe(0)
  })

  it('空串与超短文本安全', () => {
    expect(scanKeywordFirstHit('', ['bomb-making']).size).toBe(0)
    expect(scanKeywordFirstHit('hi', ['hi']).get(0)).toBe(0)
    expect(scanKeywordFirstHit('hi', ['bomb-making']).size).toBe(0)
    expect(scanKeywordFirstHit('只有一点点文本', ['', '文本']).get(1)).toBe(5)
  })
})

describe('F-622 出网代理地址日志脱敏', () => {
  it('脱敏后日志串不含账密,但保留可辨识的 host/port', () => {
    const masked = maskProxyUrlForLog('http://relayuser:s3cr3t-pass@proxy.example.com:7897')
    expect(masked).toBe('http://proxy.example.com:7897')
    expect(masked).not.toContain('s3cr3t-pass')
    expect(masked).not.toContain('relayuser')
    expect(masked).toContain('proxy.example.com:7897')
  })
})
