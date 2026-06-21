<template>
	<view class="container-ali">
		<view class="container1">
			<view class="container-box">
				<view class="top_box">
					<view class="logobox">
						<image class="logo" src="/static/images/sqlogo.svg" mode="aspectFit" />
					</view>
					<view class="titlebox">
						<image class="titlebox-image" src="https://test.aizhs.top/minio/sys-mini/loginengtext.png" mode=""></image>
						<image class="titlebox-image1" src="https://test.aizhs.top/minio/sys-mini/loginzhtext.png" mode=""></image>
					</view>
				</view>

				<view class="center_box">
					<!-- 第一步：验证手机号 -->
					<template v-if="step === 1">
						<view class="page-title">验证手机号</view>
						<view class="input-wbox">
							<view :class="['input-nbox', isPhoneFocused ? 'input-nbox-focused' : '']">
								<view class="input-box">
									<view class="input-icon phone">
										<image class="phoneimg" src="https://test.aizhs.top/minio/sys-mini/phone-fill.png" mode=""></image>
									</view>
									<view :class="['xiaicc', isPhoneFocused ? 'xiaicc-focused' : '']" @click.stop="selectPhone">
										<text class="input-area-code">{{ phoneHead }}</text>
										<image class="xiaicc-img" src="https://test.aizhs.top/minio/sys-mini/search-xia.png" mode=""></image>
									</view>
									<view class="nation-box" v-show="nationShow" @click.stop>
										<view class="nation-boo">
											<scroll-view class="benefits-scroll" :scroll-y="true" style="height: 280rpx;">
												<view v-for="(item, index) in nationData" class="nationInfo" :key="item.id">
													<view class="nation-info1" @click="selectnati(item.content)">
														<text class="nation-name">{{ item.title }}</text>
														<text class="nation-code">{{ item.content }}</text>
													</view>
												</view>
											</scroll-view>
										</view>
									</view>
									<input class="input iponeinput input-text" v-model="phoneNumber" style="color: #000;"
										type="number" maxlength="11" placeholder="手机号码"
										placeholder-style="color:#6B6980;font-size: 36rpx;font-weight: normal;"
										@focus="isPhoneFocused = true" @blur="isPhoneFocused = false" />
								</view>
							</view>
						</view>
						<view class="input-wbox">
							<view :class="['input-nbox', isCodeFocused ? 'input-nbox-focused' : '']" style="margin-top: 18rpx;">
								<view class="input-box">
									<view class="input-icon pwd">
										<image class="verifyimg" src="https://test.aizhs.top/minio/sys-mini/loginiponeo.png" mode=""></image>
									</view>
									<input class="input input-text" type="number" maxlength="6" placeholder="验证码" v-model="codeValue"
										placeholder-style="color:#6B6980;font-size: 36rpx;font-weight: normal;"
										@focus="isCodeFocused = true" @blur="isCodeFocused = false" />
									<view class="send-code send-code-pr16" @click="sendCode">
										<text class="send-code" v-if="sendCodeShow">发送验证码</text>
										<view v-else style="width: 180rpx;display: flex;justify-content: center;align-items: center;">
											<text v-if="codeMin > 0 && codeMin <= 60" class="send-code" style="font-size: 28rpx;color: #3D3D3D;font-weight: normal;">{{ codeMin }}秒后重新获取</text>
											<text v-else class="send-code" @click="sendCode">获取验证码</text>
										</view>
									</view>
								</view>
							</view>
						</view>
					</template>

					<!-- 第二步：设置新密码 -->
					<template v-if="step === 2">
						<view class="page-title">设置新密码</view>
						<view class="input-wbox">
							<view :class="['input-nbox', isPwdFocused ? 'input-nbox-focused' : '']">
								<view class="input-box">
									<view class="input-icon pwd">
										<image class="pwdimg" src="https://test.aizhs.top/minio/sys-mini/key-fill.png" mode=""></image>
									</view>
									<input class="input input-text" style="color: #000;"
										:type="pwdValue && !eyeStatus ? 'password' : 'text'" placeholder="新密码" v-model="pwdValue"
										placeholder-style="color:#6B6980;font-size: 36rpx;font-weight: normal;"
										@focus="isPwdFocused = true" @blur="isPwdFocused = false" />
									<view class="password-toggle" @click="changeEye">
										<image v-if="eyeStatus" class="eye-icon" src="/static/images/eye-gray.svg" mode="aspectFit"></image>
										<image v-else class="eye-icon" src="/static/images/eye-slash-gray.svg" mode="aspectFit"></image>
									</view>
								</view>
							</view>
						</view>
						<view class="input-wbox">
							<view :class="['input-nbox', isConfirmPwdFocused ? 'input-nbox-focused' : '']" style="margin-top: 18rpx;">
								<view class="input-box">
									<view class="input-icon pwd">
										<image class="pwdimg" src="https://test.aizhs.top/minio/sys-mini/key-fill.png" mode=""></image>
									</view>
									<input class="input input-text" style="color: #000;"
										:type="confirm_pwdValue && !eyeStatus_new ? 'password' : 'text'" placeholder="确认新密码" v-model="confirm_pwdValue"
										placeholder-style="color:#6B6980;font-size: 36rpx;font-weight: normal;"
										@focus="isConfirmPwdFocused = true" @blur="isConfirmPwdFocused = false" />
									<view class="password-toggle" @click="changeEye_new">
										<image v-if="eyeStatus_new" class="eye-icon" src="/static/images/eye-gray.svg" mode="aspectFit"></image>
										<image v-else class="eye-icon" src="/static/images/eye-slash-gray.svg" mode="aspectFit"></image>
									</view>
								</view>
							</view>
						</view>
					</template>
				</view>

				<view class="bottom-section">
					<view class="bottom_box">
						<view class="login-btn" v-if="step === 1">
							<button class="btn" hover-class="none" style="padding: 0 !important;" @click="onNextStep">下一步</button>
						</view>
						<view class="login-btn" v-if="step === 2">
							<button class="btn" hover-class="none" style="padding: 0 !important;" @click="confirmPwd">确定</button>
						</view>
						<view class="logintext" style="width: 100%;display: flex;justify-content: center;align-items: center;">
							<view class="textoo" style="width: 250rpx;display: flex;justify-content: center;align-items: center;">
								<text style="font-size: 36rpx;font-weight: bold;color: #847CFF;" @click="toReg">注册/</text>
								<text style="font-size: 36rpx;font-weight: bold;color: #847CFF;" @click="toLogin">登录</text>
							</view>
						</view>
					</view>
				</view>
			</view>
		</view>
	</view>
