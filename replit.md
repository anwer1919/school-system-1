# مدرسة النور - نظام الإدارة المدرسي المتكامل

Arabic school management system (Al-Nour School) built with Node.js/Express and Supabase.

## How to run

The app starts automatically via the **Start application** workflow:

```
node index.js
```

Runs on **port 5000**. The `PORT` environment variable controls this.

## Stack

- **Backend**: Node.js 22 + Express
- **Database**: Supabase (PostgreSQL)
- **Frontend**: Plain HTML/CSS (Tailwind CDN) in `/public`

## Environment variables

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_KEY` | Supabase anon key |
| `PORT` | Server port (set to 5000) |

These are loaded from `.env` (development). On Replit, `PORT` is managed as a Replit env var.

## Features

- Student, teacher, and employee management
- Attendance tracking
- Fees and financial reports
- Weekly/daily schedules
- ID card printing
- User access control with role-based menus
- Audit log

## User preferences

- Keep Arabic RTL layout and Arabic-language UI as-is
- Use Node.js 22 (required for Supabase JS v2 native WebSocket support)
