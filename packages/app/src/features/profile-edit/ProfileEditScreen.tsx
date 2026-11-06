// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import { TextField } from '../../components/TextField'
import { SquarePen, User } from 'lucide-react-native'
import type { AvatarEditorProps, Gender, ProfileEditScreenProps } from '../../types'

import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { BackChevron } from '../../components/BackChevron'
import { ErrorState, ScreenSkeleton } from '../../components/ScreenStates'

/**
 * 头像编辑共享组件 — props 注入式跨端组件。
 * 相册/相机/文件选择等平台能力只走回调注入,本组件内零平台 API;
 * RN 资料页与小程序头像页各自注入本端实现。
 */
export type { AvatarEditorProps, ProfileEditScreenProps }

export function AvatarEditor({
  t,
  currentUrl,
  onPickFromAlbum,
  onPickFromCamera,
  onUpload,
  uploading,
  error,
  onPreview,
  nickname,
  showUrlEntry = false,
  colorScheme = 'light',
}: AvatarEditorProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createAvatarStyles(tk), [tk])
  const [urlInput, setUrlInput] = useState('')

  return (
    <View style={styles.avatarWrap}>
      <TouchableOpacity
        onPress={onPreview}
        activeOpacity={0.8}
        testID="avatar-preview"
        disabled={uploading}
      >
        {currentUrl ? (
          <Image source={{ uri: currentUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <User size={36} color={tk.text.medium} />
          </View>
        )}
        <View style={styles.avatarEditBadge}>
          <SquarePen size={14} color={tk.brand.ctaForeground} />
        </View>
      </TouchableOpacity>
      {nickname ? <Text style={styles.avatarNickname}>{nickname}</Text> : null}

      {onPickFromAlbum || onPickFromCamera ? (
        <View style={styles.avatarActions}>
          {onPickFromAlbum ? (
            <TouchableOpacity
              style={[styles.avatarActionBtn, uploading && styles.btnDisabled]}
              onPress={onPickFromAlbum}
              disabled={uploading}
              testID="avatar-pick-album"
            >
              <Text style={styles.avatarActionPrimaryText}>{t('user.avatar.fromAlbum')}</Text>
            </TouchableOpacity>
          ) : null}
          {onPickFromCamera ? (
            <TouchableOpacity
              style={[styles.avatarActionBtn, styles.avatarActionBtnOutline]}
              onPress={onPickFromCamera}
              disabled={uploading}
              testID="avatar-pick-camera"
            >
              <Text style={styles.avatarActionOutlineText}>{t('user.avatar.takePhoto')}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      <View style={styles.avatarHint}>
        <Text style={styles.avatarHintText}>{t('user.avatar.formatHint')}</Text>
        <Text style={styles.avatarHintText}>{t('user.avatar.sizeHint')}</Text>
      </View>
      {showUrlEntry ? (
        <View style={styles.avatarUrlEntry} testID="avatar-url-entry">
          <TextField
            colorScheme={colorScheme}
            style={styles.avatarUrlInput}
            value={urlInput}
            onChangeText={setUrlInput}
            placeholder={t('profileEdit.avatarUrlPlaceholder')}
            placeholderTextColor={tk.text.tertiary}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={[styles.avatarUrlBtn, uploading && styles.btnDisabled]}
            onPress={() => onUpload(urlInput.trim())}
            disabled={uploading}
            testID="avatar-url-submit"
          >
            <Text style={styles.avatarActionPrimaryText}>{t('profileEdit.avatarUrlApply')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      {error ? <Text style={styles.avatarError}>{error}</Text> : null}

      {uploading ? (
        <View style={styles.avatarMask} testID="avatar-upload-mask">
          <ActivityIndicator color={tk.surface.light} />
          <Text style={styles.avatarMaskText}>{t('user.avatar.uploading')}</Text>
        </View>
      ) : null}
    </View>
  )
}

function createAvatarStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    avatarWrap: { alignItems: 'center', paddingVertical: rnSpacing.lg, gap: rnSpacing.sm },
    avatar: {
      width: 96,
      height: 96,
      borderRadius: rnRadius['2xl'],
      backgroundColor: tk.surface.light,
    },
    avatarFallback: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tk.border.light,
    },
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
    avatarNickname: { ...rnType.subtitle, color: tk.text.primary },
    avatarActions: { flexDirection: 'row', gap: rnSpacing.sm },
    avatarActionBtn: {
      height: 44,
      paddingHorizontal: rnSpacing.lg,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.cta,
    },
    avatarActionBtnOutline: {
      backgroundColor: tk.surface.light,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    avatarActionPrimaryText: { fontSize: rnType.body.size, color: tk.surface.light },
    avatarActionOutlineText: { fontSize: rnType.body.size, color: tk.text.secondary },
    avatarHint: { alignItems: 'center', gap: rnSpacing['2xs'] },
    avatarHintText: { fontSize: rnType.caption.size, color: tk.text.tertiary },
    avatarUrlEntry: { width: '100%', gap: rnSpacing.sm, marginTop: rnSpacing.sm },
    avatarUrlInput: {
      borderWidth: 1,
      borderColor: tk.border.light,
      borderRadius: rnRadius.sm,
      paddingHorizontal: rnSpacing.md,
      height: 50,
      backgroundColor: tk.surface.light,
      fontSize: rnType.body.size,
      color: tk.text.primary,
    },
    avatarUrlBtn: {
      height: 44,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.cta,
    },
    avatarError: { fontSize: rnType.caption.size, color: tk.error.text },
    btnDisabled: { opacity: 0.6 },
    avatarMask: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: tk.overlay.modal,
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.sm,
      borderRadius: rnRadius.lg,
    },
    avatarMaskText: { fontSize: rnType.body.size, color: tk.surface.light },
  })
}

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
  avatarEditor,
  onNicknameChange,
  onBioChange,
  onGenderChange,
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
      contentContainerStyle={{ padding: 14, gap: rnSpacing.md }}
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

      {avatarEditor}

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
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
