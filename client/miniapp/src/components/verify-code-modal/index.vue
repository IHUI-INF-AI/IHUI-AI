<template>
	<view class="verify-code-modal" v-if="visible" @click="handleMaskClick">
		<view class="verify-code-modal-mask"></view>
		<view class="verify-code-modal-content" @click.stop>
			<view class="verify-code-modal-header">
				<text class="verify-code-modal-title">获取验证码</text>
			</view>
			<view class="verify-code-modal-body">
				<text class="verify-code-tip">账号未注册，请获取验证码完成注册并登录</text>
				<view class="verify-code-phone-row">
					<text class="verify-code-label">手机号</text>
					<text class="verify-code-phone">{{ phone }}</text>
				</view>
				<view class="verify-code-input-row">
					<text class="verify-code-label">验证码</text>
					<input class="verify-code-input" type="number" maxlength="6" placeholder="请输入验证码"
						v-model="code" placeholder-class="verify-code-placeholder" />
					<view class="verify-code-get-btn" @click="sendCode">
						<text v-if="codeMin <= 0">获取验证码</text>
						<text v-else class="verify-code-countdown">{{ codeMin }}秒后重发</text>
					</view>
				</view>
			</view>
			<view class="verify-code-modal-footer">
				<view class="verify-code-modal-btn cancel-btn" @click="handleClose">
					<text class="btn-text">取消</text>
				</view>
				<view class="verify-code-modal-btn confirm-btn" @click="handleConfirm">
					<text class="btn-text">确定</text>
				</view>
			</view>
		</view>
	</view>
</template>

<script setup>
import { ref, watch, onBeforeUnmount } from 'vue'
import { sendTextMsg, sendTextMsg_new, registerLogin } from '@/service/login.js'

const props = defineProps({
	visible: {
		type: Boolean,
		default: false,
	},
	phone: {
		type: String,
		default: '',
	},
	password: {
		type: String,
		default: '',
	},
})

const emit = defineEmits(['close', 'confirm'])

const code = ref('')
const codeMin = ref(0)
const timer = ref(null)

function clearTimer() {
	if (timer.value) {
		clearInterval(timer.value)
		timer.value = null
	}
}

function handleMaskClick() {
	emit('close')
}

function handleClose() {
	emit('close')
}

async function sendCode() {
	if (codeMin.value > 0) return
	if (!props.phone) {
		uni.showToast({ title: '手机号为空', icon: 'none' })
		return
	}
	if (props.phone.length !== 11) {
		uni.showToast({ title: '请输入正确手机号', icon: 'none' })
		return
	}
	try {
		await sendTextMsg(props.phone, 1, '')
		codeMin.value = 60
		clearTimer()
		timer.value = setInterval(() => {
			if (codeMin.value > 0) {
				codeMin.value--
			} else {
				clearTimer()
			}
		}, 1000)
		uni.showToast({ title: '验证码已发送', icon: 'none' })
	} catch (e) {
		uni.showToast({ title: e?.data?.msg || '发送失败', icon: 'none' })
	}
}

async function handleConfirm() {
	if (!code.value) {
		uni.showToast({ title: '请输入验证码', icon: 'none' })
		return
	}
	uni.showLoading({ title: '登录中...' })
	try {
		const { data: responseData } = await sendTextMsg_new(props.phone, code.value)
		if (responseData['code'] !== '200') {
			uni.hideLoading()
			uni.showToast({ title: responseData['msg'] || '验证码错误', icon: 'none', duration: 1000 })
			return
		}
		uni.setStorageSync('regCode', responseData?.data)
		const { data } = await registerLogin(
			props.phone,
			props.password,
			code.value,
			responseData['data']
		)
		uni.hideLoading()
		emit('confirm', { data })
	} catch (err) {
		uni.hideLoading()
		uni.showToast({ title: err?.data?.msg || '登录失败，请重试', icon: 'none', duration: 1000 })
	}
}

watch(
	() => props.visible,
	(val) => {
		if (!val) {
			clearTimer()
			code.value = ''
			codeMin.value = 0
		}
	}
)

onBeforeUnmount(() => {
	clearTimer()
})
</script>

<style lang="scss" scoped>
.verify-code-modal {
	position: fixed;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;
	z-index: 1000;
	display: flex;
	align-items: center;
	justify-content: center;
}

.verify-code-modal-mask {
	position: absolute;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;
	background: rgba(0, 0, 0, 0.5);
}

.verify-code-modal-content {
	position: relative;
	width: 580rpx;
	background: #ffffff;
	border-radius: 24rpx;
	overflow: visible;
	padding-bottom: 20rpx;
	box-shadow: 0 12rpx 48rpx rgba(0, 0, 0, 0.15);
}

.verify-code-modal-header {
	padding: 40rpx 30rpx 30rpx;
	text-align: center;
}

.verify-code-modal-title {
	font-size: 36rpx;
	font-weight: bold;
	color: #000000;
}

.verify-code-modal-body {
	padding: 0 30rpx 24rpx;
	display: flex;
	flex-direction: column;
	align-items: stretch;
}

.verify-code-tip {
	font-size: 28rpx;
	color: #6B6980;
	line-height: 1.5;
	margin-bottom: 24rpx;
}

.verify-code-phone-row,
.verify-code-input-row {
	display: flex;
	align-items: center;
	margin-bottom: 20rpx;
}

.verify-code-phone-row:last-of-type,
.verify-code-input-row:last-of-type {
	margin-bottom: 0;
}

.verify-code-label {
	font-size: 28rpx;
	color: #333;
	width: 120rpx;
	flex-shrink: 0;
}

.verify-code-phone {
	font-size: 30rpx;
	color: #000;
	font-weight: 500;
}

.verify-code-input {
	flex: 1;
	height: 72rpx;
	line-height: 72rpx;
	padding: 0 20rpx;
	font-size: 30rpx;
	color: #000;
	background: #f5f5f5;
	border-radius: 12rpx;
}

.verify-code-placeholder {
	color: #999;
}

.verify-code-get-btn {
	margin-left: 16rpx;
	padding: 0 24rpx;
	height: 72rpx;
	line-height: 72rpx;
	font-size: 26rpx;
	color: #847CFF;
	flex-shrink: 0;
}

.verify-code-get-btn:active {
	opacity: 0.8;
}

.verify-code-countdown {
	color: #999;
}

.verify-code-modal-footer {
	display: flex;
	padding: 12rpx 30rpx 20rpx;
	gap: 16rpx;
}

.verify-code-modal-btn {
	flex: 1;
	height: 88rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 12rpx;
	transition: all 0.3s;
}

.verify-code-modal-btn:active {
	opacity: 0.7;
	transform: scale(0.98);
}

.cancel-btn {
	background: #fff;
	color: #000;
}

.confirm-btn {
	background: #000;
	color: #fff;
}

.btn-text {
	font-size: 32rpx;
}
</style>
