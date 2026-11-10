// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useState } from 'react'
import { useTheme } from '../context/ThemeContext'
import { View } from 'react-native'
import { appAlert } from '../components/BottomPops'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { updatePassword } from '@ihui/api-client'
import { toUserFriendlyMessage } from '@ihui/shared/utils'
import { ChangePwdScreen as SharedChangePwdScreen } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { useHostPorts } from '../host/use-host-ports'
import { WEB_BASE_URL } from '../lib/webview-portal-config'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const MIN_PWD_LEN = 6
/** 与小程序 pwd 页同规则:输入上限 20(types 契约 inputMaxLength) */
const MAX_PWD_LEN = 20

function ChangePwdScreen() {
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const { t } = useI18n()
  const [oldPwd, setOldPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [showOld, setShowOld] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const onSubmit = async () => {
    if (!oldPwd) {
      appAlert(t('home.pubTip'), t('pwd.oldRequired'))
      return
    }
    if (newPwd.length < MIN_PWD_LEN) {
      appAlert(t('home.pubTip'), t('pwd.minLen', { n: MIN_PWD_LEN }))
      return
    }
    if (newPwd !== confirmPwd) {
      appAlert(t('home.pubTip'), t('settings.pwdNotMatch'))
      return
    }
    setSubmitting(true)
    try {
      const res = await updatePassword({ oldPassword: oldPwd, newPassword: newPwd })
      if (res.success) {
        appAlert(t('pwd.okTitle'), t('pwd.okBody'), [
          { text: t('common.confirm'), onPress: () => navigation.goBack() },
        ])
      } else {
        appAlert(t('pwd.failRetry'), res.error || t('pwd.retryLater'))
      }
    } catch (e: unknown) {
      const detail = e instanceof Error ? e.message : typeof e === 'string' ? e : ''
      appAlert(t('pwd.failRetry'), detail.trim() ? toUserFriendlyMessage(e) : t('pwd.netFail'))
    } finally {
      setSubmitting(false)
    }
  }

  const { onNavigate, onToast } = useHostPorts()

  // XUI-068:旧密码想不起来时同样走 web 找回页,不要在本屏兜圈。
  const handleForgotOld = () => {
    navigation.navigate('WebView', {
      url: `${WEB_BASE_URL}/forgot-password`,
      title: t('auth.forgotPassword'),
    })
  }

  return (
    <View style={{ flex: 1 }}>
      <SharedChangePwdScreen
        t={t}
        onBack={() => navigation.goBack()}
        oldPwd={oldPwd}
        newPwd={newPwd}
        confirmPwd={confirmPwd}
        showOld={showOld}
        showNew={showNew}
        showConfirm={showConfirm}
        submitting={submitting}
        inputMaxLength={MAX_PWD_LEN}
        onOldChange={setOldPwd}
        onNewChange={setNewPwd}
        onConfirmChange={setConfirmPwd}
        onToggleOld={() => setShowOld((v) => !v)}
        onToggleNew={() => setShowNew((v) => !v)}
        onToggleConfirm={() => setShowConfirm((v) => !v)}
        onSubmit={onSubmit}
        onForgotOld={handleForgotOld}
        forgotLabel={t('auth.forgotPassword')}
        colorScheme={resolvedTheme}
        onNavigate={onNavigate}
        onToast={onToast}
      />
    </View>
  )
}

export default ChangePwdScreen
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
