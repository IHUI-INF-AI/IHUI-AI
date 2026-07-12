import { View, Text, Video } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { getVideoDetail } from '@/api'

interface VideoInfo {
  id: string
  title: string
  coverUrl?: string
  playUrl?: string
  duration?: string
  description?: string
  teacher?: string
  chapters?: Array<{ id: string; title: string; duration: string; watched?: boolean }>
}

export default function VideoDetailPage() {
  const [info, setInfo] = useState<VideoInfo>({ id: '', title: '' })
  const [loading, setLoading] = useState(true)
  const [currentChapter, setCurrentChapter] = useState<string>('')

  const load = useCallback(async () => {
    const pages = Taro.getCurrentPages()
    const current = pages[pages.length - 1]
    const id = (current?.options?.id || '') as string
    if (!id) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = (await getVideoDetail(id)) as VideoInfo
      setInfo(res)
      const firstChapter = res.chapters?.[0]
      if (firstChapter) {
        setCurrentChapter(firstChapter.id)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useDidShow(load)

  const handleChapterClick = (chapterId: string) => {
    setCurrentChapter(chapterId)
  }

  return (
    <View className="min-h-screen bg-[#f7f8fa]">
      <View className="bg-black w-full" style={{ height: '210px' }}>
        {info.playUrl ? (
          <Video
            className="w-full"
            style={{ height: '210px' }}
            src={info.playUrl}
            poster={info.coverUrl}
            controls
            autoplay={false}
            objectFit="contain"
          />
        ) : (
          <View className="flex items-center justify-center w-full h-full">
            <Text className="text-sm text-gray-400">{loading ? '加载中...' : '暂无视频'}</Text>
          </View>
        )}
      </View>

      <View className="bg-white px-4 py-3">
        <Text className="block text-base font-medium text-gray-800">
          {info.title || '视频详情'}
        </Text>
        <View className="flex items-center mt-2">
          {info.teacher && <Text className="text-xs text-gray-500 mr-3">讲师: {info.teacher}</Text>}
          {info.duration && <Text className="text-xs text-gray-400">时长: {info.duration}</Text>}
        </View>
        {info.description && (
          <Text className="block text-sm text-gray-500 mt-2 leading-relaxed">
            {info.description}
          </Text>
        )}
      </View>

      {info.chapters && info.chapters.length > 0 && (
        <View className="mx-3 mt-3 bg-white rounded-xl px-4 py-3">
          <Text className="block text-sm font-medium text-gray-800 mb-3">
            章节列表 ({info.chapters.length})
          </Text>
          {info.chapters.map((chapter, idx) => {
            const active = chapter.id === currentChapter
            return (
              <View
                key={chapter.id}
                className={`flex items-center py-2.5 px-3 mb-1.5 rounded-lg ${
                  active ? 'bg-gray-100' : 'hover:bg-gray-50'
                }`}
                onClick={() => handleChapterClick(chapter.id)}
              >
                <View
                  className={`flex items-center justify-center w-6 h-6 mr-3 rounded-full text-xs ${
                    active ? 'bg-gray-800 text-white' : 'bg-gray-50 text-gray-500'
                  }`}
                >
                  <Text>{idx + 1}</Text>
                </View>
                <View className="flex-1 min-w-0">
                  <Text
                    className={`block text-sm truncate ${
                      active ? 'text-gray-800 font-medium' : 'text-gray-600'
                    }`}
                  >
                    {chapter.title}
                  </Text>
                  <Text className="block text-xs text-gray-400 mt-0.5">{chapter.duration}</Text>
                </View>
                {chapter.watched && <Text className="text-xs text-green-500">✓ 已学</Text>}
              </View>
            )
          })}
        </View>
      )}
    </View>
  )
}
