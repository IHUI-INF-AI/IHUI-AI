// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useState } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { rnRadius } from '@ihui/design-tokens'
import { TextField } from '@ihui/rn-app'
import { tokens } from '../theme/active-tokens'
import { NavBar } from '../components/NavBar'
import { NavChrome } from '../components/NavChrome'
import { appAlert } from '../components/BottomPops'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

/**
 * 发布需求(广场新建)—— 对齐 web /plaza/new。
 * 契约实读自 apps/api/src/routes/plaza.ts:42-54 createPlazaSchema:
 * title 2-200、description 10-10000、lowestPrice/peakPrice>0、contact≤200、
 * cycle/cycleUnit≤50/20、closingTime 需 ISO datetime;服务端另校验起步价不得高于最高价。
 */
type Nav = NativeStackNavigationProp<RootStackParamList>

export default function PlazaNewScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<Nav>()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [contact, setContact] = useState('')
  const [lowestPrice, setLowestPrice] = useState('')
  const [peakPrice, setPeakPrice] = useState('')
  const [cycle, setCycle] = useState('')
  const [saving, setSaving] = useState(false)

  const onSubmit = useCallback(async () => {
    const trimmedTitle = title.trim()
    const trimmedDesc = description.trim()
    if (trimmedTitle.length < 2 || trimmedDesc.length < 10) {
      appAlert(t('common.error'), t('plazaNew.validationHint'))
      return
    }
    const low = lowestPrice.trim() === '' ? undefined : Number(lowestPrice)
    const peak = peakPrice.trim() === '' ? undefined : Number(peakPrice)
    if (
      (low !== undefined && !Number.isFinite(low)) ||
      (peak !== undefined && !Number.isFinite(peak))
    ) {
      appAlert(t('common.error'), t('plazaNew.priceInvalid'))
      return
    }
    if (low !== undefined && peak !== undefined && low > peak) {
      appAlert(t('common.error'), t('plazaNew.priceOrder'))
      return
    }
    const body: Record<string, unknown> = { title: trimmedTitle, description: trimmedDesc }
    if (contact.trim()) body.contact = contact.trim()
    if (cycle.trim()) body.cycle = cycle.trim()
    if (low !== undefined) body.lowestPrice = low
    if (peak !== undefined) body.peakPrice = peak

    setSaving(true)
    try {
      const res = await fetchApi<{ id: string }>('/api/plaza', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      if (!res.success) {
        appAlert(t('common.error'), res.error || t('plazaNew.failed'))
        return
      }
      appAlert(t('plazaNew.success'))
      navigation.goBack()
    } catch {
      appAlert(t('common.error'), t('plazaNew.failed'))
    } finally {
      setSaving(false)
    }
  }, [contact, cycle, description, lowestPrice, navigation, peakPrice, t, title])

  const styles = makeStyles()

  return (
    <View style={styles.container}>
      <NavChrome>
        <NavBar title={t('plazaNew.title')} onBack={() => navigation.goBack()} />
      </NavChrome>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.hint}>{t('plazaNew.subtitle')}</Text>

        <Text style={styles.label}>{t('plazaNew.fieldTitle')}</Text>
        <TextField
          colorScheme={resolvedTheme}
          value={title}
          onChangeText={setTitle}
          placeholder={t('plazaNew.titlePlaceholder')}
          maxLength={200}
          style={styles.input}
          editable={!saving}
        />

        <Text style={styles.label}>{t('plazaNew.fieldDescription')}</Text>
        <TextField
          colorScheme={resolvedTheme}
          value={description}
          onChangeText={setDescription}
          placeholder={t('plazaNew.descriptionPlaceholder')}
          multiline
          numberOfLines={8}
          style={[styles.input, styles.descInput]}
          editable={!saving}
        />

        <View style={styles.row}>
          <View style={styles.rowCell}>
            <Text style={styles.label}>{t('plazaNew.lowestPrice')}</Text>
            <TextField
              colorScheme={resolvedTheme}
              value={lowestPrice}
              onChangeText={setLowestPrice}
              keyboardType="decimal-pad"
              placeholder={t('plazaNew.pricePlaceholder')}
              style={styles.input}
              editable={!saving}
            />
          </View>
          <View style={styles.rowCell}>
            <Text style={styles.label}>{t('plazaNew.peakPrice')}</Text>
            <TextField
              colorScheme={resolvedTheme}
              value={peakPrice}
              onChangeText={setPeakPrice}
              keyboardType="decimal-pad"
              placeholder={t('plazaNew.pricePlaceholder')}
              style={styles.input}
              editable={!saving}
            />
          </View>
        </View>

        <Text style={styles.label}>{t('plazaNew.contact')}</Text>
        <TextField
          colorScheme={resolvedTheme}
          value={contact}
          onChangeText={setContact}
          placeholder={t('plazaNew.contactPlaceholder')}
          maxLength={200}
          style={styles.input}
          editable={!saving}
        />

        <Text style={styles.label}>{t('plazaNew.cycle')}</Text>
        <TextField
          colorScheme={resolvedTheme}
          value={cycle}
          onChangeText={setCycle}
          placeholder={t('plazaNew.cyclePlaceholder')}
          maxLength={50}
          style={styles.input}
          editable={!saving}
        />

        <TouchableOpacity
          style={[styles.submit, saving && styles.submitDisabled]}
          onPress={() => void onSubmit()}
          disabled={saving}
          activeOpacity={0.7}
        >
          <Text style={styles.submitText}>
            {saving ? t('plazaNew.submitting') : t('plazaNew.submit')}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  )
}

function makeStyles() {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tokens.surface.bg },
    body: { padding: 16, gap: 4, paddingBottom: 40 },
    hint: { fontSize: 13, color: tokens.text.secondary, marginBottom: 6 },
    label: { fontSize: 14, color: tokens.text.secondary, marginTop: 10 },
    input: {
      height: 44,
      paddingHorizontal: 12,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tokens.border.medium,
      color: tokens.text.primary,
      fontSize: 15,
      backgroundColor: tokens.surface.card,
    },
    descInput: { height: 176, paddingTop: 12, paddingBottom: 12, textAlignVertical: 'top' },
    row: { flexDirection: 'row', gap: 12 },
    rowCell: { flex: 1 },
    submit: {
      height: 46,
      marginTop: 22,
      borderRadius: rnRadius.sm,
      backgroundColor: tokens.brand.cta,
      alignItems: 'center',
      justifyContent: 'center',
    },
    submitDisabled: { opacity: 0.5 },
    submitText: { fontSize: 16, fontWeight: '600', color: tokens.brand.ctaForeground },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
