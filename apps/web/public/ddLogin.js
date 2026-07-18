/**
 * 钉钉扫码登录 iframe 注入器
 * 等价自历史项目 code/edu/web/web/public/ddLogin.js
 */
(function () {
  var DD_LOGIN_URL = 'https://login.dingtalk.com/login/qrcode.htm';
  var gotoUrl = '';
  var width = 300;
  var height = 300;

  function init(options) {
    if (options.gotoUrl) gotoUrl = options.gotoUrl;
    if (options.width) width = options.width;
    if (options.height) height = options.height;
    render();
  }

  function render() {
    var container = document.getElementById('dd-login-container');
    if (!container) return;
    var iframe = document.createElement('iframe');
    iframe.src = DD_LOGIN_URL + '?goto=' + encodeURIComponent(gotoUrl) + '&width=' + width + '&height=' + height;
    iframe.width = width;
    iframe.height = height;
    iframe.frameBorder = '0';
    iframe.scrolling = 'no';
    container.innerHTML = '';
    container.appendChild(iframe);
  }

  function handleMessage(event) {
    if (event.origin !== 'https://login.dingtalk.com') return;
    var loginTmpCode = event.data;
    var redirectUri = encodeURIComponent(gotoUrl + '&loginTmpCode=' + loginTmpCode);
    window.location.href = 'https://oa.dingtalk.com/login/login.htm?loginRedirect=' + redirectUri;
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('message', handleMessage);
    window.DDLogin = { init: init };
  }
})();
