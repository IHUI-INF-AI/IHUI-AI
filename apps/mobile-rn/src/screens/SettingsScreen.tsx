import { useEffect, useState } from 'react'
import { ScrollView, Text, View, Alert, TouchableOpacity } from 'react-native'
import { Button, Input } from '@ihui/ui-native'
import { useBiometrics } from '../hooks/use-biometrics'
import { useClipboard } from '../hooks/use-clipboard'
import { usePush } from '../hooks/use-push'
import { useScreenshot } from '../hooks/use-screenshot'
import { useAuth } from '../context/AuthContext'
import { useI18n, type Locale } from '../i18n'

const LANGS: Array<{ value: Locale; key: 'zhCN' | 'en' | 'ja' | 'ko' | 'zhTW' }> = [
  { value: 'zh-CN', key: 'zhCN' },
  { value: 'en', key: 'en' },
  { value: 'ja', key: 'ja' },
  { value: 'ko', key: 'ko' },
  { value: 'zh-TW', key: 'zhTW' },
]

export default function SettingsScreen() {
  const { user, logout } = useAuth()
  const { t, locale, setLocale } = useI18n()
  const bio = useBiometrics()
  const clip = useClipboard()
  const push = usePush()
  const shot = useScreenshot()
  const [clipboardInput, setClipboardInput] = useState('')

  useEffect(() => {
    void bio.probe()
  }, [bio])

  const onAuth = async () => {
    const r = await bio.authenticate(t('setting.biometricUnlock'))
    Alert.alert(
      r.success ? t('setting.biometricSuccess') : t('setting.biometricFailed'),
      r.success ? t('setting.biometricEnabled') : (r.error ?? t('setting.unknownError')),
    )
  }

  const onSelectLocale = (v: Locale) => {
    if (v === locale) return
    void setLocale(v)
  }

  return (
    <ScrollView className="flex-1 bg-white p-4 dark:bg-black">
      <Text className="mb-2 text-xl font-semibold text-neutral-900 dark:text-neutral-50">
        {t('setting.language')}
      </Text>
      <View className="mb-6 rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900">
        {LANGS.map((l, idx) => (
          <TouchableOpacity
            key={l.value}
            onPress={() => onSelectLocale(l.value)}
            className={`flex-row items-center justify-between px-2 py-3 ${
              idx < LANGS.length - 1 ? 'border-b border-neutral-200 dark:border-neutral-800' : ''
            }`}
          >
            <Text className="text-base text-neutral-900 dark:text-neutral-50">
              {t(`setting.${l.key}`)}
            </Text>
            {locale === l.value && <Text className="text-base text-blue-500">✓</Text>}
          </TouchableOpacity>
        ))}
      </View>

      <Text className="mb-2 text-xl font-semibold text-neutral-900 dark:text-neutral-50">
        {t('setting.account')}
      </Text>
      <View className="mb-6 rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900">
        <Text className="text-sm text-neutral-500">{t('setting.currentUser')}</Text>
        <Text className="text-base text-neutral-900 dark:text-neutral-50">
          {user?.nickname ?? t('setting.notLoggedIn')}
        </Text>
      </View>

      <Text className="mb-2 text-xl font-semibold text-neutral-900 dark:text-neutral-50">
        {t('setting.biometrics')}
      </Text>
      <View className="mb-6 rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900">
        <Text className="mb-2 text-sm text-neutral-600 dark:text-neutral-400">
          {t('setting.hardwareSupported')}:{bio.supported ? '✓' : '✗'} · {t('setting.enrolled')}:
          {bio.enrolled ? '✓' : '✗'}
        </Text>
        <Button onPress={onAuth} variant="default">
          {t('setting.verifyIdentity')}
        </Button>
      </View>

      <Text className="mb-2 text-xl font-semibold text-neutral-900 dark:text-neutral-50">
        {t('setting.clipboard')}
      </Text>
      <View className="mb-6 rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900">
        <Input
          value={clipboardInput}
          onChangeText={setClipboardInput}
          placeholder={t('setting.clipboardInputPlaceholder')}
          className="mb-2"
        />
        <View className="flex-row gap-2">
          <Button onPress={() => clip.copy(clipboardInput)} variant="default">
            {t('setting.copy')}
          </Button>
          <Button
            onPress={async () => {
              const v = await clip.read()
              setClipboardInput(v)
            }}
            variant="outline"
          >
            {t('setting.read')}
          </Button>
        </View>
        {clip.lastCopied !== null && (
          <Text className="mt-2 text-xs text-neutral-500">
            {t('setting.copied')}:{clip.lastCopied}
          </Text>
        )}
      </View>

      <Text className="mb-2 text-xl font-semibold text-neutral-900 dark:text-neutral-50">
        {t('setting.pushNotification')}
      </Text>
      <View className="mb-6 rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900">
        <Text className="mb-2 text-sm text-neutral-600 dark:text-neutral-400">
          {t('setting.permission')}:{push.state.permission}
        </Text>
        {push.state.error && <Text className="mb-2 text-xs text-red-500">{push.state.error}</Text>}
        {push.state.token && (
          <Text className="mb-2 text-xs text-neutral-500">Token:{push.state.token}</Text>
        )}
        <Button onPress={() => void push.register()} variant="default">
          {t('setting.registerPush')}
        </Button>
      </View>

      <Text className="mb-2 text-xl font-semibold text-neutral-900 dark:text-neutral-50">
        {t('setting.screenshot')}
      </Text>
      <View className="mb-6 rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900">
        <Text className="mb-2 text-sm text-neutral-600 dark:text-neutral-400">
          {t('setting.status')}:
          {shot.busy
            ? t('setting.capturing')
            : shot.lastUri
              ? t('setting.saved')
              : t('setting.ready')}
        </Text>
        {shot.lastUri && <Text className="mb-2 text-xs text-neutral-500">{shot.lastUri}</Text>}
        <Text className="text-xs text-neutral-500">{t('setting.screenshotTip')}</Text>
      </View>

      <Button onPress={logout} variant="destructive">
        {t('auth.logout')}
      </Button>
    </ScrollView>
  )
}
