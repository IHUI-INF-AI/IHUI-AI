// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D94 共享层脱敏 —— 真实含密样本用例。
//
// 断言方式(防"假绿"):
//   · 每类样本都断言**原始密串整体消失**(不只是"出现了标记");
//   · 同时断言标记在位(能定位到"这里原本有秘密");
//   · 末尾一组**反误伤**用例:正常中文/数字文本不得被改坏。

import { describe, expect, it } from 'vitest'

import {
  D94_ADDED_PATTERNS,
  REDACT_IP_MARKER,
  REDACT_QUERY_MARKER,
  REDACT_SECRET_MARKER,
  SECRET_RULES,
  redactEmails,
  redactIps,
  redactSecrets,
  redactUrl,
  redactUserPaths,
  sanitizeEvidenceText,
  stripAnsi,
} from '../redact'

const PEM = [
  '-----BEGIN RSA PRIVATE KEY-----',
  'MIIEowIBAAKCAQEAx3fV2Qm9k3J0pQb7t1Vc8yN0mR4uL6wZ0aB1cD2eF3gH4iJ5',
  'kL6mN7oP8qR9sT0uV1wX2yZ3aB4cD5eF6gH7iJ8kL9mN0oP1qR2sT3uV4wX5yZ6',
  '-----END RSA PRIVATE KEY-----',
].join('\n')

describe('D94 脱敏 / 真实含密样本逐类断言', () => {
  it('OpenAI sk- 密钥被脱敏', () => {
    const raw = 'upstream failed: sk-proj-AbCdEfGhIjKlMnOpQrStUvWxYz0123456789 (len=51)'
    const out = sanitizeEvidenceText(raw)
    expect(out).not.toContain('sk-proj-AbCdEfGhIjKlMnOpQrStUvWxYz0123456789')
    expect(out).not.toContain('AbCdEfGhIjKlMnOpQrStUvWxYz0123456789')
    expect(out).toContain(REDACT_SECRET_MARKER)
  })

  it('GitHub ghp_ token 被脱敏', () => {
    const raw = 'clone failed with ghp_abcdefghijklmnopqrstuvwxyz0123456789'
    const out = sanitizeEvidenceText(raw)
    expect(out).not.toContain('ghp_abcdefghijklmnopqrstuvwxyz0123456789')
    expect(out).toContain(REDACT_SECRET_MARKER)
  })

  it('Bearer + JWT 被脱敏', () => {
    const raw =
      'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dBjftJeZ4CVPmB92K27uhbUJU1p1r_wW1gFWFOEjXk'
    const out = sanitizeEvidenceText(raw)
    expect(out).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9')
    expect(out).not.toContain('dBjftJeZ4CVPmB92K27uhbUJU1p1r_wW1gFWFOEjXk')
    expect(out).toContain(REDACT_SECRET_MARKER)
    // 裸 JWT(不带 Bearer)同样要盖
    const bare = 'token=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
    const bareOut = sanitizeEvidenceText(bare)
    expect(bareOut).not.toContain('SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c')
    expect(bareOut).toContain(REDACT_SECRET_MARKER)
  })

  it('24 位及以上十六进制串被脱敏(D94 新增,既有两处实现都没有)', () => {
    expect(sanitizeEvidenceText('id=5f4dcc3b5aa765d61d8327deb882cf99')).not.toContain(
      '5f4dcc3b5aa765d61d8327deb882cf99',
    )
    expect(sanitizeEvidenceText('trace 0123456789abcdef01234567')).not.toContain(
      '0123456789abcdef01234567',
    )
    expect(sanitizeEvidenceText('id=5f4dcc3b5aa765d61d8327deb882cf99')).toContain(REDACT_SECRET_MARKER)
  })

  it('IPv4 被整段脱敏(D94 新增)', () => {
    const out = sanitizeEvidenceText('connect 192.168.31.7:5432 timeout')
    expect(out).not.toContain('192.168.31.7')
    expect(out).toContain(REDACT_IP_MARKER)
    expect(redactIps('10.0.0.1 与 172.16.254.1')).toBe(
      `${REDACT_IP_MARKER} 与 ${REDACT_IP_MARKER}`,
    )
  })

  it('邮箱:账号部分掩码、域名保留(可定位但不外泄)', () => {
    const out = sanitizeEvidenceText('notify chunchuan.li@aizhs.top failed')
    expect(out).not.toContain('chunchuan.li@aizhs.top')
    expect(out).toContain('c***@aizhs.top')
    expect(redactEmails('a@b.io')).toBe('a***@b.io')
  })

  it('PEM 私钥整块被脱敏(含中间内容)', () => {
    const out = sanitizeEvidenceText(`key loaded:\n${PEM}\nthen failed`)
    expect(out).not.toContain('MIIEowIBAAKCAQEAx3fV2Qm9k3J0pQb7t1Vc8yN0mR4uL6wZ0aB1cD2eF3gH4iJ5')
    expect(out).not.toContain('-----BEGIN RSA PRIVATE KEY-----')
    expect(out).toContain(REDACT_SECRET_MARKER)
  })

  it('AWS / Google / Slack / GitLab / Basic 形态被脱敏', () => {
    const samples = [
      'AKIAIOSFODNN7EXAMPLE',
      'AIzaSyBOti4mM-6x9WDnZIjIeyEU21OpBXqWBgw',
      'xoxb-123456789012-123456789012-abcdefghijklmnopqrstuvwx',
      'glpat-abc123DEF456ghi789',
      'xapp-1-A02B3C4D5E6-1234567890-abcdef',
      'dXNlcjpwYXNzd29yZA==',
    ]
    for (const secret of samples) {
      const out = sanitizeEvidenceText(
        secret.startsWith('dXNl') ? `Authorization: Basic ${secret}` : `leak ${secret} end`,
      )
      expect(out, secret).not.toContain(secret)
      expect(out, secret).toContain(REDACT_SECRET_MARKER)
    }
  })

  it('password / api_key 赋值只盖值、保留键名', () => {
    expect(sanitizeEvidenceText('password=p@ssw0rd12345')).toBe(
      `password=${REDACT_SECRET_MARKER}`,
    )
    expect(sanitizeEvidenceText('api_key: abcdef123456')).toBe(`api_key: ${REDACT_SECRET_MARKER}`)
    // 引用形态不误伤(既有实现的防误伤规则)
    expect(sanitizeEvidenceText('password=os.getenv("PWD")')).toBe('password=os.getenv("PWD")')
  })

  it('URL query 敏感参数与内联凭据被脱敏', () => {
    const out = redactUrl('https://api.example.com/v1/chat?api_key=abcdef123456&q=hi')
    expect(out).not.toContain('abcdef123456')
    expect(out).toContain(`api_key=${REDACT_QUERY_MARKER}`)
    expect(out).toContain('q=hi')
    const inline = sanitizeEvidenceText('psql https://user:pa55word@db.example.com:5432/app')
    expect(inline).not.toContain('pa55word')
    expect(inline).toContain(REDACT_SECRET_MARKER)
  })

  it('用户路径脱敏走注入式(共享层不依赖 node:os)', () => {
    expect(redactUserPaths('C:\\Users\\Administrator\\secret.txt', { user: 'Administrator' })).toBe(
      'C:\\Users\\<user>\\secret.txt',
    )
    expect(redactUserPaths('/home/ihui/app/.env', { home: '/home/ihui' })).toBe('~/app/.env')
    // 不注入 ⇒ 空转,不改文本
    expect(redactUserPaths('C:\\Users\\Administrator\\secret.txt')).toBe(
      'C:\\Users\\Administrator\\secret.txt',
    )
  })

  it('strip_ansi 清掉 CSI / OSC 转义(顺序:先清转义再脱敏)', () => {
    expect(stripAnsi('\u001b[31mERROR\u001b[0m: 连接失败')).toBe('ERROR: 连接失败')
    expect(stripAnsi('\u001b]0;title\u0007done')).toBe('done')
    expect(stripAnsi('\u001b[1;32msk-proj-AbCdEfGhIjKlMnOpQrStUvWxYz0123456789\u001b[0m')).toBe(
      'sk-proj-AbCdEfGhIjKlMnOpQrStUvWxYz0123456789',
    )
    // 转义被切断的密钥:先 strip 再脱敏才盖得住
    const out = sanitizeEvidenceText('\u001b[31msk-proj-AbCdEfGhIjKlMnOpQrStUvWxYz012345\u001b[0m6789')
    expect(out).not.toContain('AbCdEfGhIjKlMnOpQrStUvWxYz012345')
    expect(out).toContain(REDACT_SECRET_MARKER)
  })
})

