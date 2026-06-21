/**
* Ripple_Yu
* 首页-工具栏组件
* 可接入点击跳转至 路由页面
*
*/
<template>
  <view class="toolbar">
	  <view class="top-toolbar" >
		  <view class="top-toolbar-item" v-for="(item, index) in headerMenu" :key='item.id' @click="trafficApplicationServiceClick(item)">
		  <view style="color: black;text-align: center;font-size: 28rpx;font-weight: bold;"">{{item.title}}</view>
		  <image :src="item.imgUrl" mode="aspectFill" style="width: 100rpx; height: 100rpx;"></image>
		  </view>
	  </view>
	<!-- 更多-->
    <view class="toolbar-title" style="padding: 20rpx 0;" @click="handleToolbarTitleClick">
		<text style="font-size: 32rpx;font-weight: bold;">独家开发 AI Agent应用</text>
     
      <!-- <text>></text> -->
	  <view style="display: flex;align-items: center;">
		  <text class="toolbar-title-text">查看更多</text>
		  <view class="toolbar-title-arrow">
		    <image :src="rightArrowSrc" mode="aspectFill" style="width: 100%; height: 100%;"></image>
		  </view>
	  </view>
	 
    </view>
    <!-- 第一栏-->
   <view style="width:100%;height: 200rpx;position: relative;margin-top: -30rpx; padding-bottom: 20rpx;"  @click="marketingClick">
		   <image 
		     :style="{animation: 'float 3s ease-in-out infinite', width: '220rpx', height: '220rpx', zIndex: 777, position: 'absolute', left: '40rpx', top: '0rpx'}" 
		     src="https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/home/second/hello1.png" 
		     alt="aspectFill" />

	   <view class="backgroundImage" >
		   <view style="position: absolute;left: 0;top: 40rpx;height: 160rpx;flex-direction: column;background: linear-gradient(180deg, #3A5DF1 0%, #81D8E5 70%);width: 100%;border-radius: 30rpx;">
			<view style="padding-left:260rpx ; height: 160rpx;">
				<view style="display: flex;flex-direction: column;justify-content: center;height: 160rpx;">
					<view>  <text style="font-size: 32rpx;font-weight: bold;">独家一键生成运营内容</text></view>
					<view> <text style="font-size: 24rpx;color: #6C6C6C; margin-top: 20rpx;">批量一件生成百条爆款，降本增效90%</text></view>
				</view>
			</view>
		   </view>
	   </view>
   </view>

    <!-- 第二栏 -->
    <view class="row second-row" style="display: flex;flex-wrap: wrap;justify-content: space-between;width: 100%;margin-top: 10rpx;">
      <view class="item medium-item round-item" style="width: 340rpx;margin-bottom: 20rpx;"  v-for="item in secondRowList" :key="item.id" 
        @click="handleItemClick(item.id + 2)"
        :class="item.id === 1 ? 'round-item-image-container-A' : 'round-item-image-container-B'">
        <view class="item-container">
          <view class="medium-item-image-container" >
            <image :src="item.imgUrl" mode="aspectFill" style="width: 100%; height: 100%;"></image>
          </view>
          <view class="medium-item-text-container" style="width: 100%;margin-left: 40rpx;">
            <text class="medium-item-title">{{ item.title }}</text>
            <text class="medium-item-description">{{ item.description }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 第三栏 -->
    <view class="row third-row">
      <view class="item full-item" @click="goToCustomMade()">
        <view class="full-item-image-container">
          <image :src="'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/home/zhong/custom-made.png'" mode="aspectFill" style="width: 100%; height: 100%;"></image>
        </view>
        <text class="full-item-text">AI定制服务，满足您个性化的服务需求</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { onMounted } from 'vue'

const emit = defineEmits(['id-service'])

const rightArrowSrc = 'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/home/zhong/right-arrow.png'
const toolbarList = [
  {
    id: 2,
    title: '一键生成运营内容',
    description: '文➡图➡视频➡输出一站式服',
    imgUrl:'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/tabbar/_20250418212023.png'
  },

]
const secondRowList = [
  {
    id: 1,
    title: 'AI图片创作',
    description: '轻松创作图片',
    imgUrl:'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/tabbar/6.png'
  },
  {
    id: 2,
    title: 'AI视频创作',
    description: '轻松创作视频',
    imgUrl:'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/tabbar/4.png'
  },
	{
	  id: 3,
	  title: 'AI文案创作',
	  description: '轻松创作文案',
	  imgUrl:'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/tabbar/7.png'
	},
	{
	  id: 4,
	  title: 'AI自动剪辑',
	  description: '轻松创作剪辑',
	  imgUrl:'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/tabbar/2.png'
	},
	{
	  id: 5,
	  title: 'AI直播',
	  description: 'AI直播服务',
	  imgUrl:'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/tabbar/5.png'
	},
	{
	  id: 6,
	  title: 'AI数字人',
	  description: '制作数字人',
	  imgUrl:'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/tabbar/3.png'
	},
]
const headerMenu = [
	{
		id:1,
		title:'流量运营陪跑',
		imgUrl:'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/tabbar/图片 28@2x.png'
	},{
		id:2,
		title:'一站式设备应用',
		 imgUrl:'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/tabbar/图片 32@2x.png'
	},{
		id:3,
		title:'AI其他技术服务',
		imgUrl:'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/tabbar/图片 32@2x (2).png'
	}
]

onMounted(() => {
  uni.setStorageSync('cross-origin-opener-policy', 'same-origin');
  uni.setStorageSync('cross-origin-embedder-policy', 'require-corp');
})

function handleToolbarTitleClick() {
  uni.navigateTo({
    url: '/pages/tools/index copy'
  })
}

function handleItemClick(index) {
  if (index === 5) {
    uni.navigateTo({
      url: '/pages/tools/ai_wenan'
    })
  } else if (index === 3) {
    uni.navigateTo({
      url: '/pages/tools/ai_photo'
    })
  }
  else if (index === 8) {
    uni.navigateTo({
      url: '/pages/tools/shuziren'
    })
  } else if (index === 4) {
    uni.navigateTo({
      url: '/pages/tools/ai_video'
    }).catch(err => {
      uni.showToast({
        title: '页面跳转失败',
        icon: 'none'
      });
    });
  } else if (index === 2) {
    
  }
}

function marketingClick() {
  uni.navigateTo({
    url: '/pages/tools/ai-marketing'
  })
}

function trafficApplicationServiceClick(item) {
  emit('id-service', item);
}

function goToCustomMade() {
  uni.showToast({
    title: '功能开发中',
    icon: 'none'
  })
}
</script>

<style lang="scss" scoped>

 @keyframes float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-20rpx); }
  }
