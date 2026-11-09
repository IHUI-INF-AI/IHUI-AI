// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * DB-04 / DB-05 / DB-06 回归夹具（纯静态，不连库）：
 *  - 共享 SQL 分割器必须识别命名 dollar-quote、单/双引号、行/块注释；
 *  - 迁移执行策略必须按 SQLSTATE 白名单判跳过，不得按错误消息子串吞错；
 *  - 含 CONCURRENTLY 的迁移必须拒绝走「单文件事务」执行器。
 */
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import { splitSqlStatements, stripSqlComments } from '../scripts/lib/split-sql.mjs'
import {
  shouldSkipStatement,
  describeSkippedObject,
  planMigrationExecution,
} from '../scripts/lib/migration-policy.mjs'

const drizzleDir = fileURLToPath(new URL('../drizzle', import.meta.url))

describe('共享 SQL 分割器（DB-04 / DB-06）', () => {
  it('命名 dollar-quote $con$ 内的分号不被当作语句边界', () => {
    const sql = 'DO $con$ BEGIN PERFORM 1; IF true THEN PERFORM 2; END IF; END $con$;'
    const { statements, semicolonCount, balanced } = splitSqlStatements(sql)
    expect(statements).toHaveLength(1)
    expect(statements[0]).toContain('END $con$')
    expect(semicolonCount).toBe(1)
    expect(balanced).toBe(true)
  })

  it('命名 dollar-quote $fn$ / $outer$ 与匿名 $$ 均正确闭合', () => {
    const sql = [
      'CREATE FUNCTION f() RETURNS void AS $fn$ BEGIN PERFORM 1; END $fn$;',
      'DO $outer$ BEGIN PERFORM 2; PERFORM 3; END $outer$;',
      'DO $$ BEGIN PERFORM 4; END $$;',
    ].join('\n')
    const { statements, semicolonCount, balanced } = splitSqlStatements(sql)
    expect(statements).toHaveLength(3)
    expect(semicolonCount).toBe(3)
    expect(balanced).toBe(true)
  })

  it('块注释内的分号不计入语句边界', () => {
    const sql = '/* 说明; 含分号 */ SELECT 1; SELECT 2;'
    const { statements, semicolonCount, balanced } = splitSqlStatements(sql)
    expect(statements).toHaveLength(2)
    expect(statements[0]).toContain('/* 说明; 含分号 */')
    expect(semicolonCount).toBe(2)
    expect(balanced).toBe(true)
  })

  it('单引号内的分号与转义单引号不切分', () => {
    const sql = "SELECT 'a;b', 'it''s;ok' FROM t; SELECT 2;"
    const { statements, semicolonCount } = splitSqlStatements(sql)
    expect(statements).toHaveLength(2)
    expect(semicolonCount).toBe(2)
  })

  it('双引号标识符内的分号不切分', () => {
    const sql = 'SELECT "a;b" FROM t; SELECT 2;'
    const { statements, semicolonCount } = splitSqlStatements(sql)
    expect(statements).toHaveLength(2)
    expect(semicolonCount).toBe(2)
  })

  it('混合注释：行注释分号 / 块注释内的美元符 / dollar-quote 内的注释符', () => {
    const sql = [
      '-- 行注释里的 ; 不是边界',
      '/* 块注释里的 $con$ 与 ; 都不是边界 */',
      'DO $con$',
      'BEGIN',
      '  -- 函数体内的注释',
      '  PERFORM 1;',
      '  /* 函数体内的块注释; */',
      'END $con$;',
      'SELECT 2;',
    ].join('\n')
    const { statements, semicolonCount, balanced } = splitSqlStatements(sql)
    expect(statements).toHaveLength(2)
    expect(semicolonCount).toBe(2)
    expect(balanced).toBe(true)
  })

  it('未闭合的命名 dollar-quote 必须报 balanced=false', () => {
    const { balanced } = splitSqlStatements('DO $con$ BEGIN PERFORM 1;')
    expect(balanced).toBe(false)
  })

  it('尾部仅注释的片段不产生幽灵语句，且分号数与语句数严格相等', () => {
    const sql = 'SELECT 1;\n-- 尾部版权注释\n/* 尾块注释; */\n'
    const { statements, semicolonCount } = splitSqlStatements(sql)
    expect(statements).toHaveLength(1)
    expect(semicolonCount).toBe(statements.length)
  })

  it('真实迁移 20261002033500_im_messages_platform_msg_unique.sql 不被块注释切碎', () => {
    const sql = readFileSync(
      fileURLToPath(
        new URL('../drizzle/20261002033500_im_messages_platform_msg_unique.sql', import.meta.url),
      ),
      'utf-8',
    )
    const { statements, semicolonCount, balanced } = splitSqlStatements(sql)
    expect(balanced).toBe(true)
    expect(statements).toHaveLength(2)
    expect(semicolonCount).toBe(statements.length)
  })

  it('全部 drizzle 迁移均满足 balanced=true 且 semicolons === statements', () => {
    const files = readdirSync(drizzleDir).filter((f) => /^\d+_.*\.sql$/.test(f))
    const failures: string[] = []
    for (const file of files) {
      const sql = readFileSync(
        fileURLToPath(new URL(`../drizzle/${file}`, import.meta.url)),
        'utf-8',
      )
      const { statements, semicolonCount, balanced } = splitSqlStatements(sql)
      if (!balanced || semicolonCount !== statements.length) {
        failures.push(
          `${file}: balanced=${balanced}, semicolons=${semicolonCount}, statements=${statements.length}`,
        )
      }
    }
    expect(failures).toEqual([])
  })
})

