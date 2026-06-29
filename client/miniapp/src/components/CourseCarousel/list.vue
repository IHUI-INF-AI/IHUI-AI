/** * Ripple_Yu * 热门课程 组件 * 点击 课程 提供跳转热门课程详情页 */
<template>
  <view class="popular-courses-container">
    <view class="popular-courses-tab-box">
      <view class="popular-courses-tab-item">
        <view
          class="popular-courses-tab-item-text"
          :class="[selectedTab === 0 ? 'active' : 'normal']"
          @click="handleTabClick(0)"
        >
          <text class="popular-courses-tab-item-text">爆款入门课程</text>
        </view>
        <view
          class="popular-courses-tab-item-text"
          :class="[selectedTab === 1 ? 'active' : 'normal']"
          @click="handleTabClick(1)"
        >
          <text class="popular-courses-tab-item-text">爆款精选课程</text>
        </view>
      </view>
    </view>

    <view class="popular-courses-list">
      <PopularCoursesList1
        v-if="selectedTab === 0"
        :CourseList="CourseList1"
        @course="oncourse"
      />
      <PopularCoursesList2
        v-else
        :CourseList="CourseList2"
        @course="oncourse"
      />
    </view>

    <!-- 占位元素 -->
    <view
      class="placeholder"
      :style="{ height: placeholderHeight + 'px' }"
    ></view>
  </view>
</template>

<script setup>
import { ref, watch, nextTick, onMounted } from 'vue'
import PopularCoursesList1 from "../PopularCourses/PopularCoursesList1.vue";
import PopularCoursesList2 from "../PopularCourses/PopularCoursesList2.vue";

const props = defineProps({
  CourseList1: {
    type: Array,
    default: '',
  },
  CourseList2: {
    type: Array,
    default: '',
  },
})

const emit = defineEmits(['oncourses'])

const selectedTab = ref(0)
const placeholderHeight = ref(0)
const isDataLoaded = ref(false)
const title = ref('爆款入门课程')

onMounted(() => {
})

function handleTabClick(index) {
  selectedTab.value = index;
  title.value = index === 0 ? "爆款入门课程" : "爆款精选课程";
}

function handleMoreClick() {
  uni.navigateTo({
    url: "/pagesA/course/MoreCourse",
  });
}

function oncourse(item) {
  emit("oncourses", item);
}

function updatePlaceholderHeight() {
  if (!isDataLoaded.value) {
    return;
  }

  const currentList =
    selectedTab.value === 0 ? props.CourseList1 : props.CourseList2;
  if (!currentList || currentList.length === 0) {
    return;
  }

  const itemHeight = 174 + 20;
  const courseCount = Math.min(currentList.length, 3);
  placeholderHeight.value = courseCount * itemHeight + 60;
}

watch(
  () => props.CourseList1,
  () => {
    if (isDataLoaded.value && selectedTab.value === 0) {
      updatePlaceholderHeight();
    }
  },
  { deep: true }
)

watch(
  () => props.CourseList2,
  () => {
    if (isDataLoaded.value && selectedTab.value === 1) {
      updatePlaceholderHeight();
    }
  },
  { deep: true }
)

watch(selectedTab, () => {
  nextTick(() => {
    updatePlaceholderHeight();
  });
})
</script>

<style lang="scss" scoped>
.popular-courses-container {
  // width: 100%;
  // position: relative;
  // margin-bottom: 10rpx; /* 添加底部间距，防止内容贴底 */
  width: 100%;
  position: relative;
  margin-bottom: 0; /* 移除底部间距 */
  height: 730rpx; /* 设置固定高度 */
}

.popular-courses-title {
  display: flex;
  align-items: center;
  justify-content: space-between; /* 确保两端对齐 */
  margin-bottom: 20rpx; /* 添加底部间距 */

  .popular-courses-title-text {
    display: flex;
    align-items: center;

    .popular-courses-title-text-icon {
      width: 62rpx;
      height: 62rpx;
      margin-right: 20rpx;
    }

    .popular-courses-title-text-text {
      font-size: 32rpx;
      font-weight: bold;
      color: #000;
    }
  }
}

.popular-courses-more {
  display: flex;
  align-items: center;

  .popular-courses-more-text {
    margin-left: 40rpx;
    font-size: 28rpx;
    font-weight: bold;
    color: #000;
  }

  .popular-courses-more-arrow {
    width: 30rpx;
    height: 30rpx;
    margin-left: 10rpx;
  }
}

.popular-courses-tab-box {
  margin-top: -20rpx;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  width: 736rpx;
  height: 80rpx;

  // position: absolute;
  // top: -45rpx;
  // left: 0;

  .popular-courses-tab-item {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 513rpx;
    height: 64rpx;
    border-top-left-radius: 32rpx;
    border-radius: 30rpx;
    background-color: #f5f5f5;
    overflow: hidden;

    .active {
      background-color: #6ab0e5;
      color: #fff;
    }

    .normal {
      background-color: #f5f5f5;
      color: #93d2f3;
    }

    .popular-courses-tab-item-text {
      line-height: 66rpx;
      width: 50%;
      height: 100%;
      font-size: 28rpx;
      font-weight: bold;
      text-align: center;
    }
  }

  .popular-courses-nav-img {
    width: 150rpx;
    height: 160rpx;
    position: absolute;
    top: 80rpx;
    right: 20rpx;
  }
}

.popular-courses-list {
  // position: absolute;
  // top: 200rpx;
  // left: 0;
  margin-top: 30rpx;
  width: 95%;
  border: 2rpx solid #f5f5f5;
  border-radius: 30rpx;
  padding: 0 15rpx 30rpx; /* 增加底部padding */
  max-height: 660rpx; /* 限制最大高度为3个课程 */
  overflow: hidden; /* 超出部分隐藏 */
}

/* 占位元素样式 */
.placeholder {
  width: 100%;
  opacity: 0;
  pointer-events: none;
}
</style>
