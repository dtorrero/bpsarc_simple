# Multi-stage build for smaller image
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application files (including images and blueprints.json)
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

# Final stage
FROM node:20-alpine

WORKDIR /app

# Create non-root user in final stage
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy built application from builder stage
COPY --from=builder --chown=nodejs:nodejs /app /app

# Create data directory for SQLite
RUN mkdir -p /app/data && chown nodejs:nodejs /app/data

# ========== SECURITY HARDENING ==========
# Remove unnecessary packages
RUN apk del --no-cache apk-tools 2>/dev/null || true

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {if(r.statusCode !== 200) throw new Error()})"

# Start the application
CMD ["node", "server/index.js"]
