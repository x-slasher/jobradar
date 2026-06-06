#!/bin/bash
# ============================================================
# JobRadar — VPS Setup Script (Ubuntu 22.04+)
# Run once on a fresh VPS as root
# Usage: bash infrastructure/scripts/setup-vps.sh
# ============================================================

set -e

echo "==> Updating system packages"
apt-get update && apt-get upgrade -y

echo "==> Installing essential packages"
apt-get install -y curl git ufw fail2ban unattended-upgrades

echo "==> Installing Docker"
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker

echo "==> Installing Docker Compose plugin"
apt-get install -y docker-compose-plugin

echo "==> Configuring UFW firewall"
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP (redirects to HTTPS)
ufw allow 443/tcp   # HTTPS
ufw --force enable
echo "Firewall configured"

echo "==> Configuring fail2ban"
cat > /etc/fail2ban/jail.local << 'FAIL2BAN'
[DEFAULT]
bantime  = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port    = ssh
logpath = %(sshd_log)s
backend = %(sshd_backend)s
FAIL2BAN
systemctl enable fail2ban
systemctl restart fail2ban
echo "fail2ban configured"

echo "==> Disabling SSH password auth"
sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl reload sshd
echo "SSH password auth disabled — ensure your SSH key is added before logging out"

echo "==> Setting up PostgreSQL backup cron"
mkdir -p /opt/jobradar/backups
cat > /etc/cron.daily/jobradar-backup << 'CRON'
#!/bin/bash
# Daily PostgreSQL backup — keeps last 7 backups
BACKUP_DIR="/opt/jobradar/backups"
DATE=$(date +%Y%m%d_%H%M%S)
docker exec jobradar-postgres-1 pg_dump -U jobradar jobradar | gzip > $BACKUP_DIR/jobradar_$DATE.sql.gz
# Keep only last 7 backups
ls -t $BACKUP_DIR/jobradar_*.sql.gz | tail -n +8 | xargs -r rm
CRON
chmod +x /etc/cron.daily/jobradar-backup
echo "Backup cron configured"

echo ""
echo "======================================================"
echo "VPS setup complete."
echo ""
echo "Next steps:"
echo "  1. Clone your repo to /opt/jobradar"
echo "  2. cd /opt/jobradar"
echo "  3. cp .env.production .env"
echo "  4. Edit .env with your real values"
echo "  5. Edit infrastructure/caddy/Caddyfile with your domain"
echo "  6. docker compose -f docker-compose.prod.yml up -d"
echo "======================================================"
