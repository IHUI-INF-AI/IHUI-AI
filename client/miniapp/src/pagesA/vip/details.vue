<template>
	<view class="vip-details-page">
		<!-- 页面头部 -->
		<view class="page-header">
			<view class="back-button" @click="navigateBack">
				<text class="iconfont icon-back"></text>
			</view>
			<text class="page-title">会员详情</text>
			<view class="header-actions">
				<view class="action-btn">
					<text class="action-dots">•••</text>
				</view>
				<view class="action-btn">
					<text class="action-circle">◯</text>
				</view>
			</view>
		</view>
		
		<!-- 月度会员卡片 -->
		<view class="vip-card monthly">
			<view class="card-header">
				<view class="vip-type">
					<text class="title">月度会员</text>
					<text class="days">30</text>
				</view>
				<view class="vip-price">
					<text class="price-symbol">¥</text>
					<text class="price-value">39.9</text>
				</view>
			</view>
			
			<view class="benefits-list">
				<view class="benefit-item">
					<text class="benefit-icon">✓</text>
					<text class="benefit-text">全站课程免费学习</text>
				</view>
				<view class="benefit-item">
					<text class="benefit-icon">✓</text>
					<text class="benefit-text">全站资源免费下载</text>
				</view>
				<view class="benefit-item">
					<text class="benefit-icon">✓</text>
					<text class="benefit-text">专属社群交流</text>
				</view>
				<view class="benefit-item">
					<text class="benefit-icon">✓</text>
					<text class="benefit-text">技术支持服务</text>
				</view>
			</view>
			
			<view class="vip-button" @click="choosePlan('monthly')">
				<text>选择</text>
			</view>
		</view>
		
		<!-- 年度会员卡片 -->
		<view class="vip-card yearly">
			<view class="card-header">
				<view class="vip-type">
					<text class="title">年度会员</text>
					<text class="days">365</text>
				</view>
				<view class="vip-price">
					<text class="price-symbol">¥</text>
					<text class="price-value">299</text>
				</view>
			</view>
			
			<view class="benefits-list">
				<view class="benefit-item">
					<text class="benefit-icon">✓</text>
					<text class="benefit-text">月度会员所有权益</text>
				</view>
				<view class="benefit-item">
					<text class="benefit-icon">✓</text>
					<text class="benefit-text">专属一对一指导</text>
				</view>
				<view class="benefit-item">
					<text class="benefit-icon">✓</text>
					<text class="benefit-text">项目落地指导</text>
				</view>
				<view class="benefit-item">
					<text class="benefit-icon">✓</text>
					<text class="benefit-text">高额返佣特权</text>
				</view>
			</view>
			
			<view class="vip-button" @click="choosePlan('yearly')">
				<text>选择</text>
			</view>
		</view>
	</view>
</template>

<script setup>
// 返回上一页
function navigateBack() {
	uni.navigateBack({
		delta: 1
	});
}

// 选择会员方案
function choosePlan(plan) {
	const planData = {
		type: plan,
		name: plan === 'yearly' ? '年度会员' : '月度会员',
		price: plan === 'yearly' ? 299 : 39.9,
		days: plan === 'yearly' ? 365 : 30
	};

	const hasLogin = uni.getStorageSync('data')?.phone;

	if (!hasLogin) {
		uni.showModal({
			title: '提示',
			content: '请先登录后再开通会员',
			confirmText: '去登录',
			success: (res) => {
				if (res.confirm) {
					uni.navigateBack();
				}
			}
		});
		return;
	}

	uni.showLoading({
		title: '处理中...'
	});

	setTimeout(() => {
		uni.hideLoading();

		uni.navigateTo({
			url: `/pagesA/vip/paySuccess?plan=${planData.type}&price=${planData.price}&days=${planData.days}&name=${encodeURIComponent(planData.name)}`,
			success: () => {
			},
			fail: (err) => {
			}
		});
	}, 1000);
}
</script>

