<template>
<view>
	<image src="/static/images/default/vip_message.jpg" mode="widthFix" style="width: 100%;height: 321rpx;display: block;margin-bottom: 10rpx;border-radius: 15rpx;box-shadow: 4rpx 4rpx 4rpx 0 rgb(0 0 0 / 0.07);"></image>
	<view class="border_back" style=" margin-top: 4rpx;padding: 2rpx;border-radius: 15rpx;position: relative;min-height: 344rpx;overflow: visible;" >
		<view style="width: 345rpx;height: 344rpx;position: absolute;right: 0;bottom: 0;z-index: 2;">
			<image src="/static/images/default/back_hudie.png" mode="widthFix" style="width: 100%;height: 100%;display: block;"></image>
		</view>
	<view class="membership-benefits-card">
		
		<view class="" style="margin: -12rpx -10rpx 0;width: calc(100% + 20rpx);border-radius: 15rpx; padding: 1rpx;" >
		
		<view style="border-radius: 15rpx;width: 100%;" class="">
			<view class="card-title" style="padding-top: 10rpx;padding-left: 20rpx;padding-bottom: 10rpx;" >享受权益</view>
			<view>
				<view class="card-vip"  style="margin-left: 50rpx;padding-right: 15rpx;color: #7abaf5;" >限时588元/<text style="text-decoration: line-through;" >1288</text>元开通VIP/年</view>
				<view class="card-vip"  style="margin-left: 50rpx;padding-right: 15rpx;color: #f00;" >限时3888元/<text style="text-decoration: line-through;" >18888</text>元开通操盘手/年</view>
			</view>
		</view>
		
		</view>
		
		<view class="benefits-list" style="font-size: 18rpx;margin-top: 16rpx;" >
			
			<view class="" style="display: flex;" >
				<view class="th-all th-all_tab" style="width: 40%;">
					权益名称
				</view>
				<view class="th-all th-all_tab" style="width: 22%;color: #a9a9a9;">
					普通用户
				</view>
				<view class="th-all th-all_tab" style="width: 23%;color: #e8e9ff;text-shadow: 2rpx 2rpx 5rpx #000fff;">
					会员
				</view>
				<view class="th-all th-all_tab" style="width: 23%;color: #dbff6d;text-shadow: 2rpx 2rpx 10rpx #7ca500;">
					操盘手
				</view>
			</view>
			
			
			
			
			<scroll-view
				class="benefits-scroll"
				:scroll-y="true"
			>
			<view class="" style="display: flex;" v-for="(item,index) in listens" :key="index">
						<view class="th-all" style="width: 40%;font-size: 26rpx;font-weight: bold;word-wrap: break-word;word-break: break-all;">
							{{item.title}}
						</view>
						<view class="th-all" style="width: 22%;display: flex;justify-content: center;align-items: center;">
							<image v-if="item.one==0" style="width: 20rpx;height: 20rpx;" src="/static/images/default/chacha.png" mode="widthFix"></image>
							<image v-if="item.one==1" style="width: 22rpx;height: 16.33rpx;" src="/static/images/pigeona.png" mode="widthFix"></image>
							<view style="color: #000;" v-else-if="item.one!=0&&item.one!=1" v-html="item.one"></view>
						</view >
						<view class="th-all" style="width: 23%;display: flex;justify-content: center;align-items: center;">
							<image v-if="item.two==0" style="width: 20rpx;height: 20rpx;" src="/static/images/default/chacha.png" mode="widthFix"></image>
							<image v-if="item.two==1" style="width: 22rpx;height: 16.33rpx;" src="/static/images/pigeona.png" mode="widthFix"></image>
							<text style="color: #000;" v-else-if="item.two!=0&&item.two!=1">{{item.two}}</text>
						</view>
						<view class="th-all" style="width: 23%;display: flex;justify-content: center;align-items: center;">
							<image v-if="item.three==0" style="width: 20rpx;height: 20rpx;" src="/static/images/default/chacha.png" mode="widthFix"></image>
							<image v-if="item.three==1" style="width: 22rpx;height: 16.33rpx;" src="/static/images/pigeona.png" mode="widthFix"></image>
							<text style="color: #000;" v-else-if="item.three!=0&&item.three!=1">{{item.three}}</text>
						</view>
			</view>
			</scroll-view>
		</view>
		
		
		
		<!--之前做的-->
		<view class="details-button" @click="showDetails">立即开通</view>
	</view>
	</view>
</view>
</template>

<script setup>
import { ref } from 'vue';

defineOptions({
  name: "UserMembershipBenefits"
});

const props = defineProps({
  isMember: {
    type: Boolean,
    default: false,
  },
  benefits: {
    type: Array,
    default: () => [
      {
        title: "https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/user/ai-icon.png",
        text: "AI助手免费使用次数增加",
      },
      {
        icon: "https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/user/course-icon.png",
        text: "部分课程免费学习",
      },
      {
        icon: "https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/user/knowledge-icon.png",
        text: "建立专属知识库",
      },
    ],
  },
});

