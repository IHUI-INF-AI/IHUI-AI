// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 台账票 59 格「消息级版本切换」小程序腿回归(2026-11-01)。
//
// 端内 vitest 为 `environment: 'node'`(无 jsdom,`@tarojs/components` 渲染级测不到),同
// `t64-message-flags-miniapp.test.ts` 的三组切法:
// ① 行为半 —— 直接调本屏真正消费的共享纯函数 `projectActiveMessages`/`versionFamilyPosition`
//    (判族唯一源 @ihui/shared/chat/message-version-family,端内零第二份实现);
// ② 接线半 —— 源码结构断言钉住 chat.tsx 的读投影 + 版本菜单挂载点 + 「切换不写库」;
// ③ 词包半 —— `ai.messageVersion` 五语言同批齐键(§19)。
// 结构断言一律在"剥掉全部空白"的归一文本上比 —— 按字面行形状写锁会被 prettier 折行判成假红。
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  projectActiveMessages,
  versionFamilyPosition,
  type VersionFamilyMessage,
} from '@ihui/shared/chat/message-version-family'

const CHAT_SRC = readFileSync(path.resolve(__dirname, '..', 'chat.tsx'), 'utf8')
const MENU_SRC = readFileSync(path.resolve(__dirname, '..', 'message-version-menu.tsx'), 'utf8')
const ITEM_SRC = readFileSync(path.resolve(__dirname, '..', 'ChatMessageItem.tsx'), 'utf8')
const NORM = CHAT_SRC.replace(/\s+/g, '')
const MENU_NORM = MENU_SRC.replace(/\s+/g, '')

/** 一条已带服务端版本族坐标的助手消息(regenerate 落库后的行形状) */
function sibling(
  id: string,
  rootId: string,
  index: number,
): VersionFamilyMessage & { content: string } {
  return { id, content: `v${index}`, parentMessageId: rootId, siblingIndex: index }
}

/** 族根首次开族时服务端补 siblingIndex=0;未开族的普通历史行不带该键 */
function root(id: string): VersionFamilyMessage & { content: string } {
  return { id, content: 'r', parentMessageId: null, siblingIndex: 0 }
}

describe('① 行为半:读投影(与 web MessageList 同一份共享判族)', () => {
  it('默认显示最新版本 —— 族内旧 sibling 不得同屏叠成两个气泡', () => {
    const msgs = [
      { id: 'u1', content: '问', siblingIndex: null },
      root('a1'),
      sibling('a2', 'a1', 1),
      sibling('a3', 'a1', 2),
    ]
    const visible = projectActiveMessages(msgs).map((m) => m.id)
    expect(visible).toEqual(['u1', 'a3'])
  })

  it('切换可逆且确定:钉某一版只换那一族,回默认后与首次投影逐字节一致', () => {
    const msgs = [root('a1'), sibling('a2', 'a1', 1), { id: 'u2', content: '问' }]
    const first = projectActiveMessages(msgs).map((m) => m.id)
    const pinned = projectActiveMessages(msgs, { a1: 'a1' }).map((m) => m.id)
    // 默认 = 族内 siblingIndex 最大者(最新版),而不是族根
    expect(first).toEqual(['a2', 'u2'])
    expect(pinned).toEqual(['a1', 'u2'])
    expect(projectActiveMessages(msgs, { a1: 'a1' })).not.toBe(msgs)
    // 清指针(重新生成后的回落路径)⇒ 回到默认最新版本
    expect(projectActiveMessages(msgs, {}).map((m) => m.id)).toEqual(first)
  })

  it('指针指向已不存在的消息 ⇒ 回落最新版本,不得整族消失', () => {
    const msgs = [root('a1'), sibling('a2', 'a1', 1)]
    expect(projectActiveMessages(msgs, { a1: 'ghost' }).map((m) => m.id)).toEqual(['a2'])
  })

  it('族根缺席当前集合 ⇒ 整族保留(丢内容比重复严重)', () => {
    const msgs = [sibling('a2', 'gone', 1), sibling('a3', 'gone', 2)]
    expect(projectActiveMessages(msgs).map((m) => m.id)).toEqual(['a2', 'a3'])
  })

  it('位置读数:族内仅一条时返回 null(切换器不渲染 1/1 骗点击)', () => {
    const solo = [root('a1'), { id: 'u1', content: '问' }]
    expect(versionFamilyPosition(solo, 'a1')).toBeNull()
    const fam = [root('a1'), sibling('a2', 'a1', 1)]
    const pos = versionFamilyPosition(fam, 'a2')
    expect(pos).not.toBeNull()
    expect({ index: pos!.index, total: pos!.total }).toEqual({ index: 1, total: 2 })
    expect(pos!.rootId).toBe('a1')
  })
})

