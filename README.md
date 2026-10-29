# Meritlab

Automated online coaching center: a mobile-first student PWA and a desktop admin panel.
First course: Bank Job Prelim (30 days, BDT 499, Day 1 free).

## Project layout

| Folder | What it is | Hosted on |
| --- | --- | --- |
| `/` (root) | Frontend: Next.js 15, Tailwind CSS | Vercel |
| `server/` | Backend: Node.js + Express, MongoDB (Mongoose), JWT auth, Cloudinary, SMTP email OTP | Render |

The frontend talks to the backend over HTTP using `NEXT_PUBLIC_API_URL`.

## Run locally

Open two terminals.

**Backend**

```bash
cd server
npm install
npm run dev
```

`server/.env` is already filled in. Check http://localhost:5000/api/health. It should show `"db": "connected"`.
(If you cloned from GitHub, `.env` is not in the repo: copy `server/.env.example` to `server/.env` and fill it in.)

**Frontend**

```bash
cp .env.example .env      # only the NEXT_PUBLIC_API_URL line is needed
npm install
npm run dev
```

Open http://localhost:3000. The backend already allows both `localhost:3000` and `localhost:5173` in development.

## First run: seed, admin, cron

```bash
cd server
npm install
npm run seed     # super admin, categories, Bank Job Prelim (30-day routine), Day 1 exam with 20 sample questions
npm run dev
npm test         # unit tests: grading, ranking, exam window, access rules
```

- Admin panel: http://localhost:3000/admin. Sign in with `ADMIN_EMAIL` and `ADMIN_PASSWORD` from `server/.env`, then enter the 6 digit code emailed to you.
- Day 1 is dated today, so its exam is live right away: register a student, open Courses, Try Day 1 free.
- Buy flow: student pays by bKash or Nagad, submits the TrxID, admin approves in Admin, Payments. Set the real numbers in the `settings` collection (`bkash_number`, `nagad_number`) or via `PUT /api/admin/settings`.
- Exams open at 12:00 AM and close at 11:59 PM Asia/Dhaka. Results publish automatically after closing. In Admin, Exams you can open, close, publish or unpublish by hand, and "Back to auto" returns control to the clock.
- Cron: Render free sleeps when idle, and status also advances whenever someone loads an exam, but a one-minute ping makes closing and publishing on time. Create a free job on cron-job.org: URL `https://YOUR-API.onrender.com/api/cron/tick`, every minute, header `Authorization: Bearer <CRON_SECRET>`. Set `CRON_SECRET` on Render.
- Upload questions in Admin, Exams and questions, Questions (JSON, see the sample in the box).
- Admin tabs: Dashboard, Courses and routine (create/edit course, edit routine table or import a CSV: `day,type,bangla,english,math,gk,ict,vocabFrom,vocabTo`), Exams and questions, Payments, Students (search, block, reset password, grant free access), Notices and categories, PDFs, Vocabulary import, Settings.
- Vocabulary CSV (Admin, Vocabulary import): columns `course,day,page,word,Bangla meaning,English explanation`, up to 5 words per page and 10 pages per day. Preview first, then Save. The seed already loads 50 words for Day 1.
- PDFs: upload in Admin, PDFs. Files are stored private on Cloudinary and students open them through a link that expires in 5 minutes. If a PDF will not open, check that Cloudinary allows PDF delivery (Settings, Security).

## How the course runs

- The course is a rolling calendar. Day 1 is the course start date, and every day has one live exam for everyone (12:00 AM to 11:59 PM Asia/Dhaka). A student who joins on day 8 starts with the exam that is live that day.
- Finished exams go to Archive (questions with explanations, practice mode). Results publish for everybody at the same time after the exam closes.
- After the last day (`durationDays`) the course starts again: round 2 uses the same questions on new dates, so earlier buyers can take them live again.
- A purchase unlocks the course for 3 months. Students get an English email when they submit the payment and another when an admin approves it (or rejects it, with the reason). The expiry date shows on the course screen and in Profile.
- The Exams tab lists only live exams you have not taken yet. Tapping one opens it if you own the course, otherwise it opens the course page to buy.

## Email check

