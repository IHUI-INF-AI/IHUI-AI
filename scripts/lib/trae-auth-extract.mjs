// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 本机 Trae 客户端凭据提取器 —— 把号池自动保活缺的那枚 refreshToken 取到手。
 *
 * 立因(2026-10-24 现读):号池里 Trae 号只有 cookie 换票通道(GetUserToken),
 * 无 refreshToken ⇒ 调度器的临期刷新与 down 恢复都进不了射程(见
 * apps/api/src/services/relay-account-pool-scheduler.ts 的 recredentialableCondition 头注),
 * cookie 一死这枚号就永久停摆。而 Trae 客户端自己一直在用 refreshToken 续期
 * (`/cloudide/api/v3/trae/oauth/ExchangeToken`),只是我方从未取过它。
 *
 * 凭据落点(本机取证):`%APPDATA%\Trae CN\User\globalStorage\storage.json` 的
 * `iCubeAuthInfo://icube.cloudide` 键 = 客户端 `byteCrypto` 信封(base64)。
 * 信封形状逐字节取自客户端 bundle 的 `out-build/vs/base/common/byteCrypto.js`:
 *
 *   header(6) = [116,99,5,16,0,0]        // 'tc' + 类型 AES(5) + 16 + 保留
 *   key(32)   = 每次加密随机生成的会话密钥
 *   body      = AES-128-CBC(aesKey, iv, SHA-512(明文) ‖ 明文)   // PKCS#7
 *   (aesKey, iv) = 前 64 字节写入 SHA-512(SHA-512(key) ‖ MASTER) 的摘要
 *   MASTER(64)   = 客户端两张常量表逐字节异或($Ve 的 Gle^zle 分支)
 *
 * 只读本机文件,不发任何网络请求;返回值与错误信息一律不含凭据明文,
 * 只给 uid / 长度 / 到期时刻 / sha256 前缀指纹(与 workbuddy-auth-extract 同口径)。
 *
 * 边界:
 * - 信封魔数或 MAC 对不上 ⇒ 抛 ExtractError('envelope-shape'),不猜、不解密;
 *   客户端改了信封格式时,这条是唯一诚实的结局(§0.3 取不到输入 ⇒ 未判定)。
 * - 不消费 refreshToken:本模块只做"读取",续期(ExchangeToken)留给调度器,
 *   避免与本机正在登录的客户端抢轮换。
 */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'

/** 信封头:Zs.AES 档(客户端 VVe 判类型时逐字节比对的同六个值) */
export const ENVELOPE_HEADER = Object.freeze([116, 99, 5, 16, 0, 0])
const HEADER_LEN = 6
const KEY_LEN = 32
const MAC_LEN = 64
/** 明文段之前的 MAC + 明文本身,密文必须按 16 字节对齐(PKCS#7 由 Node 补齐) */
const BLOCK_LEN = 16

/**
 * `$Ve(64, Zs.AES)` 的展开:客户端 bundle 里两张 64 字节常量表逐字节异或。
 * 表值随 bundle 走查(2026-10-24 本机 Trae CN 2.3.93438 实取),不是编出来的。
 */
export const MASTER_TABLE_GLE = Object.freeze([
  82, 9, 106, 213, 48, 54, 165, 56, 191, 64, 163, 158, 129, 243, 215, 251, 124, 227, 57, 130, 155,
  47, 255, 135, 52, 142, 67, 68, 196, 222, 233, 203, 84, 123, 148, 50, 166, 194, 35, 61, 238, 76,
  149, 11, 66, 250, 195, 78, 8, 46, 161, 102, 40, 217, 36, 178, 118, 91, 162, 73, 109, 139, 209, 37,
])
export const MASTER_TABLE_ZLE = Object.freeze([
  31, 221, 168, 51, 136, 7, 199, 49, 177, 18, 16, 89, 39, 128, 236, 95, 96, 81, 127, 169, 25, 181,
  74, 13, 45, 229, 122, 159, 147, 201, 156, 239, 160, 224, 59, 77, 174, 42, 245, 176, 200, 235, 187,
  60, 131, 83, 153, 97, 23, 43, 4, 126, 186, 119, 214, 38, 225, 105, 20, 99, 85, 33, 12, 125,
])

export class ExtractError extends Error {
  constructor(message, code = 'extract-failed') {
    super(message)
    this.name = 'ExtractError'
    this.code = code
  }
}

