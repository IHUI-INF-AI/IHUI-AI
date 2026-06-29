/** 推送工具类型声明（对应 push.js） */

export interface PushMessageRes {
  type: 'click' | 'receive'
  data: unknown
}

export interface InitPushOptions {
  onMessage?: (res: PushMessageRes) => void
  onClientId?: (cid: string | null) => void
}

export interface CreatePushMessageOptions {
  title?: string
  content?: string
  payload?: string
  delay?: number
  channelId?: string
}

export function getUniCloudSpaceInfo(): Record<string, unknown>
export function getPushClientId(): Promise<string | null>
export function onPushMessage(callback: (res: PushMessageRes) => void): unknown
export function offPushMessage(callback?: unknown): void
export function getChannelManager(): unknown
export function createPushMessage(options?: CreatePushMessageOptions): Promise<unknown>
export function initPush(options?: InitPushOptions): Promise<string | null>
export function savePushClientIdToServer(
  pushClientId: string,
  userId?: string | null,
): Promise<unknown>
