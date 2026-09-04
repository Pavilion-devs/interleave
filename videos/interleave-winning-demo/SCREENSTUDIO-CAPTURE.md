# Interleave final demo — exact Screen Studio capture

## Final cut target

- Runtime: 1:55–2:10
- Canvas: 1920 × 1080, 16:9
- Product footage: at least 70% of the finished film
- Structure: clean landing → native WebMCP race → exact evidence → guarded replay → contribution
- Record the six takes below separately. HyperFrames will remove waits, reframe the evidence, add narration and captions, and preserve the existing designed open and close.

## Before recording

1. Use the final deployed URL after its commit matches GitHub.
2. Open it in ChatGPT’s in-app browser so the header says **9 native tools**.
3. Set the window to 16:9 and keep browser zoom at 100%.
4. Close unrelated tabs, downloads, notifications, and personal account surfaces.
5. Clear this site’s local storage once, then reload the landing page.
6. Keep the pointer parked outside the product card before each take.
7. Record without narration. The final voiceover and captions will be added in HyperFrames.
8. Leave two seconds of stillness at the beginning and end of every take.

## Take 01 — landing to flagship

**File:** `01-landing-to-plane.mov`  
**Raw length:** 12–15 seconds

1. Start at the landing page with the Interleave hero fully visible.
2. Hold for two seconds.
3. Move the pointer directly to **Launch Demo**.
4. Click once.
5. Let `/plane` finish loading.
6. Hold on the cleaned workbench until **9 native tools** is readable.
7. Stop.

**Do not:** scroll the landing page, open GitHub, or hover across unrelated cards.

## Take 02 — the native human-agent race

**File:** `02-native-race.mov`  
**Raw length:** 30–40 seconds

1. Start on `/plane`.
2. Confirm **Current Plane** is selected.
3. Confirm the worker delay is **15 seconds**.
4. In the ChatGPT conversation attached to the browser, paste this exact prompt:

   > Start a Plane link metadata crawl with a 15-second delay. Do not perform the human metadata edit for me. Keep the tool call pending while I change the page, then report whether my value survived.

5. Send the prompt.
6. As soon as the page shows **CRAWLER QUEUED**, move to **Human metadata override**.
7. Select the complete field value and type:

   `Human verified runbook`

8. Click **Save metadata** once.
9. Do not click **Complete now**. Let the original native tool call finish by itself.
10. Keep the page visible while the worker completes.
11. Hold when the red **RULE VIOLATED** verdict appears.
12. Stop after the agent reports the expected and actual values.

**The required visible order is:** native dispatch → manual human edit → delayed native overwrite.

## Take 03 — inspect the exact failure

**File:** `03-verdict-and-trace.mov`  
**Raw length:** 18–22 seconds

1. Begin with the failed run still visible.
2. Scroll once until the full verdict and execution trace are framed together.
3. Hold for two seconds on:
   - expected **Human verified runbook**
   - actual **Plane documentation**
4. Click event **02 · Human saves explicit metadata**.
5. Hold on its before/after receipt for two seconds.
6. Click event **03 · Explicit metadata overwritten**.
7. Hold on the worker receipt for three seconds.
8. Stop.

## Take 04 — tracker, replay proof, and reduction

**File:** `04-tracker-and-proof.mov`  
**Raw length:** 30–35 seconds

1. Click **Session tracker** in the sidebar.
2. Wait for the just-recorded five-entry session to open automatically.
3. Hold on the counts and ordered receipts for three seconds.
4. Click **Patch proof** in the sidebar.
5. Click **Compare**.
6. Hold until both cards are visible:
   - **Plane preview@da1a7ab · FAIL**
   - **Proposed compare-and-set · PASS**
7. Click **Reduce**.
8. Hold on the three-command minimum:
   - `start_crawl`
   - `edit_metadata`
   - `release`
9. Click **Regression** and hold until the download notice appears.
10. Click **Upstream patch** and hold until the patch notice appears.
11. Stop.

## Take 05 — replay the same recording against the guard

**File:** `05-guarded-replay.mov`  
**Raw length:** 18–24 seconds

1. Click **Plane #9674** in the sidebar.
2. Select **Proposed patch**.
3. Click **Replay recording**.
4. Do not touch the page while the replay runs.
5. Hold when the green verdict appears:
   - **PASS · stale worker rejected**
   - expected **Human verified runbook**
   - actual **Human verified runbook**
   - **RULE HOLDS**
6. Stop.

## Take 06 — reusable developer contribution

**File:** `06-developer-kit.mov`  
**Raw length:** 12–16 seconds

1. Open `/integrate`.
2. Hold on **@interleave/recorder · v0.2.0** and the hero for two seconds.
3. Scroll once to **Make the interleaving observable**.
4. Continue to the minimal TypeScript integration and package install command.
5. Hold for three seconds.
6. Stop.

## Edit map for HyperFrames

| Final time | Visual source            | Point that must land                                                     |
| ---------- | ------------------------ | ------------------------------------------------------------------------ |
| 0:00–0:08  | Existing designed hook   | A successful human save can be erased later.                             |
| 0:08–0:18  | Take 01                  | Interleave and the flagship Plane proof.                                 |
| 0:18–0:48  | Take 02                  | Real native call, human action during the wait, overwrite.               |
| 0:48–1:03  | Take 03                  | Explicit rule, expected value, actual value, actor order.                |
| 1:03–1:30  | Take 04                  | Recorded session, FAIL/PASS comparison, three-command minimum.           |
| 1:30–1:44  | Take 05                  | The same sequence passes with the guard.                                 |
| 1:44–1:56  | Take 04 exports          | Runnable regression, five-file Plane patch, 13 cases, 37/37 Plane tests. |
| 1:56–2:04  | Take 06 + existing close | Reusable recorder and final Interleave lockup.                           |

## Acceptance checklist

Do not begin the final edit unless every answer is yes:

- Does Take 02 visibly show **9 native tools**?
- Does the native call remain pending while the human clicks **Save metadata**?
- Are the expected and actual values readable in Take 03?
- Does Tracker reopen the session that was just recorded?
- Does Patch Proof compare and reduce that recorded failure?
- Does the guarded replay finish with **RULE HOLDS**?
- Are both downloads shown as local artifacts rather than published upstream?
- Is the developer package visible without claiming npm registry publication?
