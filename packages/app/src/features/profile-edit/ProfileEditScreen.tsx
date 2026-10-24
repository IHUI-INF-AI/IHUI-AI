// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import {
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import { TextField } from '../../components/TextField'
import { Camera, SquarePen } from 'lucide-react-native'
import type { Gender, ProfileEditScreenProps } from '../../types'

import { rnRadius, rnRadiusFor, rnSpacing, rnType } from '@ihui/design-tokens'
import { BackChevron } from '../../components/BackChevron'
import { ErrorState, ScreenSkeleton } from '../../components/ScreenStates'

/** 资料编辑共享屏 — props 注入式跨端组件(wrapper 负责 getProfile / updateProfile / Alert) */
export type { ProfileEditScreenProps }

const GENDERS: Array<{ value: Gender; key: 'male' | 'female' | 'secret' }> = [
  { value: 1, key: 'male' },
  { value: 2, key: 'female' },
  { value: 0, key: 'secret' },
]

const GENDER_KEYS: Record<'male' | 'female' | 'secret', string> = {
  male: 'profileEdit.genderMale',
  female: 'profileEdit.genderFemale',
  secret: 'profileEdit.genderSecret',
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
      <View style={styles.container}>
        <ScreenSkeleton variant="list" count={4} colorScheme={colorScheme} />
      </View>
    )
  }

  // 初次加载失败(无任何资料数据)→ 展示 retry 视图
  if (error && !nickname && !avatar) {
    return (
      <View style={styles.container}>
        <ErrorState
          message={error}
          onRetry={onRetry}
          retryLabel={t('profileEdit.retry')}
          colorScheme={colorScheme}
        />
      </View>
    )
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 14, gap: 12 }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <BackChevron
          onPress={onBack}
          label={t('common.back')}
          colorScheme={colorScheme}
          style={styles.backBtn}
        />
        <Text style={styles.title}>{t('profileEdit.title')}</Text>
      </View>

      <View style={styles.avatarWrap}>
        <TouchableOpacity onPress={onOpenAvatarModal} activeOpacity={0.8}>
          {avatar ? (
            <Image source={{ uri: avatar }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Camera size={28} color={tk.text.medium} />
            </View>
          )}
          <View style={styles.avatarEditBadge}>
            <SquarePen size={14} color={tk.brand.ctaForeground} />
          </View>
        </TouchableOpacity>
        <Text style={styles.avatarTip}>{t('profileEdit.avatarTip')}</Text>
      </View>

      <View style={styles.fieldCard}>
        <Text style={styles.fieldLabel}>{t('profileEdit.nickname')}</Text>
        <TextField
          colorScheme={colorScheme}
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
        <TextField
          colorScheme={colorScheme}
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
          <ActivityIndicator color={tk.brand.ctaForeground} />
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
            <TextField
              colorScheme={colorScheme}
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
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: rnSpacing.xs,
      paddingVertical: rnSpacing.sm,
    },
    backBtn: { marginRight: rnSpacing.md },
    title: { ...rnType.heading, color: tk.text.primary },
    avatarWrap: { alignItems: 'center', paddingVertical: rnSpacing.lg, gap: rnSpacing.sm },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: rnRadius['2xl'],
      backgroundColor: tk.surface.light,
    },
    avatarFallback: {
      width: 48,
      height: 48,
      borderRadius: rnRadius['2xl'],
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
      borderRadius: rnRadius.xl,
      backgroundColor: tk.brand.cta,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarEditBadgeText: { fontSize: rnType.body.size, color: tk.surface.light },
    avatarTip: { fontSize: rnType.caption.size, color: tk.text.tertiary },
    fieldCard: {
      backgroundColor: tk.surface.light,
      borderRadius: rnRadius.lg,
      padding: rnSpacing.md,
    },
    fieldLabel: {
      fontSize: rnType.body.size,
      fontWeight: '600',
      color: tk.text.secondary,
      marginBottom: rnSpacing.sm,
    },
    fieldInput: {
      borderWidth: 1,
      borderColor: tk.border.light,
      borderRadius: rnRadius.sm,
      paddingHorizontal: rnSpacing.md,
      height: 50,
      backgroundColor: tk.surface.muted,
      fontSize: rnType.title.size,
      color: tk.text.primary,
    },
    bioInput: { minHeight: 80, paddingTop: rnSpacing.md },
    bioCounter: {
      fontSize: rnType.label.size,
      color: tk.text.tertiary,
      textAlign: 'right',
      marginTop: rnSpacing.sm,
    },
    genderRow: { flexDirection: 'row', gap: rnSpacing.sm },
    genderItem: {
      flex: 1,
      paddingVertical: rnSpacing.sm,
      borderRadius: rnRadius.xl,
      backgroundColor: tk.surface.light,
      borderWidth: 1,
      borderColor: tk.border.light,
      alignItems: 'center',
    },
    genderItemActive: { backgroundColor: tk.brand.cta },
    genderText: { fontSize: rnType.body.size, color: tk.text.secondary },
    genderTextActive: { color: tk.surface.light },
    errorBar: {
      backgroundColor: tk.danger.light,
      borderRadius: rnRadius.lg,
      padding: rnSpacing.sm,
    },
    errorText: { fontSize: rnType.body.size, color: tk.error.text },
    saveBtn: {
      height: 50,
      justifyContent: 'center',
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.cta,
      alignItems: 'center',
    },
    btnDisabled: { opacity: 0.6 },
    saveText: { color: tk.surface.light, ...rnType.title },
    modalOverlay: {
      flex: 1,
      backgroundColor: tk.overlay.modal,
      alignItems: 'center',
      justifyContent: 'center',
      padding: rnSpacing['2xl'],
    },
    modalCard: {
      backgroundColor: tk.surface.light,
      borderRadius: rnRadiusFor.panel,
      padding: rnSpacing.lg,
      width: '100%',
    },
    modalTitle: { ...rnType.subtitle, color: tk.text.primary, marginBottom: rnSpacing.md },
    modalLabel: {
      fontSize: rnType.body.size,
      color: tk.text.secondary,
      marginBottom: rnSpacing.sm,
    },
    modalInput: {
      borderWidth: 1,
      borderColor: tk.border.light,
      borderRadius: rnRadius.sm,
      paddingHorizontal: rnSpacing.md,
      height: 50,
      backgroundColor: tk.surface.muted,
      fontSize: rnType.title.size,
      color: tk.text.primary,
    },
    modalHint: { fontSize: rnType.caption.size, color: tk.text.tertiary, marginTop: rnSpacing.sm },
    modalActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: rnSpacing.sm,
      marginTop: rnSpacing.lg,
    },
    modalCancelBtn: {
      paddingHorizontal: rnSpacing.md,
      height: 44,
      justifyContent: 'center',
      borderRadius: rnRadius.sm,
      backgroundColor: tk.surface.muted,
    },
    modalCancelText: { fontSize: rnType.body.size, color: tk.text.secondary },
    modalConfirmBtn: {
      paddingHorizontal: rnSpacing.md,
      height: 44,
      justifyContent: 'center',
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.cta,
    },
    modalConfirmText: { fontSize: rnType.body.size, color: tk.surface.light },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