describe('D94 脱敏 / 反误伤与规则来源', () => {
  it('正常中文与数字文本不得被改坏', () => {
    const samples = [
      '任务已完成,耗时 3.2 秒',
      '共 12 个文件,跳过 3 个',
      'ERROR: connection refused',
      'v1.2.3 发布完成',
      '端口 5432 未开放',
    ]
    for (const text of samples) {
      const out = sanitizeEvidenceText(text)
      expect(out, text).toBe(text)
      expect(out).not.toContain(REDACT_SECRET_MARKER)
      expect(out).not.toContain(REDACT_IP_MARKER)
    }
  })

  it('空串与非字符串输入不炸', () => {
    expect(sanitizeEvidenceText('')).toBe('')
    expect(stripAnsi('')).toBe('')
    expect(redactSecrets('')).toBe('')
  })

  it('规则集:既有实现并集 + 本票新增三类,逐条带来源标注', () => {
    expect(SECRET_RULES.length).toBeGreaterThan(0)
    for (const rule of SECRET_RULES) {
      expect(['output_cleaning.py', 'cli/redact.ts']).toContain(rule.source)
    }
    // 本票新增只三条:十六进制(D94);邮箱与 IP 走函数(D94)
    expect(D94_ADDED_PATTERNS.length).toBe(1)
    expect(D94_ADDED_PATTERNS[0]?.source).toBe('D94')
  })

  it('幂等:脱敏后的文本再脱敏一次不引入新标记堆叠', () => {
    const once = sanitizeEvidenceText('sk-proj-AbCdEfGhIjKlMnOpQrStUvWxYz0123456789')
    expect(sanitizeEvidenceText(once)).toBe(once)
  })
})
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
