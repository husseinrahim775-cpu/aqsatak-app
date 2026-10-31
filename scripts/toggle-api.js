const fs = require('fs');
const path = require('path');

const apiPath = path.join(__dirname, '../app/api');
const tempPath = path.join(__dirname, '../_api_temp');

const action = process.argv[2];

if (action === 'hide' && fs.existsSync(apiPath)) {
  fs.renameSync(apiPath, tempPath);
  console.log('📦 API folder hidden for static export');
} else if (action === 'restore' && fs.existsSync(tempPath)) {
  fs.renameSync(tempPath, apiPath);
  console.log('✅ API folder restored');
}