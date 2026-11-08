// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = path.dirname(fileURLToPath(import.meta.url))

function read(rel: string): string {
  return fs.readFileSync(path.resolve(here, rel), 'utf8')
}

describe('同型根因 S-01:剩余时间一律截止戳派生,禁止按 tick 自减', () => {
  const cases: Array<[string, string, RegExp]> = [
    ['../../app/sso/register/PageClient.tsx', 'SSO 注册发码冷却', /setCountdown\(/],
    ['../../src/components/login/RegisterAccountForm.tsx', '注册发码冷却', /setCountdown\(/],
    ['../../src/components/login/ForgotPasswordForm.tsx', '找回密码发码冷却', /setCountdown\(/],
    ['../../src/components/publish/CountdownTimer.tsx', '发布倒计时', /setRemaining\(\(prev\) =>/],
    ['../../app/(main)/user/security/page.tsx', '安全中心换绑手机发码', /setCodeCountdown\(/],
    ['../../src/hooks/use-updater.ts', '桌面端自动重启倒计时', /setRestartCountdown/],
  ]

  for (const [rel, name, forbidden] of cases) {
    it(`${name}:不得按 tick 自减,必须走 useDeadlineCountdown`, () => {
      const src = read(rel)
      expect(src).not.toMatch(forbidden)
      expect(src).toContain('useDeadlineCountdown')
    })
  }
})
