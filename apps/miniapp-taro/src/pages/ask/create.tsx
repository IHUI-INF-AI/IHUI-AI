import { View, Text, Input, Textarea, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { createAsk } from '@/api'
import './create.css'

interface FormState {
  title: string
  content: string
  reward: number
}

const REWARDS = [0, 5, 10, 20, 50]

export default function AskCreatePage() {
  const [form, setForm] = useState<FormState>({ title: '', content: '', reward: 0 })

  const onSubmit = useCallback(async () => {
    try {
      await createAsk({ title: form.title, content: form.content })
      Taro.showToast({ title: '发布成功', icon: 'success' })
      setTimeout(() => Taro.navigateBack(), 1500)
    } catch (e) {}
  }, [form.title, form.content])

  return (
    <View className="page">
      <View className="card">
        <Text className="label">问题标题</Text>
        <Input
          className="input"
          value={form.title}
          placeholder="一句话描述你的问题"
          maxlength={50}
          onInput={e => setForm(f => ({ ...f, title: e.detail.value }))}
        />
        <Text className="label">问题详情</Text>
        <Textarea
          className="textarea"
          value={form.content}
          placeholder="详细描述问题背景、已尝试的方法等"
          maxlength={1000}
          onInput={e => setForm(f => ({ ...f, content: e.detail.value }))}
        />
        <Text className="counter">{form.content.length}/1000</Text>
      </View>

      <View className="card">
        <Text className="label">悬赏积分</Text>
        <View className="rewards">
          {REWARDS.map(r => (
            <Text
              key={r}
              className={`reward${form.reward === r ? ' active' : ''}`}
              onClick={() => setForm(f => ({ ...f, reward: r }))}
            >{r}</Text>
          ))}
        </View>
      </View>

      <View className="tips">
        <Text>· 提问前请先搜索，避免重复提问</Text>
        <Text>· 问题应具体明确，便于他人回答</Text>
        <Text>· 采纳回答后悬赏积分将自动发放</Text>
      </View>

      <Button
        className="btn"
        onClick={onSubmit}
        disabled={!form.title || form.content.length < 5}
      >发布问题</Button>
    </View>
  )
}
