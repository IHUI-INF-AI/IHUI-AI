<template>
    <view class="container">
        <!-- 导航栏固定到屏幕最顶部，避免被安全区/默认内边距下推 -->
        <view class="nav-bar-fixed">
            <navigation-bars 
                :title="chatTitle" 
                :viscosity="true" 
                :showBack="true"
                :showFenLei="false"
                image="/static/images/back.svg"
                backgroundColor="#fff"
            />
        </view>
        <view class="nav-bar-spacer" :style="{ height: topBarHeightPx }"></view>
        <scroll-view 
            class="chat-container" 
            scroll-y 
            :scroll-top="scrollTop"
            @scrolltoupper="loadMoreHistory"
        >
            <!-- 商品信息卡片 -->
            <!-- <view class="product-card" v-if="productInfo">
                <image class="product-image" :src="productInfo.image" mode="aspectFill" />
                <view class="product-info">
                    <view class="product-price-wrapper">
                        <text class="product-price">¥{{productInfo.price}}</text>
                        <text class="product-shipping">含运费{{productInfo.shipping}}元</text>
                    </view>
                    <text class="product-location">{{productInfo.location}}</text>
                </view>
                <view class="buy-again-btn" @click="handleBuyAgain">再次购买</view>
            </view> -->
            
            <!-- 聊天消息区域 -->
            <view class="chat-messages">
            <view 
                    class="message-item" 
                v-for="(item, index) in chatList" 
                :key="index"
                    :class="item.type"
                >
                    <!-- 买家消息（右侧） -->
                    <template v-if="item.type === 'user'">
                        <view class="message-bubble user-bubble" :class="{
                            'media-message': item.mediaType === 'image' || item.mediaType === 'audio' || item.mediaType === 'video' || item.mediaType === 'file' || item.messageType === 2 || item.messageType === 3 || item.messageType === 4 || item.messageType === 5
                        }">
                            <!-- 图片消息 -->
                            <image v-if="item.mediaType === 'image' || item.messageType === 2" 
                                   :src="item.mediaUrl || item.content" 
                                   mode="aspectFit"
                                   class="message-image"
                                   @error="handleImageError"
                                   @load="handleImageLoad"
                                   @click="previewImage(item.mediaUrl || item.content)" />
                            <!-- 视频消息 -->
                            <video v-else-if="item.mediaType === 'video' || item.messageType === 5" 
                                   :src="item.mediaUrl || item.content" 
                                   class="message-video"
                                   controls
                                   :poster="item.poster || ''" />
                            <!-- 音频消息 -->
                            <view v-else-if="item.mediaType === 'audio' || item.messageType === 3" class="message-audio">
                                <text class="audio-text">🎵 音频消息</text>
                                <text class="audio-url" @click="openAudio(item.mediaUrl || item.content)">点击播放</text>
                </view>
                            <!-- 文件消息 -->
                            <view v-else-if="item.mediaType === 'file' || item.messageType === 4" class="message-file">
                                <text class="file-text">📄 文件消息</text>
                                <text class="file-url" @click="openFile(item.mediaUrl || item.content)">点击查看</text>
                            </view>
                            <!-- 文本消息 -->
                            <view v-else class="bubble-text">{{item.content}}</view>
                            <view class="read-status" v-if="item.read">已读</view>
                        </view>
                        <view class="avatar user-avatar">
                            <image :src="item.avatar || userAvatar" mode="aspectFill" />
                        </view>
                    </template>
                    
                    <!-- 卖家消息（左侧） -->
                    <template v-else-if="item.type === 'seller'">
                        <view class="avatar seller-avatar">
                            <image :src="item.avatar || sellerAvatar" mode="aspectFill" />
                        </view>
                        <view class="message-bubble seller-bubble" :class="{
                            'media-message': item.mediaType === 'image' || item.mediaType === 'audio' || item.mediaType === 'video' || item.mediaType === 'file' || item.messageType === 2 || item.messageType === 3 || item.messageType === 4 || item.messageType === 5
                        }">
                            <!-- 图片消息 -->
                            <image v-if="item.mediaType === 'image' || item.messageType === 2" 
                                   :src="item.mediaUrl || item.content" 
                                   mode="aspectFit"
                                   class="message-image"
                                   @error="handleImageError"
                                   @load="handleImageLoad"
                                   @click="previewImage(item.mediaUrl || item.content)" />
                            <!-- 视频消息 -->
                            <video v-else-if="item.mediaType === 'video' || item.messageType === 5" 
                                   :src="item.mediaUrl || item.content" 
                                   class="message-video"
                                   controls
                                   :poster="item.poster || ''" />
                            <!-- 音频消息 -->
                            <view v-else-if="item.mediaType === 'audio' || item.messageType === 3" class="message-audio">
                                <text class="audio-text">🎵 音频消息</text>
                                <text class="audio-url" @click="openAudio(item.mediaUrl || item.content)">点击播放</text>
                            </view>
                            <!-- 文件消息 -->
                            <view v-else-if="item.mediaType === 'file' || item.messageType === 4" class="message-file">
                                <text class="file-text">📄 文件消息</text>
                                <text class="file-url" @click="openFile(item.mediaUrl || item.content)">点击查看</text>
                            </view>
                            <!-- 文本消息 -->
                            <view v-else class="bubble-text">{{item.content}}</view>
                        </view>
                    </template>
                    
                    <!-- 系统消息（居中） -->
                    <template v-else-if="item.type === 'system'">
                        <view class="system-message">
                            <text>{{item.content}}</text>
                        </view>
                    </template>
                </view>
            </view>
        </scroll-view>
        
        <!-- 输入区域：与首页一致，使用固定底部的 input_box_content -->
        <view class="input_box_content" :style="{ position: 'fixed', bottom: computedContainerBottom }">
            <BottomActionBar
            ref="bottomActionBar"
            :isShowIcon="isShowIcon"
            :imgsList="imgsList"
            :modelName="modelName"
            :modelNameEN="modelNameEN"
            :isVoiceAnimationActive="isVoiceAnimationActive"
            :isVoiceInput="isVoiceInput"
            :isIOS="isIOS"
            :isLoading="false"
            :prompt="inputContent"
            :placeholderStyle="'color: #999999; font-size: 28rpx;'"
            :inputFocused="inputFocused"
            :isVoiceAnimationActiveStart="isVoiceAnimationActiveStart"
            :pageAgentVariables="pageAgentVariables"
            :modelInfo="modelInfo"
            :inputBottom="inputBottom"
            :statusBarHeight="statusBarHeight"
            :titleBarHeight="titleBarHeight"
            :textarea_int="true"
            :sourceIs="sourceIs"
            :showModel="false"
            :showModelSelect="false"
            :modelConfigChangeData="modelConfigChangeData"
            @toggle-super-agent="handleToggleSuperAgent"
            @toggle-mcp="handleToggleMCP"
            @toggle-knowledge-base="handleToggleKnowledgeBase"
            @toggle-permanent-memory="handleTogglePermanentMemory"
            @toggle-voice-input="toggleVoiceInput"
            @remove-image="removeImage"
            @send-message="handleSendMessage"
            @start-long-press="startLongPress"
            @end-long-press="endLongPress"
            @input-focus="handleInputFocus"
            @input-blur="handleInputBlur"
            @input-click="handleInputClick"
            @start-voice-animation="startVoiceAnimation"
            @stop-voice-animation="stopVoiceAnimation"
            @function-handle="handleAddClick"
            @source-handle="handleSourceHandle"
            @icon-click="handleIconClick"
            @update:prompt="updateInputContent"
            @showModelConfig="handleShowModelConfig"
            @textareaHeightChange="handleTextareaHeightChange"
            @modelConfigChange="handleModelConfigChange"
            @keyboard-show="handleKeyboardShow"
            @keyboard-hide="handleKeyboardHide"
            />
        </view>
    </view>