function sha512(buf) {
  return crypto.createHash('sha512').update(buf).digest()
}

/** 派生 (aesKey 16B, iv 16B) —— 客户端 Fle() 的原样翻译 */
export function deriveKeyIv(sessionKey) {
  const master = Buffer.from(MASTER_TABLE_GLE.map((v, i) => v ^ MASTER_TABLE_ZLE[i]))
  const s = Buffer.concat([sha512(sessionKey), master])
  const digest = sha512(s)
  digest.copy(s, 0)
  return { aesKey: s.subarray(0, 16), iv: s.subarray(16, 16 + BLOCK_LEN) }
}

/** 信封解码 + 解密:魔数/长度/MAC 任一不合即抛,不返回半成品 */
export function decryptEnvelope(base64Text) {
  const bytes = Buffer.from(String(base64Text), 'base64')
  if (bytes.length <= HEADER_LEN + KEY_LEN + BLOCK_LEN) {
    throw new ExtractError(`信封过短(${bytes.length}B),不是 byteCrypto 信封`, 'envelope-shape')
  }
  for (let i = 0; i < HEADER_LEN; i++) {
    if (bytes[i] !== ENVELOPE_HEADER[i]) {
      throw new ExtractError(
        `信封魔数不符(前 6 字节 ${bytes.subarray(0, HEADER_LEN).toString('hex')},期望 ${ENVELOPE_HEADER.map((v) => v.toString(16).padStart(2, '0')).join('')}) ⇒ 客户端改了加密格式`,
        'envelope-shape',
      )
    }
  }
  const sessionKey = bytes.subarray(HEADER_LEN, HEADER_LEN + KEY_LEN)
  const cipher = bytes.subarray(HEADER_LEN + KEY_LEN)
  const { aesKey, iv } = deriveKeyIv(sessionKey)
  let opened
  try {
    const d = crypto.createDecipheriv('aes-128-cbc', aesKey, iv)
    opened = Buffer.concat([d.update(cipher), d.final()])
  } catch {
    throw new ExtractError('信封解密失败(密钥派生或密文不匹配)', 'envelope-decrypt')
  }
  if (opened.length < MAC_LEN) throw new ExtractError('信封缺 SHA-512 前缀', 'envelope-shape')
  const body = opened.subarray(MAC_LEN)
  const mac = opened.subarray(0, MAC_LEN)
  const want = sha512(body)
  if (!crypto.timingSafeEqual(mac, want)) {
    throw new ExtractError('信封 MAC 校验不过(内容被改写或取错键)', 'envelope-mac')
  }
  return body.toString('utf8')
}

/** 加密(与客户端同形状):供往返自证,不用于写回客户端 */
export function encryptEnvelope(plaintext, sessionKey = crypto.randomBytes(KEY_LEN)) {
  const body = Buffer.from(String(plaintext), 'utf8')
  const { aesKey, iv } = deriveKeyIv(sessionKey)
  const c = crypto.createCipheriv('aes-128-cbc', aesKey, iv)
  const cipher = Buffer.concat([c.update(Buffer.concat([sha512(body), body])), c.final()])
  return Buffer.concat([Buffer.from(ENVELOPE_HEADER), sessionKey, cipher]).toString('base64')
}

