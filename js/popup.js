// HunterKiller - Clean Edition
// No tabs, no categories, just emails

class PopupController {
    constructor() {
        this.scanId = null;
        this.scanInterval = null;
        this.startTime = null;
        this.allEmails = [];
        this.streamedEmails = new Set();
        
        this.init();
    }

    init() {
        this.cacheElements();
        this.attachListeners();
        this.autoDetectDomain();
    }

    cacheElements() {
        // Inputs
        this.domainInput = document.getElementById('domain');
        this.scanModeInputs = document.querySelectorAll('input[name="scanMode"]');
        
        // Buttons
        this.autoDetectBtn = document.getElementById('autoDetect');
        this.scanBtn = document.getElementById('scanBtn');
        this.verifyAllBtn = document.getElementById('verifyAll');
        this.copyAllBtn = document.getElementById('copyAll');
        this.exportCSVBtn = document.getElementById('exportCSV');
        
        // Progress
        this.progressContainer = document.getElementById('progress');
        this.progressFill = document.getElementById('progressFill');
        this.progressPercent = document.getElementById('progressPercent');
        this.progressStatus = document.getElementById('progressStatus');
        this.emailsStat = document.getElementById('emailsStat');
        this.pagesStat = document.getElementById('pagesStat');
        this.timeStat = document.getElementById('timeStat');
        this.streamEmails = document.getElementById('streamEmails');
        
        // Results
        this.resultsContainer = document.getElementById('results');
        this.totalCount = document.getElementById('totalCount');
        this.emailList = document.getElementById('emailList');
        this.searchInput = document.getElementById('searchInput');
        
        // ULTRA Warning Modal
        this.ultraWarning = document.getElementById('ultraWarning');
        this.cancelUltra = document.getElementById('cancelUltra');
        this.confirmUltra = document.getElementById('confirmUltra');
        
        // Toast
        this.toast = document.getElementById('toast');
    }

