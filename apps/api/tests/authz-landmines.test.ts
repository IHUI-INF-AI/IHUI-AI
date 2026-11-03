// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 鉴权地雷接线锁(2026-11-01 安全强化)。
 *
 * 两枚都是"今天不是活敞口、但结构上会咬人"的形态,所以锁的是**形状 + 单源**,
 * 而不是跑一遍 HTTP(organization.ts 现读未进生产注册表,跑 HTTP 反而证明不了什么):
 *  1. routes/organization.ts 的按 id 改/删与成员列表原先只有 authenticate,
 *     没有任何归属/角色判据 ⇒ 一旦被注册,任何登录账号可毁他人组织。
 *     默认拒绝网只拦"完全没有主体"的请求,抓不到"调了 authenticate 但不判归属"的写法 ——
 *     这正是它作为陷阱的地方。
 *  2. payment-usdt 的 webhook secret 原先是字符串 `!==` 比较(时序可见),
 *     仓内已有单源 `secretsEqual`(定长散列 + timingSafeEqual,csrf/agent-control 都在用)。
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const orgSrc = readFileSync('src/routes/organization.ts', 'utf-8')
const usdtSrc = readFileSync('src/routes/payment-usdt.ts', 'utf-8')

/**
 * 形状锁一律判**代码行**,不判散文。
 * 本轮已三次踩同一格:注释里引用被禁写法(为了说明"原先是什么样")会被整文件 grep
 * 当成回潮。散文里引用旧写法是交代,不是缺陷;判据如果把交代也拦下,下一手必然是
 * 有人为了过门把交代删掉 —— 那才是真损失。
 */
function codeLines(src: string): string {
  return src
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .join('\n')
}

describe('organization.ts 归属型写面必须带闸', () => {
  const mutating = [
    ...orgSrc.matchAll(/server\.(put|delete|patch)\(\s*'([^']+)'\s*,?/g),
  ].map((m) => ({ verb: m[1], path: m[2], at: m.index ?? 0 }))

  it('枚举到枚数不为 0(枚举到 0 个候选判死,不冒绿)', () => {
    expect(mutating.length).toBeGreaterThanOrEqual(3)
  })

  it.each(mutating.map((m) => [m.verb, m.path, m.at] as const))(
    '%s %s 的注册处带 preHandler 闸',
    (_verb, _path, at) => {
      const window = orgSrc.slice(at, at + 220)
      expect(window, `${_verb} ${_path} 的注册段里没有 preHandler`).toContain('preHandler')
    },
  )

  it('成员列表(含 email/phone 的读面)同样收口', () => {
    const at = orgSrc.indexOf("server.get('/organizations/:id/members'")
    expect(at).toBeGreaterThan(-1)
    expect(orgSrc.slice(at, at + 220)).toContain('preHandler')
  })

  it('判据不抄第二份:角色闸走 require-permission 的单一出口', () => {
    expect(orgSrc).toContain("import { requireAdmin } from '../plugins/require-permission.js'")
  })
})

describe('USDT webhook 验签走单源的常数时间比较', () => {
  it('不再用字符串 !== 比 secret', () => {
    expect(codeLines(usdtSrc)).not.toMatch(/providedSecret\s*!==\s*WEBHOOK_SECRET/)
  })

  it('用 secretsEqual,且未配置 secret 时仍然 fail-closed', () => {
    expect(usdtSrc).toContain('secretsEqual(providedSecret, WEBHOOK_SECRET)')
    expect(usdtSrc).toContain('!WEBHOOK_SECRET ||')
    expect(usdtSrc).toContain("import { secretsEqual } from '../plugins/internal-service-token.js'")
  })

  it('不在本文件里另造一份比较器(§0.6)', () => {
    expect(usdtSrc).not.toMatch(/function secretsEqual|const secretsEqual\s*=/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
