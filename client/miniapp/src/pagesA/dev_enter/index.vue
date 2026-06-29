<template>
    <view class="outContainer">
        <navigation-bars color="black" :viscosity="true" :title="title[pageType]" @pack="backPage" :showBack="false"
            :image="'https://file.aizhs.top/sys-mini/default/back.svg'" />
        <Loading v-if="loading"></Loading>
        <ModelEdit v-if="pageType == 'edit' || pageType == 'change'" :modelTypes="modelTypes" :modelInfo="modelInfo"
            :pageType="pageType" @reback="reback">
        </ModelEdit>
        <view class="models_bar" v-if="pageType == 'index'">
            <view class="models_bar-item flex_center"
                :class="((status == item.id) || (status == 4 && item.id == 0) || (status == 5 && item.id == 0)) ? 'models_bar-text' : ''"
                v-for="item in headTypes" :key="item.id" @click="changeFb(item)">
                <text>{{ item.name }}</text>
            </view>
        </view>
        <SearchInput v-if="pageType == 'index'" @change="searchChange" :isIos="isIos"></SearchInput>

        <view class="models_bar2" v-if="(pageType == 'index') && (status == 0 || status == 4 || status == 5)">
            <view class="models_bar_item2 flex_center" :class="status == item.id ? 'models_bar_text2' : ''"
                v-for="item in tabbarList" :key="item.id" @click="changeFb(item)">
                <text>{{ item.name }}</text>
            </view>
        </view>
        <scroll-view v-if="pageType == 'index'" class="scroll_body" style="flex: 1; height: 0;" scroll-y
            scroll-x="false" lower-threshold="50" @scrolltolower="scrolltolower">
            <StateCard class="scroll_item" :status="status" :modelTypes="modelTypes" :datas="item" root="model"
                v-for="(item, index) in dataList" :key="item.id" @toDevEdit="toDevEdit"
                @deleteZntCharge="handleDeleteZntCharge" />
        </scroll-view>
    </view>
</template>
<script setup>
import { ref, watch, onMounted } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import NavigationBars from "@/components/navigation-bars/index.vue";
import Loading from "@/components/loading/index.vue";
import StateCard from './components/state_card.vue'
import ModelEdit from './model_edit.vue'
import { category, getZntList, getChargeInfoById, deleteZntCharge } from '@/service/aiModels.js'
import SearchInput from '@/components/SearchInput/index.vue'

const pageType = ref('index')
const dataList = ref([])
const loading = ref(false)
const headTypes = ref([
    { id: 0, name: '待发布' },
    { id: 1, name: '审核中' },
    { id: 2, name: '已发布' }
])
const status = ref(0)
const tabbarList = ref([
    { id: 0, name: '全部' },
    { id: 4, name: '审核失败' },
    { id: 5, name: '已下架' }
])
const page = ref({ page: 1, pageSize: 10 })
const total = ref(0)
const modelTypes = ref([])
const modelInfo = ref({})
const search = ref('')
const title = ref({
    'index': '我的智能体',
    'edit': '设置智能体',
    'change': '修改智能体'
})
const hasbar = ref(true)
const userInfo = ref(uni.getStorageSync("data"))
const isIos = ref(false)

watch(status, (n) => {
    if (n == 0 || n == 4 || n == 5) {
        hasbar.value = true
    } else {
        hasbar.value = false
    }
    page.value.page = 1
    dataList.value = []
    search.value = ''
    fetchZntList()
})

onLoad(() => {})

onShow(() => {
    const systemInfo = uni.getSystemInfoSync();
    isIos.value = systemInfo.platform === 'ios';
})

onMounted(() => {
    if (!userInfo.value) {
        userInfo.value = uni.getStorageSync("data")
    }
    fetchZntList()
    category().then(res => {
        modelTypes.value = res.data
    })
})

