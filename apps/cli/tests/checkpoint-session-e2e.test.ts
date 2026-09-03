// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { CheckpointManager } from '../src/checkpoints/index.js'
import {
  createSession,
  saveSession,
  loadSession,
  type Session,
} from '../src/commands/session.js'

// H4 会话级闭环:创建会话(commands/session,CLI 主会话落 ~/.ihui/sessions)→
// 会话内产生 checkpoint(等价 file-edit 写前快照)→ 会话落盘模拟进程退出 →
// "同 sessionId 的新 CheckpointManager 实例"(模拟新进程/重启后)按会话 list+restore 找回现场;
// 异 sessionId 实例看不到也恢复不了(多会话隔离)。

describe('checkpoint 会话级闭环', () => {
  let tmpDir: string
  let workspaceDir: string
  let session: Session
  let otherSession: Session

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-cp-session-'))
    workspaceDir = path.join(tmpDir, 'workspace')
    fs.mkdirSync(workspaceDir, { recursive: true })
    session = createSession(workspaceDir, 'test-model')
    otherSession = createSession(workspaceDir, 'test-model')
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
    // 会话文件与检查点目录按 id 落盘,统一清理不污染真实用户数据
    for (const s of [session, otherSession]) {
      fs.rmSync(path.join(os.homedir(), '.ihui', 'sessions', `${s.id}.json`), { force: true })
      fs.rmSync(path.join(os.homedir(), '.ihui', 'checkpoints', s.id), {
        recursive: true,
        force: true,
      })
    }
  })

  it('闭环:会话内 snapshot → saveSession 落盘 → 同 sessionId 新实例 restore 找回现场', async () => {
    // 1. 会话内产生文件并快照(等价 file-edit 写前快照)
    const filePath = path.join(workspaceDir, 'feature.ts')
    fs.writeFileSync(filePath, 'export const v = 1\n', 'utf-8')
    const mgr = new CheckpointManager({ sessionId: session.id, workspacePath: workspaceDir })
    const cp = mgr.snapshotSync([filePath], 'auto_pre_edit')

    // 2. 会话落盘,模拟进程退出
    session.history.push({ role: 'user', content: '给 feature.ts 改成 v=2' })
    session.history.push({ role: 'assistant', content: '已修改' })
    saveSession(session)

    // 3. 模拟后续编辑破坏现场
    fs.writeFileSync(filePath, 'export const v = 2\n// 意外改动\n', 'utf-8')

    // 4. 新进程:同 sessionId 重建 CheckpointManager,list 能找到该会话的检查点
    const mgrRestored = new CheckpointManager({
      sessionId: session.id,
      workspacePath: workspaceDir,
    })
    const listed = mgrRestored.list()
    expect(listed.find((c) => c.id === cp.id)).toBeDefined()
    expect(listed.find((c) => c.id === cp.id)!.sessionId).toBe(session.id)

    const { restored, removed } = await mgrRestored.restore(cp.id)
    expect(restored).toContain('feature.ts')
    expect(removed).toEqual([])
    expect(fs.readFileSync(filePath, 'utf-8')).toBe('export const v = 1\n')

    // 5. 会话可跨进程 load 回来(id 与会话一致)
    const reloaded = loadSession(session.id)
    expect(reloaded).not.toBeNull()
    expect(reloaded!.id).toBe(session.id)
    expect(reloaded!.history).toHaveLength(2)
  })

  it('隔离:otherSession 的 CheckpointManager 看不到也恢复不了本会话的检查点', async () => {
    const filePath = path.join(workspaceDir, 'feature.ts')
    fs.writeFileSync(filePath, 'v1\n', 'utf-8')
    const mgr = new CheckpointManager({ sessionId: session.id, workspacePath: workspaceDir })
    const cp = mgr.snapshotSync([filePath], 'manual')

    const otherMgr = new CheckpointManager({
      sessionId: otherSession.id,
      workspacePath: workspaceDir,
    })
    // 其他会话的列表不含本会话检查点
    expect(otherMgr.list().find((c) => c.id === cp.id)).toBeUndefined()
    expect(otherMgr.get(cp.id)).toBeNull()
    // 其他会话用本会话的 id 恢复必须报错(不存在)
    await expect(otherMgr.restore(cp.id)).rejects.toThrow('不存在')
    // 本会话自己仍可恢复
    fs.writeFileSync(filePath, 'v2\n', 'utf-8')
    const { restored } = await mgr.restore(cp.id)
    expect(restored).toContain('feature.ts')
    expect(fs.readFileSync(filePath, 'utf-8')).toBe('v1\n')
  })
})
