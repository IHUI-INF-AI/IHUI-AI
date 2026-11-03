// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { RN_UI_ROUTES } from '../src/constants/ui-routes.generated'
import { navigateAfterVipPay } from '../src/navigation/vip-pay-exit'

const route = (name: string) => RN_UI_ROUTES.find((r) => r.name === name)

describe('nav-B 路由契约', () => {
  it('ExamDetail 已注册且必填 id', () => {
    expect(route('ExamDetail')).toMatchObject({ tab: false, requiresParams: true, requiredParams: ['id'] })
  })

  it('VipUpgrade 已注册且必填 id(与 VipLevel 同一壳)', () => {
    expect(route('VipUpgrade')).toMatchObject({ tab: false, requiresParams: true, requiredParams: ['id'] })
    expect(route('VipLevel')).toMatchObject({ tab: false, requiresParams: true, requiredParams: ['id'] })
  })

  it('ExamQuestion 必填 examId、PayResult 必填 orderNo', () => {
    expect(route('ExamQuestion')?.requiredParams).toEqual(['examId'])
    expect(route('PayResult')?.requiredParams).toEqual(['orderNo'])
  })

  it('Follow 是 stack 屏而不是 tab(tab 语义走屏内 onSelectTab)', () => {
    expect(route('Follow')).toMatchObject({ tab: false })
  })
})

describe('nav-B 九屏壳端口与返回面', () => {
  const screens = [
    'ExamScreen',
    'ExamHistoryScreen',
    'VipScreen',
    'FollowScreen',
    'PostDetailScreen',
    'StudyRecordScreen',
    'VideoPlayerScreen',
    'VipCompareScreen',
    'ChangePwdScreen',
  ]

  it('九屏均接入 useHostPorts,不再用直接 navigate/replace 做前向前跳', () => {
    for (const name of screens) {
      const src = readFileSync(join(process.cwd(), 'src/screens', `${name}.tsx`), 'utf8')
      expect(src, `${name} 未接入导航端口`).toMatch(/useHostPorts/)
      expect(src, `${name} 仍存在直接 navigate`).not.toMatch(/navigation\.navigate\(/)
      expect(src, `${name} 仍存在直接 replace`).not.toMatch(/navigation\.replace\(/)
    }
  })

  it('无前向目标的 5 屏返回统一走栈 goBack', () => {
    for (const name of ['FollowScreen', 'PostDetailScreen', 'StudyRecordScreen', 'VideoPlayerScreen', 'VipCompareScreen']) {
      const src = readFileSync(join(process.cwd(), 'src/screens', `${name}.tsx`), 'utf8')
      expect(src, `${name} 返回未走栈`).toMatch(/onBack=\{\(\) => navigation\.goBack\(\)\}/)
    }
  })
})

describe('nav-B Vip 支付链出口', () => {
  it('支付成功落 PayResult(orderNo) 且 replace 不可回退', () => {
    const onNavigate = vi.fn()
    navigateAfterVipPay('PAY-ORDER-1', onNavigate)
    expect(onNavigate).toHaveBeenCalledTimes(1)
    expect(onNavigate).toHaveBeenCalledWith('PayResult', { orderNo: 'PAY-ORDER-1' }, { replace: true })
  })

  it('失败/取消不调用出口:未 paid 分支只提示并 return,不落结果页', () => {
    const src = readFileSync(join(process.cwd(), 'src/screens/VipScreen.tsx'), 'utf8')
    expect(src).toMatch(/if \(!statusRes\.success \|\| !statusRes\.data\?\.paid\) \{[\s\S]*?return\n/)
    const paidBranch = src.slice(src.indexOf('navigateAfterVipPay(orderNo, onNavigate)'))
    expect(paidBranch).not.toMatch(/statusRes\.data\?\.paid/)
    expect(src.match(/navigateAfterVipPay\(orderNo, onNavigate\)/g)).toHaveLength(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