</template>

<script setup>
import { ref, computed, nextTick, onUnmounted } from 'vue'
import { onLoad, onUnload } from '@dcloudio/uni-app'
import navigationBars from '@/components/navigation-bars/index.vue'
import BottomActionBar from '@/components/BottomActionBar.vue'
import { getRoomHistory, markRoomAsRead } from '@/service/message.js'
import websocketManager from '@/utils/websocket.js'
import { baseUrl3 } from '@/utils/service/index.js'
import { useChat } from '@/composables/shared-logic'

const { messages: chatMessages, connect, disconnect, send, loadHistory, clearMessages } = useChat()

const chatId = ref(null)
const roomId = ref(null)
const userUuid = ref('')
const receiverUuid = ref('')
const chatTitle = ref('AI助手')
const sellerAvatar = ref('/static/images/default-avatar.png')
const senderAvatar = ref('')
const scrollTop = ref(0)
const inputContent = ref('')
const userAvatar = ref('/static/images/default-avatar.png')
const productInfo = ref({
    image: '/static/images/product-thumb.png',
    price: '299.00',
    shipping: '0.00',
    location: '广东·广州'
})
const chatList = ref([])
const lastHistoryMessageId = ref(null)
const lastHistoryMessageContent = ref(null)
const lastHistoryMessageTime = ref(null)
const lastHistoryMessageUserUuid = ref(null)
const isShowIcon = ref(false)
const imgsList = ref([])
const modelName = ref('')
const modelNameEN = ref('')
const isVoiceAnimationActive = ref(false)
const isVoiceInput = ref(false)
const isIOS = ref(false)
const inputFocused = ref(false)
const isVoiceAnimationActiveStart = ref(false)
const inputBottom = ref(0)
const statusBarHeight = ref('0')
const titleBarHeight = ref('0')
const pageAgentVariables = ref([])
const modelInfo = ref(null)
const sourceIs = ref(false)
const textarea_int = ref(true)
const modelConfigChangeData = ref({})
const wsConnected = ref(false)
const bottomActionBar = ref(null)

const computedContainerBottom = computed(() => '0')

const topBarHeightPx = computed(() => {
    const v = typeof getApp !== 'undefined' && getApp().globalData && getApp().globalData.$styleVariables && getApp().globalData.$styleVariables['--app-top-bar-height']
    return v || `${(parseInt(statusBarHeight.value, 10) || 0) + (parseInt(titleBarHeight.value, 10) || 44)}px`
})

onLoad((options) => {
    if (options.roomId) {
        roomId.value = options.roomId
        chatId.value = options.roomId
    } else if (options.id) {
        chatId.value = options.id
        roomId.value = options.id
    }

    if (options.room_name) {
        chatTitle.value = decodeURIComponent(options.room_name)
    }

    if (options.receiver_uuid) {
        receiverUuid.value = decodeURIComponent(options.receiver_uuid)
    }

    const userData = uni.getStorageSync('data')
    if (userData && userData.uuid) {
        userUuid.value = userData.uuid
    }
    if (userData && userData.avatar) {
        userAvatar.value = userData.avatar
    } else if (userData && userData.headimgurl) {
        userAvatar.value = userData.headimgurl
    } else if (userData && userData.thirdPartyAccounts && userData.thirdPartyAccounts.avatar) {
        userAvatar.value = userData.thirdPartyAccounts.avatar
    }

    if (options.avatar) {
        sellerAvatar.value = decodeURIComponent(options.avatar)
    }

    const systemInfo = uni.getSystemInfoSync()
    isIOS.value = systemInfo.platform === 'ios'
    statusBarHeight.value = String(systemInfo.statusBarHeight || 0)
    titleBarHeight.value = '44'

    if (roomId.value) {
        loadChatHistory()
        markAsRead()
    }

    if (userUuid.value) {
        connectWebSocket()
    }
})

onUnload(() => {
    disconnectWebSocket()
})

async function loadChatHistory() {
    if (!roomId.value) {
        console.warn('房间ID不存在，无法加载历史记录')
        return
    }
    if (!userUuid.value) {
        console.warn('用户UUID不存在，无法加载历史记录')
        return
    }
    try {
        console.log('开始加载房间历史消息，用户UUID:', userUuid.value, '房间ID:', roomId.value)
        const res = await getRoomHistory(userUuid.value, roomId.value)
        console.log('获取历史消息响应:', res)
        console.log('响应数据类型:', typeof res)
        console.log('响应数据内容:', JSON.stringify(res, null, 2))
        let messages = []
        if (res) {
            if (res.code === 200 || res.code === '200') {
                if (res.data && res.data.messages) {
                    messages = res.data.messages || []
                } else if (Array.isArray(res.data)) {
                    messages = res.data
                }
            } else if (Array.isArray(res)) {
                messages = res
            } else if (res.messages) {
                messages = res.messages
            } else if (res.data && Array.isArray(res.data)) {
                messages = res.data
            }
        }
        console.log('解析后的消息列表:', messages)
        console.log('消息数量:', messages.length)
        if (messages && messages.length > 0) {
            processMessages(messages)
        } else {
            console.warn('没有消息数据，返回数据:', res)
            chatList.value = []
            uni.showToast({
                title: '暂无历史消息',
                icon: 'none'
            })
        }
    } catch (error) {
        console.error('加载聊天历史记录失败:', error)
        uni.showToast({
            title: '加载消息失败',
            icon: 'none'
        })
    }
}

