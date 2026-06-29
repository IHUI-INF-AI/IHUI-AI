<template>
  <view class="popular-courses-container">
    <view class="popular-courses-title">
      <view class="popular-courses-title-text">
        <view class="popular-courses-title-text-icon">
          <image
            :src="'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/home/xia/popular-courser.png'"
            mode="aspectFill"
            style="width: 100%; height: 100%"
          >
          </image>
        </view>
        <text class="popular-courses-title-text-text">知识星球</text>
      </view>

      <view
        class="popular-courses-more"
        style="z-index: 888"
        @click="handleMoreClick"
      >
        <text class="popular-courses-more-text">进入星球</text>
        <view class="popular-courses-more-arrow">
          <image
            :src="'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/home/xia/right-arrow.png'"
            mode="aspectFill"
            style="width: 100%; height: 100%"
          ></image>
        </view>
      </view>
    </view>

    <view class="popular-courses-tab-box">
      <view class="popular-courses-tab-item">
        <view
          class="popular-courses-tab-item-text"
          :class="[selectedTab === 0 ? 'active' : 'normal']"
          @click="handleTabClick(0)"
        >
          <text class="popular-courses-tab-item-text">官方资讯</text>
        </view>
        <view
          class="popular-courses-tab-item-text"
          :class="[selectedTab === 1 ? 'active' : 'normal']"
          @click="handleTabClick(1)"
        >
          <text class="popular-courses-tab-item-text">星球社区</text>
        </view>
      </view>

      <view class="popular-courses-nav-img">
        <image
          :src="'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/home/xia/KnowledgePlanet.png'"
          mode="aspectFill"
          style="width: 100%; height: 100%"
        >
        </image>
      </view>
    </view>

    <view class="popular-courses-list" v-if="selectedTab === 0">
      <view
        class="popular-courses-list-item"
        v-for="item in kList1"
        :key="item.id"
        @click="handleItemClick(item)"
      >
        <view class="flex-box">
          <view class="flex-box-B">
            <view class="popular-courses-list-item-text">
              <view>
                <view class="popular-courses-list-item-text-king">
                  <view class="popular-courses-list-item-text-king-img">
                    <image
                      :src="'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/home/zhong/aizhinengshe.png'"
                      style="width: 100%; height: 100%"
                    ></image>
                  </view>
                  <text class="popular-courses-list-item-text-king-img-text"
                    >AI智汇社</text
                  >
                </view>
                <text class="popular-courses-list-item-text-title">{{
                  item.title
                }}</text>
              </view>

              <view class="popular-courses-list-item-text-time-NumberOfHits">
                <text class="popular-courses-list-item-text-time">
                  {{ happenTimeFun(item.time) }}
                </text>
              </view>
            </view>

            <view class="popular-courses-list-item-img">
              <image
                :src="item.img"
                mode="aspectFill"
                style="width: 100%; height: 100%"
              >
              </image>
            </view>
          </view>
          <view class="line-box">
            <view class="typeBox">
              <view class="typeBox-title">{{ item.classification }}</view>
              <view>{{ item.NumberOfVisitors }}人浏览</view>
            </view>
            <view class="Likes-Box">
              <view class="message-Box-item">
                <view class="message-Box-item-img">
                  <image
                    :src="'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/home/xia/message.png'"
                    style="width: 100%; height: 100%"
                  ></image>
                </view>
                <view>{{ item.NumberOfVisitors }}</view>
              </view>
              <view class="Likes-Box-item">
                <view class="Likes-Box-item-img">
                  <image
                    :src="'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/home/xia/Like.png'"
                    style="width: 100%; height: 100%"
                  ></image>
                </view>
                <view>{{ item.NumberOfVisitors }}</view>
              </view>
              <view class="Likes-Forward-item">
                <view class="Forward-Box-item-img">
                  <image
                    :src="'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/home/xia/Forward.png'"
                    style="width: 100%; height: 100%"
                  ></image>
                </view>
                <view>{{ item.NumberOfForwarding }}</view>
              </view>
            </view>
          </view>
        </view>
      </view>
    </view>
    <view class="popular-courses-list" v-else>
      <view
        class="popular-courses-list-item"
        v-for="item in kList2"
        :key="item.id"
        @click="handleItemClick(item)"
      >
        <view class="flex-box">
          <view class="flex-box-B">
            <view class="popular-courses-list-item-text">
              <view>
                <view class="popular-courses-list-item-text-king">
                  <view class="popular-courses-list-item-text-king-img">
                    <image
                      :src="'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/home/zhong/aizhinengshe.png'"
                      style="width: 100%; height: 100%"
                    ></image>
                  </view>
                  <text class="popular-courses-list-item-text-king-img-text"
                    >AI智汇社</text
                  >
                </view>
                <text class="popular-courses-list-item-text-title">{{
                  item.title
                }}</text>
              </view>

              <view class="popular-courses-list-item-text-time-NumberOfHits">
                <text class="popular-courses-list-item-text-time">
                  {{ happenTimeFun(item.time) }}
                </text>
              </view>
            </view>

            <view class="popular-courses-list-item-img">
              <image
                :src="item.img"
                mode="aspectFill"
                style="width: 100%; height: 100%"
              >
              </image>
            </view>
          </view>
          <view class="line-box">
            <view class="typeBox">
              <view class="typeBox-title">{{ item.classification }}</view>
              <view>{{ item.NumberOfVisitors }}人浏览</view>
            </view>
            <view class="Likes-Box">
              <view class="message-Box-item">
                <view class="message-Box-item-img">
                  <image
                    :src="'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/home/xia/message.png'"
                    style="width: 100%; height: 100%"
                  ></image>
                </view>
                <view>{{ item.NumberOfVisitors }}</view>
              </view>
              <view class="Likes-Box-item">
                <view class="Likes-Box-item-img">
                  <image
                    :src="'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/home/xia/Like.png'"
                    style="width: 100%; height: 100%"
                  ></image>
                </view>
                <view>{{ item.NumberOfVisitors }}</view>
              </view>
              <view class="Likes-Forward-item">
                <view class="Forward-Box-item-img">
                  <image
                    :src="'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/home/xia/Forward.png'"
                    style="width: 100%; height: 100%"
                  ></image>
                </view>
                <view>{{ item.NumberOfForwarding }}</view>
              </view>
            </view>
          </view>
        </view>
      </view>
    </view>
    <view
      class="placeholder"
      :style="{ height: placeholderHeight + 'rpx' }"
    ></view>
  </view>
