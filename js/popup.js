// HunterKiller v4.0 - Popup Controller (FIXED)
// Clean, cinematic UI - matches new HTML

class PopupController {
    constructor() {
        this.scanId = null;
        this.scanInterval = null;
        this.startTime = null;
        this.currentEmails = {
            domain: [],
            external: [],
            social: []
        };
        this.scanInfo = null;
        
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
        this.scanModeInputs = document.querySelectorAll('input[name="scanMode"]');
        this.verifyEmailsCheckbox = document.getElementById('verifyEmails');
        this.extractSocialCheckbox = document.getElementById('extractSocial');
        
        // Buttons
        this.autoDetectBtn = document.getElementById('autoDetect');
        this.scanBtn = document.getElementById('scanBtn');
        this.settingsBtn = document.getElementById('settingsBtn');
        this.closeSettingsBtn = document.getElementById('closeSettings');
        this.saveSettingsBtn = document.getElementById('saveSettings');
        this.verifyAllBtn = document.getElementById('verifyAll');
        this.copyAllBtn = document.getElementById('copyAll');
        this.exportCSVBtn = document.getElementById('exportCSV');
        this.clearResultsBtn = document.getElementById('clearResults');
        
        // Domain info
        this.domainInfo = document.getElementById('domainInfo');
        this.domainIP = document.getElementById('domainIP');
        this.domainRegistrar = document.getElementById('domainRegistrar');
        
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
        this.domainCount = document.getElementById('domainCount');
        this.externalCount = document.getElementById('externalCount');
        this.socialCount = document.getElementById('socialCount');
        
        // Lists
        this.domainList = document.getElementById('domainList');
        this.externalList = document.getElementById('externalList');
        this.socialList = document.getElementById('socialList');
        this.infoPanel = document.getElementById('infoPanel');
        
        // Search inputs
        this.searchDomain = document.getElementById('searchDomain');
        this.searchExternal = document.getElementById('searchExternal');
        
        // Tabs
        this.tabs = document.querySelectorAll('.tab');
        this.tabContents = document.querySelectorAll('.tab-content');
        
        // Settings
        this.settingsPanel = document.getElementById('settingsPanel');
        
        // Toast
        this.toast = document.getElementById('toast');
    }

