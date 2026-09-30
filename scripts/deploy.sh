#!/bin/bash
set -e

# ==============================================================================
# om-karthi-healing-centre-frontend Server Deployment Script
# ==============================================================================

PROJECT_DIR="/home/azureuser/builder-sites/om-karthi-healing-centre-frontend"

echo "=== Starting deployment at $(date) ==="
cd "$PROJECT_DIR"

echo "--> Fetching and pulling latest changes from git origin/main..."
git stash --all || true
if git show-ref --verify --quiet refs/heads/main; then
    git switch main
else
    git checkout -b main
fi
git pull origin main || echo "Warning: git pull completed with note or branch up-to-date."

BUILD_VER=$(git rev-parse --short HEAD 2>/dev/null || date +%s)
echo "--> Injecting dynamic version tag (?v=${BUILD_VER}) for asset cache busting..."
# Fast find excluding .git, node_modules, and temporary scratch folders
find . -type d \( -name .git -o -name node_modules -o -name scratch_crops \) -prune -o -type f -name "*.html" -exec sed -i -E "s/(href|src)=\"([a-zA-Z0-9_\.\/ -%]+\.(css|js|png|jpg|jpeg|gif|svg|webp|ico))(\?v=[^\"']*)?\"/\1=\"\2?v=${BUILD_VER}\"/g" {} + 2>/dev/null || true

echo "--> Setting file permissions..."
chmod -R 755 .

echo "--> Validating JavaScript syntax..."
if command -v node >/dev/null 2>&1; then
    for f in js/*.js *.js scripts/*.js; do
        if [ -f "$f" ]; then
            node -c "$f"
        fi
    done
    echo "✓ All JavaScript files passed syntax check."
fi

echo "--> Fast generating sitemap.xml & robots.txt..."
if [ -f "scripts/generate-sitemap.js" ] && command -v node >/dev/null 2>&1; then
    node scripts/generate-sitemap.js || echo "Warning: Sitemap generation had warnings."
fi

echo "--> Checking Nginx configuration..."
if command -v nginx >/dev/null 2>&1; then
    sudo nginx -t
    echo "--> Reloading Nginx..."
    sudo systemctl reload nginx
    echo "✓ Nginx reloaded successfully."
fi

echo "=== Deployment completed successfully at $(date) ==="
