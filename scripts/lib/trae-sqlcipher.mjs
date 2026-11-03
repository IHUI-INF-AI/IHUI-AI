// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Trae ai-agent 正库(SQLCipher 4)读写器物 —— 解密、重加密、整库往返。
 *
 * 立因(2026-10-30):机主要求"一键切号把聊天记录带到新号"。本机取证实证:
 *   Trae 的对话正文住 `%APPDATA%\Trae CN\ModularData\ai-agent\database.db`
 *   (SQLCipher 4:AES-256-CBC + HMAC-SHA512,reserve=80,page=4096),
 *   会话按 session_id 组织、账号绑定只出现在 project.user_id / user_configuration /
 *   state.vscdb 键前缀这几处 ⇒ 迁移 = 解密 → 重绑账号 → 重加密回 SQLCipher。
 *   开源先例(Oh-My-Trae 等)只做"解密读取"这一半;本模块补"重加密写回"另一半,
 *   全程 Node 内建 crypto + node:sqlite,无 Python/第三方依赖(超越轴:可测、可入仓、可接线)。
 *
 * 取证来源(§12 逆向铁律,Evidence,均本机 2026-10-30 实测):
 *   - 对照程序:%LOCALAPPDATA%\Programs\Trae CN\resources\app\modules\ai-agent\ai_agent.dll
 *   - 密钥算法事实取自社区公开逆向文档:多表 XOR("rust"/"cpp"/"electron") →
 *     PBKDF2-HMAC-SHA256(salt=123456789abcdef01122334455667788, iter=100000, dklen=32);
 *     对本机真实 database.db 副本:page1 HMAC 通过、112,491 页全过、解密后 62 表可读
 *     (chat_message=1134 / history_v2=16,166 / server_history_info=34,700)。
 *   - 页布局两条 oracle 标定:① 社区参考实现(真实库可打开);② 本模块"解密→重加密→再解密"
 *     字节级互逆自证(scripts/tests/trae-sqlcipher.test.mjs)。页 1 的 salt 顶替 SQLite header 区,
 *     密文体 [SALT..PAGE-RESERVE)=4000B;其余页体 [0..PAGE-RESERVE)=4016B;尾 80B = IV(16)+HMAC(64)。
 *   - 本模块只服务"用户读/搬自己本机数据",不粘贴对方源码、不碰许可证、不绕付费、不提取凭据。
 *
 * 版本适配:优先从 ai_agent.dll 字节面现读核验常量族(mics_sj10gy 等);
 * 常量缺失 ⇒ 显式抛错要求重新取证,绝不静默用可能过期的常量(失效方向=多要一次定向说明)。
 */
import crypto from 'node:crypto'

/** SQLCipher 4 参数(社区逆向文档 + 本机实测一致) */
export const CIPHER = Object.freeze({
  PAGE: 4096,
  SALT: 16,
  IV: 16,
  HMAC: 64,
  RESERVE: 80, // IV(16) + HMAC(64)
  ITER: 100_000,
  KEY_LEN: 32,
})

/** 公开算法文档记录的当前版本常量(仅作 DLL 核验锚点与"无 DLL 时"的显式兜底) */
export const KNOWN_CONSTANTS = Object.freeze({
  configKey: 'mics_sj10gy',
  encryptedPassword: '452a17351d191e13360914012d4e2e00175b241d0f0a38091f21210e24181253',
  xorTables: ['rust', 'cpp', 'electron'],
  pbkdf2SaltHex: '123456789abcdef01122334455667788',
})

const SQLITE_HEADER = Buffer.from('SQLite format 3\x00', 'binary')

export class CipherError extends Error {
  constructor(message, code = 'cipher-failed') {
    super(message)
    this.name = 'CipherError'
    this.code = code
  }
}

/** XOR 周期表解密(三表独立游标,总周期 4×3×8=96) */
export function xorDecrypt(data, tables) {
  const out = Buffer.alloc(data.length)
  const cur = tables.map(() => 0)
  for (let i = 0; i < data.length; i++) {
    let v = data[i]
    for (let t = 0; t < tables.length; t++) {
      v ^= tables[t][cur[t]]
      cur[t] = (cur[t] + 1) % tables[t].length
    }
    out[i] = v
  }
  return out
}

