import Taro from '@tarojs/taro'

export interface SubscribeResult {
  [tmplId: string]: 'accept' | 'reject' | 'ban' | 'filter'
}

export function requestSubscribeMessage(tmplIds: string[]): Promise<SubscribeResult> {
  return new Promise((resolve, reject) => {
    Taro.requestSubscribeMessage({
      tmplIds,
      success: (res) => {
        const result: SubscribeResult = {}
        for (const id of tmplIds) {
          const status = (res as Record<string, unknown>)[id]
          if (typeof status === 'string') {
            result[id] = status as SubscribeResult[string]
          }
        }
        resolve(result)
      },
      fail: (err) => reject(err),
    } as Taro.requestSubscribeMessage.Option)
  })
}

export async function subscribeOnce(tmplIds: string[]): Promise<boolean> {
  try {
    const result = await requestSubscribeMessage(tmplIds)
    return tmplIds.some((id) => result[id] === 'accept')
  } catch {
    return false
  }
}

export function checkSubscribeStatus(tmplIds: string[]): Promise<Record<string, string>> {
  return new Promise((resolve) => {
    Taro.getSetting({
      success: (res) => {
        const itemSettings = res.subscriptionsSetting?.itemSettings || {}
        const result: Record<string, string> = {}
        for (const id of tmplIds) {
          result[id] = (itemSettings[id] as string) || ''
        }
        resolve(result)
      },
      fail: () => resolve({}),
    })
  })
}
