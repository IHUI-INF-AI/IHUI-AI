const http = require('http');

// 测试直播频道列表API - 通过网关
const options = {
  hostname: '127.0.0.1',
  port: 6608,
  path: '/live/public-api/channel/list?current=1&size=10',
  method: 'GET',
  headers: {
    'Content-Type': 'application/json'
  }
};

console.log('测试 API: http://127.0.0.1:6600/live/public-api/channel/recommend/list');

const req = http.request(options, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      console.log('\n状态码:', res.statusCode);
      console.log('返回数据:');
      
      if (json.data && json.data.list) {
        console.log(`\n找到 ${json.data.list.length} 个直播:\n`);
        json.data.list.forEach((channel, index) => {
          console.log(`${index + 1}. ${channel.name}`);
          console.log(`   ID: ${channel.id}`);
          console.log(`   订阅人数 (subscribeNum): ${channel.subscribeNum || 0}`);
          console.log('');
        });
      } else {
        console.log(JSON.stringify(json, null, 2));
      }
    } catch (e) {
      console.log('原始响应:', data.substring(0, 500));
    }
  });
});

req.on('error', (e) => {
  console.error('请求错误:', e.message);
});

req.setTimeout(10000, () => {
  console.log('请求超时');
  req.abort();
});

req.end();
