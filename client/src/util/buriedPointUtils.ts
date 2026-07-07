// @ts-nocheck
// 用户端 buriedPointUtils shim —— 埋点/访问日志，用户端迁移期降级为 no-op，避免外部 IP 服务依赖
import storage from './storageUtils'

export async function fetchClientIp() {
  return storage.get('ipAddress') || ''
}

export async function initIpInfo() {
  // no-op
}

export function getUuid() {
  return 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export function generateSessionId() {
  storage.set('SESSION_ID', getUuid())
}

export function generateUuidId() {
  const uuid = storage.get('MEMBER_UUID')
  if (!uuid) {
    storage.set('MEMBER_UUID', getUuid())
  }
}

export const refreshSessionId = () => {
  const sessionId = storage.get('SESSION_ID')
  if (!sessionId) {
    generateSessionId()
  }
}

export const sendVisitLog = async () => {
  // 迁移期：不发送访问日志，仅保证调用不报错
}
