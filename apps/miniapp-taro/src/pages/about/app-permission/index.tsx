import { View, Text } from '@tarojs/components'
import { useI18n } from '@/i18n'
import './index.css'

const REQUIRED_FLAGS = [true, false, true, false, false, true, false, true]

export default function AppPermission() {
  const { t, tList } = useI18n()
  const names = tList('about.appPermission.names')
  const descs = tList('about.appPermission.descs')
  const permissions = names.map((name, i) => ({
    name,
    desc: descs[i] || '',
    required: REQUIRED_FLAGS[i] ?? false,
  }))

  return (
    <View className="page">
      <View className="intro">
        <Text className="intro-text">{t('about.appPermission.intro')}</Text>
      </View>

      <View className="card">
        {permissions.map((p, idx) => (
          <View key={p.name} className={`row${idx === permissions.length - 1 ? ' last' : ''}`}>
            <View className="body">
              <View className="head">
                <Text className="name">{p.name}</Text>
                {p.required ? (
                  <Text className="tag">{t('about.appPermission.required')}</Text>
                ) : (
                  <Text className="tag opt">{t('about.appPermission.optional')}</Text>
                )}
              </View>
              <Text className="desc">{p.desc}</Text>
            </View>
          </View>
        ))}
      </View>

      <View className="tips">
        <Text>{t('about.appPermission.footer')}</Text>
      </View>
    </View>
  )
}
