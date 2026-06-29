const mysql = require('mysql2/promise');

async function insertMockData() {
  const connection = await mysql.createConnection({
    host: '47.94.40.108',
    port: 3306,
    user: 'Raindrop_L',
    password: 'Raindrop_L250604',
    database: 'cloud_learning_content'
  });

  console.log('数据库连接成功！');

  try {
    // 1. 查询已发布的课程
    const [lessons] = await connection.execute(
      "SELECT id, name FROM t_lesson WHERE status = 'published'"
    );
    console.log(`找到 ${lessons.length} 个已发布课程`);

    if (lessons.length === 0) {
      console.log('没有已发布的课程，退出');
      return;
    }

    // 2. 确保有会员数据
    console.log('检查并创建模拟会员...');
    for (let i = 1; i <= 30; i++) {
      try {
        await connection.execute(
          `INSERT IGNORE INTO t_member (id, name, phone, status, create_time, update_time) 
           VALUES (?, ?, ?, 'active', NOW(), NOW())`,
          [i, `用户${i}`, `1380000${String(i).padStart(4, '0')}`]
        );
      } catch (e) {
        // 忽略插入错误（可能是字段不存在等）
      }
    }

    // 3. 为每个课程插入报名数据
    console.log('开始插入报名数据...');
    let totalInserted = 0;

    for (const lesson of lessons) {
      // 每个课程随机生成 50-300 个报名记录
      const signupCount = 50 + Math.floor(Math.random() * 251);
      
      for (let i = 0; i < signupCount; i++) {
        const memberId = 1 + Math.floor(Math.random() * 30);
        const status = Math.random() < 0.85 ? 'sign_up' : (Math.random() < 0.9 ? 'completed' : 'cancel_sign_up');
        const daysAgo = Math.floor(Math.random() * 90);
        
        try {
          await connection.execute(
            `INSERT IGNORE INTO t_sign_up (member_id, lesson_id, status, create_time, update_time) 
             VALUES (?, ?, ?, DATE_SUB(NOW(), INTERVAL ? DAY), NOW())`,
            [memberId, lesson.id, status, daysAgo]
          );
          totalInserted++;
        } catch (e) {
          // 忽略重复键错误
        }
      }
      console.log(`课程 "${lesson.name}" (ID: ${lesson.id}) 已处理`);
    }

    console.log(`\n总共插入 ${totalInserted} 条报名记录`);

    // 4. 验证结果
    const [result] = await connection.execute(`
      SELECT 
        l.id AS lesson_id,
        l.name AS lesson_name,
        COUNT(DISTINCT s.member_id) AS signup_count
      FROM t_lesson l
      LEFT JOIN t_sign_up s ON l.id = s.lesson_id
      WHERE l.status = 'published'
      GROUP BY l.id, l.name
      ORDER BY signup_count DESC
      LIMIT 10
    `);

    console.log('\n前10个课程的报名人数:');
    console.table(result);

  } finally {
    await connection.end();
    console.log('\n数据库连接已关闭');
  }
}

insertMockData().catch(console.error);