const emit = defineEmits(['openIntroduces']);

const listens = ref([
	{
		'title':'终身二级分销收益',
		'one':'分享送<br/>智汇值',
		'two':'一级分销10%',
		'three':'一级分销40%二级分销10%',
		'type':0,
	},
	{
		'title':'获取上千+智能体源码',
		'one':0,
		'two':1,
		'three':1,
		'type':0,
	},
	{
		'title':'AI应用Coze官方渠道发布',
		'one':1,
		'two':1,
		'three':1,
		'type':0,
	},
	{
		'title':'AI应用限免开放',
		'one':1,
		'two':1,
		'three':1,
		'type':0,
	},
	{
		'title':'Coze/N8N无缝接入',
		'one':1,
		'two':1,
		'three':1,
		'type':0,
	},
	{
		'title':'多对一答疑陪跑',
		'one':0,
		'two':1,
		'three':1,
		'type':0,
	},
	{
		'title':'算力值赠送',
		'one':'8万',
		'two':'888万',
		'three':'1888万',
		'type':0,
	},
	{
		'title':'总部入驻及线下学习实操机会',
		'one':0,
		'two':0,
		'three':1,
		'type':0,
	},
	{
		'title':'成立一人公司',
		'one':1,
		'two':1,
		'three':1,
		'type':0,
	},
	{
		'title':'定制Agent ',
		'one':'原价',
		'two':'9.5折',
		'three':'8折',
		'type':1,
	},
	{
		'title':'入驻社区服务商名列',
		'one':0,
		'two':0,
		'three':1,
		'type':0,
	},
]);

function showDetails() {
	emit('openIntroduces');
}
</script>

<style scoped lang="less">
.border_back{
	background: url('/static/images/default/back_jianbianse.png') no-repeat;
	background-size: 100% 100%;
}
	.th-all{
		width: 40%;height:auto;
		color: #000;
		padding: 3rpx 0;
		text-align: center;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 24rpx;
	}
.membership-benefits-card {
  border-radius: 15rpx;
  padding: 17rpx;
  box-shadow: 2rpx 2rpx 8rpx rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  z-index: 1;
}


.card-title {
  font-size: 40rpx;
  font-weight: bold;
  color: #3D3D3D;
  align-self: flex-start;
  text-align: center;
  letter-spacing: 0px;
}

.card-vip {
  font-family: "AlimamaFangYuanTi" !important;
  font-weight: 700;
  font-size: 32rpx;
  font-variation-settings: "BEVL" 100, "opsz" auto;
  color: #ff0000;
}

@media screen and (max-width: 380px) {
  .card-title {
    font-size: 36rpx !important;
  }
  .card-vip {
    font-size: 30rpx !important;
  }
}

.benefits-list {
  width: 100%;
  margin-bottom: 0;
}

.benefit-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  width: 33%;
}

.benefit-icon {
  width: 144rpx;
  height: 154rpx;
  z-index: 1;
}

.benefit-text {
  font-size: 28rpx;
  color: #000000;
  font-weight: 600;
  line-height: 1.4;
}

.details-button {
	width: 100%;
    box-sizing: border-box;
    height: auto;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
    color: #000;
	font-weight: bold;
	font-size: 42rpx;
    border-radius: 15rpx;
    border: 4rpx solid #000;
    padding: 10rpx 27rpx;
    box-shadow: 3rpx 3rpx 5rpx 0 #9b9b9b;
    margin: 0 auto;
    -webkit-backdrop-filter: blur(10px);
    backdrop-filter: blur(10px);
	margin-top: 20rpx;
  animation: bounce 0.5s ease-in-out infinite;
}
@keyframes bounce {
  0% {
    box-shadow: none;
    transform: translate(3rpx, 3rpx);
  }

  50% {
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
    transform: translate(0, 0);
  }

  100% {
    box-shadow: none;
    transform: translate(3rpx, 3rpx);
  }
}
.benefit-title{
	font-family: "AlimamaFangYuanTi" !important;
	font-size: 20rpx;
	font-weight: normal;
	line-height: 40rpx;
	display: flex;
	align-items: center;
	letter-spacing: 0.06rem;
	color: #FFF98F;
}
.xintext{
	font-family: "AlimamaFangYuanTi" !important;
	font-size: 10rpx;
	font-weight: normal;
	line-height: 35rpx;
	text-align: center;
	display: flex;
	align-items: flex-start;
	letter-spacing: 0.06rem;
	height: 610rpx;
	padding: 10rpx;
	    width: 90%;
	    justify-content: center;
}
.xian{
	border-right: 1px solid #D8D8D8;
}
.benefits-scroll {
  overflow-y: auto;
}
.th-all_tab{
	color: #157dff;
	font-weight: bold;
	font-size: 34rpx;
}
</style>