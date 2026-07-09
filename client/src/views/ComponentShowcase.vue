<template>
  <div class="component-showcase">
    <header class="showcase-header">
      <h1 class="showcase-title">{{ t('showcase.title') }}</h1>
      <p class="showcase-subtitle">{{ t('showcase.subtitle') }}</p>
    </header>

    <Tabs v-model="activeTab" class="showcase-tabs">
      <TabsList>
        <TabsTrigger value="buttons">{{ t('showcase.tab.buttons') }}</TabsTrigger>
        <TabsTrigger value="forms">{{ t('showcase.tab.forms') }}</TabsTrigger>
        <TabsTrigger value="feedback">{{ t('showcase.tab.feedback') }}</TabsTrigger>
        <TabsTrigger value="data">{{ t('showcase.tab.data') }}</TabsTrigger>
        <TabsTrigger value="navigation">{{ t('showcase.tab.navigation') }}</TabsTrigger>
      </TabsList>
      <TabsContent value="buttons">
        <Card class="showcase-card transition-shadow hover:shadow-md"><CardHeader>
            <span>{{ t('showcase.buttons.title') }}</span>
          </CardHeader><CardContent class="p-5">
                    <div class="demo-row">
            <Button variant="default">{{ t('showcase.buttons.primary') }}</Button>
            <Button variant="default">{{ t('showcase.buttons.success') }}</Button>
            <Button variant="secondary">{{ t('showcase.buttons.warning') }}</Button>
            <Button variant="destructive">{{ t('showcase.buttons.danger') }}</Button>
            <Button variant="ghost">{{ t('showcase.buttons.info') }}</Button>
          </div>
          <Divider />
          <div class="demo-row">
            <Button variant="default" @click="onClick('btn')">
              {{ t('showcase.buttons.loading') }}
            </Button>
            <Button variant="default" disabled>{{ t('showcase.buttons.disabled') }}</Button>
            <Button variant="default" className="rounded-full">{{ t('showcase.buttons.round') }}</Button>
            <Button variant="default" size="icon"><Plus class="h-4 w-4" /></Button>
          </div>
        </CardContent></Card>
      </TabsContent>

      <TabsContent value="forms">
        <Card class="showcase-card transition-shadow hover:shadow-md"><CardHeader>
            <span>{{ t('showcase.forms.title') }}</span>
          </CardHeader><CardContent class="p-5">
                    <form @submit.prevent class="demo-form">
            <div class="mb-4 flex items-center gap-4">
              <label class="w-24 shrink-0 text-sm font-medium text-foreground">{{ t('showcase.forms.input') }}</label>
              <div class="flex-1">
                <Input v-model="formData.input" :placeholder="t('showcase.forms.inputPlaceholder')" />
              </div>
            </div>
            <div class="mb-4 flex items-center gap-4">
              <label class="w-24 shrink-0 text-sm font-medium text-foreground">{{ t('showcase.forms.textarea') }}</label>
              <div class="flex-1">
                <Textarea v-model="formData.textarea" :rows="3" />
              </div>
            </div>
            <div class="mb-4 flex items-center gap-4">
              <label class="w-24 shrink-0 text-sm font-medium text-foreground">{{ t('showcase.forms.select') }}</label>
              <div class="flex-1">
                <Select v-model="formData.select" :placeholder="t('showcase.forms.selectPlaceholder')">
                  <SelectOption :label="t('showcase.forms.optionA')" value="a" />
                  <SelectOption :label="t('showcase.forms.optionB')" value="b" />
                  <SelectOption :label="t('showcase.forms.optionC')" value="c" />
                </Select>
              </div>
            </div>
            <div class="mb-4 flex items-center gap-4">
              <label class="w-24 shrink-0 text-sm font-medium text-foreground">{{ t('showcase.forms.switch') }}</label>
              <div class="flex-1">
                <Switch v-model="formData.switchVal" />
              </div>
            </div>
            <div class="mb-4 flex items-center gap-4">
              <label class="w-24 shrink-0 text-sm font-medium text-foreground">{{ t('showcase.forms.checkbox') }}</label>
              <div class="flex-1">
                <div>
                  <Checkbox v-model="formData.checkboxVal" value="vue">{{ t('showcase.forms.vue') }}</Checkbox>
                  <Checkbox v-model="formData.checkboxVal" value="react">{{ t('showcase.forms.react') }}</Checkbox>
                  <Checkbox v-model="formData.checkboxVal" value="ai">{{ t('showcase.forms.ai') }}</Checkbox>
                </div>
              </div>
            </div>
            <div class="mb-4 flex items-center gap-4">
              <label class="w-24 shrink-0 text-sm font-medium text-foreground">{{ t('showcase.forms.radio') }}</label>
              <div class="flex-1">
                <div>
                  <Radio v-model="formData.radioVal" value="m">{{ t('showcase.forms.male') }}</Radio>
                  <Radio v-model="formData.radioVal" value="f">{{ t('showcase.forms.female') }}</Radio>
                </div>
              </div>
            </div>
            <div class="mb-4 flex items-center gap-4">
              <label class="w-24 shrink-0 text-sm font-medium text-foreground">{{ t('showcase.forms.date') }}</label>
              <div class="flex-1">
                <el-date-picker v-model="formData.date" type="date" :placeholder="t('showcase.forms.datePlaceholder')" />
              </div>
            </div>
          </form>
        </CardContent></Card>
      </TabsContent>

      <TabsContent value="feedback">
        <Card class="showcase-card transition-shadow hover:shadow-md"><CardHeader>
            <span>{{ t('showcase.feedback.title') }}</span>
          </CardHeader><CardContent class="p-5">
                    <div class="demo-row">
            <Alert :title="t('showcase.feedback.successAlert')" variant="success" :closable="false" />
            <Alert :title="t('showcase.feedback.warningAlert')" variant="warning" :closable="false" />
            <Alert :title="t('showcase.feedback.errorAlert')" variant="destructive" :closable="false" />
          </div>
          <Divider />
          <div class="demo-row">
            <Tag type="success">{{ t('showcase.feedback.tagSuccess') }}</Tag>
            <Tag type="info">{{ t('showcase.feedback.tagInfo') }}</Tag>
            <Tag type="warning">{{ t('showcase.feedback.tagWarning') }}</Tag>
            <Tag type="danger">{{ t('showcase.feedback.tagDanger') }}</Tag>
          </div>
          <Divider />
          <div class="demo-row">
            <div class="w-full bg-muted rounded-full h-3.5"><div class="bg-primary h-3.5 rounded-full" :style="{ width: progressValue + '%' }"></div></div>
            <input type="range" v-model="progressValue" min="0" max="100" class="w-full" />
          </div>
        </CardContent></Card>
      </TabsContent>

      <TabsContent value="data">
        <Card class="showcase-card transition-shadow hover:shadow-md"><CardHeader>
            <span>{{ t('showcase.data.title') }}</span>
          </CardHeader><CardContent class="p-5">
                    <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{{ t('showcase.data.columnName') }}</TableHead>
                <TableHead>{{ t('showcase.data.columnCategory') }}</TableHead>
                <TableHead>{{ t('showcase.data.columnStatus') }}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="(row, index) in tableData" :key="row.name ?? index">
                <TableCell>{{ row.name }}</TableCell>
                <TableCell>{{ row.category }}</TableCell>
                <TableCell>
                  <Tag :type="row.statusType">{{ row.status }}</Tag>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
          <Pagination
            class="demo-pagination"
            layout="prev, pager, next, total"
            :total="50"
            :page-size="10"
            :page="1"
          />
        </CardContent></Card>
      </TabsContent>

      <TabsContent value="navigation">
        <Card class="showcase-card transition-shadow hover:shadow-md"><CardHeader>
            <span>{{ t('showcase.navigation.title') }}</span>
          </CardHeader><CardContent class="p-5">
                    <el-menu mode="horizontal" class="demo-menu" :default-active="'home'">
            <el-menu-item index="home">{{ t('showcase.navigation.menuHome') }}</el-menu-item>
            <el-menu-item index="agents">{{ t('showcase.navigation.menuAgents') }}</el-menu-item>
            <el-menu-item index="docs">{{ t('showcase.navigation.menuDocs') }}</el-menu-item>
            <el-menu-item index="about">{{ t('showcase.navigation.menuAbout') }}</el-menu-item>
          </el-menu>
          <Divider />
          <el-breadcrumb separator="/">
            <el-breadcrumb-item>{{ t('showcase.navigation.breadcrumbHome') }}</el-breadcrumb-item>
            <el-breadcrumb-item>{{ t('showcase.navigation.breadcrumbDocs') }}</el-breadcrumb-item>
            <el-breadcrumb-item>{{ t('showcase.navigation.breadcrumbCurrent') }}</el-breadcrumb-item>
          </el-breadcrumb>
          <Divider />
          <el-steps :active="stepValue" finish-status="success" class="demo-steps">
            <el-step :title="t('showcase.navigation.step1')" />
            <el-step :title="t('showcase.navigation.step2')" />
            <el-step :title="t('showcase.navigation.step3')" />
          </el-steps>
          <div class="flex gap-2 demo-row">
            <Button variant="outline" @click="stepValue = Math.max(1, stepValue - 1)">
              {{ t('showcase.navigation.prev') }}
            </Button>
            <Button variant="outline" @click="stepValue = Math.min(3, stepValue + 1)">
              {{ t('showcase.navigation.next') }}
            </Button>
          </div>
        </CardContent></Card>
      </TabsContent>
    </Tabs>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCleanup } from '@/composables/useCleanup'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import Button from '@/components/ui/Button.vue'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Tag } from '@/components/ui/tag'
