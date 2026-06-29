<template>
	<view class="navbar" :class="theme">
		<view class="navbar__content">
			<view class="logo">
				<text class="logo__text">{{title || 'AI智汇社'}}</text>
			</view>
			<view class="nav-actions">
				<view class="search-btn" @tap="handleSearch">
					<text class="icon">🔍</text>
				</view>
				<view class="message-btn" @tap="handleMessage">
					<text class="icon">💬</text>
					<view class="badge" v-if="unreadCount">{{unreadCount}}</view>
				</view>
			</view>
		</view>
	</view>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
	title: {
		type: String,
		default: ''
	},
	theme: {
		type: String,
		default: 'dark'
	}
})

const unreadCount = ref(2)

function handleSearch() {
	uni.vibrateShort()
	uni.showToast({
		title: '搜索功能开发中',
		icon: 'none'
	})
}

function handleMessage() {
	uni.vibrateShort()
	uni.showToast({
		title: '消息功能开发中',
		icon: 'none'
	})
}
</script>

<style lang="scss" scoped>
.navbar {
	position: fixed;
	top: 0;
	left: 0;
	right: 0;
	z-index: 100;
	backdrop-filter: blur(40px);
	background: linear-gradient(180deg, 
		rgb(10 10 15 / 0.95), 
		rgb(15 15 20 / 0.85)
	);
	border-bottom: 1px solid rgb(0 242 255 / 0.15);
	box-shadow: 
		0 0 30rpx rgb(0 0 0 / 0.4),
		inset 0 0 60rpx rgb(0 242 255 / 0.02);
	
	&::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 1px;
		background: linear-gradient(90deg, 
			transparent,
			rgb(0 242 255 / 0.6),
			rgb(139 92 246 / 0.6),
			transparent
		);
		opacity: 0.6;
		filter: blur(1px);
		animation: gradientFlow 6s linear infinite;
	}
	
	&.light {
		background: linear-gradient(180deg, 
			rgb(255 255 255 / 0.95), 
			rgb(250 250 250 / 0.9)
		);
		border-bottom: 1px solid rgb(0 0 0 / 0.08);
		box-shadow: 
			0 2rpx 20rpx rgb(0 0 0 / 0.06),
			inset 0 0 60rpx rgb(255 255 255 / 0.5);
		
		&::before {
			background: linear-gradient(90deg, 
				transparent,
				rgb(0 242 255 / 0.3),
				rgb(139 92 246 / 0.3),
				transparent
			);
			opacity: 0.4;
		}
		
		.logo__text {
			background: linear-gradient(135deg, #00F2FF, #8B5CF6);
			background-size: 200% 100%;
			animation: gradientFlow 6s linear infinite;
			-webkit-background-clip: text;
			-webkit-text-fill-color: transparent;
			text-shadow: none;
		}
		
		.search-btn, .message-btn {
			background: rgb(0 242 255 / 0.08);
			border: 1px solid rgb(0 242 255 / 0.2);
			
			&::before {
				background: linear-gradient(90deg, transparent, rgb(0 242 255 / 0.3), transparent);
			}
			
			&:active {
				background: rgb(0 242 255 / 0.12);
				box-shadow: 
					0 0 30rpx rgb(0 242 255 / 0.15),
					inset 0 0 20rpx rgb(0 242 255 / 0.08);
			}
		}
	}
	
	&__content {
		padding: 24rpx 32rpx;
		padding-top: calc(24rpx + env(safe-area-inset-top));
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
}

.logo {
	display: flex;
	align-items: center;
	gap: 20rpx;
	position: relative;
	
	&__text {
		font-size: 38rpx;
		font-weight: 800;
		letter-spacing: 1px;
		background: linear-gradient(135deg, #00F2FF, #8B5CF6, #00F2FF);
		background-size: 200% 100%;
		animation: gradientFlow 6s linear infinite;
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		text-shadow: 0 0 30rpx rgb(0 242 255 / 0.5);
	}
	
	&::after {
		content: '';
		position: absolute;
		bottom: -8rpx;
		left: 0;
		width: 70%;
		height: 2px;
		background: linear-gradient(90deg, rgb(0 242 255 / 0.8), transparent);
		filter: blur(1px);
		opacity: 0.8;
	}
}

.nav-actions {
	display: flex;
	align-items: center;
	gap: 28rpx;
}

.search-btn, .message-btn {
	width: 80rpx;
	height: 80rpx;
	background: rgb(0 242 255 / 0.05);
	border-radius: 20rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	position: relative;
	transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
	border: 1px solid rgb(0 242 255 / 0.15);
	overflow: hidden;
	backdrop-filter: blur(30px);
	
	&::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 1px;
		background: linear-gradient(90deg, transparent, rgb(0 242 255 / 0.4), transparent);
		filter: blur(1px);
	}
	
	&::after {
		content: '';
		position: absolute;
		inset: 0;
		background: radial-gradient(circle at center, rgb(0 242 255 / 0.15) 0%, transparent 70%);
		opacity: 0;
		transition: opacity 0.3s ease;
	}
	
	&:active {
		transform: scale(0.95) translateY(2rpx);
		background: rgb(0 242 255 / 0.08);
		box-shadow: 
			0 0 40rpx rgb(0 242 255 / 0.2),
			inset 0 0 30rpx rgb(0 242 255 / 0.1);
		
		&::after {
			opacity: 1;
		}
	}
	
	.icon {
		font-size: 40rpx;
		filter: drop-shadow(0 0 15rpx rgb(0 242 255 / 0.5));
		transform: translateZ(0);
	}
}

.badge {
	position: absolute;
	top: -8rpx;
	right: -8rpx;
	min-width: 36rpx;
	height: 36rpx;
	padding: 0 10rpx;
	background: linear-gradient(135deg, #00F2FF, #8B5CF6);
	border-radius: 15rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 22rpx;
	color: #fff;
	font-weight: bold;
	box-shadow: 
		0 0 30rpx rgb(0 242 255 / 0.5),
		inset 0 0 8rpx rgb(255 255 255 / 0.5);
	animation: badgePulse 2s infinite;
	border: 1px solid rgb(255 255 255 / 0.3);
	transform: translateZ(0);
	text-shadow: 0 0 10rpx rgb(0 242 255 / 0.5);
}

@keyframes badgePulse {
	0% {
		box-shadow: 0 0 20rpx rgb(0 242 255 / 0.4);
	}

	50% {
		box-shadow: 0 0 40rpx rgb(0 242 255 / 0.6);
	}

	100% {
		box-shadow: 0 0 20rpx rgb(0 242 255 / 0.4);
	}
}

@keyframes gradientFlow {
	0% {
		background-position: 0% 50%;
	}

	50% {
		background-position: 100% 50%;
	}

	100% {
		background-position: 0% 50%;
	}
}
</style> 
