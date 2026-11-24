// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * MiniMax(mcode)可用模型清单(本机 CLI 配置通路,2026-11-24 立)。
 *
 * 取证定案(docs/RELAY_MINIMAX_LISTMODELS_EVIDENCE.md):MiniMax 号池存的是 mcode
 * OAuth 票(mmoat_),上游 GET /v1/models 官方端点存在但要 API Secret Key
 * (实弹 401 1004 "Please carry the API secret key"),凭据面不匹配;余量端点
 * coding_plan/remains 的 model_remains 免费号为 null,不含清单。
 *
 * 唯一客户端同源通路 = mcode CLI 自己的 `~/.minimax/config.yaml`:
 *   - provider.minimax.models 键 = 当前可用的模型 id(M3/M3.1-Flash...);
 *   - provider.minimax.whitelist  = CLI 允许的模型全集;
 *   - provider.minimax.model_order = 选择器排序。
 * 实测(2026-11-20 本机)models={M3,M3.1-Flash},whitelist 4 条,defaultModel=M3.1-Flash。
 * CLI 升级会更新这个文件 ⇒ 新模型自动进、旧模型自动出(正是用户要的自动发现)。
 *
 * 清单语义 = **本机 CLI 登录态的当前配置**,与号池任意账号无关,
 * 结果如实标 scope:'local-cli-login'(同 qoder 范式);调用方不得当成号池账号的清单。
 * 纪律(不冒充可用):文件缺失/解析失败/无 models 一律 ok:false,绝不返回静态清单冒充。
 */
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { load as parseYaml } from 'js-yaml'

/** 默认配置路径;允许 env 覆盖(NSSM 服务 homedir 可能不是用户目录) */
export function minimaxConfigPath(home = homedir()): string {
  return process.env['IHUI_MINIMAX_CONFIG'] || join(home, '.minimax', 'config.yaml')
}

export interface MinimaxModelTable {
  /** provider.minimax.models 的键(当前可用模型) */
  models: string[]
  /** provider.minimax.whitelist(CLI 允许全集) */
  whitelist: string[]
  /** defaultModel(如 minimax/MiniMax-M3.1-Flash) */
  defaultModel: string
}

/**
 * 解析 config.yaml 的 provider.minimax 模型面。纯函数、零 I/O,便于单测锁形状。
 * 取不到任何模型 id → null(如实未判定,不冒充空清单)。
 */
export function parseMinimaxConfigModels(body: string): MinimaxModelTable | null {
  let doc: unknown
  try {
    doc = parseYaml(body)
  } catch {
    return null
  }
  if (!doc || typeof doc !== 'object') return null
  const provider = (doc as Record<string, unknown>)['provider']
  if (!provider || typeof provider !== 'object') return null
  const mm = (provider as Record<string, unknown>)['minimax']
  if (!mm || typeof mm !== 'object') return null
  const m = mm as Record<string, unknown>
  const modelsObj = m['models']
  const models =
    modelsObj && typeof modelsObj === 'object' && !Array.isArray(modelsObj)
      ? Object.keys(modelsObj as Record<string, unknown>)
      : []
  const white = Array.isArray(m['whitelist'])
    ? (m['whitelist'] as unknown[]).filter((x): x is string => typeof x === 'string' && x.trim() !== '')
    : []
  const def = typeof m['defaultModel'] === 'string' ? (m['defaultModel'] as string).trim() : ''
  const rootDef = typeof (doc as Record<string, unknown>)['defaultModel'] === 'string'
    ? ((doc as Record<string, unknown>)['defaultModel'] as string).trim()
    : ''
  if (models.length === 0 && white.length === 0) return null
  return { models, whitelist: white, defaultModel: def || rootDef }
}

/** 读本机 config.yaml 并解析;文件缺失/解析失败 → null(不抛,由 adapter 记 ok:false) */
export function readLocalMinimaxModels(configPath = minimaxConfigPath()): MinimaxModelTable | null {
  if (!existsSync(configPath)) return null
  try {
    return parseMinimaxConfigModels(readFileSync(configPath, 'utf8'))
  } catch {
    return null
  }
}
