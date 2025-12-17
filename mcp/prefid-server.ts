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

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

// Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_ANON_KEY || ''
);

// PrefID Backend URL
const PREFID_BACKEND_URL = process.env.PREFID_BACKEND_URL || 'http://localhost:3001';

// User ID resolution: ENV > Config File > Default
import { readFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

function getUserId(): string {
    // 1. Check environment variable
    if (process.env.PREFID_USER_ID) {
        return process.env.PREFID_USER_ID;
    }

    // 2. Check config file (~/.prefid/user.json)
    const configPath = join(homedir(), '.prefid', 'user.json');
    if (existsSync(configPath)) {
        try {
            const config = JSON.parse(readFileSync(configPath, 'utf-8'));
            if (config.userId) {
                console.log(`[PrefID MCP] Using user from config: ${config.userId.slice(0, 8)}...`);
                return config.userId;
            }
        } catch (e) {
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
async function validateAgentDelegation(userId: string, requiredScope: string): Promise<{ valid: boolean; reason?: string }> {
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
async function ensureAgentRegistered(userId: string): Promise<void> {
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
const server = new Server(
    {
        name: 'prefid-mcp-server',
        version: '1.1.0',
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

// Define available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
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
                            description: 'The domain to fetch (e.g., travel_profile, food_profile, coding_profile, finance_profile)',
                            enum: [
                                'travel_profile',
                                'food_profile',
                                'coding_profile',
                                'business_profile',
                                'creator_profile',
                                'general_profile',
                                'seo_profile',
                                'music_profile',
                                'music_preferences',
                                'entertainment_profile',
                                'finance_profile', // Phase 37: Scoped finance preferences (read-only)
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
                description: `IMPORTANT: You MUST call this tool AUTOMATICALLY whenever you detect any preference, like, dislike, or personal information about the user. Do NOT wait for the user to ask you to save - save automatically!

Signal Types (choose appropriately):
- 'mood_signal': Temporary feelings/vibes (24h) - "I'm in the mood for...", "feels nostalgic"
- 'situational': Time-bound context (7d) - "today I'm working on...", "this week I'm..."
- 'stated': Explicit preferences (90d) - "I love...", "I prefer...", "I hate..."
- 'explicit': User-set settings (permanent) - "Set my preference to..."
- 'inferred': Learned patterns (30d) - default if unsure

Examples:
- User mentions favorite music → signalType: 'stated'
- User says "feeling nostalgic" → signalType: 'mood_signal'
- User says "today I'm working late" → signalType: 'situational'`,
                inputSchema: {
                    type: 'object',
                    properties: {
                        summary: {
                            type: 'string',
                            description: 'A natural language summary of what you learned about the user. Include preferences, likes, dislikes, plans.',
                        },
                        conversationTopic: {
                            type: 'string',
                            description: 'Brief topic (e.g., "Music preferences", "Travel planning")',
                        },
                        signalType: {
                            type: 'string',
                            enum: ['mood_signal', 'situational', 'inferred', 'stated', 'explicit'],
                            description: 'Type of signal: mood_signal (24h), situational (7d), inferred (30d default), stated (90d), explicit (permanent)',
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
            {
                name: 'spotify_recommend',
                description: 'Get personalized music recommendations based on user\'s music profile. Can filter by mood (chill, energetic, focus, workout, happy, sad) or search query. Uses hybrid scoring based on user\'s favorite artists and listening history.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        mood: {
                            type: 'string',
                            description: 'Optional mood filter: chill, energetic, focus, workout, happy, sad',
                        },
                        query: {
                            type: 'string',
                            description: 'Optional search query. If not provided, auto-generates from user preferences.',
                        },
                        limit: {
                            type: 'number',
                            description: 'Number of recommendations to return (default 5, max 20)',
                        },
                        userId: {
                            type: 'string',
                            description: 'Optional user ID. Uses default if not provided.',
                        },
                    },
                },
            },
            // Career Profile & Intelligence Tools
            {
                name: 'get_career_profile',
                description: 'Get the user\'s career profile including skills, experience, education, industries, and career goals. Use this to understand their background before giving career advice.',
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
                name: 'get_career_advice',
                description: 'Get personalized career direction advice based on the user\'s profile. Use for questions like "What path should I take?", "What skills should I learn?", "What\'s my salary potential?". This provides GUIDANCE, not job search. Do NOT use this for finding jobs.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        question: {
                            type: 'string',
                            description: 'The user\'s career question',
                        },
                        focus_area: {
                            type: 'string',
                            enum: ['skills', 'roles', 'salary', 'roadmap', 'general'],
                            description: 'Area to focus advice on',
                        },
                        userId: {
                            type: 'string',
                            description: 'Optional user ID. Uses default if not provided.',
                        },
                    },
                    required: ['question'],
                },
            },
            // Learning Recommendations
            {
                name: 'get_course_recommendations',
                description: 'Get personalized Coursera course recommendations based on user\'s skill gaps. Analyzes the career profile to suggest courses that fill critical skill gaps for target roles.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        target_role: {
                            type: 'string',
                            description: 'Optional target role to analyze skill gaps for. If not provided, uses best matching role.',
                        },
                        userId: {
                            type: 'string',
                            description: 'Optional user ID. Uses default if not provided.',
                        },
                    },
                },
            },
            // YouTube Learning Videos
            {
                name: 'get_learning_videos',
                description: 'Get YouTube video tutorials based on user\'s skill gaps. Returns real-time video recommendations from educational channels like freeCodeCamp, Fireship, and more.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        target_role: {
                            type: 'string',
                            description: 'Optional target role to analyze skill gaps for.',
                        },
                        userId: {
                            type: 'string',
                            description: 'Optional user ID. Uses default if not provided.',
                        },
                    },
                },
            },
            // Role Fit Scoring (BGE Powered)
            {
                name: 'get_role_fit_score',
                description: 'Calculate how well the user matches a specific target role (e.g., Staff Engineer, Engineering Manager, Cloud Architect). Returns a fit score (0-1), category, and gap analysis using BGE vector similarity.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        role_name: {
                            type: 'string',
                            description: 'The exact name of the role to check fit for (e.g. "Staff Engineer", "Cloud Architect").'
                        },
                        userId: {
                            type: 'string',
                            description: 'Optional user ID. Uses default if not provided.'
                        }
                    },
                    required: ['role_name']
                }
            },
            // Role Recommendations (BGE Powered)
            {
                name: 'get_role_recommendations',
                description: 'Get a ranked list of best-fit career roles for the user based on their skills and experience using vector similarity search. Returns role names and fit scores.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        limit: {
                            type: 'number',
                            description: 'Number of recommendations (default 5)'
                        },
                        userId: {
                            type: 'string',
                            description: 'Optional user ID. Uses default if not provided.'
                        }
                    }
                }
            },
            // Coding DNA - Get User's Coding Style
            {
                name: 'get_coding_style',
                description: `Get the user's coding style preferences for personalized code generation. Returns naming conventions, formatting preferences, patterns, anti-patterns, and frameworks the user prefers. Use this BEFORE generating any code to match the user's style.`,
                inputSchema: {
                    type: 'object',
                    properties: {
                        language: {
                            type: 'string',
                            description: 'Optional programming language filter (e.g., typescript, python, go). Returns global style if not specified.',
                        },
                        includeAntiPatterns: {
                            type: 'boolean',
                            description: 'Include patterns the user wants to AVOID (default true)',
                        },
                        userId: {
                            type: 'string',
                            description: 'Optional user ID. Uses default if not provided.',
                        },
                    },
                },
            }
        ],
    };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const userId = (args?.userId as string) || DEFAULT_USER_ID;

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

                if (error) throw error;

                const preferences: Record<string, any> = {};
                (data || []).forEach((p: any) => {
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
                let domain = args?.domain as string;
                if (!domain) {
                    return {
                        content: [{ type: 'text', text: 'Error: domain is required' }],
                        isError: true,
                    };
                }

                // Map music_profile to music_preferences (stored domain name)
                if (domain === 'music_profile') {
                    domain = 'music_preferences';
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
                const summary = args?.summary as string;
                const conversationTopic = args?.conversationTopic as string;
                const signalType = args?.signalType as string || null;

                if (!summary || !conversationTopic) {
                    return {
                        content: [{ type: 'text', text: 'Error: summary and conversationTopic are required' }],
                        isError: true,
                    };
                }

                // Define signal type descriptions for response
                const signalDescriptions: Record<string, string> = {
                    mood_signal: 'Mood signal (24h decay)',
                    situational: 'Situational context (7d decay)',
                    inferred: 'Inferred preference (30d decay)',
                    stated: 'Stated preference (90d decay)',
                    explicit: 'Explicit setting (permanent)',
                };

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
                            signalType: signalType, // Pass signal type for classification
                        }),
                    });

                    if (!response.ok) {
                        throw new Error(`Backend returned ${response.status}`);
                    }

                    const result = await response.json();
                    const appliedSignalType = signalType || result.detectedSignalType || 'inferred';

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
                            signal_type: appliedSignalType,
                        },
                    });

                    return {
                        content: [
                            {
                                type: 'text',
                                text: JSON.stringify({
                                    success: true,
                                    message: `Saved insights from "${conversationTopic}" to PrefID.`,
                                    signal_type: appliedSignalType,
                                    signal_info: signalDescriptions[appliedSignalType] || 'Auto-classified',
                                    domains_updated: result.savedDomains || ['processed'],
                                    note: appliedSignalType === 'mood_signal'
                                        ? 'This mood signal will influence short-term but decay after 24h.'
                                        : appliedSignalType === 'situational'
                                            ? 'This context will be remembered for 7 days.'
                                            : 'These preferences are now available across all your conversations.',
                                }, null, 2),
                            },
                        ],
                    };
                } catch (fetchError: any) {
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
                        const artists = track.artists.map((a: any) => a.name).join(', ');
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
                    } else {
                        return {
                            content: [{ type: 'text', text: JSON.stringify({ is_playing: false, message: 'No music currently playing' }) }]
                        };
                    }
                } catch (e: any) {
                    return { content: [{ type: 'text', text: `Spotify error: ${e.message}` }], isError: true };
                }
            }

            case 'spotify_playlists': {
                try {
                    const response = await fetch(`${PREFID_BACKEND_URL}/spotify/playlists?userId=${userId}`);
                    const data = await response.json();
                    const playlists = (data.playlists || []).map((p: any) => ({
                        name: p.name,
                        tracks: p.tracks?.total,
                        url: p.external_urls?.spotify
                    }));
                    return { content: [{ type: 'text', text: JSON.stringify({ playlists }, null, 2) }] };
                } catch (e: any) {
                    return { content: [{ type: 'text', text: `Spotify error: ${e.message}` }], isError: true };
                }
            }

            case 'spotify_search': {
                try {
                    const query = args?.query as string;
                    const response = await fetch(`${PREFID_BACKEND_URL}/spotify/search?userId=${userId}&q=${encodeURIComponent(query)}`);
                    const data = await response.json();
                    const tracks = (data.results?.tracks?.items || []).slice(0, 5).map((t: any) => ({
                        name: t.name,
                        artist: t.artists?.[0]?.name,
                        uri: t.uri,
                        url: t.external_urls?.spotify
                    }));
                    return { content: [{ type: 'text', text: JSON.stringify({ query, tracks }, null, 2) }] };
                } catch (e: any) {
                    return { content: [{ type: 'text', text: `Spotify error: ${e.message}` }], isError: true };
                }
            }

            case 'spotify_play': {
                try {
                    const query = args?.query as string;
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
                    } catch (playErr) {
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
                } catch (e: any) {
                    return { content: [{ type: 'text', text: `Spotify error: ${e.message}` }], isError: true };
                }
            }

            case 'spotify_recommend': {
                try {
                    const mood = args?.mood as string;
                    const query = args?.query as string;
                    const limit = Math.min((args?.limit as number) || 5, 20);

                    const response = await fetch(`${PREFID_BACKEND_URL}/spotify/recommend`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userId, mood, query, limit })
                    });
                    const data = await response.json();

                    if (data.error) {
                        return { content: [{ type: 'text', text: `Spotify error: ${data.error}` }], isError: true };
                    }

                    const recommendations = (data.recommendations || []).map((r: any) => ({
                        name: r.name,
                        artist: r.artist,
                        score: r.score,
                        spotify_url: r.spotify_url
                    }));

                    return {
                        content: [{
                            type: 'text',
                            text: JSON.stringify({
                                recommendations,
                                query_used: data.query,
                                mood: data.mood,
                                user_profile: data.user_profile
                            }, null, 2)
                        }]
                    };
                } catch (e: any) {
                    return { content: [{ type: 'text', text: `Spotify recommend error: ${e.message}` }], isError: true };
                }
            }

            case 'get_career_profile': {
                try {
                    const response = await fetch(`${PREFID_BACKEND_URL}/career/profile?userId=${userId}`);
                    const data = await response.json();

                    if (data.error) {
                        return {
                            content: [{
                                type: 'text',
                                text: JSON.stringify({
                                    error: data.error,
                                    hint: 'User needs to upload their CV first. They can do this at the PrefID dashboard.'
                                }, null, 2)
                            }]
                        };
                    }

                    const profile = data.profile;
                    return {
                        content: [{
                            type: 'text',
                            text: JSON.stringify({
                                name: profile.personal?.name,
                                current_role: profile.current_role,
                                seniority: profile.seniority,
                                total_experience_years: profile.total_experience_years,
                                skills: profile.skills,
                                experience: profile.experience?.map((e: any) => ({
                                    title: e.title,
                                    company: e.company,
                                    duration_months: e.duration_months,
                                    highlights: e.highlights?.slice(0, 3)
                                })),
                                education: profile.education,
                                industries: profile.industries,
                                certifications: profile.certifications,
                                career_goals: profile.career_goals,
                                languages: profile.languages
                            }, null, 2)
                        }]
                    };
                } catch (e: any) {
                    return { content: [{ type: 'text', text: `Career profile error: ${e.message}` }], isError: true };
                }
            }

            case 'get_career_advice': {
                try {
                    const question = args?.question as string;
                    const focusArea = args?.focus_area as string || 'general';

                    // Call the career advice endpoint
                    const response = await fetch(`${PREFID_BACKEND_URL}/career/advice`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            userId,
                            question,
                            focus_area: focusArea
                        })
                    });
                    const advice = await response.json();

                    if (advice.error) {
                        return {
                            content: [{
                                type: 'text',
                                text: JSON.stringify({
                                    error: advice.error,
                                    hint: 'User needs to upload their CV first to get personalized career advice.',
                                    suggestion: 'Ask the user to upload their CV at the PrefID dashboard.'
                                }, null, 2)
                            }]
                        };
                    }

                    return {
                        content: [{
                            type: 'text',
                            text: JSON.stringify(advice, null, 2)
                        }]
                    };
                } catch (e: any) {
                    return { content: [{ type: 'text', text: `Career advice error: ${e.message}` }], isError: true };
                }
            }

            case 'get_course_recommendations': {
                try {
                    const targetRole = args?.target_role as string;

                    // Build URL with optional target_role
                    let url = `${PREFID_BACKEND_URL}/career/courses?userId=${userId}`;
                    if (targetRole) {
                        url += `&target_role=${encodeURIComponent(targetRole)}`;
                    }

                    const response = await fetch(url);
                    const data = await response.json();

                    if (data.error) {
                        return {
                            content: [{
                                type: 'text',
                                text: JSON.stringify({
                                    error: data.error,
                                    hint: 'User needs to upload their CV first to get course recommendations.'
                                }, null, 2)
                            }]
                        };
                    }

                    return {
                        content: [{
                            type: 'text',
                            text: JSON.stringify(data, null, 2)
                        }]
                    };
                } catch (e: any) {
                    return { content: [{ type: 'text', text: `Course recommendations error: ${e.message}` }], isError: true };
                }
            }

            case 'get_role_fit_score': {
                try {
                    const roleName = args?.role_name as string;
                    if (!roleName) {
                        return { content: [{ type: 'text', text: 'Error: role_name is required' }], isError: true };
                    }

                    const response = await fetch(`${PREFID_BACKEND_URL}/career/role-fit`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userId, role: roleName })
                    });
                    const data = await response.json();

                    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
                } catch (e: any) {
                    return { content: [{ type: 'text', text: `Error calculating role fit: ${e.message}` }], isError: true };
                }
            }

            case 'get_role_recommendations': {
                try {
                    const limit = args?.limit || 5;
                    const response = await fetch(`${PREFID_BACKEND_URL}/career/role-recommendations?userId=${userId}&limit=${limit}`);
                    const data = await response.json();

                    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
                } catch (e: any) {
                    return { content: [{ type: 'text', text: `Error getting recommendations: ${e.message}` }], isError: true };
                }
            }

            case 'get_learning_videos': {
                try {
                    const targetRole = args?.target_role as string;

                    // Build URL with optional target_role
                    let url = `${PREFID_BACKEND_URL}/career/videos?userId=${userId}`;
                    if (targetRole) {
                        url += `&target_role=${encodeURIComponent(targetRole)}`;
                    }

                    const response = await fetch(url);
                    const data = await response.json();

                    if (data.error) {
                        return {
                            content: [{
                                type: 'text',
                                text: JSON.stringify({
                                    error: data.error,
                                    hint: 'User needs to upload their CV first to get video recommendations.'
                                }, null, 2)
                            }]
                        };
                    }

                    return {
                        content: [{
                            type: 'text',
                            text: JSON.stringify(data, null, 2)
                        }]
                    };
                } catch (e: any) {
                    return { content: [{ type: 'text', text: `Video recommendations error: ${e.message}` }], isError: true };
                }
            }

            // Coding DNA - Get User's Coding Style
            case 'get_coding_style': {
                try {
                    const language = args?.language as string;
                    const includeAntiPatterns = args?.includeAntiPatterns !== false;

                    // Call the coding style API
                    let url = `${PREFID_BACKEND_URL}/coding/style?userId=${userId}`;
                    if (language) {
                        url += `&language=${encodeURIComponent(language)}`;
                    }

                    const response = await fetch(url);
                    const data = await response.json();

                    if (data.error) {
                        return {
                            content: [{
                                type: 'text',
                                text: JSON.stringify({
                                    error: data.error,
                                    hint: 'User has not set up their coding style yet. You can help them by asking about their preferences or analyzing their code.'
                                }, null, 2)
                            }]
                        };
                    }

                    // Format for AI consumption
                    const style = data.style;
                    const formattedResponse = {
                        language: style.language || 'global',
                        naming: style.naming,
                        quotes: style.quotes,
                        semicolons: style.semicolons,
                        indent: style.indent,
                        functionStyle: style.functionStyle,
                        errorHandling: style.errorHandling,
                        earlyReturns: style.earlyReturns,
                        patterns: style.patterns || [],
                        ...(includeAntiPatterns && { antiPatterns: style.antiPatterns || [] }),
                        frameworks: style.frameworks || [],
                        summary: style.summary,
                        instruction: 'GENERATE CODE FOLLOWING THESE PREFERENCES. Match naming, quotes, indentation, and patterns. AVOID anti-patterns listed.'
                    };

                    return {
                        content: [{
                            type: 'text',
                            text: JSON.stringify(formattedResponse, null, 2)
                        }]
                    };
                } catch (e: any) {
                    return { content: [{ type: 'text', text: `Coding style error: ${e.message}` }], isError: true };
                }
            }

            default:
                return {
                    content: [{ type: 'text', text: `Unknown tool: ${name}` }],
                    isError: true,
                };
        }
    } catch (error: any) {
        return {
            content: [{ type: 'text', text: `Error: ${error.message}` }],
            isError: true,
        };
    }
});

// Start the server
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('PrefID MCP Server running on stdio');
}

main().catch(console.error);
