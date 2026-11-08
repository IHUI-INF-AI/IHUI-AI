// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * F-112 回归锁(2026-11-08,apps/api P1 越权组)。
 *
 * 病灶:ws/ai 转发 ai-service 时 metadata 用 `{ userId, ...客户端 metadata }`,
 * 客户端可用 metadata.userId 覆盖认证主体;Coze 分支还采信消息体里可整写的
 * bot_id/user_id,可把会话挂到任意 bot 或伪造任意用户。
 *
 * 判据:合并语义恒为「服务端身份最后写入」;Coze 身份只取连接态;
 * 源码里不得再出现把客户端 spread 放在 userId 之后的写法。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

import { mergeServerMetadata, resolveCozeIdentity } from '../src/plugins/ws-ai.js'

const wsAiSource = readFileSync(new URL('../src/plugins/ws-ai.ts', import.meta.url), 'utf8')

describe('F-112 ws/ai 出站身份以服务端为准', () => {
  it('mergeServerMetadata:客户端 userId 不能覆盖服务端主体,其余键保留', () => {
    const merged = mergeServerMetadata(
      { userId: 'victim', provider: 'evil', trace: 't-1' },
      { userId: 'me', provider: 'openai' },
    )
    expect(merged).toEqual({ userId: 'me', provider: 'openai', trace: 't-1' })
  })

  it('resolveCozeIdentity:bot/user 只取连接态', () => {
    expect(resolveCozeIdentity({ botId: 'conn-bot', userId: 'conn-user' })).toEqual({
      botId: 'conn-bot',
      userId: 'conn-user',
    })
  })

  it('源码不再采信客户端可写的 userId / bot_id / user_id', () => {
    // 合并顺序必须是服务端身份在后
    expect(wsAiSource).not.toMatch(/userId,\s*\.\.\.metadata/)
    expect(wsAiSource).not.toMatch(/userId,\s*provider,\s*\.\.\.metadata/)
    // Coze 分支不得读消息体里的身份字段
    expect(wsAiSource).not.toMatch(/msg\.bot_id/)
    expect(wsAiSource).not.toMatch(/msg\.user_id/)
    // 两处出站 metadata 都走统一合并函数
    expect(wsAiSource.match(/metadata:\s*mergeServerMetadata\(/g)?.length).toBe(2)
  })
})
