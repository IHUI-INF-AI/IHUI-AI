import { t } from '@/i18n'
import Taro from '@tarojs/taro'

export interface PrivacySettingResult {
  needAuthorization: boolean
  privacyContractName: string
}

export function getPrivacySetting(): Promise<PrivacySettingResult> {
  return new Promise((resolve) => {
    Taro.getPrivacySetting({
      success: (res) =>
        resolve({
          needAuthorization: res.needAuthorization,
          privacyContractName: res.privacyContractName || '',
        }),
      fail: () => resolve({ needAuthorization: false, privacyContractName: '' }),
    })
  })
}

export function openPrivacyContract(): Promise<boolean> {
  return new Promise((resolve) => {
    Taro.openPrivacyContract({
      success: () => resolve(true),
      fail: () => resolve(false),
    })
  })
}

let listenerRegistered = false

export function initPrivacyGuard(): void {
  if (listenerRegistered) return
  listenerRegistered = true

  Taro.onNeedPrivacyAuthorization((resolve) => {
    Taro.showModal({
      title: t('utilsPrivacy.q1'),
      content: t('utilsPrivacy.q2'),
      confirmText: t('utilsPrivacy.q3'),
      cancelText: t('utilsPrivacy.q4'),
      success: (modalRes) => {
        if (modalRes.confirm) {
          Taro.openPrivacyContract({
            success: () => resolve({ event: 'agree' }),
            fail: () => resolve({ event: 'disagree' }),
          })
        } else {
          resolve({ event: 'disagree' })
        }
      },
      fail: () => resolve({ event: 'disagree' }),
    })
  })
}
