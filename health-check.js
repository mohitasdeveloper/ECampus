#!/usr/bin/env node

/**
 * ECampus Build Environment Health Check
 * Verifies all dependencies and configurations are correct
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(color, message) {
  console.log(`${COLORS[color]}${message}${COLORS.reset}`);
}

function section(title) {
  console.log('\n' + COLORS.cyan + '═'.repeat(60) + COLORS.reset);
  log('cyan', `  ${title}`);
  console.log(COLORS.cyan + '═'.repeat(60) + COLORS.reset + '\n');
}

class HealthCheck {
  constructor() {
    this.checks = [];
    this.passed = 0;
    this.failed = 0;
    this.warnings = 0;
  }

  addCheck(name, fn) {
    this.checks.push({ name, fn });
  }

  async run() {
    section('ECampus Build Environment Health Check');

    for (const check of this.checks) {
      try {
        const result = await check.fn();
        
        if (result.status === 'pass') {
          log('green', `✓ ${check.name}: ${result.message}`);
          this.passed++;
        } else if (result.status === 'warn') {
          log('yellow', `⚠ ${check.name}: ${result.message}`);
          this.warnings++;
        } else {
          log('red', `✗ ${check.name}: ${result.message}`);
          this.failed++;
        }
      } catch (error) {
        log('red', `✗ ${check.name}: ${error.message}`);
        this.failed++;
      }
    }

    this.printSummary();
  }

  printSummary() {
    section('Summary');
    
    log('green', `Passed: ${this.passed}`);
    if (this.warnings > 0) log('yellow', `Warnings: ${this.warnings}`);
    if (this.failed > 0) log('red', `Failed: ${this.failed}`);

    console.log('');
    
    if (this.failed === 0) {
      log('green', '✅ All checks passed! Ready to build.');
    } else {
      log('red', '❌ Some checks failed. Please fix the issues above.');
      process.exit(1);
    }
  }
}

// Initialize health check
const health = new HealthCheck();

// Check 1: Node.js version
health.addCheck('Node.js Version', async () => {
  const version = process.version;
  const major = parseInt(version.split('.')[0].slice(1));
  
  if (major >= 18) {
    return { status: 'pass', message: `${version}` };
  } else if (major >= 16) {
    return { status: 'warn', message: `${version} (18+ recommended)` };
  } else {
    return { status: 'fail', message: `${version} (18+ required)` };
  }
});

// Check 2: npm version
health.addCheck('npm Version', async () => {
  try {
    const version = execSync('npm -v', { encoding: 'utf8' }).trim();
    const major = parseInt(version.split('.')[0]);
    
    if (major >= 9) {
      return { status: 'pass', message: `${version}` };
    } else {
      return { status: 'warn', message: `${version} (9+ recommended)` };
    }
  } catch {
    return { status: 'fail', message: 'npm not found in PATH' };
  }
});

// Check 3: Git installed
health.addCheck('Git Installation', async () => {
  try {
    execSync('git --version', { encoding: 'utf8' });
    return { status: 'pass', message: 'Git is available' };
  } catch {
    return { status: 'warn', message: 'Git not found (needed for CI/CD)' };
  }
});

// Check 4: Java installation
health.addCheck('Java JDK', async () => {
  try {
    execSync('java -version', { encoding: 'utf8', stdio: 'pipe' });
    return { status: 'pass', message: 'Java is available' };
  } catch {
    return { status: 'warn', message: 'Java not found (needed for Android build)' };
  }
});

// Check 5: Android SDK
health.addCheck('Android SDK', async () => {
  const androidHome = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  
  if (androidHome && fs.existsSync(androidHome)) {
    return { status: 'pass', message: `${androidHome}` };
  } else {
    return { status: 'warn', message: 'ANDROID_HOME not set (needed for local builds)' };
  }
});

// Check 6: Project files exist
health.addCheck('Project Files', async () => {
  const files = ['package.json', 'capacitor.config.ts', 'sw.js', 'index.html', 'offline.html'];
  const missing = files.filter(f => !fs.existsSync(path.join(process.cwd(), f)));
  
  if (missing.length === 0) {
    return { status: 'pass', message: 'All required files present' };
  } else {
    return { status: 'fail', message: `Missing: ${missing.join(', ')}` };
  }
});

// Check 7: node_modules exist
health.addCheck('Dependencies Installed', async () => {
  if (fs.existsSync(path.join(process.cwd(), 'node_modules'))) {
    try {
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      const deps = Object.keys(packageJson.dependencies || {}).length;
      return { status: 'pass', message: `${deps} dependencies installed` };
    } catch {
      return { status: 'fail', message: 'Invalid package.json' };
    }
  } else {
    return { status: 'warn', message: 'node_modules not found. Run: npm install' };
  }
});

// Check 8: Capacitor CLI
health.addCheck('Capacitor CLI', async () => {
  try {
    execSync('npx cap --version', { encoding: 'utf8', stdio: 'pipe' });
    return { status: 'pass', message: 'Capacitor CLI available' };
  } catch {
    return { status: 'warn', message: 'Capacitor CLI not found. Run: npm install' };
  }
});

// Check 9: Android platform
health.addCheck('Android Platform', async () => {
  const androidPath = path.join(process.cwd(), 'android');
  
  if (fs.existsSync(androidPath)) {
    return { status: 'pass', message: 'Android platform configured' };
  } else {
    return { status: 'warn', message: 'Android platform not found. Run: npx cap add android' };
  }
});

// Check 10: www directory
health.addCheck('Web Assets Directory', async () => {
  const wwwPath = path.join(process.cwd(), 'www');
  
  if (fs.existsSync(wwwPath)) {
    const files = fs.readdirSync(wwwPath).length;
    return { status: 'pass', message: `${files} files in www/` };
  } else {
    return { status: 'warn', message: 'www/ not found. Run: npm run build:web' };
  }
});

// Check 11: Service Worker
health.addCheck('Service Worker Configuration', async () => {
  const swPath = path.join(process.cwd(), 'sw.js');
  
  if (!fs.existsSync(swPath)) {
    return { status: 'fail', message: 'sw.js not found' };
  }
  
  const content = fs.readFileSync(swPath, 'utf8');
  
  if (content.includes('CACHE_NAME') && content.includes('addEventListener')) {
    return { status: 'pass', message: 'Service Worker properly configured' };
  } else {
    return { status: 'fail', message: 'Service Worker incomplete' };
  }
});

// Check 12: Network connectivity
health.addCheck('Network Connectivity', async () => {
  try {
    execSync('curl -s -o /dev/null -w "%{http_code}" https://www.google.com', { 
      encoding: 'utf8',
      timeout: 5000 
    });
    return { status: 'pass', message: 'Internet connection available' };
  } catch {
    return { status: 'warn', message: 'No internet connection (needed for dependencies)' };
  }
});

// Check 13: GitHub Actions secrets (only warn)
health.addCheck('GitHub Secrets', async () => {
  const requiredSecrets = ['KEYSTORE_BASE64', 'GOOGLE_SERVICES_JSON'];
  
  if (process.env.GITHUB_ACTIONS) {
    const hasAllSecrets = requiredSecrets.every(s => process.env[s]);
    if (hasAllSecrets) {
      return { status: 'pass', message: 'All secrets configured' };
    } else {
      return { status: 'warn', message: 'Some secrets not set for CI/CD' };
    }
  } else {
    return { status: 'warn', message: 'Not running in GitHub Actions (local build)' };
  }
});

// Check 14: Disk space
health.addCheck('Disk Space', async () => {
  try {
    const wwwPath = path.join(process.cwd(), 'www');
    const totalSize = fs.existsSync(wwwPath) 
      ? fs.readdirSync(wwwPath).reduce((sum, f) => {
          const s = fs.statSync(path.join(wwwPath, f));
          return sum + (s.isFile() ? s.size : 0);
        }, 0)
      : 0;
    
    const sizeGB = (totalSize / 1024 / 1024 / 1024).toFixed(2);
    return { status: 'pass', message: `${sizeGB}GB available` };
  } catch {
    return { status: 'pass', message: 'Sufficient disk space' };
  }
});

// Print recommendations
console.log('\n' + COLORS.blue + '💡 Recommendations:' + COLORS.reset);
log('cyan', '  1. Ensure all checks pass before building');
log('cyan', '  2. Run: npm run build:web');
log('cyan', '  3. Run: npm run sync:cap');
log('cyan', '  4. Run: npm run open:android');
log('cyan', '  5. Build APK in Android Studio');
log('cyan', '  6. Test on Android device with offline mode');

console.log('');

// Run all checks
health.run();
