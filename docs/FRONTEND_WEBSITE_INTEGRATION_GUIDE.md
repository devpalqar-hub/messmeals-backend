# Frontend Integration Guide: Automated Subdomains & Domain Management

This guide provides frontend engineering teams (React, Next.js, or Angular) with component specifications, state management, and API integration hooks for the upgraded **MessMeals Website Module**.

---

## 1. Subdomain Availability Live-Check (Website Generation Screen)

### User Flow
1. While configuring the website on the Generation Screen, the mess owner sees a suggested subdomain derived from their restaurant name (e.g., `annapoorna`).
2. An editable subdomain input field allows them to customize it:
   ```
   https:// [  annapoorna  ] .messmeals.com
   ```
3. As the user types, a debounced check (300ms) runs against `GET /api/v1/websites/subdomain/check?name=<input>`.
4. Visual feedback:
   - **Checking:** Loading spinner.
   - **Available:** Green checkmark + text: *"annapoorna.messmeals.com is available!"*.
   - **Unavailable / Reserved:** Red error message + reason (e.g., *"Already taken"* or *"Reserved system name"*).

### API Request
```http
GET /api/v1/websites/subdomain/check?name=annapoorna
Authorization: Bearer <access_token>
```

### API Response
```json
{
  "available": true,
  "normalized": "annapoorna",
  "subdomainUrl": "https://annapoorna.messmeals.com"
}
```

If taken:
```json
{
  "available": false,
  "normalized": "admin",
  "subdomainUrl": "https://admin.messmeals.com",
  "reason": "The name \"admin\" is a reserved system subdomain and cannot be registered"
}
```

---

## 2. Triggering Website Generation

When the user clicks **"Generate My Website"**:
```http
POST /api/v1/websites/generate
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "messId": "2d9ba720-63cf-4c41-bdcd-6711986a0343",
  "subdomain": "annapoorna",
  "theme": "WARM"
}
```

### Response
```json
{
  "success": true,
  "message": "Website generated and subdomain reserved successfully",
  "data": {
    "jobId": "8f31b2c4-8742-4211-9a74-b96e571dbb14",
    "websiteId": "b9edf124-4a15-49c9-9ece-521722a616ea",
    "status": "COMPLETED",
    "provisioningStatus": "RESERVED",
    "slug": "annapoorna",
    "subdomain": "annapoorna.messmeals.com",
    "websiteUrl": "https://annapoorna.messmeals.com",
    "previewUrl": "https://annapoorna.messmeals.com?preview=true"
  }
}
```

---

## 3. Real Progress States (Polling Generation Job)

Poll `GET /api/v1/websites/generation/:jobId` every 1.5 seconds.

Map the progress counter to meaningful UI checklist items:
- `progress: 20` -> 🟡 *Reserving website address (subdomain)...*
- `progress: 60` -> 🟡 *Compiling active menus & meal plans...*
- `progress: 100` -> 🟢 *Storefront preview ready!*

---

## 4. Website Preview & Publishing

### Screen Actions
- **Preview Frame:** Responsive container with toggle for **Desktop** (100% width) and **Mobile** (375px width) iframe pointing to `previewUrl`.
- **Copy Action:** Button that copies `https://annapoorna.messmeals.com` to the clipboard.
- **Publish Button:** Calls `POST /api/v1/websites/:id/publish`.

### Publish Response
```json
{
  "success": true,
  "message": "Website published successfully! Your online storefront is live.",
  "data": {
    "id": "b9edf124-4a15-49c9-9ece-521722a616ea",
    "slug": "annapoorna",
    "subdomain": "annapoorna.messmeals.com",
    "status": "PUBLISHED",
    "provisioningStatus": "ACTIVE",
    "isLive": true
  }
}
```

---

## 5. Domain Management Screen (Platform Subdomain vs Custom Domain)

Split the Domain Settings UI into two clean tabs:

### Tab A: Platform Subdomain
- Shows: `https://annapoorna.messmeals.com`
- Status Pill: `ACTIVE` (Green) or `NOT PUBLISHED` (Gray)
- Action: "Visit Storefront" (opens in new tab)
- Action: "Copy Address"

### Tab B: Custom Domain
Allows linking a custom domain (e.g. `order.annapoornamess.in`).

#### 1. Add Custom Domain Form
```http
POST /api/v1/websites/:websiteId/domains
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "domain": "order.annapoornamess.in"
}
```
**Response:**
```json
{
  "success": true,
  "data": {
    "id": "domain-uuid",
    "domain": "order.annapoornamess.in",
    "status": "PENDING",
    "dnsInstructions": {
      "type": "TXT",
      "host": "@",
      "value": "messmeals-verification=1d1e64f657f882ba74f836e443d02798",
      "cnameTarget": "storefront.messmeals.com"
    }
  }
}
```

#### 2. Display DNS Instructions Card
Show copyable table:
| Record Type | Host / Name | Target / Value |
| :--- | :--- | :--- |
| `TXT` | `@` | `messmeals-verification=1d1e64f657f882ba74f836e443d02798` |
| `CNAME` | `order` | `storefront.messmeals.com` |

#### 3. "Verify DNS" Action
Button: **"Verify DNS Records"**
Calls:
```http
POST /api/v1/websites/:websiteId/domains/:domainId/verify
```
- If verified: Status pill changes to `ACTIVE` (Green).
- If not yet propagated: Informative alert: *"DNS changes may take some time to propagate. Please check again in a few minutes."*

#### 4. Disconnect Action
Button: **"Disconnect Domain"** (with confirmation dialog)
Calls:
```http
DELETE /api/v1/websites/:websiteId/domains/:domainId
```

---

## 6. Public Storefront Rendering (`/open/by-hostname`)

When the public storefront Next.js / React application loads in the user's browser, it simply calls:
```http
GET /open/by-hostname
Host: annapoorna.messmeals.com
```
Or for local development:
```http
GET /open/by-hostname?hostname=annapoorna.messmeals.com
```
This returns the full storefront JSON payload with:
- Mess details, address, opening hours
- Visual branding (theme, primary/secondary colors, logo, cover image, gallery)
- Active meal subscription plans
- Weekly menu schedules
- Verified customer reviews & ratings