    attachListeners() {
        this.autoDetectBtn.addEventListener('click', () => this.autoDetectDomain());
        this.scanBtn.addEventListener('click', () => this.handleScanClick());
        this.domainInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleScanClick();
        });
        
        // Results actions
        if (this.verifyAllBtn) this.verifyAllBtn.addEventListener('click', () => this.verifyAllEmails());
        if (this.copyAllBtn) this.copyAllBtn.addEventListener('click', () => this.copyAll());
        if (this.exportCSVBtn) this.exportCSVBtn.addEventListener('click', () => this.exportCSV());
        
        // ULTRA Modal
        if (this.cancelUltra) this.cancelUltra.addEventListener('click', () => this.hideUltraWarning());
        if (this.confirmUltra) this.confirmUltra.addEventListener('click', () => this.startUltraScan());
        
        // Search
        if (this.searchInput) this.searchInput.addEventListener('input', (e) => this.filterResults(e.target.value));
    }

    async autoDetectDomain() {
        try {
            const browserAPI = typeof browser !== 'undefined' ? browser : chrome;
            const tabs = await browserAPI.tabs.query({active: true, currentWindow: true});
            
            if (tabs[0] && tabs[0].url) {
                const url = new URL(tabs[0].url);
                const hostname = url.hostname;
                
                if (hostname && 
                    !hostname.includes('chrome://') && 
                    !hostname.includes('about:') &&
                    !hostname.includes('moz-extension://') &&
                    !hostname.includes('chrome-extension://')) {
                    
                    const cleanDomain = hostname.replace(/^www\./, '');
                    this.domainInput.value = cleanDomain;
                    this.showToast('Auto-detected: ' + cleanDomain);
                }
            }
        } catch (error) {
            console.error('Auto-detect failed:', error);
        }
    }

    handleScanClick() {
        let selectedMode = 'low';
        this.scanModeInputs.forEach(input => {
            if (input.checked) selectedMode = input.value;
        });
        
        if (selectedMode === 'ultra') {
            this.showUltraWarning();
        } else {
            this.startScan();
        }
    }

    showUltraWarning() {
        if (this.ultraWarning) {
            this.ultraWarning.style.display = 'flex';
        }
    }

    hideUltraWarning() {
        if (this.ultraWarning) {
            this.ultraWarning.style.display = 'none';
        }
    }

    startUltraScan() {
        this.hideUltraWarning();
        this.startScan();
    }

    async startScan() {
        const domain = this.domainInput.value.trim();
        
        if (!domain) {
            this.showToast('Please enter a domain');
            return;
        }
        
        let scanMode = 'low';
        this.scanModeInputs.forEach(input => {
            if (input.checked) scanMode = input.value;
        });
        
        const cleanDomain = domain
            .replace(/^https?:\/\//, '')
            .replace(/^www\./, '')
            .replace(/\/$/, '');
        
        console.log('🚀 Starting scan:', {
            domain: cleanDomain,
            mode: scanMode
        });
        
        // Reset
        this.allEmails = [];
        this.streamedEmails.clear();
        if (this.streamEmails) this.streamEmails.innerHTML = '';
        
        // Update UI
        this.scanBtn.classList.add('scanning');
        this.scanBtn.querySelector('.btn-text').textContent = 'Scanning...';
        this.scanBtn.disabled = true;
        
        // Show progress
        this.progressContainer.style.display = 'block';
        if (this.resultsContainer) this.resultsContainer.style.display = 'none';
        
        this.startTime = Date.now();
        
        try {
            const browserAPI = typeof browser !== 'undefined' ? browser : chrome;
            
            const response = await browserAPI.runtime.sendMessage({
                action: 'startScan',
                data: {
                    domain: cleanDomain,
                    scanMode: scanMode
                }
            });
            
            console.log('📨 Scan response:', response);
            
            if (response && response.success) {
                this.scanId = response.scanId;
                this.startPolling();
                this.showToast(`🚀 Scan started!`);
            } else {
                throw new Error(response?.error || 'Failed to start scan');
            }
            
        } catch (error) {
            console.error('❌ Scan error:', error);
            this.showToast('Error: ' + error.message);
            this.resetScanUI();
        }
    }

    startPolling() {
        this.scanInterval = setInterval(async () => {
            try {
                const browserAPI = typeof browser !== 'undefined' ? browser : chrome;
                
                const status = await browserAPI.runtime.sendMessage({
                    action: 'getScanStatus',
                    data: { scanId: this.scanId }
                });
                
                if (status && !status.error) {
                    this.updateProgress(status);
                    this.updateLiveFeed(status);
                    
                    if (status.status === 'completed' || status.status === 'error') {
                        this.completeScan(status);
                    }
                }
                
            } catch (error) {
                console.error('❌ Polling error:', error);
            }
        }, 500);
    }

    updateProgress(status) {
        this.progressFill.style.width = status.progress + '%';
        this.progressPercent.textContent = Math.round(status.progress) + '%';
        this.progressStatus.textContent = status.currentAction || 'Scanning...';
        
        const totalEmails = status.allEmails?.length || 0;
        this.emailsStat.textContent = totalEmails;
        this.pagesStat.textContent = status.pagesScanned || 0;
        
        const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
        this.timeStat.textContent = elapsed + 's';
    }

    updateLiveFeed(status) {
        if (!status.allEmails) return;
        
        const allEmails = status.allEmails || [];
        const newEmails = allEmails.filter(email => !this.streamedEmails.has(email));
        
        newEmails.forEach(email => {
            this.addToStream(email);
            this.streamedEmails.add(email);
        });
    }

    addToStream(email) {
        if (!this.streamEmails) return;
        
        const item = document.createElement('div');
        item.className = 'stream-item';
        item.textContent = email;
        
        // Add to top
        this.streamEmails.insertBefore(item, this.streamEmails.firstChild);
        
        // Keep only last 10
        while (this.streamEmails.children.length > 10) {
            this.streamEmails.removeChild(this.streamEmails.lastChild);
        }
    }

    completeScan(status) {
        clearInterval(this.scanInterval);
        this.resetScanUI();
        
        if (status.status === 'completed') {
            this.allEmails = status.allEmails || [];
            
            const totalEmails = this.allEmails.length;
            
            if (totalEmails > 0) {
                this.displayResults();
                this.showToast(`✅ Found ${totalEmails} emails!`);
            } else {
                this.showToast('⚠️ No emails found');
            }
        } else if (status.status === 'error') {
            this.showToast('❌ ' + (status.error || 'Scan failed'));
        }
        
        this.progressContainer.style.display = 'none';
    }

    displayResults() {
        if (!this.resultsContainer) return;
        
        this.resultsContainer.style.display = 'block';
        this.totalCount.textContent = this.allEmails.length;
        
        this.displayEmailList(this.allEmails);
    }

    displayEmailList(emails) {
        if (!this.emailList) return;
        this.emailList.innerHTML = '';
        
        if (emails.length === 0) {
            this.emailList.innerHTML = '<div class="empty-message">No emails found</div>';
            return;
        }
        
        emails.forEach(email => {
            const item = document.createElement('div');
            item.className = 'email-item';
            item.dataset.email = email;
            
            const emailSpan = document.createElement('span');
            emailSpan.className = 'email-text';
            emailSpan.textContent = email;
            
            const actions = document.createElement('div');
            actions.className = 'email-actions';
            
            const verifyBtn = document.createElement('button');
            verifyBtn.className = 'btn-verify';
            verifyBtn.textContent = 'Verify';
            verifyBtn.addEventListener('click', () => this.verifyEmail(email, verifyBtn, emailSpan));
            
            const copyBtn = document.createElement('button');
            copyBtn.className = 'btn-copy';
            copyBtn.textContent = 'Copy';
            copyBtn.addEventListener('click', () => this.copyEmail(email, copyBtn));
            
            actions.appendChild(verifyBtn);
            actions.appendChild(copyBtn);
            
            item.appendChild(emailSpan);
            item.appendChild(actions);
            this.emailList.appendChild(item);
        });
    }

    async verifyEmail(email, button, emailSpan) {
        button.textContent = 'Checking...';
        button.disabled = true;
        
        try {
            const domain = email.split('@')[1];
            const response = await fetch(`https://dns.google/resolve?name=${domain}&type=MX`);
            const data = await response.json();
            
            const badge = document.createElement('span');
            
            if (data.Answer && data.Answer.length > 0) {
                badge.className = 'email-verified';
                badge.textContent = 'VALID';
                button.textContent = '✓';
                button.style.background = 'var(--green)';
                button.style.color = 'white';
            } else {
                badge.className = 'email-invalid';
                badge.textContent = 'INVALID';
                button.textContent = '✗';
                button.style.background = 'var(--red)';
                button.style.color = 'white';
            }
            
            const oldBadge = emailSpan.querySelector('.email-verified, .email-invalid');
            if (oldBadge) oldBadge.remove();
            
            emailSpan.appendChild(badge);
            
        } catch (error) {
            button.textContent = 'Verify';
            button.disabled = false;
            this.showToast('Verification failed');
        }
        
        setTimeout(() => {
            button.textContent = 'Verify';
            button.disabled = false;
            button.style.background = '';
            button.style.color = '';
        }, 3000);
    }

    async verifyAllEmails() {
        if (this.allEmails.length === 0) {
            this.showToast('No emails to verify');
            return;
        }
        
        this.showToast(`Verifying ${this.allEmails.length} emails...`);
        
        if (this.verifyAllBtn) {
            this.verifyAllBtn.disabled = true;
            this.verifyAllBtn.style.opacity = '0.5';
        }
        
        for (let i = 0; i < this.allEmails.length; i++) {
            const email = this.allEmails[i];
            const item = document.querySelector(`[data-email="${email}"]`);
            
            if (item) {
                const emailSpan = item.querySelector('.email-text');
                const verifyBtn = item.querySelector('.btn-verify');
                if (verifyBtn) {
                    this.verifyEmail(email, verifyBtn, emailSpan);
                }
            }
            
            await this.delay(500);
        }
        
        if (this.verifyAllBtn) {
            this.verifyAllBtn.disabled = false;
            this.verifyAllBtn.style.opacity = '1';
        }
        this.showToast('✅ Verification complete');
    }

    filterResults(query) {
        if (!this.emailList) return;
        
        const items = this.emailList.querySelectorAll('.email-item');
        const lowerQuery = query.toLowerCase();
        
        items.forEach(item => {
            const email = item.dataset.email.toLowerCase();
            item.style.display = email.includes(lowerQuery) ? 'flex' : 'none';
        });
    }

    async copyEmail(text, button) {
        try {
            await navigator.clipboard.writeText(text);
            button.textContent = '✓';
            button.style.background = 'var(--green)';
            button.style.color = 'white';
            
            setTimeout(() => {
                button.textContent = 'Copy';
                button.style.background = '';
                button.style.color = '';
            }, 2000);
        } catch (error) {
            console.error('Copy failed:', error);
            this.showToast('Copy failed');
        }
    }

    async copyAll() {
        if (this.allEmails.length === 0) {
            this.showToast('No emails to copy');
            return;
        }
        
        try {
            const text = this.allEmails.join('\n');
            await navigator.clipboard.writeText(text);
            this.showToast(`📋 Copied ${this.allEmails.length} emails`);
        } catch (error) {
            console.error('Copy all failed:', error);
            this.showToast('Copy failed');
        }
    }

    exportCSV() {
        if (this.allEmails.length === 0) {
            this.showToast('No emails to export');
            return;
        }
        
        const csv = 'Email\n' + this.allEmails.join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `hunterkiller-${this.domainInput.value}-${Date.now()}.csv`;
        a.click();
        
        URL.revokeObjectURL(url);
        this.showToast('📊 CSV exported');
    }

    resetScanUI() {
        this.scanBtn.classList.remove('scanning');
        this.scanBtn.querySelector('.btn-text').textContent = 'Start Scan';
        this.scanBtn.disabled = false;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    showToast(message) {
        this.toast.textContent = message;
        this.toast.classList.add('show');
        
        setTimeout(() => {
            this.toast.classList.remove('show');
        }, 3000);
    }
}

// Initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new PopupController());
} else {
    new PopupController();
}
