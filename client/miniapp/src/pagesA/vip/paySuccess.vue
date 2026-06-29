<template>
	<view class="pay-success-page">
		<view class="success-icon">
			<text class="iconfont icon-check-circle"></text>
		</view>
		
		<view class="success-title">支付成功</view>
		
		<view class="success-info">
			<view class="info-item">
				<text class="label">购买方案</text>
				<text class="value">{{ planName }}</text>
			</view>
			<view class="info-item">
				<text class="label">支付金额</text>
				<text class="value">¥{{ price }}</text>
			</view>
			<view class="info-item">
				<text class="label">支付时间</text>
				<text class="value">{{ payTime }}</text>
			</view>
		</view>
		
		<view class="btn-group">
			<button class="btn primary-btn" @click="goToVipCenter">查看会员权益</button>
			<button class="btn outline-btn" @click="goToHome">返回首页</button>
		</view>
	</view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useStore } from 'vuex'

const store = useStore()

const plan = ref('')
const price = ref(0)
const payTime = ref('')
const planName = ref('')
const days = ref('')
const orderNo = ref('')

const userInfo = computed(() => store.state.user.userInfo)
const hasLogin = computed(() => store.state.user.hasLogin)

function formatDate(date) {
	const year = date.getFullYear()
	const month = (date.getMonth() + 1).toString().padStart(2, '0')
	const day = date.getDate().toString().padStart(2, '0')
	const hours = date.getHours().toString().padStart(2, '0')
	const minutes = date.getMinutes().toString().padStart(2, '0')
	const seconds = date.getSeconds().toString().padStart(2, '0')
	
	return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

function getDeviceInfo() {
	const info = {}
	
	try {
		const sysInfo = uni.getSystemInfoSync()
		info.platform = sysInfo.platform
		info.system = sysInfo.system
		info.model = sysInfo.model
		info.brand = sysInfo.brand
		
		const networkType = uni.getNetworkType()
		info.networkType = networkType.networkType
	} catch (e) {
		console.error('获取设备信息失败:', e)
		info.error = '获取设备信息失败'
	}
	
	return info
}

function saveOrderToLocal(orderData) {
	let localOrders = uni.getStorageSync('localOrders') || []
	localOrders.push(orderData)
	
	uni.setStorageSync('localOrders', localOrders)
}

function savePaymentToCloud(expireDate) {
	uni.showLoading({
		title: '保存订单...',
		mask: true
	})
	
	const orderData = {
		userId: userInfo.value._id,
		nickname: userInfo.value.nickname || '用户',
		avatar: userInfo.value.avatar || '',
		orderNo: orderNo.value,
		productId: 'vip_membership_' + plan.value,
		productName: planName.value,
		productType: 'vip',
		planType: plan.value,
		amount: parseFloat(price.value),
		paidAt: new Date(),
		expireTime: expireDate.toISOString(),
		duration: parseInt(days.value),
		paymentMethod: 'android',
		deviceInfo: getDeviceInfo()
	}

	uniCloud.callFunction({
		name: 'order',
		data: {
			action: 'createOrder',
			orderData
		}
	}).then(res => {
		if (res.result && res.result.code === 0) {
			uni.showToast({
				title: '订单已记录',
				icon: 'success',
				duration: 2000
			})
		} else {
			console.error('保存订单失败:', res.result ? res.result.msg : '未知错误')
			saveOrderToLocal(orderData)
		}
	}).catch(err => {
		console.error('调用云函数失败:', err)
		saveOrderToLocal(orderData)
	}).finally(() => {
		uni.hideLoading()
	})
}

function saveAnonymousOrder() {
	const planDays = plan.value === 'yearly' ? 365 : 30
	const expireDate = new Date()
	expireDate.setDate(expireDate.getDate() + planDays)
	
	const orderData = {
		orderNo: orderNo.value,
		productId: 'vip_membership_' + plan.value,
		productName: planName.value,
		productType: 'vip',
		planType: plan.value,
		amount: parseFloat(price.value),
		paidAt: new Date(),
		expireTime: expireDate.toISOString(),
		duration: parseInt(days.value),
		paymentMethod: 'android',
		deviceInfo: getDeviceInfo()
	}
	
	saveOrderToLocal(orderData)

	uni.showToast({
		title: '支付成功',
		icon: 'success',
		duration: 2000
	})
}

function recordPayment() {
	uni.setStorageSync('paidStatus', true)
	
	if (hasLogin.value && userInfo.value) {
		const planDays = plan.value === 'yearly' ? 365 : 30
		const expireDate = new Date()
		expireDate.setDate(expireDate.getDate() + planDays)
		
		const updatedUserInfo = {
			...userInfo.value,
			isVip: true,
			vipExpireTime: expireDate.toISOString(),
			vipDays: planDays
		}
		
		store.commit('user/SET_USER_INFO', updatedUserInfo)
		uni.setStorageSync('userInfo', JSON.stringify(updatedUserInfo))
		
		savePaymentToCloud(expireDate)
	} else {
		saveAnonymousOrder()
	}
}

function goToVipCenter() {
	uni.redirectTo({
		url: '/pagesA/vip/index'
	})
}

function goToHome() {
	uni.switchTab({
		url: '/pages/table/tools/index'
	})
}

onLoad((options) => {
	plan.value = options.plan || 'monthly'
	price.value = options.price || '39.9'
	days.value = options.days || '30'
	
	planName.value = options.name ? decodeURIComponent(options.name) : (plan.value === 'yearly' ? '年度会员' : '月度会员')
	
	orderNo.value = 'VIP' + new Date().getTime()
	
	const now = new Date()
	payTime.value = formatDate(now)
	
	recordPayment()
})
</script>

<style lang="scss">
	.pay-success-page {
		min-height: 100vh;
		background-color: #030a1c;
		background: none;
		padding: 60rpx 30rpx;
		display: flex;
		flex-direction: column;
		align-items: center;
	}
	
	.success-icon {
		width: 200rpx;
		height: 200rpx;
		background: rgba(5, 122, 255, 0.1);
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		margin-bottom: 40rpx;
		border: 1px solid rgba(5, 122, 255, 0.3);
		box-shadow: 0 0 30rpx rgba(5, 122, 255, 0.3);
		
		.iconfont {
			font-size: 120rpx;
			color: #4caf50;
			text-shadow: 0 0 20rpx rgba(76, 175, 80, 0.6);
		}
	}
	
	.success-title {
		font-size: 48rpx;
		font-weight: bold;
		color: #fff;
		margin-bottom: 50rpx;
		text-shadow: 0 0 15rpx rgba(5, 122, 255, 0.6);
	}
	
	.success-info {
		width: 100%;
		background: rgba(8, 20, 40, 0.5);
		border-radius: 20rpx;
		padding: 40rpx 30rpx;
		margin-bottom: 60rpx;
		backdrop-filter: blur(10px);
		border: 1px solid rgba(5, 122, 255, 0.2);
		box-shadow: 0 0 35rpx rgba(0, 0, 0, 0.3), 0 0 20rpx rgba(5, 122, 255, 0.1);
	}
	
	.info-item {
		display: flex;
		justify-content: space-between;
		margin-bottom: 30rpx;
		padding-bottom: 20rpx;
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
		
		&:last-child {
			margin-bottom: 0;
			padding-bottom: 0;
			border-bottom: none;
		}
	}
	
	.label {
		font-size: 30rpx;
		color: rgba(255, 255, 255, 0.7);
	}
	
	.value {
		font-size: 30rpx;
		color: #fff;
		font-weight: 500;
	}
	
	.btn-group {
		width: 100%;
		margin-top: 20rpx;
	}
	
	.btn {
		width: 100%;
		height: 90rpx;
		line-height: 90rpx;
		text-align: center;
		border-radius: 30rpx;
		font-size: 32rpx;
		margin-bottom: 30rpx;
		transition: all 0.3s;
	}
	
	.primary-btn {
		background: linear-gradient(135deg, #0550d0, #057aff);
		color: #fff;
		border: 1px solid rgba(255, 255, 255, 0.2);
		box-shadow: 0 0 15rpx rgba(5, 122, 255, 0.4), 0 0 30rpx rgba(5, 122, 255, 0.2);
		
		&:active {
			transform: scale(0.98);
			box-shadow: 0 0 10rpx rgba(5, 122, 255, 0.3);
		}
	}
	
	.outline-btn {
		background: transparent;
		color: #fff;
		border: 1px solid rgba(5, 122, 255, 0.4);
		
		&:active {
			background: rgba(5, 122, 255, 0.1);
		}
	}
</style>
