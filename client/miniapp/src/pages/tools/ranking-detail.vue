<template>
  <view class="detail-container">
    <!-- 统一侧边栏：历史对话 -->
    <DrawerComponent
      ref="drawerComponent"
      :showTabbar="false"
      :tagWrapShow="drawerVisible"
      :statusBarHeight="statusBarHeight"
      :groupedData="groupedData"
      :active_date="chat_active_date"
      :active_menu="chat_active_menu"
      :userinfo="userinfo"
      :modelList="modelList"
      @close-drawer="close_drawer"
      @go-page="gopage"
      @go-company="gotocompany"
      @lingqu="lingqu"
      @add-new-chat="addNewChat"
      @show-full-list="handleShowChatFullList"
      @touch-start="handleTouchStart"
      @touch-move="handleTouchMove"
      @touch-end="handleTouchEnd"
      @remove-chat="removeChat"
    />

    <!-- 导航栏 -->
    <navigation-bars 
      :viscosity="true" 
      :showMenu="true"
      :showFenLei="true"
      color="#171717" 
      font-size-30 
      :title="detailData.title || detailData.name || '详情页'" 
      @pack="backPage"
      @nav-click="handleNavClick"
      @menu-click="handleMenuClick"
      :image="'/static/images/back.svg'"
    />

    <!-- 内容区域 -->
    <scroll-view class="content-scroll" scroll-y>
      <!-- Logo + 标题和简介 -->
      <view class="row-1">
        <image class="logo" :src="detailData.avatar || detailData.field1 || '/static/images/wirelesslogo.png'" mode="aspectFill" />
        <view class="title-desc">
          <text class="title">{{ detailData.title || detailData.name || '未命名' }}</text>
          <text class="desc">{{ detailData.context || ('排名：' + (detailData.rank || '-') + ' · 机构：' + (detailData.company || detailData.organization || '-') + ' · 关注度：' + (detailData.attention || detailData.viewCount || detailData.collectCount || '0')) }}</text>
        </view>
      </view>

      <!-- 四个横向排列的信息项 -->
      <view class="row-2">
        <view class="info-item">
          <text class="info-label">关注度</text>
          <text class="info-value">{{ detailData.attention || detailData.viewCount || detailData.collectCount || '0' }}</text>
        </view>
        <view class="info-item">
          <text class="info-label">类别</text>
          <text class="info-value">{{ detailData.category || '通用助手' }}</text>
        </view>
        <view class="info-item">
          <text class="info-label">价格</text>
          <text class="info-value">{{ detailData.price || '免费' }}</text>
        </view>
        <view class="info-item">
          <text class="info-label">状态</text>
          <text class="info-value">{{ getStatusText(detailData.status) }}</text>
        </view>
      </view>

      <!-- 细分类别 -->
      <view class="row-common">
        <text class="row-title">细分类别</text>
        <text class="row-content">{{ detailData.subCategory || '未知' }}</text>
      </view>

      <!-- 产品形式 -->
      <view class="row-common">
        <text class="row-title">产品形式</text>
        <text class="row-content">{{ detailData.productForm || '未知' }}</text>
      </view>

      <!-- 所属机构 -->
      <view class="row-common">
        <text class="row-title">所属机构</text>
        <text class="row-content">{{ detailData.organization || detailData.company || '未知' }}</text>
      </view>

      <!-- 官方网址 -->
      <view class="row-common">
        <text class="row-title">官方网址</text>
        <view class="row-content url-content" v-if="detailData.officialWebsite">
          <text class="url-text" @click="copyUrl">{{ detailData.officialWebsite }}</text>
          <text class="copy-hint">点击复制</text>
        </view>
        <text class="row-content" v-else>未知</text>
      </view>

      <!-- 图片 -->
      <image 
        v-if="detailData.imgs || detailData.icon" 
        class="detail-image" 
        :src="detailData.imgs ? detailData.imgs.split(',')[0] : detailData.icon" 
        mode="widthFix" 
      />

      <!-- 详细介绍 -->
      <view class="detail-text" v-if="detailData.context">
        <text>{{ detailData.context }}</text>
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import NavigationBars from '@/components/navigation-bars/indexb.vue'
import DrawerComponent from '@/components/DrawerComponentall.vue'
import { getCozeApiList } from '@/service/aiModels.js'
import { getModelChat, removeModelChat } from '@/service/ai_index.js'

// 数据
const detailData = ref<any>({})
const drawerVisible = ref(false)
const groupedData = ref<any[]>([])
const chatAlldataarr = ref<any[]>([])
const chat_active_date = ref('0')
const chat_active_menu = ref(0)
const userinfo = ref({
  avatar: '',
  nickname: '',
})
const modelList = ref<any[]>([])

// 状态栏高度
const statusBarHeight = computed(() => {
  return 0
})

// 获取状态文本
function getStatusText(status: number) {
  if (status == 2) return '已发布'
  if (status == 4) return '测试中'
  if (status == 6) return '已下线'
  return '未知'
}