</template>

<script setup>
import { ref, onBeforeUnmount } from 'vue'
import { onUnload } from '@dcloudio/uni-app'
import { sendTextMsg, sendTextMsg_new, editPwd, pwdExist } from "@/service/login.js";

const step = ref(1)
const codeMin = ref(60)
const sendCodeShow = ref(true)
const phoneNumber = ref('')
const codeValue = ref('')
const pwdValue = ref('')
const confirm_pwdValue = ref('')
const phoneHead = ref('+86')
const nationShow = ref(false)
const nationData = ref([
	{ title: '美国', content: '+1', id: 1 },
	{ title: '台湾', content: '+886', id: 2 },
	{ title: '香港', content: '+852', id: 3 },
	{ title: '韩国', content: '+82', id: 4 },
	{ title: '日本', content: '+81', id: 5 },
])
const timer = ref(null)
const eyeStatus = ref(true)
const eyeStatus_new = ref(true)
const isPhoneFocused = ref(false)
const isCodeFocused = ref(false)
const isPwdFocused = ref(false)
const isConfirmPwdFocused = ref(false)

function cleanupTimer() {
	if (timer.value) {
		clearInterval(timer.value);
		timer.value = null;
	}
}

onUnload(() => {
	cleanupTimer();
})

onBeforeUnmount(() => {
	cleanupTimer();
})

async function onNextStep() {
	if (!phoneNumber.value) {
		uni.showToast({ title: "请输入手机号码!", icon: "none", duration: 1000 });
		return;
	}
	if (phoneNumber.value.length !== 11) {
		uni.showToast({ title: "请输入正确手机号码!", icon: "none", duration: 1000 });
		return;
	}
	if (!codeValue.value) {
		uni.showToast({ title: "请输入验证码!", icon: "none", duration: 1000 });
		return;
	}
	try {
		const res = await sendTextMsg_new(phoneNumber.value, codeValue.value);
		const newVerify = (res && res.data) || res;
		if (newVerify && newVerify.code !== '200' && newVerify.code !== 200) {
			uni.showToast({
				title: newVerify.msg || "验证码错误，请重试",
				icon: "none",
				duration: 2000,
			});
			return;
		}
		uni.setStorageSync('regCode_new', newVerify['data']);
		step.value = 2;
	} catch (e) {
		uni.showToast({
			title: (e && e.msg) || "验证码错误，请重试",
			icon: "none",
			duration: 2000,
		});
	}
}

