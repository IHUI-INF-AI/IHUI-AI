<template>
  <div class="share-container">
    <!-- 加载状态 -->
    <div v-if="loading" class="loading-container">
      <div class="loading-spinner"></div>
      <div class="loading-text">加载中...</div>
    </div>

    <!-- 错误状态 -->
    <div v-else-if="error" class="error-container">
      <div class="error-icon">⚠️</div>
      <div class="error-text">{{ error }}</div>
      <button class="retry-btn" @click="loadShareContent">重试</button>
    </div>

    <!-- 内容区域 -->
    <div v-else-if="shareData" class="content-container">
      <!-- 头部信息 -->
      <div class="header">
        <div
          v-if="shareData.avatar"
          class="model-icon-wrapper"
        >
          <img
            :src="shareData.avatar"
            class="model-icon"
            alt="模型图标"
          />
        </div>
        <div
          v-else
          class="model-icon-placeholder"
        >🤖</div>
        <div class="model-name">{{ shareData.modelName || 'AI智能对话' }}</div>
      </div>

      <!-- 对话内容 -->
      <div class="chat-content">
        <div class="question-box">
          <div class="question-item">
            <div class="question-content">{{ shareData.question || '' }}</div>
          </div>
        </div>

        <div class="answer-box">
          <!-- 思考过程 -->
          <div v-if="shareData.thinkingContent" class="thinking-process-container">
            <div class="thinking-process-header">
              <span class="thinking-process-icon">💭</span>
              <div class="thinking-process-title">思考过程</div>
            </div>
            <div
              class="thinking-process-content"
              :class="{ 'thinking-process-expanded': isThinkingExpanded }"
            >
              <div class="thinking-process-text">{{ shareData.thinkingContent }}</div>
            </div>
            <div
              v-if="shareData.thinkingContent && shareData.thinkingContent.length > 200"
              class="thinking-process-toggle"
              @click="toggleThinkingExpand"
            >
              <span class="thinking-process-toggle-text">{{ isThinkingExpanded ? '收起' : '展开' }}</span>
              <span class="thinking-process-toggle-icon" :class="{ 'expanded': isThinkingExpanded }">▼</span>
            </div>
          </div>

          <!-- 视频内容 -->
          <div v-if="shareData.videoUrl" class="media-container">
            <div v-if="shareData.videoRatio === '9:16'" class="video-wrapper vertical">
              <video
                class="answer-video"
                :style="{
                  width: '118px',
                  height: '210px'
                }"
                controls
                :src="shareData.videoUrl"
              ></video>
            </div>
            <div v-else class="video-wrapper">
              <video
                class="answer-video"
                :style="{
                  width: videoWidth,
                  height: videoHeight
                }"
                controls
                :src="shareData.videoUrl"
              ></video>
            </div>
          </div>

          <!-- 图片列表 -->
          <div v-if="shareData.imgUrlList && shareData.imgUrlList.length > 0" class="media-container">
            <img
              v-for="(imgUrl, imgIndex) in shareData.imgUrlList"
              :key="imgIndex"
              :src="imgUrl"
              class="answer-image"
              @click="previewImage(imgUrl, shareData.imgUrlList)"
              :alt="`图片${imgIndex + 1}`"
            />
          </div>

          <!-- 音频内容 -->
          <div v-if="shareData.audioUrl" class="audio-player-container">
            <div class="audio-player">
              <span
                class="audio-play-icon"
                @click="toggleAudioPlay"
              >{{ !isAudioPlaying ? '▶️' : '⏸️' }}</span>
              <input
                type="range"
                class="audio-progress"
                :value="audioProgress"
                min="0"
                max="100"
                @input="onAudioProgressChange"
              />
              <div class="audio-time">{{ formatAudioTime(audioCurrentTime) }}</div>
            </div>
          </div>

          <!-- 文本内容 -->
          <div v-if="shareData.content" class="answer-text">
            {{ removeSpecialChars(shareData.content) }}
          </div>

          <!-- 混合内容（lists） -->
          <div v-if="shareData.lists && shareData.lists.length > 0" class="lists-container">
            <div v-for="(listItem, listIndex) in shareData.lists" :key="listIndex" class="list-item">
              <div v-if="listItem.type === 'text' && listItem.text" class="list-text">
                {{ removeSpecialChars(listItem.text) }}
              </div>
              <img
                v-if="listItem.type === 'image' && listItem.image"
                :src="listItem.image"
                class="answer-image"
                @click="previewImage(listItem.image, shareData.lists.filter(i => i.type === 'image').map(i => i.image))"
                :alt="`图片${listIndex + 1}`"
              />
            </div>
          </div>

          <!-- 底部信息 -->
          <div class="answer-footer">
            <div class="footer-text-left">
              <span>智汇AI生成</span>
              <span v-if="shareData.field1" class="footer-text-tokens">
                消耗智汇值：{{ formatTokens(shareData.field1) }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- 底部操作栏 -->
      <div class="bottom-bar">
        <button class="action-btn" @click="openMiniProgram">打开小程序</button>
        <button class="action-btn primary" @click="copyLink">复制链接</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import { getShareContentByCode } from '@/api/share'
import { uni } from '@/utils/uni-adapter'

const route = useRoute()

const loading = ref(true)
const error = ref('')
const shareData = ref(null)
const code = ref('')
const isThinkingExpanded = ref(false)
const isAudioPlaying = ref(false)
const audioProgress = ref(0)
const audioCurrentTime = ref(0)
const audioContext = ref(null)
const videoWidth = ref('calc(100vw - 40px)')
const videoHeight = ref('auto')

onMounted(() => {
  // 优先从查询参数获取code（如 ?code=abc123）
  code.value = route.query.code || ''

  // 如果查询参数没有，从路由路径参数获取（如 /abc123 或 /share/abc123）
  // 但要排除常见的路径名（如 dist, index.html 等）
  if (!code.value && route.params.code) {
    const pathCode = route.params.code
    // 排除常见的路径名
    if (pathCode && !['dist', 'index.html', 'index', 'share'].includes(pathCode)) {
      code.value = pathCode
    }
  }

  // 如果查询参数也没有，尝试直接从 URL 获取（兼容性处理）
  if (!code.value) {
    // 先尝试正常解析
    try {
      const urlParams = new URLSearchParams(window.location.search)
      code.value = urlParams.get('code') || ''
    } catch (e) {
      console.warn('URLSearchParams 解析失败:', e)
    }

    // 如果还是为空，尝试手动解析（处理 URL 编码的情况，如 code%3D）
    if (!code.value) {
      const href = window.location.href
      // 处理 code%3D 或 code= 的情况
      const patterns = [
        /[?&]code%3D([^&]*)/,  // code%3D (编码的 =)
        /[?&]code=([^&]*)/,    // code= (正常的 =)
        /[?&]code:([^&]*)/     // code: (冒号分隔)
      ]

      for (const pattern of patterns) {
        const match = href.match(pattern)
        if (match && match[1]) {
          try {
            code.value = decodeURIComponent(match[1])
            break
          } catch (e) {
            code.value = match[1]
            break
          }
        }
      }
    }
  }

  // 调试信息
  console.log('路由参数:', route.params)
  console.log('查询参数:', route.query)
  console.log('window.location.search:', window.location.search)
  console.log('获取到的code:', code.value)
  console.log('当前URL:', window.location.href)

  // 验证 code 是否有效（排除常见的路径名和无效值）
  const invalidCodes = ['dist', 'index.html', 'index', 'share', 'error', '']
  if (!code.value || invalidCodes.includes(code.value)) {
    loading.value = false
    error.value = '分享链接无效'
    console.error('无效的 code:', code.value)
    return
  }

  // 验证 code 格式（通常是32位十六进制字符串）
  if (code.value.length < 10) {
    console.warn('code 长度异常:', code.value)
  }

  loadShareContent()
})

onBeforeUnmount(() => {
  cleanupAudioContext()
})

// 加载分享内容
async function loadShareContent() {
  loading.value = true
  error.value = ''

  console.log('开始加载分享内容, code:', code.value)

  try {
    const res = await getShareContentByCode(code.value)
    console.log('分享内容接口响应:', res)
    console.log('响应类型:', typeof res)
    console.log('响应数据结构:', JSON.stringify(res, null, 2))

    // 如果响应是字符串 "success"，说明请求成功但没有数据
    if (res === 'success' || res === 'Success') {
      error.value = '分享内容为空'
      return
    }

    // 如果响应不是对象，报错
    if (!res || typeof res !== 'object') {
      error.value = '分享内容格式错误'
      return
    }

    // 提取实际数据
    let data = null

    // 情况1: 标准格式 { code: 200, data: {...} } 或 { code: "200", data: [...] }
    if (res.code !== undefined) {
      // 处理 code 为字符串或数字的情况
      const codeValue = typeof res.code === 'string' ? parseInt(res.code) : res.code
      if (codeValue === 200 || codeValue === 0 || res.code === '200' || res.code === '0') {
        // data 可能是数组，取第一个元素
        if (Array.isArray(res.data) && res.data.length > 0) {
          data = res.data[0]
        } else if (res.data && typeof res.data === 'object') {
          data = res.data
        } else {
          data = res
        }
      } else {
        // 业务错误
        error.value = res?.message || res?.msg || '获取分享内容失败'
        return
      }
    }
    // 情况2: 直接是数据对象 { question: ..., content: ... }
    else if (res.question !== undefined || res.content !== undefined || res.data) {
      if (Array.isArray(res.data) && res.data.length > 0) {
        data = res.data[0]
      } else {
        data = res.data || res
      }
    }
    // 情况3: 其他格式，尝试直接使用
    else {
      data = res
    }

    // 处理数据
    if (data && typeof data === 'object') {
      shareData.value = processShareData(data)
      calculateVideoSize()
      console.log('处理后的分享数据:', shareData.value)
    } else {
      error.value = '分享内容为空'
    }
  } catch (err) {
    console.error('加载分享内容失败:', err)

    // 处理不同类型的错误
    if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
      error.value = '请求超时，请检查网络连接后重试'
    } else if (err.code === 'ERR_NETWORK' || err.message?.includes('Network Error')) {
      error.value = '网络错误，请检查网络连接'
    } else if (err.response) {
      // HTTP 错误响应
      const status = err.response.status
      if (status === 404) {
        error.value = '分享内容不存在'
      } else if (status >= 500) {
        error.value = '服务器错误，请稍后重试'
      } else {
        error.value = err?.message || err?.response?.data?.message || '获取分享内容失败'
      }
    } else {
      error.value = err?.message || '加载失败，请稍后重试'
    }
  } finally {
    loading.value = false
  }
}

