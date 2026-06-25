<template>
  <div class="user-quick-actions">
    <div
      v-for="action in actions"
      :key="action.key"
      class="action-card"
      @click="handleClick(action.key)"
    >
      <div class="action-icon">
        <el-icon :size="36"><component :is="action.icon" /></el-icon>
      </div>
      <div class="action-info">
        <div class="action-title">{{ action.title }}</div>
        <div class="action-desc">{{ action.desc }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { Document, OfficeBuilding, Coin, Wallet } from '@element-plus/icons-vue'

defineOptions({
  name: 'UserCard'
})

const router = useRouter()

interface ActionItem {
  key: string
  title: string
  desc: string
  icon: any
  route: string
}

const actions: ActionItem[] = [
  {
    key: 'order',
    title: '我的订单',
    desc: '查看相关订单',
    icon: Document,
    route: '/orders',
  },
  {
    key: 'company',
    title: '我的公司',
    desc: '查看员工与业绩',
    icon: OfficeBuilding,
    route: '/distribution/company',
  },
  {
    key: 'token',
    title: '我的智汇值',
    desc: '智汇消耗信息',
    icon: Coin,
    route: '/token-value',
  },
  {
    key: 'wallet',
    title: '我的钱包',
    desc: '查看余额与充值',
    icon: Wallet,
    route: '/recharge',
  },
]

function handleClick(key: string) {
  const action = actions.find((a) => a.key === key)
  if (action) {
    router.push(action.route)
  }
}
</script>

<style scoped>
.user-quick-actions {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.action-card {
  display: flex;
  align-items: center;
  padding: 16px;
  background: var(--el-fill-color-lighter);
  border-radius: var(--global-border-radius);
  cursor: pointer;
  transition: all 0.3s;
}

.action-card:hover {
  background: var(--el-fill-color-light);
  transform: translateY(-2px);
  }

.action-icon {
  width: 56px;
  height: 56px;
  margin-right: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--el-bg-color);
  border-radius: var(--global-border-radius);
  flex-shrink: 0;
  color: var(--el-color-primary);
}

.action-info {
  flex: 1;
  min-width: 0;
}

.action-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin-bottom: 4px;
}

.action-desc {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
