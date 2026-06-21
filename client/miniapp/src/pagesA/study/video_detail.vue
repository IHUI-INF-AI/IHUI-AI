<template>
  <view class="cousor">
    <!-- 返回按钮 -->
    <view class="image_background f_c">
      <image class="back_image" src="https://file.aizhs.top/sys-mini/default/back.svg" @click="backPage" />
    </view>

    <!-- 视频播放器 -->
    <video 
      ref="videoPlayer" 
      id="myVideo" 
      class="video_header" 
      :src="videoData.videoPath" 
      object-fit="fill" 
      autoplay
      controls 
      @waiting="waitingHead" 
      @error="errorHead" 
      @loadedmetadata="loadedmetadataHead" 
      @play="onPlay"
      @pause="onPause" 
      @timeupdate="onTimeUpdate" 
      @ended="ended"
    ></video>

    <Loading v-if="loading"></Loading>

    <!-- 内容区域 -->
    <view class="content">
      <!-- Tab 栏 -->
      <view class="color_bg m_b18">
        <view class="color_cont">
          <view class="bar_left f_b">
            <view 
              class="bar_item f_c text" 
              :class="{ 'select': selectIndex == index }"
              v-for="(item, index) in tabs" 
              :key="index" 
              @click="selectBar(item, index)"
            >
              <text>{{ item.name }}</text>
            </view>
          </view>
          <view class="bar_right f_n">
            <image 
              v-if="!dianzanle" 
              class="like_icon" 
              @click.stop="getAgentLike"
              src="https://file.aizhs.top/sys-mini/default/like.png" 
              mode="widthFix"
            ></image>
            <image 
              v-else 
              class="like_icon" 
              @click.stop="getAgentLike"
              src="https://file.aizhs.top/sys-mini/default/like_active.png" 
              mode="widthFix" 
              style="transform: scale(1.2);"
            ></image>

            <image 
              v-if="!shoucangle" 
              class="shoucang_icon" 
              @click.stop="getAgentCollect"
              src="https://file.aizhs.top/sys-mini/default/shoucang.png" 
              mode="widthFix"
            ></image>
            <image 
              v-else 
              class="shoucang_icon" 
              @click.stop="getAgentCollect"
              src="https://file.aizhs.top/sys-mini/default/choucang_active.png" 
              mode="widthFix" 
              style="transform: scale(1.2);"
            ></image>

            <!-- 分享按钮 -->
            <!-- #ifdef MP-WEIXIN -->
            <button class="btn_class" open-type="share">
              <image class="share" src="https://file.aizhs.top/sys-mini/default/new_share.png"></image>
            </button>
            <!-- #endif -->
            <!-- #ifdef APP-PLUS -->
            <view class="btn_class" @click.stop="handleAppShare">
              <image class="share" src="https://file.aizhs.top/sys-mini/default/new_share.png"></image>
            </view>
            <!-- #endif -->
          </view>
        </view>
      </view>

      <!-- 视频信息 -->
      <view v-if="selectIndex != 2">
        <view class="f_b" style="margin-bottom: 14rpx;">
          <view class="f_n">
            <image class="icon_head" src="https://file.aizhs.top/sys-mini/xtk/logo.png" />
            <view>
              <text class="font_nomal">{{ videoData.title ? videoData.title : '智汇社区-官方' }}</text>
              <view class="f_n">
                <image class="icon_video" src="https://file.aizhs.top/sys-mini/xtk/study_icon_video.png" />
                <text class="font_nomal">共{{ total }}节</text>
              </view>
            </view>
          </view>
          <view class="f_c_d">
            <text class="font_nomal">{{ videoData.createdAt || '' }}</text>
          </view>
        </view>
        <view class="font_nomal title-sub" style="margin-bottom: 14rpx;">{{ videoData.content || '' }}</view>
        <view class="f_n" style="margin-bottom: 16rpx;">
          <view class="types_item f_c" v-for="(item, index) in videoData.typeList" :key="index">
            <text class="text">{{ item.name }}</text>
          </view>
        </view>
      </view>

      <!-- Tab 内容 -->
      <Catalog v-if="selectIndex == 0" :pay="payData" :videoList="videoList" @change="changeVideo" @pageDown="pageDown" @showPay="showPay" />
      <Introduction v-if="selectIndex == 1" :videoList="videoList" :content="contentInfo" :agentMap="videoData.agentMap || null"></Introduction>
      <Comment v-if="selectIndex == 2" :videoId="videoId" :remark="remark"></Comment>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { onLoad, onShareAppMessage } from '@dcloudio/uni-app'
import Loading from '@/components/loading/index.vue'
import Catalog from './components/catalog.vue'
import Introduction from './components/introduction.vue'
import Comment from './components/comment.vue'

