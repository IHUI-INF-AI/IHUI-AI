/**
* Ripple_Yu
* 我的页面 信息卡组件
*
*/
<template>
  <view>

  <view class="user-avatar-section">
    <!-- <image
      :src="userInfo.avatarUrl ? userInfo.avatarUrl :'/static/images/daixaodiming.png'"
      class="avatar-img" @click="editProfile" /> -->
    <view class="" style="background-color: rgba(0, 0, 0, 0);">

      <image :src="avatarPic ? avatarPic : '/static/images/daixaodiming.png'"
        class="avatar-img" @click="editProfile" style="border-radius: 15rpx;" mode="aspectFill" />
    </view>
    <view class="username-wrapper" @click="editProfile">
      <!-- <image class="username-icon"
        style="margin-right: 12rpx; width: 40rpx;height: 40rpx;margin-left: 12rpx;flex: none;"
        src="https://file.aizhs.top/sys-mini/userIcon.jpg" mode="widthFix" /> -->
      <view class="username" style="line-height: 47rpx;color: #000;font-weight: bold;font-size: 44rpx;">
        
        {{ (userInfo && userInfo.username) || '' }}
      </view>
      <!-- <image v-if="showRechargeBtn" class="username-edit" style="width: 40rpx;display: block;float: right;flex: none;"
        src="https://file.aizhs.top/sys-mini/xiugai.jpg" mode="widthFix" /> -->
    </view>
    <view class="left" style="margin-top: 12rpx;" v-if="userInfo && userInfo.uuid">
      <view class="identity-title"> 当前身份: 
        <text class="role" style="line-height: 40rpx; align-items: center; color: #e8e9ff; text-shadow: 2rpx 2rpx 5rpx #000fff;" v-if="userInfo.isVip == 1">会员</text>
        <text class="role" style="line-height: 40rpx; align-items: center; color: #dbff6d; text-shadow: 2rpx 2rpx 10rpx #7ca500;" v-else-if="userInfo.isVip == 2">操盘手</text>
        <text class="role" style="line-height: 40rpx; align-items: center; color: #a9a9a9;" v-else>普通用户</text>
      </view>
    </view>
  </view>
    <view v-if="userInfo && userInfo.uuid" class=""
      style="border-radius: 15rpx;padding: 1px 1px;">
      <view class="user-info-card">
        <view class="" style="width: 100%;display: flex;justify-content: space-between;align-items: center; ">
          <view style="width: 154rpx;
						align-items: center;
						justify-content: center;
						display: none;
            margin-top: -20rpx;
						position: relative;" :class="{
              'card_type_nor': userInfo.isVip == 0,
              'card_type_act': userInfo.isVip == 1
            }">

            <view class="vipTip" v-if="userInfo.isVip !== 0" style="color: #716FFF;font-size: 20rpx;text-indent: 34rpx;
            text-shadow: 0 4rpx 12rpx rgba(116, 83, 255, 0.08);">
              {{ vipText }}</view>
            <view class="vipTip" v-if="userInfo.isVip === 0" style="text-indent: 34rpx;">智域访客</view>


            <image @click="openLevelIntroduce(1)" v-if="userInfo.isVip !== 0"
              style="width: 120rpx;height: 44rpx;position: absolute;top: 6rpx;left: 30rpx; z-index: 10; "
              class="head-icon" src="/static/images/vip_back.png" mode="widthFix" />
            <image @click="openLevelIntroduce(1)" v-if="userInfo.isVip !== 0"
              style="width: 70rpx;height: 70rpx;position: absolute;top: -20rpx;left: 2rpx;z-index: 220; "
              src="/static/images/Vector.png" mode="widthFix" />


            <!--https://file.aizhs.top/sys-mini/danshuzhiq.png -->
            <!-- http://file.aizhs.top/sys-mini/default/home/userVip_act.png -->

            <image @click="openLevelIntroduce(0)" v-else-if="userInfo.isVip === 0"
              style="width: 154rpx;height: 100%;position: absolute;z-index: 100; " class="head-icon"
              src="/static/images/userVip_nor.png" mode="widthFix" />
            <!--  https://file.aizhs.top/sys-mini/pt-head.png -->
            <!-- http://file.aizhs.top/sys-mini/default/home/userVip_act.png -->

            <!-- <image @click="openLevelIntroduce(2)" v-else-if="userInfo.isVip!==0"
                style="width: 154rpx;height: 100%;" class="head-icon"
                src="https://file.aizhs.top/sys-mini/xtk/vip_back.png" mode="widthFix" /> -->

            <!-- https://file.aizhs.top/sys-mini/default/home/userVip_act.png -->



          </view>
          <!-- v-if="userAllI.vipLevelVO != null && userAllI.vipLevelVO != '' && userAllI.vipLevelVO != undefined" -->
          <!-- v-if="userAllI.vipLevelVO" -->
          <view style="display: flex; align-items: center; margin-bottom: 0;">
            <view style="width: 154rpx;
            align-items: center;
            justify-content: center;
            display: flex;
            margin-bottom: 0;
            margin-left: 0;
            margin-right:10rpx;
            padding-top: 0;
            margin-top: -0;
            position: relative;
            height: 40rpx;" :class="{
              'card_type_nor': userInfo.isVip == 0,
              'card_type_act': userInfo.isVip == 1
            }">
            <image :src="userInfo.isVip == 0 ? '/static/images/vip_icon.png' : '/static/images/vip_icon_true.png'" mode="widthFix" style="width: 70rpx;height: 30rpx;z-index: 111;margin-right: 10rpx;"></image>
            <view class="vipTip" style="background: #716eff;color:#fff;" v-if="userInfo.isVip != 0">{{ vipText }}</view>
            <view class="vipTip" v-if="userInfo.isVip == 0">智域访客</view>
          </view>
          </view>
          <view @click="openLevelIntroduce" class="growth-bar-outer" style="width: calc(100% - 8rpx);height: 24rpx;padding: 0;border-radius: 6px;margin: 0 auto;position: relative;">

            <view v-if="userInfo.isVip == 1" class="growth-bar-bg" style="width: calc(100%);height: 24rpx;position: relative;overflow: visible;">
              <view class="growth-bar-fg" :style="{
                width: percent,
              }">
              </view>
              <text class="bar-value" style="position: absolute;left: 10rpx;top: 3rpx;z-index: 3;white-space: nowrap;">
                当前成长值:{{ userAllI && userAllI.vipLevelVO && userAllI.vipLevelVO.userVip ? userAllI.vipLevelVO.userVip.progress : 0 }}
              </text>
              <text class="bar-max">所需成长值:{{ userAllI && userAllI.vipLevelVO ? userAllI.vipLevelVO.progress : 0 }}</text>
            </view>
            <view v-else-if="userInfo.isVip == 2" class="growth-bar-bg" style="width: calc(100%);height: 24rpx;position: relative;box-shadow: 0 0 15px -3px rgba(0, 0, 0, 0.5), 
              0 4px 6px -2px rgba(0, 0, 0, 0.5);">
              <view class="bar-value" style="position: absolute;left: 0;top: 0; width: calc(100%);height: 24rpx;">
                
              </view>
              <view class="bar_text" style="position: absolute;top:0;margin-right: 0;line-height: 24rpx;width: 100%;text-align: center;z-index: 3;color: #9694ff;">{{ (userAllI && userAllI.vipLevelVO && userAllI.vipLevelVO.userVip ? userAllI.vipLevelVO.userVip.progress : 0) + ' / ' +
                  (userAllI && userAllI.vipLevelVO ? userAllI.vipLevelVO.progress : 0) }}</view>
            </view>
            <view v-else class="growth-bar-bg" style="width: calc(100%);height: 24rpx;line-height: 24rpx;justify-content: center;">
              <view class="bar-max" style="width: 100%; font-size: 21rpx;margin-left: 0;right: 0;">{{ '0 / 0' }}</view>
            </view>
          </view>
          <view v-if="userInfo.isVip > 0" @click="unsubscribe" class="unsubscribe-btn" style="color: #999;width: 80rpx;height: 24rpx;line-height: 24rpx;justify-content: center;float: right;text-align: center;margin-left: 10rpx;">
            退订
          </view>
        </view>

        <view class="card-content">
          <!-- Left side - Avatar -->

          


          <!-- Right side - User Info -->

          <view class="user-info-section">
            <!-- <view class="growth-section">
              <text class="growth-label">成长值：</text>
              <view class="growth-bar-wrapper">
                <view class="growth-bar-bg">
                  <view class="growth-bar"
                    :style="{ width: (userInfo.progress / userInfo.vipLevel.progress * 100) + '%' }">
                  </view>
                </view>
                <text class="growth-bar-max">
                  {{ userInfo.progress || 0 }}/{{ userInfo.vipLevel.progress || 0 }}
                </text>
              </view>
            </view> -->

            <view></view>
            <!-- <view class="login-status">
              <view class="username-wrapper" @click="editProfile">
                <image class="username-icon"
                  style="margin-right: 12rpx; width: 40rpx;height: 40rpx;margin-left: 12rpx;flex: none;"
                  src="/static/images/userIcon.jpg" mode="widthFix" />
                <view class="username" style="line-height: 47rpx;">
                  
                  {{ userInfo.username || '' }}
                </view>
                <image v-if="showRechargeBtn" class="username-edit" style="width: 40rpx;display: block;float: right;flex: none;"
                  src="/static/images/xiugai.jpg" mode="widthFix" />
              </view>
            </view> -->
            
            <!-- <view v-if="userInfo.phone" class="username-wrapper">
		      <image class="username-icon" mode="widthFix" style="width: 60rpx;height:40rpx;margin-left: 12rpx;margin-right: 12rpx;box-shadow: 0px 2px 2px 0px rgba(0, 0, 0, 0.3);"
		        src="/static/images/wirelesslogo.png" />
		      <view class="username" style="text-align: start; color: #8587ff">剩余智汇值：<text style="font-weight: bold">{{
		        formatTokenValue(userInfo.tokenQuantity || 0) }}</text></view>
		      <image @click="handleWallet" v-show="!isshow" class="buy-btn" mode="widthFix"
		        src="/static/images/rechargebtn.png" />
		    </view> -->

            <!--新-->
            <view class="course-section" style="display: none;">

              <view class="my-company">
                <image class="company-icon" mode="widthFix"
                  src="/static/images/company_icon.png" />
                <view class="company-text">
                  <view class="course_title" style="margin-top: 10rpx;">我的公司</view>
                  <!-- <image @click.stop="toMyCompany" mode="widthFix" src="https://file.aizhs.top/sys-mini/xtk/company.png" /> -->

                  <view class="course-tips" style="margin-top: 0;">
                    <view class="buy-btn" style="min-width: 4em;margin: 10rpx 0 0;" @click.stop="toMyCompany">进入公司</view>
                  </view>
                <!-- <view>
                  <view class="course_title">我的公司</view>
                  <view class="company_text">
                    <text>进入公司</text>
                  </view> -->
                  <!-- <image @click.stop="toMyCompany" mode="widthFix" src="https://file.aizhs.top/sys-mini/xtk/company.png" /> -->
                </view>
              </view>

              <view class="course-content">
                <view class="course_title">课程学习</view>
                <view class="course-tips">功能马上开放</view>
                <view class="course-info" v-if="false">
                  <view class="course-info-item">
                    <text class="course-info-item-s">401</text>
                    <text class="course-info-item-a">学习时长</text>
                  </view>
                  <view class="course-info-item">
                    <text class="course-info-item-s">12</text>
                    <text class="course-info-item-a">已购课程</text>
                  </view>
                  <view class="course-info-item">
                    <text class="course-info-item-s">39</text>
                    <text class="course-info-item-a">我的收藏</text>
                  </view>
                </view>
              </view>
            </view>


            <!-- <view>
              <view class="membership-status">
                <text>{{ userInfo.isVip ? "" : "未开通会员" }}</text>
                <view class="img-vip">当前身份
                  <image src="./img/vip.jpg"></image>
                </view>
                <text v-if="userInfo.isVip" class="vip-text">VIP</text>
                <view v-if="userInfo.isVip" class="vip-progress-bar"></view>
              </view>

              <view v-if="userInfo.isLoggedIn" class="info-details">
                <view class="info-item">
                  <text>我的剩余token值</text>
                  <text>{{ userInfo.remainingTokens }}</text>
                </view>
              </view>
            </view> -->
          </view>

          <!-- Membership upgrade section -->
          <!-- <view v-if="!isshow && userInfo.isLoggedIn">
  			<view v-if="userInfo.isVip" class="membership-upgrade-info">
  				<view class="member-level-icon">
  					<image style="width: 100%; height: 100%;" src="./img/vip-icon.png"></image>
  				</view>
  				<view class="level-text">
  					<text class="current-level">{{ userInfo.memberLevelText }}</text>
  					<text class="next-level-info">{{ userInfo.nextLevelInfoText }}</text>
  				</view>
  				<view v-if="userInfo.identityTypy == 0" @click="gotrader" class="level-button">成为操盘手</view>
  			</view>

  			<view v-else class="membership-upgrade-info">
  				<view class="member-level-icon">
  					<image style="width: 100%; height: 100%;" src="./img/vip-icon.png"></image>
  				</view>
  				<view class="level-box">
  					<view class="level-text">
  						<text class="current-level">{{ memberLevelText }}</text>
  						<text class="next-level-info">{{ nextLevelInfoText }}</text>
  					</view>
  					<view class="open_vip">
  						<image @click="gochongzhiVip" src="./img/btn.jpg"></image>
  					</view>
  				</view>
  			</view>
  		</view> -->
          <!--  -->
        </view>
        <!-- <view class="cps-container" v-if="userInfo.phone">
          <view class="left">
            <view class="identity-title"> 当前身份 </view>

            <view style="margin-top: 5rpx">
              <text class="role">{{ vipIdentityStatus }}</text>
            </view>
          </view>
          <view class="right" v-if="0">
            <view class="course_title">课程学习</view>
            <view class="course-info">
              <view class="course-info-item">
                <text>401</text>
                <text>学习时长</text>
              </view>
              <view class="course-info-item">
                <text>12</text>
                <text>已购课程</text>
              </view>
              <view class="course-info-item">
                <text>39</text>
                <text>我的收藏</text>
              </view>
            </view>
          </view>
        </view> -->
        <!-- <view class="login-status" style="margin-top: 9rpx;">
              <view v-if="userInfo.uuid" class="username-wrapper">
                <image class="username-icon" mode="widthFix"
                  style="margin-left: 12rpx;margin-right: 12rpx;height: 40rpx;width: 40rpx;flex: none;"
                  src="/static/images/Vector.svg" />
                <view class="username" style="color: #8587ff;line-height: 47rpx;">剩余智汇值：<view v-if="userInfo.tokenQuantity >= 10000000">
                  </view><text style="font-weight: bold;display: inline-block;">{{
                    formatTokenValue(userInfo.tokenQuantity || 0) }}</text>
                </view>
                <view class="buy-btn" v-if="showRechargeBtn && !isshow" @click="handleWallet">充值</view>
              </view>
            </view> -->
        <view style="border: 1px solid #f0f0f0;box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);margin-top: 6rpx;border-radius: 15rpx;">
          <view class="db-card" style="margin-top: 0;">
            <view class="vip-card" :style="{borderBottomLeftRadius: showRechargeBtn && userInfo && (userInfo.isVip == 0 || userInfo.isVip == 1 || userInfo.isVip == 2) && !isshow && userInfo.uuid ? 0 : '15rpx',borderBottomRightRadius: showRechargeBtn && userInfo && (userInfo.isVip == 0 || userInfo.isVip == 1 || userInfo.isVip == 2) && !isshow && userInfo.uuid ? 0 : '15rpx'}">
              <view class="vip-card-main">
                <view class="vip-icon" style="background: none;">
                  <image class="username-icon" mode="widthFix"
                    style="margin-left: 0;margin-right: 24rpx;height: 40rpx;width: 40rpx;flex: none;"
                    src="/static/images/Vector.svg" />
                </view>
                <view class="vip-title">
                  剩余智汇值：<text style="font-weight: bold;display: inline-block;">{{
                      formatTokenValue(userInfo && userInfo.tokenQuantity ? userInfo.tokenQuantity : 0) }}</text>
                </view>
              </view>
              <view class="vip-btn-wrap" v-if="showBtn && !isshow" @click="handleWallet">
                充 值
              </view>
            </view>
          </view>
          <view v-if="showRechargeBtn" class="db-card" style="margin-top: 0;">
            <template v-if="userInfo && (userInfo.isVip == 0 || userInfo.isVip == 1 || userInfo.isVip == 2)">
              <view v-if="!isshow && userInfo && userInfo.uuid" class="vip-card" style="border-top-left-radius: 0;border-top-right-radius: 0;">

                <view class="vip-card-main">
                  <view class="vip-icon"></view>
                  <view v-if="userInfo.isVip == 0" class="vip-title red">
                    限时开通<text class="vip-yellow">VIP</text>专享全部权益
                  </view>
                  <view v-if="userInfo.isVip == 1" class="vip-title red" style="position: absolute;left: 65rpx;">
                    限时成为<text class="vip-yellow">操盘手</text>独享最高权益
                  </view>
                  <view v-if="userInfo.isVip == 2" class="vip-title red" style="position: absolute;left: 65rpx;">
                    <text class="vip-yellow vip-title red">加入私董会</text>
                  </view>
                </view>
                <view v-if="userInfo.isVip == 0 && showBtn" class="vip-btn-wrap" @click="openIntroduce">
                  开 通
                </view>
                <view v-if="userInfo.isVip == 1 && showBtn" class="vip-btn-wrap" @click="openIntroduces">
                  开 通
                </view>
                <view v-if="userInfo.isVip == 2 && showBtn" class="vip-btn-wrap" @click="openIntroduces2">
                  加 入
                </view>
              </view>
            </template>
          </view>
          <view v-else class="db-card-else"></view>
        </view>
        <!-- <view class="db-card">
          <view style="padding: 0 20rpx;">
            <view class="db-header">
              <view class="db-header-left">
                <view class="db-icon"></view>
                <text class="db-title">当前独享私人数据库容量：<text class="db-size">1G</text></text>
              </view>
              <view class="db-header-right">
                <text class="db-new">NEW</text>
                <text class="db-gift">赠送<text class="db-size">1G</text>容量</text>
              </view>
            </view>
  			<view class="db-progress-bar">
  			  <view class="db-progress-bar-inner" style="width: 60%"></view>
  			</view>
            <view class="db-progress-row">
              <view class="db-progress-label db-dot-yellow"></view>
              <text class="db-progress-label">使用容量 600.5MB</text>
              <view class="db-progress-label db-dot-gray"></view>
              <text class="db-progress-label">剩余容量 399.5MB</text>
            </view>
            
          </view>
          <view v-if="!isshow && userInfo.phone" class="vip-card">
            <view class="vip-card-main">
              <view v-if="userInfo.isVip != 1 || userInfo.identityTypy != 1" class="vip-icon"></view>
              <view v-if="userInfo.isVip == 0" class="vip-title">
                限时开通<text class="vip-yellow">VIP</text>专享全部权益
              </view>
              <view v-if="userInfo.isVip == 1 && userInfo.identityTypy != 1" class="vip-title red">
                限时成为<text class="vip-yellow">操盘手</text>独享最高权益
              </view>
            </view>
            <view v-if="userInfo.isVip == 0" class="vip-btn-wrap" @click="openIntroduce">
              立即开通
            </view>
            <view v-if="userInfo.isVip == 1 && userInfo.identityTypy != 1" class="vip-btn-wrap" @click="openIntroduces">
              立即开通
            </view>
          </view>
        </view>  -->


      </view>

    </view>
    <view v-else style="margin-top: 20rpx;">
      <button class="login-btn-new" v-if="isAppEnvironment" @click="getPhoneNumber">
        <view class="btn_join btn_join_login" style="position: relative;">
          一键登录
        </view>
      </button>
      <button class="login-btn-new" v-else open-type="getPhoneNumber" @getphonenumber="getPhoneNumber">
        <view class="btn_join btn_join_login" style="position: relative;">
          一键登录
        </view>
      </button>
    </view>
  </view>

