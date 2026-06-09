# 💳 Payment Microservice

A production-ready **Node.js payment microservice** built with Express 5, Prisma ORM, and PostgreSQL. Designed as a multi-tenant backend that lets multiple products process payments, manage subscriptions, handle refunds, and receive real-time webhook events via the [Tilled](https://www.tilled.com/) payment gateway.

---

## ✨ Features

- 🔑 **Multi-tenant API Key System** — Scoped, permissioned API keys per product with rate limiting
- 💰 **Payment Processing** — Create, confirm, and track one-time & recurring payments via Tilled
- 🔄 **Subscription Management** — Create, update, and cancel subscriptions with webhook sync
- 💸 **Refund Handling** — Full and partial refunds with status tracking
- 🪝 **Webhook Engine** — Signature-verified, idempotent webhook processor for Tilled events
- 🛡️ **Idempotency** — Request-level idempotency keys to prevent duplicate charges
- 📊 **Rate Limiting** — Per API key, per-minute rate limiting stored in the database
- 🧾 **Audit Logging** — Request/response logging middleware for traceability
- 🐳 **Docker Ready** — Full Docker Compose setup with PostgreSQL

---

## 🏗️ Architecture

```
payment-microservice/
├── src/
│   ├── app.js                  # Express app setup (helmet, cors, morgan)
│   ├── index.js                # Server bootstrap & DB health check
│   ├── config/
│   │   └── prismaClient.js     # Prisma client singleton
│   ├── controllers/            # Route handlers
│   │   ├── payments.controller.js
│   │   ├── subscription.controller.js
│   │   ├── webhook.controller.js
│   │   ├── apiKey.controller.js
│   │   ├── productPlan.controller.js
│   │   ├── productWebhook.controller.js
│   │   ├── products.controller.js
│   │   ├── admin.idompotency.controller.js
│   │   └── CRUD.controller.js
│   ├── services/               # Business logic
│   │   ├── payments.service.js
│   │   ├── apiKey.service.js
│   │   ├── product.service.js
│   │   ├── rateLimit.service.js
│   │   └── webhookHandlers/    # Event-specific webhook handlers
│   │       ├── paymentIntent.handler.js
│   │       ├── customer.handler.js
│   │       ├── subscription.handler.js
│   │       └── charge.handler.js
│   ├── middleware/
│   │   ├── auth.middleware.js          # API key authentication
│   │   ├── idempotency.js              # Idempotency key enforcement
│   │   ├── requireIdempotencyKey.js
│   │   ├── requirePermissions.js       # Permission-based authorization
│   │   ├── admin.middleware.js
│   │   ├── auditLogger.middleware.js
│   │   └── validatePaymentRequest.js
│   ├── routes/
│   │   ├── payments.routes.js
│   │   ├── apiKey.routes.js
│   │   ├── product.routes.js
│   │   └── CRUD.routes.js
│   └── dao/                    # Data Access Objects
│       └── webhookEvent.dao.js
├── prisma/
│   └── schema.prisma           # Database schema
├── Dockerfile
├── docker-compose.yml
└── .env.example
```

---

## 🗄️ Data Model

```
Product ──┬── ApiKey (with RateLimitTracker)
          ├── ProductUser
          ├── ProductPlan (ONE_TIME | RECURRING)
          └── Order ──── Payment ──── Refund
                              │
                         IdempotencyKey
```

| Model | Description |
|---|---|
| `Product` | A tenant/product that uses the payment service |
| `ApiKey` | Scoped API key with permissions & rate limits |
| `ProductUser` | End-user linked to a product (external ID mapping) |
| `ProductPlan` | Pricing plan (one-time or recurring) |
| `Order` | A purchase intent, tracks lifecycle from CREATED → PAID/FAILED |
| `Payment` | Actual payment attempt linked to an order (CARD, ACH) |
| `Refund` | Full or partial refund against a payment |
| `IdempotencyKey` | Stores request hashes to deduplicate API calls |

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v20+
- [PostgreSQL](https://www.postgresql.org/) 14+ (or use Docker)
- A [Tilled](https://www.tilled.com/) account with API credentials

### 1. Clone & Install

```bash
git clone https://github.com/vasu991/payment-backend-service.git
cd payment-backend-service
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your values:

```env
NODE_ENV=development
PORT=3000
DATABASE_URL="postgresql://postgres:password@localhost:5432/payment_db"

# Tilled credentials
TILLED_API_KEY=your_tilled_secret_key
TILLED_WEBHOOK_SECRET=your_webhook_signing_secret
```

### 3. Set Up the Database

```bash
# Run migrations
npm run prisma:migrate

# Generate Prisma client
npm run prisma:generate
```

### 4. Start the Server

```bash
# Development (with hot-reload)
npm run dev

# Production
npm start
```

The server will start on `http://localhost:3000`.

---

## 🐳 Docker Setup

Run the entire stack (app + PostgreSQL) with a single command:

```bash
npm run docker:up
```

To stop:

```bash
npm run docker:down
```

The Compose file spins up:
- **app** — Node.js service on port `3000`
- **db** — PostgreSQL 16 on port `5432` with a persistent volume

---

## 🔌 API Reference

All payment routes are authenticated via API key. Pass your key in the request header:

```
x-api-key: pk_live_xxxxxxxxxxxx
```

### Health

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Service status |
| `GET` | `/health` | Health check with timestamp |

---

### Payments `/api/payments`

> Requires API key authentication on all routes.

| Method | Endpoint | Permission | Description |
|---|---|---|---|
| `POST` | `/api/payments` | `charge` | Create a new payment / charge |
| `POST` | `/api/payments/confirm` | `charge` | Confirm a subscription payment with `payment_method_id` |
| `GET` | `/api/payments` | `read` | List all payments for a product |
| `GET` | `/api/payments/status?orderId=` | `read` | Get order status by order ID |
| `GET` | `/api/payments/:id` | `read` | Get a single payment by ID |
| `POST` | `/api/payments/:id/refund` | `refund` | Refund a payment |

**Create Payment — Request Body:**
```json
{
  "externalUserId": "user_123",
  "planId": "plan_uuid",
  "referenceId": "order_ref_001",
  "amount": 4999,
  "currency": "usd",
  "paymentMethod": "CARD",
  "tilledAccountId": "acct_xxx"
}
```

**Refund — Request Body:**
```json
{
  "amount": 4999,
  "reason": "Customer requested cancellation"
}
```

> ⚠️ `POST /api/payments` and `POST /api/payments/:id/refund` **require an `Idempotency-Key` header** to prevent duplicate operations.

---

### Subscriptions `/api/payments/subscriptions`

| Method | Endpoint | Permission | Description |
|---|---|---|---|
| `DELETE` | `/api/payments/subscriptions/:tilledSubscriptionId` | `charge` | Cancel a subscription |
| `GET` | `/api/payments/subscriptions/:tilledSubscriptionId` | `read` | Get subscription status |

---

### API Keys `/api/keys`

> Admin-only. Used to provision and manage API keys for products.

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/keys` | Generate a new API key |
| `GET` | `/api/keys` | List all keys for a product |
| `GET` | `/api/keys/getAllkeys` | Get all keys across products |
| `GET` | `/api/keys/:id` | Get a specific key |
| `PATCH` | `/api/keys/:id` | Update key settings |
| `POST` | `/api/keys/:id/regenerate` | Rotate / regenerate a key |
| `POST` | `/api/keys/:id/deactivate` | Deactivate a key (soft delete) |
| `DELETE` | `/api/keys/:id` | Permanently delete a key |
| `GET` | `/api/keys/:id/stats` | Usage stats for a key |

**Create API Key — Request Body:**
```json
{
  "productId": "product_uuid",
  "keyName": "Production Key",
  "environment": "production",
  "permissions": ["charge", "read", "refund"],
  "rateLimitPerMin": 100,
  "expiresInDays": 365
}
```

---

### Products `/api/products`

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/products` | Create a product |
| `GET` | `/api/products` | List all products |
| `GET` | `/api/products/:id` | Get a product |
| `PATCH` | `/api/products/:id` | Update a product |

---

### Webhooks `/api/webhooks`

```
POST /api/webhooks/tilled
```

Receives and processes signed webhook events from Tilled. The endpoint:
1. Verifies the `tilled-signature` header
2. Returns `200 OK` immediately
3. Processes the event asynchronously in the background
4. Stores events in the DB and marks them as processed (idempotent)

**Handled event types:**

| Category | Events |
|---|---|
| Payment Intent | `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled` |
| Customer | `customer.created`, `customer.updated` |
| Subscription | `subscription.created`, `subscription.updated`, `subscription.canceled` |
| Charge | `charge.succeeded`, `charge.failed`, `charge.refunded` |

---

## 🔐 Security

- **Helmet** — Sets secure HTTP response headers
- **API Key Auth** — Keys are hashed with bcrypt; only the prefix is stored in plain text
- **Permission Scoping** — Each key declares allowed permissions (`charge`, `read`, `refund`, `delegate`)
- **Rate Limiting** — Sliding window rate limiting per API key, enforced at the DB level
- **Webhook Signature Verification** — All incoming Tilled webhooks are HMAC-verified before processing
- **Idempotency** — Mutating endpoints require `Idempotency-Key` to prevent duplicate charges

---

## 📦 Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20 |
| Framework | Express 5 |
| ORM | Prisma 7 |
| Database | PostgreSQL 16 |
| Payment Gateway | Tilled |
| Validation | express-validator |
| Containerization | Docker + Docker Compose |
| Security | helmet, bcryptjs, cors |
| Logging | morgan |

---

## 📝 Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start with nodemon (hot-reload) |
| `npm start` | Start in production mode |
| `npm run prisma:generate` | Regenerate Prisma client |
| `npm run prisma:migrate` | Run DB migrations |
| `npm run prisma:studio` | Open Prisma Studio GUI |
| `npm run docker:up` | Build and start Docker stack |
| `npm run docker:down` | Stop Docker stack |

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'feat: add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

---

## 📄 License

This project is licensed under the **ISC License**.

---

> Built with ❤️ — [GitHub Issues](https://github.com/vasu991/payment-backend-service/issues)