function processMessages(messages) {
    if (!messages || messages.length === 0) {
        chatList.value = []
        return
    }
    const currentUserUuid = userUuid.value
    let processedMessages = messages
        .filter(msg => msg.is_del === 0)
        .map(msg => {
            const isUserMessage = msg.user_uuid === currentUserUuid
            let messageAvatar = ''
            if (isUserMessage) {
                messageAvatar = userAvatar.value
            } else {
                messageAvatar = msg.sender_avatar || sellerAvatar.value
                if (msg.sender_avatar) {
                    sellerAvatar.value = msg.sender_avatar
                }
            }
            let mediaType = null
            let messageType = msg.type || 1
            let mediaUrl = null
            const content = msg.content || ''
            if (msg.type === 2) {
                mediaType = 'image'
                messageType = 2
                mediaUrl = content
            } else if (msg.type === 3) {
                mediaType = 'audio'
                messageType = 3
                mediaUrl = content
            } else if (msg.type === 4) {
                mediaType = 'file'
                messageType = 4
                mediaUrl = content
            } else if (content && (content.startsWith('http://') || content.startsWith('https://'))) {
                const urlLower = content.toLowerCase()
                const imageExts = /\.(jpg|jpeg|png|gif|webp|bmp|svg|ico)$/
                const videoExts = /\.(mp4|avi|mov|wmv|flv|mkv|webm|m4v|3gp|rm|rmvb)$/
                const audioExts = /\.(mp3|wav|aac|m4a|ogg|flac|wma|amr|ape)$/
                if (imageExts.test(urlLower)) {
                    mediaType = 'image'
                    messageType = 2
                    mediaUrl = content
                } else if (videoExts.test(urlLower)) {
                    mediaType = 'video'
                    messageType = 5
                    mediaUrl = content
                } else if (audioExts.test(urlLower)) {
                    mediaType = 'audio'
                    messageType = 3
                    mediaUrl = content
                } else {
                    mediaType = 'file'
                    messageType = 4
                    mediaUrl = content
                }
            }
            return {
                id: msg.id,
                type: isUserMessage ? 'user' : 'seller',
                content: content,
                sendTime: msg.send_time,
                source: msg.source,
                userUuid: msg.user_uuid,
                receiverUuid: msg.receiver_uuid,
                messageType: messageType,
                read: false,
                avatar: messageAvatar,
                senderName: msg.sender_name || '',
                senderAvatar: msg.sender_avatar || '',
                mediaType: mediaType,
                mediaUrl: mediaUrl
            }
        })
    processedMessages = processedMessages.reverse()
    const messageMap = new Map()
    const seenKeys = new Set()
    processedMessages.forEach(msg => {
        let shouldAdd = false
        let uniqueKey = null
        if (msg.id) {
            uniqueKey = `id_${msg.id}`
            if (!seenKeys.has(uniqueKey)) {
                seenKeys.add(uniqueKey)
                shouldAdd = true
            }
        } else {
            uniqueKey = `content_${msg.content}_${msg.userUuid}_${msg.sendTime}`
            if (!seenKeys.has(uniqueKey)) {
                seenKeys.add(uniqueKey)
                shouldAdd = true
            }
        }
        if (shouldAdd) {
            messageMap.set(uniqueKey, msg)
        }
    })
    chatList.value = Array.from(messageMap.values())
    if (chatList.value.length > 0) {
        const lastMessage = chatList.value[chatList.value.length - 1]
        lastHistoryMessageId.value = lastMessage.id
        lastHistoryMessageContent.value = lastMessage.content
        lastHistoryMessageTime.value = lastMessage.sendTime
        lastHistoryMessageUserUuid.value = lastMessage.userUuid
        console.log('记录最后一条历史消息信息:', {
            id: lastHistoryMessageId.value,
            content: lastHistoryMessageContent.value,
            time: lastHistoryMessageTime.value,
            userUuid: lastHistoryMessageUserUuid.value
        })
    }
    console.log('处理后的聊天列表:', chatList.value)
    scrollToBottom()
    setTimeout(() => {
        scrollToBottom()
    }, 500)
}

async function markAsRead() {
    if (!userUuid.value || !roomId.value) {
        console.warn('用户UUID或房间ID不存在，无法标记为已读')
        return
    }
    try {
        console.log('开始标记房间为已读，用户UUID:', userUuid.value, '房间ID:', roomId.value)
        const res = await markRoomAsRead(userUuid.value, roomId.value)
        console.log('标记已读成功:', res)
    } catch (error) {
        console.error('标记已读失败:', error)
    }
}

function scrollToBottom() {
    nextTick(() => {
        setTimeout(() => {
            const query = uni.createSelectorQuery()
            query.select('.chat-container').boundingClientRect()
            query.select('.chat-messages').boundingClientRect()
            query.exec(res => {
                if (res[0] && res[1]) {
                    const scrollHeight = res[1].height || res[0].scrollHeight || 99999
                    scrollTop.value = scrollHeight
                } else {
                    scrollTop.value = 99999
                }
            })
        }, 100)
    })
}

async function handleSendMessage(content) {
    if (!content || !content.trim()) {
        return
    }
    if (!wsConnected.value) {
        uni.showToast({
            title: 'WebSocket 未连接，请稍后重试',
            icon: 'none'
        })
        return
    }
    if (!userUuid.value) {
        uni.showToast({
            title: '用户信息不完整',
            icon: 'none'
        })
        return
    }
    if (!roomId.value) {
        console.log('没有房间ID，将发送到系统房间')
    }
    const messageContent = content.trim()
    try {
        const messageData = {
            event: 'send_message',
            user_uuid: userUuid.value,
            content: messageContent
        }
        if (roomId.value) {
            messageData.room_id = roomId.value
        }
        if (receiverUuid.value) {
            messageData.receiver_uuid = receiverUuid.value
        }
        console.log('发送消息:', messageData)
        const tempMessageId = `temp_${Date.now()}`
        const userMessage = {
            id: tempMessageId,
            type: 'user',
            content: messageContent,
            sendTime: new Date().toISOString(),
            source: userUuid.value,
            userUuid: userUuid.value,
            receiverUuid: '',
            messageType: 1,
            read: false,
            avatar: userAvatar.value,
            senderName: '',
            senderAvatar: '',
            isTemp: true
        }
        chatList.value.push(userMessage)
        inputContent.value = ''
        scrollToBottom()
        const sendResult = websocketManager.send(messageData)
        if (!sendResult) {
            const index = chatList.value.findIndex(msg => msg.id === tempMessageId)
            if (index !== -1) {
                chatList.value.splice(index, 1)
            }
            uni.showToast({
                title: '消息发送失败，请检查连接',
                icon: 'none'
            })
            return
        }
        scrollToBottom()
    } catch (error) {
        console.error('发送消息失败:', error)
        uni.showToast({
            title: '发送消息失败',
            icon: 'none'
        })
    }
}