</template>


<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { openId, login, getPhoneNumberApi } from "@/service/login.js";
import { formatTokenValue } from "@/utils/index.js";
import { clearLoginDataCompletely } from "@/utils/auth.js";
import { useUserStore } from '@/store/modules/user'

const userStore = useUserStore()

const props = defineProps({
  userInfo: {
    type: Object,
    default() {
      return {
        isLoggedIn: false,
        username: "请登录",
        isVip: null,
        knowledgeBaseQuota: "N/A",
        remainingTokens: "",
        userId: "N/A",
        avatarUrl: "",
        memberLevelText: "显示用户的会员等级",
        tokenQuantity: "",
        nextLevelInfoText: "显示距离下一个等级还差多少积分也就是钱",
        phone: "",
      };
    },
  },
  showRechargeBtn: {
    type: Boolean,
    default: true,
  },
  openid: {
    type: String,
    default: ''
  },
  showBtn: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['edit-profile', 'update:login-out'])

const logined = ref(false)
const current = ref(30)
const max = ref(100)
const tokenQuantity = ref(0)
const memberLevelText = ref("VIP会员中心")
const nextLevelInfoText = ref("开通立项多重特权")
const newUserInfo = ref({
  isLoggedIn: false,
  username: "请登录",
  isVip: null,
  knowledgeBaseQuota: "N/A",
  remainingTokens: "",
  userId: "N/A",
  avatarUrl: "",
  memberLevelText: "显示用户的会员等级",
  nextLevelInfoText: "显示距离下一个等级还差多少积分也就是钱",
  tokenQuantity: "",
  phone: "",
})
const showLogOut = ref(true)
const isshow = ref(false)
const isAppEnvironment = ref(false)
const phoneNumberDetail = ref({})
const userAllI = ref({})
const avatarPic = ref('')
const vipText = ref('')
const navBarTop = ref(0)

const percent = computed(() => {
  if (props.userInfo && props.userInfo.vipLevelVO && userAllI.value && userAllI.value.vipLevelVO && userAllI.value.vipLevelVO.userVip && userAllI.value.vipLevelVO.progress) {
    let p = (userAllI.value.vipLevelVO.userVip.progress / userAllI.value.vipLevelVO.progress) * 100;
    if (p > 100) p = 100;
    if (p < 0) p = 0;
    return p + '%';
  }
  return '0%';
})

const inviteCode = computed(() => userStore.inviteCode)

// created() equivalent - runs at setup time
const cachedUser = uni.getStorageSync("data");
if (cachedUser && cachedUser['isVip'] !== 0 && cachedUser['vipLevelVO'] && cachedUser['vipLevelVO']['title']) {
  vipText.value = cachedUser['vipLevelVO']['title']
}
userAllI.value = cachedUser;

function checkFeedbackPermission() {
  const allowedPhones = ['19944894487', '18643389808', '19944895160', '17549549976'];
  
  let phone = props.userInfo?.phone;
  
  if (!phone) {
    const cachedUser = uni.getStorageSync("data");
    if (cachedUser) {
      phone = cachedUser.authInfo?.phone || cachedUser.phone;
    }
  }
  
  const phoneStr = String(phone || '').trim();
  
  return allowedPhones.includes(phoneStr);
}

function toFankui() {
  uni.navigateTo({
    url: `/pagesA/fankui/index?pageType=list`,
  })
}

function toMyCompany() {
  uni.navigateTo({
    url: '/pages/distribution/index',
  });
}

function userInfoAll() {
  userAllI.value = uni.getStorageSync("data");
}

function getPhoneNumber(e) {
  console.log('getPhoneNumber 被调用', e);
  
  if (isAppEnvironment.value) {
    uni.navigateTo({
      url: '/pages/login-app/login'
    });
    return;
  }
  
  if (e && e.detail) {
    if (e.detail.errMsg !== "getPhoneNumber:ok") {
      console.error('获取手机号失败:', e.detail.errMsg);
      uni.showToast({
        title: '获取手机号失败',
        icon: 'none'
      });
      return;
    }
    
    uni.showLoading({
      title: '登录中...',
      mask: true
    });
    
    uni.login({
      provider: "weixin",
      success: (res) => {
        console.log('uni.login 成功:', res);
        if (res.code) {
          let code = res.code;
          openId(code).then((resa) => {
            console.log('openId API 响应:', resa);
            
            if (!resa.data) {
              console.error('openId 返回数据为空');
              uni.hideLoading();
              uni.showToast({
                title: '获取用户信息失败',
                icon: 'none'
              });
              return;
            }
            
            let getOpenid = '';
            let unionId = '';
            
            if (resa.data.openid != undefined) {
              getOpenid = resa.data.openid;
            } else if (resa.data.thirdPartyAccounts && resa.data.thirdPartyAccounts.openId) {
              getOpenid = resa.data.thirdPartyAccounts.openId;
            } else {
              console.error('无法获取 openid');
              uni.hideLoading();
              uni.showToast({
                title: '获取用户信息失败',
                icon: 'none'
              });
              return;
            }
            
            if (resa.data.unionId) {
              unionId = resa.data.unionId;
            } else if (resa.data.thirdPartyAccounts && resa.data.thirdPartyAccounts.unionId) {
              unionId = resa.data.thirdPartyAccounts.unionId;
            } else {
              console.error('无法获取 unionId');
              uni.hideLoading();
              uni.showToast({
                title: '获取用户信息失败',
                icon: 'none'
              });
              return;
            }
            
            console.log('准备调用 getPhoneNumberApi:', { unionId, code: e.detail.code, openId: getOpenid, inviteCode: inviteCode.value });
            
            getPhoneNumberApi(unionId, e.detail.code, getOpenid, inviteCode.value).then(res => {
              console.log('getPhoneNumberApi 响应:', res);
              uni.hideLoading();
              
              if (res.data) {
                const data = res.data;
                uni.setStorageSync("data", res.data);
                uni.$emit('loginSuccess', res.data);
                updateUserInfo(data);
                uni.showToast({
                  title: '登录成功',
                  icon: 'success'
                });
              } else {
                console.error('getPhoneNumberApi 返回数据为空');
                uni.showToast({
                  title: '登录失败，请重试',
                  icon: 'none'
                });
              }
            }).catch(err => {
              console.error('getPhoneNumberApi 调用失败:', err);
              uni.hideLoading();
              uni.showToast({
                title: '登录失败，请重试',
                icon: 'none'
              });
            });
          }).catch(err => {
            console.error('openId 调用失败:', err);
            uni.hideLoading();
            uni.showToast({
              title: '获取用户信息失败',
              icon: 'none'
            });
          });
        } else {
          console.error('uni.login 未返回 code');
          uni.hideLoading();
          uni.showToast({
            title: '登录失败，请重试',
            icon: 'none'
          });
        }
      },
      fail: function (err) {
        console.error('uni.login 失败:', err);
        uni.hideLoading();
        uni.showToast({
          title: '登录失败，请重试',
          icon: 'none'
        });
      },
    });
  }
}

function handleWallet() {
  uni.navigateTo({
    url: "/pagesA/top-up/index",
  });
}

function gotrader() {
  uni.navigateTo({
    url: "/pagesA/vip/trader",
  });
}

function gochongzhiVip() {
  uni.navigateTo({
    url: "/pagesA/vip/index",
  });
}

function openIntroduce() {
  uni.navigateTo({
    url: '/pagesA/vip_info/index?type=IntroducePopup'
  })
}

function openIntroduces() {
  uni.navigateTo({
    url: '/pagesA/vip_info/index?type=IntroducePopups'
  })
}

function openIntroduces2() {
  uni.navigateTo({
    url: '/pagesA/vip_info/index?type=PrivateAdvisory'
  })
}

function openLevelIntroduce(val) {
  uni.navigateTo({
    url: '/pagesA/vip_info/index?type=levelPopup'
  })
}

function editProfile() {
  const userInfodata = uni.getStorageSync("data");
  if (!userInfodata) {
    return;
  }
  emit("edit-profile");
}

function loginOut() {
  showLogOut.value = false;
  
  try {
    clearLoginDataCompletely();
  } catch (e) {
    clearLoginDataSync();
  }
  
  newUserInfo.value = {
    isLoggedIn: false,
    username: "请登录",
    isVip: null,
    knowledgeBaseQuota: "N/A",
    remainingTokens: "",
    userId: "N/A",
    avatarUrl: "",
    memberLevelText: "显示用户的会员等级",
    nextLevelInfoText: "显示距离下一个等级还差多少积分也就是钱",
    tokenQuantity: "",
    phone: "",
  };
  
  emit("update:login-out", newUserInfo.value);
  
  setTimeout(() => {
    uni.$emit('userLogout');
    
    uni.reLaunch({
      url: '/pages/login-app/login'
    });
  }, 500);
}

function clearLoginDataSync() {
  try {
    const storageKeys = [
      'token', 'userInfo', 'data', 'accessToken', 'refreshToken',
      'openid', 'openId', 'uuid', 'thirdPartyAccounts', 'authInfo',
      'userMargin', 'isVip', 'vipExpireTime', 'loginState', 'hasLogin',
      'isLoggedIn', 'phone', 'nickname', 'avatar'
    ];
    
    storageKeys.forEach(key => {
      try {
        uni.removeStorageSync(key);
      } catch (e) {
      }
    });
    
    try {
      uni.clearStorageSync();
    } catch (e) {
      uni.clearStorage();
    }
  } catch (e) {
  }
}

function handleLogin() {
  try {
    const userData = uni.getStorageSync("data");
    if (userData) {
      updateUserInfo(userData);
    } else {
      wxLogin();
    }
  } catch (e) {
    wxLogin();
  }
}

function wxLogin() {
  uni.login({
    provider: "weixin",
    success: (loginRes) => {
      if (loginRes.code) {
        openId(loginRes.code)
          .then((openIdRes) => {
            getPhoneNumberApi(
              openIdRes.unionId,
              phoneNumberDetail.value.code,
              openIdRes.openid,
              ""
            ).then((res) => {
              const data = res.data;
              uni.setStorageSync("data", data);
              updateUserInfo(data);
              userAllI.value = data;
              newUserInfo.value = data;
              emit("update:login-out", newUserInfo.value);
              showLogOut.value = true;
              uni.$emit('loginSuccess', data);
            });
          })
          .catch((err) => {
          });
      } else {
        uni.showToast({
          title: "登录失败，请检查网络",
          icon: "none",
        });
      }
    },
    fail: (err) => {
      uni.showToast({
        title: "登录失败，请检查网络",
        icon: "none",
      });
    },
  });
}

function updateUserInfo(userData) {
  if (userData && userData.uuid) {
    const info = {
      isLoggedIn: !!userData.uuid,
      username: userData.thirdPartyAccounts.nickname || "用户",
      isVip: userData.isVip,
      knowledgeBaseQuota: userData.userMargin ? userData.userMargin.tokenQuantity : 0,
      remainingTokens: userData.userMargin ? userData.userMargin.tokenQuantity : 0,
      tokenQuantity: userData.userMargin ? Number(userData.userMargin.tokenQuantity) : 0,
      userId: userData.uuid,
      avatarUrl: userData.avatar ? userData.avatar : "/static/images/daixaodiming.png",
      memberLevelText: userData.isVip ? "黄金会员" : "普通会员",
      nextLevelInfoText: userData.isVip ? "距离铂金会员还差 2000 积分" : "开通会员特权",
      phone: userData.authInfo ? userData.authInfo.phone : '',
      zhsToken: userData.thirdPartyAccounts ? userData.thirdPartyAccounts.accessToken : '',
      identityTypy: userData.identityTypy
    };

    newUserInfo.value = info;
    userAllI.value = userData;
    uni.$emit('setAvatarPic', newUserInfo.value['avatarUrl'])
    emit("update:login-out", info);
  }
}

function refreshUserInfo() {
  try {
    const userData = uni.getStorageSync('data');
    if (userData) {
      updateUserInfo(userData);
      userAllI.value = userData;
      
      if (userData.uuid) {
        getUserInfo();
      }
    }
  } catch (e) {
  }
}

function calculateNavBarPosition() {
  const systemInfo = uni.getSystemInfoSync();
  const statusBarHeight = systemInfo.statusBarHeight || 0;
  const titleBarHeight = 88;
  navBarTop.value = statusBarHeight * 2 + titleBarHeight / 2 - 30;
}

function unsubscribe() {
  uni.showModal({
    title: '确认退订',
    content: '您确定要退订会员吗？退订后将无法享受会员权益。',
    confirmText: '确认退订',
    confirmColor: '#ff5a5f',
    success: (res) => {
      if (res.confirm) {
        processUnsubscribe();
      }
    }
  });
}

function processUnsubscribe() {
  uni.showLoading({
    title: '处理中...'
  });
  
  setTimeout(() => {
    uni.hideLoading();
    
    const userData = uni.getStorageSync("data");
    if (userData) {
      userData.isVip = 0;
      uni.setStorageSync("data", userData);
      updateUserInfo(userData);
    }
    
    uni.showToast({
      title: '退订成功',
      icon: 'success',
      duration: 2000
    });
  }, 1500);
}

onMounted(() => {
  if (props.userInfo && props.userInfo['avatarUrl']) {
    uni.setStorageSync('avatarPic', props.userInfo['avatarUrl'])
  }
  avatarPic.value = uni.getStorageSync('avatarPic')
  uni.$on('setAvatarPic', (data) => {
    avatarPic.value = data
  })
  const systemInfo = uni.getSystemInfoSync();
  isshow.value = (
    systemInfo.osName === 'ios' ||
    systemInfo.platform === 'ios' ||
    (systemInfo.system && systemInfo.system.toLowerCase().includes('ios'))
  );
  
  isAppEnvironment.value = systemInfo.uniPlatform !== 'h5' && systemInfo.uniPlatform !== 'mp-weixin';
  console.log('当前运行平台:', systemInfo.uniPlatform, '是否为APP环境:', isAppEnvironment.value);

  userInfoAll()
  uni.$on('user-info-updated', refreshUserInfo);
})

onBeforeUnmount(() => {
  uni.$off('user-info-updated', refreshUserInfo);
})
</script>

<style lang="scss" scoped>
.user-info-card {
  // margin-top: 20rpx;
  position: relative;
  background: white;
  border-radius: 15rpx;
  padding: 10rpx 0 18rpx;
  // box-shadow: 0px 0 6px 0px rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
  background-size: 100% 100%;
  background-repeat: no-repeat;
  // background-image: url("https://file.aizhs.top/sys-mini/user-bg.png");
  // background: linear-gradient(241deg, rgba(195, 190, 255, 0.4) 0%, rgba(255, 255, 255, 0.4) 98%), #FFFFFF;
  // border: 1px solid;
}

.card-content {
  display: flex;
  align-items: flex-start;
  position: relative;
}

.vipTip {
  z-index: 111;
  font-size: 22rpx;
  width: 100%;
  text-align: center;
  line-height: 34rpx;
  // margin-top: 11rpx;
  // margin-left: 18rpx;
  // margin-bottom: 8rpx;
  color: #fff;
  font-weight: bold;
  background: rgba(133, 133, 133, 0.3);
  border-radius: 10rpx;
}

.card_type_nor {
  height: 45rpx;
}

.card_type_act {
  height: 40rpx;
}

.user-avatar-section {
  position: relative;
  top: -4rpx;
  margin-right: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  border-radius: 8px;
  // box-shadow: 0px 0 6px 0px rgba(0, 0, 0, 0.3);
  // background: linear-gradient(108deg, rgba(205, 208, 255, 0.3) 3%, rgba(253, 255, 225, 0.3) 104%);

  .vip-badge {
    position: absolute;
    top: -22%;
    left: 39%;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;

    .head-icon {
      width: 190rpx;
    }
  }
}

.avatar-img {
  width: 163rpx;
  height: 163rpx;
  border-radius: 15rpx;
  background-color: white;
  // border: 4rpx solid #ccc;
  margin-left: 2rpx;
  margin-top: 2px;
  margin-right: 2rpx;
  // border: 1px solid #E8E1FF;
}

.user-info-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  // justify-content: flex-start;
}

