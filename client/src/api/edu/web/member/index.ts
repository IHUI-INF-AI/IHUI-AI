// @ts-nocheck
// 自动生成: 用户端 API re-export shim，re-export 自 @/api/edu/web-api
import { memberApi } from '@/api/edu/web-api'

export const registerMember = memberApi.registerMember
export const registerMemberByMobile = memberApi.registerMemberByMobile
export const updateAvatar = memberApi.updateAvatar
export const updateName = memberApi.updateName
export const updateMobile = memberApi.updateMobile
export const updateEmail = memberApi.updateEmail
export const updatePassword = memberApi.updatePassword
export const getMemberInfo = memberApi.getMemberInfo
export const getMemberByMobile = memberApi.getMemberByMobile
export const getMemberById = memberApi.getMemberById
export const getAuthMemberList = memberApi.getAuthMemberList
export const checkIn = memberApi.checkIn
export const getCheckIn = memberApi.getCheckIn
export const isFollowMember = memberApi.isFollowMember
export const followMember = memberApi.followMember
export const unfollowMember = memberApi.unfollowMember
export const followMemberCount = memberApi.followMemberCount
export const getFollowMemberList = memberApi.getFollowMemberList
export const getFollowFansMemberList = memberApi.getFollowFansMemberList
export const getListByIds = memberApi.getListByIds
export const getPwdAuthCode = memberApi.getPwdAuthCode
export const checkPwdAuthCode = memberApi.checkPwdAuthCode
export const resetPwd = memberApi.resetPwd

import router from '@/router'
import { getUser } from '@/util/userUtils'
export function gotoMemberDetail(id) {
  router.push({ path: '/edu/member/detail', query: { id: id } })
}
export function getMember() {
  return new Promise((resolve, reject) => {
    const m = getUser()
    if (!m) { reject(new Error('用户未登录')); return }
    const params = { mobile: m.mobile || m.username || m.email }
    memberApi.getMemberInfo(params, (res) => resolve(res))
  })
}
