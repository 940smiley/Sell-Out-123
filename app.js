/**
 * Main Application Logic for eBay Master Web Edition
 * Handles UI interactions, authentication, and coordination between services
 */

class EbayMasterApp {
    constructor() {
        this.ebayAPI = new EbayAPI();
        this.aiServices = new AIServices();
        this.currentUser = null;
        this.currentListings = [];
        this.currentSection = 'listings';
        
        this.init();
    }

    /**
     * Initialize the application
     */
    async init() {
        this.setupEventListeners();
        this.loadStoredCredentials();
        this.handleOAuthCallback();
        
        // Check if user is already authenticated
        if (this.ebayAPI.isAuthenticated()) {
            await this.showMainApplication();
        }
        
        this.initializeTooltips();
    }

    /**
     * Setup all event listeners
     */
    setupEventListeners() {
        // Authentication form
        document.getElementById('authForm').addEventListener('submit', this.handleAuthentication.bind(this));
        
        // Navigation
        document.querySelectorAll('[data-section]').forEach(link => {
            link.addEventListener('click', this.handleNavigation.bind(this));
        });
        
        // Logout
        document.getElementById('logoutBtn').addEventListener('click', this.handleLogout.bind(this));
        
        // Listings
        document.getElementById('refreshListings').addEventListener('click', this.refreshListings.bind(this));
        
        // AI Image Upload
        document.getElementById('productImage').addEventListener('change', this.handleImageUpload.bind(this));
        document.getElementById('identifyProduct').addEventListener('click', this.identifyProduct.bind(this));
        
        // Draft Generator
        document.getElementById('generateDescription').addEventListener('click', this.generateDescription.bind(this));
        document.getElementById('draftForm').addEventListener('submit', this.saveDraft.bind(this));
        document.getElementById('previewListing').addEventListener('click', this.previewListing.bind(this));
        
        // Settings
        document.getElementById('saveSettings').addEventListener('click', this.saveSettings.bind(this));
        document.getElementById('clearData').addEventListener('click', this.clearAllData.bind(this));
        
        // Drag and drop for image upload
        this.setupDragAndDrop();
    }

    /**
     * Handle authentication form submission
     */
    async handleAuthentication(event) {
        event.preventDefault();
        
        const formData = new FormData(event.target);
        const config = {
            appId: formData.get('appId'),
            certId: formData.get('certId'),
            devId: formData.get('devId'),
            ruName: formData.get('ruName'),
            sandbox: formData.get('sandboxMode') === 'on'
        };
        
        try {
            // Validate credentials
            if (!config.appId || !config.certId || !config.devId || !config.ruName) {
                throw new Error('All credential fields are required');
            }
            
            // Initialize eBay API
            this.ebayAPI.initialize(config);
            
            // Save credentials
            this.saveCredentials(config);
            
            // Get application token first
            await this.ebayAPI.getApplicationToken();
            
            // Redirect to eBay for user authorization
            const authUrl = this.ebayAPI.getAuthUrl();
            window.location.href = authUrl;
            
        } catch (error) {
            this.showError('Authentication failed: ' + error.message);
        }
    }

    /**
     * Handle OAuth callback from eBay
     */
    handleOAuthCallback() {
        const urlParams = new URLSearchParams(window.location.search);
        const authCode = urlParams.get('code');
        const state = urlParams.get('state');
        const error = urlParams.get('error');
        
        if (error) {
            this.showError('eBay authorization failed: ' + error);
            return;
        }
        
        if (authCode && state) {
            this.completeAuthentication(authCode, state);
        }
    }

    /**
     * Complete authentication process
     */
    async completeAuthentication(authCode, state) {
        try {
            // Exchange code for token
            const tokenData = await this.ebayAPI.exchangeCodeForToken(authCode, state);
            
            // Show success and load main app
            this.showSuccess('Successfully connected to eBay!');
            await this.showMainApplication();
            
            // Clean up URL
            window.history.replaceState({}, document.title, window.location.pathname);
            
        } catch (error) {
            this.showError('Token exchange failed: ' + error.message);
        }
    }

    /**
     * Show main application interface
     */
    async showMainApplication() {
        document.getElementById('authSection').style.display = 'none';
        document.getElementById('mainApp').style.display = 'block';
        
        // Update user info
        const userInfo = this.ebayAPI.getUserInfo();
        document.getElementById('userInfo').textContent = 'Connected to eBay';
        document.getElementById('logoutBtn').style.display = 'inline-block';
        
        // Load initial data
        await this.refreshListings();
        this.showSection('listings');
    }

