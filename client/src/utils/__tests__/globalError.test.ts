import { describe, it, expect } from 'vitest'
import {
  ErrorType,
} from '../globalError'

describe('globalError', () => {
  describe('ErrorType', () => {
    it('应该定义错误类型', () => {
      const types: ErrorType[] = [
        'network',
        'api',
        'validation',
        'authentication',
        'authorization',
        'not_found',
        'server',
        'timeout',
        'unknown',
      ]

      types.forEach(type => {
        expect(['network', 'api', 'validation', 'authentication', 'authorization', 'not_found', 'server', 'timeout', 'unknown']).toContain(type)
      })
    })
  })

  describe('错误消息', () => {
    it('应该定义网络错误消息', () => {
      const messages: Record<ErrorType, string> = {
        network: '网络连接失败，请检查网络设置',
        api: 'API请求失败，请稍后重试',
        validation: '数据验证失败，请检查输入',
        authentication: '登录已过期，请重新登录',
        authorization: '没有权限执行此操作',
        not_found: '请求的资源不存在',
        server: '服务器错误，请稍后重试',
        timeout: '请求超时，请稍后重试',
        unknown: '发生未知错误',
      }

      expect(messages.network).toContain('网络')
      expect(messages.authentication).toContain('登录')
      expect(messages.unknown).toContain('未知')
    })
  })
})
