// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE).

/**
 * useAgentRuntime 切换 agentId 的残留状态夹具（2026-11-08）。
 *
 * 钉死的不变量：EventSource effect 的 cleanup 必须把全部事件派生状态清空，
 * 包括 tokenStream / toolCallChain / healEvents / streamError —— 否则 A→B 切换后
 * 旧 Agent 的 token 流与工具链（追加写）会挂在新会话上。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// vitest 在 apps/web 下运行(jsdom 环境),import.meta.url 非 file: 协议,故用 cwd 定位源码
const SOURCE = readFileSync(resolve(process.cwd(), 'src/hooks/use-agent-runtime.ts'), 'utf8')

describe('useAgentRuntime cleanup', () => {
  it('事件流 cleanup 重置 tokenStream/toolCallChain/healEvents/streamError', () => {
    const match = SOURCE.match(/return \(\) => \{\n\s*es\.close\(\)[\s\S]*?\n\s*\}/)
    expect(match, '未找到 EventSource cleanup 块').not.toBeNull()
    const cleanup = match![0]
    for (const setter of [
      'setTokenStream([])',
      'setToolCallChain([])',
      'setHealEvents([])',
      'setStreamError(null)',
    ]) {
      expect(cleanup, `cleanup 缺少 ${setter}`).toContain(setter)
    }
  })
})
