// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像 packages/app/src/features/identity-verify/IdentityVerifyScreen.tsx
import { useI18n } from '@/i18n'
import { logger } from '@/utils/logger'
import { View, Text, Button, Image } from '@tarojs/components'
import { FocusInput } from '@/components/FocusField'
import LineIcon from '@/components/LineIcon'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { getProfile, post } from '@/api'
import { useAuthReadyGate } from '@/hooks/use-auth-ready-gate'
import { uploadImage } from '@/utils/upload-image'
import ThemeRoot from '@/components/ThemeRoot'
import './realname.css'

const ID_CARD_REGEX = /^\d{17}[\dXx]$/

type AuthStatus = 'unverified' | 'reviewing' | 'verified' | 'rejected'

/** 证件照三面(对齐共享屏 IdentityVerifyScreen 的 items:人像面 / 国徽面 / 手持照) */
type PhotoSide = 'front' | 'back' | 'selfie'

function maskIdCard(id: string): string {
  if (!id || id.length < 8) return id || ''
  return id.slice(0, 4) + '********' + id.slice(-4)
}

export default function Realname() {
  const { t } = useI18n()
  const gate = useAuthReadyGate()
  const tt = useCallback((k: string, fb: string) => (t(k) === k ? fb : t(k)), [t])
  const [realName, setRealName] = useState('')
  const [idCard, setIdCard] = useState('')
  const [frontPhoto, setFrontPhoto] = useState('')
  const [backPhoto, setBackPhoto] = useState('')
  const [selfiePhoto, setSelfiePhoto] = useState('')
  const [frontUploading, setFrontUploading] = useState(false)
  const [backUploading, setBackUploading] = useState(false)
  const [selfieUploading, setSelfieUploading] = useState(false)
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
      logger.error('user/realname', t('userRealname.q1'), e)
      Taro.showToast({ title: t('common.failed'), icon: 'none' })
    }
  }, [t])

  useDidShow(() => {
    // G-933 冷启动门控:GET /user/profile(checkAuth)需鉴权,落定前不发
    gate.waitUntilReady(() => {
      void load()
    })
  })

  const pickPhoto = (side: PhotoSide) => {
    const busy =
      side === 'front' ? frontUploading : side === 'back' ? backUploading : selfieUploading
    if (busy) return
    const setUrl: (v: string) => void =
      side === 'front' ? setFrontPhoto : side === 'back' ? setBackPhoto : setSelfiePhoto
    const setUploading: (v: boolean) => void =
      side === 'front' ? setFrontUploading : side === 'back' ? setBackUploading : setSelfieUploading
    Taro.chooseImage({
      count: 1,
      sizeType: ['compressed', 'original'],
      sourceType: ['album', 'camera'],
      success: async (res) => {
        const tempPath = res.tempFilePaths && res.tempFilePaths[0]
        if (!tempPath) return
        setUrl(tempPath)
        setUploading(true)
        Taro.showLoading({ title: tt('common.uploading', '上传中…') })
        try {
          const uploaded = await uploadImage(tempPath, '/files/upload')
          if (!uploaded.url) throw new Error('no url')
          setUrl(uploaded.url)
        } catch (e) {
          logger.error('user/realname', t('userRealname.q2'), e)
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
        logger.error('user/realname', t('user.avatar.chooseFailed'), err)
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
        // 手持照是共享屏 IdentityVerifyScreen 就有的第三面;后端 zod 目前只取
        // realName/idCard/authSource(未登记的摄影字段一律被 strip,正反面同此),有值才带
        ...(selfiePhoto ? { idCardHand: selfiePhoto } : {}),
      })
      Taro.showToast({ title: t('user.realname.authSuccess'), icon: 'success' })
      setStatus('reviewing')
      setTimeout(() => Taro.navigateBack(), 1000)
    } catch (e) {
      logger.error('user/realname', t('userRealname.q3'), e)
      Taro.showToast({ title: t('common.failed'), icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  if (status === 'verified') {
    return (
      <ThemeRoot>
        <View className="rn-page">
          <View className="rn-result-card">
            <View className="rn-result-icon">
              <LineIcon
                className="rn-result-icon-text"
                name="check-success"
                size={56}
                color="var(--color-success)"
              />
            </View>
            <Text className="rn-result-title">{t('user.realname.authed')}</Text>
            <Text className="rn-result-name">{authedName}</Text>
            <Text className="rn-result-sub">{maskIdCard(authedId)}</Text>
            <Text className="rn-result-note">
              {tt('user.realname.verifiedNote', '实名信息已认证,不可修改')}
            </Text>
          </View>
        </View>
      </ThemeRoot>
    )
  }

  const isReviewing = status === 'reviewing'

  // 三面证件照的标签走共享屏 IdentityVerifyScreen 的键(人像面 / 国徽面 / 手持照)
  const photoSides: ReadonlyArray<{ side: PhotoSide; label: string }> = [
    { side: 'front', label: tt('identityVerify.uploadFront', '上传身份证人像面') },
    { side: 'back', label: tt('identityVerify.uploadBack', '上传身份证国徽面') },
    { side: 'selfie', label: tt('identityVerify.uploadSelfie', '上传手持身份证照片') },
  ]

  return (
    <ThemeRoot>
      <View className="rn-page">
        <View className="rn-intro">
          <Text className="rn-intro-title">{tt('identityVerify.title', '身份认证')}</Text>
          <Text className="rn-intro-line">
            {tt('identityVerify.subtitle', '完成身份认证,保障账户安全')}
          </Text>
          <Text className="rn-intro-line rn-intro-muted">
            {tt(
              'user.realname.privacyPromise',
              '您的身份信息仅用于实名核验,平台将严格保密,不会用于其他用途',
            )}
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
            <Text className="rn-status-text">{tt('user.realname.rejected', '认证未通过')}</Text>
            {rejectReason ? <Text className="rn-status-reason">{rejectReason}</Text> : null}
          </View>
        )}

        <View className="rn-card">
          <View className="rn-field">
            <Text className="rn-label">{t('user.realname.realName')}</Text>
            <FocusInput
              className="rn-input"
              type="text"
              placeholder={t('user.realname.realNamePlaceholder')}
              value={realName}
              onInput={(e) => setRealName(e.detail.value)}
            />
          </View>
          <View className="rn-field">
            <Text className="rn-label">{t('user.realname.idCard')}</Text>
            <FocusInput
              className="rn-input"
              type="idcard"
              maxlength={18}
              placeholder={t('user.realname.idCardPlaceholder')}
              placeholderClass="rn-placeholder"
              value={idCard}
              onInput={(e) => setIdCard(e.detail.value)}
            />
          </View>
        </View>

        <View className="rn-card">
          <View className="rn-photo-head">
            <Text className="rn-label">{tt('user.realname.idCardPhotos', '身份证照片')}</Text>
          </View>
          <View className="rn-photo-row">
            {photoSides.map((p) => {
              const url =
                p.side === 'front' ? frontPhoto : p.side === 'back' ? backPhoto : selfiePhoto
              const uploading =
                p.side === 'front'
                  ? frontUploading
                  : p.side === 'back'
                    ? backUploading
                    : selfieUploading
              return (
                <View
                  key={p.side}
                  className="rn-photo-box"
                  hoverClass="opacity-60"
                  onClick={() => pickPhoto(p.side)}
                >
                  {url ? (
                    <Image className="rn-photo-img" src={url} mode="aspectFill" />
                  ) : (
                    <View className="rn-photo-placeholder">
                      <Text className="rn-photo-plus">+</Text>
                      <Text className="rn-photo-tip text-center">{p.label}</Text>
                    </View>
                  )}
                  {uploading ? (
                    <Text className="rn-photo-loading">{tt('common.uploading', '上传中…')}</Text>
                  ) : null}
                </View>
              )
            })}
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
              ? tt('identityVerify.submitting', '提交中...')
              : t('user.realname.submit')}
        </Button>
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
