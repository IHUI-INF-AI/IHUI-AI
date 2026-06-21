declare global {
  /** 小程序存储操作错误类型 */
  interface MiniProgramStorageError {
    errMsg: string
    errCode?: number
  }

  interface Window {
    wx?: WechatMiniprogram.Wx
    my?: MyAlipay.My
    __wxjs_environment?: string
     
    require?: (module: string) => any
  }

  namespace WechatMiniprogram {
    interface Wx {
      setStorage(options: {
        key: string
        data: any
        success?: () => void
        fail?: (error: MiniProgramStorageError) => void
        complete?: () => void
      }): void
      getStorage(options: {
        key: string
        success: (res: { data: any }) => void
        fail?: (error: MiniProgramStorageError) => void
        complete?: () => void
      }): void
      removeStorage(options: {
        key: string
        success?: () => void
        fail?: (error: MiniProgramStorageError) => void
        complete?: () => void
      }): void
      clearStorage(options?: {
        success?: () => void
        fail?: (error: MiniProgramStorageError) => void
        complete?: () => void
      }): void
    }
  }

  namespace MyAlipay {
    interface My {
      setStorage(options: {
        key: string
        data: any
        success?: () => void
        fail?: (error: MiniProgramStorageError) => void
        complete?: () => void
      }): void
      getStorage(options: {
        key: string
        success: (res: { data: any }) => void
        fail?: (error: MiniProgramStorageError) => void
        complete?: () => void
      }): void
      removeStorage(options: {
        key: string
        success?: () => void
        fail?: (error: MiniProgramStorageError) => void
        complete?: () => void
      }): void
      clearStorage(options?: {
        success?: () => void
        fail?: (error: MiniProgramStorageError) => void
        complete?: () => void
      }): void
    }
  }

  // DOM 类型定义 - 用于多平台支持（h5、alipay 等平台可能缺少完整的 DOM 类型）
  // 这些定义确保在所有构建平台上都能正确识别触摸事件相关类型
  interface EventTarget {
    addEventListener(
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions
    ): void
    removeEventListener(
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | EventListenerOptions
    ): void
    dispatchEvent(event: Event): boolean
  }

  interface TouchEvent extends Event {
    touches: TouchList
    changedTouches: TouchList
    targetTouches: TouchList
  }

  interface TouchList {
    length: number
    item(index: number): Touch | null
    [index: number]: Touch
  }

  interface Touch {
    identifier: number
    target: EventTarget | null
    screenX: number
    screenY: number
    clientX: number
    clientY: number
    pageX: number
    pageY: number
  }
}

export {}