.toolbar {
  display: flex;
  flex-direction: column;
  margin-top: 20rpx;
  width: 100%;
.top-toolbar{
	width: 100%;
	display: flex;
	justify-content: space-between;  /* 左右分散排列 */
	height: 180rpx;
	.top-toolbar-item{
	padding: 20rpx 0;
	display: flex;
	flex-direction: column;
	align-items: center; 
	justify-content: space-between;
    border-radius: 30rpx;
	width: calc(100% / 3 - 10rpx);
    height: 140rpx;
	background: linear-gradient(180deg, #FCFDFE 0%, rgba(216, 216, 216, 0) 100%);
	}
}
.econd-row{
	display: flex;
	lex-wrap: wrap;    
}
  .toolbar-title {
	margin-top: 20rpx;
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20rpx;
    font-size: 28rpx;
    font-weight: bold;
    color: #000;
    margin-right: 20rpx;

    .toolbar-title-text {
      margin-right: 20rpx;
    }

    .toolbar-title-arrow {
      width: 30rpx;
      height: 30rpx;
    }
  }
  .rows{
	   display: flex;
	   flex-wrap: wrap;
	   justify-content: space-between;
	   margin-bottom: 40rpx;
	   .item {
	     background-color: #f5f5f5;
	   }
	   
  }

  .row {
    display: flex;
    justify-content: center;
    margin-bottom: 40rpx;

    .item {
      background-color: #f5f5f5;
    }

    .large-item-image-container-A {
      // background: linear-gradient(180deg, #d7f0fd,#93D2F3, #4E9FD8, #4095E5, #d7f0fd);
      background-image: url('https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/home/zhong/backA.png');
      background-size: 100% 100%;
      background-repeat: no-repeat;
    }

    .large-item-image-container-B {
      // background: linear-gradient(180deg, #E5E5E5,#9CADD4, #9CADD4, #9CADF6, #9CADD4,#9CADD4,#E5E5E5);
      background-image: url('https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/tabbar/_20250418221944.png');
      background-size: 100% 100%;
      background-repeat: no-repeat;
    }

    .large-item {
      width: 358rpx;
      height: 160rpx;
      border-radius: 30rpx;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 15rpx;
      overflow: hidden;

      &:first-child {
        margin-right: 24rpx;
      }

      .item-title {
        font-size: 36rpx;
        font-weight: bold;
        color: #000;
      }

      .item-description {
        font-size: 24rpx;
        color: #6C6C6C;
      }

      .item-image-container {
        width: 140rpx;
        height: 162rpx;
      }


    }

    .medium-item {
      width: 358rpx;
      height: 106rpx;
      background: linear-gradient(180deg, #93D2F3, #FFFFFF);
      &:first-child {
        margin-right: 24rpx;
      }

      display: flex;
      align-items: center;
      justify-content: center;

      .item-container {
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 280rpx;
        height: 90rpx;

        .medium-item-image-container {
          width: 76rpx;
          height: 76rpx;
        }
      }



      .item-image-container {
        width: 82rpx;
        height: 90rpx;
      }

      .medium-item-text-container {
        display: flex;
        flex-direction: column;

        .medium-item-title {
          font-size: 32rpx;
          font-weight: bold;
          color: #000;
        }

        .medium-item-description {
          font-size: 24rpx;
          color: #6C6C6C;
        }
      }
    }

    .round-item {
      border-radius: 276rpx;
    }

    .full-item {
      width: 736rpx;
      height: 106rpx;
      border-radius: 20rpx;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 40rpx;

      .full-item-image-container {
        width: 90rpx;
        height: 94rpx;
      }

      .full-item-text {
        font-size: 32rpx;
        font-weight: bold;
        color: #93D2F3;
      }

    }
  }
}
</style>