`cd server` then `npm run mail:test -- you@example.com` sends one test email and prints the exact reason and fix if it fails. The server also checks the mail setup on every start and prints `Mail: SMTP ready` or `[MAIL NOT WORKING]`.
In Brevo, `SMTP_USER` is the SMTP login from SMTP & API (like `9xxxxx001@smtp-brevo.com`), `SMTP_PASS` is the SMTP key, and `SMTP_FROM` must be a verified sender. If port 587 times out on your network, use `SMTP_PORT=2525`.

## More API routes

| Method and path | What it does |
| --- | --- |
| `GET /courses/:slug/days` | Routine with each day's exam status and lock state |
| `GET /courses/:slug/archive` | Closed exams |
| `GET /exams/:id` | Exam info for the current student |
| `POST /exams/:id/start` | Start or resume (live, or practice after closing). Never returns answers. |
| `POST /exams/:id/answer` | Lock one answer (first tap wins) |
| `POST /exams/:id/submit` | Submit and grade on the server |
| `GET /exams/:id/result` | Score, rank, mark sheet, answer sheet with explanations (after publish) |
| `GET /exams/:id/merit` | Merit list, searchable by name |
| `POST /payments`, `GET /me/payments`, `GET /me/enrollments` | Payment submission and my courses |
| `/admin/*` | Admin: stats, categories, courses, routine, payments, exams, questions, settings |

## Backend API (`server/`)

All routes start with `/api`. Replies look like `{ "success": true, "data": ... }` or `{ "success": false, "message": "..." }`.

| Method and path | What it does |
| --- | --- |
| `GET /health` | Status and database state. Use it as the Render health check. |
| `POST /auth/register` | Body: `name, mobile, email, password`. Creates the account and emails a 6 digit code. |
| `POST /auth/verify-email` | Body: `email, code`. Verifies the email and logs the user in. |
| `POST /auth/resend-otp` | Body: `email, purpose` (`REGISTER` or `RESET`). |
| `POST /auth/login` | Body: `identifier` (email or mobile), `password`. |
| `POST /auth/refresh` | Uses the refresh cookie and returns a new `accessToken`. Call it on page load and on a 401. |
| `POST /auth/logout` | Clears the refresh cookie. |
| `POST /auth/forgot-password` | Body: `email`. Emails a reset code. |
| `POST /auth/reset-password` | Body: `email, code, newPassword`. |
| `GET /auth/me` | Current user. Needs the access token. |
| `POST /upload/image` | Multipart field `file` (jpg, png, webp, max 5 MB). Any logged-in user. Returns `{ url, publicId }`. |
| `POST /upload/pdf` | Multipart field `file` (pdf, max 20 MB). Admin and exam manager only. |
| `GET /categories`, `GET /courses`, `GET /courses/:slug` | Public catalog. `GET /courses?category=slug` filters. |

### How the frontend should call it

- Send the access token on every protected request: `Authorization: Bearer <accessToken>`. Keep it in memory (or state), not in a cookie.
- The refresh token is an httpOnly cookie. For `/auth/*` calls always send credentials:
  `axios.create({ baseURL: API_URL, withCredentials: true })` or `fetch(url, { credentials: "include" })`.
- When any request returns 401, call `POST /auth/refresh` once, store the new `accessToken`, and retry.
- Login with an unverified email returns 403 with `details.code = "EMAIL_NOT_VERIFIED"`. Send the user to the code screen.

## Environment variables (`server/.env`)

| Variable | Notes |
| --- | --- |
| `PORT` | 5000 locally. Render sets its own, so do not set it there. |
| `NODE_ENV` | `development` locally, `production` on Render. |
| `CLIENT_URL` | Allowed frontend origin(s), comma separated, no trailing slash. Production: your Vercel URL. |
| `MONGO_URI` | Atlas connection string. |
| `MONGO_DB_NAME` | Database name. Default `meritlab`. Your Atlas URI has no database name, so this sets it. |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | Long random strings. Generate with `openssl rand -hex 32`. Must differ from each other. |
| `JWT_EXPIRE`, `JWT_REFRESH_EXPIRE` | For example `7d` and `30d`. |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | From the Cloudinary dashboard. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Brevo SMTP. `SMTP_USER` is your Brevo login, `SMTP_PASS` is an SMTP key. `SMTP_FROM` must be a sender verified in Brevo. |

If SMTP is empty (or fails in development), the OTP code is printed in the server terminal instead.

## Deploy: GitHub, then Render (backend), then Vercel (frontend)

