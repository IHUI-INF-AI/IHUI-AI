import type { FastifyPluginAsync } from 'fastify'

/**
 * 收款落地页(平台独占:API 端自包含 HTML,无需 web app)。
 * 公网访问:https://api.aizhs.top/landing
 * 流程:展示 VIP 套餐 → 登录 → 创建支付宝订单 → 跳转支付宝收银台 → 支付宝回调自动激活 VIP
 */
export const landingRoutes: FastifyPluginAsync = async (server) => {
  server.get('/landing', async (_request, reply) => {
    reply.type('text/html; charset=utf-8')
    return LANDING_HTML
  })
}

const LANDING_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>IHUI-AI · 开源 AI 商业级基座 — VIP 订阅</title>
<meta name="description" content="IHUI-AI VIP 订阅 - 开源 AI 商业级基座,8 端 + 339 表 + 100 模型,完整商业闭环,支付宝安全支付">
<meta name="keywords" content="IHUI-AI,VIP,AI平台,开源,商业级,支付宝订阅">
<meta property="og:title" content="IHUI-AI 开源 AI 商业级基座 — VIP 订阅">
<meta property="og:description" content="开源 AI 商业级基座,8 端 + 339 表 + 100 模型,完整商业闭环,支付宝安全支付">
<meta property="og:type" content="website">
<meta property="og:url" content="https://api.aizhs.top/landing">
<meta property="og:image" content="https://api.aizhs.top/landing/og.png">
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"Product","name":"IHUI-AI VIP 订阅","description":"开源 AI 商业级基座,8 端 + 339 表 + 100 模型,完整商业闭环,支付宝安全支付","brand":{"@type":"Brand","name":"IHUI-AI"},"offers":{"@type":"Offer","priceCurrency":"CNY","price":"9.90","availability":"https://schema.org/InStock","seller":{"@type":"Organization","name":"吉林省爱智汇人工智能科技有限公司"}}}
</script>
<style>
  :root {
    --bg: #ffffff;
    --bg-card: #f8f9fa;
    --bg-hover: #f1f3f5;
    --text: #1a1a1a;
    --text-muted: #6b7280;
    --border: #e5e7eb;
    --accent: #1a1a1a;
    --accent-text: #ffffff;
    --price: #1a1a1a;
    --radius: 12px;
    --radius-sm: 8px;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #0a0a0a;
      --bg-card: #141414;
      --bg-hover: #1a1a1a;
      --text: #f5f5f5;
      --text-muted: #9ca3af;
      --border: #2a2a2a;
      --accent: #f5f5f5;
      --accent-text: #0a0a0a;
      --price: #f5f5f5;
    }
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "HarmonyOS Sans SC", "Microsoft YaHei", sans-serif;
    background: var(--bg);
    color: var(--text);
    line-height: 1.6;
    min-height: 100vh;
  }
  .container { max-width: 960px; margin: 0 auto; padding: 0 24px; }

  /* Hero */
  .hero { text-align: center; padding: 64px 24px 40px; }
  .hero h1 { font-size: 32px; font-weight: 700; letter-spacing: -0.5px; margin-bottom: 12px; }
  .hero p { font-size: 16px; color: var(--text-muted); max-width: 560px; margin: 0 auto; }
  .hero .badges { margin-top: 16px; display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; }
  .hero .badge { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 4px 12px; font-size: 13px; color: var(--text-muted); }

  /* Pricing */
  .pricing { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 20px; padding: 24px 0 64px; }
  .card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 32px 28px;
    display: flex;
    flex-direction: column;
    transition: border-color 0.2s, background 0.2s;
  }
  .card:hover { border-color: var(--accent); }
  .card.featured { border-color: var(--accent); }
  .card .name { font-size: 15px; font-weight: 600; color: var(--text-muted); margin-bottom: 8px; }
  .card .price { font-size: 36px; font-weight: 700; color: var(--price); margin-bottom: 4px; }
  .card .price .unit { font-size: 16px; font-weight: 400; color: var(--text-muted); }
  .card .period { font-size: 13px; color: var(--text-muted); margin-bottom: 24px; }
  .card .benefits { list-style: none; flex: 1; margin-bottom: 24px; }
  .card .benefits li { font-size: 14px; color: var(--text); padding: 6px 0; display: flex; align-items: flex-start; gap: 8px; }
  .card .benefits li::before { content: "✓"; color: var(--accent); font-weight: 700; flex-shrink: 0; }
  .card .buy-btn {
    display: block;
    width: 100%;
    padding: 12px 20px;
    background: var(--accent);
    color: var(--accent-text);
    border: none;
    border-radius: var(--radius-sm);
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.2s;
  }
  .card .buy-btn:hover { opacity: 0.85; }
  .card .buy-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  /* Modal */
  .modal-overlay {
    display: none;
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.5);
    z-index: 100;
    align-items: center; justify-content: center;
  }
  .modal-overlay.active { display: flex; }
  .modal {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 32px;
    width: 100%; max-width: 360px;
    margin: 16px;
  }
  .modal h3 { font-size: 18px; margin-bottom: 20px; }
  .modal .field { margin-bottom: 16px; }
  .modal label { display: block; font-size: 13px; color: var(--text-muted); margin-bottom: 6px; }
  .modal input {
    width: 100%;
    padding: 10px 12px;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    font-size: 14px;
    color: var(--text);
    outline: none;
    transition: border-color 0.2s;
  }
  .modal input:focus { border-color: var(--accent); }
  .modal .actions { display: flex; gap: 12px; margin-top: 24px; }
  .modal .btn {
    flex: 1;
    padding: 10px 16px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    font-size: 14px;
    cursor: pointer;
    background: var(--bg-card);
    color: var(--text);
  }
  .modal .btn-primary { background: var(--accent); color: var(--accent-text); border-color: var(--accent); }
  .modal .error { color: #dc2626; font-size: 13px; margin-top: 8px; min-height: 18px; }

  /* Toast */
  .toast {
    position: fixed; bottom: 24px; left: 50%;
    transform: translateX(-50%);
    background: var(--accent);
    color: var(--accent-text);
    padding: 12px 24px;
    border-radius: var(--radius-sm);
    font-size: 14px;
    z-index: 200;
    opacity: 0;
    transition: opacity 0.3s;
    pointer-events: none;
  }
  .toast.show { opacity: 1; }

  /* Promo banner */
  .promo { display: inline-block; background: var(--accent); color: var(--accent-text); border-radius: var(--radius-sm); padding: 6px 14px; font-size: 13px; font-weight: 600; margin-top: 14px; }

  /* Trust bar */
  .trust-bar { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; padding: 8px 0 32px; }
  .trust-item { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 8px 14px; font-size: 13px; color: var(--text-muted); }

  /* FAQ */
  .faq { padding: 24px 0 64px; }
  .faq h2 { font-size: 22px; font-weight: 700; text-align: center; margin-bottom: 20px; letter-spacing: -0.3px; }
  .faq details { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 14px 20px; margin-bottom: 10px; transition: border-color 0.2s; }
  .faq details[open] { border-color: var(--accent); }
  .faq summary { font-size: 15px; font-weight: 600; cursor: pointer; list-style: none; display: flex; align-items: center; gap: 8px; }
  .faq summary::-webkit-details-marker { display: none; }
  .faq summary::before { content: "+"; color: var(--accent); font-weight: 700; font-size: 16px; line-height: 1; }
  .faq details[open] summary::before { content: "−"; }
  .faq details p { font-size: 14px; color: var(--text-muted); margin-top: 10px; }

  footer { text-align: center; padding: 32px 24px; font-size: 13px; color: var(--text-muted); border-top: 1px solid var(--border); }
</style>
</head>
<body>
  <section class="hero">
    <div class="container">
      <h1>IHUI-AI 开源 AI 商业级基座</h1>
      <div class="promo">🎉 限时优惠:前 100 名用户享 8 折,售完恢复原价</div>
      <p>Apache 2.0 商用 · 8 端 + 339 表 + 100 模型 + 完整商业闭环 · 3 年省 $35,000</p>
      <div class="badges">
        <span class="badge">8 端 Monorepo</span>
        <span class="badge">14 平台发布</span>
        <span class="badge">AI 教育全栈</span>
        <span class="badge">完整计费系统</span>
      </div>
    </div>
  </section>

  <section class="container">
    <div class="trust-bar">
      <span class="trust-item">🔒 支付宝安全支付</span>
      <span class="trust-item">执照 吉林省爱智汇人工智能科技有限公司</span>
      <span class="trust-item">📖 Apache 2.0 开源协议</span>
      <span class="trust-item">👥 5000+ 开发者选择</span>
    </div>
  </section>

  <section class="container">
    <div class="pricing" id="pricing"></div>
  </section>

  <section class="container">
    <div class="faq">
      <h2>常见问题</h2>
      <details><summary>支付后多久生效?</summary><p>支付成功后自动激活 VIP,立即生效,无需等待</p></details>
      <details><summary>支持退款吗?</summary><p>VIP 订阅为虚拟商品,支付后不支持退款,请确认后再购买</p></details>
      <details><summary>可以用微信支付吗?</summary><p>目前正在接入微信支付,当前支持支付宝扫码支付</p></details>
      <details><summary>VIP 权益会变吗?</summary><p>我们持续迭代 VIP 权益,已购用户享有新增权益,不会减少</p></details>
      <details><summary>发票怎么开?</summary><p>支付后联系客服 502319984@qq.com 开具电子发票</p></details>
    </div>
  </section>

  <div class="modal-overlay" id="loginModal">
    <div class="modal">
      <h3>登录后购买</h3>
      <div class="field">
        <label>账号(用户名 / 邮箱 / 手机号)</label>
        <input type="text" id="account" placeholder="admin 或 502319984@qq.com">
      </div>
      <div class="field">
        <label>密码</label>
        <input type="password" id="password" placeholder="你的密码">
      </div>
      <div class="error" id="loginError"></div>
      <div class="actions">
        <button class="btn" onclick="closeModal()">取消</button>
        <button class="btn btn-primary" id="loginBtn" onclick="doLogin()">登录</button>
      </div>
    </div>
  </div>

  <div class="toast" id="toast"></div>

  <footer>
    <div class="container">
      © 2026 IHUI-AI · 吉林省爱智汇人工智能科技有限公司 · 支付宝安全支付
    </div>
  </footer>

<script>
  let pendingProduct = null;

  async function loadProducts() {
    try {
      const resp = await fetch('/api/vip/levels');
      const json = await resp.json();
      const items = (json.data && json.data.items) || [];
      const container = document.getElementById('pricing');
      container.innerHTML = items.map((item, i) => {
        const priceYuan = (item.price / 100).toFixed(2);
        const period = item.durationDays >= 36500 ? '永久有效' : item.durationDays + ' 天';
        const benefits = (item.benefits || []).map(b => '<li>' + benefitLabel(b) + '</li>').join('');
        return '<div class="card' + (i === 1 ? ' featured' : '') + '">' +
          '<div class="name">' + item.levelName + '</div>' +
          '<div class="price">¥' + priceYuan + '<span class="unit"> / ' + period + '</span></div>' +
          '<div class="period">一次购买,支付宝安全支付</div>' +
          '<ul class="benefits">' + benefits + '</ul>' +
          '<button class="buy-btn" onclick="buy(\\''+item.id+'\\', \\''+priceYuan+'\\', \\''+item.levelName+'\\')">立即购买</button>' +
        '</div>';
      }).join('');
    } catch (e) { document.getElementById('pricing').innerHTML = '<p style="color:var(--text-muted)">加载套餐失败,请刷新重试</p>'; }
  }

  function benefitLabel(key) {
    const map = {
      unlimitedChat: '无限 AI 对话',
      exclusiveModel: '独享高级模型',
      prioritySupport: '优先客服支持',
      referral: '推荐返佣资格',
      lifetime: '终身权益',
      distributionQualification: '分销资格',
      aiCourses: 'AI 课程访问',
      founderQa: '创始人问答',
      agentBeta: 'Agent 内测',
      vipMaxDiscount: 'VIP 最大折扣',
      customAgentDiscount: '定制 Agent 折扣',
      allVipRights: '全部 VIP 权益',
      verticalAccountIncubation: '垂直账号孵化',
      secondaryDistribution: '二级分销',
      offlineLearning: '线下学习'
    };
    return map[key] || key;
  }

  function buy(productId, amount, name) {
    const token = localStorage.getItem('ihui_token');
    if (!token) {
      pendingProduct = { productId, amount, name };
      document.getElementById('loginModal').classList.add('active');
      document.getElementById('account').focus();
      return;
    }
    createOrder(productId, amount, name, token);
  }

  function closeModal() {
    document.getElementById('loginModal').classList.remove('active');
    document.getElementById('loginError').textContent = '';
  }

  async function doLogin() {
    const account = document.getElementById('account').value.trim();
    const password = document.getElementById('password').value;
    if (!account || !password) { document.getElementById('loginError').textContent = '请填写账号和密码'; return; }
    const btn = document.getElementById('loginBtn');
    btn.disabled = true; btn.textContent = '登录中...';
    try {
      const resp = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account, password })
      });
      const json = await resp.json();
      if (json.code === 0 && json.data && json.data.accessToken) {
        localStorage.setItem('ihui_token', json.data.accessToken);
        closeModal();
        showToast('登录成功,正在创建订单...');
        if (pendingProduct) {
          const p = pendingProduct; pendingProduct = null;
          createOrder(p.productId, p.amount, p.name, json.data.accessToken);
        }
      } else {
        document.getElementById('loginError').textContent = json.message || '登录失败,请检查账号密码';
      }
    } catch (e) {
      document.getElementById('loginError').textContent = '网络错误,请重试';
    }
    btn.disabled = false; btn.textContent = '登录';
  }

  async function createOrder(productId, amount, name, token) {
    showToast('正在创建支付订单...');
    try {
      const resp = await fetch('/api/payments/alipay/create?amount=' + amount + '&orderType=2&productId=' + productId + '&subject=' + encodeURIComponent('IHUI-AI ' + name), {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token }
      });
      // 401: token 过期/无效,清除并弹登录框让用户重新登录
      if (resp.status === 401) {
        localStorage.removeItem('ihui_token');
        pendingProduct = { productId, amount, name };
        document.getElementById('loginModal').classList.add('active');
        document.getElementById('account').focus();
        showToast('登录已过期,请重新登录');
        return;
      }
      const json = await resp.json();
      if (json.code === 0 && json.data && json.data.payUrl) {
        showToast('正在跳转支付宝...');
        window.location.href = json.data.payUrl;
      } else if (json.code === 0 && json.data && json.data.mock) {
        showToast('当前为测试模式,支付功能已就绪');
      } else {
        showToast(json.message || '创建订单失败');
      }
    } catch (e) {
      showToast('网络错误,请重试');
    }
  }

  function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
  }

  document.getElementById('password').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  loadProducts();
</script>
</body>
</html>`