.growth-section {
  display: flex;
  align-items: center;
}

.growth-label {
  color: black;
  margin-right: 10rpx;
  white-space: nowrap;
}

.growth-bar-wrapper {
  position: relative;
  width: 100%;
}

.growth-bar-bg {
  width: 100%;
  height: 24rpx;
  background: #f1f1f1;
  border-radius: 6px;
  // box-shadow: 0 0 12rpx rgba(116, 83, 255, 0.08);
  // box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5), 
  //             0 4px 6px -2px rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  position: relative;
  overflow: visible;
  overflow: hidden;
}

.growth-bar {
  height: 100%;
  border-radius: 30rpx;
  background: #FFE066;
  box-shadow: 0 0 8rpx #ffe16b;
  display: flex;
  align-items: center;
  justify-content: center;
  position: absolute;
  left: 0;
  top: 0;
  z-index: 2;
  transition: width 0.4s;
}

.growth-bar-label {
  color: black;
  font-size: 28rpx;
  font-weight: bold;
  text-shadow: 0 0 8rpx #ffe16b;
  padding: 0 24rpx;
  border-radius: 30rpx;
  background: #FFE066;
  box-shadow: 0 0 8rpx #ffe16b;
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  z-index: 3;
}

.growth-bar-max {
  position: absolute;
  right: 32rpx;
  color: black;
  font-size: 24rpx;
  font-weight: bold;
  z-index: 4;
  top: 50%;
  transform: translateY(-50%);
  text-shadow: 0 2rpx 8rpx #bdbdbd;
}

