# 03 · Licensing Token Architecture

End-to-end design for managing license tokens/keys for premium content, matched to the actual
stack: static React SPA (Lovable/Vite) + Supabase, with Polar.sh primary and Gumroad fallback.

## 0. Principles

1. **Supabase is the single source of truth for entitlements.** The payment platform is the
   purchase and key-issuance *signal*; your own DB decides access. This makes the vendor
   swappable (Polar ⇄ Gumroad ⇄ Stripe+Keygen later) without re-licensing buyers.
2. **A static SPA can never hold a secret or perform a real access check.** Every enforcement
   point lives in a Supabase Edge Function or Storage policy.
3. **Premium content never touches the public surface** — not `/public`, not the public GitHub
   repo, not the PWA precache, not the bundled JSON.
4. **Social DRM, not hard DRM.** Watermark, rate-limit, revoke on refund, DMCA indexed leaks,
   and accept residual leakage as a cost of doing business. Hard DRM on markdown/PDF is a
   losing trade that punishes paying customers.

## 1. Threat model (what the tokens must survive)

| Threat | Mitigation |
|---|---|
| Paywall bypass via public assets | Leak purge (§8): premium content out of public JSON/precache/repo entirely |
| Key sharing | Device-activation limits (3), server-side validation on every download, per-buyer watermarks |
| Refund/chargeback abuse | Webhook-driven revocation kills key + entitlements + downloads at once |
| Gray-market resale of cheap-region (PPP) keys | PPP bound to card country at checkout; non-transferable per EULA; velocity flags |
| Mass leak of files | Watermark attribution, rate limits per license, DMCA takedowns |
| Vendor lock-in / vendor death | Own entitlements DB; vendor is only the signal |

## 2. Product & key configuration (Polar)

- Each product (Skill Pack, Field Manual, Complete Library, Team) carries:
  - a **license-key benefit** — prefix `CLDR_`, activation limit **3 devices**, **no expiry**
    (lifetime positioning forbids expiring keys), auto-revocation on refund;
  - a **file-download benefit** for the typeset/stamped artifacts (up to 10 GB per file).
- Complete Library is one product whose entitlement maps to *all* volume content rows —
  future volumes light up automatically for existing buyers.
- Teams use Polar seat-based pricing (beta) as the purchase signal; enforcement is our own
  `seats` table (§6). **Never a shared key** — every member gets an individual entitlement.

Polar's customer-portal license endpoints are public (no secret required), so they are safe to
call from the SPA or a future CLI:

```
POST https://api.polar.sh/v1/customer-portal/license-keys/validate
  { key, organization_id, activation_id? }
POST https://api.polar.sh/v1/customer-portal/license-keys/activate
  { key, organization_id, label }        → returns activation.id (store client-side; 403 at limit)
POST https://api.polar.sh/v1/customer-portal/license-keys/deactivate
  { key, organization_id, activation_id }
```

Server-side management (Bearer org token): `GET/PATCH /v1/license-keys/{id}` for limits/status.

## 3. Supabase schema

