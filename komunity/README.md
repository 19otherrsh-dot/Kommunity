# Komunity — Community-Led Learning Platform

> A unified platform where paid learning communities live: discussions, courses, events, gamification, and billing — all under one roof.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, TailwindCSS, TanStack Query, Zustand |
| Backend | Node.js, Express |
| Database | PostgreSQL 16 |
| Cache / Sessions | Redis 7 |
| Payments | Stripe (subscriptions + Connect payouts) |
| Video Hosting | Mux |
| Live Video Calls | Daily.co |
| Push Notifications | Firebase Cloud Messaging |
| Email | SendGrid |
| Storage | AWS S3 / Cloudflare R2 |

---

## Project Structure

```
komunity/
├── backend/
│   ├── server.js             # Express app entry point
│   ├── db/
│   │   ├── index.js          # PostgreSQL pool
│   │   ├── redis.js          # Redis client
│   │   └── schema.sql        # Full DB schema
│   ├── middleware/
│   │   ├── auth.js           # JWT + membership middleware + Redis blocklist
│   │   └── errorHandler.js
│   ├── utils/
│   │   └── points.js         # Shared gamification points engine + badge awarding
│   ├── routes/
│   │   ├── auth.js
│   │   ├── communities.js
│   │   ├── posts.js
│   │   ├── courses.js
│   │   ├── events.js
│   │   ├── members.js
│   │   ├── gamification.js
│   │   ├── billing.js
│   │   ├── spaces.js
│   │   ├── upload.js
│   │   ├── notifications.js
│   │   └── webhooks.js       # Mux + Daily.co webhooks
│   └── controllers/
│       ├── authController.js
│       ├── communityController.js
│       ├── postController.js     # Includes notifications on likes/comments
│       ├── courseController.js
│       ├── eventController.js    # Awards event_attend points
│       ├── memberController.js
│       ├── gamificationController.js
│       ├── billingController.js
│       ├── uploadController.js   # S3/R2 presigned URL generation
│       ├── notificationController.js  # Firebase + in-app notifications
│       └── webhookController.js  # Mux + Daily.co event processing
│
└── frontend/
    └── src/
        ├── api/index.js      # Axios client + all API methods
        ├── contexts/
        │   └── authStore.js  # Zustand auth store
        ├── components/
        │   ├── NotificationBell.jsx  # In-app notification dropdown
        │   └── Layout/
        │       ├── AppLayout.jsx   # Sidebar + nav
        │       └── AuthLayout.jsx
        └── pages/
            ├── LoginPage.jsx
            ├── RegisterPage.jsx
            ├── ForgotPasswordPage.jsx  # Password reset request
            ├── ResetPasswordPage.jsx   # Password reset form
            ├── DiscoverPage.jsx    # Public community directory
            ├── CommunityPage.jsx   # Tabbed community wrapper
            ├── FeedPage.jsx        # Social feed + post creation
            ├── CoursesPage.jsx     # Course grid
            ├── CoursePage.jsx      # Curriculum + video player
            ├── EventsPage.jsx      # Calendar + RSVP
            ├── MembersPage.jsx     # Member directory
            ├── LeaderboardPage.jsx # Gamification leaderboard
            ├── ProfilePage.jsx
            └── SettingsPage.jsx    # Billing + creator dashboard
```

---

## Quick Start (Docker)

The fastest way to get everything running locally:

```bash
# 1. Clone and enter the project
git clone <your-repo>
cd komunity

# 2. Copy env file and fill in your API keys
cp backend/.env.example backend/.env

# 3. Spin up everything (postgres + redis + backend + frontend)
docker compose up --build

# App will be available at:
#   Frontend → http://localhost:5173
#   Backend  → http://localhost:4000
#   API docs → http://localhost:4000/health
```

---

## Local Dev (Without Docker)

### Prerequisites
- Node.js 20+
- PostgreSQL 16
- Redis 7

### Backend

```bash
cd backend
npm install
cp .env.example .env          # fill in your values
psql -U postgres -c "CREATE DATABASE komunity;"
psql -U postgres -d komunity -f db/schema.sql
npm run dev                   # starts on :4000
```

### Frontend

```bash
cd frontend
npm install
npm run dev                   # starts on :5173
```

---

## API Overview

### Auth
| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Get JWT token |
| POST | `/api/auth/logout` | Logout + blocklist JWT in Redis |
| POST | `/api/auth/refresh` | Refresh JWT token |
| GET | `/api/auth/me` | Current user + memberships |
| PATCH | `/api/auth/me` | Update profile |
| POST | `/api/auth/forgot-password` | Send password reset email |
| POST | `/api/auth/reset-password` | Reset password with token |

### Communities
| Method | Path | Description |
|---|---|---|
| GET | `/api/communities` | List public communities |
| POST | `/api/communities` | Create community |
| GET | `/api/communities/:id` | Get community |
| POST | `/api/communities/:id/join` | Join (free) or get checkout URL (paid) |
| PATCH | `/api/communities/:id` | Update settings (admin) |

### Posts & Comments
| Method | Path | Description |
|---|---|---|
| GET | `/api/posts/:communityId` | List posts (chronological) |
| POST | `/api/posts/:communityId` | Create post (+points) |
| POST | `/api/posts/:communityId/:postId/like` | Toggle like (+points to author, +notification) |
| POST | `/api/posts/:communityId/:postId/comments` | Add comment (+points, +notification) |

