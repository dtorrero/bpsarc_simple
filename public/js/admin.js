// Admin panel logic

class AdminPanel {
    constructor() {
        this.users = [];
        this.init();
    }
    
    async init() {
        // Check authentication and admin status
        const user = auth.getCurrentUser();
        if (!user) {
            window.location.href = '/';
            return;
        }
        
        if (!user.isAdmin) {
            window.location.href = '/app';
            return;
        }
        
        // Update UI with user info
        this.updateUserInfo(user);
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Load initial data
        await this.loadUsers();
        await this.loadSystemInfo();
    }
    
    updateUserInfo(user) {
        const usernameDisplay = document.getElementById('usernameDisplay');
        if (usernameDisplay) {
            usernameDisplay.textContent = user.username;
        }
    }
    
    setupEventListeners() {
        // Back button
        const backBtn = document.getElementById('backBtn');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                window.location.href = '/app';
            });
        }
        
        // Logout button
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                auth.logout();
            });
        }
        
        // Add user button
        const addUserBtn = document.getElementById('addUserBtn');
        if (addUserBtn) {
            addUserBtn.addEventListener('click', () => this.addUser());
        }
        
        // Change password button
        const changePasswordBtn = document.getElementById('changePasswordBtn');
        if (changePasswordBtn) {
            changePasswordBtn.addEventListener('click', () => this.changePassword());
        }
        
        // Enter key support for forms
        const newUsername = document.getElementById('newUsername');
        const newPassword = document.getElementById('newPassword');
        
        if (newUsername && newPassword) {
            newUsername.addEventListener('keyup', (e) => {
                if (e.key === 'Enter') this.addUser();
            });
            newPassword.addEventListener('keyup', (e) => {
                if (e.key === 'Enter') this.addUser();
            });
        }
        
        const currentPassword = document.getElementById('currentPassword');
        const newPasswordAdmin = document.getElementById('newPasswordAdmin');
        const confirmPassword = document.getElementById('confirmPassword');
        
        if (currentPassword && newPasswordAdmin && confirmPassword) {
            currentPassword.addEventListener('keyup', (e) => {
                if (e.key === 'Enter') this.changePassword();
            });
            newPasswordAdmin.addEventListener('keyup', (e) => {
                if (e.key === 'Enter') this.changePassword();
            });
            confirmPassword.addEventListener('keyup', (e) => {
                if (e.key === 'Enter') this.changePassword();
            });
        }
    }
    
    async loadUsers() {
        const container = document.getElementById('usersTableContainer');
        if (!container) return;
        
        container.innerHTML = `
            <div class="loading">
                <div class="loading-spinner"></div>
                <p>Loading users...</p>
            </div>
        `;
        
        try {
            const data = await api.getUsers();
            this.users = data.users;
            this.renderUsersTable();
            
        } catch (error) {
            console.error('Failed to load users:', error);
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">⚠️</div>
                    <p>Failed to load users</p>
                    <button class="btn btn-primary mt-2" onclick="admin.loadUsers()">Retry</button>
                </div>
            `;
        }
    }
    
    renderUsersTable() {
        const container = document.getElementById('usersTableContainer');
        if (!container) return;
        
        if (this.users.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">👤</div>
                    <p>No users found</p>
                </div>
            `;
            return;
        }
        
        const currentUser = auth.getCurrentUser();
        
        let html = `
            <table class="users-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Username</th>
                        <th>Role</th>
                        <th>Created</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        this.users.forEach(user => {
            const isCurrentUser = currentUser && user.id === currentUser.id;
            
            html += `
                <tr>
                    <td>${user.id}</td>
                    <td>${user.username}</td>
                    <td>${user.isAdmin ? '<span class="admin-badge">Admin</span>' : 'User'}</td>
                    <td>${new Date(user.createdAt).toLocaleDateString()}</td>
                    <td>
                        ${!isCurrentUser ? 
                            `<button class="btn btn-danger btn-sm delete-user-btn" data-user-id="${user.id}">Delete</button>` : 
                            '<span class="text-muted">Current User</span>'}
                    </td>
                </tr>
            `;
        });
        
        html += `
                </tbody>
            </table>
        `;
        
        container.innerHTML = html;
        
        // Add event listeners to delete buttons
        const deleteButtons = container.querySelectorAll('.delete-user-btn');
        deleteButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const userId = e.target.dataset.userId;
                const user = this.users.find(u => u.id === parseInt(userId));
                
                if (user && confirm(`Delete user "${user.username}"? This action cannot be undone.`)) {
                    this.deleteUser(userId);
                }
            });
        });
    }
    
    async addUser() {
        const usernameInput = document.getElementById('newUsername');
        const passwordInput = document.getElementById('newPassword');
        const isAdminCheckbox = document.getElementById('newUserIsAdmin');
        const errorDiv = document.getElementById('addUserError');
        const successDiv = document.getElementById('addUserSuccess');
        
        if (!usernameInput || !passwordInput) return;
        
        const username = usernameInput.value.trim();
        const password = passwordInput.value;
        const isAdmin = isAdminCheckbox ? isAdminCheckbox.checked : false;
        
        // Clear messages
        if (errorDiv) {
            errorDiv.classList.add('hidden');
            errorDiv.textContent = '';
        }
        if (successDiv) {
            successDiv.classList.add('hidden');
            successDiv.textContent = '';
        }
        
        // Validation
        if (!username || !password) {
            this.showError(errorDiv, 'Username and password are required');
            return;
        }
        
        if (username.length < 3) {
            this.showError(errorDiv, 'Username must be at least 3 characters');
            return;
        }
        
        if (password.length < 6) {
            this.showError(errorDiv, 'Password must be at least 6 characters');
            return;
        }
        
        try {
            await api.createUser(username, password, isAdmin);
            
            // Clear form
            usernameInput.value = '';
            passwordInput.value = '';
            if (isAdminCheckbox) isAdminCheckbox.checked = false;
            
            // Show success message
            this.showSuccess(successDiv, `User "${username}" created successfully`);
            
            // Reload users list
            await this.loadUsers();
            
        } catch (error) {
            this.showError(errorDiv, error.message || 'Failed to create user');
        }
    }
    
    async deleteUser(userId) {
        try {
            await api.deleteUser(userId);
            
            // Reload users list
            await this.loadUsers();
            
            // Show success message (could use toast notification)
            console.log('User deleted successfully');
            
        } catch (error) {
            console.error('Failed to delete user:', error);
            alert(`Failed to delete user: ${error.message}`);
        }
    }
    
    async changePassword() {
        const currentPasswordInput = document.getElementById('currentPassword');
        const newPasswordInput = document.getElementById('newPasswordAdmin');
        const confirmPasswordInput = document.getElementById('confirmPassword');
        const errorDiv = document.getElementById('changePasswordError');
        const successDiv = document.getElementById('changePasswordSuccess');
        
        if (!currentPasswordInput || !newPasswordInput || !confirmPasswordInput) return;
        
        const currentPassword = currentPasswordInput.value;
        const newPassword = newPasswordInput.value;
        const confirmPassword = confirmPasswordInput.value;
        
        // Clear messages
        if (errorDiv) {
            errorDiv.classList.add('hidden');
            errorDiv.textContent = '';
        }
        if (successDiv) {
            successDiv.classList.add('hidden');
            successDiv.textContent = '';
        }
        
        // Validation
        if (!currentPassword || !newPassword || !confirmPassword) {
            this.showError(errorDiv, 'All password fields are required');
            return;
        }
        
        if (newPassword.length < 6) {
            this.showError(errorDiv, 'New password must be at least 6 characters');
            return;
        }
        
        if (newPassword !== confirmPassword) {
            this.showError(errorDiv, 'New passwords do not match');
            return;
        }
        
        try {
            await api.changePassword(currentPassword, newPassword);
            
            // Clear form
            currentPasswordInput.value = '';
            newPasswordInput.value = '';
            confirmPasswordInput.value = '';
            
            // Show success message
            this.showSuccess(successDiv, 'Password changed successfully');
            
        } catch (error) {
            this.showError(errorDiv, error.message || 'Failed to change password');
        }
    }
    
    async loadSystemInfo() {
        const container = document.getElementById('systemInfo');
        if (!container) return;
        
        try {
            // Get health check data
            const healthData = await api.healthCheck();
            
            // Get current user
            const user = auth.getCurrentUser();
            
            // Get some basic stats
            const inventoryData = await api.getInventory().catch(() => ({ totalItems: 0, uniqueItems: 0 }));
            const blueprintsData = await api.getBlueprints().catch(() => ({ total: 0 }));
            
            const html = `
                <div class="system-info-grid">
                    <div class="info-item">
                        <strong>Server Status:</strong> <span class="text-success">● Online</span>
                    </div>
                    <div class="info-item">
                        <strong>Uptime:</strong> ${Math.floor(healthData.uptime)} seconds
                    </div>
                    <div class="info-item">
                        <strong>Current User:</strong> ${user.username} (${user.isAdmin ? 'Admin' : 'User'})
                    </div>
                    <div class="info-item">
                        <strong>Your Inventory:</strong> ${inventoryData.totalItems} items (${inventoryData.uniqueItems} unique)
                    </div>
                    <div class="info-item">
                        <strong>Total Blueprints:</strong> ${blueprintsData.total}
                    </div>
                    <div class="info-item">
                        <strong>Total Users:</strong> ${this.users.length}
                    </div>
                    <div class="info-item">
                        <strong>Server Time:</strong> ${new Date(healthData.timestamp).toLocaleString()}
                    </div>
                </div>
            `;
            
            container.innerHTML = html;
            
        } catch (error) {
            console.error('Failed to load system info:', error);
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">⚠️</div>
                    <p>Failed to load system information</p>
                </div>
            `;
        }
    }
    
    showError(element, message) {
        if (!element) return;
        
        element.textContent = message;
        element.classList.remove('hidden');
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            element.classList.add('hidden');
        }, 5000);
    }
    
    showSuccess(element, message) {
        if (!element) return;
        
        element.textContent = message;
        element.classList.remove('hidden');
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            element.classList.add('hidden');
        }, 5000);
    }
}

// Initialize admin panel when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.admin = new AdminPanel();
});