// 处理分享数据
function processShareData(data) {
  const processed = {
    // 问题字段：支持 problem 和 question
    question: data.problem || data.question || '',
    // 答案字段：支持 answer 和 content
    content: data.answer || data.content || '',
    thinkingContent: data.thinking_content || data.thinkingContent || '',
    videoUrl: data.video_url || data.videoUrl || '',
    videoRatio: data.video_ratio || data.videoRatio || '16:9',
    imgUrlList: data.img_url_list || data.imgUrlList || [],
    audioUrl: data.audio_url || data.audioUrl || '',
    lists: data.lists || [],
    // total_tokens 可能在顶层，也可能在 data 中
    totalTokens: data.total_tokens || data.totalTokens || 0,
    // field1 字段（智汇值）
    field1: data.field1 || data.total_tokens || data.totalTokens || 0,
    // modelName 支持多种字段名
    modelName: data.modelName || data.model_name || 'AI智能对话',
    // avatar 字段（模型头像）
    avatar: data.avatar || data.modelImg || data.model_img || data.agentUrl || data.agent_url || ''
  }

  // 处理图片URL列表（可能是字符串，需要分割）
  if (typeof processed.imgUrlList === 'string') {
    processed.imgUrlList = processed.imgUrlList.split(',').map(url => url.trim()).filter(url => url)
  }

  return processed
}