### Courses
| Method | Path | Description |
|---|---|---|
| GET | `/api/courses/:communityId` | List courses |
| GET | `/api/courses/:communityId/:courseId` | Get course with curriculum |
| POST | `/api/courses/:communityId/:courseId/lessons/:lessonId/complete` | Mark complete (+points, +badge check) |
| GET | `/api/courses/:communityId/:courseId/progress` | My progress |

### Events
| Method | Path | Description |
|---|---|---|
| GET | `/api/events/:communityId` | List events |
| POST | `/api/events/:communityId/:eventId/rsvp` | RSVP (+event_attend points) |
| POST | `/api/events/:communityId/:eventId/room` | Create Daily.co room |

### Gamification
| Method | Path | Description |
|---|---|---|
| GET | `/api/gamification/:communityId/leaderboard` | Top 50 members |
| GET | `/api/gamification/:communityId/point-rules` | Current point config |
| PATCH | `/api/gamification/:communityId/point-rules` | Update rules (admin) |

### Billing
| Method | Path | Description |
|---|---|---|
| POST | `/api/billing/checkout` | Create Stripe checkout session |
| POST | `/api/billing/portal` | Customer billing portal |
| POST | `/api/billing/webhook` | Stripe webhook receiver |
| GET | `/api/billing/creator-dashboard` | MRR, churn, active members |

### Uploads
| Method | Path | Description |
|---|---|---|
| POST | `/api/upload/presigned-url` | Get S3/R2 presigned upload URL |

### Notifications & Digesst
| Method | Path | Description |
|---|---|---|
| GET | `/api/notifications` | List notifications (paginated) |
| PATCH | `/api/notifications/:id/read` | Mark single notification as read |
| POST | `/api/notifications/read-all` | Mark all as read |
| POST | `/api/notifications/trigger-digest` | Trigger weekly/daily email digests (CRON) |

### Webhooks
| Method | Path | Description |
|---|---|---|
| POST | `/api/webhooks/mux` | Mux video asset ready → publish lesson |
| POST | `/api/webhooks/daily` | Daily.co recording ready → attach to event |
| POST | `/api/billing/webhook` | Stripe subscription events |

---

## Gamification Engine

Points are awarded automatically in controllers when members take actions:

| Action | Default Points | Daily Cap |
|---|---|---|
| Create a post | 5 | 20 |
| Leave a comment | 2 | 30 |
| Complete a lesson | 10 | None |
| Attend an event | 15 | None |
| Receive a like | 1 | 50 |

Level = `floor(points / 100) + 1`, capped at Level 10. Admins can override point values per community via the API.

---

## Stripe Integration

Komunity uses a **dual revenue model**:

- **Platform subscription** — creators pay $9/mo (Hobby) or $99/mo (Pro)
- **Transaction fees** — 10% on Hobby, 2.9% on Pro, applied via Stripe's `application_fee_percent`

Webhook events handled:
- `checkout.session.completed` → add member to community
- `customer.subscription.deleted` → revoke access
- `invoice.payment_failed` → mark as `past_due`

---

## Environment Variables

See `backend/.env.example` for the full list. Required for full functionality:

```
DATABASE_URL          # PostgreSQL connection string
REDIS_URL             # Redis connection string
JWT_SECRET            # Strong random secret
STRIPE_SECRET_KEY     # sk_live_... or sk_test_...
STRIPE_WEBHOOK_SECRET # From Stripe dashboard
MUX_TOKEN_ID          # For video hosting
MUX_TOKEN_SECRET
MUX_WEBHOOK_SECRET    # For Mux webhook signature verification
DAILY_API_KEY         # For live video calls
SENDGRID_API_KEY      # For transactional emails (password reset, etc.)
SENDGRID_FROM_EMAIL   # Sender email address
S3_ENDPOINT           # S3/R2 endpoint URL
S3_ACCESS_KEY         # S3/R2 access key
S3_SECRET_KEY         # S3/R2 secret key
S3_BUCKET_NAME        # S3/R2 bucket name
S3_PUBLIC_URL         # CDN/public URL for uploaded assets
FIREBASE_PROJECT_ID   # For push notifications
FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY
```

---

## Roadmap

### v1.0 (MVP — this scaffold)
- [x] Auth (JWT)
- [x] Community creation & management
- [x] Social feed (posts, comments, likes, pins)
- [x] Course builder (modules, lessons, video, progress)
- [x] Events calendar + RSVP + Daily.co video calls
- [x] Member directory
- [x] Gamification engine (points, levels, leaderboard)
- [x] Stripe subscriptions + webhooks

### v1.1
- [x] Subscription tiers per community (Free / Paid / Premium)
- [x] Email capture on join + CRM export
- [x] Granular notification settings + digest emails
- [x] Native video hosting (Mux direct upload)

### v1.2+
- [x] Advanced analytics dashboard
- [x] Affiliate / referral system
- [x] Skool-style discovery marketplace
- [x] Direct Messaging (real-time chat)
- [x] Spaces & Content Categorization
- [x] Moderation & Reports System
- [x] Webinar mode (1,000+ attendees)

---

## Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Commit with conventional commits: `feat:`, `fix:`, `chore:`
4. Open a PR against `main`

---

Built with ❤️ for the Komunity PRD by Adarsh Singh · v1.0 · March 2026