.login-status {
  border-top: 1px solid #bdbdbd;
  border-radius: 0;



  // .username {
  // 	font-size: 44rpx;
  // 	font-weight: bold;
  // 	color: #000;
  // }
  .username-wrapper {
    // padding: 0 10rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 52rpx;
  }

  .username-icon {
    width: 40rpx;
    height: 40rpx;
    // border-radius: 50%;
    background: #f5f6fa;
    object-fit: cover;
  }

  .username-edit {
    width: 40rpx;
    height: 40rpx;
    margin-right: 12rpx;
    // height: 65rpx;
  }

  .username {
    width: 100%;
    font-size: 44rpx;
    font-weight: bold;
    color: #000;
    text-align: start;
  }

  .login-btn {
    background-color: transparent;
    padding: 0;
    margin: 0;
    font-size: 44rpx;
    font-weight: bold;
  }
}

.membership-status {
  display: flex;
  align-items: center;
  font-size: 28rpx;
  color: #666666;

  text {
    margin-right: 20rpx;
  }

  .img-vip {
    width: 180rpx;
    height: 50rpx;

    img {
      width: 100%;
      height: 100%;
    }
  }

  .vip-text {
    color: #e6a23c;
    font-weight: bold;
    margin-left: 10rpx;
  }

  .vip-progress-bar {
    width: 160rpx;
    height: 16rpx;
    background-color: #fff;
    border-radius: 8rpx;
    margin-left: 10rpx;
    border: 2rpx solid #e6a23c;
  }
}

