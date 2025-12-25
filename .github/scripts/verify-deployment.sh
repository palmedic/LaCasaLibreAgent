#!/bin/bash
set -e

# Deployment Verification Script for La Casa Libre Agent
# This script checks Vercel deployment status and reports errors

echo "🔍 Verifying Vercel deployment..."

# Check if vercel CLI is available
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI not found. Installing..."
    npm install -g vercel
fi

# Get the latest deployment
DEPLOYMENT_URL=$(vercel ls --token $VERCEL_TOKEN 2>&1 | grep "lacasalibre-agent-ui" | head -1 | awk '{print $2}')

if [ -z "$DEPLOYMENT_URL" ]; then
    echo "❌ No deployment found"
    exit 1
fi

echo "📦 Latest deployment: $DEPLOYMENT_URL"

# Check deployment status
STATUS=$(vercel inspect $DEPLOYMENT_URL --token $VERCEL_TOKEN 2>&1 | grep "State:" | awk '{print $2}')

echo "📊 Deployment status: $STATUS"

if [ "$STATUS" = "READY" ]; then
    echo "✅ Deployment is live and ready!"

    # Test the deployment URL
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "https://$DEPLOYMENT_URL")

    if [ "$HTTP_CODE" = "200" ]; then
        echo "✅ Health check passed (HTTP $HTTP_CODE)"
        exit 0
    else
        echo "⚠️  Warning: Site returned HTTP $HTTP_CODE"
        exit 1
    fi
elif [ "$STATUS" = "ERROR" ]; then
    echo "❌ Deployment failed!"
    vercel inspect $DEPLOYMENT_URL --token $VERCEL_TOKEN
    exit 1
elif [ "$STATUS" = "BUILDING" ]; then
    echo "⏳ Deployment is still building..."
    exit 1
else
    echo "⚠️  Unknown status: $STATUS"
    exit 1
fi
