/**
 * uni-app API适配器 - 将uni-app API转换为Web标准API
 */

// 存储适配
export const uni = {
  getStorageSync(key) {
    try {
      const value = localStorage.getItem(key)
      return value ? JSON.parse(value) : null
    } catch (e) {
      return localStorage.getItem(key)
    }
  },
  
  setStorageSync(key, value) {
    try {
      localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value))
    } catch (e) {
      console.error('存储失败:', e)
    }
  },
  
  // Toast提示
  showToast(options) {
    const { title, icon = 'none', duration = 2000 } = options
    const toast = document.createElement('div')
    toast.className = 'uni-toast'
    toast.textContent = title
    toast.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.8);
      color: #fff;
      padding: 12px 24px;
      border-radius: 8px;
      z-index: 9999;
      font-size: 14px;
      pointer-events: none;
    `
    document.body.appendChild(toast)
    setTimeout(() => {
      document.body.removeChild(toast)
    }, duration)
  },
  
  // 模态框
  showModal(options) {
    const { title, content, showCancel = true, success } = options
    const confirmed = window.confirm(`${title}\n${content}`)
    if (success) {
      success({ confirm: confirmed, cancel: !confirmed })
    }
  },
  
  // 预览图片
  previewImage(options) {
    const { current, urls } = options
    // 创建图片预览模态框
    const modal = document.createElement('div')
    modal.className = 'uni-preview-image'
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.9);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
    `
    
    const img = document.createElement('img')
    img.src = current
    img.style.cssText = `
      max-width: 90%;
      max-height: 90%;
      object-fit: contain;
    `
    
    modal.appendChild(img)
    document.body.appendChild(modal)
    
    modal.addEventListener('click', () => {
      document.body.removeChild(modal)
    })
  },
  
  // 获取系统信息
  getSystemInfoSync() {
    return {
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
      pixelRatio: window.devicePixelRatio || 1,
      platform: navigator.platform,
      system: navigator.userAgent
    }
  },
  
  // 设置剪贴板
  setClipboardData(options) {
    const { data, success, fail } = options
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(data).then(() => {
        if (success) success()
      }).catch(() => {
        if (fail) fail()
      })
    } else {
      // 降级方案
      const textarea = document.createElement('textarea')
      textarea.value = data
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      try {
        document.execCommand('copy')
        document.body.removeChild(textarea)
        if (success) success()
      } catch (e) {
        document.body.removeChild(textarea)
        if (fail) fail()
      }
    }
  },
  
  // 创建音频上下文（简化版）
  createInnerAudioContext() {
    const audio = new Audio()
    let currentTime = 0
    let duration = 0
    
    return {
      src: '',
      volume: 1,
      currentTime: 0,
      duration: 0,
      play() {
        audio.play()
      },
      pause() {
        audio.pause()
      },
      stop() {
        audio.pause()
        audio.currentTime = 0
      },
      seek(time) {
        audio.currentTime = time
      },
      destroy() {
        audio.pause()
        audio.src = ''
      },
      onTimeUpdate(callback) {
        audio.addEventListener('timeupdate', () => {
          currentTime = audio.currentTime
          duration = audio.duration || 0
          callback()
        })
      },
      onEnded(callback) {
        audio.addEventListener('ended', callback)
      },
      onError(callback) {
        audio.addEventListener('error', callback)
      },
      get currentTime() {
        return audio.currentTime
      },
      get duration() {
        return audio.duration || 0
      },
      set src(value) {
        audio.src = value
      },
      set volume(value) {
        audio.volume = value
      }
    }
  }
}
