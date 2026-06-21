<template>
  <view class="main-container">
    <navigation-bars :viscosity="true" color="#171717" font-size-30 title="我团队邀请的下级成员" @pack="backPage"
      :image="'https://file.aizhs.top/sys-mini/default/back.svg'" />
    <view style="padding: 20rpx;">
      <view class="search-bar">
        <image class="search-icon" src="https://img.icons8.com/ios-filled/50/999999/search--v1.png" mode="aspectFit" />
        <input class="search-input" placeholder="搜索我的团友" v-model="searchText"
          placeholder-style="color:#888;font-size:30rpx;" />
      </view>


      <view class="sort-tabs">
        <view class="tab-item" :class="{ active: activeTab === '成交订单数' }" @click="switchTab('成交订单数')">成交订单数</view>
        <picker mode="date" :value="selectedDate" @change="onDateChange">
          <view class="sort-item">
            <view class="tab-item" :class="{ active: activeTab === '邀请时间' }">邀请时间</view>
            <image class="sort-icon" src="https://file.aizhs.top/sys-mini/xiala.png" mode="aspectFit" />
          </view>
        </picker>
      </view>

      <scroll-view class="user-list" scroll-y @scrolltolower="scrolltolower">
        <view class="no-result" v-if="teamList.length === 0">
          <image src="https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/empty.png" mode="aspectFit">
          </image>
          <text>没有找到相关用户</text>
        </view>

        <view class="person-card" v-for="(member, index) in teamList" :key="member.id">
          <view class="person-left">
            <view class="avatar-wrap">
              <image v-if="member.avatar" class="avatar" :src="member.avatar" mode="aspectFill"></image>
              <image v-else class="avatar"
                src="https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/user/act.png" mode="aspectFill" />
              <view class="medal">
                <image class="medal-img" :src="`https://file.aizhs.top/sys-mini/No${index + 1}@3x.png`" />
                <text class="medal-num">{{ index + 1 }}</text>
              </view>
            </view>
            <view class="person-name">{{ member.nickname }}</view>
          </view>
          <view class="person-info">
            <view style="display: flex;justify-content: space-between;">
              <view>成交额：<text class="highlight">{{ formatToYuan(member.transactionVolume) }}</text></view>
              <view>获取佣金：<text class="highlight">{{ formatToYuan(member.commission) }}</text></view>
            </view>
            <view>
              成交订单数：<text class="highlight">{{ member.orderNum }}</text>
            </view>
            <view>
              邀请时间：<text class="bold">{{ formatDate(member.createdAt) }}</text>
            </view>
          </view>
        </view>
      </scroll-view>

    </view>
  </view>

</template>

<script setup>
import { ref } from 'vue'
import { getUserInviteeOrderStats } from "@/service/trader.js";
import NavigationBars from "@/components/navigation-bars/index.vue";

const activeTab = ref("成交订单数")
const searchKeyword = ref("")
const originalTeamList = ref([])
const teamList = ref([])
const selectedDate = ref("")
const memberOpenId = ref("")
const pageNum = ref(1)
const teamTotal = ref(0)
const searchText = ref("")

const formatToYuan = (value) => {
  if (!value) return '0.00';
  const amount = typeof value === 'string' ? parseFloat(value) : value;
  return (amount / 100).toFixed(2);
}

