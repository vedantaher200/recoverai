const { execSync } = require('child_process');
const fs = require('fs');

try {
  console.log('Starting dependency installation...');
  
  // Check if node_modules exists and has packages
  if (fs.existsSync('node_modules')) {
    console.log('node_modules exists, checking contents...');
    const packages = fs.readdirSync('node_modules').filter(p => !p.startsWith('.'));
    console.log('Installed packages:', packages.slice(0, 10).join(', '));
  }
  
  console.log('Running npm install...');
  execSync('npm install', { stdio: 'inherit', shell: true });
  
  console.log('Checking react-router-dom installation...');
  if (fs.existsSync('node_modules/react-router-dom')) {
    console.log('✓ react-router-dom is installed!');
  } else {
    console.log('✗ react-router-dom is NOT installed');
  }
  
  console.log('Installation complete!');
  process.exit(0);
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}
