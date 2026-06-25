<template>
  <div class="ai-card" @click="toDetail">
    <div class="card-box" :class="idx < 3 ? 'import-card-border' : 'normal-card-border'">
      <div class="xin-card-content" :class="idx < 3 ? 'import-card-bg' : 'normal-card-bg'">
        <div class="card-body">
          <div class="card-left">
            <img v-if="idx === 0" src="https://file.aizhs.top/sys-mini/default/rankone.png" class="top-icon" alt="第一名" loading="lazy" />
            <img v-if="idx === 1" src="https://file.aizhs.top/sys-mini/default/ranktwo.png" class="top-icon" alt="第二名" loading="lazy" />
            <img v-if="idx === 2" src="https://file.aizhs.top/sys-mini/default/rankthree.png" class="top-icon" alt="第三名" loading="lazy" />

            <div class="left-content">
              <div class="card-avatar-box">
                <img class="robot-img" :src="item.binding" :alt="item.name || '模型图标'" loading="lazy" />
              </div>
              <div class="xin-left">
                <div class="xin-title">
                  <span
                    class="max-title"
                    :style="{
                      color: idx < 3 ? 'var(--color-blue-517bff)' : 'var(--color-black)',
                      maxWidth: idx < 3
                        ? item.isNew === 1
                          ? 'calc(100% - 56px - 57px)'
                          : 'calc(100% - 57px)'
                        : item.isNew === 1
                          ? 'calc(100% - 56px)'
                          : '100%'
                    }"
                  >
                    {{ item.title || '' }}
                  </span>
                  <span v-if="item.isNew === 1" class="xin-title-new"></span>
                </div>
              </div>
              <div class="tab-list">
                <span v-for="(value, indextab) in item.typeList" :key="indextab" class="tab-item">
                  {{ value.name }}
                </span>
              </div>
              <div class="subtitle">{{ item.content || item.title || '' }}</div>
            </div>
          </div>
          <div class="card-footer">
            <div class="profile">
              <img
                class="xin-avatar"
                :src="item.avatar || 'https://file.aizhs.top/sys-mini/default/logo/guanlogo.png'"
                :alt="item.name || '用户头像'"
              />
              <span class="xin-name">{{ item.nickname || t('studyModelItem.official') }}</span>
              <div v-if="item.isHot === 0" class="xin-title-hot">
                <img src="https://file.aizhs.top/sys-mini/default/useNum.png" class="hot-icon-small" alt="" />
                <span>{{ numResult(item.usageCount) }}</span>
              </div>
              <div v-if="item.isHot === 1" class="xin-title-hot">
                <img src="https://file.aizhs.top/sys-mini/default/hot.png" class="hot-icon" alt="" loading="lazy" />
                <span>{{ numResult(item.usageCount) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

defineProps<{
  item: Record<string, any>
  idx: number
}>()

const emit = defineEmits<{
  toDetail: []
  intelliShow: [text: string]
  getAgentCollect: [id: any]
  getAgentLike: [id: any]
}>()

function toDetail() {
  emit('toDetail')
}

function numResult(num: number) {
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K'
  }
  return num
}
</script>

<style scoped>
.ai-card {
  width: 100%;
  border-radius: var(--global-border-radius);
  box-sizing: border-box;
  position: relative;
  display: flex;
  align-items: flex-end;
  transition: box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.ai-card:hover {
  box-shadow: var(--global-box-shadow);
  transform: translateY(0) scale(1.03);
}

.card-box {
  width: 100%;
  box-sizing: border-box;
  display: flex;
  justify-content: center;
  align-items: center;
  border-radius: var(--global-border-radius);
}

.xin-card-content {
  width: 100%;
  margin: 1px;
  display: flex;
  justify-content: space-between;
  border-radius: var(--global-border-radius);
  padding: 10px 11px 0;
  box-sizing: border-box;
  overflow: hidden;
}

.import-card-bg {
  background: var(--color-blue-015);
  border: none;
}

.normal-card-bg {
  background: var(--color-blue-015);
}

.card-body {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  width: 100%;
  height: 100%;
}

.card-left {
  margin-left: 0;
  display: flex;
  flex-direction: row;
  margin-bottom: 5px;
  position: relative;
}

.top-icon {
  position: absolute;
  right: 9px;
  top: -5px;
  width: 48px;
  height: 48px;
}

.left-content {
  width: 100%;
}

.card-avatar-box {
  float: left;
  position: relative;
}

.robot-img {
  width: 90px;
  height: 90px;
  border-radius: var(--global-border-radius);
  border-radius: var(--global-border-radius);
}

.xin-left {
  margin-top: 0;
  display: flex;
  align-items: center;
  padding-left: 4px;
}

.xin-title {
  font-size: 19px;
  font-weight: bold;
  color: var(--color--8178ef);
  font-family: inherit;
  line-height: 25px;
  letter-spacing: 0;
  width: 100%;
  display: block;
}

.max-title {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  display: block;
  float: left;
  line-height: 25px;
  font-size: 19px;
}

.xin-title-new {
  font-size: 10px;
  font-weight: bold;
  line-height: 9px;
  color: var(--color-white);
  background: url('https://file.aizhs.top/sys-mini/default/new.png') no-repeat;
  background-size: 100% 100%;
  display: inline-block;
  border-radius: var(--global-border-radius);
  margin-left: 3px;
  position: relative;
  top: 1px;
  width: 25px;
  height: 25px;
}

.tab-list {
  display: flex;
  overflow-x: auto;
  flex-wrap: nowrap;
}

.tab-item {
  flex: none;
  width: auto;
  padding: 2.5px 5px;
  border: none;
  border-radius: var(--global-border-radius);
  font-size: 10px;
  font-weight: bold;
  line-height: 10px;
  margin-right: 4px;
  color: var(--color-black-60);
}

.subtitle {
  width: 100%;
  font-size: 10px;
  color: var(--color-black-60);
  line-height: 15px;
  margin-top: 3px;
  padding-left: 4px;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  padding-bottom: 2px;
  margin-top: -5px;
  padding-right: 2px;
}

.profile {
  display: flex;
  color: var(--color--6c6c6c);
  justify-content: flex-start;
  align-items: center;
  margin-bottom: 2px;
}

.xin-avatar {
  width: 16px;
  height: 16px;
  border-radius: var(--global-border-radius);
}

.xin-name {
  font-size: 12px;
  margin-left: 4px;
  font-weight: bold;
  font-family: inherit;
}

.xin-title-hot {
  float: right;
  font-size: 13px;
  font-weight: bold;
  line-height: 16px;
  color: var(--color--ff5f33);
  margin-top: -4px;
  margin-left: 2px;
}

.xin-title-hot span {
  margin-left: 3px;
}

.hot-icon-small {
  width: 11px;
  height: 9px;
  margin-bottom: -6px;
}

.hot-icon {
  width: 22px;
  height: 22px;
  margin-bottom: -6px;
}
</style>
