<template>
  <view class="outContainer" @click="handleContainerClick">
    <!-- 推送通知弹窗组件 - 通过全局事件触发显示 -->
    <PushNotification ref="pushNotification" />
    
    <DrawerComponent ref="drawerComponent" :showTabbar="showTabbar" :tagWrapShow="tagWrapShow" :statusBarHeight="statusBarHeight" :groupedData="groupedData"
      :active_date="active_date" :active_menu="active_menu" :userinfo="userinfo" :modelList="modelList" :showIndexBtn="false" @close-drawer="close_drawer"
      @go-page="gopage" @go-company="gotocompany" @lingqu="lingqu" @add-new-chat="addNewChat"
      @show-full-list="handleShowFullList" @touch-start="handleTouchStart" @touch-move="handleTouchMove"
      @touch-end="handleTouchEnd" @remove-chat="removeChat" />
    <float-box ref="floatBoxRef" :floatboxVisible="floatboxVisible" />
    <view class="container" style="padding: 0" @click="handleClick">
      <!-- 引入外部 顶部导航栏 -->
      <navigation-bars :showJoin="true" :showMenu="true" :userIcon="userIcon" :showUser="true" :tagWrapShow="tagWrapShow" @nav-click="handleNavClick" @menu-click="handleNavClick" @join-click="showQrCode" :viscosity="true"
      color="#171717" font-size-30 title="智汇AI社区" />
      <view class="top_box" style="padding: 0 20rpx;height: calc(72vh);position: relative;">
        <view class="titlebox">
          <view class="titlebox-right">
            <image class="share-image" style="width: 140rpx;height: 140rpx;" src="/static/images/share_zhuanmi.png" mode="widthFix" @click="goToMyPage"></image>
          </view>
        </view>
          
      </view>

      <view class="input_box_content" :style="{
        position: 'fixed',
        bottom: computedContainerBottom
      }">
        
        <view class="posi_angeetlis">
          <view style="padding: 0 20rpx;">
            <ModelList v-if="showModelList && !showModelaConfig" ref="modelList" :modelList="modelList" :pitch="pitch" :sourceIs="true" :showModelConfigVal="showModelConfigVal"
              :textareaHeight="textareaHeight" :showAgentMode="false" @pitch-handle="(item, index) => pitchHandle(item, index, true)" @agent-mode-click="handleAgentModeClick" @scroll="handleScroll" @click.stop />
            <AgentList v-if="showAgentList" :agentList="agentList" :agentPitch="agentPitch" :sourceIs="true" :isLoading="isLoading" :hasMore="hasMore"
              @agent-pitch-handle="handleAgentPitch" @scroll="handleScroll" @click.stop />
            <MaterialList v-if="showMaterialList" :sourceIs="true" :activeTab="materialTab"
              :textContentList="materialTextList" :imageContentList="materialImageList" :videoContentList="materialVideoList" :audioContentList="materialAudioList"
              :isLoading="materialLoading" :hasMore="materialHasMore"
              @tab-change="handleMaterialTabChange" @scroll-to-lower="handleMaterialScrollToLower" @item-click="handleMaterialItemClick" @click.stop />
          </view>
          <view style="display: flex;flex-direction: row;justify-content: center;margin-bottom: 10rpx;">
            <scroll-view scroll-x="true" style="width: 100%;white-space: nowrap;">
              <view style="display: inline-flex;flex-direction: row;align-items: center;padding: 0 20rpx;">
                <view class="model-type-btn" :class="{ active: currentModelType === 'skills' }" @click.stop="toggleSkillsPopup">
                  <image class="btn-bg" :src="currentModelType === 'skills' ? '/static/images/add/active_back.svg' : '/static/images/add/back_default.svg'" mode="widthFix"></image>
                  <view class="btn-content-wrapper">
                    <image class="btn-content" src="/static/images/add/skills.svg" mode="widthFix"></image>
                    <image class="btn-arrow" :class="{ rotate: currentModelType === 'skills' }" src="/static/images/add/jiantou.svg" mode="widthFix"></image>
                  </view>
                </view>
                <view class="model-type-btn" :class="{ active: currentModelType === 'talk' }" @click.stop="handleModelTypeClick('talk')">
                  <image class="btn-bg" :src="currentModelType === 'talk' ? '/static/images/add/active_back.svg' : '/static/images/add/back_default.svg'" mode="widthFix"></image>
                  <view class="btn-content-wrapper">
                    <image class="btn-content" src="/static/images/add/text.svg" mode="widthFix"></image>
                    <image class="btn-arrow" :class="{ rotate: currentModelType === 'talk' }" src="/static/images/add/jiantou.svg" mode="widthFix"></image>
                  </view>
                </view>
                <view class="model-type-btn" :class="{ active: currentModelType === 'image' }" @click.stop="handleModelTypeClick('image')">
                  <image class="btn-bg" :src="currentModelType === 'image' ? '/static/images/add/active_back.svg' : '/static/images/add/back_default.svg'" mode="widthFix"></image>
                  <view class="btn-content-wrapper">
                    <image class="btn-content" src="/static/images/add/picter.svg" mode="widthFix"></image>
                    <image class="btn-arrow" :class="{ rotate: currentModelType === 'image' }" src="/static/images/add/jiantou.svg" mode="widthFix"></image>
                  </view>
                </view>
                <view class="model-type-btn" :class="{ active: currentModelType === 'video' }" @click.stop="handleModelTypeClick('video')">
                  <image class="btn-bg" :src="currentModelType === 'video' ? '/static/images/add/active_back.svg' : '/static/images/add/back_default.svg'" mode="widthFix"></image>
                  <view class="btn-content-wrapper">
                    <image class="btn-content" src="/static/images/add/video.svg" mode="widthFix"></image>
                    <image class="btn-arrow" :class="{ rotate: currentModelType === 'video' }" src="/static/images/add/jiantou.svg" mode="widthFix"></image>
                  </view>
                </view>
                <view class="model-type-btn" :class="{ active: currentModelType === 'audio' }" @click.stop="handleModelTypeClick('audio')">
                  <image class="btn-bg" :src="currentModelType === 'audio' ? '/static/images/add/active_back.svg' : '/static/images/add/back_default.svg'" mode="widthFix"></image>
                  <view class="btn-content-wrapper">
                    <image class="btn-content" src="/static/images/add/audio.svg" mode="widthFix"></image>
                    <image class="btn-arrow" :class="{ rotate: currentModelType === 'audio' }" src="/static/images/add/jiantou.svg" mode="widthFix"></image>
                  </view>
                </view>
                <view class="model-type-btn" :class="{ active: currentModelType === 'videoa' }" @click.stop="handleModelTypeClick('videoa')">
                  <image class="btn-bg" :src="currentModelType === 'videoa' ? '/static/images/add/active_back.svg' : '/static/images/add/back_default.svg'" mode="widthFix"></image>
                  <view class="btn-content-wrapper">
                    <image class="btn-content" src="/static/images/add/people.svg" mode="widthFix"></image>
                    <image class="btn-arrow" :class="{ rotate: currentModelType === 'videoa' }" src="/static/images/add/jiantou.svg" mode="widthFix"></image>
                  </view>
                </view>
                <view class="model-type-btn" :class="{ active: currentModelType === 'other' }" @click.stop="handleModelTypeClick('other')">
                  <image class="btn-bg" :src="currentModelType === 'other' ? '/static/images/add/active_back.svg' : '/static/images/add/back_default.svg'" mode="widthFix"></image>
                  <view class="btn-content-wrapper">
                    <image class="btn-content" src="/static/images/add/tongyong.svg" mode="widthFix"></image>
                    <image class="btn-arrow" :class="{ rotate: currentModelType === 'other' }" src="/static/images/add/jiantou.svg" mode="widthFix"></image>
                  </view>
                </view>
                <view class="model-type-btn" :class="{ active: currentModelType === 'sck' }" @click.stop="toggleMaterialPopup">
                  <image class="btn-bg" :src="currentModelType === 'sck' ? '/static/images/add/active_back.svg' : '/static/images/add/back_default.svg'" mode="widthFix"></image>
                  <view class="btn-content-wrapper">
                    <image class="btn-content" src="/static/images/add/sck.svg" mode="widthFix"></image>
                    <image class="btn-arrow" :class="{ rotate: currentModelType === 'sck' }" src="/static/images/add/jiantou.svg" mode="widthFix"></image>
                  </view>
                </view>
              </view>
            </scroll-view>
          </view>
        </view>
        <view v-if="showModelaConfig && modelList[pitch] && modelList[pitch].variables" class="input-area-backa">
          <image @click="showModelaConfig = false" src="/static/images/close_input.png" mode="widthFix" class="imgs_list_closea"></image>
          <ModelConfigDialog ref="modelConfigDialog" :modelConfigChangeData="modelConfigChangeData" :modelName="modelName" :modelNameEN="modelNameEN" :modelInfo="modelInfo" :imgsList="imgsList" @change="modelConfigChange"
            style="width: 100%;" :fromPath="fromPath"></ModelConfigDialog>
        </view>
        <!-- 我的创作引入的卡片 -->
        <view v-if="materialCards.length > 0" class="material-cards-wrap">
          <scroll-view scroll-x class="material-cards-scroll" show-scrollbar="false">
            <view class="material-cards-list">
              <view
                v-for="(card, index) in materialCards"
                :key="'mc-' + (card.id || index) + '-' + index"
                class="material-card-item">
                <image src="/static/images/close_input.png" mode="widthFix" class="material-card-close" @click="removeMaterialCard(index)"></image>
                <view v-if="card.type === 1" class="material-card-body material-card-text">
                  <text class="material-card-title">{{ card.title }}</text>
                  <text class="material-card-preview">{{ (card.content || '').slice(0, 20) }}{{ (card.content && card.content.length > 20) ? '...' : '' }}</text>
                </view>
                <view v-else-if="card.type === 2 && card.imageList && card.imageList[0]" class="material-card-body material-card-img">
                  <image :src="card.imageList[0]" mode="aspectFill" class="material-card-thumb" />
                  <text class="material-card-title">{{ card.title }}</text>
                </view>
                <view v-else-if="card.type === 3" class="material-card-body material-card-video">
                  <image v-if="card.posterUrl || card.videoUrl" :src="card.posterUrl || card.videoUrl" mode="aspectFill" class="material-card-thumb" />
                  <text class="material-card-title">{{ card.title }}</text>
                </view>
                <view v-else-if="card.type === 4" class="material-card-body material-card-audio">
                  <text class="material-card-title">{{ card.title }}</text>
                  <text class="material-card-preview">音频</text>
                </view>
              </view>
            </view>
          </scroll-view>
        </view>
        <BottomActionBar :isShowIcon="isShowIcon" :imgsList="imgsList" :imgsListVersion="imgsListVersion" :modelName="modelName" :modelNameEN="modelNameEN" :sourceIs="sourceIs"
          :statusBarHeight="statusBarHeight" :titleBarHeight="titleBarHeight" :textarea_int="textarea_int"
          :isVoiceAnimationActive="isVoiceAnimationActive" :isVoiceInput="isVoiceInput" :isIOS="isIOS"
          :isLoading="loading" :prompt="prompt" :placeholderStyle="placeholderStyle" :inputFocused="inputFocused"
          :isVoiceAnimationActiveStart="isVoiceAnimationActiveStart" :modelInfo="modelInfo" :inputBottom="inputBottom" :isIndex="true"
          @toggle-super-agent="toggleSuperAgent" @toggle-super-agentfu="toggleSuperAgentfu" @toggle-mcp="toggleMCP"
          @toggle-knowledge-base="toggleKnowledgeBase" @toggle-permanent-memory="togglePermanentMemory"
          @toggle-voice-input="toggleVoiceInput" @remove-image="removeImage" @send-message="handleSendMessageabc"
          @start-long-press="startLongPress" @end-long-press="endLongPress" @input-focus="handleInputFocus"
          @input-blur="handleInputBlur" @input-click="handleInputClick" @start-voice-animation="startVoiceAnimation"
          @stop-voice-animation="stopVoiceAnimation" @function-handle="functionHandle" @source-handle="sourceHandle"
          @icon-click="handleIconClick" @update:prompt="updatePrompt" @showModelConfig="showModelConfig"
          @textareaHeightChange="textareaHeightChange" @modelConfigChange="modelConfigChange" @fangda="ampily" 
          @keyboard-show="handleKeyboardShow" @keyboard-hide="handleKeyboardHide" @show-model-list="handleShowModelList" ref="toogleBtn" />
      </view>
    </view>
    
    <!-- 分享领智汇值弹窗 -->
    <view class="share-points-popup" v-if="showSharePointsPopup" @click="closeSharePointsPopup">
      <view class="popup-mask"></view>
      <view class="popup-content" @click.stop>
        <image src="/static/images/share_zhz.png" style="width: 440rpx;" mode="widthFix"></image>
        <button class="popup-share-btn" v-if="!isAppEnvironment" open-type="share" @click="handleShareClick"></button>
        <button class="popup-share-btn" v-else @click="handleAppShareClick"></button>
      </view>
    </view>
    
    <!-- 二维码弹窗 -->
    <view class="qr-code-modal" v-if="showQrCodeModal" @click="hideQrCode">
      <view class="qr-code-content" @click.stop>
        <image src="/static/images/qewm.png" 
               style="width: 600rpx; height: 600rpx; margin: 20rpx;" mode="aspectFit" 
               @longpress="handleLongPressQrCode" />
        <view class="qr-code-title" style="text-align: center; font-size: 32rpx; font-weight: bold; margin-bottom: 20rpx;color: #000;">
          扫描二维码加入社区
        </view>
        <view class="qr-code-close" @click="hideQrCode" style="position: absolute; top: 20rpx; right: 20rpx; width: 60rpx; height: 60rpx;border: 1px solid #000; border-radius: 15rpx; display: flex; align-items: center; justify-content: center;">
          <text style="font-size: 60rpx; color: #000;">×</text>
        </view>
      </view>
    </view>
    
    
  </view>
</template>


<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick, getCurrentInstance } from 'vue'
import { onShow, onLoad, onShareAppMessage } from '@dcloudio/uni-app'
import DrawerComponent from '@/components/DrawerComponentall.vue';
import NavigationBars from "../../../components/navigation-bars/index.vue";
import IntelligentAssistant from "../../table/tools/components/Intelligent-assistant.vue";
import { openId, login, getPhoneNumberApi, fetchAudioText } from "@/service/login.js";
import {
  getTokenReturn,
  postContext,
  getAgentList,
  getAgentListAll,
} from "@/service/pay.js";
import {
  getCozeApiList,
  audioStart,
  audioEnd,
  searchModelWorkflowRun,
  getMyCreation,
} from "@/service/aiModels.js"
import {
  getModelChat,
  removeModelChat,
  checkFirstShareStatus,
  firstShare
} from '@/service/ai_index.js'
import { WECHAT_MINI_PROGRAM_ID } from '@/config/apiConfig.js'
import { uploadBybase64 } from "@/service/businessCard.js";
import { readFileToBase64 as readFileToBase64Util } from '@/utils/readFileToBase64.js';
import ModelList from '@/components/ModelList.vue';
import AgentList from '@/components/AgentList.vue';
import MaterialList from '@/components/MaterialList.vue';
import ToggleButtonGroup from '@/components/ToggleButtonGroup.vue';
import InputArea from '@/components/InputArea.vue';
import BottomActionBar from '@/components/BottomActionBar.vue';
import ModelConfigDialog from '@/components/ModelConfigDialog/index.vue';
import FloatBox from "../../../components/FloatBox.vue";

const { proxy } = getCurrentInstance()

// Template refs - use ref for modelList
const modelListComp = ref(null)
const modelConfigDialog = ref(null)
const toogleBtn = ref(null)
const conversationComp = ref(null)
const responseFormatter = ref(null)
const uploadComponent = ref(null)
const sharingComponent = ref(null)

// Data refs
const modelList = ref([])
const pitch = ref(0)
const sourceIs = ref(false)
const intelliReveal = ref(true)
const prompt = ref('')
const loading = ref(false)
const showModelaConfig = ref(false)
const completedResponses = ref([])
const taskId = ref(null)
const checkStatusInterval = ref(null)
const savedPrompt = ref('')
const conversationMessages = ref([])
const userAvatar = ref('https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/ai_agent/user-avatar.png')
const botAvatar = ref('https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/ai_agent/jiqiren-big.png')
const initialBotMessage = ref('请在下方输入您想要的图片描述')
const placeholder = ref('请输入描述')
const currentResponse = ref(null)
const lastProcessedTimestamp = ref(0)
const flowId = ref(null)
const tokenReturnExecuted = ref(false)
const active_date = ref("0")
const userinfo = ref({ avatar: '', nickname: '' })
const token = ref('')
const hasPostContext = ref(false)
const userContextId = ref("")
const scrollTop = ref(0)
const scrollTimer = ref(null)
const timer = ref(null)
const isVoiceInput = ref(false)
const inputText = ref('')
const isInputVisible = ref(true)
const isVoiceAnimationActive = ref(false)
const isVoiceAnimationActiveStart = ref(false)
const modelName = ref('')
const modelNameEN = ref('')
const modelId = ref('')
const HomePagedata = ref({})
const isShowIcon = ref(false)
const isLongPress = ref(false)
const isRecording = ref(false)
const recordManager = ref(null)
const showKeyboard = ref(false)
const isAuthorizingVoice = ref(false)
const pluginReady = ref(false)
const pluginPreloaded = ref(false)
const imgUrl = ref('')
const inputFocused = ref(false)
const keyboardHeight = ref(0)
const isKeyboardActive = ref(false)
const adjustResizeDetected = ref(false)
const adjustResizeSupported = ref(false)
const initialWindowHeight = ref(0)
const keyboardHeightChangeCallback = ref(null)
const nativeKeyboardAndroidDecorView = ref(null)
const nativeKeyboardAndroidLayoutListener = ref(null)
const nativeKeyboardIOSCenter = ref(null)
const nativeKeyboardIOSShowObserver = ref(null)
const nativeKeyboardIOSHideObserver = ref(null)
const adjustResizeDetectionResults = ref([])
const isIOS = ref(false)
const agentList = ref([])
const agent_content = ref('')
const agent_content1 = ref('')
const pressStartTime = ref(null)
const sourceIsAgent = ref(false)
const pitcha = ref(0)
const modelNamea = ref('')
const agent_con1 = ref(false)
const imgsList = ref([])
const imgsListVersion = ref(0)
const agent_content_list = ref([])
const question_list = ref([])
const page = ref(1)
const page_size = ref(10)
const isLoading = ref(false)
const hasMore = ref(true)
const agentListLoaded = ref(false)
const changePath = ref(true)
const clickedMCP = ref(false)
const clickedKnowled = ref(false)
const clickedPermanent = ref(false)
const clickedVoiceInput = ref(false)
const clickedVideoCall = ref(false)
const tagWrapShow = ref(false)
const field_id = ref('')
const alldataarr = ref([])
const active_menu = ref(0)
const groupedData = ref([])
const isLogin = ref(false)
const showTabbar = ref(false)
const showModelConfigVal = ref(false)
const modelInfo = ref({})
const textareaHeight = ref(37)
const modelConfigChangeData = ref({})
const inputBottom = ref(0)
const textarea_int = ref(true)
const userIcon = ref(uni.getStorageSync('data')?.avatar || uni.getStorageSync('userInfo')?.avatar || '')
const audioUrl = ref('')
const audioTimer = ref(null)
const placeholderStyle = ref('')
const currentModelType = ref('')
const showModelList = ref(false)
const showAgentList = ref(false)
const agentPitch = ref(-1)
const showSkillsPopup = ref(false)
const isAppEnvironment = ref(false)
const announcementText = ref('因小程序大小受限，更多强大AI能力推荐下载APP使用')
const announcementDuration = ref('15s')
const showSharePointsPopup = ref(false)
const hasReceivedPoints = ref(false)
const showQrCodeModal = ref(false)
const showPrivacyPolicy = ref(false)
const isFirstOpen = ref(true)
const floatboxVisible = ref(true)
const isApp = ref(true)
const newRecorder = ref(null)
const asrTxt = ref('')
const fromPath = ref('')
const lastRefreshTime = ref(0)
const refreshInterval = ref(30000)
const disableCustomKeyboardLift = ref(false)
const showMaterialList = ref(false)
const materialTab = ref(1)
const materialTextList = ref([])
const materialImageList = ref([])
const materialVideoList = ref([])
const materialAudioList = ref([])
const materialPageNum = ref(1)
const materialPageSize = ref(10)
const materialHasMore = ref(true)
const materialLoading = ref(false)
const materialCards = ref([])

