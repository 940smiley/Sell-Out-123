/**
 * AI Services for eBay Master Web Edition
 * Handles product identification and description generation using free AI APIs
 */

class AIServices {
    constructor() {
        this.config = {
            huggingfaceToken: '', // Optional for enhanced features
            huggingfaceAPI: 'https://api-inference.huggingface.co',
            openAIProxy: 'https://api.openai.com/v1', // Fallback if user has key
            models: {
                imageClassification: 'google/vit-base-patch16-224',
                objectDetection: 'facebook/detr-resnet-50',
                textGeneration: 'microsoft/DialoGPT-medium',
                productClassification: 'microsoft/resnet-50'
            }
        };
        
        this.productCategories = {
            'electronic': ['smartphone', 'laptop', 'tablet', 'camera', 'headphones', 'speaker', 'television', 'monitor'],
            'fashion': ['shirt', 'dress', 'pants', 'shoes', 'bag', 'watch', 'jewelry', 'hat'],
            'home': ['furniture', 'lamp', 'pillow', 'blanket', 'decoration', 'kitchen', 'tool'],
            'sports': ['ball', 'equipment', 'clothing', 'fitness', 'outdoor'],
            'toys': ['doll', 'game', 'puzzle', 'educational', 'action figure'],
            'automotive': ['car', 'motorcycle', 'tire', 'part', 'accessory'],
            'books': ['book', 'magazine', 'educational', 'fiction', 'non-fiction'],
            'health': ['supplement', 'medical', 'fitness', 'beauty', 'care']
        };
    }

    /**
     * Initialize AI services with optional API keys
     */
    initialize(config = {}) {
        this.config = { ...this.config, ...config };
        this.loadStoredConfig();
    }

    /**
     * Identify product from uploaded image
     */
    async identifyProductFromImage(imageFile) {
        try {
            // Convert image to base64
            const imageData = await this.fileToBase64(imageFile);
            
            // Try multiple identification approaches
            const results = await Promise.allSettled([
                this.classifyImageHuggingFace(imageFile),
                this.detectObjectsInImage(imageFile),
                this.analyzeImageLocally(imageFile)
            ]);

            // Combine and process results
            const identifications = this.combineIdentificationResults(results);
            
            // Generate product information
            const productInfo = await this.generateProductInfo(identifications, imageFile);
            
            return {
                success: true,
                identifications,
                productInfo,
                confidence: this.calculateOverallConfidence(identifications)
            };
            
        } catch (error) {
            console.error('Image identification failed:', error);
            return {
                success: false,
                error: error.message,
                identifications: [],
                productInfo: null
            };
        }
    }

    /**
     * Classify image using Hugging Face Vision Transformer
     */
    async classifyImageHuggingFace(imageFile) {
        const formData = new FormData();
        formData.append('file', imageFile);

        const headers = {
            'Authorization': this.config.huggingfaceToken ? `Bearer ${this.config.huggingfaceToken}` : undefined
        };

        // Remove undefined headers
        Object.keys(headers).forEach(key => headers[key] === undefined && delete headers[key]);

        const response = await fetch(`${this.config.huggingfaceAPI}/models/${this.config.models.imageClassification}`, {
            method: 'POST',
            headers,
            body: imageFile
        });

        if (!response.ok) {
            throw new Error(`Hugging Face API error: ${response.status}`);
        }

        const results = await response.json();
        
        return {
            source: 'huggingface_classification',
            results: results.map(item => ({
                label: item.label,
                confidence: item.score,
                category: this.mapToEbayCategory(item.label)
            }))
        };
    }

    /**
     * Detect objects in image
     */
    async detectObjectsInImage(imageFile) {
        const headers = {
            'Authorization': this.config.huggingfaceToken ? `Bearer ${this.config.huggingfaceToken}` : undefined
        };

        Object.keys(headers).forEach(key => headers[key] === undefined && delete headers[key]);

        const response = await fetch(`${this.config.huggingfaceAPI}/models/${this.config.models.objectDetection}`, {
            method: 'POST',
            headers,
            body: imageFile
        });

        if (!response.ok) {
            throw new Error(`Object detection API error: ${response.status}`);
        }

        const results = await response.json();
        
        return {
            source: 'object_detection',
            results: results.map(item => ({
                label: item.label,
                confidence: item.score,
                category: this.mapToEbayCategory(item.label),
                box: item.box
            }))
        };
    }

