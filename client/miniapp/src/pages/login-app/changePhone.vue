<template>
	<view class="container-ali">
		<view class="container1">
			<view class="container-box">
				<!-- 顶部状态栏 -->
				<!-- <view class="status-bar"></view> -->
				<view class="top_box">
					<!-- 顶部文字和logo -->
					<view class="header">
						<image class="header-image" style="width: 410rpx;height: 67rpx;"
							src="/static/images/logintitle.png" mode=""></image>
						<image class="header-image" style="width: 222rpx;height: 40rpx;"
							src="/static/images/logintitlet.png" mode=""></image>
						<!-- <text class="welcome">Welcome</text> -->
						<!-- <text class="brand">iHui Inf.AI</text> -->
					</view>
					<view class="logobox">
						<image class="logo" src="/static/images/wirelesslogo.png" mode="aspectFit" />
					</view>
					<view class="titlebox">
						<image class="titlebox-image" style="" src="/static/images/loginengtext.png"
							mode=""></image>
						<image class="titlebox-image1" style="" src="/static/images/loginzhtext.png"
							mode=""></image>
					</view>
					<!-- <text class="welcome">Welcome</text> -->
					<!-- <text class="brand">iHui Inf.AI</text> -->
				</view>
        <view class="bandPhone">绑定手机号</view>

				<!-- 手机号输入框 -->
				<view class="center_box">
					<view class="input-wbox">
						<view class="input-nbox">
							<view class="input-box">
								<view class="" style="display: flex;align-items: center;position: relative;">
									<view class="input-icon phone">
										<image class="phoneimg" src="/static/images/phone-fill.png"
											mode=""></image>
									</view>
									<view class="xiaicc" @click="selectPhone" style="">
										<text class="input-area-code">{{ phoneHead }}</text>
										<image class="xiaicc-img" src="/static/images/search-xia.png"
											mode=""></image>
									</view>
									<view class="nation-box" v-show="nationShow">
										<view class="nation-boo">
											<scroll-view class="benefits-scroll" :scroll-y="true" style="height: 280rpx;">
												<view v-for="(item, index) in nationData" class="nationInfo">
													<view class="nation-info1" @click="selectnati(item.content)">
														<view class="" style="color: #3D3D3D;">
															{{ item.title }}
														</view>
														<view class="" style="color: #979797;">
															{{ item.content }}
														</view>
													</view>

												</view>
											</scroll-view>
										</view>
									</view>


								</view>

								<input class="input iponeinput input-text" v-model="phoneNumber" style="color: #000;"
									type="text" placeholder="手机号码"
									placeholder-style="font-size: 24rpx;font-weight: normal;" />
							</view>
						</view>
					</view>

					<!--验证码-->
					<view class="input-wbox">
						<view class="input-nbox" style="margin-top: 18rpx;">
							<view class="input-box">
								<view class="input-icon pwd">
									<image class="verifyimg" src="/static/images/loginiponeo.png">
									</image>
								</view>
								<input class="input input-text" type="password" placeholder="验证码"
                       v-model="codeValue"
									placeholder-style="color:#6B6980;font-size: 22rpx;font-weight: normal;" />
								<view v-if="sendCodeShow" class="send-code send-code-pr16" @click="sendCode">
									<text class="send-code">发送验证码</text>
								</view>
                <view v-if="!sendCodeShow" class=""
                      style="width: 150rpx;height: 100%;display: flex;justify-content: center;align-items: center;flex-direction: column;">
                  <view v-show="codeMin <= 60 && codeMin > 0" class="send-code"
                        style="font-family: AlimamaFangYuanTi;font-size: 20rpx;color: #3D3D3D;font-weight: normal;">{{codeMin}}秒后重新获取</view>
                  <view v-show="codeMin == 0" class="send-code" style="white-space: nowrap" @click="sendCode">获取验证码</view>
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


					<!-- 注册/忘记密码 -->
					<view class="row-between">
						<view class="" style="width: 532rpx;display: flex;
		justify-content: flex-start;
		align-items: center;">
<!--							<view class="" style="display: flex;justify-content: flex-end;align-items: center;">
								<view class="custom-switch" @click="toggle1">
									<view class="switch-bg" :class="{ checked: isChecked1 }">
										<view class="switch-dot" :class="{ checked: isChecked1 }"></view>
									</view>
								</view>
								&lt;!&ndash; <switch class="my-switch" checked color="#FFCC33" style="transform:scale(0.5)" /> &ndash;&gt;


								<view class="link" style="">自动登录</view>
							</view>-->
							<view class="">

							</view>
						</view>
					</view>
				</view>
				<view class="bottom_box">
					<!-- 登录按钮 -->
					<view class="login-btn">
						<button class="btn" hover-class="none" style="padding: 0 !important;" @click="confirmPwd">确定</button>
					</view>


					<view class="logintext" style="width: 100%;display: flex;justify-content: center;align-items: center; ">
					</view>
				</view>
			</view>
		</view>
	</view>
