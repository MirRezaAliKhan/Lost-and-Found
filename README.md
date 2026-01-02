# 🔍 LostFound.AI - Next-Gen Campus Recovery System

**LostFound.AI** is a smart, centralized platform designed to solve the chaos of lost items on college campuses. It replaces fragmented WhatsApp groups with a secure, searchable, and AI-powered web application.

## 🚀 Key Features

* **🧠 AI Semantic Search:** Uses **Google Gemini Embeddings** to match items by meaning (e.g., searching for "Timepiece" finds a "Watch"), solving the "description mismatch" problem.
* **🔗 Real-World Custody Logic:** Tracks the entire chain of custody. Finders can mark items as "Kept by me" or "Submitted to Authority" (e.g., Security Guard, Library), giving the loser exact directions.
* **🛡️ Role-Based Security:** * **Students:** Can report lost/found items and claim property.
    * **Admins:** Have a "God Mode" dashboard to monitor all items, track user details, and delete spam.
* **⚡ Serverless Architecture:** Built on Firebase (Auth, Firestore) for real-time updates and zero-maintenance scalability.

## 🛠️ Tech Stack

* **Frontend:** React.js + Tailwind CSS (Glassmorphism UI)
* **Backend:** Firebase (Serverless)
* **Database:** Cloud Firestore (NoSQL)
* **AI Engine:** Google Gemini (`text-embedding-004`)
* **Hosting:** Vercel / Netlify

## 📸 How It Works

1.  **Report:** A student uploads a photo of a found item. The AI (optional future scope) or User tags it.
2.  **Search:** The owner searches for their lost item using natural language.
3.  **Match:** The system calculates a vector similarity score to rank the most relevant items.
4.  **Recover:** The app provides the location (e.g., "Main Gate Security") or contact details to retrieve the item.

## 🏃‍♂️ Running Locally

1.  Clone the repository:
    ```bash
    git clone [https://github.com/MirRezaAliKhan/Lost-and-Found.git](https://github.com/MirRezaAliKhan/Lost-and-Found.git)
    cd Lost-and-Found
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Set up Environment Variables:
    * Create a `.env` file.
    * Add your Firebase Config and Gemini API Key:
        ```
        VITE_FIREBASE_API_KEY=your_key
        VITE_GEMINI_KEY=your_key
        ```
4.  Run the development server:
    ```bash
    npm run dev
    ```

## 👥 Contributors

Mir Reza Ali Khan
Mohammed Zaheer Khan
Hasifa Ammara

---
*Developed for the CSI-MJCET's Mini Expo 2025.*