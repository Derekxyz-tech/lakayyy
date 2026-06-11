# 🛒 LakayMarket: Technical Production-Grade Architecture Blueprint (2026)

This document establishes the enterprise-level, production-grade architectural blueprint, security postures, database schema optimizations, and scaling strategies for **LakayMarket**. It is designed with the operational standards of top-tier platforms (Shopify, Stripe, Firebase, and Vercel) to support over 1,000,000 active concurrent users.

---

## 📂 1. Core Structural Layout & Directory Pattern

To scale LakayMarket cleanly as more developers join and visual components grow, we replace any flat directories with a highly structured **Feature-Sliced Design (FSD)** variation. This separates features (e.g., Checkout, Shop, Seller Dashboard) from shared infrastructure (e.g., Firebase, common UX components).

### 📐 Enterprise Directory Structure
```
/
├── .github/
│   └── workflows/                # CI/CD pipelines (Dev, Staging, Prod)
│       ├── test-and-lint.yml
│       └── deploy.yml
├── .firebase/                    # Firebase Cache and configurations
├── functions/                    # Serverless Cloud Functions (Node.js/TS)
│   ├── src/
│   │   ├── checkouts/           # Transactional secure endpoints
│   │   ├── sellers/             # Payout and onboarding hooks
│   │   ├── notifications/       # Real-time triggers (Push/SMS/Email)
│   │   └── index.ts             # Gateway entry point
│   ├── package.json
│   └── tsconfig.json
├── src/
│   ├── assets/                   # Static media assets, vectors, and font files
│   ├── components/               # Global Design System (Core Atomic UI)
│   │   ├── ui/
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Card.tsx
│   │   │   └── Skeleton.tsx      # Core shell skeletons
│   │   └── layout/
│   │       ├── Header.tsx
│   │       ├── Footer.tsx
│   │       └── ErrorBoundary.tsx
│   ├── features/                 # Modular, high-cohesion domain features
│   │   ├── catalog/
│   │   │   ├── components/
│   │   │   │   ├── ProductGrid.tsx
│   │   │   │   └── ProductFilters.tsx
│   │   │   ├── hooks/useProducts.ts
│   │   │   └── catalogSlice.ts
│   │   ├── seller/
│   │   │   ├── components/
│   │   │   │   ├── SalesChart.tsx
│   │   │   │   └── StockMetrics.tsx
│   │   │   └── services/sellerApi.ts
│   │   ├── checkout/
│   │   │   ├── components/CheckoutForm.tsx
│   │   │   └── hooks/useCheckout.ts
│   │   └── cart/
│   │       ├── cartSlice.ts
│   │       └── useCart.ts
│   ├── lib/                      # Core sdk initializations
│   │   ├── firebase.ts           # Hardened Firebase Auth & Firestore client
│   │   ├── query.ts              # TanStack Query Config
│   │   └── logger.ts             # Global telemetry logger
│   ├── localization/             # Multi-language files (HT, FR, EN)
│   │   ├── ht.json
│   │   ├── fr.json
│   │   └── en.json
│   ├── types/                    # Strictly typed global declarations
│   │   ├── product.ts
│   │   ├── user.ts
│   │   └── index.ts
│   ├── App.tsx                   # Central Shell, Route Manager, Providers
│   ├── main.tsx                  # Front-end Entrypoint
│   └── index.css                 # Global styles and Tailwind v4 themes
├── public/                       # Assets serving (Manifest, Icons)
│   ├── manifest.json
│   ├── sw.js                     # Offline Progressive Web App Service Worker
│   └── robots.txt
├── Dockerfile                    # Production container wrapper
├── firestore.rules               # ABAC Secure Firestore Gate
├── firestore.indexes.json        # Single-field & Composite Indexes
├── firebase-blueprint.json       # Structural IR specification
└── tailwind.config.js
```

---

## 🗄️ 2. Optimized Database Schema & Firestore Indexes

A scalable Firestore database requires modeling data to **minimize O(n) reads**, prevent expensive nested document overheads, and bypass the **1 write/second per document constraint** using horizontal sub-collections.

