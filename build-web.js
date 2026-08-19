#!/usr/bin/env node

/**
 * Build Script for ECampus Offline-First App
 * Bundles web assets and prepares for Capacitor build
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

function logSection(title) {
  console.log('\n' + COLORS.cyan + '═'.repeat(60) + COLORS.reset);
  log('cyan', `  ${title}`);
  console.log(COLORS.cyan + '═'.repeat(60) + COLORS.reset + '\n');
}

async function buildWeb() {
  try {
    logSection('ECampus Build System - Offline-First');

    // Step 1: Validate Node.js version
    log('blue', '📋 Checking environment...');
    const nodeVersion = process.version;
    if (!nodeVersion.startsWith('v18') && !nodeVersion.startsWith('v20') && !nodeVersion.startsWith('v24')) {
      log('yellow', `⚠️  Node.js ${nodeVersion} - Recommended: v18+`);
    }
    log('green', `✓ Node.js ${nodeVersion} OK`);

    // Step 2: Create www directory
    log('blue', '📁 Creating web directory structure...');
    const wwwDir = path.join(__dirname, '..', 'www');
    const assetsDirs = [wwwDir, path.join(wwwDir, 'assets'), path.join(wwwDir, 'api')];
    
    assetsDirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        log('green', `✓ Created: ${dir}`);
      }
    });

    // Step 3: Copy HTML files
    log('blue', '📄 Copying HTML files...');
    const sourceDir = process.cwd();
    const filesToCopy = ['index.html', 'offline.html', 'sw.js'];

    filesToCopy.forEach(file => {
      const srcPath = path.join(sourceDir, file);
      const destPath = path.join(wwwDir, file);

      if (fs.existsSync(srcPath)) {
        const content = fs.readFileSync(srcPath, 'utf8');
        
        // Add build timestamp and version to files
        const buildInfo = `<!-- Built: ${new Date().toISOString()} -->`;
        const fileContent = content.includes('<html') || content.includes('<!--') 
          ? content.replace('<html', `${buildInfo}\n<html`)
          : buildInfo + '\n' + content;

        fs.writeFileSync(destPath, fileContent);
        
        const fileSize = (fs.statSync(destPath).size / 1024).toFixed(2);
        log('green', `✓ Copied: ${file} (${fileSize}KB)`);
      } else {
        log('yellow', `⚠️  Skipped: ${file} (not found)`);
      }
    });

    // Step 4: Create PWA manifest
    log('blue', '🎯 Creating PWA manifest...');
    const manifest = {
      name: 'ECampus - Campus Management System',
      short_name: 'ECampus',
      description: 'Access your campus resources offline',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      orientation: 'portrait-primary',
      theme_color: '#059669',
      background_color: '#ffffff',
      categories: ['education'],
      screenshots: [
        {
          src: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 540 720%22><rect fill=%22%23059669%22 width=%22540%22 height=%22720%22/><text x=%2270%25%22 y=%2250%25%22 font-size=%22200%22 fill=%22white%22 text-anchor=%22middle%22>E</text></svg>',
          sizes: '540x720',
          type: 'image/svg+xml',
          form_factor: 'narrow'
        }
      ],
      icons: [
        {
          src: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 192 192%22><rect fill=%22%23059669%22 width=%22192%22 height=%22192%22/><text x=%2250%25%22 y=%2260%25%22 font-size=%22120%22 fill=%22white%22 text-anchor=%22middle%22>E</text></svg>',
          sizes: '192x192',
          type: 'image/svg+xml',
          purpose: 'any'
        },
        {
          src: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 512 512%22><rect fill=%22%23059669%22 width=%22512%22 height=%22512%22/><text x=%2250%25%22 y=%2260%25%22 font-size=%22320%22 fill=%22white%22 text-anchor=%22middle%22>E</text></svg>',
          sizes: '512x512',
          type: 'image/svg+xml',
          purpose: 'any maskable'
        }
      ],
      shortcuts: [
        {
          name: 'Open App',
          short_name: 'Open',
          description: 'Open ECampus app',
          url: '/?mode=app',
          icons: [
            {
              src: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 96 96%22><rect fill=%22%23059669%22 width=%2296%22 height=%2296%22/><text x=%2250%25%22 y=%2260%25%22 font-size=%2260%22 fill=%22white%22 text-anchor=%22middle%22>E</text></svg>',
              sizes: '96x96',
              type: 'image/svg+xml'
            }
          ]
        }
      ],
      share_target: {
        action: '/share',
        method: 'POST',
        enctype: 'application/x-www-form-urlencoded',
        params: {
          title: 'title',
          text: 'text',
          url: 'url'
        }
      }
    };

    fs.writeFileSync(
      path.join(wwwDir, 'manifest.json'),
      JSON.stringify(manifest, null, 2)
    );
    log('green', '✓ Created: manifest.json (PWA configuration)');

    // Step 5: Create app configuration
    log('blue', '⚙️  Creating app configuration...');
    const appConfig = {
      version: '2.0.1',
      buildNumber: process.env.GITHUB_RUN_NUMBER || 'local',
      buildDate: new Date().toISOString(),
      offlineEnabled: true,
      cacheBusting: true,
      environment: process.env.NODE_ENV || 'production',
      features: {
        offline: true,
        pushNotifications: true,
        camera: true,
        fileShare: true,
        backgroundSync: true
      },
      api: {
        baseUrl: 'https://api.example.com',
        timeout: 5000,
        retries: 3
      },
      cache: {
        version: 'v1',
        assets: 'ecampus-assets-v1',
        runtime: 'ecampus-runtime-v1',
        maxAge: 86400000 // 24 hours
      }
    };

    fs.writeFileSync(
      path.join(wwwDir, 'config.json'),
      JSON.stringify(appConfig, null, 2)
    );
    log('green', '✓ Created: config.json (App configuration)');

    // Step 6: Create robots.txt
    log('blue', '🤖 Creating meta files...');
    const robots = `User-agent: *
Allow: /
Disallow: /api/

# ECampus Offline-First PWA
`;
    fs.writeFileSync(path.join(wwwDir, 'robots.txt'), robots);
    log('green', '✓ Created: robots.txt');

    // Step 7: Create .htaccess (if deploying to web)
    const htaccess = `# Cache static assets for 1 year
<FilesMatch "\\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$">
  Header set Cache-Control "max-age=31536000, public"
</FilesMatch>

# Don't cache HTML or manifest files
<FilesMatch "\\.(html|json|xml)$">
  Header set Cache-Control "max-age=0, public, must-revalidate"
</FilesMatch>

# Service Worker not cached
<FilesMatch "sw\\.js$">
  Header set Cache-Control "max-age=0, public, must-revalidate"
</FilesMatch>

# Gzip compression
<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/plain text/xml text/css text/javascript application/javascript application/json
</IfModule>

# Rewrite rules for offline support
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  
  # Rewrite missing files to index.html
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule ^(.*)$ /index.html [L]
</IfModule>
`;
    fs.writeFileSync(path.join(wwwDir, '.htaccess'), htaccess);
    log('green', '✓ Created: .htaccess (Server configuration)');

    // Step 8: Create web.config for IIS
    const webConfig = `<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <rule name="ECampus SPA">
          <match url=".*" />
          <conditions logicalGrouping="MatchAll">
            <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
            <add input="{REQUEST_FILENAME}" matchType="IsDirectory" negate="true" />
          </conditions>
          <action type="Rewrite" url="/index.html" />
        </rule>
      </rules>
    </rewrite>
    <staticContent>
      <remove fileExtension=".json" />
      <mimeType fileExtension=".json" mimeType="application/json" />
      <remove fileExtension=".woff2" />
      <mimeType fileExtension=".woff2" mimeType="font/woff2" />
    </staticContent>
    <httpProtocol>
      <customHeaders>
        <add name="Cache-Control" value="max-age=31536000" />
      </customHeaders>
    </httpProtocol>
  </system.webServer>
</configuration>
`;
    fs.writeFileSync(path.join(wwwDir, 'web.config'), webConfig);
    log('green', '✓ Created: web.config (IIS configuration)');

    // Step 9: Generate build report
    logSection('Build Report');
    const wwwContents = fs.readdirSync(wwwDir);
    const totalSize = wwwContents.reduce((sum, file) => {
      const filePath = path.join(wwwDir, file);
      if (fs.statSync(filePath).isFile()) {
        return sum + fs.statSync(filePath).size;
      }
      return sum;
    }, 0);

    log('blue', '📦 Generated Files:');
    wwwContents.forEach(file => {
      const filePath = path.join(wwwDir, file);
      if (fs.statSync(filePath).isFile()) {
        const size = (fs.statSync(filePath).size / 1024).toFixed(2);
        log('green', `  ✓ ${file} (${size}KB)`);
      }
    });

    log('blue', `\n📊 Total Size: ${(totalSize / 1024 / 1024).toFixed(2)}MB`);

    // Step 10: Validation
    logSection('Validation');
    const requiredFiles = ['index.html', 'offline.html', 'sw.js', 'manifest.json', 'config.json'];
    const allFilesPresent = requiredFiles.every(file => 
      fs.existsSync(path.join(wwwDir, file))
    );

    if (allFilesPresent) {
      log('green', '✓ All required files present');
      log('green', '✓ Build successful!');
    } else {
      const missing = requiredFiles.filter(file => 
        !fs.existsSync(path.join(wwwDir, file))
      );
      log('red', `✗ Missing files: ${missing.join(', ')}`);
      process.exit(1);
    }

    // Step 11: Next steps
    logSection('Next Steps');
    log('cyan', '1. Run: npm run sync:cap');
    log('cyan', '2. Run: npm run open:android');
    log('cyan', '3. Build APK in Android Studio');
    log('cyan', '4. Test on Android device');

    console.log('');
    log('green', '✅ Build process completed!');

  } catch (error) {
    logSection('Build Error');
    log('red', `✗ ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// Run build
buildWeb();
