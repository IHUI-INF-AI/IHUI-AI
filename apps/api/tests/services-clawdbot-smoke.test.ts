import { describe, it, expect, vi } from 'vitest'
import { EventEmitter } from 'node:events'

vi.mock('../src/services/clawdbot/logger.js', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import {
  AnalyticsService,
  AnalyticsError,
  getAnalyticsService,
} from '../src/services/clawdbot/analytics.js'
import { BotManager, BotManagerError, getBotManager } from '../src/services/clawdbot/bot-manager.js'
import { HealthChecker, HealthError, getHealthChecker } from '../src/services/clawdbot/health.js'
import {
  MessageRouter,
  MessageRouterError,
  getMessageRouter,
} from '../src/services/clawdbot/message-router.js'
import {
  PermissionGuard,
  PermissionGuardError,
  getPermissionGuard,
} from '../src/services/clawdbot/permission-guard.js'
import {
  SessionManager,
  SessionManagerError,
  getSessionManager,
} from '../src/services/clawdbot/session-manager.js'
import {
  StateMachine,
  StateMachineError,
  getStateMachine,
} from '../src/services/clawdbot/state-machine.js'
import {
  ToolRunner,
  ToolExecutorError,
  getToolRunner,
} from '../src/services/clawdbot/tool-executor.js'

describe('clawdbot 服务 smoke 测试', () => {
  describe('analytics AnalyticsService 分析服务', () => {
    it('导出存在且模块可加载', () => {
      expect(AnalyticsService).toBeDefined()
      expect(AnalyticsError).toBeDefined()
      expect(getAnalyticsService).toBeDefined()
    })

    it('getAnalyticsService 返回 EventEmitter 子类实例', () => {
      const svc = getAnalyticsService()
      expect(svc).toBeInstanceOf(EventEmitter)
      expect(svc).toBeInstanceOf(AnalyticsService)
    })

    it('getAnalyticsService 多次调用返回同一实例', () => {
      expect(getAnalyticsService()).toBe(getAnalyticsService())
    })

    it('AnalyticsError 是 Error 实例', () => {
      expect(new AnalyticsError('x', 'invalid')).toBeInstanceOf(Error)
    })

    it('关键方法存在', () => {
      const svc = new AnalyticsService()
      expect(typeof svc.record).toBe('function')
      expect(typeof svc.query).toBe('function')
      expect(typeof svc.getSummary).toBe('function')
      expect(typeof svc.getTodaySummary).toBe('function')
      expect(typeof svc.clear).toBe('function')
      expect(typeof svc.on).toBe('function')
      expect(typeof svc.emit).toBe('function')
    })
  })

  describe('bot-manager BotManager 机器人管理', () => {
    it('导出存在且模块可加载', () => {
      expect(BotManager).toBeDefined()
      expect(BotManagerError).toBeDefined()
      expect(getBotManager).toBeDefined()
    })

    it('getBotManager 返回 EventEmitter 子类实例', () => {
      const mgr = getBotManager()
      expect(mgr).toBeInstanceOf(EventEmitter)
      expect(mgr).toBeInstanceOf(BotManager)
    })

    it('getBotManager 多次调用返回同一实例', () => {
      expect(getBotManager()).toBe(getBotManager())
    })

    it('BotManagerError 是 Error 实例', () => {
      expect(new BotManagerError('x', 'invalid')).toBeInstanceOf(Error)
    })

    it('关键方法存在', () => {
      const mgr = new BotManager()
      expect(typeof mgr.create).toBe('function')
      expect(typeof mgr.get).toBe('function')
      expect(typeof mgr.list).toBe('function')
      expect(typeof mgr.update).toBe('function')
      expect(typeof mgr.start).toBe('function')
      expect(typeof mgr.stop).toBe('function')
      expect(typeof mgr.getStats).toBe('function')
    })
  })

  describe('health HealthChecker 健康检查', () => {
    it('导出存在且模块可加载', () => {
      expect(HealthChecker).toBeDefined()
      expect(HealthError).toBeDefined()
      expect(getHealthChecker).toBeDefined()
    })

    it('getHealthChecker 返回 EventEmitter 子类实例', () => {
      const checker = getHealthChecker()
      expect(checker).toBeInstanceOf(EventEmitter)
      expect(checker).toBeInstanceOf(HealthChecker)
    })

    it('getHealthChecker 多次调用返回同一实例', () => {
      expect(getHealthChecker()).toBe(getHealthChecker())
    })

    it('HealthError 是 Error 实例', () => {
      expect(new HealthError('x', 'check_failed')).toBeInstanceOf(Error)
    })

    it('关键方法存在', () => {
      const checker = new HealthChecker()
      expect(typeof checker.registerDependency).toBe('function')
      expect(typeof checker.unregisterDependency).toBe('function')
      expect(typeof checker.checkDependency).toBe('function')
      expect(typeof checker.checkHealth).toBe('function')
      expect(typeof checker.isReady).toBe('function')
      expect(typeof checker.isLive).toBe('function')
    })
  })

  describe('message-router MessageRouter 消息路由', () => {
    it('导出存在且模块可加载', () => {
      expect(MessageRouter).toBeDefined()
      expect(MessageRouterError).toBeDefined()
      expect(getMessageRouter).toBeDefined()
    })

    it('getMessageRouter 返回 EventEmitter 子类实例', () => {
      const router = getMessageRouter()
      expect(router).toBeInstanceOf(EventEmitter)
      expect(router).toBeInstanceOf(MessageRouter)
    })

    it('getMessageRouter 多次调用返回同一实例', () => {
      expect(getMessageRouter()).toBe(getMessageRouter())
    })

    it('MessageRouterError 是 Error 实例', () => {
      expect(new MessageRouterError('x', 'no_handler')).toBeInstanceOf(Error)
    })

    it('关键方法存在', () => {
      const router = new MessageRouter()
      expect(typeof router.registerHandler).toBe('function')
      expect(typeof router.unregisterHandler).toBe('function')
      expect(typeof router.recognize).toBe('function')
      expect(typeof router.route).toBe('function')
      expect(typeof router.getHandlers).toBe('function')
      expect(typeof router.getTopIntents).toBe('function')
    })
  })

  describe('permission-guard PermissionGuard 权限守卫', () => {
    it('导出存在且模块可加载', () => {
      expect(PermissionGuard).toBeDefined()
      expect(PermissionGuardError).toBeDefined()
      expect(getPermissionGuard).toBeDefined()
    })

    it('getPermissionGuard 返回 EventEmitter 子类实例', () => {
      const guard = getPermissionGuard()
      expect(guard).toBeInstanceOf(EventEmitter)
      expect(guard).toBeInstanceOf(PermissionGuard)
    })

    it('getPermissionGuard 多次调用返回同一实例', () => {
      expect(getPermissionGuard()).toBe(getPermissionGuard())
    })

    it('PermissionGuardError 是 Error 实例', () => {
      expect(new PermissionGuardError('x', 'denied')).toBeInstanceOf(Error)
    })

    it('关键方法存在', () => {
      const guard = new PermissionGuard()
      expect(typeof guard.addRule).toBe('function')
      expect(typeof guard.removeRule).toBe('function')
      expect(typeof guard.check).toBe('function')
      expect(typeof guard.require).toBe('function')
      expect(typeof guard.listRules).toBe('function')
      expect(typeof guard.getMatrix).toBe('function')
    })
  })

  describe('session-manager SessionManager 会话管理', () => {
    it('导出存在且模块可加载', () => {
      expect(SessionManager).toBeDefined()
      expect(SessionManagerError).toBeDefined()
      expect(getSessionManager).toBeDefined()
    })

    it('getSessionManager 返回 EventEmitter 子类实例', () => {
      const mgr = getSessionManager()
      expect(mgr).toBeInstanceOf(EventEmitter)
      expect(mgr).toBeInstanceOf(SessionManager)
    })

    it('getSessionManager 多次调用返回同一实例', () => {
      expect(getSessionManager()).toBe(getSessionManager())
    })

    it('SessionManagerError 是 Error 实例', () => {
      expect(new SessionManagerError('x', 'not_found')).toBeInstanceOf(Error)
    })

    it('关键方法存在', () => {
      const mgr = new SessionManager()
      expect(typeof mgr.create).toBe('function')
      expect(typeof mgr.get).toBe('function')
      expect(typeof mgr.resume).toBe('function')
      expect(typeof mgr.pause).toBe('function')
      expect(typeof mgr.close).toBe('function')
      expect(typeof mgr.appendMessage).toBe('function')
      expect(typeof mgr.getStats).toBe('function')
    })
  })

  describe('state-machine StateMachine 状态机', () => {
    it('导出存在且模块可加载', () => {
      expect(StateMachine).toBeDefined()
      expect(StateMachineError).toBeDefined()
      expect(getStateMachine).toBeDefined()
    })

    it('getStateMachine 返回 EventEmitter 子类实例', () => {
      const sm = getStateMachine()
      expect(sm).toBeInstanceOf(EventEmitter)
      expect(sm).toBeInstanceOf(StateMachine)
    })

    it('getStateMachine 多次调用返回同一实例', () => {
      expect(getStateMachine()).toBe(getStateMachine())
    })

    it('StateMachineError 是 Error 实例', () => {
      expect(new StateMachineError('x', 'invalid_transition')).toBeInstanceOf(Error)
    })

    it('关键方法存在', () => {
      const sm = new StateMachine()
      expect(typeof sm.create).toBe('function')
      expect(typeof sm.get).toBe('function')
      expect(typeof sm.canTransition).toBe('function')
      expect(typeof sm.transition).toBe('function')
      expect(typeof sm.reset).toBe('function')
      expect(typeof sm.list).toBe('function')
      expect(typeof sm.getStats).toBe('function')
    })
  })

  describe('tool-executor ToolRunner 工具执行器', () => {
    it('导出存在且模块可加载', () => {
      expect(ToolRunner).toBeDefined()
      expect(ToolExecutorError).toBeDefined()
      expect(getToolRunner).toBeDefined()
    })

    it('getToolRunner 返回 EventEmitter 子类实例', () => {
      const runner = getToolRunner()
      expect(runner).toBeInstanceOf(EventEmitter)
      expect(runner).toBeInstanceOf(ToolRunner)
    })

    it('getToolRunner 多次调用返回同一实例', () => {
      expect(getToolRunner()).toBe(getToolRunner())
    })

    it('ToolExecutorError 是 Error 实例', () => {
      expect(new ToolExecutorError('x', 'not_found')).toBeInstanceOf(Error)
    })

    it('关键方法存在', () => {
      const runner = new ToolRunner()
      expect(typeof runner.register).toBe('function')
      expect(typeof runner.unregister).toBe('function')
      expect(typeof runner.execute).toBe('function')
      expect(typeof runner.list).toBe('function')
      expect(typeof runner.get).toBe('function')
      expect(typeof runner.toggle).toBe('function')
      expect(typeof runner.getStats).toBe('function')
    })
  })
})
