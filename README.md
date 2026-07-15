<div align="center">

# ⚡ PersonalOS

### **Your Single Operating System for Work & Life.**
*Stop switching between Notion, Todoist, Bitwarden, and Google Sheets. Unify your digital life in one modular, database-driven workspace.*

[![Vite](https://img.shields.io/badge/Vite-5.x-purple.svg?style=for-the-badge&logo=vite)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-18.x-blue.svg?style=for-the-badge&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Backend-emerald.svg?style=for-the-badge&logo=supabase)](https://supabase.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.x-38bdf8.svg?style=for-the-badge&logo=tailwindcss)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)

[**Live Demo**](https://personalos.vercel.app) • [**Bug Report**](https://github.com/Abhishek0964/PersonalOS/issues) • [**Feature Request**](https://github.com/Abhishek0964/PersonalOS/issues)

</div>

---

## 🚀 The Vision

**PersonalOS** is a modular, highly configurable, database-driven productivity platform designed to become the single operating system for an individual's professional and personal life. 

Rather than hardcoding features, **PersonalOS** is built on a relationship-first architecture where every workspace, category, and entry is dynamically generated. If you change a client record, your projects, task checklists, documents, secure credentials, and calendar events automatically reflect those associations.

---

## ✨ Features (P0 Modules)

| Module | Description |
| :--- | :--- |
| 📊 **Dynamic Dashboard** | Drag, drop, and configure widgets for your daily tasks, meetings, notes, and quick action logs. |
| 📁 **Infinite Workspaces** | Organize folders with unlimited nesting and customized tags for dynamic indexing. |
| ✅ **Task Engine** | Full CRUD with priorities, recurring schedules, subtasks, checklists, and file attachments. |
| 📅 **Smart Calendar** | Interactive Day/Week/Month planner with drag-and-drop rescheduling. |
| 👥 **CRM & Client Hub** | Keep track of clients, linked projects, logs, credentials, and meetings in one centralized directory. |
| 📝 **Rich Note Editor** | Autosaving document creator powered by **Tiptap** with code block syntax highlighting, check-lists, and nested tables. |
| 🔒 **Secure Vault** | Keep API keys, passwords, and private environment variables encrypted and secure. |
| 📂 **File Storage** | Upload and preview files inside workspaces with tag-based organization. |

---

## 🛠 Tech Stack

- **Frontend:** React 18 (TypeScript), Vite
- **Styling:** Tailwind CSS (Dark-mode first, premium glassmorphism)
- **State Management:** Zustand (Application State) + TanStack Query v5 (Server State caching)
- **Database & Auth:** Supabase (PostgreSQL, Row Level Security, Realtime syncing)
- **Forms & Validation:** React Hook Form + Zod
- **Rich Editor:** Tiptap Editor Suite

```
  Browser (React + Vite + Zustand)
       │
       ▼ (Queries / Actions)
  TanStack Query (Client Cache)
       │
       ▼ (Secure API Calls)
  Supabase Backend (Postgres + Auth + Storage)
```

---

## ⚡ Quick Start

### 1. Clone the repository
```bash
git clone https://github.com/Abhishek0964/PersonalOS.git
cd PersonalOS/project
```

### 2. Install dependencies
```bash
npm install
```

### 3. Setup environment variables
Create a `.env` file in the root of the `project` directory:
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_public_key
```

> [!WARNING]
> Never put your `service_role` secret key in the `.env` file as it will trigger security errors in the browser environment. Use only the `anon` public key.

### 4. Run the development server
```bash
npm run dev
```
Open **[http://localhost:5173](http://localhost:5173)** in your browser!

---

## 🌐 Deploy to Vercel

If you're deploying this repository to Vercel:

1. Connect your Github repository to **Vercel**.
2. Add your environment variables in Vercel's **Settings > Environment Variables**:
   * `VITE_SUPABASE_URL`
   * `VITE_SUPABASE_ANON_KEY` *(use your public `anon` key)*
3. Deploy! The routing is preconfigured in `vercel.json` to handle client-side routes seamlessly.

---

## 🗺️ Roadmap (P1 Features)

- [ ] **AI Assistant Integration** — Personal semantic search and assistant querying your workspace.
- [ ] **Workflow Automation Engine** — Trigger-Condition-Action builder (e.g., "When task is completed -> Update client progress -> Email invoice").
- [ ] **Advanced Analytics** — Time tracking dashboards, client conversion rates, and productivity heatmaps.
- [ ] **Offline Sync** — Local-first caching to allow full functionality when disconnected, syncing back to Supabase automatically when online.

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---

<div align="center">
  Made with ❤️ by Abhishek Choudhary. Star this repo if you love it! ⭐
</div>
