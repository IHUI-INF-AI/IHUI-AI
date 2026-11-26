// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 「让 AI 写 SQL」的守门测试。
 *
 * 这一层的价值不在「能查」，而在「查不坏」：写操作、第二张表、子查询绕过、
 * 注释藏语句、多语句拼接，只要有一条漏过去，这个功能就变成数据库授权入口。
 */

import { describe, expect, it } from 'vitest'

import { formatSqlAnswer, isDestructiveQuestion, stripSqlFences, validateSql } from '../wechat-hub/ask-sql'

const ACCOUNT = '0f9c2a7e-1111-4c22-9d33-abcdefabcdef'

describe('stripSqlFences', () => {
  it('剥掉 Markdown 围栏、分号与前言，只留语句本身', () => {
    const raw = '好的，这是查询：\n```sql\nselect count(*) from m;\n```\n希望对你有帮助'
    expect(stripSqlFences(raw)).toBe('select count(*) from m')
  })
})

describe('validateSql 守门', () => {
  it('正常查询被注入租户 CTE 与行数上限', () => {
    const result = validateSql('select count(*) as cnt from m', ACCOUNT)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.statement).toContain(`WHERE account_id = '${ACCOUNT}'`)
    expect(result.statement).toContain('WITH m AS')
    expect(result.statement.trimEnd().endsWith('LIMIT 50')).toBe(true)
    expect(result.raw).toBe('select count(*) as cnt from m')
  })

  it('写操作、DDL、系统函数一律拒', () => {
    for (const sqlText of [
      "update m set content = 'x'",
      'delete from m',
      'drop table wechat_hub_messages',
      'select pg_sleep(10) from m',
      'select nextval(\'seq\') from m',
      'select * from m into outfile \'/tmp/x\'',
    ]) {
      expect(validateSql(sqlText, ACCOUNT).ok).toBe(false)
    }
  })

  it('多语句、注释、跨表引用都拒', () => {
    expect(validateSql('select 1 from m; select 2 from m', ACCOUNT).ok).toBe(false)
    expect(validateSql('select 1 from m -- 注释里藏东西', ACCOUNT).ok).toBe(false)
    expect(validateSql('select * from users', ACCOUNT).ok).toBe(false)
    expect(validateSql('select * from wechat_hub_messages', ACCOUNT).ok).toBe(false)
    expect(validateSql('select * from (select * from m) x', ACCOUNT).ok).toBe(false)
  })

  it('没有 from m、账号标识不是 UUID 都不执行', () => {
    expect(validateSql('select 1', ACCOUNT).ok).toBe(false)
    expect(validateSql('select count(*) from m', "x' or 1=1")).toEqual({
      ok: false,
      reason: expect.stringContaining('账号标识异常'),
    })
  })

  it(' aggregates 与 with 写法都能过（常见问法不该被误杀）', () => {
    const withQuery =
      'with d as materialized (select * from m) select count(*) from d'
    // 这条引用了 d（子查询别名），按「只允许 m」的规则应当被拒——
    // 误杀比放过好，但要钉住这个行为，避免以后有人悄悄放宽。
    expect(validateSql(withQuery, ACCOUNT).ok).toBe(false)
    expect(
      validateSql('select sender_name, count(*) as n from m group by sender_name order by n desc', ACCOUNT).ok,
    ).toBe(true)
    expect(validateSql('select date_trunc(\'day\', sent_at) as d, count(*) from m', ACCOUNT).ok).toBe(true)
  })
})

describe('formatSqlAnswer', () => {
  it('单行单列直接给值，多行给计数与前 10 行', () => {
    expect(formatSqlAnswer([{ cnt: '12' }], 1)).toBe('结果：12')
    expect(formatSqlAnswer([], 0)).toContain('没有命中')
    const rows = Array.from({ length: 12 }, (_, index) => ({ sender_name: `人${index}` }))
    const text = formatSqlAnswer(rows, 12)
    expect(text).toContain('共 12 行')
    expect(text.split('\n')).toHaveLength(11)
  })
})

describe('isDestructiveQuestion', () => {
  it('认出删除、清空、撤回、修改这类写诉求', () => {
    for (const question of [
      '把最近10条消息删掉',
      '删除这个群的聊天记录',
      '清空上周的语音',
      '帮我把这条撤回',
      '把群名改成项目组',
      '踢出这个成员',
    ]) {
      expect(isDestructiveQuestion(question), question).toBe(true)
    }
  })

  it('纯查询不会被误判', () => {
    for (const question of [
      '最近30天谁发消息最多',
      '这个库最早的一条消息是哪天',
      '语音消息有多少条',
      '上周一共有多少条消息',
    ]) {
      expect(isDestructiveQuestion(question), question).toBe(false)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
