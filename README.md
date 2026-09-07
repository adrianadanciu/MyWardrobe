# MyWardrobe
A personal wardrobe app that selects every-day outfits based on your profile and on the weather
## What it does
- Add clothes with a photo, category, color, fit, warmth, occasions
- Generate outfits matched to the current weather and to your set color palette/body shape
- Tracks laundry: washable items become "dirty" automatically after a number of wears and are excluded from suggestions until marked washed.
- "Ask for Ideas": describe what you need in free text, and the AI picks pieces from your wardrobe or suggests what to shop for
- Analyzes a photo to suggest a color palette
- Beauty: makeup/skincare products, tracking opened date, expiry (PAO) and neglected products, with a "why aren't you using this" flow that gives tailored advice based on the reason.
- Wear journal, outfit planning, profile with preferences
## `src/` structure
Frontend:
- `screens/` — the app's full screens.
- `components/` — user interface pieces reused across multiple screens
- `theme/` — the app's theme (light/dark colors).
Auth:
- `auth/` — `AuthContext`, wrapping Firebase auth and exposing the current user to the rest of the app.
Backend:
- `services/` — anything involving network or persistence: local storage, weather, AI calls, Firebase auth config, Supabase 
- `utils/` — pure calculations: outfit generation, color matching, laundry logic, date formatting, duplicate checking.
- `constants/` — fixed data: categories, labels, thresholds. Used by both sides, but renders nothing on its own.
## Running it
npm install
npm start
Then `npm run ios`, `npm run android`, or `npm run web`, or scan the QR code from Expo with your phone.