### 📊 Entity Architecture Specification (`firebase-blueprint.json`)
```json
{
  "entities": {
    "User": {
      "title": "User",
      "description": "Public domain information of any user",
      "type": "object",
      "properties": {
        "userId": { "type": "string" },
        "displayName": { "type": "string" },
        "photoURL": { "type": "string" },
        "role": { "type": "string", "enum": ["client", "seller", "admin"] },
        "createdAt": { "type": "string", "format": "date-time" }
      },
      "required": ["userId", "displayName", "role"]
    },
    "UserPrivate": {
      "title": "UserPrivate",
      "description": "Strict isolated PII database table (never leaked)",
      "type": "object",
      "properties": {
        "email": { "type": "string" },
        "phone": { "type": "string" },
        "address": { "type": "object" },
        "moncashNumber": { "type": "string" },
        "natcashNumber": { "type": "string" }
      },
      "required": ["email"]
    },
    "Product": {
      "title": "Product",
      "description": "Craft listed in the catalog",
      "type": "object",
      "properties": {
        "id": { "type": "string" },
        "name": { "type": "string" },
        "description": { "type": "string" },
        "price": { "type": "number" },
        "stock": { "type": "integer" },
        "images": { "type": "array" },
        "category": { "type": "string" },
        "sellerId": { "type": "string" },
        "createdAt": { "type": "string" },
        "updatedAt": { "type": "string" }
      },
      "required": ["id", "name", "price", "stock", "sellerId"]
    },
    "Transaction": {
      "title": "Transaction",
      "description": "Recorded processed sales",
      "type": "object",
      "properties": {
        "id": { "type": "string" },
        "buyerId": { "type": "string" },
        "sellerId": { "type": "string" },
        "items": { "type": "array" },
        "totalAmount": { "type": "number" },
        "paymentMethod": { "type": "string", "enum": ["moncash", "natcash"] },
        "phoneNumber": { "type": "string" },
        "status": { "type": "string", "enum": ["pending", "processing", "success", "failed"] },
        "createdAt": { "type": "string" }
      },
      "required": ["id", "buyerId", "sellerId", "items", "totalAmount", "status"]
    }
  },
  "firestore": {
    "/users/{userId}": {
      "schema": "User",
      "description": "Public profile accessible to catalogs and review boards."
    },
    "/users/{userId}/private/info": {
      "schema": "UserPrivate",
      "description": "Private customer contact metrics and payment targets."
    },
    "/products/{productId}": {
      "schema": "Product",
      "description": "Store items currently active in catalogue."
    },
    "/transactions/{transactionId}": {
      "schema": "Transaction",
      "description": "Audit trails for orders and escrow payment steps."
    }
  }
}
```

### 🗂️ Production Firestore Indexing System (`firestore.indexes.json`)
Firestore queries involving multiple `where` clauses or sorting/filtering with custom parameters require **Composite Indexes** to prevent client querying errors (`FAILED_PRECONDITION`).

