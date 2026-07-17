import { describe, expect, it, beforeEach } from 'vitest'
import { PlanMachine } from '../src/plan/machine.js'

describe('PlanMachine', () => {
  let machine: PlanMachine

  beforeEach(() => {
    machine = new PlanMachine()
  })

  describe('合法状态转移(主链)', () => {
    it('initialized + start → gathering', () => {
      expect(machine.transition('start')).toBe('gathering')
    })

    it('gathering + gather_complete → executing', () => {
      machine.transition('start')
      expect(machine.transition('gather_complete')).toBe('executing')
    })

    it('executing + execute_complete → done', () => {
      machine.transition('start')
      machine.transition('gather_complete')
      expect(machine.transition('execute_complete')).toBe('done')
    })

    it('完整主链 initialized→gathering→executing→done', () => {
      machine.transition('start')
      machine.transition('gather_complete')
      machine.transition('execute_complete')
      expect(machine.getCurrentState()).toBe('done')
    })
  })

  describe('cancelled 转移', () => {
    it('initialized + cancel → cancelled', () => {
      expect(machine.transition('cancel')).toBe('cancelled')
    })

    it('gathering + cancel → cancelled', () => {
      machine.transition('start')
      expect(machine.transition('cancel')).toBe('cancelled')
    })

    it('executing + cancel → cancelled', () => {
      machine.transition('start')
      machine.transition('gather_complete')
      expect(machine.transition('cancel')).toBe('cancelled')
    })

    it('done + cancel → cancelled', () => {
      machine.transition('start')
      machine.transition('gather_complete')
      machine.transition('execute_complete')
      expect(machine.transition('cancel')).toBe('cancelled')
    })

    it('cancelled + cancel 幂等(保持 cancelled)', () => {
      machine.transition('cancel')
      expect(machine.transition('cancel')).toBe('cancelled')
    })
  })

  describe('reset 转移', () => {
    it('cancelled + reset → initialized', () => {
      machine.transition('cancel')
      expect(machine.transition('reset')).toBe('initialized')
    })

    it('done + reset → initialized', () => {
      machine.transition('start')
      machine.transition('gather_complete')
      machine.transition('execute_complete')
      expect(machine.transition('reset')).toBe('initialized')
    })

    it('reset 后状态回到 initialized', () => {
      machine.transition('start')
      machine.transition('cancel')
      machine.transition('reset')
      expect(machine.getCurrentState()).toBe('initialized')
    })

    it('多次 reset 保持 initialized', () => {
      machine.transition('cancel')
      machine.transition('reset')
      expect(machine.getCurrentState()).toBe('initialized')
    })
  })

  describe('非法转移抛错', () => {
    it('initialized + gather_complete 抛错', () => {
      expect(() => machine.transition('gather_complete')).toThrow(/Invalid transition/)
    })

    it('initialized + execute_complete 抛错', () => {
      expect(() => machine.transition('execute_complete')).toThrow(/Invalid transition/)
    })

    it('gathering + start 抛错', () => {
      machine.transition('start')
      expect(() => machine.transition('start')).toThrow(/Invalid transition/)
    })

    it('gathering + execute_complete 抛错', () => {
      machine.transition('start')
      expect(() => machine.transition('execute_complete')).toThrow(/Invalid transition/)
    })

    it('done + start 抛错', () => {
      machine.transition('start')
      machine.transition('gather_complete')
      machine.transition('execute_complete')
      expect(() => machine.transition('start')).toThrow(/Invalid transition/)
    })

    it('非法转移不改变当前状态', () => {
      machine.transition('start')
      expect(() => machine.transition('execute_complete')).toThrow()
      expect(machine.getCurrentState()).toBe('gathering')
    })
  })

  describe('canTransition', () => {
    it('initialized + start 返回 true', () => {
      expect(machine.canTransition('start')).toBe(true)
    })

    it('initialized + gather_complete 返回 false', () => {
      expect(machine.canTransition('gather_complete')).toBe(false)
    })

    it('gathering + gather_complete 返回 true', () => {
      machine.transition('start')
      expect(machine.canTransition('gather_complete')).toBe(true)
    })

    it('done + reset 返回 true', () => {
      machine.transition('start')
      machine.transition('gather_complete')
      machine.transition('execute_complete')
      expect(machine.canTransition('reset')).toBe(true)
    })

    it('cancelled + cancel 返回 true(幂等)', () => {
      machine.transition('cancel')
      expect(machine.canTransition('cancel')).toBe(true)
    })
  })

  describe('isWriteBlocked', () => {
    it('initialized 状态返回 false', () => {
      expect(machine.isWriteBlocked()).toBe(false)
    })

    it('gathering 状态返回 true(核心阻断语义)', () => {
      machine.transition('start')
      expect(machine.isWriteBlocked()).toBe(true)
    })

    it('executing 状态返回 false', () => {
      machine.transition('start')
      machine.transition('gather_complete')
      expect(machine.isWriteBlocked()).toBe(false)
    })

    it('done 状态返回 false', () => {
      machine.transition('start')
      machine.transition('gather_complete')
      machine.transition('execute_complete')
      expect(machine.isWriteBlocked()).toBe(false)
    })

    it('cancelled 状态返回 false', () => {
      machine.transition('cancel')
      expect(machine.isWriteBlocked()).toBe(false)
    })
  })

  describe('getCurrentState', () => {
    it('初始状态返回 initialized', () => {
      expect(machine.getCurrentState()).toBe('initialized')
    })

    it('转移后返回新状态', () => {
      machine.transition('start')
      expect(machine.getCurrentState()).toBe('gathering')
    })
  })

  describe('reset 方法', () => {
    it('reset() 重置到 initialized', () => {
      machine.transition('start')
      machine.reset()
      expect(machine.getCurrentState()).toBe('initialized')
    })

    it('多次 reset 保持 initialized', () => {
      machine.transition('start')
      machine.reset()
      machine.reset()
      expect(machine.getCurrentState()).toBe('initialized')
    })
  })

  describe('构造函数', () => {
    it('默认状态为 initialized', () => {
      const m = new PlanMachine()
      expect(m.getCurrentState()).toBe('initialized')
    })

    it('接受自定义初始状态', () => {
      const m = new PlanMachine('gathering')
      expect(m.getCurrentState()).toBe('gathering')
    })
  })

  describe('PlanContext 可选', () => {
    it('transition 接受可选 ctx 参数', () => {
      expect(machine.transition('start', { currentStepIndex: 0, planSteps: [], messages: [] })).toBe('gathering')
    })

    it('transition 不传 ctx 也正常工作', () => {
      expect(machine.transition('start')).toBe('gathering')
    })
  })
})
