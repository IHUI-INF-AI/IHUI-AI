// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-216(P1) 回归:归属列必须真的绑定到 subjectId,而不是"文本含列名 + 参数含自己 ID"。
 *
 * 旧实现(scoped-guard.ts:588-622)只做 `sqlText.includes('"user_id"')` 且
 * `params.some(p => p === subjectId)`:
 *  - INSERT 把归属列写 $1(实为他人),只要同一语句另一个参数是自己 → 放行;
 *  - `WHERE name = $1 OR user_id = $2`(自己 ID 在 $2) → 放行,OR 分支可绕过;
 *  - UPDATE 只在 SET 里写 `user_id = $1`(自己),WHERE 只按 id 定位 → 放行,可抢他人行;
 *  - `ON CONFLICT DO UPDATE SET user_id = $n` → 放行,upsert 可改归属。
 * 本套件断言以上形态在修复后一律 false,并保留合法 SQL 的 true。
 */
import { describe, it, expect } from 'vitest'
import {
  configureDataScopeGuard,
  hasOwnerPredicate,
  type OwnerPredicateEvidence,
} from '../src/utils/scoped-guard.js'

const SELF = '11111111-1111-4111-8111-111111111111'
const OTHER = '22222222-2222-4222-8222-222222222222'

function evidence(overrides: Partial<OwnerPredicateEvidence>): OwnerPredicateEvidence {
  return {
    subjectId: SELF,
    tables: ['projects'],
    kind: 'select',
    sqlText: '',
    params: [],
    ...overrides,
  }
}

describe('F-216 INSERT/upsert:归属列 value 必须绑定主体', () => {
  it('合法:归属列在列清单,对应 value 是主体参数 → true', () => {
    expect(
      hasOwnerPredicate(
        evidence({
          kind: 'insert',
          sqlText: 'insert into "projects" ("user_id", "name") values ($1, $2)',
          params: [SELF, '合法项目'],
        }),
      ),
    ).toBe(true)
  })

  it('恶意:归属列 $1 是他人,仅"另一个参数"是自己 → false(旧实现会放行)', () => {
    expect(
      hasOwnerPredicate(
        evidence({
          kind: 'insert',
          sqlText: 'insert into "projects" ("user_id", "name") values ($1, $2)',
          params: [OTHER, SELF],
        }),
      ),
    ).toBe(false)
  })

  it('恶意:归属列写成他人字面量 → false', () => {
    expect(
      hasOwnerPredicate(
        evidence({
          kind: 'insert',
          sqlText: `insert into "projects" ("user_id", "name") values ('${OTHER}', $1)`,
          params: [SELF],
        }),
      ),
    ).toBe(false)
  })

  it('恶意:归属列用表达式/函数写入(无法证明等于主体)→ false', () => {
    expect(
      hasOwnerPredicate(
        evidence({
          kind: 'insert',
          sqlText: 'insert into "projects" ("user_id", "name") values (coalesce($1, $2), $3)',
          params: [SELF, OTHER, 'x'],
        }),
      ),
    ).toBe(false)
  })

  it('恶意:列清单缺失归属列(改用默认值/别人值)→ false', () => {
    expect(
      hasOwnerPredicate(
        evidence({
          kind: 'insert',
          sqlText: 'insert into "projects" ("name") values ($1)',
          params: [SELF],
        }),
      ),
    ).toBe(false)
  })

  it('多行插入:任一行归属列不是主体 → false;全部本人 → true', () => {
    const sqlText = 'insert into "projects" ("user_id", "name") values ($1, $2), ($3, $4)'
    expect(
      hasOwnerPredicate(evidence({ kind: 'insert', sqlText, params: [SELF, 'a', OTHER, 'b'] })),
    ).toBe(false)
    expect(
      hasOwnerPredicate(evidence({ kind: 'insert', sqlText, params: [SELF, 'a', SELF, 'b'] })),
    ).toBe(true)
  })

  it('on conflict do update 改归属列 → false;只改业务列 → true', () => {
    const baseSql =
      'insert into "projects" ("user_id", "name") values ($1, $2) on conflict ("id") do update set '
    expect(
      hasOwnerPredicate(
        evidence({
          kind: 'insert',
          sqlText: `${baseSql}"user_id" = $3`,
          params: [SELF, 'a', OTHER],
        }),
      ),
    ).toBe(false)
    expect(
      hasOwnerPredicate(
        evidence({
          kind: 'insert',
          sqlText: `${baseSql}"name" = $3`,
          params: [SELF, 'a', 'b'],
        }),
      ),
    ).toBe(true)
  })
})

describe('F-216 UPDATE/DELETE/SELECT:WHERE 内必须有 owner = 主体', () => {
  it('合法 UPDATE/DELETE/SELECT:owner 列 = $n 且该参数是本人 → true', () => {
    expect(
      hasOwnerPredicate(
        evidence({
          kind: 'update',
          sqlText: 'update "projects" set "name" = $1 where "projects"."user_id" = $2',
          params: ['新名字', SELF],
        }),
      ),
    ).toBe(true)
    expect(
      hasOwnerPredicate(
        evidence({
          kind: 'delete',
          sqlText: 'delete from "projects" where "projects"."user_id" = $1',
          params: [SELF],
        }),
      ),
    ).toBe(true)
    expect(
      hasOwnerPredicate(
        evidence({
          kind: 'select',
          sqlText: 'select * from "projects" where "projects"."user_id" = $1',
          params: [SELF],
        }),
      ),
    ).toBe(true)
  })

  it('语句级 OR 一律拒绝:即使每分支都绑定主体(发件人/收件人)→ false', () => {
    // 本波口径:不上"OR 可证明才放行"的解析器,语句级出现 or 即拒绝。
    // 该接线若确需 OR,应在路由侧拆成两条查询或改走显式 scope 声明。
    configureDataScopeGuard({ ownerColumnByTable: { messages: 'receiver_id' } })
    expect(
      hasOwnerPredicate(
        evidence({
          tables: ['messages'],
          kind: 'select',
          sqlText:
            'select * from "messages" where ("messages"."sender_id" = $1 or "messages"."receiver_id" = $2)',
          params: [SELF, SELF],
        }),
      ),
    ).toBe(false)
  })

  it('恶意:OR 谓词即使含"owner = 自己" → false(旧实现会放行)', () => {
    expect(
      hasOwnerPredicate(
        evidence({
          kind: 'select',
          sqlText:
            'select * from "projects" where "projects"."name" = $1 or "projects"."user_id" = $2',
          params: ['x', SELF],
        }),
      ),
    ).toBe(false)
  })

  it('恶意:位运算 or(...)无法证明 → false(fail-closed)', () => {
    expect(
      hasOwnerPredicate(
        evidence({
          kind: 'select',
          sqlText:
            'select * from "projects" where or("projects"."user_id" = $1, "projects"."name" = $2)',
          params: [SELF, 'x'],
        }),
      ),
    ).toBe(false)
  })

  it('仅出现列名/等值不是主体 → false', () => {
    expect(
      hasOwnerPredicate(
        evidence({
          kind: 'select',
          sqlText: 'select "projects"."user_id" from "projects"',
          params: [SELF],
        }),
      ),
    ).toBe(false)
    expect(
      hasOwnerPredicate(
        evidence({
          kind: 'delete',
          sqlText: 'delete from "projects" where "projects"."user_id" = $1',
          params: [OTHER],
        }),
      ),
    ).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
