# Credit Agricole Auto Connect & Operations Download

An automated Node.js tool that connects to your Credit Agricole bank account and downloads your latest operations as a CSV file. This tool uses Puppeteer to automate the web browser interactions required to log in and download transaction data.

## Features

### 🤖 **Automated Bank Operations**

- **Automated Login**: Securely logs into your Credit Agricole account using your account number and password
- **Smart Keypad Navigation**: Handles the randomized digital keypad for password entry
- **CSV Download**: Downloads transaction data in CSV format for the current month
- **Date Range Selection**: Automatically selects from the first to the last day of the current month
- **Privacy Compliance**: Automatically handles privacy policy acceptance

### 📊 **Advanced Data Processing**

- **Account Balance Extraction**: Automatically extracts current account balance from CSV files
- **Robust CSV Parsing**: Handles multi-line CSV format with proper encoding support for French characters
- **Character Encoding Fix**: Automatically corrects broken characters (€, à, é, etc.) in CSV files
- **Smart Categorization**: Intelligently categorizes transactions into 11 comprehensive categories:
  - 💰 Revenus (Income) - Salary, benefits, transfers
  - 🏠 Logement (Housing) - Rent, utilities, telecom, accommodation
  - 🍕 Alimentation (Food) - Groceries, restaurants, fast food
  - 🚗 Transport - Fuel, tolls, public transport, car maintenance
  - 🏥 Santé (Health) - Healthcare, pharmacy, insurance, optical
  - 🎯 Loisirs (Leisure) - Entertainment, culture, sports, streaming
  - 🛒 Shopping - Online purchases, retail, clothing, electronics
  - 🎮 Divertissement (Gaming) - Games, digital entertainment platforms
  - 🏦 Banque (Banking) - Banking fees and operations
  - 📋 Impôts (Taxes) - Government fees and taxes
  - 📦 Divers (Miscellaneous) - Other transactions

### 📈 **Visualization & Analytics**

- **Interactive Dashboard**: Modern web-based interface with responsive design
- **Real-time Charts**: Doughnut charts, bar charts, and timeline visualizations
- **Expandable Categories**: Click to drill down into individual transactions
- **Financial Summary Cards**: Quick overview of debits, credits, net balance, and account balance
- **Export Capabilities**: JSON and text report generation

### 🐳 **Deployment & Infrastructure**

- **Docker Support**: Fully containerized with optimized Dockerfile and docker-compose
- **Comprehensive Logging**: Detailed logging with timestamps using Pino logger
- **Error Handling**: Robust error handling and recovery mechanisms
- **Modular Architecture**: Categories configuration separated into dedicated file for maintainability
- **ES6 Modules**: Modern JavaScript with import/export syntax

## Prerequisites

- Node.js (version 14 or higher)
- A valid Credit Agricole Centre Loire bank account
- Chrome/Chromium browser (installed automatically with Puppeteer)

## Installation

1. Clone or download this repository
2. Install dependencies:

   ```bash
   npm install
   ```

3. Set up your environment variables:

   ```bash
   cp .env.example .env
   ```

4. Edit the `.env` file with your credentials:
   ```
   ACCOUNT_NUMBER=your_account_number
   PASSWORD=your_password
   ```

## Usage

### 🚀 **Quick Start - Complete Workflow**

1. **Download Bank Operations**:

   ```bash
   npm start
   # or: node index.js
   ```

2. **Process & Categorize Data**:

   ```bash
   npm run categorize CA20250822_XXXXXX.csv
   # or: node categorize-operations.js your-csv-file.csv
   ```

3. **Visualize with Dashboard**:
   ```bash
   node server.js
   # Open http://localhost:3000 in your browser
   ```

### 🐳 **Docker Deployment (Recommended)**

For a containerized deployment of the dashboard:

```bash
# Build and run the dashboard container
docker compose up --build

# Access dashboard at http://localhost:3000
```

The Docker setup automatically:

- Installs all dependencies
- Configures the server environment
- Serves the dashboard on port 3000
- Handles file permissions and security