// 计算视频尺寸
function calculateVideoSize() {
  if (!shareData.value || !shareData.value.videoUrl || shareData.value.videoRatio === '9:16') {
    return
  }

  const systemInfo = uni.getSystemInfoSync()
  const windowWidth = systemInfo.windowWidth
  const videoWidthPx = windowWidth - 40 // 减去左右padding

  let aspectRatio = 16 / 9
  if (shareData.value.videoRatio && shareData.value.videoRatio.includes(':')) {
    const [widthRatio, heightRatio] = shareData.value.videoRatio.split(':').map(Number)
    if (!isNaN(widthRatio) && !isNaN(heightRatio) && heightRatio > 0) {
      aspectRatio = widthRatio / heightRatio
    }
  }

  videoWidth.value = `${videoWidthPx}px`
  videoHeight.value = `${videoWidthPx / aspectRatio}px`
}

// 移除特殊字符
function removeSpecialChars(str) {
  if (!str) return ''
  // 先判断是否包含连续的#号
  if (/#+/g.test(str)) {
    str = str.replace(/#+/g, '')
  }
  // 再判断是否包含连续的*号
  if (/\*+/g.test(str)) {
    str = str.replace(/\*+/g, '')
  }
  return str
}

// 预览图片
function previewImage(currentUrl, urlList) {
  uni.previewImage({
    current: currentUrl,
    urls: urlList || [currentUrl]
  })
}

// 切换思考过程展开/收起
function toggleThinkingExpand() {
  isThinkingExpanded.value = !isThinkingExpanded.value
}

// 切换音频播放/暂停
function toggleAudioPlay() {
  if (!shareData.value || !shareData.value.audioUrl) {
    return
  }

  isAudioPlaying.value = !isAudioPlaying.value

  if (isAudioPlaying.value) {
    // 创建音频上下文
    audioContext.value = uni.createInnerAudioContext()
    audioContext.value.src = shareData.value.audioUrl
    audioContext.value.volume = 1

    // 监听播放进度
    audioContext.value.onTimeUpdate(() => {
      const duration = audioContext.value.duration || 0
      const currentTime = audioContext.value.currentTime || 0
      const progress = duration > 0 ? (currentTime / duration) * 100 : 0
      audioProgress.value = progress
      audioCurrentTime.value = currentTime
    })

    // 监听播放结束
    audioContext.value.onEnded(() => {
      isAudioPlaying.value = false
      audioProgress.value = 100
      audioCurrentTime.value = audioContext.value.duration || 0
      cleanupAudioContext()
    })

    // 监听错误
    audioContext.value.onError(() => {
      isAudioPlaying.value = false
      cleanupAudioContext()
      uni.showToast({
        title: '音频播放失败',
        icon: 'none'
      })
    })

    // 开始播放
    audioContext.value.play()
  } else {
    // 暂停播放
    if (audioContext.value) {
      audioContext.value.pause()
      cleanupAudioContext()
    }
  }
}

// 处理音频进度条变化
function onAudioProgressChange(e) {
  const progress = e.target.value
  audioProgress.value = progress

  if (audioContext.value && audioContext.value.duration) {
    const seekTime = (progress / 100) * audioContext.value.duration
    audioContext.value.seek(seekTime)
    audioCurrentTime.value = seekTime
  }
}

// 格式化音频时间
function formatAudioTime(seconds) {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.floor(seconds % 60)
  return `${minutes}:${remainingSeconds < 10 ? '0' + remainingSeconds : remainingSeconds}`
}

// 格式化智汇值
function formatTokens(value) {
  if (!value) return '0'
  const numValue = typeof value === 'string' ? parseInt(value) : value
  if (isNaN(numValue)) return '0'
  return numValue >= 1000 ? (numValue / 1000).toFixed(1) + 'K' : numValue.toString()
}

// 清理音频上下文
function cleanupAudioContext() {
  if (audioContext.value) {
    audioContext.value.stop()
    audioContext.value.destroy()
    audioContext.value = null
  }
}

// 打开小程序
function openMiniProgram() {
  uni.showModal({
    title: '打开小程序',
    content: '请使用微信扫描小程序码或复制链接在微信中打开',
    showCancel: false
  })
}

// 复制链接
function copyLink() {
  let currentUrl = ''
  try {
    if (typeof window !== 'undefined' && window.location) {
      currentUrl = window.location.href
    } else {
      currentUrl = `https://aizhs.top/share/${code.value}`
    }
  } catch (e) {
    currentUrl = `https://aizhs.top/share/${code.value}`
  }

  uni.setClipboardData({
    data: currentUrl,
    success: () => {
      uni.showToast({
        title: '链接已复制',
        icon: 'success'
      })
    }
  })
}
</script>

<style lang="scss" scoped>
.share-container {
  min-height: 100vh;
  background: #ffffff;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
}

.loading-spinner {
  width: 30px;
  height: 30px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #9A99F3;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.loading-text {
  margin-top: 20px;
  font-size: 14px;
  color: #999;
}

.error-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  padding: 40px;
}

