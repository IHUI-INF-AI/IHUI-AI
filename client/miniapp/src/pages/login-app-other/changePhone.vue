<template>
	<view class="container-ali" @click="handleContainerClick" @keyboard-show="handleKeyboardShow"
		@keyboard-hide="handleKeyboardHide">
		<view class="container1">
			<scroll-view class="container-scroll" scroll-y="true" :style="{ height: containerHeight }">
				<view class="container-box">
					<!-- 顶部状态栏 -->
					<!-- <view class="status-bar"></view> -->
					<view class="top_box">
						<!-- 顶部文字和logo -->
						<!-- <view class="header">
							<image class="header-image header-image-410-67"
								src="https://test.aizhs.top/minio/sys-mini/logintitle.png" mode=""></image>
							<image class="header-image header-image-222-40"
								src="https://test.aizhs.top/minio/sys-mini/logintitlet.png" mode=""></image>
						</view> -->
						<view class="logobox">
							<image class="logo" src="/static/images/sqlogo.svg" mode="aspectFit" />
						</view>
						<view class="titlebox">
							<image class="titlebox-image titlebox-image-310-37" style=""
								src="https://test.aizhs.top/minio/sys-mini/loginengtext.png" mode=""></image>
							<image class="titlebox-image1 titlebox-image1-312-66" style=""
								src="https://test.aizhs.top/minio/sys-mini/loginzhtext.png" mode=""></image>
						</view>
						<!-- <text class="welcome">Welcome</text> -->
						<!-- <text class="brand">iHui Inf.AI</text> -->
					</view>
					<view class="center_box">
						<view class="bandPhone">绑定手机号</view>

						<!-- 手机号输入框 -->
						<view class="input-wbox">
							<view :class="['input-nbox', isPhoneFocused ? 'input-nbox-focused' : '']">
								<view class="input-box">
									<view class="" style="display: flex;align-items: center;position: relative;">
										<view class="input-icon phone">
											<image class="phoneimg"
												src="https://test.aizhs.top/minio/sys-mini/phone-fill.png" mode="">
											</image>
										</view>
										<view :class="['xiaicc', isPhoneFocused ? 'xiaicc-focused' : '']"
											@click.stop="selectPhone" style="">
											<text class="input-area-code">{{ phoneHead }}</text>
											<image class="xiaicc-img"
												src="https://test.aizhs.top/minio/sys-mini/search-xia.png" mode="">
											</image>
										</view>
										<view class="nation-box nation-box-95-72" v-show="nationShow" @click.stop>
											<view class="nation-boo">
												<scroll-view class="benefits-scroll" :scroll-y="true"
													style="height: 280rpx;">
													<view v-for="(item, index) in nationData" class="nationInfo">
														<view class="nation-info1" @click="selectnati(item.content)">
															<text class="nation-name">{{ item.title }}</text>
															<text class="nation-code">{{ item.content }}</text>
														</view>
													</view>
												</scroll-view>
											</view>
										</view>
									</view>
									<input class="input iponeinput input-text" style="color: #000;" type="text"
										placeholder="手机号码"
										placeholder-style="color:#6B6980;font-size: 36rpx;font-weight: normal;"
										v-model="phoneNumber" @focus="handlePhoneFocus" @blur="handlePhoneBlur"
										adjust-position="true" />
								</view>
							</view>
						</view>

						<!--验证码-->
						<view class="input-wbox">
							<view :class="['input-nbox', isCodeFocused ? 'input-nbox-focused' : '']"
								style="margin-top: 18rpx;">
								<view class="input-box">
									<view class="input-icon pwd">
										<image class="verifyimg"
											src="https://test.aizhs.top/minio/sys-mini/loginiponeo.png">
										</image>
									</view>
									<input class="input input-text" style="color: #000;" type="password"
										placeholder="验证码" v-model="codeValue"
										placeholder-style="color:#6B6980;font-size: 36rpx;font-weight: normal;"
										@focus="handleCodeFocus" @blur="handleCodeBlur" adjust-position="true" />
									<view class="send-code send-code-pr16" @click="sendCode">
										<text class="send-code" v-if="sendCodeShow">发送验证码</text>
										<view
											style="width: 180rpx;height: 100%;display: flex;justify-content: center;align-items: center;flex-direction: column;">
											<view v-if="!sendCodeShow && (codeMin <= 60 && codeMin > 0)"
												class="send-code"
												style="font-family: AlimamaFangYuanTi;font-size: 28rpx;color: #3D3D3D;margin-right: 0;font-weight: normal;">
												{{ codeMin }}秒后重新获取
											</view>
											<view v-if="!sendCodeShow && codeMin == 0" class="send-code"
												style="white-space: nowrap" @click="sendCode">获取验证码</view>
										</view>
									</view>
								</view>
							</view>
						</view>


						<!-- <view style="width: 100%;display: flex;justify-content: center;padding-top: 12rpx;">
						<view
							style="display: flex;justify-content: flex-start;color: #979797;width:532rpx;font-size: 14rpx;font-family: AlimamaFangYuanTi;">
							验证码已发送，60秒内输入有效
						</view>
					</view> -->



						<!-- 账户输入框 -->
						<!-- <view class="input-wbox">
						<view class="input-nbox">
							<view class="input-box">
								<view class="input-icon pwd">
									<image class="accountimg" src="/static/images/account0.png" mode=""></image>
								</view>
								<view class="xiaicc" style="width: 120rpx;padding-right: 0rpx; border-right:0rpx;">
									<text class="input-area-code">iHui lnf - </text>
								</view>
								<input class="input input-text" style="color: #000;" type="password" placeholder="最多3个中文字符或6个英文字符"
									placeholder-style="color:#6B6980;font-size: 22rpx;font-weight: normal; " />
							</view>
						</view>
					</view> -->

						<!-- 密码输入框 -->

						<!-- 验证码输入框 -->
						<!-- <view class="input-wbox">
						<view class="input-nbox">
							<view class="input-box verify-box">
								<view class="input-icon verify">
									<image class="verifyimg" src="/static/images/phonecz.png" mode=""></image>
								</view>
								<view class="verify-cells">
								<view class="verify-cell">
						
									<input type="text" value="0" /> 
								
								</view>
								</view>
								<text class="send-code">发送验证码</text>
							</view>
						</view>
					</view> -->


						<view style="height: 100rpx;"></view>

						<!-- 注册/忘记密码 -->
						<view class="row-between">
						</view>

						<!-- 确定按钮 - 键盘隐藏时在scroll-view内部 -->
						<view class="bottom_box" v-if="keyboardHeight === 0">
							<!-- 登录按钮 -->
							<view class="login-btn">
								<button class="btn" hover-class="none" style="padding: 0 !important;" @click="confirmPwd">确定</button>
							</view>

							<view class="logintext" style="width: 100%;display: flex;justify-content: center;align-items: center; ">
							</view>
						</view>
					</view>
				</view>
			</scroll-view>
			<!-- 确定按钮 - 键盘弹起时固定在底部 -->
			<view class="bottom_box bottom_box_fixed" v-if="keyboardHeight > 0" :style="buttonBottomStyle">
				<!-- 登录按钮 -->
				<view class="login-btn">
					<button class="btn" hover-class="none" style="padding: 0 !important;" @click="confirmPwd">确定</button>
				</view>

				<view class="logintext" style="width: 100%;display: flex;justify-content: center;align-items: center; ">
				</view>
			</view>
		</view>
	</view>
