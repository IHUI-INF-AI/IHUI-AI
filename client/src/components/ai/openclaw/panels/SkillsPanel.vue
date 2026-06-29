<template>
  <div class="openclaw-panel-content">
    <div class="openclaw-toolbar">
      <el-button link size="small" :loading="loadingList || loadingInstalled" @click="refresh">
        {{ t('common.refresh') }}
      </el-button>
    </div>
    <el-tabs v-model="activeTab">
      <el-tab-pane :label="t('floatingChat.openclaw.availableSkills')" name="available">
        <el-input
          v-model="skillSearch"
          size="small"
          :placeholder="t('floatingChat.openclaw.searchSkills')"
          clearable
          class="openclaw-search"
        />
        <div class="openclaw-loading" v-if="loadingList">{{ t('common.loading') }}</div>
        <ul v-else class="openclaw-list">
          <li v-for="s in filteredAvailableList" :key="s.id" class="openclaw-list__item openclaw-list__item--skill">
            <div class="openclaw-skill-info">
              <span class="openclaw-skill-name">{{ s.name }}</span>
              <span class="openclaw-skill-desc">{{ s.description || '-' }}</span>
            </div>
            <el-button type="primary" size="small" :loading="installingId === s.id" :disabled="installedIds.has(s.id)" @click="install(s.id)">
              {{ installedIds.has(s.id) ? t('floatingChat.openclaw.installed') : t('floatingChat.openclaw.install') }}
            </el-button>
          </li>
        </ul>
        <p v-if="!loadingList && filteredAvailableList.length === 0" class="openclaw-empty">{{ skillSearch ? t('floatingChat.openclaw.noMatchSkills') : t('floatingChat.openclaw.noSkills') }}</p>
      </el-tab-pane>
      <el-tab-pane :label="t('floatingChat.openclaw.installedSkills')" name="installed">
        <div class="openclaw-loading" v-if="loadingInstalled">{{ t('common.loading') }}</div>
        <ul v-else class="openclaw-list">
          <li v-for="s in installedList" :key="s.skillId" class="openclaw-list__item openclaw-list__item--skill">
            <div class="openclaw-skill-info">
              <span class="openclaw-skill-name">{{ s.skillName }}</span>
              <span class="openclaw-skill-desc">v{{ s.version }}</span>
            </div>
            <el-button type="danger" size="small" link :loading="uninstallingId === s.skillId" @click="uninstall(s.skillId)">
              {{ t('floatingChat.openclaw.uninstall') }}
            </el-button>
          </li>
        </ul>
        <p v-if="!loadingInstalled && installedList.length === 0" class="openclaw-empty">{{ t('floatingChat.openclaw.noInstalledSkills') }}</p>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { getApiErrorMessage } from './utils'
import { getSkills, getInstalledSkills, installSkill, uninstallSkill } from '@/api/openclaw'
import type { Skill, SkillInstallation } from '@/api/openclaw'

const { t } = useI18n()

const activeTab = ref('available')
const skillSearch = ref('')
const availableList = ref<Skill[]>([])
const installedList = ref<SkillInstallation[]>([])
const loadingList = ref(false)
const loadingInstalled = ref(false)
const installingId = ref<string | null>(null)
const uninstallingId = ref<string | null>(null)

const installedIds = computed(() => new Set(installedList.value.map(i => i.skillId)))
const filteredAvailableList = computed(() => {
  const q = skillSearch.value.trim().toLowerCase()
  if (!q) return availableList.value
  return availableList.value.filter(s => (s.name + (s.description || '')).toLowerCase().includes(q))
})

async function loadAvailable() {
  loadingList.value = true
  try {
    const res = await getSkills({ page: 1, pageSize: 50 })
    const data = res.data as { list?: Skill[] }
    availableList.value = data?.list ?? []
  } catch {
    availableList.value = []
  } finally {
    loadingList.value = false
  }
}

async function loadInstalled() {
  loadingInstalled.value = true
  try {
    const res = await getInstalledSkills()
    installedList.value = (res.data as SkillInstallation[]) ?? []
  } catch {
    installedList.value = []
  } finally {
    loadingInstalled.value = false
  }
}

async function install(skillId: string) {
  installingId.value = skillId
  try {
    await installSkill(skillId)
    ElMessage.success(t('common.installSuccess'))
    loadInstalled()
    loadAvailable()
  } catch (e) {
    ElMessage.error(getApiErrorMessage(e, t('common.installFailed')))
  } finally {
    installingId.value = null
  }
}

async function uninstall(skillId: string) {
  uninstallingId.value = skillId
  try {
    await uninstallSkill(skillId)
    ElMessage.success(t('floatingChat.openclaw.uninstalled'))
    loadInstalled()
    loadAvailable()
  } catch (e) {
    ElMessage.error(getApiErrorMessage(e, t('common.requestFailed')))
  } finally {
    uninstallingId.value = null
  }
}

function refresh() {
  loadAvailable()
  loadInstalled()
}

onMounted(refresh)
</script>

<style lang="scss" scoped>
/* 共用样式见 styles/_openclaw-panels.scss */
.openclaw-search {
  margin-bottom: 14px;
}

.openclaw-list {
  padding-top: 4px;
}
</style>
