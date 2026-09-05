# ReflectAI — User-Authenticated Journaling & Reflection Assistant

A private, multi-turn AI journaling and reflection web application powered by **Gemini 3.6 Flash**, **Firebase Authentication (Google Sign-In)**, and **Cloud Firestore**.

All journal entries and AI reflections are strictly isolated to the authenticated user under `/users/{userId}/interactions/{interactionId}` with zero cross-user access.

---

## 1. Architecture Overview

- **Frontend**: React 19 + TypeScript + Tailwind CSS (Vite SPA)
- **Backend Service**: Express.js proxy with defensive payload parsing & null-safe destructuring
- **AI Processing Engine**: Gemini 3.6 Flash with an automated 4-tier Resilient Model Fallback Ladder (`gemini-3.6-flash` → `gemini-3.1-flash-lite` → `gemini-flash-latest` → `gemini-3.7-flash`)
- **Identity & Auth**: Firebase Authentication with Google Sign-In (federated identity; no custom password handling)
- **Database**: Google Cloud Firestore with owner-bound security rules and strict undefined-stripping payload hygiene
- **Secret Management**: Cloud Secret Manager / Environment Variables (`GEMINI_API_KEY` kept strictly server-side)

---

## 2. Prerequisites & Google Cloud APIs

Ensure the following Google Cloud APIs are enabled in your project:

```bash
gcloud services enable \
  run.googleapis.com \
  secretmanager.googleapis.com \
  firestore.googleapis.com \
  aiplatform.googleapis.com
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

Deploy the following owner-bound Firestore security rules to guarantee data isolation:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // User profile isolation
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Journal reflections and interactions isolation
    match /users/{userId}/interactions/{interactionId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
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

### Test Case 3: Follow-Up Conversational Continuation
1. In the active reflection thread, click the follow-up suggestion pill **"3 Practical Action Steps"** or type:
   > *"What are 3 small habits I can adopt this week to test this path without fully stepping away from engineering?"*
2. Click **Send**.
3. Verify that the conversation history persists, the new response appends to the bottom of the thread, and the view smoothly auto-scrolls down.

### Test Case 4: Transaction Persistence Verification
1. Inspect Cloud Firestore in the Google Cloud Console.
2. Verify that a document exists under:
   `/users/{authenticatedUserId}/interactions/{interactionId}`
3. Confirm the document contains:
   - `userId` matching the authenticated Google account UID.
   - `messages` array containing both user messages and model replies.
   - `mode: "reflection"`.
   - `createdAt` and `updatedAt` timestamps.
4. Confirm no `undefined` keys or corrupted attributes were written to Firestore.

### Test Case 5: History Recall, Search & Filtering
1. Click the **"New Entry"** button in the navbar to start a fresh canvas.
2. Verify the composer clears and prompts for a new reflection.
3. Open the **Journal History** sidebar on the left.
4. Verify that the earlier `"Reflections on Career Growth"` entry appears in the list.
5. In the history search bar, type `"mentoring"`. Confirm the list filters down to the relevant entry.
6. Click the entry; verify that the entire multi-turn thread and title are restored in the studio.

### Test Case 6: Export & Privacy Deletion
1. In the history sidebar, hover over the entry and click the **Export** (download) icon.
2. Verify that a formatted Markdown file (`.md`) downloads with the conversation transcript.
3. Click the **Delete** (trash) icon on the entry and confirm the browser alert.
4. Verify that the entry is permanently removed from the Firestore database and vanishes from the history list.
5. Click **Sign Out** in the top navbar; confirm the user session terminates and returns to the landing page.