async function confirmPwd() {
	if (!pwdValue.value) {
		uni.showToast({ title: "请输入新密码!", icon: "none", duration: 1000 });
		return;
	}
	if (!confirm_pwdValue.value) {
		uni.showToast({ title: "请确认新密码!", icon: "none", duration: 1000 });
		return;
	}
	if (pwdValue.value !== confirm_pwdValue.value) {
		uni.showToast({ title: "两次输入不一致!", icon: "none", duration: 1000 });
		return;
	}
	try {
		const { data: editData } = await editPwd(phoneNumber.value, pwdValue.value);
		if (editData['code'] !== '200') {
			uni.showToast({ title: editData['msg'] || '修改失败', icon: "none", duration: 1000 });
			return;
		}
		uni.showToast({ title: '修改成功！', icon: "none", duration: 1000 });
		setTimeout(() => {
			uni.redirectTo({ url: '/pages/login-app/login' });
		}, 1000);
	} catch (e) {
		uni.showToast({ title: (e && e.msg) || "修改失败", icon: "none", duration: 1000 });
	}
}

function changeEye() {
	eyeStatus.value = !eyeStatus.value;
}

function changeEye_new() {
	eyeStatus_new.value = !eyeStatus_new.value;
}

function toLogin() {
	uni.navigateBack();
}

function toReg() {
	uni.navigateBack();
}

async function sendCode() {
	if (!phoneNumber.value) {
		uni.showToast({ title: "请输入手机号码!", icon: "none", duration: 1000 });
		return;
	}
	if (phoneNumber.value.length !== 11) {
		uni.showToast({ title: "请输入正确手机号码!", icon: "none", duration: 1000 });
		return;
	}
	try {
		const exist = await pwdExist(phoneNumber.value);
		if (!exist) {
			uni.showToast({ title: "该手机号未注册，请先注册", icon: "none", duration: 2000 });
			return;
		}
	} catch (e) {
		uni.showToast({ title: (e && e.msg) || "查询失败", icon: "none", duration: 1000 });
		return;
	}
	cleanupTimer();
	try {
		await sendTextMsg(phoneNumber.value, 2, '');
	} catch (e) {
		uni.showToast({ title: (e && e.msg) || "发送失败", icon: "none", duration: 1000 });
		return;
	}
	sendCodeShow.value = false;
	codeMin.value = 60;
	timer.value = setInterval(() => {
		if (codeMin.value > 0) {
			codeMin.value--;
		} else {
			clearInterval(timer.value);
			timer.value = null;
		}
	}, 1000);
}

function selectPhone() {
	nationShow.value = !nationShow.value;
}

function selectnati(val) {
	nationShow.value = false;
	phoneHead.value = val;
}
</script>

<style scoped>
.container-ali {
	width: 100%;
	min-height: 100vh;
	background-color: #fff;
}

.container1 {
	width: 100%;
	background: url('https://test.aizhs.top/minio/sys-mini/loginbackk.png') no-repeat center/cover;
	position: relative;
	min-height: 100vh;
	display: flex;
	flex-direction: column;
}

.container-box {
	height: 100vh;
	max-height: 100vh;
	padding: 0 30rpx 0 30rpx;
	display: flex;
	flex-direction: column;
	box-sizing: border-box;
	overflow-y: auto;
}

.top_box {
	height: calc(40% - 177rpx);
	display: flex;
	flex-direction: column;
	justify-content: center;
	position: relative;
	padding-top: 100rpx;
	box-sizing: border-box;
}

.logobox {
	padding-top: 20rpx;
	display: flex;
	justify-content: center;
	align-items: center;
	margin-top: -60rpx;
}

.logo {
	width: 55%;
	height: 245rpx;
}

.titlebox {
	display: flex;
	justify-content: center;
	flex-direction: column;
	align-items: center;
}

.titlebox-image {
	margin-top: 10rpx;
	width: 310rpx;
	height: 37rpx;
}

.titlebox-image1 {
	margin-top: 18rpx;
	width: 312rpx;
	height: 66rpx;
}

.page-title {
	width: 100%;
	text-align: center;
	font-size: 36rpx;
	font-weight: bold;
	color: #000;
	margin-bottom: 24rpx;
}

.center_box {
	height: 354rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
}

.input-wbox {
	width: 100%;
	display: flex;
	justify-content: center;
	margin-bottom: 0;
}