```sql
-- Purchases: raw, idempotent ingestion of vendor events
create table purchases (
  id uuid primary key default gen_random_uuid(),
  vendor text not null check (vendor in ('polar','gumroad')),
  vendor_order_id text not null,
  email text not null,
  product_id text not null,           -- our product slug, mapped from vendor product
  amount_cents int,
  currency text,
  raw jsonb not null,
  created_at timestamptz not null default now(),
  unique (vendor, vendor_order_id)    -- idempotency
);

-- Licenses: one row per issued key
create table licenses (
  id uuid primary key default gen_random_uuid(),
  vendor text not null,
  license_key text not null unique,
  purchase_id uuid references purchases(id),
  product_id text not null,
  email text not null,
  status text not null default 'active'
    check (status in ('active','revoked','disabled')),
  seats int not null default 1,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

-- Entitlements: what actually grants access (user- or email-keyed)
create table entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),   -- null until claimed
  email text not null,
  product_id text not null,
  license_id uuid references licenses(id),
  granted_via text not null,                -- 'purchase' | 'seat' | 'comp' | 'contributor'
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

-- Teams
create table teams (
  id uuid primary key default gen_random_uuid(),
  license_id uuid not null references licenses(id),
  owner_email text not null,
  seat_limit int not null
);
create table seats (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id),
  member_email text not null,
  entitlement_id uuid references entitlements(id),
  claimed_at timestamptz,
  unique (team_id, member_email)
);

-- Premium content lives in tables/Storage, not public JSON
create table premium_skills (
  slug text primary key,
  volume text not null,
  title text not null,
  teaser_md text not null,      -- first ~40 lines, publicly readable
  content_md text not null,     -- full content, service-role only
  version text not null,
  updated_at timestamptz not null default now()
);

create table releases (
  id uuid primary key default gen_random_uuid(),
  product_id text not null,
  version text not null,
  notes text,
  storage_path text not null,   -- private bucket: products/{product}/{version}/…
  published_at timestamptz not null default now()
);

create table download_log (
  id bigint generated always as identity primary key,
  entitlement_id uuid references entitlements(id),
  release_id uuid references releases(id),
  ip inet, created_at timestamptz not null default now()
);

create table fraud_flags (
  id uuid primary key default gen_random_uuid(),
  email text, license_id uuid references licenses(id),
  reason text not null, created_at timestamptz not null default now()
);
```

RLS: everything above is service-role-only except `premium_skills.teaser_md` (public read via a
view) and users reading *their own* entitlements/seats. Storage: `products` bucket is private;
add a defense-in-depth RLS policy on `storage.objects` joined to `entitlements` even though the
primary path is signed URLs.

## 4. Edge functions (the enforcement points)

**`polar-webhook`** (deployed `--no-verify-jwt`):
- Verify Standard-Webhooks signature (HMAC-SHA256, `whsec_` secret in Vault) using
  `webhook-id`/`webhook-timestamp`/`webhook-signature` headers; reject on skew/mismatch.
- Handle `order.created` → upsert `purchases` (idempotent on `vendor_order_id`);
  `benefit_grant.created` → insert `licenses` + `entitlements` keyed by verified buyer email;
  `benefit_grant.revoked` (refund/chargeback/cancel) → set `revoked_at` on license + all
  dependent entitlements — one event kills access everywhere at once.
- Ack in <2 s; defer heavy work (delivery emails, stamping) to a queue table. Delivery is
  at-least-once with retries — idempotency is mandatory.

**`claim`** — links a purchase to an account:
- Primary path: Supabase Auth **magic link to the purchase email**; on first sign-in,
  auto-link `entitlements.user_id` where `email` matches.
- Fallback path (mismatched email): accept a license key, call Polar's public validate
  endpoint, verify status, link `user_id`, store the activation id client-side, and expose a
  "deactivate device" button (calls the public deactivate endpoint).

**`get-skill`** — serves premium markdown:
- Input: skill slug + user JWT. Check a live entitlement covering the skill's volume
  (`revoked_at is null`). Return `content_md`; otherwise return the teaser + purchase CTA.

**`download`** — mints artifact URLs:
- Re-check entitlement AND license status at download time (refund revocation applies
  instantly), rate-limit per license (e.g. 20/day), log to `download_log`,
  **stamp the file (§5)**, then `createSignedUrl(path, 60–300s)` from the private bucket.
  Signed URLs are bearer links until expiry — keep TTL short.

**`issue-license-file`** (deferred, for a future CLI/offline use):
- Ed25519 keypair; private key in Vault. License file =
  `base64url(payload) + "." + base64url(sign(payload))` with payload
  `{ schema, license_key, email, product_id, seats, issued_at, revalidate_by }`.
  Client embeds only the 32-byte public key (WebCrypto/tweetnacl verify — works in Deno/Node).
  Include `revalidate_by` so revocations eventually propagate offline. Not launch-blocking.

## 5. Social DRM — watermarking pipeline

