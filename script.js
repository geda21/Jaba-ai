class JabaAI {
    constructor() {
        // Configuration
        this.config = {
            model: 'moonshotai/kimi-k3',
            maxRetries: 3,
            retryDelay: 1000,
        };

        // State
        this.state = {
            chats: this.loadChats(),
            currentChatId: null,
            isProcessing: false,
            theme: localStorage.getItem('jaba-theme') || 'light',
            isConnected: false
        };

        // DOM Elements
        this.elements = {
            loadingScreen: document.getElementById('loadingScreen'),
            sidebar: document.getElementById('sidebar'),
            chatArea: document.getElementById('chatArea'),
            messagesContainer: document.getElementById('messagesContainer'),
            welcomeScreen: document.getElementById('welcomeScreen'),
            userInput: document.getElementById('userInput'),
            sendBtn: document.getElementById('sendBtn'),
            newChatBtn: document.getElementById('newChatBtn'),
            chatHistory: document.getElementById('chatHistory'),
            currentChatTitle: document.getElementById('currentChatTitle'),
            charCount: document.getElementById('charCount'),
            collapseBtn: document.getElementById('collapseBtn'),
            menuBtn: document.getElementById('menuBtn'),
            themeToggle: document.getElementById('themeToggle'),
            statusDot: document.getElementById('statusDot'),
            statusText: document.getElementById('statusText'),
            toast: document.getElementById('toast'),
            totalChats: document.getElementById('totalChats'),
            totalMessages: document.getElementById('totalMessages'),
            clearAllBtn: document.getElementById('clearAllBtn'),
            exportBtn: document.getElementById('exportBtn'),
            codeModal: document.getElementById('codeModal'),
            modalCode: document.getElementById('modalCode'),
            modalClose: document.getElementById('modalClose'),
            copyCodeBtn: document.getElementById('copyCodeBtn'),
            attachBtn: document.getElementById('attachBtn')
        };

        this.init();
    }

    async init() {
        this.applyTheme();
        this.setupEventListeners();
        this.updateStats();
        
        // Check API connection
        await this.checkConnection();
        
        // Load current chat
        this.loadCurrentChat();
        
        // Simulate loading screen
        this.simulateLoading();
        
        // Auto-resize textarea
        this.elements.userInput.addEventListener('input', () => {
            this.autoResizeTextarea();
            this.updateCharCount();
        });

        // Add copy buttons to code blocks after render
        this.observeMessages();
    }

    async checkConnection() {
        try {
            // Test the API connection
            await puter.ai.chat("test", { 
                model: this.config.model,
                max_tokens: 1 
            });
            this.state.isConnected = true;
            this.updateConnectionStatus(true);
        } catch (error) {
            console.warn('API connection test failed:', error);
            this.state.isConnected = false;
            this.updateConnectionStatus(false);
        }
    }

    updateConnectionStatus(connected) {
        const { statusDot, statusText } = this.elements;
        if (connected) {
            statusDot.className = 'status-dot online';
            statusText.textContent = 'Connected';
        } else {
            statusDot.className = 'status-dot offline';
            statusText.textContent = 'Offline';
        }
    }

    simulateLoading() {
        setTimeout(() => {
            this.elements.loadingScreen.classList.add('hidden');
        }, 2000);
    }

    applyTheme() {
        document.documentElement.setAttribute('data-theme', this.state.theme);
        localStorage.setItem('jaba-theme', this.state.theme);
    }

    setupEventListeners() {
        // Send message
        this.elements.sendBtn.addEventListener('click', () => this.sendMessage());
        this.elements.userInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // New chat
        this.elements.newChatBtn.addEventListener('click', () => this.createNewChat());

        // Sidebar controls
        this.elements.collapseBtn.addEventListener('click', () => this.toggleSidebar());
        this.elements.menuBtn.addEventListener('click', () => this.toggleMobileSidebar());

        // Theme toggle
        this.elements.themeToggle.addEventListener('click', () => this.toggleTheme());

        // Clear all chats
        this.elements.clearAllBtn.addEventListener('click', () => this.clearAllChats());

        // Export chat
        this.elements.exportBtn.addEventListener('click', () => this.exportCurrentChat());

        // Quick actions
        document.querySelectorAll('.quick-action-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const prompt = btn.dataset.prompt;
                this.elements.userInput.value = prompt;
                this.sendMessage();
            });
        });

        // Code modal
        this.elements.modalClose.addEventListener('click', () => this.closeCodeModal());
        this.elements.copyCodeBtn.addEventListener('click', () => this.copyModalCode());

        // Attach button (for future use)
        this.elements.attachBtn.addEventListener('click', () => {
            this.showToast('File attachment coming soon!', 'info');
        });

        // Close sidebar on outside click (mobile)
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 768) {
                const sidebar = this.elements.sidebar;
                const menuBtn = this.elements.menuBtn;
                if (!sidebar.contains(e.target) && !menuBtn.contains(e.target)) {
                    sidebar.classList.remove('mobile-open');
                }
            }
        });

        // Close modal on outside click
        this.elements.codeModal.addEventListener('click', (e) => {
            if (e.target === this.elements.codeModal) {
                this.closeCodeModal();
            }
        });
    }

    async sendMessage() {
        const message = this.elements.userInput.value.trim();
        if (!message || this.state.isProcessing) return;

        // Create new chat if none exists
        if (!this.state.currentChatId) {
            this.createNewChat();
        }

        this.state.isProcessing = true;
        this.elements.sendBtn.disabled = true;
        this.elements.userInput.value = '';
        this.elements.userInput.style.height = 'auto';
        this.updateCharCount();

        // Hide welcome screen
        this.elements.welcomeScreen.style.display = 'none';

        // Add user message
        this.addMessageToChat('user', message);

        // Show typing indicator
        const typingId = this.showTypingIndicator();

        try {
            const response = await this.callKimiAPI(message);
            
            this.removeTypingIndicator(typingId);
            this.addMessageToChat('bot', response);
            this.updateStats();
            this.showToast('Response received', 'success');
        } catch (error) {
            this.removeTypingIndicator(typingId);
            console.error('API Error:', error);
            
            let errorMessage = 'Sorry, I encountered an error. ';
            if (error.message.includes('network')) {
                errorMessage += 'Please check your internet connection.';
            } else if (error.message.includes('rate limit')) {
                errorMessage += 'Too many requests. Please wait a moment.';
            } else {
                errorMessage += 'Please try again.';
            }
            
            this.addMessageToChat('bot', `❌ ${errorMessage}\n\nError details: ${error.message}`);
            this.showToast('Failed to get response', 'error');
        } finally {
            this.state.isProcessing = false;
            this.elements.sendBtn.disabled = false;
            this.elements.userInput.focus();
        }
    }

    async callKimiAPI(message, retryCount = 0) {
        try {
            const response = await puter.ai.chat(message, {
                model: this.config.model,
                systemPrompt: `You are Jaba AI, an expert coding assistant powered by Kimi K3. 
                You help developers write clean, efficient, and secure code.
                
                Guidelines:
                - Always provide well-commented code examples with explanations
                - Use markdown for code blocks with language specification
                - Be concise but thorough in your explanations
                - Focus on best practices and modern approaches
                - Include error handling and edge cases in code examples
                - Mention potential security considerations when relevant
                - Optimize for readability and maintainability`,
                temperature: 0.7,
                maxTokens: 4000
            });

            if (!response) {
                throw new Error('Empty response from API');
            }

            return typeof response === 'string' ? response : response.message?.content || JSON.stringify(response);
        } catch (error) {
            if (retryCount < this.config.maxRetries) {
                console.log(`Retry attempt ${retryCount + 1}/${this.config.maxRetries}`);
                await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
                return this.callKimiAPI(message, retryCount + 1);
            }
            throw error;
        }
    }

    addMessageToChat(role, content) {
        const chat = this.state.chats.find(c => c.id === this.state.currentChatId);
        if (!chat) return;

        chat.messages.push({ role, content, timestamp: Date.now() });
        
        // Update chat title from first user message
        if (role === 'user' && chat.messages.filter(m => m.role === 'user').length === 1) {
            chat.title = content.substring(0, 60) + (content.length > 60 ? '...' : '');
            this.elements.currentChatTitle.textContent = chat.title;
        }

        this.saveChats();
        this.renderMessage(role, content);
        this.updateChatHistory();
    }

    renderMessage(role, content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}`;
        
        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.textContent = role === 'bot' ? 'J' : '👤';
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        
        if (role === 'bot') {
            contentDiv.innerHTML = this.formatMessage(content);
            // Add copy buttons to code blocks
            this.addCodeCopyButtons(contentDiv);
        } else {
            contentDiv.textContent = content;
        }
        
        // Add timestamp
        const timestamp = document.createElement('div');
        timestamp.className = 'message-timestamp';
        timestamp.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        contentDiv.appendChild(timestamp);
        
        messageDiv.appendChild(avatar);
        messageDiv.appendChild(contentDiv);
        this.elements.messagesContainer.appendChild(messageDiv);
        
        // Highlight code blocks
        if (role === 'bot') {
            messageDiv.querySelectorAll('pre code').forEach(block => {
                hljs.highlightElement(block);
                // Make code blocks clickable for preview
                block.addEventListener('click', () => this.openCodeModal(block.textContent));
            });
        }
        
        this.scrollToBottom();
    }

    formatMessage(content) {
        marked.setOptions({
            breaks: true,
            gfm: true,
            highlight: (code, lang) => {
                if (lang && hljs.getLanguage(lang)) {
                    return hljs.highlight(code, { language: lang }).value;
                }
                return hljs.highlightAuto(code).value;
            }
        });
        
        return marked.parse(content);
    }

    addCodeCopyButtons(container) {
        container.querySelectorAll('pre').forEach(pre => {
            const button = document.createElement('button');
            button.className = 'code-copy-btn';
            button.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                </svg>
                Copy
            `;
            button.addEventListener('click', () => {
                const code = pre.querySelector('code').textContent;
                navigator.clipboard.writeText(code).then(() => {
                    button.innerHTML = '✓ Copied!';
                    setTimeout(() => {
                        button.innerHTML = `
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                            </svg>
                            Copy
                        `;
                    }, 2000);
                });
            });
            pre.style.position = 'relative';
            pre.appendChild(button);
        });
    }

    openCodeModal(code) {
        this.elements.modalCode.textContent = code;
        hljs.highlightElement(this.elements.modalCode);
        this.elements.codeModal.style.display = 'block';
    }

    closeCodeModal() {
        this.elements.codeModal.style.display = 'none';
    }

    copyModalCode() {
        const code = this.elements.modalCode.textContent;
        navigator.clipboard.writeText(code).then(() => {
            this.showToast('Code copied to clipboard!', 'success');
        });
    }

    showTypingIndicator() {
        const id = 'typing-' + Date.now();
        const indicator = document.createElement('div');
        indicator.id = id;
        indicator.className = 'message bot';
        indicator.innerHTML = `
            <div class="message-avatar">J</div>
            <div class="message-content">
                <div class="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        `;
        this.elements.messagesContainer.appendChild(indicator);
        this.scrollToBottom();
        return id;
    }

    removeTypingIndicator(id) {
        const indicator = document.getElementById(id);
        if (indicator) indicator.remove();
    }

    createNewChat() {
        const newChat = {
            id: 'chat-' + Date.now(),
            title: 'New Chat',
            messages: [],
            createdAt: Date.now()
        };
        
        this.state.chats.unshift(newChat);
        this.state.currentChatId = newChat.id;
        
        this.saveChats();
        this.loadCurrentChat();
        this.updateChatHistory();
        this.updateStats();
    }

    loadCurrentChat() {
        this.elements.messagesContainer.innerHTML = '';
        
        if (this.state.currentChatId) {
            const chat = this.state.chats.find(c => c.id === this.state.currentChatId);
            if (chat) {
                this.elements.currentChatTitle.textContent = chat.title;
                this.elements.welcomeScreen.style.display = 'none';
                
                chat.messages.forEach(msg => {
                    this.renderMessage(msg.role, msg.content);
                });
            }
        } else {
            this.elements.currentChatTitle.textContent = 'New Chat';
            this.elements.welcomeScreen.style.display = 'flex';
        }
        
        this.updateChatHistory();
    }

    updateChatHistory() {
        this.elements.chatHistory.innerHTML = '';
        
        this.state.chats.forEach(chat => {
            const item = document.createElement('div');
            item.className = `chat-history-item ${chat.id === this.state.currentChatId ? 'active' : ''}`;
            item.innerHTML = `
                <span class="history-icon">💬</span>
                <span class="history-text">${chat.title}</span>
                <span class="history-time">${this.formatTime(chat.createdAt)}</span>
                <button class="delete-chat" data-chat-id="${chat.id}">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                    </svg>
                </button>
            `;
            
            item.addEventListener('click', (e) => {
                if (!e.target.closest('.delete-chat')) {
                    this.switchChat(chat.id);
                }
            });
            
            item.querySelector('.delete-chat').addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteChat(chat.id);
            });
            
            this.elements.chatHistory.appendChild(item);
        });
    }

    switchChat(chatId) {
        this.state.currentChatId = chatId;
        this.saveChats();
        this.loadCurrentChat();
    }

    deleteChat(chatId) {
        if (confirm('Delete this chat? This action cannot be undone.')) {
            this.state.chats = this.state.chats.filter(c => c.id !== chatId);
            
            if (this.state.currentChatId === chatId) {
                this.state.currentChatId = this.state.chats[0]?.id || null;
            }
            
            this.saveChats();
            this.loadCurrentChat();
            this.updateStats();
            this.showToast('Chat deleted', 'info');
        }
    }

    clearAllChats() {
        if (confirm('Delete all chats? This action cannot be undone.')) {
            this.state.chats = [];
            this.state.currentChatId = null;
            this.saveChats();
            this.loadCurrentChat();
            this.updateStats();
            this.showToast('All chats cleared', 'info');
        }
    }

    exportCurrentChat() {
        const chat = this.state.chats.find(c => c.id === this.state.currentChatId);
        if (!chat) {
            this.showToast('No chat to export', 'error');
            return;
        }

        const exportData = {
            title: chat.title,
            createdAt: new Date(chat.createdAt).toISOString(),
            messages: chat.messages,
            exportedAt: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `jaba-ai-chat-${chat.id}.json`;
        a.click();
        URL.revokeObjectURL(url);
        this.showToast('Chat exported successfully', 'success');
    }

    toggleSidebar() {
        this.elements.sidebar.classList.toggle('collapsed');
    }

    toggleMobileSidebar() {
        this.elements.sidebar.classList.toggle('mobile-open');
    }

    toggleTheme() {
        this.state.theme = this.state.theme === 'light' ? 'dark' : 'light';
        this.applyTheme();
        this.showToast(`${this.state.theme === 'dark' ? '🌙 Dark' : '☀️ Light'} mode activated`, 'info');
    }

    updateCharCount() {
        const length = this.elements.userInput.value.length;
        this.elements.charCount.textContent = `${length}/8000`;
    }

    autoResizeTextarea() {
        const textarea = this.elements.userInput;
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
    }

    updateStats() {
        this.elements.totalChats.textContent = this.state.chats.length;
        const totalMessages = this.state.chats.reduce((sum, chat) => sum + chat.messages.length, 0);
        this.elements.totalMessages.textContent = totalMessages;
    }

    showToast(message, type = 'info') {
        const toast = this.elements.toast;
        toast.className = `toast ${type}`;
        toast.querySelector('.toast-message').textContent = message;
        
        const icons = {
            success: '✅',
            error: '❌',
            info: 'ℹ️',
            warning: '⚠️'
        };
        toast.querySelector('.toast-icon').textContent = icons[type] || icons.info;
        
        toast.classList.add('show');
        
        clearTimeout(this.toastTimeout);
        this.toastTimeout = setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    scrollToBottom() {
        setTimeout(() => {
            this.elements.chatArea.scrollTop = this.elements.chatArea.scrollHeight;
        }, 100);
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return date.toLocaleDateString();
    }

    observeMessages() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1 && node.classList.contains('message')) {
                        // Add any dynamic functionality to new messages
                    }
                });
            });
        });
        
        observer.observe(this.elements.messagesContainer, {
            childList: true,
            subtree: true
        });
    }

    // Local Storage Management
    loadChats() {
        try {
            const chats = localStorage.getItem('jaba-chats-v2');
            return chats ? JSON.parse(chats) : [];
        } catch (error) {
            console.error('Failed to load chats:', error);
            return [];
        }
    }

    saveChats() {
        try {
            // Limit storage size (keep last 50 chats)
            if (this.state.chats.length > 50) {
                this.state.chats = this.state.chats.slice(0, 50);
            }
            localStorage.setItem('jaba-chats-v2', JSON.stringify(this.state.chats));
        } catch (error) {
            console.error('Failed to save chats:', error);
            if (error.name === 'QuotaExceededError') {
                this.showToast('Storage full. Please clear some chats.', 'warning');
                // Keep only last 10 chats
                this.state.chats = this.state.chats.slice(0, 10);
                localStorage.setItem('jaba-chats-v2', JSON.stringify(this.state.chats));
            }
        }
    }
}

// Initialize Jaba AI when Puter.js is ready
document.addEventListener('DOMContentLoaded', () => {
    // Wait for Puter.js to be available
    const checkPuter = setInterval(() => {
        if (typeof puter !== 'undefined' && puter.ai) {
            clearInterval(checkPuter);
            window.jabaAI = new JabaAI();
        }
    }, 100);
    
    // Fallback if Puter.js fails to load
    setTimeout(() => {
        if (!window.jabaAI) {
            clearInterval(checkPuter);
            console.error('Puter.js failed to load');
            window.jabaAI = new JabaAI();
        }
    }, 5000);
});
