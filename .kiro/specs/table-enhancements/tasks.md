# Implementation Plan

- [x] 1. Fix Processing Queue Settings arrows duplication
  - Remove duplicate arrow controls in AI Settings modal
  - Ensure only one set of increment/decrement arrows exists
  - _Requirements: Processing Queue Settings fix_

- [x] 2. Implement Name column in table structure
  - [x] 2.1 Add name extraction logic to createTableRow method
    - Write extractItemName() method to handle YouTube videos, documents, and websites
    - Implement name truncation for display (30 character limit)
    - Add fallback logic for unknown or processing items
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_
  
  - [x] 2.2 Update table row generation to include Name column
    - Modify createTableRow() to include name cell as second column
    - Ensure proper HTML structure with name-cell class
    - Add title attribute for full name on hover
    - _Requirements: 1.1, 1.5_

- [x] 3. Implement checkbox selection functionality
  - [x] 3.1 Add checkbox event handlers and state management
    - Implement handleRowSelection() method for individual checkbox changes
    - Add selectedItems Set to track selected item IDs
    - Update bulk actions bar visibility based on selection state
    - _Requirements: 2.1, 2.2, 2.3, 2.4_
  
  - [x] 3.2 Implement header checkbox and select all functionality
    - Add toggleSelectAll() method for header checkbox and button
    - Implement indeterminate state for partial selections
    - Update select all button text based on selection state
    - _Requirements: 2.5, 3.1, 3.2, 3.3, 3.4_
  
  - [x] 3.3 Add selected count display and UI updates
    - Implement getSelectedIds() helper method
    - Update selected count display in bulk actions bar
    - Show/hide bulk actions bar based on selection state
    - _Requirements: 3.5, 2.3, 2.4_

- [x] 4. Create backend bulk operations API endpoints
  - [x] 4.1 Implement bulk download API endpoint
    - Create POST /api/summaries/bulk-download route in server.js
    - Add logic to generate single PDF or ZIP with multiple PDFs
    - Implement ZIP file creation using archiver library
    - Add proper error handling for individual item failures
    - _Requirements: 4.1, 4.2, 4.3, 4.4_
  
  - [x] 4.2 Implement bulk delete API endpoint
    - Create POST /api/summaries/bulk-delete route in server.js
    - Add logic to delete multiple summaries with error resilience
    - Return deletion count and any errors that occurred
    - Ensure database consistency during bulk operations
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 5. Implement frontend bulk actions functionality
  - [x] 5.1 Add bulk download functionality
    - Implement bulkDownload() method in SawronApp class
    - Handle single item PDF download vs multiple item ZIP download
    - Add proper file download handling with blob URLs
    - Implement error handling and user feedback
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
  
  - [x] 5.2 Add bulk delete functionality
    - Implement bulkDelete() method in SawronApp class
    - Add confirmation dialog with item count display
    - Handle API response and refresh knowledge base
    - Hide bulk actions bar after successful deletion
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 6. Update table rendering to support all new features
  - Modify renderFilteredKnowledgeBase() to handle empty state with correct colspan
  - Update createTableRow() to include checkbox and name columns
  - Ensure proper event handler binding for checkboxes
  - Test table rendering with various data states
  - _Requirements: 1.1, 2.1, 2.2_

- [ ] 7. Add comprehensive error handling and user feedback
  - Implement error handling for network failures in bulk operations
  - Add loading states and progress indicators for bulk actions
  - Ensure graceful degradation when individual items fail
  - Add user-friendly error messages and success notifications
  - _Requirements: 4.4, 4.5, 5.4, 5.5_