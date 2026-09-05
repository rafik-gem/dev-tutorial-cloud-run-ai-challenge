# ReflectAI — User-Authenticated Journaling & Reflection Assistant

A private, multi-turn AI journaling and reflection web application powered by **Gemini 3.6 Flash**, **Firebase Authentication (Google Sign-In)**, **Google Maps Platform**, and **Cloud Firestore**.

All journal entries and AI reflections are strictly isolated to the authenticated user under `/users/{userId}/interactions/{interactionId}` with zero cross-user access.

---

## 1. Architecture Overview

- **Frontend**: React 19 + TypeScript + Tailwind CSS (Vite SPA) + `@vis.gl/react-google-maps`
- **Backend Service**: Express.js proxy with defensive payload parsing, null-safe destructuring & SSRF protection
- **AI Processing Engine**: Gemini 3.6 Flash with an automated 4-tier Resilient Model Fallback Ladder (`gemini-3.6-flash` → `gemini-3.1-flash-lite` → `gemini-flash-latest` → `gemini-3.7-flash`)
- **Identity & Auth**: Firebase Authentication with Google Sign-In (federated identity; no custom password handling)
- **Role-Based Access Control (RBAC)**: Firestore security rules verifying admin privileges for telemetry and directory management
- **Database**: Google Cloud Firestore with owner-bound security rules and strict undefined-stripping payload hygiene
- **External Notifications**: Webhook dispatcher supporting Discord, Slack, and custom webhooks with strict SSRF filtering
- **Secret Management**: Cloud Secret Manager / Environment Variables (`GEMINI_API_KEY` kept strictly server-side)

---

## 2. Prerequisites & Google Cloud APIs

Ensure the following Google Cloud APIs are enabled in your project:

```bash
gcloud services enable \
  run.googleapis.com \
  secretmanager.googleapis.com \
  firestore.googleapis.com \
  aiplatform.googleapis.com \
  maps-backend.googleapis.com
```

---

## 3. Secret Management Setup

Create the `GEMINI_API_KEY` secret in Google Cloud Secret Manager and grant the Cloud Run compute service account access:

```bash
# 1. Create and populate the secret
gcloud secrets create GEMINI_API_KEY --replication-policy="automatic"
echo -n "YOUR_GEMINI_API_KEY" | gcloud secrets versions add GEMINI_API_KEY --data-file=-

# 2. Identify your Cloud Project Number
PROJECT_NUMBER=$(gcloud projects describe $(gcloud config get-value project) --format="value(projectNumber)")

# 3. Grant the default Cloud Run runtime service account access to read the secret
gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

## 4. Firestore Security Rules Configuration

Deploy the following owner-bound Firestore security rules supporting RBAC and user data isolation:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Helper function to check if the caller is an administrator
    function isAdmin() {
      return request.auth != null && (
        request.auth.token.email == 'rafikrafik3956@gmail.com' ||
        (exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
         get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin')
      );
    }

    // User profile isolation and admin inspection
    match /users/{userId} {
      allow read: if request.auth != null && (request.auth.uid == userId || isAdmin());
      allow create: if request.auth != null && request.auth.uid == userId;
      allow update: if request.auth != null && (request.auth.uid == userId || isAdmin());
      allow delete: if isAdmin();
    }

    // Journal reflections and interactions isolation (Strictly Owner-Bound)
    match /users/{userId}/interactions/{interactionId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // User notification settings isolation
    match /users/{userId}/settings/{settingId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // System Telemetry for Challenge Verification
    match /system/telemetry {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
  }
}
```

Deploy using the Firebase CLI:
```bash
firebase deploy --only firestore:rules
```

---

## 5. Cloud Run Deployment Flow

Deploy the application container directly to Cloud Run:

```bash
# 1. Build and deploy to Cloud Run
gcloud run deploy reflect-ai \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-secrets="GEMINI_API_KEY=GEMINI_API_KEY:latest" \
  --port=3000
```

---

## 6. Required Campaign Labeling (Verification Binding)

Apply the mandatory resource label to register the Cloud Run service for challenge verification:

```bash
gcloud run services update reflect-ai \
  --update-labels=dev-tutorial=cloud-run-ai-challenge \
  --region=us-central1
```

---

## 7. Functional Stability & Step-by-Step Test Walkthrough

Use the following test cases to verify complete end-to-end functionality:

### Test Case 1: Unauthenticated Landing & Google Sign-In
1. Navigate to the root application URL (`/`).
2. Verify that the landing hero renders with the header "Mindful journaling, deepened by Gemini AI" and displays the "Continue with Google" button.
3. Click the "Architecture & Security" button in the top navigation; verify that the security modal displays the Firestore rules and threat mitigation breakdown.
4. Click "Continue with Google". Complete authentication in the Google identity popup.
5. Verify that upon successful sign-in, the UI transitions to the private dashboard with the user avatar and email displayed in the top navbar.

