<template>
	<view class="container">
		<view class="logo">
			<image src="/static/logo.png" mode="aspectFit" class="logo-image"></image>
		</view>
		<view class="title">AI智汇社</view>
		<view class="subtitle">登录/注册您的账号</view>
		
		<view class="form">
			<view class="input-group">
				<text class="input-icon">👤</text>
				<input type="text" v-model="username" placeholder="请输入用户名" class="input" />
			</view>
			
			<view class="input-group">
				<text class="input-icon">🔒</text>
				<input type="password" v-model="password" placeholder="请输入密码" class="input" password />
			</view>
			
			<button class="btn login-btn" @tap="handleLogin">登录/注册</button>
		</view>
		
		<view class="tips">
			<text>注册即代表同意《用户服务协议》</text>
		</view>
	</view>
</template>

<script setup>
import { ref } from 'vue'

const username = ref('')
const password = ref('')
const loading = ref(false)

const checkLoginStatus = () => {
	try {
		const token = uni.getStorageSync('token');
		const userInfo = uni.getStorageSync('userInfo');
		
		if (token && userInfo) {
			uni.switchTab({
				url: '/pages/table/tools/index'
			});
		}
	} catch (e) {
	}
}

const handleLogin = () => {
	if (loading.value) return;
	
	if (!username.value || !password.value) {
		uni.showToast({
			title: '请输入用户名和密码',
			icon: 'none'
		});
		return;
	}
	
	loading.value = true;
	uni.showLoading({
		title: '登录中...'
	});
	
	callCloudLogin();
}

const callCloudLogin = async () => {
	try {
		const result = await uniCloud.callFunction({
			name: 'login',
			data: {
				action: 'login',
				params: {
					username: username.value,
					password: password.value
				}
			}
		});
		
		handleLoginResult(result);
	} catch (error) {
		loading.value = false;
		uni.hideLoading();
		
		uni.showToast({
			title: '登录失败，请检查网络',
			icon: 'none'
		});
	}
}

const handleLoginResult = (result) => {
	loading.value = false;
	uni.hideLoading();
	
	if (result && result.result && result.result.code === 0) {
		const { token, userInfo } = result.result.data;
		
		if (!userInfo.openid) {
			// #ifdef MP-WEIXIN
			getWechatOpenid(userInfo, token);
			// #endif
			
			// #ifndef MP-WEIXIN
			generateRandomOpenid(userInfo, token);
			// #endif
			
			return;
		}
		
		uni.setStorageSync('token', token);
		uni.setStorageSync('userInfo', userInfo);
		
		const app = getApp();
		if (app.globalData) {
			app.globalData.userInfo = userInfo;
		}
		
		uni.showToast({
			title: '登录成功',
			icon: 'success'
		});
		
		setTimeout(() => {
			uni.switchTab({
				url: '/pages/table/tools/index'
			});
		}, 1500);
	} else {
		uni.showToast({
			title: result?.result?.msg || '登录失败，请重试',
			icon: 'none'
		});
	}
}

const getWechatOpenid = (userInfo, token) => {
	// #ifdef MP-WEIXIN
	uni.login({
		provider: 'weixin',
		success: (loginRes) => {
			if (loginRes.code) {
				uniCloud.callFunction({
					name: 'login',
					data: {
						action: 'getOpenid',
						params: {
							code: loginRes.code,
							userId: userInfo._id || userInfo.userId
						}
					},
					success: (res) => {
						if (res.result && res.result.code === 0) {
							userInfo.openid = res.result.data.openid;
							
							uni.setStorageSync('token', token);
							uni.setStorageSync('userInfo', userInfo);

							uni.switchTab({
								url: '/pages/table/tools/index'
							});
						} else {
							handleLoginFailure('获取用户信息失败');
						}
					},
					fail: (err) => {
						handleLoginFailure('获取用户信息失败');
					}
				});
			} else {
				handleLoginFailure('微信登录失败');
			}
		},
		fail: (err) => {
			handleLoginFailure('微信登录失败');
		}
	});
	// #endif
}

const generateRandomOpenid = (userInfo, token) => {
	const randomOpenid = 'random_openid_' + Date.now() + '_' + Math.floor(Math.random() * 1000000);
	userInfo.openid = randomOpenid;

	uniCloud.callFunction({
		name: 'user',
		data: {
			action: 'updateUserOpenid',
			params: {
				userId: userInfo._id || userInfo.userId,
				openid: randomOpenid
			}
		},
		success: (res) => {
			if (res.result && res.result.code === 0 && res.result.data) {
				userInfo = res.result.data;
			}

			uni.setStorageSync('token', token);
			uni.setStorageSync('userInfo', userInfo);

			uni.switchTab({
				url: '/pages/table/tools/index'
			});
		},
		fail: (err) => {
			handleLoginFailure('更新用户信息失败');
		}
	});
}

const handleLoginFailure = (message) => {
	loading.value = false;
	uni.hideLoading();
	
	uni.showToast({
		title: message || '登录失败，请重试',
		icon: 'none'
	});
}

checkLoginStatus()
</script>




<style>
.container {
	min-height: 100vh;
	background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
	padding: 60rpx 50rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
}

.logo {
	margin-bottom: 40rpx;
}

.logo-image {
	width: 180rpx;
	height: 180rpx;
}

.title {
	color: #ffffff;
	font-size: 56rpx;
	font-weight: bold;
	margin-bottom: 20rpx;
	text-shadow: 0 2px 10px rgba(0,242,255,0.5);
}

.subtitle {
	color: rgba(255,255,255,0.7);
	font-size: 32rpx;
	margin-bottom: 80rpx;
}

.form {
	width: 100%;
	max-width: 600rpx;
}

.input-group {
	display: flex;
	align-items: center;
	background-color: rgba(255,255,255,0.08);
	border-radius: 15rpx;
	height: 100rpx;
	padding: 0 30rpx;
	margin-bottom: 30rpx;
}

.input-icon {
	font-size: 40rpx;
	margin-right: 20rpx;
}

.input {
	flex: 1;
	height: 100%;
	color: #ffffff;
	font-size: 30rpx;
}

.btn {
	height: 90rpx;
	line-height: 90rpx;
	border-radius: 30rpx;
	font-size: 32rpx;
	margin-bottom: 30rpx;
}

.login-btn {
	background: linear-gradient(45deg, #0056d6, #00a0ff);
	color: #ffffff;
	box-shadow: 0 0 15px rgba(0,86,214,0.3);
}

.tips {
	margin-top: 60rpx;
	color: rgba(255,255,255,0.5);
	font-size: 24rpx;
}
</style>
