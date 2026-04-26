# TeNo

TeNo is a keyboard-first personal browser companion for saving links, tracking reminders, managing a shopping cart list, and running a built-in timer from one minimal interface.

It is built with React + Vite and uses Firebase Authentication and Firestore for user accounts and data sync.

## Why TeNo

TeNo is designed as a fast command-center style utility:

- One interface for daily browsing tasks
- Authenticated, user-scoped data in Firestore
- Keyboard shortcuts for faster navigation
- Simple terminal-inspired UI for distraction-free use

## Core Features

- User authentication
  - Google sign-in
  - Email/password login and registration
  - Logout support
- Saved links manager
  - Save URL with nickname and description
  - Favorite/unfavorite links
  - Edit and delete links
  - Move items up/down for manual ordering
  - Open links quickly from keyboard shortcuts `[1]` to `[9]`
- Cart links manager
  - Same link management behavior, backed by a separate Firestore collection
- Reminders
  - Add, edit, reorder, and complete reminders
- Timer
  - Stopwatch mode
  - Countdown mode with minute input
  - Pause, stop, and reset controls
  - Chrome alarm/storage integration when running in extension-compatible context
- Tabbed workspace
  - Links, Cart, Reminders, Timer
  - Cycle tabs with keyboard shortcut `S`
- Data migration helper
  - Automatically migrates legacy top-level collections into `users/{uid}/...` on login

## Tech Stack

- React 19
- Vite 8
- Firebase Auth + Firestore
- lucide-react icons
- CSS (custom terminal-style theme)

## Project Structure

```text
curr-brows/
  public/
  src/
    components/
      Cart.jsx
      LinkStorer.jsx
      Login.jsx
      Reminders.jsx
      Timer.jsx
    App.jsx
    firebase.js
    index.css
    main.jsx
  index.html
  package.json
  vite.config.js
```

## Getting Started

### Prerequisites

- Node.js 18+ (Node.js 20+ recommended)
- npm
- A Firebase project with:
  - Authentication enabled (Google provider and/or Email/Password)
  - Firestore database enabled

### Install

```bash
npm install
```

### Configure Firebase

Current implementation reads Firebase config from `src/firebase.js`.

1. Open `src/firebase.js`
2. Replace the `firebaseConfig` object values with your Firebase Web App credentials
3. Ensure these values are correct in Firebase Console:
   - apiKey
   - authDomain
   - projectId
   - storageBucket
   - messagingSenderId
   - appId
   - measurementId

### Run in Development

```bash
npm run dev
```

### Build for Production

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## Firestore Data Model

User data is stored under subcollections:

- `users/{uid}/saved_links`
- `users/{uid}/cart_items`
- `users/{uid}/reminders`

Each record includes timestamps and feature-specific fields (for example: nickname, url, description, isFavorite).

## Vercel Deployment

This app is Vite-based and deploys cleanly on Vercel.

Recommended settings:

- Framework Preset: Vite
- Root Directory: `curr-brows`
- Install Command: `npm install`
- Build Command: `npm run build`
- Output Directory: `dist`
- Automatic Deployments: Enabled from connected Git branch

If you later move Firebase config to environment variables, use `VITE_...` prefixed variables in Vercel project settings.

## Keyboard Shortcuts

- `S`: switch to next top navigation tab
- `1` to `9` (inside link tabs): open corresponding saved link quickly

## Notes

- The app includes optional `chrome.*` integrations for storage/tab behavior. In normal web deployments, it falls back to standard browser APIs where applicable.
- UI uses a terminal-inspired lowercase visual style by design.

## Scripts

```json
{
  "dev": "vite",
  "build": "vite build",
  "preview": "vite preview"
}
```

## License

ISC
