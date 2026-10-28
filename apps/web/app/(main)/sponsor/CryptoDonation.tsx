// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { Bitcoin, Copy, Check, QrCode } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Tooltip } from '@/components/feedback'
import { Button, Card } from '@ihui/ui-react'
import { fetchApi } from '@/lib/api'

/**
 * G-944 fail-closed:USDT 收款方式的可用性以服务端 env 为权威。
 * 权威值未配置(或形态非法)⇒ GET /api/payment/usdt/public-config 回 available=false
 * ⇒ 本页隐藏该卡片,避免"平台没配 TRC20 收款地址、页面却引导用户往该链打款"。
 * 查询失败(网络/服务不可用)按"未知"处理,维持展示 —— 拒的是"明确未配置",
 * 不是"问不出答案";下单侧仍由 createUsdtPayment 的「未配置 500」兜底拒单。
 */
const USDT_WALLET_NETWORK: Record<string, 'TRC20' | 'ERC20'> = {
  usdtTrc20: 'TRC20',
  usdtErc20: 'ERC20',
}

// Public donation addresses (safe to commit — these can only receive funds).
// Private keys live in .ihui-agent/tmp/crypto-wallets/wallet-secrets.json (gitignored).
const WALLETS = [
  {
    id: 'bitcoin',
    icon: Bitcoin,
    emoji: '₿',
    address: 'bc1q3q4ffds36kmmz7x8q0ynuvh70hmfaf08sh3e0y',
    explorer: 'https://blockchain.com/btc/address/',
    recommended: false,
  },
  {
    id: 'ethereum',
    icon: null,
    emoji: 'Ξ',
    address: '0x66e0101c41aed519b309faead5d3778091a8ab09',
    explorer: 'https://etherscan.io/address/',
    recommended: false,
  },
  {
    id: 'usdtTrc20',
    icon: null,
    emoji: '₮',
    // 权威值在 env USDT_TRC20_ADDRESS(2026-10-06 机主拍板:取本页已上线的收款地址);
    // 本行只是投影,待公开配置端点化后改为从接口读取。锁:apps/api/tests/sponsor-usdt-address-source.test.ts
    address: 'TMtTpPEMduWurHLi6Fe8XjfcP5Y5AMMnbG',
    explorer: 'https://tronscan.org/#/address/',
    recommended: true,
  },
  {
    id: 'usdtErc20',
    icon: null,
    emoji: '₮',
    // 权威值在 env USDT_ERC20_ADDRESS(0x26e359a5…79dd),2026-10-06 与 env 对齐;待后续公开配置端点化后改为从接口读取。锁:apps/api/tests/sponsor-usdt-address-source.test.ts
    address: '0x26e359a5c69cf903d8709a286f5fd2d7554579dd',
    explorer: 'https://etherscan.io/address/',
    recommended: false,
  },
] as const

function useCopyAddress() {
  const [copiedId, setCopiedId] = React.useState<string | null>(null)
  const copy = React.useCallback(async (id: string, address: string) => {
    try {
      await navigator.clipboard.writeText(address)
      setCopiedId(id)
      window.setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 1800)
    } catch {
      // clipboard may be unavailable (insecure context); fall back to select+execCommand
      const ta = document.createElement('textarea')
      ta.value = address
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      try {
        document.execCommand('copy')
        setCopiedId(id)
        window.setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 1800)
      } finally {
        document.body.removeChild(ta)
      }
    }
  }, [])
  return { copiedId, copy }
}

export function CryptoDonation(): React.JSX.Element {
  const t = useTranslations('crypto')
  const { copiedId, copy } = useCopyAddress()

  // null = 尚未问到答案(未知 ⇒ 全展示);否则为「明确未配置」的钱包 id 集合
  const [unconfiguredIds, setUnconfiguredIds] = React.useState<Set<string> | null>(null)
  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      const res = await fetchApi<{
        networks: Record<'TRC20' | 'ERC20', { available: boolean }>
      }>('/api/payment/usdt/public-config')
      if (cancelled) return
      if (!res.success || !res.data?.networks) return // 未知:维持展示
      const hidden = new Set<string>()
      for (const [walletId, network] of Object.entries(USDT_WALLET_NETWORK)) {
        if (res.data.networks[network]?.available !== true) hidden.add(walletId)
      }
      setUnconfiguredIds(hidden)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const visibleWallets = unconfiguredIds
    ? WALLETS.filter((w) => !unconfiguredIds.has(w.id))
    : WALLETS

  return (
    <section className="mt-16">
      <div className="text-center">
        <h2 className="text-xl font-bold tracking-tight min-[768px]:text-2xl">{t('title')}</h2>
        <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground min-[768px]:text-base">
          {t('subtitle')}
        </p>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 min-[640px]:grid-cols-2">
        {visibleWallets.map((w) => {
          const Icon = w.icon
          const copied = copiedId === w.id
          return (
            <Card
              key={w.id}
              className={`flex flex-col p-3 ${w.recommended ? 'border-brand-accent-deep' : ''}`}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-base font-semibold text-primary">
                  {Icon ? <Icon className="h-4 w-4" /> : <span aria-hidden>{w.emoji}</span>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold">{t(`${w.id}.name`)}</h3>
                    {w.recommended && (
                      <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                        {t('usdtTrc20.recommended').split(':')[0]}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{t(`${w.id}.network`)}</p>
                </div>
              </div>

              <div className="mt-4 flex items-stretch gap-3">
                <Tooltip content={t('qrCode')}>
                  <a
                    href={`${w.explorer}${w.address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-lg border bg-muted/40 text-muted-foreground transition-colors hover:bg-muted"
                    aria-label={t('qrCode')}
                  >
                    <QrCode className="h-6 w-6" />
                    <span className="mt-1 text-[10px]">{t('qrCode')}</span>
                  </a>
                </Tooltip>
                <div className="flex min-w-0 flex-1 flex-col justify-between">
                  <Tooltip content={w.address}>
                    <code className="block break-all text-xs leading-relaxed text-foreground">
                      {w.address}
                    </code>
                  </Tooltip>
                  <Button
                    type="button"
                    size="sm"
                    variant={copied ? 'default' : 'outline'}
                    className="mt-2 w-full"
                    onClick={() => copy(w.id, w.address)}
                  >
                    {copied ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        <span>{t('copied')}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>{t('copyButton')}</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      <p className="mx-auto mt-6 max-w-2xl text-center text-xs leading-relaxed text-muted-foreground">
        {t('disclaimer')}
      </p>
    </section>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
