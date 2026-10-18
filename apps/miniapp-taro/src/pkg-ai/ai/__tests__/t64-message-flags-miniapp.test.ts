// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 台账票 64 格②(小程序腿)回归:消息级钉选/收藏的写链与写回口径。
//
// 端内 vitest 为 `environment: 'node'`(无 jsdom,`@tarojs/components` 渲染级测不到),所以分三组:
// ① 行为半 —— 直接调本端真正的纯函数 `mapServerMessage`,量回放行的两个标记时刻透传;
// ② 接线半 —— 源码结构断言钉住 chat.tsx 的两枚动作(同型先例:`model-switch.test.ts` 末两组);
// ③ 词包半 —— 五语言同批齐键(§19)。
// 结构断言一律在"剥掉全部空白"的归一文本上比 —— 按字面行形状写锁会被 prettier 折行判成假红(本仓记过)。
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { mapServerMessage } from '../server-chat-replay'

const SRC = readFileSync(path.resolve(__dirname, '..', 'chat.tsx'), 'utf8')
/** 归一面:剥所有空白字符,只留语法本体(结构锁用它比,不拿行形状当判据)。 */
const NORM = SRC.replace(/\s+/g, '')

/** 服务端行的最小可信形状(其余字段本测不关心,给到 mapServerMessage 的守卫线上即可)。 */
function serverRow(extra: Record<string, unknown> = {}) {
  return {
    id: 'msg-1',
    role: 'assistant',
    content: '正文',
    createdAt: '2026-10-19T00:00:00.000Z',
    ...extra,
  } as never
}

describe('① 回放透传:服务端盖章的两个标记时刻进 UI 层行', () => {
  it('带值就带上 —— 已钉选的回放行不得读成未标记', () => {
    const mapped = mapServerMessage(
      serverRow({ pinnedAt: '2026-10-19T00:00:00.000Z', bookmarkedAt: null }),
    )
    expect(mapped).not.toBeNull()
    expect(mapped!.pinnedAt).toBe('2026-10-19T00:00:00.000Z')
    expect(mapped!.bookmarkedAt).toBeNull()
  })

  it('缺值不造 —— 服务端没给这一维就不写键,不得填 false/空串冒充已知状态', () => {
    const mapped = mapServerMessage(serverRow())
    expect('pinnedAt' in mapped!).toBe(false)
    expect('bookmarkedAt' in mapped!).toBe(false)
  })

  it('两维互不牵连 —— 只给 pinnedAt 时不得顺手挂上 bookmarkedAt', () => {
    const mapped = mapServerMessage(serverRow({ pinnedAt: '2026-10-19T08:00:00.000Z' }))
    expect(mapped!.pinnedAt).toBe('2026-10-19T08:00:00.000Z')
    expect('bookmarkedAt' in mapped!).toBe(false)
  })
})

describe('② 接线:长按动作表里的两枚标记(形态与已入库的 RN 腿同值)', () => {
  it('写链只走 @ihui/api-client 的 setMessageFlags,端内不重写第二份 fetch', () => {
    expect(NORM).toContain('setMessageFlags,')
    expect(SRC).toContain("from '@ihui/api-client'")
    expect(NORM).not.toMatch(/fetch\(`\/api\/chat\/messages/)
    // 守门 73「端内不得裸 Taro.request」在本票写链上的同一条纪律
    expect(NORM).not.toContain('Taro.request({url:`/api/chat/messages')
  })

  it('一次点击只动一把 —— 只给被点的那一维,不给空 body(空 body 服务端拒 400)', () => {
    expect(NORM).toContain(
      `...(kind==='pinned'?{pinned:!msg.pinnedAt}:{bookmarked:!msg.bookmarkedAt}),`,
    )
    // 反向锁:同一个对象字面量里不得同时给两维(三元分支各给一把是合法的,故按"同一对花括号内"判)
    expect(NORM).not.toMatch(/\{[^{}]*pinned:[^{}]*bookmarked:[^{}]*\}/)
  })

  it('写回取服务端回写的时刻,不做本地乐观翻转', () => {
    expect(NORM).toContain('constwritten=res.data?.message')
    expect(NORM).toContain('pinnedAt:written?.pinnedAt??null')
    expect(NORM).toContain('bookmarkedAt:written?.bookmarkedAt??null')
  })

  it('没有服务端 id 就不给这两项、也不发这一枪(端内流式行落库前 id 为空)', () => {
    expect(NORM).toContain('if(!msg.id)return')
    expect(NORM).toContain(`if(msg.id){actions.push({label:t(msg.pinnedAt?`)
  })

  it('两枚动作的文案一律取词,且 useCallback 依赖里带着 toggleMessageFlag', () => {
    for (const key of [
      'ai.messageAction.pin',
      'ai.messageAction.unpin',
      'ai.messageAction.bookmark',
      'ai.messageAction.unbookmark',
      'ai.messageAction.flagFailed',
    ]) {
      expect(SRC, `缺文案键 ${key}`).toContain(`'${key}'`)
    }
    expect(NORM).toContain('[t,handleReuse,handleRegenerate,toggleMessageFlag]')
  })
})

describe('③ 词包:ai.messageAction 五把键五语言同批(§19)', () => {
  const KEYS = ['pin', 'unpin', 'bookmark', 'unbookmark', 'flagFailed']
  const LEGACY = ['copy', 'delete', 'reuse']
  for (const lang of ['zh-CN', 'zh-TW', 'en', 'ja', 'ko']) {
    it(`${lang}:新五把齐且原三把未被顶掉`, () => {
      const pack = JSON.parse(
        readFileSync(
          path.resolve(
            __dirname,
            '../../../../../../packages/i18n/messages/miniapp-taro',
            `${lang}.json`,
          ),
          'utf8',
        ),
      )
      const block = pack.ai.messageAction
      for (const k of KEYS) expect(block[k], `${lang} 缺 ${k}`).toBeTruthy()
      for (const k of LEGACY) expect(block[k], `${lang} 丢了原有 ${k}`).toBeTruthy()
      // 值不得与 zh-CN 同形(除 zh-TW 与共用汉字档):挡住"复制一份中文顶四语"那一型
      if (lang !== 'zh-CN' && lang !== 'zh-TW') {
        const zh = JSON.parse(
          readFileSync(
            path.resolve(
              __dirname,
              '../../../../../../packages/i18n/messages/miniapp-taro/zh-CN.json',
            ),
            'utf8',
          ),
        ).ai.messageAction
        for (const k of KEYS) expect(block[k], `${lang} 的 ${k} 与 zh-CN 同值`).not.toBe(zh[k])
      }
    })
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
