const mysql = require('mysql2/promise');

async function insertSubscribeData() {
  const connection = await mysql.createConnection({
    host: '47.94.40.108',
    port: 3306,
    user: 'Raindrop_L',
    password: 'Raindrop_L250604',
    database: 'cloud_learning_content'
  });

  console.log('数据库连接成功！');

  try {
    // 1. 查询所有直播频道
    const [channels] = await connection.execute(
      "SELECT id, name FROM t_channel"
    );
    console.log(`找到 ${channels.length} 个直播频道`);

    if (channels.length === 0) {
      console.log('没有直播频道，退出');
      return;
    }

    // 2. 为每个直播频道插入订阅数据
    console.log('开始插入直播订阅数据...');
    let totalInserted = 0;

    for (const channel of channels) {
      // 每个直播随机生成 30-200 个订阅记录
      const subscribeCount = 30 + Math.floor(Math.random() * 171);
      
      for (let i = 0; i < subscribeCount; i++) {
        const memberId = 1 + Math.floor(Math.random() * 30);
        const daysAgo = Math.floor(Math.random() * 60);
        
        try {
          await connection.execute(
            `INSERT IGNORE INTO t_subscribe (member_id, channel_id, create_time, update_time) 
             VALUES (?, ?, DATE_SUB(NOW(), INTERVAL ? DAY), NOW())`,
            [memberId, channel.id, daysAgo]
          );
          totalInserted++;
        } catch (e) {
          // 忽略重复键错误
        }
      }
      console.log(`直播 "${channel.name}" (ID: ${channel.id}) 已处理`);
    }

    console.log(`\n总共插入 ${totalInserted} 条订阅记录`);

    // 3. 验证结果
    const [result] = await connection.execute(`
      SELECT 
        c.id AS channel_id,
        c.name AS channel_name,
        COUNT(DISTINCT s.member_id) AS subscribe_count
      FROM t_channel c
      LEFT JOIN t_subscribe s ON c.id = s.channel_id
      GROUP BY c.id, c.name
      ORDER BY subscribe_count DESC
      LIMIT 15
    `);

    console.log('\n直播订阅人数统计:');
    console.table(result);

  } finally {
    await connection.end();
    console.log('\n数据库连接已关闭');
  }
}

insertSubscribeData().catch(console.error);