    /**
     * Analyze image locally using browser APIs
     */
    async analyzeImageLocally(imageFile) {
        return new Promise((resolve) => {
            const img = new Image();
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            img.onload = () => {
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);

                // Basic image analysis
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const analysis = this.performBasicImageAnalysis(imageData);

                resolve({
                    source: 'local_analysis',
                    results: [{
                        label: analysis.dominantColor,
                        confidence: 0.8,
                        category: 'color_analysis',
                        metadata: analysis
                    }]
                });
            };

            img.src = URL.createObjectURL(imageFile);
        });
    }

    /**
     * Perform basic image analysis
     */
    performBasicImageAnalysis(imageData) {
        const data = imageData.data;
        const colorCounts = {};
        let totalPixels = 0;

        // Sample pixels to avoid performance issues
        for (let i = 0; i < data.length; i += 16) { // Sample every 4th pixel
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            
            const colorKey = `${Math.floor(r/32)*32},${Math.floor(g/32)*32},${Math.floor(b/32)*32}`;
            colorCounts[colorKey] = (colorCounts[colorKey] || 0) + 1;
            totalPixels++;
        }

        // Find dominant color
        let dominantColor = 'unknown';
        let maxCount = 0;
        
        for (const [color, count] of Object.entries(colorCounts)) {
            if (count > maxCount) {
                maxCount = count;
                const [r, g, b] = color.split(',').map(Number);
                dominantColor = this.rgbToColorName(r, g, b);
            }
        }

        return {
            dominantColor,
            dimensions: {
                width: imageData.width,
                height: imageData.height
            },
            aspectRatio: imageData.width / imageData.height
        };
    }

    /**
     * Generate product information based on identifications
     */
    async generateProductInfo(identifications, imageFile) {
        const topIdentification = this.getTopIdentification(identifications);
        
        if (!topIdentification) {
            return this.generateGenericProductInfo();
        }

        const category = topIdentification.category || 'general';
        const label = topIdentification.label || 'unknown product';

        // Generate title
        const title = this.generateProductTitle(label, category);
        
        // Generate description
        const description = await this.generateProductDescription(label, category, identifications);
        
        // Suggest pricing based on category
        const suggestedPrice = this.suggestPrice(category, label);
        
        // Determine condition
        const condition = this.determineCondition(identifications);

        return {
            title,
            description,
            category,
            suggestedPrice,
            condition,
            keywords: this.generateKeywords(label, category),
            specifications: this.generateSpecifications(identifications)
        };
    }

    /**
     * Generate product description using AI or templates
     */
    async generateProductDescription(label, category, identifications) {
        // Try to use AI for description generation
        if (this.config.huggingfaceToken) {
            try {
                return await this.generateDescriptionWithAI(label, category);
            } catch (error) {
                console.warn('AI description generation failed:', error);
            }
        }

        // Fallback to template-based description
        return this.generateTemplateDescription(label, category, identifications);
    }

    /**
     * Generate description using AI
     */
    async generateDescriptionWithAI(label, category) {
        const prompt = `Write a compelling eBay product description for a ${label} in the ${category} category. Include key features, benefits, and selling points. Keep it under 200 words.`;

        const response = await fetch(`${this.config.huggingfaceAPI}/models/${this.config.models.textGeneration}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.config.huggingfaceToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                inputs: prompt,
                parameters: {
                    max_length: 200,
                    temperature: 0.7
                }
            })
        });

        if (!response.ok) {
            throw new Error('AI description generation failed');
        }

        const result = await response.json();
        return result[0]?.generated_text || this.generateTemplateDescription(label, category);
    }

    /**
     * Generate template-based description
     */
    generateTemplateDescription(label, category, identifications) {
        const templates = {
            electronics: `High-quality ${label} in excellent condition. Perfect for everyday use with reliable performance. Features modern design and user-friendly interface. Great value for money!`,
            fashion: `Stylish ${label} that combines comfort and fashion. Made from quality materials with attention to detail. Perfect for various occasions and easy to care for.`,
            home: `Beautiful ${label} that will enhance your home decor. Functional and aesthetically pleasing design. Durable construction ensures long-lasting use.`,
            sports: `Premium ${label} for sports enthusiasts. Designed for performance and durability. Suitable for both beginners and professionals.`,
            automotive: `Reliable ${label} for your vehicle. Quality construction meets safety standards. Easy installation and long-lasting performance.`,
            default: `Quality ${label} in good condition. Functional and well-maintained. Perfect for anyone looking for reliable value. Fast shipping and excellent customer service guaranteed!`
        };

        const template = templates[category] || templates.default;
        
        // Add confidence information if high
        const topResult = this.getTopIdentification(identifications);
        if (topResult && topResult.confidence > 0.8) {
            return template + `\n\nProduct identified with high confidence using advanced AI technology.`;
        }
        
        return template;
    }

    /**
     * Utility functions
     */
    combineIdentificationResults(results) {
        const allResults = [];
        
        results.forEach(result => {
            if (result.status === 'fulfilled' && result.value) {
                allResults.push(...result.value.results);
            }
        });

        // Remove duplicates and sort by confidence
        const uniqueResults = this.removeDuplicateIdentifications(allResults);
        return uniqueResults.sort((a, b) => b.confidence - a.confidence);
    }

    removeDuplicateIdentifications(results) {
        const seen = new Set();
        return results.filter(result => {
            const key = result.label.toLowerCase();
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    }

    getTopIdentification(identifications) {
        return identifications && identifications.length > 0 ? identifications[0] : null;
    }

    calculateOverallConfidence(identifications) {
        if (!identifications || identifications.length === 0) return 0;
        
        const totalConfidence = identifications.reduce((sum, item) => sum + item.confidence, 0);
        return totalConfidence / identifications.length;
    }

    mapToEbayCategory(label) {
        const lowerLabel = label.toLowerCase();
        
        for (const [category, keywords] of Object.entries(this.productCategories)) {
            if (keywords.some(keyword => lowerLabel.includes(keyword))) {
                return category;
            }
        }
        
        return 'general';
    }

    generateProductTitle(label, category) {
        const categoryMap = {
            electronics: 'Tech',
            fashion: 'Style',
            home: 'Home',
            sports: 'Sports',
            automotive: 'Auto'
        };
        
        const prefix = categoryMap[category] || 'Quality';
        const cleanLabel = this.capitalizeWords(label.replace(/[_-]/g, ' '));
        
        return `${prefix} ${cleanLabel} - Excellent Condition`;
    }

    generateKeywords(label, category) {
        const baseKeywords = [label, category];
        const categoryKeywords = this.productCategories[category] || [];
        
        return [...new Set([...baseKeywords, ...categoryKeywords.slice(0, 5)])];
    }

    generateSpecifications(identifications) {
        const specs = {};
        
        identifications.forEach(item => {
            if (item.metadata) {
                Object.assign(specs, item.metadata);
            }
        });
        
        return specs;
    }

    suggestPrice(category, label) {
        const basePrices = {
            electronics: 50,
            fashion: 25,
            home: 30,
            sports: 35,
            automotive: 40,
            books: 15,
            toys: 20
        };
        
        return basePrices[category] || 25;
    }

    determineCondition(identifications) {
        // Default to "Used" for AI-identified items
        // Could be enhanced with condition detection AI
        return 'Used';
    }

    rgbToColorName(r, g, b) {
        const colors = {
            'black': [0, 0, 0],
            'white': [255, 255, 255],
            'red': [255, 0, 0],
            'green': [0, 255, 0],
            'blue': [0, 0, 255],
            'yellow': [255, 255, 0],
            'purple': [128, 0, 128],
            'orange': [255, 165, 0],
            'brown': [139, 69, 19],
            'gray': [128, 128, 128]
        };

        let minDistance = Infinity;
        let closestColor = 'unknown';

        for (const [colorName, [cr, cg, cb]] of Object.entries(colors)) {
            const distance = Math.sqrt((r-cr)**2 + (g-cg)**2 + (b-cb)**2);
            if (distance < minDistance) {
                minDistance = distance;
                closestColor = colorName;
            }
        }

        return closestColor;
    }

    capitalizeWords(str) {
        return str.replace(/\w\S*/g, (txt) => 
            txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
        );
    }

    async fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });
    }

    generateGenericProductInfo() {
        return {
            title: 'Quality Product - Excellent Condition',
            description: 'Quality item in good condition. Perfect for anyone looking for reliable value. Fast shipping and excellent customer service guaranteed!',
            category: 'general',
            suggestedPrice: 25,
            condition: 'Used',
            keywords: ['quality', 'value', 'reliable'],
            specifications: {}
        };
    }

    saveConfig(config) {
        localStorage.setItem('ai_config', JSON.stringify(config));
        this.config = { ...this.config, ...config };
    }

    loadStoredConfig() {
        const stored = localStorage.getItem('ai_config');
        if (stored) {
            try {
                const config = JSON.parse(stored);
                this.config = { ...this.config, ...config };
            } catch (error) {
                console.error('Failed to load AI config:', error);
            }
        }
    }

    clearConfig() {
        localStorage.removeItem('ai_config');
    }
}

// Export for use in other modules
window.AIServices = AIServices;