</template>

<script setup>
import { ref, onBeforeUnmount } from 'vue'
import { onLoad, onUnload } from '@dcloudio/uni-app'
import { sendTextMsg, sendTextMsg_new, editPhone } from "@/service/login.js";

const codeMin = ref(60)
const sendCodeShow = ref(true)
const phoneNumber = ref('')
const pwdValue = ref('')
const confirm_pwdValue = ref('')
const phoneHead = ref('+86')
const nationShow = ref(false)
const isChecked1 = ref(false)
const isChecked = ref(false)
const showcode = ref(false)
const codeArr = ref(['', '', '', '', '', ''])
const focusIndex = ref(0)
const lastInput = ref(['', '', '', '', '', ''])
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
const isFoucs = ref(false)
const vcodeValue = ref('')
const codeValue = ref('')
const uuid = ref('')

onLoad((params) => {
	uuid.value = params['uuid']
})

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

	const { data: newVerify } = await sendTextMsg_new(phoneNumber.value, codeValue.value)
	uni.setStorageSync('regCode_new', newVerify['data'])

	const { data: editData } = await editPhone(phoneNumber.value, uuid.value, newVerify['data'])
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
			url: `/pages/table/aiIndex/ai_index?openid=${editData['data'].uuid || editData.uuid}`
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
  -webkit-text-security: disc; /* Safari, Chrome */
  text-security: disc; /* Future proofing */
  font-size: 1em; /* 防止字体大小影响圆点大小 */
  letter-spacing: 0.3em; /* 增加圆点间的距离 */
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

	/* height: 100vh; */

	/* display: flex; */

	/* min-height: 1522rpx; */

	/* min-height: 100%; */
	background: url('/static/images/loginbackk.png') no-repeat center/cover;

	/* background: #fff; */
	position: relative;
	min-height: 100vh;
	display: flex;
	flex-direction: column;
	justify-content: center;

	/* padding-bottom: 60rpx; */
}

.container-box {
	height: 100vh;
	padding: 50rpx 30rpx 0;
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
}

.logo {
	width: 311rpx;
	height: 207rpx;
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
	background: conic-gradient(from 180deg at 50% 50%, #CCDAF4 -8deg, #E6CBF9 0deg, #CCDAF4 352deg, #E6CBF9 360deg);
}

.vcodeInput {
  width: 0;
  height: 0;
  border: none;
}

.input-nbox {
	padding: 2rpx;
	width: 532rpx;
	height: 79rpx;
	margin-top: 30rpx;
	border-radius: 25rpx;
	background: conic-gradient(from 180deg at 50% 50%, #CCDAF4 -8deg, #E6CBF9 0deg, #CCDAF4 352deg, #E6CBF9 360deg);
}

.input-box {
	width: 100%;

	/* height: 100rpx; */
	background: #fff;

	/* border: 1rpx dashed #000; */
	border-radius: 25rpx;

	/* margin: 0 auto 32rpx auto; */

	display: flex;
	align-items: center;
	box-shadow: 0 0 6rpx 0 rgb(0 0 0 / 0.3);
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
	font-family: "Source Han Serif CN";
	font-size: 26rpx;
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
	font-size: 24rpx;
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
	font-size: 24rpx;
	font-weight: bold;
	line-height: 25rpx;
	letter-spacing: 0;
	color: #847CFF;
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
	width: 250rpx;
	height: 100rpx;
	margin: 10rpx auto 80rpx;
	background: rgb(0 0 0 / 0);

}

.btn {
	width: 100%;
	height: 100%;

	/* background: linear-gradient(252deg, rgba(195, 190, 255, 0.4), rgba(255, 255, 255, 0.4)); */
	background-image: url('/static/images/zcbutton.png');
	background-size: 100% 100%;

	/* 宽高都铺满 */
	background-repeat: no-repeat;

	/* 不重复 */
	background-position: center;

	/* 居中显示 */
	border-radius: 15rpx;
	color: rgb(0 0 0 / 0.5);
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
  color: #8D80E5;
  font-size: 44rpx;
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
	border-radius: 0rpx 0rpx 20rpx 20rpx;
	padding: 1rpx;
	background: linear-gradient(180deg, #EEF4FF 0%, #409EFF 100%);
}

.nation-boo {
	width: 100%;
	height: 100%;
	background: #F7F8FF;
	border-radius: 0rpx 0rpx 20rpx 20rpx;
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
	height: 354rpx;
}

.top_box {
  margin-top: 150rpx;
	height: calc(42% - 177rpx);
	display: flex;
	flex-direction: column;
	justify-content: center;
}

.bottom_box {
	height: calc(50% - 277rpx);
	display: flex;
	flex-direction: column;
	justify-content: center;
}
</style>
