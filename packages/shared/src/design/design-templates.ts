/**
 * Design 模式模板库(P2-a,2026-07-24 立)。
 *
 * 8 个行业模板:blank / landing / dashboard / login / blog / product / pricing / profile。
 * HTML 为 body 片段(无 <html>/<head>/<body> 包裹),注入 iframe srcDoc 由 buildSrcDoc 拼接。
 * 遵循 AGENTS.md §4:无 rounded-full / 9999px / 50% 圆角,无分割线,无渐变遮罩。
 */
export type DesignTemplateCategory = 'blank' | 'marketing' | 'app' | 'content' | 'commerce'

export interface DesignTemplate {
  id: string
  nameKey: string
  descriptionKey: string
  category: DesignTemplateCategory
  html: string
}

const BLANK_HTML = `<div id="root" style="padding:24px;font-family:sans-serif">
  <h1>Start Here</h1>
  <p>Edit this template to begin.</p>
</div>`

const LANDING_HTML = `<div id="root" style="font-family:sans-serif">
  <section id="hero" style="padding:48px 24px;text-align:center">
    <h1 style="font-size:36px;margin:0 0 12px">Welcome to Your Product</h1>
    <p style="font-size:16px;color:#666;margin:0 0 24px">A short tagline describing your value proposition.</p>
    <button id="cta" style="padding:10px 24px;background:#000;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px">Get Started</button>
  </section>
  <section id="features" style="display:flex;gap:16px;padding:24px">
    <div style="flex:1;padding:16px;border:1px solid #eee;border-radius:8px">
      <h3 style="margin:0 0 8px">Feature One</h3>
      <p style="margin:0;color:#666;font-size:13px">Describe the first feature.</p>
    </div>
    <div style="flex:1;padding:16px;border:1px solid #eee;border-radius:8px">
      <h3 style="margin:0 0 8px">Feature Two</h3>
      <p style="margin:0;color:#666;font-size:13px">Describe the second feature.</p>
    </div>
    <div style="flex:1;padding:16px;border:1px solid #eee;border-radius:8px">
      <h3 style="margin:0 0 8px">Feature Three</h3>
      <p style="margin:0;color:#666;font-size:13px">Describe the third feature.</p>
    </div>
  </section>
</div>`

const DASHBOARD_HTML = `<div id="root" style="display:flex;min-height:100vh;font-family:sans-serif">
  <aside id="sidebar" style="width:200px;padding:16px;border-right:1px solid #eee">
    <h3 style="margin:0 0 12px;font-size:14px">Menu</h3>
    <div style="padding:6px 0;font-size:13px;color:#444">Dashboard</div>
    <div style="padding:6px 0;font-size:13px;color:#444">Analytics</div>
    <div style="padding:6px 0;font-size:13px;color:#444">Settings</div>
  </aside>
  <main id="main" style="flex:1;padding:16px">
    <header id="topbar" style="margin-bottom:16px">
      <h2 style="margin:0;font-size:18px">Dashboard</h2>
    </header>
    <div id="cards" style="display:flex;gap:16px">
      <div style="flex:1;padding:16px;border:1px solid #eee;border-radius:8px">
        <p style="margin:0 0 4px;color:#666;font-size:12px">Users</p>
        <h3 style="margin:0;font-size:22px">1,234</h3>
      </div>
      <div style="flex:1;padding:16px;border:1px solid #eee;border-radius:8px">
        <p style="margin:0 0 4px;color:#666;font-size:12px">Revenue</p>
        <h3 style="margin:0;font-size:22px">$5,678</h3>
      </div>
      <div style="flex:1;padding:16px;border:1px solid #eee;border-radius:8px">
        <p style="margin:0 0 4px;color:#666;font-size:12px">Orders</p>
        <h3 style="margin:0;font-size:22px">892</h3>
      </div>
    </div>
  </main>
</div>`

const LOGIN_HTML = `<div id="root" style="display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif">
  <div id="card" style="width:320px;padding:32px;border:1px solid #eee;border-radius:8px">
    <h2 style="margin:0 0 16px;text-align:center;font-size:20px">Login</h2>
    <input id="email" placeholder="Email" style="width:100%;padding:8px;margin-bottom:12px;border:1px solid #ccc;border-radius:4px;box-sizing:border-box;font-size:13px" />
    <input id="password" type="password" placeholder="Password" style="width:100%;padding:8px;margin-bottom:16px;border:1px solid #ccc;border-radius:4px;box-sizing:border-box;font-size:13px" />
    <button id="submit" style="width:100%;padding:10px;background:#000;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:14px">Sign In</button>
  </div>
</div>`

const BLOG_HTML = `<div id="root" style="display:flex;gap:24px;padding:24px;font-family:sans-serif;max-width:960px;margin:0 auto">
  <article id="post" style="flex:1">
    <h1 style="margin:0 0 8px;font-size:26px">Blog Title</h1>
    <p style="color:#666;margin:0 0 16px;font-size:13px">By Author · 2026-07-24</p>
    <p style="line-height:1.6;color:#333">Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>
    <p style="line-height:1.6;color:#333">Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</p>
  </article>
  <aside id="sidebar" style="width:200px;padding:16px;border:1px solid #eee;border-radius:8px;align-self:flex-start">
    <h3 style="margin:0 0 8px;font-size:14px">Recent Posts</h3>
    <div style="padding:4px 0;font-size:12px;color:#444">Post One</div>
    <div style="padding:4px 0;font-size:12px;color:#444">Post Two</div>
    <div style="padding:4px 0;font-size:12px;color:#444">Post Three</div>
  </aside>
</div>`

