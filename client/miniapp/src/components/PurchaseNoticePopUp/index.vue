/** * Ripple_Yu * 需要购买VIP弹窗通知 */
<template>
  <view class="popup-container" v-if="showPopup" @touchmove.stop="safePreventTouchMove">
    <view class="mask" @click="closePopup"></view>
    <view
      class="popup-content"
      :class="{ 'popup-show': animationShow, 'popup-hide': !animationShow }"
    >
      <view class="popup-body">
        <view class="popup-title">赚取佣金</view>

        <view class="popup-desc">加入我们的推广计划，获得额外收入</view>

        <button class="commission-btn" @click="navigateToCommission">
          前往开启会员
        </button>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue';

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['update:show']);

const showPopup = ref(false);
const animationShow = ref(false);

watch(
  () => props.show,
  (newVal) => {
    if (newVal) {
      openPopup();
    } else {
      hidePopup();
    }
  },
  { immediate: true }
);

function safePreventTouchMove(e) {
  if (e.cancelable !== false) e.preventDefault();
}

function openPopup() {
  showPopup.value = true;
  // 使用nextTick确保DOM已更新后再添加动画类
  nextTick(() => {
    setTimeout(() => {
      animationShow.value = true;
    }, 50);
  });
}

function hidePopup() {
  animationShow.value = false;
  // 动画结束后再隐藏整个弹窗
  setTimeout(() => {
    showPopup.value = false;
  }, 300); // 动画持续时间
}

function closePopup() {
  emit('update:show', false);
}

function navigateToCommission() {
  uni.navigateTo({
    url: '/pagesA/earn_commission/index',
    fail: (err) => {
        // 如果导航失败，尝试使用switchTab（针对tabBar页面）
      uni.switchTab({
        url: '/pagesA/earn_commission/index',
        fail: (error) => {
          // 备用方案：尝试使用navigateTo
          uni.navigateTo({
            url: '/pagesA/earn_commission/index',
            fail: (err) => {
              uni.showToast({
                title: '页面跳转失败',
                icon: 'none'
              });
            }
          });
        }
      });
    }
  });
  closePopup();
}
</script>

<style scoped>
.popup-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 999;
}

.mask {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgb(0 0 0 / 0.5);
}

.popup-content {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 600rpx;
  background-color: #fff;
  border-radius: 24rpx 24rpx 0 0;
  transform: translateY(100%);
  transition: transform 0.3s ease-out;
}

.popup-show {
  transform: translateY(0);
}

.popup-hide {
  transform: translateY(100%);
}

.popup-body {
  padding: 40rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
}

.popup-title {
  font-size: 36rpx;
  font-weight: bold;
  margin-bottom: 20rpx;
  color: #333;
}

.popup-desc {
  font-size: 28rpx;
  color: #666;
  margin-bottom: 60rpx;
  text-align: center;
}

.commission-btn {
  width: 80%;
  height: 88rpx;
  line-height: 88rpx;
  background-color: #f60;
  color: #fff;
  font-size: 32rpx;
  font-weight: bold;
  border-radius: 30rpx;
  margin-top: 200rpx;
  margin-bottom: 40rpx;
}
</style>

应用实例
<!-- <template>
    <view class="container">

      <commission-popup :show.sync="showPopup"></commission-popup>
      <button @click="togglePopup">显示佣金弹窗</button>
    </view>
  </template>
  
  <script>
  import CommissionPopup from '@/components/CommissionPopup/index.vue';
  
  export default {
    components: {
      CommissionPopup
    },
    data() {
      return {
        showPopup: false
      }
    },
    methods: {
      togglePopup() {
        this.showPopup = !this.showPopup;
      }
    }
  }
  </script> -->
