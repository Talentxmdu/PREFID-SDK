"use strict";
/**
 * PrefID MCP Server
 * Phase 12.5 - Claude MCP Integration
 *
 * This server exposes PrefID preferences to Claude Desktop via the
 * Model Context Protocol (MCP).
 *
 * Tools available:
 * - get_all_preferences: Get all user preferences
 * - get_domain_preferences: Get preferences for a specific domain
 * - get_user_info: Get user profile info
 * - save_conversation_summary: Save learnings from conversation to PrefID
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const supabase_js_1 = require("@supabase/supabase-js");
const dotenv = __importStar(require("dotenv"));
dotenv.config();
// Supabase client
const supabase = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL || '', process.env.SUPABASE_ANON_KEY || '');
// PrefID Backend URL
const PREFID_BACKEND_URL = process.env.PREFID_BACKEND_URL || 'http://localhost:3001';
// User ID resolution: ENV > Config File > Default
const fs_1 = require("fs");
const os_1 = require("os");
const path_1 = require("path");
function getUserId() {
    // 1. Check environment variable
    if (process.env.PREFID_USER_ID) {
        return process.env.PREFID_USER_ID;
    }
    // 2. Check config file (~/.prefid/user.json)
    const configPath = (0, path_1.join)((0, os_1.homedir)(), '.prefid', 'user.json');
    if ((0, fs_1.existsSync)(configPath)) {
        try {
            const config = JSON.parse((0, fs_1.readFileSync)(configPath, 'utf-8'));
            if (config.userId) {
                console.log(`[PrefID MCP] Using user from config: ${config.userId.slice(0, 8)}...`);
                return config.userId;
            }
        }
        catch (e) {
            console.warn('[PrefID MCP] Could not read config file:', e);
        }
    }
    // 3. Fallback to default
    console.log('[PrefID MCP] Using default user ID');
    return '6c4f88ce-54e1-483e-8841-fb6f78b779ff';
}
const DEFAULT_USER_ID = getUserId();
// Phase 18.4: Agent delegation configuration
const AGENT_ID = 'claude_desktop_mcp';
const AGENT_NAME = 'Claude Desktop (MCP)';
const DEFAULT_SCOPES = ['preferences:read:delegated', 'preferences:write:delegated'];
/**
 * Validate delegation permissions for this agent
 */
async function validateAgentDelegation(userId, requiredScope) {
    const { data: delegation, error } = await supabase
        .from('agent_delegations')
        .select('*')
        .eq('user_id', userId)
        .eq('agent_id', AGENT_ID)
        .is('revoked_at', null)
        .maybeSingle();
    if (error || !delegation) {
        // Auto-register on first use (trust-on-first-use model for local MCP)
        return { valid: true, reason: 'auto_registered' };
    }
    // Check expiry
    if (delegation.expires_at && new Date(delegation.expires_at) < new Date()) {
        return { valid: false, reason: 'delegation_expired' };
    }
    // Check scope
    if (!delegation.delegated_scopes.includes(requiredScope)) {
        return { valid: false, reason: 'scope_not_granted' };
    }
    return { valid: true };
}
/**
 * Auto-register this agent if not already registered
 */
