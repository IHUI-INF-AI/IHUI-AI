/* 不同卡片渲染不同智能体类别 * @author: TONG * @date: 2025-04-30 */

<template>
	<view class="ai-list">
		<view class="title_container" v-if="showTitle">
			<view class="title_text title_left" style="font-size: 36rpx;"><image src="/static/images/hot.png" style="width: 50rpx;height: 50rpx;display: block;float: left;margin-right: 10rpx;" mode="widthFix"></image>热门排行</view>
		</view>

		<view class="ai-card-row znt_row" style="">
			<view v-for="(item, idx) in visibleTools" :key="idx" class="ai-card" :style="{ backgroundImage: item.bg }"
				style="border-radius: 25rpx" @click="navigateTo(item,idx)">
				<view class="card-box" :class="idx < 3 ? 'import_card-border' : 'nomarl_card-border'">
					<view class="xin-card-content" :class="idx < 3 ? 'import_card-bg' : 'nomarl_card-bg'">
						<view style="display: flex; flex-direction: column; justify-content: space-between; height: 100%;">
							<view class="card-zuo" style="position: relative;">
								<image v-if="idx == 0" src="/static/images/rankone.png" mode="widthFix" style="position: absolute;right: 9rpx;top: 0;width: 48rpx;height: 48rpx;"></image>
								<image v-if="idx == 1" src="/static/images/ranktwo.png" mode="widthFix" style="position: absolute;right: 9rpx;top: 0;width: 48rpx;height: 48rpx;"></image>
								<image v-if="idx == 2" src="/static/images/rankthree.png" mode="widthFix" style="position: absolute;right: 9rpx;top: 0;width: 48rpx;height: 48rpx;"></image>
								<view style="width: 100%;">
									<view class="card-you-box1" style="float: left;position: relative;">
										<view v-if="item.type == 6" class="vip_label">
											<image src="/static/images/vip_label.png" mode="heightFix" class="label_icon"></image>
											<text class="label_title">会员免费</text>
										</view>
										<view v-if="item.type == 1" class="vip_label">
											<image style="" src="/static/images/mian_label.png" mode="heightFix" class="label_icon"></image>
											<text class="label_title" style="color: #80BEFF;">免费使用</text>
										</view>
										<view v-if="item.type == 2" class="vip_label">
											<image style="" src="/static/images/xian_label.png" mode="heightFix" class="label_icon"></image>
											<text class="label_title" style="color: #FF8A8A;">限时免费</text>
										</view>
										<view v-if="item.type == 3 || item.type == 5" class="vip_label">
											<image style="" src="/static/images/yue_label.png" mode="heightFix" class="label_icon"></image>
											<text class="label_title" style="color: #FF1818;overflow: auto;">{{
												(item.accountType && item.accountType.account && item.accountType.type) ? (item.accountType.account / 100).toFixed(2) + '/' + item.accountType.type : ''
											}}</text>
										</view>
										<view v-if="item.type == 4" class="vip_label" style="background-color: #5E56FF;">
											<image src="/static/images/yibuy_label.png" mode="heightFix" class="label_icon"></image>
											<text class="label_title" style="color: #FFF;">已购买</text>
										</view>
										<image class="robot-img floating-decoration" mode="" :src="item.agentAvatar"></image>
									</view>
									<view class="xin-left">
										<view class="xin-title">
											<text class="max_title" :style="{ 'color': idx < 3 ? '#517bff' : '#000','maxWidth': idx < 3 ? item.isNew == 1 ? 'calc(100% - 56rpx - 57rpx)':'calc(100% - 57rpx)':item.isNew == 1 ? 'calc(100% - 56rpx)':'100%' }" style="float: left;line-height: 50rpx;font-size: 38rpx;">{{ item.agentName }}</text>
											<text class="xin-title-new" v-if="item.isNew == 1"> </text>
										</view>
									</view>
									<view class="tab_list">
										<view class="tab_item" v-for="(value,indextab) in item.agentMainCategory" :key="indextab">{{ value.name }}</view>
									</view>
									<view class="subtitle" style="color: rgb(0 0 0 / 0.6);">{{ item.agentDescription }}</view>
								</view>
							</view>
							<view style="display: flex; justify-content: space-between; align-items: flex-end;padding-bottom: 5rpx;margin-top: -10rpx;padding-right: 5rpx;">
								<view class="profile">
									<image class="xin-avatar" src="/static/images/guanlogo.png"></image>
									<span class="xin-name">智汇社区-官方</span>
									<view class="xin-title-hot" v-if="item.isHot == 0" style="margin-top: 0;">
										<image src="/static/images/useNum.png" style="width: 22rpx;height: 19rpx;margin-bottom: 0;" mode="widthFix"></image>
										<text style="color: #000;">{{ numResult(item.usageCount) }}</text>
									</view>
									<view class="xin-title-hot" v-if="item.isHot == 1">
										<image src="/static/images/hot.png" style="width: 44rpx;height: 44rpx;" mode="widthFix"></image>
										<text>{{ numResult(item.usageCount) }}</text>
									</view>
								</view>
								<view class="" style="margin-bottom: 0;">
									<view style="float: right;position: relative;margin-top: 4rpx;">
										<button @click.stop="" open-type="share" style="opacity: 0;position: absolute;z-index: 1;width: 36rpx;height: 36rpx;">分享</button>
									<image @click.stop="intelliShow(item.prologue)"
										src="/static/images/new_share.png"
										style="width: 36rpx;height: 36rpx;display: block;" alt="" ></image>
									</view>
									<text style="display: block;color: #373737;font-size: 24rpx;float: right;height:44rpx;line-height:44rpx;padding: 0 10rpx;">{{ numResult(item.collectCount) }}</text>
									<image @click.stop="getAgentCollect(item.botId)" v-if="item.isCollect == 0" src="/static/images/shoucang.png" style="width: 44rpx;height: 44rpx;display: block;float: right;margin-top: -2rpx;" mode="widthFix"></image>
									<image @click.stop="getAgentCollect(item.botId)" v-else src="/static/images/choucang_active.png" style="width: 44rpx;height: 44rpx;display: block;float: right;margin-top: -2rpx;" mode="widthFix"></image>
									<image v-if="item.isThumbs == 0" @click.stop="getAgentLike(item.botId)" src="/static/images/like.png" style="width: 44rpx;height: 44rpx;margin-bottom: -14rpx;" mode="widthFix"></image>
									<image v-else @click.stop="getAgentLike(item.botId)" src="/static/images/like_active.png" style="width: 44rpx;height: 44rpx;margin-bottom: -14rpx;" mode="widthFix"></image>
									<text style="display: inline-block;color: #373737;font-size: 24rpx;padding: 0 10rpx;">{{ numResult(item.likeCount) }}</text>
								</view>
							</view>
						</view>
					</view>
				</view>
			</view>
		</view>

		

		<!-- 智能体类别按钮 #FF5F33 -->
		<view class="ai-card-row znt_row" style="" v-if="false">
			<view v-for="(item, idx) in visibleTools.slice(3)" :key="idx + 3" class="ai-card" :style="{ backgroundImage: item.bg }"
				style="border-radius: 25rpx" @click="navigateTo(item,idx + 3)">
				<view class="card-box" :class="(idx + 3) < 3 ? 'import_card-border' : 'nomarl_card-border'">
					<view class="xin-card-content" :class="(idx + 3) < 3 ? 'import_card-bg' : 'nomarl_card-bg'">
						<view style="display: flex; flex-direction: column; justify-content: space-between; height: 100%;">
							<view class="card-zuo" style="position: relative;">
								<view style="width: 100%;">
									<view class="card-you-box1" style="float: left;position: relative;">
										<view v-if="item.type == 6" class="vip_label">
											<image src="/static/images/vip_label.png" mode="heightFix" class="label_icon"></image>
											<text class="label_title">会员免费</text>
										</view>
										<view v-if="item.type == 1" class="vip_label">
											<image style="" src="/static/images/mian_label.png" mode="heightFix" class="label_icon"></image>
											<text class="label_title" style="color: #80BEFF;">免费使用</text>
										</view>
										<view v-if="item.type == 2" class="vip_label">
											<image style="" src="/static/images/xian_label.png" mode="heightFix" class="label_icon"></image>
											<text class="label_title" style="color: #FF8A8A;">限时免费</text>
										</view>
										<view v-if="item.type == 3 || item.type == 5" class="vip_label">
											<image style="" src="/static/images/yue_label.png" mode="heightFix" class="label_icon"></image>
											<text class="label_title" style="color: #FF1818;overflow: auto;">{{
												(item.accountType && item.accountType.account && item.accountType.type) ? (item.accountType.account / 100).toFixed(2) + '/' + item.accountType.type : ''
											}}</text>
										</view>
										<view v-if="item.type == 4" class="vip_label" style="background-color: #5E56FF;">
											<image src="/static/images/yibuy_label.png" mode="heightFix" class="label_icon"></image>
											<text class="label_title" style="color: #FFF;">已购买</text>
										</view>
										<image class="robot-img floating-decoration" mode="" :src="item.agentAvatar"></image>
									</view>
									<view class="xin-left">
										<view class="xin-title">
											<text class="max_title" :style="{ 'color': '#000','maxWidth': item.isNew == 1 ? 'calc(100% - 56rpx)':'100%' }" style="float: left;line-height: 50rpx;font-size: 38rpx;">{{ item.agentName }}</text>
											<text class="xin-title-new" v-if="item.isNew == 1"> </text>
										</view>
									</view>
									<view class="tab_list">
										<view class="tab_item" v-for="(value,indextab) in item.agentMainCategory" :key="indextab">{{ value.name }}</view>
									</view>
									<view class="subtitle" style="color: rgb(0 0 0 / 0.6);">{{ item.agentDescription }}</view>
								</view>
							</view>
							<view style="display: flex; justify-content: space-between; align-items: flex-end;padding-bottom: 5rpx;margin-top: -10rpx;padding-right: 5rpx;">
								<view class="profile">
									<image class="xin-avatar" src="/static/images/guanlogo.png"></image>
									<span class="xin-name">智汇社区-官方</span>
									<view class="xin-title-hot" v-if="item.isHot == 0" style="margin-top: 0;">
										<image src="/static/images/useNum.png" style="width: 22rpx;height: 19rpx;margin-bottom: 0;" mode="widthFix"></image>
										<text style="color: #000;">{{ numResult(item.usageCount) }}</text>
									</view>
									<view class="xin-title-hot" v-if="item.isHot == 1">
										<image src="/static/images/hot.png" style="width: 44rpx;height: 44rpx;" mode="widthFix"></image>
										<text>{{ numResult(item.usageCount) }}</text>
									</view>
								</view>
								<view class="" style="margin-bottom: 0;">
									<view style="float: right;position: relative;margin-top: 4rpx;">
										<button @click.stop="" open-type="share" style="opacity: 0;position: absolute;z-index: 1;width: 36rpx;height: 36rpx;">分享</button>
									<image @click.stop="intelliShow(item.prologue)"
										src="/static/images/new_share.png"
										style="width: 36rpx;height: 36rpx;display: block;" alt="" ></image>
									</view>
									<text style="display: block;color: #373737;font-size: 24rpx;float: right;height:44rpx;line-height:44rpx;padding: 0 10rpx;">{{ numResult(item.collectCount) }}</text>
									<image @click.stop="getAgentCollect(item.botId)" v-if="item.isCollect == 0" src="/static/images/shoucang.png" style="width: 44rpx;height: 44rpx;display: block;float: right;margin-top: -2rpx;" mode="widthFix"></image>
									<image @click.stop="getAgentCollect(item.botId)" v-else src="/static/images/choucang_active.png" style="width: 44rpx;height: 44rpx;display: block;float: right;margin-top: -2rpx;" mode="widthFix"></image>
									<image v-if="item.isThumbs == 0" @click.stop="getAgentLike(item.botId)" src="/static/images/like.png" style="width: 44rpx;height: 44rpx;margin-bottom: -14rpx;" mode="widthFix"></image>
									<image v-else @click.stop="getAgentLike(item.botId)" src="/static/images/like_active.png" style="width: 44rpx;height: 44rpx;margin-bottom: -14rpx;" mode="widthFix"></image>
									<text style="display: inline-block;color: #373737;font-size: 24rpx;padding: 0 10rpx;">{{ numResult(item.likeCount) }}</text>
								</view>
							</view>
						</view>
					</view>
				</view>
			</view>
		</view>
		<view v-if="showBottom" class="toodown" style="z-index: 1001;">
			<image @click="backToTop" style="" class="toodownimg" src="/static/images/back.svg" mode="widthFix"></image>
		</view>
		<!-- 服务弹窗 -->
		<view v-if="isServicePopupVisible" class="service-mask" @click="hideServicePopup">
			<view class="service-popup-content" @click.stop>
				<view style="display: flex; flex-direction: column; align-items: center;">
					<image class="card-image" src="/static/images/mingpian.png" mode="widthFix">
					</image>
					<image class="card-image2" show-menu-by-longpress="true"
						src="/static/images/erweima.png" mode="widthFix">
					</image>
					<image style="margin-top: 16rpx;" src="/static/images/text-tip.jpg"
						mode="widthFix">
					</image>
				</view>
			</view>
		</view>

		<view v-if="visibleTools.length <= 0">
			<view class="empty f_c font_nomal">
                <text>快去应用商店</text>
                <text class="font_big">雇佣您的AI员工</text>
                <image class="image" src="/static/images/empty.png" />
            </view>
		</view>

		<view>
			<!-- 遮罩层 -->
			<view v-if="show" class="mask" @click="close"></view>
			<!-- 弹窗内容 -->
			<view v-if="show" class="dialog">
				<text>{{ textInfo == '' ? '此功能暂无说明' : textInfo }}</text>
				<view style="margin-top: 40rpx;">
					<button @click="close">关闭</button>
				</view>
			</view>
		</view>
		<view class="pay_mask" v-show="showPay" @click="closePay"></view>
		<view class="pay_window" :class="showPay ? 'pay_window_active':''">
			<view class="base_datas">
				<view class="head">
					<image class="head-image" :src="itemData.agentAvatar" mode="widthFix" lazy-load="true" />
				</view>
				<view class="content_main m_b">
					<view class="title m_b" style="margin-bottom: 8rpx;">{{ itemData.agentName }}</view>
					<view class="title-sub">{{ detail.prologue }}</view>
				</view>
			</view>
			<view class="f_n m_b">价格：{{ price }} 元 / {{ typeChilds[detail.type_child] || '月' }}</view>

			<view class="f_n m_b">折扣：{{ discounts[detail.discount_month] || '无' }}</view>
			<view class="f_n m_b" style="display: flex; align-items: center;">
				<text>时长按{{ typeChilds[detail.type_child] || '月' }}：</text>
				<image @click.stop="() => { if (count > 1) count-- }" class="pay_icon"
					src="/static/images/pay_delete.png" mode="widthFix" />
				<text style="width: 40rpx;text-align: center;">{{ count }}</text>
				<image @click.stop="() => { count++ }" class="pay_icon"
					src="/static/images/pay_add.png" mode="widthFix" />
			</view>
			<view class="b_f" @click.stop="toPay">
				<view class="b_f_title" style="display: block;flex: none;width: 100%;">立即支付</view>
				<view class="b_f_text">
					<text>￥</text>
					<text>{{ real_price }}</text>
				</view>
			</view>
			<view class="discount">折扣￥{{ discount }}</view>
		</view>
	</view>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import {
  getAgentListAll
} from "@/service/pay.js"
import { getChargeInfoById, createPayHistory } from '@/service/aiModels.js'
import { pay } from "@/utils/pay/index.js"

