// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 「统一后端 · 多端互通」接线锁（2026-11-24 立）。
 *
 * 机主令「所有接口所有功能全部多端互通,但要分好是从哪个端操作录入的」。
 * 这条锁只判三件事，任何一件漂了都当场红：
 *  A. 小程序写路径必须给统一会话表留镜像（双写 + 四个状态端点都同步）;
 *  B. 统一会话表必须有 source / source_ref 两列与部分唯一索引（收编幂等键）;
 *  C. 迁移文件必须真的登记进 journal（造好没装车 = 没有）。
 */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(__dirname, '../../../../..')
const read = (rel: string) => readFileSync(resolve(ROOT, rel), 'utf8')

const ROUTE = 'apps/api/src/routes/ai-user-model-chat.ts'
const QUERIES = 'apps/api/src/db/chat-queries.ts'
const ROUTES_CHAT = 'apps/api/src/routes/chat.ts'
const MIGRATION = 'packages/database/drizzle/20261124120000_chat_conversation_source.sql'
const JOURNAL = 'packages/database/drizzle/meta/_journal.json'

describe('A. 小程序写路径留镜像', () => {
  const src = read(ROUTE)

  it('新建历史时双写统一会话(source=miniapp, sourceRef=history.id)', () => {
    expect(src).toMatch(/insert\(chatConversations\)/)
    expect(src).toMatch(/source:\s*'miniapp'/)
    expect(src).toMatch(/sourceRef:\s*history\?\.id/)
    expect(src).toMatch(/onConflictDoNothing\(\)/)
  })

  it('置顶 / 改名 / 文件夹 / 删除 四个状态端点都同步镜像', () => {
    for (const path of [
      "'/history/:id/pinned'",
      "'/history/:id/title'",
      "'/history/batch-folder'",
      "'/history/batch-delete'",
    ]) {
      expect(
        src.includes(`server.patch(${path}`) || src.includes(`server.post(${path}`),
        `缺少端点 ${path}`,
      ).toBe(true)
    }
    const mirrorCalls = (src.match(/mirrorConversations\(/g) ?? []).length
    // 三处 patch(置顶/改名/文件夹) + 定义本身 = 至少 4
    expect(mirrorCalls, '镜像调用枚数少于预期').toBeGreaterThanOrEqual(4)
    expect(src, '删除必须清掉镜像行').toMatch(/delete\(chatConversations\)/)
    expect(src, '文件夹必须落统一分组表').toMatch(/ensureConversationGroup/)
  })

  it('镜像失败不阻断端上操作（降级方向 = 统一层滞后，不是功能不可用）', () => {
    expect(src).toMatch(/镜像失败|同步落库失败/)
    expect(src).toMatch(/request\.log\.warn/)
  })
})

describe('B. 统一会话表结构与幂等键', () => {
  const schema = read('packages/database/src/schema/chat.ts')
  const sql = read(MIGRATION)

  it('schema 有 source / sourceRef 两列', () => {
    expect(schema).toMatch(/source:\s*varchar\('source'/)
    expect(schema).toMatch(/sourceRef:\s*varchar\('source_ref'/)
    expect(schema).toMatch(
      /source:\s*varchar\('source',\s*\{\s*length:\s*16\s*\}\)\.default\('web'\)/,
    )
  })

  it('迁移是幂等的且建部分唯一索引（只约束 source_ref 非空）', () => {
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS "source"/)
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS "source_ref"/)
    expect(sql).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS "uq_chat_conversations_user_source_ref"/)
    expect(sql).toMatch(/WHERE "source_ref" IS NOT NULL/)
  })

  it('列表查询把两列带出来（否则序列化拿不到，前端永远显示 web）', () => {
    const q = read(QUERIES)
    const hits = (q.match(/sourceRef: chatConversations\.sourceRef/g) ?? []).length
    expect(hits, '会话查询漏带 source_ref').toBeGreaterThanOrEqual(2)
    expect(q).toMatch(/source: chatConversations\.source,/)
  })

  it('创建入口接受 source 且序列化回吐（含来源端白名单）', () => {
    expect(read(ROUTES_CHAT)).toMatch(/x-client-platform/)
    expect(read(ROUTES_CHAT)).toMatch(/platformHeader === 'rn' \|\| platformHeader === 'miniapp'/)
    expect(read(ROUTES_CHAT)).toMatch(/sourceRef !== undefined && \{ sourceRef/)
  })
})

describe('C. 迁移装车（journal 登记 + 文件真实存在）', () => {
  it('迁移文件已在 journal 登记且 idx/tag 唯一', () => {
    const journal = JSON.parse(read(JOURNAL)) as { entries: Array<{ idx: number; tag: string }> }
    expect(journal.entries.some((e) => e.tag === '20261124120000_chat_conversation_source')).toBe(
      true,
    )
    expect(new Set(journal.entries.map((e) => e.idx)).size).toBe(journal.entries.length)
    expect(new Set(journal.entries.map((e) => e.tag)).size).toBe(journal.entries.length)
  })

  it('收编脚本存在且带台账 / 回滚 / 未判定三件套', () => {
    const adopt = read('scripts/conversations-adopt-miniapp.mjs')
    expect(adopt).toMatch(/conversation-adopt\.jsonl/)
    expect(adopt).toMatch(/--rollback/)
    expect(adopt).toMatch(/未判定/)
    expect(adopt).toMatch(/ON CONFLICT DO NOTHING/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
