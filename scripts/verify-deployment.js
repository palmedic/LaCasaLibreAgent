#!/usr/bin/env node

/**
 * Vercel Deployment Verification Script
 *
 * Automatically checks Vercel deployment status after git push
 * and reports any errors or warnings.
 */

const https = require('https');
const { execSync } = require('child_process');

// Configuration
const PROJECT_NAME = 'lacasalibre-agent-ui';
const VERCEL_API = 'https://api.vercel.com';
const VERCEL_TOKEN = process.env.VERCEL_TOKEN;

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.vercel.com',
      path: path,
      headers: {
        'Authorization': `Bearer ${VERCEL_TOKEN}`,
      },
    };

    https.get(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('Failed to parse response'));
        }
      });
    }).on('error', reject);
  });
}

async function getLatestDeployment() {
  log('\n🔍 Checking Vercel deployment status...', 'blue');

  if (!VERCEL_TOKEN) {
    log('⚠️  VERCEL_TOKEN not set. Skipping deployment verification.', 'yellow');
    log('   To enable automatic verification:', 'gray');
    log('   1. Get your token from https://vercel.com/account/tokens', 'gray');
    log('   2. Set it: export VERCEL_TOKEN="your-token"', 'gray');
    return null;
  }

  try {
    // Get project deployments
    const response = await makeRequest(`/v6/deployments?projectId=${PROJECT_NAME}&limit=1`);

    if (!response.deployments || response.deployments.length === 0) {
      log('❌ No deployments found', 'red');
      return null;
    }

    return response.deployments[0];
  } catch (error) {
    log(`❌ Error fetching deployment: ${error.message}`, 'red');
    return null;
  }
}

async function checkDeploymentStatus(deployment) {
  const { uid, url, state, readyState } = deployment;

  log(`\n📦 Deployment: ${url}`, 'blue');
  log(`   State: ${state}`, 'gray');
  log(`   Ready: ${readyState}`, 'gray');

  // Check if deployment is ready
  if (readyState === 'READY') {
    log('✅ Deployment is READY', 'green');

    // Test the URL
    return new Promise((resolve) => {
      https.get(`https://${url}`, (res) => {
        if (res.statusCode === 200) {
          log(`✅ Health check passed (HTTP ${res.statusCode})`, 'green');
          log(`\n🎉 Deployment verified successfully!`, 'green');
          log(`   Visit: https://${url}\n`, 'blue');
          resolve(true);
        } else {
          log(`⚠️  Warning: Site returned HTTP ${res.statusCode}`, 'yellow');
          resolve(false);
        }
      }).on('error', () => {
        log('⚠️  Could not reach deployment URL', 'yellow');
        resolve(false);
      });
    });
  } else if (readyState === 'ERROR') {
    log('❌ Deployment FAILED', 'red');
    log(`   Check details at: https://vercel.com/deployments/${uid}\n`, 'blue');
    return false;
  } else if (readyState === 'BUILDING' || readyState === 'QUEUED') {
    log('⏳ Deployment is still in progress...', 'yellow');
    log(`   Monitor at: https://vercel.com/deployments/${uid}\n`, 'blue');
    return false;
  } else {
    log(`⚠️  Unknown state: ${readyState}`, 'yellow');
    return false;
  }
}

async function waitForDeployment(maxWaitTime = 300000) {
  const startTime = Date.now();
  const pollInterval = 10000; // Check every 10 seconds

  log('\n⏳ Waiting for deployment to complete...', 'yellow');

  while (Date.now() - startTime < maxWaitTime) {
    const deployment = await getLatestDeployment();

    if (!deployment) {
      return false;
    }

    if (deployment.readyState === 'READY') {
      return await checkDeploymentStatus(deployment);
    } else if (deployment.readyState === 'ERROR') {
      return await checkDeploymentStatus(deployment);
    }

    // Wait before next check
    log(`   Checking again in ${pollInterval / 1000}s...`, 'gray');
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  log('⏱️  Timeout waiting for deployment', 'yellow');
  return false;
}

async function main() {
  const deployment = await getLatestDeployment();

  if (!deployment) {
    process.exit(0);
  }

  const success = await checkDeploymentStatus(deployment);

  // If building, optionally wait
  if (deployment.readyState === 'BUILDING' || deployment.readyState === 'QUEUED') {
    const shouldWait = process.argv.includes('--wait');

    if (shouldWait) {
      await waitForDeployment();
    } else {
      log('\n💡 Tip: Use --wait to automatically wait for deployment', 'gray');
    }
  }

  process.exit(success ? 0 : 1);
}

main().catch((error) => {
  log(`\n❌ Unexpected error: ${error.message}`, 'red');
  process.exit(1);
});
