// Main application logic

class BlueprintApp {
    constructor() {
        this.currentSearch = '';
        this.blueprints = [];
        this.inventory = [];
        
        this.init();
    }
    
    async init() {
        // Check authentication
        const user = auth.getCurrentUser();
        if (!user) {
            window.location.href = '/';
            return;
        }
        
        // Update UI with user info
        this.updateUserInfo(user);
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Load initial data
        await this.loadBlueprints();
        await this.loadInventory();
    }
    
    updateUserInfo(user) {
        const usernameDisplay = document.getElementById('usernameDisplay');
        const userRole = document.getElementById('userRole');
        const adminBtn = document.getElementById('adminBtn');
        
        if (usernameDisplay) {
            usernameDisplay.textContent = user.username;
        }
        
        if (userRole) {
            userRole.textContent = user.isAdmin ? 'Admin' : 'User';
            userRole.style.backgroundColor = user.isAdmin ? 'var(--warning-color)' : 'var(--primary-color)';
        }
        
        if (adminBtn && user.isAdmin) {
            adminBtn.style.display = 'inline-block';
            adminBtn.addEventListener('click', () => {
                window.location.href = '/admin';
            });
        }
    }
    
    setupEventListeners() {
        // Logout button
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                auth.logout();
            });
        }
        
        // Filter controls
        const searchFilter = document.getElementById('searchFilter');
        const applyFiltersBtn = document.getElementById('applyFilters');
        const clearFiltersBtn = document.getElementById('clearFilters');
        
        if (searchFilter) {
            searchFilter.addEventListener('keyup', (e) => {
                if (e.key === 'Enter') {
                    this.applyFilters();
                }
            });
        }
        
        if (applyFiltersBtn) {
            applyFiltersBtn.addEventListener('click', () => this.applyFilters());
        }
        
        if (clearFiltersBtn) {
            clearFiltersBtn.addEventListener('click', () => this.clearFilters());
        }
        
        // Show All button
        const showAllBtn = document.getElementById('showAllInventory');
        if (showAllBtn) {
            showAllBtn.addEventListener('click', () => this.showAllInventory());
        }
        
        // Export button
        const exportBtn = document.getElementById('exportInventory');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportInventory());
        }
        
        // Modal close button
        const modalClose = document.querySelector('.modal-close');
        if (modalClose) {
            modalClose.addEventListener('click', () => this.hideModal());
        }
        
        // Close modal when clicking outside
        const modal = document.getElementById('showAllModal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.hideModal();
                }
            });
        }
        
        // Close modal with Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideModal();
            }
        });
    }
    
    
    async loadBlueprints() {
        const grid = document.getElementById('blueprintsGrid');
        if (!grid) return;
        
        grid.innerHTML = `
            <div class="loading">
                <div class="loading-spinner"></div>
                <p>Loading blueprints...</p>
            </div>
        `;
        
        try {
            const filters = { search: this.currentSearch };
            const data = await api.getBlueprints(filters);
            this.blueprints = data.blueprints;
            
            this.renderBlueprints();
            
            // Update count
            const countElement = document.getElementById('blueprintCount');
            if (countElement) {
                countElement.textContent = `${data.total} blueprints found`;
            }
            
        } catch (error) {
            console.error('Failed to load blueprints:', error);
            grid.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">⚠️</div>
                    <p>Failed to load blueprints</p>
                    <button class="btn btn-primary mt-2" onclick="app.loadBlueprints()">Retry</button>
                </div>
            `;
        }
    }
    
    renderBlueprints() {
        const grid = document.getElementById('blueprintsGrid');
        if (!grid) return;
        
        if (this.blueprints.length === 0) {
            grid.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📭</div>
                    <p>No blueprints found</p>
                    <p class="text-muted">Try changing your filters</p>
                </div>
            `;
            return;
        }
        
        grid.innerHTML = '';
        
        this.blueprints.forEach(blueprint => {
            const card = this.createBlueprintCard(blueprint);
            grid.appendChild(card);
        });
    }
    
    createBlueprintCard(blueprint) {
        const card = document.createElement('div');
        card.className = 'blueprint-card';
        card.dataset.name = blueprint.name;
        
        // Check if blueprint is in inventory
        const inventoryItem = this.inventory.find(item => item.blueprint_name === blueprint.name);
        const quantity = inventoryItem ? inventoryItem.quantity : 0;
        
        card.innerHTML = `
            <img src="${blueprint.imageUrl}" alt="${blueprint.name}" class="blueprint-image" 
                 onerror="this.src='/static/favicon-256x256.png'">
            <div class="blueprint-name">${blueprint.name}</div>
            <div class="blueprint-details">
                <div>${blueprint.map || 'N/A'}</div>
                <div>${blueprint.condition || 'Any'}</div>
            </div>
            <div class="blueprint-actions">
                ${quantity > 0 ? 
                    `<div class="inventory-quantity">${quantity} in inventory</div>` : 
                    ''}
                <button class="btn btn-primary btn-sm btn-block mt-1 add-to-inventory-btn">
                    ${quantity > 0 ? 'Add More' : 'Add to Inventory'}
                </button>
            </div>
        `;
        
        // Add click event to add button
        const addBtn = card.querySelector('.add-to-inventory-btn');
        addBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.addBlueprintToInventory(blueprint.name);
        });
        
        // Add click event to entire card for details (future enhancement)
        card.addEventListener('click', (e) => {
            if (!e.target.closest('.add-to-inventory-btn')) {
                // Could show blueprint details modal here
                console.log('Blueprint details:', blueprint);
            }
        });
        
        return card;
    }
    
    async loadInventory() {
        const list = document.getElementById('inventoryList');
        if (!list) return;
        
        list.innerHTML = `
            <div class="loading">
                <div class="loading-spinner"></div>
                <p>Loading inventory...</p>
            </div>
        `;
        
        try {
            const data = await api.getInventory();
            this.inventory = data.inventory;
            
            this.renderInventory();
            
            // Update stats
            const statsElement = document.getElementById('inventoryStats');
            if (statsElement) {
                statsElement.textContent = `${data.totalItems} total items (${data.uniqueItems} unique)`;
            }
            
        } catch (error) {
            console.error('Failed to load inventory:', error);
            list.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">⚠️</div>
                    <p>Failed to load inventory</p>
                    <button class="btn btn-primary mt-2" onclick="app.loadInventory()">Retry</button>
                </div>
            `;
        }
    }
    
    renderInventory() {
        const list = document.getElementById('inventoryList');
        if (!list) return;
        
        if (this.inventory.length === 0) {
            list.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📦</div>
                    <p>Your inventory is empty</p>
                    <p class="text-muted">Add blueprints from the catalog</p>
                </div>
            `;
            return;
        }
        
        list.innerHTML = '';
        
        this.inventory.forEach(item => {
            const blueprint = this.blueprints.find(bp => bp.name === item.blueprint_name);
            const inventoryItem = this.createInventoryItem(item, blueprint);
            list.appendChild(inventoryItem);
        });
    }
    
    createInventoryItem(item, blueprint) {
        const div = document.createElement('div');
        div.className = 'inventory-item';
        div.dataset.name = item.blueprint_name;
        
        const imageUrl = blueprint ? blueprint.imageUrl : '/static/favicon-256x256.png';
        
        div.innerHTML = `
            <div class="inventory-info">
                <img src="${imageUrl}" alt="${item.blueprint_name}" class="inventory-image"
                     onerror="this.src='/static/favicon-256x256.png'">
                <div>
                    <div class="inventory-name">${item.blueprint_name}</div>
                    <div class="text-muted">Last updated: ${new Date(item.updated_at).toLocaleDateString()}</div>
                </div>
                <div class="inventory-quantity">${item.quantity}</div>
            </div>
            <div class="inventory-actions">
                <div class="quantity-controls">
                    <button class="quantity-btn decrement" title="Remove one">-</button>
                    <button class="quantity-btn increment" title="Add one">+</button>
                </div>
                <button class="btn btn-danger btn-sm remove-btn">Remove</button>
            </div>
        `;
        
        // Add event listeners
        const decrementBtn = div.querySelector('.decrement');
        const incrementBtn = div.querySelector('.increment');
        const removeBtn = div.querySelector('.remove-btn');
        
        decrementBtn.addEventListener('click', () => {
            this.updateInventoryQuantity(item.blueprint_name, item.quantity - 1);
        });
        
        incrementBtn.addEventListener('click', () => {
            this.updateInventoryQuantity(item.blueprint_name, item.quantity + 1);
        });
        
        removeBtn.addEventListener('click', () => {
            if (confirm(`Remove all ${item.quantity} ${item.blueprint_name} from inventory?`)) {
                this.updateInventoryQuantity(item.blueprint_name, 0);
            }
        });
        
        return div;
    }
    
    async addBlueprintToInventory(blueprintName, quantity = 1) {
        try {
            await api.addToInventory(blueprintName, quantity);
            
            // Refresh both views
            await this.loadInventory();
            await this.loadBlueprints();
            
            // Show success message (could be enhanced with toast notification)
            console.log(`Added ${blueprintName} to inventory`);
            
        } catch (error) {
            console.error('Failed to add to inventory:', error);
            alert(`Failed to add ${blueprintName}: ${error.message}`);
        }
    }
    
    async updateInventoryQuantity(blueprintName, newQuantity) {
        try {
            if (newQuantity <= 0) {
                await api.removeFromInventory(blueprintName, 1);
            } else {
                await api.setInventoryQuantity(blueprintName, newQuantity);
            }
            
            // Refresh both views
            await this.loadInventory();
            await this.loadBlueprints();
            
        } catch (error) {
            console.error('Failed to update inventory:', error);
            alert(`Failed to update ${blueprintName}: ${error.message}`);
        }
    }
    
    applyFilters() {
        const searchFilter = document.getElementById('searchFilter');
        this.currentSearch = searchFilter ? searchFilter.value.trim() : '';
        this.loadBlueprints();
    }
    
    clearFilters() {
        const searchFilter = document.getElementById('searchFilter');
        if (searchFilter) searchFilter.value = '';
        this.currentSearch = '';
        this.loadBlueprints();
    }
    
    showAllInventory() {
        const modal = document.getElementById('showAllModal');
        const grid = document.getElementById('showAllGrid');
        
        if (!modal || !grid) return;
        
        // Clear previous content
        grid.innerHTML = '';
        
        if (this.inventory.length === 0) {
            grid.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1;">
                    <div class="empty-state-icon">📦</div>
                    <p>Your inventory is empty</p>
                    <p class="text-muted">Add blueprints from the catalog</p>
                </div>
            `;
        } else {
            // Create items for each inventory entry
            this.inventory.forEach(item => {
                const blueprint = this.blueprints.find(bp => bp.name === item.blueprint_name);
                const imageUrl = blueprint ? blueprint.imageUrl : '/static/favicon-256x256.png';
                
                const itemDiv = document.createElement('div');
                itemDiv.className = 'show-all-item';
                itemDiv.innerHTML = `
                    <img src="${imageUrl}" alt="${item.blueprint_name}" class="show-all-image"
                         onerror="this.src='/static/favicon-256x256.png'">
                    <div class="show-all-name">${item.blueprint_name}</div>
                    <div class="show-all-quantity">${item.quantity} owned</div>
                `;
                grid.appendChild(itemDiv);
            });
        }
        
        // Show the modal
        modal.classList.add('show');
        document.body.style.overflow = 'hidden'; // Prevent scrolling behind modal
    }
    
    hideModal() {
        const modal = document.getElementById('showAllModal');
        if (modal) {
            modal.classList.remove('show');
            document.body.style.overflow = ''; // Restore scrolling
        }
    }
    
    async exportInventory() {
        try {
            // Create CSV content
            let csvContent = "Blueprint Name,Quantity,Last Updated\n";
            
            this.inventory.forEach(item => {
                const blueprint = this.blueprints.find(bp => bp.name === item.blueprint_name);
                const lastUpdated = new Date(item.updated_at).toLocaleDateString();
                const escapedName = `"${item.blueprint_name.replace(/"/g, '""')}"`;
                csvContent += `${escapedName},${item.quantity},${lastUpdated}\n`;
            });
            
            // Create blob and download
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.setAttribute('href', url);
            link.setAttribute('download', `blueprint-inventory-${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            console.log('Inventory exported successfully');
            
        } catch (error) {
            console.error('Failed to export inventory:', error);
            alert('Failed to export inventory: ' + error.message);
        }
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new BlueprintApp();
});
