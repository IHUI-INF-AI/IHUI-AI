<template>
  <view class="navbar">
    <navigation-bars :image="image" title="提现明细" />
    <datas></datas>
    <selects></selects>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import NavigationBars from "@/components/navigation-bars/index.vue";
import datas from "@/pages/income/components/datas.vue";
import selects from "@/pages/income/components/select/index.vue";

const isShow = ref(false)
const image = ref("https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/user/左.png")
</script>
<style scoped></style>