// 数据
const loading = ref(false)
const videoId = ref('')
const remark = ref('')
const selectIndex = ref(0)
const total = ref(0)
const dianzanle = ref(false)
const shoucangle = ref(false)

// Tab 栏
const tabs = ref([
  { id: 0, name: '课程目录' },
  { id: 1, name: '课程介绍' },
  { id: 2, name: '评论' },
])

// 视频数据
const videoData = reactive({
  videoPath: '',
  title: '',
  content: '',
  createdAt: '',
  typeList: [] as any[],
  agentMap: null,
})

// 课程列表
const videoList = ref<any[]>([])
const payData = ref<any>({})
const contentInfo = ref('')

onLoad((options: any) => {
  if (options.id) {
    videoId.value = options.id
  }
  if (options.remark) {
    remark.value = options.remark
  }
  loadVideoDetail()
})

// 分享
onShareAppMessage(() => {
  return {
    title: videoData.title || '视频详情',
    path: `/pagesA/study/video_detail?id=${videoId.value}`,
  }
})

// 加载视频详情
async function loadVideoDetail() {
  loading.value = true
  try {
    // TODO: 调用 API 加载视频详情
    // const res = await getVideoDetail(videoId.value)
    // if (res && res.data) {
    //   Object.assign(videoData, res.data)
    //   videoList.value = res.data.videoList || []
    //   total.value = videoList.value.length
    // }
  } catch (error) {
    console.error('加载视频详情失败:', error)
  } finally {
    loading.value = false
  }
}

// Tab 切换
function selectBar(item: any, index: number) {
  selectIndex.value = index
}

// 切换视频
function changeVideo(item: any) {
  videoData.videoPath = item.videoPath
  videoData.title = item.title
}

// 下一页
function pageDown() {
  // 加载更多课程
}

// 显示支付
function showPay() {
  // 显示支付弹窗
}

// 点赞
function getAgentLike() {
  dianzanle.value = !dianzanle.value
}

// 收藏
function getAgentCollect() {
  shoucangle.value = !shoucangle.value
}

// APP 分享
function handleAppShare() {
  // APP 分享逻辑
}

// 视频播放事件
function waitingHead() {
  console.log('视频加载中...')
}

function errorHead() {
  console.error('视频加载错误')
}

function loadedmetadataHead() {
  console.log('视频元数据加载完成')
}

function onPlay() {
  console.log('视频播放')
}

function onPause() {
  console.log('视频暂停')
}

function onTimeUpdate(e: any) {
  // 时间更新
}

function ended() {
  console.log('视频播放结束')
}

// 返回上一页
function backPage() {
  uni.navigateBack()
}
</script>

<style lang="scss" scoped>
.cousor {
  min-height: 100vh;
  background: #f5f5f5;
}

.image_background {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100rpx;
  z-index: 100;
  padding-top: 60rpx;
}

.back_image {
  width: 40rpx;
  height: 40rpx;
  position: absolute;
  left: 30rpx;
}

.f_c {
  display: flex;
  align-items: center;
  justify-content: center;
}

.f_b {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.f_n {
  display: flex;
  align-items: center;
}

.f_c_d {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.video_header {
  width: 100%;
  height: 420rpx;
}

.content {
  padding: 20rpx;
  margin-top: 20rpx;
}

.color_bg {
  background: #fff;
  border-radius: 16rpx;
  padding: 20rpx;
}

.color_cont {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.bar_left {
  display: flex;
}

.bar_item {
  padding: 16rpx 24rpx;
  font-size: 28rpx;
  color: #666;

  &.select {
    color: #007aff;
    font-weight: bold;
    border-bottom: 4rpx solid #007aff;
  }
}

.bar_right {
  display: flex;
  align-items: center;
  gap: 20rpx;
}

.like_icon, .shoucang_icon {
  width: 40rpx;
  height: 40rpx;
}

.btn_class {
  background: transparent;
  border: none;
  padding: 0;
  margin: 0;
  line-height: normal;

  &::after {
    border: none;
  }
}

.share {
  width: 40rpx;
  height: 40rpx;
}

.icon_head {
  width: 60rpx;
  height: 60rpx;
  border-radius: 50%;
  margin-right: 16rpx;
}

.icon_video {
  width: 24rpx;
  height: 24rpx;
  margin-right: 8rpx;
}

.font_nomal {
  font-size: 26rpx;
  color: #333;
}

.title-sub {
  font-size: 28rpx;
  color: #666;
  line-height: 1.6;
}

.types_item {
  background: #f0f0f0;
  padding: 8rpx 16rpx;
  border-radius: 8rpx;
  margin-right: 16rpx;

  .text {
    font-size: 24rpx;
    color: #666;
  }
}

.m_b18 {
  margin-bottom: 18rpx;
}
</style>