</template>

<script setup>
import { ref, computed, onBeforeUnmount } from 'vue'
import { onLoad, onUnload } from '@dcloudio/uni-app'
import { sendTextMsg, sendTextMsg_new, editPhone, bindPhone } from "@/service/login.js";

const codeMin = ref(60)
const sendCodeShow = ref(true)
const phoneNumber = ref('')
const pwdValue = ref('')
const confirm_pwdValue = ref('')
const phoneHead = ref('+86')
const nationShow = ref(false)
const isPhoneFocused = ref(false)
const isCodeFocused = ref(false)
const isChecked1 = ref(false)
const isChecked = ref(false)
const showcode = ref(false)
const codeArr = ref(['', '', '', '', '', ''])
const focusIndex = ref(0)
const lastInput = ref(['', '', '', '', '', ''])
const nationData = ref([
	{ title: '中国', content: '+86', id: 1 },
	{ title: '美国', content: '+1', id: 2 },
	{ title: '台湾', content: '+886', id: 3 },
	{ title: '香港', content: '+852', id: 4 },
	{ title: '韩国', content: '+82', id: 5 },
	{ title: '日本', content: '+81', id: 6 },
])
const timer = ref(null)
const eyeStatus = ref(true)
const eyeStatus_new = ref(true)
const isFoucs = ref(false)
const vcodeValue = ref('')
const codeValue = ref('')
const uuid = ref('')
const openid = ref('')
const unionid = ref('')
const platform = ref('')
const scrollTop = ref(0)
const keyboardHeight = ref(0)
const keyboardHeightRpx = ref(0)
const phoneKeyboardHeight = ref(0)
const codeKeyboardHeight = ref(0)
const containerHeight = ref('100vh')
const systemInfo = ref(null)
const buttonHeightRpx = ref(180)
const keyboardHeightChangeCallback = ref(null)

