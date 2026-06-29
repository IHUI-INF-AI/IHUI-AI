<template>
    <view class="type">
        <!-- Loading遮罩层 - 移至页面最外层 -->
        <view v-if="loading" class="loading-mask">
            <view class="loading-container">
                <view class="loading-spinner"></view>
                <text class="loading-text">加载中...</text>
            </view>
        </view>

        <navigation-bars color="black" :viscosity="true" title="充值" :backgroundColor="color" :image="images"
            @pack="onPackClick" />
        <view style="margin: 20rpx;">
            <UserInfoCard :userInfo="currentUser" :popupVisible="false" :introducePopupVisible="false"
                :showRechargeBtn="false" />
        </view>
        <view style="position: relative;padding: 0 20rpx;">
            <image class="activity-bg-img" mode="widthFix" src="https://test.aizhs.top/minio/sys-mini/huodongBG.jpg">
            </image>
            <view class="activity-input-action-row">
                <view style="width: 215rpx; height: 65rpx; margin-left: 50rpx;">
                    <view class="activity-input-card">
                        <view class="input-card-main">
                            <image style="width: 40rpx;height: 40rpx;
    padding-left: 8rpx;" src="https://test.aizhs.top/minio/sys-mini/penicon.png" mode="widthFix" />
                            <input class="input-card-main-text" v-model="activityprice" type="number"
                                placeholder="请输入充值金额"
                                placeholder-style="font-size: 22rpx;font-weight: normal;color: #F7F173;"
                                @blur="onCustomInputBlur" />
                        </view>
                    </view>
                </view>

                <view class="activity-input-btn-card" style="height: 65rpx;" @click="onDiscountTopUp">
                    <view class="input-btn-main">
                        <view class="input-btn-main-text">充值</view>
                        <image class="input-btn-icon" src="https://test.aizhs.top/minio/sys-mini/moneyjin.png" />
                    </view>
                    <view class="input-btn-sub">
                        <view class="">
                            点击此处充值
                        </view>
                        <view class="">

                        </view>
                    </view>
                </view>
            </view>
        </view>
        <!-- 充值 -->
        <view>
            <view class="amount-card">
                <view style="padding-bottom: 5px;
    border-bottom: 1px solid #989697;" class="amount-header">
                    <image class="amount-header-icon" src="https://test.aizhs.top/minio/sys-mini/wallet-zf.png"
                        mode="widthFix" />
                    <text class="amount-header-title">请选择充值金额</text>
                </view>
                <view class="amount-header-right">
                    <text class="amount-header-rate">充值比例</text>
                    <view class="amount-header-desc">
                        <view style="margin-top: 10rpx;">
                            <text style="margin-right: 20rpx;">普通用户{{ price }}￥={{ formatTokenValue(denomination)
                                }}智汇值</text>
                            <text>会员{{ price }}￥={{ formatTokenValue(denominatidenominationVipon) }}智汇值</text>
                        </view>
                        <view style="margin-top: 10rpx;"><text>操盘手{{ price }}￥={{ formatTokenValue(denominationOperate)
                                }}智汇值</text>
                        </view>
                    </view>
                </view>
                <view class="amount-list">
                    <view v-for="(item, idx) in list" :key="item.id" class="amount-item"
                        :class="{ active: item.id === indexId }" @click="hander(item)">
                        <image class="amount-item-icon"
                            :src="item.id === indexId ? 'https://test.aizhs.top/minio/sys-mini/chongzhiy.png' : 'https://test.aizhs.top/minio/sys-mini/chongzhin.png'"
                            mode="widthFix" />
                        <text class="amount-item-text">{{ item.price }}</text>
                    </view>
                </view>
            </view>
        </view>
        <!-- 选择 -->
        <view style="margin-top: 30rpx; padding: 0 20rpx">
            <view class="pay-card">
                <view style="padding-bottom: 5px;
    border-bottom: 1px solid #989697;" class="pay-header">
                    <image class="pay-header-icon" src="https://test.aizhs.top/minio/sys-mini/wallet-zf.png"
                        mode="widthFix" />
                    <text class="pay-header-title">请选择充值方式</text>
                    <text style="color: rgb(0 0 0 / 0.4);" class="pay-header-tip">更多充值方式可使用官方<text
                            class="bold">APP</text></text>
                </view>
                <view class="pay-list">
                    <view v-for="item in topUp" :key="item.id" class="pay-item" :class="{ active: item.id === id }"
                        @click="choose(item)">
                        <image class="pay-icon" :src="item.images" mode="widthFix" />
                        <text class="pay-name">{{ item.name }}</text>
                        <view class="pay-radio">
                            <view class="pay-radio-outer" :class="{ checked: item.id === id }">
                                <view class="pay-radio-inner" v-if="item.id === id"></view>
                            </view>
                        </view>
                    </view>
                </view>
            </view>
        </view>
        <!-- 按钮 -->
        <view style="display: flex; justify-content: center; margin-top: 30rpx">
            <view class="btns" @click="payClick">充值</view>
        </view>
        <view style="text-align: center;">
            <image style="width: 140rpx;" src="https://test.aizhs.top/minio/sys-mini/Emphty.png" mode="widthFix" />
        </view>
        <view style="text-align: center;">
            <image style="text-align: center;width:70%" src="https://test.aizhs.top/minio/sys-mini/yejiao.png" mode="widthFix" />
        </view>
    </view>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue'
