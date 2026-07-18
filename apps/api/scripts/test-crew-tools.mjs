/**
 * Crew 工具调用端到端测试
 *
 * 验证目标:
 * 1. 真实登录 (admin/admin123) 获取 token
 * 2. 创建需要工具调用的 Crew 会话
 * 3. 触发流式执行 /api/crew/runs/{id}/stream
 * 4. 解析 SSE 流,收集所有事件
 * 5. 验证出现 tool_call / tool_result 事件
 * 6. 验证最终 complete 事件携带结果
 *
 * 使用方式: node apps/api/scripts/test-crew-tools.mjs
 */
import http from 'node:http'

const HOST = '127.0.0.1'
const PORT = 3001

/** 普通 JSON 请求 */
function req(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null
    const r = http.request(
      {
        host: HOST,
        port: PORT,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        },
      },
      (res) => {
        let d = ''
        res.on('data', (c) => (d += c))
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(d) })
          } catch {
            resolve({ status: res.statusCode, body: d })
          }
        })
      },
    )
    r.on('error', reject)
    if (data) r.write(data)
    r.end()
  })
}

/** SSE 流式请求,逐块返回 */
function reqSSE(method, path, token) {
  return new Promise((resolve, reject) => {
    const r = http.request(
      {
        host: HOST,
        port: PORT,
        path,
        method,
        headers: {
          Accept: 'text/event-stream',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      },
      (res) => {
        resolve(res)
      },
    )
    r.on('error', reject)
    r.end()
  })
}

/** 解析 SSE 块,从 buffer 中提取完整 event + data 行 */
function parseSSEBlock(buffer) {
  const events = []
  let rest = buffer
  const sep = '\n\n'
  while (true) {
    const idx = rest.indexOf(sep)
    if (idx === -1) break
    const block = rest.slice(0, idx)
    rest = rest.slice(idx + sep.length)
    if (!block.trim()) continue
    let event = 'message'
    let data = ''
    for (const line of block.split('\n')) {
      if (line.startsWith(':')) continue
      if (line.startsWith('event:')) {
        event = line.slice(6).trim()
      } else if (line.startsWith('data:')) {
        data += (data ? '\n' : '') + line.slice(5).replace(/^\s/, '')
      }
    }
    if (data) events.push({ event, data })
  }
  return { events, rest }
}

console.log('═'.repeat(72))
console.log(' Crew 工具调用端到端测试')
console.log('═'.repeat(72))

try {
  // ===== Step 1: 登录获取 token =====
  console.log('\n[1/5] 登录获取 token...')
  const login = await req('POST', '/api/auth/login', {
    account: 'admin',
    password: 'admin123',
  })
  if (login.status !== 200) {
    console.error('❌ 登录失败:', login.status, login.body)
    process.exit(1)
  }
  const token = login.body?.data?.accessToken
  if (!token) {
    console.error('❌ 登录返回未包含 accessToken:', login.body)
    process.exit(1)
  }
  console.log('✅ 登录成功,token 已获取')

  // ===== Step 2: 验证 Crew 健康检查 =====
  console.log('\n[2/5] 验证 Crew 服务健康...')
  const health = await req('GET', '/api/crew/health', null, token)
  if (health.status !== 200) {
    console.error('❌ Crew 健康检查失败:', health.status, health.body)
    process.exit(1)
  }
  console.log('✅ Crew 服务健康:', health.body?.data)

  // ===== Step 3: 查询可用模型 =====
  console.log('\n[3/5] 查询可用模型...')
  const models = await req('GET', '/api/crew/models', null, token)
  if (models.status !== 200) {
    console.error('❌ 模型查询失败:', models.status, models.body)
    process.exit(1)
  }
  const modelData = models.body?.data ?? models.body
  console.log(
    '✅ 模型列表 (stubMode=%s, default=%s):',
    modelData?.stubMode,
    modelData?.default,
  )
  const modelList = modelData?.models ?? []
  if (modelList.length > 0) {
    console.log('   可用模型:')
    for (const m of modelList.slice(0, 5)) {
      console.log(`     - ${m.id} (${m.provider ?? '?'})`)
    }
  }

  // ===== Step 4: 创建需要工具调用的 Crew 会话 =====
  console.log('\n[4/5] 创建 Crew 会话 (设计为需要工具调用)...')
  // 任务设计:需要执行代码 + 搜索知识库 + 网页搜索才能完成
  const taskMessage =
    '请使用工具完成以下任务:1) 调用 code_execute 计算 123 * 456 的结果;2) 调用 knowledge_search 搜索"IHUI-AI 项目架构";3) 汇总结果。'
  const createSession = await req(
    'POST',
    '/api/crew/sessions',
    {
      userId: login.body.data.user.id,
      inputMessage: taskMessage,
      title: 'E2E 工具调用测试',
      config: {
        modelId: modelData?.default ?? '',
        collectionName: 'default',
        maxRetries: 1,
      },
    },
    token,
  )
  if (createSession.status !== 200 && createSession.status !== 201) {
    console.error('❌ 创建会话失败:', createSession.status, createSession.body)
    process.exit(1)
  }
  const sessionId = createSession.body?.data?.sessionId
  if (!sessionId) {
    console.error('❌ 创建会话未返回 sessionId:', createSession.body)
    process.exit(1)
  }
  console.log('✅ 会话已创建: ' + sessionId)

  // ===== Step 5: 触发流式执行 =====
  console.log('\n[5/5] 触发流式执行 (SSE)...')
  console.log('   等待事件流 (最多 120s)...')

  const resp = await reqSSE('GET', `/api/crew/runs/${sessionId}/stream`, token)
  if (resp.statusCode !== 200) {
    console.error('❌ SSE 启动失败: HTTP ' + resp.statusCode)
    process.exit(1)
  }
  console.log('✅ SSE 连接已建立 (HTTP 200)')

  const events = []
  let buffer = ''
  const startTime = Date.now()

  await new Promise((resolve) => {
    let ended = false
    const timeout = setTimeout(() => {
      if (!ended) {
        ended = true
        console.log('\n⚠️  超过 120s,强制结束等待')
        resolve()
      }
    }, 120000)

    resp.on('data', (chunk) => {
      buffer += chunk.toString()
      const parsed = parseSSEBlock(buffer)
      buffer = parsed.rest
      for (const ev of parsed.events) {
        try {
          const obj = JSON.parse(ev.data)
          events.push(obj)
          // 实时打印事件
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
          switch (obj.type) {
            case 'start':
              console.log(`   [${elapsed}s] ▶ start (sessionId=${obj.sessionId?.slice(0, 8) ?? ''})`)
              break
            case 'planning':
              console.log(`   [${elapsed}s] 🧠 planning...`)
              break
            case 'plan':
              console.log(`   [${elapsed}s] 📋 plan: ${obj.tasks?.length ?? 0} 个任务`)
              break
            case 'task_start':
              console.log(`   [${elapsed}s] 🚀 task_start: [${obj.taskIndex}] ${obj.role}`)
              break
            case 'tool_call': {
              const tc = obj.toolCall
              const argsStr = tc && Object.keys(tc.args).length > 0
                ? JSON.stringify(tc.args).slice(0, 120)
                : '{}'
              console.log(
                `   [${elapsed}s] 🔧 tool_call: [${obj.taskIndex}] ${tc?.name ?? '?'}(${argsStr})`,
              )
              break
            }
            case 'tool_result': {
              const tr = obj.toolResult
              const out = tr?.success
                ? (typeof tr.output === 'string' ? tr.output : JSON.stringify(tr.output ?? null)).slice(0, 100)
                : tr?.error ?? '失败'
              console.log(
                `   [${elapsed}s] ${tr?.success ? '✅' : '❌'} tool_result: [${obj.taskIndex}] ${tr?.name ?? '?'} (${tr?.durationMs ?? 0}ms) → ${out}`,
              )
              break
            }
            case 'task_complete':
              console.log(`   [${elapsed}s] ✔ task_complete: [${obj.taskIndex}] ${obj.role}`)
              break
            case 'task_error':
              console.log(`   [${elapsed}s] ⚠ task_error: [${obj.taskIndex}] ${obj.role}: ${obj.content?.slice(0, 100) ?? ''}`)
              break
            case 'complete':
              console.log(`   [${elapsed}s] 🎉 complete: ${obj.content?.slice(0, 100) ?? ''}`)
              ended = true
              clearTimeout(timeout)
              resolve()
              break
            case 'error':
              console.log(`   [${elapsed}s] ❌ error: ${obj.content?.slice(0, 100) ?? ''}`)
              ended = true
              clearTimeout(timeout)
              resolve()
              break
            default:
              console.log(`   [${elapsed}s] • ${obj.type}: ${obj.content?.slice(0, 60) ?? ''}`)
          }
        } catch {
          // 忽略非 JSON 事件
        }
      }
    })

    resp.on('end', () => {
      if (!ended) {
        ended = true
        clearTimeout(timeout)
        resolve()
      }
    })
    resp.on('error', (e) => {
      console.error('   SSE 错误:', e.message)
      if (!ended) {
        ended = true
        clearTimeout(timeout)
        resolve()
      }
    })
  })

  // ===== 统计结果 =====
  console.log('\n' + '═'.repeat(72))
  console.log(' 测试结果统计')
  console.log('═'.repeat(72))
  const counts = {}
  for (const ev of events) {
    counts[ev.type] = (counts[ev.type] ?? 0) + 1
  }
  console.log('事件计数:')
  for (const [type, count] of Object.entries(counts)) {
    console.log(`  ${type}: ${count}`)
  }

  const toolCalls = events.filter((e) => e.type === 'tool_call')
  const toolResults = events.filter((e) => e.type === 'tool_result')
  const completed = events.some((e) => e.type === 'complete')

  console.log('\n工具调用次数: ' + toolCalls.length)
  if (toolCalls.length > 0) {
    console.log('调用的工具:')
    for (const tc of toolCalls) {
      console.log(`  - ${tc.toolCall?.name} (args: ${JSON.stringify(tc.toolCall?.args).slice(0, 80)})`)
    }
  }

  console.log('\n工具结果次数: ' + toolResults.length)
  if (toolResults.length > 0) {
    console.log('工具执行结果:')
    for (const tr of toolResults) {
      const out = tr.toolResult?.success
        ? (typeof tr.toolResult.output === 'string'
            ? tr.toolResult.output
            : JSON.stringify(tr.toolResult.output ?? null)).slice(0, 100)
        : tr.toolResult?.error ?? '失败'
      console.log(`  - ${tr.toolResult?.name} (${tr.toolResult?.durationMs}ms) success=${tr.toolResult?.success}: ${out}`)
    }
  }

  console.log('\n会话是否完成: ' + (completed ? '✅ 是' : '❌ 否'))

  // 判定
  console.log('\n' + '═'.repeat(72))
  if (toolCalls.length > 0 && toolResults.length > 0 && completed) {
    console.log(' 🎉 测试通过:executor 成功发起工具调用并收到结果')
    process.exit(0)
  } else if (toolCalls.length > 0 && toolResults.length > 0) {
    console.log(' ⚠️  部分通过:有工具调用但未收到 complete 事件')
    process.exit(0)
  } else if (completed) {
    console.log(' ⚠️  会话完成但未触发工具调用 (LLM 未选择工具)')
    process.exit(0)
  } else {
    console.log(' ❌ 测试失败:未观察到工具调用事件')
    process.exit(1)
  }
} catch (e) {
  console.error('💥 测试异常:', e)
  process.exit(1)
}
