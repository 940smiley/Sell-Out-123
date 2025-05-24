# eBay Master - Web Edition

A modern web-based interface for managing eBay listings with AI-powered product identification and automated listing generation. This is a complete rewrite of the original C# Windows application, now running entirely in the browser and hosted on GitHub Pages.

## 🌟 Features

### 🔐 eBay Integration
- **OAuth 2.0 Authentication**: Secure connection to your eBay seller account
- **Active Listings Management**: View and manage all your active eBay listings
- **Real-time Data**: Fetch live data directly from eBay's REST APIs
- **Sandbox Support**: Test with eBay's sandbox environment

### 🤖 AI-Powered Product Identification
- **Image Recognition**: Upload product photos for automatic identification
- **Multiple AI Models**: Uses Hugging Face's vision transformers and object detection
- **Category Mapping**: Automatically maps identified products to eBay categories
- **Confidence Scoring**: Shows confidence levels for all identifications

### ✍️ Intelligent Draft Generation
- **AI-Generated Descriptions**: Creates compelling product descriptions automatically
- **Smart Titles**: Generates SEO-friendly listing titles
- **Price Suggestions**: Recommends starting prices based on product category
- **Template System**: Fallback to curated templates when AI is unavailable

### 💾 Local Data Management
- **Browser Storage**: All data stored locally in your browser
- **Draft Saving**: Save listing drafts for later editing
- **Settings Persistence**: Remember your preferences and API keys
- **Offline Capable**: Works without internet for draft creation

## 🚀 Getting Started

### Prerequisites
You'll need:
1. An eBay developer account with API credentials
2. A modern web browser (Chrome, Firefox, Safari, Edge)
3. Optional: Hugging Face API token for enhanced AI features

### eBay API Setup

