// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * DB-07 镜像测试：apply-all 执行器的“默认安全”判据（全部纯函数，不连库）。
 *
 * 钉五件事：
 *  ① 目标 DSN 必须来自显式 env，绝不回落到硬编码 localhost；
 *  ② 非 localhost 目标必须显式 `--allow-remote`；
 *  ③ 无 ON CONFLICT / WHERE / NOT EXISTS 保护的 INSERT/UPDATE/DELETE 默认拒绝；
 *  ④ 执行顺序按 journal.when，而不是文件名 ASCII 序；
 *  ⑤ 顶部横幅必须明示“该脚本不写 drizzle 账本”。
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  NON_LEDGER_BANNER,
  detectNonIdempotentDml,
  orderMigrationsByWhen,
  resolveTargets,
} from '../../packages/database/scripts/lib/apply-all-safety.mjs'

describe('DB-07 目标 DSN 安全', () => {
  it('没有显式 env DSN ⇒ 拒绝，不回落到硬编码 localhost', () => {
    const r = resolveTargets({ env: {} })
    assert.equal(r.ok, false)
    assert.match(r.why, /DATABASE_URL|显式/)
    assert.doesNotMatch(String(r.why), /postgres:postgres@localhost/)
  })

  it('非 localhost 目标未给 --allow-remote ⇒ 拒绝', () => {
    const r = resolveTargets({
      env: { APPLY_ALL_DATABASE_URLS: 'postgresql://u:p@db.prod.example:5432/ihui' },
    })
    assert.equal(r.ok, false)
    assert.match(r.why, /allow-remote/)
  })

  it('非 localhost + --allow-remote ⇒ 放行；localhost 无需确认', () => {
    const remote = resolveTargets({
      env: { APPLY_ALL_DATABASE_URLS: 'postgresql://u:p@db.prod.example:5432/ihui' },
      allowRemote: true,
    })
    assert.equal(remote.ok, true)
    assert.equal(remote.targets.length, 1)
    const local = resolveTargets({
      env: {
        APPLY_ALL_DATABASE_URLS:
          'postgresql://postgres:postgres@localhost:5432/ihui, postgresql://postgres:postgres@127.0.0.1:5432/ihui_test',
      },
    })
    assert.equal(local.ok, true)
    assert.equal(local.targets.length, 2)
  })

  it('非法 URL / 非 postgres 协议 ⇒ 拒绝并点名', () => {
    assert.equal(resolveTargets({ env: { DATABASE_URL: 'not-a-url' } }).ok, false)
    assert.equal(resolveTargets({ env: { DATABASE_URL: 'mysql://u:p@localhost/db' } }).ok, false)
  })
})

describe('DB-07 非幂等 DML 检测', () => {
  it('裸 INSERT / 无 WHERE 的 UPDATE / DELETE 全部点名', () => {
    const got = detectNonIdempotentDml([
      'INSERT INTO t (a) VALUES (1);',
      'UPDATE t SET a = 1;',
      'DELETE FROM t;',
    ])
    assert.equal(got.length, 3)
    assert.deepEqual(
      got.map((x) => x.kind),
      ['insert', 'update', 'delete'],
    )
  })

  it('ON CONFLICT / WHERE / NOT EXISTS 保护视为幂等', () => {
    const got = detectNonIdempotentDml([
      'INSERT INTO t (a) VALUES (1) ON CONFLICT DO NOTHING;',
      'UPDATE t SET a = 1 WHERE id = 1;',
      'DELETE FROM t WHERE id = 1;',
      'INSERT INTO t SELECT 1 WHERE NOT EXISTS (SELECT 1 FROM t WHERE id = 1);',
    ])
    assert.equal(got.length, 0)
  })

  it('注释/字符串里的关键字不误判', () => {
    const got = detectNonIdempotentDml([
      '-- INSERT INTO t VALUES (1)\nCREATE TABLE t2 (id int);',
      "COMMENT ON TABLE t IS 'DELETE FROM t';",
    ])
    assert.equal(got.length, 0)
  })
})

describe('DB-07 迁移排序', () => {
  it('按 journal.when 排序，而不是文件名', () => {
    const files = ['0002_b.sql', '0001_a.sql']
    const journal = {
      entries: [
        { tag: '0001_a', when: 2000 },
        { tag: '0002_b', when: 1000 },
      ],
    }
    assert.deepEqual(orderMigrationsByWhen(files, journal).ordered, ['0002_b.sql', '0001_a.sql'])
  })

  it('journal 里没有的文件排在末尾并点名（不静默丢）', () => {
    const r = orderMigrationsByWhen(['0001_a.sql', '9999_extra.sql'], {
      entries: [{ tag: '0001_a', when: 1 }],
    })
    assert.equal(typeof r, 'object')
    assert.deepEqual(r.ordered, ['0001_a.sql', '9999_extra.sql'])
    assert.deepEqual(r.unknown, ['9999_extra.sql'])
  })
})

describe('DB-07 无账本警告', () => {
  it('横幅明示“不写 drizzle 账本，仅用于 dev/test”', () => {
    assert.match(NON_LEDGER_BANNER, /不写/)
    assert.match(NON_LEDGER_BANNER, /账本/)
    assert.match(NON_LEDGER_BANNER, /dev\/test/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