const buttonBottomStyle = computed(() => {
	const bottom = getButtonBottom()
	return {
		bottom: bottom + 'rpx'
	}
})

onLoad((params) => {
	uuid.value = params['uuid'] || '';
	openid.value = params['openid'] ? decodeURIComponent(params['openid']) : '';
	unionid.value = params['unionid'] ? decodeURIComponent(params['unionid']) : '';
	platform.value = params['platform'] ? decodeURIComponent(params['platform']) : '';
	systemInfo.value = uni.getSystemInfoSync();
	updateContainerHeight();
	setTimeout(() => {
		setupKeyboardListener();
	}, 100);
})

function cleanupTimer() {
	if (timer.value) {
		clearInterval(timer.value);
		timer.value = null;
	}
}

onUnload(() => {
	cleanupTimer();
	if (keyboardHeightChangeCallback.value) {
		uni.offKeyboardHeightChange(keyboardHeightChangeCallback.value);
		keyboardHeightChangeCallback.value = null;
	}
})

onBeforeUnmount(() => {
	cleanupTimer();
})

async function confirmPwd() {
	let code = codeArr.value.join('')

	if (!phoneNumber.value) {
		uni.showToast({
			title: "请输入手机号码!",
			icon: "none",
			duration: 1000,
		});
		return
	}
	if (!codeValue.value) {
		uni.showToast({
			title: "请输入验证码!",
			icon: "none",
			duration: 1000,
		});
		return
	}

	const newVerifyRes = await sendTextMsg_new(phoneNumber.value, codeValue.value)
	console.log('sendTextMsg_new 接口返回参数', newVerifyRes)
	const newVerify = newVerifyRes.data
	uni.setStorageSync('regCode_new', newVerify['data'])

	const { data: editData } = await bindPhone(openid.value, unionid.value, phoneNumber.value, newVerify?.data, platform.value)
	if (editData['code'] !== '200') {
		uni.showToast({
			title: editData['msg'],
			icon: "none",
			duration: 1000,
		});
		return
	}
	uni.showToast({
		title: '绑定成功！',
		icon: "none",
		duration: 1000,
	});

	setTimeout(() => {
		uni.setStorageSync("data", editData['data']);
		uni.setStorageSync("avatarPic", editData['data']['avatar']);
		uni.$emit('loginSuccess', editData['data']);

		uni.reLaunch({
			url: `/pages/table/user/index?openid=${editData.uuid}`
		});
	}, 1000)
}

function vcodeClick(i) {
	isFoucs.value = true
}

function codeBlur() {
	isFoucs.value = false
}

function handelVCode() {
	codeArr.value = vcodeValue.value.split('').reverse()
}

function changeEye() {
	eyeStatus.value = !eyeStatus.value
}

function changeEye_new() {
	eyeStatus_new.value = !eyeStatus_new.value
}

function toLogin() {
	uni.navigateBack()
}

function toReg() {
	uni.navigateBack()
}

async function sendCode() {
	if (!phoneNumber.value) {
		uni.showToast({
			title: "请输入电话号码!",
			icon: "none",
			duration: 1000,
		});
		return
	} else if (phoneNumber.value.length !== 11) {
		uni.showToast({
			title: "请输入正确电话号码!",
			icon: "none",
			duration: 1000,
		});
		return
	}

	if (timer.value) {
		clearInterval(timer.value);
		timer.value = null;
	}
	const data = await sendTextMsg(phoneNumber.value, 2, '')
	console.log('绑定手机号验证码', data);

	sendCodeShow.value = false;
	codeMin.value = 60;
	timer.value = setInterval(() => {
		if (codeMin.value > 0) {
			codeMin.value--;
		} else {
			console.log("倒计时结束，清除定时器");
			clearInterval(timer.value);
			timer.value = null;
		}
	}, 1000);
}