import { Select, SelectOption } from '@/components/ui/select'
import { Plus } from '@element-plus/icons-vue'

const { t } = useI18n()
const activeTab = ref('buttons')

const loadingState = reactive({ btnLoading: false })
const progressValue = ref(66)
const stepValue = ref(1)

const cleanup = useCleanup()

const formData = reactive({
  input: '',
  textarea: '',
  select: 'a',
  switchVal: true,
  checkboxVal: ['vue'],
  radioVal: 'm',
  date: '',
})

const tableData = [
  { name: '智能客服', category: '对话', status: '已上线', statusType: 'success' },
  { name: '图像生成', category: '生成', status: '测试中', statusType: 'warning' },
  { name: '代码助手', category: '辅助', status: '已上线', statusType: 'success' },
  { name: '数据分析', category: '分析', status: '已下线', statusType: 'danger' },
]

const onClick = (key: string) => {
  if (key === 'btn') {
    loadingState.btnLoading = true
    cleanup.addTimer(() => { loadingState.btnLoading = false }, 1200)
  }
}
</script>

<style scoped lang="scss">
.component-showcase {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 32px 24px 64px;
}

.showcase-header {
  text-align: center;
  margin-bottom: 32px;
}

.showcase-title {
  font-size: 32px;
  font-weight: 700;
  color: hsl(var(--foreground));
  margin: 0 0 8px;
}

.showcase-subtitle {
  font-size: 16px;
  color: hsl(var(--muted-foreground));
  margin: 0;
}

.showcase-tabs {
  background: hsl(var(--background));
}

.showcase-card {
  margin-bottom: 16px;
}

.demo-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.demo-form {
  max-width: 640px;
}

.demo-pagination {
  margin-top: 16px;
  justify-content: flex-end;
}

.demo-menu {
  border-bottom: var(--unified-border-bottom);
}

.demo-steps {
  margin-bottom: 16px;
}
</style>
