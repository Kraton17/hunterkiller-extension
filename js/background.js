// HunterKiller Background Service Worker
// IMPROVED EMAIL DETECTION FOR kristujayanti.edu.in

// Get browser API (works in both Chrome and Firefox)
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

class HunterKiller {
    constructor() {
        this.activeScans = new Map();
        this.setupListeners();
    }

    setupListeners() {
        browserAPI.runtime.onMessage.addListener((request, sender, sendResponse) => {
            this.handleMessage(request, sender, sendResponse);
            return true; // Keep channel open for async
        });
    }

    async handleMessage(request, sender, sendResponse) {
        console.log('Background received message:', request);
        
        const { action, data } = request;

        try {
            switch (action) {
                case 'startScan':
                    await this.startScan(data, sendResponse);
                    break;
                case 'getScanStatus':
                    sendResponse(this.getScanStatus(data.scanId));
                    break;
                default:
                    sendResponse({ error: 'Unknown action' });
            }
        } catch (error) {
            console.error('Message handler error:', error);
            sendResponse({ error: error.message });
        }
    }

    async startScan(config, sendResponse) {
        const scanId = Date.now().toString();
        const scanner = new DomainScanner(scanId, config);
        
        this.activeScans.set(scanId, scanner);
        
        // Start scanning
        scanner.start().catch(error => {
            console.error('Scan error:', error);
            scanner.status = 'error';
            scanner.error = error.message;
        });

        sendResponse({ 
            success: true, 
            scanId,
            message: 'Scan started'
        });
    }

    getScanStatus(scanId) {
        const scanner = this.activeScans.get(scanId);
        
        if (!scanner) {
            return { error: 'Scan not found' };
        }

        return {
            scanId,
            status: scanner.status,
            progress: scanner.progress,
            currentAction: scanner.currentAction,
            emails: Array.from(scanner.emails),
            phones: Array.from(scanner.phones),
            pagesScanned: scanner.visitedUrls.size,
            timeElapsed: scanner.getElapsedTime()
        };
    }
}

class DomainScanner {
    constructor(scanId, config) {
        this.scanId = scanId;
        this.domain = config.domain;
        this.maxDepth = config.maxDepth || 3;
        this.maxPages = config.maxPages || 100;
        this.techniques = config.techniques || [];
        
        this.emails = new Set();
        this.phones = new Set();
        this.visitedUrls = new Set();
        this.queue = [];
        
        this.status = 'running';
        this.progress = 0;
        this.currentAction = 'Initializing...';
        this.startTime = Date.now();

        // IMPROVED EMAIL PATTERNS - More aggressive
        this.emailPatterns = [
            // Standard email
            /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi,
            // Mailto links
            /mailto:([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,})/gi,
            // Obfuscated with [at] and [dot]
            /[A-Za-z0-9._%+-]+\s*\[\s*at\s*\]\s*[A-Za-z0-9.-]+\s*\[\s*dot\s*\]\s*[A-Z|a-z]{2,}/gi,
            // Obfuscated with (at) and (dot)
            /[A-Za-z0-9._%+-]+\s*\(\s*at\s*\)\s*[A-Za-z0-9.-]+\s*\(\s*dot\s*\)\s*[A-Z|a-z]{2,}/gi,
            // With spaces around @
            /[A-Za-z0-9._%+-]+\s+@\s+[A-Za-z0-9.-]+\s+\.\s+[A-Z|a-z]{2,}/gi,
            // JavaScript encoded
            /[A-Za-z0-9._%+-]+%40[A-Za-z0-9.-]+%2E[A-Z|a-z]{2,}/gi,
            // HTML entities
            /[A-Za-z0-9._%+-]+&#64;[A-Za-z0-9.-]+&#46;[A-Z|a-z]{2,}/gi
        ];

        this.phonePatterns = [
            /\+?1?\s*\(?(\d{3})\)?[-.\s]?(\d{3})[-.\s]?(\d{4})/g,
            /\+(\d{1,3})\s*\(?(\d{1,4})\)?[-.\s]?(\d{1,4})[-.\s]?(\d{4,})/g,
            /(\d{10})/g
        ];
    }

