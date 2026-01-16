// HunterKiller v3.0 - Background Scanner Engine
// SIMPLIFIED: Web Crawl + Email Verify + Social Media (optional)
// Removed: DNS, WHOIS, PDF extraction

const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

class HunterKiller {
    constructor() {
        this.activeScans = new Map();
        this.setupListeners();
    }

    setupListeners() {
        browserAPI.runtime.onMessage.addListener((request, sender, sendResponse) => {
            this.handleMessage(request, sender, sendResponse);
            return true;
        });
    }

    async handleMessage(request, sender, sendResponse) {
        console.log('Background received:', request);
        
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
        
        scanner.start().catch(error => {
            console.error('Scan error:', error);
            scanner.status = 'error';
            scanner.error = error.message;
        });

        sendResponse({ 
            success: true, 
            scanId,
            message: 'Scan started in ' + config.scanMode + ' mode'
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
            domainEmails: Array.from(scanner.domainEmails),
            externalEmails: Array.from(scanner.externalEmails),
            socialLinks: scanner.socialLinks,
            pagesScanned: scanner.visitedUrls.size,
            timeElapsed: scanner.getElapsedTime(),
            scanInfo: scanner.scanInfo
        };
    }
}

class DomainScanner {
    constructor(scanId, config) {
        this.scanId = scanId;
        this.targetDomain = config.domain;
        this.scanMode = config.scanMode || 'low';
        this.verifyEmails = config.verifyEmails !== false;
        this.extractSocial = config.extractSocial || false;
        
        // Extract base domain for smart matching
        this.baseDomainName = this.extractBaseDomainName(this.targetDomain);
        
        // Mode configurations
        const modeConfig = {
            low: { maxDepth: 2, maxPages: 30, delay: 200 },
            medium: { maxDepth: 3, maxPages: 100, delay: 300 },
            high: { maxDepth: 5, maxPages: 500, delay: 400 }
        };
        
        const cfg = modeConfig[this.scanMode];
        this.maxDepth = cfg.maxDepth;
        this.maxPages = cfg.maxPages;
        this.requestDelay = cfg.delay;
        
        // Email storage - categorized
        this.domainEmails = new Set();
        this.externalEmails = new Set();
        this.socialLinks = [];
        
        this.visitedUrls = new Set();
        this.queue = [];
        
        this.status = 'running';
        this.progress = 0;
        this.currentAction = 'Initializing';
        this.startTime = Date.now();
        
        // Scan info
        this.scanInfo = {
            ip: null,
            registrar: null,
            pagesScanned: 0,
            duration: null
        };

        // EMAIL PATTERNS
        this.emailPatterns = [
            /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi,
            /mailto:([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,})/gi,
            /[A-Za-z0-9._%+-]+\s*\[\s*at\s*\]\s*[A-Za-z0-9.-]+\s*\[\s*dot\s*\]\s*[A-Z|a-z]{2,}/gi,
            /[A-Za-z0-9._%+-]+\s*\(\s*at\s*\)\s*[A-Za-z0-9.-]+\s*\(\s*dot\s*\)\s*[A-Z|a-z]{2,}/gi,
            /[A-Za-z0-9._%+-]+%40[A-Za-z0-9.-]+%2E[A-Z|a-z]{2,}/gi,
            /[A-Za-z0-9._%+-]+&#64;[A-Za-z0-9.-]+&#46;[A-Z|a-z]{2,}/gi
        ];

        // STRICT FALSE POSITIVE FILTERS
        this.invalidPatterns = [
            /^(example|test|sample|demo|dummy|user|admin)@/i,
            /@(example\.com|test\.com|domain\.com|email\.com|localhost)$/i,
            /\.(png|jpg|jpeg|gif|svg|css|js|json|xml|pdf|doc|zip)$/i,
            /^(no-?reply|do-?not-?reply|noreply|donotreply|bounce|mailer-daemon)@/i,
            /@(sentry|bugsnag|rollbar|datadog|segment|analytics)/i,
            /^(wix|squarespace|wordpress|shopify|weebly|jimdo)@/i,
            /@[a-z]{1,2}\.[a-z]{2}$/i,
            /^.{1,2}@/,
            /@.{1,2}\./
        ];

        // SOCIAL MEDIA PATTERNS
        this.socialPatterns = {
            facebook: /(?:https?:\/\/)?(?:www\.)?facebook\.com\/[a-zA-Z0-9.]+/gi,
            twitter: /(?:https?:\/\/)?(?:www\.)?(?:twitter|x)\.com\/[a-zA-Z0-9_]+/gi,
            linkedin: /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/(?:in|company)\/[a-zA-Z0-9-]+/gi,
            instagram: /(?:https?:\/\/)?(?:www\.)?instagram\.com\/[a-zA-Z0-9._]+/gi,
            youtube: /(?:https?:\/\/)?(?:www\.)?youtube\.com\/(?:c|channel|user)\/[a-zA-Z0-9_-]+/gi,
            github: /(?:https?:\/\/)?(?:www\.)?github\.com\/[a-zA-Z0-9-]+/gi
        };
    }