    /**
     * Handle navigation between sections
     */
    handleNavigation(event) {
        event.preventDefault();
        const section = event.currentTarget.dataset.section;
        this.showSection(section);
        
        // Update active state
        document.querySelectorAll('[data-section]').forEach(link => {
            link.classList.remove('active');
        });
        event.currentTarget.classList.add('active');
    }

    /**
     * Show specific section
     */
    showSection(sectionName) {
        // Hide all sections
        document.querySelectorAll('.content-section').forEach(section => {
            section.style.display = 'none';
        });
        
        // Show selected section
        document.getElementById(`${sectionName}-section`).style.display = 'block';
        this.currentSection = sectionName;
        
        // Section-specific initialization
        switch (sectionName) {
            case 'settings':
                this.loadSettings();
                break;
            case 'ai-identify':
                this.resetImageUpload();
                break;
        }
    }

    /**
     * Handle logout
     */
    handleLogout() {
        if (confirm('Are you sure you want to logout?')) {
            this.ebayAPI.clearTokens();
            document.getElementById('authSection').style.display = 'block';
            document.getElementById('mainApp').style.display = 'none';
            document.getElementById('userInfo').textContent = 'Not Connected';
            document.getElementById('logoutBtn').style.display = 'none';
            this.showSuccess('Successfully logged out');
        }
    }

    /**
     * Refresh listings from eBay
     */
    async refreshListings() {
        const loader = document.getElementById('listingsLoader');
        const tableContainer = document.getElementById('listingsTable');
        
        try {
            loader.style.display = 'block';
            tableContainer.innerHTML = '';
            
            // Get listings from eBay API
            const listings = await this.ebayAPI.getActiveListings();
            this.currentListings = listings;
            
            if (listings.length === 0) {
                tableContainer.innerHTML = `
                    <div class="alert alert-info">
                        <h5>No Active Listings Found</h5>
                        <p>You don't have any active listings yet. Use the Draft Generator to create your first listing!</p>
                    </div>
                `;
            } else {
                this.renderListingsTable(listings);
            }
            
        } catch (error) {
            this.showError('Failed to load listings: ' + error.message);
            tableContainer.innerHTML = `
                <div class="alert alert-danger">
                    <h5>Failed to Load Listings</h5>
                    <p>${error.message}</p>
                    <button class="btn btn-outline-danger" onclick="app.refreshListings()">Try Again</button>
                </div>
            `;
        } finally {
            loader.style.display = 'none';
        }
    }

    /**
     * Render listings table
     */
    renderListingsTable(listings) {
        const container = document.getElementById('listingsTable');
        
        const html = `
            <div class="table-responsive">
                <table class="table table-hover">
                    <thead>
                        <tr>
                            <th>Image</th>
                            <th>Title</th>
                            <th>SKU</th>
                            <th>Price</th>
                            <th>Quantity</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${listings.map(listing => this.renderListingRow(listing)).join('')}
                    </tbody>
                </table>
            </div>
        `;
        
        container.innerHTML = html;
    }

