// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 应用上架平台账号落库(2026-11-14 立)。
 *
 * 这些行只回答「哪个商店后台用哪个账号」:provider_code 是商店码,token 恒为空串密文,
 * 永不参与 AI 中转转发/刷新/签到/指标。`tempUnschedulable=true` 让调度器的巡检与
 * 临期刷新候选面天然跳过;`sharedToOps=false` 不向全局池开放。
 *
 * seed 幂等:靠 (provider_code, uid) 的部分唯一索引 + ON CONFLICT DO NOTHING,
 * 重复执行只补缺失行,不覆盖人工改名。
 */
import { aiRelayAccountPool } from '@ihui/database'
import { STORE_PLATFORMS, storePlatformOf } from '@ihui/shared/constants/store-platforms'
import { db } from '../db/index.js'
import { encryptField } from '../utils/crypto.js'

export interface StoreSeedResult {
  /** 本次新写入的平台数 */
  inserted: number
  /** 已存在、未改动的平台数 */
  existing: number
  /** 内置平台总数 */
  total: number
}

export interface CreateStoreAccountInput {
  providerCode: string
  name: string
  uid: string
}

export interface CreateStoreAccountResult {
  /** false = 该平台下同 uid 已存在(未覆盖) */
  created: boolean
  id: string | null
}

/**
 * 写入一个应用上架平台账号(运营池、同平台可多账号)。
 * 唯一键 = (provider_code, uid, owner_user_id IS NULL),重复时保留原行。
 */
export async function createStoreAccount(
  input: CreateStoreAccountInput,
): Promise<CreateStoreAccountResult> {
  const platform = storePlatformOf(input.providerCode)
  if (!platform) throw new Error(`未知的应用上架平台:${input.providerCode}`)
  const now = new Date()
  const rows = await db
    .insert(aiRelayAccountPool)
    .values({
      ownerUserId: null,
      providerCode: platform.providerCode,
      uid: input.uid.slice(0, 128),
      name: input.name.slice(0, 128),
      // 商店账号没有 AI 中转凭据;空串密文与 codearts 永久密钥形态同形
      tokenEnc: encryptField(''),
      isEnabled: true,
      // 不共享到 AI 运营池
      sharedToOps: false,
      // 摘出 AI 调度:巡检/临期刷新/池健康分母都不会命中
      tempUnschedulable: true,
      healthStatus: 'unknown',
      extraMetadata: {
        storePlatform: true,
        loginUrl: platform.loginUrl,
        ...(platform.note ? { note: platform.note } : {}),
        createdAt: now.toISOString(),
      },
      updatedAt: now,
    })
    .onConflictDoNothing()
    .returning({ id: aiRelayAccountPool.id })
  return rows[0] ? { created: true, id: rows[0].id } : { created: false, id: null }
}

/** 把内置应用上架平台账号补齐到运营池(幂等;已存在的行保持不动) */
export async function seedStoreAccounts(): Promise<StoreSeedResult> {
  let inserted = 0
  let existing = 0
  for (const platform of STORE_PLATFORMS) {
    const result = await createStoreAccount({
      providerCode: platform.providerCode,
      name: platform.defaultName,
      uid: platform.defaultUid,
    })
    if (result.created) inserted++
    else existing++
  }
  return { inserted, existing, total: STORE_PLATFORMS.length }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
