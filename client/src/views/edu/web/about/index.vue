<template>
  <div class="about-container">
    <div class="about-header">
      <h1 class="about-title">关于我们</h1>
      <p class="about-subtitle">吉林省爱智汇人工智能科技有限公司</p>
    </div>

    <div class="about-content">
      <section class="about-section">
        <h2 class="section-title">公司简介</h2>
        <div class="section-content">
          <p>吉林省爱智汇人工智能科技有限公司是一家专注于人工智能教育培训的科技公司，致力于为广大学习者提供优质的AI技术学习资源和培训服务。</p>
          <p>我们的使命是推动人工智能技术的普及与应用，帮助更多人掌握AI技能，迎接智能时代的机遇与挑战。</p>
        </div>
      </section>

      <section class="about-section">
        <h2 class="section-title">我们的优势</h2>
        <div class="advantage-grid">
          <div class="advantage-item">
            <div class="advantage-icon">
              <i class="el-icon-trophy"></i>
            </div>
            <h3>专业团队</h3>
            <p>拥有资深的AI技术专家和教育专家团队</p>
          </div>
          <div class="advantage-item">
            <div class="advantage-icon">
              <i class="el-icon-document"></i>
            </div>
            <h3>优质课程</h3>
            <p>提供系统化、实战化的AI学习课程</p>
          </div>
          <div class="advantage-item">
            <div class="advantage-icon">
              <i class="el-icon-service"></i>
            </div>
            <h3>贴心服务</h3>
            <p>全程跟踪学习进度，提供答疑辅导</p>
          </div>
          <div class="advantage-item">
            <div class="advantage-icon">
              <i class="el-icon-data-line"></i>
            </div>
            <h3>就业保障</h3>
            <p>与多家企业合作，提供就业推荐服务</p>
          </div>
        </div>
      </section>

      <section class="about-section">
        <h2 class="section-title">联系我们</h2>
        <div class="contact-info">
          <div class="contact-item">
            <span class="contact-label">地址：</span>
            <span class="contact-value">长春市高新区越达路107号 AI人工智能人才孵化基地</span>
          </div>
          <div class="contact-item">
            <span class="contact-label">电话：</span>
            <span class="contact-value">18643389808</span>
          </div>
          <div class="contact-item">
            <span class="contact-label">邮箱：</span>
            <span class="contact-value">502319984@qq.com / lizong@aizhs.top</span>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script>
export default {
  name: "AboutIndex"
}
</script>

<style lang="scss" scoped>
.about-container {
  max-width: 1200px;
  min-width: 1200px;
  margin: 30px auto 40px;
  padding: 0 20px;
  background: #fff;
  border-radius: 8px;
}

.about-header {
  text-align: center;
  padding: 40px 0;
  border-bottom: 1px solid #eee;
}

.about-title {
  font-size: 32px;
  color: #303133;
  margin: 0 0 10px;
  font-weight: 600;
}

.about-subtitle {
  font-size: 18px;
  color: #606266;
  margin: 0;
}

.about-content {
  padding: 40px 0;
}

.about-section {
  margin-bottom: 50px;

  &:last-child {
    margin-bottom: 0;
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

.section-content {
  p {
    font-size: 16px;
    line-height: 1.8;
    color: #606266;
    margin: 0 0 15px;
    text-indent: 2em;

    &:last-child {
      margin-bottom: 0;
    }
  }
}

.advantage-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 30px;
  margin-top: 30px;
}

.advantage-item {
  text-align: center;
  padding: 30px 20px;
  background: #f5f7fa;
  border-radius: 8px;
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-5px);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
  }
}

.advantage-icon {
  width: 60px;
  height: 60px;
  margin: 0 auto 15px;
  background: #409eff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;

  i {
    font-size: 28px;
    color: #fff;
  }
}

.advantage-item h3 {
  font-size: 18px;
  color: #303133;
  margin: 0 0 10px;
}

.advantage-item p {
  font-size: 14px;
  color: #909399;
  margin: 0;
  line-height: 1.6;
}

.contact-info {
  background: #f5f7fa;
  padding: 30px;
  border-radius: 8px;
}

.contact-item {
  display: flex;
  align-items: flex-start;
  margin-bottom: 15px;
  font-size: 16px;

  &:last-child {
    margin-bottom: 0;
  }
}

.contact-label {
  color: #303133;
  font-weight: 500;
  min-width: 60px;
}

.contact-value {
  color: #606266;
}

@media (max-width: 1200px) {
  .about-container {
    min-width: auto;
  }

  .advantage-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .advantage-grid {
    grid-template-columns: 1fr;
  }
}
</style>