const props = defineProps({
	searchKeyword: {
		type: String,
		default: '',
	},
	ailist: {
		type: Array,
		default: () => [],
	},
	showAssistant: {
		type: Boolean,
		default: false,
	},
	isBottoma: {
		type: Boolean,
		default: false,
	},
	showRoot: {
		type: Boolean,
		default: true
	},
	showBottom: {
		type: Boolean,
		default: true
	},
	showNoMore: {
		type: Boolean,
		default: true
	},
	showTabbar:{
		type: Boolean,
		default: false,
	},
	showTitle: {
		type: Boolean,
		default: false,
	}
})

const emit = defineEmits(['getAgentCollect', 'getAgentLike'])

const show = ref(false)
const showMore = ref(false)
const isServicePopupVisible = ref(false)
const visibleAppend = ref([
	{
		title: '开发者上传项目赚钱',
		img: '../../../../static/tabbar/tabbar_2.png',
	},
])
const aiList = ref([])
const showDevEnter = ref(false)
const textInfo = ref('')
const filteredData = ref([])
const itemData = ref({})
const loading = ref(false)
const real_price = ref('')
const discount = ref('无')
const count = ref(1)
const showPay = ref(false)
const detail = ref({})
const typeChilds = ref({
	'1': '月',
	'2': '年',
	'3': '永久'
})
const price = ref(0)
const discounts = ref({
	'1': '8折',
	'2': '7折',
	'3': '5折'
})

