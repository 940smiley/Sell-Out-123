/**
 * eBay API Integration for eBay Master Web Edition
 * Uses eBay's REST APIs with OAuth 2.0 authentication
 */

class EbayAPI {
    constructor() {
        this.config = {
            sandbox: false,
            appId: '',
            certId: '',
            devId: '',
            ruName: '',
            accessToken: '',
            refreshToken: '',
            userToken: ''
        };
        
        this.endpoints = {
            production: {
                api: 'https://api.ebay.com',
                auth: 'https://auth.ebay.com/oauth/api_request',
                signin: 'https://signin.ebay.com/authorize'
            },
            sandbox: {
                api: 'https://api.sandbox.ebay.com',
                auth: 'https://auth.sandbox.ebay.com/oauth/api_request',
                signin: 'https://auth.sandbox.ebay.com/oauth/authorize'
            }
        };
    }

    /**
     * Initialize eBay API with credentials
     */
    initialize(config) {
        this.config = { ...this.config, ...config };
        this.loadStoredTokens();
        return this.config.appId && this.config.certId && this.config.devId;
    }

    /**
     * Get current API endpoints based on sandbox mode
     */
    getEndpoints() {
        return this.config.sandbox ? this.endpoints.sandbox : this.endpoints.production;
    }

    /**
     * Generate OAuth authorization URL
     */
    getAuthUrl(scopes = ['https://api.ebay.com/oauth/api_scope/sell.inventory']) {
        const endpoints = this.getEndpoints();
        const params = new URLSearchParams({
            client_id: this.config.appId,
            response_type: 'code',
            redirect_uri: this.config.ruName,
            scope: scopes.join(' '),
            state: this.generateState()
        });
        
        localStorage.setItem('ebay_oauth_state', params.get('state'));
        return `${endpoints.signin}?${params.toString()}`;
    }

