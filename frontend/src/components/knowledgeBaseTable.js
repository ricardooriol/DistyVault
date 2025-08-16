/**
 * KnowledgeBaseTable Component
 * Handles table rendering, interaction, and data management for the knowledge base
 */
class KnowledgeBaseTable {
    constructor(app) {
        this.app = app;
        this.knowledgeBase = [];
        this.currentFilter = 'all';
        this.clearingSelections = false;
        this.openDropdownId = null;
        
        // Event handlers
        this.documentClickHandler = null;
        this.keyboardHandler = null;
        this.scrollHandler = null;
    }

    /**
     * Initialize the table component
     */
    init() {
        this.setupEventListeners();
    }

    /**
     * Set up event listeners for table interactions
     */
    setupEventListeners() {
        // Search and filter
        const searchInput = DomUtils.getElementById('search-input');
        const filterSelect = DomUtils.getElementById('filter-select');
        
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filterKnowledgeBase(e.target.value, this.currentFilter);
            });
        }

        if (filterSelect) {
            filterSelect.addEventListener('change', (e) => {
                this.currentFilter = e.target.value;
                this.filterKnowledgeBase(DomUtils.getElementById('search-input').value, this.currentFilter);
            });
        }
    }

    /**
     * Load and render the knowledge base data
     */
    async loadKnowledgeBase() {
        try {
            const data = await this.app.apiClient.getSummaries();

            // Validate data structure
            if (!Array.isArray(data)) {
                throw new Error('Invalid data format received from server');
            }

            this.knowledgeBase = this.sortKnowledgeBaseItems(data);
            this.renderKnowledgeBase();

            // Ensure bulk actions bar visibility is correct after initial load
            this.app.updateBulkActionsBar();
        } catch (error) {
            console.error('Error loading knowledge base:', error);
            this.renderErrorState(error);
        }
    }

    /**
     * Filter knowledge base by search term and type
     */
    filterKnowledgeBase(searchTerm, type) {
        let filtered = this.knowledgeBase;

        if (type !== 'all') {
            filtered = filtered.filter(s => s.sourceType === type);
        }

        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(s =>
                (s.title && s.title.toLowerCase().includes(term)) ||
                (s.content && s.content.toLowerCase().includes(term))
            );
        }

        // Sort items by status priority and then by start time
        filtered = this.sortKnowledgeBaseItems(filtered);
        this.renderFilteredKnowledgeBase(filtered);
    }

    /**
     * Sort knowledge base items by queued time (createdAt) descending - oldest first
     */
    sortKnowledgeBaseItems(items) {
        return items.sort((a, b) => {
            // Sort by createdAt (oldest first) to maintain queue order
            const aTime = new Date(a.createdAt || 0);
            const bTime = new Date(b.createdAt || 0);
            return aTime - bTime;
        });
    }

    /**
     * Render the complete knowledge base table
     */
    renderKnowledgeBase() {
        const searchTerm = DomUtils.getElementById('search-input').value;
        this.filterKnowledgeBase(searchTerm, this.currentFilter);
    }

    /**
     * Render filtered knowledge base data
     */
    renderFilteredKnowledgeBase(items) {
        const tbody = DomUtils.getElementById('knowledge-base-tbody');
        const bulkActionsBar = DomUtils.getElementById('bulk-actions-bar');
        
        // Store currently open dropdown to restore after rendering
        const openDropdown = document.querySelector('.action-dropdown.show');
        this.openDropdownId = openDropdown ? openDropdown.closest('tr').dataset.id : null;

        if (!items || items.length === 0) {
            tbody.innerHTML = this.createEmptyState();
            // Hide bulk actions bar when empty and clear selections
            if (bulkActionsBar) {
                bulkActionsBar.style.display = 'none';
                this.app.selectedItems.clear();
            }
            return;
        }

        tbody.innerHTML = items.map(item => this.createTableRow(item)).join('');

        // Show bulk actions bar when there are items
        if (bulkActionsBar && this.knowledgeBase && this.knowledgeBase.length > 0) {
            bulkActionsBar.style.display = 'flex';
        }

        // Fix any text overflow issues after rendering
        this.fixTextOverflow();

        // Restore checkbox states after rendering
        this.restoreCheckboxStates();

        // Restore dropdown state after rendering
        if (this.openDropdownId) {
            const restoredDropdown = document.querySelector(`tr[data-id="${this.openDropdownId}"] .action-dropdown`);
            if (restoredDropdown) {
                restoredDropdown.classList.add('show');
                this.addDropdownEventListeners();
            }
        }
    }

    /**
     * Create empty state HTML
     */
    createEmptyState() {
        return `
            <tr>
                <td colspan="8" class="empty-state-cell">
                    <div class="empty-state">
                        <div class="empty-icon">🎯</div>
                        <h3>Ready to Process Knowledge</h3>
                        <p>Start by entering a URL, YouTube video, or uploading a document above.</p>
                    </div>
                </td>
            </tr>
        `;
    }

    /**
     * Create error state HTML
     */
    renderErrorState(error) {
        const tbody = DomUtils.getElementById('knowledge-base-tbody');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="empty-state-cell">
                        <div class="empty-state">
                            <div class="empty-icon">⚠️</div>
                            <h3>Failed to Load Knowledge Base</h3>
                            <p>Unable to connect to server. Please check your connection and try again.</p>
                            <button onclick="app.knowledgeBaseTable.loadKnowledgeBase()" style="margin-top: 1rem; padding: 0.5rem 1rem; background: var(--primary-orange); color: white; border: none; border-radius: 4px; cursor: pointer;">Retry</button>
                        </div>
                    </td>
                </tr>
            `;
        }
        // Hide bulk actions bar when there's an error and no data
        const bulkActionsBar = DomUtils.getElementById('bulk-actions-bar');
        if (bulkActionsBar) {
            bulkActionsBar.style.display = 'none';
        }
    }

    /**
     * Create a single table row
     */
    createTableRow(item) {
        const isSelected = this.clearingSelections ? false : this.app.selectedItems.has(item.id);
        const status = item.status;
        const isCompleted = status === 'completed';
        const isProcessing = ['pending', 'extracting', 'distilling'].includes(status);
        const isError = status === 'error';

        // Enhanced status mapping with more granular stages
        const statusConfig = this.getStatusConfig(status);
        const statusClass = statusConfig.class;
        const statusIcon = statusConfig.icon;
        const statusText = statusConfig.text;

        // Extract name for display
        const fullName = this.extractItemName(item);
        const name = fullName.length > 100 ? fullName.substring(0, 97) + '...' : fullName;

        // Format source display
        const sourceDisplay = this.formatSourceDisplay(item);

        // Format status display with step
        const statusDisplay = `<span class="status-icon">${statusIcon}</span><span class="status-text">${statusText}</span>`;

        // Format processing time with live chronometer
        const processingTimeDisplay = DateUtils.calculateProcessingTimeDisplay(item);

        // Format created date
        const createdAt = new Date(item.createdAt);
        const formattedDate = this.formatDate(createdAt);

        // Format actions as dropdown
        const actions = this.createActionsDropdown(item);

        return `
            <tr data-id="${item.id}">
                <td class="checkbox-column">
                    <input type="checkbox" class="row-checkbox" data-id="${item.id}" onchange="app.handleRowSelection()" ${isSelected ? 'checked' : ''}>
                </td>
                <td class="name-cell truncate-text" data-tooltip="${fullName}">${name}</td>
                <td class="source-cell truncate-text" data-tooltip="${item.sourceUrl || (item.sourceFile ? item.sourceFile.name : '')}">${sourceDisplay}</td>
                <td class="type-cell">${this.getTypeLabel(item.sourceType)}</td>
                <td class="status-cell ${statusClass}">${statusDisplay}</td>
                <td class="time-cell">${processingTimeDisplay}</td>
                <td class="date-cell">${formattedDate}</td>
                <td class="actions-cell">${actions}</td>
            </tr>
        `;
    }

    /**
     * Get status configuration for display
     */
    getStatusConfig(status) {
        const STATUS_CONFIG = {
            'pending': { icon: '⏳', text: 'QUEUED', class: 'status-queued' },
            'extracting': { icon: '🔍', text: 'EXTRACTING', class: 'status-processing' },
            'distilling': { icon: '💠', text: 'DISTILLING', class: 'status-processing' },
            'completed': { icon: '✅', text: 'COMPLETED', class: 'status-completed' },
            'error': { icon: '❌', text: 'ERROR', class: 'status-error' },
            'stopped': { icon: '⏹️', text: 'STOPPED', class: 'status-stopped' }
        };
        return STATUS_CONFIG[status] || STATUS_CONFIG['pending'];
    }

    /**
     * Create actions dropdown for a table row
     */
    createActionsDropdown(item) {
        const isCompleted = item.status === 'completed';
        const isProcessing = ['pending', 'extracting', 'distilling'].includes(item.status);
        const isError = item.status === 'error';

        return `
            <div class="action-dropdown" onclick="app.knowledgeBaseTable.toggleActionDropdown(event, '${item.id}')">
                <button class="action-dropdown-btn">
                    Action
                    <span style="font-size: 0.7rem;">▼</span>
                </button>
                <div class="action-dropdown-content" id="dropdown-${item.id}" onclick="event.stopPropagation()">
                    ${isCompleted ? `
                        <button class="action-dropdown-item" onclick="event.stopPropagation(); app.showDistillationModal('${item.id}'); app.knowledgeBaseTable.closeAllDropdowns();">
                            📄 View
                        </button>
                        <button class="action-dropdown-item" id="download-btn-${item.id}" 
                                onclick="event.stopPropagation(); app.handleDownloadClick('${item.id}'); app.knowledgeBaseTable.closeAllDropdowns();">
                            <span class="btn-icon">📥</span>
                            <span class="btn-text">Download</span>
                        </button>
                    ` : ''}
                    ${isProcessing ? `
                        <button class="action-dropdown-item" onclick="event.stopPropagation(); app.stopProcessing('${item.id}'); app.knowledgeBaseTable.closeAllDropdowns();">
                            ⏹️ Stop
                        </button>
                    ` : ''}
                    <button class="action-dropdown-item retry-item" onclick="event.stopPropagation(); app.retryDistillation('${item.id}'); app.knowledgeBaseTable.closeAllDropdowns();">
                        🔄 Retry
                    </button>
                    ${(isCompleted || isError) && item.rawContent ? `
                        <button class="action-dropdown-item" onclick="event.stopPropagation(); app.showRawContent('${item.id}'); app.knowledgeBaseTable.closeAllDropdowns();">
                            🔍 View Raw
                        </button>
                    ` : ''}
                    <button class="action-dropdown-item" onclick="event.stopPropagation(); app.showLogs('${item.id}'); app.knowledgeBaseTable.closeAllDropdowns();">
                        📋 Logs
                    </button>
                    <button class="action-dropdown-item delete-item" onclick="event.stopPropagation(); app.deleteDistillation('${item.id}'); app.knowledgeBaseTable.closeAllDropdowns();">
                        🗑️ Delete
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Extract item name from title, URL, or file
     */
    extractItemName(item) {
        let name = '';

        if (item.title && item.title !== 'Processing...' && !item.title.includes('Processing')) {
            name = item.title;
        } else if (item.sourceUrl) {
            // Extract name from URL
            try {
                const url = new URL(item.sourceUrl);
                if (url.hostname.includes('youtube.com') || url.hostname.includes('youtu.be')) {
                    name = 'YouTube Video';
                } else {
                    name = url.hostname.replace('www.', '');
                }
            } catch {
                name = 'Web Page';
            }
        } else if (item.sourceFile) {
            // Remove extension from file name
            name = item.sourceFile.name.replace(/\.[^/.]+$/, '');
        }

        return name;
    }

    /**
     * Format source display for table cell
     */
    formatSourceDisplay(item) {
        let sourceDisplay = '';
        if (item.sourceUrl) {
            const truncatedUrl = this.truncateText(item.sourceUrl, 40);
            sourceDisplay = `<a href="${item.sourceUrl}" target="_blank" class="source-link" title="${item.sourceUrl}">${truncatedUrl}</a>`;
        } else if (item.sourceFile) {
            const truncatedFileName = this.truncateText(item.sourceFile.name, 30);
            sourceDisplay = `<span class="file-source" title="${item.sourceFile.name}">${truncatedFileName}</span>`;
        }
        return sourceDisplay;
    }

    /**
     * Get type label for display
     */
    getTypeLabel(type) {
        const labels = {
            'url': '🌐 Web',
            'youtube': '📺 YouTube',
            'file': '📄 Document'
        };
        return labels[type] || type;
    }

    /**
     * Format date for display
     */
    formatDate(date) {
        return new Intl.DateTimeFormat('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(date);
    }

    /**
     * Truncate text to specified length
     */
    truncateText(text, maxLength) {
        if (!text || text.length <= maxLength) {
            return text;
        }
        return text.substring(0, maxLength - 3) + '...';
    }

    /**
     * Update a single row in the table
     */
    updateSingleRow(item) {
        const row = document.querySelector(`tr[data-id="${item.id}"]`);
        if (!row) return;

        // Check if this is a processing item with live chronometer
        const isProcessing = ['pending', 'extracting', 'distilling'].includes(item.status);
        const hasStartTime = item.startTime;
        const shouldPreserveTime = isProcessing && hasStartTime;

        if (shouldPreserveTime) {
            // Update individual cells to preserve the live chronometer
            this.updateRowCellsSelectively(row, item);
        } else {
            // Replace the entire row for non-processing items
            const newRowHtml = this.createTableRow(item);
            row.outerHTML = newRowHtml;
        }
    }

    /**
     * Update specific cells in a row while preserving time cell
     */
    updateRowCellsSelectively(row, item) {
        const statusConfig = this.getStatusConfig(item.status);
        const statusClass = statusConfig.class;
        const statusText = statusConfig.text;
        const statusDisplay = `<span class="status-icon">${statusConfig.icon}</span>${statusText}`;

        // Update status cell
        const statusCell = row.querySelector('.status-cell');
        if (statusCell) {
            statusCell.className = `status-cell ${statusClass} truncate-text`;
            statusCell.innerHTML = statusDisplay;
        }

        // Update title cell if it changed
        const titleCell = row.querySelector('.title-cell');
        if (titleCell && item.title) {
            const truncatedTitle = item.title.length > 50 ? item.title.substring(0, 50) + '...' : item.title;
            titleCell.textContent = truncatedTitle;
            titleCell.setAttribute('data-tooltip', item.title);
        }

        // Update actions cell
        const actionsCell = row.querySelector('.actions-cell');
        if (actionsCell) {
            actionsCell.innerHTML = this.createActionsDropdown(item);
        }
    }

    /**
     * Add a single row to the table
     */
    addSingleRow(item) {
        const tbody = DomUtils.getElementById('knowledge-base-tbody');
        const newRowHtml = this.createTableRow(item);

        // Check if table is empty (has empty state)
        const emptyState = tbody.querySelector('.empty-state-cell');
        if (emptyState) {
            tbody.innerHTML = newRowHtml;
        } else {
            // Add to the beginning of the table
            tbody.insertAdjacentHTML('afterbegin', newRowHtml);
        }
    }

    /**
     * Fix text overflow issues after rendering
     */
    fixTextOverflow() {
        const nameElements = document.querySelectorAll('.name-cell');
        const statusElements = document.querySelectorAll('.status-cell');
        const sourceElements = document.querySelectorAll('.source-cell');

        [...nameElements, ...statusElements, ...sourceElements].forEach(element => {
            if (element.scrollWidth > element.clientWidth) {
                element.style.overflow = 'hidden';
                element.style.textOverflow = 'ellipsis';
                element.style.whiteSpace = 'nowrap';
                element.style.maxWidth = '0';
                element.style.minWidth = '0';
            }
        });
    }

    /**
     * Restore checkbox states after rendering
     */
    restoreCheckboxStates() {
        this.app.selectedItems.forEach(id => {
            const checkbox = document.querySelector(`.row-checkbox[data-id="${id}"]`);
            if (checkbox) {
                checkbox.checked = true;
            }
        });

        // Update UI based on current selection
        this.app.handleRowSelection();
    }

    /**
     * Toggle action dropdown for a row
     */
    toggleActionDropdown(event, id) {
        event.stopPropagation();

        // Close all other dropdowns and remove row classes
        document.querySelectorAll('.action-dropdown').forEach(dropdown => {
            if (dropdown !== event.currentTarget) {
                dropdown.classList.remove('show');
                const parentRow = dropdown.closest('tr');
                if (parentRow) {
                    parentRow.classList.remove('dropdown-open');
                }
            }
        });

        // Toggle current dropdown
        const dropdown = event.currentTarget;
        const isOpen = dropdown.classList.toggle('show');
        const parentRow = dropdown.closest('tr');

        if (isOpen) {
            if (parentRow) {
                parentRow.classList.add('dropdown-open');
            }

            const dropdownContent = dropdown.querySelector('.action-dropdown-content');
            if (dropdownContent) {
                dropdownContent.style.zIndex = '2147483647';
                dropdownContent.style.position = 'fixed';
            }

            this.positionDropdown(dropdown);
            this.addDropdownEventListeners();
        } else {
            if (parentRow) {
                parentRow.classList.remove('dropdown-open');
            }
            this.removeDropdownEventListeners();
        }
    }

    /**
     * Position dropdown intelligently within viewport
     */
    positionDropdown(dropdown) {
        const dropdownContent = dropdown.querySelector('.action-dropdown-content');
        if (!dropdownContent) return;

        dropdownContent.style.position = 'fixed';
        dropdownContent.style.zIndex = '2147483647';

        const triggerRect = dropdown.getBoundingClientRect();
        const dropdownRect = dropdownContent.getBoundingClientRect();
        const viewport = {
            width: window.innerWidth,
            height: window.innerHeight
        };

        let top = triggerRect.bottom + 4;
        let left = triggerRect.right - dropdownRect.width;

        // Adjust horizontal position if dropdown extends beyond viewport
        if (left < 10) {
            left = triggerRect.left;
        }
        if (left + dropdownRect.width > viewport.width - 10) {
            left = viewport.width - dropdownRect.width - 10;
        }

        // Adjust vertical position if dropdown extends beyond viewport
        if (top + dropdownRect.height > viewport.height - 10) {
            top = triggerRect.top - dropdownRect.height - 4;
        }
        if (top < 10) {
            top = 10;
        }

        dropdownContent.style.top = `${top}px`;
        dropdownContent.style.left = `${left}px`;
        dropdownContent.style.right = 'auto';
        dropdownContent.style.bottom = 'auto';
        dropdownContent.style.zIndex = '2147483647';
    }

    /**
     * Add dropdown event listeners
     */
    addDropdownEventListeners() {
        this.removeDropdownEventListeners();

        this.documentClickHandler = (event) => {
            const openDropdown = document.querySelector('.action-dropdown.show');
            if (openDropdown && !openDropdown.contains(event.target)) {
                openDropdown.classList.remove('show');
                const parentRow = openDropdown.closest('tr');
                if (parentRow) {
                    parentRow.classList.remove('dropdown-open');
                }
                this.removeDropdownEventListeners();
            }
        };

        this.keyboardHandler = (event) => {
            if (event.key === 'Escape') {
                const openDropdown = document.querySelector('.action-dropdown.show');
                if (openDropdown) {
                    openDropdown.classList.remove('show');
                    const parentRow = openDropdown.closest('tr');
                    if (parentRow) {
                        parentRow.classList.remove('dropdown-open');
                    }
                    this.removeDropdownEventListeners();
                }
            }
        };

        this.scrollHandler = () => {
            const openDropdown = document.querySelector('.action-dropdown.show');
            if (openDropdown) {
                openDropdown.classList.remove('show');
                const parentRow = openDropdown.closest('tr');
                if (parentRow) {
                    parentRow.classList.remove('dropdown-open');
                }
                this.removeDropdownEventListeners();
            }
        };

        document.addEventListener('click', this.documentClickHandler);
        document.addEventListener('keydown', this.keyboardHandler);
        document.addEventListener('scroll', this.scrollHandler, true);
    }

    /**
     * Remove dropdown event listeners
     */
    removeDropdownEventListeners() {
        if (this.documentClickHandler) {
            document.removeEventListener('click', this.documentClickHandler);
            this.documentClickHandler = null;
        }
        if (this.keyboardHandler) {
            document.removeEventListener('keydown', this.keyboardHandler);
            this.keyboardHandler = null;
        }
        if (this.scrollHandler) {
            document.removeEventListener('scroll', this.scrollHandler, true);
            this.scrollHandler = null;
        }
    }

    /**
     * Close all open dropdowns
     */
    closeAllDropdowns() {
        document.querySelectorAll('.action-dropdown.show').forEach(dropdown => {
            dropdown.classList.remove('show');
            const parentRow = dropdown.closest('tr');
            if (parentRow) {
                parentRow.classList.remove('dropdown-open');
            }
        });
        this.removeDropdownEventListeners();
    }

    /**
     * Update processing times for live chronometer
     */
    updateProcessingTimes() {
        const processingItems = this.knowledgeBase.filter(item =>
            ['extracting', 'distilling'].includes(item.status) && item.startTime
        );

        processingItems.forEach(item => {
            const row = document.querySelector(`tr[data-id="${item.id}"]`);
            if (row) {
                const timeCell = row.querySelector('.time-cell');
                if (timeCell) {
                    const timeDisplay = DateUtils.calculateProcessingTimeDisplay(item);

                    if (timeDisplay && timeCell.textContent !== timeDisplay) {
                        timeCell.textContent = timeDisplay;
                    }
                }
            }
        });
    }
}

// Export for use in other modules
window.KnowledgeBaseTable = KnowledgeBaseTable;