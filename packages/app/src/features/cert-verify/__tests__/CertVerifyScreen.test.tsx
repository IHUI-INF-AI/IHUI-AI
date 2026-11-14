// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

import { CertVerifyScreen } from '../CertVerifyScreen'
import type { CertVerifyResult } from '@ihui/types'

afterEach(cleanup)

/**
 * 证书验证屏的两处契约放宽：
 * `issuer` 缺省时不得出现来源行；`certNo` 缺省时不得出现证书编号行（阴性对照）。
 */
const t = (key: string): string => key

const baseResult: CertVerifyResult = {
  valid: true,
  title: '示例证书',
  holder: '张三',
  issuedAt: '2026-01-02',
}

function renderScreen(result: CertVerifyResult | null) {
  return render(
    <CertVerifyScreen
      t={t}
      initialCertNo=""
      result={result}
      loading={false}
      error=""
      onVerify={vi.fn()}
      onBack={vi.fn()}
    />,
  )
}

describe('CertVerifyScreen 可选展示位', () => {
  it('不传 issuer 时不出现来源行', () => {
    renderScreen(baseResult)
    expect(screen.queryByText(/certVerify\.issuer/)).toBeNull()
  })

  it('不传 certNo 时不出现证书编号行', () => {
    renderScreen(baseResult)
    expect(screen.queryByText(/certVerify\.certNo:/)).toBeNull()
  })

  it('传 issuer 时出现来源行，传 certNo 时出现编号行', () => {
    renderScreen({ ...baseResult, issuer: 'IHUI AI', certNo: 'IHUI-2026-0001' })
    expect(screen.getByText(/certVerify\.issuer/)).toBeTruthy()
    expect(screen.getByText(/certVerify\.certNo:/)).toBeTruthy()
    expect(screen.getByText(/IHUI-2026-0001/)).toBeTruthy()
  })
})