import NavigationBars from "@/components/navigation-bars/index.vue";
import UserInfoCard from "@/components/UserInfoCard/UserInfoCard.vue";
import { zfb_newPay } from "@/service/pay.js";

import { pay, zfb_pay } from "@/utils/pay/index.js";
import { selectsGoods, getactivity } from "@/service/shop.js";
import { happenTimeFun, formatFullTime } from "@/utils/time.js";
import { getTokenCount } from "@/service/pay.js";
import { payToken } from "@/utils/token/index.js";
import { formatPrice } from "@/utils/time.js";
import { formatTokenValue } from "@/utils/index.js";

const images = ref("https://test.aizhs.top/minio/sys-mini/backf1.png")
const color = ref("transparent")
const id = ref(2)
const quantity = ref("")
const token = ref("")
const indexId = ref(0)
const center = ref("")
const product_id = ref("1")
const order_type = ref("")
const list = ref([])
const vip = ref([])
const user = ref({
	tokenBalance: "",
})
const currentUser = ref({
	open_id: "",
	isLoggedIn: false,
	username: "",
	isVip: null,
	knowledgeBaseQuota: "",
	remainingTokens: "",
	tokenQuantity: 0,
	phone: "",
	identityTypy: 0,
	avatarUrl: "",
	zhsToken: "",
})
const grade = ref(false)
const showCalculator = ref(false)
const calculatedTokens = ref(null)
const topUp = ref([
	{
		id: 2,
		name: "支付宝",
		images:
			"http://file.aizhs.top/sys-mini/default/logo/%E5%BE%AE%E4%BF%A1%E5%9B%BE%E7%89%87_20250806001129.png",
	}
])
const tokenRecharge = ref({})
const timestamp = ref(1710000000)
const price = ref(1)
const liprice = ref(0)
const activityprice = ref(null)
const activitydata = ref({})
const loading = ref(true)
const denomination = ref(20000)
const denominatidenominationVipon = ref(40000)
const denominationOperate = ref(80000)
const payHtmlUrl = ref('')
const formAct = ref('')
const formVal = ref({
	out_trade_no: '',
	total_amount: '',
	subject: '',
	product_code: '',
})

let stablePay = null
let stablePays = null

onPageScroll((e) => {
	color.value = e.scrollTop > 20 ? "white" : "transparent";
})

onLoad(() => {
	loading.value = true;

	getactivity().then((res) => {
		if (res.code == "200") {
			activitydata.value = res.data;
			console.log("活动数据", activitydata.value);
		}
	})
})

onShow(() => {
	user.value = uni.getStorageSync("data");
	console.log(uni.getStorageSync("data"), 'uni.getStorageSync("data")======')
	currentUser.value = {
		open_id: user.value.open_id || "",
		isLoggedIn: !!user.value.phone,
		username: user.value.nickname || user.value.username || "",
		isVip: user.value.isVip || user.value.isVIP || 0,
		knowledgeBaseQuota: user.value.knowledgeBaseQuota || "",
		remainingTokens: user.value.remainingTokens || "",
		tokenQuantity: user.value.userMargin.tokenQuantity || 0,
		phone: user.value.phone || "",
		identityTypy: user.value.identityTypy || 0,
		avatarUrl: user.value.avatar || "",
		zhsToken: user.value.zhsToken,
		uuid: user.value.uuid,
	};
})

