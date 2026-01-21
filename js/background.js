// HunterKiller - v6 Improved
// Better headers, more paths, smarter extraction

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
        console.log('📨 Background received:', request);
        
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
            console.error('❌ Error:', error);
            sendResponse({ error: error.message });
        }
    }

    async startScan(config, sendResponse) {
        const scanId = Date.now().toString();
        const scanner = new DomainScanner(scanId, config);
        
        this.activeScans.set(scanId, scanner);
        
        scanner.start().catch(error => {
            console.error('❌ Scan error:', error);
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
            allEmails: Array.from(scanner.allEmails),
            pagesScanned: scanner.visitedUrls.size,
            timeElapsed: scanner.getElapsedTime(),
            error: scanner.error
        };
    }
}

class DomainScanner {
    constructor(scanId, config) {
        this.scanId = scanId;
        this.targetDomain = config.domain;
        this.scanMode = config.scanMode || 'low';
        
        // IMPROVED SCAN MODES - More pages!
        const modeConfig = {
            low: { maxDepth: 2, maxPages: 50, delay: 150 },      // Was 30
            medium: { maxDepth: 3, maxPages: 150, delay: 200 },  // Was 100
            high: { maxDepth: 5, maxPages: 500, delay: 300 },    // Same
            ultra: { maxDepth: 8, maxPages: 5000, delay: 400 }   // Same
        };
        
        const cfg = modeConfig[this.scanMode];
        this.maxDepth = cfg.maxDepth;
        this.maxPages = cfg.maxPages;
        this.requestDelay = cfg.delay;
        
        this.allEmails = new Set();
        this.visitedUrls = new Set();
        this.queue = [];
        
        this.status = 'running';
        this.progress = 0;
        this.currentAction = 'Initializing';
        this.startTime = Date.now();
        this.error = null;

        // EMAIL PATTERNS
        this.emailPatterns = [
            /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi,
            /mailto:([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,})/gi,
            /[A-Za-z0-9._%+-]+\s*\[\s*at\s*\]\s*[A-Za-z0-9.-]+\s*\[\s*dot\s*\]\s*[A-Z|a-z]{2,}/gi,
            /[A-Za-z0-9._%+-]+\s*\(\s*at\s*\)\s*[A-Za-z0-9.-]+\s*\(\s*dot\s*\)\s*[A-Z|a-z]{2,}/gi
        ];

        this.invalidPatterns = [
            /^(example|test|sample|demo|dummy|user|admin|placeholder)@/i,
            /@(example\.com|test\.com|domain\.com|email\.com|localhost)$/i,
            /\.(png|jpg|jpeg|gif|svg|css|js|json|xml|pdf|doc|zip|mp4)$/i,
            /^(no-?reply|noreply|bounce|mailer-daemon)@/i,
            /@(sentry|analytics|tracking)/i,
            /@[a-z]{1,2}\.[a-z]{2}$/i,
            /^.{1,2}@/
        ];
    }

    getElapsedTime() {
        return Math.floor((Date.now() - this.startTime) / 1000);
    }

    async start() {
        try {
            this.currentAction = `Starting ${this.scanMode.toUpperCase()} scan`;
            this.progress = 5;

            await this.crawlWebsite();
            this.progress = 90;

            this.progress = 100;
            this.status = 'completed';
            
            const totalEmails = this.allEmails.size;
            this.currentAction = `Completed - Found ${totalEmails} emails`;
            
            console.log('✅ Scan completed:', {
                totalEmails,
                pagesScanned: this.visitedUrls.size,
                duration: this.getElapsedTime() + 's'
            });

        } catch (error) {
            console.error('❌ Scan error:', error);
            this.status = 'error';
            this.error = error.message;
        }
    }

