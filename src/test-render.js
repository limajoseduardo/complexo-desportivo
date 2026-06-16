const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'components/Dashboards.tsx');
let content = fs.readFileSync(file, 'utf8');

const regex = /\{([a-zA-Z0-9_\.\?\!]+)\}/g;
let matches;
let unique = new Set();
while ((matches = regex.exec(content)) !== null) {
  unique.add(matches[1]);
}
console.log(Array.from(unique).sort());
