#!/usr/bin/env node

/**
 * Service Worker Validation Script
 * Validates sw.js for common issues and best practices
 */

const fs = require('fs');
const path = require('path');

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

class ServiceWorkerValidator {
  constructor() {
    this.issues = [];
    this.warnings = [];
    this.tips = [];
    this.swPath = path.join(process.cwd(), 'sw.js');
  }

  validate() {
    console.log('\n' + COLORS.cyan + '═'.repeat(60) + COLORS.reset);
    log('cyan', '  Service Worker Validation Report');
    console.log(COLORS.cyan + '═'.repeat(60) + COLORS.reset + '\n');

    if (!fs.existsSync(this.swPath)) {
      log('red', '✗ sw.js not found in project root');
      return false;
    }

    const swContent = fs.readFileSync(this.swPath, 'utf8');

    // Check 1: Cache version defined
    if (!swContent.includes('CACHE_NAME')) {
      this.issues.push('Cache version (CACHE_NAME) not defined');
    } else {
      log('green', '✓ Cache version defined');
    }

    // Check 2: Install event handler
    if (!swContent.includes('addEventListener(\'install\'')) {
      this.issues.push('Install event not implemented');
    } else {
      log('green', '✓ Install event handler present');
    }

    // Check 3: Activate event handler
    if (!swContent.includes('addEventListener(\'activate\'')) {
      this.issues.push('Activate event not implemented');
    } else {
      log('green', '✓ Activate event handler present');
    }

    // Check 4: Fetch event handler
    if (!swContent.includes('addEventListener(\'fetch\'')) {
      this.issues.push('Fetch event not implemented');
    } else {
      log('green', '✓ Fetch event handler present');
    }

    // Check 5: Offline fallback page defined
    if (!swContent.includes('OFFLINE_PAGE') && !swContent.includes('offline.html')) {
      this.warnings.push('No offline fallback page defined');
    } else {
      log('green', '✓ Offline fallback configured');
    }

    // Check 6: Error handling
    if (!swContent.includes('.catch(') && !swContent.includes('try')) {
      this.warnings.push('Minimal error handling detected');
    } else {
      log('green', '✓ Error handling implemented');
    }

    // Check 7: Cache busting
    if (swContent.includes('cache-buster') || swContent.includes('?v=')) {
      log('green', '✓ Cache busting strategy detected');
    } else {
      this.tips.push('Consider implementing cache busting strategy');
    }

    // Check 8: Background sync
    if (swContent.includes('addEventListener(\'sync\'')) {
      log('green', '✓ Background sync implemented');
    } else {
      this.tips.push('Consider implementing background sync for offline actions');
    }

    // Check 9: Message handling
    if (swContent.includes('addEventListener(\'message\'')) {
      log('green', '✓ Message handling implemented');
    } else {
      this.tips.push('Consider implementing message handling for updates');
    }

    // Check 10: Console logging
    if (swContent.includes('console.log') || swContent.includes('console.error')) {
      log('green', '✓ Logging implemented (remember to disable in production)');
    } else {
      this.tips.push('Add logging for debugging in development');
    }

    // Display warnings
    if (this.warnings.length > 0) {
      console.log(COLORS.yellow + '\n⚠️  Warnings:' + COLORS.reset);
      this.warnings.forEach(w => log('yellow', `  • ${w}`));
    }

    // Display issues
    if (this.issues.length > 0) {
      console.log(COLORS.red + '\n✗ Issues:' + COLORS.reset);
      this.issues.forEach(issue => log('red', `  • ${issue}`));
      return false;
    }

    // Display tips
    if (this.tips.length > 0) {
      console.log(COLORS.blue + '\n💡 Tips:' + COLORS.reset);
      this.tips.forEach(tip => log('blue', `  • ${tip}`));
    }

    console.log('');
    log('green', '✓ Service Worker validation passed!');
    return true;
  }

