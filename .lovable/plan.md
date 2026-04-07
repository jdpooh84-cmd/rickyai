

## Make RickyAI Universal: Remove Industry-Specific and Location-Specific Hardcoding

### Problem
The app has pizza-specific and Virginia Beach-specific references baked into several files. A business owner in Tokyo, Lagos, or London would see irrelevant US pizza content.

### Files to Change

**1. `src/pages/DemoVideoShowcase.tsx`** — The biggest offender
- Replace "Donato's Pizza" branding with generic "Sample Business — Video Package"
- Remove the Virginia Beach address and pizza-specific caption/hashtags
- Replace with a generic sample caption template showing placeholders like `[Your City]`, `[Your Business Name]`
- Change download filenames from `donatos-pizza-*.mp4` to `sample-video-*.mp4`
- Keep the actual video files (they're real demo content) but frame them as "sample output"

**2. `src/App.tsx`**
- Change route from `/demo/donatos` to `/demo/video-package`

**3. `src/components/dashboard/CreateVideoFlow.tsx`**
- Change placeholder from `"e.g., Donato's Pizza"` to `"e.g., Sunrise Auto Spa"`

**4. `src/components/dashboard/MediaLibrary.tsx`**
- Broaden the shot-type regex: remove pizza-specific terms (`calzone`, `pepperoni`), keep generic `food` keyword, add business-neutral terms like `product`, `service`, `interior`, `exterior`

**5. `supabase/functions/ai-strategy/index.ts`**
- Replace the pizza example in `unique_details` from `"circle pizza with small square-cut slices"` to something universal like `"hand-crafted signature product"` or `"proprietary method since 1963"`

### What's Already Fine (No Changes Needed)
- Landing page (HeroSection, StepsOverview, PricingSection) — already generic
- All dashboard steps — already industry-agnostic
- Currency: uses `$` in a few places but those are in US federal contracting and pricing contexts which are appropriate
- Date formatting: uses `toLocaleDateString()` which respects the user's browser locale automatically
- AI prompts: already say "local to the same city" not "local to Virginia Beach"

### Summary
5 files changed, all removing hardcoded pizza/Virginia Beach references and replacing with universal placeholders. No structural changes, no new features — just making the existing content work for any business anywhere.

