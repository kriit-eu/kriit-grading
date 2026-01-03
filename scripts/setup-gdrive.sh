#!/bin/bash
# Google Drive MCP Server Setup Script
# Run after downloading client_secret_*.json from Google Cloud Console

set -e

CONFIG_DIR="$HOME/.config/google-drive-mcp"
CREDENTIALS_FILE="$CONFIG_DIR/gcp-oauth.keys.json"

echo "🔧 Google Drive MCP Setup"
echo "========================="
echo ""

# Step 1: Find credentials file
DOWNLOADED_FILE=$(ls -t ~/Downloads/client_secret_*.json 2>/dev/null | head -1)

if [ -z "$DOWNLOADED_FILE" ]; then
    echo "❌ No client_secret_*.json found in ~/Downloads/"
    echo ""
    echo "Please complete these steps first:"
    echo "1. Go to https://console.cloud.google.com/"
    echo "2. Create project & enable Google Drive API"
    echo "3. Configure OAuth consent screen"
    echo "4. Create OAuth client (Desktop app)"
    echo "5. Download JSON credentials"
    echo ""
    echo "See README.md for detailed instructions."
    exit 1
fi

echo "✅ Found credentials: $(basename "$DOWNLOADED_FILE")"

# Step 2: Create config directory
mkdir -p "$CONFIG_DIR"
echo "✅ Created config directory: $CONFIG_DIR"

# Step 3: Copy credentials
cp "$DOWNLOADED_FILE" "$CREDENTIALS_FILE"
chmod 600 "$CREDENTIALS_FILE"
echo "✅ Copied credentials to: $CREDENTIALS_FILE"

# Step 4: Add MCP server to Claude Code
echo ""
echo "📦 Configuring Claude Code MCP server..."

# Remove existing if present
claude mcp remove gdrive 2>/dev/null || true

# Add with environment variable
claude mcp add gdrive \
    -e GOOGLE_DRIVE_OAUTH_CREDENTIALS="$CREDENTIALS_FILE" \
    -- npx @piotr-agier/google-drive-mcp

echo "✅ MCP server added to Claude Code"

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
echo "1. Restart Claude Code"
echo "2. Test with: 'List my Google Drive files'"
echo ""
echo "Note: Token expires after 7 days in testing mode."
echo "Re-authenticate with: bun run setup:gdrive"