// Additional refs not in original data() but used in methods
const talkingList = ref([])
const displayedTalkingTexts = ref([])
const displayedTexts = ref([])
const isShow = ref(false)
const talking = ref(false)
const showImagePopup = ref(false)
const inviteCode = ref('')
const longPressTimeout = ref(null)

// Computed
const titleBarHeight = computed(() => {
  return proxy.$styleVariables["--app-nav-bar-height"]
})

const statusBarHeight = computed(() => {
  return proxy.$styleVariables["--app-status-bar-height"]
})

const computedContainerBottom = computed(() => {
  return '0'
})

// uni-app share hook
onShareAppMessage(() => {
  uni.setStorageSync('isSharing', true)
  
  const floatBoxComponent = floatBoxRef.value

  if (floatBoxComponent && typeof floatBoxComponent.getShareInfo === 'function') {
    const shareInfo = floatBoxComponent.getShareInfo()
    return {
      ...shareInfo,
      success: (res) => {
        uni.$emit('shareSuccess')
        uni.removeStorageSync('isSharing')
        uni.showToast({
          title: '分享成功',
          icon: 'success'
        })
      },
      fail: (res) => {
        uni.$emit('shareFail')
        uni.removeStorageSync('isSharing')
        uni.showToast({
          title: '分享失败',
          icon: 'none'
        })
      },
      complete: (res) => {
        if (res.errMsg && res.errMsg.includes('cancel')) {
          uni.$emit('shareFail')
          uni.removeStorageSync('isSharing')
          return
        }
        
        setTimeout(() => {
          if (showSharePointsPopup.value) {
            uni.removeStorageSync('isSharing')
          }
        }, 1000)
      }
    }
  }

  let userData = uni.getStorageSync('data') || {}
  if (!userData || Object.keys(userData).length === 0) {
    userData = uni.getStorageSync('userInfo') || {}
  }
  const inviteCodeVal = userData.inviteCode || ''
  return {
    title: 'AI智汇社',
    path: `/pages/table/aiIndex/ai_index?source=share&inviteCode=${inviteCodeVal}`,
    imageUrl: '/static/images/shar.jpg',
    success: (res) => {
      uni.$emit('shareSuccess')
      uni.removeStorageSync('isSharing')
      uni.showToast({
        title: '分享成功',
        icon: 'success'
      })
    },
    fail: (res) => {
      uni.$emit('shareFail')
      uni.removeStorageSync('isSharing')
      uni.showToast({
        title: '分享失败',
        icon: 'none'
      })
    },
    complete: (res) => {
      if (res.errMsg && res.errMsg.includes('cancel')) {
        uni.$emit('shareFail')
        uni.removeStorageSync('isSharing')
        return
      }
      
      setTimeout(() => {
        if (showSharePointsPopup.value) {
          uni.removeStorageSync('isSharing')
        }
      }, 1000)
    }
  }
})

// ===================== Methods =====================

function loadModelList() {
  let userData = uni.getStorageSync('data')
  if (!userData) {
    userData = uni.getStorageSync('userInfo')
  }
  
  getCozeApiList().then(res => {
    modelList.value = res.data
    
    modelList.value.forEach(model => {
      if (model.name === 'qwen-omni') {
        model.quest_type = 'websocket'
      }
    })
    
    if (!modelId.value || !modelName.value) {
      if (currentModelType.value === 'talk') {
        pitch.value = -1
        modelName.value = 'Agent模式'
        modelNameEN.value = 'AgentMode'
        modelId.value = ''
        modelInfo.value = {
          name: 'AgentMode',
          source: 'Agent模式',
          type: 0,
          img: '/static/images/mian_label.png'
        }
      } else {
        modelInfo.value = res.data[0]
        modelName.value = res.data[0].source
        modelNameEN.value = res.data[0].name
        modelId.value = res.data[0].id
      }
    } else {
      const selectedModel = res.data.find(model => model.id === modelId.value)
      if (selectedModel) {
        modelInfo.value = selectedModel
        modelName.value = selectedModel.source
        modelNameEN.value = selectedModel.name
      } else if (modelNameEN.value === 'AgentMode' || pitch.value === -1) {
        pitch.value = -1
        modelName.value = 'Agent模式'
        modelNameEN.value = 'AgentMode'
        modelId.value = ''
        modelInfo.value = {
          name: 'AgentMode',
          source: 'Agent模式',
          type: 0,
          img: '/static/images/mian_label.png'
        }
      }
    }
    if (userData && userData.uuid && userData.thirdPartyAccounts && userData.thirdPartyAccounts.accessToken) {
      getModelChat({
        user_uuid: userData.uuid
      }).then(res => {
        alldataarr.value = res.data
        groupDataByDate()
      }).catch(err => {})
    }
  }).catch(err => {}).finally(() => {
    loading.value = false
  })
}

function toSet() {
  const downloadUrl = 'https://a.app.qq.com/o/simple.jsp?pkgname=zh.ai.sq'
  uni.setClipboardData({
    data: downloadUrl,
    success: function () {
      uni.showToast({
        title: '链接已复制，请在浏览器中打开',
        icon: 'none'
      })
    }
  })
}

function goToAiCareer() {
  uni.navigateTo({
    url: '/pagesA/ai_career/index'
  })
}

function downloadApp() {
  const downloadUrl = 'https://a.app.qq.com/o/simple.jsp?pkgname=zh.ai.sq'
  // #ifdef H5
  uni.setClipboardData({
    data: downloadUrl,
    success: function () {
      uni.showToast({
        title: '链接已复制，请在浏览器中打开下载',
        icon: 'none',
        duration: 3000
      })
    },
    fail: function () {
      uni.showToast({
        title: '复制失败，请手动复制链接下载',
        icon: 'none'
      })
    }
  })
  // #endif
  
  // #ifdef MP-WEIXIN
  uni.setClipboardData({
    data: downloadUrl,
    success: function () {
      uni.showModal({
        title: '提示',
        content: '下载链接已复制，请在浏览器中打开下载APP',
        showCancel: false,
        confirmText: '知道了'
      })
    }
  })
  // #endif
  
  // #ifdef APP-PLUS
  plus.runtime.openURL(downloadUrl)
  // #endif
}

function handleAgentModeClick() {
  pitch.value = -1
  modelName.value = 'Agent模式'
  modelNameEN.value = 'AgentMode'
  modelId.value = ''
  modelInfo.value = {
    name: 'AgentMode',
    source: 'Agent模式',
    type: 0,
    img: '/static/images/mian_label.png'
  }
  currentModelType.value = 'talk'
  
  showModelList.value = false
  currentModelType.value = ''
}

function handleContainerClick(event) {
  if (event && event.target && event.target.closest && event.target.closest('.model-list-container')) {
    return
  }
  
  if (event && event.target && event.target.closest && event.target.closest('.skills-popup')) {
    return
  }

  if (event && event.target && event.target.closest && event.target.closest('.material-list-container')) {
    return
  }
  
  if (showModelList.value) {
    showModelList.value = false
    currentModelType.value = ''
  }
  
  if (showSkillsPopup.value) {
    showSkillsPopup.value = false
  }

  if (showAgentList.value) {
    showAgentList.value = false
    agentPitch.value = -1
  }

  if (showMaterialList.value) {
    showMaterialList.value = false
    currentModelType.value = ''
  }
}

function handleModelTypeClick(type) {
  if (currentModelType.value === type) {
    currentModelType.value = ''
    showModelList.value = false
    showModelaConfig.value = false
    showMaterialList.value = false
    return
  } else {
    currentModelType.value = type
  }
  showSkillsPopup.value = false
  showAgentList.value = false
  showMaterialList.value = false
  showModelList.value = true
  showModelaConfig.value = false
  nextTick(() => {
    modelListComp.value && modelListComp.value.updateModelType(type)
    
    setTimeout(() => {
      if (modelListComp.value) {
        let targetList = []
        switch(type) {
          case 'image':
            targetList = modelListComp.value.imageList
            break
          case 'video':
            targetList = modelListComp.value.videoList
            break
          case 'videoa':
            targetList = modelListComp.value.videoaList
            break
          case 'audio':
            targetList = modelListComp.value.audioList
            break
          case 'other':
            targetList = modelListComp.value.otherList
            break
          case 'talk':
            targetList = modelListComp.value.talkList
            break
        }
        console.log(targetList)
        if (targetList && targetList.length > 0) {
          const firstModel = targetList[0]
          modelName.value = firstModel.source
          modelNameEN.value = firstModel.name
          modelId.value = firstModel.id
          modelInfo.value = firstModel
          pitch.value = 0
        }
      }
    }, 500)
  })
}

function handleShowModelList() {
  showModelList.value = true
  showModelaConfig.value = false
}

function toggleMaterialPopup() {
  if (currentModelType.value === 'sck') {
    currentModelType.value = ''
    showMaterialList.value = false
  } else {
    currentModelType.value = 'sck'
    showMaterialList.value = true
    showModelList.value = false
    showAgentList.value = false
    showSkillsPopup.value = false
    materialTab.value = 1
    loadMaterialContent(1, false)
  }
}

function handleMaterialTabChange(tabId) {
  materialTab.value = tabId
  loadMaterialContent(tabId, false)
}

function getMaterialApiType(tabId) {
  const map = { 1: 1, 2: 3, 3: 2, 4: 4 }
  return map[tabId] || 1
}

async function loadMaterialContent(tabId, isLoadMore = false) {
  if (materialLoading.value) return
  const apiType = getMaterialApiType(tabId)
  const pageNum = isLoadMore ? materialPageNum.value + 1 : 1
  if (!isLoadMore) {
    materialHasMore.value = true
  }
  if (!materialHasMore.value && isLoadMore) return

  materialLoading.value = true
  try {
    const res = await getMyCreation({ pageNum, pageSize: materialPageSize.value }, apiType)
    let dataList = []
    if (Array.isArray(res)) {
      dataList = res
    } else if (res && (res.code === 200 || res.code === 0 || res.code === '200' || res.code === '0')) {
      if (Array.isArray(res.data)) dataList = res.data
      else if (res.data && Array.isArray(res.data.list)) dataList = res.data.list
      else if (res.data && Array.isArray(res.data.records)) dataList = res.data.records
      else if (res.data && Array.isArray(res.data.data)) dataList = res.data.data
    }

    if (apiType === 1) {
      const mapped = dataList.map(item => ({
        id: item.id,
        title: item.problem || item.title || item.name || '文本内容',
        content: item.answer || item.content || item.text || '',
        time: item.sendTimeStr || item.sendTime || item.createTime || item.time || '',
        chatId: item.chatId || ''
      }))
      if (isLoadMore) materialTextList.value = [...materialTextList.value, ...mapped]
      else materialTextList.value = mapped
    } else if (apiType === 3) {
      const mapped = dataList.map(item => {
        const imageUrls = item.agentUrl ? (Array.isArray(item.agentUrl) ? item.agentUrl : [item.agentUrl]) : []
        return {
          id: item.id,
          title: item.problem || item.title || item.name || '图片内容',
          imageList: imageUrls,
          time: item.sendTimeStr || item.sendTime || item.createTime || item.time || '',
          chatId: item.chatId || ''
        }
      })
      if (isLoadMore) materialImageList.value = [...materialImageList.value, ...mapped]
      else materialImageList.value = mapped
    } else if (apiType === 2) {
      const mapped = dataList.map(item => ({
        id: item.id,
        title: item.problem || item.title || item.name || '视频内容',
        videoUrl: item.agentUrl || '',
        posterUrl: item.posterUrl || item.coverUrl || item.thumbnail || '',
        time: item.sendTimeStr || item.sendTime || item.createTime || item.time || '',
        chatId: item.chatId || ''
      }))
      if (isLoadMore) materialVideoList.value = [...materialVideoList.value, ...mapped]
      else materialVideoList.value = mapped
    } else if (apiType === 4) {
      const mapped = dataList.map(item => ({
        id: item.id,
        title: item.problem || item.title || item.name || '音频内容',
        audioUrl: item.agentUrl || '',
        time: item.sendTimeStr || item.sendTime || item.createTime || item.time || '',
        chatId: item.chatId || ''
      }))
      if (isLoadMore) materialAudioList.value = [...materialAudioList.value, ...mapped]
      else materialAudioList.value = mapped
    }

    materialPageNum.value = pageNum
    materialHasMore.value = dataList.length >= materialPageSize.value
  } catch (e) {
    if (!isLoadMore) {
      if (apiType === 1) materialTextList.value = []
      else if (apiType === 3) materialImageList.value = []
      else if (apiType === 2) materialVideoList.value = []
      else if (apiType === 4) materialAudioList.value = []
    }
  } finally {
    materialLoading.value = false
  }
}

function handleMaterialScrollToLower() {
  loadMaterialContent(materialTab.value, true)
}

function handleMaterialItemClick(item, type) {
  const card = {
    type,
    id: item.id,
    title: item.title || (type === 1 ? '文本内容' : type === 2 ? '图片内容' : type === 3 ? '视频内容' : '音频内容'),
    content: item.content || item.answer || '',
    imageList: item.imageList || (item.agentUrl ? (Array.isArray(item.agentUrl) ? item.agentUrl : [item.agentUrl]) : []),
    videoUrl: item.videoUrl || item.agentUrl || '',
    audioUrl: item.audioUrl || item.agentUrl || '',
    posterUrl: item.posterUrl || item.coverUrl || item.thumbnail || '',
    chatId: item.chatId || ''
  }
  materialCards.value.push(card)
  showMaterialList.value = false
  currentModelType.value = ''
}

function removeMaterialCard(index) {
  materialCards.value.splice(index, 1)
}

function toggleSkillsPopup() {
  if (currentModelType.value === 'skills') {
    currentModelType.value = ''
    showSkillsPopup.value = false
    showAgentList.value = false
    showMaterialList.value = false
  } else {
    currentModelType.value = 'skills'
    showSkillsPopup.value = true
    showAgentList.value = true
    showModelList.value = false
    showModelaConfig.value = false
    showMaterialList.value = false
    loadAgentList()
  }
}

function loadAgentList(isLoadMore = false) {
  if (isLoading.value) return
  if (!isLoadMore) {
    if (agentListLoaded.value) {
      return
    }
    page.value = 1
    hasMore.value = true
    agentListLoaded.value = true
  }
  if (!hasMore.value && isLoadMore) return
  
  isLoading.value = true
  console.log('加载智能体列表分页数据', page.value, page_size.value)
  getAgentListAll({
    pageNum: page.value,
    pageSize: page_size.value,
  }).then(res => {
    console.log('加载智能体列表分页数据', res)
    let agents = []
    if (res && res.data) {
      if (res.data.agents && Array.isArray(res.data.agents)) {
        agents = res.data.agents
      } else if (Array.isArray(res.data)) {
        agents = res.data
      } else if (res.data.list && Array.isArray(res.data.list)) {
        agents = res.data.list
      } else if (res.data.data && Array.isArray(res.data.data)) {
        agents = res.data.data
      }
    }
    
    console.log('解析后的智能体列表', agents, '长度:', agents.length)
    
    if (agents && agents.length > 0) {
      if (isLoadMore) {
        agentList.value = [...agentList.value, ...agents]
      } else {
        agentList.value = agents
      }
      console.log('更新后的agentList', agentList.value, '长度:', agentList.value.length)
      page.value++
      if (agents.length < page_size.value) {
        hasMore.value = false
      }
    } else {
      hasMore.value = false
      if (!isLoadMore) {
        agentList.value = []
      }
      console.log('没有智能体数据')
    }
  })
  .catch(err => {
    console.error('加载智能体列表失败:', err)
    if (!isLoadMore) {
      agentListLoaded.value = false
    }
  })
  .finally(() => {
    isLoading.value = false
  })
}

function loadMoreAgents() {
  loadAgentList(true)
}

function handleAgentPitch(agent, index) {
  agentPitch.value = index
  modelNamea.value = agent.agentName || agent.name
  pitcha.value = index
  showAgentList.value = false
  uni.navigateTo({
    url: '/pages/tools/ai_assistant?' + 'modelNamea=' + modelNamea.value +
      '&pitcha=' + pitcha.value + '&pitch=' + pitch.value + '&type=' + agent.type,
    fail: (err) => {
      console.error('跳转失败:', err)
    }
  })
}

function selectAgent(index) {
  const agent = agentList.value[index]
  modelNamea.value = agent.agentName || agent.name
  pitcha.value = index
  showSkillsPopup.value = false
  uni.navigateTo({
    url: '/pages/tools/ai_assistant?' + 'modelNamea=' + modelNamea.value +
      '&pitcha=' + pitcha.value + '&pitch=' + pitch.value + '&type=' + agent.type,
    fail: (err) => {
      console.error('跳转失败:', err)
    }
  })
}

function getLogin() {
  let userData = uni.getStorageSync('data')
  if (!userData) {
    userData = uni.getStorageSync('userInfo')
  }
  
  console.log('getLogin - userData:', userData)
  console.log('getLogin - userData.uuid:', userData?.uuid)
  console.log('getLogin - userData.thirdPartyAccounts:', userData?.thirdPartyAccounts)
  console.log('getLogin - userData.thirdPartyAccounts.accessToken:', userData?.thirdPartyAccounts?.accessToken)
  
  if (!userData || 
      (typeof userData === 'object' && Object.keys(userData).length === 0) ||
      userData === '' ||
      userData === null ||
      userData === undefined ||
      !userData.uuid) {
    console.log('getLogin - 设置为未登录，原因：userData 或 uuid 不存在')
    isLogin.value = false
  } else {
    const accessToken = userData?.thirdPartyAccounts?.accessToken
    
    if (userData.uuid) {
      console.log('getLogin - 设置为已登录')
      isLogin.value = true
    } else {
      console.log('getLogin - 设置为未登录，原因：uuid 不存在')
      isLogin.value = false
    }
  }
}

