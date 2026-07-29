import { useMemo } from 'react'
import {
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { Gender, ProfileEditScreenProps } from '../../types'

/** 资料编辑共享屏 — props 注入式跨端组件(wrapper 负责 getProfile / updateProfile / Alert) */
export type { ProfileEditScreenProps }

const GENDERS: Array<{ value: Gender; key: 'male' | 'female' | 'secret' }> = [
  { value: 1, key: 'male' },
  { value: 2, key: 'female' },
  { value: 0, key: 'secret' },
]

const GENDER_KEYS: Record<'male' | 'female' | 'secret', string> = {
  male: 'profileEdit.gender_male',
  female: 'profileEdit.gender_female',
  secret: 'profileEdit.gender_secret',
}

export function ProfileEditScreen({
  t,
  nickname,
  bio,
  gender,
  avatar,
  loading,
  saving,
  error,
  avatarModalVisible,
  avatarInput,
  onNicknameChange,
  onBioChange,
  onGenderChange,
  onOpenAvatarModal,
  onCloseAvatarModal,
  onAvatarInputChange,
  onConfirmAvatar,
  onSave,
  onRetry,
  onBack,
  colorScheme = 'light',
}: ProfileEditScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  if (loading) {
    return (
      <View style={styles.centerWrap}>
        <ActivityIndicator color={tk.text.primary} />
        <Text style={styles.emptyText}>{t('common.loading')}</Text>
      </View>
    )
  }

  // 初次加载失败(无任何资料数据)→ 展示 retry 视图
  if (error && !nickname && !avatar) {
    return (
      <View style={styles.centerWrap}>
        <Text style={styles.errorText}>{error}</Text>
        <View style={{ height: 12 }} />
        <TouchableOpacity onPress={onRetry} style={styles.retryBtn}>
          <Text style={styles.retryText}>{t('profileEdit.retry')}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('profileEdit.title')}</Text>
      </View>

      <View style={styles.avatarWrap}>
        <TouchableOpacity onPress={onOpenAvatarModal} activeOpacity={0.8}>
          {avatar ? (
            <Image source={{ uri: avatar }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarEmoji}>📷</Text>
            </View>
          )}
          <View style={styles.avatarEditBadge}>
            <Text style={styles.avatarEditBadgeText}>✎</Text>
          </View>
        </TouchableOpacity>
        <Text style={styles.avatarTip}>{t('profileEdit.avatarTip')}</Text>
      </View>

      <View style={styles.fieldCard}>
        <Text style={styles.fieldLabel}>{t('profileEdit.nickname')}</Text>
        <TextInput
          style={styles.fieldInput}
          value={nickname}
          onChangeText={onNicknameChange}
          placeholder={t('profileEdit.nicknamePlaceholder')}
          placeholderTextColor={tk.text.tertiary}
          maxLength={32}
        />
      </View>

      <View style={styles.fieldCard}>
        <Text style={styles.fieldLabel}>{t('profileEdit.gender')}</Text>
        <View style={styles.genderRow}>
          {GENDERS.map((g) => (
            <TouchableOpacity
              key={g.value}
              onPress={() => onGenderChange(g.value)}
              style={[styles.genderItem, gender === g.value && styles.genderItemActive]}
            >
              <Text style={[styles.genderText, gender === g.value && styles.genderTextActive]}>
                {t(GENDER_KEYS[g.key])}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.fieldCard}>
        <Text style={styles.fieldLabel}>{t('profileEdit.bio')}</Text>
        <TextInput
          style={[styles.fieldInput, styles.bioInput]}
          value={bio}
          onChangeText={onBioChange}
          placeholder={t('profileEdit.bioPlaceholder')}
          placeholderTextColor={tk.text.tertiary}
          multiline
          maxLength={200}
          textAlignVertical="top"
        />
        <Text style={styles.bioCounter}>{bio.length}/200</Text>
      </View>

      {error ? (
        <View style={styles.errorBar}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <TouchableOpacity
        style={[styles.saveBtn, saving && styles.btnDisabled]}
        onPress={onSave}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color={tk.surface.light} />
        ) : (
          <Text style={styles.saveText}>{t('profileEdit.save')}</Text>
        )}
      </TouchableOpacity>

      <Modal
        visible={avatarModalVisible}
        transparent
        animationType="fade"
        onRequestClose={onCloseAvatarModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('profileEdit.avatarModalTitle')}</Text>
            <Text style={styles.modalLabel}>{t('profileEdit.avatarUrlLabel')}</Text>
            <TextInput
              style={styles.modalInput}
              value={avatarInput}
              onChangeText={onAvatarInputChange}
              placeholder={t('profileEdit.avatarUrlPlaceholder')}
              placeholderTextColor={tk.text.tertiary}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.modalHint}>{t('profileEdit.avatarUrlHint')}</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={onCloseAvatarModal} style={styles.modalCancelBtn}>
                <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onConfirmAvatar} style={styles.modalConfirmBtn}>
                <Text style={styles.modalConfirmText}>{t('common.confirm')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.muted },
    centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, paddingVertical: 8 },
    backBtn: { marginRight: 12 },
    backText: { fontSize: 14, color: tk.text.medium },
    title: { fontSize: 18, fontWeight: '600', color: tk.text.primary },
    avatarWrap: { alignItems: 'center', paddingVertical: 16, gap: 8 },
    avatar: { width: 80, height: 80, borderRadius: 8, backgroundColor: tk.surface.card },
    avatarFallback: {
      width: 80,
      height: 80,
      borderRadius: 8,
      backgroundColor: tk.border.light,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarEmoji: { fontSize: 28 },
    avatarEditBadge: {
      position: 'absolute',
      right: -4,
      bottom: -4,
      width: 24,
      height: 24,
      borderRadius: 8,
      backgroundColor: tk.brand.DEFAULT,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarEditBadgeText: { fontSize: 12, color: tk.surface.light },
    avatarTip: { fontSize: 11, color: tk.text.tertiary },
    fieldCard: { backgroundColor: tk.surface.light, borderRadius: 8, padding: 12 },
    fieldLabel: { fontSize: 12, fontWeight: '600', color: tk.text.secondary, marginBottom: 8 },
    fieldInput: {
      borderWidth: 1,
      borderColor: tk.border.light,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      fontSize: 14,
      color: tk.text.primary,
    },
    bioInput: { minHeight: 80, paddingTop: 8 },
    bioCounter: { fontSize: 10, color: tk.text.tertiary, textAlign: 'right', marginTop: 4 },
    genderRow: { flexDirection: 'row', gap: 8 },
    genderItem: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: tk.surface.card,
      alignItems: 'center',
    },
    genderItemActive: { backgroundColor: tk.brand.DEFAULT },
    genderText: { fontSize: 12, color: tk.text.secondary },
    genderTextActive: { color: tk.surface.light },
    errorBar: { backgroundColor: tk.danger.light, borderRadius: 8, padding: 8 },
    errorText: { fontSize: 12, color: tk.error.text },
    emptyText: { marginTop: 8, fontSize: 12, color: tk.text.secondary },
    retryBtn: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    retryText: { fontSize: 13, color: tk.text.secondary },
    saveBtn: {
      paddingVertical: 12,
      borderRadius: 8,
      backgroundColor: tk.brand.DEFAULT,
      alignItems: 'center',
    },
    btnDisabled: { opacity: 0.6 },
    saveText: { color: tk.surface.light, fontSize: 14, fontWeight: '600' },
    modalOverlay: {
      flex: 1,
      backgroundColor: tk.overlay.modal,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },
    modalCard: { backgroundColor: tk.surface.light, borderRadius: 8, padding: 16, width: '100%' },
    modalTitle: { fontSize: 16, fontWeight: '600', color: tk.text.primary, marginBottom: 12 },
    modalLabel: { fontSize: 12, color: tk.text.secondary, marginBottom: 4 },
    modalInput: {
      borderWidth: 1,
      borderColor: tk.border.light,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      fontSize: 14,
      color: tk.text.primary,
    },
    modalHint: { fontSize: 11, color: tk.text.tertiary, marginTop: 4 },
    modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 16 },
    modalCancelBtn: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: tk.surface.card,
    },
    modalCancelText: { fontSize: 13, color: tk.text.secondary },
    modalConfirmBtn: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: tk.brand.DEFAULT,
    },
    modalConfirmText: { fontSize: 13, color: tk.surface.light },
  })
}