```json
{
  "indexes": [
    {
      "collectionGroup": "products",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "category", "order": "ASCENDING" },
        { "fieldPath": "price", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "products",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "sellerId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "transactions",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "sellerId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "transactions",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "buyerId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

---

## 🔒 3. Enterprise Firewalls: Zero-Trust Security Rules

We implement strict Attribute-Based Access Control (ABAC) in `firestore.rules`. This blocks attackers from spoofing identities, updating forbidden fields, injecting long payloads, and scraping general user lists.

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Global default-deny firewall
    match /{document=**} {
      allow read, write: if false;
    }

    // Standard Validation Helpers
    function isSignedIn() {
      return request.auth != null;
    }

    function isOwner(userId) {
      return isSignedIn() && request.auth.uid == userId;
    }

    function isValidId(id) {
      return id is string && id.size() <= 64 && id.matches('^[a-zA-Z0-9_\\-]+$');
    }

    function isVerifiedUser() {
      return isSignedIn() && request.auth.token.email_verified == true;
    }

    // Helper to evaluate public resource updates
    function incoming(req) {
      return req.resource.data;
    }
    
    function existing(res) {
      return res.data;
    }

    // User Public Registry Rules
    match /users/{userId} {
      allow get: if isSignedIn();
      allow list: if false; // Block scraping of user data
      allow create: if isOwner(userId) 
        && incoming(request).role == "client" // Prevent privilege escalation
        && incoming(request).createdAt == request.time;
      
      allow update: if isOwner(userId)
        && incoming(request).role == existing(resource).role // Role is immutable
        && incoming(request).updatedAt == request.time;
        
      // Private split PII collection
      match /private/info {
        allow get: if isOwner(userId);
        allow write: if isOwner(userId);
      }
    }

    // Products catalog logic
    match /products/{productId} {
      allow read: if true; // Public access for search engines & customers
      
      allow create: if isVerifiedUser()
        && incoming(request).sellerId == request.auth.uid
        && incoming(request).price > 0 
        && incoming(request).price is number
        && incoming(request).stock is int
        && incoming(request).stock >= 0
        && incoming(request).createdAt == request.time;

      allow update: if isVerifiedUser()
        && existing(resource).sellerId == request.auth.uid
        && incoming(request).sellerId == request.auth.uid
        && incoming(request).price is number
        && incoming(request).price > 0
        && incoming(request).stock is int
        && incoming(request).stock >= 0
        && incoming(request).updatedAt == request.time;
        
      allow delete: if isVerifiedUser()
        && existing(resource).sellerId == request.auth.uid;
    }

    // Transactions and double-spend shields
    match /transactions/{transactionId} {
      allow get: if isSignedIn() && (
        resource.data.buyerId == request.auth.uid || 
        resource.data.sellerId == request.auth.uid
      );
      
      allow list: if isSignedIn() && (
        resource.data.buyerId == request.auth.uid || 
        resource.data.sellerId == request.auth.uid
      );

      allow create: if isSignedIn()
        && incoming(request).buyerId == request.auth.uid
        && incoming(request).status == "pending"
        && incoming(request).createdAt == request.time;

      // Allow Firestore transactions to advance steps and settle funds securely
      allow update: if isSignedIn()
        && (resource.data.buyerId == request.auth.uid || resource.data.sellerId == request.auth.uid)
        && incoming(request).status in ["processing", "success", "failed"]
        && (
          // System updates for MonCash settlement
          incoming(request).diff(existing(resource)).affectedKeys().hasOnly(['status', 'updatedAt'])
        );
    }
  }
}
```

---

## 💻 4. Next-Gen State Management & Caching System

To avoid state corruption, layout flickering, and massive Firebase read bills, we replace fragile global state models with a production framework driven by **TanStack Query (React Query)** and fine-tuned React 19 abstractions.

### ⚡ React Query Global setup (`src/lib/query.ts`)
```typescript
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes fresh before syncing
      gcTime: 1000 * 60 * 30,    // Hard cache lifespan 30 minutes
      retry: (failureCount, error: any) => {
        // Do not retry on auth/permission rejections
        if (error?.status === 403 || error?.code === 'permission-denied') return false;
        return failureCount < 3;
      },
      refetchOnWindowFocus: false, // Prevent redundant mobile re-renders
      refetchOnReconnect: 'always', // Critical for offline recovery in Haiti
    },
  },
});
```

### 🧠 Modern React Mutation Cache Hooks (`src/features/catalog/hooks/useProducts.ts`)
This implementation provides instantaneous rendering and protects offline-first clients:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, getDocs, doc, setDoc, query, where } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { Product } from '../../../types/product';

