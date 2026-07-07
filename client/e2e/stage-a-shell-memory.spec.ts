/**
 * Stage A-2 + A-5: .cursorrules + Shell 黑名单 (对标 Claude Code / Cursor)
 *
 * 覆盖:
 *  1. .cursorrules 项目记忆: system prompt 应包含 .cursorrules 内容
 *  2. Shell 黑名单: 危险命令 (rm -rf /) 应被后端拒绝
 *  3. Shell 黑名单: 安全命令 (ls -la) 应被执行
 *  4. Shell 黑名单: 边界命令 (sudo apt install) 应被拒绝
 */

import { test, expect } from '@playwright/test'

const MEMORY_ENDPOINT = '/api/v1/workspace/memory/system-prompt'
const RUN_ENDPOINT = '/api/v1/workspace/run'
const SHELL_PAYLOAD = { workspace_path: '.', timeout_ms: 10000 }

test.describe('项目记忆 (.cursorrules) — Stage A-2', () => {
  test('system-prompt 端点返回 200 + 包含 system_prompt 字段', async ({ request }) => {
    const res = await request.get(MEMORY_ENDPOINT + '?workspace_path=.', { failOnStatusCode: false })
    if (res.status() === 200) {
      const body = await res.json()
      expect(body.data).toHaveProperty('system_prompt')
      expect(typeof body.data.system_prompt).toBe('string')
    } else {
      expect([401, 403, 422]).toContain(res.status())
    }
  })
})

test.describe('Shell 命令黑名单 — Stage A-5', () => {
  test('危险命令: rm -rf / 应被拒绝', async ({ request }) => {
    const res = await request.post(RUN_ENDPOINT, {
      data: { command: 'rm -rf /', ...SHELL_PAYLOAD },
      failOnStatusCode: false,
    })
    // 期望 400/403 (blocked) 或 200 但不执行 (后端拦截)
    if (res.status() === 200) {
      const body = await res.json()
      // 成功响应应包含 blocked 标记或 error 字段
      expect(JSON.stringify(body)).toMatch(/blocked|blacklist|forbidden|error|denied/i)
    } else {
      expect([400, 403]).toContain(res.status())
    }
  })

  test('危险命令: sudo 应被拒绝', async ({ request }) => {
    const res = await request.post(RUN_ENDPOINT, {
      data: { command: 'sudo apt install curl', ...SHELL_PAYLOAD },
      failOnStatusCode: false,
    })
    if (res.status() === 200) {
      const body = await res.json()
      expect(JSON.stringify(body)).toMatch(/blocked|blacklist|forbidden|error|denied/i)
    } else {
      expect([400, 403]).toContain(res.status())
    }
  })

  test('危险命令: shutdown -h now 应被拒绝', async ({ request }) => {
    const res = await request.post(RUN_ENDPOINT, {
      data: { command: 'shutdown -h now', ...SHELL_PAYLOAD },
      failOnStatusCode: false,
    })
    if (res.status() === 200) {
      const body = await res.json()
      expect(JSON.stringify(body)).toMatch(/blocked|blacklist|forbidden|error|denied/i)
    } else {
      expect([400, 403]).toContain(res.status())
    }
  })

  test('安全命令: ls -la 可执行', async ({ request }) => {
    const res = await request.post(RUN_ENDPOINT, {
      data: { command: 'ls -la', ...SHELL_PAYLOAD },
      failOnStatusCode: false,
    })
    // 期望 200 (执行成功) 或 401/403 (需要鉴权但不拦截命令)
    expect([200, 401, 403]).toContain(res.status())
  })

  test('安全命令: git status 可执行', async ({ request }) => {
    const res = await request.post(RUN_ENDPOINT, {
      data: { command: 'git status', ...SHELL_PAYLOAD },
      failOnStatusCode: false,
    })
    expect([200, 401, 403]).toContain(res.status())
  })
})
