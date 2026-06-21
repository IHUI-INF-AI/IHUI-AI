<template>
	<view class="ai-circle">
		<view class="ai-circle-header">
			<text class="ai-circle-title">AI圈</text>
		</view>
		
		<view class="ai-circle-content">
			<view class="empty-state">
				<view class="empty-icon">🔮</view>
				<text class="empty-text">AI圈功能开发中，敬请期待...</text>
			</view>
		</view>
	</view>
</template>

<script setup>
import { ref } from 'vue'

const title = ref('AI圈')

onLoad(() => {});
</script>

<style lang="scss">
.ai-circle {
	min-height: 100vh;
	background-color: #121217;
	padding-top: var(--status-bar-height);
	
	.ai-circle-header {
		height: 90rpx;
		display: flex;
		align-items: center;
		justify-content: center;
		position: relative;
		
		.ai-circle-title {
			font-size: 36rpx;
			font-weight: bold;
			color: #ffffff;
			text-shadow: 0 0 10rpx rgba(0, 242, 255, 0.5);
		}
	}
	
	.ai-circle-content {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 60vh;
		padding: 40rpx;
	}
	
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		
		.empty-icon {
			font-size: 120rpx;
			margin-bottom: 30rpx;
			opacity: 0.7;
			background: linear-gradient(135deg, #00F2FF, #8B5CF6);
			-webkit-background-clip: text;
			color: transparent;
			text-shadow: 0 0 30rpx rgba(0, 242, 255, 0.5);
		}
		
		.empty-text {
			font-size: 28rpx;
			color: rgba(255, 255, 255, 0.6);
			text-align: center;
		}
	}
}
</style>
