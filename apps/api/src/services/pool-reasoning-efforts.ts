// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 号池模型推理档位的**读侧唯一出口**(2026-11-21 立)。
//
// 上游不公布 reasoning 枚举(WorkBuddy/Trae 这类网关甚至对未知 effort 静默接受),
// 所以档位只能靠 `apps/api/scripts/probe-pool-reasoning-efforts.mjs` 实弹逐档核对后
// 写进文件账本;本模块只负责把账本按模型 id 交给 /api/account-pool/models。
//
// 三条判序(取不到一律"未判定",绝不猜):
// ① 账本读不到 / 形状坏 ⇒ 返回空 map,前端回落通用档;
// ② 某模型没测过 ⇒ 该行不下发 reasoning_efforts(缺省 ≠ 空数组);
// ③ 测过但五档全被接受 ∧ 一档未拒 ⇒ 上游不区分档位,下发实测集但在
//    `reasoning_efforts_source` 里标明 probed,前端据此可提示"实测可发"。

import { readFileSync } from 'node:fs'

type StoreEntry = { efforts?: unknown; unknown?: unknown; probedAt?: unknown; source?: unknown }

const STORE_PATH = new URL(
  '../../../../.ihui-agent/state/pool-reasoning-efforts.json',
  import.meta.url,
)

const CACHE_TTL_MS = 60_000
let cache: { at: number; map: Map<string, string[]> } | null = null

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string')
}

/** 现读账本(60s 进程内缓存,刷新脚本写盘后最迟一分钟可见) */
export function loadPoolReasoningEfforts(): Map<string, string[]> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.map
  const map = new Map<string, string[]>()
  try {
    const raw = JSON.parse(readFileSync(STORE_PATH, 'utf8')) as { models?: unknown }
    const models = raw?.models
    if (models && typeof models === 'object') {
      for (const [id, entry] of Object.entries(models as Record<string, StoreEntry>)) {
        if (!isStringArray(entry?.efforts)) continue
        // 五档全没判定(上游超时/报错)不是"都不支持":该行保持未测,不向下游下发空数组。
        const unknowns = Array.isArray(entry?.unknown) ? entry.unknown.length : 0
        if (entry.efforts.length === 0 && unknowns > 0) continue
        // 空数组 = 五档都发过且都被明确拒(有证据的不支持);有值 = 实测可发集
        map.set(id, entry.efforts)
      }
    }
  } catch {
    // 账本缺失/损坏 ⇒ 空 map(未判定,前端回落通用档)
  }
  cache = { at: Date.now(), map }
  return map
}

/** 给号池模型行附上实测档位;没测过的行原样返回(不写缺省键) */
export function attachPoolReasoningEfforts<T extends { id: string }>(
  rows: T[],
): (T & { reasoning_efforts?: string[] })[] {
  const map = loadPoolReasoningEfforts()
  return rows.map((row) => {
    const efforts = map.get(row.id)
    return efforts ? { ...row, reasoning_efforts: efforts } : row
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