function getPhoneNumber(e) {
  const systemInfo = uni.getSystemInfoSync()
  const isAppLocal = systemInfo.platform !== 'h5' && systemInfo.platform !== 'mp-weixin'
  
  if (e.detail.errMsg == "getPhoneNumber:ok") {
    uni.login({
      provider: "weixin",
      success: (res) => {
        if (res.code) {
          let code = res.code
          openId(res.code).then((resa) => {
            if (resa && resa.data) {
              const openIdUserData = resa.data
              
              const existingUserData = uni.getStorageSync('data') || {}
              const updatedUserData = {
                ...existingUserData,
                ...openIdUserData,
                thirdPartyAccounts: openIdUserData.thirdPartyAccounts || existingUserData.thirdPartyAccounts
              }
              
              updateUserInfo(updatedUserData)
              
              let getOpenid = ''
              if (openIdUserData.openid != undefined) {
                getOpenid = openIdUserData.openid
              } else {
                getOpenid = openIdUserData.thirdPartyAccounts?.openId || ''
              }
              
              getPhoneNumberApi(openIdUserData.unionId, e.detail.code, getOpenid, inviteCode.value).then(res => {
                if (res.data) {
                  const data = res.data
                  const finalUserData = {
                    ...updatedUserData,
                    ...data,
                    thirdPartyAccounts: data.thirdPartyAccounts || updatedUserData.thirdPartyAccounts
                  }
                  
                  uni.setStorageSync("data", finalUserData)
                  uni.$emit('loginSuccess', finalUserData)
                  getLogin()
                  updateUserInfo(finalUserData)
                }
              }).catch(err => {})
            }
          }).catch(err => {})
        }
      },
      fail: function (err) {},
    })
  }
}

function login_app(e) {
  console.log('login_app 被调用', e)
  
  const systemInfo = uni.getSystemInfoSync()
  const isAppLocal = systemInfo.platform !== 'h5' && systemInfo.platform !== 'mp-weixin'
  
  if (isAppLocal) {
    uni.navigateTo({
      url: '/pages/login-app/login'
    })
    return
  }
  
  if (e && e.detail) {
    if (e.detail.errMsg !== "getPhoneNumber:ok") {
      console.error('获取手机号失败:', e.detail.errMsg)
      uni.showToast({
        title: '获取手机号失败',
        icon: 'none'
      })
      return
    }
    
    uni.showLoading({
      title: '登录中...',
      mask: true
    })
    
    uni.login({
      provider: "weixin",
      success: (res) => {
        console.log('uni.login 成功:', res)
        if (res.code) {
          let code = res.code
          openId(code).then((resa) => {
            console.log('openId API 响应:', resa)
            
            if (!resa.data) {
              console.error('openId 返回数据为空')
              uni.hideLoading()
              uni.showToast({
                title: '获取用户信息失败',
                icon: 'none'
              })
              return
            }
            
            let getOpenid = ''
            let unionId = ''
            
            if (resa.data.openid != undefined) {
              getOpenid = resa.data.openid
            } else if (resa.data.thirdPartyAccounts && resa.data.thirdPartyAccounts.openId) {
              getOpenid = resa.data.thirdPartyAccounts.openId
            } else {
              console.error('无法获取 openid')
              uni.hideLoading()
              uni.showToast({
                title: '获取用户信息失败',
                icon: 'none'
              })
              return
            }
            
            if (resa.data.unionId) {
              unionId = resa.data.unionId
            } else if (resa.data.thirdPartyAccounts && resa.data.thirdPartyAccounts.unionId) {
              unionId = resa.data.thirdPartyAccounts.unionId
            } else {
              console.error('无法获取 unionId')
              uni.hideLoading()
              uni.showToast({
                title: '获取用户信息失败',
                icon: 'none'
              })
              return
            }
            
            console.log('准备调用 getPhoneNumberApi:', { unionId, code: e.detail.code, openId: getOpenid })
            
            getPhoneNumberApi(unionId, e.detail.code, getOpenid).then(res => {
              console.log('getPhoneNumberApi 响应:', res)
              uni.hideLoading()
              
              if (res.data) {
                const data = res.data
                console.log('登录成功，存储的数据:', data)
                console.log('data.uuid:', data.uuid)
                console.log('data.thirdPartyAccounts:', data.thirdPartyAccounts)
                
                uni.setStorageSync("data", res.data)
                uni.$emit('loginSuccess', res.data)
                isLogin.value = true
                userinfo.value = data
                
                getLogin()
                
                uni.showToast({
                  title: '登录成功',
                  icon: 'success'
                })
              } else {
                console.error('getPhoneNumberApi 返回数据为空')
                uni.showToast({
                  title: '登录失败，请重试',
                  icon: 'none'
                })
              }
            }).catch(err => {
              console.error('getPhoneNumberApi 调用失败:', err)
              uni.hideLoading()
              uni.showToast({
                title: '登录失败，请重试',
                icon: 'none'
              })
            })
          }).catch(err => {
            console.error('openId 调用失败:', err)
            uni.hideLoading()
            uni.showToast({
              title: '获取用户信息失败',
              icon: 'none'
            })
          })
        } else {
          console.error('uni.login 未返回 code')
          uni.hideLoading()
          uni.showToast({
            title: '登录失败，请重试',
            icon: 'none'
          })
        }
      },
      fail: function (err) {
        console.error('uni.login 失败:', err)
        uni.hideLoading()
        uni.showToast({
          title: '登录失败，请重试',
          icon: 'none'
        })
      },
    })
  } else {
    uni.showToast({
      title: '请登录',
      icon: 'none'
    })
  }
}

function modelConfigChange(obj) {
  modelConfigChangeData.value = obj
}

function textareaHeightChange(val) {
  textareaHeight.value = val
}

function showModelConfig(val) {
  showModelConfigVal.value = val
  showModelaConfig.value = val
}

function handleTouchStart(event, index, modelIndex, dateGroupIndex) {}
function handleTouchMove(event, index, modelIndex, dateGroupIndex) {}
function handleTouchEnd(event, index, modelIndex, dateGroupIndex) {}

function groupDataByDate() {
  groupedData.value = []
  const dateMap = {}

  alldataarr.value.forEach(item => {
    const date = formatDate(item.create_time)
    if (!dateMap[date]) {
      dateMap[date] = { name: date, list: [] }
      groupedData.value.push(dateMap[date])
    }
    const itemWithShow = { ...item, isShow: false }
    dateMap[date].list.push(itemWithShow)
  })
}

function formatDate(date) {
  const [year, month] = date.split('-')
  return `${year}年${month}月`
}

function gobackIndex() {
  uni.switchTab({
    url: '/pages/table/aiIndex/ai_index'
  })
}

function removeChat(id, index, modelIndex, dateGroupIndex) {
  let userData = uni.getStorageSync('data')
  if (!userData) {
    userData = uni.getStorageSync('userInfo')
  }

  if (id === active_date.value) {
    active_menu.value = -1
    active_date.value = -1

    talkingList.value = []
    displayedTalkingTexts.value = []
    displayedTexts.value = []
    question_list.value = []
    agent_content_list.value = []
    field_id.value = ''

    tagWrapShow.value = false
  }

  let modelNameENVal = modelNameEN.value
  
  if (drawerComponent.value && drawerComponent.value.sortedGroupedData && 
      drawerComponent.value.sortedGroupedData[modelIndex]) {
    const modelGroup = drawerComponent.value.sortedGroupedData[modelIndex]
    
    const foundModel = modelList.value.find(m => m.name === modelGroup.modelName || m.source === modelGroup.modelName)
    if (foundModel) {
      modelNameENVal = foundModel.name
    }
  }

  removeModelChat(id).then(res => {
    if (userData && userData.uuid && userData.thirdPartyAccounts && userData.thirdPartyAccounts.accessToken) {
      getModelChat({
        user_uuid: userData.uuid
      }).then(res => {
        alldataarr.value = res.data
        groupDataByDate()
      }).catch(err => {})
    }

    uni.showToast({
      title: '删除成功',
      icon: 'success'
    })
  }).catch(err => {
    uni.showToast({
      title: '删除失败',
      icon: 'error'
    })
  })
}

function gopage(url) {
  tagWrapShow.value = false
  if (url == '/pages/tools/aigc/index' || url == '/pagesA/studyindex/index') {
    uni.navigateTo({
      url: url
    })
    return
  }
  if (url == '/pages/table/user/index') {
    uni.navigateTo({
      url: url
    })
    return
  }
  uni.navigateTo({
    url: url
  })
}

function goToMyPage() {
  uni.navigateTo({
    url: '/pages/table/user/index',
    success: () => {
      setTimeout(() => {
        uni.$emit('showImageSharePopup', {
          current: 0
        })
      }, 500)
    }
  })
}

function handleShowFullList(item, index, modelIndex, dateGroupIndex) {
  active_menu.value = index
  active_date.value = item.id
  field_id.value = item.field1
  talkingList.value = []
  displayedTalkingTexts.value = []
  displayedTexts.value = []
  question_list.value = []
  agent_content_list.value = []
  isShowIcon.value = false
  inputFocused.value = false
  changePath.value = false
  prompt.value = ''
  imgUrl.value = ''
  imgsList.value = []
  
  let modelNameVal = ''
  let modelNameENVal = ''
  let modelIdVal = ''
  let modelInfoVal = null
  let pitchVal = -1
  
  if (drawerComponent.value && drawerComponent.value.sortedGroupedData && 
      drawerComponent.value.sortedGroupedData[modelIndex]) {
    const modelGroup = drawerComponent.value.sortedGroupedData[modelIndex]
    modelNameVal = modelGroup.modelName || modelName.value
    
    const foundModel = modelList.value.find(m => m.name === modelGroup.modelName || m.source === modelGroup.modelName)
    if (foundModel) {
      modelNameENVal = foundModel.name
      modelIdVal = foundModel.id
      modelInfoVal = foundModel
      pitchVal = modelList.value.indexOf(foundModel)
    } else {
      modelNameENVal = modelNameEN.value
      modelIdVal = modelId.value
      modelInfoVal = modelInfo.value
      pitchVal = pitch.value
    }
  } else {
    modelNameVal = modelName.value
    modelNameENVal = modelNameEN.value
    modelIdVal = modelId.value
    modelInfoVal = modelInfo.value
    pitchVal = pitch.value
  }
  
  let dateStr = ''
  if (drawerComponent.value && drawerComponent.value.sortedGroupedData && 
      drawerComponent.value.sortedGroupedData[modelIndex] && 
      drawerComponent.value.sortedGroupedData[modelIndex].dateGroups && 
      drawerComponent.value.sortedGroupedData[modelIndex].dateGroups[dateGroupIndex]) {
    dateStr = drawerComponent.value.sortedGroupedData[modelIndex].dateGroups[dateGroupIndex].date
  } else {
    dateStr = item.create_time ? item.create_time.split(' ')[0] : ''
  }
  
  const isSpecialModel = modelNameVal === '智汇AI数字人' || (modelInfoVal && (modelInfoVal.source === '智汇AI数字人'))
  const targetPage = isSpecialModel ? 'ai_index3' : 'ai_index2'
  
  uni.navigateTo({
    url: `/pages/tools/${targetPage}?prompt=` +
      prompt.value + '&remark=' + (modelInfoVal ? modelInfoVal.remark : modelInfo.value.remark) + '&modelName=' + modelNameVal + '&modelNameEN=' + modelNameENVal + '&modelId=' + modelIdVal + '&modelNamea=' +
      modelNamea.value + '&pitcha=' + pitcha.value + '&pitch=' + pitchVal + '&mccd=' + JSON.stringify(modelConfigChangeData.value) + '&modelType=' + currentModelType.value + '&imgUrl=' + JSON.stringify(imgsList.value) + '&noSend=' + true + '&isfulllist=' + true + '&item=' + item.field1 + '&index=' + index +
      '&date=' + dateStr + '&chat_id=' + item.id + '&audioUrl=' + audioUrl.value
  })
}

function addNewChat() {
  active_menu.value = -1
  active_date.value = -1
  talkingList.value = []
  displayedTalkingTexts.value = []
  displayedTexts.value = []
  question_list.value = []
  agent_content_list.value = []
  field_id.value = ''
  tagWrapShow.value = !tagWrapShow.value
  sourceIs.value = false
  isShowIcon.value = false
  inputFocused.value = false
  changePath.value = false
  prompt.value = ''
  imgUrl.value = ''
  imgsList.value = []
  
  const isSpecialModel = modelName.value === '智汇AI数字人' || (modelInfo.value && (modelInfo.value.source === '智汇AI数字人'))
  const targetPage = isSpecialModel ? 'ai_index3' : 'ai_index2'
  
  uni.navigateTo({
    url: `/pages/tools/${targetPage}?prompt=` +
      prompt.value + '&remark=' + modelInfo.value.remark + '&modelName=' + modelName.value + '&modelNameEN=' + modelNameEN.value + '&modelId=' + modelId.value + '&modelNamea=' +
      modelNamea.value + '&mccd=' + JSON.stringify(modelConfigChangeData.value) + '&modelType=' + currentModelType.value + '&pitcha=' + pitcha.value + '&pitch=' +
      pitch.value + '&imgUrl=' + JSON.stringify(imgsList.value) + '&noSend=' + true + '&isaddnew=' + true + '&chat_id=null' + '&audioUrl=' + audioUrl.value
  })
}

function close_drawer() {
  tagWrapShow.value = !tagWrapShow.value
}

function handleNavClick() {
  tagWrapShow.value = !tagWrapShow.value
}

function startmessage(e) {
  return Promise.resolve()
}

function completemessage(e) {
  try {
    if (e && e.detail) {
      if (e.detail.errMsg && e.detail.errMsg.includes('ok')) {
        uni.showToast({
          title: '加入成功',
          icon: 'success'
        })
      } else if (!(e.detail.errMsg && e.detail.errMsg.includes('cancel'))) {
        uni.showToast({
          title: '加入失败，请重试',
          icon: 'none'
        })
      }
    }
  } catch (error) {}
  return Promise.resolve()
}

function updatePrompt(newValue) {
  prompt.value = newValue
}

function home() {}

function ampily() {}

function intelliShow() {
  intelliReveal.value = !intelliReveal.value
  setupTimer()
}

function setupTimer() {
  timer.value = setTimeout(() => {
    intelliReveal.value = false
  }, 3000)
}

function clearTimer() {
  if (timer.value) {
    clearTimeout(timer.value)
    timer.value = null
  }
}

function pitchHandle(item, index, shouldNavigate = false) {
  let currentList = []
  switch(currentModelType.value) {
    case 'image':
      currentList = modelListComp.value.imageList
      break
    case 'talk':
      currentList = modelListComp.value.talkList
      break
    case 'videoa':
      currentList = modelListComp.value.videoaList
      break
    case 'video':
      currentList = modelListComp.value.videoList
      break
    case 'audio':
      currentList = modelListComp.value.audioList
      break
    case 'other':
      currentList = modelListComp.value.otherList
      break
  }
  
  pitch.value = index
  modelName.value = item.source
  modelNameEN.value = item.name
  modelId.value = item.id
  modelInfo.value = item
  talking.value = false

  showModelList.value = false
  currentModelType.value = ''

  if (shouldNavigate) {
    let setVariables = []
    if (modelConfigDialog.value && modelConfigDialog.value.setVariables) {
      setVariables = modelConfigDialog.value.setVariables
    }
    
    const isSpecialModel = modelName.value === '智汇AI数字人' || (modelInfo.value && (modelInfo.value.source === '智汇AI数字人'))
    const targetPage = isSpecialModel ? 'ai_index3' : 'ai_index2'
    
    uni.navigateTo({
      url: `/pages/tools/${targetPage}?prompt=` +
        prompt.value + '&modelName=' + modelName.value + '&remark=' + modelInfo.value.remark + '&modelNameEN=' + modelNameEN.value + '&modelId=' + modelId.value + '&modelNamea=' +
        modelNamea.value + '&mccd=' + JSON.stringify(modelConfigChangeData.value) + '&modelType=' + currentModelType.value + '&pitcha=' + pitcha.value + '&pitch=' +
        pitch.value + '&imgUrl=' + JSON.stringify(imgsList.value) + '&audioUrl=' + audioUrl.value + '&setVariables=' + JSON.stringify(setVariables) + '&chat_id=' + (alldataarr.value.find(item => item.model_name === modelNameEN.value)?.id || '')
    })
  }
}

function pitchHandlea(index) {
  pitcha.value = index
  modelNamea.value = agentList.value[index].agentName
  uni.navigateTo({
    url: '/pages/tools/ai_assistant?' + 'modelNamea=' + modelNamea.value +
      '&pitcha=' + pitcha.value + '&pitch=' + pitch.value + '&type=' + agentList.value[index].type,
    fail: (err) => {}
  })
}

function sourceHandle() {
  sourceIs.value = !sourceIs.value
  isShowIcon.value = false
}

function goTop() {
  uni.pageScrollTo({
    scrollTop: 0,
    duration: 300
  })
}

function backPage() {
  const pages = getCurrentPages()
  if (pages.length > 1) {
    uni.navigateBack({
      delta: 1
    })
  } else {
    uni.switchTab({
      url: '/pages/table/aiIndex/ai_index'
    })
  }
}

