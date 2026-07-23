import { logger } from '@/utils/logger'
import { View, Text, Input, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { updateUserNickname, getProfile } from '@/api'
import { useI18n } from '@/i18n'
import './nickname.css'

const MIN_LENGTH = 2
const MAX_LENGTH = 20
// 允许:中文 / 字母 / 数字 / 下划线,禁止其他特殊符号
const VALID_REG = /^[\u4e00-\u9fa5A-Za-z0-9_]+$/
const RANDOM_POOL = [
  '智汇小达人', 'AI探索者', '学习委员', '知识海绵', '深夜读书人',
  '代码搬运工', '灵感制造机', '云端漫步者', '效率先锋', '思考的芦苇',
]

export default function Nickname() {
  const { t } = useI18n()
  const tt = useCallback((k: string, fb: string) => (t(k) === k ? fb : t(k)), [t])
  const [nickname, setNickname] = useState('')
  const [original, setOriginal] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    try {
      const profile = await getProfile()
      const name = profile.nickname || ''
      setNickname(name)
      setOriginal(name)
    } catch (e) {
      logger.error('user/nickname', '获取用户信息', e)
      Taro.showToast({ title: t('common.failed'), icon: 'none' })
    }
  }, [t])

  useDidShow(() => {
    load()
  })

  const onInput = (e: { detail: { value: string } }) => {
    setNickname((e.detail.value || '').slice(0, MAX_LENGTH))
  }

  const fillRandom = () => {
    const pick = RANDOM_POOL[Math.floor(Math.random() * RANDOM_POOL.length)]
    setNickname(pick ?? '')
  }

  const validate = (val: string): string => {
    const v = val.trim()
    if (!v) return tt('user.nickname.enterNickname', '请输入昵称')
    if (v.length < MIN_LENGTH) return tt('user.nickname.tooShort', `昵称不能少于${MIN_LENGTH}个字符`)
    if (v.length > MAX_LENGTH) return tt('user.nickname.maxLength', `昵称不能超过${MAX_LENGTH}个字符`)
    if (!VALID_REG.test(v)) return tt('user.nickname.invalidChar', '昵称仅支持中英文、数字和下划线')
    if (original && v === original) return tt('user.nickname.sameAsCurrent', '新昵称与当前昵称相同')
    return ''
  }

  async function onSubmit() {
    const err = validate(nickname)
    if (err) {
      Taro.showToast({ title: err, icon: 'none' })
      return
    }
    setSubmitting(true)
    try {
      await updateUserNickname(nickname.trim())
      Taro.showToast({ title: t('user.nickname.saveSuccess'), icon: 'success' })
      setTimeout(() => Taro.navigateBack(), 800)
    } catch (e) {
      logger.error('user/nickname', '修改昵称', e)
      Taro.showToast({ title: t('common.failed'), icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  const err = validate(nickname)
  const canSubmit = !err && !submitting

  return (
    <View className="nick-page">
      <View className="nick-card">
        <View className="nick-row">
          <Text className="nick-label">{t('user.nickname.current')}</Text>
          <Text className="nick-value">{original || t('user.profile.notSet')}</Text>
        </View>
      </View>

      <View className="nick-card">
        <View className="nick-input-head">
          <Text className="nick-label">{t('user.nickname.newNickname')}</Text>
          <Text className="nick-count">{nickname.length}/{MAX_LENGTH}</Text>
        </View>
        <Input
          className="nick-input"
          type="text"
          maxlength={MAX_LENGTH}
          placeholder={t('user.nickname.nicknamePlaceholder')}
          value={nickname}
          onInput={onInput}
        />
        <View className="nick-random" onClick={fillRandom}>
          <Text className="nick-random-text">
            {tt('user.nickname.randomNickname', '🎲 随机推荐昵称')}
          </Text>
        </View>
      </View>

      <View className="nick-rules">
        <Text className="nick-rules-title">
          {tt('user.nickname.rulesTitle', '昵称规则')}
        </Text>
        <Text className="nick-rules-line">
          • {tt('user.nickname.ruleLength', `${MIN_LENGTH}-${MAX_LENGTH} 个字符`)}
        </Text>
        <Text className="nick-rules-line">
          • {tt('user.nickname.ruleChar', '支持中英文、数字')}
        </Text>
        <Text className="nick-rules-line">
          • {tt('user.nickname.ruleSymbol', '禁止特殊符号')}
        </Text>
      </View>

      <Button
        className={`nick-submit${canSubmit ? '' : ' disabled'}`}
        disabled={!canSubmit}
        onClick={onSubmit}
      >
        {submitting ? tt('user.nickname.saving', '保存中…') : t('user.nickname.save')}
      </Button>
    </View>
  )
}
