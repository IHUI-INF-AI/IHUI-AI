// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 朋友圈评论结构化格式化单测：普通署名、回复关系、昵称回退、超限截断与脏值兜底逐档对账。
 */
import { describe, expect, it } from 'vitest'
import type { WechatMomentCommentView } from '@ihui/types'
import { formatMomentComments } from '../moment-comment-format'

function cmt(overrides: Partial<WechatMomentCommentView>): WechatMomentCommentView {
  return {
    username: 'wxid_a',
    nickname: '阿花',
    content: '好看',
    commentId: 'c1',
    refCommentId: null,
    ...overrides,
  }
}

describe('moment-comment-format / 普通评论', () => {
  it('昵称齐全时按「昵称：内容」输出，顺序保持原数组顺序', () => {
    const result = formatMomentComments([
      cmt({ commentId: 'c1', nickname: '阿花', content: '这周末去哪玩' }),
      cmt({ commentId: 'c2', username: 'wxid_b', nickname: '大强', content: '爬山去' }),
    ])
    expect(result).toEqual({
      total: 2,
      lines: ['阿花：这周末去哪玩', '大强：爬山去'],
    })
  })
})

describe('moment-comment-format / 回复关系', () => {
  it('refCommentId 命中被回复条目时拼出「昵称 回复 被回复者昵称：内容」', () => {
    const result = formatMomentComments([
      cmt({ commentId: 'c1', nickname: '阿花', content: '这周末去哪玩', refCommentId: null }),
      cmt({
        commentId: 'c2',
        username: 'wxid_b',
        nickname: '大强',
        content: '爬山去',
        refCommentId: 'c1',
      }),
    ])
    expect(result.total).toBe(2)
    expect(result.lines).toEqual(['阿花：这周末去哪玩', '大强 回复 阿花：爬山去'])
  })

  it('找不到被回复条目时退回普通格式，不拼出空昵称也不报错', () => {
    const result = formatMomentComments([
      cmt({ commentId: 'c2', nickname: '大强', content: '接一句话', refCommentId: 'missing-id' }),
    ])
    expect(result.total).toBe(1)
    expect(result.lines).toEqual(['大强：接一句话'])
  })

  it('被回复者昵称缺失时同样按 wxid → 匿名回退', () => {
    const result = formatMomentComments([
      cmt({ commentId: 'c1', nickname: undefined, username: 'wxid_target', content: '原评论' }),
      cmt({ commentId: 'c2', nickname: '大强', content: '回复一句', refCommentId: 'c1' }),
    ])
    expect(result.lines).toEqual(['wxid_target：原评论', '大强 回复 wxid_target：回复一句'])
  })
})

describe('moment-comment-format / 署名回退', () => {
  it('昵称缺失回退 wxid，昵称与 wxid 都为空时用匿名', () => {
    const result = formatMomentComments([
      cmt({ commentId: 'c1', nickname: '', username: 'wxid_xyz', content: '第一条' }),
      cmt({ commentId: 'c2', nickname: undefined, username: '', content: '第二条' }),
    ])
    expect(result.total).toBe(2)
    expect(result.lines).toEqual(['wxid_xyz：第一条', '匿名：第二条'])
  })
})

describe('moment-comment-format / 截断与兜底', () => {
  it('超过 4 条时 lines 截断到 4 条，total 保留完整条数', () => {
    const items = Array.from({ length: 6 }, (_, i) =>
      cmt({ commentId: `c${i + 1}`, nickname: `用户${i + 1}`, content: `评论${i + 1}` }),
    )
    const result = formatMomentComments(items)
    expect(result.total).toBe(6)
    expect(result.lines).toEqual(['用户1：评论1', '用户2：评论2', '用户3：评论3', '用户4：评论4'])
  })

  it('空数组、undefined、null 与缺字段脏元素都不抛异常，返回空结果', () => {
    expect(formatMomentComments(undefined)).toEqual({ lines: [], total: 0 })
    expect(formatMomentComments(null)).toEqual({ lines: [], total: 0 })
    expect(formatMomentComments([])).toEqual({ lines: [], total: 0 })
    expect(
      formatMomentComments([
        null,
        undefined,
        123,
        '',
        [],
        {},
        { content: '   ' },
      ] as unknown as WechatMomentCommentView[]),
    ).toEqual({ lines: [], total: 0 })
  })

  it('正文换行原样保留，交给展示层 whitespace-pre-wrap 还原', () => {
    const result = formatMomentComments([
      cmt({ commentId: 'c1', nickname: '阿花', content: '第一行\n第二行' }),
    ])
    expect(result.lines).toEqual(['阿花：第一行\n第二行'])
  })
})
