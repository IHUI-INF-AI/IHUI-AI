// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 台账号 G-664 —— 关停期新建实例立即回收。
//
// 立因:关停开始后仍有 create() 被调用的窗口(在飞请求的懒初始化、后台任务的懒连接),
// 旧形状下产物直接交给调用方 —— 关停结束后进程里多出一个"没人管的新句柄",永不 dispose。
//
// 本套件钉六件事(纯单元,不连库/不连 Redis §5):
//   ① 正向对照:serving 期 guardCreate ⇒ 原样返回,close 零调用(判据不得恒红)
//   ② 主格:beginShutdown 后 guardCreate ⇒ 抛 ServingError 且新建体 close 恰好 1 次
//   ③ 竞态窗:关停在 create() 等待窗口内开始 ⇒ 同样抛 + close(迟到实例由创建边界释放)
//   ④ memoize:gate 回收后既有清理链再 close ⇒ 真实 close 仍只执行 1 次(不二次执行)
//   ⑤ 聚合错误:close 抛错 ⇒ ServingError 消息聚合该错误;再次 close 重放同一错误(不吞)
//   ⑥ assertServing/isServing 状态机:stopping 后必抛,点名 label
import { describe, it, expect, vi } from 'vitest'
import { createServingGate, ServingError } from '../src/utils/shutdown-phases.js'

interface FakeHandle {
  close: () => Promise<void>
  closed: number
}

function makeHandle(closeImpl?: () => Promise<void>): FakeHandle {
  return {
    closed: 0,
    async close() {
      this.closed++
      if (closeImpl) await closeImpl()
    },
  }
}

describe('G-664 关停闸:createServingGate', () => {
  it('① 正向对照:serving 期 guardCreate 原样返回,close 零调用', async () => {
    const gate = createServingGate('测试服务')
    const handle = makeHandle()
    const spy = vi.spyOn(handle, 'close')

    await expect(gate.guardCreate(async () => handle)).resolves.toBe(handle)
    expect(gate.isServing()).toBe(true)
    expect(spy).not.toHaveBeenCalled()
  })

  it('② 主格:beginShutdown 后调工厂 ⇒ 抛 ServingError 且新建体被 close 恰好 1 次', async () => {
    const gate = createServingGate('测试服务')
    gate.beginShutdown()
    const handle = makeHandle()

    await expect(gate.guardCreate(async () => handle)).rejects.toThrow(ServingError)
    expect(handle.closed).toBe(1)
  })

  it('③ 竞态窗:关停在 create() 等待窗口内开始 ⇒ 迟到实例同样被回收并拒绝', async () => {
    const gate = createServingGate('竞态服务')
    const handle = makeHandle()
    let resolveCreate: (h: FakeHandle) => void = () => {}
    const slowCreate = new Promise<FakeHandle>((resolve) => {
      resolveCreate = resolve
    })

    const pending = gate.guardCreate(() => slowCreate)
    // create 还没 resolve 时关停开始 —— 这正是"迟到资源"的出生窗口
    gate.beginShutdown()
    resolveCreate(handle)

    await expect(pending).rejects.toThrow(ServingError)
    expect(handle.closed).toBe(1)
  })

  it('④ memoize:gate 回收后既有清理链再 close ⇒ 真实 close 仍只执行 1 次', async () => {
    const gate = createServingGate('memo 服务')
    gate.beginShutdown()
    const handle = makeHandle()

    await expect(gate.guardCreate(async () => handle)).rejects.toThrow(ServingError)
    expect(handle.closed).toBe(1)
    // 拥有者不知道 gate 已回收,照常走清理链:不得二次执行真实 close
    await expect(handle.close()).resolves.toBeUndefined()
    expect(handle.closed).toBe(1)
  })

  it('⑤ 聚合错误:close 抛错 ⇒ ServingError 聚合该错误;再 close 重放同一错误(不吞不重复执行)', async () => {
    const gate = createServingGate('聚合服务')
    gate.beginShutdown()
    const handle = makeHandle(async () => {
      throw new Error('socket 已销毁')
    })

    const rejection = gate.guardCreate(async () => handle)
    await expect(rejection).rejects.toThrow(ServingError)
    await expect(rejection).rejects.toThrow(/socket 已销毁/)

    // 失败被记住并重放:第二次 close(拥有者清理链)不吞错、也不二次执行真实 close
    await expect(handle.close()).rejects.toThrow('socket 已销毁')
    expect(handle.closed).toBe(1)
  })

  it('⑥ 状态机:assertServing 在 stopping 后必抛并点名 label', () => {
    const gate = createServingGate('点名服务')
    expect(() => gate.assertServing()).not.toThrow()
    gate.beginShutdown()
    expect(gate.isServing()).toBe(false)
    expect(() => gate.assertServing()).toThrow(ServingError)
    expect(() => gate.assertServing()).toThrow(/点名服务/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