### Test Case 2: Multi-turn Reflection with Gemini 3.6 Flash
1. On the private dashboard, select the **Deep Reflection** intent mode pill.
2. In the title input, enter `"Reflections on Career Growth"`.
3. In the journal composer, type:
   > *"I have been contemplating transitioning from software engineering into technical leadership. I feel excited about mentoring, but anxious about writing less daily code."*
4. Press `Enter` or click the **Send** button.
5. Verify:
   - A loading indicator shows "Gemini is reflecting on your thoughts...".
   - The user message card displays with the current timestamp and user avatar.
   - The Gemini reflection arrives rendered in clean markdown with empathetic validation and inquiry questions.
   - The model badge indicates `gemini-3.6-flash` (or high-availability fallback).

### Test Case 3: Location-Aware Reflection (Google Maps Integration)
1. In the journal studio header, click **"Pin Location"**.
2. In the modal, select one of the curated locations (e.g. `"Kyoto Zen Temple & Bamboo Forest"`) or enter a custom coordinate/place.
3. Click **"Attach Location"**.
4. Verify:
   - The location badge appears in the studio header (`📍 Kyoto Zen Temple & Bamboo Forest`).
   - A contextual atmosphere banner displays above the message thread with coordinates.
5. Submit a message such as: *"How does the peacefulness here compare to my daily routine?"*.
6. Verify that Gemini incorporates the geographic setting and cultural atmosphere into its reflection.

### Test Case 4: External Webhook Notifications (Slack / Discord)
1. Click the **Notification Bell** icon in the top navigation bar.
2. In the modal, toggle **"Enable Dispatch"** to active.
3. Paste a Discord or Slack webhook URL (or test with a mock endpoint).
4. Click **"Send Test"**.
5. Verify that the server validates the URL (blocking SSRF and metadata IP ranges) and returns a green confirmation badge.
6. Click **"Save Preferences"** to persist preferences to Firestore.

### Test Case 5: Role-Based Access Control (Admin Dashboard)
1. Log in as an administrator (e.g., `rafikrafik3956@gmail.com`).
2. Verify that the **"Admin RBAC"** button appears in the top navigation.
3. Click **"Admin RBAC"** to open the Governance & RBAC Control Plane.
4. Verify:
   - **Telemetry & Health**: Displays total reflection count, registered users, and 4-tier fallback ladder status.
   - **RBAC Directory**: Lists registered users with options to promote or demote roles.
   - **5-Zone Threat Matrix**: Shows all threat zones mapped to implemented countermeasures.

### Test Case 6: Transaction Persistence Verification
1. Inspect Cloud Firestore in the Google Cloud Console.
2. Verify that a document exists under:
   `/users/{authenticatedUserId}/interactions/{interactionId}`
3. Confirm the document contains:
   - `userId` matching the authenticated Google account UID.
   - `messages` array containing both user messages and model replies.
   - `mode: "reflection"`.
   - `location` object (latitude, longitude, name).
   - `createdAt` and `updatedAt` timestamps.
4. Confirm no `undefined` keys or corrupted attributes were written to Firestore.

### Test Case 7: History Recall, Search & Filtering
1. Click the **"New Entry"** button in the navbar to start a fresh canvas.
2. Verify the composer clears and prompts for a new reflection.
3. Open the **Journal History** sidebar on the left.
4. Verify that the earlier entries appear in the list with their respective location pin badges.
5. In the history search bar, type `"Kyoto"`. Confirm the list filters down to the location-pinned entry.
6. Click the entry; verify that the entire multi-turn thread, title, and pinned location are restored in the studio.

### Test Case 8: Export & Privacy Deletion
1. In the history sidebar, hover over an entry and click the **Export** (download) icon, or click the **Export Text** button in the ReflectionStudio top toolbar.
2. Verify that a formatted `.md` or `.txt` file downloads with the conversation transcript, location metadata, and privacy footer.
3. Click the **Delete** (trash) icon on the entry and confirm the browser alert.
4. Verify that the entry is permanently removed from the Firestore database and vanishes from the history list.
5. Click **Sign Out** in the top navbar; confirm the user session terminates and returns to the landing page.

### Test Case 9: Web Speech API Voice-to-Text Dictation
1. In the ReflectionStudio input composer, locate the microphone button (`#voice-dictation-btn`) adjacent to the Send button.
2. Click the microphone button.
3. If prompted by the browser, grant microphone permission.
4. Verify:
   - The microphone button turns red with a pulse animation and displays the `MicOff` icon.
   - An active listening banner appears above the composer: *"Microphone active • Listening to your voice dictation..."*.
