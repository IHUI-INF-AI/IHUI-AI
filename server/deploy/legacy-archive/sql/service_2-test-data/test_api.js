const http = require('http');

// 测试推荐课程列表API
const options = {
  hostname: '127.0.0.1',
  port: 6607,
  path: '/learn/public-api/lesson/recommend/list?current=1&size=5',
  method: 'GET',
  headers: {
    'Content-Type': 'application/json'
  }
};

console.log('测试 API: http://127.0.0.1:6600/learn/public-api/lesson/recommend/list');

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
      
      if (json.data && json.data.records) {
        console.log(`\n找到 ${json.data.records.length} 个课程:\n`);
        json.data.records.forEach((lesson, index) => {
          console.log(`${index + 1}. ${lesson.name}`);
          console.log(`   ID: ${lesson.id}`);
          console.log(`   学习人数 (learnNum): ${lesson.learnNum || 0}`);
          console.log(`   报名人数 (signUpNum): ${lesson.signUpNum || 0}`);
          console.log('');
        });
      } else {
        console.log(JSON.stringify(json, null, 2));
      }
    } catch (e) {
      console.log('原始响应:', data);
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
