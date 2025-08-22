# Credit Agricole Auto Connect & Operations Download

An automated Node.js tool that connects to your Credit Agricole bank account and downloads your latest operations as a CSV file. This tool uses Puppeteer to automate the web browser interactions required to log in and download transaction data.

## Features

- **Automated Login**: Securely logs into your Credit Agricole account using your account number and password
- **Smart Keypad Navigation**: Handles the randomized digital keypad for password entry
- **CSV Download**: Downloads transaction data in CSV format for the current month
- **Date Range Selection**: Automatically selects from the first to the last day of the current month
- **Comprehensive Logging**: Detailed logging with timestamps for monitoring the automation process
- **Privacy Compliance**: Automatically handles privacy policy acceptance

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

Run the automation script:

```bash
npm start
```

Or directly with Node.js:

```bash
node index.js
```

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

| Variable | Description | Example |
|----------|-------------|---------|
| `ACCOUNT_NUMBER` | Your Credit Agricole account number | `12345678` |
| `PASSWORD` | Your account password (digits only) | `123456` |

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

## File Structure

```
├── index.js           # Main automation script
├── package.json       # Project dependencies and scripts
├── .env              # Environment variables (create from .env.example)
├── .env.example      # Environment variables template
├── .gitignore        # Git ignore rules
└── README.md         # This documentation
```

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