function selectPhone() {
	nationShow.value = true;
}

function handleContainerClick() {
	nationShow.value = false;
}

function selectnati(val) {
	nationShow.value = false;
	phoneHead.value = val;
}

function handlePhoneFocus(e) {
	isPhoneFocused.value = true;
	if (e && e.detail && e.detail.height && e.detail.height > 0) {
		console.log('手机号输入框 - 从焦点事件获取键盘高度:', e.detail.height, 'px');
		phoneKeyboardHeight.value = e.detail.height;
		keyboardHeight.value = e.detail.height;
		updateContainerHeight();
	} else {
		if (phoneKeyboardHeight.value > 0) {
			console.log('手机号输入框 - 使用已记录的键盘高度:', phoneKeyboardHeight.value, 'px');
			keyboardHeight.value = phoneKeyboardHeight.value;
			updateContainerHeight();
		} else {
			setTimeout(() => {
				if (keyboardHeight.value === 0 || keyboardHeight.value === codeKeyboardHeight.value) {
					console.log('手机号输入框 - 使用估算值');
					estimateKeyboardHeight('phone');
				}
			}, 400);
		}
	}
}

function handlePhoneBlur() {
	isPhoneFocused.value = false;
	setTimeout(() => {
		if (!isCodeFocused.value) {
			keyboardHeight.value = 0;
			updateContainerHeight();
		}
	}, 100);
}

function handleCodeFocus(e) {
	isCodeFocused.value = true;
	if (e && e.detail && e.detail.height && e.detail.height > 0) {
		console.log('验证码输入框 - 从焦点事件获取键盘高度:', e.detail.height, 'px');
		codeKeyboardHeight.value = e.detail.height;
		keyboardHeight.value = e.detail.height;
		updateContainerHeight();
	} else {
		if (codeKeyboardHeight.value > 0) {
			console.log('验证码输入框 - 使用已记录的键盘高度:', codeKeyboardHeight.value, 'px');
			keyboardHeight.value = codeKeyboardHeight.value;
			updateContainerHeight();
		} else {
			setTimeout(() => {
				if (keyboardHeight.value === 0 || keyboardHeight.value === phoneKeyboardHeight.value) {
					console.log('验证码输入框 - 使用估算值（通常比手机号键盘高）');
					estimateKeyboardHeight('code');
				}
			}, 400);
		}
	}
}

function handleCodeBlur() {
	isCodeFocused.value = false;
	setTimeout(() => {
		if (!isPhoneFocused.value) {
			keyboardHeight.value = 0;
			updateContainerHeight();
		}
	}, 100);
}

function handleKeyboardShow(e) {
	console.log('键盘显示事件:', e);
	// #ifdef APP-PLUS
	if (e && e.height && e.height > 0) {
		console.log('从键盘显示事件获取高度:', e.height, 'px');
		if (isCodeFocused.value) {
			codeKeyboardHeight.value = e.height;
			console.log('保存验证码键盘高度:', codeKeyboardHeight.value, 'px');
		} else if (isPhoneFocused.value) {
			phoneKeyboardHeight.value = e.height;
			console.log('保存手机号键盘高度:', phoneKeyboardHeight.value, 'px');
		}
		keyboardHeight.value = e.height;
		updateContainerHeight();
	} else {
		setTimeout(() => {
			if (keyboardHeight.value === 0) {
				const inputType = isCodeFocused.value ? 'code' : 'phone';
				console.log('键盘显示事件无高度，使用估算值，输入框类型:', inputType);
				estimateKeyboardHeight(inputType);
			}
		}, 300);
	}
	// #endif
	// #ifndef APP-PLUS
	setTimeout(() => {
		if (keyboardHeight.value === 0) {
			const inputType = isCodeFocused.value ? 'code' : 'phone';
			estimateKeyboardHeight(inputType);
		}
	}, 300);
	// #endif
}

function handleKeyboardHide() {
	console.log('键盘隐藏事件');
	setTimeout(() => {
		if (!isPhoneFocused.value && !isCodeFocused.value) {
			keyboardHeight.value = 0;
			updateContainerHeight();
		}
	}, 100);
}

