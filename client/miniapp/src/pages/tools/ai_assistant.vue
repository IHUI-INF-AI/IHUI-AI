<template>
  <view class="container" style="padding: 0" @click="handleClick">
    <!-- 导航栏 -->
    <view style="opacity: 0;">
      <navigation-bars :viscosity="false" color="#171717" @back="backPage" font-size-30 :title="page_title" :image="'/static/images/back.svg'" />
    </view>
    <view style="position: fixed; top: 0; left: 0; right: 0; z-index: 999;">
      <navigation-bars :viscosity="false" color="#171717" @back="backPage" font-size-30 :title="page_title" :image="'/static/images/back.svg'" />
    </view>

    <!-- 思考过程弹窗 -->
    <view v-show="agent_con1" style="position: fixed; z-index: 1000; inset: 0; background: rgb(0 0 0 / 0.3);"></view>
    <view v-show="agent_con1" class="agent-content agent-content1" style="padding-bottom: 4rpx;">
      <view class="agent_content_box">
        <view class="agent_back"></view>
        <scroll-view class="agent_content" scroll-y="true" :scroll-top="scrollTopVal">
          <view class="agent_content_title">
            <view class="agent_content_title_top" style="padding-top: 20rpx;">
              <image src="/static/images/sikao.png" class="agent_content_title_top_img" mode="widthFix"></image>
              <text class="agent_content_title_top_text" style="color: #000;">正在极速生成中</text>
            </view>
            <view class="thinking-progress-container" style="position: relative;" v-if="showThinkingProgress">
              <view class="thinking-progress-bar" :style="{ width: thinkingProgress + '%' }"></view>
              <view style="position: absolute; left: 50%; line-height: 36rpx; transform: translateX(-50%); color: #000; top: 0;">{{ Math.floor(thinkingProgress) }}%</view>
            </view>
            <view class="agent_content_con" style="color: #666 !important;">
              <text style="color: #0018ff;" v-if="displayedAgentContent1.length == 0">Tips：您可以先点击右上角三个点浮窗小程序，过一会儿再回来哟~</text>
              {{ agent_content1 }}
            </view>
          </view>
        </scroll-view>
      </view>
    </view>

    <!-- 主内容区 -->
    <scroll-view class="top_box" scroll-y="true" :scroll-top="scrollTop">
      <!-- 引导说明 -->
      <view class="tishi_block" @click="tishiHandle">
        <image :src="tishi_show ? '/static/images/close_agent.png' : '/static/images/tishi_icon.png'" mode="widthFix" class="tishi_block_img"></image>
        <text class="tishi_block_text">{{ tishi_show ? '关闭' : '查看' }}智能体引导说明</text>
      </view>

      <view v-show="tishi_show" style="margin-top: 0; padding: 20rpx 0 0; margin-bottom: 20rpx;">
        <intelligent-assistant :concealxiaBelow="false"></intelligent-assistant>
      </view>

      <view class="tishi_box" v-if="tishi_show && tishi_content != ''">
        <view class="tishi_box_back">
          <view class="tishi_title">
            <image src="/static/images/tishi.png" mode="widthFix" class="tishi_title_img"></image>
            <text class="tishi_title_text">小方需要您输入以下相关内容，以便于更精准的解决您的需求</text>
          </view>
          <view class="tishi_content">
            <view class="tishi_content_item" v-html="tishi_content"></view>
          </view>
        </view>
      </view>

      <!-- 对话列表 -->
      <view class="agent-content question_box">
        <template v-for="(item, index) in question_list" :key="index">
        <view v-if="agent_content_list[index] != undefined">
          <view v-if="item.imgsLista.length > 0" class="agent-content-item-question" style="margin-top: 20rpx;">
            <image 
              class="agent-question-item-img" 
              v-for="(imgUrl, imgIndex) in item.imgsLista" 
              :key="imgIndex" 
              :src="imgUrl.imgUrl" 
              mode="widthFix" 
              style="width: 100rpx; height: 100rpx; display: block; margin-bottom: 10rpx;"
            ></image>
          </view>
          <view style="height: 1rpx; width: 100%; clear: both;"></view>
          <view class="question-container" style="width: 100%; display: flex; justify-content: flex-end; align-items: flex-end;">
            <view class="agent-content-item-question">{{ item.question }}</view>
          </view>
          <view class="agent-content-item">
            <view class="content_agent_nei" selectable="true" user-select="text">
              <text v-if="agent_content_list[index].content">{{ agent_content_list[index].content }}</text>
            </view>
          </view>
        </view>
        </template>
      </view>
    </scroll-view>

    <!-- 输入区域 -->
    <view class="bottom_box">
      <InputArea 
        :prompt="prompt" 
        @update:prompt="updatePrompt"
        :showFile="true"
        :imgsList="imgsList"
        @remove-image="removeImage"
        @send-message="handleSendMessage"
        :isShowIcon="isShowIcon"
        :isLoading="loading"
        :placeholderStyle="'color:#B8B8D0;font-size: 30rpx;'"
        :inputFocused="inputFocused"
        @input-focus="inputFocus"
        @input-blur="inputBlur"
        :modelName="modelName"
        :showSend="true"
        ref="inputArea"
      />
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, nextTick } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import request from '@/utils/service/index.js'
import NavigationBars from '@/components/navigation-bars/index.vue'
import InputArea from '@/components/InputArea.vue'

// 数据
const page_title = ref('AI助手')
const agentId = ref('')
const prompt = ref('')
const loading = ref(false)
const inputFocused = ref(false)

// 对话数据
const question_list = ref<any[]>([])
const agent_content_list = ref<any[]>([])
const agent_content1 = ref('')
const displayedAgentContent1 = ref('')

