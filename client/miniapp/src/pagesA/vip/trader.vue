<template>
	<view class="vip-page">
		<view class="header">
			<image class="bg-image" src="/static/vip-bg.png" mode="aspectFill"></image>
			<view class="content">
				<view class="title">AI智汇社 操盘手</view>
				<view class="subtitle">一次性支付{{ dataInfo.amount }}元，终身使用</view>
				<view class="price-box">
					<text class="current-price">¥{{ dataInfo.amount }}</text>
				</view>
			</view>
		</view>

		<view class="features">
			<view class="section-title">操盘手权益</view>
			<view class="feature-list">
				<view class="feature-item" v-for="feature in features" :key="feature.id">
					<text class="feature-icon">{{ feature.icon }}</text>
					<view class="feature-info">
						<text class="feature-title">{{ feature.title }}</text>
						<text class="feature-desc">{{ feature.desc }}</text>
					</view>
				</view>
			</view>
		</view>

		<view class="buy-section">
			<view class="price-info">
				<view class="price">
					<text class="symbol">¥</text>
					<text class="number">{{ dataInfo.amount }}</text>
				</view>
			</view>
			<button class="buy-btn" @tap="openPopup">一键开通会员</button>
		</view>
		<ConfirmPurchasePopUp :dataInfo="dataInfo" :vipFeatures="vipFeatures" :visible="showPopup"
			@updateVisible="handlePayment" />
	</view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useUserStore } from '@/store/modules/user'
import { getvipPrice } from "@/service/vip.js";
import ConfirmPurchasePopUp from '@/pagesA/ConfirmPurchasePopUp/index.vue'

const store = useUserStore()

const showPopup = ref(false)
const features = ref([
	{
		id: 'distribution_qualification',
		title: '享受大额分销资格,入驻社区服务商名列',
		icon: '🏅',
	},
	{
		id: 'ai_courses',
		title: 'AI深度认知课,降维看世界课程/深度商业课/流量全链路打法课程/免费观看',
		icon: '🎓',
	},
	{
		id: 'founder_qa',
		title: '创始人一对一随时答疑陪跑',
		icon: '🤝',
	},
	{
		id: 'agent_beta',
		title: '最新研发agent内测资格一年',
		icon: '🧪',
	},
	{
		id: 'vip_max_discount',
		title: '会员等级拉满,享受全部最高折扣',
		icon: '💎',
	},
	{
		id: 'custom_agent_discount',
		title: '插队定制独家定制agent功能8折优惠',
		icon: '⚡',
	},
	{
		id: 'all_vip_rights',
		title: '会员享受的全部权益',
		icon: '🎁',
	},
	{
		id: 'vertical_account_incubation',
		title: 'AI+垂类账号孵化优先陪跑机会',
		icon: '🚀',
	},
	{
		id: 'secondary_distribution',
		title: '二级分销权益,快速扩张团队及收益',
		icon: '🌐',
	},
	{
		id: 'offline_learning',
		title: '公司总部入驻及线下学习实操机会',
		icon: '🏢',
	},
	{
		id: 'free_computing_power',
		title: '操盘手赠送1600W算力',
		icon: '💡',
	},
	{
		id: 'large_knowledge_base',
		title: '开通个人知识库超大20G空间',
		icon: '🗂️',
	},
	{
		id: 'ai_customization',
		title: '插队AI分身/AI客服定制开通',
		icon: '🤖',
	}
])
const dataInfo = ref({})

const vipFeatures = computed(() => store.vipFeatures)

function purchaseVip() {
	return store.purchaseVip()
}

onShow(() => {
	getvipPrice(uni.getStorageSync("data").token).then(res => {
		if (res.code == "200") {
			dataInfo.value = res.data
		}
	})
})

function openPopup() {
	showPopup.value = true
}

function handlePayment() {
	showPopup.value = false
}
</script>

<style lang="scss" scoped>
.vip-page {
	min-height: 100vh;
	background: linear-gradient(135deg, #0F1623, #1F2937);
	padding-bottom: calc(140rpx + env(safe-area-inset-bottom));
}

.header {
	position: relative;
	height: 400rpx;
	overflow: hidden;

	.bg-image {
		position: absolute;
		width: 100%;
		height: 100%;
		z-index: 1;
	}

	.content {
		position: relative;
		z-index: 2;
		padding: 60rpx 40rpx;
		color: #fff;

		.title {
			font-size: 48rpx;
			font-weight: bold;
			margin-bottom: 16rpx;
			text-shadow: 0 2rpx 10rpx rgb(0 0 0 / 0.3);
		}

		.subtitle {
			font-size: 28rpx;
			opacity: 0.9;
			margin-bottom: 40rpx;
		}

		.price-box {
			display: flex;
			align-items: baseline;
			gap: 20rpx;

			.current-price {
				font-size: 64rpx;
				font-weight: bold;
				color: #FFD700;
				text-shadow: 0 2rpx 10rpx rgb(255 215 0 / 0.3);
			}
		}
	}
}

.features {
	padding: 40rpx;

	.section-title {
		font-size: 32rpx;
		color: #fff;
		margin-bottom: 32rpx;
		font-weight: bold;
	}

	.feature-list {
		display: flex;
		flex-direction: column;
		gap: 24rpx;
	}

	.feature-item {
		display: flex;
		align-items: center;
		gap: 24rpx;
		padding: 24rpx;
		background: rgb(255 255 255 / 0.05);
		border-radius: 15rpx;
		border: 1px solid rgb(255 255 255 / 0.1);

		.feature-icon {
			font-size: 40rpx;
			width: 80rpx;
			height: 80rpx;
			background: rgb(255 255 255 / 0.1);
			border-radius: 30rpx;
			display: flex;
			align-items: center;
			justify-content: center;
		}

		.feature-info {
			flex: 1;

			.feature-title {
				font-size: 28rpx;
				color: #fff;
				margin-bottom: 8rpx;
				display: block;
			}

			.feature-desc {
				font-size: 24rpx;
				color: rgb(255 255 255 / 0.6);
				display: block;
			}
		}

		.feature-tag {
			padding: 4rpx 16rpx;
			background: linear-gradient(135deg, #FFD700, #FFA500);
			border-radius: 20rpx;
			font-size: 20rpx;
			color: #1F2937;
			font-weight: bold;
		}
	}
}

.buy-section {
	position: fixed;
	bottom: 0;
	left: 0;
	right: 0;
	padding: 24rpx 40rpx;
	padding-bottom: calc(24rpx + env(safe-area-inset-bottom));
	background: rgb(15 23 42 / 0.95);
	backdrop-filter: blur(20px);
	border-top: 1px solid rgb(255 255 255 / 0.1);
	display: flex;
	align-items: center;
	justify-content: space-between;

	.price-info {
		.price {
			display: flex;
			align-items: baseline;

			.symbol {
				font-size: 32rpx;
				color: #fff;
				margin-right: 4rpx;
			}

			.number {
				font-size: 48rpx;
				font-weight: bold;
				color: #fff;
			}
		}
	}

	.buy-btn {
		padding: 20rpx 48rpx;
		background: linear-gradient(135deg, #FFD700, #FFA500);
		border-radius: 30rpx;
		font-size: 32rpx;
		color: #1F2937;
		font-weight: bold;
		border: none;

		&:active {
			transform: scale(0.98);
			background: linear-gradient(135deg, #FFC700, #FF9500);
		}
	}
}
</style>
