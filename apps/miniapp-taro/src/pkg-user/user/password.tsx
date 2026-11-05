// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像 packages/app/src/features/change-pwd/ChangePwdScreen.tsx(直载共享屏 + 注入本端事实)
//
// 端内保留的业务:校验规则(6-20 位 / 两次一致 / 新旧不同)、`changePassword` 端点契约
// (`PUT /api/auth/password { oldPassword, newPassword }`)、成功 toast + navigateBack、
// 「忘记原密码」跳转 `/pages/forgot-password/index`、失败文案 `settings.pwdChangeFailed`。
// 渲染(页头、三个密码框、显示/隐藏、内联校验、忘记入口、提交按钮)全部委托共享屏。

import Taro from '@tarojs/taro'
import { useCallback, useState } from 'react'
import { changePassword } from '@/api'
import { useI18n } from '@/i18n'
import { logger } from '@/utils/logger'
import ThemeRoot from '@/components/ThemeRoot'
import { useTheme } from '@/rn-compat/theme'
import { onToast } from '@/host/on-toast'
import { ChangePwdScreen } from '@ihui/rn-app/features/change-pwd/ChangePwdScreen'

export default function Password() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const [oldPwd, setOldPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [showOld, setShowOld] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const tt = useCallback(
    (k: string, fb: string) => {
      const v = t(k)
      return v === k ? fb : v
    },
    [t],
  )

  const newPwdValid = newPwd.length >= 6 && newPwd.length <= 20
  const confirmMatch = newPwd !== '' && newPwd === confirmPwd

  const onSubmit = useCallback(async () => {
    if (submitting) return
    if (!oldPwd) {
      onToast(tt('user.password.enterOld', '请输入原密码'), { kind: 'info' })
      return
    }
    if (!newPwdValid) {
      onToast(tt('user.password.tooShort', '密码长度 6-20 位'), { kind: 'error' })
      return
    }
    if (newPwd !== confirmPwd) {
      onToast(tt('user.password.mismatch', '两次输入的密码不一致'), { kind: 'info' })
      return
    }
    if (oldPwd === newPwd) {
      onToast(tt('user.password.sameAsOld', '新密码不能与原密码相同'), { kind: 'error' })
      return
    }
    setSubmitting(true)
    try {
      await changePassword({ oldPassword: oldPwd, newPassword: newPwd })
      onToast(tt('user.password.success', '密码修改成功'), { kind: 'success' })
      setTimeout(() => Taro.navigateBack(), 1000)
    } catch (e) {
      logger.error('user/password', '修改密码', e)
      /* `common.failed` 五语言词条是「加载失败」,用在提交失败处是说谎文案;
         取已在册且语义精确的 `settings.pwdChangeFailed`(与设置页密码弹层同一句)。 */
      onToast(t('settings.pwdChangeFailed'), { kind: 'error' })
    } finally {
      setSubmitting(false)
    }
  }, [submitting, oldPwd, newPwdValid, newPwd, confirmPwd, tt, t])

  // 共享屏要求注入导航端口;本屏内只剩「忘记原密码」一条真实跳转(已单独走 onForgotOld)。
  const onNavigate = useCallback(() => {
    onToast('导航未接入', { kind: 'error' })
  }, [])

  return (
    <ThemeRoot>
      <ChangePwdScreen
        t={t}
        colorScheme={resolvedTheme}
        oldPwd={oldPwd}
        newPwd={newPwd}
        confirmPwd={confirmPwd}
        showOld={showOld}
        showNew={showNew}
        showConfirm={showConfirm}
        submitting={submitting}
        onOldChange={setOldPwd}
        onNewChange={setNewPwd}
        onConfirmChange={setConfirmPwd}
        onToggleOld={() => setShowOld((v) => !v)}
        onToggleNew={() => setShowNew((v) => !v)}
        onToggleConfirm={() => setShowConfirm((v) => !v)}
        submitLabel={tt('user.password.submit', '修改密码')}
        newPwdError={
          newPwd !== '' && !newPwdValid
            ? tt('user.password.tooShort', '密码长度 6-20 位')
            : undefined
        }
        confirmPwdError={
          confirmPwd !== '' && !confirmMatch
            ? tt('user.password.mismatch', '两次输入的密码不一致')
            : undefined
        }
        onForgotOld={() => {
          void Taro.navigateTo({ url: '/pages/forgot-password/index' })
        }}
        forgotLabel={tt('user.password.forgotOld', '忘记原密码?通过手机验证修改')}
        onBack={() => {
          void Taro.navigateBack()
        }}
        onSubmit={() => {
          void onSubmit()
        }}
        onNavigate={onNavigate}
        onToast={onToast}
      />
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌​‌‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