onMounted(() => {
	user.value = uni.getStorageSync("data");
	if (!user.value.tokenBalance) {
		user.value.tokenBalance = user.value.token_quantity || 0;
	}
	grade.value = uni.getStorageSync("vip");

	currentUser.value = {
		open_id: user.value.open_id || "",
		isLoggedIn: !!user.value.phone,
		username: user.value.thirdPartyAccounts.nickname || user.value.thirdPartyAccounts.username || "",
		isVip: user.value.isVip || user.value.isVIP || 0,
		knowledgeBaseQuota: user.value.knowledgeBaseQuota || "",
		remainingTokens: user.value.remainingTokens || "",
		tokenQuantity: user.value.userMargin.tokenQuantity || 0,
		phone: user.value.phone || "",
		identityTypy: user.value.identityTypy || 0,
		avatarUrl: user.value.thirdPartyAccounts.avatar || "",
		zhsToken: user.value.zhsToken,
		uuid: user.value.uuid,
	};

	Promise.all([
		paySelectsGoods("1").then(data => {
			list.value = data.sort((a, b) => a.price - b.price);
			order_type.value = 2;
			indexId.value = list.value[0].id;
			product_id.value = list.value[0].id;
			tokenRecharge.value = list.value[0];
		}),

		paySelectsGoods("0").then(data => {
			vip.value = data.find((item) => item.type === 0);
			liprice.value = data[0].price;
		}),

		fetchTokenBalance(id.value)
	])
		.then(() => {
			hander(list.value[0]);
		})
		.catch(err => console.error("数据加载出错:", err))
		.finally(() => {
			setTimeout(() => {
				loading.value = false;
			}, 500);
		});

	stablePay = stabilization(
		() => pay(center.value, price.value * 100, product_id.value, 0, 0),
		500
	);
	stablePays = stabilization(
		() => pay(center.value, liprice.value * 100, product_id.value, 0, 0),
		500
	);
})

function hander(item) {
	console.log("item", item);
	price.value = item.price;
	order_type.value = 2;
	indexId.value = item.id;
	product_id.value = item.id;
	tokenRecharge.value = item;
	denomination.value = item.denomination;
	denominationOperate.value = item.denominationOperate;
	denominatidenominationVipon.value = item.denominationVip;
	console.log("tokenRecharge完整结构", JSON.stringify(tokenRecharge.value));
}

function choose(item) {
	id.value = item.id;
	console.log(id.value);
}

async function payClick() {
	if (id.value === 1) {
		stablePay().then((res) => {
			user.value = uni.getStorageSync("data");
			grade.value = uni.getStorageSync("vip");
		});
	} else {
		const priceStr = String(activityprice.value);
		const isInteger = /^\d+$/.test(priceStr);
		const minAmount = activitydata.value.beginAmount;
		if (!isInteger || Number(activityprice.value) < minAmount) {
			uni.showToast({ title: '请输入正确的充值金额', icon: 'none' });
			return;
		}

		const data = await zfb_newPay("", activityprice.value, activitydata.value.id, 1, 1)
		let newData = data['data']
		console.log(newData);
		zfbPay(newData)
	}
}

function onPackClick() {
	uni.navigateBack({
		delta: 1,
	});
	console.log("返回");
}

function stabilization(fn, wait) {
	let timer;
	return (...args) => {
		clearTimeout(timer);
		return new Promise((resolve) => {
			timer = setTimeout(() => {
				resolve(fn(...args));
			}, wait);
		});
	};
}

function paySelectsGoods(type) {
	return selectsGoods(type)
		.then((res) => {
			if (res.data) {
				return res.data;
			}
			return null;
		})
		.catch((err) => {
			console.error(err);
			return null;
		});
}

function activateNowClick() {
	console.log(liprice.value)
	order_type.value = 1;
	product_id.value = vip.value.id;
	stablePays().then((res) => {
		user.value = uni.getStorageSync("data");
		grade.value = uni.getStorageSync("vip");
		uni.navigateTo({
			url: "/pages/topup-success/index",
		});
	});
}

function fetchTokenBalance(id) {
	getTokenCount(uni.getStorageSync("data").id, 1)
		.then((res) => {
			if (res.code === 200) {
				user.value.tokenBalance = res.data;
				currentUser.value.tokenQuantity = res.data;
				console.log("Token API response:", res);
			} else {
				console.log("获取Token信息失败:", res);
			}
		})
		.catch((err) => {
			console.error("获取Token信息失败:", err);
		});
}

function tokenClick() {
	payToken(id.value, 10)
		.then((res) => {
			const newUser = { ...user.value, tokenBalance: res };
			user.value = newUser;
		})
		.catch((err) => { });
}

function onCustomInput() {
	uni.showToast({ title: '自定义输入金额功能开发中', icon: 'none' });
}