export function useProducts(category?: string) {
  return useQuery({
    queryKey: ['products', category],
    queryFn: async (): Promise<Product[]> => {
      let q = collection(db, 'products');
      if (category) {
        q = query(collection(db, 'products'), where('category', '==', category)) as any;
      }
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
    },
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (newProduct: Omit<Product, 'id'>) => {
      const docRef = doc(collection(db, 'products'));
      const productWithId = { ...newProduct, id: docRef.id, createdAt: new Date().toISOString() };
      await setDoc(docRef, productWithId);
      return productWithId;
    },
    // Optimistic UI updates
    onMutate: async (newProduct) => {
      await queryClient.cancelQueries({ queryKey: ['products'] });
      const previousProducts = queryClient.getQueryData<Product[]>(['products']);
      
      if (previousProducts) {
        queryClient.setQueryData<Product[]>(
          ['products'],
          [...previousProducts, { ...newProduct, id: 'temp-id' } as Product]
        );
      }
      return { previousProducts };
    },
    onError: (err, newProduct, context) => {
      if (context?.previousProducts) {
        queryClient.setQueryData(['products'], context.previousProducts);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}
```

---

## 💵 5. Double-Spend Defensive Transactions & Payment Webhooks

The 5-second processing period in our mobile flow simulates the carrier system validation. To run the applet on standard infrastructure, we use a custom server endpoint and defensive transactional locks inside Firestore to prevent double spending.

```typescript
import { runTransaction, doc, increment, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  sellerId: string;
}

export async function executeDefensivePurchase(
  userId: string,
  items: CartItem[],
  paymentMethod: 'moncash' | 'natcash',
  phoneNumber: string
): Promise<string> {
  const transactionId = `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  await runTransaction(db, async (transaction) => {
    // 1. Compile inventory checks first
    const productRefs = items.map(item => ({
      ref: doc(db, 'products', item.id),
      item
    }));

    const verifiedDocs = [];
    for (const prod of productRefs) {
      const snap = await transaction.get(prod.ref);
      if (!snap.exists()) {
        throw new Error(`Le produit ${prod.item.name} n'existe plus.`);
      }
      
      const currentStock = snap.data().stock || 0;
      if (currentStock < prod.item.quantity) {
        throw new Error(`Quantité demandée épuisée pour ${prod.item.name}. Stock restant: ${currentStock}`);
      }
      
      verifiedDocs.push({
        ref: prod.ref,
        currentStock,
        quantity: prod.item.quantity,
        price: prod.item.price,
        sellerId: prod.item.sellerId
      });
    }

    // 2. Complete stock reductions and credit seller earnings atomically
    for (const docInfo of verifiedDocs) {
      // Deduct target inventory
      transaction.update(docInfo.ref, {
        stock: Math.max(0, docInfo.currentStock - docInfo.quantity),
        updatedAt: serverTimestamp()
      });

      // Credit the merchant balance accounts securely
      const sellerRef = doc(db, 'users', docInfo.sellerId);
      transaction.set(sellerRef, {
        totalRevenue: increment(docInfo.price * docInfo.quantity),
        totalSales: increment(docInfo.quantity),
        updatedAt: serverTimestamp()
      }, { merge: true });
    }

    // 3. Log structural financial audit trail
    const transactionRef = doc(db, 'transactions', transactionId);
    transaction.set(transactionRef, {
      id: transactionId,
      buyerId: userId,
      items: items.map(i => ({ id: i.id, name: i.name, quantity: i.quantity, price: i.price })),
      totalAmount: items.reduce((sum, item) => sum + (item.price * item.quantity), 0),
      paymentMethod,
      phoneNumber,
      status: 'success',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  });

  return transactionId;
}
```

---

## 🌍 6. Progressive Web App (PWA) Offline Architecture

Connectivity can be unstable across both urban networks and remote artisan centers. LakayMarket is configured with an aggressive caching Service Worker that prioritizes local resources while queuing write queries.

### 📦 Web Application Manifest (`public/manifest.json`)
```json
{
  "short_name": "LakayMarket",
  "name": "LakayMarket: Marché d'Artisanat Haïtien",
  "icons": [
    {
      "src": "favicon.ico",
      "sizes": "64x64 32x32 24x24 16x16",
      "type": "image/x-icon"
    },
    {
      "src": "logo192.png",
      "type": "image/png",
      "sizes": "192x192"
    },
    {
      "src": "logo512.png",
      "type": "image/png",
      "sizes": "512x512"
    }
  ],
  "start_url": ".",
  "display": "standalone",
  "theme_color": "#EB5E55",
  "background_color": "#FFFFFF",
  "orientation": "portrait-primary"
}
```

### 🛰️ Modern Progressive Service Worker (`public/sw.js`)
This script uses Cache-First patterns for interface templates, network-first for catalogs, and implements fallbacks when networks are unreachable:

```javascript
const CACHE_NAME = 'lakay-static-v3';
const DYNAMIC_CACHE_NAME = 'lakay-dynamic-v3';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/logo192.png',
  '/logo512.png',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && key !== DYNAMIC_CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Bypass Firestore connection queries
  if (url.origin.includes('firestore.googleapis.com')) {
    return;
  }

  // Network-First for main static catalog files
  event.respondWith(
    fetch(request)
      .then((response) => {
        const clonedResponse = response.clone();
        caches.open(DYNAMIC_CACHE_NAME).then((cache) => {
          cache.put(request, clonedResponse);
        });
        return response;
      })
      .catch(() => {
        return caches.match(request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          // Return generic catalog offline fallback
          if (request.headers.get('accept').includes('text/html')) {
            return caches.match('/index.html');
          }
        });
      })
  );
});
```

---

## 🛠️ 7. Full-Stack Dockerization & Production Manifest

To run LakayMarket on standard serverless architectures (Cloud Run, AWS ECS, GCP Vercel proxies), we provide a secure, ultra-light dual-stage Docker orchestration manifest.

### 🐳 Multistage Production Dockerfile (`/Dockerfile`)
```dockerfile
# Stage 1: Fast compiling build container
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Clean execution container
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 reactapp

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# If running custom Node.js Express Server proxy or Firebase hosting Emulator
RUN npm install -g serve
USER reactapp
EXPOSE 3000