<style lang="scss">
	.vip-details-page {
		min-height: 100vh;
		background-color: #030a1c;
		background: none;
		padding-bottom: 80rpx;
		position: relative;
		
		&::before {
			content: '';
			position: fixed;
			top: 0;
			left: 0;
			right: 0;
			height: 40%;
			background: linear-gradient(to bottom, rgb(8 78 170 / 0.12), transparent);
			z-index: 0;
		}
	}
	
	/* 页面头部 */
	.page-header {
		padding: 40rpx 30rpx;
		display: flex;
		justify-content: space-between;
		align-items: center;
		position: relative;
		z-index: 1;
	}
	
	.back-button {
		width: 80rpx;
		height: 80rpx;
		display: flex;
		align-items: center;
		justify-content: center;
		
		.iconfont {
			font-size: 44rpx;
			color: #fff;
		}
	}
	
	.page-title {
		font-size: 40rpx;
		font-weight: bold;
		color: #fff;
		text-shadow: 0 0 15rpx rgb(5 122 255 / 0.6);
		position: relative;
		
		&::after {
			content: '';
			position: absolute;
			left: 50%;
			bottom: -12rpx;
			width: 60rpx;
			height: 4rpx;
			background: #057aff;
			transform: translateX(-50%);
			box-shadow: 0 0 10rpx rgb(5 122 255 / 0.8);
			border-radius: 8rpx;
		}
	}
	
	.header-actions {
		display: flex;
	}
	
	.action-btn {
		width: 80rpx;
		height: 80rpx;
		display: flex;
		align-items: center;
		justify-content: center;
		margin-left: 10rpx;
		
		&:active {
			opacity: 0.8;
		}
	}
	
	.action-dots {
		font-size: 40rpx;
		color: #fff;
	}
	
	.action-circle {
		font-size: 44rpx;
		color: #fff;
	}
	
	/* 会员卡片共通样式 */
	.vip-card {
		margin: 30rpx;
		padding: 30rpx;
		background: rgb(8 20 40 / 0.5);
		border-radius: 20rpx;
		backdrop-filter: blur(10px);
		border: 1px solid rgb(5 122 255 / 0.2);
		box-shadow: 0 0 35rpx rgb(0 0 0 / 0.3), 0 0 20rpx rgb(5 122 255 / 0.1);
		position: relative;
		z-index: 1;
		overflow: hidden;
		
		&::before {
			content: '';
			position: absolute;
			top: 0;
			left: 0;
			right: 0;
			height: 1px;
			background: linear-gradient(90deg, transparent, rgb(5 122 255 / 0.4), transparent);
		}
	}
	
	/* 月度会员卡片 */
	.monthly {
		&::after {
			content: '';
			position: absolute;
			inset: 0;
			background: linear-gradient(135deg, rgb(5 122 255 / 0.1), transparent 70%);
			z-index: -1;
		}
	}
	
	/* 年度会员卡片 */
	.yearly {
		&::after {
			content: '';
			position: absolute;
			inset: 0;
			background: linear-gradient(135deg, rgb(255 215 0 / 0.1), transparent 70%);
			z-index: -1;
		}
		
		.vip-price {
			.price-symbol, .price-value {
				color: #ffd700;
				text-shadow: 0 0 15rpx rgb(255 215 0 / 0.5);
			}
		}
		
		.vip-button {
			background: linear-gradient(135deg, #DAA520, #FFD700);
			box-shadow: 0 0 15rpx rgb(255 215 0 / 0.3), 0 0 30rpx rgb(255 215 0 / 0.1);
		}
	}
	
	.card-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 30rpx;
	}
	
	.vip-type {
		display: flex;
		flex-direction: column;
	}
	
	.title {
		font-size: 36rpx;
		font-weight: bold;
		color: #fff;
		margin-bottom: 8rpx;
		text-shadow: 0 0 10rpx rgb(5 122 255 / 0.4);
	}
	
	.days {
		font-size: 28rpx;
		color: rgb(255 255 255 / 0.7);
	}
	
	.vip-price {
		display: flex;
		align-items: flex-start;
	}
	
	.price-symbol {
		font-size: 36rpx;
		color: #057aff;
		font-weight: bold;
		line-height: 1;
		margin-top: 8rpx;
		text-shadow: 0 0 15rpx rgb(5 122 255 / 0.5);
	}
	
	.price-value {
		font-size: 60rpx;
		color: #057aff;
		font-weight: bold;
		line-height: 1;
		text-shadow: 0 0 15rpx rgb(5 122 255 / 0.5);
	}
	
	.benefits-list {
		margin-bottom: 30rpx;
	}
	
	.benefit-item {
		display: flex;
		align-items: center;
		margin-bottom: 18rpx;
		
		&:last-child {
			margin-bottom: 0;
		}
	}
	
	.benefit-icon {
		font-size: 32rpx;
		color: #FFD700;
		margin-right: 16rpx;
		text-shadow: 0 0 10rpx rgb(255 215 0 / 0.5);
	}
	
	.benefit-text {
		font-size: 28rpx;
		color: rgb(255 255 255 / 0.9);
	}
	
	.vip-button {
		width: 100%;
		height: 90rpx;
		line-height: 90rpx;
		text-align: center;
		background: linear-gradient(135deg, #0550d0, #057aff);
		border-radius: 30rpx;
		font-size: 32rpx;
		color: #fff;
		font-weight: bold;
		box-shadow: 0 0 15rpx rgb(5 122 255 / 0.3), 0 0 30rpx rgb(5 122 255 / 0.1);
		margin-top: 10rpx;
		position: relative;
		overflow: hidden;
		
		&::before {
			content: '';
			position: absolute;
			top: -50%;
			left: -50%;
			width: 200%;
			height: 200%;
			background: linear-gradient(transparent, rgb(255 255 255 / 0.1), transparent);
			transform: rotate(45deg);
			animation: buttonShine 4s infinite;
		}
		
		&:active {
			transform: scale(0.98);
			opacity: 0.9;
		}
	}
	
	@keyframes buttonShine {
		0% { transform: translateX(-100%) rotate(45deg); }
		20%, 100% { transform: translateX(100%) rotate(45deg); }
	}
</style> 
