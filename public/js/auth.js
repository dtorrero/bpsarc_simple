// Authentication logic

document.addEventListener('DOMContentLoaded', () => {
    // Only run login page logic if we're on the login page
    const isLoginPage = window.location.pathname === '/' || window.location.pathname === '/index.html';
    
    if (!isLoginPage) {
        return;
    }
    
    // Check if user is already logged in
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    
    if (token && user) {
        // Verify token is still valid
        api.getCurrentUser()
            .then(data => {
                // Redirect to main app
                window.location.href = '/app';
            })
            .catch(error => {
                // Token invalid, clear storage and stay on login page
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                // Don't redirect or reload - just stay on the login page
                console.log('Token validation failed, please login again');
            });
    }
    
    // Setup login form
    const loginForm = document.getElementById('loginForm');
    const loginError = document.getElementById('loginError');
    
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const username = document.getElementById('username').value.trim();
            const password = document.getElementById('password').value;
            
            // Clear previous errors
            loginError.style.display = 'none';
            loginError.textContent = '';
            
            // Show loading state
            const submitBtn = loginForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.textContent = 'Logging in...';
            submitBtn.disabled = true;
            
            try {
                const data = await api.login(username, password);
                
                // Store user data
                localStorage.setItem('user', JSON.stringify(data.user));
                
                // Redirect to main app
                window.location.href = '/app';
                
            } catch (error) {
                // Show error
                loginError.textContent = error.message || 'Login failed. Please check your credentials.';
                loginError.style.display = 'block';
                
                // Restore button
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
            }
        });
    }
    
    // Auto-focus username field
    const usernameInput = document.getElementById('username');
    if (usernameInput) {
        usernameInput.focus();
    }
});

// Utility function to check if user is admin
function isAdmin() {
    const user = localStorage.getItem('user');
    if (!user) return false;
    
    try {
        const userData = JSON.parse(user);
        return userData.isAdmin === true;
    } catch {
        return false;
    }
}

// Utility function to get current user
function getCurrentUser() {
    const user = localStorage.getItem('user');
    if (!user) return null;
    
    try {
        return JSON.parse(user);
    } catch {
        return null;
    }
}

// Logout function
function logout() {
    api.logout();
}

// Export for use in other files
window.auth = {
    isAdmin,
    getCurrentUser,
    logout
};
