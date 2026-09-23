// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * sqli-guard 判据回归测试。
 *
 * 2026-09-24 起因:旧实现关键字侧是**子串**匹配(`upper.includes('OR')`),
 * 生产实测 POST /api/mail/send 正文含 ASCII 分号 `;` 与 `IHUI-CORE`(内嵌 OR 子串)
 * 即被 400「请求包含不合法字符」。本套用例双向钉死:
 *   A 组 = 真注入载荷必须仍被拦(防"为了不误杀而放软");
 *   B 组 = 普通文案(含 `;` 与 OR/AND/SET/FROM 子串或单词)必须放行。
 */

import { describe, expect, it } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import sqliGuard, { detectSqlInjectionPattern } from '../src/plugins/sqli-guard.js'

/** 生产误杀原文复刻:`;` + `IHUI-CORE`(旧代码必 400)。 */
const PRODUCTION_REPRO_BODY = [
  '尊敬的用户,您好!',
  '您订阅的 IHUI-CORE 套餐已生效;到期时间请在控制台查看。',
  '如需帮助请直接回复本邮件,祝您使用愉快。',
].join('\n')

describe('sqli-guard — A 组:真注入载荷必须判红', () => {
  const payloads: ReadonlyArray<readonly [string, string]> = [
    ["经典布尔绕过 admin' OR 1=1 --", "admin' OR 1=1 --"],
    ["引号内恒真 ' OR '1'='1", "' OR '1'='1"],
    ["无空格变体 1'or''='1", "1'or''='1"],
    ['堆叠语句 ; DROP TABLE', '1; DROP TABLE users--'],
    ['UNION 拖库', "1' UNION SELECT password FROM users--"],
    ['UNION ALL + NULL 列', "-1' UNION ALL SELECT NULL,NULL,NULL--"],
    ['注释混淆 union/**/select', "' UNION/**/SELECT token FROM oauth_tokens--"],
    ['时间盲注 sleep()', '1; sleep(10)'],
    ['时间盲注 BENCHMARK()', '1; BENCHMARK(5000000,MD5(1))'],
    ['MSSQL WAITFOR DELAY', "'; WAITFOR DELAY '0:0:5'--"],
    ['AND 二次布尔', "admin' AND 1=2 --"],
    ['布尔 + 注释收尾 or 1 --', "' or 1 --"],
    ['子查询取系统目录', "1' AND (SELECT * FROM information_schema.tables)--"],
    ['insert into 堆叠', "'; INSERT INTO admin_users VALUES('x','y')--"],
    ['delete from 拖库', "1'; DELETE FROM sessions WHERE 1=1--"],
    ['update set 篡改', "x'; UPDATE users SET role='admin' WHERE id=1--"],
    ['select @@version 指纹', "' UNION SELECT @@version--"],
    ['存储过程 xp_cmdshell', "'; EXEC master..xp_cmdshell 'dir'--"],
    ['MySQL 写文件', "' UNION SELECT '<?php eval($_GET[1])?>' INTO OUTFILE '/tmp/x.php'--"],
    ['大小写混排 oR 1=1', "admin' oR 1=1 #"],
  ]

  it.each(payloads)('%s', (_label, payload) => {
    expect(detectSqlInjectionPattern(payload)).toBe(true)
  })
})

