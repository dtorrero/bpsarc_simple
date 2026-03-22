// API Client for Blueprint Inventory

class API {
    constructor() {
        this.baseUrl = '/api';
        this.token = localStorage.getItem('token');
    }

    setToken(token) {
        this.token = token;
        if (token) {
            localStorage.setItem('token', token);
        } else {
            localStorage.removeItem('token');
        }
    }

    getHeaders() {
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }
        
        return headers;
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const headers = this.getHeaders();
        
        const config = {
            ...options,
            headers: {
                ...headers,
                ...options.headers
            }
        };

        try {
            const response = await fetch(url, config);
            
            if (response.status === 401) {
                // Token expired or invalid
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                // Only redirect if not already on the login page
                if (window.location.pathname !== '/' && window.location.pathname !== '/index.html') {
                    window.location.href = '/';
                }
                throw new Error('Unauthorized');
            }

            if (!response.ok) {
                const error = await response.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(error.error || `HTTP ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    }

    // Auth endpoints
    async login(username, password) {
        const data = await this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
        
        if (data.token) {
            this.setToken(data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
        }
        
        return data;
    }

    async getCurrentUser() {
        return await this.request('/auth/me');
    }

    async changePassword(currentPassword, newPassword) {
        return await this.request('/auth/change-password', {
            method: 'POST',
            body: JSON.stringify({ currentPassword, newPassword })
        });
    }

    // User management (admin only)
    async getUsers() {
        return await this.request('/auth/users');
    }

    async createUser(username, password, isAdmin = false) {
        return await this.request('/auth/users', {
            method: 'POST',
            body: JSON.stringify({ username, password, isAdmin })
        });
    }

    async deleteUser(userId) {
        return await this.request(`/auth/users/${userId}`, {
            method: 'DELETE'
        });
    }

    // Blueprint endpoints
    async getBlueprints(filters = {}) {
        const params = new URLSearchParams();
        Object.entries(filters).forEach(([key, value]) => {
            if (value) params.append(key, value);
        });
        
        const query = params.toString() ? `?${params.toString()}` : '';
        return await this.request(`/blueprints${query}`);
    }

    async getBlueprintFilters() {
        return await this.request('/blueprints/filters');
    }

    async getBlueprint(name) {
        return await this.request(`/blueprints/${name}`);
    }

    // Inventory endpoints
    async getInventory() {
        return await this.request('/inventory');
    }

    async addToInventory(blueprintName, quantity = 1) {
        return await this.request(`/inventory/${encodeURIComponent(blueprintName)}`, {
            method: 'POST',
            body: JSON.stringify({ quantity })
        });
    }

    async removeFromInventory(blueprintName, quantity = 1) {
        return await this.request(`/inventory/${encodeURIComponent(blueprintName)}`, {
            method: 'DELETE',
            body: JSON.stringify({ quantity })
        });
    }

    async setInventoryQuantity(blueprintName, quantity) {
        return await this.request(`/inventory/${encodeURIComponent(blueprintName)}`, {
            method: 'PUT',
            body: JSON.stringify({ quantity })
        });
    }

    // Health check
    async healthCheck() {
        return await this.request('/health');
    }

    // Logout
    logout() {
        this.setToken(null);
        localStorage.removeItem('user');
        window.location.href = '/';
    }
}

// Create global API instance
window.api = new API();
