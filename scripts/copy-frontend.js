const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'frontend', 'dist');
const target = path.join(root, 'backend', 'public');

fs.rmSync(target, { recursive: true, force: true });
fs.mkdirSync(target, { recursive: true });
fs.cpSync(source, target, { recursive: true });
console.log(`Copied ${source} to ${target}`);
