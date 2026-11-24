// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 本地桥 payload 归一化：桥没有统一规范，这里必须"三种常见形状都吃得下"，
 * 且群聊/私聊、媒体类型不能判错（判错会把群消息记成私聊，后面白名单与发送全跟着错）。
 */
import { describe, expect, it } from 'vitest'
import { bridgeCursorNeedsReset, normalizeBridgePayload } from '../wechat-hub/bridge-adapter'

describe('normalizeBridgePayload', () => {
  it('吃下单条 message 形状', () => {
    const events = normalizeBridgePayload({
      message: {
        id: 'm1',
        chatId: 'wxid-a',
        sender: 'wxid-a',
        senderName: '张三',
        type: 'text',
        content: '你好',
      },
    })
    expect(events).toHaveLength(1)
    expect(events[0]?.platformMessageId).toBe('m1')
    expect(events[0]?.conversationKind).toBe('private')
    expect(events[0]?.kind).toBe('text')
    expect(events[0]?.content).toBe('你好')
  })

  it('吃下 { data: [] } 且识别群聊与图片', () => {
    const events = normalizeBridgePayload({
      data: [
        {
          msgId: 'm2',
          roomId: 'room-1',
          roomName: '运营群',
          sender: 'wxid-b',
          type: 'image',
          url: 'https://cdn.example.com/a.png',
        },
      ],
    })
    expect(events).toHaveLength(1)
    expect(events[0]?.conversationKind).toBe('group')
    expect(events[0]?.conversationTitle).toBe('运营群')
    expect(events[0]?.kind).toBe('image')
    expect(events[0]?.mediaUrl).toBe('https://cdn.example.com/a.png')
    expect(events[0]?.content).toBe('[图片]')
  })

  it('chatId 带 @chatroom 后缀也识别为群聊', () => {
    const events = normalizeBridgePayload({
      id: 'm-group-id',
      chatId: '12345678@chatroom',
      sender: 'wxid-b',
      content: '群里好',
    })
    expect(events[0]?.conversationKind).toBe('group')
    expect(events[0]?.platformChatId).toBe('12345678@chatroom')
  })

  it('吃下裸数组并保留毫秒时间戳', () => {
    const events = normalizeBridgePayload([
      {
        id: 'm3',
        chat_id: 'wxid-c',
        from: 'wxid-c',
        msg_type: 'voice',
        timestamp: 1_760_000_000_000,
      },
    ])
    expect(events).toHaveLength(1)
    expect(events[0]?.kind).toBe('voice')
    expect(events[0]?.sentAt.getTime()).toBe(1_760_000_000_000)
  })

  it('空 messages 信封不产生空入站消息', () => {
    expect(normalizeBridgePayload({ ok: true, messages: [], nextCursor: '3' })).toEqual([])
    expect(normalizeBridgePayload({ ok: true, data: [], nextCursor: '3' })).toEqual([])
    expect(normalizeBridgePayload({ ok: true })).toEqual([])
  })

  it('未知形状不抛错，返回单条兜底事件', () => {
    const events = normalizeBridgePayload({ id: 'x', content: 'hi' })
    expect(events).toHaveLength(1)
    expect(events[0]?.platformChatId).toBe('unknown')
  })

  it('OCR 桥的 chatTitle 作为会话标题', () => {
    const events = normalizeBridgePayload({
      messages: [
        {
          id: 'ocr-1',
          chatId: 'ocr:abc',
          sender: 'ocr:abc',
          senderName: '微信ClawBot',
          type: 'text',
          content: '你好',
          chatTitle: '微信ClawBot',
        },
      ],
    })
    expect(events[0]?.conversationTitle).toBe('微信ClawBot')
    expect(events[0]?.senderName).toBe('微信ClawBot')
  })

  it('OCR 群聊：ocr:chatId + isGroup=true 仍识别为群，并保留群成员发送人', () => {
    const events = normalizeBridgePayload({
      id: 'ocr-group-1',
      chatId: 'ocr:group123',
      sender: 'ocr:member:abc',
      senderName: '张三',
      type: 'text',
      content: '明天十点开会',
      chatTitle: '项目群 (23)',
      isGroup: true,
    })
    expect(events).toHaveLength(1)
    expect(events[0]?.conversationKind).toBe('group')
    expect(events[0]?.conversationTitle).toBe('项目群 (23)')
    expect(events[0]?.senderId).toBe('ocr:member:abc')
    expect(events[0]?.senderName).toBe('张三')
  })

  it('吃下 WeChatFerry WxMsg 的 roomid/isGroup/ts 与数字 type', () => {
    const events = normalizeBridgePayload({
      id: 'wcf-1',
      type: 1,
      isGroup: true,
      sender: 'wxid-sender',
      roomid: '12345678@chatroom',
      content: '群里好',
      ts: 1_760_000_000,
    })
    expect(events).toHaveLength(1)
    expect(events[0]?.conversationKind).toBe('group')
    expect(events[0]?.platformChatId).toBe('12345678@chatroom')
    expect(events[0]?.senderId).toBe('wxid-sender')
    expect(events[0]?.kind).toBe('text')
    expect(events[0]?.sentAt.getTime()).toBe(1_760_000_000_000)
  })

  it('数字 type=3 识别图片，并用 thumb 作为媒体地址', () => {
    const events = normalizeBridgePayload({
      id: 'wcf-2',
      type: 3,
      sender: 'wxid-a',
      roomid: '',
      thumb: 'https://cdn.example.com/wcf.png',
    })
    expect(events[0]?.conversationKind).toBe('private')
    expect(events[0]?.kind).toBe('image')
    expect(events[0]?.mediaUrl).toBe('https://cdn.example.com/wcf.png')
  })

  it('吃下酷喵 fromwx/gidfromwx/msg，群消息不把群 id 记成发送人', () => {
    const events = normalizeBridgePayload({
      type: 1,
      fromwx: 'room-9@chatroom',
      gidfromwx: 'wxid-sender',
      msg: '大家好',
    })
    expect(events[0]?.conversationKind).toBe('group')
    expect(events[0]?.platformChatId).toBe('room-9@chatroom')
    expect(events[0]?.senderId).toBe('wxid-sender')
    expect(events[0]?.content).toBe('大家好')
    const privateEvent = normalizeBridgePayload({
      type: 1,
      fromwx: 'wxid-a',
      toWxid: 'wxid-me',
      msg: '私聊',
    })[0]
    expect(privateEvent?.conversationKind).toBe('private')
    expect(privateEvent?.platformChatId).toBe('wxid-a')
  })

  it('桥 seq 回退到游标之前时把游标退回 0，避免新消息被 since 过滤掉', () => {
    expect(bridgeCursorNeedsReset('4', 1)).toBe(true)
    expect(bridgeCursorNeedsReset('3', 3)).toBe(false)
    expect(bridgeCursorNeedsReset('', 0)).toBe(false)
    expect(bridgeCursorNeedsReset('abc', 1)).toBe(false)
    expect(bridgeCursorNeedsReset('3', null)).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
