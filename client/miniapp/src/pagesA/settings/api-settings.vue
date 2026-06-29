<template>
	<view class="container">
		<!-- 顶部导航栏 -->
		<view class="navbar glass flex-between">
			<view class="navbar__title text-neon">API 设置</view>
			<view class="navbar__actions flex">
				<view class="navbar__icon flex-center" @click="goBack">
					<text class="iconfont icon-back"></text>
				</view>
			</view>
		</view>
		
		<!-- 设置内容 -->
		<view class="settings-content">
			<view class="settings-section">
				<view class="section-title">Coze API 配置</view>
				
				<view class="input-group">
					<view class="input-label">API 令牌（Token）</view>
					<input 
						type="text" 
						v-model="apiToken" 
						placeholder="请输入您的Coze API令牌..." 
						:password="!showToken"
					/>
					<view class="input-action" @tap="toggleTokenVisibility">
						<text :class="showToken ? 'icon-eye-open' : 'icon-eye-close'"></text>
					</view>
				</view>
				
				<view class="input-group">
					<view class="input-label">工作流 ID（Workflow ID）</view>
					<input 
						type="text" 
						v-model="workflowId" 
						placeholder="请输入工作流ID..." 
					/>
				</view>
				
				<view class="settings-hint">
					<text>提示：您可以从Coze平台获取API令牌和工作流ID。</text>
				</view>
				
				<button class="save-btn" @tap="saveSettings">保存设置</button>
			</view>
			
			<view class="settings-section">
				<view class="section-title">关于API</view>
				<view class="description">
					<text>
						Coze API允许您使用已创建的智能助手来处理文章内容。文章重构工具使用此API来提取文章要点并生成更简洁的版本。
					</text>
				</view>
				
				<view class="api-docs">
					<view class="docs-title">API 请求示例</view>
					<view class="code-block">
						<text>POST https://api.coze.cn/v1/workflow/run
						
Headers:
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

Body:
{
  "workflow_id": "YOUR_WORKFLOW_ID",
  "parameters": {
    "user_id": "用户ID",
    "article_content": "文章内容"
  }
}</text>
					</view>
				</view>
			</view>
		</view>
	</view>
</template>

<script setup>
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'

const apiToken = ref('')
const workflowId = ref('')
const showToken = ref(false)

function goBack() {
	uni.navigateBack();
}

function toggleTokenVisibility() {
	showToken.value = !showToken.value;
}

function saveSettings() {
	if (!apiToken.value || !workflowId.value) {
		uni.showToast({
			title: '请填写完整的API配置信息',
			icon: 'none'
		});
		return;
	}
	
	uni.setStorageSync('coze_token', apiToken.value);
	uni.setStorageSync('coze_workflow_id', workflowId.value);
	
	uni.showToast({
		title: '设置已保存',
		icon: 'success'
	});
	
	setTimeout(() => {
		uni.navigateBack();
	}, 1500);
}

onLoad(() => {
	apiToken.value = uni.getStorageSync('coze_token') || '';
	workflowId.value = uni.getStorageSync('coze_workflow_id') || '';
})
</script>

<style lang="scss" scoped>
.container {
	display: flex;
	flex-direction: column;
	min-height: 100vh;
	background-color: #121217;
}

/* 导航栏 */
.navbar {
	padding: 20rpx;
	background-color: rgb(18 18 23 / 0.95);
	border-bottom: 1px solid rgb(0 242 255 / 0.15);
	box-shadow: 0 0 10rpx rgb(0 0 0 / 0.3);
	
	&__title {
		font-size: 36rpx;
		font-weight: bold;
		text-align: center;
		color: rgb(0 242 255 / 0.8);
		text-shadow: 0 0 10rpx rgb(0 242 255 / 0.5);
	}
	
	&__icon {
		width: 70rpx;
		height: 70rpx;
		border-radius: 50%;
		background-color: rgb(31 31 40 / 0.8);
		font-size: 32rpx;
		position: relative;
		box-shadow: 0 0 15px rgb(0 0 0 / 0.3);
		border: 1px solid rgb(0 242 255 / 0.3);
	}
}

/* 设置内容 */
.settings-content {
	flex: 1;
	padding: 30rpx;
	display: flex;
	flex-direction: column;
	gap: 30rpx;
}

.settings-section {
	background-color: rgb(31 31 40 / 0.6);
	border-radius: 20rpx;
	padding: 30rpx;
	border: 1px solid rgb(0 242 255 / 0.2);
	
	.section-title {
		font-size: 32rpx;
		font-weight: bold;
		color: rgb(0 242 255 / 0.8);
		margin-bottom: 30rpx;
	}
	
	.input-group {
		margin-bottom: 30rpx;
		position: relative;
		
		.input-label {
			font-size: 28rpx;
			color: rgb(255 255 255 / 0.8);
			margin-bottom: 10rpx;
		}
		
		input {
			width: 100%;
			height: 80rpx;
			background-color: rgb(15 15 20 / 0.6);
			border-radius: 8rpx;
			padding: 0 80rpx 0 20rpx;
			color: #fff;
			border: 1px solid rgb(0 242 255 / 0.3);
		}
		
		.input-action {
			position: absolute;
			right: 20rpx;
			bottom: 20rpx;
			font-size: 40rpx;
			color: rgb(255 255 255 / 0.6);
		}
	}
	
	.settings-hint {
		font-size: 24rpx;
		color: rgb(255 255 255 / 0.5);
		margin-bottom: 30rpx;
		line-height: 1.5;
	}
	
	.save-btn {
		background-color: rgb(0 242 255 / 0.3);
		color: #fff;
		font-size: 32rpx;
		padding: 20rpx;
		border-radius: 30rpx;
		border: 1px solid rgb(0 242 255 / 0.5);
		margin-top: 20rpx;
	}
	
	.description {
		font-size: 28rpx;
		color: rgb(255 255 255 / 0.7);
		line-height: 1.6;
		margin-bottom: 30rpx;
	}
	
	.api-docs {
		.docs-title {
			font-size: 28rpx;
			color: rgb(255 255 255 / 0.8);
			margin-bottom: 10rpx;
		}
		
		.code-block {
			background-color: rgb(15 15 20 / 0.8);
			border-radius: 8rpx;
			padding: 20rpx;
			font-family: monospace;
			font-size: 24rpx;
			color: rgb(255 255 255 / 0.7);
			line-height: 1.5;
			white-space: pre-wrap;
			overflow-x: auto;
			border: 1px solid rgb(0 242 255 / 0.2);
		}
	}
}

.flex-between {
	display: flex;
	justify-content: space-between;
	align-items: center;
}
</style> 
