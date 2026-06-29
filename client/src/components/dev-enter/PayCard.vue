<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
const { t } = useI18n()

interface PayCardData {
  order_no?: string
  create_time?: string
  agent_avatar?: string
  agent_name?: string
  prologue?: string
  type?: string | number
  price?: number
  discount_month_desc?: string
  discount?: string
  withdrawal?: number
  settlement?: number
  total?: number
  groupAccount?: number
}

const props = defineProps<{
  datas?: PayCardData
}>()

const typeChilds = computed<Record<string, string>>(() => ({
  '1': t('devPayCard.month'),
  '2': t('devPayCard.year'),
  '3': t('devPayCard.permanent'),
}))

const discounts = computed<Record<string, string>>(() => ({
  '1': t('devPayCard.discount80'),
  '2': t('devPayCard.discount70'),
  '3': t('devPayCard.discount50'),
}))

const accountType = computed(() => {
  const d = props.datas
  if (!d) return t('devPayCard.permanent')
  const tp = String(d.type || '')
  return typeChilds.value[tp] ? `${d.price}${typeChilds.value[tp]}` : t('devPayCard.permanent')
})

const discountDesc = computed(() => {
  return discounts.value[String(props.datas?.discount || '')] || t('devPayCard.noDiscount')
})
</script>

<template>
  <div class="card-body">
    <div class="font-title margin-bottom">{{ t('devPayCard.relatedOrderNo') }}{{ datas?.order_no }}</div>
    <div class="font-title margin-bottom">{{ t('devPayCard.orderTime') }}{{ datas?.create_time?.replace('T', ' ') }}</div>
    <div class="base-info margin-bottom">
      <img class="base-image" :src="datas?.agent_avatar" alt="avatar" />
      <div>
        <div class="title margin-bottom">{{ datas?.agent_name }}</div>
        <div class="sub font-nomal">{{ datas?.prologue }}</div>
      </div>
    </div>
    <div class="font-nomal margin-bottom">{{ t('devPayCard.price') }}{{ accountType }}</div>
    <div class="font-nomal">{{ t('devPayCard.discount') }}{{ datas?.discount_month_desc || discountDesc }}</div>
    <div class="right-top">
      <div class="model-icon-body">
        <span class="font-title">{{ t('devPayCard.purchased') }}</span>
      </div>
      <div class="font-nomal margin-bottom" :class="{ pay_end: datas?.settlement !== 1 }">
        {{ datas?.settlement === 1 ? t('devPayCard.settled') : t('devPayCard.pending') }}
      </div>
      <div class="has_num">×{{ datas?.total }}</div>
    </div>
    <div class="right-bottom">￥{{ datas?.groupAccount }}</div>
  </div>
</template>

<style lang="scss" scoped>
.card-body {
  margin: 0 15px;
  padding: 12px;
  background-color: var(--color-white);
  border-radius: var(--global-border-radius);
  position: relative;
  margin-bottom: 10px;
  box-shadow: var(--global-box-shadow);
}

.font-title {
  font-size: 13px;
  font-weight: normal;
  color: var(--color-black);
}

.font-nomal {
  font-size: 12px;
  font-weight: normal;
  color: var(--color-black);
}

.margin-bottom {
  margin-bottom: 8px;
}

.base-info {
  display: flex;
  align-items: center;
}

.base-image {
  width: 60px;
  height: 60px;
  border-radius: var(--global-border-radius);
  margin-right: 10px;
  object-fit: cover;
}

.title {
  font-size: 14px;
  font-weight: normal;
  color: var(--color-black);
}

.sub {
  font-size: 12px;
  font-weight: normal;
  color: var(--color-gray-979797);
}

.right-top {
  position: absolute;
  top: 15px;
  right: 12px;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.model-icon-body {
  background-color: var(--color-gray-light);
  width: 60px;
  height: 25px;
  border-radius: var(--global-border-radius-sm, 4px);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 5px;
}

.pay_end {
  color: var(--color-orange-ff6b00);
}

.has_num {
  background-color: var(--color-purple-7b61ff);
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: var(--color-white);
}

.right-bottom {
  position: absolute;
  bottom: 12px;
  right: 12px;
  font-size: 15px;
  font-weight: normal;
  color: var(--color-orange-ff6b00);
}
</style>
