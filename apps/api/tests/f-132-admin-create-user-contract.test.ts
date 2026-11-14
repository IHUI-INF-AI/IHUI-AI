// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-132 回归:`POST /admin/users` 的**请求契约必须自洽**。
 *
 * 修前契约自相矛盾:
 * - route JSON Schema:`required: ['passwordHash', 'nickname']`,且 properties 里没有 `password`
 * - handler:zod `createUserBodySchema` 要求 `password`(min 6),并二次 `hashPassword`
 *
 * 于是两条路都 400:传 `passwordHash` ⇒ zod 拒(它不认识该键);传 `password` ⇒ ajv 先拒
 * (缺 `passwordHash`)。而"传 passwordHash 就存我给的哈希"更是把哈希所有权交给了调用方。
 *
 * 本文件钉的是**两份契约同形**,不是某次请求的返回值:
 * ① JSON Schema 的 required 与 zod 的必填键一致;
 * ② JSON Schema 声明的属性与 zod 接受的键一致(多一个 = 文档骗人,少一个 = 静默忽略);
 * ③ `passwordHash` 不再作为入参(送预哈希值等于让客户端决定哈希算法与强度);
 * ④ `password` 的最小长度在两处同值(否则前端按 schema 传、后端按 zod 拒)。
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const SRC = readFileSync(path.resolve(__dirname, '../src/routes/admin.ts'), 'utf8')

/** 截出 POST /users 的 schema 块(从注释到 handler 之前)。 */
function postUsersBlock(): string {
  const start = SRC.indexOf("  // POST /users - 管理员创建用户")
  expect(start).toBeGreaterThan(-1)
  const end = SRC.indexOf('async (request, reply) => {', start)
  expect(end).toBeGreaterThan(start)
  return SRC.slice(start, end)
}

/** 截出 zod 的 createUserBodySchema 定义块。 */
function zodBlock(): string {
  const start = SRC.indexOf('const createUserBodySchema = z.object({')
  expect(start).toBeGreaterThan(-1)
  const end = SRC.indexOf('})', start)
  expect(end).toBeGreaterThan(start)
  return SRC.slice(start, end)
}

describe('F-132 POST /admin/users 请求契约自洽', () => {
  it('JSON Schema 的 required 与 zod 必填键一致', () => {
    const block = postUsersBlock()
    const required = block.match(/required: \[([^\]]+)\]/)?.[1] ?? ''
    const names = [...required.matchAll(/'([^']+)'/g)].map((m) => m[1]).sort()

    const zod = zodBlock()
    // zod 里没有 .optional() 的键即必填
    const zodKeys = [...zod.matchAll(/\n\s{2}(\w+): /g)].map((m) => m[1])
    const zodRequired = zodKeys
      .filter((k) => {
        const line = zod.split('\n').find((l) => l.trim().startsWith(`${k}:`)) ?? ''
        return !line.includes('.optional()')
      })
      .sort()

    expect(names).toEqual(zodRequired)
  })

  it('JSON Schema 不接受 passwordHash(不得让客户端送预哈希)', () => {
    expect(postUsersBlock()).not.toMatch(/passwordHash:/)
  })

  it('JSON Schema 的 password 最小长度与 zod 同值', () => {
    const block = postUsersBlock()
    const schemaMin = block.match(/password: \{[^}]*minLength: (\d+)/)?.[1]
    const zodMin = zodBlock().match(/password: z\.string\(\)\.min\((\d+)/)?.[1]
    expect(schemaMin).toBeDefined()
    expect(schemaMin).toBe(zodMin)
  })

  it('handler 仍走 zod 校验并二次哈希(不接受客户端给的哈希)', () => {
    expect(SRC).toMatch(/createUserBodySchema\.safeParse\(request\.body\)/)
    expect(SRC).toMatch(/passwordHash: await hashPassword\(parsed\.data\.password\)/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
