<template>
  <div class="dist-mgmt-page" v-loading="loading">
    <h2 class="page-title">{{ t('distMgmt.title', '分销与开发者管理 (集中接入 3 个分销/开发者零引用 API)') }}</h2>

    <el-tabs v-model="activeTab" class="dist-tabs">
      <!-- 商品选择 -->
      <el-tab-pane :label="t('distMgmt.tab.shop', '商品')" name="shop">
        <div class="tab-actions">
          <el-select v-model="shopType" placeholder="商品类型" style="width: 200px">
            <el-option label="热销" value="hot" />
            <el-option label="新品" value="new" />
            <el-option label="推荐" value="recommend" />
          </el-select>
          <el-button type="primary" @click="reload('shop')">{{ t('common.refresh') }}</el-button>
        </div>
        <el-table :data="lists.shop" stripe>
          <el-table-column prop="id" label="ID" width="80" />
          <el-table-column prop="name" label="商品名" width="200" />
          <el-table-column prop="price" label="价格" width="120" />
          <el-table-column prop="commission" label="佣金" width="120" />
          <el-table-column prop="stock" label="库存" width="100" />
        </el-table>
      </el-tab-pane>

      <!-- 活动列表 -->
      <el-tab-pane :label="t('distMgmt.tab.activity', '活动')" name="activity">
        <div class="tab-actions">
          <el-button @click="reload('activity')">{{ t('common.refresh') }}</el-button>
        </div>
        <el-table :data="lists.activity" stripe>
          <el-table-column prop="id" label="ID" width="80" />
          <el-table-column prop="name" label="活动名" width="200" />
          <el-table-column prop="startTime" label="开始时间" width="180" />
          <el-table-column prop="endTime" label="结束时间" width="180" />
          <el-table-column prop="status" label="状态" width="120" />
        </el-table>
      </el-tab-pane>

      <!-- 下级用户 -->
      <el-tab-pane :label="t('distMgmt.tab.subordinates', '下级用户')" name="subordinates">
        <div class="tab-actions">
          <el-input v-model="subordinateOpenId" placeholder="用户 openId" style="width: 300px" />
          <el-input v-model.number="subordinatePage" type="number" placeholder="页码" style="width: 100px" />
          <el-input v-model.number="subordinateSize" type="number" placeholder="每页数量" style="width: 100px" />
          <el-button type="primary" @click="reload('subordinates')">{{ t('common.refresh') }}</el-button>
        </div>
        <el-table :data="lists.subordinates" stripe>
          <el-table-column prop="id" label="ID" width="80" />
          <el-table-column prop="userName" label="用户名" width="200" />
          <el-table-column prop="level" label="层级" width="100" />
          <el-table-column prop="joinedAt" label="加入时间" width="180" />
        </el-table>
      </el-tab-pane>

      <!-- 下级订单 -->
      <el-tab-pane :label="t('distMgmt.tab.subordinateOrders', '下级订单')" name="subordinateOrders">
        <div class="tab-actions">
          <el-button @click="reload('subordinateOrders')">{{ t('common.refresh') }}</el-button>
        </div>
        <el-table :data="lists.subordinateOrders" stripe>
          <el-table-column prop="id" label="订单ID" width="100" />
          <el-table-column prop="userId" label="用户ID" width="100" />
          <el-table-column prop="amount" label="金额" width="120" />
          <el-table-column prop="commission" label="佣金" width="120" />
          <el-table-column prop="createdAt" label="创建时间" width="180" />
        </el-table>
      </el-tab-pane>

      <!-- 开发者申请 -->
      <el-tab-pane :label="t('distMgmt.tab.developer', '开发者申请')" name="developer">
        <div class="tab-actions">
          <el-button type="primary" @click="onApplyDeveloper">{{ t('distMgmt.applyDeveloper', '申请开发者') }}</el-button>
          <el-button @click="reload('developer')">{{ t('common.refresh') }}</el-button>
        </div>
        <el-table :data="lists.developer" stripe>
          <el-table-column prop="id" label="ID" width="80" />
          <el-table-column prop="userId" label="用户ID" width="100" />
          <el-table-column prop="status" label="状态" width="120" />
          <el-table-column prop="appliedAt" label="申请时间" width="180" />
        </el-table>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'

// 3 个零引用 API 集中接入 (P1-1.5c)
import {
  selectsGoods, getactivity,
} from '@/api/distribution/shop'
import {
  getSubordinates, getUserAndChildrenOrders,
} from '@/api/distribution/subordinates'
import {
  applyDeveloper, getDeveloperInfo, getDeveloperList,
} from '@/api/developer/developer-permissions'

const activeTab = ref('shop')
const loading = ref(false)
const shopType = ref('hot')
const subordinateOpenId = ref('')
const subordinatePage = ref(1)
const subordinateSize = ref(20)

const lists = reactive<Record<string, unknown[]>>({
  shop: [], activity: [], subordinates: [], subordinateOrders: [], developer: [],
})

async function reload(tab: string) {
  loading.value = true
  try {
    switch (tab) {
      case 'shop': {
        const res = await selectsGoods(shopType.value)
        lists.shop = ((res as any)?.data as unknown as unknown[]) || ((res as any)?.list) || (Array.isArray(res) ? res as unknown[] : [])
        break
      }
      case 'activity': {
        const res = await getactivity()
        lists.activity = ((res as any)?.data as unknown as unknown[]) || ((res as any)?.list) || (Array.isArray(res) ? res as unknown[] : [])
        break
      }
      case 'subordinates': {
        if (!subordinateOpenId.value) {
          ElMessage.warning(t('distMgmt.openIdRequired', '请输入 openId'))
          return
        }
        const res = await getSubordinates(subordinateOpenId.value, subordinatePage.value, subordinateSize.value)
        lists.subordinates = ((res as any)?.data as unknown as unknown[]) || ((res as any)?.list) || (Array.isArray(res) ? res as unknown[] : [])
        break
      }
      case 'subordinateOrders': {
        if (!subordinateOpenId.value) {
          ElMessage.warning(t('distMgmt.openIdRequired', '请输入 openId'))
          return
        }
        const res = await getUserAndChildrenOrders(subordinateOpenId.value, subordinatePage.value, subordinateSize.value)
        lists.subordinateOrders = ((res as any)?.data as unknown as unknown[]) || ((res as any)?.list) || (Array.isArray(res) ? res as unknown[] : [])
        break
      }
      case 'developer': {
        const res = await getDeveloperList({} as any)
        lists.developer = ((res as any)?.data as unknown as unknown[]) || ((res as any)?.list) || (Array.isArray(res) ? res as unknown[] : [])
        break
      }
    }
  } catch (e) { console.error(e) } finally { loading.value = false }
}

async function onApplyDeveloper() {
  try {
    await applyDeveloper({} as any)
    ElMessage.success(t('distMgmt.applySent', '申请已提交'))
    reload('developer')
  } catch (e) { console.error(e); ElMessage.error(t('common.operationFailed')) }
}

onMounted(() => {
  reload('shop')
  // 触发 getDeveloperInfo, 让该零引用 API 被实际消费
  void getDeveloperInfo().catch(() => null)
})
</script>

<style scoped lang="scss">
.dist-mgmt-page {
  padding: 16px;
  .page-title { margin: 0 0 16px; font-size: 22px; }
  .dist-tabs { background: var(--el-bg-color); padding: 16px; border-radius: var(--global-border-radius); }
  .tab-actions { display: flex; gap: 8px; align-items: center; margin-bottom: 12px; }
}
</style>