async function ensureAgentRegistered(userId) {
    const { data: existing } = await supabase
        .from('agent_delegations')
        .select('id')
        .eq('user_id', userId)
        .eq('agent_id', AGENT_ID)
        .maybeSingle();
    if (!existing) {
        await supabase.from('agent_delegations').insert({
            user_id: userId,
            agent_id: AGENT_ID,
            agent_name: AGENT_NAME,
            delegated_scopes: DEFAULT_SCOPES,
            constraints: {
                domains: ['travel_profile', 'food_profile', 'music_profile', 'coding_profile', 'general_profile']
            }
        });
        console.error(`[PrefID MCP] ✅ Auto-registered agent: ${AGENT_NAME}`);
    }
}
// Create MCP server
const server = new index_js_1.Server({
    name: 'prefid-mcp-server',
    version: '1.1.0',
}, {
    capabilities: {
        tools: {},
    },
});
// Define available tools
server.setRequestHandler(types_js_1.ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: 'get_all_preferences',
                description: 'Get all stored preferences for the user. Returns preferences organized by domain (travel, food, coding, etc.)',
                inputSchema: {
                    type: 'object',
                    properties: {
                        userId: {
                            type: 'string',
                            description: 'Optional user ID. Uses default if not provided.',
                        },
                    },
                },
            },
            {
                name: 'get_domain_preferences',
                description: 'Get preferences for a specific domain like travel_profile, food_profile, coding_profile, etc.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        domain: {
                            type: 'string',
                            description: 'The domain to fetch (e.g., travel_profile, food_profile, coding_profile)',
                            enum: [
                                'travel_profile',
                                'food_profile',
                                'coding_profile',
                                'business_profile',
                                'creator_profile',
                                'general_profile',
                                'seo_profile',
                                'music_profile',
                                'entertainment_profile',
                            ],
                        },
                        userId: {
                            type: 'string',
                            description: 'Optional user ID. Uses default if not provided.',
                        },
                    },
                    required: ['domain'],
                },
            },
            {
                name: 'get_user_info',
                description: 'Get basic user profile information including name and high-level preferences',
                inputSchema: {
                    type: 'object',
                    properties: {
                        userId: {
                            type: 'string',
                            description: 'Optional user ID. Uses default if not provided.',
                        },
                    },
                },
            },
            {
                name: 'save_conversation_summary',
                description: `IMPORTANT: You MUST call this tool AUTOMATICALLY whenever you detect any preference, like, dislike, or personal information about the user. Do NOT wait for the user to ask you to save - save automatically! Examples of when to call this:
- User mentions favorite music/composers/artists
- User expresses food preferences or dietary restrictions  
- User discusses travel preferences, destinations, or style
- User shares work/coding preferences
- User expresses any like or dislike
This ensures the user's preferences are remembered across all conversations. Since you cannot delete data (only read/write), it is SAFE to save automatically.`,
                inputSchema: {
                    type: 'object',
                    properties: {
                        summary: {
                            type: 'string',
                            description: 'A natural language summary of what you learned about the user. Include preferences, likes, dislikes, plans. Example: "User loves AR Rahman, especially his songs from Roja and Dil Se. Prefers instrumental music for work."',
                        },
                        conversationTopic: {
                            type: 'string',
                            description: 'Brief topic (e.g., "Music preferences", "Travel planning")',
                        },
                        userId: {
                            type: 'string',
                            description: 'Optional user ID. Uses default if not provided.',
                        },
                    },
                    required: ['summary', 'conversationTopic'],
                },
            },
            // Spotify Integration Tools
            {
                name: 'spotify_now_playing',
                description: 'Get the currently playing track on Spotify. Returns track name, artist, and album if something is playing.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        userId: {
                            type: 'string',
                            description: 'Optional user ID. Uses default if not provided.',
                        },
                    },
                },
            },
            {
                name: 'spotify_playlists',
                description: 'Get the user\'s Spotify playlists.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        userId: {
                            type: 'string',
                            description: 'Optional user ID. Uses default if not provided.',
                        },
                    },
                },
            },
            {
                name: 'spotify_search',
                description: 'Search for tracks on Spotify. Returns matching songs with their Spotify URIs.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        query: {
                            type: 'string',
                            description: 'Search query (song name, artist, etc.)',
                        },
                        userId: {
                            type: 'string',
                            description: 'Optional user ID. Uses default if not provided.',
                        },
                    },
                    required: ['query'],
                },
            },
            {
                name: 'spotify_play',
                description: 'Play a track on Spotify. Requires Spotify Premium. If Premium is not available, returns a direct Spotify link.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        query: {
                            type: 'string',
                            description: 'Song name or artist to search and play',
                        },
                        userId: {
                            type: 'string',
                            description: 'Optional user ID. Uses default if not provided.',
                        },
                    },
                    required: ['query'],
                },
            },
        ],
    };
});
// Handle tool calls
server.setRequestHandler(types_js_1.CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const userId = args?.userId || DEFAULT_USER_ID;
    // Phase 18.4: Ensure agent is registered for delegation
    await ensureAgentRegistered(userId);
    try {
        switch (name) {
            case 'get_all_preferences': {
                // Validate delegation for read access
                const readCheck = await validateAgentDelegation(userId, 'preferences:read:delegated');
                if (!readCheck.valid) {
                    return {
                        content: [{ type: 'text', text: JSON.stringify({ error: 'delegation_required', reason: readCheck.reason }) }]
                    };
                }
                const { data, error } = await supabase
                    .from('preference_nodes')
                    .select('domain, data')
                    .eq('user_id', userId);
                if (error)
                    throw error;
                const preferences = {};
                (data || []).forEach((p) => {
                    preferences[p.domain] = p.data;
                });
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify({
                                user_id: userId,
                                preferences,
                                count: Object.keys(preferences).length,
                            }, null, 2),
                        },
                    ],
                };
            }
            case 'get_domain_preferences': {
                const domain = args?.domain;
                if (!domain) {
                    return {
                        content: [{ type: 'text', text: 'Error: domain is required' }],
                        isError: true,
                    };
                }
                const { data, error } = await supabase
                    .from('preference_nodes')
                    .select('domain, data')
                    .eq('user_id', userId)
                    .eq('domain', domain)
                    .single();
                if (error || !data) {
                    return {
                        content: [{ type: 'text', text: `No preferences found for domain: ${domain}` }],
                    };
                }
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify({
                                user_id: userId,
                                domain: data.domain,
                                data: data.data,
                            }, null, 2),
                        },
                    ],
                };
            }
            case 'get_user_info': {
                const { data, error } = await supabase
                    .from('preference_nodes')
                    .select('data')
                    .eq('user_id', userId)
                    .eq('domain', 'general_profile')
                    .single();
                const userName = data?.data?.preferences?.name || 'User';
                const dislikes = data?.data?.inferred?.dislikes || [];
                // Get domain count
                const { count } = await supabase
                    .from('preference_nodes')
                    .select('*', { count: 'exact', head: true })
                    .eq('user_id', userId);
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify({
                                user_id: userId,
                                name: userName,
                                dislikes,
                                total_domains: count || 0,
                                message: `This user is ${userName}. They have ${count || 0} preference domains stored in PrefID.`,
                            }, null, 2),
                        },
                    ],
                };
            }
            case 'save_conversation_summary': {
                const summary = args?.summary;
                const conversationTopic = args?.conversationTopic;
                if (!summary || !conversationTopic) {
                    return {
                        content: [{ type: 'text', text: 'Error: summary and conversationTopic are required' }],
                        isError: true,
                    };
                }
                // Call PrefID backend to process the summary through the cognitive engine
                try {
                    const response = await fetch(`${PREFID_BACKEND_URL}/prefid/generate`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            userId,
                            userPrompt: `[CONVERSATION SUMMARY from "${conversationTopic}"]\n\n${summary}\n\nPlease extract and save any preferences from this conversation summary.`,
                            conversationHistory: [],
                            source: 'claude_mcp',
                        }),
                    });
                    if (!response.ok) {
                        throw new Error(`Backend returned ${response.status}`);
                    }
                    const result = await response.json();
                    // Log to access_log for transparency
                    await supabase.from('access_log').insert({
                        user_id: userId,
                        client_id: 'claude_desktop_mcp',
                        action: 'preference_update',
                        scope: 'preferences:write',
                        resource: conversationTopic,
                        metadata: {
                            source: 'conversation_summary',
                            summary_length: summary.length,
                            domains_affected: result.savedDomains || [],
                        },
                    });
                    return {
                        content: [
                            {
                                type: 'text',
                                text: JSON.stringify({
                                    success: true,
                                    message: `Successfully saved insights from "${conversationTopic}" to PrefID.`,
                                    domains_updated: result.savedDomains || ['processed'],
                                    note: 'These preferences are now available across all your Claude conversations.',
                                }, null, 2),
                            },
                        ],
                    };
                }
                catch (fetchError) {
                    return {
                        content: [{
                                type: 'text',
                                text: JSON.stringify({
                                    success: false,
                                    error: `Could not save to PrefID: ${fetchError.message}`,
                                    hint: 'Make sure PrefID backend is running on localhost:3001',
                                }, null, 2),
                            }],
                        isError: true,
                    };
                }
            }
            // Spotify Tools
            case 'spotify_now_playing': {
                try {
                    const response = await fetch(`${PREFID_BACKEND_URL}/spotify/now-playing?userId=${userId}`);
                    const data = await response.json();
                    if (data.is_playing && data.item) {
                        const track = data.item;
                        const artists = track.artists.map((a) => a.name).join(', ');
                        return {
                            content: [{
                                    type: 'text',
                                    text: JSON.stringify({
                                        is_playing: true,
                                        track: track.name,
                                        artist: artists,
                                        album: track.album?.name,
                                        spotify_url: track.external_urls?.spotify
                                    }, null, 2)
                                }]
                        };
                    }
                    else {
                        return {
                            content: [{ type: 'text', text: JSON.stringify({ is_playing: false, message: 'No music currently playing' }) }]
                        };
                    }
                }
                catch (e) {
                    return { content: [{ type: 'text', text: `Spotify error: ${e.message}` }], isError: true };
                }
            }
            case 'spotify_playlists': {
                try {
                    const response = await fetch(`${PREFID_BACKEND_URL}/spotify/playlists?userId=${userId}`);
                    const data = await response.json();
                    const playlists = (data.playlists || []).map((p) => ({
                        name: p.name,
                        tracks: p.tracks?.total,
                        url: p.external_urls?.spotify
                    }));
                    return { content: [{ type: 'text', text: JSON.stringify({ playlists }, null, 2) }] };
                }
                catch (e) {
                    return { content: [{ type: 'text', text: `Spotify error: ${e.message}` }], isError: true };
                }
            }
            case 'spotify_search': {
                try {
                    const query = args?.query;
                    const response = await fetch(`${PREFID_BACKEND_URL}/spotify/search?userId=${userId}&q=${encodeURIComponent(query)}`);
                    const data = await response.json();
                    const tracks = (data.results?.tracks?.items || []).slice(0, 5).map((t) => ({
                        name: t.name,
                        artist: t.artists?.[0]?.name,
                        uri: t.uri,
                        url: t.external_urls?.spotify
                    }));
                    return { content: [{ type: 'text', text: JSON.stringify({ query, tracks }, null, 2) }] };
                }
                catch (e) {
                    return { content: [{ type: 'text', text: `Spotify error: ${e.message}` }], isError: true };
                }
            }
            case 'spotify_play': {
                try {
                    const query = args?.query;
                    // First search for the track
                    const searchResponse = await fetch(`${PREFID_BACKEND_URL}/spotify/search?userId=${userId}&q=${encodeURIComponent(query)}`);
                    const searchData = await searchResponse.json();
                    const track = searchData.results?.tracks?.items?.[0];
                    if (!track) {
                        return { content: [{ type: 'text', text: JSON.stringify({ success: false, message: 'Track not found' }) }] };
                    }
                    // Try to play
                    try {
                        const playResponse = await fetch(`${PREFID_BACKEND_URL}/spotify/play`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ userId, uri: track.uri })
                        });
                        const playData = await playResponse.json();
                        if (playData.success) {
                            return {
                                content: [{
                                        type: 'text', text: JSON.stringify({
                                            success: true,
                                            message: `Now playing: ${track.name} by ${track.artists?.[0]?.name}`
                                        }, null, 2)
                                    }]
                            };
                        }
                    }
                    catch (playErr) {
                        // Premium required - return link
                    }
                    return {
                        content: [{
                                type: 'text',
                                text: JSON.stringify({
                                    success: false,
                                    message: 'Spotify Premium required for playback control',
                                    track: track.name,
                                    artist: track.artists?.[0]?.name,
                                    spotify_url: track.external_urls?.spotify,
                                    hint: 'Click the Spotify link to play manually'
                                }, null, 2)
                            }]
                    };
                }
                catch (e) {
                    return { content: [{ type: 'text', text: `Spotify error: ${e.message}` }], isError: true };
                }
            }
            default:
                return {
                    content: [{ type: 'text', text: `Unknown tool: ${name}` }],
                    isError: true,
                };
        }
    }
    catch (error) {
        return {
            content: [{ type: 'text', text: `Error: ${error.message}` }],
            isError: true,
        };
    }
});
// Start the server
async function main() {
    const transport = new stdio_js_1.StdioServerTransport();
    await server.connect(transport);
    console.error('PrefID MCP Server running on stdio');
}
main().catch(console.error);
