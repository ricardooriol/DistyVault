// SAWRON App JavaScript
class SawronApp {
    constructor() {
        this.summaries = [];
        this.currentFilter = 'all';
        this.selectedFile = null;
        this.currentUrlType = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadSummaries();
    }

    setupEventListeners() {
        // Main input field
        const mainInput = document.getElementById('main-input');
        mainInput.addEventListener('input', (e) => {
            this.handleInputChange(e.target.value);
        });

        // File input
        const fileInput = document.getElementById('file-input');
        fileInput.addEventListener('change', (e) => {
            this.handleFileSelection(e.target.files);
        });

        // Search and filter
        document.getElementById('search-input').addEventListener('input', (e) => {
            this.filterSummaries(e.target.value, this.currentFilter);
        });
        
        document.getElementById('filter-select').addEventListener('change', (e) => {
            this.currentFilter = e.target.value;
            this.filterSummaries(document.getElementById('search-input').value, this.currentFilter);
        });

        // Modal close
        document.getElementById('summary-modal').addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeSummaryModal();
            }
        });

        // Drag and drop on the entire input section
        const inputSection = document.querySelector('.input-section');
        inputSection.addEventListener('dragover', (e) => {
            e.preventDefault();
            inputSection.style.background = 'var(--shadow-light)';
        });
        
        inputSection.addEventListener('dragleave', (e) => {
            if (!inputSection.contains(e.relatedTarget)) {
                inputSection.style.background = 'var(--bg-secondary)';
            }
        });
        
        inputSection.addEventListener('drop', (e) => {
            e.preventDefault();
            inputSection.style.background = 'var(--bg-secondary)';
            this.handleFileSelection(e.dataTransfer.files);
        });
    }

    handleInputChange(value) {
        const trimmedValue = value.trim();
        
        // Clear file selection if user types in input
        if (trimmedValue && this.selectedFile) {
            this.removeFile();
        }
        
        // Update button states
        this.updateButtonStates();
    }



    handleFileSelection(files) {
        if (!files || files.length === 0) return;
        
        const file = files[0]; // Take only the first file
        
        // Clear input field if file is selected
        const mainInput = document.getElementById('main-input');
        if (mainInput.value.trim()) {
            mainInput.value = '';
        }
        
        this.selectedFile = file;
        this.showFileDisplay(file);
        this.updateButtonStates();
    }

    showFileDisplay(file) {
        const fileDisplay = document.getElementById('file-display');
        const fileName = document.getElementById('file-name');
        
        fileName.textContent = file.name;
        fileDisplay.style.display = 'block';
    }

    removeFile() {
        this.selectedFile = null;
        document.getElementById('file-display').style.display = 'none';
        document.getElementById('file-input').value = '';
        this.updateButtonStates();
    }

    updateButtonStates() {
        const mainInput = document.getElementById('main-input');
        const uploadBtn = document.getElementById('upload-btn');
        const summarizeBtn = document.getElementById('summarize-btn');
        
        const hasText = mainInput.value.trim().length > 0;
        const hasFile = this.selectedFile !== null;
        
        // Upload button: disabled if there's text in input
        if (hasText) {
            uploadBtn.classList.add('disabled');
        } else {
            uploadBtn.classList.remove('disabled');
        }
        
        // Summarize button: enabled if there's text or file selected
        if (hasText || hasFile) {
            summarizeBtn.classList.remove('disabled');
        } else {
            summarizeBtn.classList.add('disabled');
        }
    }

    isValidUrl(string) {
        try {
            new URL(string);
            return true;
        } catch (_) {
            return false;
        }
    }



    showStatus(message, progress = 0) {
        const statusSection = document.getElementById('status-section');
        const statusMessage = document.getElementById('status-message');
        const progressFill = document.getElementById('progress-fill');
        
        statusSection.style.display = 'block';
        statusMessage.textContent = message;
        progressFill.style.width = `${progress}%`;
    }

    hideStatus() {
        document.getElementById('status-section').style.display = 'none';
    }

    async startSummarization() {
        const summarizeBtn = document.getElementById('summarize-btn');
        if (summarizeBtn.classList.contains('disabled')) {
            return;
        }

        const mainInput = document.getElementById('main-input');
        const url = mainInput.value.trim();

        try {
            if (this.selectedFile) {
                // Process file
                this.showStatus(`Processing ${this.selectedFile.name}...`, 25);
                await this.simulateProcessing();
                
                const summary = {
                    id: Date.now().toString(),
                    title: `${this.selectedFile.name} Summary`,
                    content: this.generateMockSummary('file'),
                    source: { type: 'file', filename: this.selectedFile.name },
                    createdAt: new Date(),
                    metadata: { wordCount: 250, processingTime: 4.1 }
                };
                
                this.addSummary(summary);
                this.removeFile();
                
            } else if (url) {
                // TODO: Detect URL type and validate URL
                // For now, process as generic content
                this.showStatus('Processing content...', 25);
                await this.simulateProcessing();
                
                const summary = {
                    id: Date.now().toString(),
                    title: 'Content Summary',
                    content: this.generateMockSummary('url'),
                    source: { type: 'url', originalUrl: url },
                    createdAt: new Date(),
                    metadata: { wordCount: 200, processingTime: 3.2 }
                };
                
                this.addSummary(summary);
                mainInput.value = '';
            }
            
            this.hideStatus();
            this.updateButtonStates();
            
        } catch (error) {
            console.error('Error during summarization:', error);
            alert('Error during processing. Please try again.');
            this.hideStatus();
        }
    }

    generateMockSummary(type) {
        const summaries = {
            url: `1. The primary concept explored in this content demonstrates how information architecture influences user decision-making processes.

This fundamental principle reveals that the way information is structured and presented directly impacts how users navigate, understand, and act upon content. When information is logically organized with clear hierarchies and intuitive pathways, users can more efficiently process complex data and make informed decisions. The architecture serves as a cognitive framework that reduces mental load and guides attention to the most relevant elements.

2. Effective content strategy requires balancing comprehensive coverage with accessible presentation to maximize knowledge retention.

The challenge lies in distilling complex topics into digestible formats without losing essential nuance or depth. This involves strategic use of progressive disclosure, where basic concepts are presented first, followed by more detailed explanations for those seeking deeper understanding. The goal is to create multiple entry points for different audience needs while maintaining coherence across all levels of detail.`,

            youtube: `1. The speaker establishes that mastering any complex skill requires understanding the underlying principles rather than memorizing surface-level techniques.

This approach shifts focus from rote learning to conceptual understanding, enabling learners to adapt their knowledge to new situations. When you grasp the fundamental principles governing a domain, you can derive specific techniques as needed rather than relying on memorized procedures. This creates more flexible, transferable knowledge that remains valuable even as specific tools and methods evolve.

2. Consistent practice with immediate feedback creates the optimal learning environment for skill development and knowledge retention.

The feedback loop between action and result allows for rapid adjustment and improvement. Without this immediate response, learners may reinforce incorrect patterns or miss opportunities for optimization. The key is creating systems that provide clear, actionable feedback that directly relates to the desired outcome, enabling continuous refinement of both understanding and execution.`,

            playlist: `1. The series demonstrates that comprehensive learning requires systematic progression through interconnected concepts rather than isolated topic consumption.

Each video builds upon previous knowledge while introducing new elements that expand understanding. This scaffolded approach ensures that complex ideas are properly supported by foundational concepts, preventing knowledge gaps that could undermine later learning. The sequential structure also allows for reinforcement of key principles across multiple contexts, strengthening retention and application ability.

2. Effective educational content balances theoretical frameworks with practical applications to maximize both understanding and usability.

The combination of conceptual explanation and real-world examples creates multiple pathways for comprehension. Theoretical frameworks provide the structural understanding necessary for principled thinking, while practical applications demonstrate relevance and utility. This dual approach accommodates different learning preferences and ensures that knowledge can be both understood intellectually and applied practically.`,

            file: `1. The document establishes that systematic analysis of complex information requires structured approaches that break down overwhelming content into manageable components.

This methodology involves identifying key themes, extracting essential arguments, and understanding the relationships between different concepts. By applying consistent analytical frameworks, readers can navigate dense material more effectively and retain important insights. The structure provides a cognitive scaffold that supports deeper comprehension and enables more effective knowledge synthesis.

2. Critical evaluation of source material demands understanding both explicit content and implicit assumptions that shape the presented arguments.

Every document contains underlying premises and contextual factors that influence its conclusions. Effective analysis requires identifying these foundational assumptions and evaluating their validity within the broader context. This deeper level of engagement reveals not just what the content says, but why it says it and what limitations might affect its applicability to different situations.`
        };
        
        return summaries[type] || summaries.url;
    }

    async simulateProcessing(duration = 2000) {
        return new Promise(resolve => setTimeout(resolve, duration));
    }

    addSummary(summary) {
        this.summaries.unshift(summary);
        this.saveSummaries();
        this.renderSummaries();
    }

    loadSummaries() {
        const saved = localStorage.getItem('sawron-summaries');
        if (saved) {
            this.summaries = JSON.parse(saved).map(s => ({
                ...s,
                createdAt: new Date(s.createdAt)
            }));
        }
        this.renderSummaries();
    }

    saveSummaries() {
        localStorage.setItem('sawron-summaries', JSON.stringify(this.summaries));
    }

    renderSummaries() {
        const grid = document.getElementById('summaries-grid');
        
        if (this.summaries.length === 0) {
            grid.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🎯</div>
                    <h3>Ready to Process Knowledge</h3>
                    <p>Start by entering a URL, YouTube video, or uploading a document above.</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = this.summaries.map(summary => `
            <div class="summary-card" onclick="app.showSummaryModal('${summary.id}')">
                <div class="summary-header">
                    <span class="summary-type">${this.getTypeLabel(summary.source.type)}</span>
                    <span class="summary-date">${this.formatDate(summary.createdAt)}</span>
                </div>
                <h3 class="summary-title">${summary.title}</h3>
                <p class="summary-preview">${summary.content.substring(0, 150)}...</p>
            </div>
        `).join('');
    }

    filterSummaries(searchTerm, type) {
        let filtered = this.summaries;
        
        if (type !== 'all') {
            filtered = filtered.filter(s => s.source.type === type);
        }
        
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(s => 
                s.title.toLowerCase().includes(term) ||
                s.content.toLowerCase().includes(term)
            );
        }
        
        const grid = document.getElementById('summaries-grid');
        if (filtered.length === 0) {
            grid.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🔍</div>
                    <h3>No Results Found</h3>
                    <p>Try adjusting your search or filter criteria.</p>
                </div>
            `;
            return;
        }
        
        grid.innerHTML = filtered.map(summary => `
            <div class="summary-card" onclick="app.showSummaryModal('${summary.id}')">
                <div class="summary-header">
                    <span class="summary-type">${this.getTypeLabel(summary.source.type)}</span>
                    <span class="summary-date">${this.formatDate(summary.createdAt)}</span>
                </div>
                <h3 class="summary-title">${summary.title}</h3>
                <p class="summary-preview">${summary.content.substring(0, 150)}...</p>
            </div>
        `).join('');
    }

    showSummaryModal(summaryId) {
        const summary = this.summaries.find(s => s.id === summaryId);
        if (!summary) return;

        document.getElementById('modal-title').textContent = summary.title;
        document.getElementById('summary-meta').innerHTML = `
            <strong>Source:</strong> ${this.getSourceDisplay(summary.source)}<br>
            <strong>Created:</strong> ${this.formatDate(summary.createdAt)}<br>
            <strong>Word Count:</strong> ${summary.metadata.wordCount} words<br>
            <strong>Processing Time:</strong> ${summary.metadata.processingTime}s
        `;
        document.getElementById('summary-content').innerHTML = this.formatContent(summary.content);
        document.getElementById('summary-modal').style.display = 'block';
    }

    closeSummaryModal() {
        document.getElementById('summary-modal').style.display = 'none';
    }

    getTypeLabel(type) {
        const labels = {
            'url': '🌐 Web',
            'youtube': '📺 YouTube',
            'playlist': '📋 YouTube Playlist',
            'file': '📄 Document'
        };
        return labels[type] || type;
    }

    getSourceDisplay(source) {
        switch (source.type) {
            case 'url':
                return source.originalUrl;
            case 'youtube':
                return `${source.videoTitle} (${source.originalUrl})`;
            case 'playlist':
                return `${source.videoTitle} from playlist`;
            case 'file':
                return source.filename;
            default:
                return 'Unknown';
        }
    }

    formatDate(date) {
        return new Intl.DateTimeFormat('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(date);
    }

    formatContent(content) {
        return content.split('\n').map(line => {
            if (line.match(/^\d+\./)) {
                return `<p><strong>${line}</strong></p>`;
            }
            return `<p>${line}</p>`;
        }).join('');
    }
}

// Global functions for HTML onclick handlers
async function pasteFromClipboard() {
    try {
        const text = await navigator.clipboard.readText();
        const mainInput = document.getElementById('main-input');
        mainInput.value = text;
        app.handleInputChange(text);
    } catch (err) {
        console.error('Failed to read clipboard:', err);
        alert('Unable to access clipboard. Please paste manually.');
    }
}

function triggerFileUpload() {
    const uploadBtn = document.getElementById('upload-btn');
    if (!uploadBtn.classList.contains('disabled')) {
        document.getElementById('file-input').click();
    }
}

function startSummarization() {
    app.startSummarization();
}

function removeFile() {
    app.removeFile();
}

function closeSummaryModal() {
    app.closeSummaryModal();
}

// Initialize app
const app = new SawronApp();