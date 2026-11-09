// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 对齐目标(RN 共享屏): packages/app/src/features/account-cancel/AccountCancelScreen.tsx
import { useI18n } from '@/i18n'
import { goToLogin } from '@/utils/auth'
import { logger } from '@/utils/logger'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback, useRef, useEffect } from 'react'
import { useCountdown } from '@ihui/shared'
import * as api from '@/api'
import { useAuthReadyGate } from '@/hooks/use-auth-ready-gate'
import ThemeRoot from '@/components/ThemeRoot'
import { AccountCancelScreen } from '@ihui/rn-app/features/account-cancel/AccountCancelScreen'
import { onToast } from '@/host/on-toast'

/**
 * 共享 AccountCancelScreen 的 i18n 键 → 本端既有词条。
 * 未列出的键按原样走 i18n(不得回落到裸 key;门 299 T13/T15 逐键断言)。
 */
export const ACCOUNT_CANCEL_TEXT: Record<string, string> = {
  'settings.accountDeletionTitle': 'accountCancel.title',
  'settings.accountDeletionWarning': 'accountCancel.warning',
  'settings.accountDeletionPhoneLabel': 'accountCancel.phoneLabel',
  'settings.accountDeletionPhonePlaceholder': 'accountCancel.phoneLabel',
  'settings.accountDeletionCodeLabel': 'accountCancel.codeLabel',
  'settings.accountDeletionCodePlaceholder': 'accountCancel.codePlaceholder',
  'settings.accountDeletionSendCode': 'accountCancel.getCode',
  'settings.accountDeletionConfirmLabel': 'accountCancel.confirmLabel',
  'settings.accountDeletionConfirm': 'accountCancel.confirmPlaceholder',
  'settings.accountDeletionSubmit': 'accountCancel.submit',
  'settings.accountDeletionSubmitting': 'accountCancel.submitting',
  'settings.accountDeletionConfirmTitle': 'accountCancel.submit',
  'settings.accountDeletionConsequenceTitle': 'accountCancel.consequenceTitle',
  'settings.accountDeletionConsequence1': 'accountCancel.consequence1',
  'settings.accountDeletionConsequence2': 'accountCancel.consequence2',
  'settings.accountDeletionConsequence3': 'accountCancel.consequence3',
  'settings.accountDeletionConsequence4': 'accountCancel.consequence4',
  'settings.accountDeletionConsequence5': 'accountCancel.consequence5',
  'settings.accountDeletionConsequence6': 'accountCancel.consequence6',
  'settings.accountDeletionConsequence7': 'accountCancel.consequence7',
  'common.back': 'common.back',
  'common.cancel': 'common.cancel',
}

const CONSEQUENCE_KEYS = [
  'settings.accountDeletionConsequence1',
  'settings.accountDeletionConsequence2',
  'settings.accountDeletionConsequence3',
  'settings.accountDeletionConsequence4',
  'settings.accountDeletionConsequence5',
  'settings.accountDeletionConsequence6',
  'settings.accountDeletionConsequence7',
]

