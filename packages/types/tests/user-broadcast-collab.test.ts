// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D125(2026-10-23 立)`collab:invitation` / `collab:comment` 帧的构造与解析回归。
 * 权威口径:docs/d125-session-collab-design.md §4(与 D163 `checkpoint:availability` 同型追加)。
 *
 * 钉住的四格(逐格对应一个"账面绿而协作端看不见"的失效):
 *  A **构造点在位且拒坏值**:空 id / 未知 state / 坏时间,都必须抛;
 *  B **载荷里没有收信人主体**:带 `userId` / `user_id` 的一律判不合法(AGENTS §5 认证≠授权);
 *  C **解析侧与构造侧同一套规则**:构造侧拒的,parse 侧同样拦;正向帧 parse 原样认出;
 *  D **扩档不得挤掉旧档**:事件清单五档齐在,未知事件名 parse 返回 null。
 */
import { describe, it, expect } from 'vitest'

import {
  COLLAB_INVITATION_STATES,
  COLLAB_LOCK_STATES,
  USER_BROADCAST_EVENT_NAMES,
  collabInvitationEvent,
  collabCommentEvent,
  collabLockEvent,
  isCollabInvitationState,
  isCollabLockState,
  parseUserBroadcastFrame,
} from '../src/user-broadcast'

const AT = '2026-10-23T12:00:00.000Z'

describe('collab A 构造出口在位且拒坏值', () => {
  it('封闭集恰为三档(pending / accepted / revoked)', () => {
    expect([...COLLAB_INVITATION_STATES].sort()).toEqual(['accepted', 'pending', 'revoked'])
    for (const s of COLLAB_INVITATION_STATES) expect(isCollabInvitationState(s)).toBe(true)
    expect(isCollabInvitationState('expired')).toBe(false)
  })

  it('正向:invitation 帧逐字成形,at 缺省取当下(ISO 可解析)', () => {
    const evt = collabInvitationEvent({
      conversationId: 'conv-1',
      invitationId: 'inv-1',
      invitedBy: 'owner-1',
      state: 'pending',
      at: AT,
    })
    expect(evt).toEqual({
      event: 'collab:invitation',
      data: {
        conversationId: 'conv-1',
        invitationId: 'inv-1',
        invitedBy: 'owner-1',
        state: 'pending',
        at: AT,
      },
    })
    const defaulted = collabInvitationEvent({
      conversationId: 'conv-1',
      invitationId: 'inv-1',
      invitedBy: 'owner-1',
      state: 'accepted',
    })
    expect(Number.isNaN(Date.parse(defaulted.data.at))).toBe(false)
  })

  it('正向:comment 帧只带定位三元组,不带正文(拉取制)', () => {
    const evt = collabCommentEvent({
      conversationId: 'conv-1',
      messageId: 'msg-1',
      commentId: 'cmt-1',
      authorId: 'user-2',
      at: AT,
    })
    expect(evt.data).not.toHaveProperty('body')
    expect(evt).toEqual({
      event: 'collab:comment',
      data: {
        conversationId: 'conv-1',
        messageId: 'msg-1',
        commentId: 'cmt-1',
        authorId: 'user-2',
        at: AT,
      },
    })
  })

  it('反向:空 id / 未知状态 / 坏时间都抛', () => {
    expect(() =>
      collabInvitationEvent({
        conversationId: '',
        invitationId: 'i',
        invitedBy: 'o',
        state: 'pending',
      }),
    ).toThrow(/conversationId/)
    expect(() =>
      collabInvitationEvent({
        conversationId: 'c',
        invitationId: '',
        invitedBy: 'o',
        state: 'pending',
      }),
    ).toThrow(/invitationId/)
    expect(() =>
      collabInvitationEvent({
        conversationId: 'c',
        invitationId: 'i',
        invitedBy: '',
        state: 'pending',
      }),
    ).toThrow(/invitedBy/)
    expect(() =>
      collabInvitationEvent({
        conversationId: 'c',
        invitationId: 'i',
        invitedBy: 'o',
        state: 'expired' as never,
      }),
    ).toThrow(/未知状态/)
    expect(() =>
      collabInvitationEvent({
        conversationId: 'c',
        invitationId: 'i',
        invitedBy: 'o',
        state: 'pending',
        at: 'x',
      }),
    ).toThrow(/不是时间/)
    expect(() =>
      collabCommentEvent({
        conversationId: 'c',
        messageId: '',
        commentId: 'k',
        authorId: 'a',
      }),
    ).toThrow(/messageId/)
    expect(() =>
      collabCommentEvent({ conversationId: 'c', messageId: 'm', commentId: 'k', authorId: '' }),
    ).toThrow(/authorId/)
    expect(() =>
      collabCommentEvent({
        conversationId: 'c',
        messageId: 'm',
        commentId: 'k',
        authorId: 'a',
        at: 'x',
      }),
    ).toThrow(/不是时间/)
  })
})

describe('collab B 收信人主体不得从载荷进来', () => {
  it('载荷里出现 userId / user_id ⇒ 整帧判不合法(parse 返回 null)', () => {
    const invBase = {
      event: 'collab:invitation',
      data: {
        conversationId: 'c',
        invitationId: 'i',
        invitedBy: 'o',
        state: 'pending',
        at: AT,
      },
    }
    expect(
      parseUserBroadcastFrame({ ...invBase, data: { ...invBase.data, userId: 'u' } }),
    ).toBeNull()
    expect(
      parseUserBroadcastFrame({ ...invBase, data: { ...invBase.data, user_id: 'u' } }),
    ).toBeNull()
    // 阳性对照:去掉那两个键必须被认出 —— 否则上面两条可能只是"函数根本不认这个事件"
    expect(parseUserBroadcastFrame(invBase)).not.toBeNull()

    const cmtBase = {
      event: 'collab:comment',
      data: { conversationId: 'c', messageId: 'm', commentId: 'k', authorId: 'a', at: AT },
    }
    expect(
      parseUserBroadcastFrame({ ...cmtBase, data: { ...cmtBase.data, userId: 'u' } }),
    ).toBeNull()
    expect(parseUserBroadcastFrame(cmtBase)).not.toBeNull()
  })
})

