# Deploy TFD Tracker to Ubuntu VPS

Follow these steps on your Ubuntu VPS. SSH in first (`ssh ubuntu@your-server-ip`).

---

## 1) Install Node.js LTS

```bash
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version   # should print v22.x or similar
```

---

## 2) Install Docker + Docker Compose

```bash
sudo apt-get install -y docker.io docker-compose-plugin
sudo usermod -aG docker $USER
newgrp docker    # apply group change without logging out
docker --version
```

---

## 3) Clone the repo

```bash
mkdir -p ~/apps
git clone https://github.com/Ahgoni/TFD-Tracker.git ~/apps/TFD
cd ~/apps/TFD/tfd-web
```

---

## 4) Configure environment

```bash
cp .env.example .env
nano .env
```

Fill in every value:

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/tfd_tracker?schema=public"
NEXTAUTH_SECRET="<generate below>"
NEXTAUTH_URL="https://yourdomain.com"
DISCORD_CLIENT_ID="your-discord-client-id"
DISCORD_CLIENT_SECRET="your-discord-client-secret"
```

Generate a secure AUTH_SECRET:

```bash
openssl rand -base64 32
```

---

## 5) Set up static assets

The `npm install` postinstall script creates the Images symlink and copies
weapons-catalog.json automatically. If it fails, run manually:

```bash
ln -sf "$(pwd)/../Images" "$(pwd)/public/Images"
cp ../weapons-catalog.json public/weapons-catalog.json
```

---

## 6) Start PostgreSQL

```bash
docker compose up -d db
docker compose ps    # db should show "running"
```

---

## 7) Install dependencies and run migrations

```bash
npm install
npx prisma migrate deploy   # applies all SQL migrations in prisma/migrations/
```

If this is your first deployment and you want to skip migrations:
```bash
npx prisma db push   # pushes schema directly (no migration files needed)
```

---

## 8) Build the app

```bash
npm run build
```

---

## 9) Run with PM2 (stays alive after reboot)

```bash
sudo npm install -g pm2
pm2 start "npm run start" --name tfd-web
pm2 save
pm2 startup   # copy and run the printed command to enable auto-start
```

Check it's running:
```bash
pm2 list
curl http://localhost:3000   # should return HTML
```

---

## 10) Nginx + HTTPS (Certbot)

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

Create `/etc/nginx/sites-available/tfd`:

```nginx
server {
    server_name yourdomain.com;

    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/tfd /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# Provision TLS (replace with your actual domain)
sudo certbot --nginx -d yourdomain.com
```

---

## 11) Discord Developer Portal

Go to https://discord.com/developers/applications → your app → **OAuth2** → **Redirects**.

Add:
```
https://yourdomain.com/api/auth/callback/discord
```

Also update `NEXTAUTH_URL` in `.env` to `https://yourdomain.com` and restart:
```bash
pm2 restart tfd-web
```

---

## 12) Future code updates (from Windows → Ubuntu)

On Windows, after making changes:
```powershell
git add .
git commit -m "describe changes"
git push
```

On Ubuntu:
```bash
cd ~/apps/TFD
git pull
cd tfd-web
npm install
npx prisma migrate deploy
npm run build
pm2 restart tfd-web
```

---

## 13) Database backups (nightly)

```bash
# Create backup script
cat > ~/backup-tfd.sh << 'EOF'
#!/bin/bash
pg_dump "postgresql://postgres:postgres@localhost:5432/tfd_tracker" \
  > /var/backups/tfd_tracker_$(date +%F).sql
find /var/backups -name "tfd_tracker_*.sql" -mtime +30 -delete
EOF
chmod +x ~/backup-tfd.sh

# Schedule with cron (runs at 3am daily)
(crontab -l 2>/dev/null; echo "0 3 * * * ~/backup-tfd.sh") | crontab -
```

Restore from backup:
```bash
psql "postgresql://postgres:postgres@localhost:5432/tfd_tracker" < /path/to/backup.sql
```
