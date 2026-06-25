<template>
  <div class="membership-benefits">
    <div class="benefits-header">
      <div class="pricing-info">
        <div class="price-line vip-price">
          {{ t('vip.userMembershipBenefits.vipPrice') }}
        </div>
        <div class="price-line trader-price">
          {{ t('vip.userMembershipBenefits.traderPrice') }}
        </div>
      </div>
    </div>

    <div class="benefits-table-wrapper">
      <table class="benefits-table">
        <thead>
          <tr>
            <th class="col-name">{{ t('vip.userMembershipBenefits.benefitName') }}</th>
            <th class="col-normal">{{ t('vip.userMembershipBenefits.normalUser') }}</th>
            <th class="col-vip">{{ t('vip.userMembershipBenefits.vip') }}</th>
            <th class="col-trader">{{ t('vip.userMembershipBenefits.trader') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(item, index) in benefits" :key="index">
            <td class="col-name">{{ item.title }}</td>
            <td class="col-normal">
              <template v-if="item.one === 0">
                <el-icon class="icon-cross"><Close /></el-icon>
              </template>
              <template v-else-if="item.one === 1">
                <el-icon class="icon-check"><Check /></el-icon>
              </template>
              <template v-else>
                <!-- eslint-disable-next-line vue/no-v-html -->
                <span v-html="sanitizeHtml(item.one)"></span>
              </template>
            </td>
            <td class="col-vip">
              <template v-if="item.two === 0">
                <el-icon class="icon-cross"><Close /></el-icon>
              </template>
              <template v-else-if="item.two === 1">
                <el-icon class="icon-check"><Check /></el-icon>
              </template>
              <template v-else>
                <span>{{ item.two }}</span>
              </template>
            </td>
            <td class="col-trader">
              <template v-if="item.three === 0">
                <el-icon class="icon-cross"><Close /></el-icon>
              </template>
              <template v-else-if="item.three === 1">
                <el-icon class="icon-check"><Check /></el-icon>
              </template>
              <template v-else>
                <span>{{ item.three }}</span>
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <el-button type="primary" size="large" class="upgrade-btn" @click="handleUpgrade">
      {{ t('vip.userMembershipBenefits.upgrade') }}
    </el-button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Close, Check } from '@element-plus/icons-vue'
import { sanitizeHtml } from '@/utils/htmlSanitizer'
import { useI18n } from 'vue-i18n'

defineOptions({
  name: 'UserMembershipBenefits'
})

const { t } = useI18n()

const emit = defineEmits<{
  (e: 'openIntroduces'): void
}>()

interface BenefitItem {
  title: string
  one: number | string
  two: number | string
  three: number | string
}

const benefits = computed<BenefitItem[]>(() => [
  {
    title: t('vip.userMembershipBenefits.benefit1Title'),
    one: t('vip.userMembershipBenefits.benefit1One'),
    two: t('vip.userMembershipBenefits.benefit1Two'),
    three: t('vip.userMembershipBenefits.benefit1Three'),
  },
  {
    title: t('vip.userMembershipBenefits.benefit2Title'),
    one: 0,
    two: 1,
    three: 1,
  },
  {
    title: t('vip.userMembershipBenefits.benefit3Title'),
    one: 1,
    two: 1,
    three: 1,
  },
  {
    title: t('vip.userMembershipBenefits.benefit4Title'),
    one: 1,
    two: 1,
    three: 1,
  },
  {
    title: t('vip.userMembershipBenefits.benefit5Title'),
    one: 1,
    two: 1,
    three: 1,
  },
  {
    title: t('vip.userMembershipBenefits.benefit6Title'),
    one: 0,
    two: 1,
    three: 1,
  },
  {
    title: t('vip.userMembershipBenefits.benefit7Title'),
    one: t('vip.userMembershipBenefits.benefit7One'),
    two: t('vip.userMembershipBenefits.benefit7Two'),
    three: t('vip.userMembershipBenefits.benefit7Three'),
  },
  {
    title: t('vip.userMembershipBenefits.benefit8Title'),
    one: 0,
    two: 0,
    three: 1,
  },
  {
    title: t('vip.userMembershipBenefits.benefit9Title'),
    one: 1,
    two: 1,
    three: 1,
  },
  {
    title: t('vip.userMembershipBenefits.benefit10Title'),
    one: t('vip.userMembershipBenefits.benefit10One'),
    two: t('vip.userMembershipBenefits.benefit10Two'),
    three: t('vip.userMembershipBenefits.benefit10Three'),
  },
  {
    title: t('vip.userMembershipBenefits.benefit11Title'),
    one: 0,
    two: 0,
    three: 1,
  },
])

function handleUpgrade() {
  emit('openIntroduces')
}
</script>

<style scoped>
.membership-benefits {
  background: var(--el-bg-color);
  border-radius: var(--global-border-radius);
  padding: 24px;
  }

.benefits-header {
  margin-bottom: 24px;
}

.pricing-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.price-line {
  font-size: 16px;
  font-weight: 700;
}

.vip-price {
  color: var(--el-color-primary);
}

.trader-price {
  color: var(--el-color-danger);
}

.price-strike {
  text-decoration: line-through;
}

.benefits-table-wrapper {
  overflow-x: auto;
  margin-bottom: 24px;
}

.benefits-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.benefits-table th,
.benefits-table td {
  padding: 12px 16px;
  text-align: center;
  border-bottom: var(--unified-border-bottom);
}

.benefits-table th {
  font-weight: 600;
  background: var(--el-fill-color-light);
}

.col-name {
  text-align: left;
  width: 40%;
  font-weight: 600;
}

.col-normal {
  width: 20%;
  color: var(--el-text-color-secondary);
}

.col-vip {
  width: 20%;
  color: var(--color--7c8cff);
  font-weight: 600;
}

.col-trader {
  width: 20%;
  color: var(--color--b8d930);
  font-weight: 600;
}

.benefits-table tbody tr:hover {
  background: var(--el-fill-color-lighter);
}

.icon-cross {
  color: var(--el-color-danger);
  font-size: 18px;
}

.icon-check {
  color: var(--el-color-success);
  font-size: 18px;
}

.upgrade-btn {
  width: 100%;
  height: 48px;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 2px;
}
</style>