/** 密码 → 32 字节加密密钥:PBKDF2-HMAC-SHA256(salt, iter=100000) */
export function deriveEncKey(password, salt, iterations = CIPHER.ITER) {
  return crypto.pbkdf2Sync(password, salt, iterations, CIPHER.KEY_LEN, 'sha256')
}

/** 从 DLL 字节面提取(加密密码,32B):命中即返回,miss ⇒ null */
export function extractEncryptedPassword(dllBuf, anchor = KNOWN_CONSTANTS.encryptedPassword) {
  const needle = Buffer.from(anchor, 'hex')
  const pos = dllBuf.indexOf(needle)
  if (pos < 0) return null
  return Buffer.from(dllBuf.subarray(pos, pos + 32))
}

/**
 * 在 DLL 字节面核验常量族。missing 非空 ⇒ 版本算法可能变更,调用方必须重新取证,
 * 本模块不猜新常量(§0.3:取不到输入 ⇒ 显式未判定,不冒绿)。
 */
export function verifyDllConstants(dllBuf) {
  const checks = [
    ['config_key', Buffer.from(KNOWN_CONSTANTS.configKey, 'utf8')],
    ['encrypted_password', Buffer.from(KNOWN_CONSTANTS.encryptedPassword.slice(0, 16), 'hex')],
    ['xor_table_rust', Buffer.from('rust', 'utf8')],
    ['xor_table_cpp', Buffer.from('cpp', 'utf8')],
    ['xor_table_electron', Buffer.from('electron', 'utf8')],
    ['pbkdf2_salt', Buffer.from(KNOWN_CONSTANTS.pbkdf2SaltHex, 'hex')],
  ]
  const missing = checks.filter(([, pat]) => dllBuf.indexOf(pat) < 0).map(([name]) => name)
  return { ok: missing.length === 0, missing }
}

/**
 * 派生本机全局密钥。
 * opts.dllBuf ⇒ 先核常量族再解;缺省 ⇒ 需显式 trustDocumented=true(不接受"口头密钥")。
 */
export function deriveGlobalKey({ dllBuf, trustDocumented = false, password, saltHex, iterations } = {}) {
  const enc32 = (() => {
    if (password) return Buffer.from(password)
    if (!dllBuf) {
      if (!trustDocumented) {
        throw new CipherError(
          '既没给 dllBuf 也没给 password:不接受"口头密钥";请传 dllBuf(核验常量族)或显式 trustDocumented:true',
          'no-key-source',
        )
      }
      return Buffer.from(KNOWN_CONSTANTS.encryptedPassword, 'hex')
    }
    const v = verifyDllConstants(dllBuf)
    if (!v.ok) {
      throw new CipherError(
        `ai_agent.dll 常量族缺项:${v.missing.join(',')} ⇒ 版本算法可能已变更,未判定,需重新取证`,
        'dll-drift',
      )
    }
    const hit = extractEncryptedPassword(dllBuf)
    if (!hit) throw new CipherError('DLL 在位但加密密码锚点提取失败 ⇒ 未判定', 'extract-fail')
    return hit
  })()
  const salt = Buffer.from(saltHex || KNOWN_CONSTANTS.pbkdf2SaltHex, 'hex')
  const tables = KNOWN_CONSTANTS.xorTables.map((s) => Buffer.from(s, 'utf8'))
  const plain = xorDecrypt(enc32, tables)
  return { password: plain, key: deriveEncKey(plain, salt, iterations) }
}

/** HMAC 密钥:PBKDF2-HMAC-SHA512(encKey, salt⊕0x3A, 2, 32) */
export function deriveMacKey(encKey, dbSalt) {
  const macSalt = Buffer.from(dbSalt.length === CIPHER.SALT ? dbSalt : Buffer.alloc(CIPHER.SALT))
  for (let i = 0; i < macSalt.length; i++) macSalt[i] ^= 0x3a
  return crypto.pbkdf2Sync(encKey, macSalt, 2, CIPHER.KEY_LEN, 'sha512')
}