watch(() => props.ailist, (newVal) => {
	aiList.value = newVal
})

watch(() => props.searchKeyword, (newVal) => {
	if (!newVal) {
		filteredData.value = aiList.value
		return
	}
	getAgentListAll({ agentName: newVal.toLowerCase() })
		.then(res => {
			filteredData.value = res.data?.agents || []
		})
		.catch(err => {
			filteredData.value = []
		})
}, { immediate: true })

watch(count, (n) => {
	let priceVal = (price.value * count.value).toFixed(2)
	if (detail.value.discount_month) {
		if (detail.value.discount_month == '1') {
			real_price.value = (priceVal * 0.8).toFixed(2)
		}
		if (detail.value.discount_month == '2') {
			real_price.value = (priceVal * 0.7).toFixed(2)
		}
		if (detail.value.discount_month == '3') {
			real_price.value = (priceVal * 0.5).toFixed(2)
		}
		discount.value = priceVal - real_price.value
	} else {
		real_price.value = priceVal
		discount.value = '无'
	}
})

const fliterList = computed(() => {
	if (!props.searchKeyword || props.searchKeyword == '' || props.searchKeyword == null || props.searchKeyword == undefined) {
		return aiList.value
	} else {
		return filteredData.value
	}
})

const visibleTools = computed(() => {
	const list = Array.isArray(fliterList.value) ? fliterList.value : []
	list.forEach(item => {
		item.tabList = ['文案','图片','视频','音频','音乐','编程','图片','视频','音频','音乐','编程','图片','视频','音频','音乐','编程']
	})
	return list
})

