import { useState } from 'react'
import { Alert, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { updatePassword } from '@ihui/api-client'
import { ChangePwdScreen as SharedChangePwdScreen } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const MIN_PWD_LEN = 6

export function ChangePwdScreen() {
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
      Alert.alert('提示', '请输入旧密码')
      return
    }
    if (newPwd.length < MIN_PWD_LEN) {
      Alert.alert('提示', `新密码至少 ${MIN_PWD_LEN} 位`)
      return
    }
    if (newPwd !== confirmPwd) {
      Alert.alert('提示', '两次输入的密码不一致')
      return
    }
    setSubmitting(true)
    try {
      const res = await updatePassword({ oldPassword: oldPwd, newPassword: newPwd })
      if (res.success) {
        Alert.alert('修改成功', '密码已更新', [
          { text: '确定', onPress: () => navigation.goBack() },
        ])
      } else {
        Alert.alert('修改失败', res.error || '请稍后重试')
      }
    } catch {
      Alert.alert('修改失败', '网络异常,请稍后重试')
    } finally {
      setSubmitting(false)
    }
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
        onOldChange={setOldPwd}
        onNewChange={setNewPwd}
        onConfirmChange={setConfirmPwd}
        onToggleOld={() => setShowOld((v) => !v)}
        onToggleNew={() => setShowNew((v) => !v)}
        onToggleConfirm={() => setShowConfirm((v) => !v)}
        onSubmit={onSubmit}
      />
    </View>
  )
}

export default ChangePwdScreen
