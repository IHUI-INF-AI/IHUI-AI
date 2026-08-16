const fs = require('fs');
const path = require('path');

const dir = 'g:\\IHUI-AI\\packages\\i18n\\messages\\web';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));

files.forEach(file => {
  const filePath = path.join(dir, file);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  
  // Find all chat objects
  function findChatObjects(obj, objPath = '') {
    let results = [];
    if (obj && typeof obj === 'object') {
      if (obj.chat !== undefined && typeof obj.chat === 'object' && obj.chat !== null) {
        results.push({ path: objPath ? objPath + '.chat' : 'chat', obj: obj.chat });
      }
      for (const [key, value] of Object.entries(obj)) {
        if (key !== 'chat' && typeof value === 'object' && value !== null) {
          results = results.concat(findChatObjects(value, objPath ? objPath + '.' + key : key));
        }
      }
    }
    return results;
  }
  
  const chatObjects = findChatObjects(data);
  console.log(`\n=== ${file} ===`);
  chatObjects.forEach((chat, idx) => {
    const hasJumpToLatest = 'jumpToLatest' in chat.obj;
    const hasLatest = 'latest' in chat.obj;
    console.log(`chat[${idx}] (${chat.path}):`);
    console.log(`  jumpToLatest: ${hasJumpToLatest} (${chat.obj.jumpToLatest || 'N/A'})`);
    console.log(`  latest: ${hasLatest} (${chat.obj.latest || 'N/A'})`);
  });
});
