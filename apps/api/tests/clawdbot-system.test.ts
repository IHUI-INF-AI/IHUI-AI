import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../src/services/clawdbot/logger.js', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { SystemService } from '../src/services/clawdbot/system.js'

describe('clawdbot SystemService 系统服务', () => {
  let svc: SystemService

  beforeEach(() => {
    svc = new SystemService()
  })

  describe('配置管理', () => {
    it('setConfig / getConfig 单个键', () => {
      svc.setConfig('key1', 'value1')
      expect(svc.getConfig('key1')).toBe('value1')
    })

    it('getConfig 不存在的键返回 undefined', () => {
      expect(svc.getConfig('nonexistent')).toBeUndefined()
    })

    it('setConfig 触发 configChanged 事件', () => {
      const handler = vi.fn()
      svc.on('configChanged', handler)
      svc.setConfig('key1', 'value1')
      expect(handler).toHaveBeenCalledWith({ key: 'key1', value: 'value1', oldValue: undefined })
    })

    it('setConfig 保留旧值到事件', () => {
      svc.setConfig('key1', 'old')
      const handler = vi.fn()
      svc.on('configChanged', handler)
      svc.setConfig('key1', 'new')
      expect(handler).toHaveBeenCalledWith({ key: 'key1', value: 'new', oldValue: 'old' })
    })

    it('getAllConfig 返回副本', () => {
      svc.setConfig('key1', 'value1')
      const all = svc.getAllConfig()
      all['key1'] = 'modified'
      expect(svc.getConfig('key1')).toBe('value1')
    })
  })

  describe('日志管理', () => {
    it('log 写入日志条目', () => {
      svc.log('info', 'test-source', 'test message')
      const logs = svc.getLogs()
      expect(logs.length).toBe(1)
      expect(logs[0].level).toBe('info')
      expect(logs[0].source).toBe('test-source')
      expect(logs[0].message).toBe('test message')
    })

    it('log 触发 log 事件', () => {
      const handler = vi.fn()
      svc.on('log', handler)
      svc.log('warn', 'src', 'msg')
      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler.mock.calls[0][0].level).toBe('warn')
    })

    it('log 包含 id 与 timestamp', () => {
      svc.log('info', 'src', 'msg')
      const logs = svc.getLogs()
      expect(logs[0].id).toMatch(/^log_\d+_/)
      expect(logs[0].timestamp).toBeGreaterThan(0)
    })

    it('getLogs 按 level 过滤', () => {
      svc.log('info', 'a', 'msg1')
      svc.log('error', 'b', 'msg2')
      svc.log('info', 'c', 'msg3')
      const infoLogs = svc.getLogs({ level: 'info' })
      expect(infoLogs.length).toBe(2)
      expect(infoLogs.every((l) => l.level === 'info')).toBe(true)
    })

    it('getLogs 按 source 过滤', () => {
      svc.log('info', 'src-a', 'msg1')
      svc.log('info', 'src-b', 'msg2')
      const filtered = svc.getLogs({ source: 'src-a' })
      expect(filtered.length).toBe(1)
      expect(filtered[0].source).toBe('src-a')
    })

    it('getLogs limit 截断', () => {
      for (let i = 0; i < 10; i++) svc.log('info', 'src', `msg${i}`)
      const limited = svc.getLogs({ limit: 3 })
      expect(limited.length).toBe(3)
      expect(limited[0].message).toBe('msg7')
    })

    it('clearLogs 返回清除数量并清空', () => {
      svc.log('info', 'a', 'msg1')
      svc.log('info', 'b', 'msg2')
      const count = svc.clearLogs()
      expect(count).toBe(2)
      expect(svc.getLogs().length).toBe(0)
    })

    it('日志超过 maxLogs 时移除最旧的', () => {
      for (let i = 0; i < 1001; i++) svc.log('info', 'src', `msg${i}`)
      expect(svc.getLogs().length).toBeLessThanOrEqual(1000)
    })
  })

  describe('监控指标', () => {
    it('getMetrics 返回 uptime 与资源使用', () => {
      const m = svc.getMetrics()
      expect(m.uptime).toBeGreaterThanOrEqual(0)
      expect(m.memoryUsage).toBeDefined()
      expect(m.cpuUsage).toBeDefined()
      expect(m.timestamp).toBeGreaterThan(0)
    })

    it('getHealth 返回健康状态', () => {
      svc.setConfig('k1', 'v1')
      svc.log('info', 'src', 'msg')
      const h = svc.getHealth()
      expect(h.status).toBe('healthy')
      expect(h.logsCount).toBe(1)
      expect(h.configKeys).toBe(1)
      expect(h.uptime).toBeGreaterThanOrEqual(0)
      expect(h.memory).toBeDefined()
    })
  })

  describe('getSystemService 单例', () => {
    it('返回同一实例', async () => {
      const mod = await import('../src/services/clawdbot/system.js')
      const a = mod.getSystemService()
      const b = mod.getSystemService()
      expect(a).toBe(b)
    })
  })
})
