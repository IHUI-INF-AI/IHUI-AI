// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-815994:steer 队列的 kind 轴(按上游 command-queue 两组切,不抄 priority 三档)。
 *
 * 正反成对(票面点名):
 *  ① 吸收循环遇不可 inline 的 kind 即 break —— break 写成 continue 时,
 *     "普通引导之后的通知"会被一并吸进来,这条立刻红;
 *  ② 全是通知型时照常成批 —— 防把吸收循环做成"永不成批"。
 * 另钉:成批判据只认通知组、control-only-turn 的 break 点语义、kind 轴缺省与持久化读侧闸。
 */
import { describe, expect, it } from 'vitest'

import { promises as fs } from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import {
  isInlineableKind,
  isNotificationKind,
  isPromptQueueKind,
  PromptQueue,
  type PromptQueueKind,
} from '../src/prompt-queue.js'

describe('G-815994 kind 轴:两组闭集', () => {
  it('六值闭集:请求-应答 3 种 + 通知 3 种;组判据各认各的', () => {
    const request: PromptQueueKind[] = ['prompt', 'target-continuation', 'target-continuation-loop']
    const notification: PromptQueueKind[] = ['task-notification', 'subagent-message', 'control-only-turn']
    for (const k of request) {
      expect(isNotificationKind(k)).toBe(false)
      expect(isInlineableKind(k)).toBe(false)
    }
    for (const k of notification) expect(isNotificationKind(k)).toBe(true)
    // control-only-turn 属通知组但不可 inline(排序契约 break 点)
    expect(isNotificationKind('control-only-turn')).toBe(true)
    expect(isInlineableKind('control-only-turn')).toBe(false)
    expect(isInlineableKind('task-notification')).toBe(true)
    expect(isInlineableKind('subagent-message')).toBe(true)
  })

  it('isPromptQueueKind 只认闭集:陌生串与缺字段落 false(读侧闸)', () => {
    expect(isPromptQueueKind('task-notification')).toBe(true)
    expect(isPromptQueueKind('prompt')).toBe(true)
    expect(isPromptQueueKind('urgent')).toBe(false)
    expect(isPromptQueueKind(undefined)).toBe(false)
    expect(isPromptQueueKind(42)).toBe(false)
  })
})

describe('G-815994 成批出队:dequeueNextBatch 排序契约', () => {
  it('正反成对 ①:不可 inline 之后的通知不得被吸收(break,不是 continue)', () => {
    const q = new PromptQueue()
    q.enqueue('task done', 'task-notification')
    q.enqueue('user follow-up', 'prompt')
    q.enqueue('another done', 'task-notification')

    const batch = q.dequeueNextBatch()
    expect(batch.map((i) => i.kind)).toEqual(['task-notification'])
    // 普通引导留在队首,它后面的通知也没被吸走
    const snapshot = q.snapshot().filter((i) => i.status === 'pending')
    expect(snapshot.map((i) => i.kind)).toEqual(['prompt', 'task-notification'])
  })

  it('正反成对 ②:全是通知型时照常成批(防"永不成批")', () => {
    const q = new PromptQueue()
    q.enqueue('n1', 'task-notification')
    q.enqueue('n2', 'subagent-message')
    q.enqueue('n3', 'task-notification')

    const batch = q.dequeueNextBatch()
    expect(batch.map((i) => i.kind)).toEqual(['task-notification', 'subagent-message', 'task-notification'])
    expect(batch.every((i) => i.status === 'running')).toBe(true)
  })

  it('队首是请求-应答型 ⇒ 单条出队不成批;control-only-turn 队首单独出队', () => {
    const q = new PromptQueue()
    q.enqueue('user ask', 'prompt')
    q.enqueue('n1', 'task-notification')
    expect(q.dequeueNextBatch().map((i) => i.kind)).toEqual(['prompt'])

    const q2 = new PromptQueue()
    q2.enqueue('ctl', 'control-only-turn')
    q2.enqueue('n1', 'task-notification')
    // control-only-turn 是 break 点:单独出队,后面的不被吸收
    expect(q2.dequeueNextBatch().map((i) => i.kind)).toEqual(['control-only-turn'])
    expect(q2.snapshot().filter((i) => i.status === 'pending').map((i) => i.kind)).toEqual(['task-notification'])
  })

  it('吸收中途遇 control-only-turn 即 break(它自己不被吸收,留在队列)', () => {
    const q = new PromptQueue()
    q.enqueue('n1', 'task-notification')
    q.enqueue('ctl', 'control-only-turn')
    q.enqueue('n2', 'task-notification')
    expect(q.dequeueNextBatch().map((i) => i.kind)).toEqual(['task-notification'])
    expect(q.snapshot().filter((i) => i.status === 'pending').map((i) => i.kind)).toEqual([
      'control-only-turn',
      'task-notification',
    ])
  })

  it('max 上限生效;空队列返回 []', () => {
    const q = new PromptQueue()
    for (let i = 0; i < 5; i++) q.enqueue(`n${i}`, 'task-notification')
    expect(q.dequeueNextBatch(2)).toHaveLength(2)
    expect(q.dequeueNextBatch(2)).toHaveLength(2)
    expect(q.dequeueNextBatch(2)).toHaveLength(1)
    expect(q.dequeueNextBatch(2)).toEqual([])
  })

  it('既有行为零回归:enqueue 缺 kind 按 prompt;dequeue 单条语义逐字不变', () => {
    const q = new PromptQueue()
    const item = q.enqueue('plain')
    expect(item.kind).toBe('prompt')
    const next = q.dequeue()
    expect(next?.kind).toBe('prompt')
    expect(next?.status).toBe('running')
  })
})

describe('G-815994 持久化:kind 随项落盘,读侧闸兜底', () => {
  it('save/load 往返保住通知型 kind;旧文件(无 kind 字段)读回 prompt', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pq-kind-'))
    const file = path.join(dir, 'pq.json')
    try {
      const q = new PromptQueue()
      q.enqueue('n1', 'task-notification')
      q.enqueue('plain')
      await q.saveToDisk(file)

      const q2 = new PromptQueue()
      expect(await q2.loadFromDisk(file)).toBe(2)
      expect(q2.snapshot().map((i) => i.kind)).toEqual(['task-notification', 'prompt'])
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('旧文件缺 kind 字段:读回 prompt,不抛错(零迁移)', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pq-kind-'))
    const file = path.join(dir, 'legacy.json')
    try {
      const legacy = {
        version: 1,
        savedAt: Date.now(),
        counter: 3,
        pending: [{ id: 'q-legacy-1', prompt: 'old item', status: 'pending', enqueuedAt: 1 }],
      }
      await fs.writeFile(file, JSON.stringify(legacy), 'utf-8')
      const q = new PromptQueue()
      expect(await q.loadFromDisk(file)).toBe(1)
      expect(q.snapshot()[0]!.kind).toBe('prompt')
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
