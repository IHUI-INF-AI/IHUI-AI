<template>
	<view class="payment-container">
		<view class="header">
			<text class="title">会员中心</text>
			<text class="subtitle">加入VIP，享受更多特权</text>
		</view>
		
		<view class="package-container">
			<view class="package active">
				<view class="package-header">
					<text class="package-title">AI智汇社VIP会员</text>
					<text class="package-tag">超值</text>
				</view>
				<view class="package-price">
					<text class="price">¥588</text>
					<text class="original-price">¥1288</text>
				</view>
				<view class="package-desc">
					<text>VIP特权</text>
					<text>无限AI文案生成</text>
					<text>高级AI模型</text>
					<text>分佣计划资格</text>
					<text>7*24小时技术支持</text>
				</view>
				<view class="select-icon">✓</view>
			</view>
		</view>
		
		<view class="payment-methods">
			<text class="section-title">支付方式</text>
			<view class="method" :class="{ active: payMethod === 'wxpay' }" @click="selectPayMethod('wxpay')">
				<image class="method-icon" src="/static/images/wxpay.png"></image>
				<text class="method-name">微信支付</text>
				<view class="select-icon" v-if="payMethod === 'wxpay'">✓</view>
			</view>
			<!-- 未来可添加其他支付方式 -->
		</view>
		
		<view class="agreement">
			<checkbox :checked="isAgree" @tap="toggleAgreement" />
			<text class="agreement-text">我已阅读并同意<text class="link" @tap="openAgreement">《会员服务协议》</text></text>
		</view>
		
		<button class="pay-button" :disabled="!isValid" @tap="doPayment">
			立即支付 {{ totalAmount }}元
		</button>
		
		<!-- 支付结果提示 -->
		<uni-popup ref="paymentResultPopup" type="center">
			<view class="result-popup">
				<view class="result-icon" :class="{ success: paymentSuccess }">
					<text v-if="paymentSuccess">✓</text>
					<text v-else>✗</text>
				</view>
				<text class="result-title">{{ paymentSuccess ? '支付成功' : '支付失败' }}</text>
				<text class="result-message">{{ paymentResultMessage }}</text>
				<button class="result-button" @tap="closeResultPopup">{{ paymentSuccess ? '完成' : '重试' }}</button>
			</view>
		</uni-popup>
	</view>
</template>

<script setup>
import { ref, computed } from 'vue'

const payMethod = ref('wxpay')
const isAgree = ref(false)

const product = ref({
	id: 'vip',
	name: 'AI智汇社 VIP会员',
	price: 588,
	original_price: 1288,
	duration: -1
})

const paymentSuccess = ref(false)
const paymentResultMessage = ref('')
const orderNo = ref('')
let orderPollingInterval = null
const paymentResultPopup = ref(null)

const isValid = computed(() => {
	return payMethod.value && isAgree.value;
})

const totalAmount = computed(() => {
	return product.value.price;
})

function getUserInfo() {
	const userInfo = uni.getStorageSync('userInfo');
	if (!userInfo) {
		console.error('获取用户信息失败: 用户未登录');
		uni.showToast({
			title: '请先登录',
			icon: 'none'
		});
		
		setTimeout(() => {
			uni.navigateTo({
				url: '/pages/login/index'
			});
		}, 1500);
		return;
	}
	
	if (!userInfo.openid) {
		console.warn('用户缺少openid，尝试重新登录获取');
		uni.showToast({
			title: '用户信息不完整，请重新登录',
			icon: 'none'
		});
		
		setTimeout(() => {
			uni.navigateTo({
				url: '/pages/login/index'
			});
		}, 1500);
		return;
	}
	
	console.log('当前用户信息:', JSON.stringify(userInfo));
}

function selectPayMethod(method) {
	payMethod.value = method;
}

function toggleAgreement() {
	isAgree.value = !isAgree.value;
}

function openAgreement() {
	uni.navigateTo({
		url: '/pages/agreement/service'
	});
}

async function doPayment() {
	if (!isValid.value) return;
	
	const userInfo = uni.getStorageSync('userInfo');
	if (!userInfo || !userInfo.openid) {
		console.error('支付失败：用户未登录或openid不存在', userInfo);
		uni.showToast({
			title: '请先登录',
			icon: 'none'
		});
		
		setTimeout(() => {
			uni.navigateTo({
				url: '/pages/login/index'
			});
		}, 1500);
		
		return;
	}
	
	console.log('当前用户信息:', JSON.stringify(userInfo));
	console.log('用户openid:', userInfo.openid);
	
	if (userInfo.is_permanent_VIP) {
		uni.showToast({
			title: '您已是VIP会员',
			icon: 'none'
		});
		return;
	}
	
	uni.showLoading({
		title: '订单创建中...'
	});
	
	try {
		const orderResult = await createOrder();
		
		uni.hideLoading();
		
		if (orderResult.code === 0) {
			orderNo.value = orderResult.data.order_no;
			
			callWxPay(orderResult.data.payParams);
			
			startOrderPolling();
		} else {
			uni.showToast({
				title: orderResult.message || '创建订单失败',
				icon: 'none'
			});
		}
	} catch (error) {
		uni.hideLoading();
		uni.showToast({
			title: error.message || '支付异常，请稍后重试',
			icon: 'none'
		});
		console.error('支付异常:', error);
	}
}

