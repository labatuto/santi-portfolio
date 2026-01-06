#!/bin/bash
# Daily auto-update script for Santi's portfolio
# Runs update-site.py, commits, and pushes to GitHub

cd /Users/Santi/portfolio

echo "=== Update started: $(date) ===" >> scripts/update.log

# Run the update script
/usr/bin/python3 scripts/update-site.py >> scripts/update.log 2>&1

# Stage any changes
git add -A

# Only commit and push if there are changes
if ! git diff --quiet --cached; then
  git commit -m "Auto-update: $(date +%Y-%m-%d)"
  git push origin main
  echo "Changes pushed to GitHub" >> scripts/update.log
else
  echo "No changes to commit" >> scripts/update.log
fi

echo "=== Update finished: $(date) ===" >> scripts/update.log
echo "" >> scripts/update.log
