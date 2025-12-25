#!/bin/bash

# Auto-commit and push to GitHub after file modifications
# Runs after Write, Edit, or NotebookEdit tool usage

# Log file for debugging
LOG_FILE="/Users/guyshalev/LaCasaLibreAgent/.claude/hooks/post-tool-use.log"

# Log function with timestamp
log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

TOOL_NAME="$1"
log "Hook triggered for tool: $TOOL_NAME"

# Only run for file modification tools
if [[ "$TOOL_NAME" != "Write" && "$TOOL_NAME" != "Edit" && "$TOOL_NAME" != "NotebookEdit" ]]; then
  log "Skipping - not a file modification tool"
  exit 0
fi

# Navigate to project root
cd /Users/guyshalev/LaCasaLibreAgent
log "Changed directory to: $(pwd)"

# Check if there are changes to commit
if [[ -z "$(git status --porcelain)" ]]; then
  log "No changes to commit"
  exit 0
fi

# Get list of changed files for commit message
CHANGED_FILES=$(git status --porcelain | head -5 | awk '{print $2}' | paste -sd "," -)
log "Changed files: $CHANGED_FILES"

# Add all changes
git add .
log "Added changes to staging"

# Create commit with descriptive message
COMMIT_MSG="Auto-commit: Modified files via Claude Code

Changed: $CHANGED_FILES

🤖 Generated with Claude Code"

if git commit -m "$COMMIT_MSG"; then
  log "Commit successful"
else
  log "ERROR: Commit failed"
  exit 1
fi

# Push to GitHub using Personal Access Token
if git push 2>&1 | tee -a "$LOG_FILE"; then
  log "Push successful"
else
  log "ERROR: Push failed"
  exit 1
fi

log "Hook completed successfully"
exit 0