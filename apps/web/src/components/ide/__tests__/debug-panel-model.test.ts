import { describe, expect, it } from 'vitest'
import type { DebugVariable } from '@/lib/api/debug'
import {
  BREAKPOINTS_KEY,
  WATCHES_KEY,
  adaptVariable,
  getLanguageFromPath,
  STATE_META,
} from '../debug-panel-model'

describe('debug-panel-model', () => {
  it('adapts API variables and defaults missing types', () => {
    const input = { name: 'count', value: '42' } as DebugVariable
    expect(adaptVariable(input)).toEqual({ name: 'count', value: '42', type: 'string' })
    expect(adaptVariable({ name: 'flag', value: 'true', type: 'boolean' })).toEqual({
      name: 'flag',
      value: 'true',
      type: 'boolean',
    })
  })

  it('maps source paths to debugger languages', () => {
    expect(getLanguageFromPath('src/App.tsx')).toBe('typescript')
    expect(getLanguageFromPath('main.py')).toBe('python')
    expect(getLanguageFromPath('main.rs')).toBe('rust')
    expect(getLanguageFromPath('unknown.xyz')).toBeUndefined()
    expect(getLanguageFromPath('noextension')).toBeUndefined()
  })

  it('exposes stable persistence keys and all debug states', () => {
    expect(BREAKPOINTS_KEY).toBe('ide:breakpoints')
    expect(WATCHES_KEY).toBe('ide:watches')
    expect(Object.keys(STATE_META).sort()).toEqual(['paused', 'running', 'stopped'])
    expect(STATE_META.paused.labelKey).toBe('debug.statePaused')
  })
})
