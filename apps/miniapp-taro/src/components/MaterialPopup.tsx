import { View, Text, ScrollView, Image } from '@tarojs/components'
import { useCallback } from 'react'
import DrawerComponent from './DrawerComponent'
import EmptyState from './EmptyState'
import { useI18n } from '@/i18n'

export type MaterialTab = 1 | 2 | 3 | 4

export interface MaterialItem {
  id: string
  title: string
  thumbnail?: string
  createdAt?: string
  content?: string
  tab?: MaterialTab
}

export interface MaterialPopupProps {
  visible?: boolean
  tab?: MaterialTab
  items?: MaterialItem[]
  loading?: boolean
  hasMore?: boolean
  selectedId?: string
  onTabChange?: (tab: MaterialTab) => void
  onSelect?: (item: MaterialItem) => void
  onClose?: () => void
  onUpload?: (tab: MaterialTab) => void
  onLoadMore?: () => void
}

const TABS: { key: MaterialTab; labelKey: string; icon: string }[] = [
  { key: 1, labelKey: 'ai.materialPopup.tabText', icon: '📝' },
  { key: 2, labelKey: 'ai.materialPopup.tabImage', icon: '🖼️' },
  { key: 3, labelKey: 'ai.materialPopup.tabVideo', icon: '🎬' },
  { key: 4, labelKey: 'ai.materialPopup.tabAudio', icon: '🎵' },
]

function formatTime(ts?: string): string {
  if (!ts) return ''
  try {
    const d = new Date(ts)
    if (isNaN(d.getTime())) return ''
    return `${d.getMonth() + 1}/${d.getDate()}`
  } catch {
    return ''
  }
}

export default function MaterialPopup({
  visible = false,
  tab = 1,
  items = [],
  loading = false,
  hasMore = false,
  selectedId = '',
  onTabChange,
  onSelect,
  onClose,
  onUpload,
  onLoadMore,
}: MaterialPopupProps) {
  const { t } = useI18n()
  const handleScrollToLower = useCallback(() => {
    if (hasMore && !loading && onLoadMore) onLoadMore()
  }, [hasMore, loading, onLoadMore])

  const handleUploadClick = useCallback(() => {
    onUpload?.(tab)
  }, [tab, onUpload])

  const isTextTab = tab === 1
  const isImageTab = tab === 2

  return (
    <DrawerComponent visible={visible} onClose={onClose} height="75vh">
      <View className="flex items-center justify-between px-4 py-3 border-b border-border">
        <Text className="text-base font-semibold text-foreground dark:text-muted-foreground">
          {t('ai.materialPopup.title')}
        </Text>
        <View
          className="px-3 py-1 text-xs rounded-md bg-primary text-white active:bg-primary"
          onClick={handleUploadClick}
        >
          <Text>＋ {t('ai.materialPopup.upload')}</Text>
        </View>
      </View>

      <ScrollView
        scrollX
        className="whitespace-nowrap px-3 py-2 border-b border-border"
      >
        {TABS.map((tabItem) => (
          <View
            key={tabItem.key}
            className={`inline-flex items-center px-3 py-1 mr-2 text-xs rounded-md ${tab === tabItem.key ? 'bg-primary text-white' : 'bg-muted text-foreground dark:text-muted-foreground'}`}
            onClick={() => onTabChange?.(tabItem.key)}
          >
            <Text className="mr-1">{tabItem.icon}</Text>
            <Text>{t(tabItem.labelKey)}</Text>
          </View>
        ))}
      </ScrollView>

      <ScrollView
        scrollY
        className="flex-1"
        style={{ maxHeight: '55vh' }}
        onScrollToLower={handleScrollToLower}
        lowerThreshold={80}
      >
        {loading && !items.length ? (
          <View className="py-12 text-center text-sm text-muted-foreground">
            <Text>{t('ai.common.loading')}</Text>
          </View>
        ) : items.length ? (
          <View className="px-3 py-2">
            {isImageTab ? (
              <View className="grid grid-cols-3 gap-2">
                {items.map((item) => (
                  <View
                    key={item.id}
                    className={`relative aspect-square rounded-lg overflow-hidden bg-muted active:opacity-80 ${selectedId === item.id ? 'ring-2 ring-primary' : ''}`}
                    onClick={() => onSelect?.(item)}
                  >
                    {item.thumbnail ? (
                      <Image className="w-full h-full" src={item.thumbnail} mode="aspectFill" />
                    ) : (
                      <View className="w-full h-full flex items-center justify-center text-2xl text-muted-foreground">
                        <Text>🖼️</Text>
                      </View>
                    )}
                    <View className="absolute bottom-0 left-0 right-0 px-1 py-1 bg-black/40">
                      <Text className="block text-xs text-white truncate">{item.title}</Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View>
                {items.map((item) => (
                  <View
                    key={item.id}
                    className={`flex p-3 mb-2 rounded-xl active:bg-muted ${selectedId === item.id ? 'bg-primary/10 border border-primary' : 'bg-muted'}`}
                    onClick={() => onSelect?.(item)}
                  >
                    <View className="w-12 h-12 mr-3 rounded-lg bg-muted flex items-center justify-center text-xl flex-shrink-0">
                      <Text>
                        {item.thumbnail ? '' : isTextTab ? '📝' : tab === 3 ? '🎬' : '🎵'}
                      </Text>
                    </View>
                    <View className="flex-1 min-w-0">
                      <View className="flex items-center">
                        <Text className="text-sm font-medium text-foreground dark:text-muted-foreground truncate">
                          {item.title}
                        </Text>
                        {selectedId === item.id ? (
                          <Text className="ml-2 text-xs text-primary">✓</Text>
                        ) : null}
                      </View>
                      {isTextTab && item.content ? (
                        <Text className="block text-xs text-muted-foreground dark:text-muted-foreground mt-1 line-clamp-2">
                          {item.content}
                        </Text>
                      ) : null}
                      {item.createdAt ? (
                        <Text className="block text-xs text-muted-foreground mt-1">
                          {formatTime(item.createdAt)}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            )}

            {loading && items.length ? (
              <View className="py-3 text-center text-xs text-muted-foreground">
                <Text>{t('ai.materialPopup.loadMore')}</Text>
              </View>
            ) : null}
            {!loading && !hasMore && items.length ? (
              <View className="py-3 text-center text-xs text-muted-foreground">
                <Text>{t('ai.materialPopup.noMore')}</Text>
              </View>
            ) : null}
          </View>
        ) : (
          <EmptyState text={t('ai.materialPopup.empty')} />
        )}
      </ScrollView>
    </DrawerComponent>
  )
}
