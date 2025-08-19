// Bulk Actions Management System
class BulkActionsManager {
    constructor(app) {
        this.app = app;
        this.selectedItems = new Set();
    }

    clearAllSelections() {
        // Clear the selectedItems set
        this.selectedItems.clear();

        // Uncheck all checkboxes in the DOM
        const allCheckboxes = document.querySelectorAll('.row-checkbox');
        allCheckboxes.forEach(checkbox => checkbox.checked = false);

        // Update the bulk actions bar
        this.updateBulkActionsBar();
    }

    forceBulkActionsRefresh() {
        // Force clear selections and refresh bulk actions bar
        this.selectedItems.clear();

        // Uncheck all checkboxes in the DOM
        const allCheckboxes = document.querySelectorAll('.row-checkbox');
        allCheckboxes.forEach(checkbox => {
            if (checkbox.checked) {
                checkbox.checked = false;
            }
        });

        // Force update the bulk actions bar
        this.updateBulkActionsBar();

        // Also call handleRowSelection to ensure consistency
        this.handleRowSelection();
    }

    nuclearSelectionReset() {
        // Complete reset of selection state
        this.selectedItems = new Set();

        // Uncheck ALL checkboxes
        const allCheckboxes = document.querySelectorAll('.row-checkbox');
        allCheckboxes.forEach(checkbox => checkbox.checked = false);

        // Update the bulk actions bar
        this.updateBulkActionsBar();
        const bulkDeleteBtn = document.getElementById('bulk-delete-btn');
        if (bulkDeleteBtn) bulkDeleteBtn.disabled = true;
    }

    handleRowSelection() {
        // Update selected items set based on checkbox states
        this.selectedItems.clear();
        const checkboxes = document.querySelectorAll('.row-checkbox:checked');
        checkboxes.forEach(checkbox => {
            this.selectedItems.add(checkbox.dataset.id);
        });

        // Update bulk actions bar visibility and content
        this.updateBulkActionsBar();
    }

    updateBulkActionsBar() {
        const bulkActionsBar = document.getElementById('bulk-actions-bar');
        const selectedCount = document.getElementById('selected-count');
        const bulkRetryBtn = document.getElementById('bulk-retry-btn');
        const bulkDownloadBtn = document.getElementById('bulk-download-btn');
        const bulkDeleteBtn = document.getElementById('bulk-delete-btn');
        const selectAllBtn = document.getElementById('select-all-btn');

        // Sync selectedItems with actual checked checkboxes to ensure consistency
        const checkedBoxes = document.querySelectorAll('.row-checkbox:checked');
        const actualSelectedIds = new Set(Array.from(checkedBoxes).map(cb => cb.dataset.id));

        // Also clean up selectedItems to remove any IDs that no longer exist in the DOM
        const allCheckboxIds = new Set(Array.from(document.querySelectorAll('.row-checkbox')).map(cb => cb.dataset.id));
        const cleanedSelectedItems = new Set();
        this.selectedItems.forEach(id => {
            if (allCheckboxIds.has(id)) {
                cleanedSelectedItems.add(id);
            }
        });

        // Update selectedItems to match actual DOM state (both checked and existing)
        this.selectedItems = actualSelectedIds;

        const selectedCount_value = this.selectedItems.size;
        const allCheckboxes = document.querySelectorAll('.row-checkbox');
        const totalCount = allCheckboxes.length;

        if (selectedCount_value > 0) {
            bulkActionsBar.style.display = 'flex';
            selectedCount.textContent = `${selectedCount_value} selected`;

            // Enable bulk action buttons
            bulkRetryBtn.disabled = false;
            bulkDeleteBtn.disabled = false;

            // Check if any selected items are completed for download
            const selectedItemsData = Array.from(this.selectedItems).map(id =>
                this.app.knowledgeBase.find(item => item.id === id)
            ).filter(Boolean);

            const hasCompletedItems = selectedItemsData.some(item => item.status === 'completed');

            // Only disable download button if no completed items AND not currently downloading
            const downloadState = this.app.downloadStateManager.getDownloadState('bulk-download-btn');
            if (downloadState.state === 'idle') {
                bulkDownloadBtn.disabled = !hasCompletedItems;
            }
            // If downloading, let the downloadStateManager handle the button state

            // Update select all button text based on actual selection state
            if (selectedCount_value === totalCount && totalCount > 0) {
                selectAllBtn.innerHTML = '<span class="btn-text">Unselect All</span>';
            } else {
                selectAllBtn.innerHTML = '<span class="btn-text">Select All</span>';
            }
        } else {
            bulkActionsBar.style.display = 'flex'; // Keep visible but disable buttons
            selectedCount.textContent = '0 selected';

            // Disable bulk action buttons
            bulkRetryBtn.disabled = true;
            bulkDeleteBtn.disabled = true;

            // Only disable download button if not currently downloading
            const downloadState = this.app.downloadStateManager.getDownloadState('bulk-download-btn');
            if (downloadState.state === 'idle') {
                bulkDownloadBtn.disabled = true;
            }

            // Reset select all button
            selectAllBtn.innerHTML = '<span class="btn-text">Select All</span>';
        }
    }

