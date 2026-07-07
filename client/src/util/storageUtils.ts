// @ts-nocheck
// 用户端 storageUtils shim —— 兼容旧项目 storageUtils.js 的默认导出
// 同时为 Storage 原型挂载 setExpire / getExpire（旧代码大量使用 localStorage.setExpire）
;(Storage.prototype as any).setExpire = (key: string, value: any, expire: number) => {
  const obj = { data: value, time: Date.now(), expire }
  localStorage.setItem(key, JSON.stringify(obj))
  return true
}
;(Storage.prototype as any).getExpire = (key: string) => {
  let val = localStorage.getItem(key)
  if (!val) return val
  val = JSON.parse(val)
  const now = Date.now()
  if (now > val.expire) {
    localStorage.removeItem(key)
    return null
  }
  return val.data
}

const storage = {
  set(key: string, value: any) {
    localStorage.setItem(key, value)
  },
  get(key: string) {
    return localStorage.getItem(key)
  },
  remove(key: string) {
    localStorage.removeItem(key)
  },
  setExpire(key: string, value: any, expire: number) {
    ;(localStorage as any).setExpire(key, value, expire)
  },
  getExpire(key: string) {
    return (localStorage as any).getExpire(key)
  },
  setJson(key: string, value: any) {
    this.set(key, JSON.stringify(value))
  },
  getJson(key: string) {
    const value = this.get(key)
    if (value) {
      try {
        return JSON.parse(value)
      } catch {
        return undefined
      }
    }
    return undefined
  },
  setJsonExpire(key: string, value: any, expire: number) {
    const now = Date.now()
    const absoluteExpire = expire < now / 10 ? now + expire : expire
    ;(localStorage as any).setExpire(key, JSON.stringify(value), absoluteExpire)
  },
  getJsonExpire(key: string) {
    const value = (localStorage as any).getExpire(key)
    if (value) {
      try {
        return JSON.parse(value)
      } catch {
        return undefined
      }
    }
    return undefined
  }
}

export default storage
