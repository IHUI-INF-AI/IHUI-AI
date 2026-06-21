/**
 * 统一前端 API 客户端
 * 封装 /api/v1/* 全部接口的请求方法
 * 包含统一错误处理、统一响应解构、JWT 自动注入
 */
(function (global) {
  'use strict';

  // 基础配置
  const DEFAULTS = {
    baseURL: '/api/v1',
    timeout: 15000,
    tokenKey: 'zhs_token',
    refreshPath: '/auth/refresh',
  };

  // 当前配置
  const CFG = Object.assign({}, DEFAULTS, global.API_CONFIG || {});

  // Token 存储器
  const TokenStore = {
    get() {
      try {
        return localStorage.getItem(CFG.tokenKey) || '';
      } catch (e) {
        return '';
      }
    },
    set(token) {
      try {
        if (token) {
          localStorage.setItem(CFG.tokenKey, token);
        } else {
          localStorage.removeItem(CFG.tokenKey);
        }
      } catch (e) {
        // 忽略
      }
    },
    clear() {
      TokenStore.set('');
    },
  };

  // 统一响应处理
  function parseResponse(payload) {
    if (payload == null) {
      return { ok: false, code: -1, msg: '空响应', data: null };
    }
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload);
      } catch (e) {
        return { ok: false, code: -1, msg: payload, data: null };
      }
    }
    const code = String(payload.code ?? payload.status ?? '200');
    const ok = code === '200' || code === 200 || code === '0';
    return {
      ok,
      code,
      msg: payload.msg || payload.message || '',
      data: payload.data ?? null,
      total: payload.total ?? 0,
      page: payload.page ?? 1,
      limit: payload.limit ?? 20,
      raw: payload,
    };
  }

  // 内部 fetch 包装
  async function request(method, path, opts) {
    opts = opts || {};
    const url = path.startsWith('http') ? path : CFG.baseURL + path;
    const headers = Object.assign(
      { 'Content-Type': 'application/json', Accept: 'application/json' },
      opts.headers || {}
    );
    const token = TokenStore.get();
    if (token && !headers.Authorization) {
      headers.Authorization = 'Bearer ' + token;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeout || CFG.timeout);
    let resp;
    try {
      resp = await fetch(url, {
        method: method.toUpperCase(),
        headers,
        body: opts.body ? JSON.stringify(opts.body) : undefined,
        signal: controller.signal,
        credentials: 'include',
      });
    } catch (e) {
      clearTimeout(timer);
      return { ok: false, code: -1, msg: '网络错误: ' + e.message, data: null };
    }
    clearTimeout(timer);

    const text = await resp.text();
    let payload;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch (e) {
      payload = text;
    }

    if (resp.status === 401) {
      TokenStore.clear();
      if (global.onUnauthorized) {
        global.onUnauthorized(payload);
      }
    }
    return parseResponse(payload);
  }

  // 快捷方法
  const api = {
    get(path, params, opts) {
      if (params && typeof params === 'object') {
        const qs = Object.keys(params)
          .filter((k) => params[k] !== undefined && params[k] !== null)
          .map((k) => encodeURIComponent(k) + '=' + encodeURIComponent(params[k]))
          .join('&');
        if (qs) {
          path += (path.indexOf('?') >= 0 ? '&' : '?') + qs;
        }
      }
      return request('GET', path, opts);
    },
    post(path, body, opts) {
      return request('POST', path, Object.assign({}, opts, { body }));
    },
    put(path, body, opts) {
      return request('PUT', path, Object.assign({}, opts, { body }));
    },
    delete(path, body, opts) {
      return request('DELETE', path, Object.assign({}, opts, { body }));
    },
    upload(path, file, extra) {
      const fd = new FormData();
      fd.append('file', file);
      Object.keys(extra || {}).forEach((k) => fd.append(k, extra[k]));
      const token = TokenStore.get();
      const headers = token ? { Authorization: 'Bearer ' + token } : {};
      return fetch(CFG.baseURL + path, {
        method: 'POST',
        body: fd,
        headers,
        credentials: 'include',
      }).then((r) => r.text()).then(parseResponse);
    },
    token: TokenStore,
    setToken: TokenStore.set,
    clearToken: TokenStore.clear,
  };

  // ============== 业务模块封装 ==============

  // 认证模块
  api.auth = {
    captcha: () => api.get('/auth/captcha'),
    login: (body) => api.post('/auth/login', body),
    logout: () => api.post('/auth/logout'),
    register: (body) => api.post('/auth/register', body),
    smsLogin: (body) => api.post('/auth/sms-login', body),
    sendSms: (body) => api.post('/auth/sms-code', body),
    me: () => api.get('/auth/me'),
    refresh: () => api.post(CFG.refreshPath),
  };

  // 用户模块
  api.user = {
    info: (uid) => api.get(uid ? '/user/' + uid : '/user/info'),
    update: (body) => api.put('/user/info', body),
    avatar: (body) => api.post('/user/avatar', body),
    list: (params) => api.get('/user/list', params),
  };

  // 钱包/支付
  api.wallet = {
    balance: () => api.get('/wallet/balance'),
    detail: (params) => api.get('/wallet/detail', params),
    recharge: (body) => api.post('/wallet/recharge', body),
    pay: (body) => api.post('/wallet/pay', body),
  };

  // 上传
  api.upload = {
    image: (file) => api.upload('/upload/image', file),
    file: (file) => api.upload('/upload/file', file),
  };

  // 课程
  api.courses = {
    list: (params) => api.get('/courses/list', params),
    detail: (id) => api.get('/courses/' + id),
    enroll: (id) => api.post('/courses/' + id + '/enroll'),
    progress: (id) => api.get('/courses/' + id + '/progress'),
  };

  // 提问/问答
  api.ask = {
    categories: () => api.get('/ask/category/public-api/list'),
    questions: (params) => api.get('/ask/question/list', params),
    questionDetail: (qid) => api.get('/ask/question/' + qid),
    answers: (params) => api.get('/ask/answer/list', params),
    ask: (body) => api.post('/ask/question', body),
    answer: (body) => api.post('/ask/answer', body),
  };

  // 圈子
  api.circle = {
    list: (params) => api.get('/circle/list', params),
    postList: (params) => api.get('/circle/post/list', params),
    detail: (id) => api.get('/circle/' + id),
    create: (body) => api.post('/circle/post', body),
    like: (id) => api.post('/circle/post/' + id + '/like'),
    comment: (id, body) => api.post('/circle/post/' + id + '/comment', body),
  };

  // 考试
  api.exam = {
    papers: (params) => api.get('/exam/paper/list', params),
    paperDetail: (id) => api.get('/exam/paper/' + id),
    questions: (params) => api.get('/exam/question/list', params),
    submit: (body) => api.post('/exam/submit', body),
    result: (id) => api.get('/exam/result/' + id),
  };

  // 直播
  api.live = {
    channels: (params) => api.get('/live/channel/list', params),
    detail: (id) => api.get('/live/channel/' + id),
    start: (body) => api.post('/live/channel/start', body),
    end: (id) => api.post('/live/channel/' + id + '/end'),
  };

  // 消息
  api.message = {
    list: (params) => api.get('/message/list', params),
    unread: () => api.get('/message/unread-count'),
    markRead: (id) => api.post('/message/' + id + '/read'),
    send: (body) => api.post('/message/send', body),
  };

  // 通知
  api.notification = {
    list: (params) => api.get('/notification/list', params),
    markRead: (id) => api.post('/notification/' + id + '/read'),
    markAllRead: () => api.post('/notification/read-all'),
  };

  // 积分
  api.point = {
    account: () => api.get('/point/account'),
    log: (params) => api.get('/point/log/list', params),
    tasks: () => api.get('/point/task/list'),
    exchange: (body) => api.post('/point/exchange', body),
  };

  // 搜索
  api.search = {
    query: (params) => api.get('/search/query', params),
    hot: () => api.get('/search/hot'),
    history: () => api.get('/search/history'),
  };

  // 排行
  api.ranking = {
    list: (params) => api.get('/ranking/list', params),
    detail: (type) => api.get('/ranking/' + type),
  };

  // AI 代理
  api.ai = {
    luyala: (body) => api.post('/luyala-proxy/chat', body),
    luyalaModels: () => api.get('/luyala-proxy/models'),
    openrouter: (body) => api.post('/openrouter-proxy/chat', body),
    openrouterModels: () => api.get('/openrouter-proxy/models'),
    doubaoEdit: (body) => api.post('/doubao-image-edit/image-edit', body),
    tongyiEdit: (body) => api.post('/tongyi-image-edit/image-edit', body),
    tongyiI2I: (body) => api.post('/tongyi-image2image/image-to-image', body),
    userChat: (body) => api.post('/user_model_chat/chat', body),
  };

  // 视频
  api.video = {
    preload: (params) => api.get('/video-preload/list', params),
    breakpointGet: (params) => api.get('/video/breakpoint/get', params),
    breakpointLoad: (body) => api.post('/video/breakpoint/load', body),
    breakpointUpdate: (body) => api.post('/video/breakpoint/update', body),
    hlsManifest: (videoId) => api.get('/video/hls/manifest/' + videoId),
    hlsPlaylist: (videoId, bitrate) => api.get('/video/hls/playlist/' + videoId + '/' + bitrate),
  };

  // 内容（CMS / 资讯 / 活动 / 反馈等）
  api.content = {
    about: () => api.get('/content/about'),
    contact: () => api.get('/content/contact'),
    contactList: (params) => api.get('/content/contact/list', params),
    banner: (params) => api.get('/content/cms/banner/list', params),
    files: (params) => api.get('/content/files/list', params),
    information: (params) => api.get('/content/information/list', params),
    activity: (params) => api.get('/content/activity/list', params),
    aigc: (params) => api.get('/content/aigc/list', params),
    feedback: (body) => api.post('/content/feedback/list', body),
  };

  // 财务
  api.finance = {
    commission: (body) => api.post('/finance/commission', body),
    commissionDetail: () => api.get('/finance/commission-detail'),
    summary: () => api.get('/finance/summary'),
    fundInfo: () => api.get('/finance/fund/getInfo'),
    balance: () => api.get('/finance/balance'),
    products: (params) => api.get('/zhs_product/list', params),
    productIdentities: (params) => api.get('/product_identity/list', params),
    withdraw: (body) => api.post('/payments/withdrawal', body),
  };

  // 资源
  api.resource = {
    home: () => api.get('/resource/home'),
    contextSave: (body) => api.post('/resource/context/save', body),
    tokenCount: (params) => api.get('/resource/token/count', params),
  };

  // 库存/股票
  api.stock = {
    analyse: (body) => api.post('/cozeZhsApi/stock/analyse', body),
  };

  // 系统管理
  api.system = {
    userList: (params) => api.get('/system/user/list', params),
    adminRoles: (params) => api.get('/system/admin/role/list', params),
    auditLog: (params) => api.get('/system/audit/operlog/list', params),
  };

  // 应用版本
  api.app = {
    versions: (params) => api.get('/app-version/list', params),
    check: (params) => api.get('/app-version/check', params),
  };

  // 智能体
  api.agent = {
    needTasks: (params) => api.get('/agent-need-task/list', params),
    uploads: (params) => api.get('/agent-upload/list', params),
    usedetail: (params) => api.get('/agent_usedetail/list', params),
    contextList: (params) => api.get('/user-agent-context/list', params),
    imageList: (params) => api.get('/user-agent-image/list', params),
  };

  // 通用
  api.common = {
    captcha: () => api.auth.captcha(),
    schedule: (params) => api.get('/schedule/list', params),
    serviceCatalog: (params) => api.get('/service-catalog/list', params),
    visitLog: (params) => api.get('/visit/log/list', params),
    behaviorLikes: (params) => api.get('/behavior/like/list', params),
    categoryDict: (params) => api.get('/category-dictionary/list', params),
  };

  // 暴露到全局
  global.api = api;
  global.zhsAPI = api;
})(window);