function updateInputContent(content) {
    inputContent.value = content
}

function toggleVoiceInput() {
    isVoiceInput.value = !isVoiceInput.value
    if (isVoiceInput.value) {
        isVoiceAnimationActive.value = true
    } else {
        isVoiceAnimationActive.value = false
        isVoiceAnimationActiveStart.value = false
    }
}

function startVoiceAnimation() {
    isVoiceAnimationActiveStart.value = true
}

function stopVoiceAnimation() {
    isVoiceAnimationActiveStart.value = false
}

function handleInputFocus(e) {
    inputFocused.value = true
}

function handleInputBlur() {
    inputFocused.value = false
}

function handleKeyboardShow(e) {
    nextTick(() => {
        setTimeout(() => scrollToBottom(), 100)
    })
}

function handleKeyboardHide() {}

function sendMessage() {
    handleSendMessage(inputContent.value)
}

function loadMoreHistory() {
}

function handleBuyAgain() {
    uni.showToast({
        title: '再次购买',
        icon: 'none'
    })
}

function handleQuickQuestion(question) {
    inputContent.value = question
    handleSendMessage(question)
}

function handleAddClick() {
    isShowIcon.value = !isShowIcon.value
}

function removeImage(index) {
    if (imgsList.value && imgsList.value.length > index) {
        imgsList.value.splice(index, 1)
    }
}

function startLongPress() {
}

function endLongPress() {
}

function handleInputClick() {
}

function handleSourceHandle() {
}

function handleIconClick(type) {
    if (type === 'camera') {
        uni.chooseImage({
            count: 1,
            sourceType: ['camera'],
            success: (res) => {
                sendImage(res.tempFilePaths[0])
            }
        })
    } else if (type === 'album') {
        uni.chooseImage({
            count: 1,
            sourceType: ['album'],
            success: (res) => {
                sendImage(res.tempFilePaths[0])
            }
        })
    } else if (type === 'audio') {
        uni.chooseVideo({
            count: 1,
            success: (res) => {
                sendFile(res.tempFilePath, 'audio')
            }
        })
    } else if (type === 'file') {
        // #ifdef H5
        uni.chooseFile({
            count: 1,
            success: (res) => {
                sendFile(res.tempFiles[0].path, 'file')
            }
        })
        // #endif
        // #ifndef H5
        uni.showToast({
            title: '当前环境不支持文件选择',
            icon: 'none'
        })
        // #endif
    } else if (type === 'wxfile') {
        // #ifdef MP-WEIXIN
        uni.chooseMessageFile({
            count: 1,
            success: (res) => {
                sendFile(res.tempFiles[0].path, 'file')
            }
        })
        // #endif
        // #ifndef MP-WEIXIN
        uni.showToast({
            title: '仅微信小程序支持',
            icon: 'none'
        })
        // #endif
    }
    isShowIcon.value = false
}

async function sendImage(imagePath) {
    if (!imagePath) {
        return
    }
    if (!wsConnected.value) {
        uni.showToast({
            title: 'WebSocket 未连接，请稍后重试',
            icon: 'none'
        })
        return
    }
    if (!userUuid.value) {
        uni.showToast({
            title: '用户信息不完整',
            icon: 'none'
        })
        return
    }
    try {
        uni.showLoading({
            title: '上传中...',
            mask: true
        })
        const base64 = await imageToBase64(imagePath)
        const { uploadBybase64 } = await import('@/service/businessCard.js')
        const fileName = imagePath.split('/').pop() || `image_${Date.now()}.jpg`
        let uploadResult
        try {
            uploadResult = await uploadBybase64(base64, fileName)
        } catch (uploadError) {
            uni.hideLoading()
            console.error('图片上传失败:', uploadError)
            if (uploadError && (uploadError.code === 401 || uploadError.code === 40101 || uploadError.code === 499)) {
                return
            }
            uni.showToast({
                title: '图片上传失败',
                icon: 'none'
            })
            return
        }
        uni.hideLoading()
        let imageUrl = ''
        if (uploadResult) {
            if (typeof uploadResult === 'string') {
                imageUrl = uploadResult
            } else if (uploadResult.url) {
                imageUrl = uploadResult.url
            } else if (uploadResult.data && typeof uploadResult.data === 'string') {
                imageUrl = uploadResult.data
            } else if (uploadResult.data && uploadResult.data.url) {
                imageUrl = uploadResult.data.url
            }
        }
        if (!imageUrl) {
            uni.showToast({
                title: '图片上传失败',
                icon: 'none'
            })
            return
        }
        const messageData = {
            event: 'send_message',
            user_uuid: userUuid.value,
            content: imageUrl
        }
        if (roomId.value) {
            messageData.room_id = roomId.value
        }
        if (receiverUuid.value) {
            messageData.receiver_uuid = receiverUuid.value
        }
        const tempMessageId = `temp_${Date.now()}`
        const userMessage = {
            id: tempMessageId,
            type: 'user',
            content: imageUrl,
            sendTime: new Date().toISOString(),
            source: userUuid.value,
            userUuid: userUuid.value,
            receiverUuid: '',
            messageType: 2,
            read: false,
            avatar: userAvatar.value,
            senderName: '',
            senderAvatar: '',
            isTemp: true,
            mediaType: 'image',
            mediaUrl: imageUrl
        }
        chatList.value.push(userMessage)
        scrollToBottom()
        const sendResult = websocketManager.send(messageData)
        if (!sendResult) {
            const index = chatList.value.findIndex(msg => msg.id === tempMessageId)
            if (index !== -1) {
                chatList.value.splice(index, 1)
            }
            uni.showToast({
                title: '图片发送失败，请检查连接',
                icon: 'none'
            })
        } else {
            uni.showToast({
                title: '图片已发送',
                icon: 'success',
                duration: 1500
            })
            scrollToBottom()
        }
    } catch (error) {
        uni.hideLoading()
        console.error('发送图片失败:', error)
        if (error && (error.code === 401 || error.code === 40101 || error.code === 499)) {
            return
        }
        uni.showToast({
            title: '发送图片失败',
            icon: 'none'
        })
    }
}

