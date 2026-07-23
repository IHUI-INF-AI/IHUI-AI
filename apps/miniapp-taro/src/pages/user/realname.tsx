import { logger } from '@/utils/logger'
import { View, Text, Input, Button, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { getProfile, post } from '@/api'
import { uploadImage } from '@/utils/upload-image'
import { useI18n } from '@/i18n'
import './realname.css'

const ID_CARD_REGEX = /^\d{17}[\dXx]$/

type AuthStatus = 'unverified' | 'reviewing' | 'verified' | 'rejected'

function maskIdCard(id: string): string {
  if (!id || id.length < 8) return id || ''
  return id.slice(0, 4) + '********' + id.slice(-4)
}

export default function Realname() {
  const { t } = useI18n()
  const tt = useCallback((k: string, fb: string) => (t(k) === k ? fb : t(k)), [t])
  const [realName, setRealName] = useState('')
  const [idCard, setIdCard] = useState('')
  const [frontPhoto, setFrontPhoto] = useState('')
  const [backPhoto, setBackPhoto] = useState('')
  const [frontUploading, setFrontUploading] = useState(false)
  const [backUploading, setBackUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [status, setStatus] = useState<AuthStatus>('unverified')
  const [authedName, setAuthedName] = useState('')
  const [authedId, setAuthedId] = useState('')
  const [rejectReason, setRejectReason] = useState('')

  const load = useCallback(async () => {
    try {
      const profile = await getProfile()
      const name = (profile.realName as string) || ''
      const raw = profile.realnameStatus as string | undefined
      if (name && raw !== 'rejected' && raw !== 'reviewing') {
        setStatus('verified')
        setAuthedName(name)
        setAuthedId((profile.idCard as string) || '')
        return
      }
      if (raw === 'reviewing') {
        setStatus('reviewing')
        setRealName(name)
      } else if (raw === 'rejected') {
        setStatus('rejected')
        setRealName(name)
        setRejectReason((profile.realnameRejectReason as string) || '')
      } else {
        setStatus('unverified')
      }
    } catch (e) {
      logger.error('user/realname', '获取用户信息', e)
      Taro.showToast({ title: t('common.failed'), icon: 'none' })
    }
  }, [t])

  useDidShow(() => {
    load()
  })

  const pickPhoto = (side: 'front' | 'back') => {
    const uploading = side === 'front' ? frontUploading : backUploading
    if (uploading) return
    Taro.chooseImage({
      count: 1,
      sizeType: ['compressed', 'original'],
      sourceType: ['album', 'camera'],
      success: async (res) => {
        const tempPath = res.tempFilePaths && res.tempFilePaths[0]
        if (!tempPath) return
        const setUploading = side === 'front' ? setFrontUploading : setBackUploading
        const setUrl = side === 'front' ? setFrontPhoto : setBackPhoto
        setUrl(tempPath)
        setUploading(true)
        Taro.showLoading({ title: tt('common.uploading', '上传中…') })
        try {
          const uploaded = await uploadImage(tempPath, '/files/upload')
          if (!uploaded.url) throw new Error('no url')
          setUrl(uploaded.url)
        } catch (e) {
          logger.error('user/realname', '上传身份证照片', e)
          Taro.showToast({ title: tt('user.realname.uploadFailed', '上传失败'), icon: 'none' })
          setUrl('')
        } finally {
          setUploading(false)
          Taro.hideLoading()
        }
      },
      fail: (err) => {
        const msg = String(err?.errMsg || '').toLowerCase()
        if (msg.includes('cancel')) return
        logger.error('user/realname', '选图失败', err)
      },
    })
  }

  async function onSubmit() {
    const name = realName.trim()
    if (!name) {
      return Taro.showToast({ title: t('user.realname.enterRealName'), icon: 'none' })
    }
    if (!ID_CARD_REGEX.test(idCard)) {
      return Taro.showToast({ title: t('user.realname.idCardLength'), icon: 'none' })
    }
    if (!frontPhoto || !backPhoto) {
      return Taro.showToast({
        title: tt('user.realname.uploadRequired', '请上传身份证正反面照片'),
        icon: 'none',
      })
    }
    setSubmitting(true)
    try {
      await post('/user/realname', {
        realName: name,
        idCard: idCard.toUpperCase(),
        idCardFront: frontPhoto,
        idCardBack: backPhoto,
      })
      Taro.showToast({ title: t('user.realname.authSuccess'), icon: 'success' })
      setStatus('reviewing')
      setTimeout(() => Taro.navigateBack(), 1000)
    } catch (e) {
      logger.error('user/realname', '提交实名认证', e)
      Taro.showToast({ title: t('common.failed'), icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  if (status === 'verified') {
    return (
      <View className="rn-page">
        <View className="rn-result-card">
          <View className="rn-result-icon">
            <Text className="rn-result-icon-text">✓</Text>
          </View>
          <Text className="rn-result-title">{t('user.realname.authed')}</Text>
          <Text className="rn-result-name">{authedName}</Text>
          <Text className="rn-result-sub">{maskIdCard(authedId)}</Text>
          <Text className="rn-result-note">
            {tt('user.realname.verifiedNote', '实名信息已认证,不可修改')}
          </Text>
        </View>
      </View>
    )
  }

  const isReviewing = status === 'reviewing'

  return (
    <View className="rn-page">
      <View className="rn-intro">
        <Text className="rn-intro-title">
          {tt('user.realname.title', '实名认证')}
        </Text>
        <Text className="rn-intro-line">
          {tt('user.realname.desc', '为保障账户安全与合规,部分功能需完成实名认证后使用')}
        </Text>
        <Text className="rn-intro-line rn-intro-muted">
          {tt('user.realname.privacyPromise', '您的身份信息仅用于实名核验,平台将严格保密,不会用于其他用途')}
        </Text>
      </View>

      {isReviewing && (
        <View className="rn-status rn-status-reviewing">
          <Text className="rn-status-text">
            {tt('user.realname.reviewing', '审核中,请耐心等待')}
          </Text>
        </View>
      )}
      {status === 'rejected' && (
        <View className="rn-status rn-status-rejected">
          <Text className="rn-status-text">
            {tt('user.realname.rejected', '认证未通过')}
          </Text>
          {rejectReason ? <Text className="rn-status-reason">{rejectReason}</Text> : null}
        </View>
      )}

      <View className="rn-card">
        <View className="rn-field">
          <Text className="rn-label">{t('user.realname.realName')}</Text>
          <Input
            className="rn-input"
            type="text"
            placeholder={t('user.realname.realNamePlaceholder')}
            value={realName}
            onInput={(e) => setRealName(e.detail.value)}
          />
        </View>
        <View className="rn-field">
          <Text className="rn-label">{t('user.realname.idCard')}</Text>
          <Input
            className="rn-input"
            type="idcard"
            maxlength={18}
            placeholder={t('user.realname.idCardPlaceholder')}
            value={idCard}
            onInput={(e) => setIdCard(e.detail.value)}
          />
        </View>
      </View>

      <View className="rn-card">
        <View className="rn-photo-head">
          <Text className="rn-label">
            {tt('user.realname.idCardPhotos', '身份证照片')}
          </Text>
        </View>
        <View className="rn-photo-row">
          <View className="rn-photo-box" onClick={() => pickPhoto('front')}>
            {frontPhoto ? (
              <Image className="rn-photo-img" src={frontPhoto} mode="aspectFill" />
            ) : (
              <View className="rn-photo-placeholder">
                <Text className="rn-photo-plus">+</Text>
                <Text className="rn-photo-tip">
                  {tt('user.realname.frontPhoto', '人像面')}
                </Text>
              </View>
            )}
            {frontUploading ? (
              <Text className="rn-photo-loading">{tt('common.uploading', '上传中…')}</Text>
            ) : null}
          </View>
          <View className="rn-photo-box" onClick={() => pickPhoto('back')}>
            {backPhoto ? (
              <Image className="rn-photo-img" src={backPhoto} mode="aspectFill" />
            ) : (
              <View className="rn-photo-placeholder">
                <Text className="rn-photo-plus">+</Text>
                <Text className="rn-photo-tip">
                  {tt('user.realname.backPhoto', '国徽面')}
                </Text>
              </View>
            )}
            {backUploading ? (
              <Text className="rn-photo-loading">{tt('common.uploading', '上传中…')}</Text>
            ) : null}
          </View>
        </View>
        <Text className="rn-photo-hint">
          {tt('user.realname.uploadHint', '请确保照片清晰、完整、无遮挡')}
        </Text>
      </View>

      <Button
        className={`rn-submit${submitting || isReviewing ? ' disabled' : ''}`}
        disabled={submitting || isReviewing}
        onClick={onSubmit}
      >
        {isReviewing
          ? tt('user.realname.reviewing', '审核中')
          : submitting
            ? tt('user.realname.submitting', '提交中…')
            : t('user.realname.submit')}
      </Button>
    </View>
  )
}
