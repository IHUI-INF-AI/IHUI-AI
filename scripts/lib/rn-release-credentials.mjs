// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * RN 发布链路凭据与环境引导 —— 唯一出口(§5d 密钥不入仓、不入聊天记录)。
 *
 * 为什么要有这一层(2026-11-02 立):发布链的每一腿都要问"凭据在不在位",此前每次都是
 * 各脚本各自硬编码网盘路径(AGENTS.md 已把盘符列为七类现读机器事实之一),而路径过期的
 * 表现不是"文件不存在"而是**下游恒红**(§5d key-dir 头注同型)。这一层把「取哪把凭据、
 * 从哪取、取不到算哪种失败」收成一处,调用方只拿三态,不拿第二份判据。
 *
 * 三条设计约束:
 *   1. **永不返回可打印的秘密原文之外还永不写日志** —— 值只在内存/子进程 env 里流动,
 *      对外只给 `fingerprint`(sha256 前 8 位)与长度;口令不落盘、不进 stdout。
 *   2. **取不到 ⇒ 三态,不猜**:`found` / `missing`(路径探到了但文件不在)/
 *      `unjudged`(连密钥根都解析不出 ⇒ 盘没挂上,绝不等同于"凭据无效")。
 *   3. **按内容识别而非文件名**:GCP SA key 文件名是随机串(`spherical-door-….json`),
 *      按名字找下次改名就瞎;改为扫密钥根、认 `type === 'service_account'`。
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { homedir } from 'node:os'

import { resolveSecretsRoot } from './key-dir.mjs'

export const STATUS = Object.freeze({ FOUND: 'found', MISSING: 'missing', UNJUDGED: 'unjudged' })

export const fp = (s) => (s === null || s === undefined ? 'null' : createHash('sha256').update(String(s)).digest('hex').slice(0, 8))

/** 三态结论的统一形状;值单独走 .value,不进 JSON 摘要。 */
function outcome(status, detail, value = null) {
  return { status, detail, value }
}

/**
 * 从 Expo 凭据文件按标签取 token。
 * 文件形态(实测 2026-11-02):`机器人Key:<t>` / `个人key:<t>`,冒号可能是全角。
 * 默认取 `个人`(它鉴权成项目 owner `ihui-ai`,`机器人` 那枚鉴权成 `智汇AI (robot)`)。
 */
export function expoToken({ root = resolveSecretsRoot(), prefer = /个人/, env = process.env } = {}) {
  if (env.EXPO_TOKEN) return outcome(STATUS.FOUND, 'env EXPO_TOKEN', env.EXPO_TOKEN)
  if (!root) return outcome(STATUS.UNJUDGED, '密钥根解析不出(盘未挂载?),不等于凭据失效')
  const file = join(root, 'expo key.txt').replace(/\\/g, '/')
  if (!existsSync(file)) return outcome(STATUS.MISSING, `${file} 不存在`)
  const lines = readFileSync(file, 'utf8').split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const parsed = []
  for (const line of lines) {
    const parts = line.split(/[:：]/)
    const token = parts.slice(1).join(':').trim()
    if (token.length >= 20) parsed.push({ label: parts[0].trim(), token })
  }
  if (parsed.length === 0) return outcome(STATUS.MISSING, `${file} 里解析不出任何 token 段`)
  const hit = parsed.find((p) => prefer.test(p.label)) ?? parsed[0]
  return outcome(STATUS.FOUND, `${file} label="${hit.label}" fp=${fp(hit.token)}`, hit.token)
}

/**
 * Google Play 服务账号 JSON —— 按内容识别(不认文件名)。
 * 返回 { path, clientEmail, projectId }:clientEmail 是 Play Console 里要授权的那枚邮箱,
 * 属于身份标识而非秘密,可以进报告。
 */