describe('sqli-guard — B 组:正常文案必须放行', () => {
  const samples: ReadonlyArray<readonly [string, string]> = [
    ['生产误杀原文(;+IHUI-CORE)', PRODUCTION_REPRO_BODY],
    ['品牌词 BRAND', '感谢使用 IHUI; 你的 brand 风格已同步到控制台。'],
    ['Android 含 AND 子串', '客户端已适配 Android 15;请更新到最新版本。'],
    [
      'restore / settings 含 OR·SET',
      '请前往设置页 restore your password; from the team 已为你准备指引。',
    ],
    ['公式 formula 含 OR', '计价公式已更新;IHUI-CORE 会员享折扣。'],
    ['command 含 AND', 'The command completed; exit code is 0.'],
    ['select…from 文案', 'Please select your plan from the list; then confirm it.'],
    ['delete from the list 文案', 'Please delete from the list; keep the top item.'],
    [
      'insert into your inbox 文案',
      'The coupon will insert into your inbox shortly; no action needed.',
    ],
    ['drop by 普通动词', 'Feel free to drop by the office; we are open at 9.'],
    ['裸 sleep 无括号', 'I need more sleep; the schedule is brutal.'],
    ['and + 词 + 无比较符', 'Set your password; and verify your email address.'],
    ['create user accounts 文案', ' admins can create user accounts; invite your teammate.'],
    ['纯中文分号句', '系统维护已完成;数据已恢复,请勿重复提交。'],
    ['URL 编码串(旧实现同样不解码)', 'path?id=%27%20OR%201%3D1%20--&x=1'],
    ['全角标点(旧实现同样不认全角)', '查询语句:ｓｅｌｅｃｔ　ｆｒｏｍ；测试'],
  ]

  it.each(samples)('%s', (_label, text) => {
    expect(detectSqlInjectionPattern(text)).toBe(false)
  })
})

describe('sqli-guard — 字符门未放宽(与旧实现逐字符一致)', () => {
  it('没有引号/分号的真载荷仍不进关键字侧(旧实现同结果,覆盖面未缩)', () => {
    expect(detectSqlInjectionPattern('1 OR 1=1')).toBe(false)
    expect(detectSqlInjectionPattern('admin or 1=1')).toBe(false)
  })

  it('单引号 / 双引号 / 分号各自都能过字符门', () => {
    expect(detectSqlInjectionPattern("' or 1=1")).toBe(true)
    expect(detectSqlInjectionPattern('" or 1=1')).toBe(true)
    expect(detectSqlInjectionPattern('1; or 1=1')).toBe(true)
  })

  it('空串与非字符串入参不炸', () => {
    expect(detectSqlInjectionPattern('')).toBe(false)
    expect(detectSqlInjectionPattern('hello world')).toBe(false)
  })
})

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify()
  await app.register(sqliGuard)
  app.post('/api/probe', () => ({ code: 0, message: 'ok', data: null }))
  app.post('/api/ai/chat', () => ({ code: 0, message: 'ok', data: null }))
  await app.ready()
  return app
}

describe('sqli-guard — preHandler 真面行为', () => {
  it('正文含 ; 与 IHUI-CORE(生产误杀原文)→ 200', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/probe',
      payload: {
        to: '502319984@qq.com',
        subject: '【核验信】套餐已生效',
        content: PRODUCTION_REPRO_BODY,
      },
    })
    await app.close()
    expect(res.statusCode).toBe(200)
  })

  it("正文含 ' OR 1=1 -- → 400 + 通用消息", async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/probe',
      payload: { content: "admin' OR 1=1 --" },
    })
    await app.close()
    expect(res.statusCode).toBe(400)
    expect(res.json()).toEqual({ code: 400, message: '请求包含不合法字符' })
  })

  it('query 侧同样检测 → 400', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/probe?kw=1%3B%20DROP%20TABLE%20users--',
      payload: { content: 'ok' },
    })
    await app.close()
    expect(res.statusCode).toBe(400)
  })

  it('AI 端点仍走强特征:分号堆叠语句 → 400', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/ai/chat',
      payload: { prompt: 'x; SELECT * FROM users' },
    })
    await app.close()
    expect(res.statusCode).toBe(400)
  })

  it('AI 端点不误杀 Markdown 表格行(既有 2026-08-06 修复不回退)', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/ai/chat',
      payload: { prompt: '| 层级 | 说明 |\n| --- | --- |\n请解释;架构怎么优化' },
    })
    await app.close()
    expect(res.statusCode).toBe(200)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