</template>

<script setup>
import { ref, watch, nextTick, onMounted } from 'vue'
import { happenTimeFun as happenTimeFunUtil, formatFullTime } from "@/utils/time.js"

defineOptions({
  name: 'KnowledgePlanet'
})

const props = defineProps({
  kList1: {
    type: Array,
    default: () => [],
  },
  kList2: {
    type: Array,
    default: () => [],
  },
})

const selectedTab = ref(0)
const placeholderHeight = ref(0)
const isDataLoaded = ref(false)

const happenTimeFun = happenTimeFunUtil

const handleItemClick = (item) => {
  uni.navigateTo({
    url: `/pagesA/coursePlanet/Official-information/index?id=${item.id}`,
  })
}

const handleTabClick = (index) => {
  selectedTab.value = index
}

const handleMoreClick = () => {
  uni.switchTab({
    url: "/pages/table/share/index",
  })
}

const updatePlaceholderHeight = () => {
  if (!isDataLoaded.value || !props.kList1 || props.kList1.length === 0) {
    return
  }
  const baseHeight = 200
  const itemHeight = 174 + 20
  const totalHeight = baseHeight + props.kList1.length * itemHeight
  placeholderHeight.value = totalHeight + 280
}

const initData = () => {
  isDataLoaded.value = true
  nextTick(() => {
    updatePlaceholderHeight()
  })
}

onMounted(() => {
  initData()
})

watch(
  () => props.kList1,
  () => {
    if (isDataLoaded.value && selectedTab.value === 0) {
      updatePlaceholderHeight()
    }
  },
  { deep: true }
)

watch(
  () => props.kList2,
  () => {
    if (isDataLoaded.value && selectedTab.value === 1) {
      updatePlaceholderHeight()
    }
  },
  { deep: true }
)