async function sendFile(filePath, fileType) {
    if (!filePath) {
        return
    }
    if (!wsConnected.value) {
        uni.showToast({
            title: 'WebSocket 未连接，请稍后重试',
            icon: 'none'
        })
        return
    }
    if (!userUuid.value) {
        uni.showToast({
            title: '用户信息不完整',
            icon: 'none'
        })
        return
    }
    try {
        uni.showLoading({
            title: '上传中...',
            mask: true
        })
        const { uploadBybase64 } = await import('@/service/businessCard.js')
        const base64 = await fileToBase64(filePath)
        const fileName = filePath.split('/').pop() || `${fileType}_${Date.now()}`
        let uploadResult
        try {
            uploadResult = await uploadBybase64(base64, fileName)
        } catch (uploadError) {
            uni.hideLoading()
            console.error('文件上传失败:', uploadError)
            if (uploadError && (uploadError.code === 401 || uploadError.code === 40101 || uploadError.code === 499)) {
                return
            }
            uni.showToast({
                title: '文件上传失败',
                icon: 'none'
            })
            return
        }
        uni.hideLoading()
        let fileUrl = ''
        if (uploadResult) {
            if (typeof uploadResult === 'string') {
                fileUrl = uploadResult
            } else if (uploadResult.url) {
                fileUrl = uploadResult.url
            } else if (uploadResult.data && typeof uploadResult.data === 'string') {
                fileUrl = uploadResult.data
            } else if (uploadResult.data && uploadResult.data.url) {
                fileUrl = uploadResult.data.url
            }
        }
        if (!fileUrl) {
            uni.showToast({
                title: '文件上传失败',
                icon: 'none'
            })
            return
        }
        const messageData = {
            event: 'send_message',
            user_uuid: userUuid.value,
            content: fileUrl
        }
        if (roomId.value) {
            messageData.room_id = roomId.value
        }
        if (receiverUuid.value) {
            messageData.receiver_uuid = receiverUuid.value
        }
        const tempMessageId = `temp_${Date.now()}`
        const userMessage = {
            id: tempMessageId,
            type: 'user',
            content: fileUrl,
            sendTime: new Date().toISOString(),
            source: userUuid.value,
            userUuid: userUuid.value,
            receiverUuid: '',
            messageType: fileType === 'audio' ? 3 : 4,
            read: false,
            avatar: userAvatar.value,
            senderName: '',
            senderAvatar: '',
            isTemp: true,
            mediaType: fileType,
            mediaUrl: fileUrl
        }
        chatList.value.push(userMessage)
        scrollToBottom()
        const sendResult = websocketManager.send(messageData)
        if (!sendResult) {
            const index = chatList.value.findIndex(msg => msg.id === tempMessageId)
            if (index !== -1) {
                chatList.value.splice(index, 1)
            }
            uni.showToast({
                title: '文件发送失败，请检查连接',
                icon: 'none'
            })
        } else {
            uni.showToast({
                title: '文件已发送',
                icon: 'success',
                duration: 1500
            })
            scrollToBottom()
        }
    } catch (error) {
        uni.hideLoading()
        console.error('发送文件失败:', error)
        if (error && (error.code === 401 || error.code === 40101 || error.code === 499)) {
            return
        }
        uni.showToast({
            title: '发送文件失败',
            icon: 'none'
        })
    }
}

function imageToBase64(imagePath) {
    return new Promise((resolve, reject) => {
        // #ifdef APP-PLUS
        const resolveAndRead = (filePath) => {
            plus.io.resolveLocalFileSystemURL(filePath, (entry) => {
                entry.file((file) => {
                    const reader = new plus.io.FileReader()
                    reader.onloadend = (e) => {
                        const base64Data = e.target.result
                        const pureBase64 = base64Data.split(',')[1] || base64Data
                        resolve(pureBase64)
                    }
                    reader.onerror = (err) => {
                        reject(new Error('文件读取失败: ' + (err.message || '未知错误')))
                    }
                    reader.readAsDataURL(file)
                }, (err) => {
                    reject(new Error('获取文件对象失败: ' + (err.message || '未知错误')))
                })
            }, (err) => {
                console.log('直接读取失败，尝试保存到应用运行路径:', err)
                const fsm = uni.getFileSystemManager()
                if (fsm) {
                    fsm.saveFile({
                        tempFilePath: imagePath,
                        success: (res) => {
                            console.log('文件已保存到应用运行路径:', res.savedFilePath)
                            resolveAndRead(res.savedFilePath)
                        },
                        fail: (saveErr) => {
                            console.error('保存文件到应用运行路径失败:', saveErr)
                            reject(new Error('文件路径不支持，请重新选择图片'))
                        }
                    })
                } else {
                    reject(new Error('文件路径不支持，请重新选择图片: ' + (err.message || '未知错误')))
                }
            })
        }
        resolveAndRead(imagePath)
        // #endif

        // #ifndef APP-PLUS
        try {
            const fileSystemManager = uni.getFileSystemManager()
            if (!fileSystemManager) {
                // #ifdef H5
                const xhr = new XMLHttpRequest()
                xhr.open('GET', imagePath, true)
                xhr.responseType = 'blob'
                xhr.onload = () => {
                    const reader = new FileReader()
                    reader.onloadend = () => {
                        const base64Data = reader.result
                        const pureBase64 = base64Data.split(',')[1] || base64Data
                        resolve(pureBase64)
                    }
                    reader.onerror = (err) => {
                        reject(new Error('FileReader 读取失败'))
                    }
                    reader.readAsDataURL(xhr.response)
                }
                xhr.onerror = (err) => {
                    reject(new Error('图片加载失败'))
                }
                xhr.send()
                // #endif
                // #ifndef H5
                reject(new Error('getFileSystemManager 不可用'))
                // #endif
                return
            }
            fileSystemManager.readFile({
                filePath: imagePath,
                encoding: 'base64',
                success: (res) => {
                    resolve(res.data)
                },
                fail: (err) => {
                    reject(err)
                }
            })
        } catch (err) {
            reject(err)
        }
        // #endif
    })
}

