# @prefid/react

React hooks and components for PrefID - Identity-aware AI memory infrastructure.

## Installation

```bash
npm install @prefid/react @prefid/sdk
# or
yarn add @prefid/react @prefid/sdk
# or
pnpm add @prefid/react @prefid/sdk
```

## Quick Start

```tsx
import { PrefIDProvider, usePreferences, LoginButton } from '@prefid/react';

function App() {
  return (
    <PrefIDProvider clientId="your-client-id">
      <LoginButton />
      <MyComponent />
    </PrefIDProvider>
  );
}

function MyComponent() {
  const { data: food, isLoading, update } = usePreferences('food_profile');
  
  if (isLoading) return <div>Loading...</div>;
  
  return (
    <div>
      <h2>Food Preferences</h2>
      <p>Cuisines: {food?.cuisines?.join(', ')}</p>
      <button onClick={() => update({ cuisines: ['Italian', 'Japanese'] })}>
        Update Preferences
      </button>
    </div>
  );
}
```

## API Reference

### PrefIDProvider

Wraps your app to provide PrefID context.

```tsx
<PrefIDProvider
  clientId="your-client-id"
  baseUrl="https://prefid-production.up.railway.app" // optional
  redirectUri="https://yourapp.com/callback"         // optional
  scopes={['food_profile', 'music_preferences']}     // optional
>
  <App />
</PrefIDProvider>
```

### usePrefID()

Access PrefID context and auth state.

```tsx
function MyComponent() {
  const { prefid, user, isAuthenticated, isLoading, login, logout } = usePrefID();
  
  return (
    <div>
      {isAuthenticated ? (
        <p>Welcome, {user?.name}!</p>
      ) : (
        <button onClick={login}>Login</button>
      )}
    </div>
  );
}
```

### usePreferences(domain)

Fetch and update preferences for a domain.

```tsx
function FoodPreferences() {
  const { data, isLoading, error, refetch, update } = usePreferences('food_profile');
  
  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  
  return (
    <div>
      <p>Cuisines: {data?.cuisines?.join(', ')}</p>
      <button onClick={refetch}>Refresh</button>
      <button onClick={() => update({ 
        cuisines: ['Italian', 'Japanese'] 
      })}>
        Update
      </button>
    </div>
  );
}
```

### LoginButton

Pre-built login/logout button.

```tsx
<LoginButton 
  loginText="Sign in with PrefID"
  logoutText="Sign out"
  showUser={true}
  className="my-button-class"
/>
```

## Available Domains

- `general_profile` - Basic user info
- `music_preferences` - Music taste
- `food_profile` - Food preferences
- `travel_profile` - Travel preferences
- `coding_profile` - Coding style
- `career_profile` - Career goals
- `finance_profile` - Finance preferences

## TypeScript Support

Fully typed with TypeScript. All domain types are inferred automatically:

```tsx
const { data: food } = usePreferences('food_profile');
// `food` is typed as FoodProfile automatically

food?.cuisines // string[] | undefined ✅
```

## Links

- [Documentation](https://pref-id.vercel.app/docs)
- [GitHub](https://github.com/Talentxmdu/PREFID-SDK)
- [Core SDK](https://github.com/Talentxmdu/PREFID-SDK)

## License

MIT © PrefID Team
