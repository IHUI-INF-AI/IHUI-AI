// Ripple_Yu 跳转链接页面的载体容器
<template>
  <web-view :src="url" @message="handleWebviewMessage" bindmessage="handleWebviewMessage" @load="onWebviewLoad"></web-view>
</template>

<script setup>
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'

const url = ref('')
const receivedOptions = ref({})
const fileCache = ref(uni.getStorageSync('webviewFileCache') || {})

function handleWebviewMessage(e) {
  console.log('接收到web-view消息:', e)
  const messages = e.detail.data[0]
  
  if (Array.isArray(messages) && messages.length > 0) {
    const parsedMessages = []
    
    messages.forEach((message, index) => {
      if (message && typeof message === 'string') {
        const fileInfo = parseFileUrl(message)
        parsedMessages.push(fileInfo)
        console.log(`解析后的文件信息[${index}]:`, fileInfo)
      } else {
        console.log(`接收到的消息[${index}]不是有效的链接路径:`, message)
      }
    })
    
    cacheFileInfoArray(parsedMessages)
  } else {
    console.log('接收到的消息不是有效的数组:', messages)
  }
}

function parseFileUrl(urlStr) {
  try {
    urlStr = String(urlStr)
    
    let filenameWithExt = ''
    
    try {
      const hasProtocol = urlStr.startsWith('http://') || urlStr.startsWith('https://')
      const urlWithProtocol = hasProtocol ? urlStr : `https://${urlStr}`
      const urlObj = new URL(urlWithProtocol)
      const pathname = urlObj.pathname
      const lastSlashIndex = pathname.lastIndexOf('/')
      filenameWithExt = lastSlashIndex !== -1 ? pathname.substring(lastSlashIndex + 1) : pathname
    } catch (e) {
      console.log('使用正则表达式解析URL:', e.message)
      const match = urlStr.match(/[^/\\\\]+\\.[^/\\\\.]+$/)
      if (match) {
        filenameWithExt = match[0]
      } else {
        const parts = urlStr.split(/[/\\\\]/)
        filenameWithExt = parts[parts.length - 1]
      }
    }
    
    const lastDotIndex = filenameWithExt.lastIndexOf('.')
    let fileExtension = ''
    let filename = filenameWithExt
    
    if (lastDotIndex !== -1 && lastDotIndex !== 0) {
      fileExtension = filenameWithExt.substring(lastDotIndex + 1).toLowerCase()
      filename = filenameWithExt.substring(0, lastDotIndex)
    }
    
    let fileType = 'unknown'
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp']
    const videoExtensions = ['mp4', 'webm', 'ogg', 'mov', 'avi']
    const audioExtensions = ['mp3', 'wav', 'ogg', 'm4a']
    const documentExtensions = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt']
    
    if (imageExtensions.includes(fileExtension)) {
      fileType = 'image'
    } else if (videoExtensions.includes(fileExtension)) {
      fileType = 'video'
    } else if (audioExtensions.includes(fileExtension)) {
      fileType = 'audio'
    } else if (documentExtensions.includes(fileExtension)) {
      fileType = 'document'
    }
    
    return {
      url: urlStr,
      filename: filename,
      fileExtension: fileExtension,
      fileType: fileType,
      fullFilename: filenameWithExt
    }
  } catch (error) {
    console.error('解析文件URL失败:', error)
    return {
      url: urlStr,
      filename: '',
      fileExtension: '',
      fileType: 'unknown',
      fullFilename: ''
    }
  }
}

function cacheFileInfo(urlStr, fileInfo) {
  let currentCache = []
  
  currentCache.push({
    ...fileInfo,
    cachedAt: Date.now()
  })
  
  fileCache.value = currentCache
  
  uni.setStorageSync('webviewFileCache', currentCache)
  
  console.log('文件信息已缓存到本地存储，当前缓存项数:', currentCache.length)
}

function cacheFileInfoArray(messagesArray) {
  let currentCache = []
  
  const MAX_CACHE_SIZE = 100
  
  messagesArray.forEach((messageInfo) => {
    if (messageInfo && messageInfo.url) {
      currentCache.push({
        ...messageInfo,
        cachedAt: Date.now()
      })
    }
  })
  
  fileCache.value = currentCache
  
  uni.setStorageSync('webviewFileCache', currentCache)
  
  console.log('消息数组已缓存到本地存储，当前缓存项数:', currentCache.length)
}

function onWebviewLoad(e) {
  console.log('web-view加载完成:', e)
}

onLoad((options) => {
  console.log('web-view接收到的原始参数:', options)
  
  receivedOptions.value = { ...options }
  
  if (options.url) {
    try {
      const decodedUrl = decodeURIComponent(options.url)
      console.log('解码后的URL:', decodedUrl)
      
      url.value = decodedUrl
      
      if (Object.keys(options).length > 1) {
        const h5Params = { ...options }
        delete h5Params.url
        delete h5Params.title
        
        if (Object.keys(h5Params).length > 0) {
          const paramString = Object.entries(h5Params)
            .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
            .join('&')
          
          const separator = decodedUrl.includes('?') ? '&' : '?'
          url.value = `${decodedUrl}${separator}${paramString}`
          console.log('添加额外参数后的完整URL:', url.value)
        }
      }
    } catch (error) {
      console.error('URL解码失败:', error)
      url.value = options.url
    }
  } else {
    console.warn('未接收到有效的URL参数')
  }
  
  if (options.title) {
    try {
      const decodedTitle = decodeURIComponent(options.title)
      console.log('设置页面标题:', decodedTitle)
      uni.setNavigationBarTitle({
        title: decodedTitle
      })
    } catch (error) {
      console.error('标题解码失败:', error)
    }
  }
})
</script>