onShow(() => {
  // 初始化侧边栏数据
  const dataInfo = uni.getStorageSync('data') || {}
  userinfo.value = {
    avatar: dataInfo.avatar || '',
    nickname: dataInfo.nickname || '',
  }
  getCozeApiList().then((res: any) => {
    modelList.value = res.data || []
  }).catch(() => {
    modelList.value = []
  })
  loadHistoryChat()
})

onLoad((options: any) => {
  // 解析从列表页传递的数据
  if (options.data) {
    detailData.value = JSON.parse(decodeURIComponent(options.data))
  }
})

// 加载历史对话
async function loadHistoryChat() {
  try {
    const dataInfo = uni.getStorageSync('data') || {}
    const uuid = dataInfo.uuid
    if (!uuid) return

    const res = await getModelChat({ uuid, pageNum: 1, pageSize: 50 })
    if (res && res.data) {
      chatAlldataarr.value = res.data.list || []
      // 按日期分组
      groupedData.value = groupByDate(chatAlldataarr.value)
    }
  } catch (error) {
    console.error('加载历史对话失败:', error)
  }
}

// 按日期分组
function groupByDate(list: any[]) {
  const groups: Record<string, any[]> = {}
  list.forEach((item: any) => {
    const date = new Date(item.createTime).toLocaleDateString()
    if (!groups[date]) groups[date] = []
    groups[date].push(item)
  })
  return Object.entries(groups).map(([date, items]) => ({ date, items }))
}

// 菜单按钮
function handleMenuClick() {
  drawerVisible.value = !drawerVisible.value
}

// 导航按钮
function handleNavClick() {
  drawerVisible.value = !drawerVisible.value
}

// 关闭侧边栏
function close_drawer() {
  drawerVisible.value = false
}

// 跳转页面
function gopage(url: string) {
  drawerVisible.value = false
  uni.navigateTo({ url })
}

// 跳转到公司页面
function gotocompany() {
  drawerVisible.value = false
  uni.navigateTo({ url: '/pages/distribution/index' })
}

// 领取
function lingqu() {
  drawerVisible.value = false
}

// 添加新对话
function addNewChat() {
  drawerVisible.value = false
  uni.navigateTo({ url: '/pages/tools/ai_assistant' })
}

// 显示完整列表
function handleShowChatFullList() {
  // 显示完整列表
}

// 触摸事件
function handleTouchStart() {}
function handleTouchMove() {}
function handleTouchEnd() {}

// 移除对话
function removeChat(item: any) {
  uni.showModal({
    title: '提示',
    content: '确定要删除这条对话吗？',
    success: async (res) => {
      if (res.confirm) {
        try {
          await removeModelChat({ id: item.id })
          loadHistoryChat()
        } catch (error) {
          console.error('删除对话失败:', error)
        }
      }
    },
  })
}

// 复制 URL
function copyUrl() {
  uni.setClipboardData({
    data: detailData.value.officialWebsite,
    success: () => {
      uni.showToast({ title: '复制成功', icon: 'success' })
    },
  })
}

// 返回上一页
function backPage() {
  uni.navigateBack()
}
</script>

<style lang="scss" scoped>
.detail-container {
  min-height: 100vh;
  background: #f5f5f5;
}

.content-scroll {
  height: calc(100vh - 100rpx);
  padding: 20rpx;
}

.row-1 {
  display: flex;
  align-items: center;
  background: #fff;
  border-radius: 16rpx;
  padding: 30rpx;
  margin-bottom: 20rpx;

  .logo {
    width: 120rpx;
    height: 120rpx;
    border-radius: 16rpx;
    margin-right: 24rpx;
  }

  .title-desc {
    flex: 1;

    .title {
      font-size: 32rpx;
      font-weight: bold;
      color: #333;
      display: block;
      margin-bottom: 8rpx;
    }

    .desc {
      font-size: 24rpx;
      color: #999;
      display: block;
    }
  }
}

.row-2 {
  display: flex;
  justify-content: space-between;
  background: #fff;
  border-radius: 16rpx;
  padding: 30rpx;
  margin-bottom: 20rpx;

  .info-item {
    text-align: center;
    flex: 1;

    .info-label {
      font-size: 24rpx;
      color: #999;
      display: block;
      margin-bottom: 8rpx;
    }

    .info-value {
      font-size: 28rpx;
      color: #333;
      font-weight: bold;
    }
  }
}

.row-common {
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx 30rpx;
  margin-bottom: 20rpx;
  display: flex;
  justify-content: space-between;

  .row-title {
    font-size: 28rpx;
    color: #666;
  }

  .row-content {
    font-size: 28rpx;
    color: #333;
  }

  .url-content {
    display: flex;
    align-items: center;

    .url-text {
      color: #007aff;
      margin-right: 10rpx;
    }

    .copy-hint {
      font-size: 22rpx;
      color: #999;
    }
  }
}

.detail-image {
  width: 100%;
  border-radius: 16rpx;
  margin-bottom: 20rpx;
}

.detail-text {
  background: #fff;
  border-radius: 16rpx;
  padding: 30rpx;
  margin-bottom: 20rpx;

  text {
    font-size: 28rpx;
    color: #666;
    line-height: 1.8;
  }
}
</style>
