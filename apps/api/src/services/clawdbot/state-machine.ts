import { EventEmitter } from 'node:events'
import { logger } from './logger.js'

export type SessionState = 'idle' | 'processing' | 'waiting' | 'done' | 'error'

export interface StateTransition {
  from: SessionState
  to: SessionState
  event: string
  timestamp: number
}

export interface StateMachineEntry {
  id: string
  state: SessionState
  history: StateTransition[]
  createdAt: number
  updatedAt: number
}

export class StateMachineError extends Error {
  constructor(
    message: string,
    readonly code: 'invalid_transition' | 'not_found' | 'exists',
  ) {
    super(message)
    this.name = 'StateMachineError'
  }
}

const VALID_TRANSITIONS: Record<SessionState, SessionState[]> = {
  idle: ['processing'],
  processing: ['waiting', 'done', 'error'],
  waiting: ['processing', 'done', 'error'],
  done: ['idle'],
  error: ['idle'],
}

export class StateMachine extends EventEmitter {
  private readonly entries = new Map<string, StateMachineEntry>()

  create(id: string): StateMachineEntry {
    if (this.entries.has(id)) throw new StateMachineError(`状态机已存在: ${id}`, 'exists')
    const now = Date.now()
    const entry: StateMachineEntry = {
      id,
      state: 'idle',
      history: [],
      createdAt: now,
      updatedAt: now,
    }
    this.entries.set(id, entry)
    logger.info({ id }, '[StateMachine] Created')
    this.emit('created', entry)
    return entry
  }

  get(id: string): StateMachineEntry {
    const entry = this.entries.get(id)
    if (!entry) throw new StateMachineError(`状态机不存在: ${id}`, 'not_found')
    return entry
  }

  canTransition(id: string, to: SessionState): boolean {
    const entry = this.get(id)
    return VALID_TRANSITIONS[entry.state]?.includes(to) ?? false
  }

  transition(id: string, to: SessionState, event?: string): StateMachineEntry {
    const entry = this.get(id)
    const from = entry.state
    if (!VALID_TRANSITIONS[from]?.includes(to)) {
      throw new StateMachineError(`无效状态转换: ${from} → ${to}`, 'invalid_transition')
    }
    entry.state = to
    entry.history.push({ from, to, event: event ?? 'manual', timestamp: Date.now() })
    entry.updatedAt = Date.now()
    logger.info({ id, from, to }, '[StateMachine] Transition')
    this.emit('transition', { id, from, to, event })
    return entry
  }

  reset(id: string): StateMachineEntry {
    const entry = this.get(id)
    const from = entry.state
    entry.state = 'idle'
    entry.history.push({ from, to: 'idle', event: 'reset', timestamp: Date.now() })
    entry.updatedAt = Date.now()
    this.emit('reset', entry)
    return entry
  }

  remove(id: string): boolean {
    return this.entries.delete(id)
  }

  list(): StateMachineEntry[] {
    return Array.from(this.entries.values())
  }

  listByState(state: SessionState): StateMachineEntry[] {
    return this.list().filter((e) => e.state === state)
  }

  getStats() {
    const all = this.list()
    return {
      total: all.length,
      idle: all.filter((e) => e.state === 'idle').length,
      processing: all.filter((e) => e.state === 'processing').length,
      waiting: all.filter((e) => e.state === 'waiting').length,
      done: all.filter((e) => e.state === 'done').length,
      error: all.filter((e) => e.state === 'error').length,
    }
  }
}

let instance: StateMachine | null = null

export function getStateMachine(): StateMachine {
  if (!instance) instance = new StateMachine()
  return instance
}
