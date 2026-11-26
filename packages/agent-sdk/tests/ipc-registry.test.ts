// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'
import {
  IpcRegistry,
  IpcRegistryError,
  toAuditLogParams,
  type IpcAuditEvent,
  type IpcChannelDefinition,
} from '../src/index.js'

function callChannel(name: string, result: string = 'ok'): IpcChannelDefinition {
  return { name, kind: 'call', owner: 'test', purpose: '契约测试', handler: () => result }
}

describe('RP-8 动态 IPC 注册表', () => {
  describe('call 请求-响应', () => {
    it('已注册通道正常调用并返回结果', async () => {
      const reg = new IpcRegistry()
      reg.register(callChannel('chat.send', 'sent'))
      expect(await reg.call('chat.send', { text: 'hi' })).toBe('sent')
    })

    it('handler 抛错向上传递（不吞业务异常）', async () => {
      const reg = new IpcRegistry()
      reg.register({
        name: 'boom', kind: 'call', owner: 'test', purpose: '契约测试',
        handler: () => { throw new Error('business failure') },
      })
      await expect(reg.call('boom', {})).rejects.toThrow('business failure')
    })

    it('未注册通道 fail-closed 并触发审计打点（含 sessionId）', async () => {
      const events: IpcAuditEvent[] = []
      const reg = new IpcRegistry((e) => events.push(e))
      await expect(reg.call('never.registered', {}, { sessionId: 's-42' })).rejects.toBeInstanceOf(
        IpcRegistryError,
      )
      expect(events).toHaveLength(1)
      expect(events[0]).toMatchObject({
        channel: 'never.registered', kind: 'call', reason: 'unregistered', sessionId: 's-42',
      })
      expect(Number.isFinite(events[0]!.at)).toBe(true)
    })

    it('审计事件与映射参数都不含 payload 原文', async () => {
      const events: IpcAuditEvent[] = []
      const reg = new IpcRegistry((e) => events.push(e))
      const secret = 'SECRET_PAYLOAD_DO_NOT_LEAK'
      await expect(reg.call('ghost', secret)).rejects.toBeInstanceOf(IpcRegistryError)
      expect(JSON.stringify(events)).not.toContain(secret)
      const params = toAuditLogParams(events[0]!)
      expect(JSON.stringify(params)).not.toContain(secret)
      expect(params).toMatchObject({
        action: 'ipc.channel', resourceType: 'ipc_channel',
        resourceId: 'ghost', result: 'denied',
      })
    })

    it('审计 sink 抛错不影响 fail-closed 决策', async () => {
      const reg = new IpcRegistry(() => { throw new Error('audit db down') })
      await expect(reg.call('nope', {})).rejects.toMatchObject({
        name: 'IpcRegistryError', reason: 'unregistered',
      })
    })
  })

  describe('listen / subscribe 通道', () => {
    it('已注册通道可 listen 与 subscribe，emitTo 广播到全部监听器', () => {
      const reg = new IpcRegistry()
      reg.register({ name: 'events', kind: 'listen', owner: 'test', purpose: '契约测试' })
      reg.register({ name: 'ticks', kind: 'subscribe', owner: 'test', purpose: '契约测试' })
      const seenA: unknown[] = []
      const seenB: unknown[] = []
      reg.listen('events', (p) => seenA.push(p))
      reg.subscribe('events', (p) => seenB.push(p))
      expect(reg.listenerCount('events')).toBe(2)
      expect(reg.emitTo('events', { n: 1 })).toBe(2)
      expect(seenA).toEqual([{ n: 1 }])
      expect(seenB).toEqual([{ n: 1 }])
      expect(reg.emitTo('ticks', {})).toBe(0) // 订阅通道已注册但无人监听
    })

    it('取消监听幂等：重复取消无副作用', () => {
      const reg = new IpcRegistry()
      reg.register({ name: 'e', kind: 'listen', owner: 'test', purpose: '契约测试' })
      const seen: unknown[] = []
      const off = reg.listen('e', (p) => seen.push(p))
      off(); off(); off()
      expect(reg.listenerCount('e')).toBe(0)
      expect(reg.emitTo('e', 'x')).toBe(0)
      expect(seen).toEqual([])
    })

    it('未注册通道 listen/subscribe 也 fail-closed 并打点', () => {
      const events: IpcAuditEvent[] = []
      const reg = new IpcRegistry((e) => events.push(e))
      expect(() => reg.listen('ghost-l', () => {})).toThrow(IpcRegistryError)
      expect(() => reg.subscribe('ghost-s', () => {})).toThrow(IpcRegistryError)
      expect(events.map((e) => e.kind)).toEqual(['listen', 'subscribe'])
      expect(events.map((e) => e.reason)).toEqual(['unregistered', 'unregistered'])
    })
  })

  describe('注册表不变量', () => {
    it('通道名闭集：种类不符拒绝并打点 kind-mismatch', async () => {
      const events: IpcAuditEvent[] = []
      const reg = new IpcRegistry((e) => events.push(e))
      reg.register(callChannel('only-call'))
      await expect(reg.call('only-call', {})).resolves.toBe('ok')
      expect(() => reg.listen('only-call', () => {})).toThrow(IpcRegistryError)
      expect(events[0]).toMatchObject({ channel: 'only-call', reason: 'kind-mismatch', kind: 'listen' })
    })

    it('重复注册 fail-closed 并打点 duplicate', () => {
      const events: IpcAuditEvent[] = []
      const reg = new IpcRegistry((e) => events.push(e))
      reg.register(callChannel('dup'))
      expect(() => reg.register(callChannel('dup'))).toThrow(IpcRegistryError)
      expect(events[0]).toMatchObject({ channel: 'dup', reason: 'duplicate' })
    })

    it('注销后调用拒绝并打点 revoked，重新注册后恢复', async () => {
      const events: IpcAuditEvent[] = []
      const reg = new IpcRegistry((e) => events.push(e))
      reg.register(callChannel('rev'))
      expect(reg.unregister('rev')).toBe(true)
      expect(reg.has('rev')).toBe(false)
      await expect(reg.call('rev', {})).rejects.toMatchObject({ reason: 'revoked' })
      expect(events[0]!.reason).toBe('revoked')
      reg.register(callChannel('rev', 'back'))
      expect(await reg.call('rev', {})).toBe('back')
    })

    it('非法 name/owner/purpose/kind 一律 fail-closed', () => {
      const reg = new IpcRegistry()
      expect(() => reg.register({ ...callChannel('x'), name: '' })).toThrow(IpcRegistryError)
      expect(() => reg.register({ ...callChannel('x'), owner: '' })).toThrow(IpcRegistryError)
      expect(() => reg.register({ ...callChannel('x'), purpose: '' })).toThrow(IpcRegistryError)
      expect(() =>
        reg.register({ ...callChannel('x'), kind: 'bogus' as never }),
      ).toThrow(IpcRegistryError)
    })

    it('list() 返回副本：外部改动不影响内部注册表', () => {
      const reg = new IpcRegistry()
      reg.register(callChannel('safe'))
      const list = reg.list()
      expect(list).toHaveLength(1)
      ;(list[0] as IpcChannelDefinition).name = 'tampered'
      expect(reg.has('safe')).toBe(true)
      expect(reg.has('tampered')).toBe(false)
    })

    it('无审计出口时静默 fail-closed（不因缺 sink 崩溃）', async () => {
      const reg = new IpcRegistry()
      await expect(reg.call('ghost', {})).rejects.toBeInstanceOf(IpcRegistryError)
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
