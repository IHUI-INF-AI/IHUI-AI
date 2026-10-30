// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 对齐目标(RN 共享屏): packages/app/src/features/real-name-auth/RealNameAuthScreen.tsx
// 状态取数取证(2026-10-30):GET /user/profile(miniapp-compat-routes.ts 的 /user/profile SELECT)
// **不产出** realName / idCard / 认证状态 —— 旧代码读 profile.realnameStatus 恒 undefined,
// 「已认证 / 审核中 / 未通过」三态分支结构上打不到。在册真值端点 = GET /api/auth/realname/my
// (auth-identity.ts,回 authStatus/realName/idCard(解密后)/rejectReason),本页改接它。
// 身份证照片上传位已撤:全仓无任何端点接收 idCardFront/idCardBack(user_auth_info 无照片列,
// POST /user/realname 与 POST /auth/realname/submit 的 Zod 体只有 realName/idCard/authSource),
// 留着就是「选了图也丢」的假输入口。
import { useI18n } from '@/i18n'
import { logger } from '@/utils/logger'
import { View, Text, Button } from '@tarojs/components'
import { FocusInput } from '@/components/FocusField'
import LineIcon from '@/components/LineIcon'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { post } from '@/api'
import { fetchApi } from '@ihui/api-client'
import { useAuthReadyGate } from '@/hooks/use-auth-ready-gate'
import ThemeRoot from '@/components/ThemeRoot'
import './realname.css'

const ID_CARD_REGEX = /^\d{17}[\dXx]$/

type AuthStatus = 'unverified' | 'reviewing' | 'verified' | 'rejected'

/** 后端 authStatus(user_auth_info.auth_status)→ 页面四态;认不出的值按未认证收口,不猜成已通过 */
function toAuthStatus(raw: string | null | undefined): AuthStatus {
  if (raw === 'approved') return 'verified'
  if (raw === 'pending') return 'reviewing'
  if (raw === 'rejected') return 'rejected'
  return 'unverified'
}

interface RealnameRecord {
  authStatus?: string | null
  realName?: string | null
  idCard?: string | null
  rejectReason?: string | null
}

function maskIdCard(id: string): string {
  if (!id || id.length < 8) return id || ''
  return id.slice(0, 4) + '********' + id.slice(-4)
}

