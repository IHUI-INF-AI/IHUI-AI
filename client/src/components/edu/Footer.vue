<template>
  <footer class="footer-container" role="contentinfo" aria-label="致谢">
    <!-- 主内容区 -->
    <div class="footer-main">
      <div class="footer-content-wrapper">
      <!-- 左侧联系信息 -->
      <div class="left-section">
        <div class="contact-content">
          <h3 class="company-name">吉林省爱智汇人工智能科技有限公司</h3>
          <ul class="contact-list">
            <li class="contact-item">
              <div style="display: flex; flex-direction: column; align-items: flex-start">
                <span class="contact-label">地址：长春市高新区越达路107号</span>
                <span class="contact-value">AI人工智能人才孵化基地</span>
              </div>
            </li>
            <li class="contact-item">
              <span class="contact-label">联系电话:</span>
              <span class="contact-value">18643389808</span>
            </li>
            <li class="contact-item">
              <span class="contact-label">邮箱:</span>
              <div style="display: flex; flex-direction: column; align-items: flex-start">
                <span class="contact-value">502319984@qq.com</span>
                <span class="contact-value">lizong@aizhs.top</span>
              </div>
            </li>
          </ul>
          <div class="quick-links-row">
            <router-link to="/edu/about" class="footer-link">关于我们</router-link>
            <router-link to="/edu/help" class="footer-link">帮助中心</router-link>
            <router-link to="/edu/feedback" class="footer-link">意见反馈</router-link>
          </div>
          <div class="quick-links-row">
            <router-link to="/edu/agreement/privacy" class="footer-link">隐私政策</router-link>
            <router-link to="/edu/agreement/service" class="footer-link">服务条款</router-link>
            <router-link to="/edu/agreement/tort" class="footer-link">用户协议</router-link>
          </div>
        </div>
      </div>

      <!-- 中间支持平台和模型 -->
      <div class="platforms-container">
        <!-- 第一排：支持接入平台 -->
        <div class="platform-row">
          <div class="platform-group">
            <h4 class="platform-title">支持接入平台</h4>
            <div class="platform-icons">
              <div class="icon-button">
                <img src="/footer/awsp/n8n.png" class="icon-bg" alt="n8n" loading="lazy" @error="handleImageError" />
              </div>
              <div class="icon-button">
                <img src="/footer/awsp/coze.png" class="icon-bg" alt="coze" loading="lazy" @error="handleImageError" />
              </div>
            </div>
          </div>
        </div>
        <div class="platform-row">
          <div class="model-group">
            <h4 class="model-title">模型</h4>
            <div class="model-icons">
              <div class="icon-button" v-for="model in modelIcons" :key="model">
                <img :src="`/footer/model/${model}`" class="icon-bg" :alt="model" loading="lazy" @error="handleImageError" />
              </div>
            </div>
          </div>
        </div>

        <!-- 第二排：支付平台和云数据库 -->
        <div class="platform-row">
          <div class="model-group">
            <h4 class="model-title">支付平台</h4>
            <div class="model-icons">
              <div class="icon-button" v-for="pay in paymentIcons" :key="pay">
                <img :src="`/footer/zf/${pay}`" class="icon-bg" :alt="pay" loading="lazy" @error="handleImageError" />
              </div>
            </div>
          </div>

          <div class="model-group">
            <h4 class="model-title">云数据库</h4>
            <div class="model-icons">
              <div class="icon-button" v-for="db in databaseIcons" :key="db">
                <img :src="`/footer/shujuku/${db}`" class="icon-bg" :alt="db" loading="lazy" @error="handleImageError" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧区域：小程序二维码和推广平台 -->
      <div class="right-section">
        <!-- 官方推广平台 -->
        <div class="promotion-section">
          <h4 class="promotion-title">官方推广平台</h4>
          <div class="promotion-icons">
            <!-- 第一排：8个图标 -->
            <div class="promotion-row">
              <div class="icon-button" v-for="i in 8" :key="'promo1-' + i" @mouseenter="setPromotionHover(i - 1)" @mouseleave="clearPromotionHover">
                <div class="img-wrapper">
                  <img :src="`/footer/tuiguangpingtai/${i}.png`" class="icon-bg" :alt="`tgpt-${i}`" loading="lazy" @error="handleImageError" />
                </div>
                <div class="qr-popover" v-show="hoveredPromotionIndex === i - 1">
                  <img src="/images/common/empty.svg" class="qr-image" @error="handleImageError" />
                </div>
              </div>
            </div>

            <!-- 第二排：8个图标 -->
            <div class="promotion-row">
              <div class="icon-button" v-for="i in 8" :key="'promo2-' + i" @mouseenter="setPromotionHover(i + 7)" @mouseleave="clearPromotionHover">
                <div class="img-wrapper">
                  <img :src="`/footer/tuiguangpingtai/${i + 8}.png`" class="icon-bg" :alt="`tgpt-${i + 8}`" loading="lazy" @error="handleImageError" />
                </div>
                <div class="qr-popover" v-show="hoveredPromotionIndex === i + 7">
                  <img src="/images/common/empty.svg" class="qr-image" @error="handleImageError" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 右侧：小程序二维码 -->
        <div class="qrcode-container">
          <div class="qrcode-section">
            <div class="qrcode-item">
              <div class="qrcode-text">官方应用</div>
              <div class="qrcode-image-wrapper">
                <img src="/footer/erweima/footer-icon-2.png" class="qrcode-image" @error="handleImageError" />
              </div>
            </div>
            <div class="qrcode-item">
              <div class="qrcode-text">联系我们</div>
              <div class="qrcode-image-wrapper">
                <img src="/footer/erweima/footer-icon-3.png" class="qrcode-image" @error="handleImageError" />
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>

      <!-- 许可证信息 -->
      <div class="license-wrapper">
        <img src="/footer/erweima/footer-icon-1.png" class="rectangle-1" @error="handleImageError" />
        <div class="text">吉ICP备2025027274号</div>
        <div class="text-1">Copyright © 2025 智汇AI集团 版权所有</div>
      </div>
    </div>
  </footer>
