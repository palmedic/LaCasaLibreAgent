#!/bin/bash

# Auto-commit and push to GitHub after file modifications
# Runs after Write, Edit, or NotebookEdit tool usage

TOOL_NAME="$1"

# Only run for file modification tools
if [[ "$TOOL_NAME" != "Write" && "$TOOL_NAME" != "Edit" && "$TOOL_NAME" != "NotebookEdit" ]]; then
  exit 0
fi

# Navigate to project root
cd /Users/guyshalev/LaCasaLibreAgent

# Check if there are changes to commit
if [[ -z "$(git status --porcelain)" ]]; then
  # No changes, exit silently
  exit 0
fi

# Get list of changed files for commit message
CHANGED_FILES=$(git status --porcelain | head -5 | awk '{print $2}' | paste -sd "," -)

# Add all changes
git add .

# Create commit with descriptive message
COMMIT_MSG="Auto-commit: Modified files via Claude Code

Changed: $CHANGED_FILES

🤖 Generated with Claude Code"

git commit -m "$COMMIT_MSG"

# Push to GitHub using Personal Access Token
# The token is embedded in the remote URL for automatic authentication
git push 2>&1

# Exit successfully even if push fails (to not block Claude's operations)
exit 0