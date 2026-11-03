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
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
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

/**
 * 商店凭据槽位识别 —— 按厂商名与字段形态找,不硬编码文件名。
 *
 * 立因(2026-11-02):发布面要覆盖国内各商店,第一件事不是写上传器,而是**量出每一家到底有没有凭据、
 * 有的是哪一类**。华为那枚实测就是"有但不是那一枚":`应用ID/密钥` 过 HMS OAuth 端点换得到 token
 * (len=104),过 AGC Connect API 端点则回 `203890688 client id or secret error` ⇒ 它是 HMS 客户端凭据,
 * 而自动化上架要的是 Connect API 客户端(client_id/client_secret,在 AGC「用户与权限→Connect API」创建)。
 * 把"有凭据"和"能上架"混为一谈,就是这条链路最可能的失效形态。
 */
export const STORE_VENDORS = Object.freeze([
  { id: 'huawei', label: '华为 AppGallery', match: /华为|huawei|appgallery/i, fieldsNeeded: ['Connect API 客户端 client_id', 'client_secret'], note: '现有枚是 HMS OAuth 客户端(能换 token),不是 Connect API 客户端 ⇒ 自动化上架缺后者' },
  { id: 'xiaomi', label: '小米应用商店', match: /小米|xiaomi|mi-store/i, fieldsNeeded: ['pac_name', 'username', 'password 或 LUD 侧凭据'], note: '小米无公开 API 客户端凭据在目录内' },
  { id: 'oppo', label: 'OPPO 软件商店', match: /oppo|coloros/i, fieldsNeeded: ['appkey', 'apisecret'], note: '' },
  { id: 'vivo', label: 'vivo 应用商店', match: /vivo/i, fieldsNeeded: ['developer account + apk 签名一致性'], note: '' },
  { id: 'yyb', label: '腾讯应用宝', match: /应用宝|yyb|tencent.*open/i, fieldsNeeded: ['qqs 开发者凭据'], note: '' },
  { id: 'honor', label: '荣耀应用市场', match: /荣耀|honor/i, fieldsNeeded: ['client_id/client_secret(荣耀独立 AGC)'], note: '' },
  { id: 'harmony', label: '鸿蒙 HarmonyOS NEXT', match: /鸿蒙|harmony|ohos/i, fieldsNeeded: ['AGC 鸿蒙应用 appId + 发布证书(.cer)+ Profile(.p7b)+ 私钥(.keystore)'], note: '本仓当前无 RN 鸿蒙产物能力(零 .ets/oh-package.json5/react-native-harmony)⇒ 先解决产物,再谈发布' },
])

/** 在密钥根(含其子目录,深 2 层)里按厂商匹配凭据件;返回脱敏摘要(路径/大小/字段名/指纹)。 */
export function storeCredential(vendor, { root = resolveSecretsRoot() } = {}) {
  if (!root) return outcome(STATUS.UNJUDGED, '密钥根解析不出 ⇒ 不能判该厂商无凭据')
  const hits = []
  const walk = (dir, depth) => {
    if (depth > 2) return
    let entries = []
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const d of entries) {
      const p = join(dir, d.name)
      if (d.isDirectory()) {
        if (!/模型|db-backup/.test(d.name)) walk(p, depth + 1)
        continue
      }
      if (vendor.match.test(d.name)) hits.push(p)
    }
  }
  walk(root, 0)
  if (!hits.length) return outcome(STATUS.MISSING, `${root} 内无匹配「${vendor.label}」的凭据件`)
  const digest = hits.map((p) => {
    const buf = readFileSync(p)
    let fields = []
    try {
      const j = JSON.parse(buf.toString('utf8'))
      fields = Object.keys(j)
    } catch {
      fields = buf
        .toString('utf8')
        .split(/\r?\n/)
        .map((l) => (l.split(/[:：]/)[0] || '').trim())
        .filter(Boolean)
    }
    return { path: p.replace(/\\/g, '/'), bytes: buf.length, sha8: createHash('sha256').update(buf).digest('hex').slice(0, 8), fields }
  })
  return outcome(STATUS.FOUND, `${vendor.label}:${digest.map((d) => `${d.path.split('/').pop()}(${d.bytes}B,字段=${d.fields.join('/')})`).join(' | ')}`, digest)
}

/** 本机是否已产出可提交的 Android 包(AAB 优先;各商店基本都收 APK,华为/Google 收 AAB)。 */
export function androidArtifacts({ dir = join(process.cwd(), 'apps', 'mobile-rn', 'android', 'app', 'build', 'outputs') } = {}) {
  const found = []
  for (const [kind, rel] of [
    ['aab', 'bundle/release/app-release.aab'],
    ['apk', 'apk/release/app-release.apk'],
  ]) {
    const p = join(dir, rel).replace(/\\/g, '/')
    if (existsSync(p)) {
      found.push({ kind, path: p, bytes: statSyncSize(p) })
    }
  }
  if (!found.length) return outcome(STATUS.MISSING, `${dir.replace(/\\/g, '/')} 下无 release aab/apk ⇒ 各商店腿都还拿不出提交物`, found)
  return outcome(STATUS.FOUND, found.map((f) => `${f.kind}=${f.bytes}B`).join(' '), found)
}

function statSyncSize(p) {
  try {
    return statSync(p).size
  } catch {
    return 0
  }
}

export const __test__ = { STATUS, fp, expoToken, playServiceKey, androidSigning, easEntry, outcome, STORE_VENDORS, storeCredential, statSyncSize }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