function fileToBase64(filePath) {
    return new Promise((resolve, reject) => {
        // #ifdef APP-PLUS
        plus.io.resolveLocalFileSystemURL(filePath, (entry) => {
            entry.file((file) => {
                const reader = new plus.io.FileReader()
                reader.onloadend = (e) => {
                    const base64Data = e.target.result
                    const pureBase64 = base64Data.split(',')[1] || base64Data
                    resolve(pureBase64)
                }
                reader.onerror = (err) => {
                    reject(err)
                }
                reader.readAsDataURL(file)
            }, (err) => {
                reject(err)
            })
        }, (err) => {
            reject(err)
        })
        // #endif

        // #ifndef APP-PLUS
        try {
            const fileSystemManager = uni.getFileSystemManager()
            if (!fileSystemManager) {
                // #ifdef H5
                const xhr = new XMLHttpRequest()
                xhr.open('GET', filePath, true)
                xhr.responseType = 'blob'
                xhr.onload = () => {
                    const reader = new FileReader()
                    reader.onloadend = () => {
                        const base64Data = reader.result
                        const pureBase64 = base64Data.split(',')[1] || base64Data
                        resolve(pureBase64)
                    }
                    reader.onerror = (err) => {
                        reject(new Error('FileReader 读取失败'))
                    }
                    reader.readAsDataURL(xhr.response)
                }
                xhr.onerror = (err) => {
                    reject(new Error('图片加载失败'))
                }
                xhr.send()
                // #endif
                // #ifndef H5
                reject(new Error('getFileSystemManager 不可用'))
                // #endif
                return
            }
            fileSystemManager.readFile({
                filePath: filePath,
                encoding: 'base64',
                success: (res) => {
                    resolve(res.data)
                },
                fail: (err) => {
                    reject(err)
                }
            })
        } catch (err) {
            reject(err)
        }
        // #endif
    })
}

function handleToggleSuperAgent() {}
function handleToggleMCP() {}
function handleToggleKnowledgeBase() {}
function handleTogglePermanentMemory() {}
function handleShowModelConfig(val) {}
function handleTextareaHeightChange(height) {}
function handleModelConfigChange(obj) {}

function connectWebSocket() {
    if (!userUuid.value) {
        console.warn('用户UUID不存在，无法连接 WebSocket')
        return
    }
    if (websocketManager.isConnected()) {
        console.log('WebSocket 已连接，先关闭旧连接')
        websocketManager.close()
    }
    const wsBaseUrl = baseUrl3.replace('https://', 'wss://').replace('http://', 'ws://')
    const wsUrl = `${wsBaseUrl}/cozeZhsApi/chat-room/ws`
    console.log('准备连接 WebSocket:', wsUrl)
    console.log('用户UUID:', userUuid.value)
    console.log('房间ID:', roomId.value)

    connect(wsUrl)

    websocketManager.connect(wsUrl, userUuid.value, {
        onOpen: () => {
            console.log('WebSocket 连接成功')
            wsConnected.value = true
            joinRoom()
        },
        onMessage: (message) => {
            console.log('收到 WebSocket 消息:', message)
            handleWebSocketMessage(message)
        },
        onError: (error) => {
            console.error('WebSocket 连接错误:', error)
            wsConnected.value = false
        },
        onClose: (res) => {
            console.log('WebSocket 连接关闭:', res)
            wsConnected.value = false
        }
    })
}

function joinRoom() {
    if (!userUuid.value) {
        console.warn('用户UUID不存在，无法加入房间')
        return
    }
    const message = {
        event: 'join_room',
        user_uuid: userUuid.value,
        room_name: chatTitle.value
    }
    if (roomId.value) {
        message.room_id = roomId.value
    }
    if (receiverUuid.value) {
        message.receiver_uuid = receiverUuid.value
    }
    console.log('发送加入房间消息:', message)
    websocketManager.send(message)
}

function handleWebSocketMessage(message) {
    try {
        console.log('收到 WebSocket 消息:', message)
        console.log('消息类型:', typeof message)
        console.log('消息 event:', message?.event)
        if (message.event === 'room_message' || message.event === 'message') {
            console.log('处理房间消息，添加到列表')
            addMessageToList(message)
        } else if (message.event === 'message_sent' || message.event === 'send_message_success') {
            console.log('消息发送成功:', message)
        } else if (message.event === 'error') {
            console.error('WebSocket 错误消息:', message)
            uni.showToast({
                title: message.message || message.msg || '消息发送失败',
                icon: 'none'
            })
        } else {
            console.log('收到其他类型消息，尝试添加到列表:', message)
            if (message.content && (message.user_uuid || message.sender_uuid)) {
                console.log('检测到消息数据，添加到列表')
                addMessageToList(message)
            } else {
                console.log('消息格式不完整，无法添加到列表:', {
                    hasContent: !!message.content,
                    hasUserUuid: !!message.user_uuid,
                    hasSenderUuid: !!message.sender_uuid,
                    message: message
                })
            }
        }
    } catch (error) {
        console.error('处理 WebSocket 消息失败:', error)
    }
}

