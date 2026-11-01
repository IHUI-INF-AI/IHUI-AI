// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 国安级密码哈希工具(argon2id + bcrypt 兼容)。
 *
 * 设计目标:
 * - 新密码用 argon2id(抗 GPU/ASIC 攻击,OWASP 2023 推荐)
 * - 老密码用 bcrypt(通过前缀 $2a$/$2b$ 识别),登录成功后自动升级到 argon2id
 * - 平滑迁移:无需强制重置密码,登录时透明升级
 *
 * argon2id 参数(OWASP 2023 推荐):
 * - type: argon2id(混合抗侧信道 + 抗 GPU)
 * - memoryCost: 19456 KiB(19 MB,OWASP 最小值)
 * - timeCost: 2(迭代次数)
 * - parallelism: 1(单线程,防 DoS)
 *
 * 安全保证:
 * - argon2id 自带 salt(每用户独立,无需全局 salt)
 * - 恒定时间比较(argon2.verify 内部实现)
 * - 哈希输出含算法参数,可未来平滑升级到更强算法
 */
import { randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { hash as argon2Hash, verify as argon2Verify, Algorithm } from '@node-rs/argon2'

/**
 * argon2 实现选型(2026-07-31 立,Windows 兼容性修复)。
 *
 * 问题:原 argon2@0.45.1 的 win32-x64 预编译文件打包错误(放了 Linux glibc 版本),
 * 在 Windows 上 require('argon2') 触发 0xC0000005 进程崩溃(try/catch 无法捕获),
 * 导致 api 完全无法启动,admin(argon2id 哈希)无法登录。
 *
 * 修复:改用 @node-rs/argon2(Rust 实现的 napi-rs 绑定,预编译文件覆盖
 * win32-x64/linux-x64/darwin-arm64 等全平台,Windows 可靠)。
 * 安全保证不变:argon2id 算法、OWASP 推荐参数、恒定时间比较。
 */

/** argon2id 参数(OWASP 2023 推荐,国安级标准) */
const ARGON2ID_OPTIONS = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19456, // 19 MB(OWASP 最小值,抗 GPU)
  timeCost: 2, // 2 次迭代
  parallelism: 1, // 单线程(防 DoS)
} as const

/** 哈希算法版本(用于未来升级到更强算法时识别) */
export const HASH_VERSION = 2 // 1=bcrypt, 2=argon2id

/** bcrypt 哈希前缀(用于识别老密码) */
const BCRYPT_PREFIX_RE = /^\$2[abxy]\$/

/**
 * 判断哈希是否为 bcrypt(老密码)。
 * argon2id 哈希以 $argon2id$ 开头,bcrypt 以 $2a$/$2b$ 开头。
 */
export function isBcryptHash(hash: string): boolean {
  return BCRYPT_PREFIX_RE.test(hash)
}

/**
 * 判断哈希是否为 argon2id(新密码)。
 */
export function isArgon2Hash(hash: string): boolean {
  return hash.startsWith('$argon2id$')
}

/**
 * 哈希密码(新密码用 argon2id)。
 *
 * 用于:
 * - 用户注册
 * - 密码重置
 * - 密码修改
 */
export async function hashPassword(password: string): Promise<string> {
  // 国安级:argon2id 替代 bcrypt(抗 GPU/ASIC 攻击)
  // @node-rs/argon2 全平台可用(含 Windows),无需降级
  return argon2Hash(password, ARGON2ID_OPTIONS)
}

/**
 * 给"账号根本不存在"这条分支用的占位哈希(2026-11-01 防用户枚举)。
 *
 * 登录路径原先在查不到用户时**直接返回**,连 `verifyPassword` 都不走 —— 于是这条分支
 * 比"用户存在但密码错"快几十到几百毫秒(argon2id 是按参数刻意做慢的),攻击者不必看
 * 响应内容,掐表就能列账号(CWE-204;消息统一只堵住了最容易的一条道)。
 * 现在两个面都要付出一次**等参数**的真实校验,所以这里现算一枚 argon2id 哈希。
 *
 * 惰性 + 进程内缓存:启动期不做口令推导(冷启动路径上不引入额外耗时),
 * 第一次用到时算一次,后续复用。密码是随机串且不外泄 —— 它的唯一用途就是被验不过。
 */
