import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native'
import { TextLink } from 'solito/link'

interface ProfileScreenProps {
  /** 用户昵称(表单初始值) */
  name: string
  /** 用户邮箱(表单初始值) */
  email: string
  /** 用户手机号(可选,仅展示) */
  phone?: string
  /**
   * 返回回调。
   * web 端可传入 Next.js router.push('/'),
   * RN 端可传入 navigation.goBack()。
   * 不传则不显示返回按钮。
   */
  onBack?: () => void
  /**
   * 保存回调,传入编辑后的 { name, email }。
   * web 端可传入 fetch POST,RN 端可传入 API 调用。
   * 不传则不显示保存按钮。
   */
  onSave?: (data: { name: string; email: string }) => void
}

/**
 * ProfileScreen — 用户资料共享页面。
 *
 * 展示头像(首字母圆形)、昵称、邮箱、手机号,并提供可编辑表单(昵称 / 邮箱)。
 * 用 react-native primitives(View/Text/TextInput/TouchableOpacity/StyleSheet),
 * web 端通过 react-native-web 渲染,RN 端原生渲染。
 * 导航与数据持久化通过 onBack/onSave 回调注入,实现平台解耦。
 */
export function ProfileScreen({ name, email, phone, onBack, onSave }: ProfileScreenProps) {
  const [editName, setEditName] = useState(name)
  const [editEmail, setEditEmail] = useState(email)

  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('')

  const handleSave = () => {
    onSave?.({ name: editName.trim(), email: editEmail.trim() })
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {onBack ? (
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Text style={styles.backButtonText}>← 返回</Text>
          </TouchableOpacity>
        ) : (
          <TextLink href="/" textProps={{ style: styles.backButtonText }}>
            ← 返回
          </TextLink>
        )}
        <Text style={styles.title}>个人资料</Text>
      </View>

      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials || '?'}</Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.displayName}>{name}</Text>
          <Text style={styles.profileMeta}>{email}</Text>
          {phone ? <Text style={styles.profileMeta}>{phone}</Text> : null}
        </View>
      </View>

      <View style={styles.formSection}>
        <Text style={styles.sectionTitle}>编辑资料</Text>

        <View style={styles.field}>
          <Text style={styles.label}>昵称</Text>
          <TextInput
            style={styles.input}
            value={editName}
            onChangeText={setEditName}
            placeholder="请输入昵称"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>邮箱</Text>
          <TextInput
            style={styles.input}
            value={editEmail}
            onChangeText={setEditEmail}
            placeholder="请输入邮箱"
            placeholderTextColor="#9CA3AF"
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        {onSave ? (
          <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
            <Text style={styles.saveButtonText}>保存</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  backButtonText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 9999,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
  },
  profileInfo: {
    flex: 1,
    gap: 2,
  },
  displayName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111827',
  },
  profileMeta: {
    fontSize: 14,
    color: '#6B7280',
  },
  formSection: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  field: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#FFFFFF',
  },
  saveButton: {
    marginTop: 4,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#10B981',
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
})
