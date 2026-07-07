// @ts-nocheck
// 自动生成: 用户端 API re-export shim，re-export 自 @/api/edu/web-api
import { commentApi } from '@/api/edu/web-api'

export const saveLike = commentApi.saveLike
export const updateLike = commentApi.updateLike
export const getMemberLikeList = commentApi.getMemberLikeList
export const getLikeCountList = commentApi.getLikeCountList

export function like(item, type, success) {
  if (item["like"] && item["like"].id) {
    item["like"].status = !item["like"].status
    commentApi.updateLike(item["like"], res => {
      if (!item.likeNum) item.likeNum = 0
      if (!res.status) item.likeNum = item.likeNum - 1
      else item.likeNum = item.likeNum + 1
      if (item.likeNum === 0) item.likeNum = ""
      success && success({ like: item.like, likeNum: item.likeNum })
    })
  } else {
    const p = { topicId: item.id, topicMemberId: item.member ? item.member.id : 0, topicType: type }
    commentApi.saveLike(p, res => {
      item.like = res
      if (!item.likeNum) item.likeNum = 0
      item.likeNum = item.likeNum + 1
      success && success({ like: res, likeNum: item.likeNum })
    })
  }
}
