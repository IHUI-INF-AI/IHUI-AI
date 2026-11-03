// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * managed-env-face.mjs —— 受管 `.env` **文本**的唯一取材出口(2026-10-28 立)。
 *
 * 为什么要有这一层:
 *  · 只读尺子判的是"本机生效配置"，而 `.env` 根本不进版本库 ⇒ `scripts/lib/face-reader.mjs`
 *    那种 HEAD/索引取面在这里结构上不适用（HEAD 面没有这个文件）。
 *  · 但门 118（取材面纪律）拦的是**门脚本自己散写** `readFileSync + ROOT 锚点`——它按棘轮只拦
 *    新增，所以出路不是给它配豁免清单（§0.7：手工白名单必然腐烂），而是按
 *    `registry-sync-audit` / `lint-staged-pin-audit` 的同一条先例把 IO 归位 lib，门脚本只留判据。
 *  · 同类 IO 只留一份：将来再有"读受管 .env 的某个键"的尺子，一律从这里取，不再各写一遍路径拼法。
 *
 * 本出口**只回文本，不回值**：脱敏与取值由各把尺子自己做（密钥值一律不得进日志/告警正文）。
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

/** 受管 .env 面清单（存在才扫；全不存在 ⇒ 调用方必须落未判定，不许当"没设"）。 */
export const MANAGED_ENV_FACES = Object.freeze([
  'apps/api/.env',
  'apps/api/.env.local',
  '.env',
  'apps/web/.env',
  'apps/ai-service/.env',
])

/**
 * 取某一面文本；取不到 ⇒ null（由调用方判未判定）。
 * 相对入参强制留在仓库根内（防 `../` 逃逸）；绝对入参按给定路径读 —— 测试夹具按 §15b
 * 本就落在仓外（DevEnv/Temp），这一类调用方给的是显式绝对路径，不存在"拼错逃逸"的形态。
 */
export function readManagedEnvText(rel = 'apps/api/.env') {
  const raw = String(rel)
  const isAbs = raw.startsWith('/') || /^[A-Za-z]:[\\/]/.test(raw)
  const abs = isAbs ? resolve(raw) : resolve(ROOT, raw)
  if (!isAbs && !abs.startsWith(ROOT)) return null
  try {
    return readFileSync(abs, 'utf8')
  } catch {
    return null
  }
}

/** 取一个键的**原始值**（调用方负责脱敏；键不存在 ⇒ null，与"设成空串"区分开）。 */
export function readManagedEnvValue(key, rel = 'apps/api/.env') {
  const text = readManagedEnvText(rel)
  if (text === null) return null
  const m = text.match(new RegExp(`^${key}=(.*)$`, 'm'))
  if (!m) return undefined // 该面里没有这一行 ⇒ "未设"
  return m[1].trim()
}

export const __test__ = { MANAGED_ENV_FACES, readManagedEnvText, readManagedEnvValue, ROOT }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