async function handleSendMessageabc(promptArg) {
  const userInput = (promptArg || prompt.value || '').trim()
  const hasPrompt = userInput.length > 0
  const hasMaterialCards = materialCards.value && materialCards.value.length > 0
  if (!hasPrompt && !hasMaterialCards) {
    uni.showToast({
      title: '请输入内容或选择创作卡片',
      icon: 'none'
    })
    return
  }
  if (hasMaterialCards && !hasPrompt) {
    uni.showToast({
      title: '请输入要回复的问题',
      icon: 'none'
    })
    return
  }
  
  if (!isLogin.value) {
    const systemInfo = uni.getSystemInfoSync()
    const isAppLocal = systemInfo.platform !== 'h5' && systemInfo.platform !== 'mp-weixin'
    
    if (isAppLocal) {
      uni.navigateTo({
        url: '/pages/login-app/login'
      })
      return
    }
    
    uni.showToast({
      title: '请先登录',
      icon: 'none'
    })
    uni.showModal({
      title: '提示',
      content: '请先登录后再使用此功能',
      confirmText: '去登录',
      success: (res) => {
        if (res.confirm) {
          uni.pageScrollTo({
            selector: '.home_btns',
            duration: 300
          })
        }
      }
    })
    return
  }
  
  sourceIs.value = false
  isShowIcon.value = false
  inputFocused.value = false
  changePath.value = false

  let setVariables = []
  if (modelConfigDialog.value && modelConfigDialog.value.setVariables) {
    setVariables = modelConfigDialog.value.setVariables
  }
  showModelaConfig.value = false

  let effectivePrompt = userInput
  let effectiveImgsList = JSON.parse(JSON.stringify(imgsList.value || []))
  if (materialCards.value && materialCards.value.length > 0) {
    const refParts = []
    materialCards.value.forEach(card => {
      if (card.type === 1 && (card.title || card.content)) {
        refParts.push('问题：' + (card.title || '') + '和回答：' + (card.content || ''))
      } else if (card.type === 2 && card.imageList && card.imageList.length) {
        card.imageList.forEach(url => {
          effectiveImgsList.push({ imgUrl: url })
        })
        if (card.title) refParts.push('问题：' + card.title + '（见上方图片）')
      } else if (card.type === 3 && card.videoUrl) {
        refParts.push('参考视频：' + card.videoUrl + (card.title ? '（' + card.title + '）' : ''))
      } else if (card.type === 4 && card.audioUrl) {
        refParts.push('参考音频：' + card.audioUrl + (card.title ? '（' + card.title + '）' : ''))
      }
    })
    if (refParts.length > 0) {
      effectivePrompt = '请参考，' + refParts.join('；') + '，进行回复以下问题：' + userInput
    }
  }

  if (modelNameEN.value === 'AgentMode' || pitch.value === -1) {
    let userData = uni.getStorageSync('data')
    if (!userData) {
      userData = uni.getStorageSync('userInfo')
    }
    
    if (!userData || !userData.uuid) {
      uni.showToast({
        title: '请先登录',
        icon: 'none'
      })
      return
    }
    
    uni.showLoading({
      title: '正在搜索模型...',
      mask: true
    })
    
    try {
      console.log('准备调用搜索模型工作流接口，参数:', {
        user_uuid: userData.uuid,
        content: promptArg || prompt.value || '这是啥'
      })
      
      const res = await searchModelWorkflowRun({
        user_uuid: userData.uuid,
        content: effectivePrompt || '这是啥'
      })
      
      uni.hideLoading()
      console.log('搜索模型工作流接口返回结果:', res)
      console.log('返回结果类型:', typeof res)
      console.log('返回结果结构:', JSON.stringify(res, null, 2))
      
      if (res && res.success && res.data) {
        const modelIdVal = res.data
        console.log('解析到的modelId:', modelIdVal)
        
        if (!modelList.value || modelList.value.length === 0) {
          try {
            const listRes = await getCozeApiList()
            modelList.value = listRes.data || []
          } catch (err) {}
        }
        
        const foundModel = modelList.value.find(model => {
          return String(model.id) === String(modelIdVal) || model.id === modelIdVal
        })
        console.log('找到的模型:', modelIdVal, foundModel)
        
        if (foundModel) {
          const isSpecialModel = foundModel.source === '智汇AI数字人'
          const targetPage = isSpecialModel ? 'ai_index3' : 'ai_index2'
          
          uni.navigateTo({
            url: `/pages/tools/${targetPage}?prompt=` +
              encodeURIComponent(effectivePrompt || '') + '&modelName=' + (foundModel.source || '') + '&remark=' + (foundModel.remark || '') + '&modelNameEN=' + (foundModel.name || '') + '&modelId=' + (foundModel.id || modelIdVal) + '&modelNamea=' +
              (modelNamea.value || '') + '&mccd=' + JSON.stringify(modelConfigChangeData.value) + '&modelType=' + currentModelType.value + '&pitcha=' + pitcha.value + '&pitch=' +
              pitch.value + '&imgUrl=' + JSON.stringify(effectiveImgsList) + '&audioUrl=' + (audioUrl.value || '') + '&setVariables=' + JSON.stringify(setVariables)
          })
        } else {
          uni.showToast({
            title: '未找到对应模型，使用默认配置',
            icon: 'none',
            duration: 2000
          })
          
          uni.navigateTo({
            url: '/pages/tools/ai_index2?prompt=' +
              encodeURIComponent(effectivePrompt || '') + '&modelName=' + 'Agent模式' + '&remark=' + '' + '&modelNameEN=' + 'agent-mode' + '&modelId=' + modelIdVal + '&modelNamea=' +
              (modelNamea.value || '') + '&mccd=' + JSON.stringify(modelConfigChangeData.value) + '&modelType=' + currentModelType.value + '&pitcha=' + pitcha.value + '&pitch=' +
              pitch.value + '&imgUrl=' + JSON.stringify(effectiveImgsList) + '&audioUrl=' + (audioUrl.value || '') + '&setVariables=' + JSON.stringify(setVariables)
          })
        }
      } else {
        console.log('搜索模型失败，返回结果不满足条件')
        console.log('res:', res)
        console.log('res.success:', res?.success)
        console.log('res.data:', res?.data)
        console.log('res.error:', res?.error)
        console.log('res.code:', res?.code)
        console.log('res.msg:', res?.msg)
        
        uni.showToast({
          title: res.error || res.msg || '搜索模型失败',
          icon: 'none'
        })
        return
      }
    } catch (error) {
      uni.hideLoading()
      console.error('搜索模型异常:', error)
      console.error('错误详情:', JSON.stringify(error, null, 2))
      
      uni.showToast({
        title: '搜索模型失败，请重试',
        icon: 'none'
      })
      return
    }
  } else {
    const isSpecialModel = modelName.value === '智汇AI数字人'
    const targetPage = isSpecialModel ? 'ai_index3' : 'ai_index2'
    
    uni.navigateTo({
      url: `/pages/tools/${targetPage}?prompt=` +
        encodeURIComponent(effectivePrompt || '') + '&modelName=' + modelName.value + '&remark=' + (modelInfo.value?.remark || '') + '&modelNameEN=' + modelNameEN.value + '&modelId=' + modelId.value + '&modelNamea=' +
        (modelNamea.value || '') + '&mccd=' + JSON.stringify(modelConfigChangeData.value) + '&modelType=' + currentModelType.value + '&pitcha=' + pitcha.value + '&pitch=' +
        pitch.value + '&imgUrl=' + JSON.stringify(effectiveImgsList) + '&audioUrl=' + (audioUrl.value || '') + '&setVariables=' + JSON.stringify(setVariables)
    })
  }
  
  prompt.value = ''
  imgUrl.value = ''
  imgsList.value = []
  materialCards.value = []

  return
}

function removeLoadingMessage() {
  conversationMessages.value = conversationMessages.value.filter(msg => msg.type !== 'loading')
}

function startCheckingStatus() {
  if (checkStatusInterval.value) {
    clearInterval(checkStatusInterval.value)
  }

  checkStatusInterval.value = setInterval(async () => {
    try {
      const result = await wx.cloud.callFunction({
        name: 'coze_worker',
        data: {
          token: token.value,
          workflowId: '7501713527549427722',
          execute_id: taskId.value
        }
      })

      if (result.result.code === 0) {
        const task = result.result.data

        if (task.status === 'Success') {
          clearInterval(checkStatusInterval.value)
          loading.value = false

          removeLoadingMessage()

          try {
            let rawData = task.rawOutput?.output || task.rawOutput || task.originalData?.output || task.originalData || ''

            saveToHistory(rawData)

            currentResponse.value = rawData

            nextTick(() => {
              if (responseFormatter.value) {
                responseFormatter.value.processResponse(rawData)

                uni.showToast({
                  title: '生成成功',
                  icon: 'success'
                })
              } else {
                removeLoadingMessage()
                conversationMessages.value.push({
                  type: 'bot',
                  content: typeof rawData === 'string' ? rawData : JSON.stringify(rawData),
                  timestamp: Date.now(),
                  showCopyButton: true
                })
              }
            })
          } catch (error) {
            removeLoadingMessage()
            conversationMessages.value.push({
              type: 'bot',
              content: '处理返回内容出错，请重试',
              timestamp: Date.now()
            })
          }
        } else if (task.status === 'Failed') {
          clearInterval(checkStatusInterval.value)
          loading.value = false
          removeLoadingMessage()
          conversationMessages.value.push({
            type: 'bot',
            content: '很抱歉，生成失败，请调整您的描述或稍后再试',
            timestamp: Date.now()
          })
          scrollToBottom()
        }
      } else {
        await handleTokenReturn()

        clearInterval(checkStatusInterval.value)
        loading.value = false
        removeLoadingMessage()
        conversationMessages.value.push({
          type: 'bot',
          content: '获取任务状态失败，请重试',
          timestamp: Date.now()
        })
        scrollToBottom()
      }
    } catch (error) {
      await handleTokenReturn()

      clearInterval(checkStatusInterval.value)
      loading.value = false
      removeLoadingMessage()
      conversationMessages.value.push({
        type: 'bot',
        content: '检查任务状态失败，请重试',
        timestamp: Date.now()
      })
      scrollToBottom()
    }
  }, 3000)
}

function processCozeBotResponse(data) {
  currentResponse.value = data
  nextTick(() => {
    if (responseFormatter.value) {
      responseFormatter.value.processResponse(data)
    } else {
      conversationMessages.value.push({
        type: 'bot',
        content: typeof data === 'string' ? data : JSON.stringify(data),
        timestamp: Date.now(),
        showCopyButton: true
      })
    }
  })

  return {
    title: '',
    text: '',
    imageUrls: []
  }
}

