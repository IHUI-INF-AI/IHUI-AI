import { COZE_PATHS } from '@/config/backend-paths'
import { t } from '@/utils/i18n'

/**
 * 名片相关 API
 * 迁移自 Ai-WXMiniVue/src/service/businessCard.js
 * 转换：JS -> TS, uni.request -> axios
 */

import request from '@/utils/request-compat'
import { getBaseUrl } from '@/config/api-config'
import { StorageManager, STORAGE_KEYS } from '@/utils/storage'
import { ElMessage } from 'element-plus'
import axios from 'axios'
import { clearAllAuthData } from '@/utils/auth-compat'

const baseUrl2Value: string = getBaseUrl(2)

/**
 * 获取名片
 */
export function getBusinessCard(id?: string) {
  const url = id ? `/remote/getBusinessCard/${id}` : '/remote/getBusinessCard'
  return request({
    url,
    method: 'GET',
    headers: {
      'content-type': 'application/json',
    },
  })
}

/**
 * 上传名片（备份版本）
 */
export function uploadBusinessCard_bak(id: string, card: string, fileName: string) {
  return request({
    url: '/remote/uploadBusinessCard',
    headers: {
      'content-type': 'application/json',
    },
    method: 'POST',
    data: {
      id,
      card,
      fileName,
    },
  })
}

/**
 * 上传名片
 */
export function uploadBusinessCard(id: string, card: string, fileName: string) {
  return new Promise((resolve, reject) => {
    const userData = StorageManager.getItem<{
      thirdPartyAccounts?: { accessToken?: string }
    }>(STORAGE_KEYS.USER_DATA)
    const zhsToken = userData?.thirdPartyAccounts

    axios
      .request({
        url: `${baseUrl2Value}/remote/uploadBusinessCard`,
        method: 'POST',
        headers: {
          Authorization: zhsToken?.accessToken ? `Bearer ${zhsToken.accessToken}` : '',
          'platform-type': 'web',
          'content-type': 'application/json',
        },
        data: {
          id,
          card,
          fileName,
        },
      })
      .then((res: { status?: number; data?: { code?: number; msg?: string; message?: string } }) => {
        // 处理token失效的情况
        if (
          res.status === 401 ||
          res.status === 40101 ||
          (res.data && (res.data.code === 401 || res.data.code === 40101))
        ) {
          clearAllAuthData()
          ElMessage.error(t('api.business_card.登录已过期请重新'))
          return reject(new Error('登录已过期'))
        }

        // 处理其他错误状态码
        if (res.status !== 200 && res.status !== 201) {
          const errorMsg = res.data?.msg || res.data?.message || `请求失败(${res.status})`
          ElMessage.error(errorMsg)
          return reject(new Error(errorMsg))
        }

        resolve(res)
      })
      .catch((err) => {
        ElMessage.error(t('msg.business_card.请求失败1'))
        reject(err)
      })
  })
}

/**
 * 支付测试参数
 */
export interface PayTestParams {
  amount: number
  paymentMethod?: string
  [key: string]: any
}

/**
 * 支付测试
 */
export function payceshi(data: PayTestParams) {
  return request({
    url: '/pay/initiate_pay',
    headers: {
      'content-type': 'application/json',
    },
    method: 'POST',
    data,
  })
}

/**
 * 上传名片（Base64）
 */
export function uploadBusinessCarda(card: string, fileName: string) {
  return request({
    url: '/resource/fileUpload',
    headers: {
      'content-type': 'application/json',
    },
    method: 'POST',
    data: {
      file: 'base64,' + card,
      fileName,
    },
    base: 1,
  })
}

/**
 * 通过 Base64 上传
 */
export function uploadBybase64(card: string, fileName: string) {
  return request({
    url: COZE_PATHS.file.uploadBase64,
    headers: {
      'content-type': 'application/json',
    },
    method: 'POST',
    data: {
      base64: card,
      fileName,
    },
    base: 3,
  })
}

/**
 * 水印
 */
export function watermark(card: string, id: string) {
  const userData = StorageManager.getItem<{
    thirdPartyAccounts?: { accessToken?: string }
  }>(STORAGE_KEYS.USER_DATA)
  const zhsToken = userData?.thirdPartyAccounts

  return request({
    url: '/resource/download/watermark',
    headers: {
      Authorization: zhsToken?.accessToken ? `Bearer ${zhsToken.accessToken}` : '',
      'platform-type': 'web',
      'content-type': 'application/json',
    },
    method: 'GET',
    data: {
      netUrl: card,
      user_uuid: id,
    },
    base: 1,
  })
}