async function createOrder() {
	const userInfo = uni.getStorageSync('userInfo');
	if (!userInfo) {
		console.error('创建订单失败: 用户信息不存在');
		throw new Error('用户未登录');
	}
	
	if (!userInfo.openid) {
		console.error('创建订单失败: openid不存在', userInfo);
		throw new Error('用户未登录或openid不存在');
	}
	
	if (!product.value.id) {
		console.error('创建订单失败: 商品ID不存在');
		throw new Error('商品信息不完整');
	}
	
	if (!payMethod.value) {
		console.error('创建订单失败: 支付方式未选择');
		throw new Error('请选择支付方式');
	}
	
	console.log('准备创建订单，信息汇总:');
	console.log('- 商品ID:', product.value.id);
	console.log('- 支付方式:', payMethod.value);
	console.log('- 用户openid:', userInfo.openid);
	
	const params = {
		productId: product.value.id,
		payMethod: payMethod.value,
		openid: userInfo.openid
	};
	
	return new Promise((resolve, reject) => {
		console.log('正在创建订单，参数:', JSON.stringify(params));
		
		uniCloud.callFunction({
			name: 'payment',
			data: {
				action: 'createOrder',
				params: params
			},
			success: (res) => {
				console.log('创建订单成功:', res.result);
				resolve(res.result);
			},
			fail: (err) => {
				console.error('创建订单失败:', err);
				reject(err);
			}
		});
	});
}

function callWxPay(payParams) {
	// #ifdef MP-WEIXIN
	uni.requestPayment({
		...payParams,
		success: (res) => {
			console.log('支付成功', res);
		},
		fail: (err) => {
			console.log('支付失败', err);
			stopOrderPolling();
			showPaymentResult(false, '支付已取消');
		}
	});
	// #endif
	
	// #ifdef H5 || APP-PLUS || APP-PLUS-NVUE
	setTimeout(() => {
		showPaymentResult(true, '模拟支付成功');
	}, 2000);
	// #endif
}

function startOrderPolling() {
	orderPollingInterval = setInterval(() => {
		checkOrderStatus();
	}, 3000);
	
	setTimeout(() => {
		stopOrderPolling();
	}, 60000);
}

function stopOrderPolling() {
	if (orderPollingInterval) {
		clearInterval(orderPollingInterval);
		orderPollingInterval = null;
	}
}

async function checkOrderStatus() {
	try {
		const result = await getOrderStatus();
		
		if (result.code === 0) {
			const orderData = result.data;
			
			if (orderData.isPaid) {
				stopOrderPolling();
				showPaymentResult(true, '恭喜您成为VIP会员！');
				
				refreshUserInfo();
			}
		}
	} catch (error) {
		console.error('检查订单状态失败:', error);
	}
}

async function getOrderStatus() {
	const userInfo = uni.getStorageSync('userInfo');
	if (!userInfo || !userInfo.openid) {
		throw new Error('用户未登录或openid不存在');
	}
	
	return new Promise((resolve, reject) => {
		uniCloud.callFunction({
			name: 'payment',
			data: {
				action: 'checkOrderStatus',
				params: {
					openid: userInfo.openid
				}
			},
			success: (res) => {
				resolve(res.result);
			},
			fail: (err) => {
				reject(err);
			}
		});
	});
}

function showPaymentResult(success, message) {
	paymentSuccess.value = success;
	paymentResultMessage.value = message;
	paymentResultPopup.value?.open();
}

function closeResultPopup() {
	paymentResultPopup.value?.close();
	
	if (paymentSuccess.value) {
		uni.navigateTo({
			url: '/pages/member/index'
		});
	}
}

function refreshUserInfo() {
	const userInfo = uni.getStorageSync('userInfo');
	if (!userInfo || !userInfo.openid) {
		console.error('刷新用户信息失败: 用户未登录或openid不存在');
		return;
	}
	
	uniCloud.callFunction({
		name: 'user',
		data: {
			action: 'getUserInfo',
			params: {
				openid: userInfo.openid
			}
		},
		success: (res) => {
			if (res.result.code === 0 && res.result.data) {
				uni.setStorageSync('userInfo', res.result.data);
			}
		}
	});
}

onLoad(() => {
	getUserInfo();
});
</script>