function handleResponseProcessed(result) {
  if (!hasPostContext.value && userContextId.value && result.originalData) {
    postContext(userContextId.value, "", result.originalData)
    hasPostContext.value = true
  }
  const currentTimestamp = Date.now()
  if (currentTimestamp - lastProcessedTimestamp.value < 500) {
    return
  }
  lastProcessedTimestamp.value = currentTimestamp

  removeLoadingMessage()

  const timestamp = Date.now()
  const title = result.title || ''
  const textContent = result.text || ''

  if (result.originalData && typeof result.originalData === 'string' &&
    (result.originalData.includes('s.coze.cn/t/') || result.originalData.includes('coze.cn/t/'))) {

    const imageUrl = result.originalData.trim()

    conversationMessages.value.push({
      type: 'bot',
      content: textContent || '生成的图片：',
      mediaType: 'image',
      mediaUrl: imageUrl,
      timestamp: timestamp,
      showCopyButton: true
    })

    if (!result.imageUrls) {
      result.imageUrls = [imageUrl]
    } else if (Array.isArray(result.imageUrls)) {
      result.imageUrls.push(imageUrl)
    }

  } else if (result.videoUrl) {

    let videoUrl = result.videoUrl

    if (typeof videoUrl === 'object') {
      videoUrl = JSON.stringify(videoUrl)
    }

    videoUrl = videoUrl.replace(/^["']+|["']+$/g, '')

    conversationMessages.value.push({
      type: 'bot',
      content: textContent || '视频内容：',
      mediaType: 'video',
      mediaUrl: videoUrl,
      timestamp: timestamp,
      showCopyButton: true
    })

    conversationMessages.value.push({
      type: 'bot',
      content: `视频链接：${videoUrl}`,
      timestamp: timestamp + 1,
      showCopyButton: true
    })

  } else if (result.imageUrls && result.imageUrls.length > 0) {

    result.imageUrls.forEach((imageUrl, index) => {
      if (imageUrl && typeof imageUrl === 'string' && imageUrl.includes('http')) {
        const message = {
          type: 'bot',
          mediaType: 'image',
          mediaUrl: imageUrl,
          timestamp: timestamp
        }

        if (index === 0 && textContent) {
          message.content = textContent
          message.showCopyButton = true
        }
        conversationMessages.value.push(message)
      }
    })
  } else if (textContent) {
    conversationMessages.value.push({
      type: 'bot',
      content: textContent,
      timestamp: timestamp,
      showCopyButton: true
    })
  } else {
    conversationMessages.value.push({
      type: 'bot',
      content: '未能获取到有效内容，请重试',
      timestamp: timestamp
    })
  }

  scrollToBottom()
}

function handleJsonProcessed(processedData) {}

async function handleTokenReturn() {
  if (tokenReturnExecuted.value || !flowId.value) {
    return
  }

  try {
    tokenReturnExecuted.value = true

    const returnRes = await getTokenReturn(userContextId.value)
    if (returnRes && returnRes.code == "200" && returnRes.data) {
      uni.setStorageSync("data", returnRes.data)
      uni.$emit('updateTokenQuantity', returnRes.data)
    }
  } catch (tokenErr) {}
}

function copyText(text) {
  if (!text) return

  uni.setClipboardData({
    data: text,
    success: function () {
      uni.showToast({
        title: '已复制',
        icon: 'success'
      })
    }
  })
}

function clearHistory() {
  uni.showModal({
    title: '确认清除',
    content: '确定要清除所有历史记录吗？',
    success: (res) => {
      if (res.confirm) {
        completedResponses.value = []
        conversationMessages.value = []
        uni.showToast({
          title: '已清除历史记录',
          icon: 'success'
        })
      }
    }
  })
}

function scrollToBottom() {
  if (scrollTimer.value) {
    clearTimeout(scrollTimer.value)
  }

  scrollTop.value = 100000

  scrollTimer.value = setTimeout(() => {
    scrollTop.value = Math.random() * 1000000 + 100000
  }, 500)
}

function handleMessagesUpdated() {
  scrollToBottom()
}

function handleMediaDetected(media) {}
function handleLinksDetected(links) {}

function handleSaveMedia({ url, type }) {
  if (type === 'image' && url) {
    saveImage(url)
  }
}

function saveToHistory(responseData) {
  const responseItem = {
    prompt: savedPrompt.value,
    timestamp: Date.now(),
    text: responseData
  }

  if (!completedResponses.value) {
    completedResponses.value = []
  }
  completedResponses.value.unshift(responseItem)
}

function saveImage(url) {
  if (!url) return

  uni.getSetting({
    success: (res) => {
      if (!res.authSetting['scope.writePhotosAlbum']) {
        uni.authorize({
          scope: 'scope.writePhotosAlbum',
          success: () => {
            downloadAndSaveImage(url)
          },
          fail: (err) => {
            uni.showModal({
              title: '提示',
              content: '保存图片需要您授权使用相册权限，请在设置中开启',
              confirmText: '去设置',
              cancelText: '取消',
              success: (modalRes) => {
                if (modalRes.confirm) {
                  uni.openSetting({
                    success: (settingRes) => {
                      if (settingRes.authSetting['scope.writePhotosAlbum']) {
                        downloadAndSaveImage(url)
                      }
                    }
                  })
                }
              }
            })
          }
        })
      } else {
        downloadAndSaveImage(url)
      }
    },
    fail: (err) => {
      uni.showToast({
        title: '获取权限信息失败',
        icon: 'none'
      })
    }
  })
}

function downloadAndSaveImage(url) {
  uni.showLoading({
    title: '保存中...'
  })

  uni.downloadFile({
    url: url,
    success: (res) => {
      if (res.statusCode === 200) {
        uni.saveImageToPhotosAlbum({
          filePath: res.tempFilePath,
          success: () => {
            uni.hideLoading()
            uni.showToast({
              title: '保存成功',
              icon: 'success'
            })
          },
          fail: (err) => {
            uni.hideLoading()
            uni.showToast({
              title: '保存失败: ' + (err.errMsg || '未知错误'),
              icon: 'none',
              duration: 2000
            })
          }
        })
      } else {
        uni.hideLoading()
        uni.showToast({
          title: '图片下载失败',
          icon: 'none'
        })
      }
    },
    fail: (err) => {
      uni.hideLoading()
      uni.showToast({
        title: '下载失败: ' + (err.errMsg || '未知错误'),
        icon: 'none'
      })
    }
  })
}

function toggleVoiceInput() {
  isInputVisible.value = !isInputVisible.value
  isVoiceAnimationActive.value = !isInputVisible.value
}

function startVoiceAnimation() {
  isRecording.value = true
  isVoiceAnimationActive.value = true
  startActualRecord()

  return
  isVoiceAnimationActiveStart.value = true
  startVoiceRecognition()
}

function stopVoiceAnimation() {
  isVoiceAnimationActiveStart.value = false
  inputFocused.value = false
  stopVoiceRecognition()
}

async function startVoiceRecognition() {
  if (isApp.value) {
    showKeyboard.value = false

  } else {
    if (isRecording.value) {
      return
    }

    showKeyboard.value = false

    try {
      const authStatus = await getRecordAuthStatus()

      if (authStatus === 'authorized') {
        await startRecording()
      } else if (authStatus === 'denied') {
        isAuthorizingVoice.value = true
        showGoToSettingsTip()
        isAuthorizingVoice.value = false
      } else {
        isAuthorizingVoice.value = true
        const granted = await requestRecordPermission()
        isAuthorizingVoice.value = false

        if (granted) {
          uni.showToast({
            title: '授权成功，请再次长按使用语音',
            icon: 'none'
          })
        }
      }
    } catch (error) {
      isAuthorizingVoice.value = false
    }
  }
}

function getRecordAuthStatus() {
  return new Promise((resolve) => {
    uni.getSetting({
      success: (res) => {
        if (res.authSetting['scope.record'] === true) {
          resolve('authorized')
        } else if (res.authSetting['scope.record'] === false) {
          resolve('denied')
        } else {
          resolve('notDetermined')
        }
      },
      fail: () => resolve('unknown')
    })
  })
}

async function startRecording() {
  if (isRecording.value) {
    return
  }
  isRecording.value = true
  if (recordManager.value) {
    recordManager.value.start({
      duration: 60000,
      lang: "zh_CN"
    })
  } else {
    isRecording.value = false
    throw new Error('录音管理器未初始化')
  }
}

function requestRecordPermission() {
  return new Promise((resolve) => {
    uni.authorize({
      scope: 'scope.record',
      success: () => {
        resolve(true)
      },
      fail: () => {
        resolve(false)
      }
    })
  })
}

function showGoToSettingsTip() {
  uni.showModal({
    title: '权限申请',
    content: '使用语音功能需要您授权麦克风权限，请在设置中开启',
    confirmText: '去设置',
    cancelText: '取消',
    success: (modalRes) => {
      if (modalRes.confirm) {
        uni.openSetting({
          success: (settingRes) => {
            if (settingRes.authSetting['scope.record']) {
              uni.showToast({
                title: '授权成功，请再次长按使用语音',
                icon: 'none'
              })
            }
          }
        })
      }
    }
  })
}

function startRecordingNew(filename) {
  let zhsToken = uni.getStorageSync('data')['uuid']
  let sysData = uni.getSystemInfoSync()
  newRecorder.value = plus.audio.getRecorder()
  const options = {
    filename: filename,
    format: "mp3",
    samplerate: 8000,
    bitrate: 12200,
    channels: 1
  }

  console.log('newRecorder', newRecorder.value)
  newRecorder.value.record(options, (path) => {
    console.log('录音完成:-- ' + path)

    uni.uploadFile({
      url: 'https://bsm.aizhs.top/prod-api/file/upload',
      filePath: path,
      name: 'file',
      success: async (res) => {
        console.log(res, '---res')
        let data = JSON.parse(res['data'])
        console.log('上传', data['data']['url'])
        if (data['code'] !== 200) {
          uni.showToast({
            title: '上传失败',
            icon: 'none',
            duration: 2000
          })
          return
        }
        const audioData = await fetchAudioText(data['data']['url'])
        console.log('识别', audioData)
        asrTxt.value = audioData['data']['data']['result']
        prompt.value = audioData['data']['data']['result']
        if (audioData['data']['data']['result'].length) {
          console.log('识别后结果', prompt.value)
          isVoiceAnimationActive.value = false
          isLongPress.value = false
          isVoiceAnimationActiveStart.value = false
          isLongPress.value = false
          isVoiceAnimationActive.value = false
          handleInputBlur()

          setTimeout(() => {
            uni.hideLoading()

            const isSpecialModel = modelName.value === '智汇AI数字人' || (modelInfo.value && (modelInfo.value.source === '智汇AI数字人'))
            const targetPage = isSpecialModel ? 'ai_index3' : 'ai_index2'

            uni.navigateTo({
              url: `/pages/tools/${targetPage}?prompt=` +
                prompt.value + '&remark=' + modelInfo.value.remark + '&modelName=' + modelName.value + '&modelNameEN=' + modelNameEN.value + '&modelId=' + modelId.value + '&modelNamea=' +
                modelNamea.value + '&mccd=' + JSON.stringify(modelConfigChangeData.value) + '&modelType=' + currentModelType.value + '&pitcha=' + pitcha.value + '&pitch=' +
                pitch.value + '&imgUrl=' + JSON.stringify(imgsList.value) + '&noSend=' + true + '&isaddnew=' + true + '&chat_id=null' + '&audioUrl=' + audioUrl.value
            })
            prompt.value = ''
            imgUrl.value = ''
            imgsList.value = []

          }, 300)
        } else {
          isVoiceAnimationActive.value = false
          isLongPress.value = false
          isVoiceAnimationActiveStart.value = false
          isLongPress.value = false
          isVoiceAnimationActive.value = false
          handleInputBlur()
          uni.hideLoading()
          uni.showToast({
            title: '请重说',
            icon: 'none'
          })
          console.log('请重说')
        }
      },
      fail: (err) => {
        console.log(err, '----上传失败')
      }
    })
  }, (error) => {
    console.log('录音失败: ' + error.message)
  })
}

function startActualRecord() {
  isVoiceAnimationActiveStart.value = true
  showKeyboard.value = false

  const dir = '_doc/audio/'
  const filename = dir + new Date().getTime() + '.mp3'

  startRecordingNew(filename)
}

function startLongPress(e) {
  inputFocused.value = false
  showKeyboard.value = false
  try {
    if (toogleBtn.value && toogleBtn.value.$refs.inputArea && toogleBtn.value.$refs.inputArea.$refs.textarea) {
      toogleBtn.value.$refs.inputArea.$refs.textarea.blur()
    }
  } catch (error) {}
  clearTimeout(longPressTimeout.value)
  longPressTimeout.value = setTimeout(() => {
    isLongPress.value = true
    handleLongPress(e)
  }, 500)
}

function endLongPress() {
  clearTimeout(longPressTimeout.value)
  if (isLongPress.value) {
    inputFocused.value = false
    stopVoiceAnimation()
    isLongPress.value = false
    isVoiceAnimationActive.value = false
  }
}

function handleLongPress(e) {
  if (isLongPress.value) {
    isVoiceAnimationActive.value = true
    if (isApp.value) {
      startVoiceAnimation()
    } else {
      startVoiceRecognition()
    }
  }
}

function toggleSuperAgent() {
  sourceIsAgent.value = !sourceIsAgent.value
  sourceIs.value = false
  isShowIcon.value = false
  inputFocused.value = false
}

function toggleSuperAgentfu() {
  sourceIsAgent.value = false
  sourceIs.value = false
  isShowIcon.value = false
  inputFocused.value = false
}

function toggleMCP() {
  clickedMCP.value = !clickedMCP.value
}

function toggleKnowledgeBase() {
  clickedKnowled.value = !clickedKnowled.value
}

function togglePermanentMemory() {
  clickedPermanent.value = !clickedPermanent.value
}

function toggleVoiceInputMenu() {
  clickedVoiceInput.value = !clickedVoiceInput.value
}

function toggleVideoCall() {
  clickedVideoCall.value = !clickedVideoCall.value
}

function readFileToBase64(filePath) {
  return readFileToBase64Util(filePath)
}

function handleIconClick(icon) {
  showImagePopup.value = false
  isShow.value = false
  switch (icon) {
    case 'camera':
      uni.chooseImage({
        count: 1,
        sourceType: ['camera'],
        success: (res) => {
          const imgUrlVal = res.tempFilePaths[0]
          let imageInfo = {}
          uni.getImageInfo({
            src: imgUrlVal,
            success: (info) => {
              imageInfo['width'] = info.width
              imageInfo['height'] = info.height
            },
            fail: (err) => {}
          })

          const fileName = imgUrlVal.split('/').pop() || 'image.jpg'
          let userData = uni.getStorageSync("data")
          if (!userData) userData = uni.getStorageSync("userInfo")
          const id = (userData && userData.uuid) || ''
          readFileToBase64(imgUrlVal)
            .then((base64Str) => uploadBybase64(base64Str, fileName))
            .then((res) => {
              const url = (res && res.url) || ''
              if (url) {
                console.log('[上传成功-相机] 图片回调地址:', url)
                isShow.value = true
                const newItem = {
                  imgUrl: url,
                  originalUrl: imgUrlVal,
                  id,
                  width: imageInfo.width,
                  height: imageInfo.height,
                }
                imgsList.value = imgsList.value.concat([newItem])
                imgsListVersion.value++
                uni.hideLoading()
                uni.showToast({ title: '上传成功', icon: 'success', duration: 2000 })
                refreshImgsListDisplay()
              } else {
                throw new Error('返回的路径无效')
              }
            })
            .catch((err) => {
              uni.hideLoading()
              console.warn('上传失败，完整响应：', err)
              const msg = (err && (err.data && (err.data.msg || err.data.message)) || err.msg || err.message) || (err && err.errMsg ? '读取文件失败' : '上传失败')
              uni.showToast({ title: typeof msg === 'string' ? msg : '上传失败', icon: 'none', duration: 2000 })
            })
        }
      })
      break
    case 'album':
      uni.chooseImage({
        count: 1,
        sourceType: ['album'],
        success: (res) => {
          const imgUrlVal = res.tempFilePaths[0]
          let imageInfo = {}
          uni.getImageInfo({
            src: imgUrlVal,
            success: (info) => {
              imageInfo['width'] = info.width
              imageInfo['height'] = info.height
            },
            fail: (err) => {}
          })

          const fileNameAlbum = imgUrlVal.split('/').pop() || 'image.jpg'
          let userDataAlbum = uni.getStorageSync("data")
          if (!userDataAlbum) userDataAlbum = uni.getStorageSync("userInfo")
          const idAlbum = (userDataAlbum && userDataAlbum.uuid) || ''
          readFileToBase64(imgUrlVal)
            .then((base64Str) => uploadBybase64(base64Str, fileNameAlbum))
            .then((res) => {
              const url = (res && res.url) || ''
              if (url) {
                console.log('[上传成功-相册] 图片回调地址:', url)
                isShow.value = true
                const newItem = {
                  imgUrl: url,
                  originalUrl: imgUrlVal,
                  id: idAlbum,
                  width: imageInfo.width,
                  height: imageInfo.height,
                }
                imgsList.value = imgsList.value.concat([newItem])
                imgsListVersion.value++
                uni.hideLoading()
                uni.showToast({ title: '上传成功', icon: 'success', duration: 2000 })
                refreshImgsListDisplay()
              } else {
                throw new Error('返回的路径无效')
              }
            })
            .catch((err) => {
              uni.hideLoading()
              console.warn('上传失败，完整响应：', err)
              const msg = (err && (err.data && (err.data.msg || err.data.message)) || err.msg || err.message) || (err && err.errMsg ? '读取文件失败' : '上传失败')
              uni.showToast({ title: typeof msg === 'string' ? msg : '上传失败', icon: 'none', duration: 2000 })
            })
        }
      })
      break
    case 'file': {
      // #ifdef APP-PLUS
      if (typeof plus !== 'undefined' && plus.io && plus.io.chooseFile) {
        plus.io.chooseFile(
          {
            title: '选择文件',
            filter: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.jpg', '.jpeg', '.png'],
            multiple: false
          },
          (res) => {
            if (!res || !res.files || res.files.length === 0) {
              uni.showToast({ title: '未选择文件', icon: 'none' })
              return
            }
            const fileInfo = res.files[0]
            let localPath = typeof fileInfo === 'string' ? fileInfo : (fileInfo && (fileInfo.path || fileInfo.fullPath || fileInfo.name || fileInfo.url || fileInfo.filePath))
            if (!localPath && fileInfo && typeof fileInfo === 'object') {
              for (const key in fileInfo) {
                const v = fileInfo[key]
                if (typeof v === 'string' && (v.startsWith('/') || v.startsWith('file://') || v.includes('/storage/') || v.includes('/data/'))) {
                  localPath = v
                  break
                }
              }
            }
            if (!localPath) {
              uni.showToast({ title: '获取文件路径失败', icon: 'none' })
              return
            }
            let uploadFilePath = localPath
            if (localPath.startsWith('/storage') || localPath.startsWith('/data')) {
              if (!localPath.startsWith('file://')) uploadFilePath = 'file://' + localPath
            }
            const fileName = (localPath.split('/').pop() || 'file').split('?')[0]
            uni.showLoading({ title: '文件上传中...', mask: true })
            uni.uploadFile({
              url: 'https://bsm.aizhs.top/prod-api/file/upload',
              filePath: uploadFilePath,
              name: 'file',
              success: (uploadRes) => {
                try {
                  const data = typeof uploadRes.data === 'string' ? JSON.parse(uploadRes.data) : uploadRes.data
                  const url = (data && data.data && (data.data.url || data.data)) || (data && data.url)
                  if (data && (data.code === 200 || data.code === '200') && url) {
                    let userData = uni.getStorageSync('data')
                    if (!userData) userData = uni.getStorageSync('userInfo')
                    const id = (userData && userData.uuid) || ''
                    console.log('[上传成功-文件] 回调地址:', url)
                    imgsList.value = imgsList.value.concat([{ imgUrl: url, id, filename: fileName }])
                    imgsListVersion.value++
                    uni.hideLoading()
                    uni.showToast({ title: '文件上传成功', icon: 'success', duration: 2000 })
                    refreshImgsListDisplay()
                  } else {
                    throw new Error(data?.msg || data?.message || '返回的路径无效')
                  }
                } catch (e) {
                  uni.hideLoading()
                  console.warn('文件上传解析失败:', e)
                  uni.showToast({ title: (e && e.message) || '文件上传失败', icon: 'none', duration: 2000 })
                }
              },
              fail: (err) => {
                uni.hideLoading()
                console.warn('文件直传失败，尝试 base64 方式:', err)
                readFileToBase64(localPath)
                  .then((base64Str) => uploadBybase64(base64Str, fileName))
                  .then((res) => {
                    const url = (res && res.url) || (res && res.data)
                    if (url) {
                      let userData = uni.getStorageSync('data')
                      if (!userData) userData = uni.getStorageSync('userInfo')
                      const id = (userData && userData.uuid) || ''
                      imgsList.value = imgsList.value.concat([{ imgUrl: url, id, filename: fileName }])
                      imgsListVersion.value++
                      uni.showToast({ title: '文件上传成功', icon: 'success', duration: 2000 })
                      refreshImgsListDisplay()
                    } else throw new Error('返回的路径无效')
                  })
                  .catch((base64Err) => {
                    const msg = (base64Err && (base64Err.data && (base64Err.data.msg || base64Err.data.message)) || base64Err.msg || base64Err.message) || '文件上传失败'
                    uni.showToast({ title: typeof msg === 'string' ? msg : '文件上传失败', icon: 'none', duration: 2000 })
                  })
              }
            })
          },
          (err) => {
            if (err && err.code === -2) return
            uni.showToast({ title: '选择文件失败，请重试', icon: 'none' })
          }
        )
        break
      }
      // #endif
      uni.navigateTo({
        url: `/pagesA/webview/index?url=https://upload.aizhs.top&uuid=${userinfo.value?.uuid || ''}`
      })
      break
    }
    case 'wxfile': {
      const systemInfo = uni.getSystemInfoSync()
      const isAppLocal = systemInfo.platform !== 'h5' && systemInfo.platform !== 'mp-weixin'
      if (isAppLocal && typeof plus !== 'undefined' && plus.share) {
        plus.share.getServices((services) => {
          const weixinService = services.find(s => s.id === 'weixin')
          if (weixinService && typeof weixinService.launchMiniProgram === 'function') {
            weixinService.launchMiniProgram({
              id: WECHAT_MINI_PROGRAM_ID,
              path: 'pages/table/aiIndex/ai_index',
              type: 0
            }, () => {
              uni.showToast({ title: '已打开小程序', icon: 'success' })
            }, (err) => {
              uni.showToast({
                title: err && err.message ? err.message : '请先安装微信并关联小程序',
                icon: 'none',
                duration: 3000
              })
            })
          } else {
            plus.runtime.openURL('weixin://', () => {
              uni.showToast({ title: '请先安装微信', icon: 'none' })
            })
            uni.showToast({
              title: '请在微信中打开「AI智汇社」小程序使用文件上传',
              icon: 'none',
              duration: 3000
            })
          }
        }, () => {
          plus.runtime.openURL('weixin://', () => {
            uni.showToast({ title: '请先安装微信', icon: 'none' })
          })
          uni.showToast({
            title: '请在微信中打开「AI智汇社」小程序使用文件上传',
            icon: 'none',
            duration: 3000
          })
        })
        break
      }
      uni.chooseMessageFile({
        count: 10,
        type: 'file',
        success(res) {
          const tempFilePaths = res.tempFiles
        }
      })
      break
    }
    case 'code':
      uni.showToast({
        title: '代码功能开发中',
        icon: 'none'
      })
      break
    case 'audio':
      wx.chooseMessageFile({
        count: 1,
        type: 'file',
        extension: ['mp3', 'wav', 'm4a', 'aac'],
        success: (res) => {
          const tempFilePath = res.tempFiles[0].path
          const fileNameAudio = tempFilePath.split('/').pop() || 'audio.mp3'
          readFileToBase64(tempFilePath)
            .then((base64Str) => uploadBybase64(base64Str, fileNameAudio))
            .then((res) => {
              const url = (res && res.url) || ''
              if (url) {
                isShow.value = true
                audioUrl.value = url
                uni.hideLoading()
                uni.showToast({ title: '获取音频文件成功', icon: 'success', duration: 2000 })
                nextTick(() => {
                  if (uploadComponent.value) uploadComponent.value.$forceUpdate()
                  if (sharingComponent.value) sharingComponent.value.$forceUpdate()
                })
              } else {
                throw new Error('返回的路径无效')
              }
            })
            .catch((err) => {
              uni.hideLoading()
              console.warn('上传失败，完整响应：', err)
              const msg = (err && (err.data && (err.data.msg || err.data.message)) || err.msg || err.message) || (err && err.errMsg ? '读取文件失败' : '上传失败')
              uni.showToast({ title: typeof msg === 'string' ? msg : '上传失败', icon: 'none', duration: 2000 })
            })
        },
        fail: (err) => {}
      })

      break
  }
}

async function preloadVoicePlugin(forceReinit = false) {
  if (pluginPreloaded.value && !forceReinit) {
    if (recordManager.value) {
      setupRecordCallbacks()
    }
    return true
  }
  try {
    const plugin = requirePlugin("WechatSI")
    if (!plugin) {
      pluginReady.value = false
      return false
    }
    if (typeof plugin.getRecordRecognitionManager === 'function') {
      recordManager.value = plugin.getRecordRecognitionManager()
      setupRecordCallbacks()
      pluginPreloaded.value = true
      pluginReady.value = true
      return true
    } else {
      pluginReady.value = false
      return false
    }
  } catch (error) {
    pluginReady.value = false
    return false
  }
}

function setupRecordCallbacks() {
  if (!recordManager.value) return
  recordManager.value.onStop = (res) => {
    isRecording.value = false
    showKeyboard.value = false
    if (res.result && res.result.trim()) {
      prompt.value = res.result
      getLogin()
      handleSendMessageabc()
    }
  }
  recordManager.value.onStart = (res) => {
    isRecording.value = true
  }
  recordManager.value.onError = (res) => {
    isRecording.value = false
    showKeyboard.value = false
    uni.showToast({
      title: '请重说',
      icon: 'none'
    })
  }
}

async function stopVoiceRecognition() {
  isVoiceAnimationActive.value = false
  if (isApp.value) {
    console.log('APP停止录音')
    newRecorder.value.stop()

  } else {
    if (!isRecording.value) {
      return
    }
    try {
      if (recordManager.value) {
        recordManager.value.stop()
      }
    } catch (error) {} finally {
      isRecording.value = false
    }
  }
}

function functionHandle() {
  isShowIcon.value = !isShowIcon.value
  sourceIs.value = false
  sourceIsAgent.value = false
}

function handleKeyboardHide() {}

function handleInputFocus(e) {
  sourceIs.value = false
  sourceIsAgent.value = false
  inputFocused.value = true
  showModelaConfig.value = true
}

function handleInputClick() {
  sourceIs.value = false
  sourceIsAgent.value = false
}

function handleInputBlur() {
  inputFocused.value = false
}

function handleKeyboardShow(e) {
  uni.pageScrollTo({ scrollTop: 0, duration: 0 })
}

function handleClick() {
  try {
    sourceIs.value = false
    sourceIsAgent.value = false
    if (toogleBtn.value && toogleBtn.value.$refs.toggleBut && toogleBtn.value.$refs.toggleBut.indexc != -1) {
      toogleBtn.value.$refs.toggleBut.toggleSuperAgent()
    }
  } catch (error) {}
}

function removeImage(index) {
  imgsList.value.splice(index, 1)
  imgsListVersion.value++
}

function refreshImgsListDisplay() {
  const doRefresh = () => {
    const bar = toogleBtn.value
    if (bar && bar.$refs && bar.$refs.inputArea) {
      bar.$refs.inputArea.$forceUpdate()
    }
  }
  nextTick(() => doRefresh())
  if (typeof plus !== 'undefined') {
    setTimeout(() => doRefresh(), 150)
    setTimeout(() => doRefresh(), 400)
  }
}

function processContent(content) {
  const regex = /!\[([^\]]+)\]\(([^)]+)\)/g
  let match
  const processedContent = []
  let lastIndex = 0
  let imgUrlVal = ''
  while ((match = regex.exec(content)) !== null) {
    processedContent.push(content.slice(lastIndex, match.index))
    const altText = match[1]
    const url = match[2]
    imgUrlVal = url
    const processedPart = `Processed: ${altText} from URL ${url}`
    processedContent.push(processedPart)
    lastIndex = regex.lastIndex
  }
  processedContent.push(content.slice(lastIndex))
  return imgUrlVal
}

function handleScroll(event) {
  let scrollHeight = 0
  let rowBoxHeight = 0
  const scrollView = uni.createSelectorQuery().select('.chu-content')
  scrollView.boundingClientRect(data => {
    if (data) {
      scrollHeight = data.height
    }
  }).exec()
  const rowBox = uni.createSelectorQuery().select('.chu-row-box')
  rowBox.boundingClientRect(data => {
    if (data) {
      rowBoxHeight = data.height
    }
    if (scrollHeight + event.detail.scrollTop >= rowBoxHeight - 50) {
      if (isLoading.value || !hasMore.value) return
      isLoading.value = true
      getAgentListAll({ pageNum: page.value, pageSize: page_size.value }).then(res => {
        if (res.data.agents && res.data.agents.length > 0) {
          agentList.value = [...agentList.value, ...res.data.agents]
          page.value++
        } else {
          hasMore.value = false
        }
      })
        .catch(err => {})
        .finally(() => {
          isLoading.value = false
        })
    }
  }).exec()
}

function gotocompany() {
  uni.navigateTo({
    url: '/pagesA/distribution/index',
  })
}

function lingqu() {
  uni.setClipboardData({
    data: "https://aizhihuishe.feishu.cn/wiki/GPs7wff9PiDekQkKvBncryrmnIh?from=from_copylink",
    success: () => {
      uni.showToast({
        title: '链接已复制，请在浏览器中打开',
        icon: 'none'
      })
    },
    fail: () => {
      uni.showToast({
        title: '复制失败',
        icon: 'none'
      })
    }
  })
}

async function checkLoginAndShowSharePoints() {
  let userData = uni.getStorageSync('data')
  if (!userData) {
    userData = uni.getStorageSync('userInfo')
  }
  const accessToken = userData?.thirdPartyAccounts?.accessToken
  if (userData && 
      typeof userData === 'object' && 
      Object.keys(userData).length > 0 &&
      userData.uuid &&
      accessToken &&
      accessToken.trim() !== '') {
    await checkPointsReceived()
  }
}

async function checkPointsReceived() {
  try {
    const res = await checkFirstShareStatus()
    showSharePointsPopup.value = !res
  } catch (error) {}
}

function closeSharePointsPopup() {
  showSharePointsPopup.value = false
  
  uni.setStorageSync('shareCancelled', true)
  
  uni.removeStorageSync('isSharing')
  uni.removeStorageSync('shareStatus')
  
  uni.$off('shareSuccess')
  uni.$off('shareFail')
}

function handleShareClick() {
  const shareStartTime = Date.now()
  
  uni.setStorageSync('shareStatus', {
    started: true,
    startTime: shareStartTime,
    completed: false
  })
  
  uni.$once('shareSuccess', () => {
    handleShareSuccess()
  })
  
  uni.$once('shareFail', () => {
    handleShareFail()
  })
}