async function onDiscountTopUp() {
	const priceStr = String(activityprice.value);
	const isInteger = /^\d+$/.test(priceStr);
	const minAmount = activitydata.value.beginAmount;
	if (!isInteger || Number(activityprice.value) < minAmount) {
		uni.showToast({ title: '请输入正确的充值金额', icon: 'none' });
		return;
	}

	console.log(id.value, '------id');

	if (id.value === 1) {
		pay("", activityprice.value, activitydata.value.id, 1, 1)
	} else {
		const data = await zfb_newPay("", activityprice.value, activitydata.value.id, 1, 1)
		let newData = data['data']
		console.log(newData);
		zfbPay(newData)
	}
}

function zfbPay(orderInfo) {
	var alipaySev = null;
	plus.payment.getChannels(function(channels) {
		console.log('=======channels', channels);
		for (var i in channels) {
			var channel = channels[i];
			if (channel.id === 'alipay') {
				alipaySev = channel;
			}
		}
		plus.payment.request(alipaySev, orderInfo, function(result) {
			var rawdata = JSON.parse(result.rawdata);
			console.log("支付成功");
		}, function(e) {
			console.log("支付失败：" + JSON.stringify(e));
		});
	}, function(e) {
		console.log("获取支付渠道失败：" + JSON.stringify(e));
	});
}

function launchAlipay(payInfo) {
	if (uni.getSystemInfoSync().platform !== 'android') {
		uni.showToast({ title: '该功能仅支持安卓设备', icon: 'none' });
		return;
	}

	const Intent = plus.android.importClass('android.content.Intent');
	const Uri = plus.android.importClass('android.net.Uri');
	const mainActivity = plus.android.runtimeMainActivity();
	console.log(mainActivity);
	try {
		const intent = new Intent(Intent.ACTION_VIEW);
		const uri = Uri.parse(`alipay://alipayclient/?${payInfo}`);
		intent.setData(uri);
		intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

		mainActivity.startActivity(intent);

	} catch (e) {
		console.error('唤起支付宝失败:', e);
		uni.showModal({
			title: '提示',
			content: '未检测到支付宝，请手动打开支付宝完成支付',
			confirmText: '知道了',
			success: () => uni.navigateBack()
		});
	}
}
</script>

<style lang="scss" scoped>
.type {
    width: 100vw;
    background-image: url("https://test.aizhs.top/minio/sys-mini/dd-bg.jpg");
    background-size: cover;
    background-repeat: no-repeat;
    background-position: center;
}

/* 骨架屏样式 */
.skeleton-container {
    margin: 20rpx;
    padding: 20rpx;
    height: 360rpx;
}

.skeleton-card {
    height: 240rpx;
    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 32rpx;
    margin-bottom: 20rpx;
}

.skeleton-section {
    height: 40rpx;
    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 8rpx;
    margin-bottom: 10rpx;
}

@keyframes shimmer {
    0% {
        background-position: -200% 0;
    }

    100% {
        background-position: 200% 0;
    }
}

.loading-mask {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background-color: white;
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 9999;
}

.loading-container {
    background-color: #fff;
    padding: 40rpx;
    border-radius: 20rpx;
    display: flex;
    flex-direction: column;
    align-items: center;
    box-shadow: 0 0 20rpx rgb(0 0 0 / 0.1);
}