  validateIndexHtml() {
    const indexPath = path.join(process.cwd(), 'index.html');
    
    if (!fs.existsSync(indexPath)) {
      log('yellow', 'ℹ️  index.html not found');
      return;
    }

    log('blue', '\n📄 Checking index.html...');
    const indexContent = fs.readFileSync(indexPath, 'utf8');

    if (indexContent.includes('navigator.serviceWorker.register')) {
      log('green', '✓ Service Worker registration found');
    } else {
      this.warnings.push('Service Worker registration not found in index.html');
    }

    if (indexContent.includes('manifest.json')) {
      log('green', '✓ PWA manifest linked');
    } else {
      this.tips.push('Link manifest.json in index.html for better PWA support');
    }

    if (indexContent.includes('meta name="viewport"')) {
      log('green', '✓ Viewport meta tag configured');
    }
  }

  validateManifest() {
    const manifestPath = path.join(process.cwd(), 'www', 'manifest.json');
    
    if (!fs.existsSync(manifestPath)) {
      log('yellow', 'ℹ️  manifest.json not found in www/ (may be auto-generated)');
      return;
    }

    log('blue', '\n📋 Checking manifest.json...');
    
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      
      if (manifest.name && manifest.short_name) {
        log('green', '✓ App names configured');
      }
      
      if (manifest.icons && manifest.icons.length > 0) {
        log('green', '✓ Icons configured');
      }
      
      if (manifest.display === 'standalone') {
        log('green', '✓ Display mode set to standalone');
      }
      
      if (manifest.theme_color) {
        log('green', '✓ Theme color configured');
      }
    } catch (error) {
      this.issues.push(`Invalid manifest.json: ${error.message}`);
    }
  }

  generateReport() {
    console.log(COLORS.cyan + '\n═'.repeat(60) + COLORS.reset);
    log('cyan', '  Summary');
    console.log(COLORS.cyan + '═'.repeat(60) + COLORS.reset + '\n');

    log('blue', `Issues: ${this.issues.length}`);
    log('yellow', `Warnings: ${this.warnings.length}`);
    log('blue', `Tips: ${this.tips.length}`);

    const status = this.issues.length === 0 ? 'PASS' : 'FAIL';
    const color = this.issues.length === 0 ? 'green' : 'red';
    
    console.log('');
    log(color, `Status: ${status}`);
    console.log('');
  }

  printDiagnostics() {
    console.log(COLORS.cyan + '\n═'.repeat(60) + COLORS.reset);
    log('cyan', '  Diagnostics');
    console.log(COLORS.cyan + '═'.repeat(60) + COLORS.reset + '\n');

    log('blue', '🔍 Checking file sizes...');
    
    const files = [
      { name: 'sw.js', path: 'sw.js' },
      { name: 'index.html', path: 'index.html' },
      { name: 'offline.html', path: 'offline.html' }
    ];

    files.forEach(({ name, path: filePath }) => {
      const fullPath = path.join(process.cwd(), filePath);
      if (fs.existsSync(fullPath)) {
        const size = fs.statSync(fullPath).size;
        const sizeKB = (size / 1024).toFixed(2);
        
        if (size > 100000) {
          log('yellow', `  ${name}: ${sizeKB}KB (large)`);
        } else {
          log('green', `  ${name}: ${sizeKB}KB`);
        }
      }
    });

    log('blue', '\n📁 Directory structure...');
    const wwwDir = path.join(process.cwd(), 'www');
    if (fs.existsSync(wwwDir)) {
      const files = fs.readdirSync(wwwDir);
      log('green', `  www/ contains ${files.length} files`);
    } else {
      log('yellow', '  www/ directory not found (will be created during build)');
    }

    log('blue', '\n🔧 Recommendations...');
    log('cyan', '  1. Test Service Worker in Chrome DevTools');
    log('cyan', '  2. Test offline mode using DevTools Network tab');
    log('cyan', '  3. Verify cache storage is working');
    log('cyan', '  4. Check browser console for errors');
    log('cyan', '  5. Test on actual Android device');
  }
}

// Run validation
const validator = new ServiceWorkerValidator();
const isValid = validator.validate();
validator.validateIndexHtml();
validator.validateManifest();
validator.printDiagnostics();
validator.generateReport();

process.exit(isValid ? 0 : 1);