function toggleShowMore() {
	showMore.value = !showMore.value
}

function closePay() {
	showPay.value = false
}

function close() {
	show.value = false
}

function intelliShow(text) {
	textInfo.value = text
	show.value = true
}

function getAgentCollect(id) {
	emit('getAgentCollect', id)
}

function getAgentLike(id) {
	emit('getAgentLike', id)
}

function backToTop() {
	uni.pageScrollTo({
		scrollTop: 0,
		duration: 300
	})
}

function navigateSwitchTab1(idx) {
	showDevEnter.value = true
	if (idx == 0) {
		uni.navigateTo({
			url: '/pagesA/plaza/developer',
		})
	} else {
		uni.navigateTo({
			url: '/pagesA/plaza/index',
		})
	}
}

function showServicePopup() {
	isServicePopupVisible.value = true
}

function hideServicePopup() {
	isServicePopupVisible.value = false
}

function navigateTo(item, idx) {
	let userInfodata = uni.getStorageSync('data')
	if (!userInfodata) {
		userInfodata = uni.getStorageSync('userInfo')
	}
	if (!userInfodata) {
		uni.showToast({
			title: '请先登录',
			icon: 'none'
		})
		return
	}
	if (item.type == 3 || item.type == 5) {
		itemData.value = item
		buyThisModel()
		return
	}

	uni.navigateTo({
		url: '/pages/tools/ai_assistant?' + '&modelNamea=' + item.agentName + '&pitcha=' + idx + '&agentId=' + item.agentId + '&type=' + item.type
	})
}

function buyThisModel() {
	loading.value = true

	getChargeInfoById(itemData.value.agentId).then(res => {
		loading.value = false
		showPay.value = true
		uni.hideTabBar()
		detail.value = res.data
		price.value = (res.data.account / 100).toFixed(2)
		let priceVal = (price.value * count.value).toFixed(2)
		if (detail.value.discount_month) {
			if (detail.value.discount_month == '1') {
				real_price.value = (priceVal * 0.8).toFixed(2)
			}
			if (detail.value.discount_month == '2') {
				real_price.value = (priceVal * 0.7).toFixed(2)
			}
			if (detail.value.discount_month == '3') {
				real_price.value = (priceVal * 0.5).toFixed(2)
			}
			discount.value = (priceVal - real_price.value).toFixed(2)
		} else {
			real_price.value = priceVal
			discount.value = '无'
		}
	}).finally(() => {
		loading.value = false
	})
}

function toPay() {
	loading.value = true
	let userInfo = uni.getStorageSync('data')
	if (!userInfo) {
		userInfo = uni.getStorageSync('userInfo')
	}
	let params = {
		agent_id: itemData.value.agentId || '',
		agent_name: itemData.value.agentName || '',
		agent_order_uuid: detail.value.create_uuid || '',
		bug_uuid: userInfo.uuid || '',
		bug_name: userInfo.nickname || '',
		category_id: detail.value.id || '',
		discount: detail.value.discount_month || 100,
		real_price: Number(real_price.value) * 100 || '',
		price: detail.value.account || '',
		count: count.value || '',
		prologue: detail.value.prologue || ''
	}
	createPayHistory(params).then(res => {
		loading.value = false
		show.value = false

		pay('', real_price.value * 100, res.data.id, 1, 4)
	})
}

