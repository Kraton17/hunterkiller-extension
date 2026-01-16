
class PopupController {
    constructor() {
        this.scanId = null;
        this.scanInterval = null;
        this.startTime = null;
        
        this.init();
    }

    init() {
        this.cacheElements();
        this.attachListeners();
        this.autoDetectDomain();
        this.loadSettings();
    }

    cacheElements() {
        // Inputs
        this.domainInput = document.getElementById('domain');
        this.depthSelect = document.getElementById('depth');
        this.maxPagesSelect = document.getElementById('maxPages');
        
        // Buttons
        this.autoDetectBtn = document.getElementById('autoDetect');
        this.scanBtn = document.getElementById('scanBtn');
        this.settingsBtn = document.getElementById('settingsBtn');
        this.closeSettingsBtn = document.getElementById('closeSettings');
        this.saveSettingsBtn = document.getElementById('saveSettings');
        this.copyAllBtn = document.getElementById('copyAll');
        this.exportCSVBtn = document.getElementById('exportCSV');
        this.clearResultsBtn = document.getElementById('clearResults');
        
        // Method checkboxes
        this.methodInputs = document.querySelectorAll('input[name="method"]');
        
        // Progress
        this.progressContainer = document.getElementById('progress');
        this.progressFill = document.getElementById('progressFill');
        this.progressPercent = document.getElementById('progressPercent');
        this.progressStatus = document.getElementById('progressStatus');
        this.emailsStat = document.getElementById('emailsStat');
        this.pagesStat = document.getElementById('pagesStat');
        this.timeStat = document.getElementById('timeStat');
        
        // Results
        this.resultsContainer = document.getElementById('results');
        this.totalCount = document.getElementById('totalCount');
        this.resultsList = document.getElementById('resultsList');
        this.searchInput = document.getElementById('searchResults');
        
        // Settings
        this.settingsPanel = document.getElementById('settingsPanel');
        
        // Toast
        this.toast = document.getElementById('toast');
    }

