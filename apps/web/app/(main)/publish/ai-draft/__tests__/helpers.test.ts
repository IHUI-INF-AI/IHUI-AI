// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'

import {
  buildPrepareDraftPayload,
  collectBlockingChecks,
  failureTitle,
  type PrepareDraftResult,
} from '../helpers'

describe('一句话出稿请求体', () => {
  it('固定口径落在请求体，平台去重且去掉空值', () => {
    const payload = buildPrepareDraftPayload({
      brief: '  讲清楚一人公司为什么先跑发布链路  ',
      platforms: ['wechat', 'wechat', '', 'xiaohongshu'],
    })
    expect(payload.brief).toBe('讲清楚一人公司为什么先跑发布链路')
    expect(payload.platforms).toEqual(['wechat', 'xiaohongshu'])
    expect(payload).toMatchObject({
      profile: 'ihui_koubo',
      format: 'md',
      min_chars: 470,
      max_chars: 490,
      title_chars: 16,
      hashtag_count: 5,
    })
  })

  it('空语气回落到自然聊天，不把空串发给服务端', () => {
    const payload = buildPrepareDraftPayload({ brief: '测试', platforms: ['wechat'], tone: '  ' })
    expect(payload.tone).toBe('口语化、自然聊天')
  })
})

describe('合规阻断项提取', () => {
  it('只取 level=block，warn 不阻塞', () => {
    const result: PrepareDraftResult = {
      ok: false,
      contentCheck: {
        blocking: 1,
        warnings: 2,
        checks: [
          { code: 'length.min', level: 'block', message: '正文字数不足' },
          { code: 'tone', level: 'warn', message: '语气偏硬' },
          { code: 'hashtag.format', level: 'warn', message: '话题词格式' },
        ],
      },
    }
    expect(collectBlockingChecks(result)).toEqual([
      { code: 'length.min', level: 'block', message: '正文字数不足' },
    ])
  })

  it('没有 checks 时返回空数组，不炸页面', () => {
    expect(collectBlockingChecks(null)).toEqual([])
    expect(collectBlockingChecks({ ok: false })).toEqual([])
  })
})

describe('业务失败标题', () => {
  it('已知错误码给人话，未知错误码回落到 message', () => {
    expect(failureTitle({ ok: false, errorCode: 'NO_ACCOUNT' })).toContain('账号')
    expect(failureTitle({ ok: false, errorCode: 'PREFLIGHT_BLOCKED' })).toContain('草稿没有落库')
    expect(failureTitle({ ok: false, message: '模型超时' })).toBe('模型超时')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
