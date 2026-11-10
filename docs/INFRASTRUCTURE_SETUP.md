# Infrastructure Guide: Automated Wildcard Subdomains & SSL Provisioning

This guide describes how to configure the production infrastructure for **MessMeals Automated Subdomains** (`*.messmeals.com`).

---

## 1. Architectural Model

```
                          ┌───────────────────────────┐
                          │   Cloudflare / DNS Provider │
                          │  *.messmeals.com  --> VPS IP│
                          └─────────────┬─────────────┘
                                        │ HTTPS (Port 443)
                                        ▼
                          ┌───────────────────────────┐
                          │   Nginx Wildcard Vhost    │
                          │   *.messmeals.com         │
                          │   Let's Encrypt Wildcard  │
                          └─────────────┬─────────────┘
                                        │ Reverse Proxy (Host preserved)
                                        ▼
                          ┌───────────────────────────┐
                          │   NestJS Backend (Port 3011)│
                          │   Hostname Resolver Svc   │
                          │   GET /open/by-hostname   │
                          └───────────────────────────┘
```

---

## 2. DNS Configuration (One-Time Setup)

At your DNS provider (e.g., Cloudflare, Route53, Namecheap), add **one single wildcard DNS A-record**:

| Type | Name | IPv4 Address | Proxy Status / TTL |
| :--- | :--- | :--- | :--- |
| **A** | `*` | `<YOUR_VPS_PUBLIC_IP>` | DNS Only (or Proxied if Cloudflare wildcard plan) / Auto (300s) |
| **A** | `@` | `<YOUR_VPS_PUBLIC_IP>` | Proxied / Auto |

> [!IMPORTANT]
> **Zero per-restaurant DNS changes:** Once `*.messmeals.com` points to your server, any subdomain (e.g. `annapoorna.messmeals.com`, `royal-mess.messmeals.com`) immediately resolves to your Nginx proxy without manual intervention.

---

## 3. Wildcard SSL Certificate (Let's Encrypt DNS-01)

Wildcard certificates (`*.messmeals.com`) require the **DNS-01 ACME challenge** (Let's Encrypt will not issue wildcard certificates via HTTP-01).

### Step 3.1: Install Certbot with Cloudflare DNS Plugin
On Ubuntu/Debian server:
```bash
sudo apt update
sudo apt install -y certbot python3-certbot-dns-cloudflare
```

### Step 3.2: Securely Store DNS Credentials
Create `/etc/letsencrypt/cloudflare.ini` with permissions restricted to `root` (chmod 600):
```ini
# /etc/letsencrypt/cloudflare.ini
dns_cloudflare_api_token = YOUR_CLOUDFLARE_API_TOKEN_WITH_ZONE_DNS_PERMISSIONS
```
Set strict permissions:
```bash
sudo chmod 600 /etc/letsencrypt/cloudflare.ini
```

### Step 3.3: Issue the Wildcard Certificate
Run Certbot:
```bash
sudo certbot certonly \
  --dns-cloudflare \
  --dns-cloudflare-credentials /etc/letsencrypt/cloudflare.ini \
  --dns-cloudflare-propagation-seconds 30 \
  -d messmeals.com \
  -d "*.messmeals.com" \
  --agree-tos \
  -m admin@messmeals.com \
  --no-eff-email
```
This generates:
- Certificate: `/etc/letsencrypt/live/messmeals.com/fullchain.pem`
- Private Key: `/etc/letsencrypt/live/messmeals.com/privkey.pem`

### Step 3.4: Automated SSL Renewal
Test dry-run renewal:
```bash
sudo certbot renew --dry-run
```
Certbot's systemd timer (`certbot.timer`) runs automatically twice a day. To automatically reload Nginx on renewal, create a post-hook:
```bash
sudo mkdir -p /etc/letsencrypt/renewal-hooks/deploy/
echo '#!/bin/sh
nginx -t && systemctl reload nginx' | sudo tee /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
sudo chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
```

---

## 4. Nginx Deployment

### Step 4.1: Deploy Configuration
Copy `nginx/messmeals-wildcard.conf` to Nginx sites directory:
```bash
sudo cp nginx/messmeals-wildcard.conf /etc/nginx/sites-available/messmeals-wildcard.conf
sudo ln -sf /etc/nginx/sites-available/messmeals-wildcard.conf /etc/nginx/sites-enabled/
```

### Step 4.2: Test and Reload Nginx
```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## 5. Verification Commands

1. **Verify DNS wildcard resolution:**
   ```bash
   dig +short random-test-restaurant.messmeals.com
   # Should return your server's public IP
   ```

2. **Verify SSL handshake:**
   ```bash
   openssl s_client -connect annapoorna.messmeals.com:443 -servername annapoorna.messmeals.com
   # Look for: CN = *.messmeals.com
   ```

3. **Verify Host header passthrough to NestJS:**
   ```bash
   curl -I -H "Host: annapoorna.messmeals.com" https://messmeals.com/open/by-hostname
   # Should return 200 OK with the restaurant storefront payload
   ```

---

## 6. Rollback Instructions

If any issues arise during deployment:
1. Revert Nginx configuration:
   ```bash
   sudo rm /etc/nginx/sites-enabled/messmeals-wildcard.conf
   sudo systemctl reload nginx
   ```
2. The database schema additions (`provisioningStatus`, `CustomDomain`) are fully backward-compatible and do not require rolling back MySQL tables.