describe('collab C 解析侧与构造侧同一套规则', () => {
  it('正向:构造出来的帧 parse 后原样认出', () => {
    const inv = collabInvitationEvent({
      conversationId: 'c',
      invitationId: 'i',
      invitedBy: 'o',
      state: 'revoked',
      at: AT,
    })
    expect(parseUserBroadcastFrame(inv)).toEqual(inv)
    const cmt = collabCommentEvent({
      conversationId: 'c',
      messageId: 'm',
      commentId: 'k',
      authorId: 'a',
      at: AT,
    })
    expect(parseUserBroadcastFrame(cmt)).toEqual(cmt)
  })

  it('构造侧拒的形态 parse 侧同样拦:空串 id / 未知 state / 坏时间 ⇒ null', () => {
    expect(
      parseUserBroadcastFrame({
        event: 'collab:invitation',
        data: { conversationId: '', invitationId: 'i', invitedBy: 'o', state: 'pending', at: AT },
      }),
    ).toBeNull()
    expect(
      parseUserBroadcastFrame({
        event: 'collab:invitation',
        data: { conversationId: 'c', invitationId: 'i', invitedBy: 'o', state: 'expired', at: AT },
      }),
    ).toBeNull()
    expect(
      parseUserBroadcastFrame({
        event: 'collab:comment',
        data: {
          conversationId: 'c',
          messageId: 'm',
          commentId: 'k',
          authorId: 'a',
          at: 'not-a-time',
        },
      }),
    ).toBeNull()
  })
})

describe('collab D 扩档不挤掉旧档', () => {
  it('事件清单九档齐在(既有三档 + collab 三档 + message 三档)', () => {
    expect([...USER_BROADCAST_EVENT_NAMES].sort()).toEqual(
      [
        'checkpoint:availability',
        'collab:comment',
        'collab:invitation',
        'collab:lock',
        'conversation:updated',
        'mcp:status',
        'message:created',
        'message:patched',
        'message:terminal',
      ].sort(),
    )
  })

  it('未知事件名 parse 返回 null(不静默放行)', () => {
    expect(
      parseUserBroadcastFrame({ event: 'collab:unknown', data: { conversationId: 'c' } }),
    ).toBeNull()
  })
})

/**
 * D125 另批收口(2026-10-23):`collab:lock` 帧 —— 与上面 A/B/C 同四条纪律的锁版落点。
 * 钉住的失效型:released 挂着持麦人 / acquired 说不出持麦人,都会把"没人能发言"
 * 渲染成"有人能发言"(或反之),正是写锁票要消灭的分叉形态。
 */
describe('collab E lock:构造拒坏值 + parse 同规则 + 封闭集', () => {
  it('封闭集恰为三档(acquired / taken / released)', () => {
    expect([...COLLAB_LOCK_STATES].sort()).toEqual(['acquired', 'released', 'taken'])
    for (const s of COLLAB_LOCK_STATES) expect(isCollabLockState(s)).toBe(true)
    expect(isCollabLockState('expired')).toBe(false)
  })

  it('正向:三档帧逐字成形;released 的 holderUserId 恒 null', () => {
    expect(
      collabLockEvent({ conversationId: 'c', holderUserId: 'u-1', state: 'acquired', at: AT }),
    ).toEqual({
      event: 'collab:lock',
      data: { conversationId: 'c', holderUserId: 'u-1', state: 'acquired', at: AT },
    })
    const released = collabLockEvent({ conversationId: 'c', holderUserId: null, state: 'released' })
    expect(released.data.holderUserId).toBeNull()
    expect(Number.isNaN(Date.parse(released.data.at))).toBe(false)
  })

  it('反向:空 conversationId / 未知 state / released 带人 / 抢麦缺人都抛', () => {
    expect(() =>
      collabLockEvent({ conversationId: '', holderUserId: 'u', state: 'acquired' }),
    ).toThrow()
    expect(() =>
      collabLockEvent({ conversationId: 'c', holderUserId: 'u', state: 'held' as never }),
    ).toThrow()
    expect(() =>
      collabLockEvent({ conversationId: 'c', holderUserId: 'u', state: 'released' }),
    ).toThrow()
    expect(() =>
      collabLockEvent({ conversationId: 'c', holderUserId: null, state: 'taken' }),
    ).toThrow()
    expect(() =>
      collabLockEvent({ conversationId: 'c', holderUserId: 'u', state: 'acquired', at: 'nope' }),
    ).toThrow()
  })

  it('parse 往返 + 载荷拒 userId 键 + released 带人整帧判不合法', () => {
    const evt = collabLockEvent({
      conversationId: 'c',
      holderUserId: 'u-1',
      state: 'taken',
      at: AT,
    })
    expect(parseUserBroadcastFrame({ event: evt.event, data: evt.data })).toEqual(evt)
    expect(
      parseUserBroadcastFrame({
        event: 'collab:lock',
        data: { conversationId: 'c', holderUserId: 'u', state: 'acquired', at: AT, userId: 'u' },
      }),
    ).toBeNull()
    expect(
      parseUserBroadcastFrame({
        event: 'collab:lock',
        data: { conversationId: 'c', holderUserId: 'u', state: 'released', at: AT },
      }),
    ).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