function preloadImages() {
	const app = getApp()
	const preloadPromises = aiList.value.map(async (item, index) => {
		try {
			const tempUrl = await app.globalData.preloadImage(item.img, {
				isCloudStorage: true
			})
		} catch (error) {
		}
	})

	return Promise.all(preloadPromises)
}

function numResult(num) {
	if (num >= 1000) {
		return (num / 1000).toFixed(1) + 'K'
	} else {
		return num
	}
}

function navigateToSquare() {
	uni.switchTab({
		url: '/pages/table/square/index'
	})
}

function uploadApp() {
	uni.navigateTo({
		url: '/pagesA/plaza/developer'
	})
}

function takeOrders() {
	uni.switchTab({
		url: '/pages/table/square/index'
	})
}

function findDeveloper() {
	uni.navigateTo({
		url: '/pagesA/plaza/index?from=aiList'
	})
}

onMounted(() => {
	aiList.value.forEach(item => {
		item.imgLoaded = false
	})
	preloadImages()
})
</script>

<style lang="scss" scoped>
.ai-list {
	position: relative;

	.ai-card-row {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 16rpx 0;
	}

	.ai-card {
		width: 100%;
		border-radius: 30rpx;
		box-sizing: border-box;
		position: relative;
		display: flex;
		align-items: flex-end;
		transition: box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);

		&:hover {
			box-shadow: 0 0 8rpx rgb(22 132 252 / 0.18);
			transform: translateY(0) scale(1.03);
		}

	}

	.nomal_bg {
		border: 1rpx solid #EBEEF5;
	}

	.ai-card-content {
		display: flex;
		justify-content: space-between;
		align-items: flex-end;
		width: 100%;

	}


	.ai-card-text {
		flex: 1 1 0;
		min-width: 0;
		display: flex;
		flex-direction: column;
		justify-content: center;
	}

	.ai-card-title,
	.ai-card-desc {
		width: auto;
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.ai-card-title {
		font-size: 32rpx;
		font-weight: bold;
		color: #6c6c6c;
		margin-bottom: 12rpx;
		display: block;
		text-shadow: 0 2rpx 8rpx rgb(0 0 0 / 0.08);
	}

	.ai-card-desc {
		font-size: 24rpx;
		color: #6c6c6c;
		margin-bottom: 8rpx;
		display: -webkit-box;
		opacity: 0.9;
		width: auto;
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: normal;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
	}

	.ai-card-img-wrapper {
		width: 130rpx;
		height: 130rpx;
		position: relative;
		margin-right: 12rpx;
		flex-shrink: 0;
	}

	.ai-card-img {
		width: 100%;
		height: 100%;
		border-radius: 50%;
		object-fit: cover;
		position: relative;
		z-index: 2;
		opacity: 0;
		transition: opacity 0.3s ease;

		&.img-loaded {
			opacity: 1;
		}
	}

	.skeleton-img {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		border-radius: 50%;
		background: linear-gradient(90deg,
				rgb(190 190 190 / 0.2) 25%,
				rgb(129 129 129 / 0.24) 37%,
				rgb(190 190 190 / 0.2) 63%);
		background-size: 400% 100%;
	}

	@keyframes skeleton-loading {
		0% {
			background-position: 100% 50%;
		}

		100% {
			background-position: 0 50%;
		}
	}

	.expand-button {
		width: 100%;
		display: flex;
		justify-content: center;
		align-items: center;
		padding: 16rpx 0;
		font-size: 28rpx;
		color: #1684fc;
		position: relative;
	}

	.expand-icon {
		margin-left: 10rpx;
		transition: transform 0.3s ease;
	}

	.expand-icon.expanded {
		transform: rotate(180deg);
	}

	.service-banner {
		margin-top: 20rpx;
		padding-left: 18rpx;
		height: 106rpx;
		background: linear-gradient(149deg, rgb(224 225 252 / 0.65) -27%, rgb(144 125 255 / 0.65) -27%, rgb(144 125 255 / 0.65) -27%, rgb(217 219 255 / 0.65) 58%, rgb(217 219 254 / 0.65) 109%, rgb(217 219 254 / 0.65) 128%, rgb(217 219 254 / 0.65) 136%, rgb(217 219 255 / 0.65) 136%);
		border-radius: 30rpx;
		display: flex;
		align-items: center;
		box-shadow: 0 0 10rpx rgb(0 0 0 / 0.05);
		border-left: solid 8rpx #E0E1FC;
		border-right: solid 8rpx #E0E1FC;
		border-top: solid 8rpx #E0E1FC;


		.service-icon {
			width: 60rpx;
			height: 60rpx;
			margin-right: 10rpx;
			padding-bottom: 8rpx;
		}
	}

	.service-text {
		font-size: 30rpx;
		background: linear-gradient(180deg, #B4B7F9 0%, #5E66FF 100%);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		font-family: AlimamaFangYuanTi;
		font-weight: 700;
		padding-bottom: 8rpx;
	}

	.service-mask {
		position: fixed;
		inset: 0;
		display: flex;
		justify-content: center;
		align-items: center;
		z-index: 999999;
		background-color: rgb(0 0 0 / 0.4);
	}

	.service-popup-content {
		padding: 20rpx;
		position: relative;
		border-radius: 30rpx;
		opacity: 1;
		background-image: linear-gradient(to bottom right, rgb(205 208 255 / 0.7) 0%, rgb(253 255 225 / 0.7) 100%);
		background: rgb(255 255 255 / 0.4);
		box-shadow: 0 0 6px 0 rgb(169 165 255 / 0.6);
		backdrop-filter: blur(3px);
		-webkit-backdrop-filter: blur(3px);
	}

	.qr-code-image {
		width: 100%;
		border-radius: 15rpx;
	}

	.close-btn {
		position: absolute;
		top: -60rpx;
		right: -60rpx;
		font-size: 50rpx;
		color: #fff;
		z-index: 1000;
		padding: 10rpx;
		text-shadow: 0 2rpx 4rpx rgb(0 0 0 / 0.3);
	}

	.special-tools {
		margin: 0 20rpx;
	}

	.special-row {
		display: flex;
		gap: 20rpx;
		margin-bottom: 20rpx;

		.special-item {
			flex: 1;
			background: linear-gradient(179deg,
					rgb(184 225 255 / 1) 0%,
					#fff 100%);
			border-radius: 30rpx;
			padding: 20rpx 30rpx;
			display: flex;
			flex-direction: row;
			align-items: center;

			.special-icon {
				width: 85rpx;
				height: 80rpx;
				margin-right: 15rpx;
			}

			.special-text-container {
				display: flex;
				flex-direction: column;
			}

			.special-name {
				font-size: 28rpx;
				color: #333;
				margin-bottom: 5rpx;
				font-weight: 500;
			}

			.special-desc {
				font-size: 24rpx;
				color: #999;
			}
		}
	}

	.ai-bottom-banner {
		display: flex;
		align-items: center;
		margin: 40rpx 0 0;
		padding: 0 20rpx;
	}

	.ai-bottom-banner-img {
		width: 70rpx;
		height: 110rpx;
		margin-right: 20rpx;
		flex-shrink: 0;
	}

	.ai-bottom-banner-text {
		position: relative;
		background: #b6c8f7;
		border-radius: 30rpx;
		padding: 18rpx 48rpx 18rpx 32rpx;
		color: #fff;
		font-size: 32rpx;
		font-weight: bold;
		display: flex;
		align-items: center;
		min-width: 420rpx;
		letter-spacing: 2rpx;
	}
}

.toodown {
	width: 108rpx;
	height: 108rpx;
	display: flex;
	justify-content: center;
	margin-top: 16rpx;
	margin: 16rpx auto 0;

	.toodownimg {
		width: 32rpx;
		height: 32rpx;
		transform: rotate(90deg);
		padding: 30rpx;
		box-shadow: 0 0 12rpx rgb(0 0 0 / 0.08);
		background: rgb(248 249 252 / 0.65);
	}
}

.no-more-container {
	display: flex;
	align-items: center;
	justify-content: center;
}

.line {
	flex: 1;
	height: 1rpx;
	background-color: #e0e0e0;
}

.no-more-text {
	margin: 0 20rpx;
	color: #767676;
	font-size: 24rpx;
}

.website-container {
	text-align: center;
}

.website-text {
	font-family: AlimamaFangYuanTi;
	font-size: 28rpx;
	color: rgb(89 97 255 / 0.55);
	font-weight: 700;
}

.copyright-container {
	padding: 10rpx 0;
	text-align: center;
	color: rgb(0 0 0 / 0.4);
	line-height: 18rpx;
	font-size: 20rpx;
}

.copyright-text {
	display: block;
	font-size: 20rpx;
	color: rgb(0 0 0 / 0.4);
	line-height: 1.5;
	font-family: AlimamaFangYuanTi;
}

.floating-decoration {
	right: 5rpx;
	width: 180rpx;
	height: 180rpx;
	z-index: 10;
	margin-right: 0;
	border-radius: 30rpx;
}

@keyframes float {
	0% {
		transform: translateY(0);
	}

	50% {
		transform: translateY(-15rpx);
	}

	100% {
		transform: translateY(0);
	}
}


.card-box {
	width: 100%;
	display: flex;
	justify-content: center;
	align-items: center;
	border-radius: 30rpx;

	.xin-card-content {
		width: 100%;
		margin: 1rpx;
		display: flex;
		justify-content: space-between;
		border-radius: 30rpx;
		padding: 10rpx 11rpx 0;
		box-sizing: border-box;
		overflow: hidden;

		.card-zuo {
			margin-left: 0;
			display: flex;
			flex-direction: row;
			margin-bottom: 5rpx;

			.xin-left {
				margin-top: 0;
				display: flex;
				align-items: center;
				justify-content: inherit;
				padding-left: 4rpx;

				.xin-title {
					font-size: 30rpx;
					color: #8178EF;
					display: block;
					font-family: AlimamaFangYuanTi !important;
					font-weight: bold;
					line-height: 30rpx;
					letter-spacing: 0rpx;
					width: 100%;

				}

				.subtitle {
					width: 95%;
					font-size: 20rpx;
					color: #6c6c6c;
					line-height: 30rpx;
					margin-top: 6rpx;
				}
			}

			.subtitle {
				width: calc(100% - 200rpx);
				font-size: 20rpx;
				color: #6c6c6c;
				line-height: 30rpx;
				margin-top: 6rpx;
				padding-left: 10rpx;
				display: -webkit-box;
				-webkit-box-orient: vertical;
				-webkit-line-clamp: 3;
				overflow: hidden;
				text-overflow: ellipsis;
			}

			.xincard-img {
				width: 50rpx;
				height: 50rpx;
			}
		}

		.card-you {
			width: 103.56rpx;
			height: 100%;
			display: flex;
			position: relative;
			margin-right: 18rpx;

			.card-you-img {
				height: 32rpx;
				width: 32rpx;
				position: absolute;
				top: 8rpx;
				left: -25rpx;
			}

			.card-you-box {
				width: 103.56rpx;
				height: auto;
				margin: 0;
				display: flex;
				border-radius: 8rpx;

				.card-you-box1 {
					width: 102.56rpx;
					height: 102.56rpx;
					display: flex;
					justify-content: center;
					align-items: center;
					border-radius: 8rpx;
					background: linear-gradient(45deg, #edebff, #DEDBFF);
					overflow: hidden;
					position: relative;
					margin-right: 10rpx;

					.robot-img {
						width: 100%;
						height: 95%;
						border-radius: 15rpx;
					}
				}
			}
		}

		.xincard-title {
			font-size: 26rpx;
			font-weight: bold;
			line-height: 30rpx;
			color: #8178EF;
			font-family: AlimamaFangYuanTi !important;
		}

		.xin-yinying {
			text-shadow: 0 4px 10px #D3D3D3;
		}
	}
}

.import_card-border {
	border: 1px solid #e0e8ff !important;
	background: rgb(248 249 252 / 0.65);
}

.import_card-bg {
	background: rgb(248 249 252 / 0.65);
}

.nomarl_card-border {
	background: rgb(248 249 252 / 0.65);
}

.nomarl_card-bg {
	background: rgb(248 249 252 / 0.65);
}

.card_bar {
	justify-content: space-around;
	align-items: center;
	padding: 0;
}

.card-image {
	width: 100%;
	height: 411rpx;
	display: block;
	margin: 0 auto;
	margin-bottom: 16rpx;
	border-radius: 30rpx;
	overflow: hidden;
}

.card-image2 {
	width: 100%;
	display: block;
	margin: 0 auto;
	border-radius: 8rpx;
	overflow: hidden;
}

.mask {
	position: fixed;
	inset: 0;
	background: rgb(0 0 0 / 0.4);
	z-index: 10001;
}

.dialog {
	position: fixed;
	left: 50%;
	top: 50%;
	transform: translate(-50%, -50%);
	background: #fff;
	border-radius: 15rpx;
	padding: 40rpx 30rpx;
	min-width: 600rpx;
	text-align: center;
	box-shadow: 0 0 32rpx rgb(0 0 0 / 0.18);
	z-index: 10002;
	color: #000;
}

.profile {
	display: flex;
	color: #6c6c6c;
	justify-content: flex-start;
	align-items: center;
	margin-bottom: 4rpx;


	.xin-avatar {
		width: 32rpx;
		height: 32rpx;
		border-radius: 8rpx;
	}

	.xin-name {
		font-size: 24rpx;
		margin-left: 8rpx;
		font-weight: bold;
		font-family: AlimamaFangYuanTi !important;
	}
}

.znt_row{
	width: 100%;
}

.znt_row .xin-card-content{
	display: block;
}

.xin-title-hot{
	float: right;
	font-size: 26rpx;
	font-weight: bold;
	line-height: 33rpx;
	color: #FF5F33;
	margin-top: -8rpx;
	margin-left: 5rpx;
}

.xin-title-hot image{
	margin-bottom: -12rpx;
	margin-right: 6rpx;
}

.xin-title-new{
	font-weight: bold;
	color: #fff;
	background: url('/static/images/new.png') no-repeat;
	background-size: 100% 100%;
	font-size: 10rpx;
	line-height: 18rpx;
	display: inline-block;
	border-radius: 8rpx;
	margin-left: 6rpx;
	position: relative;
	top: 3rpx;
	width: 50rpx;
	height: 50rpx;
	padding: 0 !important;
}

.btn_buy{
	float: right;
	height: 44rpx;
	line-height: 37rpx;
	border-bottom:none;
	display: flex;
	align-items: center;
	justify-content: center;
	width: 140rpx;
	margin-left: 0rpx;
	border: none;
	background: url('/static/images/btn_back.png') no-repeat center center;
	background-size: 100%;
}

.btn_buy image{
	margin-right: 6rpx;
	margin-top: -2rpx;
}

.max_title{
	overflow: hidden;
	white-space: nowrap;
	text-overflow: ellipsis;
}

.tab_list{
	display: flex;
	overflow-x: auto;
	flex-wrap: nowrap;
}

.tab_item{
	flex: none;
	width: auto;
	padding: 5rpx 10rpx;
	border: 1px solid rgb(0 0 0 / 0.3);
	border-radius: 15rpx;
	font-size: 20rpx;
	font-weight: bold;
	line-height: 20rpx;
	margin-right: 8rpx;
	color: rgb(0 0 0 / 0.6);
}

.tab_item:last-child{
	margin-right: 0;
}

.vip_label{
position: absolute;
left: 50%;
top: 8rpx;
transform: translateX(-50%);
background-color: #000;
border-radius: 8rpx;
height: 36rpx;
z-index: 2;
font-size: 24rpx;
width: auto;
padding: 0 10rpx;
box-sizing: border-box;
display: flex;
justify-content: center;

	.label_icon{
		height: 28rpx;
		width: 28rpx;
		display: block;
		margin-top: 4rpx;
		margin-right: 4rpx;
	}

	.label_title{
		font-size: 24rpx;
		color: #F8B34E;
		font-weight: bold;
		line-height: 36rpx;
		width: auto;
		text-align: center;
		white-space: nowrap;
	}
}



.pay_mask {
    position: fixed;
    inset: 0;
    z-index: 99999;
    align-items: center;
    justify-content: center;
    width: 100vw;
    height: 100vh;
    box-sizing: border-box;
	overflow: hidden;
    background-color: rgb(0 0 0 / 0.4);
}

.pay_window {
    width: 100%;
    height: auto;
    box-sizing: border-box;
    padding: 29rpx 26rpx 20rpx;
    background-color: rgb(233 235 255 / 0.9);
	backdrop-filter: blur(10px);
    position: fixed;
	border-radius: 30rpx 30rpx 0 0;
	bottom: 0;
	left: 0;
	transform: translateY(120%);
	box-shadow: 0 -10rpx 20rpx -10rpx rgb(177 177 177);
	transition: all .4s ease;
    z-index: 100000;
}

.pay_window_active{
	transform: translateY(0);
}

.pay_icon {
    width: 30rpx;
    height: 30rpx;
}

.discount {
    position: absolute;
    top: 29rpx;
    right: 26rpx;
    font-family: AlimamaFangYuanTi !important;
    font-size: 24rpx;
    font-weight: bold;
    color: #FF5050;
}

.base_datas {
    display: flex;

    .head {
        margin-right: 18rpx;

        .head-image {
            width: 104rpx;
            height: 104rpx;
            border-radius: 15rpx;
        }
    }

    .content_main {
        flex: 1;
		min-height: 104rpx;

        .title {
            text-shadow: 0rpx 4rpx 10rpx #D3D3D3;
            color: #517BFF;
            font-size: 30rpx;
            font-weight: bold;
            font-family: AlimamaFangYuanTi !important;
        }

        .title-sub {
            font-size: 24rpx;
            color: #414141;
            font-weight: normal;
            font-family: AlimamaFangYuanTi !important;
        }
    }
}

.b_f {
    width: 192rpx;
    box-sizing: border-box;
    height: auto;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
    color: #000;
	border-radius: 15rpx;
	border: 4rpx solid #fff;
	border-bottom: none;
	padding: 10rpx 27rpx;
	background:linear-gradient(268deg, rgb(217 219 254 / 0.65) -207%, rgb(217 219 254 / 0.65) -148%, rgb(217 219 255 / 0.65) -122%, rgb(217 219 254 / 0.65) -33%, rgb(217 219 255 / 0.65) -17%, rgb(144 125 255 / 0.65) 217%, rgb(224 225 252 / 0.65) 302%);
	box-shadow: inset 0 -6rpx 20rpx 0 rgb(255 255 255 / 0.8);
	margin: 0 auto;
	backdrop-filter: blur(10px);

	.b_f_title{
		width: auto;
		text-align: center;
		color: #fff;
		font-size: 32rpx;
		font-weight: bold;
	}

	.b_f_text{
		color: #90A7FF;
		font-weight: bold;
		font-size: 24rpx;
	}
}

.f_n {
    font-family: AlimamaFangYuanTi !important;
    font-size: 24rpx;
    font-weight: normal;
    color: #3D3D3D;
}

.m_b {
    margin-bottom: 18rpx;
}

.card-you-box1{
	margin-right: 10rpx;
}

.f_c {
    display: flex;
    align-items: center;
    justify-content: center;
}

.font_nomal {
    font-family: AlimamaFangYuanTi !important;
    font-size: 30rpx;
    font-weight: 500;
    color: #8D8D8D;
}

.empty {
	width: 100%;
	height: calc(100vh - 500rpx);
	flex-direction: column;

	.font_big {
		font-family: AlimamaFangYuanTi !important;
		font-size: 40rpx;
		font-weight: bold;
		color: #847CFF;
	}

	.font_icon {
		font-family: AlimamaFangYuanTi !important;
		font-weight: 700;
		font-size: 40rpx;
		color: #F00
	}

	.image {
		width: 199rpx;
		height: 199rpx;
		margin-top: 23rpx;
	}
}

.title_container{
	display: flex;
	justify-content: space-between;
	align-items: flex-end;
}

.title_text{
	font-size: 30rpx;
	padding-bottom: 0;
	color: #000;
	font-weight: bold;
}

.title_right{
	color: rgb(0 0 0 / 0.3);
}

.developer_nav_container {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 20rpx;
	
	.developer_nav_left {
		font-size: 36rpx;
		color: #000;
		font-weight: bold;
	}
	
	.developer_nav_right {
		font-size: 30rpx;
		color: rgb(0 0 0 / 0.3);
		font-weight: bold;
	}
}

.function_buttons_container {
	display: flex;
	justify-content: space-between;
	gap: 20rpx;
	margin-bottom: 10rpx;
	
	.function_button {
		flex: 1;
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: center;
		height: 70rpx;
		border-radius: 15rpx;
		background: #fff;
		padding: 10rpx;
		box-sizing: border-box;
		border: 6rpx solid rgb(205 208 255 / 1);
		border-width: 2rpx;
		
		.button_icon {
			width: 48rpx;
			height: 48rpx;
			margin-right: 10rpx;
		}
		
		.button_text {
			font-size: 26rpx;
			font-weight: bold;
			color: rgb(102 89 255 / 1);
		}
	}
}

.more_apps_title {
	text-align: center;
	font-size: 30rpx;
	font-weight: bold;
	color: rgb(0 0 0 / 0.3);
	margin-bottom: 20rpx;
}

.lianjie_con {
  width: 100%;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  padding: 0 20rpx;
  box-sizing: border-box;
  overflow-x: auto;
}

.lianjie_cona {
  left: 0;
  right: 0;
  z-index: 1;
}

.lianjie_list {
  display: block;
  flex: none;
  text-align: center;
}

.lianjie_icon {
  display: block;
  margin: 0 auto 10rpx;
  height: 160rpx;
}

.lianjie_text {
  color: #020009;
  font-size: 36rpx;
  text-align: center;
}

.icon-imageb {
  position: absolute;
  bottom: 14rpx;
  right: 4rpx;
  width: 22rpx;
  height: 22rpx;
}

.z_index_1000 {
  z-index: 1000;
}
</style>