const formatDate = (timestamp) => {
  if (!timestamp) return '';
  const date = new Date(timestamp * 1000);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

const handleSearch = () => {
  updateDisplayList();
}

const switchTab = (tab) => {
  if (activeTab.value === tab) return;
  activeTab.value = tab;
  updateDisplayList();
}

const onDateChange = (e) => {
  selectedDate.value = e.detail.value;
  activeTab.value = '邀请时间';
  loadMemberData()
}

const updateDisplayList = () => {
  let result = [...originalTeamList.value];

  if (activeTab.value === '邀请时间' && selectedDate.value) {
    result = result.filter(member => formatDate(member.createdAt) === selectedDate.value);
  }

  if (searchKeyword.value) {
    const keyword = searchKeyword.value.toLowerCase();
    result = result.filter(member =>
      member.nickname?.toLowerCase().includes(keyword) ||
      String(member.orderNum || '').includes(keyword) ||
      String(member.transactionVolume || '').includes(keyword) ||
      String(member.commission || '').includes(keyword) ||
      String(member.phone || '').includes(keyword) ||
      formatDate(member.createdAt).includes(keyword)
    );
  }

  if (activeTab.value === '成交订单数') {
    result.sort((a, b) => (b.orderNum || 0) - (a.orderNum || 0));
  } else if (activeTab.value === '邀请时间') {
    result.sort((a, b) => (new Date(b.createdAt).getTime() || 0) - (new Date(a.createdAt).getTime() || 0));
  }

  result.forEach((item, index) => {
    item.rank = index + 1;
  });

  teamList.value = result;
}

const scrolltolower = () => {
  if(originalTeamList.value.length < teamTotal.value){
    pageNum.value += 1
    loadMemberData()
  }
}

const loadMemberData = () => {
  const token = uni.getStorageSync("data").uuid;
  let params = {
    token: memberOpenId.value,
    begin: selectedDate.value,
    end: selectedDate.value,
    pageNum: pageNum.value,
    pageSize: 10
  }
  getUserInviteeOrderStats(params).then((res) => {
    originalTeamList.value = originalTeamList.value.concat(res.data)
    teamTotal.value = res.teamCount
    updateDisplayList();
  }).catch(err => {
    uni.showToast({
      title: '获取数据失败',
      icon: 'none'
    });
  });
}

const backPage = () => {
  uni.navigateBack();
}

const onLoad = (options) => {
  if (options.openId) {
    memberOpenId.value = options.openId;
    loadMemberData();
  } else {
    uni.showToast({
      title: '参数错误',
      icon: 'none'
    });
    setTimeout(() => {
      uni.navigateBack();
    }, 1500);
  }
}
</script>

<style lang="less" scoped>
.main-container {
  height: 100vh;
  box-sizing: border-box;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  position: relative;
}

.team-total {
  color: #3D3D3D;
  margin-top: 27rpx;
  font-size: 36rpx;
}

.search-bar {
  height: 85rpx;
  display: flex;
  align-items: center;
  border-radius: 15rpx;
  padding: 0 24rpx;
  position: relative;
  background: rgba(206, 203, 241, 0.25);
  border: 1px solid #B7B5CA;
}

.search-icon {
  width: 40rpx;
  height: 40rpx;
  margin-right: 16rpx;
  display: block;
}

.search-input {
  flex: 1;
  height: 80rpx;
  border: none;
  background: transparent;
  font-size: 30rpx;
  color: #444;
  outline: none;
}

.sort-tabs {
  display: flex;
  justify-content: space-around;
  align-items: center;
  margin-top: 20rpx;
}

.tab-item {
  font-size: 34rpx;
  color: #3D3D3D;
  padding: 10rpx 20rpx;
  position: relative;
  &.active {
    color: #584ECB;
    &::after {
      content: "";
      position: absolute;
      bottom: 0;
      left: 20%;
      width: 120rpx;
      height: 2rpx;
      background-color: #584ECB;
    }
  }
}

.user-list {
  flex: 1;
  margin-top: 30rpx;
  height: calc(100vh - 384rpx);
}

.no-result {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 100rpx 0;

  image {
    width: 200rpx;
    height: 200rpx;
    margin-bottom: 20rpx;
  }

  text {
    font-size: 28rpx;
    color: #999;
  }
}

.person-card {
  border-radius: 30rpx;
  display: flex;
  margin-bottom: 16rpx;
  align-items: flex-start;
  padding: 40rpx 15rpx;
  position: relative;
  background: linear-gradient(112deg, rgba(217, 219, 255, 0.8) 3%, rgba(253, 255, 220, 0.8) 104%);
  border-width: 3rpx 3rpx 0rpx 3rpx;
  border-style: solid;
  border-color: rgba(251, 255, 203, 0.08);
  backdrop-filter: blur(10rpx);
  box-shadow: 0rpx 0 10rpx 0px rgba(0, 0, 0, 0.3), 0px -6rpx 20rpx 0px rgba(255, 255, 255, 0.8);
}

.person-left {
  display: flex;
  flex-direction: column;
  margin-right: 33rpx;
}

.avatar-wrap {
  position: relative;
}

.avatar {
  width: 170rpx;
  height: 170rpx;
  border-radius: 50%;
  border: 4rpx solid #fff;
  box-shadow: 0 0 8rpx rgba(0, 0, 0, 0.08);
}

.medal {
  position: absolute;
  left: 0rpx;
  top: -7rpx;
  width: 70rpx;
  height: 7dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
}

.medal-img {
  width: 70rpx;
  height: 70rpx;
}

.medal-num {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  text-align: center;
  line-height: 40rpx;
  color: #fff;
  font-size: 22rpx;
  font-weight: bold;
}

.person-name {
  margin-top: 12rpx;
  font-size: 30rpx;
  color: #333;
  text-align: center;
}

.person-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  font-size: 28rpx;
  color: #3D3D3D;
  margin-top: 4rpx;
  gap: 8rpx;
  position: relative;
}

.highlight {
  color: #ff9800;
  font-weight: bold;
  font-size: 42rpx;
}

.bold {
  font-weight: bold;
  color: #222;
  font-size: 30rpx;
}

.member-details {
  margin-right: 20rpx;
}

.member-id {
  font-size: 24rpx;
  color: #666;
}

.member-phone {
  font-size: 24rpx;
  color: #666;
}

.contact-btn-img {
  width: 160rpx;
  position: absolute;
  right: 26rpx;
  bottom: 33rpx;
}
.sort-icon{
  width: 40rpx;
  height: 40rpx;
}
.sort-item{
  display: flex;
  align-items: center;
}
</style>
