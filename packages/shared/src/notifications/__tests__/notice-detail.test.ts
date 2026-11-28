// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'

import {
  buildNoticeDetail,
  noticeDetailCopyText,
  noticeTypeLabelKey,
  readNoticeSessionId,
} from '../notice-detail'

describe('站内消息详情投影', () => {
  it('空标题取正文首行前 40 字;正文原样保留(不截断)', () => {
    const long = '第一行标题候选\n第二行开始的很长正文,'.repeat(6)
    const detail = buildNoticeDetail({ id: 'n1', title: '   ', content: `  ${long}` })
    expect(detail.title).toBe('第一行标题候选')
    expect(detail.content).toBe(`  ${long}`)
  })

  it('read 与 isRead 两种字段名都认;缺省按已读(不制造假未读红点)', () => {
    expect(buildNoticeDetail({ id: 'a', isRead: false }).read).toBe(false)
    expect(buildNoticeDetail({ id: 'b', read: true, isRead: false }).read).toBe(true)
    expect(buildNoticeDetail({ id: 'c' }).read).toBe(true)
  })

  it('深链 id 只从对象载荷的 sessionId 读;数组/标量/空串一律 null', () => {
    expect(readNoticeSessionId({ sessionId: 'auto_7' })).toBe('auto_7')
    expect(readNoticeSessionId({ sessionId: '' })).toBeNull()
    expect(readNoticeSessionId(['auto_7'])).toBeNull()
    expect(readNoticeSessionId('auto_7')).toBeNull()
    expect(readNoticeSessionId(null)).toBeNull()
  })

  it('source.sessionId 优先于载荷读取', () => {
    const detail = buildNoticeDetail({
      id: 'd',
      sessionId: 'explicit',
      payload: { sessionId: 'from_payload' },
    })
    expect(detail.sessionId).toBe('explicit')
  })

  it('复制文本 = 标题 + 全文,空段不占位', () => {
    expect(
      noticeDetailCopyText(buildNoticeDetail({ id: 'x', title: '公告', content: '正文' })),
    ).toBe('公告\n\n正文')
    expect(noticeDetailCopyText(buildNoticeDetail({ id: 'y', content: '只有正文' }))).toBe(
      '只有正文',
    )
  })

  it('类型文案键与消息中心四档同源', () => {
    expect(noticeTypeLabelKey('order')).toBe('messageCenter.type.order')
    expect(noticeTypeLabelKey('course')).toBe('messageCenter.type.course')
    expect(noticeTypeLabelKey('comment')).toBe('messageCenter.type.social')
    expect(noticeTypeLabelKey('automation')).toBe('messageCenter.type.system')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