function fetchZntList() {
    loading.value = true
    let params = {
        page: page.value.page,
        page_size: page.value.pageSize,
        status: status.value,
        agent_name: search.value,
        start_user: userInfo.value.uuid
    }
    getZntList(params).then(res => {
        if (res.success) {
            dataList.value = dataList.value.concat(res.data)
            total.value = res.total
        }
    }).finally(() => {
        loading.value = false
    })
}

function changeFb(item) {
    status.value = item.id
}

function searchChange(val) {
    page.value.page = 1
    dataList.value = []
    search.value = val
    fetchZntList()
}

function scrolltolower() {
    if (total.value > dataList.value.length) {
        page.value.page += 1
        fetchZntList()
    }
}

function toDevEdit(item, type) {
    if (type == 'change') {
        loading.value = true
        getChargeInfoById(item.agent_id).then(res => {
            if (res.success) {
                modelInfo.value = res.data
                pageType.value = 'change'
            }
        }).finally(() => {
            loading.value = false
        })
    } else {
        modelInfo.value = item
        pageType.value = 'edit'
    }
}

function handleDeleteZntCharge(id) {
    loading.value = true
    deleteZntCharge(id).then(res => {
        uni.showToast({
            title: `${res.message}`,
            icon: 'none'
        });
        page.value.page = 1
        dataList.value = []
        fetchZntList()
    }).catch(err => {
        uni.showToast({
            title: `${err.detail}`,
            icon: 'none'
        });
    }).finally(() => {
        loading.value = false
    })
}

function reback() {
    pageType.value = 'index'
    page.value.page = 1
    dataList.value = []
    search.value = ''
    fetchZntList()
}

function backPage() {
    if (pageType.value != 'index') {
        pageType.value = 'index'
        return
    }
    const pages = getCurrentPages()
    if (pages.length > 1) {
        uni.navigateBack()
    } else {
        uni.switchTab({
            url: '/pages/table/tools/index',
        })
    }
}
</script>
<style lang="scss" scoped>
::v-deep .input-area {
    position: relative !important;
}

.outContainer {
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    font-family: AlimamaFangYuanTi !important;
    font-variation-settings: "BEVL" 100, "opsz" auto;
    overflow: hidden;
    height: 100vh;

    .top_bars {
        width: 100%;
        padding: 0 20rpx;
        box-sizing: border-box;
    }

    .scroll_body {
        width: calc(100vw - 36rpx);
        padding: 0 18rpx;

        .scroll_item {
            // margin-bottom: 18rpx;
        }
    }
}

.models_bar {
    width: calc(100% - 40rpx);
    margin: 0 20rpx;
    padding: 8rpx;
    box-sizing: border-box;
    background: #EBEEF5;
    border: 1px solid rgb(255 255 255 / 0);
    border-radius: 15rpx;
    display: flex;
    align-items: center;
    justify-content: space-around;

    .models_bar-item {
        box-sizing: border-box;

        // width: 150rpx;
        flex: 1;
        height: 56rpx;
        border-radius: 15rpx;
        color: #3D3D3D;
        font-weight: normal;
        font-size: 30rpx;
        font-family: AlibabaPuHuiTi;
        font-variation-settings: "BEVL" 100, "opsz" auto;
        font-feature-settings: "kern" on;
        padding: auto;
    }

    .models_bar-text {
        background-color: #FFF !important;
        border-color: 1rpx solid rgb(0 0 0 / 0.1);
        color: #3D3D3D !important;
        font-weight: bold !important;
    }
}

.models_bar2 {
    display: flex;
    align-items: center;
    margin: 0 20rpx;

    .models_bar_item2 {
        font-family: AlimamaFangYuanTi !important;
        font-size: 30rpx;
        font-weight: normal;
        color: #3D3D3D;
        margin-right: 36rpx;
    }

    .models_bar_text2 {
        color: #7B61FF;
    }
}

.font_nomal {
    font-family: AlimamaFangYuanTi !important;
    font-size: 24rpx;
    font-weight: normal;
    color: #3D3D3D;
}

.flex_center {
    display: flex;
    align-items: center;
    justify-content: center;
}
</style>