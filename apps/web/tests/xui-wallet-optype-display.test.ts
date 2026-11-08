// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// XUI-086: 钱包流水 opType 的文案/正负号/颜色必须按服务端写入点（权威枚举）渲染，
// 未知值不得静默显示成「充值」。
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { resolveWalletFlowMeta } from '../lib/wallet-flow-meta'

const WEB_ROOT = process.cwd()
const REPO_ROOT = join(WEB_ROOT, '..', '..')
const LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko']

describe('XUI-086 钱包流水 opType 展示（文案 + 符号 + 颜色）', () => {
  it('0 充值：正号、绿色', () => {
    const meta = resolveWalletFlowMeta(0, 100)
    expect(meta).toMatchObject({ labelKey: 'flowRecharge', sign: 'positive' })
    expect(meta.colorClass).toContain('emerald')
  })

  it('1 扣减(提现)：负号、红色（此前被错当充值）', () => {
    const meta = resolveWalletFlowMeta(1, 100)
    expect(meta).toMatchObject({ labelKey: 'flowDeduct', sign: 'negative' })
    expect(meta.colorClass).toContain('red')
  })

  it('2 过期清零 / 3 退款扣回 / 4 Relay 转账：均为负号、红色', () => {
    for (const opType of [2, 3, 4]) {
      const meta = resolveWalletFlowMeta(opType, 100)
      expect(meta.sign).toBe('negative')
      expect(meta.colorClass).toContain('red')
    }
    expect(resolveWalletFlowMeta(2, 100).labelKey).toBe('flowExpire')
    expect(resolveWalletFlowMeta(3, 100).labelKey).toBe('flowRefund')
    expect(resolveWalletFlowMeta(4, 100).labelKey).toBe('flowRelayRecharge')
  })

  it('5 管理员调整：按数量符号决定正负', () => {
    expect(resolveWalletFlowMeta(5, 100)).toMatchObject({
      labelKey: 'flowAdminAdjust',
      sign: 'positive',
    })
    expect(resolveWalletFlowMeta(5, -100)).toMatchObject({
      labelKey: 'flowAdminAdjust',
      sign: 'negative',
    })
  })

  it('6 配额 / 未知值：中性灰、文案「其他变动」，绝不显示成充值', () => {
    for (const opType of [6, 99, -1]) {
      const meta = resolveWalletFlowMeta(opType, 500000)
      expect(meta.labelKey).toBe('flowOther')
      expect(meta.sign).toBe('neutral')
      expect(meta.colorClass).toBe('text-muted-foreground')
    }
  })

  it('schema 枚举与写入点一致（3=退款扣回，4=Relay 转账），不写「4=佣金」', () => {
    const schema = readFileSync(
      join(REPO_ROOT, 'packages', 'database', 'src', 'schema', 'wallet.ts'),
      'utf8',
    )
    expect(schema).toContain('3=退款扣回')
    expect(schema).toContain('4=Relay')
    expect(schema).not.toContain('4=佣金')
  })

  it('钱包页改用统一映射，不再保留错位硬编码', () => {
    const page = readFileSync(join(WEB_ROOT, 'app', '(main)', 'wallet', 'page.tsx'), 'utf8')
    expect(page).toContain('resolveWalletFlowMeta')
    expect(page).not.toMatch(/it\.opType === 1 \|\| it\.opType === 4/)
    expect(page).not.toMatch(/OP_TYPE_KEY:/)
  })

  it('五个语言包都有新增文案键', () => {
    for (const locale of LOCALES) {
      const json = JSON.parse(
        readFileSync(join(REPO_ROOT, 'packages', 'i18n', 'messages', 'web', `${locale}.json`), 'utf8'),
      ) as { wallet?: Record<string, string> }
      for (const key of ['flowRefund', 'flowRelayRecharge', 'flowAdminAdjust', 'flowOther']) {
        expect(json.wallet?.[key], `${locale}.${key}`).toBeTruthy()
      }
    }
  })
})