### 📊 **Data Processing Features**

The categorization script automatically:

- **Extracts Account Balance**: Reads current balance from CSV line A7
- **Fixes Encoding Issues**: Corrects broken French characters (€, à, é, ç, etc.)
- **Smart Categorization**: Uses keyword matching for 9+ categories
- **Generates Reports**: Creates both JSON and human-readable text reports
- **Handles Multi-line CSV**: Properly parses Credit Agricole's complex CSV format

### 🎯 **Dashboard Features**

The interactive dashboard provides:

- **📊 Visual Analytics**: Doughnut charts, bar charts, and timeline graphs
- **💰 Financial Summary**: Account balance, debits, credits, and net balance
- **🔍 Category Drill-down**: Click categories to see individual transactions
- **📱 Responsive Design**: Works on desktop, tablet, and mobile
- **🎨 Modern UI**: Clean interface with smooth animations and icons

### What the Script Does

1. **Opens Browser**: Launches a visible Chrome browser window
2. **Navigates to Login**: Goes to the Credit Agricole login page
3. **Enters Account Number**: Types your account number
4. **Handles Digital Keypad**: Clicks each digit of your password on the randomized keypad
5. **Submits Login**: Completes the authentication process
6. **Accepts Privacy Policy**: Handles the privacy policy popup
7. **Navigates to Downloads**: Goes to the operations download section
8. **Selects Account**: Chooses the first available account
9. **Configures Download**: Sets format to CSV and selects current month date range
10. **Downloads File**: Initiates the CSV download
11. **Closes Browser**: Cleans up and closes the browser

## Configuration

### Environment Variables

| Variable         | Description                         | Example    |
| ---------------- | ----------------------------------- | ---------- |
| `ACCOUNT_NUMBER` | Your Credit Agricole account number | `12345678` |
| `PASSWORD`       | Your account password (digits only) | `123456`   |

### Browser Settings

The script runs with the following Puppeteer configuration:

- **Headless**: `false` (browser window is visible)
- **Slow Motion**: 100ms delay between actions
- **Viewport**: 1920px width, full page height

## Dependencies

- **puppeteer**: Web automation and browser control
- **dotenv**: Environment variable management
- **pino**: High-performance logging
- **pino-pretty**: Pretty-printed log formatting

## 📁 Project Structure

```
ca-auto-connect-and-get-operations/
├── index.js                    # Main automation script
├── categorize-operations.js    # CSV processing and categorization
├── categories.js              # Transaction categories configuration
├── dashboard.html             # Interactive web dashboard
├── server.js                  # Dashboard web server
├── package.json               # Dependencies and scripts
├── .env.example              # Environment variables template
├── Dockerfile                # Docker container configuration
├── compose.yaml              # Docker Compose setup
├── .dockerignore             # Docker build exclusions
└── README.md                 # This documentation
```

### 🗂️ Generated Files (after running scripts):

```
├── CA20250822_XXXXXX.csv      # Downloaded bank operations
├── CA20250822_XXXXXX_categorized.json  # Processed financial data
├── CA20250822_XXXXXX_report.txt        # Human-readable report
└── downloads/                 # Browser download directory
```

## 🏷️ Smart Categorization System

The categorization script automatically sorts operations into **10 intelligent categories** with enhanced keyword matching:

