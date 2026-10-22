// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 票59(消息级版本切换 3/3,2026-10-22 立):sibling 坐标落库通道逐段装车对账。
//
// 链路(五段,任何一段摘线都会让"regenerate 出 sibling"整链空转):
//   前端 streamChat metadata(父票 web 行为测试钉)→ ① 网关 chatStreamSchema 显式声明
//   (不声明被 zod strip 静默丢弃)→ ② mergedMetadata 透传上游(ai-service dict[str,Any]
//   原样回显,禁碰面不测)→ ③ 回调端点 callbackSchema 声明 + 从 metadata **提出进 job 顶层**
//   (metadata 在回调被 capMetadataObject 逐字段重建,原始键不透传;坐标是列不是 jsonb)
//   → ④ AICallbackJobData 顶层键 → ⑤ worker createMessage 落两列。
// 本机无 PostgreSQL(AGENTS §5b),与 g59-regenerate-sibling-branch.test.ts 同款取
// 静态对账口径;api-client 契约(返回类型/metadata 类型)一并钉在此处(跨包接线无行为面)。
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const read = (rel: string) => readFileSync(resolve(HERE, rel), 'utf8')

const STREAM = read('../src/routes/ai-chat-stream.ts')
const CALLBACK = read('../src/routes/ai-callback.ts')
const QUEUE = read('../src/plugins/queue.ts')
const WORKER = read('../src/workers/ai-callback-worker.ts')
const CLIENT = read('../../../packages/api-client/src/client.ts')
const ENDPOINTS = read('../../../packages/api-client/src/endpoints/chat.ts')

describe('票59③:网关 ai-chat-stream 声明并透传坐标(不声明=被 zod strip 静默丢弃)', () => {
  it('chatStreamSchema metadata 显式声明两键(uuid / 非负整数)', () => {
    expect(STREAM).toContain('parentMessageId: z.string().uuid().optional(),')
    expect(STREAM).toContain('siblingIndex: z.number().int().nonnegative().optional(),')
  })

  it('mergedMetadata 拾取两键透传上游(前端 metadata → ai-service 回显的通道)', () => {
    expect(STREAM).toContain('parentMessageId: opts.metadata?.parentMessageId,')
    expect(STREAM).toContain('siblingIndex: opts.metadata?.siblingIndex,')
  })

  it('streamToClient opts.metadata 内联类型扩两键(否则透传行编译不过)', () => {
    const i = STREAM.indexOf('parentMessageId?: string')
    expect(i).toBeGreaterThan(-1)
    expect(STREAM.indexOf('siblingIndex?: number')).toBeGreaterThan(i)
  })
})

describe('票59③:回调端点提出坐标进 job 顶层(G-94 显式列举,不落 metadata jsonb)', () => {
  it('callbackSchema metadata 显式声明两键', () => {
    expect(CALLBACK).toContain('parentMessageId: z.string().min(1).optional(),')
    expect(CALLBACK).toContain('siblingIndex: z.number().int().nonnegative().optional(),')
  })

  it('从 metadata 提出两键(与 conversationId/userId 同源)', () => {
    expect(CALLBACK).toContain('const parentMessageId = metadata?.parentMessageId')
    expect(CALLBACK).toContain('const siblingIndex = metadata?.siblingIndex')
  })

  it('job payload 条件写顶层键(缺省不写 ⇒ 存量回调形态零变化)', () => {
    expect(CALLBACK).toContain('...(parentMessageId ? { parentMessageId } : {}),')
    expect(CALLBACK).toContain('...(siblingIndex !== undefined ? { siblingIndex } : {}),')
  })
})

describe('票59③:job 契约与 worker 落库', () => {
  it('AICallbackJobData 顶层坐标键(payload 契约,worker 解构的依据)', () => {
    const i = QUEUE.indexOf('parentMessageId?: string')
    expect(i).toBeGreaterThan(-1)
    expect(QUEUE.indexOf('siblingIndex?: number')).toBeGreaterThan(i)
  })

  it('worker 解构坐标并交 createMessage 落两列(update 路径不接:占位 UUID 必走 create)', () => {
    expect(WORKER).toContain('parentMessageId,')
    expect(WORKER).toContain('siblingIndex,')
    // createMessage 调用块内出现裸键(解构同名直传),且位于 updateMessage 之后的 create 分支
    const createIdx = WORKER.indexOf('await createMessage({')
    expect(createIdx).toBeGreaterThan(-1)
    const createBlock = WORKER.slice(createIdx, createIdx + 1200)
    expect(createBlock).toContain('parentMessageId,')
    expect(createBlock).toContain('siblingIndex,')
  })
})

describe('票59③:api-client 跨包契约(返回类型 + metadata 类型)', () => {
  it('regenerateConversation 返回类型带 rootId/nextSiblingIndex(sibling 语义的响应面)', () => {
    const i = ENDPOINTS.indexOf('export function regenerateConversation')
    const block = ENDPOINTS.slice(i, i + 700)
    expect(block).toContain('rootId: string')
    expect(block).toContain('nextSiblingIndex: number')
  })

  it('StreamChatOptions.metadata 类型扩两键(前端行为测试发得出,类型面先放行)', () => {
    const i = CLIENT.indexOf('parentMessageId?: string')
    expect(i).toBeGreaterThan(-1)
    expect(CLIENT.indexOf('siblingIndex?: number')).toBeGreaterThan(i)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
