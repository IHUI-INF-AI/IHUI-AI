// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 台账号 G-662 —— 迟到资源由创建边界释放(迟到句柄闸)。
//
// 立因:关停信号(abort)与 init/create 谁先到是不确定的。旧形状下关停方要么干等卡住的
// init Promise(进程假死),要么放弃等待 —— 后者出生的句柄成了"没人管的孩子",永不 dispose。
//
// 本套件钉六件事(纯单元,不连库/不连 Redis §5):
//   ① 正向对照:未关停 disposeLate ⇒ 原样返回、close 零调用(判据不得恒红)
//   ② 验收格:abort 早于 create resolve(beginShutdown 先行)⇒ disposeLate 被调用、
//      close 恰好 1 次、抛 ServingError 点名 —— 迟到句柄不得被当正常产物继续使用
//   ③ 失败必 warn:close 抛错 ⇒ log.warn 点名 + ServingError 文案聚合原因
//   ④ memoize:gate 回收后拥有者再 close ⇒ 真实 close 仍只执行 1 次(不二次执行)
//   ⑤ disposeAll:登记句柄逐个回收;单个失败 warn 不中断、记录 ok=false
//   ⑥ disposeAll 幂等:再调一次 ⇒ 空表,真实 close 不二次执行
import { describe, it, expect, vi } from 'vitest'
import {
  createLateDisposeGate,
  ServingError,
  type ShutdownPhasesLogger,
} from '../src/utils/shutdown-phases.js'

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

function makeLogSpy(): ShutdownPhasesLogger & { warns: string[] } {
  const warns: string[] = []
  return {
    warns,
    info: () => {},
    warn: (msg: string) => {
      warns.push(msg)
    },
  }
}

describe('G-662 迟到句柄闸:createLateDisposeGate', () => {
  it('① 正向对照:未关停 disposeLate 原样返回,close 零调用', async () => {
    const gate = createLateDisposeGate('测试服务')
    const handle = makeHandle()
    const spy = vi.spyOn(handle, 'close')
    await expect(gate.disposeLate('db-conn', handle)).resolves.toBe(handle)
    expect(spy).not.toHaveBeenCalled()
    expect(gate.isShutdown()).toBe(false)
  })

  it('② 验收格:abort 早于 create resolve ⇒ disposeLate 被调用,close 恰 1 次且抛 ServingError', async () => {
    const gate = createLateDisposeGate('测试服务')
    // 构造面:关停信号先于 init 产物到达(调用方在 init resolve 前已 beginShutdown)
    gate.beginShutdown()
    const handle = makeHandle()
    const spy = vi.spyOn(handle, 'close')
    await expect(gate.disposeLate('late-conn', handle)).rejects.toSatisfy(
      (e: unknown) => e instanceof ServingError && e.message.includes('late-conn'),
    )
    expect(spy).toHaveBeenCalledTimes(1)
    expect(handle.closed).toBe(1)
  })

  it('③ close 抛错 ⇒ warn 点名 + ServingError 聚合原因', async () => {
    const log = makeLogSpy()
    const gate = createLateDisposeGate('测试服务', log)
    gate.beginShutdown()
    const handle = makeHandle(async () => {
      throw new Error('fd 已被关闭')
    })
    await expect(gate.disposeLate('late-conn', handle)).rejects.toSatisfy(
      (e: unknown) =>
        e instanceof ServingError &&
        e.message.includes('回收失败') &&
        e.message.includes('fd 已被关闭'),
    )
    expect(log.warns).toHaveLength(1)
    expect(log.warns[0]).toContain('late-conn')
    expect(log.warns[0]).toContain('fd 已被关闭')
  })

  it('④ memoize:gate 当场回收后拥有者再 close,真实 close 仍只执行 1 次', async () => {
    const gate = createLateDisposeGate('测试服务')
    gate.beginShutdown()
    const handle = makeHandle()
    await expect(gate.disposeLate('late-conn', handle)).rejects.toBeInstanceOf(ServingError)
    await expect(handle.close()).resolves.toBeUndefined()
    expect(handle.closed).toBe(1)
  })

  it('⑤ disposeAll:登记句柄逐个回收,单个失败 warn 不中断且记录 ok=false', async () => {
    const log = makeLogSpy()
    const gate = createLateDisposeGate('测试服务', log)
    const ok1 = makeHandle()
    const bad = makeHandle(async () => {
      throw new Error('close 炸了')
    })
    const ok2 = makeHandle()
    await gate.disposeLate('ok1', ok1)
    await gate.disposeLate('bad', bad)
    await gate.disposeLate('ok2', ok2)
    const records = await gate.disposeAll()
    expect(records.map((r) => [r.name, r.ok])).toEqual([
      ['ok1', true],
      ['bad', false],
      ['ok2', true],
    ])
    expect(records.find((r) => r.name === 'bad')?.reason).toContain('close 炸了')
    expect(ok1.closed).toBe(1)
    expect(bad.closed).toBe(1)
    expect(ok2.closed).toBe(1)
    expect(log.warns).toHaveLength(1)
    expect(log.warns[0]).toContain('bad')
  })

  it('⑥ disposeAll 幂等:再调一次 ⇒ 空表,真实 close 不二次执行', async () => {
    const gate = createLateDisposeGate('测试服务')
    const handle = makeHandle()
    await gate.disposeLate('conn', handle)
    await gate.disposeAll()
    const again = await gate.disposeAll()
    expect(again).toEqual([])
    expect(handle.closed).toBe(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