    async start() {
        try {
            this.currentAction = 'Starting scan...';
            this.progress = 5;

            // Quick methods first
            if (this.techniques.includes('dns')) {
                await this.dnsLookup();
            }
            this.progress = 15;

            if (this.techniques.includes('whois')) {
                await this.whoisLookup();
            }
            this.progress = 25;

            // Deep crawl - MAIN METHOD
            if (this.techniques.includes('crawl')) {
                await this.crawlWebsite();
            }
            this.progress = 90;

            // Additional methods
            if (this.techniques.includes('pdf')) {
                await this.extractFromPDFs();
            }

            if (this.techniques.includes('verify')) {
                await this.verifyEmails();
            }

            this.progress = 100;
            this.status = 'completed';
            this.currentAction = `Completed! Found ${this.emails.size} emails`;
            
            console.log('Scan completed:', {
                emails: Array.from(this.emails),
                phones: Array.from(this.phones),
                pages: this.visitedUrls.size
            });

        } catch (error) {
            console.error('Scan error:', error);
            this.status = 'error';
            this.currentAction = `Error: ${error.message}`;
            this.error = error.message;
        }
    }

    getElapsedTime() {
        return Math.floor((Date.now() - this.startTime) / 1000);
    }

    async dnsLookup() {
        this.currentAction = 'DNS lookup...';
        try {
            const response = await fetch(`https://dns.google/resolve?name=${this.domain}&type=TXT`);
            const data = await response.json();
            
            if (data.Answer) {
                data.Answer.forEach(record => {
                    if (record.data) {
                        this.extractEmails(record.data);
                    }
                });
            }
        } catch (error) {
            console.log('DNS lookup failed:', error);
        }
    }

    async whoisLookup() {
        this.currentAction = 'WHOIS lookup...';
        // Note: WHOIS API requires key, skipping for now
        console.log('WHOIS lookup skipped (requires API key)');
    }

    async crawlWebsite() {
        this.currentAction = 'Crawling website...';
        
        const baseUrl = `https://${this.domain}`;
        
        // Start with homepage
        this.queue = [{ url: baseUrl, depth: 0 }];

        // Add common contact pages - IMPORTANT for finding emails
        const commonPaths = [
            '/',
            '/contact',
            '/contact-us',
            '/contactus',
            '/about',
            '/about-us',
            '/team',
            '/people',
            '/staff',
            '/faculty',
            '/administration',
            '/leadership',
            '/careers',
            '/support',
            '/help',
            '/info',
            '/email',
            '/directory'
        ];
        
        commonPaths.forEach(path => {
            this.queue.push({ url: baseUrl + path, depth: 0 });
        });

        while (this.queue.length > 0 && this.visitedUrls.size < this.maxPages) {
            const { url, depth } = this.queue.shift();
            
            if (this.visitedUrls.has(url) || depth > this.maxDepth) {
                continue;
            }

            await this.crawlPage(url, depth);
            
            // Update progress
            this.progress = 25 + (this.visitedUrls.size / this.maxPages * 65);
        }
    }