.info-details {
  font-size: 28rpx;

  .info-item {
    display: flex;
    justify-content: space-between;
    margin-bottom: 16rpx;
    color: #101010;

    text:first-child {
      color: #000;
    }
  }
}

.membership-upgrade-info {
  background: #54C1FF;
  border-radius: 30rpx;
  padding: 12rpx;
  margin-top: 40rpx;
  display: flex;
  align-items: center;
  z-index: 1;

  .level-box {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
  }

  .member-level-icon {
    z-index: 2;
    width: 108rpx;
    height: 132rpx;
    margin-left: 20rpx;
  }

  .open_vip {
    width: 240rpx;
    height: 80rpx;

    img {
      width: 100%;
      height: 100%;
    }
  }

  .level-text {
    display: flex;
    flex-direction: column;
    margin-left: 20rpx;

    .current-level {
      font-size: 32rpx;
      font-weight: bold;
      color: #030007;
      margin-bottom: 8rpx;
    }

    .next-level-info {
      font-size: 24rpx;
      color: #666666;
    }
  }

  .level-button {
    background: #54C1FF;
    border-radius: 30rpx;
    color: #fff;
    font-size: 24rpx;
    font-weight: bold;
    padding: 8rpx 28rpx;
    box-shadow: 0 0 8rpx rgba(0, 238, 251, 0.1);
    margin-left: 12rpx;
    margin-right: 12rpx;
    margin-top: 0;
    margin-bottom: 0;
    text-align: center;
    transition: box-shadow 0.2s, background 0.2s;
    border: none;
    outline: none;
    user-select: none;
    white-space: nowrap;
    display: inline-block;
  }

  .level-button:active {
    background: #3A9BE6;
    box-shadow: 0 0 4rpx rgba(0, 238, 251, 0.08);
  }
}