    /**
     * Render individual listing row
     */
    renderListingRow(listing) {
        const imageUrl = listing.images && listing.images[0] ? listing.images[0] : 'assets/no-image.png';
        const statusClass = listing.status.toLowerCase().replace(' ', '-');
        
        return `
            <tr>
                <td>
                    <img src="${imageUrl}" alt="${listing.title}" class="listing-image" 
                         onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHZpZXdCb3g9IjAgMCA4MCA4MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjgwIiBoZWlnaHQ9IjgwIiBmaWxsPSIjRjhGOUZBIi8+CjxwYXRoIGQ9Ik0yNSAzNUgyNVYzNUgyNVoiIGZpbGw9IiM2Qzc1N0QiLz4KPHRleHQgeD0iNDAiIHk9IjQ1IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjNkM3NTdEIiBmb250LXNpemU9IjEyIj5ObyBJbWFnZTwvdGV4dD4KPC9zdmc+'">
                </td>
                <td>
                    <a href="#" class="listing-title" onclick="app.showListingDetails('${listing.sku}')">
                        ${this.truncateText(listing.title, 50)}
                    </a>
                </td>
                <td><code>${listing.sku}</code></td>
                <td class="listing-price">${listing.currency} ${listing.price.toFixed(2)}</td>
                <td>${listing.quantity}</td>
                <td>
                    <span class="listing-status status-${statusClass}">
                        ${listing.status}
                    </span>
                </td>
                <td>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-primary" onclick="app.editListing('${listing.sku}')" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-outline-info" onclick="app.viewListing('${listing.itemId || listing.sku}')" title="View on eBay">
                            <i class="fas fa-external-link-alt"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }

    /**
     * Handle image upload for AI identification
     */
    handleImageUpload(event) {
        const file = event.target.files[0];
        if (file) {
            this.processUploadedImage(file);
        }
    }

    /**
     * Process uploaded image
     */
    processUploadedImage(file) {
        // Validate file type
        if (!file.type.startsWith('image/')) {
            this.showError('Please select a valid image file');
            return;
        }
        
        // Validate file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
            this.showError('Image file is too large. Please select a file under 10MB');
            return;
        }
        
        // Show preview
        const reader = new FileReader();
        reader.onload = (e) => {
            const preview = document.getElementById('imagePreview');
            preview.src = e.target.result;
            preview.style.display = 'block';
            
            // Enable identify button
            document.getElementById('identifyProduct').disabled = false;
        };
        reader.readAsDataURL(file);
        
        // Store file for identification
        this.currentImageFile = file;
    }

    /**
     * Identify product using AI
     */
    async identifyProduct() {
        if (!this.currentImageFile) {
            this.showError('Please select an image first');
            return;
        }
        
        const button = document.getElementById('identifyProduct');
        const resultsContainer = document.getElementById('identificationResults');
        const resultsDiv = document.getElementById('aiResults');
        
        try {
            // Show loading state
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Identifying...';
            button.disabled = true;
            
            // Call AI service
            const result = await this.aiServices.identifyProductFromImage(this.currentImageFile);
            
            if (result.success) {
                this.displayIdentificationResults(result);
                resultsContainer.style.display = 'block';
                
                // Auto-fill draft form if on that section
                if (result.productInfo) {
                    this.fillDraftFormFromAI(result.productInfo);
                }
            } else {
                throw new Error(result.error || 'Identification failed');
            }
            
        } catch (error) {
            this.showError('Product identification failed: ' + error.message);
            resultsContainer.style.display = 'none';
        } finally {
            // Reset button
            button.innerHTML = '<i class="fas fa-search"></i> Identify Product';
            button.disabled = false;
        }
    }

    /**
     * Display AI identification results
     */
    displayIdentificationResults(result) {
        const resultsDiv = document.getElementById('aiResults');
        
        let html = `
            <div class="mb-3">
                <strong>Overall Confidence:</strong> 
                <div class="confidence-bar">
                    <div class="confidence-fill" style="width: ${result.confidence * 100}%"></div>
                </div>
                <small class="text-muted">${(result.confidence * 100).toFixed(1)}%</small>
            </div>
        `;
        
        if (result.identifications && result.identifications.length > 0) {
            html += '<div class="mb-3"><strong>Identified Items:</strong></div>';
            
            result.identifications.slice(0, 5).forEach(item => {
                html += `
                    <div class="ai-result-item">
                        <div class="d-flex justify-content-between">
                            <span>${this.capitalizeWords(item.label)}</span>
                            <small class="text-muted">${(item.confidence * 100).toFixed(1)}%</small>
                        </div>
                        <div class="confidence-bar">
                            <div class="confidence-fill" style="width: ${item.confidence * 100}%"></div>
                        </div>
                        ${item.category ? `<small class="text-info">Category: ${item.category}</small>` : ''}
                    </div>
                `;
            });
        }
        
        if (result.productInfo) {
            html += `
                <div class="mt-3">
                    <strong>Generated Product Info:</strong>
                    <div class="mt-2">
                        <small class="text-muted">Title:</small> ${result.productInfo.title}<br>
                        <small class="text-muted">Category:</small> ${result.productInfo.category}<br>
                        <small class="text-muted">Suggested Price:</small> $${result.productInfo.suggestedPrice}
                    </div>
                    <button class="btn btn-sm btn-success mt-2" onclick="app.useAIResults()">
                        <i class="fas fa-magic"></i> Use for New Listing
                    </button>
                </div>
            `;
        }
        
        resultsDiv.innerHTML = html;
    }

    /**
     * Use AI results to create new listing
     */
    useAIResults() {
        this.showSection('draft-generator');
        
        // Update navigation
        document.querySelectorAll('[data-section]').forEach(link => {
            link.classList.remove('active');
        });
        document.querySelector('[data-section="draft-generator"]').classList.add('active');
        
        this.showSuccess('AI results applied to draft form!');
    }

    /**
     * Fill draft form with AI results
     */
    fillDraftFormFromAI(productInfo) {
        document.getElementById('productTitle').value = productInfo.title || '';
        document.getElementById('productCategory').value = productInfo.category || '';
        document.getElementById('startingPrice').value = productInfo.suggestedPrice || '';
        document.getElementById('condition').value = productInfo.condition || 'Used';
        document.getElementById('productDescription').value = productInfo.description || '';
    }

    /**
     * Generate description using AI
     */
    async generateDescription() {
        const title = document.getElementById('productTitle').value;
        const category = document.getElementById('productCategory').value;
        
        if (!title) {
            this.showError('Please enter a product title first');
            return;
        }
        
        const button = document.getElementById('generateDescription');
        const descriptionField = document.getElementById('productDescription');
        
        try {
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
            button.disabled = true;
            
            // Create mock identification for description generation
            const mockIdentifications = [{
                label: title,
                category: category || 'general',
                confidence: 0.8
            }];
            
            const description = await this.aiServices.generateProductDescription(title, category || 'general', mockIdentifications);
            descriptionField.value = description;
            
            this.showSuccess('Description generated successfully!');
            
        } catch (error) {
            this.showError('Failed to generate description: ' + error.message);
        } finally {
            button.innerHTML = '<i class="fas fa-magic"></i> Generate AI Description';
            button.disabled = false;
        }
    }

    /**
     * Save draft listing
     */
    saveDraft(event) {
        event.preventDefault();
        
        const formData = new FormData(event.target);
        const draft = {
            title: formData.get('productTitle'),
            category: formData.get('productCategory'),
            price: parseFloat(formData.get('startingPrice')) || 0,
            condition: formData.get('condition'),
            description: formData.get('productDescription'),
            timestamp: new Date().toISOString(),
            id: this.generateId()
        };
        
        // Validate required fields
        if (!draft.title || !draft.description || draft.price <= 0) {
            this.showError('Please fill in all required fields');
            return;
        }
        
        // Save to local storage
        this.saveDraftToStorage(draft);
        this.showSuccess('Draft saved successfully!');
        
        // Reset form
        event.target.reset();
    }

    /**
     * Preview listing
     */
    previewListing() {
        const title = document.getElementById('productTitle').value;
        const category = document.getElementById('productCategory').value;
        const price = document.getElementById('startingPrice').value;
        const condition = document.getElementById('condition').value;
        const description = document.getElementById('productDescription').value;
        
        if (!title || !description) {
            this.showError('Please fill in title and description first');
            return;
        }
        
        // Create preview HTML
        const previewHtml = `
            <div class="listing-preview">
                <h4>${title}</h4>
                <div class="row">
                    <div class="col-md-8">
                        <div class="preview-description">
                            ${description.replace(/\n/g, '<br>')}
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="preview-details">
                            <p><strong>Price:</strong> $${price}</p>
                            <p><strong>Condition:</strong> ${condition}</p>
                            <p><strong>Category:</strong> ${category || 'Not specified'}</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Show in modal
        this.showModal('Listing Preview', previewHtml);
    }

