import { test, expect } from '@playwright/test'

/**
 * 临时复现脚本 v4:注册 → 登录态 → 在浏览器内直接调用 streamChat → 捕获 SSE 流所有事件。
 * 目的:确认 SSE 流是否真的返回内容,定位"请求 200 但 UI 空"的根因。
 */

test('注册 → 浏览器内调 streamChat → 捕获 SSE 流', async ({ page, request, baseURL }) => {
  const baseUrl = baseURL ?? 'http://localhost:8801'

  // 1. 注册新账号
  const phone = `138${Date.now().toString().slice(-8)}`
  const password = 'Test123456!'
  console.log('[step] register:', phone)
  const regResp = await request.post(`${baseUrl}/api/auth/register`, {
    data: { phone, password },
  })
  const regBody = (await regResp.json().catch(() => ({}))) as {
    code?: number
    data?: { accessToken?: string; user?: { id?: string; nickname?: string } }
  }
  expect(regBody.code).toBe(0)
  const token = regBody.data!.accessToken!
  const userId = regBody.data!.user!.id!
  console.log('[register-ok] user:', userId)

  // 2. 注入 auth_token cookie + localStorage
  await page.context().addCookies([
    { name: 'auth_token', value: token, domain: 'localhost', path: '/' },
  ])
  await page.addInitScript((authData) => {
    const store = {
      state: { isAuthenticated: true, user: authData.user },
      version: 0,
    }
    window.localStorage.setItem('ihui-auth', JSON.stringify(store))
  }, { user: { id: userId, phone, nickname: 'Tester' } })

  // 3. 监听所有网络请求(找 400/500)
  page.on('response', async (resp) => {
    if (resp.status() >= 400) {
      const url = resp.url()
      let body = ''
      try { body = await resp.text().catch(() => '') } catch { /* ignore */ }
      console.log(`[HTTP-${resp.status()}]`, url, body.slice(0, 200))
    }
  })

  // 4. 访问 /chat
  console.log('[step] goto /chat')
  await page.goto(`${baseUrl}/chat`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(2000)

  // 5. 在浏览器内直接调用 fetch /api/ai/chat/stream,读取完整 SSE 流
  console.log('[step] direct fetch SSE in browser')
  const sseResult = await page.evaluate(async (tokenArg) => {
    const result = {
      events: [] as Array<{ type: string; data: string }>,
      fullContent: '',
      error: null as string | null,
      responseStatus: 0,
      responseHeaders: {} as Record<string, string>,
    }
    try {
      const resp = await fetch('/api/ai/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          'Authorization': `Bearer ${tokenArg}`,
        },
        body: JSON.stringify({
          model: 'stepfun/step-3.7-flash',
          messages: [{ role: 'user', content: '你好' }],
        }),
      })
      result.responseStatus = resp.status
      resp.headers.forEach((v, k) => { result.responseHeaders[k] = v })

      if (!resp.ok || !resp.body) {
        result.error = `HTTP ${resp.status}: ${await resp.text().catch(() => '')}`
        return result
      }

      const reader = resp.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let chunkCount = 0
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.trim()) continue
          if (line.startsWith('event: ')) {
            result.events.push({ type: 'event', data: line.slice(7) })
          } else if (line.startsWith('data: ')) {
            result.events.push({ type: 'data', data: line.slice(6) })
            // 尝试解析 chunk content
            try {
              const json = JSON.parse(line.slice(6))
              if (json?.type === 'chunk' && typeof json.content === 'string') {
                result.fullContent += json.content
              } else if (json?.type === 'done') {
                result.events.push({ type: 'done', data: JSON.stringify(json) })
              } else if (json?.error) {
                result.events.push({ type: 'error', data: JSON.stringify(json) })
              }
            } catch { /* non-JSON */ }
          }
          chunkCount++
          if (chunkCount > 200) break // 防止无限循环
        }
      }
    } catch (e) {
      result.error = (e as Error).message
    }
    return result
  }, token)

  console.log('[sse-result]', JSON.stringify({
    status: sseResult.responseStatus,
    fullContent: sseResult.fullContent,
    fullContentLength: sseResult.fullContent.length,
    eventsCount: sseResult.events.length,
    error: sseResult.error,
    first10Events: sseResult.events.slice(0, 10),
    last5Events: sseResult.events.slice(-5),
    responseHeaders: sseResult.responseHeaders,
  }, null, 2))

  // 6. 如果 SSE 内容正确,说明问题在前端 React 渲染。检查 useChatStore 状态
  if (sseResult.fullContent) {
    console.log('[step] SSE works, checking React store state')
    const storeState = await page.evaluate(() => {
      // 读取 useChatStore 的当前消息
      const ls = window.localStorage.getItem('ihui-chat')
      return {
        chatStorePersist: ls ? ls.slice(0, 500) : null,
      }
    })
    console.log('[store-state]', JSON.stringify(storeState))
  }
})