function addMessageToList(messageData) {
    const currentUserUuid = userUuid.value
    if (!currentUserUuid) {
        console.warn('当前用户UUID不存在，无法处理消息')
        return
    }
    const messageUserUuid = messageData.user_uuid || messageData.sender_uuid
    if (!messageUserUuid) {
        console.warn('消息缺少发送者UUID，无法处理:', messageData)
        return
    }
    const isUserMessage = messageUserUuid === currentUserUuid
    console.log('处理消息添加到列表:', {
        messageUserUuid,
        currentUserUuid,
        isUserMessage,
        content: messageData.content,
        roomId: messageData.room_id,
        messageData: messageData
    })
    if (!isUserMessage && chatList.value.some(msg =>
        msg.isTemp &&
        msg.content === messageData.content &&
        msg.userUuid === currentUserUuid
    )) {
        console.log('检测到临时消息匹配，强制识别为用户消息')
    }
    if (messageData.id) {
        const existingMessageIndex = chatList.value.findIndex(msg => msg.id === messageData.id)
        if (existingMessageIndex !== -1) {
            console.log('消息已存在（通过ID匹配），跳过添加:', messageData.id)
            return
        }
        if (lastHistoryMessageId.value && messageData.id === lastHistoryMessageId.value) {
            console.log('这是最后一条历史消息（通过ID匹配），跳过添加（避免重复）:', messageData.id)
            return
        }
    }
    if (lastHistoryMessageContent.value && lastHistoryMessageTime.value && lastHistoryMessageUserUuid.value) {
        const sendTime = messageData.send_time || messageData.timestamp || new Date().toISOString()
        const contentMatch = messageData.content === lastHistoryMessageContent.value
        const userMatch = messageUserUuid === lastHistoryMessageUserUuid.value
        let timeMatch = false
        if (sendTime === lastHistoryMessageTime.value) {
            timeMatch = true
        } else if (sendTime && lastHistoryMessageTime.value) {
            try {
                const msgTime = new Date(lastHistoryMessageTime.value).getTime()
                const newTime = new Date(sendTime).getTime()
                if (!isNaN(msgTime) && !isNaN(newTime)) {
                    timeMatch = Math.abs(msgTime - newTime) < 2000
                }
            } catch (e) {
                timeMatch = false
            }
        }
        if (contentMatch && userMatch && timeMatch) {
            console.log('这是最后一条历史消息（通过内容+时间匹配），跳过添加（避免重复）:', {
                content: messageData.content,
                userUuid: messageUserUuid,
                sendTime: sendTime
            })
            return
        }
    }
    const sendTime2 = messageData.send_time || messageData.timestamp || new Date().toISOString()
    const existingMessageIndex2 = chatList.value.findIndex(msg => {
        if (messageData.id && msg.id === messageData.id) {
            return true
        }
        const contentMatch = msg.content === messageData.content
        const userMatch = msg.userUuid === messageUserUuid
        let timeMatch = false
        if (msg.sendTime === sendTime2) {
            timeMatch = true
        } else if (msg.sendTime && sendTime2) {
            try {
                const msgTime = new Date(msg.sendTime).getTime()
                const newTime = new Date(sendTime2).getTime()
                if (!isNaN(msgTime) && !isNaN(newTime)) {
                    timeMatch = Math.abs(msgTime - newTime) < 2000
                }
            } catch (e) {
                timeMatch = false
            }
        }
        return contentMatch && userMatch && (timeMatch || !msg.sendTime || !sendTime2)
    })
    if (existingMessageIndex2 !== -1) {
        console.log('消息已存在（通过内容+时间匹配），跳过添加:', {
            content: messageData.content,
            userUuid: messageUserUuid,
            sendTime: sendTime2,
            existingIndex: existingMessageIndex2,
            existingMessage: chatList.value[existingMessageIndex2]
        })
        return
    }
    const tempMessageIndex = chatList.value.findIndex(msg =>
        msg.isTemp &&
        msg.content === messageData.content &&
        msg.userUuid === currentUserUuid
    )
    if (tempMessageIndex !== -1) {
        console.log('找到匹配的临时消息，强制识别为用户消息')
    }
    if (isUserMessage || tempMessageIndex !== -1) {
        const finalTempMessageIndex = tempMessageIndex !== -1 ? tempMessageIndex : chatList.value.findIndex(msg =>
            msg.isTemp &&
            msg.content === messageData.content &&
            msg.userUuid === currentUserUuid
        )
        if (finalTempMessageIndex !== -1) {
            const tempMessage = chatList.value[finalTempMessageIndex]
            tempMessage.id = messageData.id || tempMessage.id
            tempMessage.sendTime = messageData.send_time || messageData.timestamp || tempMessage.sendTime
            tempMessage.source = messageData.source || messageUserUuid
            tempMessage.receiverUuid = messageData.receiver_uuid || ''
            tempMessage.messageType = messageData.type || tempMessage.messageType
            tempMessage.isTemp = false
            tempMessage.senderName = messageData.sender_name || ''
            tempMessage.senderAvatar = messageData.sender_avatar || ''
            tempMessage.type = 'user'
            if (tempMessage.mediaType) {
                if (messageData.type === 2) {
                    tempMessage.mediaType = 'image'
                } else if (messageData.type === 3) {
                    tempMessage.mediaType = 'audio'
                } else if (messageData.type === 4) {
                    tempMessage.mediaType = 'file'
                }
            }
            if (tempMessage.mediaType && !tempMessage.mediaUrl) {
                tempMessage.mediaUrl = tempMessage.content
            }
            console.log('更新临时消息为正式消息:', tempMessage)
            scrollToBottom()
            return
        }
    }
    let messageAvatar = ''
    if (isUserMessage) {
        messageAvatar = userAvatar.value
    } else {
        messageAvatar = messageData.sender_avatar || sellerAvatar.value
        if (messageData.sender_avatar) {
            sellerAvatar.value = messageData.sender_avatar
        }
    }
    let mediaType = null
    if (messageData.type === 2) {
        mediaType = 'image'
    } else if (messageData.type === 3) {
        mediaType = 'audio'
    } else if (messageData.type === 4) {
        mediaType = 'file'
    } else if (messageData.content && (messageData.content.startsWith('http://') || messageData.content.startsWith('https://'))) {
        const urlLower = messageData.content.toLowerCase()
        if (urlLower.match(/\.(jpg|jpeg|png|gif|webp|bmp)$/)) {
            mediaType = 'image'
        } else if (urlLower.match(/\.(mp3|wav|aac|m4a|ogg)$/)) {
            mediaType = 'audio'
        } else {
            mediaType = 'file'
        }
    }
    const newMessage = {
        id: messageData.id || Date.now(),
        type: isUserMessage ? 'user' : 'seller',
        content: messageData.content || '',
        sendTime: messageData.send_time || messageData.timestamp || new Date().toISOString(),
        source: messageData.source || messageUserUuid,
        userUuid: messageUserUuid,
        receiverUuid: messageData.receiver_uuid,
        messageType: messageData.type || 1,
        read: false,
        avatar: messageAvatar,
        senderName: messageData.sender_name || '',
        senderAvatar: messageData.sender_avatar || '',
        isTemp: false,
        mediaType: mediaType,
        mediaUrl: mediaType ? messageData.content : null
    }
    console.log('添加消息到列表:', newMessage)
    chatList.value.push(newMessage)
    scrollToBottom()
}

function disconnectWebSocket() {
    console.log('断开 WebSocket 连接')
    disconnect()
    websocketManager.close()
    wsConnected.value = false
}

function handleImageError(e) {
    console.error('消息中的图片加载失败:', e)
}

function handleImageLoad(e) {
    console.log('图片加载成功')
}