</template>

<script>
export default {
  name: "FooterIndex",
  data() {
    return {
      hoveredPromotionIndex: null,
      fallbackIcon: '/images/common/ai_default.svg',
      modelIcons: ['2.png', '3x.png', '4.png', '5.png', '6.png', '7.png', '8x.png', '9.png'],
      paymentIcons: ['DY.png', 'VISA.png', 'YL.png', 'weixin@1x.png', 'zfb.png'],
      databaseIcons: ['1.png', '2.png', '3.png', '4.png', '5.png']
    }
  },
  methods: {
    setPromotionHover(idx) {
      this.hoveredPromotionIndex = idx
    },
    clearPromotionHover() {
      this.hoveredPromotionIndex = null
    },
    handleImageError(event) {
      const img = event.target
      if (img && img.src !== this.fallbackIcon) {
        img.src = this.fallbackIcon
      }
    }
  }
}
</script>

<style lang="scss" scoped>
.footer-container {
  width: 100%;
  min-width: auto;
  height: auto;
  z-index: 3000;
  background-color: #1d1e1f;
  color: #e5eaf3;
  padding: 0;
  box-sizing: border-box;
  margin: 0;
  position: relative;
  display: flex;
  flex-direction: column;
  overflow: visible;
  border-top: 1px solid #303133;
}

.footer-main {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0;
  margin: 0;
  width: 100%;
  min-width: auto;
  position: relative;
  z-index: 3001;
  overflow: visible;
  background-color: transparent;
}

.footer-content-wrapper {
  display: flex;
  justify-content: space-between;
  align-items: stretch;
  flex-wrap: nowrap;
  width: 100%;
  margin: 0;
  padding: 20px 40px;
  box-sizing: border-box;
  gap: 40px;
}

