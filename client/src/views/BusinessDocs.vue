<template>
  <div class="business-docs">
    <header class="docs-header">
      <h1 class="docs-title">{{ t('businessDocs.title') }}</h1>
      <p class="docs-subtitle">{{ t('businessDocs.subtitle') }}</p>
    </header>

    <el-tabs v-model="activeSection" class="docs-tabs">
      <el-tab-pane :label="t('businessDocs.tab.overview')" name="overview">
        <el-card class="docs-card" shadow="hover">
          <template #header>
            <span>{{ t('businessDocs.overview.title') }}</span>
          </template>
          <el-descriptions :column="1" border>
            <el-descriptions-item :label="t('businessDocs.overview.projectName')">
              {{ overview.projectName }}
            </el-descriptions-item>
            <el-descriptions-item :label="t('businessDocs.overview.version')">
              {{ overview.version }}
            </el-descriptions-item>
            <el-descriptions-item :label="t('businessDocs.overview.license')">
              {{ overview.license }}
            </el-descriptions-item>
            <el-descriptions-item :label="t('businessDocs.overview.node')">
              {{ overview.node }}
            </el-descriptions-item>
            <el-descriptions-item :label="t('businessDocs.overview.description')">
              {{ overview.description }}
            </el-descriptions-item>
          </el-descriptions>
        </el-card>
      </el-tab-pane>

      <el-tab-pane :label="t('businessDocs.tab.modules')" name="modules">
        <el-card class="docs-card" shadow="hover">
          <template #header>
            <span>{{ t('businessDocs.modules.title') }}</span>
          </template>
          <el-collapse v-model="openModules">
            <el-collapse-item
              v-for="m in modules"
              :key="m.name"
              :name="m.name"
              :title="m.title"
            >
              <p class="module-desc">{{ m.desc }}</p>
              <el-table :data="m.endpoints" size="small" border>
                <el-table-column prop="method" :label="t('businessDocs.modules.method')" width="100" />
                <el-table-column prop="path" :label="t('businessDocs.modules.path')" />
                <el-table-column prop="desc" :label="t('businessDocs.modules.desc')" />
              </el-table>
            </el-collapse-item>
          </el-collapse>
        </el-card>
      </el-tab-pane>

      <el-tab-pane :label="t('businessDocs.tab.deploy')" name="deploy">
        <el-card class="docs-card" shadow="hover">
          <template #header>
            <span>{{ t('businessDocs.deploy.title') }}</span>
          </template>
          <el-steps direction="vertical" :active="6" finish-status="success">
            <el-step
              v-for="(step, idx) in deploySteps"
              :key="idx"
              :title="step.title"
              :description="step.desc"
            />
          </el-steps>
        </el-card>
      </el-tab-pane>

      <el-tab-pane :label="t('businessDocs.tab.environment')" name="env">
        <el-card class="docs-card" shadow="hover">
          <template #header>
            <span>{{ t('businessDocs.environment.title') }}</span>
          </template>
          <el-alert
            :title="t('businessDocs.environment.note')"
            type="info"
            :closable="false"
            show-icon
          />
          <el-table :data="envVars" stripe size="small" border class="docs-table">
            <el-table-column prop="key" :label="t('businessDocs.environment.key')" width="280" />
            <el-table-column prop="required" :label="t('businessDocs.environment.required')" width="100">
              <template #default="{ row }">
                <el-tag :type="row.required ? 'danger' : 'info'">
                  {{ row.required ? t('businessDocs.environment.yes') : t('businessDocs.environment.no') }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="desc" :label="t('businessDocs.environment.desc')" />
          </el-table>
        </el-card>
      </el-tab-pane>

      <el-tab-pane :label="t('businessDocs.tab.security')" name="security">
        <el-card class="docs-card" shadow="hover">
          <template #header>
            <span>{{ t('businessDocs.security.title') }}</span>
          </template>
          <el-collapse v-model="openSecurity">
            <el-collapse-item
              v-for="s in securityItems"
              :key="s.title"
              :name="s.title"
              :title="s.title"
            >
              <p>{{ s.desc }}</p>
            </el-collapse-item>
          </el-collapse>
        </el-card>
      </el-tab-pane>

      <el-tab-pane :label="t('businessDocs.tab.faq')" name="faq">
        <el-card class="docs-card" shadow="hover">
          <template #header>
            <span>{{ t('businessDocs.faq.title') }}</span>
          </template>
          <el-collapse v-model="openFaq">
            <el-collapse-item
              v-for="(f, idx) in faqItems"
              :key="idx"
              :name="String(idx)"
              :title="f.q"
            >
              <p class="module-desc">{{ f.a }}</p>
            </el-collapse-item>
          </el-collapse>
        </el-card>
      </el-tab-pane>

      <el-tab-pane :label="t('businessDocs.tab.changelog')" name="changelog">
        <el-card class="docs-card" shadow="hover">
          <template #header>
            <span>{{ t('businessDocs.changelog.title') }}</span>
          </template>
          <el-timeline>
            <el-timeline-item
              v-for="(c, idx) in changelog"
              :key="idx"
              :timestamp="c.version"
              placement="top"
              :type="c.type"
            >
              <h4 class="changelog-version">{{ c.version }}</h4>
              <p class="module-desc">{{ c.date }}</p>
              <ul class="changelog-list">
                <li v-for="(item, i) in c.items" :key="i">{{ item }}</li>
              </ul>
            </el-timeline-item>
          </el-timeline>
        </el-card>
      </el-tab-pane>

      <el-tab-pane :label="t('businessDocs.tab.contributing')" name="contributing">
        <el-card class="docs-card" shadow="hover">
          <template #header>
            <span>{{ t('businessDocs.contributing.title') }}</span>
          </template>
          <el-steps direction="vertical" :active="contributingSteps.length" finish-status="success">
            <el-step
              v-for="(step, idx) in contributingSteps"
              :key="idx"
              :title="step.title"
              :description="step.desc"
            />
          </el-steps>
          <el-alert
            :title="t('businessDocs.contributing.note')"
            type="success"
            :closable="false"
            show-icon
          />
        </el-card>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const activeSection = ref('overview')
const openModules = ref<string[]>(['auth'])
const openSecurity = ref<string[]>(['CSP'])
const openFaq = ref<string[]>(['0'])

const overview = computed(() => ({
  projectName: 'ihui-agi-inf-web',
  version: '1.0.0',
  license: 'Apache-2.0',
  node: '>=20.0.0',
  description: t('businessDocs.overview.descriptionValue'),
}))

interface ModuleInfo {
  name: string
  title: string
  desc: string
  endpoints: Array<{ method: string; path: string; desc: string }>
}

const modules = computed<ModuleInfo[]>(() => [
  {
    name: 'auth',
    title: t('businessDocs.modules.list.auth.title'),
    desc: t('businessDocs.modules.list.auth.desc'),
    endpoints: [
      { method: 'POST', path: '/api/v1/auth/login', desc: t('businessDocs.modules.list.auth.endpoints.login') },
      { method: 'POST', path: '/api/v1/auth/register', desc: t('businessDocs.modules.list.auth.endpoints.register') },
      { method: 'POST', path: '/api/v1/auth/refresh', desc: t('businessDocs.modules.list.auth.endpoints.refresh') },
      { method: 'POST', path: '/api/v1/auth/logout', desc: t('businessDocs.modules.list.auth.endpoints.logout') },
      { method: 'GET', path: '/api/v1/auth/info', desc: t('businessDocs.modules.list.auth.endpoints.userInfo') },
    ],
  },
  {
    name: 'payment',
    title: t('businessDocs.modules.list.payment.title'),
    desc: t('businessDocs.modules.list.payment.desc'),
    endpoints: [
      { method: 'POST', path: '/api/fund/ali/pay', desc: t('businessDocs.modules.list.payment.endpoints.aliPay') },
      { method: 'POST', path: '/api/fund/ali/pay/notify', desc: t('businessDocs.modules.list.payment.endpoints.aliPayNotify') },
      { method: 'GET', path: '/api/fund/ali/pay/success', desc: t('businessDocs.modules.list.payment.endpoints.aliPaySuccess') },
      { method: 'POST', path: '/api/fund/wx/pay', desc: t('businessDocs.modules.list.payment.endpoints.wxPay') },
      { method: 'POST', path: '/api/order/create', desc: t('businessDocs.modules.list.payment.endpoints.orderCreate') },
    ],
  },
  {
    name: 'ai',
    title: t('businessDocs.modules.list.ai.title'),
    desc: t('businessDocs.modules.list.ai.desc'),
    endpoints: [
      { method: 'POST', path: '/api/ai/chat', desc: t('businessDocs.modules.list.ai.endpoints.chat') },
      { method: 'POST', path: '/api/ai/generate', desc: t('businessDocs.modules.list.ai.endpoints.generate') },
      { method: 'GET', path: '/api/ai/models', desc: t('businessDocs.modules.list.ai.endpoints.models') },
      { method: 'POST', path: '/api/agents/create', desc: t('businessDocs.modules.list.ai.endpoints.agentsCreate') },
    ],
  },
  {
    name: 'user',
    title: t('businessDocs.modules.list.user.title'),
    desc: t('businessDocs.modules.list.user.desc'),
    endpoints: [
      { method: 'GET', path: '/api/user/profile', desc: t('businessDocs.modules.list.user.endpoints.profileGet') },
      { method: 'PUT', path: '/api/user/profile', desc: t('businessDocs.modules.list.user.endpoints.profileUpdate') },
      { method: 'GET', path: '/api/vip/levels', desc: t('businessDocs.modules.list.user.endpoints.vipLevels') },
      { method: 'GET', path: '/api/orders', desc: t('businessDocs.modules.list.user.endpoints.orders') },
    ],
  },
  {
    name: 'admin',
    title: t('businessDocs.modules.list.admin.title'),
    desc: t('businessDocs.modules.list.admin.desc'),
    endpoints: [
      { method: 'POST', path: '/api/admin/login', desc: t('businessDocs.modules.list.admin.endpoints.login') },
      { method: 'GET', path: '/api/admin/users', desc: t('businessDocs.modules.list.admin.endpoints.users') },
      { method: 'GET', path: '/api/admin/roles', desc: t('businessDocs.modules.list.admin.endpoints.roles') },
      { method: 'GET', path: '/api/admin/menus', desc: t('businessDocs.modules.list.admin.endpoints.menus') },
    ],
  },
])

const deploySteps = computed(() => [
  { title: t('businessDocs.deploy.steps.clone.title'), desc: t('businessDocs.deploy.steps.clone.desc') },
  { title: t('businessDocs.deploy.steps.install.title'), desc: t('businessDocs.deploy.steps.install.desc') },
  { title: t('businessDocs.deploy.steps.env.title'), desc: t('businessDocs.deploy.steps.env.desc') },
  { title: t('businessDocs.deploy.steps.build.title'), desc: t('businessDocs.deploy.steps.build.desc') },
  { title: t('businessDocs.deploy.steps.preview.title'), desc: t('businessDocs.deploy.steps.preview.desc') },
  { title: t('businessDocs.deploy.steps.production.title'), desc: t('businessDocs.deploy.steps.production.desc') },
])

interface EnvVar { key: string; required: boolean; desc: string }

const envVars = computed<EnvVar[]>(() => [
  { key: 'VITE_API_BASE_URL', required: true, desc: t('businessDocs.environment.vars.viteApiBaseUrl') },
  { key: 'VITE_APP_TITLE', required: false, desc: t('businessDocs.environment.vars.viteAppTitle') },
  { key: 'VITE_ENABLE_MONITOR', required: false, desc: t('businessDocs.environment.vars.viteEnableMonitor') },
  { key: 'VITE_USE_VIZE', required: false, desc: t('businessDocs.environment.vars.viteUseVize') },
  { key: 'BUILD_PLATFORM', required: false, desc: t('businessDocs.environment.vars.buildPlatform') },
  { key: 'VITE_CSP_REPORT_URI', required: false, desc: t('businessDocs.environment.vars.viteCspReportUri') },
  { key: 'VITE_SENTRY_DSN', required: false, desc: t('businessDocs.environment.vars.viteSentryDsn') },
])

interface SecurityItem { title: string; desc: string }

const securityItems = computed<SecurityItem[]>(() => [
  { title: t('businessDocs.security.items.csp.title'), desc: t('businessDocs.security.items.csp.desc') },
  { title: t('businessDocs.security.items.hmac.title'), desc: t('businessDocs.security.items.hmac.desc') },
  { title: t('businessDocs.security.items.webhook.title'), desc: t('businessDocs.security.items.webhook.desc') },
  { title: t('businessDocs.security.items.session.title'), desc: t('businessDocs.security.items.session.desc') },
  { title: t('businessDocs.security.items.rbac.title'), desc: t('businessDocs.security.items.rbac.desc') },
  { title: t('businessDocs.security.items.xss.title'), desc: t('businessDocs.security.items.xss.desc') },
])

interface FaqItem { q: string; a: string }

const faqItems = computed<FaqItem[]>(() => [
  { q: t('businessDocs.faq.items.browser.q'), a: t('businessDocs.faq.items.browser.a') },
  { q: t('businessDocs.faq.items.language.q'), a: t('businessDocs.faq.items.language.a') },
  { q: t('businessDocs.faq.items.demo.q'), a: t('businessDocs.faq.items.demo.a') },
  { q: t('businessDocs.faq.items.deploy.q'), a: t('businessDocs.faq.items.deploy.a') },
  { q: t('businessDocs.faq.items.contribute.q'), a: t('businessDocs.faq.items.contribute.a') },
  { q: t('businessDocs.faq.items.techStack.q'), a: t('businessDocs.faq.items.techStack.a') },
  { q: t('businessDocs.faq.items.bug.q'), a: t('businessDocs.faq.items.bug.a') },
  { q: t('businessDocs.faq.items.pwa.q'), a: t('businessDocs.faq.items.pwa.a') },
])

interface ChangelogItem {
  version: string
  date: string
  type: 'primary' | 'success' | 'warning' | 'danger' | 'info'
  items: string[]
}

const changelog = computed<ChangelogItem[]>(() => [
  {
    version: 'v1.1.0',
    date: '2026-06-17',
    type: 'primary',
    items: [
      t('businessDocs.changelog.items.v110[0]'),
      t('businessDocs.changelog.items.v110[1]'),
      t('businessDocs.changelog.items.v110[2]'),
      t('businessDocs.changelog.items.v110[3]'),
      t('businessDocs.changelog.items.v110[4]'),
    ],
  },
  {
    version: 'v1.0.0',
    date: '2026-06-10',
    type: 'success',
    items: [
      t('businessDocs.changelog.items.v100[0]'),
      t('businessDocs.changelog.items.v100[1]'),
      t('businessDocs.changelog.items.v100[2]'),
      t('businessDocs.changelog.items.v100[3]'),
      t('businessDocs.changelog.items.v100[4]'),
      t('businessDocs.changelog.items.v100[5]'),
    ],
  },
  {
    version: 'v0.9.0',
    date: '2026-06-01',
    type: 'info',
    items: [
      t('businessDocs.changelog.items.v090[0]'),
      t('businessDocs.changelog.items.v090[1]'),
      t('businessDocs.changelog.items.v090[2]'),
      t('businessDocs.changelog.items.v090[3]'),
    ],
  },
])

interface ContributingStep { title: string; desc: string }

const contributingSteps = computed<ContributingStep[]>(() => [
  { title: t('businessDocs.contributing.steps.fork.title'), desc: t('businessDocs.contributing.steps.fork.desc') },
  { title: t('businessDocs.contributing.steps.clone.title'), desc: t('businessDocs.contributing.steps.clone.desc') },
  { title: t('businessDocs.contributing.steps.install.title'), desc: t('businessDocs.contributing.steps.install.desc') },
  { title: t('businessDocs.contributing.steps.branch.title'), desc: t('businessDocs.contributing.steps.branch.desc') },
  { title: t('businessDocs.contributing.steps.dev.title'), desc: t('businessDocs.contributing.steps.dev.desc') },
  { title: t('businessDocs.contributing.steps.check.title'), desc: t('businessDocs.contributing.steps.check.desc') },
  { title: t('businessDocs.contributing.steps.commit.title'), desc: t('businessDocs.contributing.steps.commit.desc') },
  { title: t('businessDocs.contributing.steps.push.title'), desc: t('businessDocs.contributing.steps.push.desc') },
])

</script>

<style scoped lang="scss">
.business-docs {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 32px 24px 64px;
}

.docs-header {
  text-align: center;
  margin-bottom: 32px;
}

.docs-title {
  font-size: 32px;
  font-weight: 700;
  color: var(--el-text-color-primary);
  margin: 0 0 8px;
}

.docs-subtitle {
  font-size: 16px;
  color: var(--el-text-color-secondary);
  margin: 0;
}

.docs-card {
  margin-bottom: 16px;
}

.module-desc {
  color: var(--el-text-color-secondary);
  margin: 0 0 12px;
  font-size: 14px;
}

.docs-table {
  margin-top: 12px;
}

.changelog-version {
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin: 0 0 4px;
}

.changelog-list {
  margin: 8px 0 0;
  padding-left: 20px;
  color: var(--el-text-color-regular);
  font-size: 14px;
  line-height: 1.8;
}
</style>
