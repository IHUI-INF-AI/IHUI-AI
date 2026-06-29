<template>
  <view class="type">
    <!-- 导航栏 -->
    <navigation-bars :image="image" title="我的佣金" color="black" :viscosity="true" />

    <!-- 佣金详情 -->
    <view>
      <accumulation 
        :today_commission="today_commission" 
        :total_earnings="total_earnings" 
        :balance="balance"
        :lists="list" 
      ></accumulation>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import NavigationBars from '@/components/navigation-bars/index.vue'
import Accumulation from '@/pages/income/components/accumulation/index.vue'
import { getUserCommissionDetail } from '@/service/trader.js'

// 数据
const today_commission = ref(0)
const total_earnings = ref(0)
const balance = ref(0)
const list = ref<any[]>([])
const image = ref('https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/user/左.png')

onMounted(() => {
  loadCommissionDetail()
})

// 加载佣金详情
async function loadCommissionDetail() {
  try {
    const data = uni.getStorageSync('data')
    const { id } = data
    const res: any = await getUserCommissionDetail(id)
    total_earnings.value = res.data.total_earnings
    today_commission.value = res.data.today_commission
    balance.value = res.data.balance
    list.value = res.data.commission_list
  } catch (error) {
    console.error('加载佣金详情失败:', error)
  }
}
</script>

<style lang="scss" scoped>
.type {
  min-height: 100vh;
  background-image: url("https://test.aizhs.top/minio/sys-mini/dd-bg.png");
  background-size: cover;
  background-repeat: no-repeat;
  background-position: center;
}
</style>
