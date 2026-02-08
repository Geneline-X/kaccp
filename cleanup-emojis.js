const fs = require('fs');
const path = require('path');

const messagesDir = path.join(process.cwd(), 'src', 'messages');

// Emoji mappings
const emojiMap = {
  '🏆': '[Trophy]',
  '🎙️': '[Microphone]',
  '✏️': '[Checkmark]',
  '✍️': '[Checkmark]',
  '🤖': '[Robot]',
  '⚠️': '[Warning]',
  '⏰': '[Clock]',
  '→': '->',
};

// Process all JSON files recursively
function processDir(dir) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      processDir(fullPath);
    } else if (file.endsWith('.json')) {
      processJsonFile(fullPath);
    }
  });
}

function processJsonFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // Replace all emojis
    for (const [emoji, replacement] of Object.entries(emojiMap)) {
      if (content.includes(emoji)) {
        content = content.replaceAll(emoji, replacement);
        modified = true;
        console.log(`✓ ${path.relative(process.cwd(), filePath)}: Replaced "${emoji}" -> "${replacement}"`);
      }
    }
    
    // Write back as UTF-8 without BOM
    if (modified) {
      fs.writeFileSync(filePath, content, { encoding: 'utf8' });
    }
  } catch (error) {
    console.error(`✗ Error processing ${filePath}:`, error.message);
  }
}

console.log('Starting emoji cleanup...\n');
processDir(messagesDir);
console.log('\n✓ Emoji cleanup completed!');