export function playServiceKey({ root = resolveSecretsRoot() } = {}) {
  if (!root) return outcome(STATUS.UNJUDGED, '密钥根解析不出')
  const names = readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.endsWith('.json'))
    .map((d) => d.name)
  const found = []
  for (const name of names) {
    let j
    try {
      j = JSON.parse(readFileSync(join(root, name), 'utf8'))
    } catch {
      continue
    }
    if (j?.type === 'service_account' && j.private_key && j.client_email) {
      found.push({ path: join(root, name).replace(/\\/g, '/'), clientEmail: j.client_email, projectId: j.project_id })
    }
  }
  if (found.length === 0) return outcome(STATUS.MISSING, `${root} 下无 type=service_account 的 JSON`)
  if (found.length > 1) return outcome(STATUS.UNJUDGED, `${root} 下有 ${found.length} 枚 SA key,需显式指定`, found)
  return outcome(STATUS.FOUND, `clientEmail=${found[0].clientEmail}`, found[0])
}

/** Android 正式签名件:keystore 落点 + gradle.properties 的 IHUI_RELEASE_* 四键。 */
export function androidSigning({ home = homedir() } = {}) {
  const store = join(home, '.android', 'ihui-release.keystore').replace(/\\/g, '/')
  const propsFile = join(home, '.gradle', 'gradle.properties').replace(/\\/g, '/')
  const keys = ['IHUI_RELEASE_STORE_FILE', 'IHUI_RELEASE_STORE_PASSWORD', 'IHUI_RELEASE_KEY_ALIAS', 'IHUI_RELEASE_KEY_PASSWORD']
  if (!existsSync(store)) return outcome(STATUS.MISSING, `${store} 不存在(不可上架;本机 debug 签名包仅可自装)`, { store, propsFile, present: [] })
  if (!existsSync(propsFile)) return outcome(STATUS.MISSING, `${propsFile} 不存在 ⇒ Gradle 拿不到口令,构建会回退 debug 签名`, { store, propsFile, present: [] })
  const text = readFileSync(propsFile, 'utf8')
  const present = keys.filter((k) => {
    const m = text.match(new RegExp(`^${k}=(.*)$`, 'm'))
    return !!m && m[1].trim() !== ''
  })
  const storeFileValue = (text.match(/^IHUI_RELEASE_STORE_FILE=(.*)$/m) || [])[1]?.trim()
  // .properties 会把反斜杠当转义吃掉 ⇒ 路径必须是正斜杠形态(2026-10-20 实测 validateSigningRelease FAILED)
  const slashOk = !storeFileValue || !storeFileValue.includes('\\')
  if (present.length < keys.length) return outcome(STATUS.MISSING, `${propsFile} 缺 ${keys.filter((k) => !present.includes(k)).join(',')}`, { store, propsFile, present })
  if (!slashOk) return outcome(STATUS.UNJUDGED, `${propsFile} 的 IHUI_RELEASE_STORE_FILE 含反斜杠,Gradle 会当转义吃掉`, { store, propsFile, present })
  return outcome(STATUS.FOUND, `keystore 与四键齐备 fp(storeFile)=${fp(storeFileValue)}`, { store, propsFile, present })
}

/**
 * eas-cli 入口 —— 必须用 node 直调 `bin/run`。
 * Windows 上 `spawn` 那个 `.bin/eas` 的 .cmd 壳会 EINVAL,而 execSync 走 cmd.exe 又违反
 * §12g 的 stdio 纪律;本仓实测过的好形态只有 node 直调 JS 入口(2026-11-02 取证)。
 */
export function easEntry({ dir = join(process.cwd(), 'apps', 'mobile-rn') } = {}) {
  for (const p of [
    join(dir, 'node_modules', 'eas-cli', 'bin', 'run'),
    join(dir, '..', '..', 'node_modules', 'eas-cli', 'bin', 'run'),
  ]) {
    if (existsSync(p)) return outcome(STATUS.FOUND, p.replace(/\\/g, '/'), p.replace(/\\/g, '/'))
  }
  return outcome(STATUS.MISSING, 'eas-cli 入口找不到(未 pnpm install?)')
}

export const __test__ = { STATUS, fp, expoToken, playServiceKey, androidSigning, easEntry, outcome }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