.input-nbox {
	padding: 2rpx;
	width: 650rpx;
	height: 99rpx;
	margin-top: 30rpx;
	border-radius: 25rpx;
	background: #f5f5f5;
	border: 1px solid #eaeaea;
	transition: background 0.15s ease-out;
	position: relative;
}

.input-nbox-focused {
	background: #FFFFFF;
	border-color: transparent;
}

.input-nbox-focused::after {
	content: '';
	position: absolute;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;
	border-radius: 25rpx;
	border: 1.5px solid #000;
	pointer-events: none;
}

.input-box {
	width: 100%;
	height: 100%;
	background: #f5f5f5;
	border-radius: 25rpx;
	display: flex;
	align-items: center;
}

.input-nbox-focused .input-box {
	background: #FFFFFF;
}

.input-icon {
	width: 40rpx;
	height: 40rpx;
	margin-right: 10rpx;
	display: flex;
	justify-content: center;
	align-items: center;
	margin-left: 21.69rpx;
}

.input-area-code {
	letter-spacing: 0rpx;
	color: #979797;
	margin-right: 0rpx;
	font-family: Source Han Serif CN;
	font-size: 36rpx;
	font-weight: normal;
}

.input {
	flex: 1;
	height: 99rpx;
	border: none;
	background: transparent;
	outline: none;
}

.input-text {
	font-family: 'AlimamaFangYuanTi';
	font-size: 36rpx;
	font-weight: 300;
	letter-spacing: 0rpx;
	color: #000;
}

.iponeinput {
	margin-left: 20rpx;
}

.phoneimg {
	width: 35.83rpx;
	height: 34.51rpx;
}

.pwdimg {
	width: 40rpx;
	height: 18rpx;
}

.verifyimg {
	width: 20.25rpx;
	height: 36rpx;
}

.xiaicc {
	padding-right: 20rpx;
	padding-left: 20rpx;
	height: 60rpx;
	display: flex;
	justify-content: space-between;
	align-items: center;
	border-right: 1px solid #979797;
}

.xiaicc-img {
	width: 17.48rpx;
	height: 9.62rpx;
	margin-left: 3rpx;
}

.nation-box {
	position: absolute;
	width: 95%;
	bottom: 72rpx;
	right: 0;
	border-radius: 0 0 20rpx 20rpx;
	padding: 1rpx;
	background: linear-gradient(180deg, #EEF4FF 0%, #409EFF 100%);
}

.nation-boo {
	width: 100%;
	height: 100%;
	background: #F7F8FF;
	border-radius: 0 0 20rpx 20rpx;
}

.nationInfo {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 5px;
	border-bottom: 1rpx solid #D8D8D8;
}

.nation-info1 {
	width: 100%;
	display: flex;
	justify-content: space-between;
	align-items: center;
}

.nation-name, .nation-code {
	font-size: 28rpx;
}

.send-code {
	font-family: AlimamaFangYuanTi;
	font-size: 32rpx;
	font-weight: bold;
	line-height: 25rpx;
	letter-spacing: 0px;
	color: #847CFF;
	margin-left: -15px;
}

.send-code-pr16 {
	padding-right: 16rpx;
}

.password-toggle {
	display: flex;
	justify-content: center;
	align-items: center;
	padding-right: 26rpx;
	width: 50rpx;
	height: 50rpx;
}

.password-toggle .eye-icon {
	width: 40rpx;
	height: 40rpx;
}

.bottom-section {
	transition: bottom 0.25s ease;
	display: flex;
	flex-direction: column;
	padding: 0 0 30rpx 0;
	box-sizing: border-box;
}

.bottom_box {
	min-height: auto;
	display: flex;
	flex-direction: column;
	justify-content: center;
	flex-shrink: 0;
}

.login-btn {
	width: 532rpx;
	height: 100rpx;
	margin: 10rpx auto 0 auto;
	background: rgba(0, 0, 0, 0);
}

.btn {
	width: 100%;
	height: 100%;
	background-image: url('https://test.aizhs.top/minio/sys-mini/zcbutton.png');
	background-size: 100% 100%;
	background-repeat: no-repeat;
	background-position: center;
	background-color: #000;
	border-radius: 30rpx;
	font-size: 60rpx;
	color: #fff;
	font-weight: bold;
	display: flex;
	justify-content: center;
	align-items: center;
	border: none;
}

.logintext {
	margin-top: 20rpx;
}
</style>