async function handleShareSuccess() {
  try {
    const res = await firstShare()
    
    if (res && res.data) {
      if (res.data.uuid || (res.data.userInfo && res.data.userInfo.uuid)) {
        const userData = res.data.userInfo || res.data
        
        if (userData && typeof userData === 'object' && userData.uuid) {
          const existingUserData = uni.getStorageSync('data') || {}
          const updatedUserData = {
            ...existingUserData,
            ...userData,
            thirdPartyAccounts: userData.thirdPartyAccounts || existingUserData.thirdPartyAccounts
          }
          
          uni.setStorageSync("data", updatedUserData)
          
          uni.$emit('loginSuccess', updatedUserData)
          
          uni.$emit('user-info-updated', updatedUserData)
          
          if (updatedUserData.userMargin || updatedUserData.tokenQuantity) {
            uni.$emit('updateTokenQuantity', updatedUserData)
          }
          
          uni.$emit('userDataUpdated', updatedUserData)
          
          userinfo.value = updatedUserData
          
          getLogin()
          
          notifyAllPagesUpdateUserInfo(updatedUserData)
        }
      }
    }
    
    updateShareStatus(true, true)
    hasReceivedPoints.value = true
    uni.setStorageSync('hasReceivedSharePoints', true)
    showSharePointsPopup.value = false
    
    uni.showToast({
      title: '智汇值领取成功',
      icon: 'success'
    })
  } catch (error) {
    updateShareStatus(true, false)
    showSharePointsPopup.value = false
    
    uni.showToast({
      title: '智汇值领取失败',
      icon: 'none'
    })
  }
}

function updateShareStatus(completed, success) {
  const shareStatus = uni.getStorageSync('shareStatus') || {}
  shareStatus.completed = completed
  shareStatus.success = success
  uni.setStorageSync('shareStatus', shareStatus)
}

function handleShareFail() {
  updateShareStatus(true, false)
  hasReceivedPoints.value = false
  showSharePointsPopup.value = false
  uni.showToast({
    title: '分享失败，智汇值未领取',
    icon: 'none'
  })
}

function handleShareTimeout() {
  const shareStatus = uni.getStorageSync('shareStatus') || {}
  shareStatus.timeout = true
  uni.setStorageSync('shareStatus', shareStatus)
  handleShareSuccess()
}

function handleAppShareClick() {
  const shareStartTime = Date.now()
  
  uni.setStorageSync('shareStatus', {
    started: true,
    startTime: shareStartTime,
    completed: false
  })
  
  let userData = uni.getStorageSync('data') || {}
  if (!userData || Object.keys(userData).length === 0) {
    userData = uni.getStorageSync('userInfo') || {}
  }
  const inviteCodeVal = userData.inviteCode || ''
  
  const weixinMiniProgramUrl = `#小程序://AI智汇社/O4LfIwsXdb7omwv`
  
  const shareContent = {
    title: 'AI智汇社',
    summary: '快来加入AI智汇社，体验强大的AI功能！',
    href: weixinMiniProgramUrl,
    imageUrl: '/static/images/shar.jpg'
  }
  
  console.log('开始分享，分享内容:', shareContent)
  
  uni.getProvider({
    service: 'share',
    success: (res) => {
      console.log('可用的分享服务:', res.provider)
      
      if (res.provider && res.provider.length > 0) {
        const weixinProvider = res.provider.find(p => p === 'weixin')
        
        if (weixinProvider) {
          console.log('使用微信分享')
          shareToWeixin(shareContent)
        } else {
          console.log('未找到微信分享服务，使用系统分享')
          shareWithSystem(shareContent)
        }
      } else {
        console.log('没有可用的分享服务，使用系统分享')
        shareWithSystem(shareContent)
      }
    },
    fail: (err) => {
      console.error('获取分享服务失败:', err)
      shareWithSystem(shareContent)
    }
  })
}

function shareToWeixin(shareContent) {
  uni.share({
    provider: 'weixin',
    scene: 'WXSceneSession',
    type: 0,
    title: shareContent.title,
    summary: shareContent.summary,
    href: shareContent.href,
    imageUrl: shareContent.imageUrl,
    success: (res) => {
      console.log('微信分享成功:', res)
      uni.$emit('shareSuccess')
      handleShareSuccess()
    },
    fail: (err) => {
      console.error('微信分享失败:', err)
      console.log('尝试使用系统分享')
      shareWithSystem(shareContent)
    }
  })
}

function shareWithSystem(shareContent) {
  if (typeof plus !== 'undefined' && plus.share && plus.share.sendWithSystem) {
    console.log('使用原生系统分享')
    plus.share.sendWithSystem(
      {
        type: 0,
        title: shareContent.title,
        content: shareContent.summary,
        href: shareContent.href,
        pictures: [shareContent.imageUrl],
        thumbs: [shareContent.imageUrl]
      },
      (result) => {
        console.log('系统分享成功:', result)
        uni.$emit('shareSuccess')
        handleShareSuccess()
      },
      (error) => {
        console.error('系统分享失败:', error)
        uni.$emit('shareFail')
        handleShareFail()
      }
    )
  } else {
    console.error('不支持系统分享')
    uni.showToast({
      title: '当前环境不支持分享',
      icon: 'none'
    })
    uni.$emit('shareFail')
    handleShareFail()
  }
}

function updateUserInfo(userData) {
  if (userData && typeof userData === 'object') {
    uni.setStorageSync("data", userData)
    userinfo.value = {
      avatar: userData.avatar || '',
      nickname: userData.thirdPartyAccounts?.nickname || userData.nickname || ''
    }
    userIcon.value = userData.avatar || ''
    getLogin()
    uni.$emit('user-info-updated', userData)
    uni.$emit('userDataUpdated', userData)
    if (userData.userMargin || userData.tokenQuantity) {
      uni.$emit('updateTokenQuantity', userData)
    }
  }
}

function notifyAllPagesUpdateUserInfo(userData) {
  try {
    const pages = getCurrentPages()
    pages.forEach(page => {
      if (page && page.$vm) {
        if (typeof page.$vm.refreshUserInfo === 'function') {
          try {
            page.$vm.refreshUserInfo()
          } catch (e) {}
        }
        if (typeof page.$vm.updateUserInfo === 'function') {
          try {
            page.$vm.updateUserInfo(userData)
          } catch (e) {}
        }
        if (typeof page.$vm.userInfoAll === 'function') {
          try {
            page.$vm.userInfoAll()
          } catch (e) {}
        }
      }
    })
  } catch (e) {}
}

async function refreshUserInfo() {
  const userData = uni.getStorageSync("data")
  if (!userData || !userData.uuid) {
    return
  }
  
  const currentTime = Date.now()
  if (currentTime - lastRefreshTime.value < refreshInterval.value) {
    console.log('距离上次刷新时间过短，跳过本次刷新')
    return
  }
  
  lastRefreshTime.value = currentTime
}

function showQrCode() {
  showQrCodeModal.value = true
}

function hideQrCode() {
  showQrCodeModal.value = false
}

function handleLongPressQrCode() {
  // #ifdef APP-PLUS
  uni.showActionSheet({
    itemList: ['保存图片到相册', '保存并打开微信'],
    success: (res) => {
      if (res.tapIndex === 0) {
        saveQrCodeToAlbum()
      } else if (res.tapIndex === 1) {
        saveAndOpenWechat()
      }
    }
  })
  // #endif
  
  // #ifndef APP-PLUS
  uni.showToast({
    title: '仅APP端支持长按识别',
    icon: 'none'
  })
  // #endif
}

function saveQrCodeToAlbum() {
  uni.saveImageToPhotosAlbum({
    filePath: '/static/images/qewm.png',
    success: () => {
      uni.showToast({
        title: '保存成功',
        icon: 'success'
      })
    },
    fail: (err) => {
      if (err.errMsg.includes('auth deny')) {
        uni.showModal({
          title: '提示',
          content: '需要您授权保存相册',
          success: (modalRes) => {
            if (modalRes.confirm) {
              uni.openSetting()
            }
          }
        })
      } else {
        uni.showToast({
          title: '保存失败',
          icon: 'none'
        })
      }
    }
  })
}

function saveAndOpenWechat() {
  uni.saveImageToPhotosAlbum({
    filePath: '/static/images/qewm.png',
    success: () => {
      uni.showModal({
        title: '保存成功',
        content: '二维码已保存到相册，请打开微信扫一扫，从相册中选择二维码图片进行扫描',
        showCancel: false
      })
    },
    fail: (err) => {
      if (err.errMsg.includes('auth deny')) {
        uni.showModal({
          title: '提示',
          content: '需要您授权保存相册',
          success: (modalRes) => {
            if (modalRes.confirm) {
              uni.openSetting()
            }
          }
        })
      } else {
        uni.showToast({
          title: '保存失败',
          icon: 'none'
        })
      }
    }
  })
}

function agreePrivacy() {
  isFirstOpen.value = false
  uni.setStorageSync('isFirstOpen', false)
  showPrivacyPolicy.value = false
  uni.$emit('privacyAccepted')
}

function disagreePrivacy() {
  uni.showModal({
    title: '提示',
    content: '您必须同意隐私政策才能使用本应用',
    showCancel: false,
    success: () => {
      uni.exitMiniProgram()
    }
  })
}

function preventClose() {}

// ===================== Lifecycle Hooks =====================

// created() → top-level code
let userData = uni.getStorageSync('data')
if (!userData) {
  userData = uni.getStorageSync('userInfo')
}
let hasHistory = false

const systemInfoCreated = uni.getSystemInfoSync()
isAppEnvironment.value = systemInfoCreated.uniPlatform !== 'h5' && systemInfoCreated.uniPlatform !== 'mp-weixin'

uni.$on('updateTokenQuantity', (data) => {})

uni.$on('loginSuccess', (userDataArg) => {
  if (userDataArg) {
    updateUserInfo(userDataArg)
  }
  loadModelList()
})

nextTick(() => {
  preloadVoicePlugin()
})

// mounted()
onMounted(() => {
  loading.value = true
  
  uni.$on('showPushNotification', (options) => {
    console.log('ai_index 页面收到推送通知事件:', options)
    if (pushNotification.value && typeof pushNotification.value.show === 'function') {
      pushNotification.value.show(options)
    } else {
      console.warn('推送通知组件未初始化')
    }
  })
  setupTimer()
})

// beforeUnmount() - merged from two original beforeUnmount hooks
onBeforeUnmount(() => {
  uni.$off('updateTokenQuantity')
  uni.$off('loginSuccess')
  uni.$off('showPushNotification')
})

// onLoad()
onLoad(() => {
  console.log('========= AI初始化 =========', isFirstOpen.value)

  const privacyPolicyShown = uni.getStorageSync('privacyPolicyShown')
  if (privacyPolicyShown) {
    const systemInfo = uni.getSystemInfoSync()
    isAppEnvironment.value = systemInfo.platform !== 'h5' && systemInfo.platform !== 'mp-weixin'
    console.log('当前运行平台:', systemInfo.platform, '是否为APP环境:', isAppEnvironment.value)
  } else {
    isAppEnvironment.value = false
    console.log('用户未同意隐私政策，使用默认平台环境设置')
  }

  const cachedIsFirstOpen = uni.getStorageSync('isFirstOpen')
  console.log('缓存中的isFirstOpen状态:', cachedIsFirstOpen)
  
  isFirstOpen.value = cachedIsFirstOpen === false ? false : true
  
  if (isFirstOpen.value) {
    showPrivacyPolicy.value = true
    console.log('显示隐私政策弹窗，showPrivacyPolicy:', showPrivacyPolicy.value)
  }

  conversationMessages.value = []

  setTimeout(() => {
    if (conversationMessages.value.length === 0 && conversationComp.value) {
      conversationComp.value.handleInitialMessage()
    }
  }, 1000)
  try {
    const privacyPolicyShownVal = uni.getStorageSync('privacyPolicyShown')
    if (privacyPolicyShownVal && uni.getSystemInfoSync().platform !== 'h5') {
      uni.authorize({
        scope: 'scope.record',
        success: () => {},
        fail: () => console.log('麦克风权限未授权')
      })
    }
  } catch (error) {}
  home()
})

// onShow()
onShow(async () => {
  const systemInfo = uni.getSystemInfoSync()
  isIOS.value = systemInfo.platform === 'ios'
  const modelInfoStr = ((systemInfo.brand || '') + ' ' + (systemInfo.model || '')).toLowerCase()
  const badModels = ['redmi k80 ultra', '25060rk16c']
  disableCustomKeyboardLift.value = badModels.some(key => modelInfoStr.includes(key))
  console.log('[ai_index 机型]', {
    brand: systemInfo.brand,
    model: systemInfo.model,
    modelInfo: modelInfoStr,
    disableCustomKeyboardLift: disableCustomKeyboardLift.value,
    platform: systemInfo.platform
  })
  // #ifdef APP-PLUS
  adjustResizeSupported.value = false
  try {
    const wv = plus.webview.currentWebview()
    wv && wv.setStyle && wv.setStyle({ softinputMode: 'adjustNothing' })
  } catch (e) {
    try {
      const wv = plus.webview.currentWebview()
      wv && wv.setStyle && wv.setStyle({ softinputMode: 'adjustPan' })
    } catch (e2) {}
  }
  // #endif
  changePath.value = true
  
  initialWindowHeight.value = systemInfo.windowHeight
  console.log('📏 记录初始窗口高度:', initialWindowHeight.value, 'px')
  // #ifdef APP-PLUS
  try {
    const wv = plus.webview.currentWebview()
    const style = wv && wv.getStyle ? wv.getStyle() : null
    console.log('[softinputMode]', style?.softinputMode, 'windowHeight=', systemInfo.windowHeight)
  } catch (e) {}
  // #endif
  
  setTimeout(() => {
    textarea_int.value = false
  }, 500)
  
  nextTick(() => {
    preloadVoicePlugin(true)
  })
  
  let userDataOnShow = uni.getStorageSync('data')
  console.log('onShow - 从storage读取的userData:', userDataOnShow)
  console.log('onShow - userData.uuid:', userDataOnShow?.uuid)
  
  if (!userDataOnShow) {
    userDataOnShow = uni.getStorageSync('userInfo')
    console.log('onShow - 从userInfo读取的userData:', userDataOnShow)
  }
  
  const isNotLoggedIn = !userDataOnShow || 
    (typeof userDataOnShow === 'object' && Object.keys(userDataOnShow).length === 0) ||
    userDataOnShow === '' ||
    userDataOnShow === null ||
    userDataOnShow === undefined ||
    !userDataOnShow.uuid
  
  if (isNotLoggedIn) {
    isLogin.value = false
    console.log('未登录，跳转到登录页')
    
    uni.setStorageSync('returnUrl', '/pages/table/aiIndex/ai_index')
    
    uni.reLaunch({
      url: '/pages/login-app/login'
    })
    return
  }
  
  const shareStatus = uni.getStorageSync('shareStatus')
  const isSharing = uni.getStorageSync('isSharing')
  
  const shareCancelled = uni.getStorageSync('shareCancelled')
  
  if (shareCancelled) {
    uni.removeStorageSync('shareCancelled')
    uni.removeStorageSync('isSharing')
    uni.removeStorageSync('shareStatus')
  }
  
  if (isSharing && showSharePointsPopup.value && shareStatus && shareStatus.started) {
    uni.removeStorageSync('isSharing')
    setTimeout(() => {
      uni.$emit('shareSuccess')
    }, 500)
  }
  else if (shareStatus && shareStatus.started && !shareStatus.completed) {
    const currentTime = Date.now()
    const elapsedTime = currentTime - shareStatus.startTime
    
    if (elapsedTime > 30000) {
      handleShareTimeout()
    }
  }
  
  let userDataForLogin = uni.getStorageSync('data')
  if (!userDataForLogin) {
    userDataForLogin = uni.getStorageSync('userInfo')
  }
  getLogin()
  
  if (isLogin.value && userDataForLogin && userDataForLogin.uuid) {
    userinfo.value = {
      avatar: userDataForLogin.avatar || '',
      nickname: userDataForLogin.thirdPartyAccounts?.nickname || userDataForLogin.nickname || ''
    }
    userIcon.value = userDataForLogin.avatar || ''
  } else {
    userinfo.value = userDataForLogin && typeof userDataForLogin === 'object' ? {
      avatar: userDataForLogin.avatar || '',
      nickname: userDataForLogin.thirdPartyAccounts?.nickname || userDataForLogin.nickname || ''
    } : {
      avatar: '',
      nickname: ''
    }
  }
  let agentId = ""
  if (modelList.value.length > 0 && pitch.value >= 0 && modelList.value[pitch.value]) {
    agentId = modelList.value[pitch.value].id
    modelNameEN.value = modelList.value[pitch.value].name
    modelId.value = agentId
  } else {
    if (modelId.value) {
      agentId = modelId.value
    }
  }
  const webviewFileCache = uni.getStorageSync('webviewFileCache')
  if (webviewFileCache) {
    if (webviewFileCache && Array.isArray(webviewFileCache)) {
      webviewFileCache.forEach(item => {
        imgsList.value.push({ imgUrl: item.url, fileType: item.fileType, filename: item.fullFilename })
      })
    }
  }
    nextTick(() => {
      loadModelList()
    })
    
    setTimeout(async () => {
      getLogin()
      await checkLoginAndShowSharePoints()
    }, 1500)
})

// Watch
watch(modelName, (val) => {
  if (val) {
    modelConfigChangeData.value = {}
  }
})

watch(agent_content1, (newVal) => {
  nextTick(() => {
    const query = uni.createSelectorQuery()
    query.select('.agent-content1').boundingClientRect(rect => {
      if (rect) {
        uni.pageScrollTo({
          scrollTop: rect.height,
          duration: 300
        })
      }
    }).exec()
  })
})
</script>

<style lang="scss">
.filter {
  padding: 48rpx 0;
  box-sizing: border-box;
}

.container {
  min-height: 100vh;
  position: fixed;
  inset: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;

  .chat-container {
    flex: 1;
    padding: 20rpx 0;
    margin-bottom: 120rpx;
    box-sizing: border-box;
    height: calc(100vh - 240rpx);
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }

  .input-area {
    bottom: 0;
    left: 0;
    right: 0;
    padding: 20rpx;
    display: flex;
    align-items: center;
    gap: 20rpx;
    z-index: 2;

    input {
      flex: 1;
      height: 80rpx;
      padding: 0 30rpx;
      background-color: #E6F3FA;
      border-radius: 30rpx;
      font-size: 30rpx;
      color: #333;
    }

    .placeholder-style {
      color: #999;
      font-size: 28rpx;
      font-family: AlimamaFangYuanTi;
    }

    .send-btn {
      width: 100rpx;
      height: 100rpx;
      padding: 0;
      margin: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: transparent;
      border-radius: 30rpx;
      border: none;

      &::after {
        border: none;
      }

      .send-icon {
        width: 200rpx;
        height: 200rpx;
      }

      &:disabled {
        opacity: 0.6;
      }
    }
  }

}

.chu-box {
  width: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  position: fixed;
  color: rgb(0 0 0 / 0.4);
  bottom: 237rpx;
  font-family: AlimamaFangYuanTi;
  z-index: 1001;
}

.guanwang-box {
  width: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  position: fixed;
  color: rgb(0 0 0 / 0.4);
  bottom: 87px;
  font-family: AlimamaFangYuanTi;
  z-index: -1;

  .guanwangline {
    font-weight: normal;
    color: rgb(89 97 255 / 0.55);
    font-size: 30rpx;
    line-height: 55rpx;
  }

  .guanwangline1 {
    font-size: 20rpx;
    line-height: 20rpx;
  }

}