/* 左侧区域 */
.left-section {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: flex-start;
  width: auto;
  margin: 0;
  padding: 0;
  background-color: transparent;
  flex: 0 0 auto;
  min-width: 280px;
}

.contact-content {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: flex-start;
  padding: 10px 10px 0 10px;
  padding-bottom: 0;
  text-align: left;
  margin-left: 0;
  width: fit-content;
  max-width: 100%;
  height: 100%;
  flex: 1 0 auto;
  font-size: 0;
  line-height: 0;
}

.contact-content > :last-child {
  margin-bottom: 0;
}

.contact-content .company-name {
  margin: 0 0 15px 0;
  text-align: left;
}

.contact-content .contact-list {
  display: block;
  margin: 0;
  padding: 0;
  max-width: 100%;
}

.contact-content .contact-item {
  margin-bottom: 0;
  justify-content: flex-start;
}

.company-name {
  font-family: 'HarmonyOS Sans SC', sans-serif;
  font-size: 20px;
  line-height: 36px;
  font-weight: 700;
  margin: 0 0 15px 0;
  padding: 0;
  color: #cfd3dc;
  text-align: left;
}

.contact-list {
  list-style: none;
  padding: 0;
  margin: 0 0 5px 0;
}

.contact-item {
  display: flex;
  align-items: flex-start;
  margin-bottom: 1px;
  text-align: left;
  justify-content: flex-start;
  font-family: 'HarmonyOS Sans SC', sans-serif;
  font-size: 18px;
  line-height: 32px;
  font-weight: 700;
  color: #cfd3dc;
}

.contact-label {
  min-width: 30px;
  margin-right: 0;
  color: #cfd3dc;
}

.contact-value {
  font-size: 18px;
  display: inline-block;
  color: #cfd3dc;
  font-family: 'HarmonyOS Sans SC', sans-serif;
}

.right-section {
  display: flex;
  flex-direction: column;
  gap: 15px;
  justify-content: flex-start;
  align-items: flex-end;
  padding: 0;
  flex: 0 0 auto;
  height: auto;
  overflow: visible;
  margin-left: auto;
}

.qrcode-container {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  align-self: end;
  margin: 0;
  padding: 0;
  width: fit-content;
  flex: 0 0 auto;
}

.qrcode-section {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 20px;
  margin: 0;
  padding: 0 5px;
  margin-left: 0;
  padding-left: 0;
  background-color: transparent;
  width: auto;
  min-width: auto;
  max-width: none;
  flex: 0 0 auto;
  overflow: visible;
}

.qrcode-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: 2px;
  flex: 0 0 auto;
  width: auto;
  position: relative;
  overflow: visible;
}

.qrcode-text {
  font-family: 'HarmonyOS Sans SC', sans-serif;
  font-size: 18px;
  line-height: 32px;
  font-weight: 700;
  text-align: center;
  white-space: nowrap;
  margin-bottom: 2px;
  color: #cfd3dc;
  min-width: 0;
  position: relative;
  z-index: 1;
}

.qrcode-item:hover .qrcode-text {
  z-index: 0;
}

.qrcode-image-wrapper {
  position: relative;
  display: inline-block;
  width: 100px;
  height: 100px;
  z-index: 10;
  transition: transform 0.3s ease;
  transform-origin: center center;
  overflow: visible;
}

.qrcode-image-wrapper::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100px;
  height: 100px;
  background-color: #1d1e1f;
  border-radius: 6px;
  opacity: 0;
  transition: transform 0.3s ease, border-radius 0.3s ease, opacity 0.3s ease;
  transform-origin: center center;
  z-index: 1;
  pointer-events: none;
}

.qrcode-image {
  width: 100px;
  height: 100px;
  object-fit: contain;
  display: block;
  position: relative;
  z-index: 11;
  transition: transform 0.3s ease, border-radius 0.3s ease, box-shadow 0.3s ease;
  transform-origin: center center;
  border-radius: 6px;
}