.loading-spinner {
    width: 100rpx;
    height: 100rpx;
    border: 6rpx solid #f3f3f3;
    border-top: 6rpx solid #8278F0;
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

@keyframes spin {
    0% {
        transform: rotate(0deg);
    }

    100% {
        transform: rotate(360deg);
    }
}

.loading-text {
    margin-top: 30rpx;
    font-size: 32rpx;
    font-weight: bold;
    color: #666;
}

.topup-image {
    width: 100%;
    display: block;
}

.user {
    margin-top: 20rpx;
    padding: 0 20rpx;
}

.user-center {
    border-radius: 30rpx;
    padding: 30rpx 20rpx;
    background: linear-gradient(180deg, #9cc6f4 0%, rgb(216 216 216 / 0) 100%);
}

.user-center-top {
    display: flex;
    justify-content: space-between;
}

.user-center-center {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
}

.user-center-button {
    margin-top: 20rpx;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20rpx;
    border-radius: 30rpx;
    background: linear-gradient(180deg, #efe0cc 0%, #f5b052 100%);
}

.user-center-button-left {
    display: flex;
    align-items: center;
}

.user-center-button-left-item {
    margin-left: 20rpx;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
}

.user-center-button-right-item {
    border-radius: 30rpx;
    font-size: 32rpx;
    font-weight: bold;
    padding: 10rpx 20rpx;
    background: linear-gradient(180deg, #f0bc6f 0%, #98d1ee 50%, #eeb781 100%);
}

// 价格
.price {
    padding-top: 20rpx;
    display: flex;
    justify-content: space-between;
    flex-wrap: wrap;
}

.price-item {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 30%;
    padding: 10rpx 0;
    border-radius: 30rpx;
    margin-bottom: 20rpx;
    background: linear-gradient(0deg, rgb(88 78 203 / 0) -39%, #8278F0 100%);
}

.active {
background: linear-gradient(180deg, rgb(255 254 200 / 0.4) 0%, rgb(219 255 89 / 0.4) 54%, rgb(137 175 0 / 0.4) 100%);
}

// input
.input {
    color: white;
    padding: 0 20rpx;
    border-radius: 30rpx;
    height: 60rpx;
    background-color: #a8d6f7;
}

.topup {
    padding: 20rpx 30rpx;
    border-radius: 30rpx;
    background: #F1F1F1;
}

.topup-item {
    height: 80rpx;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.topup-item-left {
    display: flex;
    align-items: center;
}

.topup-item-right {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 40rpx;
    height: 40rpx;
    border-radius: 50%;
    border: 2px solid #8178EF;
}

.rounded {
    width: 20rpx;
    height: 20rpx;
    border-radius: 50%;
    background: #8178EF;
}

// 步骤
.step {
    border-radius: 30rpx;
    color: black;
    margin-top: 30rpx;
    padding: 20rpx;
    display: flex;
    justify-content: space-between;
    background: linear-gradient(270deg, #dee4fd 0%, rgb(216 216 216 / 0) 100%);
}

.btns {
    min-width: 180rpx;
    margin-bottom: 24rpx;
    display: flex;
    align-items: center;
    border-radius: 15rpx;
    font-size: 40rpx;
    font-family: 'Lilita One', 'PingFang SC', Arial, sans-serif;
    font-weight: bold;
    color: #222;
    padding: 10rpx;
    box-shadow: 0 2px 6px 0 rgb(0 0 0 / 0.3);
    background: linear-gradient(108deg, rgb(205 208 255 / 0.3) 3%, rgb(253 255 225 / 0.3) 104%);
    box-sizing: border-box;
    justify-content: center;
}

// 活动充值
.topup-info {
}

.topup-info-row {
    margin-bottom: 20rpx;
}

.topup-info-label {
    font-size: 28rpx;
    color: #505050;
    margin-left: 20rpx;
}

.topup-info-btns {
    display: flex;
    justify-content: flex-start;
    align-items: center;
    margin-bottom: 20rpx;
    gap: 30rpx;
}

.custom-btn {
    background: #b2e2ff;
    color: #1684fc;
    border-radius: 30rpx;
    font-size: 28rpx;
    padding: 10rpx 40rpx;
    border: none;
}

.discount-btn {
    color: #fff;
    border-radius: 40rpx;
    font-size: 28rpx;
    margin-left: 20rpx;
    background: linear-gradient(0deg, #8278F0 38%, rgb(88 78 203 / 0) 100%);
    box-sizing: border-box;
    border: 1px solid #8D88C5;
}

.topup-info-desc {
    margin-top: 10rpx;
}

.topup-info-title {
    font-size: 28rpx;
    color: #FF8F1F;
}

.topup-info-subtitle {
    font-size: 26rpx;
    color: #ff7e5f;
    margin: 10rpx 0;
}

.topup-info-text {
    font-size: 24rpx;
    color: #666;
    margin-top: 6rpx;
}

.custom-input {
    color: #666;
    border-radius: 50rpx;
    height: 80rpx;
    padding: 0;
    width: 50%;
    text-align: center;
    outline: none;
    font-weight: bold;
    box-sizing: border-box;
    margin: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #EBEAF7;
    border: 1px solid #8D88C5;
}

/* 兼容微信小程序/uni-app placeholder 伪类写法 */
.custom-input::input-placeholder {
    color: #fff;
    text-align: center;
}

.custom-input:placeholder {
    color: #fff;
    text-align: center;
}

.custom-input::placeholder {
    color: #fff;
    text-align: center;
}

.custom-input:input-placeholder {
    color: #fff;
    text-align: center;
}

/* uni-app/微信小程序专用写法 */
.custom-input::placeholder {
    color: #fff;
    text-align: center;
}

/* 保证 placeholder 聚焦时不移动 */
.custom-input:focus::placeholder {
    color: #fff;
    text-align: center;
}

/* 用户信息卡片 start */
.user-info-card {
    background: linear-gradient(to right,
            rgb(211 215 253 / 0.3) 40%,
            rgb(173 181 255 / 0.6) 100%);
    border-radius: 32rpx;
    padding: 20rpx;
    font-family: "PingFang SC", "Microsoft YaHei", sans-serif;
    color: #333;
    position: relative;
    box-shadow: 0 8rpx 24rpx rgb(0 0 0 / 0.08);
    margin: 20rpx;
}

.card-content {
    display: flex;
    align-items: flex-start;
    gap: 30rpx;
}

.user-avatar-section {
    .avatar-img {
        width: 150rpx;
        height: 150rpx;
        border-radius: 50%;
        background-color: white;
        border: 4rpx solid white;
    }
}

.login-status {
    border: 1px solid #555;
    border-radius: 16rpx;

    .username-wrapper {
        padding: 15rpx 10rpx;
        display: flex;
        align-items: center;
        cursor: pointer;
    }

    .username-icon {
        width: 10%;
        border-radius: 50%;
        background: #f5f6fa;
        object-fit: cover;
    }

    .username-edit {
        width: 88rpx;
        height: 65rpx;
    }

    .username {
        width: 100%;
        font-size: 25rpx;
        font-weight: bold;
        color: #000;
    }

    .login-btn {
        background-color: transparent;
        padding: 0;
        margin: 0;
        font-size: 44rpx;
        font-weight: bold;
    }
}

.cps-container {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    width: 100%;
    background: transparent;
}

.left {
    background: linear-gradient(to right, #f6f5ff 60%, #e0ddff 100%);
    border-radius: 30rpx;
    box-shadow: 0 2rpx 8rpx #e0e0ff;
    padding: 10rpx;
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-right: 20rpx;
}

.identity-title {
    position: relative;
    padding-left: 48rpx;
    font-size: 32rpx;
    color: #222;
    font-weight: bold;

    &::before {
        content: "";
        position: absolute;
        left: 0;
        top: 50%;
        transform: translateY(-50%);
        width: 45rpx;
        height: 45rpx;
        background: url("https://img.icons8.com/ios-filled/50/000000/identification-documents.png") no-repeat center/contain;
        display: inline-block;
    }
}

.role {
    color: #9694ff;
    font-size: 35rpx;
    margin-top: 8rpx;
}

/* 用户信息卡片 end */
.topup-info {
    margin: 20rpx;
}

.topup-info-bg {
    width: 100%;
    position: relative;
}

.topup-info-text-box {
    position: absolute;
    color: red;
}



.divider {
    width: 96%;
    height: 2rpx;
    background: #bfc6e6;
    margin: 24rpx auto;
    border-radius: 2rpx;
}

.user-info-section {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 20rpx;
}

.amount-card {
    background: rgb(255 255 255 / 0.4);
    border-radius: 20rpx;
    padding: 20rpx;
    margin: 20rpx;
    box-shadow: 0 6px 6px 0 rgb(169 165 255 / 0.6);
}

.amount-header {
    display: flex;
    align-items: center;
    margin-bottom: 20rpx;
}

.amount-header-icon {
    width: 50rpx;
    margin-right: 10rpx;
}

.amount-header-title {
    font-size: 32rpx;
    font-weight: bold;
    color: #333;
}

.amount-header-right {
}

.amount-header-rate {
    font-size: 28rpx;
    color: #666;
}

.amount-header-desc {
    font-size: 26rpx;
    color: #999;
}

.amount-list {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    margin: 10rpx auto 20rpx;
}

.amount-item {
    width: 30%;
    min-width: 180rpx;
    margin-bottom: 24rpx;
    display: flex;
    align-items: center;
    border-radius: 16rpx;
    font-size: 40rpx;
    font-family: 'Lilita One', 'PingFang SC', Arial, sans-serif;
    font-weight: bold;
    color: #222;
    padding: 10rpx 10rpx 10rpx 40rpx;
    box-shadow: 0 2px 6px 0 rgb(0 0 0 / 0.3);
    background: linear-gradient(108deg, rgb(205 208 255 / 0.3) 3%, rgb(253 255 225 / 0.3) 104%);
    box-sizing: border-box;
}

.amount-item:nth-child(3n) {
    margin-right: 0;
}

.amount-item-icon {
    width: 44rpx;
    height: 44rpx;
}

.amount-item.active {
    background: linear-gradient(180deg, rgb(255 254 200 / 0.4) 0%, rgb(219 255 89 / 0.4) 54%, rgb(137 175 0 / 0.4) 100%);
    border-image: linear-gradient(0deg, rgb(249 255 213 / 0.4) 0%, rgb(237 249 172 / 0) 100%) 2;
    box-shadow: 0 2px 6px 0 rgb(0 0 0 / 0.3);
    color: #B7FF00;
}

.amount-item-text {
    font-size: 32rpx;
    font-weight: bold;
    color: #333;
    width: 50%;
    text-align: center;
    font-family: monospace;
}

.amount-item.active .amount-item-text {
    color: #B7FF00;
    text-shadow: 2rpx 2rpx 6rpx rgb(0 0 0 / 0.4), 0 0 8rpx rgb(0 0 0 / 0.2);
}

.amount-remark {
    display: flex;
    align-items: center;
    margin-top: 20rpx;
    background: linear-gradient(180deg, rgb(173 173 173 / 0.2) 0%, rgb(220 220 220 / 0.2) 49%, rgb(255 255 255 / 0.2) 100%);
    box-sizing: border-box;
    box-shadow: 0 0 4px 0 rgb(0 0 0 / 0.1);
    border-radius: 40rpx;
}

.amount-remark-icon {
    width: 80rpx;
    height: 80rpx;
    margin-right: 10rpx;
}

.amount-remark-label {
    font-size: 28rpx;
    color: #666;
}

.amount-remark-input {
    flex: 1;
    outline: none;
    color: #000
}

.pay-card {
    background: #fff;
    border-radius: 30rpx;
    padding: 20rpx;
    box-shadow: 0 6px 6px 0 rgb(169 165 255 / 0.6);
}

.pay-header {
    display: flex;
    align-items: center;
    margin-bottom: 20rpx;
}

.pay-header-icon {
    width: 50rpx;
    margin-right: 10rpx;
}

.pay-header-title {
    font-size: 32rpx;
    font-weight: bold;
    color: #222;
    text-shadow: 2rpx 2rpx 0 #fff, 0 2rpx 0 #fff, 2rpx 0 0 #fff;
}

.pay-header-tip {
    flex: 1;
    text-align: right;
    color: #989697;
    font-size: 20rpx;
    margin-left: 20rpx;
}

.pay-header-tip .bold {
    font-weight: bold;
    color: #989697;
}

.pay-list {
    margin-top: 20rpx;
}

.pay-item {
    display: flex;
    align-items: center;
    background: linear-gradient(90deg, #f7f8ff 0%, #f9fbe7 100%);
    border-radius: 24rpx;
    margin-bottom: 30rpx;
    padding: 15rpx 20rpx;
    font-size: 30rpx;
    color: #222;
    box-shadow: 0 4rpx 16rpx rgb(0 0 0 / 0.04);
    position: relative;
    height: 40rpx;
}

.pay-item.active {
    background: linear-gradient(90deg, #e6eaff 0%, #fffde4 100%);
    box-shadow: 0 8rpx 32rpx rgb(88 78 203 / 0.08);
}

.pay-icon {
    width: 50rpx;
    height: 50rpx;
    margin-right: 30rpx;
}

.pay-name {
    font-size: 30rpx;
    color: #222;
    font-family: 'Lilita One', 'PingFang SC', Arial, sans-serif;
}

.pay-radio {
    margin-left: auto;
    display: flex;
    align-items: center;
}

.pay-radio-outer {
    width: 44rpx;
    height: 44rpx;
    border-radius: 50%;
    border: 4rpx solid #bdbdbd;
    background: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: border-color 0.2s;
}

.pay-radio-outer.checked {
    border-color: #8587ff;
    box-shadow: 0 0 0 4rpx #e0e3ff;
}

.pay-radio-inner {
    width: 20rpx;
    height: 20rpx;
    border-radius: 50%;
    background: #8587ff;
}

.btn-row {
    display: flex;
    justify-content: center;
    margin: 40rpx 0;
}

.main-btn {
    width: 300rpx;
    height: 80rpx;
    background: linear-gradient(90deg, #e6eaff 0%, #fffde4 100%);
    color: #222;
    font-size: 36rpx;
    font-weight: bold;
    border-radius: 20rpx;
    box-shadow: 0 8rpx 32rpx rgb(88 78 203 / 0.08);
    font-family: 'Lilita One', 'PingFang SC', Arial, sans-serif;
}

.activity-bg-box {
    position: relative;
    margin: 20rpx;
    border-radius: 40rpx;
    overflow: visible;
    min-height: 540rpx;
    box-shadow: 0 8rpx 32rpx rgb(255 126 95 / 0.15);
}

.activity-bg-img {
    width: 100%;
    border-radius: 40rpx;
    position: relative;
    z-index: 1;
    height: 580rpx !important;
}

.activity-fire {
    position: absolute;
    left: 60rpx;
    top: 60rpx;
    width: 100rpx;
    z-index: 2;
}

.activity-title-wrap {
    position: absolute;
    left: 180rpx;
    top: 80rpx;
    z-index: 3;
    display: flex;
    flex-direction: column;
}

.activity-title-main {
    font-size: 54rpx;
    font-weight: bold;
    color: #fffde4;
    text-shadow: 4rpx 4rpx 0 #ffb300, 0 4rpx 0 #ffb300, 4rpx 0 0 #ffb300;
}

.activity-title-sub {
    font-size: 48rpx;
    font-weight: bold;
    color: #fffde4;
    margin-top: 8rpx;
    text-shadow: 4rpx 4rpx 0 #ffb300, 0 4rpx 0 #ffb300, 4rpx 0 0 #ffb300;
}

.activity-content-card {
    position: absolute;
    left: 0;
    right: 0;
    top: 200rpx;
    margin: 0 36rpx;
    border-radius: 30rpx;
    box-shadow: 0 4rpx 24rpx rgb(0 0 0 / 0.06);
    padding: 0rpx 36rpx;
    z-index: 4;
}

.activity-desc-row {
    margin-bottom: 12rpx;
    color: black;
    min-height: 206rpx;
}

.activity-desc-red {
    color: #ff4d4f;
    font-size: 24rpx;
}

.activity-desc-main {
    color: #848484;
    font-size: 30rpx;
    font-weight: bold;
}

.activity-desc-black {
    color: #FF5757;
    font-size: 30rpx;
    font-weight: bold;
}

.activity-desc-orange {
    color: #FF5757;
    font-size: 24rpx;
}

.bold {
    font-weight: bold;
    color: #ffb300;
}

.activity-input-action-row {
    display: flex;
    flex-direction: row;
    align-items: flex-start;
    justify-content: flex-start;
    gap: 32rpx;
    position: absolute;
    bottom: 37rpx;
    z-index: 100;
}

.activity-input-card {
    flex: 1;
    border-radius: 15rpx;
    box-shadow: 0 4rpx 16rpx rgb(0 0 0 / 0.06);
    display: flex;
    flex-direction: column;
    min-width: 0;
    background: linear-gradient(107deg, rgb(217 219 255 / 0.8) 3%, rgb(253 255 220 / 0.8) 104%);
    box-sizing: border-box;
    border-width: 0 0 4rpx;
    border-style: solid;
    border-color: #9A96CD;
    width: 215rpx;
    height: 65rpx;
}

.input-card-main {
    display: flex;
    align-items: center;
    width: 215rpx;
    height: 65rpx;
}

.input-card-icon {
    width: 44rpx;
    height: 44rpx;
    margin-right: 16rpx;
}

.input-card-main-text {
    font-size: 22rpx;
    color: #6a7be6;
    font-weight: bold;
    margin-left: 4rpx;
}

.input-card-sub {
    font-size: 24rpx;
    color: #888;
    margin-left: 4rpx;
}

.input-card-bold {
    font-weight: bold;
    color: #222;
    margin: 0 4rpx;
}

.input-card-red {
    color: #FF5757;
    font-weight: bold;
}

.activity-input-btn-card {
    min-width: 146rpx;
    height: 65rpx;
    max-width: 240rpx;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    margin-left: 16rpx;
    position: relative;
    border-radius: 15rpx;
    background: linear-gradient(114deg, rgb(217 219 255 / 0.8) 3%, rgb(253 255 220 / 0.8) 104%);
    box-sizing: border-box;
    border-width: 0 0 4rpx 0rpx;
    border-style: solid;
    border-color: #9A96CD;
    backdrop-filter: blur(10px);
    box-shadow: 0 2rpx 4rpx 0 rgb(0 0 0 / 0.3);
    padding: 0 9rpx;
}

.input-btn-main {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    width: 100%;
    padding-left: 15rpx;
}

.input-btn-main-text {
    font-size: 30rpx;
    color: #F7F173;
    margin-right: 8rpx;
}

.input-btn-icon {
    width: 60rpx;
    height: 60rpx;
    position: absolute;
    left: 90rpx;
    top: 0;
}

.input-btn-sub {
    font-size: 16rpx;
    color: #FFF;
    margin-top: 2rpx;
    width: 100%;
    display: flex;
    justify-content: flex-start;
    padding-left: 15rpx;
}
</style>