.conceal {
  width: 100%;
  height: 0rpx;
  display: flex;
  justify-content: center;

  .conceal-img {
    height: 15rpx;
    width: 40rpx;
    position: fixed;
    z-index: 1000;
    margin-top: 10rpx;
  }
}

.search-box {
  display: flex;
  align-items: flex-start;
  width: 100%;
  background-color: #fff;
  background-size: 100% 100%;
  background-repeat: no-repeat;
  border-radius: 30rpx;
  padding: 0 15rpx 0 25rpx;
  height: auto;
  box-sizing: border-box;
  flex-wrap: wrap;
  position: relative;
}

.search-icon {
  width: 40rpx;
  height: 40rpx;
  margin-right: 16rpx;
}

.search-input {
  flex: 1;
  border: none;
  background: transparent;
  font-size: 30rpx;
  color: rgb(0 0 0 / 0.6) !important;
  font-weight: 900;
  font-family: AlimamaFangYuanTi, sans-serif;
  outline: none;
}

.no-more-container {
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 16rpx 0;
  width: 90%;
}

.search-right {
  width: 119rpx;
  height: 68rpx;
  margin-right: 0;
  border-radius: 0 26px 26px 0;
  box-sizing: border-box;
  display: flex;
  justify-content: space-around;
  align-items: center;
  position: absolute;
  right: 0;
  bottom: 0;
}

.no-more-text {
  margin: 0 9rpx;
  color: #767676;
  font-family: AlimamaFangYuanTi;
  font-size: 24rpx;
  font-weight: normal;
  line-height: 20rpx;
}




.voice-bar-animation {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  width: 100%;
  height: 68rpx;
  flex: 1;
}

.bar {
  width: 2rpx;
  height: 2rpx;
  background-color: #007AFF;
}

.bar_ani {
  animation: bounce 1s infinite ease-in-out;
  animation-delay: calc(0.1s * var(--i));
}

@keyframes bounce {
  0%,
  100% {
    height: 2rpx;
  }

  50% {
    height: calc(20px + 20px * var(--i) / 15);
  }
}


.header {
  padding-top: 10rpx;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
}

.welcome {
  color: #000;
  margin-bottom: 10rpx;
  font-family: AlimamaFangYuanTi;
  font-size: 80rpx;
  font-weight: normal;
  line-height: 67rpx;
  letter-spacing: 0;
}

.brand {
  margin-bottom: 20rpx;
  align-self: flex-end;
  font-family: AlimamaFangYuanTi;
  font-size: 30rpx;
  font-weight: bold;
  text-align: center;
  letter-spacing: 0;
  font-variation-settings: "BEVL" 100, "opsz" auto;
  color: #8D83FF;

}

.logobox {
  padding-top: 20rpx;
  display: flex;
  justify-content: center;
  align-items: center;
}

.logo {
  width: 210rpx;
  height: 260rpx;
}

.input-wbox {
  width: 100%;
  display: flex;
  justify-content: center;
}


.titlebox {
  display: flex;
  justify-content: center;
  flex-direction: column;
  align-items: flex-end;
  position: relative;
}

.titlebox-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6rpx;
  margin-top: 10rpx;
  position: relative;
}

.titlebox-image {
  margin-top: 20rpx;
  width: 210rpx;
  height: 37rpx;
}

.titlebox-image1 {
  margin-top: 0;
  width: calc(100%);
  height: 66rpx;
}

.share-image {
  width: 100rpx;
  height: auto;
  z-index: 10;
  animation: pulse .5s infinite ease-in-out;
}

.top_box {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  padding-top: 30%;
}

.button-group {
  display: flex;
  justify-content: space-between;
  margin: 10rpx auto 8rpx;
  width: calc(100% - 100rpx);
  gap: 16rpx;
  bottom: 110rpx;
  left: 0;
  right: 0;
}

.button-group-box {
  display: flex;
  justify-content: space-between;
  margin: 10rpx auto 8rpx;
  width: calc(100% - 100rpx);
  gap: 16rpx;
  position: fixed;
  bottom: 170rpx;
  left: 0;
  right: 0;
  z-index: 1;
}

.toggle-button {
  width: calc(25% - 12rpx);
  border: 4rpx solid #fff;
  border-width: 4rpx 4rpx 0;
  padding: 0;
  margin: 0 8rpx 0 0;
  border-radius: 15rpx;
  font-size: 28rpx;
  transition: background-color 0.3s;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  background: linear-gradient(106deg, rgb(205 208 255 / 0.3) 0%, rgb(253 255 225 / 0.3) 100%);
  box-shadow: 0 0 6px 0 rgb(0 0 0 / 0.3);
  padding-left: 10rpx;
  -webkit-tap-highlight-color: transparent;
  tap-highlight-color: transparent;
  outline: none;
}

.toggle-button:last-child {
  margin-right: 0;
}

.button-group-box-inner {
  color: #000;
  font-size: 18rpx;
  font-family: AlimamaFangYuanTi;
}

.button-group-box-inner:first-child {
  color: rgb(0 0 0 / 0.6);
}

.custom-carousel-wrapper {
  border: 1px solid rgb(156 156 156 / 0.3);
  box-sizing: border-box;
  border-radius: 30rpx;
  overflow: hidden;
}

.carousel-img {
  width: 100%;
  height: 100%;
  border-radius: 30rpx;
  display: block;
}