    attachListeners() {
        this.autoDetectBtn.addEventListener('click', () => this.autoDetectDomain());
        this.scanBtn.addEventListener('click', () => this.startScan());
        this.domainInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.startScan();
        });
        
        // Tabs
        this.tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.tab;
                this.switchTab(tabName);
            });
        });
        
        // Settings
        this.settingsBtn.addEventListener('click', () => this.openSettings());
        this.closeSettingsBtn.addEventListener('click', () => this.closeSettings());
        this.saveSettingsBtn.addEventListener('click', () => this.saveSettings());
        
        // Results actions
        if (this.verifyAllBtn) this.verifyAllBtn.addEventListener('click', () => this.verifyAllEmails());
        if (this.copyAllBtn) this.copyAllBtn.addEventListener('click', () => this.copyAll());
        if (this.exportCSVBtn) this.exportCSVBtn.addEventListener('click', () => this.exportCSV());
        if (this.clearResultsBtn) this.clearResultsBtn.addEventListener('click', () => this.clearResults());
        
        // Search
        if (this.searchDomain) this.searchDomain.addEventListener('input', (e) => this.filterResults('domain', e.target.value));
        if (this.searchExternal) this.searchExternal.addEventListener('input', (e) => this.filterResults('external', e.target.value));
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
            this.showToast('Could not auto-detect domain');
        }
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
        
        console.log('Starting scan:', {
            domain: cleanDomain,
            mode: scanMode,
            verify: this.verifyEmailsCheckbox.checked,
            social: this.extractSocialCheckbox.checked
        });
        
        // Update button UI
        this.scanBtn.classList.add('scanning');
        this.scanBtn.textContent = 'Scanning...';
        this.scanBtn.disabled = true;
        
        // Show progress
        this.progressContainer.style.display = 'block';
        if (this.resultsContainer) this.resultsContainer.style.display = 'none';
        if (this.domainInfo) this.domainInfo.style.display = 'none';
        
        this.startTime = Date.now();
        
        try {
            const browserAPI = typeof browser !== 'undefined' ? browser : chrome;
            
            const response = await browserAPI.runtime.sendMessage({
                action: 'startScan',
                data: {
                    domain: cleanDomain,
                    scanMode: scanMode,
                    verifyEmails: this.verifyEmailsCheckbox.checked,
                    extractSocial: this.extractSocialCheckbox.checked
                }
            });
            
            console.log('Scan response:', response);
            
            if (response && response.success) {
                this.scanId = response.scanId;
                this.startPolling();
                this.showToast('Scan started in ' + scanMode + ' mode');
            } else {
                throw new Error(response?.error || 'Failed to start scan');
            }
            
        } catch (error) {
            console.error('Scan error:', error);
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
                    
                    if (status.status === 'completed' || status.status === 'error') {
                        this.completeScan(status);
                    }
                }
                
            } catch (error) {
                console.error('Polling error:', error);
            }
        }, 1000);
    }

    updateProgress(status) {
        this.progressFill.style.width = status.progress + '%';
        this.progressPercent.textContent = Math.round(status.progress) + '%';
        this.progressStatus.textContent = status.currentAction || 'Scanning...';
        
        const totalEmails = (status.domainEmails?.length || 0) + 
                           (status.externalEmails?.length || 0);
        this.emailsStat.textContent = totalEmails;
        this.pagesStat.textContent = status.pagesScanned || 0;
        
        const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
        this.timeStat.textContent = elapsed + 's';
    }

    completeScan(status) {
        clearInterval(this.scanInterval);
        this.resetScanUI();
        
        if (status.status === 'completed') {
            this.currentEmails = {
                domain: status.domainEmails || [],
                external: status.externalEmails || [],
                social: status.socialLinks || []
            };
            
            this.scanInfo = status.scanInfo || {};
            
            const totalEmails = this.currentEmails.domain.length + this.currentEmails.external.length;
            
            // Show domain info
            if (this.scanInfo.ip && this.domainInfo) {
                this.domainIP.textContent = this.scanInfo.ip;
                this.domainRegistrar.textContent = this.scanInfo.registrar || 'Unknown';
                this.domainInfo.style.display = 'block';
            }
            
            this.displayResults();
            this.showToast(`Found ${totalEmails} emails (${this.currentEmails.domain.length} domain, ${this.currentEmails.external.length} external)`);
        } else {
            this.showToast('Scan failed: ' + (status.error || 'Unknown error'));
        }
        
        this.progressContainer.style.display = 'none';
    }

    displayResults() {
        if (!this.resultsContainer) return;
        
        this.resultsContainer.style.display = 'block';
        
        const totalEmails = this.currentEmails.domain.length + this.currentEmails.external.length;
        this.totalCount.textContent = totalEmails;
        this.domainCount.textContent = this.currentEmails.domain.length;
        this.externalCount.textContent = this.currentEmails.external.length;
        this.socialCount.textContent = this.currentEmails.social.length;
        
        this.displayEmailList(this.currentEmails.domain, this.domainList, 'domain');
        this.displayEmailList(this.currentEmails.external, this.externalList, 'external');
        this.displaySocialList(this.currentEmails.social, this.socialList);
        this.displayInfoPanel();
    }

    displayEmailList(emails, container, category) {
        if (!container) return;
        container.innerHTML = '';
        
        if (emails.length === 0) {
            container.innerHTML = '<div class="empty-message">No emails in this category</div>';
            return;
        }
        
        emails.forEach(email => {
            const item = document.createElement('div');
            item.className = 'result-item';
            item.dataset.email = email;
            item.dataset.category = category;
            
            const emailSpan = document.createElement('span');
            emailSpan.className = 'result-email';
            emailSpan.textContent = email;
            
            const actions = document.createElement('div');
            actions.style.display = 'flex';
            actions.style.gap = '6px';
            
            const verifyBtn = document.createElement('button');
            verifyBtn.className = 'result-copy';
            verifyBtn.textContent = 'Verify';
            verifyBtn.addEventListener('click', () => this.verifyEmail(email, verifyBtn, emailSpan));
            
            const copyBtn = document.createElement('button');
            copyBtn.className = 'result-copy';
            copyBtn.textContent = 'Copy';
            copyBtn.addEventListener('click', () => this.copyEmail(email, copyBtn));
            
            actions.appendChild(verifyBtn);
            actions.appendChild(copyBtn);
            
            item.appendChild(emailSpan);
            item.appendChild(actions);
            container.appendChild(item);
        });
    }

    displaySocialList(socialLinks, container) {
        if (!container) return;
        container.innerHTML = '';
        
        if (socialLinks.length === 0) {
            container.innerHTML = '<div class="empty-message">No social profiles found</div>';
            return;
        }
        
        socialLinks.forEach(social => {
            const item = document.createElement('div');
            item.className = 'social-item';
            
            const icon = document.createElement('div');
            icon.className = 'social-icon';
            icon.textContent = this.getSocialIcon(social.platform);
            
            const info = document.createElement('div');
            info.className = 'social-info';
            
            const platform = document.createElement('div');
            platform.className = 'social-platform';
            platform.textContent = social.platform;
            
            const url = document.createElement('div');
            url.className = 'social-url';
            url.textContent = social.url;
            
            info.appendChild(platform);
            info.appendChild(url);
            
            const copyBtn = document.createElement('button');
            copyBtn.className = 'result-copy';
            copyBtn.textContent = 'Copy';
            copyBtn.addEventListener('click', () => this.copyEmail(social.url, copyBtn));
            
            item.appendChild(icon);
            item.appendChild(info);
            item.appendChild(copyBtn);
            container.appendChild(item);
        });
    }

    displayInfoPanel() {
        if (!this.infoPanel || !this.scanInfo) return;
        
        let html = '';
        
        html += '<div class="info-section">';
        html += '<h4>Domain Information</h4>';
        if (this.scanInfo.ip) {
            html += `<div class="info-row"><span class="info-row-label">IP Address</span><span class="info-row-value">${this.scanInfo.ip}</span></div>`;
        }
        if (this.scanInfo.registrar) {
            html += `<div class="info-row"><span class="info-row-label">Registrar</span><span class="info-row-value">${this.scanInfo.registrar}</span></div>`;
        }
        html += '</div>';
        
        html += '<div class="info-section">';
        html += '<h4>Scan Statistics</h4>';
        html += `<div class="info-row"><span class="info-row-label">Pages Scanned</span><span class="info-row-value">${this.scanInfo.pagesScanned || 0}</span></div>`;
        html += `<div class="info-row"><span class="info-row-label">Duration</span><span class="info-row-value">${this.scanInfo.duration || '0s'}</span></div>`;
        html += `<div class="info-row"><span class="info-row-label">Domain Emails</span><span class="info-row-value">${this.currentEmails.domain.length}</span></div>`;
        html += `<div class="info-row"><span class="info-row-label">External Emails</span><span class="info-row-value">${this.currentEmails.external.length}</span></div>`;
        html += `<div class="info-row"><span class="info-row-label">Social Profiles</span><span class="info-row-value">${this.currentEmails.social.length}</span></div>`;
        html += '</div>';
        
        this.infoPanel.innerHTML = html;
    }

    getSocialIcon(platform) {
        const icons = {
            'Facebook': 'FB',
            'Twitter': 'X',
            'LinkedIn': 'IN',
            'Instagram': 'IG',
            'YouTube': 'YT',
            'GitHub': 'GH'
        };
        return icons[platform] || 'SM';
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
                button.textContent = 'Valid';
                button.style.background = 'var(--green)';
                button.style.color = 'white';
            } else {
                badge.className = 'email-invalid';
                badge.textContent = 'INVALID';
                button.textContent = 'Invalid';
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
        const allEmails = [...this.currentEmails.domain, ...this.currentEmails.external];
        
        if (allEmails.length === 0) {
            this.showToast('No emails to verify');
            return;
        }
        
        this.showToast(`Verifying ${allEmails.length} emails...`);
        
        if (this.verifyAllBtn) {
            this.verifyAllBtn.disabled = true;
            this.verifyAllBtn.style.opacity = '0.5';
        }
        
        for (let i = 0; i < allEmails.length; i++) {
            const email = allEmails[i];
            const items = document.querySelectorAll(`[data-email="${email}"]`);
            
            items.forEach(item => {
                const emailSpan = item.querySelector('.result-email');
                const verifyBtn = Array.from(item.querySelectorAll('button')).find(btn => btn.textContent === 'Verify');
                if (verifyBtn) {
                    this.verifyEmail(email, verifyBtn, emailSpan);
                }
            });
            
            await this.delay(500);
        }
        
        if (this.verifyAllBtn) {
            this.verifyAllBtn.disabled = false;
            this.verifyAllBtn.style.opacity = '1';
        }
        this.showToast('Verification complete');
    }

    filterResults(category, query) {
        const container = category === 'domain' ? this.domainList : this.externalList;
        if (!container) return;
        
        const items = container.querySelectorAll('.result-item');
        const lowerQuery = query.toLowerCase();
        
        items.forEach(item => {
            const email = item.dataset.email.toLowerCase();
            item.style.display = email.includes(lowerQuery) ? 'flex' : 'none';
        });
    }

    switchTab(tabName) {
        this.tabs.forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });
        
        this.tabContents.forEach(content => {
            content.classList.toggle('active', content.id === tabName + 'Tab');
        });
    }

    async copyEmail(text, button) {
        try {
            await navigator.clipboard.writeText(text);
            button.textContent = 'Copied!';
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
        const allEmails = [
            ...this.currentEmails.domain,
            ...this.currentEmails.external
        ];
        
        if (allEmails.length === 0) {
            this.showToast('No emails to copy');
            return;
        }
        
        try {
            const text = allEmails.join('\n');
            await navigator.clipboard.writeText(text);
            this.showToast(`Copied ${allEmails.length} emails`);
        } catch (error) {
            console.error('Copy all failed:', error);
            this.showToast('Copy failed');
        }
    }

    exportCSV() {
        const allEmails = [
            ...this.currentEmails.domain.map(e => ({ email: e, category: 'Domain' })),
            ...this.currentEmails.external.map(e => ({ email: e, category: 'External' }))
        ];
        
        if (allEmails.length === 0) {
            this.showToast('No emails to export');
            return;
        }
        
        const csv = 'Email,Category\n' + allEmails.map(item => `${item.email},${item.category}`).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `hunterkiller-${this.domainInput.value}-${Date.now()}.csv`;
        a.click();
        
        URL.revokeObjectURL(url);
        this.showToast('CSV exported');
    }

    clearResults() {
        if (this.resultsContainer) this.resultsContainer.style.display = 'none';
        if (this.domainList) this.domainList.innerHTML = '';
        if (this.externalList) this.externalList.innerHTML = '';
        if (this.socialList) this.socialList.innerHTML = '';
        if (this.infoPanel) this.infoPanel.innerHTML = '';
        this.currentEmails = { domain: [], external: [], social: [] };
        this.scanInfo = null;
        if (this.searchDomain) this.searchDomain.value = '';
        if (this.searchExternal) this.searchExternal.value = '';
    }

    resetScanUI() {
        this.scanBtn.classList.remove('scanning');
        this.scanBtn.textContent = 'Start Scan';
        this.scanBtn.disabled = false;
    }

    openSettings() {
        if (this.settingsPanel) this.settingsPanel.style.display = 'flex';
    }

    closeSettings() {
        if (this.settingsPanel) this.settingsPanel.style.display = 'none';
    }

    async saveSettings() {
        const settings = {
            requestDelay: parseInt(document.getElementById('reqDelay')?.value) || 300,
            timeout: parseInt(document.getElementById('timeout')?.value) || 10,
            followRedirects: document.getElementById('followRedirects')?.checked !== false,
            strictValidation: document.getElementById('strictValidation')?.checked !== false
        };
        
        try {
            const browserAPI = typeof browser !== 'undefined' ? browser : chrome;
            await browserAPI.storage.local.set({ settings });
            this.showToast('Settings saved');
            this.closeSettings();
        } catch (error) {
            console.error('Save settings failed:', error);
            this.showToast('Failed to save settings');
        }
    }

    async loadSettings() {
        try {
            const browserAPI = typeof browser !== 'undefined' ? browser : chrome;
            const result = await browserAPI.storage.local.get('settings');
            
            if (result.settings) {
                const s = result.settings;
                const reqDelay = document.getElementById('reqDelay');
                const timeout = document.getElementById('timeout');
                const followRedirects = document.getElementById('followRedirects');
                const strictValidation = document.getElementById('strictValidation');
                
                if (reqDelay) reqDelay.value = s.requestDelay || 300;
                if (timeout) timeout.value = s.timeout || 10;
                if (followRedirects) followRedirects.checked = s.followRedirects !== false;
                if (strictValidation) strictValidation.checked = s.strictValidation !== false;
            }
        } catch (error) {
            console.error('Load settings failed:', error);
        }
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
