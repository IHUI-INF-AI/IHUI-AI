// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 批次1 网关接线锁:主聊天流必须真的挂上周期心跳(源码级,零连接)。
 *
 * 为什么钉"接线"而不是再钉一次心跳实现:`startHeartbeat` 的节奏/断线跳过语义
 * 已有行为测试(agent-chat-stream.test.ts)。这一批的失效型恰恰是**实现存在、
 * 接线漏了** —— 主聊天流(ai-chat-stream.ts)此前只有 ai-service 在"等审批/等表单"
 * 的分支里发 keep-alive,工具执行等静默期一个字节都没有,而客户端读环 30s 判定断线。
 * 因此本文件钉三件事:
 *
 *  1. 新会话建好后立刻 `startHeartbeat(session)`(且只在"新建会话"这一跳接一次,
 *     重连接管不得再起第二个定时器);
 *  2. `stopHeartbeat()` 在 finally 里、且早于 `finishSession`(会话摘除后定时器
 *     仍持有 raw 就是泄漏,且会写已关闭连接);
 *  3. 心跳间隔只有一个真源(@ihui/shared/constants),registry 不得再自抄字面量
 *     —— 客户端读超时是"2 拍"关系,分叉一次就会静默断流。
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// vitest 的 cwd 恒等于本包根(与同目录既有源级锁同一口径,不写绝对路径)
const ROUTE = readFileSync(resolve(process.cwd(), 'src/routes/ai-chat-stream.ts'), 'utf8')
const REGISTRY = readFileSync(resolve(process.cwd(), 'src/utils/sse-stream-registry.ts'), 'utf8')
const RESUME = readFileSync(resolve(process.cwd(), 'src/routes/chat-resume.ts'), 'utf8')
const RUNTIME = readFileSync(resolve(process.cwd(), 'src/routes/agent-runtime.ts'), 'utf8')

describe('ai-chat-stream 周期心跳接线(批1)', () => {
  it('新建会话后启动唯一一次心跳', () => {
    const createIdx = ROUTE.indexOf('const session = createSession(raw')
    const startIdx = ROUTE.indexOf('const stopHeartbeat = startHeartbeat(session)')
    expect(createIdx).toBeGreaterThan(-1)
    expect(startIdx).toBeGreaterThan(createIdx)
    // 只允许一处启动:重连接管走的是既有会话,再起一次就是双定时器双倍 ping
    expect(ROUTE.match(/startHeartbeat\(/g) ?? []).toHaveLength(1)
  })

  it('finally 内先停心跳、后 finishSession(不让定时器活过会话)', () => {
    const stopIdx = ROUTE.indexOf('stopHeartbeat()')
    const finallyIdx = ROUTE.indexOf('} finally {')
    const finishIdx = ROUTE.indexOf('finishSession(session)')
    expect(stopIdx).toBeGreaterThan(finallyIdx)
    expect(stopIdx).toBeLessThan(finishIdx)
  })

  it('心跳间隔跨端只有一个真源,registry 不再自抄字面量', () => {
    expect(REGISTRY).toContain("import { SSE_HEARTBEAT_INTERVAL_MS } from '@ihui/shared/constants'")
    expect(REGISTRY).not.toMatch(/const SSE_HEARTBEAT_INTERVAL_MS\s*=/)
    // 节奏值的唯一读取点:通用心跳的默认参数,不在 setInterval 处另写一个数
    expect(REGISTRY).toMatch(/intervalMs: number = SSE_HEARTBEAT_INTERVAL_MS/)
    // 会话级 startHeartbeat 只能委托通用实现,否则就是两份节奏实现
    expect(REGISTRY).toMatch(
      /return startSseHeartbeat\(\(\) => \{[\s\S]*?session\.raw[\s\S]*?\}, intervalMs\)/,
    )
  })

  it('续接流与 agent-runtime 转发流同样挂上心跳,且各只停一次', () => {
    for (const [label, src] of [
      ['chat-resume', RESUME],
      ['agent-runtime', RUNTIME],
    ] as const) {
      const startIdx = src.indexOf('startSseHeartbeat(')
      expect(startIdx, `${label} 必须启动心跳`).toBeGreaterThan(-1)
      expect(src.match(/stopHeartbeat\(\)/g) ?? [], `${label} 只能停一次`).toHaveLength(1)
      expect(src.indexOf('stopHeartbeat()'), `${label} 停心跳必须在启动之后`).toBeGreaterThan(
        startIdx,
      )
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
