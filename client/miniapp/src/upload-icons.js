const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const readdir = promisify(fs.readdir);
const readFile = promisify(fs.readFile);

async function uploadIcons() {
  try {
    // 读取图标目录
    const iconsDir = path.join(__dirname, 'static/tabbar');
    const files = await readdir(iconsDir);
    
    // 过滤出PNG文件
    const pngFiles = files.filter(file => file.endsWith('.png'));
    
    // 上传每个图标
    for (const file of pngFiles) {
      const filePath = path.join(iconsDir, file);
      
      // 使用uniCloud上传
      const result = await uniCloud.uploadFile({
        filePath: filePath,
        cloudPath: `tabbar/${file}`
      });
      
    }
    
  } catch (error) {
  }
}

// 执行上传
uploadIcons(); 