describe('② 接线半:chat.tsx 的读投影与版本菜单挂载点', () => {
  it('判族/投影只 import 共享层,端内不得有第二份族判定', () => {
    expect(CHAT_SRC).toContain("from '@ihui/shared/chat/message-version-family'")
    expect(NORM).toContain('projectActiveMessages(familyRows,activeVersionByRoot)')
    // 反向锁:屏幕与菜单组件都不得自己按 siblingIndex 排序/分组(那是共享层的判据)
    for (const src of [NORM, MENU_NORM]) {
      expect(src).not.toMatch(/sort\([^)]*siblingIndex/)
      expect(src).not.toMatch(/parentMessageId\?\?\w+\.id/)
    }
  })

  it('切换态是本地读投影态:写入只动 activeVersionByRoot,不写库、不发请求', () => {
    const handler = NORM.match(/consthandleSwitchMessageVersion=useCallback\(\([\s\S]*?\},\[\]\)/)
    expect(handler, '未找到 handleSwitchMessageVersion').not.toBeNull()
    expect(handler![0]).toContain('setActiveVersionByRoot((prev)=>')
    for (const forbidden of ['await', 'regenerateConversation(', 'chatStream(', 'Taro.request(']) {
      expect(handler![0], `切换处理器不得含副作用 ${forbidden}`).not.toContain(forbidden)
    }
  })

  it('版本菜单挂在 assistant 且有服务端 id 的那一条之后,吃全量 familyRows(投影前)读数', () => {
    expect(NORM).toContain('importMessageVersionMenufrom')
    expect(NORM).toContain("msg.role==='assistant'&&msg.id")
    expect(NORM).toContain('<MessageVersionMenu')
    expect(NORM).toContain('messages={versionList.familyRows}')
    expect(NORM).toContain('onSwitch={handleSwitchMessageVersion}')
    // 族枚举必须看投影前的全量:把可见行喂给菜单会让切换器永远只数到 1 版
    expect(NORM).not.toContain('messages={versionList.items')
  })

  it('渲染腿回调仍按原始下标切片(截断/长按定位吃的是 messages 的下标,不是投影后的下标)', () => {
    expect(NORM).toContain('.map((msg,idx)=>({msg,idx}))')
    // 没有服务端 id 的行(流式占位)不参与族判定,必须原样保留,不能被投影吃掉
    expect(NORM).toContain('!msg.id||visibleIds.has(msg.id)')
    expect(NORM).toContain('onLongPress={()=>handleLongPress(msg,idx)}')
    expect(NORM).toContain("msg.role==='user'?()=>handleEdit(msg,idx)")
  })

  it('重新生成成功后:族根补坐标 + 指针回落默认(不留在旧版本上)', () => {
    expect(NORM).toContain('siblingIndex:nextSiblingIndex')
    expect(NORM).toContain('setActiveVersionByRoot((prev)=>')
    expect(NORM).toContain('deletenext[siblingVersion.rootId]')
  })

  it('上行上下文截到族根之前(与 web historySource 同口径),族根缺席才回落全量前缀', () => {
    expect(NORM).toContain('constrootCut=messages.findIndex((m)=>m.id===rootId)')
    expect(NORM).toContain('rootCut===-1?messages.slice(0,lastUserIdx+1):messages.slice(0,rootCut)')
    // 反向锁:不得再无条件用"最后一个用户问题"当截断点(那样旧回复与后续轮次会混进上下文)
    expect(NORM).not.toContain('sendMessage(undefined,messages.slice(0,lastUserIdx+1),{')
  })

  it('「重新生成」必须带上被点的那一条 —— 不带 target 只会落到最后一版,族就开错了根', () => {
    expect(NORM).toContain("msg.role==='assistant'?()=>handleRegenerate(msg):undefined")
    // 反向锁:渲染腿不得再把事件对象直接当 handler 交出去(Taro onClick 的第一参是事件)
    const ITEM_NORM = ITEM_SRC.replace(/\s+/g, '')
    expect(ITEM_NORM).toContain('onClick={()=>onRegenerate(msg)}')
    expect(ITEM_NORM).not.toContain('onClick={onRegenerate}')
    expect(ITEM_SRC).toContain('onRegenerate?: (msg: ChatMessage) => void')
  })
})

describe('③ 词包半:ai.messageVersion 五语言同批(§19)', () => {
  const KEYS = ['history', 'regenerateFailed']
  const zh = JSON.parse(
    readFileSync(
      path.resolve(__dirname, '../../../../../../packages/i18n/messages/miniapp-taro/zh-CN.json'),
      'utf8',
    ),
  )
  for (const lang of ['zh-CN', 'zh-TW', 'en', 'ja', 'ko']) {
    it(`${lang}:两把键齐`, () => {
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
      const block = pack.ai.messageVersion
      for (const k of KEYS) expect(block[k], `${lang} 缺 ${k}`).toBeTruthy()
      if (lang !== 'zh-CN' && lang !== 'zh-TW') {
        for (const k of KEYS)
          expect(block[k], `${lang} 的 ${k} 与 zh-CN 同值`).not.toBe(zh.ai.messageVersion[k])
      }
    })
  }

  it('端内不硬编码中文:切换器与失败提示一律取键', () => {
    expect(MENU_SRC).toContain("t('ai.messageVersion.history')")
    expect(CHAT_SRC).toContain("t('ai.messageVersion.regenerateFailed')")
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
