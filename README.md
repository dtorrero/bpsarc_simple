# Blueprint Inventory Management System

A web application for managing blueprint collections with user authentication, inventory tracking, and admin features.

## Features

- **User Authentication**: Login system with JWT tokens
- **Blueprint Catalog**: Browse all blueprints with images and details
- **Inventory Management**: Add blueprints to personal inventory, track quantities
- **Advanced Filtering**: Filter by map, condition, scavengable status
- **Admin Panel**: User management, password changes, system info
- **Dark Theme**: Modern dark UI with responsive design
- **Docker/Podman Ready**: Easy deployment with Caddy for automatic SSL

## Tech Stack

- **Backend**: Node.js + Express.js
- **Database**: SQLite (file-based, no separate DB server)
- **Frontend**: Vanilla JavaScript + HTML/CSS
- **Authentication**: JWT + bcrypt
- **Reverse Proxy**: Caddy (automatic HTTPS)
- **Containerization**: Docker/Podman
- **CI/CD**: GitHub Actions

## Project Structure

```
bpsarc_simple/
├── blueprints.json          # Blueprint data
├── images/                  # Blueprint images
├── static/                  # Favicons
├── server/                  # Backend code
│   ├── index.js            # Express server
│   ├── config.js           # Configuration
│   ├── db/init.js          # Database setup
│   ├── middleware/auth.js  # JWT middleware
│   └── routes/             # API routes
├── public/                  # Frontend files
│   ├── index.html          # Login page
│   ├── app.html            # Main application
│   ├── admin.html          # Admin panel
│   ├── css/styles.css      # Dark theme CSS
│   └── js/                 # JavaScript modules
├── deploy/                  # Deployment files
│   ├── podman-compose.yml  # Container orchestration
│   ├── Caddyfile           # Reverse proxy config
│   ├── setup.sh            # Setup script
│   └── .env.example        # Environment template
├── Dockerfile              # Container build
├── .github/workflows/      # CI/CD pipelines
└── README.md              # This file
```

## Quick Start (Development)

1. **Clone and install dependencies:**
   ```bash
   git clone <repository-url>
   cd bpsarc_simple
   npm install
   ```

2. **Start the development server:**
   ```bash
   npm run dev
   ```

3. **Access the application:**
   - Open http://localhost:3000
   - Default login: `admin` / `changeme`

## Deployment with Podman

### Prerequisites
- Podman and podman-compose installed on your ARM SBC
- Domain name (e.g., xiric.duckdns.org)
- Ports 80 and 443 open on your firewall

### Setup Steps

1. **Prepare deployment directory:**
   ```bash
   cd bpsarc_simple/deploy
   ```

2. **Run the setup script:**
   ```bash
   chmod +x setup.sh
   ./setup.sh
   ```

3. **Follow the interactive prompts:**
   - Enter your domain name
   - Enter your GitHub username
   - The script will generate a secure JWT secret

4. **Access your application:**
   - Open https://your-domain.com
   - Login with default credentials
   - **IMPORTANT**: Change the admin password immediately!

### Management Commands

```bash
# View logs
podman-compose logs -f

# Stop services
podman-compose down

# Restart services
podman-compose restart

# Update to latest version
podman-compose pull && podman-compose up -d

# Check service status
podman-compose ps

# Create backup
./backup.sh
```

## GitHub Actions CI/CD

The repository includes a GitHub Actions workflow that:
- Builds multi-architecture Docker images (AMD64 + ARM64)
- Pushes to GitHub Container Registry
- Runs basic tests and linting

### Setting up GitHub Actions

1. **Enable Actions** in your repository settings
2. **Push to main branch** to trigger the first build
3. **Update deploy/podman-compose.yml** with your GitHub username

## Security Notes

1. **Default Credentials**: The default admin password is `changeme` - CHANGE THIS IMMEDIATELY!
2. **JWT Secret**: A random secret is generated during setup. Keep your `.env` file secure.
3. **Database**: SQLite database is stored in `./data/database.sqlite`. Regular backups are recommended.
4. **HTTPS**: Caddy provides automatic SSL via Let's Encrypt. Ensure port 80 is open for the ACME challenge.

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user
- `POST /api/auth/change-password` - Change password

### Blueprints
- `GET /api/blueprints` - List blueprints (with filters)
- `GET /api/blueprints/filters` - Get available filter options
- `GET /api/blueprints/:name` - Get specific blueprint

### Inventory
- `GET /api/inventory` - Get user's inventory
- `POST /api/inventory/:name` - Add blueprint to inventory
- `DELETE /api/inventory/:name` - Remove blueprint from inventory
- `PUT /api/inventory/:name` - Set specific quantity

### Admin (admin only)
- `GET /api/auth/users` - List all users
- `POST /api/auth/users` - Create new user
- `DELETE /api/auth/users/:id` - Delete user

## Development

### Adding New Features

1. **New API endpoints**: Add to appropriate file in `server/routes/`
2. **Frontend changes**: Update files in `public/`
3. **Database changes**: Modify `server/db/init.js`

### Testing Locally

```bash
# Start development server with file watching
npm run dev

# Or start production server
npm start
```

## Troubleshooting

### Common Issues

1. **Caddy SSL errors**: Ensure port 80 is accessible for Let's Encrypt challenges
2. **Database permissions**: Run `chmod 755 data` and `chmod 644 data/*` if SQLite has permission issues
3. **Image loading**: Check that blueprint images exist in the `images/` directory
4. **Container networking**: Ensure containers can communicate on the `bpsarc-network`

### Logs

```bash
# View all logs
podman-compose logs

# View specific service logs
podman-compose logs app
podman-compose logs caddy

# Follow logs in real-time
podman-compose logs -f
```

## License

MIT License - see LICENSE file for details.

## Support

For issues and feature requests, please use the GitHub Issues page.
