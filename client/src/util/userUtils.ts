// @ts-nocheck
// 用户端 userUtils shim —— 当前登录用户信息（localStorage 持久化）
import storage from './storageUtils'

const currentUserKey = 'cloud-learning-member'

export function setUser(data: any) {
  return storage.setJson(currentUserKey, data)
}

export function getUser() {
  const user = storage.getJson(currentUserKey)
  if (user) {
    return user
  }
  return undefined
}

export function deleteUser() {
  storage.remove(currentUserKey)
}
