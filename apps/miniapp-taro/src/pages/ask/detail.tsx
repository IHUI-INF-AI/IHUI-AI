import { View, Text, Image, Input, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback, useEffect } from 'react'
import { getAskDetail, type Ask } from '@/api'
import './detail.css'

interface AnswerItem {
  author: string
  avatar?: string
  time: string
  content: string
}

export default function AskDetailPage() {
  const [data, setData] = useState<Ask>({} as Ask)
  const [answers, setAnswers] = useState<AnswerItem[]>([])
  const [answer, setAnswer] = useState('')
  const [id, setId] = useState('')

  const load = useCallback(async () => {
    if (!id) return
    try {
      setData(await getAskDetail(id))
    } catch (e) {
      console.error('[ask/detail] 获取问题详情 failed:', e)
      Taro.showToast({ title: '操作失败', icon: 'none' })
    }
  }, [id])

  useDidShow(() => {
    const instance = Taro.getCurrentInstance()
    const q = instance?.router?.params
    if (q?.id) {
      setId(q.id)
      load()
    }
  })

  useEffect(() => {
    if (id) load()
  }, [id, load])

  const onAnswer = useCallback(() => {
    if (!answer) return
    setAnswers((prev) => [...prev, { author: '我', time: '刚刚', content: answer }])
    setAnswer('')
    Taro.showToast({ title: '回答成功', icon: 'success' })
  }, [answer])

  return (
    <View className="page">
      {data.title ? (
        <View className="head">
          <Text className="title">{data.title}</Text>
          <View className="meta">
            <Image
              className="avatar"
              src={data.avatar || '/static/default-avatar.png'}
              mode="aspectFill"
            />
            <Text className="author">{data.author}</Text>
            <Text className="time">{data.createTime}</Text>
          </View>
          <View className="content">{data.content}</View>
        </View>
      ) : null}

      {answers.length ? (
        <View className="answers">
          <View className="answers-title">{answers.length}个回答</View>
          {answers.map((a, i) => (
            <View key={i} className="answer">
              <View className="a-head">
                <Image
                  className="avatar"
                  src={a.avatar || '/static/default-avatar.png'}
                  mode="aspectFill"
                />
                <Text className="a-author">{a.author}</Text>
                <Text className="a-time">{a.time}</Text>
              </View>
              <View className="a-content">{a.content}</View>
            </View>
          ))}
        </View>
      ) : null}

      <View className="footer">
        <Input
          className="input"
          value={answer}
          placeholder="写下你的回答"
          onInput={(e) => setAnswer(e.detail.value)}
        />
        <Button className="btn" size="mini" onClick={onAnswer} disabled={!answer}>
          回答
        </Button>
      </View>
    </View>
  )
}
