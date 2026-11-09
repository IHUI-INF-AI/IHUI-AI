// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-216 回归锁(2026-11-08,apps/api P1 越权组)。
 *
 * 旧判据 = 「SQL 文本任意位置出现 owner 列名」+「参数数组任意位置出现主体 ID」,
 * 于是 `insert ("user_id","body") values ($1,$2)` 配 `[$1=受害者,$2=自己]`
 * 会被判为"归属自己";`select "user_id" ... where "id" = $1` 也会被放行。
 * 新判据要求 owner 列与主体参数**同位绑定**,并拒绝语句级 OR。
 */
import { describe, it, expect } from 'vitest'
import { hasOwnerPredicate } from '../src/utils/scoped-guard.js'

const ME = '00000000-0000-4000-8000-0000000000aa'
const VICTIM = '00000000-0000-4000-8000-0000000000bb'

describe('F-216 hasOwnerPredicate:归属必须是同位绑定', () => {
  it('冒名 insert(owner=$1 是受害者,自己在 $2)必须拒绝', () => {
    expect(
      hasOwnerPredicate({
        tables: ['projects'],
        kind: 'insert',
        sqlText: 'insert into "projects" ("user_id", "name") values ($1, $2)',
        params: [VICTIM, ME],
        subjectId: ME,
      }),
    ).toBe(false)
  })

  it('本人 insert(owner 同位绑定自己)放行', () => {
    expect(
      hasOwnerPredicate({
        tables: ['projects'],
        kind: 'insert',
        sqlText: 'insert into "projects" ("user_id", "name") values ($1, $2)',
        params: [ME, '自有项目'],
        subjectId: ME,
      }),
    ).toBe(true)
  })

  it('owner 列只出现在 SELECT 列表、WHERE 走其他列 → 拒绝', () => {
    expect(
      hasOwnerPredicate({
        tables: ['projects'],
        kind: 'select',
        sqlText: 'select "projects"."user_id" from "projects" where "projects"."id" = $1',
        params: [ME],
        subjectId: ME,
      }),
    ).toBe(false)
  })

  it('WHERE 里带 OR 短路 → 拒绝', () => {
    expect(
      hasOwnerPredicate({
        tables: ['projects'],
        kind: 'select',
        sqlText: 'select * from "projects" where "projects"."user_id" = $1 or true',
        params: [ME],
        subjectId: ME,
      }),
    ).toBe(false)
  })

  it('owner 等值绑定的是他人 ID → 拒绝', () => {
    expect(
      hasOwnerPredicate({
        tables: ['projects'],
        kind: 'update',
        sqlText: 'update "projects" set "name" = $1 where "projects"."user_id" = $2',
        params: ['x', VICTIM],
        subjectId: ME,
      }),
    ).toBe(false)
  })

  it('owner 等值绑定自己 → 放行', () => {
    expect(
      hasOwnerPredicate({
        tables: ['projects'],
        kind: 'select',
        sqlText: 'select * from "projects" where "projects"."user_id" = $1',
        params: [ME],
        subjectId: ME,
      }),
    ).toBe(true)
  })

  it('users 主键 owner 仍需限定引用且同位绑定', () => {
    expect(
      hasOwnerPredicate({
        tables: ['users'],
        kind: 'select',
        sqlText: 'select "users"."id" from "users" where "users"."id" = $1',
        params: [ME],
        subjectId: ME,
      }),
    ).toBe(true)
    expect(
      hasOwnerPredicate({
        tables: ['users'],
        kind: 'select',
        sqlText: 'select "users"."id" from "users" where "users"."phone" = $1',
        params: [ME],
        subjectId: ME,
      }),
    ).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
