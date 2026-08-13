/**
 * ChangePwdScreen 修改密码 (mobile-rn 端)
 *
 * 1:1 复刻历史 Uniapp changePwd.vue(已登录态修改密码,简化为旧/新/确认三段输入):
 * - 3 个 TextInput:旧密码 / 新密码 / 确认新密码(secureTextEntry + 显隐切换)
 * - 校验:新密码 ≥ 6 位 / 两次密码一致
 * - 提交:调用 @ihui/api-client.updatePassword(对齐 SettingsScreen 的 onChangePassword)
 * - NavBar 带 onBack
 * 类型零 any;颜色走 @ihui/design-tokens 的 rnLightTokens;圆角仅 12/8/6。
 */
import { useState } from 'react'
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { updatePassword } from '@ihui/api-client'
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { NavBar } from '../components/NavBar'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const MIN_PWD_LEN = 6

export default function ChangePwdScreen() {
  const navigation = useNavigation<NavigationProp>()
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
    <View style={styles.container}>
      <NavBar title="修改密码" onBack={() => navigation.goBack()} />
      <View style={styles.body}>
        <PwdInput
          label="旧密码"
          value={oldPwd}
          onChange={setOldPwd}
          show={showOld}
          onToggle={() => setShowOld((v) => !v)}
        />
        <PwdInput
          label="新密码"
          value={newPwd}
          onChange={setNewPwd}
          show={showNew}
          onToggle={() => setShowNew((v) => !v)}
        />
        <PwdInput
          label="确认新密码"
          value={confirmPwd}
          onChange={setConfirmPwd}
          show={showConfirm}
          onToggle={() => setShowConfirm((v) => !v)}
        />
        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.submitDisabled]}
          activeOpacity={0.7}
          disabled={submitting}
          onPress={onSubmit}
          accessibilityRole="button"
        >
          <Text style={styles.submitText}>{submitting ? '提交中...' : '确定'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

interface PwdInputProps {
  label: string
  value: string
  onChange: (v: string) => void
  show: boolean
  onToggle: () => void
}

function PwdInput({ label, value, onChange, show, onToggle }: PwdInputProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputBox}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChange}
          secureTextEntry={!show}
          placeholder={`请输入${label}`}
          placeholderTextColor={tokens.text.tertiary}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity style={styles.eyeBtn} onPress={onToggle} hitSlop={8}>
          <Text style={styles.eyeText}>{show ? '隐藏' : '显示'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.surface.bg },
  body: { padding: 16, gap: 16 },
  field: { gap: 6 },
  label: { fontSize: 14, color: tokens.text.secondary },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.surface.muted,
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: tokens.text.primary,
  },
  eyeBtn: { paddingVertical: 8, paddingHorizontal: 4 },
  eyeText: { fontSize: 13, color: tokens.text.secondary },
  submitBtn: {
    marginTop: 8,
    backgroundColor: tokens.brand.DEFAULT,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitDisabled: { opacity: 0.6 },
  submitText: { fontSize: 15, fontWeight: '600', color: tokens.surface.light },
})