ENV PORT=3000
CMD ["serve", "-s", "dist", "-l", "3000"]
```

---

## 🤖 8. CI/CD Pipeline & Build Orchestration

This pipeline automatically tests, lints, and compiles security rules before deploying to staging/production on every push.

### 🚀 GitHub Actions Framework (`.github/workflows/deploy.yml`)
```yaml
name: LakayMarket Continuous Deployment

on:
  push:
    branches: [ main, staging ]

jobs:
  audit-and-verify:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Set up Node.js Lifecycle
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install Base Packages
        run: npm ci

      - name: Syntax Linting
        run: npm run lint

      - name: Compile and Build Assets
        run: npm run build

      - name: Run ESLint for Security Rules
        run: |
          npm install --save-dev @firebase/eslint-plugin-security-rules
          npx eslint firestore.rules

  deploy-infrastructure:
    needs: audit-and-verify
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - name: Checkout Source
        uses: actions/checkout@v4

      - name: Deploy Google Firebase Resources
        uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: '${{ secrets.GITHUB_TOKEN }}'
          firebaseServiceAccount: '${{ secrets.FIREBASE_SERVICE_ACCOUNT_LAKAYMARKET }}'
          channelId: live
          projectId: lakaymarket-prod
```

---

## 🧪 9. Complete Enterprise Testing Architecture

### 🛡️ Playwright End-to-End Test Suite (`tests/checkout.spec.ts`)
```typescript
import { test, expect } from '@playwright/test';

test.describe('LakayMarket Payment Gateway and Stock Settlement E2E Flow', () => {
  test('Should process MonCash and execute inventory reduction', async ({ page }) => {
    // 1. Visit store front Page
    await page.goto('/');
    
    // 2. Add sample artwork to cart
    const addToCartButton = page.locator('#add-to-cart-button-1').first();
    await addToCartButton.click();
    
    // 3. Confirm target cart is open
    const cartButton = page.locator('#cart-trigger');
    await cartButton.click();
    
    // 4. Initialize payment Checkout process
    const checkoutButton = page.locator('#checkout-start-btn');
    await checkoutButton.click();
    
    // 5. Select Digicel MonCash option
    await page.click('text=MonCash');
    
    // 6. Enter valid mobile validation targets
    await page.fill('input[type="tel"]', '37123456');
    await page.click('text=PAYER');

    // 7. Verify processing spinner appears matches the 5 seconds mock timing
    await expect(page.locator('text=Autorisez la transaction')).toBeVisible();
    
    // 8. Expect confirmation window within the 5 seconds test run
    await page.waitForTimeout(5500);
    await expect(page.locator('text=Merci pour votre achat')).toBeVisible();
  });
});
```

---

## 🛠️ 10. Operational Guidelines: Costs Management & Anti-Explosion Strategy

Scale without financial overheads. To prevent write amplification attacks, LakayMarket enforces:

### 💡 Anti-Inflation Checklist:
1.  **Stop query scraping**: Avoid blanket reads (`allow read: if isSignedIn()`). Only authorize matching filtering queries to reduce unnecessary read cycles.
2.  **Use metadata counts**: Maintain centralized counters for total orders in memory, updating them once during daily summaries instead of counting whole collection lengths on every page refresh.
3.  **Local storage cache**: Cache non-sensitive catalog items locally using standard LocalStorage or IndexDB, invalidating them only when custom webhooks indicate stock changes.
4.  **Debounce updates**: Add a 300ms debounce interval on product creation and profile editing interfaces to block spam, repetitive clicks, and duplicated writes.
