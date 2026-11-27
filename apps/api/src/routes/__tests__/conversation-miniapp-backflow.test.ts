// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 「会话状态双向回写」接线锁(2026-11-24,真多端互通)。
 *
 * 机主令「必须做到真多端互通」。统一表上的改名 / 置顶 / 归档 / 删除必须反向回到小程序
 * 历史表,小程序侧的归档也必须镜像回统一表 —— 任何一边漏、顺序错(尤其是"删后再查 source_ref")
 * 都会让状态在另一端沉默分叉。这条锁只判四件事:
 *  A. 回写模块的判据面(只处理镜像行;失败回 -1 绝不抛;批量删除必须删前收集);
 *  B. 统一写端点(单条 PATCH / 单条 DELETE / 批量)都真的接到了回写;
 *  C. 小程序历史表有可空 archived_at 列,迁移已登记进 journal(造好没装车 = 没有);
 *  D. 小程序新增 batch-archive 端点并镜像回统一表,历史列表默认排除已归档(与 web 同口径)。
 */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(__dirname, '../../../../..')
const read = (rel: string) => readFileSync(resolve(ROOT, rel), 'utf8')

const BACKFLOW = 'apps/api/src/routes/conversation-miniapp-backflow.ts'
const ROUTES_CHAT = 'apps/api/src/routes/chat.ts'
const ROUTE = 'apps/api/src/routes/ai-user-model-chat.ts'
const SCHEMA = 'packages/database/src/schema/ai-user-model-chat.ts'
const MIGRATION = 'packages/database/drizzle/20261124180000_ai_model_chat_history_archived.sql'
const JOURNAL = 'packages/database/drizzle/meta/_journal.json'

describe('A. 回写模块判据面', () => {
  const src = read(BACKFLOW)

  it('只处理 source=miniapp 且有 source_ref 的镜像行(其它来源一律 no-op)', () => {
    expect(src).toMatch(/row\.source === MINIAPP_SOURCE/)
    expect(src).toMatch(/sourceRef\.length > 0/)
  })

  it('失败回 -1 而不是抛出:镜像是副本,不该让 web 的写请求变 500', () => {
    expect(src).toMatch(/catch \{\s*return -1\s*\}/)
    expect(src).not.toMatch(/\bthrow\b/)
  })

  it('批量删除拆成"删前收集 + 删后执行"(删后在统一表已查不到 source_ref)', () => {
    expect(src).toMatch(/export async function collectMiniappRefs/)
    expect(src).toMatch(/export async function removeMiniappHistoryRows/)
    // 旧的一步式批量删除必须已不存在(留着它就是那个恒得空集的顺序错)
    expect(src).not.toMatch(/backflowMiniappRemoveMany/)
  })
})

describe('B. 统一写端点反向回写接线', () => {
  const src = read(ROUTES_CHAT)

  it('单条 PATCH:改名 / 置顶回写小程序表', () => {
    expect(src).toMatch(/backflowMiniappPatch\(userId, owned\.conversation/)
    expect(src).toMatch(/parsed\.data\.title !== undefined/)
    expect(src).toMatch(/parsed\.data\.pinned !== undefined/)
  })

  it('单条 DELETE:只在统一表真删掉之后联动删小程序历史行', () => {
    expect(src).toMatch(
      /if \(removed\.length > 0\) \{\s*const backflowed = await backflowMiniappRemove/,
    )
  })

  it('批量:删除在 switch 之前收 refs、归档在写后回写', () => {
    expect(src).toMatch(/collectMiniappRefs\(\s*userId,\s*ownedRows\.map/)
    expect(src).toMatch(/backflowMiniappPatchMany\(/)
    expect(src).toMatch(/removeMiniappHistoryRows\(userId, miniappRefsToRemove\)/)
  })
})

describe('C. 小程序历史表归档列与迁移登记', () => {
  it('schema 有可空 archived_at 列', () => {
    expect(read(SCHEMA)).toMatch(/archivedAt: timestamp\('archived_at'/)
  })

  it('迁移真加了列,且 journal 已登记(下标唯一)', () => {
    expect(read(MIGRATION)).toMatch(/add column if not exists "archived_at"/)
    const journal = JSON.parse(read(JOURNAL)) as {
      entries: Array<{ idx: number; tag: string }>
    }
    const entry = journal.entries.find(
      (e) => e.tag === '20261124180000_ai_model_chat_history_archived',
    )
    expect(entry).toBeTruthy()
    const sameIdx = journal.entries.filter((e) => e.idx === entry!.idx)
    expect(sameIdx).toHaveLength(1)
  })
})

describe('D. 小程序归档端点与列表口径', () => {
  const src = read(ROUTE)

  it('新增 /history/batch-archive 并镜像回统一表', () => {
    expect(src).toMatch(/server\.post\('\/history\/batch-archive'/)
    expect(src).toMatch(/archivedAt: nextArchivedAt/)
    expect(src).toMatch(/nextArchivedAt = body\.data\.archived \? new Date\(\) : null/)
  })

  it('历史列表默认排除已归档(与 web includeArchived=false 同口径)', () => {
    expect(src).toMatch(/isNull\(zhsAiUserModelChatHistory\.archivedAt\)/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
