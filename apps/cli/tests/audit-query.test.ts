import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'

// ---- mock settings(避免读真实 ~/.ihui/settings.json 影响)----
vi.mock('../src/commands/settings.js', () => ({
  loadSettings: () => ({ auditEnabled: true }),
}))

import { auditLog, queryAuditLog, type AuditEntry } from '../src/audit.js'

// ---- 辅助:用临时目录覆盖 USERPROFILE/HOME,使 os.homedir() 返回临时目录 ----
const tmpDir = path.join(os.tmpdir(), `ihui-audit-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
const tmpAuditPath = path.join(tmpDir, '.ihui', 'audit.jsonl')

let origUserProfile: string | undefined
let origHome: string | undefined

beforeEach(() => {
  fs.mkdirSync(path.join(tmpDir, '.ihui'), { recursive: true })
  if (fs.existsSync(tmpAuditPath)) fs.unlinkSync(tmpAuditPath)
  // 保存原值
  origUserProfile = process.env.USERPROFILE
  origHome = process.env.HOME
  // 覆盖环境变量 — os.homedir() 在 Windows 读 USERPROFILE,POSIX 读 HOME
  process.env.USERPROFILE = tmpDir
  process.env.HOME = tmpDir
})

afterEach(() => {
  // 还原环境变量
  if (origUserProfile === undefined) delete process.env.USERPROFILE
  else process.env.USERPROFILE = origUserProfile
  if (origHome === undefined) delete process.env.HOME
  else process.env.HOME = origHome
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  } catch {
    // 忽略
  }
})

function writeEntries(entries: AuditEntry[]): void {
  const lines = entries.map((e) => JSON.stringify(e)).join('\n') + '\n'
  fs.writeFileSync(tmpAuditPath, lines, 'utf-8')
}

describe('P1-3 queryAuditLog 基础查询', () => {
  it('空日志文件返回空结果', () => {
    const result = queryAuditLog()
    expect(result.entries).toHaveLength(0)
    expect(result.total).toBe(0)
    expect(result.filtered).toBe(0)
  })

  it('日志文件不存在返回空结果', () => {
    if (fs.existsSync(tmpAuditPath)) fs.unlinkSync(tmpAuditPath)
    const result = queryAuditLog()
    expect(result.entries).toHaveLength(0)
    expect(result.total).toBe(0)
  })

  it('返回所有条目(默认 limit=50)', () => {
    const entries: AuditEntry[] = Array.from({ length: 60 }, (_, i) => ({
      timestamp: new Date(2025, 0, 1, 0, 0, i).toISOString(),
      tool: `tool_${i}`,
      input: {},
    }))
    writeEntries(entries)
    const result = queryAuditLog()
    expect(result.total).toBe(60)
    expect(result.filtered).toBe(60)
    expect(result.entries).toHaveLength(50) // 默认 limit
  })

  it('结果按时间倒序(最近在前)', () => {
    const entries: AuditEntry[] = [
      { timestamp: '2025-01-01T00:00:00.000Z', tool: 'old', input: {} },
      { timestamp: '2025-01-02T00:00:00.000Z', tool: 'new', input: {} },
      { timestamp: '2025-01-01T12:00:00.000Z', tool: 'mid', input: {} },
    ]
    writeEntries(entries)
    const result = queryAuditLog()
    expect(result.entries[0]!.tool).toBe('new')
    expect(result.entries[1]!.tool).toBe('mid')
    expect(result.entries[2]!.tool).toBe('old')
  })

  it('自定义 limit', () => {
    const entries: AuditEntry[] = Array.from({ length: 10 }, (_, i) => ({
      timestamp: new Date(2025, 0, 1, 0, 0, i).toISOString(),
      tool: `t${i}`,
      input: {},
    }))
    writeEntries(entries)
    const result = queryAuditLog({ limit: 3 })
    expect(result.total).toBe(10)
    expect(result.entries).toHaveLength(3)
  })
})

describe('P1-3 queryAuditLog 过滤', () => {
  beforeEach(() => {
    const entries: AuditEntry[] = [
      { timestamp: '2025-01-01T00:00:00.000Z', tool: 'read_file', input: {}, success: true, durationMs: 10 },
      { timestamp: '2025-01-01T00:01:00.000Z', tool: 'write_file', input: {}, success: true, durationMs: 20 },
      { timestamp: '2025-01-01T00:02:00.000Z', tool: 'read_file', input: {}, success: false, error: 'not found', durationMs: 5 },
      { timestamp: '2025-01-01T00:03:00.000Z', tool: 'run_command', input: {}, success: true, durationMs: 100 },
      { timestamp: '2025-01-01T00:04:00.000Z', tool: 'read_file', input: {}, success: false, error: 'permission', durationMs: 8 },
    ]
    writeEntries(entries)
  })

  it('按工具名子串过滤(大小写不敏感)', () => {
    const result = queryAuditLog({ tool: 'READ_FILE' })
    expect(result.total).toBe(5)
    expect(result.filtered).toBe(3)
    expect(result.entries.every((e) => e.tool === 'read_file')).toBe(true)
  })

  it('按工具名子串匹配', () => {
    const result = queryAuditLog({ tool: 'file' })
    expect(result.filtered).toBe(4) // 3 read_file + 1 write_file
  })

  it('按成功状态过滤', () => {
    const successResult = queryAuditLog({ success: true })
    expect(successResult.filtered).toBe(3)
    expect(successResult.entries.every((e) => e.success === true)).toBe(true)

    const failResult = queryAuditLog({ success: false })
    expect(failResult.filtered).toBe(2)
    expect(failResult.entries.every((e) => e.success === false)).toBe(true)
  })

  it('按 ISO 时间过滤', () => {
    const result = queryAuditLog({ since: '2025-01-01T00:02:30.000Z' })
    expect(result.filtered).toBe(2) // 00:03, 00:04(>= 00:02:30,00:02 早于 02:30 被排除)
  })

  it('按相对时间过滤(0s 表示当前瞬间,旧数据全部排除)', () => {
    const result = queryAuditLog({ since: '0s' })
    expect(result.filtered).toBe(0) // 测试数据是 2025-01-01,早于当前瞬间
  })

  it('非法相对时间格式返回空', () => {
    const result = queryAuditLog({ since: 'invalid' })
    expect(result.entries).toHaveLength(0)
    expect(result.total).toBe(0)
    expect(result.filtered).toBe(0)
  })

  it('组合过滤:工具名 + 成功状态', () => {
    const result = queryAuditLog({ tool: 'read_file', success: false })
    expect(result.filtered).toBe(2)
    expect(result.entries.every((e) => e.tool === 'read_file' && e.success === false)).toBe(true)
  })

  it('跳过损坏的 JSON 行', () => {
    // 在已有日志后追加一行损坏的 JSON
    fs.appendFileSync(tmpAuditPath, 'not-a-json-line\n', 'utf-8')
    const result = queryAuditLog()
    expect(result.total).toBe(5) // 损坏行被跳过,不计入 total
  })
})

describe('P1-3 相对时间解析', () => {
  beforeEach(() => {
    const now = Date.now()
    const entries: AuditEntry[] = [
      { timestamp: new Date(now - 5000).toISOString(), tool: 'recent_5s', input: {} },
      { timestamp: new Date(now - 30 * 60 * 1000).toISOString(), tool: 'mid_30m', input: {} },
      { timestamp: new Date(now - 2 * 60 * 60 * 1000).toISOString(), tool: 'old_2h', input: {} },
    ]
    writeEntries(entries)
  })

  it('1s 过滤窗口:仅返回 5s 内', () => {
    const result = queryAuditLog({ since: '10s' })
    expect(result.filtered).toBe(1)
    expect(result.entries[0]!.tool).toBe('recent_5s')
  })

  it('1h 过滤窗口:返回 5s + 30m', () => {
    const result = queryAuditLog({ since: '1h' })
    expect(result.filtered).toBe(2)
  })

  it('1d 过滤窗口:返回全部', () => {
    const result = queryAuditLog({ since: '1d' })
    expect(result.filtered).toBe(3)
  })

  it('支持 m/h/d/s 单位', () => {
    expect(queryAuditLog({ since: '1s' }).total).toBe(3)
    expect(queryAuditLog({ since: '1m' }).total).toBe(3)
    expect(queryAuditLog({ since: '1h' }).total).toBe(3)
    expect(queryAuditLog({ since: '1d' }).total).toBe(3)
  })
})

describe('P1-3 auditLog 与 queryAuditLog 集成', () => {
  it('auditLog 追加后可被 queryAuditLog 查到', () => {
    auditLog({
      timestamp: '2025-06-01T00:00:00.000Z',
      tool: 'test_tool',
      input: { path: '/tmp/test.ts' },
      output: 'ok',
      success: true,
      durationMs: 42,
    })
    const result = queryAuditLog({ tool: 'test_tool' })
    expect(result.entries).toHaveLength(1)
    expect(result.entries[0]!.tool).toBe('test_tool')
    expect(result.entries[0]!.success).toBe(true)
  })

  it('auditLog 自动脱敏 secrets', () => {
    auditLog({
      timestamp: '2025-06-01T00:00:00.000Z',
      tool: 'http_request',
      input: { url: 'https://api.example.com', headers: { Authorization: 'Bearer sk-secret-1234567890abcdef' } },
      output: 'response with password=supersecret12345',
      success: true,
    })
    const result = queryAuditLog({ tool: 'http_request' })
    expect(result.entries).toHaveLength(1)
    // 输入和输出都应被脱敏(Bearer token + password= 模式)
    const inputStr = JSON.stringify(result.entries[0]!.input)
    expect(inputStr).not.toContain('sk-secret-1234567890abcdef')
    expect(inputStr).toContain('REDACTED')
    expect(result.entries[0]!.output).not.toContain('supersecret12345')
    expect(result.entries[0]!.output).toContain('REDACTED')
  })
})
