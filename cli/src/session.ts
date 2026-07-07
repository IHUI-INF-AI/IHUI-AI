/**
 * 会话管理 — 持久化对话历史到 ~/.ihui/sessions/
 *
 * 每个会话保存为 JSON 文件, 包含完整的多轮对话历史。
 * 支持 --resume <id> 恢复指定会话, --continue 恢复最近会话。
 */

import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

export interface ChatMessage {
  role: string
  content: string
}

export interface Session {
  id: string
  createdAt: string
  updatedAt: string
  workspacePath: string
  modelId: string
  history: ChatMessage[]
}

export function getSessionsDir(): string {
  return path.join(os.homedir(), '.ihui', 'sessions')
}

export function ensureSessionsDir(): void {
  const dir = getSessionsDir()
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

export function createSession(workspacePath: string, modelId: string): Session {
  ensureSessionsDir()
  const id = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const now = new Date().toISOString()
  return {
    id,
    createdAt: now,
    updatedAt: now,
    workspacePath,
    modelId,
    history: [],
  }
}

export function saveSession(session: Session): void {
  ensureSessionsDir()
  session.updatedAt = new Date().toISOString()
  const filePath = path.join(getSessionsDir(), `${session.id}.json`)
  fs.writeFileSync(filePath, JSON.stringify(session, null, 2), 'utf-8')
}

export function loadSession(id: string): Session | null {
  const filePath = path.join(getSessionsDir(), `${id}.json`)
  if (!fs.existsSync(filePath)) return null
  try {
    const data = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(data) as Session
  } catch {
    return null
  }
}

export function listSessions(): Session[] {
  ensureSessionsDir()
  const dir = getSessionsDir()
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'))
  const sessions: Session[] = []
  for (const f of files) {
    try {
      const data = fs.readFileSync(path.join(dir, f), 'utf-8')
      sessions.push(JSON.parse(data) as Session)
    } catch {
      // ignore corrupted files
    }
  }
  return sessions.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )
}

export function getMostRecentSession(): Session | null {
  const sessions = listSessions()
  return sessions.length > 0 ? sessions[0] : null
}
