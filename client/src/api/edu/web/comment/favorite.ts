// @ts-nocheck
// 自动生成: 用户端 API re-export shim，re-export 自 @/api/edu/web-api
import { commentApi } from '@/api/edu/web-api'

export const saveFavorite = commentApi.saveFavorite
export const deleteFavorite = commentApi.deleteFavorite
export const getMemberFavoriteList = commentApi.getMemberFavoriteList
export const getFavoriteCountList = commentApi.getFavoriteCountList
export const getFavoriteTypeList = commentApi.getFavoriteTypeList
export const getMemberFavoritePageList = commentApi.getMemberFavoritePageList

export function favorite(item, type, success) {
  if (item["favorite"] && item["favorite"].id) {
    commentApi.deleteFavorite({ id: item["favorite"].id }, () => {
      item.favorite = {}
      if (!item.favoriteNum) item.favoriteNum = 0
      item.favoriteNum = item.favoriteNum - 1
      if (item.favoriteNum === 0) item.favoriteNum = ""
      success && success({ favorite: item.favorite, favoriteNum: item.favoriteNum })
    })
  } else {
    commentApi.saveFavorite({ topicId: item.id, topicMemberId: item.member ? item.member.id : 0, topicType: type }, res => {
      item.favorite = res
      if (!item.favoriteNum) item.favoriteNum = 0
      item.favoriteNum = item.favoriteNum + 1
      success && success({ favorite: res, favoriteNum: item.favoriteNum })
    })
  }
}
