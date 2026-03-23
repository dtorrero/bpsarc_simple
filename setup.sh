#!/bin/bash

# Setup script for Blueprint Inventory on ARM machine
# Run this script before starting with docker-compose/podman-compose

set -e

echo "========================================="
echo "  Blueprint Inventory Setup"
echo "========================================="
echo ""

# Check if we're in the right directory
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ Please run this script from the directory containing docker-compose.yml"
    exit 1
fi

echo "🔧 Checking for existing containers from previous failed attempts..."
echo ""

# Check for existing containers
if podman ps -a --format "{{.Names}}" | grep -q "bpsarc-app\|bpsarc-caddy" 2>/dev/null || \
   docker ps -a --format "{{.Names}}" | grep -q "bpsarc-app\|bpsarc-caddy" 2>/dev/null; then
    echo "⚠️  Found existing containers from previous deployment attempts."
    echo ""
    echo "To clean up and start fresh, run:"
    echo "  podman-compose down  # or docker-compose down"
    echo "  podman rm bpsarc-app bpsarc-caddy 2>/dev/null || true"
    echo "  podman volume prune -f 2>/dev/null || true"
    echo ""
    read -p "Do you want to clean up existing containers now? (y/n): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Cleaning up..."
        podman-compose down 2>/dev/null || docker-compose down 2>/dev/null || true
        podman rm bpsarc-app bpsarc-caddy 2>/dev/null || true
        podman volume prune -f 2>/dev/null || docker volume prune -f 2>/dev/null || true
        echo "✅ Cleanup complete."
        echo ""
    fi
fi

echo "📁 Creating data directory..."
mkdir -p data

# Set permissions - readable and executable by everyone, writable by owner
# Podman/Docker will handle user namespace mapping
chmod -R 755 data 2>/dev/null || sudo chmod -R 755 data 2>/dev/null || true

echo "✅ Data directory created: ./data"
echo "Note: If you get database permission errors, run: sudo chmod -R 777 data"
echo ""

echo "🔧 Checking docker-compose.yml variables..."
echo ""
echo "IMPORTANT: Edit these variables in docker-compose.yml before starting:"
echo "1. JWT_SECRET: Generate with: openssl rand -hex 32"
echo "2. DOMAIN: Your domain (e.g., example.com) or 'localhost' for development"
echo "3. CADDY_EMAIL: Optional email for Let's Encrypt"
echo ""

read -p "Do you want to generate a JWT_SECRET now? (y/n): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || echo "dev-secret-$(date +%s)")
    echo "Generated JWT_SECRET: $JWT_SECRET"
    echo "Copy this into docker-compose.yml (replace 'your-secure-jwt-secret-change-this')"
    echo ""
fi

echo "🚀 Ready to deploy!"
echo ""
echo "To start the application:"
echo "  podman-compose up -d   # or docker-compose up -d"
echo ""
echo "The application will be available at: http://your-server-ip:3000"
echo ""
echo "To view logs:"
echo "  podman-compose logs -f   # or docker-compose logs -f"
echo ""
echo "To stop:"
echo "  podman-compose down   # or docker-compose down"
echo ""
echo "Default login: admin / changeme"
echo "⚠️  CHANGE THE DEFAULT PASSWORD IMMEDIATELY AFTER FIRST LOGIN!"