// 思考过程
const agent_con1 = ref(false)
const showThinkingProgress = ref(false)
const thinkingProgress = ref(0)
const scrollTopVal = ref(0)

// 引导说明
const tishi_show = ref(false)
const tishi_content = ref('')

// 图片列表
const imgsList = ref<any[]>([])
const isShowIcon = ref(true)

// 模型信息
const modelName = ref('')

// 滚动相关
const scrollTop = ref(0)
const topBoxHeight = ref('calc(100vh - 200rpx)')

onLoad((options: any) => {
  if (options.modelName) {
    modelName.value = options.modelName
    page_title.value = options.modelName
  }
  agentId.value = options.agentId || ''
})

// 更新提示词
function updatePrompt(value: string) {
  prompt.value = value
}

// 移除图片
function removeImage(index: number) {
  imgsList.value.splice(index, 1)
}

// 发送消息
async function handleSendMessage() {
  if (!prompt.value && imgsList.value.length === 0) return

  // 添加问题到列表
  question_list.value.push({
    question: prompt.value,
    imgsLista: imgsList.value.map((img: any) => ({ imgUrl: img.url || img })),
  })

  // 清空输入
  prompt.value = ''
  imgsList.value = []

  // 显示思考过程
  agent_con1.value = true
  showThinkingProgress.value = true

  // 调用 AI 接口
  const userMessage = question_list.value[question_list.value.length - 1]?.question || ''
  loading.value = true
  try {
    const res: any = await request({
      url: '/chat/message',
      method: 'POST',
      header: { 'content-type': 'application/json' },
      data: { message: userMessage, agent_id: agentId.value },
      base: 1,
    })
    const replyData = res && res.data
    const replyContent = (replyData && (replyData.content || replyData.message || replyData.reply)) || (typeof replyData === 'string' ? replyData : '') || ''
    agent_content_list.value.push({
      content: replyContent,
      content1: '',
      imgUrlList: [],
      total_tokens: (replyData && replyData.total_tokens) || 0,
      isHaveSikao: false,
    })
  } catch (error) {
    console.error('调用AI接口失败:', error)
    uni.showToast({ title: '调用AI接口失败', icon: 'none' })
    agent_content_list.value.push({
      content: '回复失败，请稍后重试',
      content1: '',
      imgUrlList: [],
      total_tokens: 0,
      isHaveSikao: false,
    })
  } finally {
    loading.value = false
    agent_con1.value = false
    showThinkingProgress.value = false
    scrollToBottom()
  }
}

// 滚动到底部
function scrollToBottom() {
  nextTick(() => {
    scrollTop.value = scrollTop.value + 1
  })
}

// 输入焦点
function inputFocus() {
  inputFocused.value = true
}

function inputBlur() {
  inputFocused.value = false
}

// 点击事件
function handleClick() {
  // 点击事件
}

// 引导说明
function tishiHandle() {
  tishi_show.value = !tishi_show.value
}

// 返回上一页
function backPage() {
  uni.navigateBack()
}
</script>

<style lang="scss" scoped>
.container {
  min-height: 100vh;
  background: #f5f5f5;
  display: flex;
  flex-direction: column;
}

.top_box {
  flex: 1;
  padding: 20rpx;
  padding-top: calc(var(--app-top-bar-height) + var(--app-nav-bar-height));
}

.tishi_block {
  display: flex;
  align-items: center;
  padding: 16rpx 0;
}

.tishi_block_img {
  width: 32rpx;
  height: 32rpx;
  margin-right: 10rpx;
}

.tishi_block_text {
  font-size: 26rpx;
  color: #666;
}

.tishi_box {
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;
}

.tishi_title {
  display: flex;
  align-items: center;
  margin-bottom: 16rpx;
}

.tishi_title_img {
  width: 40rpx;
  height: 40rpx;
  margin-right: 10rpx;
}

.tishi_title_text {
  font-size: 28rpx;
  color: #333;
  font-weight: bold;
}

.tishi_content {
  font-size: 26rpx;
  color: #666;
  line-height: 1.6;
}

.question_box {
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
}

.agent-content-item-question {
  background: #007aff;
  color: #fff;
  padding: 16rpx 24rpx;
  border-radius: 16rpx 16rpx 0;
  max-width: 80%;
  margin-left: auto;
  font-size: 28rpx;
}

.agent-content-item {
  margin-bottom: 24rpx;
}

.content_agent_nei {
  background: #f5f5f5;
  padding: 16rpx 24rpx;
  border-radius: 16rpx 16rpx 16rpx 0;
  font-size: 28rpx;
  color: #333;
  line-height: 1.6;
}

/* 思考过程弹窗 */
.agent-content1 {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 90%;
  max-height: 50vh;
  background: #fff;
  border-radius: 16rpx;
  z-index: 1001;
}

.agent_content_box {
  padding: 20rpx;
}

.agent_content {
  max-height: 40vh;
}

.agent_content_title {
  text-align: center;
}

.agent_content_title_top {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20rpx;
}

.agent_content_title_top_img {
  width: 40rpx;
  height: 40rpx;
  margin-right: 10rpx;
}

.agent_content_title_top_text {
  font-size: 28rpx;
  color: #000;
}

.thinking-progress-container {
  height: 6rpx;
  background: #eee;
  border-radius: 3rpx;
  margin: 20rpx 0;
}

.thinking-progress-bar {
  height: 100%;
  background: #007aff;
  border-radius: 3rpx;
  transition: width 0.3s;
}

.agent_content_con {
  font-size: 28rpx;
  color: #666;
  text-align: left;
}

/* 底部输入区域 */
.bottom_box {
  background: #fff;
  padding: 20rpx;
  border-top: 1rpx solid #eee;
}
</style>
