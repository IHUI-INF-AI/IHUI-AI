// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 取证助手纯函数的行为锁(2026-11-18 立)。
 *
 * 钉住:
 *   P1 脱敏   长 hex / 长 base64 / 超长数字一律 <redacted>(工具输出会被贴进工单与聊天)。
 *   P2 命中   offset 必须指向原始字节位置(用 latin1 映射,不做 UTF-8 解码)。
 *   P3 多命中 同一关键字在文件里出现多次要全部列出(端点常量常成簇出现)。
 *   P4 空输入 空 Buffer ⇒ 空数组,不抛异常。
 */
import { describe, it, expect } from 'vitest'
// arch-exempt: 被测本体(qoder 安装探针)属 repo-tooling 脚本,测试面只能单向借用其 __test__ 出口;探针搬到 apps/api/scripts 会牵动脚本清单与文档命令,单独立票再做。
import { __test__ } from '../../../scripts/qoder-local-probe.mjs'

const { redactSnippet, extractCandidates } = __test__

describe('qoder-local-probe', () => {
  it('P1 脱敏:32 位以上 hex 被替换', () => {
    const s = redactSnippet('machine_id=9f8e7d6c5b4a39281706f5e4d3c2b1a0 tail')
    expect(s).toContain('<redacted>')
    expect(s).not.toContain('9f8e7d6c5b4a39281706f5e4d3c2b1a0')
  })

  it('P1b 脱敏:长 base64url 被替换,短词保留', () => {
    const s = redactSnippet('token=' + 'A'.repeat(60) + ' end')
    expect(s).toContain('<redacted>')
    expect(s).toContain('end')
  })

  it('P1c 脱敏:控制字符压成空格且长度受限', () => {
    const s = redactSnippet('\u0000\u0001abc\u0002')
    expect(s).toBe('abc')
    expect(redactSnippet('x'.repeat(500)).length).toBeLessThanOrEqual(200)
  })

  it('P2 命中:offset 指向原始字节位置', () => {
    const buf = Buffer.from('AAAA device_authorization BBBB', 'latin1')
    const hits = extractCandidates(buf)
    const h = hits.find((x) => x.keyword === 'device_authorization')
    expect(h).toBeTruthy()
    expect(buf.slice(h.offset, h.offset + h.keyword.length).toString('latin1')).toBe('device_authorization')
  })

  it('P3 多命中:同关键字出现两次要列出两条', () => {
    const buf = Buffer.from('client_id=1 ... client_id=2', 'latin1')
    const hits = extractCandidates(buf).filter((x) => x.keyword === 'client_id')
    expect(hits.length).toBe(2)
    expect(hits[1].offset).toBeGreaterThan(hits[0].offset)
  })

  it('P4 空输入 ⇒ 空数组', () => {
    expect(extractCandidates(Buffer.alloc(0))).toEqual([])
    expect(extractCandidates(null)).toEqual([])
  })

  it('不相关文本 ⇒ 无命中', () => {
    expect(extractCandidates(Buffer.from('hello world', 'latin1'))).toEqual([])
  })

  it('双区域名能被命中(gateway / apiN)', () => {
    const buf = Buffer.from('x gateway.qoder.com.cn y api1.qoder.sh z', 'latin1')
    const kws = extractCandidates(buf).map((x) => x.keyword)
    expect(kws).toContain('gateway.qoder.com.cn')
    expect(kws).toContain('api1.qoder.sh')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