    extractBaseDomainName(domain) {
        const parts = domain.split('.');
        if (parts.length === 2) {
            return parts[0];
        }
        return parts[0];
    }

    async start() {
        try {
            this.currentAction = 'Starting ' + this.scanMode + ' mode scan';
            this.progress = 5;

            // Get domain IP
            await this.getDomainInfo();
            this.progress = 10;

            // Main web crawl (CORE METHOD)
            this.currentAction = 'Crawling website';
            await this.crawlWebsite();
            this.progress = 90;

            // Extract social media (if enabled)
            if (this.extractSocial) {
                this.currentAction = 'Extracting social profiles';
                this.extractSocialMedia();
            }

            this.progress = 100;
            this.status = 'completed';
            
            const totalEmails = this.domainEmails.size + this.externalEmails.size;
            this.currentAction = `Completed - Found ${totalEmails} emails`;
            
            // Update scan info
            this.scanInfo.pagesScanned = this.visitedUrls.size;
            this.scanInfo.duration = this.getElapsedTime() + 's';
            
            console.log('Scan completed:', {
                domainEmails: Array.from(this.domainEmails),
                externalEmails: Array.from(this.externalEmails),
                socialLinks: this.socialLinks,
                scanInfo: this.scanInfo
            });

        } catch (error) {
            console.error('Scan error:', error);
            this.status = 'error';
            this.currentAction = `Error: ${error.message}`;
            this.error = error.message;
        }
    }

    async getDomainInfo() {
        this.currentAction = 'Getting domain info';
        
        try {
            // Get IP address
            const ipResponse = await fetch(`https://dns.google/resolve?name=${this.targetDomain}&type=A`);
            const ipData = await ipResponse.json();
            
            if (ipData.Answer && ipData.Answer.length > 0) {
                this.scanInfo.ip = ipData.Answer[0].data;
                console.log('Domain IP:', this.scanInfo.ip);
            }
            
            // Set default registrar
            this.scanInfo.registrar = 'Unknown (DNS only)';
            
        } catch (error) {
            console.log('Failed to get IP:', error);
        }
    }

    getElapsedTime() {
        return Math.floor((Date.now() - this.startTime) / 1000);
    }

    async crawlWebsite() {
        this.currentAction = 'Crawling website';
        
        const baseUrl = `https://${this.targetDomain}`;
        
        this.queue = [{ url: baseUrl, depth: 0 }];

        // Common contact pages
        const commonPaths = [
            '/', '/contact', '/contact-us', '/contactus', '/about', '/about-us',
            '/team', '/people', '/staff', '/faculty', '/administration',
            '/leadership', '/careers', '/support', '/help', '/directory'
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
            
            this.progress = 10 + (this.visitedUrls.size / this.maxPages * 80);
        }
    }

