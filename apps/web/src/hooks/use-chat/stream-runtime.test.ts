// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 票60(2026-10-18,步序三):流式运行时域按 store 实例隔离用例。
// 咬三件事:
//  ① 同一 store 恒同一运行时记录(单例路径行为零变化的前提);
//  ② 不同实例的 abort 域互相独立 —— 窗格 A 的中断不碰窗格 B 的控制器(本票核心缺陷面);
//  ③ CustomEvent 触发面注册槽(sendInstance/actionCtx)按实例隔离,互不覆盖。

import { describe, expect, it } from 'vitest'

import { getStreamRuntime } from './stream-runtime'
import { createChatStore, useChatStore } from '@/stores/chat'

describe('getStreamRuntime 实例化运行时域', () => {
  it('同一 store 恒同一记录;单例与窗格实例各一份', () => {
    const singletonA = getStreamRuntime(useChatStore)
    const singletonB = getStreamRuntime(useChatStore)
    expect(singletonA).toBe(singletonB)

    const pane = createChatStore('ihui-chat-runtime-test')
    expect(getStreamRuntime(pane)).not.toBe(singletonA)
  })

  it('abort 域按实例隔离:A 的控制器写入不影响 B(每窗格独立中断)', () => {
    const paneA = createChatStore('ihui-chat-runtime-a')
    const paneB = createChatStore('ihui-chat-runtime-b')
    const rtA = getStreamRuntime(paneA)
    const rtB = getStreamRuntime(paneB)

    const controllerA = new AbortController()
    rtA.abortRef.current = controllerA
    expect(rtB.abortRef.current).toBeNull()
    expect(getStreamRuntime(useChatStore).abortRef.current).toBeNull()

    // 中断 A:B 与单例的控制器槽不被顶掉(改造前单例 abortRef 正是这一缺陷形态)
    controllerA.abort()
    expect(rtB.abortRef.current).toBeNull()

    const controllerB = new AbortController()
    rtB.abortRef.current = controllerB
    expect(rtA.abortRef.current).toBe(controllerA)
    expect(rtB.abortRef.current).toBe(controllerB)
  })

  it('CustomEvent 触发面注册槽按实例隔离,后注册不覆盖他实例', () => {
    const paneA = createChatStore('ihui-chat-runtime-c')
    const paneB = createChatStore('ihui-chat-runtime-d')
    const rtA = getStreamRuntime(paneA)
    const rtB = getStreamRuntime(paneB)

    const sendA = async () => true
    rtA.sendInstance = sendA
    rtA.actionCtx = { abortRef: rtA.abortRef } as never

    expect(rtB.sendInstance).toBeNull()
    expect(rtB.actionCtx).toBeNull()

    const sendB = async () => true
    rtB.sendInstance = sendB
    expect(rtA.sendInstance).toBe(sendA)
    expect(rtB.sendInstance).toBe(sendB)
  })
})
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
