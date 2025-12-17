# @prefid/sdk

> Identity-aware AI memory infrastructure. Portable user preferences for any app or agent.

[![npm version](https://badge.fury.io/js/@prefid%2Fsdk.svg)](https://www.npmjs.com/package/@prefid/sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Installation

```bash
npm install @prefid/sdk
# or
yarn add @prefid/sdk
# or
pnpm add @prefid/sdk
```

## Quick Start

```typescript
import { PrefID } from '@prefid/sdk';

// Initialize with your client ID
const prefid = new PrefID({ 
  clientId: 'your-client-id'
});

// Login (redirects to PrefID)
await prefid.login();

// After callback, get user preferences
const food = await prefid.getPreferences('food_profile');
console.log(food.cuisines); // ['Italian', 'Indian']

// Generate personalized content
const result = await prefid.generate({
  prompt: 'Recommend a restaurant for dinner',
  domains: ['food_profile']
});
console.log(result.content);
```

## Authentication

### Login Flow

```typescript
// On your login page
const prefid = new PrefID({ clientId: 'your-client-id' });
await prefid.login(); // Redirects to PrefID

// On your callback page (/callback)
await prefid.handleCallback();
const user = prefid.getUser();
console.log(`Welcome, ${user.name}!`);
```

### Check Authentication

```typescript
if (prefid.isAuthenticated()) {
  const user = prefid.getUser();
  console.log(user.email);
} else {
  await prefid.login();
}
```

### Logout

```typescript
prefid.logout();
```

## Preferences

### Get Preferences

```typescript
// Typed domains (with autocomplete!)
const food = await prefid.getPreferences('food_profile');
const music = await prefid.getPreferences('music_preferences');
const travel = await prefid.getPreferences('travel_profile');
const coding = await prefid.getPreferences('coding_profile');
const career = await prefid.getPreferences('career_profile');
const finance = await prefid.getPreferences('finance_profile');

// Custom domain (escape hatch)
const custom = await prefid.getPreferences('my_custom_domain' as any);
```

### Update Preferences

```typescript
await prefid.updatePreferences('food_profile', {
  cuisines: ['Italian', 'Japanese', 'Mexican'],
  spice_tolerance: 'hot',
  dietary_restrictions: ['vegetarian']
});
```

### Get All Preferences

```typescript
const all = await prefid.getAllPreferences();
console.log(all.food_profile);
console.log(all.travel_profile);
```

## Generation

Generate personalized content using AI + user preferences:

```typescript
const result = await prefid.generate({
  prompt: 'Plan a weekend trip for me',
  domains: ['travel_profile', 'food_profile'],
  context: {
    date: '2024-01-15',
    budget: 500
  }
});

console.log(result.content);
console.log(result.preferences_used);
```

## Thinking Profile (AoT)

**NEW in v0.2.0:** Learn and apply thinking preferences that govern HOW AI responds.

### Get Thinking Profile

```typescript
const profile = await prefid.getThinkingProfile();

console.log(profile.atoms); 
// [{ 
//   atom: 'prefers_stepwise_reasoning',
//   priority_bucket:' ordering',
//   confidence: 0.7,
//   lifecycle_state: 'active'
// }]
```

### Learn Thinking Preferences

```typescript
// AI will learn your thinking preference
await prefid.learnThought('I prefer step-by-step explanations');
await prefid.learnThought('I like a recommendation, not multiple options');
```

### Get Agent Hints

Clean contract for AI agents - no internals, just behavior values:

```typescript
const hints = await prefid.getAgentHints();

console.log(hints);
// {
//   contract_version: 'v1',
//   reasoning: 'stepwise',
//   verbosity: 'default',
//   decision: 'recommend',
//   autonomy: 'default',
//   description: 'Structure responses step-by-step. Give one clear recommendation.',
//   atom_count: 2
// }
```

### Introspection (Why)

Get explanation of current AI behavior:

```typescript
const why = await prefid.getWhy();

console.log(why.explanation);
// "I'm responding this way because you prefer step-by-step explanations..."

console.log(why.active_atoms);
// [{ atom: 'prefers_stepwise_reasoning', bucket: 'ordering', effect: '...' }]
```

### Learning Budget

Check usage status:

```typescript
const budget = await prefid.getBudgetStatus('thinking_profile');

console.log(`${budget.remaining}/${budget.monthly_cap} atoms remaining`);
// "8/10 atoms remaining"

console.log(budget.cooldown_active); // false
```

## Configuration

```typescript
const prefid = new PrefID({
  // Required
  clientId: 'your-client-id',
  
  // Optional
  baseUrl: 'https://prefid-production.up.railway.app', // Your PrefID server
  redirectUri: 'https://yourapp.com/callback',         // OAuth callback
  scopes: ['general_profile', 'food_profile'],         // Requested scopes
  debug: true                                          // Enable logging
});
```

## TypeScript Support

Full TypeScript support with typed domains:

```typescript
import type { 
  FoodProfile, 
  MusicPreferences,
  PrefIDDomain 
} from '@prefid/sdk';

const food: FoodProfile = await prefid.getPreferences('food_profile');
food.cuisines // string[] | undefined - fully typed!
```

## Available Domains

| Domain | Description |
|--------|-------------|
| `general_profile` | Basic user info, language, timezone |
| `music_preferences` | Genres, artists, listening habits |
| `food_profile` | Cuisines, dietary restrictions, favorites |
| `travel_profile` | Destinations, travel style, preferences |
| `coding_profile` | Languages, frameworks, tools, style |
| `career_profile` | Industry, skills, goals |
| `finance_profile` | Risk tolerance, investment interests |

## Available Scopes

| Scope | Access | Description |
|-------|--------|-------------|
| `preferences:read` | 🔵 Read | View user preferences |
| `preferences:write` | 🟠 Write | Update user preferences |
| `profile:read` | 🔵 Read | View basic user info (name, email) |

## Error Handling

```typescript
import { AuthenticationError, PrefIDError } from '@prefid/sdk';

try {
  await prefid.getPreferences('food_profile');
} catch (error) {
  if (error instanceof AuthenticationError) {
    // Redirect to login
    await prefid.login();
  } else if (error instanceof PrefIDError) {
    console.error(`Error ${error.code}: ${error.message}`);
  }
}
```

## React Integration

For React apps, use `@prefid/react`:

```bash
npm install @prefid/react
```

```tsx
import { PrefIDProvider, usePreferences, LoginButton } from '@prefid/react';

function App() {
  return (
    <PrefIDProvider clientId="your-client-id">
      <MyComponent />
    </PrefIDProvider>
  );
}

function MyComponent() {
  const { data: food, isLoading } = usePreferences('food_profile');
  
  if (isLoading) return <div>Loading...</div>;
  
  return <div>Favorite cuisines: {food?.cuisines?.join(', ')}</div>;
}
```

## Getting a Client ID

1. Visit [pref-id.vercel.app](https://pref-id.vercel.app)
2. Sign up / Login
3. Go to Developer Settings
4. Create an OAuth Application
5. Copy your Client ID

## Use Cases

PrefID powers personalization across multiple domains:

- **🎵 Music Apps** - Spotify, Apple Music integrations for personalized recommendations
- **🍕 Food Delivery** - DoorDash, Uber Eats for dietary preferences and cuisine matching
- **✈️ Travel Booking** - Expedia, Airbnb for travel style and accommodation preferences
- **💻 Developer Tools** - IDE plugins, code assistants with coding style preferences
- **💰 Finance Apps** - Investment platforms with risk tolerance and goals
- **📈 Career Platforms** - LinkedIn, job boards with career goals and work style

[See all use cases →](https://pref-id.vercel.app/use-cases)

## Semantic Firewall™

PrefID uses a **Semantic Firewall™** to prevent memory corruption:

- ✅ **Domain Isolation** - Music can't leak into finance
- ✅ **Deterministic Routing** - 335+ curated terms mapped to domains
- ✅ **No Hallucination** - Overrides LLM guessing with vocabulary registry
- ✅ **Zero Cross-Contamination** - AR Rahman stays in `music_preferences`, not `food_profile`

Unlike memory APIs that store unstructured blobs, PrefID enforces strict boundaries.

## Integrations

### CustomGPT

Add PrefID to ChatGPT:

🤖 **[PrefID Assistant](https://chatgpt.com/g/g-694008c8de188191bebc93b737d40af3-prefid-assistant)** - Official ChatGPT integration

### MCP (Model Context Protocol)

Use PrefID with Claude Desktop:

```bash
npm install -g @prefid/mcp
```

[PrefID MCP Server →](https://github.com/Talentxmdu/PrefID-MCP)

### AI Agents

PrefID works with any AI agent framework:
- LangChain
- AutoGPT
- CrewAI
- Semantic Kernel

### Shopify Apps

Build personalized Shopify experiences with PrefID's e-commerce integrations.

## Stats

🎉 **104 weekly downloads** - Launched 3 days ago!

Thank you to our early adopters building with PrefID.

## Support

Questions? Reach out:

📧 **sriram.srinivasdesikan@gmail.com**

## Links

- 🌐 [Website](https://pref-id.vercel.app)
- 📖 [Documentation](https://pref-id.vercel.app/docs)
- 💬 [Why PrefID?](https://pref-id.vercel.app/why)
- 💰 [Pricing](https://pref-id.vercel.app/pricing)
- 🐙 [GitHub (SDK)](https://github.com/Talentxmdu/PREFID-SDK)
- 🤖 [CustomGPT](https://chatgpt.com/g/g-694008c8de188191bebc93b737d40af3-prefid-assistant)
- 🔌 [MCP Server](https://github.com/Talentxmdu/PrefID-MCP)

## License

MIT © PrefID Team