At download time (in `download`, or pre-generated per order into a per-buyer Storage path):
- **PDF:** footer on every page — `Licensed to jane@example.com · Order #1234` (pdf-lib/qpdf) +
  XMP metadata keys.
- **EPUB:** inserted colophon page + metadata.
- **SKILL.md zip:** `LICENSE.txt` manifest with buyer + order + EULA summary; per-file comment
  stamps where format allows.
- Rate-limit downloads per license; disable → revoke on refund; DMCA takedowns for indexed
  leaks; accept the rest.

(Note: `src/lib/downloads.ts` exists in the site today — the stamping concept moves
server-side; client-side stamping is decorative, not enforcement.)

## 6. Teams

1. Billing manager buys N seats (Polar seat pricing, or quantity fallback).
2. Webhook creates `licenses` (seats=N) + `teams` row; owner gets an invite dashboard
   (`/account`), adds member emails → `seats` rows.
3. Each member claims via magic link → personal `entitlements` row.
4. Seat reassignment frees the old entitlement (revoke) and issues a new one; enforced by
   `seat_limit`. Invoice/PO handled by the MoR; W-8/vendor forms need the legal entity
   (doc 05, item 7).

## 7. Gumroad fallback mapping

Same schema, different signal:
- Verify: `POST https://api.gumroad.com/v2/licenses/verify` with `product_id` + `license_key` —
  **always pass `increment_uses_count=false` for passive checks** (it defaults to true and
  inflates the counter). A `success` response is NOT good standing — additionally check
  `purchase.refunded`, `purchase.chargebacked`, and subscription end/cancel/fail fields.
- Manage (OAuth, `edit_products` scope): `PUT /v2/licenses/disable` (kill switch),
  `/enable`, `/rotate` (leaked key), `/decrement_uses_count` (device deactivation).
- Webhooks ("ping"/resource_subscriptions: sale, refund, dispute, cancellation) are
  form-encoded and **unsigned** — authenticate by a random secret in the webhook URL, check
  `seller_id`, and treat the ping as a hint: re-fetch truth via the verify API before writing
  entitlements.
- Multi-seat: enable Gumroad's multi-seat license; verify responses carry
  `is_multiseat_license` + `quantity`; enforcement stays in our `seats` table.

## 8. Launch-day leak purge (blocking checklist)

1. Strip premium content from all `public/data/*.json` and `public/skills-pack/` — the public
   JSON becomes catalog + ~40-line teasers (≈95% payload cut from 8.1 MB; a site-speed win too).
2. Bump the PWA cache version to evict precached full corpora from returning visitors' devices.
3. Remove any raw.githubusercontent fallback for premium slugs; premium sources live only in
   the private content repo.
4. Update robots.txt / llms.txt / JSON-LD (add `Offer` price markup; fix the "is it free?" FAQ)
   so marketing claims match freemium reality.
5. Remember: git history, forks, Wayback, and LLM training sets retain everything published
   before launch — which is why premium volumes are substantively new material (doc 05, item 2).

## 9. Fraud & abuse handling

- `benefit_grant.revoked` → license + entitlements revoked automatically (already designed).
- Redemption-velocity limits (same key activating many devices/IPs in hours → flag).
- Multi-refund emails → `fraud_flags`; manual review before honoring further purchases.
- Refund-rate alarm at >5% → investigate product/expectation mismatch.
- PPP: bind discount to card country at checkout; mark PPP licenses non-transferable (EULA).

## 10. Build order

1. Schema + `polar-webhook` + sandbox test purchase (Polar sandbox).
2. `claim` + `/account` page (entitlements, devices, downloads, seat management).
3. `premium_skills` split pipeline (teaser/full) + `get-skill` + SkillModal "Unlock" CTA
   (gate `getSkillContent()`/`getInstallCommand()` in `src/lib/skillActions.ts`).
4. `download` + watermark pipeline + private bucket + releases table.
5. Teams flow. 6. Gumroad adapter (only if needed). 7. Ed25519 offline files (later).