describe('迁移执行策略（DB-05）', () => {
  const pgError = (code: string, extra: Record<string, unknown> = {}) => ({ code, ...extra })

  it('仅对白名单 SQLSTATE 且语句形态匹配时才允许跳过', () => {
    expect(shouldSkipStatement(pgError('42P07'), 'CREATE TABLE t (id int);')).toBe(true)
    expect(shouldSkipStatement(pgError('42710'), 'CREATE UNIQUE INDEX i ON t (id);')).toBe(true)
    expect(shouldSkipStatement(pgError('42701'), 'ALTER TABLE t ADD COLUMN c int;')).toBe(true)
    expect(shouldSkipStatement(pgError('42P01'), 'DROP TABLE IF EXISTS t;')).toBe(true)
    expect(shouldSkipStatement(pgError('42703'), 'ALTER TABLE t DROP COLUMN c;')).toBe(true)
  })

  it('语句形态不匹配时不得跳过（避免吞掉 SELECT/INSERT 的真错误）', () => {
    expect(shouldSkipStatement(pgError('42P01'), 'SELECT * FROM t;')).toBe(false)
    expect(shouldSkipStatement(pgError('42703'), 'SELECT missing FROM t;')).toBe(false)
    expect(shouldSkipStatement(pgError('42P07'), 'INSERT INTO t VALUES (1);')).toBe(false)
  })

  it('没有 SQLSTATE、仅错误消息含 already exists 时不得跳过', () => {
    expect(
      shouldSkipStatement(new Error('relation "t" already exists'), 'CREATE TABLE t ();'),
    ).toBe(false)
  })

  it('打印被跳过对象名', () => {
    expect(describeSkippedObject(pgError('42P07', { table: 't' }), 'CREATE TABLE t ();')).toContain(
      't',
    )
    expect(describeSkippedObject(pgError('42710'), 'CREATE INDEX idx_t ON t (id);')).toContain(
      'idx_t',
    )
    expect(describeSkippedObject(pgError('42701'), 'ALTER TABLE t ADD COLUMN c int;')).toContain(
      'c',
    )
  })

  it('含 CONCURRENTLY 的迁移拒绝走单文件事务执行器', () => {
    expect(() =>
      planMigrationExecution(['CREATE INDEX CONCURRENTLY i ON t (id);'], '20260101_x.sql'),
    ).toThrow(/CONCURRENTLY/)
  })

  it('仅注释里提到 CONCURRENTLY 不算数', () => {
    const statements = ['-- 生产建议用 CONCURRENTLY\nCREATE INDEX i ON t (id);']
    expect(() => planMigrationExecution(statements, '20260101_x.sql')).not.toThrow()
  })

  it('stripSqlComments 保留字符串与 dollar-quote 正文，只去掉注释', () => {
    const sql = "SELECT '--not-comment'; /* ; */ DO $con$ BEGIN PERFORM 1; END $con$; -- tail"
    const stripped = stripSqlComments(sql)
    expect(stripped).toContain("'--not-comment'")
    expect(stripped).toContain('$con$')
    expect(stripped).not.toContain('/* ; */')
    expect(stripped).not.toContain('-- tail')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