Push the whole project to one GitHub repo first. `.env` files are git-ignored, so no secret goes to GitHub.

### 1. MongoDB Atlas (once)

Atlas, Security, Network Access, Add IP Address, `0.0.0.0/0` (Allow access from anywhere). Render has no fixed IP, so without this the backend cannot connect.

### 2. Render: backend

1. New, Web Service, pick the GitHub repo.
2. Settings:
   - Root Directory: `server`
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Health Check Path: `/api/health`
3. Environment tab: add every variable from the table above, with these production values:
   - `NODE_ENV` = `production`
   - `CLIENT_URL` = your Vercel URL (you get it in step 3, so add it afterwards and redeploy)
   - `SMTP_PORT` = `2525`. Render free web services block outbound SMTP ports 25, 465 and 587, so 587 times out there. Brevo also accepts 2525. If emails still do not send on the free plan, use a paid Render instance or switch to an HTTP email API.
   - New random `JWT_SECRET` and `JWT_REFRESH_SECRET`.
4. Deploy. Open `https://YOUR-SERVICE.onrender.com/api/health`. The free plan sleeps after about 15 minutes idle, so the first request after a pause is slow.

### 3. Vercel: frontend

1. Add New, Project, pick the same repo. Root Directory stays `/` (framework: Next.js).
2. Environment Variables: `NEXT_PUBLIC_API_URL` = your Render URL (no trailing slash).
3. Deploy, then copy the Vercel URL into `CLIENT_URL` on Render and redeploy the backend.

Vercel and Render are different sites, so the production refresh cookie is `SameSite=None; Secure`. Safari and some browsers block such third-party cookies. The permanent fix is a custom domain for both, for example `meritlab.com` and `api.meritlab.com`.

## Before going live

- Rotate any credential that was ever pasted into a chat or committed: MongoDB password, Cloudinary API secret, Brevo SMTP key.
- Use different JWT secrets in production than in local `.env`.

## Data model (models/)

| Collection | Notes |
| --- | --- |
| users | Unique mobile and email. `passwordHash` is `select: false`. `noticesSeenAt` drives the unread dot. |
| otpcodes | Hash only. A TTL index removes each code after one hour. |
| categories, courses, routinedays | `startDate` and `date` are the start of the Dhaka day, stored as a UTC instant. Subject counts live on the course. |
| exams | One per routine day. `dayNo` and `type` are copied from the routine so lists need no lookup. |
| questions | `answer`, `explanation` and `shortcut` are `select: false`. Opt in with `.select("+answer +explanation +shortcut")`. |
| attempts | Answers are embedded (at most 100). A partial unique index allows one live attempt per student per exam. |
| questionstates | Favorite heart and read flag, one document per student and question. |
| enrollments, payments | Unique per student and course. `trxId` is unique and upper-cased. |
| materials | `fileKey` is a storage key, served through short-lived signed URLs. |
| vocabpages | One document per 5-word page. |
| vocabprogress | One document per student, course and day, with a `pages` map keyed by page number. |
| notices | No `courseId` means all students. A `userId` makes it a personal notice. |
| settings | The key is the `_id`, for example `bkash_number`. |

Never put a raw request object into a query filter. Validate every input with Zod first so only strings and
numbers reach Mongo, and no `$` operator can be injected.

## What is included

| Area | Scope |
| --- | --- |
| Setup | Next.js frontend, Express and MongoDB backend, Tailwind theme, seed, unit tests (`npm test` in `server/`) |
| Auth | Register, email OTP, login, refresh, password reset, admin login with a second code |
| Student | Home, categories, course details, buy with bKash or Nagad TrxID, routine with live countdown, live exam, results, mark sheet, merit list, archive, practice, wrong/correct/unanswered/favorites, vocabulary, PDFs, notices, profile, terms and privacy |
| Admin | Dashboard, courses, routine (table or CSV), exam control, question bank editor, payments, students, notices, categories, PDFs, vocabulary CSV import, settings |

## Not included (needs an outside service)

- Google login, phone SMS OTP (email OTP is used), push notifications.
- Excel import for the routine (use the CSV import).
- Discussion on the mark sheet and a "Cancelled" questions tab.

## After the first deploy

- Change the seeded admin password and the bKash/Nagad numbers (Admin, Settings).
- Rotate any credential that was ever shared in chat.