function previewImage(imageUrl) {
    const imageUrls = chatList.value
        .filter(msg => (msg.mediaType === 'image' || msg.messageType === 2) && (msg.mediaUrl || msg.content))
        .map(msg => msg.mediaUrl || msg.content)
    const currentIndex = imageUrls.findIndex(url => url === imageUrl)
    uni.previewImage({
        urls: imageUrls.length > 0 ? imageUrls : [imageUrl],
        current: currentIndex >= 0 ? currentIndex : 0
    })
}

function openAudio(audioUrl) {
    // #ifdef APP-PLUS
    plus.runtime.openURL(audioUrl)
    // #endif
    // #ifndef APP-PLUS
    uni.showToast({
        title: '请在浏览器中打开',
        icon: 'none'
    })
    // #endif
}

function openFile(fileUrl) {
    // #ifdef APP-PLUS
    plus.runtime.openURL(fileUrl)
    // #endif
    // #ifndef APP-PLUS
    uni.showToast({
        title: '请在浏览器中打开',
        icon: 'none'
    })
    // #endif
}
</script>

<style lang="scss" scoped>
.container {
    width: 100%;
    height: 100vh;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    background-color: #fff;
    overflow: hidden;
}

.nav-bar-fixed {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 1001;
}

.nav-bar-spacer {
    flex-shrink: 0;
}

.chat-container {
    /* 主体内容占满剩余空间，可滚动；底部留出固定输入栏高度避免被遮挡 */
    flex: 1;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    background-color: #fff;
    padding-bottom: 180rpx;
    box-sizing: border-box;
    min-height: 0;
    width: 100%;
}

/* 与首页一致的输入区域容器：固定底部，安全区由组件内部处理 */
.input_box_content {
    left: 0;
    right: 0;
    background-color: #fff;
    transition: bottom 0.3s ease;
    padding-bottom: calc(env(safe-area-inset-bottom) + 10rpx);
    z-index: 100;
}

// 商品信息卡片
.product-card {
        display: flex;
    align-items: center;
    padding: 24rpx 20rpx;
    background-color: #fff;
    border-bottom: 1rpx solid #f0f0f0;
    
    .product-image {
        width: 120rpx;
        height: 120rpx;
        border-radius: 8rpx;
        margin-right: 20rpx;
        flex-shrink: 0;
    }
    
    .product-info {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 8rpx;
        
        .product-price-wrapper {
            display: flex;
            align-items: baseline;
            gap: 12rpx;
            
            .product-price {
                font-size: 36rpx;
                font-weight: 600;
                color: #ff4d4f;
            }
            
            .product-shipping {
                font-size: 24rpx;
                color: #999;
            }
        }
        
        .product-location {
            font-size: 24rpx;
            color: #999;
        }
    }
    
    .buy-again-btn {
        padding: 12rpx 24rpx;
        background-color: #ff8c00;
        border-radius: 8rpx;
        font-size: 26rpx;
        color: #fff;
        flex-shrink: 0;
    }
}

// 聊天消息区域
.chat-messages {
    padding: 20rpx;
    
    .message-item {
        display: flex;
        margin-bottom: 24rpx;
        
        &.user {
            justify-content: flex-end;
            align-items: flex-end;
        }
        
        &.seller {
            justify-content: flex-start;
            align-items: flex-start;
        }
        
        &.system {
            justify-content: center;
            margin: 24rpx 0;
        }
        
        .avatar {
            width: 80rpx;
            height: 80rpx;
            border-radius: 50%;
            overflow: hidden;
            flex-shrink: 0;
            
            image {
                width: 100%;
                height: 100%;
            }
        }
        
        .user-avatar {
            margin-left: 16rpx;
        }
        
        .seller-avatar {
            margin-right: 16rpx;
        }
        
        .message-bubble {
            max-width: 480rpx;
            padding: 20rpx 24rpx;
            border-radius: 12rpx;
            position: relative;
            
            // 媒体消息容器样式
            &.media-message {
                padding: 0;
            }
            
            .bubble-text {
                font-size: 28rpx;
                color: #333;
                word-break: break-all;
                white-space: pre-wrap;
                line-height: 1.5;
            }
            
            .read-status {
                font-size: 20rpx;
                color: #999;
                margin-top: 8rpx;
                text-align: right;
            }
            
            // 图片消息样式
            .message-image {
                max-width: 480rpx;
                width: 100%;
                min-width: 200rpx;
                min-height: 200rpx;
                border-radius: 8rpx;
                display: block;
                background-color: #f5f5f5; // 添加背景色，方便调试
            }
            
            // 视频消息样式
            .message-video {
                max-width: 100%;
                max-height: 600rpx;
                border-radius: 8rpx;
                display: block;
                width: auto;
                height: auto;
            }
            
            // 音频消息样式
            .message-audio {
                display: flex;
                flex-direction: column;
                gap: 8rpx;
                
                .audio-text {
                    font-size: 26rpx;
                    color: #666;
                }
                
                .audio-url {
                    font-size: 24rpx;
                    color: #1890ff;
                    text-decoration: underline;
                }
            }
            
            // 文件消息样式
            .message-file {
    display: flex;
                flex-direction: column;
                gap: 8rpx;
                
                .file-text {
                    font-size: 26rpx;
                    color: #666;
                }
                
                .file-url {
                    font-size: 24rpx;
                    color: #1890ff;
                    text-decoration: underline;
                }
            }
        }
        
        .user-bubble {
            background-color: #FFD700;
            border-top-right-radius: 4rpx;
            
            // 媒体消息（图片、音频、文件）不显示背景色
            &.media-message {
                background-color: transparent;
                padding: 0;
            }
        }
        
        .seller-bubble {
            background-color: #f0f0f0;
            border-top-left-radius: 4rpx;
            
            .bubble-text {
                color: #333;
            }
            
            // 媒体消息（图片、音频、文件）不显示背景色
            &.media-message {
                background-color: transparent;
                padding: 0;
            }
        }
        
        .system-message {
            padding: 12rpx 0;
            
            text {
                font-size: 24rpx;
                color: #999;
            }
        }
    }
}

// 快捷问题按钮
.quick-questions {
        display: flex;
    flex-wrap: wrap;
    gap: 16rpx;
    padding: 0 20rpx 20rpx;
    
    .question-btn {
        padding: 12rpx 24rpx;
        background-color: #f5f5f5;
        border-radius: 32rpx;
        
        text {
            font-size: 26rpx;
            color: #666;
        }
    }
}

// InputArea 组件会使用自己的样式
.input-area{
    position: fixed;
    bottom: 0;
}
</style> 
