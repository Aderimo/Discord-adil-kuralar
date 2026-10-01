<div align="center">

# Moderator Guide & Penalty Advisor

**Your staff handbook, searchable — with an AI advisor for fair penalties.**

[![License](https://img.shields.io/badge/license-MIT-4ADE80)](LICENSE)
[![Stack](https://img.shields.io/badge/Next.js_14_%2B_Prisma_%2B_OpenAI-6B7280)](#tech-stack)

A custom moderator guide and AI-assisted penalty advisor built for the
SANIYE MODLARI Discord server: every rule and penalty definition in one place,
with role-based access and a RAG-powered assistant that suggests consistent penalties.

**English** · [Türkçe](README.tr.md)

</div>

---

## Why

Moderation teams drift: rules live in pinned messages, penalty memory lives in
people's heads, and two mods give two different punishments for the same offence.
This app puts the whole staff handbook behind a login and lets an AI advisor quote
the actual guide when recommending a penalty — so decisions stay consistent.

## Features

- 🔐 **Role-based access control** — Mod, Admin, Senior Staff
- 📚 **Guide content management** — the moderator handbook, editable in-app
- ⚖️ **Penalty definitions & categories**
- 🤖 **AI penalty advisor** — RAG-based, answers grounded in the guide's own content
- 🔍 **Advanced search** across rules and penalties
- 📝 **Content editing** — restricted to Senior Staff
- 📊 **Activity logging** — who changed what, who asked what

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 14 |
| Language | TypeScript |
| Database | Prisma ORM |
| UI | Tailwind CSS + shadcn/ui |
| AI | OpenAI API (RAG over guide content) |

## Setup

1. Clone the repo:

```bash
git clone https://github.com/Aderimo/Discord-adil-kuralar.git
cd Discord-adil-kuralar
```

2. Install dependencies:

```bash
npm install
```

3. Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

4. Create the database:

```bash
npx prisma db push
```

5. Start the dev server:

```bash
npm run dev
```

## Environment variables

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | Database connection URL |
| `OPENAI_API_KEY` | OpenAI API key (for the AI advisor) |

## License

[MIT](LICENSE)