1. **Create eBay Developer Account**
   - Visit [eBay Developers Program](https://developer.ebay.com/)
   - Sign up and create a new application

2. **Get Your Credentials**
   - **App ID**: Your application identifier
   - **Dev ID**: Your developer identifier  
   - **Cert ID**: Your certificate identifier
   - **RuName**: Your OAuth redirect URL (use: `[your-github-username].github.io/ebaymaster`)

3. **Configure OAuth**
   - Set your RuName in eBay's developer console
   - Enable the required OAuth scopes:
     - `https://api.ebay.com/oauth/api_scope/sell.inventory`
     - `https://api.ebay.com/oauth/api_scope/sell.marketing`
     - `https://api.ebay.com/oauth/api_scope`

### Hosting Setup

#### Option 1: GitHub Pages (Recommended)
1. Fork this repository
2. Go to repository Settings → Pages
3. Select "Deploy from a branch" → `main` → `/docs`
4. Your app will be available at `https://[username].github.io/ebaymaster`

#### Option 2: Local Development
1. Clone the repository
2. Serve the `docs` folder with any web server:
   ```bash
   cd docs
   python -m http.server 8000
   # or
   npx serve .
   ```
3. Open `http://localhost:8000`

### First Time Setup

1. **Access the Application**
   - Navigate to your hosted URL
   - You'll see the eBay connection form

2. **Enter Your eBay Credentials**
   - App ID, Dev ID, Cert ID, and RuName
   - Choose Sandbox for testing or Production for live trading
   - Click "Connect to eBay"

3. **Complete OAuth Authorization**
   - You'll be redirected to eBay for authorization
   - Sign in and grant permissions
   - You'll be redirected back to the application

4. **Start Using Features**
   - View your active listings
   - Upload product images for AI identification
   - Create new listing drafts

## 📱 Using the Application

### Managing Listings
- **View Active Listings**: See all your current eBay listings with images, prices, and status
- **Refresh Data**: Click the refresh button to get the latest information from eBay
- **Edit Listings**: Click the edit button to modify listing details (coming soon)
- **View on eBay**: Click the external link to open the listing on eBay

### AI Product Identification
1. **Upload an Image**: 
   - Click "Choose File" or drag and drop an image
   - Supported formats: JPG, PNG, GIF, WebP
   - Maximum size: 10MB

2. **Identify Product**:
   - Click "Identify Product" to analyze the image
   - View confidence scores for different identifications
   - See suggested category and product information

3. **Use Results**:
   - Click "Use for New Listing" to auto-fill the draft form
   - Results include title, description, category, and pricing suggestions

### Creating Listing Drafts
1. **Manual Entry**:
   - Fill in product title, category, price, and condition
   - Write your own description or use the AI generator

2. **AI-Assisted Creation**:
   - Use product identification results to auto-fill forms
   - Generate descriptions with the "Generate AI Description" button
   - Preview your listing before saving

3. **Save and Manage**:
   - Save drafts to local storage
   - Preview how your listing will appear
   - Export or publish to eBay (coming soon)

### Settings and Configuration
- **API Tokens**: Add your Hugging Face token for enhanced AI features
- **Default Values**: Set default shipping costs and handling times
- **Data Management**: Clear all stored data if needed

## 🔧 Technical Details

### Architecture
- **Frontend-Only**: Pure HTML, CSS, and JavaScript application
- **No Backend Required**: All API calls made directly from the browser
- **Modern Web APIs**: Uses Fetch API, Local Storage, File API
- **Responsive Design**: Works on desktop and mobile devices

### APIs Used
- **eBay REST APIs**: For listing management and authentication
- **Hugging Face Inference API**: For AI-powered image recognition
- **Browser APIs**: For file handling and local storage

### Security
- **Client-Side Only**: Your eBay tokens never leave your browser
- **Local Storage**: All data stored locally, not on external servers
- **HTTPS Required**: Secure connections for all API calls
- **OAuth 2.0**: Industry-standard authentication with eBay

### Browser Compatibility
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## 🤖 AI Features Detail

### Image Recognition Models
- **Vision Transformer (ViT)**: Primary image classification
- **DETR Object Detection**: Identifies multiple objects in images
- **Local Analysis**: Basic color and dimension analysis

### Fallback System
- **Free Tier**: Works without API tokens using public endpoints
- **Rate Limiting**: Handles API rate limits gracefully
- **Template Fallback**: Uses templates when AI is unavailable

### Supported Product Categories
- Electronics (smartphones, laptops, cameras, etc.)
- Fashion (clothing, shoes, accessories)
- Home & Garden (furniture, decor, tools)
- Sports & Outdoors
- Automotive parts and accessories
- Books and media
- Toys and games
- Health and beauty

## 📊 Data Storage

All data is stored locally in your browser using:
- **LocalStorage**: For settings, credentials, and small data
- **IndexedDB**: For larger datasets (future feature)
- **No Cloud Storage**: Your data never leaves your device

### Stored Information
- eBay API credentials (encrypted)
- OAuth tokens (temporary)
- User preferences and settings
- Draft listings
- AI service configuration

## 🔒 Privacy & Security

- **No Data Collection**: This application doesn't collect or transmit personal data
- **Local Processing**: All AI processing happens in your browser or via direct API calls
- **Secure Storage**: Sensitive data is encrypted in browser storage
- **Open Source**: Full source code available for review

## 🛠️ Development

### Project Structure
```
docs/
├── index.html          # Main application interface
├── css/
│   └── style.css       # Application styles
├── js/
│   ├── app.js          # Main application logic
│   ├── ebay-api.js     # eBay API integration
│   └── ai-services.js  # AI service integration
└── assets/             # Images and other assets
```

### Contributing
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

### Local Development Setup
```bash
# Clone the repository
git clone https://github.com/[username]/ebaymaster.git
cd ebaymaster

# Serve the docs folder
cd docs
python -m http.server 8000

# Open in browser
open http://localhost:8000
```

## 📝 Changelog

### Version 2.0.0 (Web Edition)
- Complete rewrite as web application
- AI-powered product identification
- Modern responsive interface
- GitHub Pages hosting
- OAuth 2.0 authentication
- Browser-based storage

### Migration from Desktop Version
This web edition replaces the original C# Windows Forms application with:
- Cross-platform compatibility
- No installation required
- Modern web technologies
- Enhanced AI features
- Real-time eBay integration

## ⚠️ Limitations

- **eBay API Limits**: Subject to eBay's API rate limits
- **Browser Storage**: Limited by browser storage quotas
- **AI Accuracy**: AI identification accuracy varies by image quality
- **Internet Required**: Needs internet for eBay API calls and AI services

## 📞 Support

- **Issues**: Report bugs via GitHub Issues
- **Documentation**: See this README and inline help
- **eBay API**: Refer to [eBay Developer Documentation](https://developer.ebay.com/docs)
- **Hugging Face**: See [Hugging Face Documentation](https://huggingface.co/docs)

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🙏 Acknowledgments

- eBay Developers Program for API access
- Hugging Face for AI model hosting
- Bootstrap for UI components
- Font Awesome for icons
- Original eBay Master C# application as inspiration

---

**Happy Selling! 🛒**

Transform your eBay listing workflow with AI-powered automation and modern web technology.