<style lang="scss">
.payment-container {
	padding: 30rpx;
	
	.header {
		margin-bottom: 40rpx;
		
		.title {
			font-size: 48rpx;
			font-weight: bold;
			color: #333;
			display: block;
			margin-bottom: 10rpx;
		}
		
		.subtitle {
			font-size: 28rpx;
			color: #666;
		}
	}
	
	.package-container {
		display: flex;
		flex-direction: column;
		margin-bottom: 40rpx;
		
		.package {
			padding: 30rpx;
			border-radius: 15rpx;
			background: #f8f8f8;
			position: relative;
			border: 2rpx solid transparent;
			
			&.active {
				border-color: #0056D6;
				background: rgb(0 86 214 / 0.05);
			}
			
			.package-header {
				display: flex;
				justify-content: space-between;
				align-items: center;
				margin-bottom: 20rpx;
				
				.package-title {
					font-size: 32rpx;
					font-weight: bold;
					color: #333;
				}
				
				.package-tag {
					font-size: 24rpx;
					color: #fff;
					background: #FF6B00;
					padding: 4rpx 12rpx;
					border-radius: 20rpx;
				}
			}
			
			.package-price {
				margin-bottom: 20rpx;
				
				.price {
					font-size: 48rpx;
					font-weight: bold;
					color: #0056D6;
					margin-right: 16rpx;
				}
				
				.original-price {
					font-size: 28rpx;
					color: #999;
					text-decoration: line-through;
				}
			}
			
			.package-desc {
				display: flex;
				flex-direction: column;
				gap: 10rpx;
				
				text {
					font-size: 26rpx;
					color: #666;
					
					&::before {
						content: '• ';
						color: #0056D6;
					}
					
					&.highlight {
						color: #FF6B00;
						font-weight: bold;
						
						&::before {
							color: #FF6B00;
						}
					}
				}
			}
			
			.select-icon {
				position: absolute;
				right: 30rpx;
				bottom: 30rpx;
				width: 40rpx;
				height: 40rpx;
				background: #0056D6;
				color: #fff;
				border-radius: 50%;
				display: flex;
				align-items: center;
				justify-content: center;
			}
		}
	}
	
	.payment-methods {
		margin-bottom: 40rpx;
		
		.section-title {
			font-size: 30rpx;
			font-weight: bold;
			color: #333;
			margin-bottom: 20rpx;
			display: block;
		}
		
		.method {
			display: flex;
			align-items: center;
			padding: 20rpx;
			border-radius: 15rpx;
			background: #f8f8f8;
			border: 2rpx solid transparent;
			
			&.active {
				border-color: #0056D6;
				background: rgb(0 86 214 / 0.05);
			}
			
			.method-icon {
				width: 60rpx;
				height: 60rpx;
				margin-right: 20rpx;
			}
			
			.method-name {
				font-size: 28rpx;
				color: #333;
				flex: 1;
			}
			
			.select-icon {
				width: 40rpx;
				height: 40rpx;
				background: #0056D6;
				color: #fff;
				border-radius: 50%;
				display: flex;
				align-items: center;
				justify-content: center;
			}
		}
	}
	
	.agreement {
		display: flex;
		align-items: center;
		margin-bottom: 40rpx;
		
		.agreement-text {
			font-size: 26rpx;
			color: #666;
			margin-left: 10rpx;
		}
		
		.link {
			color: #0056D6;
		}
	}
	
	.pay-button {
		background: #0056D6;
		color: #fff;
		height: 90rpx;
		line-height: 90rpx;
		font-size: 32rpx;
		font-weight: bold;
		border-radius: 30rpx;
		
		&[disabled] {
			background: #ccc;
			color: #fff;
		}
	}
	
	.result-popup {
		background: #fff;
		border-radius: 15rpx;
		padding: 40rpx;
		width: 560rpx;
		display: flex;
		flex-direction: column;
		align-items: center;
		
		.result-icon {
			width: 120rpx;
			height: 120rpx;
			border-radius: 60rpx;
			background: #FF5252;
			color: #fff;
			display: flex;
			align-items: center;
			justify-content: center;
			font-size: 60rpx;
			margin-bottom: 30rpx;
			
			&.success {
				background: #4CAF50;
			}
		}
		
		.result-title {
			font-size: 36rpx;
			font-weight: bold;
			color: #333;
			margin-bottom: 20rpx;
		}
		
		.result-message {
			font-size: 28rpx;
			color: #666;
			margin-bottom: 40rpx;
			text-align: center;
		}
		
		.result-button {
			background: #0056D6;
			color: #fff;
			height: 80rpx;
			line-height: 80rpx;
			font-size: 30rpx;
			border-radius: 30rpx;
			width: 80%;
		}
	}
}
</style> 
