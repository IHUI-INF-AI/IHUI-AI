// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import { describe, expect, it } from 'vitest'
import { __test__ } from '../src/services/sms-review-status.js'

const { reviewStatusFromCode, trimReply, secondsToIso, parseTemplateReview, parseSignReview } =
  __test__

describe('腾讯云短信审核状态映射', () => {
  it('0 / 2 视为已通过,1 审核中,-1 未通过', () => {
    expect(reviewStatusFromCode(0)).toBe('approved')
    expect(reviewStatusFromCode(2)).toBe('approved')
    expect(reviewStatusFromCode(1)).toBe('pending')
    expect(reviewStatusFromCode(-1)).toBe('rejected')
  })

  it('未知/缺省状态码一律 unknown —— 绝不默认已通过', () => {
    expect(reviewStatusFromCode(undefined)).toBe('unknown')
    expect(reviewStatusFromCode(null)).toBe('unknown')
    expect(reviewStatusFromCode(9)).toBe('unknown')
    expect(reviewStatusFromCode('0')).toBe('unknown')
  })

  it('审核意见截断到 200 字并压掉控制字符', () => {
    expect(trimReply('  已通过\n')).toBe('已通过')
    expect(trimReply('')).toBeUndefined()
    expect(trimReply(123)).toBeUndefined()
    expect(trimReply('x'.repeat(300))).toHaveLength(200)
    expect(trimReply('a\u0000b')).toBe('a b')
  })

  it('秒级时间戳转 ISO,非法值缺省', () => {
    expect(secondsToIso(1_700_000_000)).toBe(new Date(1_700_000_000_000).toISOString())
    expect(secondsToIso(0)).toBeUndefined()
    expect(secondsToIso('abc')).toBeUndefined()
  })
})

describe('腾讯云模板/签名列表响应解析', () => {
  it('模板响应按 TemplateId 建索引(真 API 的列表键是 DescribeTemplateStatusSet)', () => {
    const raw = {
      Response: {
        DescribeTemplateStatusSet: [
          { TemplateId: 2759147, StatusCode: 0, ReviewReply: '审核通过', UpdateTime: 1_700_000_000 },
          { TemplateId: 2759156, StatusCode: 1, ReviewReply: '审核中', UpdateTime: 0 },
          { TemplateId: 2759161, StatusCode: -1, ReviewReply: '禁止推广拉新', UpdateTime: 1_700_000_100 },
        ],
        TotalCount: 3,
        RequestId: 'req-1',
      },
    }
    const parsed = parseTemplateReview(raw)
    expect(Object.keys(parsed).sort()).toEqual(['2759147', '2759156', '2759161'])
    expect(parsed['2759147']).toMatchObject({ status: 'approved', reply: '审核通过' })
    expect(parsed['2759156']).toMatchObject({ status: 'pending' })
    expect(parsed['2759161']).toMatchObject({ status: 'rejected' })
    expect(parsed['2759147'].updatedAt).toBe(new Date(1_700_000_000_000).toISOString())
    expect(parsed['2759156'].updatedAt).toBeUndefined()
  })

  it('签名响应按 SignId 建索引', () => {
    const raw = {
      Response: {
        DescribeSignListStatusSet: [
          { SignId: 730042, StatusCode: 1, ReviewReply: '中性化,需连续包含营业执照全称' },
        ],
      },
    }
    const parsed = parseSignReview(raw)
    expect(parsed['730042'].status).toBe('pending')
    expect(parsed['730042'].reply).toContain('营业执照全称')
  })

  it('响应缺字段/非数组时返回空表,不抛错', () => {
    expect(parseTemplateReview(null)).toEqual({})
    expect(parseTemplateReview({ Response: {} })).toEqual({})
    expect(parseTemplateReview({ Response: { DescribeTemplateStatusSet: 'x' } })).toEqual({})
    expect(parseSignReview({ Response: { DescribeSignListStatusSet: [null, {}] } })).toEqual({})
  })

  it('缺 TemplateId 的条目跳过,不产生 "undefined" 键', () => {
    const parsed = parseTemplateReview({
      Response: { DescribeTemplateStatusSet: [{ StatusCode: 0 }] },
    })
    expect(parsed).toEqual({})
  })
})
