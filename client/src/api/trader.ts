import { t } from '@/utils/i18n'

/**
 * 操盘手相关 API
 * 迁移自 Ai-WXMiniVue/src/service/trader.js
 * 转换：JS -> TS, uni.request -> axios
 */

import request from '@/utils/request-compat'
import { getBaseUrl } from '@/config/api-config'
import { StorageManager, STORAGE_KEYS } from '@/utils/storage'
import { ElMessage } from 'element-plus'
import axios from 'axios'

const baseUrl: string = getBaseUrl(1)
const baseUrl2Value: string = getBaseUrl(2)

/**
 * 获取操盘手个人信息卡接口
 */
export function getOperatorDataCardData(token: string) {
  return request({
    url: '/flow/getStatistics',
    method: 'GET',
    data: { token },
  })
}

/**
 * 操盘手团队数据查询参数
 */
export interface TraderTeamParams {
  token: string
  begin: string
  end: string
  pageNum: number
  pageSize: number
}

/**
 * 获取操盘手的团队数据
 */
export function getUserInviteeOrderStats(params: TraderTeamParams) {
  return request({
    url: '/flow/getTraderTeamByCenter',
    method: 'GET',
    data: {
      token: params.token,
      begin: params.begin,
      end: params.end,
      pageNum: params.pageNum,
      pageSize: params.pageSize,
    },
  })
}

/**
 * 操盘手获取自己以及下家订单
 */
export function getUserAndChildrenOrders(id: string, page: number, quantity: number) {
  return request({
    url: '/distribution/getUserAndChildrenOrders',
    method: 'POST',
    data: { id, page, quantity },
  })
}

/**
 * 操盘手获取个人的推广小程序码
 */
export function getWxCode(invite_code: string, back?: string) {
  return new Promise((resolve, reject) => {
    const userData = StorageManager.getItem<{
      thirdPartyAccounts?: { accessToken?: string }
    }>(STORAGE_KEYS.USER_DATA)
    const zhsToken = userData?.thirdPartyAccounts

    axios
      .request({
        url: `${baseUrl}/login/getWxCode`,
        method: 'GET',
        headers: {
          Authorization: zhsToken?.accessToken ? `Bearer ${zhsToken.accessToken}` : '',
        },
        params: {
          invite_code,
          back: back || '',
        },
        responseType: 'arraybuffer',
      })
      .then((res: { status?: number; data?: ArrayBuffer }) => {
        if (res.status === 200 && res.data) {
          // 将arraybuffer转换为base64格式的图片URL
          const base64 = btoa(
            String.fromCharCode(...new Uint8Array(res.data))
          )
          const imageUrl = 'data:image/png;base64,' + base64
          resolve(imageUrl)
        } else {
          ElMessage.error(t('msg.trader.获取二维码失败'))
          reject(res)
        }
      })
      .catch((err) => {
        ElMessage.error(t('msg.trader.请求失败1'))
        reject(err)
      })
  })
}

/**
 * 操盘手获取佣金页面信息
 */
export function getUserCommissionDetail(user_id: string) {
  return request({
    url: '/distribution/getUserCommissionDetail',
    method: 'GET',
    data: { user_id },
  })
}

/**
 * 获取分销流水列表
 */
export function getflowList(tokenUuid: string) {
  return request({
    url: '/flow/list',
    method: 'GET',
    data: { tokenUuid },
  })
}

/**
 * 获取我的订单接口
 */
export function getFlowOrderList(pageNum: number, pageSize: number, openId: string) {
  return request({
    url: '/flow/orderList',
    method: 'GET',
    data: { pageNum, pageSize, openId },
  })
}

/**
 * 实名认证
 */
export function realAuth(username: string, idCard: string, uuid: string) {
  return new Promise((resolve, reject) => {
    const userData = StorageManager.getItem<{
      thirdPartyAccounts?: { accessToken?: string }
    }>(STORAGE_KEYS.USER_DATA)
    const zhsToken = userData?.thirdPartyAccounts

    axios
      .request({
        url: `${baseUrl2Value}/auth/user`,
        method: 'POST',
        headers: {
          Authorization: zhsToken?.accessToken ? `Bearer ${zhsToken.accessToken}` : '',
          'platform-type': 'web',
        },
        data: { username, idCard, uuid },
      })
      .then((res: { data?: { code?: number } }) => {
        if (res?.data?.code === 200) {
          resolve(res)
        } else {
          ElMessage.error(t('msg.trader.实名认证失败2'))
          reject(res)
        }
      })
      .catch((err) => {
        ElMessage.error(t('msg.trader.请求失败3'))
        reject(err)
      })
  })
}
