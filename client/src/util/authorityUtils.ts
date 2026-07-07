// @ts-nocheck
// 用户端 authorityUtils shim —— 权限/路由本地存储（用户端基本不使用，保留接口兼容）
import storage from './storageUtils'

function hasAuthority(authorityObjs: any[], route: any) {
  if (route.meta && route.meta.authorities) {
    return authorityObjs.some((authorityObj: any) => route.meta.authorities.includes(authorityObj))
  }
  return true
}

export function filterAsyncRoutes(routes: any[], authorities: any[]) {
  const res: any[] = []
  routes.forEach((route: any) => {
    const tmp = { ...route }
    if (hasAuthority(authorities, tmp)) {
      if (tmp.children) {
        tmp.children = filterAsyncRoutes(tmp.children, authorities)
      }
      res.push(tmp)
    }
  })
  return res
}

export function deleteAuthorities() {
  storage.remove('authorityList')
}

export function setAuthorities(authorities: any) {
  deleteAuthorities()
  storage.setJson('authorityList', authorities)
}

export function getAuthorities() {
  const authorities = storage.getJson('authorityList')
  if (authorities) {
    return authorities.authorities
  }
  return null
}

export function checkAuthorities(value: any) {
  if (value && value instanceof Array && value.length > 0) {
    const authorities = getAuthorities() || []
    return authorities.some((authorityObj: any) => value.includes(authorityObj))
  }
  return false
}

export function getRoutes() {
  return storage.getJson('routes')
}

export function setRoutes(routes: any) {
  storage.remove('routes')
  storage.setJson('routes', routes)
}
