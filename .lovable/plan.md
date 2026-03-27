
Goal: make Step 8 reliably produce a real 45–60 second video in-app, and be honest when it cannot.

What I found
- The latest failed job never reached Runway. It failed earlier while generating the script because the backend AI gateway returned `402 Not enough credits`.
- Even when the job succeeds, the current Runway call can only create a single 5-second clip:
  - it sends only the first scene image to Runway
  - it sets `duration: 5`
  - it only renders up to 4 scene images
- So the current pipeline cannot produce a 45–60 second final video, even with the aspect-ratio fix.
- The Step 8 UI also does not poll the job after starting it, so it cannot show the finished video in-place the way the onboarding flow does.

What needs to change
1. Make the Video Studio UI actually wait for the job and display the finished video
- Reuse the polling pattern already used in `CreateVideoFlow`
- Show statuses like script, scene prep, clip rendering, stitching, ready
- Surface exact blocking errors in the UI instead of only a toast

2. Replace the single-clip Runway call with a multi-clip pipeline
- Generate a 45–60 second plan as 6–12 short scenes
- Render one Runway clip per scene
- Store all clip URLs
- Stitch them into one final MP4 in the backend/client flow
- Save the final MP4 back to storage and show it in-app

3. Remove the hidden “credits” blocker from the Runway path
- Right now the pipeline still depends on Lovable AI credits for script + image generation
- For a true Runway-first path, add a no-credit fallback that builds scene prompts from the business profile and selected platform using deterministic templates instead of paid AI text generation
- If richer AI scripting is available, use it; if not, continue with the template-based prompt builder so the job can still reach Runway

4. Enforce the user’s duration requirement
- Add a minimum final duration rule of 45 seconds
- Map production modes to real target durations, for example:
  - quick: 45 sec
  - standard: 60 sec
  - longform: 90+ sec
- Ensure scene counts and per-scene durations add up to the requested runtime

5. Finish the delivery flow
- Save the final MP4 to the job record and `content_posts`
- Show “Post manually” links/buttons for the chosen platform(s)
- Keep captions, hashtags, and thumbnail attached to the finished asset

Recommended implementation order
1. Fix Step 8 to poll and render job progress/results in-app
2. Refactor `generate-video` to create multiple Runway clips instead of one 5-second clip
3. Add final assembly into one 45–60 second MP4
4. Add the no-credit template prompt path so Runway can still work when AI credits are exhausted
5. Update Watch Video / Ready to Post to always prefer the final MP4

Technical notes
- `supabase/functions/generate-video/index.ts` is the main blocker:
  - it currently slices scenes to 4
  - uses only `sceneImageUrls[0]`
  - sends `duration: 5`
- `src/components/dashboard/steps/VideoStudioStep.tsx` starts generation but does not monitor the job
- `src/components/dashboard/CreateVideoFlow.tsx` already contains a useful polling pattern that can be adapted
- The current “completed with images only” state should be changed so it is clearly marked as incomplete when no final video exists

Expected result after this work
- Clicking Produce Video in Step 8 starts a visible pipeline
- The app either:
  - returns a real 45–60 second MP4 generated through Runway and playable inside the app, or
  - shows a precise blocking reason such as exhausted AI credits or Runway render failure
- No more “success” state when only still images were produced
