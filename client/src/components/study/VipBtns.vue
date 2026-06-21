<template>
  <div @click.stop="handleClick">
    <div v-if="status.payCrowd === 1 && isVip && isVip > 0" class="vip-label">
      <img src="https://file.aizhs.top/sys-mini/default/vip_label.png" class="label-icon" alt="VIP标签" loading="lazy" />
      <span class="label-title">{ t('studyVipBtns.vipFree') }</span>
    </div>
    <div v-if="status.payType === 0" class="vip-label">
      <img src="https://file.aizhs.top/sys-mini/default/mian_label.png" class="label-icon" alt="免费标签" loading="lazy" />
      <span class="label-title" style="color: var(--color--80beff);">{{ t('studyVipBtns.freeUse') }}</span>
    </div>
    <div v-if="status.payType === 1 && status.payCrowd === 0" class="vip-label">
      <img src="https://file.aizhs.top/sys-mini/default/xian_label.png" class="label-icon" alt="限时标签" loading="lazy" />
      <span class="label-title" style="color: var(--color-red-ff8a8a);">{{ t('studyVipBtns.limitedFree') }}</span>
    </div>
    <div v-if="((status.payType === 1 && status.payCrowd === 1) || (status.payType === 2 && status.payCrowd === 1)) && isVip === 0" class="vip-label">
      <img src="https://file.aizhs.top/sys-mini/default/yue_label.png" class="label-icon" style="width: 11px;" alt="月度标签" loading="lazy" />
      <span class="label-title" style="color: var(--color--ff1818);">{{ status.amount ? (status.amount / 100).toFixed(2) : '' }}</span>
    </div>
    <div v-if="status.payType === 2 && !status.payCrowd" class="vip-label" style="background-color: var(--color--5e56ff);">
      <img src="https://file.aizhs.top/sys-mini/default/yibuy_label.png" class="label-icon" alt="已购买标签" loading="lazy" />
      <span class="label-title" style="color: var(--color-white);">{{ t('studyVipBtns.purchased') }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'

defineOptions({ name: 'VipBtns' })

const { t } = useI18n()

const props = defineProps<{
  pay?: any
}>()

const emit = defineEmits<{
  (e: 'showPay'): void
}>()

const userInfo = ref<any>(null)
const isVip = ref<number | boolean>(false)
const status = ref<any>({})

watch(() => props.pay, (n) => {
  if (n) {
    nextTick(() => {
      try {
        userInfo.value = JSON.parse(localStorage.getItem('data') || '{}')
      } catch {
        userInfo.value = {}
      }
      isVip.value = userInfo.value?.isVip || false
      status.value = n
    })
  }
}, { immediate: true })

function handleClick() {
  emit('showPay')
}
</script>

<style scoped>
.vip-label {
  background-color: var(--color-black);
  border-radius: var(--global-border-radius);
  height: 16px;
  font-size: 12px;
  width: calc(4em + 23px);
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
}

.label-icon {
  height: 14px;
  width: 14px;
}

.label-title {
  font-size: 12px;
  color: var(--color--f8b34e);
  font-weight: bold;
  line-height: 16px;
  width: calc(4em + 4px);
  text-align: center;
  white-space: nowrap;
}
</style>
