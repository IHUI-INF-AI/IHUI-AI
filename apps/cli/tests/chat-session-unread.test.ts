// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { afterEach, describe, expect, it } from 'vitest'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import {
  readCompactionTimelineLedger,
  recoverCompactionTimelinesForSession,
} from '../src/compaction-timeline-resume.js'
import { listSessions, loadSession, saveSession, type Session } from '../src/commands/session.js'

describe('对话会话读不到', () => {
  const prev = process.env.IHUI_CLI_SESSIONS_DIR
  let dir = ''

  afterEach(() => {
    if (prev === undefined) delete process.env.IHUI_CLI_SESSIONS_DIR
    else process.env.IHUI_CLI_SESSIONS_DIR = prev
    if (dir) fs.rmSync(dir, { recursive: true, force: true })
  })

  it('不把它说成没有这场会话,也不覆盖', () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-chat-session-unread-'))
    process.env.IHUI_CLI_SESSIONS_DIR = dir
    const blocked = path.join(dir, 'blocked.json')
    fs.mkdirSync(blocked)
    const session: Session = {
      id: 'blocked',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      workspacePath: dir,
      modelId: 'test',
      history: [],
    }
    expect(() => loadSession('blocked')).toThrow(/不能把它说成没有这场会话/)
    expect(() => listSessions()).toThrow(/不能把它说成没有这场会话/)
    expect(() => saveSession(session)).toThrow(/不能把它覆盖成新会话/)
    const corrupt = path.join(dir, 'kept.json')
    const body = '{not json'
    fs.writeFileSync(corrupt, body, 'utf-8')
    expect(() => saveSession({ ...session, id: 'kept' })).toThrow(/不能把它覆盖成新会话 \(corrupt\)/)
    expect(fs.readFileSync(corrupt, 'utf-8')).toBe(body)
    expect(fs.statSync(blocked).isDirectory()).toBe(true)
  })

  it('压缩账本读不到不能当成没有,也不重写', () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-compact-ledger-unread-'))
    process.env.IHUI_CLI_SESSIONS_DIR = dir
    const ledger = path.join(dir, 's1.compaction-timelines.json')
    fs.writeFileSync(ledger, '[{"timelineId":"t","kind":"started","atMs":1}]\n')
    const original = fs.readFileSync(ledger)
    const denied = () => {
      const err = new Error('denied') as NodeJS.ErrnoException
      err.code = 'EACCES'
      throw err
    }
    expect(() => readCompactionTimelineLedger('s1', denied)).toThrow(/读不到/)
    expect(() => recoverCompactionTimelinesForSession('s1', 1, denied)).toThrow(/读不到/)
    expect(readCompactionTimelineLedger('missing-session')).toEqual([])
    expect(fs.readFileSync(ledger)).toEqual(original)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
