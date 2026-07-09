#!/bin/bash
# Google Drive MCP Server Setup Script
# Run after downloading client_secret_*.json from Google Cloud Console
#
# Usage:
#   bun run setup:gdrive                    # Auto-find in ~/Downloads
#   bun run setup:gdrive /path/to/file.json # Specify file path

set -e

CONFIG_DIR="$HOME/.config/google-drive-mcp"
CREDENTIALS_FILE="$CONFIG_DIR/gcp-oauth.keys.json"

echo "🔧 Google Drive MCP Setup"
echo "========================="
echo ""

# Step 1: Find credentials file
if [ -n "$1" ]; then
    # User provided a path
    if [ -f "$1" ]; then
        DOWNLOADED_FILE="$1"
    else
        echo "❌ File not found: $1"
        exit 1
    fi
else
    # Auto-find in Downloads
    DOWNLOADED_FILE=$(ls -t ~/Downloads/client_secret_*.json 2>/dev/null | head -1)
fi

if [ -z "$DOWNLOADED_FILE" ]; then
    echo "❌ No client_secret_*.json found in ~/Downloads/"
    echo ""
    echo "Usage: bun run setup:gdrive [/path/to/client_secret.json]"
    echo ""
    echo "Please complete these steps first:"
    echo "1. Go to https://console.cloud.google.com/"
    echo "2. Create project & enable Google Drive API"
    echo "3. Configure OAuth consent screen"
    echo "4. Create OAuth client (Desktop app)"
    echo "5. Download JSON credentials to ~/Downloads/"
    echo ""
    echo "See README.md for detailed instructions."
    exit 1
fi

echo "✅ Found credentials: $(basename "$DOWNLOADED_FILE")"

# Step 2: Create config directory
mkdir -p "$CONFIG_DIR"

# Step 3: Copy credentials (overwrites existing)
cp "$DOWNLOADED_FILE" "$CREDENTIALS_FILE"
chmod 600 "$CREDENTIALS_FILE"
echo "✅ Credentials saved to: $CREDENTIALS_FILE"

# Step 4: Add MCP server to agy harness
echo ""
echo "📦 Configuring agy harness MCP server..."

node -e "
const fs = require('fs');
const path = require('path');
const configPath = path.join(process.env.HOME, '.gemini/config/mcp_config.json');
let config = { mcpServers: {} };

try {
  if (fs.existsSync(configPath)) {
    const content = fs.readFileSync(configPath, 'utf8').trim();
    if (content) {
      config = JSON.parse(content);
    }
  }
} catch (e) {
  console.warn('Warning: Could not parse existing mcp_config.json, overwriting.');
}

if (!config.mcpServers) config.mcpServers = {};
config.mcpServers['gdrive'] = {
  command: 'npx',
  args: ['-y', '@piotr-agier/google-drive-mcp'],
  env: {
    GOOGLE_DRIVE_OAUTH_CREDENTIALS: '$CREDENTIALS_FILE'
  }
};

fs.mkdirSync(path.dirname(configPath), { recursive: true });
fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
console.log('✅ MCP server added/updated in ~/.gemini/config/mcp_config.json');
"

# Step 5: Run authentication
echo ""
echo "🔐 Starting authentication..."
echo "   A browser window will open. Log in with your Google account."
echo ""

GOOGLE_DRIVE_OAUTH_CREDENTIALS="$CREDENTIALS_FILE" \
    npx @piotr-agier/google-drive-mcp auth

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Restart agy harness"
echo "2. Test with: 'List my Google Drive files'"
echo ""
echo "Note: Token expires after 7 days in testing mode."
echo "Re-authenticate with: bun run setup:gdrive"
