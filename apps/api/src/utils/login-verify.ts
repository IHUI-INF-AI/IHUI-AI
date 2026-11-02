// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 登录口令校验的**等代价**外壳(2026-11-01 从 utils/password-crypto.ts 拆出)。
 *
 * 为什么单开一个文件,而不是留在口令模块里:
 * 本仓有 6 份测试用 `vi.mock('.../password-crypto.js', () => ({hashPassword, verifyPassword}))`
 * **整片替换**那个模块(只 spread 原模块的那两份不受影响)。把 `verifyLoginPassword` 放在里面,
 * 就等于给这 6 份替身各埋一颗雷 —— 替身里没有这个名字,调用点拿到 `undefined`,一按登录就是 500。
 * 实测:`tests/success-paths.test.ts` 三条登录用例正是这样翻红的(现读 `expected 500 to be 200`)。
 * 放在这里之后:整片替换式 mock 拦不到它,而它内部调用的 `verifyPassword` 仍是被 mock 的那一枚,
 * 于是"替身只管自己的替身、新增导出不炸别人"同时成立。
 *
 * 判据本体仍在 utils/password-crypto.ts(哈希算法、恒定时间比较、bcrypt 兼容与升级判定),
 * 本文件只做"账号不存在也要付一次等参数真实校验"这一层编排,不复制任何哈希规则(§0.6)。
 */

import { hashPassword, verifyPassword } from './password-crypto.js'
import { randomBytes } from 'node:crypto'

/**
 * 现算一枚真实 argon2id 哈希,专给"账号根本不存在"那条分支消耗等量时间。
 *
 * 立因:登录路径原先在查不到用户时**直接返回**,连 `verifyPassword` 都不走 —— 于是这条分支
 * 比"用户存在但密码错"快几十到几百毫秒(argon2id 是按参数刻意做慢的),攻击者不必看响应内容,
 * 掐表就能列账号(CWE-204;消息统一只堵住了最容易的一条道)。
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
 * 登录用的口令校验 —— 存在与否都要付一次等代价。
 *
 * @param user 查到的主体(可为 undefined/null = 账号不存在)
 * @param password 提交上来的口令
 * @param verify **测试缝**:默认走口令模块的真实校验。存在性证明只能靠"这次到底调没调
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