/** storage.json 里的凭据键:形如 `iCubeAuthInfo://<authProviderId>` 且值为信封 */
export function pickAuthEnvelopeKeys(storeJson) {
  const out = []
  for (const [key, value] of Object.entries(storeJson || {})) {
    if (typeof value !== 'string' || !/^[A-Za-z0-9+/]+=*$/.test(value)) continue
    if (!/^iCubeAuthInfo:\/\//.test(key)) continue
    out.push(key)
  }
  // icube.cloudide = IDE 会话(authProviderId),其余(usertag / icube-dc)是附属档
  return out.sort((a, b) =>
    a.endsWith('icube.cloudide') ? -1 : b.endsWith('icube.cloudide') ? 1 : a.localeCompare(b),
  )
}

/** Trae 数据目录候选:`IHUI_TRAE_DIR` 覆盖 > Trae CN > TRAE SOLO CN > Trae */
export function traeUserDataDirs(env = process.env, homedir = os.homedir()) {
  const appdata = env.APPDATA || path.join(homedir, 'AppData', 'Roaming')
  const override = env.IHUI_TRAE_DIR?.trim()
  const names = ['Trae CN', 'TRAE SOLO CN', 'Trae']
  const list = override
    ? [override, ...names.map((n) => path.join(appdata, n))]
    : names.map((n) => path.join(appdata, n))
  return list.map((p) => path.resolve(p))
}

/**
 * userInfo 明文 → 号池标准导入 JSON。
 * 展示名按 AGENTS 口径 手机 > 邮箱 > 账户名 > 用户名;全空时用 uid 兜底,
 * 绝不把 uuid/纯数字之外的形态当名字(checkin_engine 的 uuid_shaped_name 同判据的简化版)。
 */
export function toPoolAccount(userInfo) {
  const token = typeof userInfo?.token === 'string' ? userInfo.token : ''
  const refreshToken = typeof userInfo?.refreshToken === 'string' ? userInfo.refreshToken : ''
  const uid =
    userInfo?.userId === undefined || userInfo?.userId === null ? '' : String(userInfo.userId)
  if (!token) throw new ExtractError('userInfo 里没有 token', 'payload-shape')
  if (!uid) throw new ExtractError('userInfo 里没有 userId', 'payload-shape')
  const acct = userInfo.account && typeof userInfo.account === 'object' ? userInfo.account : {}
  const name =
    [acct.phone, acct.nonPlainTextMobile, acct.email, acct.username, acct.nickname, acct.name].find(
      (v) => typeof v === 'string' && v.trim() !== '' && !/^[0-9a-f]{8}-[0-9a-f]{4}/i.test(v),
    ) || `trae-${uid.slice(0, 8)}`
  return {
    providerCode: 'trae',
    accounts: [
      {
        name,
        token,
        ...(refreshToken ? { refreshToken } : {}),
        uid,
        ...(typeof userInfo.expiredAt === 'string' ? { expiresAt: userInfo.expiredAt } : {}),
        enabled: true,
      },
    ],
    meta: {
      edition: 'trae',
      uid,
      name,
      tokenExpiresAt: typeof userInfo.expiredAt === 'string' ? userInfo.expiredAt : null,
      refreshExpiresAt:
        typeof userInfo.refreshExpiredAt === 'string' ? userInfo.refreshExpiredAt : null,
      tokenReleaseAt: typeof userInfo.tokenReleaseAt === 'string' ? userInfo.tokenReleaseAt : null,
      host: typeof userInfo.host === 'string' ? userInfo.host : null,
      hasRefreshToken: refreshToken.length > 0,
      tokenFingerprint: fingerprintOf(token),
      refreshTokenFingerprint: refreshToken ? fingerprintOf(refreshToken) : null,
      accessTokenLength: token.length,
      refreshTokenLength: refreshToken.length,
    },
  }
}

export function fingerprintOf(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 12)
}

/** 读本机 Trae 客户端会话;取不到输入一律抛错(调用方按 exit 2 报未判定) */
export function extractTraeAccount(opts = {}) {
  const dirs = opts.dirs || traeUserDataDirs()
  const tried = []
  for (const dir of dirs) {
    const file = path.join(dir, 'User', 'globalStorage', 'storage.json')
    tried.push(file)
    let store
    try {
      store = JSON.parse(fs.readFileSync(file, 'utf8'))
    } catch {
      continue
    }
    const keys = pickAuthEnvelopeKeys(store)
    if (keys.length === 0) continue
    for (const key of keys) {
      let plain
      try {
        plain = decryptEnvelope(store[key])
      } catch {
        continue
      }
      let userInfo
      try {
        userInfo = JSON.parse(plain)
      } catch {
        continue
      }
      if (!userInfo || typeof userInfo !== 'object' || typeof userInfo.token !== 'string') continue
      const account = toPoolAccount(userInfo)
      account.meta.storageFile = file
      account.meta.storageKey = key
      return account
    }
  }
  throw new ExtractError(
    `本机未找到可解密的 Trae 会话信封(试过 ${tried.length} 个落点:${tried.join(' | ')})`,
    'no-envelope',
  )
}

export const __test__ = {
  deriveKeyIv,
  decryptEnvelope,
  encryptEnvelope,
  pickAuthEnvelopeKeys,
  traeUserDataDirs,
  toPoolAccount,
  fingerprintOf,
  ExtractError,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
