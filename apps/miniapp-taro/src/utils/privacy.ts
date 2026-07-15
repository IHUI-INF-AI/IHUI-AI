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
      title: '隐私保护提示',
      content: '为了向您提供更优质的服务，我们需要您同意《用户隐私保护指引》后再使用相关功能。',
      confirmText: '查看协议',
      cancelText: '拒绝',
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
