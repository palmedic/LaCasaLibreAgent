# Automated Deployment Verification

This guide explains how to automatically verify Vercel deployments after pushing code.

## Setup

### 1. Get Your Vercel Token

1. Go to https://vercel.com/account/tokens
2. Create a new token named "Deployment Verification"
3. Copy the token

### 2. Set Environment Variable

Add to your shell profile (`~/.zshrc` or `~/.bashrc`):

```bash
export VERCEL_TOKEN="your-token-here"
```

Then reload:
```bash
source ~/.zshrc  # or ~/.bashrc
```

## Usage

### Option 1: Manual Verification After Push

```bash
git push
npm run verify-deployment
```

### Option 2: Automatic Push + Verify

```bash
npm run push
```

This automatically runs `git push` followed by deployment verification.

### Option 3: Wait for Deployment to Complete

```bash
npm run verify-deployment -- --wait
```

This will poll the deployment status every 10 seconds until it's ready (max 5 minutes).

## What It Checks

The verification script:

1. ✅ Fetches the latest deployment from Vercel
2. ✅ Checks deployment state (READY, ERROR, BUILDING, etc.)
3. ✅ Performs HTTP health check on the live URL
4. ✅ Reports any errors or warnings
5. ✅ Provides direct links to deployment details

## Output Examples

### Successful Deployment
```
🔍 Checking Vercel deployment status...

📦 Deployment: lacasalibre-agent-ui-abc123.vercel.app
   State: READY
   Ready: READY
✅ Deployment is READY
✅ Health check passed (HTTP 200)

🎉 Deployment verified successfully!
   Visit: https://lacasalibre-agent-ui-abc123.vercel.app
```

### Failed Deployment
```
🔍 Checking Vercel deployment status...

📦 Deployment: lacasalibre-agent-ui-xyz789.vercel.app
   State: ERROR
   Ready: ERROR
❌ Deployment FAILED
   Check details at: https://vercel.com/deployments/xyz789
```

### Deployment In Progress
```
🔍 Checking Vercel deployment status...

📦 Deployment: lacasalibre-agent-ui-def456.vercel.app
   State: BUILDING
   Ready: BUILDING
⏳ Deployment is still in progress...
   Monitor at: https://vercel.com/deployments/def456

💡 Tip: Use --wait to automatically wait for deployment
```

## Integration with Git Hooks

You can also set up a post-push hook to automatically verify deployments.

Create `.git/hooks/post-push`:
```bash
#!/bin/bash
npm run verify-deployment
```

Make it executable:
```bash
chmod +x .git/hooks/post-push
```

## Troubleshooting

### "VERCEL_TOKEN not set"
You haven't exported your Vercel token. Follow setup step 2 above.

### "No deployments found"
- Check that your project is connected to Vercel
- Verify the PROJECT_NAME in `scripts/verify-deployment.js` matches your Vercel project

### "Error fetching deployment"
- Check your Vercel token is valid
- Ensure you have access to the project
- Verify your internet connection

## Advanced: Custom Configuration

Edit `scripts/verify-deployment.js` to customize:

- `PROJECT_NAME`: Your Vercel project name
- `pollInterval`: How often to check deployment status (default: 10s)
- `maxWaitTime`: Maximum time to wait for deployment (default: 5min)

## For Claude Code

When using Claude Code, I can automatically:
1. Run the verification after every `git push`
2. Wait for the deployment to complete
3. Check for errors and attempt to fix them
4. Report the deployment status to you

Just ask me to "push" or "push and verify deployment" and I'll handle everything!