function setupKeyboardListener() {
	// #ifdef APP-PLUS
	try {
		console.log('设置键盘监听器');
		keyboardHeightChangeCallback.value = (res) => {
			try {
				console.log('uni.onKeyboardHeightChange 触发:', res.height, 'px');
				if (res && res.height !== undefined && res.height >= 0) {
					const newHeight = res.height || 0;
					if (isCodeFocused.value) {
						codeKeyboardHeight.value = newHeight;
						console.log('保存验证码键盘高度:', codeKeyboardHeight.value, 'px');
					} else if (isPhoneFocused.value) {
						phoneKeyboardHeight.value = newHeight;
						console.log('保存手机号键盘高度:', phoneKeyboardHeight.value, 'px');
					}
					if (Math.abs(keyboardHeight.value - newHeight) > 10) {
						keyboardHeight.value = newHeight;
						updateContainerHeight();
					}
				}
			} catch (error) {
				console.error('键盘高度变化回调错误:', error);
			}
		};
		uni.onKeyboardHeightChange(keyboardHeightChangeCallback.value);
		console.log('键盘监听器设置完成');
	} catch (error) {
		console.error('设置键盘监听器失败:', error);
	}
	// #endif
}

function estimateKeyboardHeight(inputType = 'phone') {
	if (!systemInfo.value) {
		systemInfo.value = uni.getSystemInfoSync();
	}
	const sysInfo = systemInfo.value;

	let estimatedKeyboardHeight;

	// #ifdef APP-PLUS
	if (sysInfo.platform === 'ios') {
		if (inputType === 'code') {
			estimatedKeyboardHeight = Math.min(Math.floor(sysInfo.windowHeight * 0.40), 320);
		} else {
			estimatedKeyboardHeight = Math.min(Math.floor(sysInfo.windowHeight * 0.35), 300);
		}
	} else {
		let baseHeight;
		if (sysInfo.windowHeight < 800) {
			baseHeight = Math.floor(sysInfo.windowHeight * 0.4);
		} else if (sysInfo.windowHeight < 1200) {
			baseHeight = Math.floor(sysInfo.windowHeight * 0.33);
		} else {
			baseHeight = Math.floor(sysInfo.windowHeight * 0.28);
		}
		if (inputType === 'code') {
			estimatedKeyboardHeight = baseHeight + 40;
		} else {
			estimatedKeyboardHeight = baseHeight;
		}
		estimatedKeyboardHeight = Math.max(200, Math.min(estimatedKeyboardHeight, 380));
	}
	// #endif

	// #ifndef APP-PLUS
	if (inputType === 'code') {
		estimatedKeyboardHeight = Math.floor(sysInfo.windowHeight * 0.36);
	} else {
		estimatedKeyboardHeight = Math.floor(sysInfo.windowHeight / 3);
	}
	// #endif

	console.log('使用估算键盘高度:', estimatedKeyboardHeight, 'px (屏幕高度:', sysInfo.windowHeight, 'px, 平台:', sysInfo.platform, ', 输入框类型:', inputType, ')');

	if (inputType === 'code') {
		codeKeyboardHeight.value = estimatedKeyboardHeight;
	} else {
		phoneKeyboardHeight.value = estimatedKeyboardHeight;
	}

	keyboardHeight.value = estimatedKeyboardHeight;
	updateContainerHeight();
}

function getButtonBottom() {
	if (isCodeFocused.value && keyboardHeight.value > 0) {
		return keyboardHeightRpx.value + 20;
	}
	return keyboardHeightRpx.value;
}

function updateContainerHeight() {
	if (!systemInfo.value) {
		systemInfo.value = uni.getSystemInfoSync();
	}
	const sysInfo = systemInfo.value;
	const pxToRpx = 750 / sysInfo.windowWidth;

	const maxKeyboardHeight = Math.floor(sysInfo.windowHeight * 0.5);
	const minKeyboardHeight = 150;
	const clampedKeyboardHeight = Math.max(minKeyboardHeight, Math.min(keyboardHeight.value, maxKeyboardHeight));

	keyboardHeightRpx.value = clampedKeyboardHeight * pxToRpx;

	if (keyboardHeight.value > 0) {
		const windowHeightRpx = sysInfo.windowHeight * pxToRpx;
		const newHeight = windowHeightRpx - keyboardHeightRpx.value - buttonHeightRpx.value;
		containerHeight.value = Math.max(200, newHeight) + 'rpx';
		console.log('键盘弹起，scroll-view高度:', containerHeight.value, '键盘高度:', keyboardHeightRpx.value, 'rpx (原始:', keyboardHeight.value, 'px)');
	} else {
		const windowHeightRpx = sysInfo.windowHeight * pxToRpx;
		containerHeight.value = (windowHeightRpx - buttonHeightRpx.value) + 'rpx';
		keyboardHeightRpx.value = 0;
		console.log('键盘收起，scroll-view高度:', containerHeight.value);
	}
}