    /**
     * Exchange authorization code for access token
     */
    async exchangeCodeForToken(authCode, state) {
        const storedState = localStorage.getItem('ebay_oauth_state');
        if (state !== storedState) {
            throw new Error('Invalid OAuth state parameter');
        }

        const endpoints = this.getEndpoints();
        const credentials = btoa(`${this.config.appId}:${this.config.certId}`);
        
        const response = await fetch(`${endpoints.auth}`, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${credentials}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code: authCode,
                redirect_uri: this.config.ruName
            })
        });

        if (!response.ok) {
            throw new Error(`Token exchange failed: ${response.status}`);
        }

        const tokenData = await response.json();
        this.config.accessToken = tokenData.access_token;
        this.config.refreshToken = tokenData.refresh_token;
        this.config.userToken = tokenData.access_token; // For user operations
        
        this.saveTokens(tokenData);
        return tokenData;
    }

    /**
     * Get application token for public API calls
     */
    async getApplicationToken() {
        const endpoints = this.getEndpoints();
        const credentials = btoa(`${this.config.appId}:${this.config.certId}`);
        
        const response = await fetch(`${endpoints.auth}`, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${credentials}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                grant_type: 'client_credentials',
                scope: 'https://api.ebay.com/oauth/api_scope'
            })
        });

        if (!response.ok) {
            throw new Error(`Application token request failed: ${response.status}`);
        }

        const tokenData = await response.json();
        this.config.accessToken = tokenData.access_token;
        return tokenData;
    }

    /**
     * Refresh user access token
     */
    async refreshAccessToken() {
        if (!this.config.refreshToken) {
            throw new Error('No refresh token available');
        }

        const endpoints = this.getEndpoints();
        const credentials = btoa(`${this.config.appId}:${this.config.certId}`);
        
        const response = await fetch(`${endpoints.auth}`, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${credentials}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: this.config.refreshToken
            })
        });

        if (!response.ok) {
            throw new Error(`Token refresh failed: ${response.status}`);
        }

        const tokenData = await response.json();
        this.config.accessToken = tokenData.access_token;
        if (tokenData.refresh_token) {
            this.config.refreshToken = tokenData.refresh_token;
        }
        
        this.saveTokens(tokenData);
        return tokenData;
    }

    /**
     * Get user's active listings using Inventory API
     */
    async getActiveListings(limit = 50, offset = 0) {
        await this.ensureValidToken();
        const endpoints = this.getEndpoints();
        
        const response = await fetch(`${endpoints.api}/sell/inventory/v1/inventory_item?limit=${limit}&offset=${offset}`, {
            headers: {
                'Authorization': `Bearer ${this.config.userToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            if (response.status === 401) {
                await this.refreshAccessToken();
                return this.getActiveListings(limit, offset);
            }
            throw new Error(`Failed to fetch listings: ${response.status}`);
        }

        const data = await response.json();
        return this.formatListingsData(data);
    }

    /**
     * Get user's selling summary using Browse API fallback
     */
    async getSellerListings(sellerId) {
        const endpoints = this.getEndpoints();
        
        const response = await fetch(`${endpoints.api}/browse/v1/item_summary/search?q=seller:${sellerId}&limit=50`, {
            headers: {
                'Authorization': `Bearer ${this.config.accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch seller listings: ${response.status}`);
        }

        const data = await response.json();
        return data;
    }

    /**
     * Get item details
     */
    async getItemDetails(itemId) {
        const endpoints = this.getEndpoints();
        
        const response = await fetch(`${endpoints.api}/browse/v1/item/${itemId}`, {
            headers: {
                'Authorization': `Bearer ${this.config.accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch item details: ${response.status}`);
        }

        return await response.json();
    }

    /**
     * Update listing (requires user token)
     */
    async updateListing(sku, updateData) {
        await this.ensureValidToken();
        const endpoints = this.getEndpoints();
        
        const response = await fetch(`${endpoints.api}/sell/inventory/v1/inventory_item/${sku}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${this.config.userToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updateData)
        });

        if (!response.ok) {
            if (response.status === 401) {
                await this.refreshAccessToken();
                return this.updateListing(sku, updateData);
            }
            throw new Error(`Failed to update listing: ${response.status}`);
        }

        return await response.json();
    }

    /**
     * Search eBay marketplace
     */
    async searchItems(query, categoryId = null, limit = 50) {
        const endpoints = this.getEndpoints();
        let url = `${endpoints.api}/browse/v1/item_summary/search?q=${encodeURIComponent(query)}&limit=${limit}`;
        
        if (categoryId) {
            url += `&category_ids=${categoryId}`;
        }
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${this.config.accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Search failed: ${response.status}`);
        }

        return await response.json();
    }

    /**
     * Get eBay categories
     */
    async getCategories() {
        const endpoints = this.getEndpoints();
        
        const response = await fetch(`${endpoints.api}/commerce/taxonomy/v1/category_tree/0`, {
            headers: {
                'Authorization': `Bearer ${this.config.accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch categories: ${response.status}`);
        }

        return await response.json();
    }

    /**
     * Format listings data for display
     */
    formatListingsData(data) {
        if (!data.inventoryItems) {
            return [];
        }

        return data.inventoryItems.map(item => ({
            sku: item.sku,
            title: item.product?.title || 'Untitled',
            description: item.product?.description || '',
            price: item.product?.price?.value || 0,
            currency: item.product?.price?.currency || 'USD',
            quantity: item.availability?.shipToLocationAvailability?.quantity || 0,
            condition: item.condition || 'NEW',
            images: item.product?.imageUrls || [],
            categoryId: item.product?.categoryId || '',
            itemId: item.product?.title ? item.sku : null,
            status: this.getListingStatus(item)
        }));
    }

    /**
     * Get listing status
     */
    getListingStatus(item) {
        if (item.availability?.shipToLocationAvailability?.quantity > 0) {
            return 'Active';
        }
        return 'Out of Stock';
    }

    /**
     * Ensure we have a valid token
     */
    async ensureValidToken() {
        if (!this.config.userToken) {
            throw new Error('User not authenticated');
        }
        
        // Try to refresh if token is close to expiry
        const tokenAge = this.getTokenAge();
        if (tokenAge > 3000) { // Refresh if older than 50 minutes
            try {
                await this.refreshAccessToken();
            } catch (error) {
                console.warn('Token refresh failed:', error);
            }
        }
    }

    /**
     * Utility functions
     */
    generateState() {
        return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }

    saveTokens(tokenData) {
        const tokens = {
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token || this.config.refreshToken,
            expires_in: tokenData.expires_in,
            timestamp: Date.now()
        };
        localStorage.setItem('ebay_tokens', JSON.stringify(tokens));
    }

    loadStoredTokens() {
        const stored = localStorage.getItem('ebay_tokens');
        if (stored) {
            try {
                const tokens = JSON.parse(stored);
                this.config.accessToken = tokens.access_token;
                this.config.refreshToken = tokens.refresh_token;
                this.config.userToken = tokens.access_token;
                return true;
            } catch (error) {
                console.error('Failed to load stored tokens:', error);
            }
        }
        return false;
    }

    getTokenAge() {
        const stored = localStorage.getItem('ebay_tokens');
        if (stored) {
            try {
                const tokens = JSON.parse(stored);
                return (Date.now() - tokens.timestamp) / 1000; // Age in seconds
            } catch (error) {
                return Infinity;
            }
        }
        return Infinity;
    }

    clearTokens() {
        localStorage.removeItem('ebay_tokens');
        localStorage.removeItem('ebay_oauth_state');
        this.config.accessToken = '';
        this.config.refreshToken = '';
        this.config.userToken = '';
    }

    isAuthenticated() {
        return !!this.config.userToken;
    }

    getUserInfo() {
        // This would need additional API call to get user info
        return {
            authenticated: this.isAuthenticated(),
            hasValidToken: this.getTokenAge() < 3600
        };
    }
}

// Export for use in other modules
window.EbayAPI = EbayAPI;