- **🍕 Alimentation**: Supermarkets, restaurants, food delivery (Carrefour, McDonald's, etc.)
- **🚗 Transport**: Gas stations, public transport, taxis, tolls (Uber, SNCF, Péage, etc.)
- **🏥 Santé**: Pharmacies, doctors, hospitals, insurance (Harmonie Mutuelle, etc.)
- **🏠 Logement**: Rent, utilities, internet, home insurance (Orange, EDF, Loyer, etc.)
- **🎯 Loisirs**: Entertainment, streaming, culture (Netflix, Spotify, Cinema, etc.)
- **🎮 Jeux**: Gaming platforms, digital entertainment (Steam, PayPal gaming, Discord, etc.)
- **🏦 Banque**: Bank fees, transfers, withdrawals, account maintenance (Cotisation, Virement, etc.)
- **💰 Salaire**: Salary, bonuses, compensation, work-related income
- **📋 Impôts**: Taxes, government fees, official payments (DGFIP, URSSAF, etc.)
- **🛒 Shopping**: Online stores, retail purchases (Amazon, Zalando, Fnac, etc.)
- **📦 Autres**: Uncategorized or miscellaneous operations

### 🔧 Customizing Categories

Transaction categories are now configured in a separate `categories.js` file for better maintainability:

```javascript
// categories.js
export const CATEGORIES = {
  Alimentation: ["CARREFOUR", "LECLERC", "MCDONALDS"],
  Transport: ["TOTAL", "SHELL", "SNCF"],
  // Add your own categories and keywords
};
```

**Key improvements:**
- ✅ **Modular Design**: Categories separated from main logic
- ✅ **ES6 Modules**: Modern import/export syntax
- ✅ **Better Organization**: Cleaner code structure
- ✅ **Easy Maintenance**: Modify categories without touching main script
- ✅ **Enhanced Keywords**: More comprehensive keyword matching for French banking

## Complete Workflow

Here's the complete process from download to visualization:

1. **Download Operations**: `npm start` - Downloads CSV from your bank account
2. **Categorize Data**: `npm run categorize filename.csv` - Analyzes and categorizes transactions
3. **Visualize Results**: `node server.js` - Launch dashboard at http://localhost:3000
4. **Upload JSON**: Use the dashboard to upload your `*_categorized.json` file
5. **Explore Data**: View interactive charts, timelines, and detailed breakdowns

## Dashboard Features

The web dashboard provides comprehensive financial visualization:

### 📊 Charts & Graphs

- **Category Distribution**: Doughnut chart showing spending breakdown
- **Balance Comparison**: Bar chart comparing debits vs credits
- **Timeline Evolution**: Line chart tracking cumulative balance over time

### 💳 Summary Cards

- Total debits and credits
- Net balance calculation
- Total number of operations

### 📋 Category Analysis

- Detailed breakdown by spending category
- Average amounts per category
- Transaction counts with visual icons
- Color-coded spending indicators

### 🎨 Modern UI

- Responsive design for desktop and mobile
- Beautiful gradient backgrounds
- Smooth animations and hover effects
- Intuitive file upload interface

## Security Considerations

⚠️ **Important Security Notes:**

- Never commit your `.env` file to version control
- Your credentials are stored locally and not transmitted anywhere except to Credit Agricole
- The script runs with a visible browser window for transparency
- Consider using this tool only on trusted, personal devices

## Troubleshooting

### Common Issues

**Browser doesn't open:**

- Ensure you have sufficient permissions to run Chrome
- Check if Puppeteer installed correctly: `npm list puppeteer`

**Login fails:**

- Verify your account number and password in `.env`
- Check if Credit Agricole has changed their website structure
- Ensure your account is not locked or requires additional verification

**Download doesn't start:**

- The script waits for page elements to load; slow connections may need longer delays
- Check if you have sufficient account permissions for downloading operations

**Date selection fails:**

- The script selects the current month by default
- Ensure the calendar widget is accessible and not blocked by other elements

### Debugging

The script includes comprehensive logging. Check the console output for detailed information about each step. Log levels include:

- `info`: General operation progress
- `error`: Critical failures (if any)

## Limitations

- Currently supports Credit Agricole Centre Loire region only
- Designed for personal accounts (not business accounts)
- Downloads current month operations only
- Requires manual setup of credentials

## Legal Notice

This tool is for personal use only. Ensure you comply with:

- Credit Agricole's terms of service
- Local banking regulations
- Data protection laws

The authors are not responsible for any misuse or violations of banking terms of service.

## Contributing

Feel free to submit issues or pull requests if you encounter bugs or have suggestions for improvements.

## License

ISC License - see package.json for details.
