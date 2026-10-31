// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 安全强化第 10 批 R10 —— 第二批回归锁（越权 / 2FA 单源 / 手机号改写）。
 *
 * 第三轮侦察（业务越权面 + 认证会话面）新发现，全部为"任意登录用户即可"级别：
 *
 *  R10-5【P0 造币】`PUT /cozeZhsApi/agents/token/balance/:userUuid` 只有插件级 checkAuth，
 *        任意登录用户 PUT 自己 uuid + `balance: 1e9` 即凭空造币；该余额正是直播礼物
 *        扣款源 ⇒ 等价于无上限白嫖并转移价值。
 *
 *  R10-6【P0 无限额度】`POST /api-key-groups` 接受客户端自报 `sharedTokenBalance/-1`，
 *        计费侧把 `-1 && -1` 判为"无限直接放行"；`/recharge` 又是纯加数字不扣任何
 *        资金来源 ⇒ 任意用户建组→充值→无限免费调用中转站。
 *
 *  R10-7【P0 改他人结算】`PUT /settlement/:id` 无归属/管理员校验，可改任意结算单的
 *        commissionRate/commissionAmount/status（同文件 `/settlement/settle` 已有闸）。
 *
 *  R10-8【P1 2FA 旁路】2FA 分支被逐路手抄，6 条登录支路（平台回调 / 短信登录 /
 *        企微扫码 / 钉钉扫码 / 小程序 ×2）漏了 ⇒ IdP 会话或短信码失窃即完全绕过 TOTP。
 *
 *  R10-9【P1 持久化接管】`POST /auth/bind-user` 无验证码改手机号 ⇒ 改绑到攻击者号码后
 *        密码重置与短信登录全部改道，受害者改密码也踢不掉。
 *
 * 判据纪律：本文件只做「接线是否还在 + 单源是否唯一」的结构断言，不复制任何业务判据
 * （AGENTS.md §0.6）。2FA 覆盖用"逐调用点向上找闸"的形态判据，避免漏数。
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = new URL('../../../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const read = (...rel: string[]) => readFileSync(resolve(ROOT, ...rel), 'utf8')

/** 取某个路由注册点之后的一小段源码（用于断言该路由的 options 里带了什么）。 */
function routeBlock(src: string, marker: string, span = 700): string {
  const at = src.indexOf(marker)
  expect(at, `找不到路由 ${marker}（被删或改名，需同步本测试）`).toBeGreaterThan(-1)
  return src.slice(at, at + span)
}

// ---------------------------------------------------------------------------
// R10-5 余额改写必须 admin
// ---------------------------------------------------------------------------
describe('R10-5 平台币余额改写仅管理员', () => {
  const src = read('apps', 'api', 'src', 'routes', 'agents.ts')

  it('PUT 余额路由带 requireAdmin（造币面不得对普通用户开放）', () => {
    const block = routeBlock(src, "'/cozeZhsApi/agents/token/balance/:userUuid'", 400)
    expect(block).toContain('preHandler: requireAdmin')
  })

  it('GET 余额路由有归属闸（读自己恒允许，读他人仅管理员）', () => {
    const block = routeBlock(src, "'/token/balance/:userUuid'", 900)
    expect(block).toContain('request.userId')
    expect(block).toContain('isSystemAdmin')
    expect(block).toContain('403')
  })

  it('admin 判据取自单源 require-permission（不得自己比 roleId 字面量）', () => {
    expect(src).toContain("from '../plugins/require-permission.js'")
    // 余额路由段内不得出现裸 roleId 比较
    const block = routeBlock(src, "'/cozeZhsApi/agents/token/balance/:userUuid'", 700)
    expect(block).not.toMatch(/roleId\s*[<>]=?/)
  })
})

// ---------------------------------------------------------------------------
// R10-7 结算单读写必须 admin
// ---------------------------------------------------------------------------
describe('R10-7 结算单读写仅管理员', () => {
  const src = read('apps', 'api', 'src', 'routes', 'agents.ts')

  it('GET /settlement/:id 带 requireAdmin', () => {
    expect(routeBlock(src, "server.get('/settlement/:id'", 300)).toContain(
      'preHandler: requireAdmin',
    )
  })

  it('PUT /settlement/:id 带 requireAdmin（不可逆资金动作）', () => {
    expect(routeBlock(src, "server.put('/settlement/:id'", 300)).toContain(
      'preHandler: requireAdmin',
    )
  })

  it('与 POST /settlement/settle 同一判据（三处一致，不得留旁路）', () => {
    expect(routeBlock(src, "server.post('/settlement/settle'", 300)).toContain(
      'preHandler: requireAdmin',
    )
  })
})

// ---------------------------------------------------------------------------
// R10-6 API Key 组池：余额不可自报、充值 admin-only、负数拒绝
// ---------------------------------------------------------------------------
describe('R10-6 组池余额不可由客户端自报', () => {
  const src = read('apps', 'api', 'src', 'routes', 'developer', 'api-key-groups.ts')

  it('建组 schema 不再含余额字段（-1 无限额度后门）', () => {
    const at = src.indexOf('const createGroupBodySchema')
    expect(at).toBeGreaterThan(-1)
    const block = src.slice(at, src.indexOf('const updateGroupBodySchema'))
    // 只判"字段声明形态"（`sharedTokenBalance:` 带冒号），注释里提到该名字不算
    expect(block).not.toMatch(/^\s*sharedTokenBalance\s*:/m)
    expect(block).not.toMatch(/^\s*sharedCostBalanceCents\s*:/m)
  })

  it('改组 schema 也不再含余额字段', () => {
    const at = src.indexOf('const updateGroupBodySchema')
    const block = src.slice(at, src.indexOf('const rechargeBodySchema'))
    expect(block).not.toMatch(/^\s*sharedTokenBalance\s*:/m)
    expect(block).not.toMatch(/^\s*sharedCostBalanceCents\s*:/m)
  })

  it('PATCH 路由不再把余额写进 update set', () => {
    const block = routeBlock(src, "server.patch('/api-key-groups/:id'", 2600)
    expect(block).not.toContain('sharedTokenBalance:')
    expect(block).not.toContain('sharedCostBalanceCents:')
  })

  it('建组服务调用硬编码 0 起步（防后来者顺手接回 d.sharedTokenBalance）', () => {
    const at = src.indexOf('await createGroup({')
    expect(at).toBeGreaterThan(-1)
    const block = src.slice(at, at + 600)
    expect(block).toContain('sharedTokenBalance: 0')
    expect(block).toContain('sharedCostBalanceCents: 0')
    expect(block).not.toContain('d.sharedTokenBalance')
  })

  it('充值路由 admin-only（纯加数字、无资金来源校验）', () => {
    expect(routeBlock(src, "'/api-key-groups/:id/recharge'", 500)).toContain(
      'preHandler: requireAdmin',
    )
  })

  it('充值 schema 拒绝负数与 0（-1 是计费侧的无限额度哨兵）', () => {
    const at = src.indexOf('const rechargeBodySchema')
    expect(at).toBeGreaterThan(-1)
    const block = src.slice(at, at + 700)
    expect(block).toContain('.min(1)')
    expect(block).toContain('.max(')
  })
})

// ---------------------------------------------------------------------------
// R10-8 2FA 单源闸：每个发 token 的登录支路都必须过
// ---------------------------------------------------------------------------
describe('R10-8 2FA 单源闸覆盖所有登录支路', () => {
  const src = read('apps', 'api', 'src', 'routes', 'auth-extended.ts')

  it('单源函数存在且导出（供其他 auth 文件复用）', () => {
    expect(src).toContain('export async function twoFactorLoginGate(')
    expect(src).toContain('request.skipResponseSanitization = true')
    expect(src).toContain('challengeToken')
  })

  it('逐调用点结构锁：每个 buildTokenPair 之前都有 2FA 闸或机器豁免标记', () => {
    const lines = src.split('\n')
    /** 机器令牌：`// @token-issue-exempt: <理由>` 必须紧贴调用点（向上 3 行内）。 */
    const EXEMPT = '@token-issue-exempt:'
    const offenders: string[] = []

    lines.forEach((line, idx) => {
      if (!line.includes('buildTokenPair(')) return
      // 豁免标记：本行或向上 3 行（调用点可能是多行形式）
      const near = lines.slice(Math.max(0, idx - 3), idx + 1).join('\n')
      if (near.includes(EXEMPT)) return
      // 向上 60 行找闸（单源函数或既有 twoFactorEnabled 分支）
      const up = lines.slice(Math.max(0, idx - 60), idx).join('\n')
      if (up.includes('twoFactorLoginGate(') || up.includes('twoFactorEnabled')) return
      offenders.push(`line ${idx + 1}: ${line.trim()}`)
    })

    expect(offenders, `以下发 token 点缺 2FA 闸且无豁免标记:\n${offenders.join('\n')}`).toEqual([])
  })

  it('豁免标记必须带理由（空标记 = 无声跳门，§0.10 禁令）', () => {
    const marks = src.split('\n').filter((l) => l.includes('@token-issue-exempt:'))
    expect(marks.length).toBeGreaterThan(0)
    for (const m of marks) {
      const reason = m.split('@token-issue-exempt:')[1]?.trim() ?? ''
      expect(reason.length, `豁免标记缺理由: ${m.trim()}`).toBeGreaterThan(8)
    }
  })

  it('闸必须在 buildTokenPair 之前（顺序反了等于没闸）', () => {
    const lines = src.split('\n')
    lines.forEach((line, idx) => {
      if (!line.includes('const twoFactorReply = await twoFactorLoginGate(')) return
      // 同一 handler 内：闸行之后 60 行内应有 buildTokenPair
      const down = lines.slice(idx, idx + 60).join('\n')
      expect(down, `line ${idx + 1} 的闸后面没有发 token（接线错位）`).toContain('buildTokenPair(')
    })
  })

  it('闸不得自己手抄 TOTP 判定（判据只能有一份）', () => {
    const at = src.indexOf('export async function twoFactorLoginGate(')
    const block = src.slice(at, at + 1200)
    // 只允许读 user.twoFactorEnabled 这一个布尔，不得出现 TOTP 校验/密钥解密
    expect(block).not.toContain('verifyTotp')
    expect(block).not.toContain('decryptTwoFactorSecret')
    expect(block).not.toContain('backupCode')
  })
})

// ---------------------------------------------------------------------------
// R10-9 bind-user 不得改手机号
// ---------------------------------------------------------------------------
describe('R10-9 /auth/bind-user 不得改写手机号', () => {
  const src = read('apps', 'api', 'src', 'routes', 'auth-extended.ts')

  it('handler 内不存在 updateData.phone = body.phone（非注释形态）', () => {
    const codeLines = src
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => !l.startsWith('//') && !l.startsWith('*') && !l.startsWith('/*'))
    expect(codeLines.join('\n')).not.toContain('updateData.phone = body.phone')
  })

  it('传 phone 时显式拒绝并指向正规换绑端点', () => {
    const at = src.indexOf("'/auth/bind-user'")
    expect(at).toBeGreaterThan(-1)
    const block = src.slice(at, at + 2500)
    expect(block).toContain('/auth/change-phone/confirm')
    expect(block).toContain('400')
  })

  it('正规换绑端点仍要求短信验证码 + 号码占用预检（不许被"顺手简化"）', () => {
    const at = src.indexOf("'/auth/change-phone/confirm'")
    expect(at).toBeGreaterThan(-1)
    const block = src.slice(at, at + 1600)
    expect(block).toContain('verifyCode')
    expect(block).toContain('findUserByPhone')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
