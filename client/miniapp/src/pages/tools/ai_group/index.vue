<template>
  <view class="outContainer">
    <!-- 导航栏 -->
    <navigation-bars 
      ref="topbar" 
      color="black" 
      :showFenLei="true" 
      :viscosity="true" 
      title="AI团队" 
      @pack="backPage" 
      :showBack="false"
      :image="'/static/images/back.svg'" 
      @nav-click="handleConfigClick" 
      :isShowSearch="true" 
      @clicksearch="handleSearchClick" 
    />

    <Loading v-if="loading"></Loading>

    <!-- 左侧抽屉 -->
    <DrawerLeft 
      :drawerVisible="drawerVisible" 
      :statusBarHeight="statusBarHeight" 
      :drawerList="drawerList" 
      :selected="drawerSelected"
      @handleDrawerClick="handleDrawerClick" 
      @handleConfigClicka="closeDrawer"
    ></DrawerLeft>

    <!-- 说明弹窗 -->
    <view>
      <view v-if="showPrologue" class="prologue_mask" @click="showPrologue = false"></view>
      <view v-if="showPrologue" class="prologue_dialog">
        <text>{{ prologueInfo ? "此功能暂无说明" : prologueInfo }}</text>
        <view style="margin-top: 40rpx;">
          <button @click="showPrologue = false">关闭</button>
        </view>
      </view>
    </view>

    <!-- 搜索栏 -->
    <view style="margin-bottom: 18rpx; padding: 0 20rpx;" v-if="showSearchBox">
      <InputArea 
        :needBottom="false"
        :prompt="searchText" 
        @send-message="onSearch" 
        :showFile="false"
        :isShowIcon="false"
        :imgsList="[]"
        :modelName="''"
        :isLoading="false"
        :inputFocused="inputFocused"
        :isClear="isCleara"
        :statusBarHeight="statusBarHeight"
        :titleBarHeight="titleBarHeight"
        :textarea_int="textarea_int"
        :showSend="true"
        @input-focus="handleInputFocus"
        @input-blur="handleInputBlur"
        @update:prompt="updatePrompt"
        @update:isClear="isClearaUpdate"
        :placeHolder="'搜索AI助手'"
        :padding="0"
      />
    </view>

    <!-- AI 列表 -->
    <AiList 
      class="ai_list" 
      :showNoMore="false" 
      :ailist="agentList" 
      showAssistant 
      :showRoot="false" 
      :showBottom="false"
      @getAgentCollect="getAgentCollect" 
      @getAgentLike="getAgentLike"
    ></AiList>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import request from '@/utils/service/index.js'
import NavigationBars from '@/components/navigation-bars/index.vue'
import DrawerLeft from './drawer_left.vue'
import Loading from '@/components/loading/index.vue'
import { getAgentbyCollect, category, getAgentType, aiRemoveAgent } from '@/service/aiModels.js'
import InputArea from '@/components/InputArea.vue'
import AiList from '@/pages/tools/components/Ai-list.vue'
import { nowDate } from '@/utils/time.js'

// 搜索相关
const searchText = ref('')
const searchKeyword = ref('')
const showSearchBox = ref(true)
const inputFocused = ref(false)
const isCleara = ref(false)
const statusBarHeight = ref('0')
const titleBarHeight = ref('0')
const textarea_int = ref(false)

// 抽屉相关
const drawerVisible = ref(false)
const drawerList = ref([
  { id: 111, showName: '老员工', code: 'old' },
  { id: 222, showName: '新聘用', code: 'new' },
])
const drawerSelected = ref({ id: 222, showName: '新聘用', code: 'new' })

// 列表数据
const agentList = ref<any[]>([])
const loading = ref(false)

// 说明弹窗
const showPrologue = ref(false)
const prologueInfo = ref('')

onMounted(() => {
  loadAgentList()
})

// 加载智能体列表
async function loadAgentList() {
  loading.value = true
  try {
    const res: any = await getAgentbyCollect({ type: drawerSelected.value.code })
    if (res && res.data) {
      agentList.value = res.data || []
    }
  } catch (error) {
    console.error('加载智能体列表失败:', error)
  } finally {
    loading.value = false
  }
}

// 搜索
async function onSearch() {
  searchKeyword.value = searchText.value
  if (!searchKeyword.value) {
    loadAgentList()
    return
  }
  loading.value = true
  try {
    const res: any = await request({
      url: '/agents/list',
      method: 'GET',
      data: { keyword: searchKeyword.value },
      base: 1,
    })
    agentList.value = (res && res.data) || []
  } catch (error) {
    console.error('搜索智能体失败:', error)
    uni.showToast({ title: '搜索智能体失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

// 配置点击
function handleConfigClick() {
  drawerVisible.value = true
}

// 搜索点击
function handleSearchClick() {
  showSearchBox.value = !showSearchBox.value
}

// 关闭抽屉
function closeDrawer() {
  drawerVisible.value = false
}

// 抽屉点击
function handleDrawerClick(item: any) {
  drawerSelected.value = item
  drawerVisible.value = false
  loadAgentList()
}

// 收藏
function getAgentCollect(agent: any) {
  console.log('收藏智能体:', agent)
}

// 点赞
function getAgentLike(agent: any) {
  console.log('点赞智能体:', agent)
}

// 输入焦点
function handleInputFocus() {
  inputFocused.value = true
}

function handleInputBlur() {
  inputFocused.value = false
}

// 更新提示词
function updatePrompt(value: string) {
  searchText.value = value
}

function isClearaUpdate(value: boolean) {
  isCleara.value = value
}

// 返回上一页
function backPage() {
  uni.navigateBack()
}
</script>

<style lang="scss" scoped>
.outContainer {
  min-height: 100vh;
  background: #f5f5f5;
}

.ai_list {
  padding: 0 20rpx;
}

.prologue_mask {
  position: fixed;
  inset: 0;
  background: rgb(0 0 0 / 0.5);
  z-index: 999;
}

.prologue_dialog {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 80%;
  background: #fff;
  border-radius: 16rpx;
  padding: 40rpx;
  z-index: 1000;
  text-align: center;

  text {
    font-size: 28rpx;
    color: #666;
    line-height: 1.6;
  }

  button {
    background: #007aff;
    color: #fff;
    border-radius: 10rpx;
    font-size: 28rpx;
  }
}
</style>