let dummyHashPromise: Promise<string> | null = null

export function dummyVerifyHash(): Promise<string> {
  if (dummyHashPromise === null) {
    dummyHashPromise = hashPassword(`absent-account-${randomBytes(16).toString('hex')}`)
  }
  return dummyHashPromise
}

/**
 * 验证密码(兼容 bcrypt + argon2id)。
 *
 * 用于:
 * - 用户登录
 * - 修改密码时校验旧密码
 *
 * 自动升级:如果哈希是 bcrypt(老密码),验证成功后调用 shouldUpgradeHash 判断是否需要升级。
 * 调用方应在登录成功后调用 upgradeHashIfNeeded 完成透明迁移。
 *
 * 恒定时间比较:argon2.verify 和 bcrypt.compare 都是恒定时间(抗时序攻击)。
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    if (isArgon2Hash(hash)) {
      // 新密码:argon2id 验证(@node-rs/argon2 verify 接受 string,参数顺序 hash 在前)
      return await argon2Verify(hash, password)
    }
    if (isBcryptHash(hash)) {
      // 老密码:bcrypt 验证(兼容)
      return await bcrypt.compare(password, hash)
    }
    // 未知格式:SHA256 无盐?(member.ts 可能)或其他 — 用 bcrypt.compare 兜底
    return await bcrypt.compare(password, hash)
  } catch {
    // 任何异常都返回 false(防 oracle 攻击)
    return false
  }
}

/**
 * 登录口令校验的"等代价 + 等形状"出口(2026-11-01 防账号枚举,CWE-204)。
 *
 * 未认证登录端点原先的写法是 `if (!user || !user.passwordHash) → 短返回`,或
 * `if (!user || !user.passwordHash || !(await verifyPassword(...)))` —— 两种都会在
 * "这个账号不存在"时**跳过 argon2id 校验**。而 argon2id 是按参数刻意做慢的,
 * 于是同一份提交在两种情况下耗时差几十到几百毫秒:攻击者不必读响应,掐表就能列账号
 * (文案早在 2026-07-24 就统一过,但耗时这条道一直没堵)。
 *
 * 所以:主体不存在时也必须付一次**等参数**的真实校验;两种 false(没这个人 / 密码不对)
 * 在本层合成同一个答案,调用方只需一条失败出口,不许再按"人存不存在"分叉。
 *
 * @param user 查到的主体(可为 undefined/null = 账号不存在)
 * @param password 提交上来的口令
 * @param verify **测试缝**:默认走本模块的真实校验。存在性证明只能靠"这次到底调没调
 *   argon2" —— 而模块内部直调本模块函数是拦不住的,所以留这一个可注入位;
 *   三个登录调用点**都不传**,生产路径恒为真实校验。
 * @returns 主体存在且口令匹配才 true
 */
export async function verifyLoginPassword(
  user: { passwordHash?: string | null } | null | undefined,
  password: string,
  verify: (password: string, hash: string) => Promise<boolean> = verifyPassword,
): Promise<boolean> {
  const storedHash = user?.passwordHash || (await dummyVerifyHash())
  const matches = await verify(password, storedHash)
  return user ? matches : false
}

/**
 * 判断密码哈希是否需要升级到 argon2id。
 * - bcrypt 哈希 → 需要升级
 * - argon2id 哈希 → 不需要升级
 */
export function shouldUpgradeHash(hash: string): boolean {
  return isBcryptHash(hash) || !isArgon2Hash(hash)
}

/**
 * 透明升级密码哈希(登录成功后调用)。
 *
 * 如果哈希是 bcrypt(老密码),用 argon2id 重新哈希并返回新哈希。
 * 调用方应将新哈希存入 DB,完成平滑迁移。
 *
 * 如果已经是 argon2id,返回 null(无需升级)。
 */
export async function upgradeHashIfNeeded(
  password: string,
  currentHash: string,
): Promise<string | null> {
  if (!shouldUpgradeHash(currentHash)) return null
  try {
    return await hashPassword(password)
  } catch {
    // 升级失败不影响登录(下次再试)
    return null
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