    async crawlWebsite() {
        const baseUrl = `https://${this.targetDomain}`;
        
        // IMPROVED PATHS - More comprehensive!
        const commonPaths = [
            // Homepage
            '/',
            
            // Contact pages
            '/contact', '/contact-us', '/contactus', '/get-in-touch',
            '/contact-form', '/reach-us', '/email-us',
            
            // About pages
            '/about', '/about-us', '/aboutus', '/company',
            '/our-story', '/who-we-are',
            
            // People pages
            '/team', '/people', '/staff', '/faculty', '/leadership',
            '/management', '/executives', '/directors', '/board',
            '/our-team', '/meet-the-team',
            
            // Press/Media
            '/press', '/media', '/newsroom', '/news',
            '/press-releases', '/media-kit', '/press-contacts',
            
            // Investor Relations
            '/investors', '/investor-relations', '/ir',
            '/shareholders', '/investor-contacts',
            
            // Career/Jobs
            '/careers', '/jobs', '/opportunities', '/work-with-us',
            '/hiring', '/join-us',
            
            // Support
            '/support', '/help', '/customer-service', '/customer-support',
            '/help-center', '/faq', '/contact-support',
            
            // Legal/Privacy
            '/legal', '/privacy', '/terms', '/policies',
            
            // Other
            '/directory', '/locations', '/offices', '/branches',
            '/partners', '/affiliates', '/dealers', '/stores'
        ];
        
        this.queue = commonPaths.map(path => ({
            url: baseUrl + path,
            depth: 0
        }));

        while (this.queue.length > 0 && this.visitedUrls.size < this.maxPages) {
            const { url, depth } = this.queue.shift();
            
            if (this.visitedUrls.has(url) || depth > this.maxDepth) {
                continue;
            }

            await this.crawlPage(url, depth);
            
            const baseProgress = 10;
            const crawlProgress = (this.visitedUrls.size / this.maxPages * 80);
            this.progress = Math.min(baseProgress + crawlProgress, 90);
        }
    }

    async crawlPage(url, depth) {
        if (this.visitedUrls.has(url)) return;
        
        this.visitedUrls.add(url);
        this.currentAction = `Scanning (${this.visitedUrls.size}/${this.maxPages})`;

        try {
            // IMPROVED HEADERS - More realistic!
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'DNT': '1',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1',
                    'Sec-Fetch-Dest': 'document',
                    'Sec-Fetch-Mode': 'navigate',
                    'Sec-Fetch-Site': 'none',
                    'Cache-Control': 'max-age=0'
                }
            });

            if (!response.ok) {
                // Don't log every 404, only if it's not common
                if (response.status !== 404) {
                    console.warn(`⚠️ ${url} returned ${response.status}`);
                }
                return;
            }

            const contentType = response.headers.get('content-type') || '';
            if (!contentType.includes('text/html')) {
                return; // Skip non-HTML
            }

            const html = await response.text();
            
            // Extract emails
            this.extractEmails(html);
            this.extractFromJavaScript(html);
            this.extractFromMetaTags(html);

            // Extract links
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
            // Silently fail, don't spam console
            if (error.message !== 'Failed to fetch') {
                console.error(`❌ ${url}:`, error.message);
            }
        }
    }

    extractEmails(text) {
        this.emailPatterns.forEach(pattern => {
            const matches = text.matchAll(new RegExp(pattern));
            for (const match of matches) {
                let email = match[1] || match[0];
                email = this.cleanEmail(email);
                
                if (this.isValidEmail(email) && !this.allEmails.has(email)) {
                    this.allEmails.add(email);
                    console.log(`📧 Found: ${email}`);
                }
            }
        });
    }

    extractFromJavaScript(html) {
        const jsEmailPattern = /['"]([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})['"]/g;
        const matches = html.matchAll(jsEmailPattern);
        
        for (const match of matches) {
            const email = this.cleanEmail(match[1]);
            if (this.isValidEmail(email) && !this.allEmails.has(email)) {
                this.allEmails.add(email);
                console.log(`📧 Found (JS): ${email}`);
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
        const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$/;
        if (!emailRegex.test(email)) return false;

        for (const pattern of this.invalidPatterns) {
            if (pattern.test(email)) return false;
        }

        if (email.length < 6 || email.length > 254) return false;

        const parts = email.split('@');
        if (parts.length !== 2) return false;

        const [localPart, domain] = parts;
        if (localPart.length < 3) return false;
        if (domain.length < 4) return false;
        if (!domain.includes('.')) return false;
        if (email.includes('..')) return false;

        return true;
    }

    extractLinks(html, baseUrl) {
        const links = new Set();
        const linkPattern = /<a[^>]+href=["']([^"']+)["']/gi;
        const matches = html.matchAll(linkPattern);

        const baseDomain = new URL(baseUrl).hostname;

        for (const match of matches) {
            try {
                const href = match[1];
                
                // Skip anchors, javascript, mailto
                if (href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:')) {
                    continue;
                }
                
                const absoluteUrl = new URL(href, baseUrl).href;
                const parsedUrl = new URL(absoluteUrl);

                // Only same domain, https only
                if (parsedUrl.hostname === baseDomain && parsedUrl.protocol === 'https:') {
                    // Remove query params and hash for deduplication
                    const cleanUrl = parsedUrl.origin + parsedUrl.pathname;
                    links.add(cleanUrl);
                }
            } catch (error) {
                // Invalid URL, skip
            }
        }

        return Array.from(links);
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Initialize
const hunterKiller = new HunterKiller();
console.log('🎯 HunterKiller v6 Improved');
console.log('✅ Better headers, more paths, smarter extraction');