export default function Realname() {
  const { t } = useI18n()
  const gate = useAuthReadyGate()
  const tt = useCallback((k: string, fb: string) => (t(k) === k ? fb : t(k)), [t])
  const [realName, setRealName] = useState('')
  const [idCard, setIdCard] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [status, setStatus] = useState<AuthStatus>('unverified')
  const [authedName, setAuthedName] = useState('')
  const [authedId, setAuthedId] = useState('')
  const [rejectReason, setRejectReason] = useState('')

  const load = useCallback(async () => {
    try {
      const res = await fetchApi<RealnameRecord>('/api/auth/realname/my')
      if (!res.success) {
        // 取不到状态就保持未认证并如实提示 —— 不把「没取到」说成「没认证过」之外的任何状态
        setStatus('unverified')
        Taro.showToast({ title: res.error || t('common.failed'), icon: 'none' })
        return
      }
      const info = res.data ?? {}
      const next = toAuthStatus(info.authStatus)
      setStatus(next)
      if (next === 'verified') {
        setAuthedName(info.realName || '')
        setAuthedId(info.idCard || '')
        return
      }
      if (next === 'reviewing' || next === 'rejected') setRealName(info.realName || '')
      if (next === 'rejected') setRejectReason(info.rejectReason || '')
    } catch (e) {
      logger.error('user/realname', t('userRealname.q1'), e)
      Taro.showToast({ title: t('common.failed'), icon: 'none' })
    }
  }, [t])

  useDidShow(() => {
    // G-933 冷启动门控:GET /auth/realname/my(checkAuth)需鉴权,落定前不发
    gate.waitUntilReady(() => {
      void load()
    })
  })

  async function onSubmit() {
    const name = realName.trim()
    if (!name) {
      return Taro.showToast({ title: t('user.realname.enterRealName'), icon: 'none' })
    }
    if (!ID_CARD_REGEX.test(idCard)) {
      return Taro.showToast({ title: t('user.realname.idCardLength'), icon: 'none' })
    }
    setSubmitting(true)
    try {
      // 只发后端真读的键:POST /user/realname 的 Zod 体 = {realName, idCard, authSource},
      // 多传的键会被 Zod 静默剥掉(user_auth_info 也没有照片列)⇒ 不再摆假字段。
      await post('/user/realname', { realName: name, idCard: idCard.toUpperCase() })
      Taro.showToast({ title: t('user.realname.authSuccess'), icon: 'success' })
      setStatus('reviewing')
      setTimeout(() => Taro.navigateBack(), 1000)
    } catch (e) {
      logger.error('user/realname', t('userRealname.q3'), e)
      Taro.showToast({ title: t('common.failed'), icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  if (status === 'verified') {
    return (
      <ThemeRoot>
        <View className="rn-page">
          <View className="rn-result-card">
            <View className="rn-result-icon">
              <LineIcon
                className="rn-result-icon-text"
                name="check-success"
                size={56}
                color="var(--color-success)"
              />
            </View>
            <Text className="rn-result-title">{t('user.realname.authed')}</Text>
            <Text className="rn-result-name">{authedName}</Text>
            <Text className="rn-result-sub">{maskIdCard(authedId)}</Text>
            <Text className="rn-result-note">
              {tt('user.realname.verifiedNote', '实名信息已认证,不可修改')}
            </Text>
          </View>
        </View>
      </ThemeRoot>
    )
  }

  const isReviewing = status === 'reviewing'

  return (
    <ThemeRoot>
      <View className="rn-page">
        <View className="rn-intro">
          <Text className="rn-intro-title">{tt('user.realname.title', '实名认证')}</Text>
          <Text className="rn-intro-line">
            {tt('user.realname.desc', '为保障账户安全与合规,部分功能需完成实名认证后使用')}
          </Text>
          <Text className="rn-intro-line rn-intro-muted">
            {tt(
              'user.realname.privacyPromise',
              '您的身份信息仅用于实名核验,平台将严格保密,不会用于其他用途',
            )}
          </Text>
        </View>

        {/* 认证状态卡:与共享屏同一形制(标签 + 当前值 + 说明 + 驳回原因)一处说完,
            不再拆成"审核中/未通过"两块各说一遍。状态值取端内已有档(共享屏那组
            realNameAuth.status_* 是常量表形态、本端词包五语言均无词条,直取会把裸键上屏)。 */}
        <View className="rn-status">
          <Text className="rn-status-text">
            {t('realNameAuth.status')}：
            {status === 'reviewing'
              ? t('user.realname.reviewing')
              : status === 'rejected'
                ? t('user.realname.rejected')
                : tt('user.realname.unverified', '未认证')}
          </Text>
          <Text className="rn-status-reason">{t('realNameAuth.unverifiedDesc')}</Text>
          {status === 'rejected' && rejectReason ? (
            <Text className="rn-status-reason">{rejectReason}</Text>
          ) : null}
        </View>

        <View className="rn-card">
          <View className="rn-field">
            <Text className="rn-label">{t('user.realname.realName')}</Text>
            <FocusInput
              className="rn-input"
              type="text"
              placeholder={t('user.realname.realNamePlaceholder')}
              value={realName}
              onInput={(e) => setRealName(e.detail.value)}
            />
          </View>
          <View className="rn-field">
            <Text className="rn-label">{t('user.realname.idCard')}</Text>
            <FocusInput
              className="rn-input"
              type="idcard"
              maxlength={18}
              placeholder={t('user.realname.idCardPlaceholder')}
              placeholderClass="rn-placeholder"
              value={idCard}
              onInput={(e) => setIdCard(e.detail.value)}
            />
          </View>
        </View>

        <Button
          className={`rn-submit${submitting || isReviewing ? ' disabled' : ''}`}
          disabled={submitting || isReviewing}
          onClick={onSubmit}
        >
          {isReviewing
            ? tt('user.realname.reviewing', '审核中')
            : submitting
              ? t('realNameAuth.submitting')
              : t('user.realname.submit')}
        </Button>
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
