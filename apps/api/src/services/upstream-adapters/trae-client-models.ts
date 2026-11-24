// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Trae 模型清单的客户端同源取数(2026-11-25 立)。
 *
 * 立因:trae 上游 model_list 对号池凭据整批 401(code=1001)——本机当前登录态的
 * JWT(2026-11-28 才到期)直连也 401,说明这不是"某枚号过期",而是该 HTTP 端点
 * 不再接受外部直连。客户端自己却拿得到清单:它把清单落在 state.vscdb
 * (`<uid>_AI.agent.model.model_list_map`,chat_v3 = 25 条,含 custom_openai_compatible/
 * 自定义模型)。本模块就是这份客户端缓存的唯一解析真相源,供 trae 适配器
 * listModels 在上游 401 时回落(与 minimax 的本地配置回落同一策略:客户端为主取数源)。
 *
 * 纪律:
 * - 只读 state.vscdb,不写、不复制、不外传;不输出任何 token。
 * - 解析不出任何条目 ⇒ 返回 null(不伪造空清单,调用方继续如实报错)。
 * - 过滤智能体内部工具名(refactor 前缀 / code-review 前缀等),它们不是可调用模型。
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/** 智能体内部工具名 / 界面名:命中即不是可调用模型(与 sync-trae-models-from-client.py 同一口径) */
const NON_MODEL_PAT =
  /(远程资源|资源管理器|refactor_|code-review|scoper|finder|planner|incrementer|judge)/i

/** 候选 state.vscdb 路径:显式 env 优先,其次本机 Trae CN 常见安装位 */
export function resolveTraeStateDbCandidates(): string[] {
  const explicit = process.env.TRAE_CN_VSCDB?.trim()
  const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming')
  return [
    ...(explicit ? [explicit] : []),
    path.join(appData, 'Trae CN', 'User', 'globalStorage', 'state.vscdb'),
    path.join(appData, 'Trae CN', 'User', 'User', 'globalStorage', 'state.vscdb'),
  ]
}

/**
 * model_list_map 的 JSON 文本 → 可调用模型 id 清单。
 * 取 chat_v3(对话选择器的全量清单)优先,退化到 builder_v3/builder/solo_agent;
 * 同 id 去重;空/坏形状返回 null。
 */
export function extractTraeClientModelsFromMapText(text: string): string[] | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
  const map = parsed as Record<string, unknown>
  const buckets = ['chat_v3', 'builder_v3', 'builder', 'solo_agent']
  const out: string[] = []
  const seen = new Set<string>()
  for (const bucket of buckets) {
    const arr = map[bucket]
    if (!Array.isArray(arr) || arr.length === 0) continue
    for (const m of arr) {
      if (!m || typeof m !== 'object') continue
      const rec = m as Record<string, unknown>
      const id =
        typeof rec['name'] === 'string' && rec['name'].trim()
          ? rec['name'].trim()
          : typeof rec['model_id'] === 'string' && rec['model_id'].trim()
            ? rec['model_id'].trim()
            : ''
      if (!id || seen.has(id) || NON_MODEL_PAT.test(id)) continue
      seen.add(id)
      out.push(id)
    }
    if (out.length > 0) break // 一个桶已能给出全量清单,不混入其它桶的残缺子集
  }
  return out.length > 0 ? out : null
}

/** 读一个 state.vscdb 里的 model_list_map(取最长的那份 = 全量账号清单) */
async function readModelListMapFromDb(file: string): Promise<string | null> {
  const { DatabaseSync } = (await import('node:sqlite')) as unknown as {
    DatabaseSync: new (
      p: string,
      o?: { readOnly?: boolean },
    ) => {
      prepare: (sql: string) => { get: () => { value?: unknown } | undefined }
      close: () => void
    }
  }
  const db = new DatabaseSync(file, { readOnly: true })
  try {
    const row = db
      .prepare(
        "select value from ItemTable where key like '%model_list_map%' order by length(value) desc limit 1",
      )
      .get()
    const value = typeof row?.value === 'string' ? row.value : ''
    return value || null
  } finally {
    try {
      db.close()
    } catch {
      /* ignore */
    }
  }
}

/**
 * 客户端 state.vscdb → 模型 id 清单。
 * 找不到可读的库 / 解析不出 ⇒ null(调用方不得当作"上游没有模型")。
 */
export async function readTraeClientModels(explicitPath?: string): Promise<string[] | null> {
  const candidates = explicitPath
    ? [explicitPath, ...resolveTraeStateDbCandidates()]
    : resolveTraeStateDbCandidates()
  for (const file of candidates) {
    if (!file || !fs.existsSync(file)) continue
    try {
      const mapText = await readModelListMapFromDb(file)
      if (!mapText) continue
      const models = extractTraeClientModelsFromMapText(mapText)
      if (models && models.length > 0) return models
    } catch {
      /* 换下一个候选;全部失败由调用方如实报错 */
    }
  }
  return null
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