5. Speak a sentence clearly (e.g. *"Today I spent two hours meditating in nature and felt deeply centered."*).
6. Verify:
   - The spoken words transcribe directly into the composer textarea in real time.
   - Spoken words seamlessly append to any pre-existing text without overwriting it.
7. Click the microphone button again or click *"Done Speaking"* on the listening banner.
8. Verify that listening stops, the banner disappears, and the transcribed text remains ready for editing or submission to Gemini.

### Test Case 10: Mood & Emotional Energy Tracking & Persistence
1. In ReflectionStudio, observe the **"Mood & Energy:"** selector row beneath the Intent Mode bar.
2. Review the mood choices with their expressive emoji and numeric energy scale:
   - 🌿 **Serene** (5/5)
   - ✨ **Grateful** (5/5)
   - ⚡ **Energized** (4/5)
   - 🌊 **Reflective** (3/5)
   - 🌪️ **Anxious** (2/5)
   - 🕯️ **Exhausted** (1/5)
3. Click a mood chip (e.g., 🌿 *Serene*).
4. Verify:
   - The chip highlights with an amber glow and indicator badge.
   - A corresponding mood pill appears in the top header toolbar (`#header-mood-pill`) with an inline dismiss button.
   - A *"Clear"* action button appears beside the mood selector row.
5. Compose a journal entry and click **Send** (`#submit-reflection-btn`).
6. Verify:
   - The entry is submitted to Gemini along with the mood context, harmonizing Gemini's reflective empathy with the user's emotional bandwidth.
   - The entry is saved to Firestore under `/users/{userId}/interactions/{interactionId}` with the `mood` object (`id`, `label`, `emoji`, `score`).
   - The journal entry in the **Journal History** sidebar displays the mood badge (`#history-item-mood-{id}`).
7. Export the entry via **"Export Text"** or Markdown export; confirm the exported text includes the user's selected mood, emoji, and numeric energy score.
8. Switching or re-opening the saved reflection from the History list restores the exact selected mood state into the ReflectionStudio.

### Test Case 11: Recharts Weekly Mood Trend Visualization Component & Dashboard
1. Locate the **"Mood Trends"** button in the top navigation bar (`#mood-dashboard-button`) or click the **"Weekly Trend"** button (`#open-mood-dashboard-from-studio-btn`) adjacent to the mood selector in ReflectionStudio.
2. Click the button to open the **Mood & Emotional Health Dashboard** modal (`#mood-dashboard-modal`).
3. Verify the visualization components rendered via **Recharts**:
   - **Main Trend Area Chart**: Displays the weekly emotional energy trend line ($1$ to $5$ scale: Exhausted 🕯️ to Serene 🌿) with a smooth gradient fill (`#moodGradient`), day axis markers, and reference line at Equilibrium ($3.0$).
   - **Summary Metric Cards**:
     - *Weekly Energy*: Average numeric energy score (e.g. `4.2/5`) with qualitative vitality descriptor.
     - *Dominant State*: Most frequently logged mood emoji and label with log count.
     - *Journal Consistency*: Active days count versus total window days.
     - *Mood Records*: Total number of reflection records with mood context.
   - **Spectrum Distribution Bar Chart**: Recharts bar chart displaying the frequency counts for each mood archetype (🌿 Serene, ✨ Grateful, ⚡ Energized, 🌊 Reflective, 🌪️ Anxious, 🕯️ Exhausted) with archetype-specific color mapping.
   - **Interactive Point Inspector**:
     - Hover over any point on the trend line to trigger the Recharts custom tooltip showing the full date, dominant mood emoji, score, and reflection count.
     - Click any point on the chart to inspect the specific reflection entries logged on that day.
     - Click any reflection card in the inspector to open and restore it directly in ReflectionStudio.
4. Test the **Time Window & Week Navigators**:
   - Click **"7 Days"** (`#mood-window-7days-btn`), **"Mon–Sun"** (`#mood-window-current-btn`), and **"14 Days"** (`#mood-window-14days-btn`); verify the X-axis and date range banner update smoothly.
   - Click the left chevron (`#mood-prev-week-btn`) to step back to the previous week; verify the week offset indicator updates (e.g., `(1 week ago)`) and the chart recomputes for that historical week.
   - Click **"Today"** (`#mood-reset-week-btn`) to instantly return to the current week.
5. If viewing as an administrator, click **"Admin RBAC"** in the navbar and navigate to the **"Weekly Mood Trends"** tab (`#admin-tab-trends`). Verify that the Recharts mood trend visualization component renders seamlessly within the governance control plane as well.
6. Click the close button (`#close-mood-dashboard-btn` or `#dismiss-mood-dashboard-btn`) or click the backdrop to dismiss the modal cleanly.