    /**
     * Setup drag and drop for image upload
     */
    setupDragAndDrop() {
        const uploadArea = document.getElementById('ai-identify-section');
        
        if (uploadArea) {
            uploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                uploadArea.classList.add('dragover');
            });
            
            uploadArea.addEventListener('dragleave', () => {
                uploadArea.classList.remove('dragover');
            });
            
            uploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                uploadArea.classList.remove('dragover');
                
                const files = e.dataTransfer.files;
                if (files.length > 0 && files[0].type.startsWith('image/')) {
                    this.processUploadedImage(files[0]);
                    // Update file input
                    const fileInput = document.getElementById('productImage');
                    fileInput.files = files;
                }
            });
        }
    }

    /**
     * Load and display settings
     */
    loadSettings() {
        const settings = this.getStoredSettings();
        
        document.getElementById('huggingfaceToken').value = settings.huggingfaceToken || '';
        document.getElementById('defaultShipping').value = settings.defaultShipping || '9.99';
        document.getElementById('defaultHandling').value = settings.defaultHandling || '1';
    }

    /**
     * Save settings
     */
    saveSettings() {
        const settings = {
            huggingfaceToken: document.getElementById('huggingfaceToken').value,
            defaultShipping: document.getElementById('defaultShipping').value,
            defaultHandling: document.getElementById('defaultHandling').value
        };
        
        // Save to local storage
        localStorage.setItem('ebay_master_settings', JSON.stringify(settings));
        
        // Update AI services config
        this.aiServices.saveConfig({ huggingfaceToken: settings.huggingfaceToken });
        
        this.showSuccess('Settings saved successfully!');
    }

    /**
     * Clear all application data
     */
    clearAllData() {
        if (confirm('Are you sure you want to clear all data? This action cannot be undone.')) {
            localStorage.clear();
            this.ebayAPI.clearTokens();
            this.aiServices.clearConfig();
            
            this.showSuccess('All data cleared successfully!');
            
            // Reload page to reset application state
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        }
    }

    /**
     * Utility functions
     */
    showError(message) {
        this.showAlert(message, 'danger');
    }

    showSuccess(message) {
        this.showAlert(message, 'success');
    }

    showAlert(message, type) {
        // Remove existing alerts
        document.querySelectorAll('.app-alert').forEach(alert => alert.remove());
        
        const alert = document.createElement('div');
        alert.className = `alert alert-${type} app-alert alert-dismissible fade show`;
        alert.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        // Add to top of main content
        const mainApp = document.getElementById('mainApp');
        const authSection = document.getElementById('authSection');
        const targetParent = mainApp.style.display !== 'none' ? mainApp : authSection;
        targetParent.insertBefore(alert, targetParent.firstChild);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (alert.parentNode) {
                alert.remove();
            }
        }, 5000);
    }

    showModal(title, content) {
        const modal = document.getElementById('listingModal');
        document.querySelector('#listingModal .modal-title').textContent = title;
        document.getElementById('listingModalBody').innerHTML = content;
        
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();
    }

    truncateText(text, length) {
        return text.length > length ? text.substring(0, length) + '...' : text;
    }

    capitalizeWords(str) {
        return str.replace(/\w\S*/g, (txt) => 
            txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
        );
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    }

    resetImageUpload() {
        document.getElementById('productImage').value = '';
        document.getElementById('imagePreview').style.display = 'none';
        document.getElementById('identifyProduct').disabled = true;
        document.getElementById('identificationResults').style.display = 'none';
        this.currentImageFile = null;
    }

    /**
     * Storage functions
     */
    saveCredentials(credentials) {
        const toSave = { ...credentials };
        delete toSave.sandbox; // Don't store sensitive data
        localStorage.setItem('ebay_credentials', JSON.stringify(toSave));
    }

    loadStoredCredentials() {
        const stored = localStorage.getItem('ebay_credentials');
        if (stored) {
            try {
                const credentials = JSON.parse(stored);
                Object.keys(credentials).forEach(key => {
                    const field = document.getElementById(key);
                    if (field) {
                        field.value = credentials[key];
                    }
                });
            } catch (error) {
                console.error('Failed to load credentials:', error);
            }
        }
    }

    saveDraftToStorage(draft) {
        const drafts = this.getStoredDrafts();
        drafts.push(draft);
        localStorage.setItem('ebay_drafts', JSON.stringify(drafts));
    }

    getStoredDrafts() {
        const stored = localStorage.getItem('ebay_drafts');
        return stored ? JSON.parse(stored) : [];
    }

    getStoredSettings() {
        const stored = localStorage.getItem('ebay_master_settings');
        return stored ? JSON.parse(stored) : {};
    }

    initializeTooltips() {
        // Initialize Bootstrap tooltips
        if (typeof bootstrap !== 'undefined') {
            const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
            tooltipTriggerList.map(function (tooltipTriggerEl) {
                return new bootstrap.Tooltip(tooltipTriggerEl);
            });
        }
    }

    /**
     * Placeholder functions for features that would require more complex implementation
     */
    showListingDetails(sku) {
        this.showModal('Listing Details', `<p>Details for listing ${sku} would be shown here.</p>`);
    }

    editListing(sku) {
        this.showModal('Edit Listing', `<p>Edit form for listing ${sku} would be shown here.</p>`);
    }

    viewListing(itemId) {
        // Open eBay listing in new tab
        const baseUrl = this.ebayAPI.config.sandbox ? 'https://www.sandbox.ebay.com' : 'https://www.ebay.com';
        window.open(`${baseUrl}/itm/${itemId}`, '_blank');
    }
}

// Initialize application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new EbayMasterApp();
});
