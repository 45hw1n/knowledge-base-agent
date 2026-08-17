# Google OAuth Setup Guide for SaaS

## 1. Account Strategy: Personal vs. Dedicated

### ❌ Personal Account (`ashwin@gmail.com`)
- **Pros**: Easy to start.
- **Cons**:
    - **Security Risk**: If your account is compromised, your users are at risk.
    - **Transferability**: You cannot easily sell or transfer the app later without giving away your personal email.
    - **Professionalism**: "Login with..." screen might show your personal name/email as the developer.

### ✅ Dedicated Account (`admin@expensetracker.com` or `expensetracker.app@gmail.com`)
- **Pros**:
    - **Separation**: Keeps application assets separate from personal life.
    - **Transferability**: Easy to hand over credentials to a co-founder or buyer.
    - **Branding**: The consent screen looks professional.

**Recommendation**: Create a fresh **Gmail** account (e.g., `expense.tracker.dev@gmail.com`) or a **Google Workspace** account for your SaaS. Use this account to log in to Google Cloud Console.

---

## 2. Managing Multiple Environments (Local, Prod)

In a SaaS application, you should **NEVER** share the same Client ID/Secret across environments. You should create **separate credentials** for each environment.

### Why?
1.  **Security**: You don't want `localhost` (Developer Machine) to be a valid redirect target for your `Production` application.
2.  **Safety**: If a developer leaks the Local credentials, you can revoke them without breaking Production login.

### Setup Instructions
Inside the **SAME** Google Cloud Project ("Expense Tracker SaaS"), you will create 2 separate OAuth Client IDs.

#### 🟢 1. Local Development Credentials
- **Go to**: Credentials > Create Credentials > OAuth Client ID.
- **Name**: "Local Dev"
- **Redirect URI**: `http://localhost:5000/auth/google/callback`
- **Action**: Copy ID/Secret -> Paste into `.env.local`.


#### 🔴 3. Production Credentials
- **Go to**: Create Credentials > OAuth Client ID.
- **Name**: "Production"
- **Redirect URI**: `https://api.yourdomain.com/auth/google/callback`
- **Action**: Copy ID/Secret -> Paste into `.env.production`.

---

## 3. Step-by-Step Configuration (General)

1.  **Log in** with your Dedicated Account.
2.  Go to [**Google Cloud Console**](https://console.cloud.google.com/).
3.  **Create a Project**:
    - Click the project dropdown (top left).
    - Click **"New Project"**.
    - Name: "Expense Tracker SaaS".
    - Click **Create**.

4.  **Configure Consent Screen**:
    - Go to **APIs & Services** > **OAuth consent screen**.
    - User Type: **External** (Available to any user with a Google Account).
    - Click **Create**.
    - **App Information**:
        - App Name: "Expense Tracker".
        - User Support Email: Your dedicated email.
    - **Developer Contact Information**: Your dedicated email.
    - Click **Save and Continue** (skip Scopes and Test Users for now).

5.  **Create Credentials** (Repeat this for each Environment as described in Section 2).
