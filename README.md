# HunterKiller

A fast, privacy-focused browser extension for discovering email addresses from any domain.

![Version](https://img.shields.io/badge/version-6.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## What is this?

HunterKiller helps you find publicly available email addresses on websites. It's useful for sales, recruiting, research, or just getting in touch with companies. Everything runs locally in your browser - no external servers, no data collection.

## Quick Start

### Chrome
1. Download this repository
2. Open `chrome://extensions/`
3. Enable "Developer mode" (top-right)
4. Click "Load unpacked"
5. Select the extension folder

### Firefox
1. Download this repository
2. Open `about:debugging#/runtime/this-firefox`
3. Click "Load Temporary Add-on"
4. Select `manifest.json`

## How to Use

1. Click the extension icon
2. Enter a domain (e.g., `example.com`)
3. Choose scan intensity:
   - **Low**: Quick scan, ~30 pages
   - **Medium**: Balanced, ~100 pages
   - **High**: Deep scan, ~500 pages
   - **ULTRA**: Maximum coverage, ~5000 pages
4. Click "Start Scan"
5. Wait for results (30 seconds to 10 minutes depending on mode)
6. Copy individual emails or export all as CSV

## Features

- **Fast scanning**: Processes multiple pages efficiently
- **Live updates**: See emails as they're discovered
- **Email verification**: Check if addresses are valid via DNS
- **Smart filtering**: Removes spam/fake addresses automatically
- **Export options**: Copy all or download as CSV
- **Privacy-first**: All processing happens in your browser
- **No tracking**: Zero analytics, zero data collection

## Scan Modes

| Mode   | Pages | Time    | Best For          |
|--------|-------|---------|-------------------|
| Low    | 30    | ~30s    | Small sites       |
| Medium | 100   | ~2min   | Most websites     |
| High   | 500   | ~10min  | Large companies   |
| ULTRA  | 5000  | ~30min  | Maximum coverage  |

## What Gets Scanned

The extension looks for emails in common places:
- Contact pages
- About pages  
- Team/staff pages
- Support pages
- Hidden in page source
- JavaScript variables
- Meta tags

## Privacy

- All scanning happens in **your browser**
- No data sent to external servers
- Results stored locally only
- You can delete everything anytime
- Open source - audit the code yourself

## Technical Details

### How It Works

1. Fetches web pages from target domain
2. Extracts text and HTML content
3. Searches for email patterns using regex
4. Validates emails (format, domain, DNS)
5. Filters out fake/spam addresses
6. Displays results in clean interface

### Resource Usage

**Small scan (Low mode):**
- ~30 pages scanned
- ~50 MB bandwidth
- 30-60 seconds

**Large scan (High mode):**
- ~500 pages scanned
- ~200 MB bandwidth
- 5-15 minutes

### Limitations

- Some sites block automated access (CORS, Cloudflare)
- Heavy JavaScript sites may hide emails
- Rate limiting may slow down scans
- Universities/government sites often block requests

## Troubleshooting

**No emails found?**
- Try a higher scan mode
- Some sites genuinely don't list emails publicly
- Check if the site is accessible in normal browser

**Scan stuck/slow?**
- Site may be blocking requests
- Try lower scan mode
- Check your internet connection

**Extension won't load?**
- Make sure Developer mode is enabled
- Check browser console for errors
- Restart browser and try again

## Use Responsibly

This tool finds **public information only**. Please:
- Respect website terms of service
- Don't overwhelm small sites
- Follow anti-spam laws (CAN-SPAM, GDPR)
- Use found emails ethically
- Don't scrape sites without permission

## File Structure
```
hunterkiller-extension/
├── manifest.json       # Extension configuration
├── popup.html         # User interface
├── css/
│   └── popup.css      # Styling
├── js/
│   ├── popup.js       # UI logic
│   └── background.js  # Scanning engine
├── icon16.png         # Extension icon (small)
├── icon48.png         # Extension icon (medium)
└── icon128.png        # Extension icon (large)
```

## Development

Built with:
- Vanilla JavaScript (no frameworks)
- Chrome Extension Manifest V3
- Modern CSS (flexbox, animations)

Want to contribute? Pull requests welcome!

## Known Issues

- Cardiff.ac.uk and similar high-security sites may block requests
- Some university sites have aggressive bot protection
- Very large scans (ULTRA mode) can take 30+ minutes

## Changelog

### v6.0.0 (Current)
- Removed category tabs for cleaner UI
- Improved extraction with better headers
- Added 40+ common paths to scan
- Increased page limits (Low: 50, Medium: 150)
- Added custom icons
- Better error handling
- Live email feed during scan

### v5.0.0
- Initial release

## License

MIT License - free to use, modify, and distribute.

## Support

Found a bug? Have a suggestion?
- Open an issue on GitHub
- Check existing issues first
- Provide details (browser, domain tested, error messages)

---

**Note**: This tool is for legitimate use only. Always comply with applicable laws and website policies.
