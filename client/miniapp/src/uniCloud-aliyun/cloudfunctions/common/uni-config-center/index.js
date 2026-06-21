'use strict';

const fs = require('fs');
const path = require('path');

// 获取配置文件路径
function getConfigFilePath(fileName) {
  const configPath = path.resolve(__dirname, fileName);
  return configPath;
}

// 获取配置内容
function getConfig(fileName) {
  const configPath = getConfigFilePath(fileName);
  try {
    // 检查文件是否存在
    if (!fs.existsSync(configPath)) {
      console.error(`配置文件 ${fileName} 不存在`);
      return {};
    }
    
    const config = require(configPath);
    return config;
  } catch (error) {
    console.error(`读取配置文件 ${fileName} 失败:`, error);
    return {};
  }
}

class Config {
  constructor() {
    this.config = {};
    
    // 初始化配置
    this.initConfig();
  }
  
  // 初始化配置
  initConfig() {
    // 尝试加载 config.json
    const commonConfig = getConfig('config.json');
    
    // 加载 uni-id 配置
    const uniIdConfig = getConfig('uni-id/config.json');
    
    // 合并配置
    this.config = Object.assign({}, commonConfig, {
      'uni-id': uniIdConfig['uni-id'] || {}
    });
  }
  
  // 获取配置
  value(name, defaultValue) {
    if (!name) {
      // 返回完整配置
      return this.config;
    }
    
    // 支持点语法获取配置
    const keys = name.split('.');
    let result = this.config;
    
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      result = result[key];
      
      if (result === undefined || result === null) {
        return defaultValue;
      }
    }
    
    return result;
  }
}

// 导出配置实例
module.exports = new Config(); 