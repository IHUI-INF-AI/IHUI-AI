// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 朋友圈展示文案纯函数单测：评论署名与回复、正文折叠截断、点赞昵称去重、超限与脏值兜底逐档对账。
 */
import { describe, expect, it } from 'vitest'
import type { WechatMomentCommentView } from '@ihui/types'
import {
  dedupeMomentLikeUsers,
  formatMomentBody,
  formatMomentComments,
} from '../moment-comment-format'

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

describe('moment-comment-format / 正文折叠截断', () => {
  it('120 字以内原样返回，不出现折叠态', () => {
    const short = '短正文'
    expect(formatMomentBody(short)).toEqual({ text: short, collapsed: false })
  })

  it('恰好 120 字不截断，不出现折叠态', () => {
    const exact = '长'.repeat(120)
    expect(formatMomentBody(exact)).toEqual({ text: exact, collapsed: false })
  })

  it('超过 120 字截断为前 120 字并补省略号，标记折叠态', () => {
    const long = '长'.repeat(121)
    expect(formatMomentBody(long)).toEqual({
      text: `${'长'.repeat(120)}…`,
      collapsed: true,
    })
  })

  it('null、undefined 与非字符串按空串处理，不抛异常', () => {
    expect(formatMomentBody(null)).toEqual({ text: '', collapsed: false })
    expect(formatMomentBody(undefined)).toEqual({ text: '', collapsed: false })
  })

  it('截断时换行原样保留，不在结构化阶段吞掉', () => {
    const mixed = `第一行\n${'长'.repeat(121)}`
    const result = formatMomentBody(mixed)
    expect(result.collapsed).toBe(true)
    expect(result.text).toEqual(`第一行\n${'长'.repeat(116)}…`)
  })
})

describe('moment-comment-format / 点赞昵称去重', () => {
  it('trim 后剔除空串，同名只保留首次出现顺序', () => {
    expect(
      dedupeMomentLikeUsers(['阿花', '阿花', ' 大强 ', '大强', '', '   ', 'wxid_c']),
    ).toEqual(['阿花', '大强', 'wxid_c'])
  })

  it('null、undefined 与非字符串元素返回空数组，不抛异常', () => {
    expect(dedupeMomentLikeUsers(null)).toEqual([])
    expect(dedupeMomentLikeUsers(undefined)).toEqual([])
    expect(dedupeMomentLikeUsers([123, null, undefined, ''] as unknown as string[])).toEqual([])
  })
})
