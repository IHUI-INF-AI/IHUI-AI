// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// XUI-086: 钱包流水 opType 的文案/正负号/颜色必须按服务端写入点（权威枚举）渲染，
// 未知值不得静默显示成「充值」。
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { resolveWalletFlowMeta } from '@ihui/shared/utils/wallet-flow-meta'

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

  it('6 API 配额：配额类变动、非金额、中性灰，绝不显示成充值/支出', () => {
    const meta = resolveWalletFlowMeta(6, 500000)
    expect(meta).toMatchObject({
      labelKey: 'flowQuota',
      sign: 'neutral',
      kind: 'quota',
      isMoney: false,
    })
    expect(meta.colorClass).toBe('text-muted-foreground')
  })

  it('未知值：中性兜底，不默认收入/支出，绝不显示成充值', () => {
    for (const opType of [99, -1, 7]) {
      const meta = resolveWalletFlowMeta(opType, 500000)
      expect(meta).toMatchObject({ labelKey: 'flowOther', sign: 'neutral', kind: 'other' })
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

  it('全仓只有 shared 一张 opType 表：web 旧映射文件已删除', () => {
    expect(existsSync(join(WEB_ROOT, 'lib', 'wallet-flow-meta.ts'))).toBe(false)
    const shared = readFileSync(
      join(REPO_ROOT, 'packages', 'shared', 'src', 'utils', 'wallet-flow-meta.ts'),
      'utf8',
    )
    expect(shared).toContain('export function resolveWalletFlowMeta')
  })

  it('web 钱包页 / 分销页直接接 shared，且不留自己的正负号判断', () => {
    const walletPage = readFileSync(join(WEB_ROOT, 'app', '(main)', 'wallet', 'page.tsx'), 'utf8')
    expect(walletPage).toContain("from '@ihui/shared/utils/wallet-flow-meta'")
    expect(walletPage).toContain('meta.isMoney')
    expect(walletPage).not.toMatch(/it\.opType === 1 \|\| it\.opType === 4/)
    expect(walletPage).not.toMatch(/OP_TYPE_KEY:/)

    const distPage = readFileSync(
      join(WEB_ROOT, 'app', '(main)', 'distribution', 'token', 'page.tsx'),
      'utf8',
    )
    expect(distPage).toContain("from '@ihui/shared/utils/wallet-flow-meta'")
    expect(distPage).not.toMatch(/OP_TYPE_KEY\s*:/)
    expect(distPage).not.toMatch(/it\.opType\s*===/)
    expect(distPage).not.toContain("?? 'flowRecharge'")
  })

  it('RN / 小程序共享屏不再自带第二套映射（核对点在 packages/app）', () => {
    const screen = readFileSync(
      join(REPO_ROOT, 'packages', 'app', 'src', 'features', 'wallet', 'WalletScreen.tsx'),
      'utf8',
    )
    expect(screen).toContain("from '@ihui/shared/utils/wallet-flow-meta'")
    expect(screen).not.toContain('POSITIVE_OP_TYPES')
    expect(screen).not.toMatch(/OP_TYPE_KEY\s*:/)

    const rnHost = readFileSync(
      join(REPO_ROOT, 'apps', 'mobile-rn', 'src', 'screens', 'WalletScreen.tsx'),
      'utf8',
    )
    expect(rnHost).not.toMatch(/opType\s*===\s*\d\s*[?:]/)
    const mini = readFileSync(
      join(REPO_ROOT, 'apps', 'miniapp-taro', 'src', 'pkg-shop', 'wallet', 'index.tsx'),
      'utf8',
    )
    expect(mini).toContain('@rn-shells/WalletScreen')
    expect(mini).not.toMatch(/opType\s*===\s*\d\s*[?:]/)
  })

  it('五个语言包（web + shared）都有 add 文案键，6 有独立配额键', () => {
    for (const locale of LOCALES) {
      const web = JSON.parse(
        readFileSync(join(REPO_ROOT, 'packages', 'i18n', 'messages', 'web', `${locale}.json`), 'utf8'),
      ) as { wallet?: Record<string, string> }
      const shared = JSON.parse(
        readFileSync(
          join(REPO_ROOT, 'packages', 'i18n', 'messages', 'shared', `${locale}.json`),
          'utf8',
        ),
      ) as { wallet?: Record<string, string> }
      for (const key of [
        'flowRecharge',
        'flowDeduct',
        'flowExpire',
        'flowRefund',
        'flowRelayRecharge',
        'flowAdminAdjust',
        'flowQuota',
        'flowOther',
      ]) {
        expect(web.wallet?.[key], `web.${locale}.${key}`).toBeTruthy()
        expect(shared.wallet?.[key], `shared.${locale}.${key}`).toBeTruthy()
      }
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
