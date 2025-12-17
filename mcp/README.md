# PrefID MCP Server for Claude Desktop

This MCP server allows Claude Desktop to access your PrefID preferences.

## Setup Instructions

### 1. Install Dependencies
```bash
cd backend/mcp
npm install
```

### 2. Build the Server
```bash
npm run build
```

### 3. Configure Claude Desktop

Add this to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
    "mcpServers": {
        "prefid": {
            "command": "node",
            "args": ["/FULL/PATH/TO/prefid-v0/backend/mcp/dist/prefid-server.js"],
            "env": {
                "SUPABASE_URL": "your-supabase-url",
                "SUPABASE_ANON_KEY": "your-supabase-key",
                "PREFID_USER_ID": "your-user-id"
            }
        }
    }
}
```

Replace:
- `/FULL/PATH/TO/` with your actual path
- Supabase credentials from your `.env` file
- User ID with your PrefID user ID

### 4. Restart Claude Desktop

After updating the config, restart Claude Desktop.

## Available Tools

| Tool | Description |
|------|-------------|
| `get_all_preferences` | Get all stored preferences |
| `get_domain_preferences` | Get preferences for a specific domain (travel, food, etc.) |
| `get_user_info` | Get user profile info |
| `save_conversation_summary` | **NEW** - Save learnings from conversation to PrefID |

## Usage in Claude

Once configured, you can ask Claude things like:
- "What are my food preferences?"
- "Check my travel preferences"
- "What does PrefID know about me?"

Claude will automatically use the PrefID tools to fetch your data.

### Saving Conversation Learnings

At the end of a conversation, you can ask Claude:
- "Save what you learned about me to PrefID"
- "Remember this conversation in my preferences"

Claude will call `save_conversation_summary` to store insights that will be available in all future conversations.