/** 页 HMAC = HMAC-SHA512(macKey, 密文体 + IV + 页号LE32) */
export function pageHmac(macKey, ctBody, iv, pgno) {
  const h = crypto.createHmac('sha512', macKey)
  h.update(ctBody)
  h.update(iv)
  const no = Buffer.alloc(4)
  no.writeUInt32LE(pgno)
  h.update(no)
  return h.digest()
}

/** 单页解密,返回体(页 1 = 4000B,不含 header;其余 4016B);HMAC 先验后解 */
export function decryptPage(encKey, page, pgno, dbSalt) {
  const macKey = deriveMacKey(encKey, dbSalt)
  const iv = page.subarray(CIPHER.PAGE - CIPHER.RESERVE, CIPHER.PAGE - CIPHER.RESERVE + CIPHER.IV)
  const bodyStart = pgno === 1 ? CIPHER.SALT : 0
  const ct = page.subarray(bodyStart, CIPHER.PAGE - CIPHER.RESERVE)
  const stored = page.subarray(CIPHER.PAGE - CIPHER.HMAC)
  const want = pageHmac(macKey, ct, iv, pgno)
  if (!crypto.timingSafeEqual(stored, want)) {
    throw new CipherError(`page ${pgno} HMAC 校验失败 ⇒ 密钥与本库不匹配或页损坏`, 'hmac-page')
  }
  const d = crypto.createDecipheriv('aes-256-cbc', encKey, iv)
  d.setAutoPadding(false)
  return Buffer.concat([d.update(ct), d.final()])
}

/** 单页加密:ptBody 长度必须 = (pgno===1 ? 4000 : 4016);返回含 salt/IV/HMAC 的整页 */
export function encryptPage(encKey, dbSalt, ptBody, pgno, ivFactory = () => crypto.randomBytes(CIPHER.IV)) {
  const expect = pgno === 1 ? CIPHER.PAGE - CIPHER.RESERVE - CIPHER.SALT : CIPHER.PAGE - CIPHER.RESERVE
  if (ptBody.length !== expect) throw new CipherError(`pgno ${pgno} 体长 ${ptBody.length} != ${expect}`, 'bad-body')
  const macKey = deriveMacKey(encKey, dbSalt)
  const iv = ivFactory()
  if (iv.length !== CIPHER.IV) throw new CipherError('IV 必须 16 字节', 'bad-iv')
  if (iv.equals(Buffer.alloc(CIPHER.IV))) iv.writeUInt32LE(1, 12) // 防全零 IV
  const c = crypto.createCipheriv('aes-256-cbc', encKey, iv)
  c.setAutoPadding(false)
  const ct = Buffer.concat([c.update(ptBody), c.final()])
  const page = Buffer.alloc(CIPHER.PAGE)
  if (pgno === 1) {
    dbSalt.copy(page, 0)
    ct.copy(page, CIPHER.SALT)
  } else {
    ct.copy(page, 0)
  }
  iv.copy(page, CIPHER.PAGE - CIPHER.RESERVE)
  pageHmac(macKey, ct, iv, pgno).copy(page, CIPHER.PAGE - CIPHER.HMAC)
  return page
}

/**
 * 整库解密:输入 database.db(建议先由上层合并 WAL),输出可直接被 SQLite 打开的 Buffer。
 * 逐页 HMAC 前置校验;任何一页不过 ⇒ 抛错点名页号,绝不产出半解密库。
 */
export function decryptDatabase(encKey, dbBuf) {
  if (dbBuf.length === 0 || dbBuf.length % CIPHER.PAGE !== 0) {
    throw new CipherError(`库长 ${dbBuf.length} 不是页长倍数或为空`, 'bad-size')
  }
  const dbSalt = dbBuf.subarray(0, CIPHER.SALT)
  const n = dbBuf.length / CIPHER.PAGE
  const out = Buffer.alloc(dbBuf.length)
  for (let i = 0; i < n; i++) {
    const off = i * CIPHER.PAGE
    const body = decryptPage(encKey, dbBuf.subarray(off, off + CIPHER.PAGE), i + 1, dbSalt)
    if (i === 0) {
      SQLITE_HEADER.copy(out, off)
      body.copy(out, off + 16)
    } else {
      body.copy(out, off)
    }
    // 页尾未用区(reserve 视口内)保持零 = SQLite 合法形态
    // 注:此处不设 usable 形态闸 —— header 字段偏移曾在取证中误读(多份库读数互斥),
    // "能否被引擎接受"的最终裁决权交给真实客户端验收与 HMAC 全页校验,不做半成品判据。
  }
  return out
}

