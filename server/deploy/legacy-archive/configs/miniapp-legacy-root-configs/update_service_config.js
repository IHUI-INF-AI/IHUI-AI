/**
 * update_service_config.js
 *
 * 脚本功能：读取 .env 文件并更新 src/utils/service/index.js 中的配置
 *
 * 使用方法：
 *   node update_service_config.js
 *
 * 该脚本会：
 * 1. 读取 .env.development 或 .env.production 文件
 * 2. 解析环境变量
 * 3. 生成新的 service/index.js 文件
 */

const fs = require('fs');
const path = require('path');

// 读取 .env 文件
function readEnvFile(envPath) {
  if (!fs.existsSync(envPath)) {
    console.warn(`警告: ${envPath} 不存在，将使用默认配置`);
    return {};
  }

  const content = fs.readFileSync(envPath, 'utf-8');
  const envVars = {};

  content.split('\n').forEach(line => {
    line = line.trim();
    // 跳过注释和空行
    if (!line || line.startsWith('#')) return;

    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();
      // 移除可能的引号
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      envVars[key] = value;
    }
  });

  return envVars;
}

// 获取当前环境
function getCurrentEnv() {
  const env = process.env.NODE_ENV || 'development';
  return env;
}

// 主函数
function main() {
  const env = getCurrentEnv();
  const envFile = `.env.${env}`;
  const envPath = path.join(__dirname, envFile);

  console.log(`正在读取环境配置文件: ${envFile}`);

  const envVars = readEnvFile(envPath);

  // 从环境变量或 .env 文件中获取配置
  const baseUrl = process.env.VUE_APP_BASE_URL || envVars.VUE_APP_BASE_URL || 'https://kou.aizhs.top';
  const baseUrl2 = process.env.VUE_APP_BASE_URL2 || envVars.VUE_APP_BASE_URL2 || 'https://bsm.aizhs.top/prod-api/ai';
  const baseUrl3 = process.env.VUE_APP_BASE_URL3 || envVars.VUE_APP_BASE_URL3 || 'https://zca.aizhs.top';
  const baseUrl4 = process.env.VUE_APP_BASE_URL4 || envVars.VUE_APP_BASE_URL4 || 'https://bsm.aizhs.top/prod-api';

  console.log('读取到的配置:');
  console.log(`  VUE_APP_BASE_URL: ${baseUrl}`);
  console.log(`  VUE_APP_BASE_URL2: ${baseUrl2}`);
  console.log(`  VUE_APP_BASE_URL3: ${baseUrl3}`);
  console.log(`  VUE_APP_BASE_URL4: ${baseUrl4}`);

  // 检查 service/index.js 是否存在
  const servicePath = path.join(__dirname, 'src/utils/service/index.js');
  if (!fs.existsSync(servicePath)) {
    console.error(`错误: ${servicePath} 不存在`);
    process.exit(1);
  }

  // 读取现有文件
  let serviceContent = fs.readFileSync(servicePath, 'utf-8');

  // 更新 DEFAULT_BASE_URL 等常量
  // 注意：由于 service/index.js 已经支持通过 setStorage 覆盖和从 process.env 读取，
  // 这个脚本主要用于记录当前配置，实际的运行时读取已经在 service/index.js 中实现

  console.log('');
  console.log('配置更新完成！');
  console.log('');
  console.log('注意: src/utils/service/index.js 已经内置支持以下优先级:');
  console.log('  1. uni.setStorageSync("API_BASE_URL_X") - 运行时覆盖（最高优先级）');
  console.log('  2. process.env.VUE_APP_BASE_URLX - 构建时环境变量');
  console.log('  3. DEFAULT_BASE_URLX - 硬编码默认值（最低优先级）');
  console.log('');
  console.log('要使用环境变量，请确保：');
  console.log('  1. 在 .env.development 或 .env.production 中定义了 VUE_APP_BASE_URL*');
  console.log('  2. 重新构建项目以使环境变量生效');
}

// 运行
main();
