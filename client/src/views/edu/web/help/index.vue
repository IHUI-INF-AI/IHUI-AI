<template>
  <div class="help-container">
    <div class="help-header">
      <h1 class="help-title">帮助中心</h1>
      <p class="help-subtitle">我们随时为您提供帮助</p>
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
        <h2 class="section-title">常见问题</h2>

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
              <p>根据我们的退款政策：</p>
              <p>• 购买后7天内，学习进度不超过30%，可申请全额退款</p>
              <p>• 购买后7-15天内，学习进度不超过50%，可申请50%退款</p>
              <p>• 超过15天或学习进度超过50%，不支持退款</p>
              <p>如需退款，请联系客服处理。</p>
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
              <p>您可以通过以下方式联系我们：</p>
              <p>• 电话：18643389808</p>
              <p>• 邮箱：502319984@qq.com</p>
              <p>• 在线客服：点击页面右下角的客服图标</p>
              <p>客服工作时间：周一至周五 9:00-18:00</p>
            </div>
          </el-collapse-item>
        </el-collapse>
      </div>

      <!-- 快速入口 -->
      <div class="quick-entry">
        <h2 class="section-title">快速入口</h2>
        <div class="entry-grid">
          <router-link to="/learn" class="entry-item">
            <div class="entry-icon">📚</div>
            <span>课程中心</span>
          </router-link>
          <router-link to="/member/personal" class="entry-item">
            <div class="entry-icon">👤</div>
            <span>个人中心</span>
          </router-link>
          <router-link to="/feedback" class="entry-item">
            <div class="entry-icon">💬</div>
            <span>意见反馈</span>
          </router-link>
          <router-link to="/about" class="entry-item">
            <div class="entry-icon">🏢</div>
            <span>关于我们</span>
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref } from 'vue'
import { Search } from '@/lib/lucide-fallback'

export default {
  name: "HelpIndex",
  setup() {
    const searchKeyword = ref('')
    const activeNames = ref(['1'])

    return {
      searchKeyword,
      activeNames,
      Search
    }
  }
}
</script>

<style lang="scss" scoped>
.help-container {
  max-width: 1200px;
  min-width: 1200px;
  margin: 30px auto 40px;
  padding: 0 20px;
  background: #fff;
  border-radius: 8px;
}

.help-header {
  text-align: center;
  padding: 40px 0;
  border-bottom: 1px solid #eee;
}

.help-title {
  font-size: 32px;
  color: #303133;
  margin: 0 0 10px;
  font-weight: 600;
}

.help-subtitle {
  font-size: 18px;
  color: #606266;
  margin: 0;
}

.help-content {
  padding: 40px 0;
}

.search-section {
  max-width: 600px;
  margin: 0 auto 50px;

  :deep(.el-input__wrapper) {
    border-radius: 30px;
    padding: 5px 20px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  }
}

.section-title {
  font-size: 24px;
  color: #303133;
  margin: 0 0 20px;
  padding-bottom: 10px;
  border-bottom: 2px solid #409eff;
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
    color: #303133;
    height: 60px;
    line-height: 60px;
    background: #f5f7fa;
    padding: 0 20px;
    margin-bottom: 10px;
    border-radius: 8px;
    border: none;

    &:hover {
      background: #ecf5ff;
    }
  }

  .el-collapse-item__wrap {
    border: none;
  }

  .el-collapse-item__content {
    padding: 20px;
    background: #fafafa;
    border-radius: 0 0 8px 8px;
    margin-top: -10px;
    margin-bottom: 10px;
  }
}

.faq-content {
  p {
    font-size: 14px;
    line-height: 2;
    color: #606266;
    margin: 0;
  }
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
  background: #f5f7fa;
  border-radius: 8px;
  text-decoration: none;
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-5px);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
    background: #ecf5ff;
  }
}

.entry-icon {
  font-size: 40px;
  margin-bottom: 15px;
}

.entry-item span {
  font-size: 16px;
  color: #303133;
  font-weight: 500;
}

@media (max-width: 1200px) {
  .help-container {
    min-width: auto;
  }

  .entry-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .entry-grid {
    grid-template-columns: 1fr;
  }
}
</style>
