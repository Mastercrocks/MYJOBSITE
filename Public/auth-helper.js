// Common authentication helper for frontend pages
// This script handles checking authentication status and updating navigation

class AuthHelper {
    constructor() {
        this.user = null;
        this.isAuthenticated = false;
    }

    // Check authentication status with server
    async checkAuthStatus() {
        try {
            const response = await fetch('/api/auth/check', {
                method: 'GET',
                credentials: 'include' // Include cookies
            });
            
            const data = await response.json();
            
            if (data.authenticated) {
                this.isAuthenticated = true;
                
                // Try to get full user details
                try {
                    const userResponse = await fetch('/api/auth/status', {
                        method: 'GET',
                        credentials: 'include'
                    });
                    
                    if (userResponse.ok) {
                        const userData = await userResponse.json();
                        this.user = userData.user;
                    } else {
                        // Fallback to basic user info
                        this.user = { id: data.userId };
                    }
                } catch (error) {
                    console.log('Could not get full user details, using basic info');
                    this.user = { id: data.userId };
                }
            } else {
                this.isAuthenticated = false;
                this.user = null;
            }
            
            return this.isAuthenticated;
        } catch (error) {
            console.error('Error checking auth status:', error);
            this.isAuthenticated = false;
            this.user = null;
            return false;
        }
    }

    // Update navigation based on authentication status
    updateNavigation() {
        const authMenuItem = document.getElementById('authMenuItem');
        
        if (!authMenuItem) {
            console.warn('authMenuItem not found in DOM');
            return;
        }

        if (this.isAuthenticated && this.user) {
            const username = this.user.username || this.user.email || 'User';
            authMenuItem.innerHTML = `
                <div class="user-menu">
                    <span>Welcome, ${username}</span>
                    <a href="/dashboard" class="ml-2">Dashboard</a>
                    <button onclick="authHelper.logout()" class="ml-2 text-red-600">Logout</button>
                </div>
            `;
        } else {
            authMenuItem.innerHTML = `<a href="/login.html">Sign In</a>`;
        }
    }

    // Logout user
    async logout() {
        try {
            // Call logout endpoint if it exists
            await fetch('/api/auth/logout', {
                method: 'POST',
                credentials: 'include'
            });
        } catch (error) {
            console.log('Logout endpoint not available, clearing client-side only');
        }
        
        // Clear client-side data
        this.isAuthenticated = false;
        this.user = null;
        
        // Clear localStorage (for backward compatibility)
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('user');
        localStorage.removeItem('authToken');
        
        // Redirect to login
        window.location.href = '/login.html';
    }

    // Get current user ID (useful for resume uploads, etc.)
    getUserId() {
        return this.user ? this.user.id : null;
    }

    // Check if user can perform authenticated actions
    requireAuth(redirectToLogin = true) {
        if (!this.isAuthenticated) {
            if (redirectToLogin) {
                alert('Please login to perform this action');
                window.location.href = '/login.html';
            }
            return false;
        }
        return true;
    }

    // Initialize authentication for the page
    async init() {
        await this.checkAuthStatus();
        this.updateNavigation();
        return this.isAuthenticated;
    }
}

// Create global instance
const authHelper = new AuthHelper();

// Auto-initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    authHelper.init();
});
