// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { ChangePhoneScreenProps } from '../../types'
import { ChevronDown } from 'lucide-react-native'

import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { TextField } from '../../components/TextField'
import { Tappable } from '@ihui/ui-native'

/** 换绑手机共享屏 — props 注入式跨端组件(wrapper 负责 fetchApi + setInterval 倒计时)。
 *  用户可见文案一律走注入的 t(),键与 web 同源(门 291)。 */
export type { ChangePhoneScreenProps }

export function ChangePhoneScreen({
  t,
  phoneNumber,
  codeValue,
  phoneHead,
  nationShow,
  codeMin,
  sendCodeShow,
  tip,
  submitting,
  nations,
  onPhoneChange,
  onCodeChange,
  onToggleNationShow,
  onSelectNation,
  onSendCode,
  onSubmit,
  oldPhone,
  oldCode,
  oldCodeMin,
  onOldCodeChange,
  onSendOldCode,
  colorScheme = 'light',
}: ChangePhoneScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])
  const oldCodeMissing = !!oldPhone && !(oldCode ?? '').trim()

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>{t('user.profile.changePhoneTitle')}</Text>

      {oldPhone ? (
        <>
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>{t('user.profile.oldPhone')}</Text>
            <View style={styles.oldPhoneBox}>
              <Text style={styles.oldPhoneText}>{oldPhone}</Text>
            </View>
          </View>
          <View style={styles.inputWbox}>
            <Text style={styles.fieldLabel}>{t('user.profile.oldCode')}</Text>
            <View style={styles.inputBox}>
              <TextField
                colorScheme={colorScheme}
                style={styles.input}
                value={oldCode ?? ''}
                onChangeText={onOldCodeChange}
                placeholder={t('user.profile.codePlaceholder')}
                placeholderTextColor={tk.text.tertiary}
                keyboardType="number-pad"
                maxLength={6}
              />
              {oldCodeMin && oldCodeMin > 0 ? (
                <Text style={styles.countdownText}>
                  {t('user.profile.resend', { seconds: oldCodeMin })}
                </Text>
              ) : (
                <Tappable
                  style={styles.sendBtn}
                  onPress={onSendOldCode}
                  accessibilityLabel={t('user.profile.sendOldCode')}
                >
                  <Text style={styles.sendText}>{t('user.profile.sendOldCode')}</Text>
                </Tappable>
              )}
            </View>
          </View>
        </>
      ) : null}

      <View style={styles.inputWbox}>
        <View style={styles.inputBox}>
          <Tappable
            style={styles.areaBox}
            onPress={onToggleNationShow}
            accessibilityLabel={t('changePhone.selectNation')}
          >
            <Text style={styles.areaText}>{phoneHead}</Text>
            <ChevronDown size={10} color={tk.text.tertiary} style={{ marginLeft: rnSpacing.sm }} />
          </Tappable>
          <TextField
            colorScheme={colorScheme}
            style={styles.input}
            value={phoneNumber}
            onChangeText={onPhoneChange}
            placeholder={t('user.profile.newPhonePlaceholder')}
            placeholderTextColor={tk.text.tertiary}
            keyboardType="phone-pad"
            maxLength={11}
          />
        </View>
        {nationShow ? (
          <View style={styles.nationBox}>
            {nations.map((n) => (
              <Tappable
                key={n.id}
                style={styles.nationItem}
                onPress={() => onSelectNation(n)}
                accessibilityLabel={`${n.title} ${n.content}`}
              >
                <Text style={styles.nationTitle}>{n.title}</Text>
                <Text style={styles.nationCode}>{n.content}</Text>
              </Tappable>
            ))}
          </View>
        ) : null}
      </View>

      <View style={styles.inputWbox}>
        <View style={styles.inputBox}>
          <TextField
            colorScheme={colorScheme}
            style={styles.input}
            value={codeValue}
            onChangeText={onCodeChange}
            placeholder={t('user.profile.codePlaceholder')}
            placeholderTextColor={tk.text.tertiary}
            keyboardType="number-pad"
            maxLength={6}
          />
          {sendCodeShow ? (
            <Tappable
              style={styles.sendBtn}
              onPress={onSendCode}
              accessibilityLabel={t('user.profile.sendNewCode')}
            >
              <Text style={styles.sendText}>{t('user.profile.sendNewCode')}</Text>
            </Tappable>
          ) : codeMin > 0 ? (
            <Text style={styles.countdownText}>
              {t('user.profile.resend', { seconds: codeMin })}
            </Text>
          ) : (
            <Tappable
              style={styles.sendBtn}
              onPress={onSendCode}
              accessibilityLabel={t('user.profile.sendNewCode')}
            >
              <Text style={styles.sendText}>{t('user.profile.sendNewCode')}</Text>
            </Tappable>
          )}
        </View>
      </View>

      {tip ? <Text style={styles.tipText}>{tip}</Text> : null}

      <Tappable
        style={[styles.submitBtn, (submitting || oldCodeMissing) && styles.submitBtnDisabled]}
        onPress={onSubmit}
        disabled={submitting || oldCodeMissing}
        accessibilityLabel={t('user.profile.confirmChange')}
      >
        <Text style={styles.submitText}>
          {submitting ? t('changePhone.submitting') : t('user.profile.confirmChange')}
        </Text>
      </Tappable>
    </ScrollView>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    content: { padding: rnSpacing['2xl'] },
    title: {
      fontSize: rnType.heading.size,
      fontWeight: '700',
      color: tk.text.primary,
      textAlign: 'center',
      marginBottom: rnSpacing['2xl'],
    },
    inputWbox: { width: '100%', marginBottom: rnSpacing.lg },
    fieldGroup: { width: '100%', marginBottom: rnSpacing.lg },
    fieldLabel: {
      fontSize: rnType.body.size,
      fontWeight: '600',
      color: tk.text.primary,
      marginBottom: rnSpacing.sm,
    },
    oldPhoneBox: {
      height: 50,
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: tk.border.light,
      borderRadius: rnRadius.xl,
      paddingHorizontal: rnSpacing.md,
      backgroundColor: tk.surface.muted,
    },
    oldPhoneText: { fontSize: rnType.title.size, color: tk.text.secondary },
    inputBox: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: tk.border.light,
      borderRadius: rnRadius.xl,
      paddingHorizontal: rnSpacing.md,
      height: 50,
      backgroundColor: tk.surface.muted,
    },
    areaBox: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingRight: rnSpacing.md,
      marginRight: rnSpacing.md,
    },
    areaText: { fontSize: rnType.title.size, color: tk.text.medium },
    areaArrow: { fontSize: rnType.badge.size, color: tk.text.tertiary, marginLeft: rnSpacing.sm },
    input: { flex: 1, fontSize: rnType.title.size, color: tk.text.primary, padding: 0 },
    sendBtn: { paddingLeft: rnSpacing.md },
    sendText: { fontSize: rnType.body.size, fontWeight: '700', color: tk.brand.DEFAULT },
    countdownText: {
      fontSize: rnType.body.size,
      color: tk.text.secondary,
      paddingLeft: rnSpacing.md,
    },
    nationBox: {
      marginTop: rnSpacing.sm,
      borderWidth: 1,
      borderColor: tk.border.light,
      borderRadius: rnRadius.xl,
      backgroundColor: tk.surface.light,
      overflow: 'hidden',
    },
    nationItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: rnSpacing['md-loose'],
      paddingVertical: rnSpacing['sm-loose'],
      gap: rnSpacing.md,
    },
    nationTitle: { fontSize: rnType.body.size, color: tk.text.primary },
    nationCode: { fontSize: rnType.body.size, color: tk.text.tertiary },
    tipText: { fontSize: rnType.body.size, color: tk.danger.DEFAULT, marginBottom: rnSpacing.md },
    submitBtn: {
      height: 50,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.cta,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: rnSpacing.sm,
    },
    submitBtnDisabled: { opacity: 0.6 },
    submitText: { fontSize: rnType.title.size, fontWeight: '700', color: tk.brand.ctaForeground },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