function toggle1() {
	isChecked1.value = !isChecked1.value
}

function toggleCheck() {
	isChecked.value = !isChecked.value
}

function gainCode() {
	if (timer.value) {
		clearInterval(timer.value);
		timer.value = null;
	}
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

function onInput(idx, e) {
	isFoucs.value = true

	let val = e.detail.value.replace(/[^0-9]/g, '');
	if (val === '') {
		codeArr.value[idx] = '';
		codeArr.value = [...codeArr.value];
		if (lastInput.value[idx] !== '' && idx > 0) {
			focusIndex.value = idx - 1;
		}
	} else {
		codeArr.value[idx] = val;
		codeArr.value = [...codeArr.value];
		if (idx < 5) {
			focusIndex.value = idx + 1;
		}
	}
	lastInput.value = [...codeArr.value];
}
</script>

<style scoped>
.full-screen {
	height: 100%;
}

.password-input {
	-webkit-text-security: disc;

	/* Safari, Chrome */
	text-security: disc;

	/* Future proofing */
	font-size: 1em;

	/* 防止字体大小影响圆点大小 */
	letter-spacing: 0.3em;

	/* 增加圆点间的距离 */
}

.my-switch {
	margin-right: -30rpx;
}

.container-ali {
	width: 100%;
	min-height: 100vh;
	background-color: #fff;
}

.container1 {
	width: 100%;
	height: 100vh;
	background: url('https://test.aizhs.top/minio/sys-mini/loginbackk.png') no-repeat center/cover;
	position: relative;
	display: flex;
	flex-direction: column;
	overflow: hidden;
}

.container-scroll {
	width: 100%;
	flex: 1;
	overflow: hidden;
}

.container-box {
	min-height: 100%;
	padding: 0rpx 30rpx 0;
	padding-bottom: 200rpx;
	display: flex;
	flex-direction: column;
	box-sizing: border-box;
}

.status-bar {
	height: 88rpx;
}

.header {
	padding-top: 10rpx;

	/* padding-top: 165rpx; */
	display: flex;
	align-items: flex-end;
	justify-content: space-between;

	/* padding: 0 20rpx; */
}

.welcome {
	color: #000;
	margin-bottom: 10rpx;
	font-family: AlimamaFangYuanTi;
	font-size: 80rpx;
	font-weight: normal;
	line-height: 67rpx;
	letter-spacing: 0;
}

.brand {
	/* font-size: 32rpx; */

	/* color: #8D83FF; */
	margin-bottom: 20rpx;
	align-self: flex-end;
	font-family: AlimamaFangYuanTi;
	font-size: 30rpx;
	font-weight: bold;

	/* line-height: 40rpx; */
	text-align: center;
	letter-spacing: 0;
	font-variation-settings: "BEVL" 100, "opsz" auto;
	color: #8D83FF;

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

.input-wbox {
	width: 100%;
	display: flex;
	justify-content: center;
}

.input-n1box {
	width: 532rpx;
	margin-top: 30rpx;
	display: flex;
	align-items: center;
}

.input-nnbox {
	padding: 2rpx;
	width: 85.4rpx;
	height: 79rpx;

	/* margin-top: 20rpx; */
	border-radius: 20rpx;
	background: #E8E8E8;
}

.vcodeInput {
	width: 0;
	height: 0;
	border: none;
}

.input-nbox {
	padding: 2rpx;
	width: 650rpx;
	height: 99rpx;
	margin-top: 30rpx;
	border-radius: 25rpx;
	background: #E8E8E8;
	transition: background 0.15s ease-out;
	will-change: background;
	position: relative;
}

.input-nbox-focused {
	background: #FFF;
}

.input-nbox-focused::after {
	content: '';
	position: absolute;
	inset: 0;
	border-radius: 25rpx;
	border: 1.5px solid #000;
	pointer-events: none;
}

.input-box {
	width: 100%;
	height: 100%;
	background: #FAFAFA;
	border-radius: 25rpx;
	display: flex;
	align-items: center;
	box-shadow: 0 0 6rpx 0 rgb(0 0 0 / 0.3);
}

.input-nbox-focused .input-box {
	background: #FFF;
}

.input-icon {
	width: 40rpx;
	height: 40rpx;
	margin-right: 10rpx;
	display: flex;
	justify-content: center;
	align-items: center;
	margin-left: 21.69rpx;


	/* background: #eee; */

	/* border-radius: 50%; */
}

.input-area-code {
	letter-spacing: 0rpx;
	color: #979797;
	margin-right: 0rpx;
	font-family: AlimamaFangYuanTi;
	font-size: 36rpx;
	font-weight: normal;
}

.input {
	flex: 1;

	/* font-size: 36rpx; */
	border: none;
	background: transparent;
	outline: none;




}

.input-text {
	font-family: AlimamaFangYuanTi;
	font-size: 36rpx;
	font-weight: 300;
	letter-spacing: 0rpx;
	color: #000;
	font-variation-settings: "BEVL" 100, "opsz" auto;
}

.verify-box {
	/* flex-direction: column; */

	/* height: auto; */

	/* padding: 20rpx 0rpx 20rpx 0rpx; */
}

.verify-cells {
	display: flex;
	justify-content: space-between;

	/* margin-bottom: 10rpx; */
}

.verify-cell {
	/* width: 50rpx; */
	height: 75rpx;

	/* border: 1rpx solid #000; */
	border-radius: 6rpx;
	font-size: 40rpx;
	color: #000;

	/* display: flex;
  align-items: center;
  justify-content: center; */

	/* background: #fff; */
}

.send-code {
	/* right: 30rpx;
		top: 30rpx;
		font-size: 30rpx;
		color: #000; */
	font-family: AlimamaFangYuanTi;
	font-size: 32rpx;
	font-weight: bold;
	line-height: 25rpx;
	letter-spacing: 0;
	color: #847CFF;
	margin-left: -15px;
}

.row-between {
	width: 100%;
	display: flex;
	justify-content: center;
	margin-top: 10rpx;
}

.link {
	color: #6B6980;
	font-size: 24rpx;
	margin-left: 5rpx;
}

.login-btn {
	/* width: 250rpx; */
	width: 532rpx;
	height: 100rpx;
	margin: 10rpx auto 0;
	background: rgb(0 0 0 / 0);

}

.btn {
	width: 100%;
	height: 100%;

	/* background: linear-gradient(252deg, rgba(195, 190, 255, 0.4), rgba(255, 255, 255, 0.4)); */
	background-image: url('https://test.aizhs.top/minio/sys-mini/zcbutton.png');
	background-size: 100% 100%;

	/* 宽高都铺满 */
	background-repeat: no-repeat;

	/* 不重复 */
	background-position: center;
	background-color: #000;

	/* 居中显示 */
	border-radius: 30rpx;
	color: #fff;
	display: flex;
	justify-content: center;
	align-items: center;
	border: none;

	/* 去掉默认边框 */
	backdrop-filter: blur(50rpx);

	/* box-shadow: inset 0px 4rpx 30rpx 0px rgba(211, 213, 255, 0.5); */
	font-size: 60rpx;
	font-weight: 500;
	text-shadow: 0 0 5px rgb(0 0 0 / 0.3);
}

.switch-login {
	width: 100%;
	text-align: center;
	margin-top: 5rpx;
	font-size: 22rpx;
	color: #757171;
}

.phone {
	margin-right: 0rpx;
}

.phoneimg {
	width: 35.83rpx;
	height: 34.51rpx;
}

.pwd {
	width: 40rpx;
	height: 40rpx;
}

.pwdimg {
	width: 40rpx;
	height: 18rpx;
}

.accountimg {
	width: 40rpx;
	height: 40rpx;
}

.verifyimg {
	width: 20.25rpx;
	height: 36rpx;
}

.xiaicc {
	/* width: 60rpx; */

	/* height: 60rpx; */
	padding-right: 20rpx;
	padding-left: 20rpx;

	/* width: 70rpx; */
	height: 39.5rpx;
	display: flex;
	justify-content: space-between;
	align-items: center;
	border-right: 1px solid #979797;
	transition: border-color 0.15s ease-out;
	will-change: border-color;
}

.xiaicc-focused {
	border-right: 1px solid #000;
}

.xiaicc-img {
	width: 17.48rpx;
	height: 9.62rpx;
	margin-left: 3rpx;

}

.input {
	height: 79rpx;
}

.iponeinput {
	margin-left: 20rpx;
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

.bandPhone {
	color: #000;
	font-size: 50rpx;
	text-align: center;
	font-weight: bold;
	margin-bottom: 30rpx;
}

.titlebox-image1 {
	margin-top: 18rpx;
	width: 312rpx;
	height: 66rpx;
}

.check-circle {
	width: 16.5rpx;
	height: 16.5rpx;
	border: 2rpx solid #bbb;
	border-radius: 50%;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 24rpx;
	color: #fff;
	background: #fff;
	transition: all 0.2s;
}

.check-circle.checked {
	border-color: #847CFF;
	background: #847CFF;
}

.icon {
	color: #fff;
	font-size: 14.5rpx;
}

.yiyue-box {
	margin-top: 5rpx;
	width: 445rpx;
	display: flex;
	justify-content: flex-start;
}

.icon-all {
	width: 100%;
	display: flex;
	justify-content: center;
	align-items: center;
	margin-top: 10rpx;
}

.icon-all-box {
	width: 100rpx;
	height: 100rpx;
	display: flex;
	justify-content: center;
	align-items: center;
}

.custom-switch {
	width: 60rpx;
	height: 25rpx;
	display: flex;
	align-items: center;
}

.switch-bg {
	width: 60rpx;
	height: 25rpx;
	border-radius: 33rpx;
	background: #fff;
	position: relative;
	transition: background 0.3s;
	border: 1px solid #889;
}

.switch-bg.checked {
	background: #8c8cff;
	border: 1px solid #8c8cff;
}

.switch-dot {
	width: 21rpx;
	height: 21rpx;
	border-radius: 50%;
	background: #889;
	position: absolute;
	top: 2rpx;
	left: 2rpx;
	transition: left 0.3s, background 0.3s;
	box-shadow: 0 2rpx 8rpx rgb(0 0 0 / 0.08);
}

.switch-dot.checked {
	left: 34rpx;
	background: #fff;
}

.nation-box {
	position: absolute;
	width: 95%;
	bottom: 72rpx;
	right: 0;
	border-radius: 20rpx;
	padding: 1rpx;
	background: #E8E8E8;
}

.nation-boo {
	width: 100%;
	height: 100%;
	background: #FFF;
	border-radius: 20rpx;
	border: 1rpx solid #979797;
	box-shadow: 0 4rpx 12rpx rgb(0 0 0 / 0.08);
}

.nationInfo {
	display: flex;
	justify-content: center;
	align-items: center;
	padding: 0;
	border-bottom: 1rpx solid #F0F0F0;
}

.nation-info1 {
	width: 90%;
	display: flex;
	flex-direction: row;
	justify-content: space-between;
	align-items: center;
	padding: 24rpx 0;
}

.nation-name {
	font-size: 28rpx;
	color: #3D3D3D;
	font-weight: 400;
	flex-shrink: 0;
}

.nation-code {
	font-size: 28rpx;
	color: #6B6980;
	font-weight: 400;
	flex-shrink: 0;
}

.input-nbox-mt18 {
	margin-top: 18rpx;
}

.send-code-pr16 {
	padding-right: 16rpx;
}

.row-between-mt10 {
	margin-top: 10rpx;
}

.link-ml5 {
	margin-left: 5rpx;
}

.center_box {
	display: flex;
	flex-direction: column;
	flex: 1;
}

.top_box {
	display: flex;
	flex-direction: column;
	justify-content: center;
	position: relative;
	padding-top: 100rpx;
	box-sizing: border-box;
	flex-shrink: 0;
}

.bottom_box {
	display: flex;
	flex-direction: column;
	justify-content: flex-start;
	align-items: center;
	flex-shrink: 0;
	padding: 40rpx 0;
	padding-bottom: calc(40rpx + env(safe-area-inset-bottom));
	margin-top: 80rpx;
}

.bottom_box_fixed {
	position: fixed;
	left: 0;
	right: 0;
	width: 100%;
	display: flex;
	flex-direction: column;
	justify-content: flex-start;
	align-items: center;
	padding: 40rpx 0;
	padding-bottom: calc(40rpx + env(safe-area-inset-bottom));
	background: transparent;
	z-index: 100;
	transition: bottom 0.3s ease;
	margin-top: 0;
}

.nation-box-95-72 {
	width: 95%;
	bottom: 72rpx;
	right: 0;
}
</style>