    attachListeners() {
        // Auto-detect button
        this.autoDetectBtn.addEventListener('click', () => this.autoDetectDomain());
        
        // Scan button
        this.scanBtn.addEventListener('click', () => this.startScan());
        
        // Enter key on domain input
        this.domainInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.startScan();
        });
        
        // Method checkboxes - toggle checked class
        this.methodInputs.forEach(input => {
            input.addEventListener('change', (e) => {
                const label = e.target.closest('.method-item');
                if (e.target.checked) {
                    label.classList.add('checked');
                } else {
                    label.classList.remove('checked');
                }
            });
        });
        
        // Settings
        this.settingsBtn.addEventListener('click', () => this.openSettings());
        this.closeSettingsBtn.addEventListener('click', () => this.closeSettings());
        this.saveSettingsBtn.addEventListener('click', () => this.saveSettings());
        
        // Results actions
        this.copyAllBtn.addEventListener('click', () => this.copyAll());
        this.exportCSVBtn.addEventListener('click', () => this.exportCSV());
        this.clearResultsBtn.addEventListener('click', () => this.clearResults());
        
        // Search
        this.searchInput.addEventListener('input', (e) => this.filterResults(e.target.value));
    }

    // Auto-detect current website domain
    async autoDetectDomain() {
        try {
            // Get browser API (works in both Chrome and Firefox)
            const browserAPI = typeof browser !== 'undefined' ? browser : chrome;
            
            const tabs = await browserAPI.tabs.query({active: true, currentWindow: true});
            
            if (tabs[0] && tabs[0].url) {
                const url = new URL(tabs[0].url);
                const hostname = url.hostname;
                
                // Skip special URLs
                if (hostname && 
                    !hostname.includes('chrome://') && 
                    !hostname.includes('about:') &&
                    !hostname.includes('moz-extension://') &&
                    !hostname.includes('chrome-extension://')) {
                    
                    // Remove www.
                    const cleanDomain = hostname.replace(/^www\./, '');
                    this.domainInput.value = cleanDomain;
                    this.showToast('✓ Auto-detected: ' + cleanDomain);
                }
            }
        } catch (error) {
            console.error('Auto-detect failed:', error);
            this.showToast('⚠️ Could not auto-detect domain');
        }
    }

    // Start scan
    async startScan() {
        const domain = this.domainInput.value.trim();
        
        if (!domain) {
            this.showToast('⚠️ Please enter a domain');
            return;
        }
        
        // Get selected methods
        const selectedMethods = [];
        this.methodInputs.forEach(input => {
            if (input.checked) {
                selectedMethods.push(input.value);
            }
        });
        
        if (selectedMethods.length === 0) {
            this.showToast('⚠️ Select at least one method');
            return;
        }
        
        // Clean domain
        const cleanDomain = domain
            .replace(/^https?:\/\//, '')
            .replace(/^www\./, '')
            .replace(/\/$/, '');
        
        console.log('Starting scan:', {
            domain: cleanDomain,
            depth: parseInt(this.depthSelect.value),
            maxPages: parseInt(this.maxPagesSelect.value),
            methods: selectedMethods
        });
        
        // Update UI
        this.scanBtn.classList.add('scanning');
        this.scanBtn.innerHTML = '<span class="btn-icon">🔄</span><span class="btn-text">Scanning...</span>';
        this.scanBtn.disabled = true;
        
        // Show progress
        this.progressContainer.style.display = 'block';
        this.resultsContainer.style.display = 'none';
        
        this.startTime = Date.now();
        
        try {
            // Get browser API
            const browserAPI = typeof browser !== 'undefined' ? browser : chrome;
            
            // Send message to background script
            const response = await browserAPI.runtime.sendMessage({
                action: 'startScan',
                data: {
                    domain: cleanDomain,
                    maxDepth: parseInt(this.depthSelect.value),
                    maxPages: parseInt(this.maxPagesSelect.value),
                    techniques: selectedMethods
                }
            });
            
            console.log('Scan response:', response);
            
            if (response && response.success) {
                this.scanId = response.scanId;
                this.startPolling();
                this.showToast('🚀 Scan started!');
            } else {
                throw new Error(response?.error || 'Failed to start scan');
            }
            
        } catch (error) {
            console.error('Scan error:', error);
            this.showToast('❌ Error: ' + error.message);
            this.resetScanUI();
        }
    }

    // Poll scan status
    startPolling() {
        this.scanInterval = setInterval(async () => {
            try {
                const browserAPI = typeof browser !== 'undefined' ? browser : chrome;
                
                const status = await browserAPI.runtime.sendMessage({
                    action: 'getScanStatus',
                    data: { scanId: this.scanId }
                });
                
                console.log('Scan status:', status);
                
                if (status && !status.error) {
                    this.updateProgress(status);
                    
                    if (status.status === 'completed' || status.status === 'error') {
                        this.completeScan(status);
                    }
                }
                
            } catch (error) {
                console.error('Polling error:', error);
            }
        }, 1000);
    }

    // Update progress
    updateProgress(status) {
        // Update progress bar
        this.progressFill.style.width = status.progress + '%';
        this.progressPercent.textContent = Math.round(status.progress) + '%';
        
        // Update status text
        this.progressStatus.textContent = status.currentAction || 'Scanning...';
        
        // Update stats
        this.emailsStat.textContent = status.emails?.length || 0;
        this.pagesStat.textContent = status.pagesScanned || 0;
        
        // Update time
        const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
        this.timeStat.textContent = elapsed + 's';
    }

    // Complete scan
    completeScan(status) {
        clearInterval(this.scanInterval);
        this.resetScanUI();
        
        if (status.status === 'completed') {
            this.displayResults(status.emails || []);
            this.showToast(`✓ Found ${status.emails?.length || 0} emails!`);
        } else {
            this.showToast('❌ Scan failed: ' + (status.error || 'Unknown error'));
        }
        
        // Hide progress
        this.progressContainer.style.display = 'none';
    }

    // Display results
    displayResults(emails) {
        this.resultsContainer.style.display = 'block';
        this.totalCount.textContent = emails.length;
        this.resultsList.innerHTML = '';
        
        if (emails.length === 0) {
            this.resultsList.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-dim);">No emails found</div>';
            return;
        }
        
        emails.forEach(email => {
            const item = document.createElement('div');
            item.className = 'result-item';
            item.dataset.email = email;
            
            const emailSpan = document.createElement('span');
            emailSpan.className = 'result-email';
            emailSpan.textContent = email;
            
            const copyBtn = document.createElement('button');
            copyBtn.className = 'result-copy';
            copyBtn.textContent = 'Copy';
            copyBtn.addEventListener('click', () => this.copyEmail(email, copyBtn));
            
            item.appendChild(emailSpan);
            item.appendChild(copyBtn);
            this.resultsList.appendChild(item);
        });
        
        this.currentEmails = emails;
    }

    // Filter results
    filterResults(query) {
        const items = this.resultsList.querySelectorAll('.result-item');
        const lowerQuery = query.toLowerCase();
        
        items.forEach(item => {
            const email = item.dataset.email.toLowerCase();
            item.style.display = email.includes(lowerQuery) ? 'flex' : 'none';
        });
    }

    // Copy email
    async copyEmail(email, button) {
        try {
            await navigator.clipboard.writeText(email);
            button.textContent = '✓ Copied';
            button.style.background = 'var(--success)';
            button.style.borderColor = 'var(--success)';
            button.style.color = 'white';
            
            setTimeout(() => {
                button.textContent = 'Copy';
                button.style.background = '';
                button.style.borderColor = '';
                button.style.color = '';
            }, 2000);
        } catch (error) {
            console.error('Copy failed:', error);
            this.showToast('❌ Copy failed');
        }
    }

    // Copy all emails
    async copyAll() {
        if (!this.currentEmails || this.currentEmails.length === 0) {
            this.showToast('⚠️ No emails to copy');
            return;
        }
        
        try {
            const text = this.currentEmails.join('\n');
            await navigator.clipboard.writeText(text);
            this.showToast(`✓ Copied ${this.currentEmails.length} emails`);
        } catch (error) {
            console.error('Copy all failed:', error);
            this.showToast('❌ Copy failed');
        }
    }

    // Export CSV
    exportCSV() {
        if (!this.currentEmails || this.currentEmails.length === 0) {
            this.showToast('⚠️ No emails to export');
            return;
        }
        
        const csv = 'Email\n' + this.currentEmails.join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `hunterkiller-${this.domainInput.value}-${Date.now()}.csv`;
        a.click();
        
        URL.revokeObjectURL(url);
        this.showToast('✓ CSV exported');
    }

    // Clear results
    clearResults() {
        this.resultsContainer.style.display = 'none';
        this.resultsList.innerHTML = '';
        this.currentEmails = [];
        this.searchInput.value = '';
    }

    // Reset scan UI
    resetScanUI() {
        this.scanBtn.classList.remove('scanning');
        this.scanBtn.innerHTML = '<span class="btn-icon">🚀</span><span class="btn-text">Start Scan</span>';
        this.scanBtn.disabled = false;
    }

    // Settings
    openSettings() {
        this.settingsPanel.style.display = 'flex';
    }

    closeSettings() {
        this.settingsPanel.style.display = 'none';
    }

    async saveSettings() {
        const settings = {
            requestDelay: parseInt(document.getElementById('reqDelay').value) || 300,
            timeout: parseInt(document.getElementById('timeout').value) || 10,
            followRedirects: document.getElementById('followRedirects').checked,
            aggressiveMode: document.getElementById('aggressiveMode').checked
        };
        
        try {
            const browserAPI = typeof browser !== 'undefined' ? browser : chrome;
            await browserAPI.storage.local.set({ settings });
            this.showToast('✓ Settings saved');
            this.closeSettings();
        } catch (error) {
            console.error('Save settings failed:', error);
            this.showToast('❌ Failed to save settings');
        }
    }

    async loadSettings() {
        try {
            const browserAPI = typeof browser !== 'undefined' ? browser : chrome;
            const result = await browserAPI.storage.local.get('settings');
            
            if (result.settings) {
                const s = result.settings;
                if (document.getElementById('reqDelay')) document.getElementById('reqDelay').value = s.requestDelay || 300;
                if (document.getElementById('timeout')) document.getElementById('timeout').value = s.timeout || 10;
                if (document.getElementById('followRedirects')) document.getElementById('followRedirects').checked = s.followRedirects !== false;
                if (document.getElementById('aggressiveMode')) document.getElementById('aggressiveMode').checked = s.aggressiveMode || false;
            }
        } catch (error) {
            console.error('Load settings failed:', error);
        }
    }

    // Toast notification
    showToast(message) {
        this.toast.textContent = message;
        this.toast.classList.add('show');
        
        setTimeout(() => {
            this.toast.classList.remove('show');
        }, 3000);
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new PopupController());
} else {
    new PopupController();
}
