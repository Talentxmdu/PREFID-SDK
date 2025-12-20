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

1. Visit [prefid.in](https://prefid.in)
2. Sign up / Login
3. Go to Developer Settings
4. Create an OAuth Application
5. Copy your Client ID

## Links

- [Documentation](https://prefid.in/docs)
- [GitHub](https://github.com/Talentxmdu/PrefID)
- [API Reference](https://prefid-production.up.railway.app/docs)

## License

MIT © PrefID Team