    async crawlPage(url, depth) {
        if (this.visitedUrls.has(url)) return;
        
        this.visitedUrls.add(url);
        this.currentAction = `Scanning: ${new URL(url).pathname}`;

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            if (!response.ok) {
                return;
            }

            const html = await response.text();
            
            // Extract emails
            this.extractEmails(html);
            this.extractFromJavaScript(html);
            this.extractFromMetaTags(html);
            
            // Extract social media (if enabled)
            if (this.extractSocial) {
                this.extractSocialFromPage(html);
            }

            // Find more links
            if (depth < this.maxDepth) {
                const links = this.extractLinks(html, url);
                links.forEach(link => {
                    if (!this.visitedUrls.has(link) && this.visitedUrls.size < this.maxPages) {
                        this.queue.push({ url: link, depth: depth + 1 });
                    }
                });
            }

            await this.delay(this.requestDelay);

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
                    this.categorizeEmail(email);
                }
            }
        });
    }

    extractFromJavaScript(html) {
        const jsEmailPattern = /['"]([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})['"]/g;
        const matches = html.matchAll(jsEmailPattern);
        
        for (const match of matches) {
            const email = this.cleanEmail(match[1]);
            if (this.isValidEmail(email)) {
                this.categorizeEmail(email);
            }
        }
    }

    extractFromMetaTags(html) {
        const metaPattern = /<meta[^>]+content=["']([^"']*@[^"']*)["'][^>]*>/gi;
        const matches = html.matchAll(metaPattern);
        
        for (const match of matches) {
            this.extractEmails(match[1]);
        }
    }

    extractSocialFromPage(html) {
        Object.entries(this.socialPatterns).forEach(([platform, pattern]) => {
            const matches = html.matchAll(pattern);
            for (const match of matches) {
                const url = match[0];
                if (!this.socialLinks.find(s => s.url === url)) {
                    this.socialLinks.push({
                        platform: platform.charAt(0).toUpperCase() + platform.slice(1),
                        url: url
                    });
                }
            }
        });
    }

    extractSocialMedia() {
        this.currentAction = `Found ${this.socialLinks.length} social profiles`;
    }

    cleanEmail(email) {
        email = email.trim().toLowerCase();
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
        // Basic format check
        const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$/;
        if (!emailRegex.test(email)) {
            return false;
        }

        // Check against false positive patterns
        for (const pattern of this.invalidPatterns) {
            if (pattern.test(email)) {
                console.log('Rejected false positive:', email);
                return false;
            }
        }

        // Strict validation
        if (email.length < 6 || email.length > 254) {
            return false;
        }

        const parts = email.split('@');
        if (parts.length !== 2) {
            return false;
        }

        const [localPart, domain] = parts;
        
        // Local part must be at least 3 characters
        if (localPart.length < 3) {
            console.log('Rejected (local part too short):', email);
            return false;
        }

        // Domain validation
        if (domain.length < 4) {
            console.log('Rejected (domain too short):', email);
            return false;
        }

        // Must have at least one dot
        if (!domain.includes('.')) {
            return false;
        }

        // Check for consecutive dots
        if (email.includes('..')) {
            return false;
        }

        // TLD must be at least 2 characters
        const domainParts = domain.split('.');
        const tld = domainParts[domainParts.length - 1];
        if (tld.length < 2) {
            console.log('Rejected (TLD too short):', email);
            return false;
        }

        return true;
    }

    categorizeEmail(email) {
        const emailDomain = email.split('@')[1];
        
        // SMART DOMAIN MATCHING
        // Direct match
        if (emailDomain === this.targetDomain || emailDomain.endsWith('.' + this.targetDomain)) {
            this.domainEmails.add(email);
            console.log('Domain email (exact match):', email);
            return;
        }
        
        // Smart match - check if base domain name appears
        if (emailDomain.includes(this.baseDomainName)) {
            this.domainEmails.add(email);
            console.log('Domain email (smart match):', email);
            return;
        }
        
        // External
        this.externalEmails.add(email);
        console.log('External email:', email);
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

                if (parsedUrl.hostname === baseDomain) {
                    links.push(absoluteUrl);
                }
            } catch (error) {
                // Invalid URL, skip
            }
        }

        return links;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Initialize
const hunterKiller = new HunterKiller();
console.log('HunterKiller v3.0 background service initialized');
console.log('Methods: Web Crawl + Email Verify + Social Media (optional)');