.gradient-border {
  position: relative;
  border-radius: 30rpx;
  padding: 4rpx;
  background: linear-gradient(235deg, #D19EFF 6%, rgb(255 242 0 / 0.3) 31%, rgb(146 146 146 / 0.3) 52%, rgb(255 242 0 / 0.3) 73%, #CD96FF 93%);
  box-shadow: 0 0 16rpx rgb(0 0 0 / 0.08);
}

.carousel-inner {
  border-radius: 30rpx;
  overflow: hidden;
  background: #fff;
}

.search-input {
  font-family: AlimamaFangYuanTi;
}

.icon-button-group {
  display: flex;
  justify-content: space-around;
  margin: 0 auto;
  width: calc(100% - 100rpx);
  bottom: 0rpx;
  left: 0;
  right: 0;
  gap: 16rpx;
  transition: transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.icon-button {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 160rpx;
  height: 150rpx;
  background: linear-gradient(135deg, rgb(205 208 255 / 0.3) 3%, rgb(253 255 225 / 0.3) 103%);
  border-radius: 30rpx;
  padding: 20rpx 10rpx 0;
  transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  box-shadow: 0 0 4rpx rgb(0 0 0 / 0.3);
  box-sizing: border-box;
  border: 6rpx solid #fff;
  border-width: 6rpx 6rpx 0;
  transform: scale(1);
}

.icon-button:active {
  transform: scale(0.95);
  box-shadow: 0 0 2rpx rgb(0 0 0 / 0.2);
}

.icon-imagea {
  width: 70rpx;
  height: 70rpx;
  margin-bottom: 12rpx;
}

.icon-text {
  font-size: 20rpx;
  line-height: 40rpx;
  color: rgb(0 0 0 / 0.9);
  font-family: AlimamaFangYuanTi;
}

.search-box2-img {
  transition: transform 0.5s ease;
}

.rotate-icon {
  transform: rotate(45deg);
}

.toggle-button {
  display: flex;
  width: 130rpx;
  margin-right: 8rpx;
  flex: none;
}

.btn_clicked {
  box-shadow: 0 0 6px 0 #5BAFF3;
}

.chu-text {
  color: #333;
}

.chu_box {
  bottom: 224rpx !important;

  .chu-inner {
    justify-content: flex-start;

    .chu-content {
      width: 284rpx;
      max-height: 500rpx;
      height: 500rpx;
      justify-content: flex-start;

      .chu-row {
        height: 60rpx;
        flex: none;

        .chu-text {
          font-size: 24rpx !important;
        }

        .chu-icon {
          width: 23rpx !important;
          height: 18rpx !important;
        }
      }
    }
  }
}

.agent-content {
  height: auto;
  z-index: 999;
  width: calc(100% - 48rpx);
  box-sizing: border-box;
  margin-left: 32rpx;
  white-space: pre-wrap;
  word-wrap: break-word;
  word-break: break-all;
  font-family: AlimamaFangYuanTi;

}

.agent-content1 {
  position: fixed;
  height: 50vh !important;
  z-index: 1000;
  top: calc((100vh - 50vh) / 2);
  box-shadow: 0 0 10rpx 0 rgb(0 0 0 / 0.3);
  border-radius: 20rpx;
  overflow: hidden;
  backdrop-filter: blur(50rpx);
  background: linear-gradient(101deg, rgb(205 208 255 / 0.3) 4%, rgb(253 255 225 / 0.3) 104%);
  width: calc(100% - 80rpx);
}

.agent_content_box {
  position: relative;
  height: 100%;
  width: 100%;
  opacity: 0.4;
}

@keyframes rotate {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}

.agent_back {
  background: linear-gradient(to right, #D19EFF 20%, #F68B09 50%, #3EFFBE 80%);
  position: absolute;
  inset: -300rpx;
  animation: rotate 5s linear infinite;
}

.agent_content {
  position: absolute;
  inset: 4rpx;
  background-color: rgb(226 226 226);
  border-radius: 20rpx;
  overflow-y: auto;
  z-index: 9;
  width: calc(100% - 8rpx) !important;
  height: calc(100% - 8rpx) !important;
  box-sizing: border-box;
  margin: 0 !important;
  opacity: 1;
  padding: 20rpx !important;
}

.agent_content_title_top_img {
  width: 30rpx;
  height: 30rpx;
  margin-right: 10rpx;
}

.agent_content_title {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: flex-start;
}

.agent_content_title_top {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
}

.agent_content_con {
  width: 100%;
  overflow: hidden;
  white-space: initial;
  color: transparent;
  background-image: linear-gradient(to bottom, transparent 50%, rgb(0 0 0 / 0.5) 50%);
  -webkit-background-clip: text;
  background-clip: text;
}

.imgs_list_item {
  position: relative;
  width: auto;
  flex: none;

  .imgs_list_close {
    position: absolute;
    top: 0;
    right: 0;
    width: 30rpx;
    height: 30rpx;
    z-index: 1000;
    background-color: #fff;
    border-radius: 100px;
  }

  .imgs_list_item_img {
    width: 100%;
    height: 90rpx;
    display: block;
  }
}

.imgs_list {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-start;
  gap: 10rpx;
  left: 0;
  right: 0;
  z-index: 1;
  width: 100%;
  padding: 20rpx 0;
  box-sizing: border-box;
  overflow-x: auto;
  flex: none;
  border-bottom: 1px solid #D8D8D8;
}

.agent-content-item {
  white-space: pre-wrap;
  word-wrap: break-word;
  word-break: break-all;
  background-color: #fff;
  border-radius: 30rpx;
  opacity: 1;
  background: #F6F6F6;
  box-sizing: border-box;
  border: 1px solid #EEE;
  width: 100%;
  float: left;
  margin-top: 20rpx;
  padding: 20rpx;
  font-size: 22rpx;
  font-weight: normal;
  line-height: 28rpx;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  color: #333;
}

.agent-content-item-question {
  background: #9A99F3;
  box-sizing: border-box;
  border: 2rpx solid;
  border-image: linear-gradient(275deg, rgb(252 255 77 / 0.5) -32%, rgb(76 32 116 / 0) 5%, rgb(54 16 88 / 0) 98%, rgb(54 16 88 / 0.5) 129%) 2;
  box-shadow: 0 0 6px 0 rgb(0 0 0 / 0.3);
  border-radius: 15rpx;
  float: right;
  padding: 20rpx;
  font-size: 22rpx;
  font-weight: normal;
  line-height: 28rpx;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  font-variation-settings: "BEVL" 100, "opsz" auto;
  color: #FFF;
}

.compan {
  overflow: hidden;
  margin: 0;
  width: 100%;
  box-sizing: border-box;
}

.compan .icon-button-group {
  overflow-x: hidden !important;
  justify-content: flex-start !important;
  padding: 12rpx 10rpx;
  position: initial;
  width: calc(100% - 44rpx);
  gap: 18rpx;
}

@keyframes slideLeft {
  0% {
    transform: translateX(0);
  }

  100% {
    transform: translateX(-3750%);
  }
}

.compan .icon-button {
  flex: none;
  position: relative;
  animation: slideLeft 30s infinite linear;
}

.lianjie_con {
  width: 100%;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  padding: 0 20rpx;
  box-sizing: border-box;
  overflow-x: auto;
}

.lianjie_cona {
  bottom: 370rpx;
  left: 0;
  right: 0;
  z-index: 1;
}

.lianjie_list {
  display: block;
  flex: none;
  text-align: center;
}

.lianjie_icon {
  display: block;
  margin: 0 auto 10rpx;
  height: 160rpx;
}

.lianjie_text {
  color: #020009;
  font-size: 36rpx;
  text-align: center;
}

.icon-imageb {
  position: absolute;
  bottom: 14rpx;
  right: 4rpx;
  width: 22rpx;
  height: 22rpx;
}

.z_index_1000 {
  z-index: 1000;
}

.home_btns {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 22rpx;
  margin-top: -150rpx;

  .icon-button {
    width: auto;
    height: auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    background: rgb(0 0 0 / 0);
    border-radius: 0;
    padding: 0;
    box-shadow: 0 0 0 rgb(0 0 0 / 0.3);
    box-sizing: border-box;
    border: none;
    animation: none;
    padding-bottom: 10rpx;
  }

  .icon-button-group {
    width: auto;
    display: flex;
    flex-direction: row;
    overflow: visible !important;
    animation: slideLefta 20s infinite linear;

    .btn_join {
      margin-left: 0;
      margin-right: 0;
    }
  }
}

@keyframes slideLefta {
  0% {
    transform: translateX(0);
  }

  100% {
    transform: translateX(-50%);
  }
}

.btn_join {
  font-size: 30rpx;
  font-weight: bold;
  color: #000;
  text-transform: uppercase;
  padding: 10rpx 20rpx;
  border-radius: 8rpx;
  border: 4rpx solid #000;
  background: #fff;
  box-shadow: 3rpx 3rpx 5rpx 0 #6d6d6d;
  margin: 20rpx auto 0;
}

.btn_join_download {
  position: relative;
  width: auto;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 !important;
  padding: 4rpx 16rpx;
  white-space: nowrap;
  border: 2rpx solid #616161 !important;
  box-shadow: 3rpx 3rpx 5rpx 0 #6d6d6d;
  
  text {
    font-size: 26rpx !important;
    font-weight: 900 !important;
    color: #000;
  }
}

.btn_join_login {
  font-size: 48rpx;
  font-weight: bold;
  color: #000;
  text-transform: uppercase;
  padding: 0;
  border-radius: 15rpx;
  border: 4rpx solid #000;
  background: #fff;
  box-shadow: 0 1px 3px rgb(0 0 0 / 0.06);
  margin: 20rpx 35rpx 0;
  animation: bouncea 0.5s ease-in-out infinite;
  line-height: 62rpx !important;
  height: 70rpx !important;
}

.btn_join_tech_service {
  font-size: 28rpx;
  font-weight: bold;
  color: #000;
  text-transform: uppercase;
  border-radius: 10rpx;
  border: 2rpx solid #000;
  background: #fff;
  box-shadow: 0 1px 3px rgb(0 0 0 / 0.06);
  margin: 0;
  line-height: 44rpx !important;
  height: 44rpx !important;
  padding: 0 12rpx;
}

@keyframes bounce {
  0% {
    box-shadow: none;
    transform: translate(3rpx, 3rpx);
  }

  50% {
    box-shadow: 0 1px 3px rgb(0 0 0 / 0.06);
    transform: translate(0, 0);
  }

  100% {
    box-shadow: none;
    transform: translate(3rpx, 3rpx);
  }
}

@keyframes bouncea {
  0% {
    box-shadow: none;
    transform: translate(3rpx, 3rpx);
  }

  50% {
    box-shadow: 0 1px 3px rgb(0 0 0 / 0.06);
    transform: translate(0, 0);
  }

  100% {
    box-shadow: none;
    transform: translate(3rpx, 3rpx);
  }
}


.input-area-backa {
  background: #fff;
  padding: 10rpx 20rpx 20rpx;
  border-radius: 30rpx;
  overflow: hidden;
  width: calc(100% - 40rpx);
  box-sizing: border-box;
  margin: 10rpx auto;
  box-shadow: 0 0 16rpx -4rpx rgb(90 87 255 / 0.5);
  transition: box-shadow 0.3s ease;
  position: relative;
}



.hold {
  width: 400px;
  height: 75px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
}

.line {
  height: 6rpx;
  width: 6rpx;
  background-color: #000;
  border-radius: 5px;
  transition: all 1s;
}

@keyframes move {
  0% { top: 0; height: 65rpx; }
  100% { top: 15rpx; height: 25rpx; }
}

@keyframes move {
  0% { top: 0; height: 65rpx; }
  100% { top: 15rpx; height: 25rpx; }
}

@keyframes move {
  0% { top: 0; height: 65rpx; }
  100% { top: 15rpx; height: 25rpx; }
}

@keyframes move {
  0% { top: 0; height: 65rpx; }
  100% { top: 15rpx; height: 25rpx; }
}

.line1 { left: 8px; animation-delay: 0.25s; }
.line2 { left: 16px; animation-delay: 0.5s; }
.line3 { left: 24px; animation-delay: 0.75s; }
.line4 { left: 32px; animation-delay: 1s; }
.line5 { left: 40px; animation-delay: 1.25s; }
.line6 { left: 48px; animation-delay: 1.5s; }
.line7 { left: 56px; animation-delay: 1.75s; }
.line8 { left: 64px; animation-delay: 2s; }
.line9 { left: 72px; animation-delay: 2.25s; }
.line10 { left: 80px; animation-delay: 2.5s; }
.line11 { left: 88px; animation-delay: 2.75s; }
.line12 { left: 96px; animation-delay: 3s; }
.line13 { left: 104px; animation-delay: 3.25s; }
.line14 { left: 112px; animation-delay: 3.5s; }
.line15 { left: 120px; animation-delay: 3.75s; }
.line16 { left: 128px; animation-delay: 4s; }
.line17 { left: 136px; animation-delay: 4.25s; }
.line18 { left: 144px; animation-delay: 4.5s; }
.line19 { left: 152px; animation-delay: 4.75s; }
.line20 { left: 160px; animation-delay: 5s; }
.line21 { left: 168px; animation-delay: 5.25s; }
.line22 { left: 176px; animation-delay: 5.5s; }
.line23 { left: 184px; animation-delay: 5.75s; }
.line24 { left: 192px; animation-delay: 6s; }
.line25 { left: 200px; animation-delay: 6.25s; }
.line26 { left: 208px; animation-delay: 6.5s; }
.line27 { left: 216px; animation-delay: 6.75s; }
.line28 { left: 224px; animation-delay: 7s; }
.line29 { left: 232px; animation-delay: 7.25s; }
.line30 { left: 240px; animation-delay: 7.5s; }
.line31 { left: 248px; animation-delay: 7.75s; }
.line32 { left: 256px; animation-delay: 8s; }
.line33 { left: 264px; animation-delay: 8.25s; }
.line34 { left: 272px; animation-delay: 8.5s; }
.line35 { left: 280px; animation-delay: 8.75s; }
.line36 { left: 288px; animation-delay: 9s; }
.line37 { left: 296px; animation-delay: 9.25s; }
.line38 { left: 304px; animation-delay: 9.5s; }
.line39 { left: 312px; animation-delay: 9.75s; }
.line40 { left: 320px; animation-delay: 10s; }
.line41 { left: 328px; animation-delay: 10.25s; }
.line42 { left: 336px; animation-delay: 10.5s; }
.line43 { left: 344px; animation-delay: 10.75s; }
.line44 { left: 352px; animation-delay: 11s; }
.line45 { left: 360px; animation-delay: 11.25s; }
.line46 { left: 368px; animation-delay: 11.5s; }
.line47 { left: 376px; animation-delay: 11.75s; }
.line48 { left: 384px; animation-delay: 12s; }
.line49 { left: 392px; animation-delay: 12.25s; }
.line50 { left: 400px; animation-delay: 12.5s; }

.material-cards-wrap {
  padding: 12rpx 20rpx 8rpx;
  border-bottom: 1rpx solid #f0f0f0;
  background: #fafafa;
}

.material-cards-scroll {
  width: 100%;
  white-space: nowrap;
}

.material-cards-list {
  display: inline-flex;
  flex-direction: row;
  align-items: stretch;
  gap: 16rpx;
  padding: 4rpx 0;
}

.material-card-item {
  position: relative;
  flex-shrink: 0;
  width: 200rpx;
  min-height: 100rpx;
  border-radius: 12rpx;
  overflow: hidden;
  background: #fff;
  border: 1rpx solid #eee;
  box-shadow: 0 2rpx 8rpx rgb(0 0 0 / 0.06);
}

.material-card-close {
  position: absolute;
  top: 6rpx;
  right: 6rpx;
  width: 36rpx;
  height: 36rpx;
  z-index: 2;
  background: #fff;
  border-radius: 50%;
}

.material-card-body {
  padding: 24rpx 12rpx 12rpx;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  box-sizing: border-box;
}

.material-card-text .material-card-title,
.material-card-img .material-card-title,
.material-card-video .material-card-title,
.material-card-audio .material-card-title {
  font-size: 24rpx;
  color: #333;
  font-weight: bold;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  width: 100%;
  margin-bottom: 6rpx;
}

.material-card-preview {
  font-size: 22rpx;
  color: #999;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  width: 100%;
}

.material-card-thumb {
  width: 100%;
  height: 80rpx;
  border-radius: 8rpx;
  margin-bottom: 8rpx;
  background: #f0f0f0;
}

.material-card-body.material-card-img,
.material-card-body.material-card-video {
  padding-top: 12rpx;
}

.input_box_content {
  background-color: #fff;
  left: 0;
  right: 0;
  transition: bottom 0.3s ease;
  padding-bottom: calc(env(safe-area-inset-bottom) + 10rpx);
}

.page_agent_can {
  flex: none;
  width: 100%;
  border-top: 1px solid #D8D8D8;
}

.page_agent_list {
  display: flex;
  padding: 5rpx 0;
  justify-content: space-between;
}

.page_can_tit {
  color: #000;
  min-width: 5em;
  line-height: 40rpx;
  margin-right: 10rpx;
  font-family: AlimamaFangYuanTi !important;
  font-size: 20rpx;
}

.page_can_con input.page_can_input {
  background-color: rgb(218 218 218 / 0.37);
  height: 40rpx;
  border-radius: 8rpx;
  font-size: 22rpx;
  width: 50vw;
  font-family: AlimamaFangYuanTi !important;
}

textarea.search-input {
  -webkit-appearance: none;
  border-radius: 0;
  background-color: transparent;
  border: none;
  outline: none;
  resize: none;
  padding: 0;
  margin: 0;
  box-shadow: none;
  -webkit-box-shadow: none;
}


.drawer {
  background-color: #fff;
  border-radius: 30rpx;
  height: calc(100%);
  width: calc(100%);
  padding: 0 14rpx;
  box-sizing: border-box;
  position: relative;
}

.drawer-header {
  position: relative;
  height: auto;
  padding-top: 0;

  .drawer-image {
    width: 100rpx;
    height: 100rpx;
    margin: 54rpx auto 0;
    display: block;
  }

  .drawer-image1 {
    width: 100rpx;
    height: 100rpx;
    margin: 10rpx auto 0;
    display: block;
  }

  .drawer-image2 {
    width: 100rpx;
    height: 100rpx;
    margin: 10rpx auto 0;
    display: block;
  }

  .drawer-close {
    position: absolute;
    top: 40rpx;
    right: 40rpx;
    width: 40rpx;
    height: 40rpx;

    image {
      width: 100%;
      height: 100%;
    }
  }
}

.drawer-menu {
  margin-top: 0;
  padding: 0;
  height: calc(100% - 422rpx);
  overflow: hidden scroll;
  margin-right: -16rpx;
}

.date-group {
  margin-bottom: 20rpx;
}

.date-title {
  font-size: 24rpx;
  padding: 10rpx 23rpx;
  color: #3D3D3D;
}

.menu-item {
  display: flex;
  align-items: center;
  padding: 20rpx 23rpx;
  justify-content: space-between;
  position: relative;
  box-sizing: border-box;
  overflow: hidden;
}

.menu_remove {
  position: absolute;
  right: -60rpx;
  transition: transform 0.3s ease;
}

.menu-icon {
  width: 40rpx;
  height: 40rpx;
  margin-right: 10rpx;
}

.menu-text {
  font-size: 30rpx;
  color: #000;
  width: 8em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.menu_text {
  color: #0d11fc;
  font-weight: bold;
}

.drawer-header {
  .logobox {
    padding: 9rpx 0;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .logo {
    width: 66rpx;
    height: 66rpx;
    margin-right: 12rpx;
  }

  .input-wbox {
    width: 100%;
    display: flex;
    justify-content: center;
  }


  .titlebox {
    display: flex;
    justify-content: center;
    flex-direction: column;
    align-items: center;
    position: relative;
  }

  .titlebox-image {
    margin-top: 0;
    width: 160rpx;
    height: 37rpx;
  }

  .titlebox-image1 {
    margin-top: 8rpx;
    width: 162rpx;
    height: 66rpx;
  }

  .share-image {
    position: absolute;
    right: 0;
    top: 0;
    width: 100rpx;
    height: auto;
    z-index: 10;
    animation: pulse 2s infinite ease-in-out;
  }

  .top_box {
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    padding-top: 30%;
  }

}

.label_title {
  font-size: 28rpx;
  flex: none;
  line-height: 56rpx;
  color: #000;
  padding: 4rpx 23rpx;
  position: relative;
}

.label_title:first-child {
  padding-top: 9rpx;
}

.label_title::after {
  content: "";
  left: 23rpx;
  right: 23rpx;
  height: 1px;
  bottom: 0;
  background-color: #D8D8D8;
  position: absolute;
  display: none;
}

.label_content {
  position: relative;
}

.label_content::after {
  content: "";
  left: 0;
  right: 0;
  height: 1px;
  bottom: 0;
  background-color: rgb(0 0 0 / 0.05);
  position: absolute;
}

.label_title image {
  display: block;
  float: left;
  margin-right: 22rpx;
}

.agent-content_line {
  position: fixed;
  bottom: 315rpx;
  left: 20rpx;
  width: 80px;
  height: 608rpx;
  z-index: 1001;
  border-left: 4rpx solid #CD96FF;
  border-top: 4rpx solid #CD96FF;
  border-top-left-radius: 20px;
}

.agent_content_topLine {
  position: absolute;
  width: 16rpx;
  height: 16rpx;
  background: #fff;
  border-radius: 50%;
  bottom: 0;
  left: -10rpx;
  animation: moveBall 2s infinite linear;
  z-index: 1001;
}

@keyframes moveBall {
  0% {
    transform: translate(0, 0);
  }

  70% {
    transform: translate(0, -584rpx);
  }

  75% {
    transform: translate(20rpx, -602rpx);
  }

  100% {
    transform: translate(80px, -602rpx);
  }
}

@keyframes pulse {
  0% {
    transform: scale(1);
  }

  50% {
    transform: scale(1.1);
  }

  100% {
    transform: scale(1);
  }
}

.drawer_menu {
  padding: 15rpx 14rpx 25rpx;
  box-sizing: border-box;
  display: flex;
  justify-content: space-between;
  border-bottom: 1px solid #D8D8D8;
}

.drawer_menu_label {
  height: 60rpx;
  width: 60rpx;
  display: block;
}

.back_index_btn_bor {
  display: flex;
}

.back_index_btn_bor::after {
  content: "";
  clear: both;
  display: block;
}

.back_index_btn {
  margin: 0 auto;
  width: auto;
  border: 1px solid #000;
  border-radius: 15rpx;
  padding: 10rpx 14rpx;
  display: flex;
  font-size: 32rpx;
  line-height: 33rpx;
  float: left;
  color: rgb(0 0 0 / 0.7);
  background: #D3E9FF;
}

.back_index_icon {
  display: block;
  float: left;
  width: 33rpx;
  height: 33rpx;
  margin-right: 10rpx;
}

.bottom_userInfo {
  display: flex;
  padding: 12rpx 13rpx;
  box-sizing: border-box;
  border-top: 1px solid rgb(239 239 239 / 0.18);
  font-size: 32rpx;
  line-height: 48rpx;
  color: #000;
  font-weight: bold;
  margin-top: 13rpx;
  position: absolute;
  bottom: 0;
  left: 14rpx;
  right: 14rpx;
  justify-content: space-between;
}

  .set_btn {
    width: 48rpx;
    height: 44rpx;
    float: right;
    flex: none;
  }


.user_avatar {
  width: 48rpx;
  height: 48rpx;
  border-radius: 8rpx;
  margin-right: 6rpx;
  flex: none;
  float: left;
  display: block;
}

.switch-container {
  margin-top: -10rpx;
  overflow: hidden;
}

.user_nickname {
  display: block;
  white-space: nowrap;
}

.drawer_remove_chat {
  font-size: 24rpx;
  color: #3D3D3D;
  position: absolute;
  right: 14rpx;
  padding: 12rpx 0;
}

.menu-item_active {
  background-color: #D3E9FF;
  border-radius: 15rpx 0 0 15rpx;
}

.bottom_anquan {
  padding-bottom: env(safe-area-inset-bottom);
  padding-bottom: constant(safe-area-inset-bottom);
}

.posi_angeetlis {
  position: relative;
}

.login_back {
  position: fixed;
  inset: 0;
  z-index: 99999999;
  opacity: 0;
}

.login-btn-new {
  background-color: transparent;
  padding: 0;
  margin: 0;

  .btn_join {
    margin: 20rpx 35rpx;
    height: 86rpx;
    line-height: 78rpx;
    box-sizing: border-box;
    padding-top: 0;
    padding-bottom: 0;
    font-size: 48rpx;
    width: 316rpx;
  }
}

.icon-button-group {
  display: flex;
  justify-content: flex-start;
  gap: 16rpx;
  padding: 0 20rpx;
  box-sizing: border-box;
}

.icon-button {
  flex: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.btn_join {
  white-space: nowrap;
}

.tishi_content{
  color: #f00;
  text-align: center;
  margin-bottom: -20rpx;
  font-size: 38rpx;
  font-weight: bold;
}

.imgs_list_closea {
  position: absolute;
  top: 10rpx;
  right: 10rpx;
  width: 50rpx;
  height: 50rpx;
  z-index: 1000;
  background-color: #fff;
  border-radius: 100px;
}

.btn_model{
  justify-content: space-between;

  view{
    flex: 1;
    text-align: center;
    border: 1px solid #000;
    border-radius: 8rpx;
    margin: 0 20rpx;
  }
  
  .active {
    color: #000;
    font-weight: bold;
  }
}

.model-type-btn {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 20rpx;
  flex-shrink: 0;
  width: 200rpx;
  height: 60rpx;
}

.btn-bg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
  box-shadow: none;
  filter: none;
}

.btn-content-wrapper {
  position: relative;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-content {
  width: 140rpx;
  height: 50rpx;
}

.btn-arrow {
  position: relative;
  z-index: 3;
  width: 20rpx;
  height: 20rpx;
  margin-left: 6rpx;
  transition: transform 0.3s ease;
}

.btn-arrow.rotate {
  transform: rotate(180deg);
}

.skills-popup {
  position: absolute;
  bottom: 100%;
  left: 0;
  width: 600rpx;
  max-height: 500rpx;
  background-color: #fff;
  border-radius: 16rpx;
  box-shadow: 0 4rpx 20rpx rgb(0 0 0 / 0.15);
  z-index: 1000;
  overflow: hidden;
  margin-bottom: 10rpx;
  animation: popupFadeIn 0.2s ease-out;
}

@keyframes popupFadeIn {
  from {
    opacity: 0;
    transform: translateY(10rpx);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.skills-popup-header {
  padding: 20rpx;
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
  border-bottom: 1px solid #f0f0f0;
  background-color: #fafafa;
}

.skills-popup-content {
  max-height: 400rpx;
  padding: 10rpx;
}

.skills-empty {
  padding: 60rpx 20rpx;
  text-align: center;
  color: #999;
  font-size: 28rpx;
}

.skills-item {
  display: flex;
  align-items: center;
  padding: 20rpx;
  border-bottom: 1px solid #f5f5f5;
  transition: background-color 0.2s ease;
}

@keyframes itemFadeIn {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

.skills-item:last-child {
  border-bottom: none;
}

.skills-item:active {
  background-color: #f5f5f5;
}

.skills-item-icon {
  width: 160rpx;
  height: 60rpx;
  border-radius: 12rpx;
  margin-right: 20rpx;
  flex-shrink: 0;
  background-color: #f0f0f0;
}

.skills-item-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.skills-item-name {
  font-size: 30rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 8rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.skills-item-desc {
  font-size: 24rpx;
  color: #999;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.skills-loading,
.skills-nomore {
  padding: 30rpx;
  text-align: center;
  font-size: 26rpx;
  color: #999;
}

.skills-loading {
  color: #5a85ff;
}



.announcement-bar {
  width: calc(100% - 40rpx);
  height: 60rpx;
  border-radius: 15rpx;
  overflow: hidden;
  position: relative;
  display: flex;
  align-items: center;
  padding: 4rpx 15rpx 4rpx 6rpx;
  box-sizing: border-box;
  margin: 0 20rpx 30rpx;
  border: 1px solid #f0f0f0;
  box-shadow: 0 1px 3px rgb(0 0 0 / 0.06);
}

.announcement-icon {
  width: 48rpx;
  height: 48rpx;
  margin-right: 12rpx;
}

.scroll-container {
  flex: 1;
  overflow: hidden;
  position: relative;
  height: 40rpx;
  display: flex;
  align-items: center;
}

.announcement-text-wrapper {
  position: absolute;
  display: flex;
  align-items: center;
  white-space: nowrap;
  animation: scroll-left 8s linear infinite;
}

.announcement-text {
  font-family: AlimamaFangYuanTi !important;
  font-size: 28rpx;
  font-weight: bold;
  color: #06c;
  white-space: nowrap;
  padding-right: 10rpx;
}

.announcement-text-content {
  font-family: AlimamaFangYuanTi !important;
  font-size: 28rpx;
  font-weight: bold;
  color: #5489ff;
  white-space: nowrap;
  padding-right: 20rpx;
}

@keyframes scroll-left {
  0% {
    transform: translateX(0);
  }

  100% {
    transform: translateX(-50%);
  }
}


.share-points-popup {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
}

.popup-mask {
  position: absolute;
  inset: 0;
  background-color: rgb(0 0 0 / 0.5);
}

.popup-content {
  position: relative;
  z-index: 10;
  animation: flipIn 1s linear;
  transform-style: preserve-3d;
  backface-visibility: hidden;
}

@keyframes flipIn {
  0% {
    transform: perspective(400px) rotateY(0deg);
    opacity: 1;
  }

  49% {
    transform: perspective(400px) rotateY(-100deg);
  }

  51% {
    transform: perspective(400px) rotateY(-260deg);
  }

  100% {
    transform: perspective(400px) rotateY(-360deg);
    opacity: 1;
  }
}

.popup-close {
  position: absolute;
  top: 20rpx;
  right: 20rpx;
  font-size: 40rpx;
  color: #999;
  width: 60rpx;
  height: 60rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.popup-title {
  font-size: 36rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 10rpx;
  text-align: left;
}

.popup-tips{
  color: #666;
  display: block;
  margin-bottom: 20rpx;
}

.popup-image-container {
  width: 100%;
  display: flex;
  justify-content: center;
  margin-bottom: 40rpx;
}

.popup-image {
  width: 400rpx;
  height: 400rpx;
}

.popup-share-btn {
  width: 300rpx;
  height: 80rpx;
  background-color: transparent;
  color: transparent;
  border-radius: 15rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32rpx;
  font-weight: bold;
  border: none;
  position: absolute;
  bottom: 40rpx;
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
}

.popup-content .drawer-header {
  width: 100%;
  display: flex;
  justify-content: flex-start;
  align-items: center;
  margin-bottom: 20rpx;
}

.popup-content .logobox {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  width: 100%;
}

.popup-content .titlebox {
  display: flex;
  justify-content: flex-start;
  flex-direction: column;
  align-items: flex-start;
}

.gemini-free-banner {
  text-align: center;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  margin-top: 20rpx;
  font-weight: bold;
  font-size: 32rpx;
  position: relative;
  gap: 12rpx;
}

.gemini-free-banner .banner-logo {
  width: 48rpx;
  height: 48rpx;
  flex-shrink: 0;
}

.gemini-free-banner text {
  background: linear-gradient(135deg, #FF6B6B 0%, #FFD93D 25%, #6BCF7F 50%, #4D96FF 75%, #9B59B6 100%);
  background-size: 200% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  color: transparent;
  animation: gradientFlow 3s ease-in-out infinite;
  letter-spacing: 2rpx;
  text-shadow: 0 0 20rpx rgb(255 107 107 / 0.3);
}

.gemini-free-banner::after {
  content: '';
  position: absolute;
  bottom: -4rpx;
  left: 50%;
  transform: translateX(-50%);
  width: 60%;
  height: 2rpx;
  background: linear-gradient(90deg, transparent, #FF6B6B, #FFD93D, #4D96FF, #9B59B6, transparent);
  opacity: 0.6;
  border-radius: 2rpx;
}

@keyframes gradientFlow {
  0%, 100% {
    background-position: 0% 50%;
  }

  50% {
    background-position: 100% 50%;
  }
}

.privacy-modal {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
}

.privacy-mask {
  position: absolute;
  inset: 0;
  background-color: rgb(0 0 0 / 0.5);
}

.privacy-content {
  position: relative;
  width: 600rpx;
  max-height: 80vh;
  background: #fff;
  border-radius: 20rpx;
  padding: 40rpx;
  display: flex;
  flex-direction: column;
  z-index: 10;
  overflow: hidden;
}

.privacy-title {
  font-size: 36rpx;
  font-weight: bold;
  color: #333;
  text-align: center;
  margin-bottom: 30rpx;
}

.privacy-text {
  flex: 1;
  overflow-y: auto;
  margin-bottom: 30rpx;
  font-size: 28rpx;
  line-height: 1.8;
  color: #666;
}

.privacy-text text {
  display: block;
  margin-bottom: 20rpx;
}

.privacy-buttons {
  display: flex;
  justify-content: space-between;
  gap: 20rpx;
}

.privacy-btn {
  flex: 1;
  height: 80rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10rpx;
  font-size: 32rpx;
  font-weight: bold;
  cursor: pointer;
}

.privacy-btn.disagree {
  background: #f5f5f5;
  color: #999;
}

.privacy-btn.agree {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
}


.qr-code-modal {
  position: fixed;
  inset: 0;
  background: rgb(0 0 0 / 0.7);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
}

.qr-code-content {
  background: #fff;
  border-radius: 20rpx;
  padding: 50rpx 40rpx 20rpx;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
}
</style>