const PRODUCT_HTML = `<div id="root" style="display:flex;gap:24px;padding:24px;font-family:sans-serif;max-width:960px;margin:0 auto">
  <div id="gallery" style="flex:1;background:#f5f5f5;border-radius:8px;min-height:320px;display:flex;align-items:center;justify-content:center;color:#999;font-size:14px">Image</div>
  <div id="details" style="flex:1;display:flex;flex-direction:column;gap:12px">
    <h1 style="margin:0;font-size:24px">Product Name</h1>
    <p id="price" style="font-size:28px;color:#000;margin:0">$99.00</p>
    <p style="color:#444;line-height:1.6;margin:0">Product description goes here. Highlight key benefits and specifications for the buyer.</p>
    <button id="buy" style="padding:12px 24px;background:#000;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px;align-self:flex-start">Buy Now</button>
  </div>
</div>`

const PRICING_HTML = `<div id="root" style="padding:24px;font-family:sans-serif">
  <h2 id="title" style="text-align:center;font-size:24px;margin:0 0 24px">Pricing</h2>
  <div id="plans" style="display:flex;gap:16px">
    <div id="starter" style="flex:1;padding:24px;border:1px solid #eee;border-radius:8px">
      <h3 style="margin:0 0 8px">Starter</h3>
      <p style="font-size:32px;margin:0 0 12px">$9</p>
      <ul style="list-style:none;padding:0;margin:0 0 16px;font-size:13px;color:#444;line-height:1.8">
        <li>Feature A</li>
        <li>Feature B</li>
      </ul>
      <button style="width:100%;padding:8px;border:1px solid #000;background:transparent;border-radius:4px;cursor:pointer;font-size:13px">Choose</button>
    </div>
    <div id="pro" style="flex:1;padding:24px;border:2px solid #000;border-radius:8px">
      <h3 style="margin:0 0 8px">Pro</h3>
      <p style="font-size:32px;margin:0 0 12px">$29</p>
      <ul style="list-style:none;padding:0;margin:0 0 16px;font-size:13px;color:#444;line-height:1.8">
        <li>Feature A</li>
        <li>Feature B</li>
        <li>Feature C</li>
      </ul>
      <button style="width:100%;padding:8px;background:#000;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:13px">Choose</button>
    </div>
    <div id="team" style="flex:1;padding:24px;border:1px solid #eee;border-radius:8px">
      <h3 style="margin:0 0 8px">Team</h3>
      <p style="font-size:32px;margin:0 0 12px">$99</p>
      <ul style="list-style:none;padding:0;margin:0 0 16px;font-size:13px;color:#444;line-height:1.8">
        <li>Feature A</li>
        <li>Feature B</li>
        <li>Feature D</li>
      </ul>
      <button style="width:100%;padding:8px;border:1px solid #000;background:transparent;border-radius:4px;cursor:pointer;font-size:13px">Choose</button>
    </div>
  </div>
</div>`

const PROFILE_HTML = `<div id="root" style="display:flex;flex-direction:column;align-items:center;padding:24px;font-family:sans-serif">
  <div id="avatar" style="width:96px;height:96px;background:#ddd;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#666;font-size:36px;font-weight:600">A</div>
  <h2 id="name" style="margin:16px 0 4px;font-size:22px">John Doe</h2>
  <p id="role" style="color:#666;margin:0 0 16px;font-size:14px">Software Engineer</p>
  <p id="bio" style="text-align:center;max-width:400px;color:#444;line-height:1.6;margin:0 0 16px">Building products with code and coffee. Passionate about open source and developer tools.</p>
  <div id="social" style="display:flex;gap:12px">
    <button style="padding:6px 16px;border:1px solid #ccc;border-radius:4px;background:transparent;cursor:pointer;font-size:12px">Twitter</button>
    <button style="padding:6px 16px;border:1px solid #ccc;border-radius:4px;background:transparent;cursor:pointer;font-size:12px">GitHub</button>
    <button style="padding:6px 16px;border:1px solid #ccc;border-radius:4px;background:transparent;cursor:pointer;font-size:12px">LinkedIn</button>
  </div>
</div>`

export const DESIGN_TEMPLATES: DesignTemplate[] = [
  {
    id: 'blank',
    nameKey: 'design.templates.blank',
    descriptionKey: 'design.templates.blankDesc',
    category: 'blank',
    html: BLANK_HTML,
  },
  {
    id: 'landing',
    nameKey: 'design.templates.landing',
    descriptionKey: 'design.templates.landingDesc',
    category: 'marketing',
    html: LANDING_HTML,
  },
  {
    id: 'dashboard',
    nameKey: 'design.templates.dashboard',
    descriptionKey: 'design.templates.dashboardDesc',
    category: 'app',
    html: DASHBOARD_HTML,
  },
  {
    id: 'login',
    nameKey: 'design.templates.login',
    descriptionKey: 'design.templates.loginDesc',
    category: 'app',
    html: LOGIN_HTML,
  },
  {
    id: 'blog',
    nameKey: 'design.templates.blog',
    descriptionKey: 'design.templates.blogDesc',
    category: 'content',
    html: BLOG_HTML,
  },
  {
    id: 'product',
    nameKey: 'design.templates.product',
    descriptionKey: 'design.templates.productDesc',
    category: 'commerce',
    html: PRODUCT_HTML,
  },
  {
    id: 'pricing',
    nameKey: 'design.templates.pricing',
    descriptionKey: 'design.templates.pricingDesc',
    category: 'commerce',
    html: PRICING_HTML,
  },
  {
    id: 'profile',
    nameKey: 'design.templates.profile',
    descriptionKey: 'design.templates.profileDesc',
    category: 'content',
    html: PROFILE_HTML,
  },
]

export function getTemplateById(id: string): DesignTemplate | undefined {
  return DESIGN_TEMPLATES.find((t) => t.id === id)
}
