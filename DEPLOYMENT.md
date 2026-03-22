# Blueprint Inventory Deployment

## Quick Deployment with Podman Compose

1. **Navigate to deploy directory:**
   ```bash
   cd deploy
   ```

2. **Create `.env` file with your values:**
   ```bash
   cat > .env << EOF
   DOMAIN=your-domain.com  # or localhost for development
   JWT_SECRET=$(openssl rand -hex 32)
   CADDY_EMAIL=your-email@example.com  # optional for Let's Encrypt
   EOF
   ```

3. **Start the services:**
   ```bash
   podman-compose up -d
   ```

## Quick Deployment with Docker Compose

1. **From project root:**
   ```bash
   # Create .env file
   cat > .env << EOF
   DOMAIN=your-domain.com  # or localhost for development
   JWT_SECRET=$(openssl rand -hex 32)
   CADDY_EMAIL=your-email@example.com  # optional for Let's Encrypt
   EOF
   
   # Start services
   docker-compose up --build -d
   ```

## Environment Variables

- `DOMAIN`: Your domain name (required for SSL)
  - Use `localhost` for development (self-signed cert)
  - Use real domain (e.g., `example.com`) for production
- `JWT_SECRET`: Secret for authentication tokens
  - Generate with: `openssl rand -hex 32`
- `CADDY_EMAIL`: Email for Let's Encrypt (optional)
  - Required for production SSL certificate notifications

## SSL Certificates

- **Production (real domain)**: Automatic Let's Encrypt certificates
- **Development (localhost)**: Self-signed certificates (browser warning)
- Certificates are stored in Docker/Podman volumes

## Service Architecture

```
Internet → Caddy (HTTPS) → Node.js App (HTTP)
           Ports 80/443        Port 3000 (internal)
```

- Caddy handles SSL termination
- Node.js app runs internally on port 3000
- Data persisted in `./data` directory

## Management Commands

**Podman:**
```bash
cd deploy
podman-compose logs -f      # View logs
podman-compose down         # Stop services
podman-compose restart      # Restart services
podman-compose ps           # Check status
```

**Docker:**
```bash
docker-compose logs -f      # View logs
docker-compose down         # Stop services
docker-compose restart      # Restart services
docker-compose ps           # Check status
```

## Default Login
- Username: `admin`
- Password: `changeme`

**IMPORTANT**: Change the default password immediately after first login!