watch(
  selectedTab,
  () => {
    nextTick(() => {
      updatePlaceholderHeight()
    })
  }
)
</script>

<style lang="scss" scoped>
.popular-courses-container {
  width: 100%;
  position: relative;
}

.popular-courses-title {
  display: flex;
  align-items: center;

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
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  width: 736rpx;
  height: 190rpx;
  position: absolute;
  top: -45rpx;
  left: 0;

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
      background-color: #9eb3ee;
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
    width: 180rpx;
    height: 196rpx;
    position: absolute;
    top: 30rpx;
    right: 20rpx;
  }
}

.popular-courses-list {
  position: absolute;
  top: 200rpx;
  left: 0;
  width: 95%;
  border-radius: 30rpx;
  padding: 0 15rpx 15rpx;

  .popular-courses-list-item {
    display: flex;
    width: 100%;
    height: 286rpx;
    margin-top: 20rpx;
    background-color: rgba($color: #e5e5e5, $alpha: 0.34);
    border-radius: 30rpx;
    overflow: hidden;
    padding: 20rpx 0;
    box-sizing: border-box;

    .flex-box {
      display: flex;
      flex-direction: column;

      .flex-box-B {
        display: flex;
      }
    }

    .popular-courses-list-item-img {
      width: 250rpx;
      height: 174rpx;
      border-radius: 20rpx;
      overflow: hidden;
    }

    .popular-courses-list-item-text {
      margin-left: 20rpx;
      width: 400rpx;
      height: 180rpx;
      display: flex;
      flex-direction: column;
      justify-content: space-between;

      .popular-courses-list-item-text-title {
        font-size: 32rpx;
        font-weight: bold;
        color: #000;
      }

      .popular-courses-list-item-text-subtitle {
        font-size: 24rpx;
        color: #6c6c6c;
      }

      .popular-courses-list-item-text-king {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 138rpx;
        height: 36rpx;
        border-radius: 15rpx;
        margin-bottom: 10rpx;

        .popular-courses-list-item-text-king-img {
          width: 38rpx;
          height: 34rpx;
          margin-right: 10rpx;
          border-radius: 100%;
          overflow: hidden;
          background-color: #fff;
        }

        .popular-courses-list-item-text-king-img-text {
          width: 115rpx;
        }

        text {
          font-size: 24rpx;
          color: #000;
        }
      }

      .popular-courses-list-item-text-time-NumberOfHits {
        display: flex;
        align-items: center;

        .popular-courses-list-item-text-time,
        .popular-courses-list-item-text-NumberOfHits {
          margin-right: 20rpx;
          font-size: 24rpx;
          color: #6c6c6c;
          font-weight: bold;
        }
      }
    }
  }

  .line-box {
    width: 100%;
    height: 48rpx;
    border-top: 4rpx solid rgba($color: #9b9b9b, $alpha: 0.4);
    margin: 10rpx 0rpx 0;
    padding: 0 15rpx;
    display: flex;
    justify-content: space-between;

    .typeBox {
      width: 238rpx;
      height: 48rpx;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 24rpx;
      color: #6c6c6c;

      .typeBox-title {
        border-radius: 30rpx;
        width: 104rpx;
        height: 36rpx;
        background-color: #feb980;
        text-align: center;
        line-height: 36rpx;
        font-size: 24rpx;
        color: #fff;
      }
    }

    .Likes-Box {
      width: 280rpx;
      height: 48rpx;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 24rpx;
      color: #6c6c6c;

      .message-Box-item {
        display: flex;
        align-items: center;
        justify-content: space-between;

        .message-Box-item-img {
          width: 24rpx;
          height: 24rpx;
          margin-right: 10rpx;
        }
      }

      .Likes-Box-item {
        display: flex;
        align-items: center;
        justify-content: space-between;

        .Likes-Box-item-img {
          width: 24rpx;
          height: 24rpx;
          margin-right: 10rpx;
        }
      }

      .Likes-Forward-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-right: 20rpx;

        .Forward-Box-item-img {
          width: 24rpx;
          height: 24rpx;
          margin-right: 10rpx;
        }
      }
    }
  }
}
</style>