    async crawlPage(url, depth) {
        if (this.visitedUrls.has(url)) return;
        
        this.visitedUrls.add(url);
        this.currentAction = `Scanning: ${new URL(url).pathname}`;

        console.log('Crawling:', url);

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            if (!response.ok) {
                console.log(`Failed to fetch ${url}:`, response.status);
                return;
            }

            const html = await response.text();
            
            console.log(`Fetched ${url}, length: ${html.length}`);
            
            // Extract emails and phones - AGGRESSIVE
            this.extractEmails(html);
            this.extractPhones(html);
            
            // Also check for JavaScript variables containing emails
            this.extractFromJavaScript(html);
            
            // Also check meta tags
            this.extractFromMetaTags(html);

            // Find more links if not at max depth
            if (depth < this.maxDepth) {
                const links = this.extractLinks(html, url);
                links.forEach(link => {
                    if (!this.visitedUrls.has(link) && this.visitedUrls.size < this.maxPages) {
                        this.queue.push({ url: link, depth: depth + 1 });
                    }
                });
            }

            // Small delay
            await this.delay(300);

        } catch (error) {
            console.error(`Error crawling ${url}:`, error);
        }
    }

    extractEmails(text) {
        this.emailPatterns.forEach(pattern => {
            const matches = text.matchAll(new RegExp(pattern));
            for (const match of matches) {
                let email = match[1] || match[0];
                email = this.cleanEmail(email);
                
                if (this.isValidEmail(email)) {
                    // Don't filter by domain for debugging
                    this.emails.add(email.toLowerCase());
                    console.log('Found email:', email);
                }
            }
        });
    }

    extractFromJavaScript(html) {
        // Look for emails in JavaScript variables
        const jsEmailPattern = /['"]([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})['"]/g;
        const matches = html.matchAll(jsEmailPattern);
        
        for (const match of matches) {
            const email = this.cleanEmail(match[1]);
            if (this.isValidEmail(email)) {
                this.emails.add(email.toLowerCase());
                console.log('Found email in JS:', email);
            }
        }
    }

    extractFromMetaTags(html) {
        // Extract from meta tags
        const metaPattern = /<meta[^>]+content=["']([^"']*@[^"']*)["'][^>]*>/gi;
        const matches = html.matchAll(metaPattern);
        
        for (const match of matches) {
            this.extractEmails(match[1]);
        }
    }

    cleanEmail(email) {
        email = email.trim();
        email = email.replace(/\[at\]/gi, '@');
        email = email.replace(/\(at\)/gi, '@');
        email = email.replace(/\s+at\s+/gi, '@');
        email = email.replace(/\[dot\]/gi, '.');
        email = email.replace(/\(dot\)/gi, '.');
        email = email.replace(/\s+dot\s+/gi, '.');
        email = email.replace(/\s+/g, '');
        email = email.replace(/%40/g, '@');
        email = email.replace(/%2E/gi, '.');
        email = email.replace(/&#64;/g, '@');
        email = email.replace(/&#46;/g, '.');
        return email;
    }

    isValidEmail(email) {
        const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$/;
        return emailRegex.test(email) && 
               !email.includes('noreply') && 
               !email.includes('no-reply') &&
               !email.includes('example.com') &&
               !email.includes('test@') &&
               !email.includes('admin@localhost');
    }

    extractPhones(text) {
        this.phonePatterns.forEach(pattern => {
            const matches = text.matchAll(new RegExp(pattern));
            for (const match of matches) {
                const phone = match[0].trim();
                if (phone.length >= 10) {
                    this.phones.add(phone);
                }
            }
        });
    }

    extractLinks(html, baseUrl) {
        const links = [];
        const linkPattern = /<a[^>]+href=["']([^"']+)["']/gi;
        const matches = html.matchAll(linkPattern);

        for (const match of matches) {
            try {
                const href = match[1];
                const absoluteUrl = new URL(href, baseUrl).href;
                const parsedUrl = new URL(absoluteUrl);
                const baseDomain = new URL(baseUrl).hostname;

                // Only follow links on same domain
                if (parsedUrl.hostname === baseDomain) {
                    links.push(absoluteUrl);
                }
            } catch (error) {
                // Invalid URL, skip
            }
        }

        return links;
    }

    async extractFromPDFs() {
        this.currentAction = 'Extracting from PDFs...';
        console.log('PDF extraction not fully implemented yet');
    }

    async verifyEmails() {
        this.currentAction = 'Verifying emails...';
        console.log('Email verification not fully implemented yet');
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Initialize
const hunterKiller = new HunterKiller();
console.log('HunterKiller background service initialized');
