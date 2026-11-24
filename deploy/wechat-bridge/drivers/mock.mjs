// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * mock 驱动：不连接微信，只验证桥契约与 IHUI 侧链路。
 * 入站消息用 POST /ingest 注入；发送只写内存日志。
 */

let counter = 0

export function createDriver() {
  const contacts = [
    { wxid: 'wxid_mock_alice', nickname: 'Mock 客户 A', remark: 'mock' },
    { wxid: 'wxid_mock_bob', nickname: 'Mock 客户 B', remark: '' },
  ]
  return {
    async status() {
      return { online: true, selfWxid: 'wxid_mock_bot', mode: 'mock' }
    },
    async send(payload) {
      counter += 1
      console.log('[mock] send', JSON.stringify(payload))
      return { messageId: `mock-${Date.now()}-${counter}` }
    },
    async action(action, payload) {
      console.log('[mock] action', action, JSON.stringify(payload))
      if (action === 'contact.sync') return { data: { contacts } }
      if (action === 'contact.delete') {
        const index = contacts.findIndex((item) => item.wxid === payload.memberId)
        if (index >= 0) contacts.splice(index, 1)
        return { data: { deleted: payload.memberId ?? null } }
      }
      if (action === 'group.create') {
        return {
          data: {
            action,
            chatId: payload.chatId ?? `mock-${Date.now()}@chatroom`,
            title: payload.title ?? '',
          },
        }
      }
      if (action === 'group.members') {
        return {
          data: {
            members: [
              { wxid: 'wxid_mock_alice', nickname: 'Mock 群主', role: 'owner' },
              { wxid: 'wxid_mock_bob', nickname: 'Mock 客户 B', role: 'member' },
              { wxid: 'wxid_mock_bot', nickname: 'Mock 机器人', role: 'member' },
            ],
          },
        }
      }
      if (action === 'history.fetch') {
        const chatId = payload.chatId ?? 'wxid_mock_alice'
        return {
          data: {
            messages: [
              {
                platformChatId: chatId,
                platformMessageId: `mock-history-${chatId}-1`,
                conversationKind: chatId.endsWith('@chatroom') ? 'group' : 'private',
                direction: 'inbound',
                kind: 'text',
                senderId: chatId,
                senderName: 'Mock 历史客户',
                content: '这是一条 mock 历史消息',
                sentAt: 1_700_000_000,
              },
              {
                platformChatId: chatId,
                platformMessageId: `mock-history-${chatId}-2`,
                conversationKind: chatId.endsWith('@chatroom') ? 'group' : 'private',
                direction: 'outbound',
                kind: 'text',
                senderId: 'wxid_mock_bot',
                senderName: 'Mock 机器人',
                content: '这是 mock 历史回复',
                sentAt: 1_700_000_060,
              },
            ],
            count: 2,
          },
        }
      }
      if (action.startsWith('group.')) return { data: { action, chatId: payload.chatId ?? null } }
      if (action === 'moment.publish') return { data: { published: true } }
      if (action === 'moment.fetch') {
        return {
          data: {
            paging: 'driver',
            source: 'mock',
            pages: 1,
            moments: [
              {
                id: 'mock-moment-1',
                authorId: 'wxid_mock_alice',
                authorName: 'Mock 客户',
                content: '朋友圈只读遍历演示：这是一条 mock 动态。',
                mediaUrls: [],
                createdAt: 1_760_000_000,
                source: 'mock',
              },
              {
                id: 'mock-moment-2',
                authorId: 'wxid_mock_bob',
                authorName: 'Mock 伙伴',
                content: '第二条 mock 动态，用于验证列表与去重。',
                mediaUrls: [],
                createdAt: 1_759_999_000,
                source: 'mock',
              },
            ],
          },
        }
      }
      return { status: 'unsupported', reason: `mock 不支持 ${action}` }
    },
    async typing() {},
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
