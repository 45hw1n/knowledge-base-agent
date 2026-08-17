# Backend Architecture & Security Guide

## 1. Environment Strategy
We use a 2-layer environment strategy to ensure stability and security.

### 🟢 Local Development (`local`)
- **Purpose**: Rapid development and testing changes on your machine.
- **Database**: Local instance (localhost:27017).
- **Data**: Temporary, dummy data. Can be deleted at any time.
- **Config**: `.env.local`


### 🔴 Production (`production`)
- **Purpose**: Live application for end-users.
- **Database**: Cloud-hosted (MongoDB Atlas) - Dedicated High-Availability Cluster.
- **Data**: Real user data. **Backups are critical.**
- **Config**: `.env.production`

---

## 2. Database Hosting & Creation

### Where does the Production DB live?
For a SaaS application, you should **NOT** host the database on the same server as your Node.js app. Instead, use a managed database provider like **MongoDB Atlas** (Cloud).

- **High Availability**: If one server fails, another takes over (Replica Sets).
- **Backups**: Automated daily snapshots.
- **Scaling**: easy to upgrade RAM/Storage.

---

## 3. Users: Infrastructure vs. Application (CRITICAL DISTINCTION)

### 🤖 Database User (Infrastructure)
**"Who connects to the Database?"** -> **The Backend Server.**
- **Created:** Manually in MongoDB Atlas Dashboard.
- **Count:** ONE per environment (e.g., one for Prod).
- **Purpose:** Gives your Node.js code permission to read/write data.
- **Credentials:** Stored in `.env` (MONGO_URI).

### 👤 Application User (End User)
**"Who uses the App?"** -> **Your Customers (Humans).**
- **Created:** **ON THE FLY** via Google OAuth.
- **Count:** Thousands (one per customer).
- **Purpose:** Represents a human using your SaaS.
- **Credentials:** Managed by Google (OAuth). Stored in the `users` collection in the database.

**Summary:** You do NOT create a "Database User" for every customer. You create **ONE** Database User for the Server, and the Server creates thousands of Application Users records.

---

## 4. Security & Credentials (Setting the Password)

### How to set the "Production Password" in MongoDB Atlas
This password is for the **Database User** (The Server).

1.  Log in to **MongoDB Atlas**.
2.  Go to **Database Access** (in the sidebar).
3.  Click **+ Add New Database User**.
4.  **Authentication Method**: Password.
5.  **Username**: `expense-backend` (or similar).
6.  **Password**: Click "Autogenerate Secure Password". **COPY THIS**.
7.  **Database User Privileges**: "Read and write to any database" (or specific DB).
8.  Click **Add User**.
9.  **Update your .env.production**:
    ```bash
    MONGO_URI=mongodb+srv://expense-backend:<PASTE_PASSWORD_HERE>@cluster0.abcde.mongodb.net/expense-tracker-prod?retryWrites=true&w=majority
    ```