.login-out {
  background: #FF7D7D;
  border-radius: 60rpx;
  z-index: 2;

  height: 72rpx;
  margin-top: 50rpx;
  line-height: 72rpx;
  text-align: center;
  font-size: 32rpx;
  font-weight: bold;
  color: #ffffff;
}

.buy-btn {
  width: auto;
  //height: 70rpx;
  min-width: 3em;
  text-align: center;
  margin: 7rpx;
  // background-image: url('https://file.aizhs.top/sys-mini/xtk/userinfo_btn_bg.png');
  // background-size: 100% 100%;
  background: #8389FF;
  box-shadow: 0px 0 2px 0px rgba(0, 0, 0, 0.3);
  // background: linear-gradient(90deg, rgba(227, 195, 119, 0.73),
  //     rgba(255, 179, 0, 0.94));
  backdrop-filter: blur(10px);
  // box-shadow: 0px 2px 2px 0px rgba(0, 0, 0, 0.3);
  color: #fff;
  border-radius: 8rpx;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 0 10rpx;
  border: 1px solid #E5E5E5;
  background: #D9DBFF;
  border-width: 0px 0px 4rpx 0px;
  border-style: solid;
  border-color: rgba(0, 0, 0, 0.1);
  -webkit-backdrop-filter: blur(10rpx);
  backdrop-filter: blur(10rpx);
  box-shadow: 0px 0 4rpx 0px rgba(0, 0, 0, 0.3);
  margin: 10rpx;
  padding: 5rpx;
  font-family: 'AlimamaFangYuanTi' !important;
  font-size: 25rpx;
  color: #310ef8;
  font-weight: bold;

  :active {
    box-shadow: 0 0 0 0 rgba(255, 255, 255, 0)
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
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin-top: auto;
}

// .identity-icon {
// 	width: 56rpx;
// 	height: 56rpx;
// 	margin-bottom: 10rpx;
// 	// background: url('你的icon路径') no-repeat center/contain;
// }

.identity-title {
  position: relative;
  padding-left: 48rpx;
  font-size: 26rpx;
  color: #222;
  font-weight: normal;
  font-variation-settings: "BEVL" 100, "opsz" auto;
  font-feature-settings: "kern" on;
  color: #000000;

  &::before {
    content: "";
    position: absolute;
    left: 0;
    right: 3rpx;
    top: 50%;
    transform: translateY(-50%);
    width: 33.92rpx;
    height: 30.91rpx;
    background: url("/static/images/identification-documents1.png") no-repeat center/contain;
    display: inline-block;
  }
}

.role {
  color: #9694ff;
  margin-top: 0;
  font-size: 26rpx;
  font-weight: bold;
  line-height: 30rpx;
  text-align: center;

  font-variation-settings: "BEVL" 100, "opsz" auto;
  font-feature-settings: "kern" on;
}

.course_title {
  // margin-bottom: 10rpx;
  font-size: 26rpx;
  font-weight: bold;
  line-height: normal;
  text-align: center;
  letter-spacing: 0rpx;
  font-variation-settings: "BEVL" 100, "opsz" auto;
  color: #2C2C2C;

}

.course-info {
  display: flex;
  flex-direction: row;
  // gap: 25rpx;
  // margin-bottom: 8rpx;
  color: #444;
  align-items: center;
  justify-content: space-evenly;
  height: 65%;

  .course-info-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    transform: scale(0.8);
    min-width: 30rpx;

    .course-info-item-s {
      font-family: 'AlimamaFangYuanTi' !important;
      font-size: 20rpx;
      font-weight: bold;
      line-height: normal;
      letter-spacing: 0rpx;

      font-variation-settings: "BEVL" 100, "opsz" auto;
      color: #282C38;
    }

    .course-info-item-a {
      font-size: 16rpx;
      font-weight: normal;
      line-height: normal;
      text-align: center;
      letter-spacing: 0rpx;
      font-variation-settings: "BEVL" 100, "opsz" auto;
      color: #AAB0BA;
    }
  }
}

