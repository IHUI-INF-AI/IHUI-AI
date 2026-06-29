<template>
  <view class="category-detail-container">
    <view style="position: fixed;left: 0;top: 0;right: 0;z-index: 999;">
      <navigationBars :showFenLei="false" :viscosity="true" :title="pageTitle" image="/static/images/back.svg" />
    </view>
    <view style="opacity: 0;">
      <navigationBars :showFenLei="false" :viscosity="true" :title="pageTitle" image="/static/images/back.svg" />
    </view>
    
    <view style="padding: 20rpx 20rpx 60rpx; margin-top: 0;">
      <view class="ailist_content">
        <ai-list 
          :showTitle="false" 
          :showTabbar="false" 
          :ailist="categoryData" 
          :showAssistant="false" 
          :isBottoma="isBottom" 
          :showBottom="false" 
          @getAgentCollect="handleGetAgentCollect" 
          @getAgentLike="handleGetAgentLike"
        />
      </view>
      
      <view v-if="isLoading" class="loading-text">
        <text>加载中...</text>
      </view>
      
      <view v-if="!hasMore && allCategoryData.length > 0" class="loading-text">
        <text>没有更多了</text>
      </view>
    </view>
    
    <view v-if="showToodown" class="toodown-wrapper">
      <view class="toodown" @click="backToTop">
        <image class="toodownimg" src="/static/images/back.svg" mode="widthFix"></image>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import NavigationBars from "@/components/navigation-bars/index.vue";
import AiList from "./components/Ai-list_b.vue";
import { getAgentList, getAgentCollect, getAgentLike } from "@/service/pay.js";

const pageTitle = ref("分类详情")
const categoryName = ref("")
const categoryData = ref({})
const allCategoryData = ref([])
const page = ref(1)
const pageSize = ref(10)
const isLoading = ref(false)
const hasMore = ref(true)
const isBottom = ref(false)
const showToodown = ref(false)
const lastScrollTop = ref(0)

const getCategoryData = () => {
  if (isLoading.value) return;
  
  isLoading.value = true;
  
  getAgentList({
    id: '',
    pageNum: page.value,
    pageSize: pageSize.value,
    agentCategory: '',
    agentMainCategory: '',
    agentId: ''
  }).then(res => {
    if (res.data && typeof res.data === 'object' && !Array.isArray(res.data)) {
      if (res.data[categoryName.value]) {
        const newData = res.data[categoryName.value];
        if (page.value === 1) {
          allCategoryData.value = newData;
        } else {
          allCategoryData.value = [...allCategoryData.value, ...newData];
        }
        categoryData.value = { [categoryName.value]: allCategoryData.value };
        
        if (newData.length === 0 || newData.length < pageSize.value) {
          hasMore.value = false;
        } else {
          hasMore.value = true;
        }
      } else {
        if (page.value === 1) {
          allCategoryData.value = [];
          categoryData.value = {};
        }
        hasMore.value = false;
      }
    } else {
      if (page.value === 1) {
        allCategoryData.value = [];
        categoryData.value = {};
      }
      hasMore.value = false;
    }
  }).catch(err => {
    if (page.value === 1) {
      allCategoryData.value = [];
      categoryData.value = {};
    }
    hasMore.value = false;
  }).finally(() => {
    isLoading.value = false;
  });
}

const loadMoreData = () => {
  if (hasMore.value && !isLoading.value) {
    page.value++;
    getCategoryData();
  }
}

const handleToodownVisibility = (scrollTop) => {
  if (scrollTop > 200) {
    showToodown.value = true;
  } else {
    showToodown.value = false;
  }
  lastScrollTop.value = scrollTop;
}

const backToTop = () => {
  uni.pageScrollTo({
    scrollTop: 0,
    duration: 300
  });
}

const handleGetAgentCollect = (id) => {
  getAgentCollect(id).then(res => {
    if (res.message == '收藏成功') {
      for (const category in categoryData.value) {
        categoryData.value[category].forEach(item => {
          if (item.botId == id) {
            item.isCollect = item.isCollect == 0 ? 1 : 0;
            item.collectCount = item.collectCount + 1;
          }
        });
      }
    } else {
      for (const category in categoryData.value) {
        categoryData.value[category].forEach(item => {
          if (item.botId == id) {
            item.isCollect = item.isCollect == 0 ? 1 : 0;
            item.collectCount = item.collectCount - 1;
          }
        });
      }
    }
  });
}

const handleGetAgentLike = (id) => {
  getAgentLike(id).then(res => {
    if (res.message == '点赞成功') {
      for (const category in categoryData.value) {
        categoryData.value[category].forEach(item => {
          if (item.botId == id) {
            item.likeCount = item.likeCount + 1;
            item.isThumbs = 1;
          }
        });
      }
    } else {
      for (const category in categoryData.value) {
        categoryData.value[category].forEach(item => {
          if (item.botId == id) {
            item.likeCount = item.likeCount - 1;
            item.isThumbs = 0;
          }
        });
      }
    }
  });
}

const onLoad = (options) => {
  if (options.categoryName) {
    categoryName.value = decodeURIComponent(options.categoryName);
    pageTitle.value = categoryName.value;
    getCategoryData();
  }
}

const onPageScroll = (e) => {
  handleToodownVisibility(e.scrollTop);
  
  if (e.scrollTop > 300) {
    isBottom.value = true;
  } else {
    isBottom.value = false;
  }
  
  const scrollHeight = uni.getWindowInfo().windowHeight;
  const scrollOffset = e.scrollTop + scrollHeight;
  const query = uni.createSelectorQuery();
  let totalHeight = 0;
  query.select('.ailist_content').boundingClientRect(data => {
    if (data) {
      totalHeight = data.height;
      if (scrollOffset >= totalHeight - 200) {
        loadMoreData();
      }
    }
  }).exec();
}
</script>

<style lang="scss" scoped>
page {
  background-color: #fff;
}

.category-detail-container {
  min-height: 100vh;
  background-color: #fff;
}

.ailist_content {
  width: 100%;
}

.loading-text {
  text-align: center;
  padding: 40rpx 0;
  color: #999;
  font-size: 28rpx;
}

.toodown-wrapper {
  z-index: 2;
  transition: all 0.2s ease-in-out;
  padding-top: 60rpx;
  background: linear-gradient(to top, #fff 0%, rgb(255 255 255 / 0) 100%);
  left: 0 !important;
  right: 0 !important;
}

.toodown-wrapper:not(.toodown-fixed) {
  position: fixed;
  left: calc(50% - 34rpx);
  bottom: 0;
}

.toodown-wrapper.toodown-fixed {
  position: relative;
  right: auto;
  bottom: auto;
  margin: 20rpx auto 0;
  display: flex;
  justify-content: center;
}

.toodown {
  width: 68rpx;
  height: 68rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  border-radius: 8rpx;
  margin: 0 auto;
}

.toodownimg {
  width: 32rpx;
  height: 32rpx;
  transform: rotate(90deg);
  transition: transform 0.2s ease;
}

.toodown:active .toodownimg {
  transform: rotate(90deg) scale(0.9);
}
</style>
