#!/bin/bash

# Blueprint Inventory Setup Script
# Run this script on your ARM SBC host to deploy the application

set -e

echo "========================================="
echo "  Blueprint Inventory Setup"
echo "========================================="
echo ""

# Check if podman-compose is available
if ! command -v podman-compose &> /dev/null; then
    echo "❌ podman-compose is not installed."
    echo "Please install it first:"
    echo "  sudo apt install podman-compose  # Debian/Ubuntu"
    echo "  sudo dnf install podman-compose  # Fedora"
    echo "  sudo pacman -S podman-compose    # Arch"
    exit 1
fi

# Check if we're in the deploy directory
if [ ! -f "podman-compose.yml" ]; then
    echo "⚠️  Please run this script from the deploy directory."
    echo "   cd /path/to/bpsarc_simple/deploy"
    echo "   ./setup.sh"
    exit 1
fi

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p data
mkdir -p backup

# Check for .env file
if [ ! -f ".env" ]; then
    echo ""
    echo "📝 Creating .env file..."
    
    # Get domain from user
    read -p "Enter your domain (e.g., xiric.duckdns.org): " domain
    domain=${domain:-xiric.duckdns.org}
    
    # Generate JWT secret
    jwt_secret=$(openssl rand -hex 32 2>/dev/null || echo "dev-secret-change-in-production-$(date +%s)")
    
    # Get GitHub username
    read -p "Enter your GitHub username (for container image): " github_user
    github_user=${github_user:-yourusername}
    
    # Create .env file
    cat > .env << EOF
# Blueprint Inventory Configuration
DOMAIN=${domain}
JWT_SECRET=${jwt_secret}
GITHUB_USER=${github_user}

# Optional: Uncomment and set if you want to use a specific image tag
# IMAGE_TAG=latest

# Optional: Database backup settings
# BACKUP_CRON="0 2 * * *"  # Daily at 2 AM
# BACKUP_RETENTION_DAYS=7
EOF
    
    echo "✅ .env file created with your settings."
    echo ""
else
    echo "✅ .env file already exists."
    echo ""
fi

# Pull latest images
echo "⬇️  Pulling latest images..."
podman-compose pull

# Start services
echo "🚀 Starting services..."
podman-compose up -d

# Wait for services to be healthy
echo "⏳ Waiting for services to start (30 seconds)..."
sleep 30

# Check if app is running
if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
    echo ""
    echo "========================================="
    echo "✅ Setup completed successfully!"
    echo "========================================="
    echo ""
    echo "📋 Application Information:"
    echo "   • App URL: https://$(grep DOMAIN .env | cut -d= -f2)"
    echo "   • Default login: admin / changeme"
    echo ""
    echo "⚠️  IMPORTANT SECURITY NOTES:"
    echo "   1. CHANGE THE DEFAULT ADMIN PASSWORD IMMEDIATELY!"
    echo "   2. The JWT secret is in the .env file - keep it secure"
    echo "   3. Regular backups are recommended"
    echo ""
    echo "🔧 Management Commands:"
    echo "   • View logs: podman-compose logs -f"
    echo "   • Stop services: podman-compose down"
    echo "   • Restart services: podman-compose restart"
    echo "   • Update to latest version: podman-compose pull && podman-compose up -d"
    echo ""
    echo "📊 To check service status:"
    echo "   podman-compose ps"
    echo ""
else
    echo ""
    echo "⚠️  Services started, but health check failed."
    echo "   Check logs with: podman-compose logs"
    echo "   Then try accessing: https://$(grep DOMAIN .env | cut -d= -f2)"
    echo ""
fi

# Create backup script
cat > backup.sh << 'EOF'
#!/bin/bash
# Backup script for Blueprint Inventory

BACKUP_DIR="./backup"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup_$TIMESTAMP.tar.gz"

echo "Creating backup..."
mkdir -p $BACKUP_DIR

# Stop services to ensure consistent backup
podman-compose stop app

# Create backup
tar -czf $BACKUP_FILE \
    data/database.sqlite \
    .env \
    Caddyfile \
    podman-compose.yml

# Start services again
podman-compose start app

echo "Backup created: $BACKUP_FILE"

# Cleanup old backups (keep last 7 days)
find $BACKUP_DIR -name "backup_*.tar.gz" -mtime +7 -delete
EOF

chmod +x backup.sh

echo "📦 Backup script created: ./backup.sh"
echo "   Run it manually or set up a cron job for automatic backups."
echo ""
