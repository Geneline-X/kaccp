#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const messagesDir = path.join(__dirname, 'src', 'messages');

const emojiMap = {
  '🏆': '[Trophy]',
  '🎙️': '[Microphone]',
  '✏️': '[Checkmark]',
  '✍️': '[Checkmark]',
  '🤖': '[Robot]',
  '⚠️': '[Warning]',
  '⏰': '[Clock]',
  '⏳': '[Processing]',
  '→': '->',
};

function processDir(dir) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      processDir(fullPath);
    } else if (file.endsWith('.json')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let modified = false;
      
      for (const [emoji, replacement] of Object.entries(emojiMap)) {
        if (content.includes(emoji)) {
          content = content.replaceAll(emoji, replacement);
          modified = true;
          console.log(`✓ ${path.relative(process.cwd(), fullPath)}: Replaced "${emoji}"`);
        }
      }
      
      if (modified) {
        fs.writeFileSync(fullPath, content, 'utf8');
      }
    }
  });
}

console.log('🧹 Starting emoji cleanup...\n');
processDir(messagesDir);
console.log('\n✓ Emoji cleanup completed!');