.error-icon {
  font-size: 60px;
  margin-bottom: 30px;
}

.error-text {
  font-size: 14px;
  color: #999;
  text-align: center;
  margin-bottom: 40px;
}

.retry-btn {
  padding: 10px 30px;
  background: #9A99F3;
  color: #fff;
  border-radius: 5px;
  font-size: 14px;
  border: none;
  cursor: pointer;
}

.retry-btn:hover {
  background: #8a89e3;
}

.content-container {
  min-height: 100vh;
  padding-bottom: 60px;
}

.header {
  display: flex;
  align-items: center;
  padding: 15px 20px;
  background: #fff;
  border-bottom: 1px solid #eee;
}

.model-icon-wrapper {
  margin-right: 10px;
}

.model-icon {
  width: 30px;
  height: 30px;
  border-radius: 5px;
  object-fit: cover;
}

.model-icon-placeholder {
  width: 30px;
  height: 30px;
  border-radius: 5px;
  margin-right: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  background: #f0f0f0;
}

.model-name {
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.chat-content {
  padding: 0 20px;
  max-height: calc(100vh - 100px);
  overflow-y: auto;
  font-size: 28px;
  color: #000000;
  padding-bottom: 20px;
  box-sizing: border-box;
}

.question-box {
  margin-bottom: 0;
  display: flex;
  justify-content: flex-end;
  width: 100%;
}

.question-item {
  max-width: 100%;
  width: 100%;
  display: flex;
  justify-content: flex-end;
}

.question-content {
  background: #9A99F3;
  box-sizing: border-box;
  border: 1px solid;
  border-image: linear-gradient(275deg, rgba(252, 255, 77, 0.5) -32%, rgba(76, 32, 116, 0) 5%, rgba(54, 16, 88, 0) 98%, rgba(54, 16, 88, 0.5) 129%) 1;
  border-radius: 15px;
  float: right;
  margin-top: 20px;
  padding: 20px;
  font-size: 22px;
  font-weight: normal;
  line-height: 28px;
  letter-spacing: 0.02em;
  color: #FFFFFF;
  white-space: pre-wrap;
  word-wrap: break-word;
  word-break: break-all;
}

.question-content::after {
  content: '';
  display: block;
  clear: both;
  width: 100%;
  height: 1px;
}

.answer-box {
  white-space: pre-wrap;
  word-wrap: break-word;
  word-break: break-all;
  background-color: #fff;
  border-radius: 30px;
  opacity: 1;
  background: #F6F6F6;
  box-sizing: border-box;
  border: 1px solid #EEEEEE;
  width: 100%;
  float: left;
  margin-top: 20px;
  padding: 20px;
  font-size: 22px;
  font-weight: normal;
  line-height: 28px;
  letter-spacing: 0.02em;
  color: #333333;
}

.answer-box::after {
  content: '';
  display: block;
  clear: both;
  width: 100%;
  height: 1px;
}

.thinking-process-container {
  margin-bottom: 20px;
  padding: 20px;
  background: linear-gradient(135deg, #f8f9ff 0%, #f0f4ff 100%);
  border-radius: 15px;
  border: 1px solid #e8ecff;
}

.thinking-process-header {
  display: flex;
  align-items: center;
  margin-bottom: 15px;
}

.thinking-process-icon {
  width: 30px;
  height: 30px;
  margin-right: 10px;
  font-size: 30px;
  display: inline-block;
  line-height: 1;
}

.thinking-process-title {
  font-size: 26px;
  font-weight: 600;
  color: #6366f1;
}

.thinking-process-content {
  max-height: 200px;
  overflow: hidden;
  transition: max-height 0.3s ease;
  position: relative;
}

.thinking-process-content.thinking-process-expanded {
  max-height: none;
}

.thinking-process-text {
  font-size: 24px;
  line-height: 1.6;
  color: #64748b;
  white-space: pre-wrap;
  word-wrap: break-word;
  display: block;
}

.thinking-process-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 15px;
  padding: 10px 0;
  cursor: pointer;
  user-select: none;
}

.thinking-process-toggle-text {
  font-size: 24px;
  color: #6366f1;
  margin-right: 8px;
}

.thinking-process-toggle-icon {
  font-size: 20px;
  color: #6366f1;
  transition: transform 0.3s ease;
  display: inline-block;
}

.thinking-process-toggle-icon.expanded {
  transform: rotate(180deg);
}

.media-container {
  margin: 10px 0;
}

.video-wrapper {
  border-radius: 8px;
  overflow: hidden;
}

.video-wrapper.vertical {
  display: inline-block;
}

.answer-video {
  display: block;
  border-radius: 8px;
  width: 100%;
  max-width: 100%;
}

.answer-image {
  width: calc(100vw - 94px);
  border-radius: 15px;
  margin-bottom: 20px;
  display: block;
  cursor: pointer;
}

.audio-player-container {
  width: calc(100vw - 94px);
  margin-top: 10px;
  margin-bottom: 10px;
}

.audio-player {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  background-color: #f5f5f5;
  padding: 15px 20px;
  border-radius: 15px;
}

.audio-play-icon {
  width: 40px;
  height: 40px;
  margin-right: 25px;
  align-self: center;
  flex-shrink: 0;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  user-select: none;
  font-size: 18px;
}

.audio-progress {
  flex: 1;
  height: 40px;
  margin: 0;
  margin-right: 25px;
  align-self: center;
  min-width: 0;
  padding: 0;
}

.audio-time {
  font-size: 20px;
  color: #666;
  margin-right: 15px;
  min-width: 40px;
  text-align: right;
  align-self: center;
  flex-shrink: 0;
}

.answer-text {
  display: block;
  white-space: pre-wrap;
  word-wrap: break-word;
  word-break: break-all;
  font-size: 22px;
  line-height: 28px;
  color: #333;
  margin: 10px 0;
}

.lists-container {
  margin: 10px 0;
}

.list-item {
  margin-bottom: 10px;
}

.list-text {
  display: block;
  font-size: 14px;
  line-height: 1.8;
  color: #333;
  white-space: pre-wrap;
  word-wrap: break-word;
  margin-bottom: 10px;
}

.answer-footer {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  margin-top: 15px;
  padding-top: 10px;
  border-top: 1px solid #eee;
}

.footer-text-left {
  display: flex;
  align-items: center;
  gap: 15px;
  font-size: 12px;
  color: #999;
}

.footer-text-tokens {
  font-size: 12px;
  color: #999;
}

.footer-text {
  font-size: 12px;
  color: #999;
}

.bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  padding: 10px;
  background: #fff;
  border-top: 1px solid #eee;
  gap: 10px;
  z-index: 100;
}

.action-btn {
  flex: 1;
  padding: 12px 0;
  background: #f5f5f5;
  color: #333;
  border-radius: 5px;
  font-size: 14px;
  border: none;
  cursor: pointer;
}

.action-btn:hover {
  background: #e5e5e5;
}

.action-btn.primary {
  background: #9A99F3;
  color: #fff;
}

.action-btn.primary:hover {
  background: #8a89e3;
}
</style>