.course-labels {
  display: flex;
  flex-direction: row;
  gap: 24rpx;
  color: #b0b0b0;
  font-size: 24rpx;
}

.db-card {
  // background: rgba(0, 4, 255, 0.03);
  border-radius: 30rpx;
  // box-shadow: 0 0 16rpx #e0e0ff;
  // padding: 24rpx 0rpx 0rpx 0rpx;
  // margin: 20rpx 0;
  margin-top: 10rpx;
  position: relative;
}

.db-card-else {
  height: 20rpx;
}

.db-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4rpx;
}

.db-header-left {
  display: flex;
  align-items: center;

  .db-icon {
    width: 56rpx;
    height: 56rpx;
    margin-right: 12rpx;
    background: url("/static/images/rongliang.png") no-repeat center/contain;
  }

  .db-title {
    font-size: 20rpx;
    font-weight: bold;
    line-height: 21.12rpx;
    letter-spacing: 0em;
    color: #716FFF;
    font-variation-settings: "BEVL" 100, "opsz" auto;

    .db-size {
      color: #3a3aff;
      font-weight: bold;
    }
  }
}

.db-header-right {
  display: flex;
  align-items: center;
  // gap: 10rpx;

  .db-new {
    background: #FF7D7D;
    color: #fff;
    border-radius: 8rpx;
    font-size: 15rpx;
    padding: 2rpx 12rpx;
    // margin-right: 8rpx;
    font-weight: bold;
    text-align: center;
    font-variation-settings: "BEVL" 100, "opsz" auto;
    margin-right: 5rpx;
  }

  .db-gift {
    font-size: 20rpx;
    font-weight: bold;
    line-height: 21.12rpx;
    letter-spacing: 0em;

    font-variation-settings: "BEVL" 100, "opsz" auto;
    color: #FF0000;
  }
}

.db-progress-row {
  display: flex;
  align-items: center;
  // margin: 18rpx 0 8rpx 0;

  .db-progress-label {
    font-size: 20rpx;
    color: #888;
    margin-right: 12rpx;

    .db-progress-label-te {
      color: rgba(0, 0, 0, 0.7);
    }
  }

  .db-dot-yellow,
  .db-dot-gray {
    width: 20rpx;
    height: 20rpx;
    border-radius: 50%;
    display: inline-block;
    margin-right: 6rpx;
  }

  .db-dot-yellow {
    background: #FFC82C;
  }

  .db-dot-gray {
    background: rgba(0, 0, 0, 0.2);
  }
}

.db-progress-bar {
  width: 100%;
  height: 14rpx;
  background: #e0e0e0;
  border-radius: 8rpx;
  overflow: hidden;
  margin-bottom: 0rpx;

  .db-progress-bar-inner {
    height: 100%;
    background: #FFE066;
    border-radius: 8rpx;
    width: 60%; // 动态设置
    transition: width 0.3s;
  }
}

.db-card-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 18rpx;

  .db-btn {
    background: #FFE066;
    color: #fff;
    font-size: 28rpx;
    font-weight: bold;
    border-radius: 15rpx;
    box-shadow: 0 0 8rpx #ffe06680;
    padding: 10rpx 36rpx;
    border: none;
    outline: none;
  }
}

.vip-card {
  background: rgba(0, 4, 255, 0.03);
  // padding: 10rpx 10rpx 10rpx 0rpx;
  // margin: 20rpx 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  //border-radius: 0rpx 0rpx 15rpx 15rpx;
  border-radius: 15rpx;
  padding: 10rpx 20rpx;
}