.qrcode-image-wrapper:hover::before {
  transform: scale(1.2) translateY(-30px);
  border-radius: 14px;
  opacity: 1;
}

.qrcode-image-wrapper:hover .qrcode-image {
  transform: scale(1.2) translateY(-30px);
  border-radius: 14px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.qrcode-image-wrapper:hover {
  z-index: 12;
  overflow: visible;
}

/* 平台和模型区域 */
.platforms-container {
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: center;
  justify-content: center;
  flex: 1 1 0;
  min-width: 0;
}

.platform-row {
  display: flex;
  flex-direction: row;
  gap: 50px;
  justify-content: center;
  width: 100%;
}

.platform-group,
.model-group {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 0;
  margin-bottom: 2px;
  position: relative;
  z-index: 10;
  min-width: 100px;
}

.platform-title,
.model-title {
  font-family: 'HarmonyOS Sans SC', sans-serif;
  font-size: 18px;
  line-height: 32px;
  font-weight: 700;
  margin: 0 0 0 0;
  text-align: left;
  color: #cfd3dc;
  white-space: nowrap;
  writing-mode: horizontal-tb;
  display: inline-block;
  width: auto;
  height: auto;
}

.promotion-title {
  font-family: 'HarmonyOS Sans SC', sans-serif;
  font-size: 18px;
  line-height: 32px;
  font-weight: 700;
  margin: 0 -10px 0 0;
  text-align: center;
  color: #cfd3dc;
  white-space: nowrap;
  writing-mode: horizontal-tb;
  display: inline-block;
  width: 100%;
  height: auto;
}

.platform-icons {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-start;
  gap: 4px;
  margin: 0;
}

.promotion-icons {
  display: flex;
  flex-wrap: nowrap;
  justify-content: flex-start;
  gap: 4px;
  margin: 0;
}

.model-icons {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-start;
  gap: 4px;
  margin: 0;
  flex: 1;
}

/* 推广平台图标按钮样式 */
.promotion-section .icon-button {
  width: 20px;
  height: 20px;
  flex: 0 0 auto;
}

/* 通用图标按钮 */
.icon-button {
  width: 30px;
  height: 30px;
  overflow: hidden;
  position: relative;
  cursor: pointer;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
  border-radius: 8px;
}

.icon-button:hover {
  transform: translateY(-3px);
}

.img-wrapper {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: 8px;
}

.icon-bg {
  width: 48px;
  height: 48px;
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  object-position: center;
}

/* 推广平台区域 */
.promotion-section {
  width: auto;
  max-width: none;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  padding: 0;
  margin: 0;
  position: relative;
  z-index: 50;
  background-color: transparent;
  flex: 0 0 auto;
  overflow: visible;
}

.promotion-icons {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: center;
  gap: 6px;
  width: auto;
  margin: 0;
  overflow: visible;
}

.promotion-row {
  display: flex;
  justify-content: flex-start;
  width: auto;
  gap: 6px;
  margin-bottom: 0;
  overflow: visible;
}

.promotion-section .icon-button {
  width: 30px;
  height: 30px;
  flex: 0 0 auto;
  overflow: visible;
  position: relative;
  z-index: 50;
}

.promotion-section .icon-button:hover {
  z-index: 10000;
}

.promotion-section .img-wrapper {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: 8px;
}

.qr-popover {
  position: absolute;
  top: -200px;
  left: -75px;
  width: 180px;
  height: 180px;
  background-color: #1d1e1f;
  border-radius: 6px;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: auto;
}

.qr-image {
  width: 168px;
  height: 168px;
  object-fit: contain;
  border-radius: 6px;
}

/* 快速链接区域 */
.quick-links-row {
  display: flex;
  gap: 10px;
  justify-content: center;
  align-items: center;
  width: 200px;
  margin-left: 68px;
  margin-top: 0;
  height: 14px;
  font-weight: 700;
  line-height: 0;
  padding-bottom: 0;
  margin-bottom: 0;
}

.contact-content .quick-links-row:first-of-type {
  margin-top: auto;
}

.quick-links-row + .quick-links-row {
  margin-top: 6px;
}

.footer-link {
  color: #cfd3dc;
  font-family: 'HarmonyOS Sans SC', sans-serif;
  font-size: 14px;
  line-height: 1;
  font-weight: 700;
  text-decoration: none;
  transition: all 0.3s ease;
  white-space: nowrap;
  position: relative;
  padding: 0;
  display: inline-block;
  height: 14px;
  vertical-align: middle;
  text-align: center;
  width: 60px;

  &:hover {
    color: #e5eaf3;
    transform: translateY(-2px);
  }

  &:focus {
    outline: 2px solid #409eff;
    outline-offset: 2px;
  }

  &.router-link-active {
    color: #cfd3dc;
    font-weight: 700;

    &::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 2px;
      background-color: #cfd3dc;
      border-radius: 1px;
    }
  }
}