/** 整库加密回 SQLCipher:与 decryptDatabase 严格互逆(页尾未用区不承载内容,归零) */
export function encryptDatabase(encKey, plainBuf, dbSalt = crypto.randomBytes(CIPHER.SALT)) {
  if (plainBuf.length === 0 || (plainBuf.length % CIPHER.PAGE !== 0 && plainBuf.length >= CIPHER.PAGE)) {
    throw new CipherError(`明文库长 ${plainBuf.length} 不是页长倍数或为空`, 'bad-size')
  }
  const n = Math.max(1, Math.ceil(plainBuf.length / CIPHER.PAGE))
  const out = Buffer.alloc(n * CIPHER.PAGE)
  for (let i = 0; i < n; i++) {
    const off = i * CIPHER.PAGE
    const slice = plainBuf.subarray(off, Math.min(off + CIPHER.PAGE, plainBuf.length))
    const full = Buffer.alloc(CIPHER.PAGE)
    slice.copy(full)
    if (i === 0) {
      if (!full.subarray(0, 16).equals(SQLITE_HEADER)) {
        throw new CipherError('页 1 缺 SQLite header,拒绝加密', 'bad-header')
      }
      encryptPage(encKey, dbSalt, full.subarray(16, CIPHER.PAGE - CIPHER.RESERVE), 1).copy(out, off)
    } else {
      encryptPage(encKey, dbSalt, full.subarray(0, CIPHER.PAGE - CIPHER.RESERVE), i + 1).copy(out, off)
    }
  }
  return out
}

/**
 * 往返自证:明文(页长倍数口径)→ 加密 → 解密,逐字节一致才 ok=true。
 * 比对口径 = 加密侧本不保留的页尾未用区两侧都取零(内容区全比)。
 */
export function roundtripSelfCheck(encKey, plainBuf) {
  const enc = encryptDatabase(encKey, plainBuf)
  const back = decryptDatabase(encKey, enc)
  const slots = Math.max(1, Math.ceil(plainBuf.length / CIPHER.PAGE)) * CIPHER.PAGE
  const a = Buffer.alloc(slots)
  plainBuf.copy(a)
  for (let i = 0; i < slots; i += CIPHER.PAGE) {
    const contentEnd = i + (CIPHER.PAGE - CIPHER.RESERVE)
    a.fill(0, contentEnd, i + CIPHER.PAGE)
  }
  if (a.compare(back) !== 0) {
    for (let i = 0; i < slots; i++) {
      if (a[i] !== back[i]) return { ok: false, atPage: Math.floor(i / CIPHER.PAGE) + 1, atByte: i }
    }
    return { ok: false, atPage: 0, atByte: -1 }
  }
  return { ok: true }
}

/** 读库头部取证:报告 salt/页数/给定密钥能否过 page1 HMAC(不产出内容) */
export function probe(encKey, dbBuf) {
  const dbSalt = dbBuf.subarray(0, CIPHER.SALT)
  try {
    decryptPage(encKey, dbBuf.subarray(0, CIPHER.PAGE), 1, dbSalt)
    return { pages: dbBuf.length / CIPHER.PAGE, salt: dbSalt.toString('hex'), keyMatches: true }
  } catch {
    return { pages: dbBuf.length / CIPHER.PAGE, salt: dbSalt.toString('hex'), keyMatches: false }
  }
}

export const __test__ = {
  CIPHER,
  KNOWN_CONSTANTS,
  SQLITE_HEADER,
  xorDecrypt,
  deriveEncKey,
  deriveGlobalKey,
  deriveMacKey,
  pageHmac,
  decryptPage,
  encryptPage,
  decryptDatabase,
  encryptDatabase,
  roundtripSelfCheck,
  probe,
  verifyDllConstants,
  extractEncryptedPassword,
  CipherError,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