export default function AccountCancel() {
  const { t } = useI18n()
  const gate = useAuthReadyGate()
  const [info, setInfo] = useState<Record<string, unknown> | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [code, setCode] = useState('')
  // 两个倒计时均为截止戳派生:后台节流后返回前台按墙钟对表(useDidShow 里 sync)
  const codeCountdown = useCountdown(60)
  const confirmCountdown = useCountdown(5)
  // 方法引用在 useCountdown 内是 useCallback 稳定的(sync/start/pause 空依赖、reset 只依赖常量秒数),
  // 解构出来可直接做 effect/callback 依赖:既让 exhaustive-deps 看到真实依赖,又不会因 count 每秒
  // 变化重建监听或让下游 memo 失效。
  const { start: startConfirmCountdown } = confirmCountdown
  const { reset: resetCodeCountdown, start: startCodeCountdown } = codeCountdown
  const codeSendingRef = useRef(false)

  const phone = (info?.phone as string) || ''
  const maskedPhone = phone ? phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') : ''

  // 共享屏文案适配:共享键 → 本端既有词条(不得回落到裸 key)
  const sharedT = useCallback(
    (key: string) => {
      const mapped = ACCOUNT_CANCEL_TEXT[key] ?? key
      return t(mapped)
    },
    [t],
  )

  const loadData = useCallback(async () => {
    try {
      const res = (await api.getProfile()) as Record<string, unknown>
      setInfo(res)
    } catch (e) {
      logger.error('unknown', '加载用户信息', e)
    }
  }, [])

  useDidShow(() => {
    codeCountdown.sync()
    confirmCountdown.sync()
    // G-933 冷启动门控:资料自查 GET /user/profile(checkAuth)需鉴权
    gate.waitUntilReady(() => {
      void loadData()
    })
  })

  // 页级 5 秒强制阅读倒计时(进入页面即开始,结束前禁止提交;闸门留在本地页)
  useEffect(() => {
    startConfirmCountdown()
  }, [startConfirmCountdown])

  const onSendCode = useCallback(async () => {
    if (codeCountdown.count > 0 || !phone) return
    // 2026-08-21 修复(双击重发竞态):count 在 await sendSmsCode 网络往返期间仍为 0,
    // 快速双击会两次通过守卫 → 发两条短信。
    // 用同步 ref 守卫覆盖整个 await 窗口。
    if (codeSendingRef.current) return
    codeSendingRef.current = true
    try {
      await api.sendSmsCode(phone)
      onToast(t('accountCancel.codeSent'), { kind: 'success' })
      resetCodeCountdown(60)
      startCodeCountdown()
    } catch {
      // 错误已由 request 统一提示
    } finally {
      codeSendingRef.current = false
    }
  }, [codeCountdown.count, phone, resetCodeCountdown, startCodeCountdown, t])

  const onSubmit = useCallback(async () => {
    if (submitting) return
    if (confirmCountdown.count > 0) return
    if (!phone) {
      onToast(t('accountCancel.noPhone'), { kind: 'error' })
      return
    }
    if (!code.trim()) {
      onToast(t('accountCancel.codeInvalid'), { kind: 'error' })
      return
    }
    if (confirmText !== t('accountCancel.confirmSentence')) {
      onToast(t('accountCancel.confirmTextMismatch'), { kind: 'info' })
      return
    }
    setSubmitting(true)
    try {
      // A 档改接真端点(2026-10-26 守门 8 存量代裁):`POST /api/auth/cancel-account` 在两后端
      // HEAD 面零注册(死调用),注销真身 = `POST /api/settings/delete-account`
      // (apps/api/src/routes/user/settings-routes.ts:383 → missingUserRoutes,index.ts:1081 prefix '/api'),
      // 与 @ihui/api-client 的 deleteAccount()(packages/api-client/src/endpoints/system.ts:478)
      // 及 RN AccountCancelScreen 同一条路径 —— 三端同一真值。
      // 只上行 code:身份由令牌在承载层解析(userAuthPreHandler → request.userId),手机号取库侧
      // user.phone 后 verifyCode(user.phone, code),不信客户端自报 phone(§5 认证不等于授权);
      // confirmText 后端 schema 不消费,继续留作端内二次确认闸门(上面的校验一条没减)。
      await api.post('/settings/delete-account', { code })
      onToast(t('accountCancel.cancelled'), { kind: 'success' })
      setTimeout(goToLogin, 800)
    } catch (e) {
      // 真实失败:如实提示,不假装注销成功
      logger.error('unknown', '注销', e)
      onToast(t('accountCancel.failed') || '注销失败,请重试', { kind: 'error' })
    } finally {
      setSubmitting(false)
    }
  }, [submitting, confirmCountdown.count, phone, code, confirmText, t])

  return (
    // 对齐 RN 共享 AccountCancelScreen:header(返回+标题)由共享屏承载;
    // 手机号只读展示(phoneReadOnly);二次确认弹窗不上收,改页级 5 秒闸。
    <ThemeRoot>
      <AccountCancelScreen
        t={sharedT}
        phone={phone ? maskedPhone : ''}
        confirmText={confirmText}
        smsCode={code}
        countdown={codeCountdown.count}
        showConfirmModal={false}
        confirmCountdown={confirmCountdown.count}
        submitting={submitting}
        consequences={CONSEQUENCE_KEYS.map((k) => t(ACCOUNT_CANCEL_TEXT[k] ?? k))}
        phoneReadOnly={true}
        onPhoneChange={() => {}}
        onConfirmTextChange={setConfirmText}
        onSmsCodeChange={setCode}
        onSendSms={onSendCode}
        onSubmit={onSubmit}
        onCloseModal={() => {}}
        onBack={() => {
          void Taro.navigateBack({ delta: 1 })
        }}
      />
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