/* 许可证和版权信息 */
.license-wrapper {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
  justify-content: center;
  padding: 10px 40px;
  border-radius: 0;
  position: relative;
  background-color: transparent;
  border: none;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  width: 100%;
  margin: 0;
  z-index: 3002;

  .rectangle-1 {
    width: 14px;
    height: 13px;
    object-fit: cover;
    margin-right: 4px;
  }

  .text {
    white-space: nowrap;
    color: #a3a6ad;
    font-family: 'HarmonyOS Sans SC', sans-serif;
    font-size: 12px;
    line-height: 16px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    margin-right: 4px;
  }

  .text-1 {
    white-space: nowrap;
    color: #a3a6ad;
    font-family: 'HarmonyOS Sans SC', sans-serif;
    font-size: 12px;
    line-height: 16px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    margin-top: 0px;
  }
}

/* 响应式设计 */
@media (max-width: 1200px) {
  .footer-content-wrapper {
    padding: 20px 30px;
    gap: 30px;
  }
}

@media (max-width: 992px) {
  .footer-content-wrapper {
    flex-wrap: wrap;
    justify-content: space-between;
    padding: 20px;
    gap: 20px;
  }
  
  .left-section {
    flex: 0 0 auto;
  }
  
  .platforms-container {
    flex: 1 1 auto;
  }
  
  .right-section {
    flex: 0 0 auto;
    margin-left: 0;
  }
}

@media (max-width: 768px) {
  .footer-content-wrapper {
    padding: 15px;
    gap: 15px;
  }

  .company-name {
    font-size: 16px;
    line-height: 24px;
  }

  .qrcode-text {
    font-size: 14px;
    line-height: 20px;
  }

  .qrcode-image-wrapper {
    width: 80px;
    height: 80px;
  }

  .qrcode-image {
    width: 80px;
    height: 80px;
  }

  .icon-button {
    width: 26px;
    height: 26px;
  }

  .contact-item,
  .contact-value,
  .platform-title,
  .model-title,
  .promotion-title {
    font-size: 14px;
    line-height: 22px;
  }

  .footer-link {
    font-size: 13px;
  }
  
  .quick-links-row {
    margin-left: 0;
    width: auto;
  }
}

@media (max-width: 600px) {
  .footer-content-wrapper {
    padding: 10px;
  }

  .qrcode-image-wrapper {
    width: 70px;
    height: 70px;
  }

  .qrcode-image {
    width: 70px;
    height: 70px;
  }

  .qrcode-text {
    font-size: 12px;
    line-height: 16px;
  }

  .company-name,
  .contact-item,
  .contact-value,
  .platform-title,
  .model-title,
  .promotion-title {
    font-size: 12px;
    line-height: 18px;
  }

  .footer-link {
    font-size: 12px;
  }
  
  .license-wrapper {
    padding: 8px 0;
  }
}
</style>
