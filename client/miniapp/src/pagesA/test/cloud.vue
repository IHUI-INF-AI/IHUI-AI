<template>
	<view class="cloud-test-page">
		<view class="status-card">
			<view class="title">云环境状态</view>
			<view class="status-item">
				<text class="label">云开发状态:</text>
				<text class="value" :class="cloudEnabled ? 'success' : 'error'">
					{{ cloudEnabled ? '已启用' : '已禁用' }}
				</text>
			</view>
			<view class="status-item">
				<text class="label">VIP状态:</text>
				<text class="value" :class="isVip ? 'success' : 'error'">
					{{ isVip ? '已开通' : '未开通' }}
				</text>
			</view>
		</view>
		
		<view class="action-card">
			<view class="title">功能测试</view>
			<button class="action-btn" @tap="testCloudInit">测试云初始化</button>
			<button class="action-btn" @tap="testLogin">测试登录</button>
			<button class="action-btn" @tap="testVipCheck">测试VIP检查</button>
			<button class="action-btn" @tap="testCloudFunction">测试云函数调用</button>
			<button class="action-btn" @tap="testDirectCloudDB">测试直接云数据库连接</button>
			<button class="action-btn" @tap="testDirectCloudFunction">测试直接云函数调用</button>
		</view>
		
		<view class="log-card">
			<view class="title">测试日志</view>
			<scroll-view class="log-content" scroll-y>
				<view v-for="(log, index) in logs" :key="index" class="log-item" :class="log.type">
					<text class="log-time">{{ log.time }}</text>
					<text class="log-msg">{{ log.message }}</text>
				</view>
			</scroll-view>
		</view>
	</view>
</template>

<script setup>
import { ref, computed, getCurrentInstance } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useUserStore } from '@/store/modules/user'

const userStore = useUserStore()
const { proxy } = getCurrentInstance()

const logs = ref([])
const cloudEnabled = ref(false)

const isVip = computed(() => userStore.userInfo?.isVip || false)

function addLog(type, message) {
	const now = new Date()
	const time = `${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`
	logs.value.unshift({
		type,
		time,
		message
	})
}

async function testCloudInit() {
	addLog('info', '测试云初始化...')
	try {
		cloudEnabled.value = proxy.$cloudEnabled || false
		addLog('success', `云环境状态: ${cloudEnabled.value ? '已启用' : '已禁用'}`)
		
		if (typeof uniCloud !== 'undefined') {
			addLog('success', 'uniCloud对象存在')
			
			if (uniCloud.mixinDatacom) {
				addLog('success', 'uniCloud.mixinDatacom存在, 阿里云配置正常')
			}
			
			if (uniCloud.config && uniCloud.config.spaceId) {
				addLog('success', `服务空间ID: ${uniCloud.config.spaceId}`)
			} else {
				addLog('warning', '无法获取服务空间ID')
			}
		} else {
			addLog('error', 'uniCloud对象不存在，请检查网络和配置')
		}
	} catch (error) {
		addLog('error', `云初始化测试错误: ${error.message}`)
	}
}

async function testLogin() {
	addLog('info', '测试登录...')
	try {
		const result = await userStore.wxLogin('test')
		addLog('success', `登录结果: ${result ? '成功' : '失败'}`)
	} catch (error) {
		addLog('error', `登录测试错误: ${error.message}`)
	}
}

async function testVipCheck() {
	addLog('info', '测试VIP状态检查...')
	try {
		const result = await userStore.checkLoginStatus()
		addLog('success', `VIP状态: ${result ? '已开通' : '未开通'}`)
	} catch (error) {
		addLog('error', `VIP检查错误: ${error.message}`)
	}
}

async function testCloudFunction() {
	addLog('info', '测试云函数调用...')
	try {
		if (!proxy.$callFunction) {
			addLog('error', '云函数调用方法不存在')
			return
		}
		
		const result = await proxy.$callFunction('login', {
			action: 'checkVipStatus',
			params: {
				userId: 'test'
			}
		})
		
		addLog('success', `云函数调用结果: ${JSON.stringify(result.result)}`)
	} catch (error) {
		addLog('error', `云函数调用错误: ${error.message}`)
	}
}

async function testDirectCloudDB() {
	addLog('info', '直接测试云数据库连接...')
	try {
		const db = uniCloud.database()
		addLog('success', 'uniCloud.database()调用成功')
		
		try {
			const userCollection = db.collection('user')
			addLog('success', '成功引用user集合')
			
			const countResult = await userCollection.count()
			addLog('success', `用户集合数量: ${countResult.total}`)
		} catch (dbError) {
			addLog('error', `集合访问错误: ${dbError.message}`)
		}
	} catch (error) {
		addLog('error', `数据库连接错误: ${error.message}`)
	}
}

async function testDirectCloudFunction() {
	addLog('info', '直接测试云函数调用...')
	try {
		if (typeof uniCloud === 'undefined') {
			addLog('error', 'uniCloud对象不存在')
			return
		}
		
		try {
			const result = await uniCloud.callFunction({
				name: 'login',
				data: {
					action: 'checkVipStatus',
					params: {
						userId: 'test'
					}
				}
			})
			
			addLog('success', `直接云函数调用结果: ${JSON.stringify(result.result || {})}`)
		} catch (fnError) {
			addLog('error', `直接云函数调用失败: ${fnError.message}`)
		}
	} catch (error) {
		addLog('error', `函数测试错误: ${error.message}`)
	}
}

onLoad(() => {
	cloudEnabled.value = proxy.$cloudEnabled || false
	addLog('info', '页面加载完成')
	addLog('info', `云环境状态: ${cloudEnabled.value ? '已启用' : '已禁用'}`)
})
</script>

<style lang="scss">
.cloud-test-page {
	padding: 30rpx;
	background-color: #f5f5f5;
	min-height: 100vh;
	
	.status-card, .action-card, .log-card {
		background-color: #fff;
		border-radius: 20rpx;
		padding: 30rpx;
		margin-bottom: 30rpx;
		box-shadow: 0 0 16rpx rgb(0 0 0 / 0.05);
		
		.title {
			font-size: 36rpx;
			font-weight: bold;
			margin-bottom: 20rpx;
			color: #333;
		}
	}
	
	.status-item {
		display: flex;
		justify-content: space-between;
		padding: 16rpx 0;
		border-bottom: 1px solid #f0f0f0;
		
		.label {
			color: #666;
		}
		
		.value {
			font-weight: bold;
			
			&.success {
				color: #4CAF50;
			}
			
			&.warning {
				color: #FF9800;
			}
			
			&.error {
				color: #F44336;
			}
		}
	}
	
	.action-btn {
		margin: 16rpx 0;
		background-color: #007AFF;
		color: #fff;
		font-size: 30rpx;
		
		&:active {
			opacity: 0.8;
		}
	}
	
	.log-content {
		height: 600rpx;
		border: 1px solid #eee;
		border-radius: 8rpx;
		padding: 20rpx;
	}
	
	.log-item {
		padding: 10rpx 0;
		font-size: 28rpx;
		border-bottom: 1px solid #f5f5f5;
		
		&.info {
			color: #2196F3;
		}
		
		&.success {
			color: #4CAF50;
		}
		
		&.error {
			color: #F44336;
		}
		
		.log-time {
			font-size: 24rpx;
			margin-right: 10rpx;
			opacity: 0.7;
		}
	}
}
</style> 