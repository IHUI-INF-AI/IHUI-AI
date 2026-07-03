<!--
  帮助中心
  迁移自 H:\edu client\web\web\src\views\help\index.vue
  - 搜索框
  - 常见问题折叠面板
  - 快速入口（课程中心 / 个人中心 / 意见反馈 / 关于我们）
-->
<template>
  <div class="help-container">
    <div class="help-header">
      <h1 class="help-title">{{ t('help.title') }}</h1>
      <p class="help-subtitle">{{ t('help.subtitle') }}</p>
    </div>

    <div class="help-content">
      <!-- 搜索框 -->
      <div class="search-section">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索您的问题..."
          size="large"
          :prefix-icon="Search"
          clearable
        />
      </div>

      <!-- 常见问题分类 -->
      <div class="faq-section">
        <h2 class="section-title">{{ t('help.faq') }}</h2>
        <el-collapse v-model="activeNames" accordion>
          <el-collapse-item title="如何注册账号？" name="1">
            <div class="faq-content">
              <p>1. 点击页面右上角的"登录"按钮</p>
              <p>2. 在登录页面选择"注册新账号"</p>
              <p>3. 填写您的手机号码并获取验证码</p>
              <p>4. 设置密码并完成注册</p>
            </div>
          </el-collapse-item>
          <el-collapse-item title="如何购买课程？" name="2">
            <div class="faq-content">
              <p>1. 登录您的账号后，浏览课程列表</p>
              <p>2. 选择您感兴趣的课程，点击进入课程详情</p>
              <p>3. 点击"立即购买"或"加入购物车"</p>
              <p>4. 确认订单信息，选择支付方式完成支付</p>
            </div>
          </el-collapse-item>
          <el-collapse-item title="如何观看已购买的课程？" name="3">
            <div class="faq-content">
              <p>1. 登录您的账号</p>
              <p>2. 点击"个人中心" - "我的课程"</p>
              <p>3. 找到已购买的课程，点击开始学习</p>
              <p>4. 您可以随时在学习记录中继续上次的学习进度</p>
            </div>
          </el-collapse-item>
          <el-collapse-item title="课程可以退款吗？" name="4">
            <div class="faq-content">
              <p>{{ t('help.refundPolicy') }}</p>
              <p>• 购买后7天内，学习进度不超过30%，可申请全额退款</p>
              <p>• 购买后7-15天内，学习进度不超过50%，可申请50%退款</p>
              <p>• 超过15天或学习进度超过50%，不支持退款</p>
              <p>{{ t('help.refundContact') }}</p>
            </div>
          </el-collapse-item>
          <el-collapse-item title="如何获取学习证书？" name="5">
            <div class="faq-content">
              <p>1. 完成课程所有章节的学习</p>
              <p>2. 通过课程结业考试（如有）</p>
              <p>3. 在"个人中心" - "我的证书"中查看和下载证书</p>
            </div>
          </el-collapse-item>
          <el-collapse-item title="如何联系客服？" name="6">
            <div class="faq-content">
              <p>{{ t('help.contactWays') }}</p>
              <p>• 在线客服：点击页面右下角的客服图标</p>
              <p>{{ t('help.workHours') }}</p>
            </div>
          </el-collapse-item>
        </el-collapse>
      </div>

      <!-- 快速入口 -->
      <div class="quick-entry">
        <h2 class="section-title">{{ t('help.quickEntry') }}</h2>
        <div class="entry-grid">
          <router-link to="/learn" class="entry-item">
            <div class="entry-icon">📚</div>
            <span>{{ t('help.courseCenter') }}</span>
          </router-link>
          <router-link to="/member/personal" class="entry-item">
            <div class="entry-icon">👤</div>
            <span>{{ t('help.personalCenter') }}</span>
          </router-link>
          <router-link to="/feedback" class="entry-item">
            <div class="entry-icon">💬</div>
            <span>{{ t('help.feedback') }}</span>
          </router-link>
          <router-link to="/about" class="entry-item">
            <div class="entry-icon">🏢</div>
            <span>{{ t('help.aboutUs') }}</span>
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Search } from '@element-plus/icons-vue'

const { t } = useI18n()
const searchKeyword = ref('')
const activeNames = ref(['1'])
</script>

<style lang="scss" scoped>
.help-container {
  max-width: 1200px;
  margin: 30px auto 40px;
  padding: 0 clamp(12px, 3vw, 24px);
  background: var(--el-bg-color);
  border-radius: var(--global-border-radius);
}

.help-header {
  text-align: center;
  padding: 40px 0;
  border-bottom: 1px solid var(--border-unified-color);
}

.help-title {
  font-size: 32px;
  color: var(--el-text-color-primary);
  margin: 0 0 10px;
  font-weight: 600;
}

.help-subtitle {
  font-size: 18px;
  color: var(--el-text-color-secondary);
  margin: 0;
}

.help-content {
  padding: 40px 0;
}

.search-section {
  max-width: 600px;
  margin: 0 auto 50px;
}

.section-title {
  font-size: 24px;
  color: var(--el-text-color-primary);
  margin: 0 0 20px;
  padding-bottom: 10px;
  border-bottom: 2px solid var(--el-text-color-primary);
  display: inline-block;
}

.faq-section {
  margin-bottom: 50px;
}

:deep(.el-collapse) {
  border: none;

  .el-collapse-item__header {
    font-size: 16px;
    font-weight: 500;
    color: var(--el-text-color-primary);
    height: 60px;
    line-height: 60px;
    background: var(--el-fill-color-lighter);
    padding: 0 20px;
    margin-bottom: 10px;
    border-radius: var(--global-border-radius);
    border: none;
  }

  .el-collapse-item__wrap {
    border: none;
  }

  .el-collapse-item__content {
    padding: 20px;
    background: var(--el-fill-color-blank);
    border-radius: 0 0 var(--global-border-radius) var(--global-border-radius);
    margin-top: -10px;
    margin-bottom: 10px;
  }
}

.faq-content p {
  font-size: 14px;
  line-height: 2;
  color: var(--el-text-color-secondary);
  margin: 0;
}

.quick-entry {
  margin-top: 50px;
}

.entry-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  margin-top: 30px;
}

.entry-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 30px 20px;
  background: var(--el-fill-color-lighter);
  border-radius: var(--global-border-radius);
  text-decoration: none;
  transition: transform 0.3s ease, background-color 0.3s ease;
  border: 1px solid var(--border-unified-color);
}

.entry-item:hover {
  background: var(--el-fill-color-light);
}

.entry-icon {
  font-size: 40px;
  margin-bottom: 15px;
}

.entry-item span {
  font-size: 16px;
  color: var(--el-text-color-primary);
  font-weight: 500;
}

@media (width <= 768px) {
  .entry-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (width <= 480px) {
  .entry-grid {
    grid-template-columns: 1fr;
  }
}
</style>