    toggleSelectAll() {
        const allCheckboxes = document.querySelectorAll('.row-checkbox');
        const checkedBoxes = document.querySelectorAll('.row-checkbox:checked');
        const shouldSelectAll = checkedBoxes.length !== allCheckboxes.length;

        if (shouldSelectAll) {
            // Select all
            allCheckboxes.forEach(checkbox => {
                checkbox.checked = true;
                this.selectedItems.add(checkbox.dataset.id);
            });
        } else {
            // Deselect all
            allCheckboxes.forEach(checkbox => {
                checkbox.checked = false;
            });
            this.selectedItems.clear();
        }

        this.updateBulkActionsBar();
    }

    getSelectedIds() {
        return Array.from(this.selectedItems);
    }

    handleBulkDownloadClick() {
        const buttonId = 'bulk-download-btn';
        const state = this.app.downloadStateManager.getDownloadState(buttonId);

        if (state.state === 'cancellable') {
            // Cancel the download
            this.app.downloadStateManager.cancelDownload(buttonId);
        } else {
            // Start the download
            this.bulkDownload();
        }
    }

    async bulkDownload() {
        const selectedIds = this.getSelectedIds();
        if (selectedIds.length === 0) {
            alert('Please select items to download');
            return;
        }

        // If only one item is selected, use single download logic but with bulk button state management
        if (selectedIds.length === 1) {
            this.downloadSingleFromBulk(selectedIds[0]);
            return;
        }

        const buttonId = 'bulk-download-btn';

        try {
            // Set loading state for bulk download
            const abortController = new AbortController();
            this.app.downloadStateManager.setDownloadState(buttonId, 'loading', {
                downloadId: 'bulk',
                abortController: abortController,
                startTime: Date.now()
            });

            // Request a ZIP file from the backend endpoint
            const result = await this.app.apiClient.bulkDownload(selectedIds, {
                signal: abortController.signal
            });

            // Handle the ZIP file download
            const blob = result.blob;
            const contentDisposition = result.headers.get('Content-Disposition');
            let filename = `distyvault-download.zip`; // Default filename

            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
                if (filenameMatch && filenameMatch[1]) {
                    filename = filenameMatch[1];
                }
            }

            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();

            // Wait a moment to ensure download has started before resetting state
            setTimeout(() => {
                this.app.downloadStateManager.setDownloadState(buttonId, 'idle');
            }, 1000);

            // Clean up after a delay
            setTimeout(() => {
                window.URL.revokeObjectURL(url);
                a.remove();
            }, 100);

        } catch (error) {
            // Check if the download was cancelled
            if (error.name === 'AbortError' || error.message === 'Request cancelled by user') {
                // Silently handle cancellation without logging
                this.app.downloadStateManager.setDownloadState(buttonId, 'idle');
                return;
            }
            
            if (typeof ErrorUtils !== 'undefined' && ErrorUtils.isUserCancellation && ErrorUtils.isUserCancellation(error)) {
                
                // Re-render table to update header and bulk actions bar visibility
                if (this.app.knowledgeBaseTable) {
                    this.app.knowledgeBaseTable.renderKnowledgeBase();
                }
                return;
            }
            
            const errorMessage = typeof ErrorUtils !== 'undefined' && ErrorUtils.handleApiError ? 
                ErrorUtils.handleApiError('bulk download', error, {
                    defaultMessage: 'Bulk download failed'
                }) : 'Bulk download failed';
            
            this.app.downloadStateManager.setDownloadState(buttonId, 'error', {
                errorMessage
            });
        }
    }

    async downloadSingleFromBulk(id) {
        const buttonId = 'bulk-download-btn';

        try {
            // Set loading state for bulk download button
            const abortController = new AbortController();
            this.app.downloadStateManager.setDownloadState(buttonId, 'loading', {
                downloadId: id,
                abortController: abortController,
                startTime: Date.now()
            });

            // Use the same logic as individual download but with bulk button state
            const result = await this.app.apiClient.downloadPdf(id, {
                signal: abortController.signal
            });

            // Handle the PDF download
            const blob = result.blob;
            const contentDisposition = result.headers.get('Content-Disposition');
            let filename = `distillation-${id}.pdf`; // Default filename

            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
                if (filenameMatch && filenameMatch[1]) {
                    filename = filenameMatch[1];
                }
            }

            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();

            // Wait a moment to ensure download has started before resetting state
            setTimeout(() => {
                this.app.downloadStateManager.setDownloadState(buttonId, 'idle');
            }, 1000);

            // Clean up after a delay
            setTimeout(() => {
                window.URL.revokeObjectURL(url);
                a.remove();
            }, 100);

        } catch (error) {
            // Check if the download was cancelled
            if (error.name === 'AbortError' || error.message === 'Request cancelled by user') {
                // Silently handle cancellation without logging
                this.app.downloadStateManager.setDownloadState(buttonId, 'idle');
                return;
            }
            
            if (typeof ErrorUtils !== 'undefined' && ErrorUtils.isUserCancellation && ErrorUtils.isUserCancellation(error)) {
                return;
            }
            
            const errorMessage = typeof ErrorUtils !== 'undefined' && ErrorUtils.handleApiError ? 
                ErrorUtils.handleApiError('single download from bulk', error, {
                    defaultMessage: 'Download failed'
                }) : 'Download failed';
            
            this.app.downloadStateManager.setDownloadState(buttonId, 'error', {
                errorMessage
            });
        }
    }

    async bulkDelete() {
        const selectedIds = this.getSelectedIds();
        if (selectedIds.length === 0) {
            alert('Please select items to delete');
            return;
        }

        const confirmMessage = selectedIds.length === 1
            ? 'Are you sure you want to delete this item? This action cannot be undone.'
            : `Are you sure you want to delete ${selectedIds.length} items? This action cannot be undone.`;

        if (!confirm(confirmMessage)) {
            return;
        }

        // Disable delete button during operation
        const deleteBtn = document.getElementById('bulk-delete-btn');
        const originalText = deleteBtn.innerHTML;
        deleteBtn.disabled = true;
        deleteBtn.innerHTML = '<span class="btn-icon">⏳</span><span class="btn-text">Deleting...</span>';

        try {
            const result = await this.app.apiClient.bulkDelete(selectedIds);
            // Show success/partial success feedback
            if (result.deletedCount === selectedIds.length) {
                const itemText = result.deletedCount === 1 ? 'item' : 'items';
                this.app.showTemporaryMessage(`Successfully deleted ${result.deletedCount} ${itemText}`, 'success');
            } else if (result.deletedCount > 0) {
                this.app.showTemporaryMessage(`Deleted ${result.deletedCount} of ${selectedIds.length} items. Some items could not be deleted.`, 'warning');
            } else {
                this.app.showTemporaryMessage('No items were deleted. Please try again.', 'error');
            }

            // Update local data
            this.app.knowledgeBase = this.app.knowledgeBase.filter(item => !selectedIds.includes(item.id));
            if (this.app.knowledgeBaseTable) {
                this.app.knowledgeBaseTable.knowledgeBase = this.app.knowledgeBase;
            }

            // Clear selection
            this.clearAllSelections();

            // Re-render table to update header, bulk actions bar, and empty state
            if (this.app.knowledgeBaseTable) {
                this.app.knowledgeBaseTable.renderKnowledgeBase();
            }

        } catch (error) {
            ErrorUtils.handleApiError('bulk delete', error, {
                showAlert: true,
                defaultMessage: 'Failed to delete items'
            });
        } finally {
            // Re-enable delete button
            deleteBtn.disabled = false;
            deleteBtn.innerHTML = originalText;
        }
    }

    async bulkRetry() {
        const selectedIds = this.getSelectedIds();
        if (selectedIds.length === 0) {
            alert('Please select items to retry.');
            return;
        }

        if (!confirm(`Are you sure you want to retry ${selectedIds.length} selected item(s)?`)) {
            return;
        }

        try {
            // Show initial message
            this.app.showTemporaryMessage(`Retrying ${selectedIds.length} selected items...`, 'info');

            // Process selected items from bottom to top (reverse order) with delay to ensure proper sequencing
            const idsToRetry = [...selectedIds].reverse();
            for (let i = 0; i < idsToRetry.length; i++) {
                const id = idsToRetry[i];
                // Add small delay between retries to ensure bottom-to-top processing order
                if (i > 0) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
                await this.app.retryDistillation(id, true); // Silent mode for bulk operations
            }

            // Show completion message
            this.app.showTemporaryMessage(`Successfully initiated retry for ${selectedIds.length} items`, 'success');

            // Clear selection after retry
            this.clearAllSelections();

            // Force status updates to detect new items
            this.app.forceStatusUpdate();
            setTimeout(() => this.app.forceStatusUpdate(), 500);
            setTimeout(() => this.app.forceStatusUpdate(), 1000);

        } catch (error) {
            ErrorUtils.handleApiError('retry selected items', error, {
                showAlert: true,
                defaultMessage: 'Error retrying selected items'
            });
        }
    }

    async bulkRetryAll() {
        if (!confirm('Are you sure you want to retry ALL items in the knowledge base? This will reprocess all distillations.')) {
            return;
        }

        try {
            const allItems = this.app.knowledgeBase;
            if (allItems.length === 0) {
                alert('No items to retry.');
                return;
            }

            // Show initial message
            this.app.showTemporaryMessage(`Retrying all ${allItems.length} items...`, 'info');

            // Process items from bottom to top (reverse order) with delay to ensure proper sequencing
            const itemsToRetry = [...allItems].reverse();
            for (let i = 0; i < itemsToRetry.length; i++) {
                const item = itemsToRetry[i];
                // Add small delay between retries to ensure bottom-to-top processing order
                if (i > 0) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
                await this.app.retryDistillation(item.id, true); // Silent mode for bulk operations
            }

            // Show completion message
            this.app.showTemporaryMessage(`Successfully initiated retry for all ${allItems.length} items`, 'success');

            // Force MULTIPLE immediate status updates after retry all
            this.app.forceStatusUpdate();
            setTimeout(() => this.app.forceStatusUpdate(), 100);
            setTimeout(() => this.app.forceStatusUpdate(), 500);
            setTimeout(() => this.app.forceStatusUpdate(), 1000);
            setTimeout(() => this.app.forceStatusUpdate(), 2000);

        } catch (error) {
            ErrorUtils.handleApiError('retry all items', error, {
                showAlert: true,
                defaultMessage: 'Error retrying all items'
            });
        }
    }

    async bulkRetryFailed() {
        try {
            const failedItems = this.app.knowledgeBase.filter(item => item.status === 'error');

            if (failedItems.length === 0) {
                alert('No failed items to retry');
                return;
            }

            if (!confirm(`Are you sure you want to retry ${failedItems.length} failed item(s)?`)) {
                return;
            }

            // Show initial message
            this.app.showTemporaryMessage(`Retrying ${failedItems.length} failed items...`, 'info');

            // Process failed items from bottom to top (reverse order) with delay to ensure proper sequencing
            const itemsToRetry = [...failedItems].reverse();
            for (let i = 0; i < itemsToRetry.length; i++) {
                const item = itemsToRetry[i];
                // Add small delay between retries to ensure bottom-to-top processing order
                if (i > 0) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
                await this.app.retryDistillation(item.id, true); // Silent mode for bulk operations
            }

            // Show completion message
            this.app.showTemporaryMessage(`Successfully initiated retry for ${failedItems.length} failed items`, 'success');

            // Force MULTIPLE immediate status updates after retry failed
            this.app.forceStatusUpdate();
            setTimeout(() => this.app.forceStatusUpdate(), 100);
            setTimeout(() => this.app.forceStatusUpdate(), 500);
            setTimeout(() => this.app.forceStatusUpdate(), 1000);
            setTimeout(() => this.app.forceStatusUpdate(), 2000);

        } catch (error) {
            ErrorUtils.handleApiError('retry failed items', error, {
                showAlert: true,
                defaultMessage: 'Error retrying failed items'
            });
        }
    }
}

// Export for use in other modules
window.BulkActionsManager = BulkActionsManager;