.vip-card-main {
  display: flex;
  align-items: center;
}

.vip-icon {
  width: 45rpx;
  height: 45rpx;
  background: url("/static/images/Fire.png") no-repeat center/contain;
}

.vip-title {
  font-size: 30rpx;
  color: #eba600;
  line-height: 1.2;
  margin-left: 11.92rpx;

  .vip-yellow {
    font-weight: bold;
    margin: 0 2rpx;
  }
}

.red {
  color: red;
}

.vip-btn-wrap {
  border-radius: 8rpx;
  display: flex;
  justify-content: flex-start;
  align-items: center;
  padding: 0 30rpx;
  border: 2rpx solid #000;
  margin: 0 0 0 0;
  font-size: 30rpx;
  color: #000; /* 白色文字 */
  font-weight: 600;
  position: relative;
  overflow: hidden;
  text-shadow: 0 1rpx 2rpx rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;

  animation: bounce 0.5s ease-in-out infinite;
}
@keyframes bounce {
  0% {
    box-shadow: none;
    transform: translate(3rpx, 3rpx);
  }

  50% {
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
    transform: translate(0, 0);
  }

  100% {
    box-shadow: none;
    transform: translate(3rpx, 3rpx);
  }
}


@keyframes shimmer-btn {
  0% {
    left: -100%;
  }
  100% {
    left: 100%;
  }
}

/* 按钮脉动效果 */
@keyframes pulse-btn {
  0% {
    box-shadow: 0px 4rpx 12rpx rgba(255, 165, 0, 0.4);
    transform: scale(1);
  }
  100% {
    box-shadow: 0px 6rpx 16rpx rgba(255, 165, 0, 0.6);
    transform: scale(1.02);
  }
}

.growth-bar-outer {
  width: 100%;
  padding: 12rpx 0;
  background: transparent;
}

// .growth-bar-bg {
//   width: 96%;
//   margin: 0 auto;
//   height: 40rpx;
//   background: #e5e7ef;
//   border-radius: 20rpx;
//   position: relative;
//   overflow: hidden;
//   display: flex;
//   align-items: center;
//   justify-content: center;
// }

.growth-bar-fg {
  position: absolute;
  left: 0;
  top: 0;
  height: 24rpx;
  border-radius: 20rpx;

  background: #E1FF00;
  box-shadow: 0 0 6px 0px rgba(0, 0, 0, 0.3);
  z-index: 1;
  transition: width 0.5s;
  align-items: center;
  display: flex;
  justify-content: center;
  overflow: visible;
}

.bar-value {
  min-width: 180rpx;
  max-width: calc(100% - 200rpx);
  left: 10rpx;
  position: absolute;
  top: 3rpx;
  padding: 0 16rpx;
  z-index: 3;
  font-size: 21rpx;
  font-weight: bold;
  line-height: 18rpx;
  text-align: center;

  display: flex;
  align-items: center;
  justify-content: center;

  letter-spacing: 0rpx;
  font-variation-settings: "BEVL" 100, "opsz" auto;
  font-feature-settings: "kern" on;
  color: #9694ff;
  text-shadow: 0px 0px 1px #494949;
  background: #f4ffa3;
  box-shadow: 7rpx 1rpx 6px 0px rgba(0, 0, 0, 0.13);
  box-sizing: border-box;
  border-radius: 6px;
  white-space: nowrap;
  overflow: visible;
}
.bar_text{
  font-size: 21rpx;
  font-weight: bold;
  letter-spacing: 0rpx;
  font-variation-settings: "BEVL" 100, "opsz" auto;
  font-feature-settings: "kern" on;
  color: #9694ff;
  text-shadow: 0px 0px 1px #494949;
}

.bar-max {
  color: #9694ff;
  // text-shadow: 0rpx 0rpx 1rpx #494949;
  position: absolute;
  font-size: 21rpx;
  font-weight: bold;
  right: 24rpx;
  top: 1rpx;
  height: 24rpx;
  line-height: 24rpx;
  z-index: 2;
  text-align: center;
}

.course-tips {
  color: #F71201;
  font-size: 26rpx;
  font-weight: bold;
  text-align: center;
  margin-top: 12rpx;
}

/* 课程区域样式调整 */
.course-section {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 9rpx;
}

.my-company {
  flex: 1;
  display: flex;
  align-items: center;
  border: 1px solid #9A9A98;
  border-radius: 8rpx;
  margin-right: 18rpx;
  height: 110rpx;

  .company-icon {
    width: 56rpx;
    height: 56rpx;
    margin: 0 20rpx 0 18rpx;
  }

  .company-text {
    margin-top: auto;
    height: 100%;
    width: calc(100% - 94rpx);
    display: flex;
    align-items: center;
    flex-direction: column;
    justify-content: center;
    image {
      width: 123rpx;
      height: 34rpx;
    }
  }
  .company_text {
    background: #7B61FF;
    box-shadow: 0px 0 10px 0px rgba(0, 0, 0, 0.3);
    width: 123rpx;
    height: 34rpx;
    border-radius: 8rpx;
    padding: 5rpx;
    font-size: 25rpx;
    font-weight: bold;
    line-height: normal;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-top: 10rpx;
  }
}

.course-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  // padding: 10rpx 30rpx;
  border: 1px solid #9A9A98;
  border-radius: 8rpx;
  font-size: 25rpx;
  height: 110rpx;
}

.login-btn-new {
  background-color: transparent;
  padding: 0;
  margin: 0;
  height: 140rpx;
  display: flex;
  justify-content: center;

  .btn_join {
    margin: 20rpx 35rpx 20rpx;
    line-height: 1;
    height: 86rpx;
    line-height: 78rpx;
    box-sizing: border-box;
    padding-top: 0;
    padding-bottom: 0;
    font-size: 48rpx;
    width: 316rpx;
  }
}

.btn_join {
  font-size: 30rpx;
  font-weight: bold;
  color: #000;
  text-transform: uppercase;
  padding: 10rpx 20rpx;
  border-radius: 8rpx;
  border: 3rpx solid #000;
  background: #fff;
  box-shadow: 3rpx 3rpx 5rpx 0 #6d6d6d;
  margin: 20rpx 35rpx 0;
}

.btn_join_login {
  font-size: 48rpx;
  font-weight: bold;
  color: #000;
  text-transform: uppercase;
  padding: 0;
  border-radius: 15rpx;
  border: 4rpx solid #000;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  margin: 20rpx 35rpx 0;
  animation: bouncea 0.5s ease-in-out infinite;
  line-height: 62rpx !important;
  height: 70rpx !important;
}

@keyframes bouncea {
  0% {
    box-shadow: none;
    transform: translate(3rpx, 3rpx);
  }

  50% {
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
    transform: translate(0, 0);
  }

  100% {
    box-shadow: none;
    transform: translate(3rpx, 3rpx);
  }
}
.border_bottom:first-child {
  border-bottom: 1px solid #e6e6e6;
}
</style>