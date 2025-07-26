# Design Document

## Overview

This design document outlines the implementation of table enhancements for the SAWRON knowledge base interface. The enhancements include adding a Name column for better item identification, implementing checkbox-based row selection, and providing bulk actions for selected items. The design focuses on maintaining the existing functionality while adding new features seamlessly.

## Architecture

The table enhancements will be implemented using a client-server architecture:

- **Frontend**: Enhanced JavaScript functionality for table rendering, checkbox management, and bulk actions
- **Backend**: New API endpoints for bulk operations (download and delete)
- **Data Flow**: Existing database operations extended with bulk processing capabilities

## Components and Interfaces

### Frontend Components

#### 1. Enhanced Table Structure
- **Name Column**: Second column after checkbox, displays extracted names from various sources
- **Checkbox Column**: First column with individual row checkboxes and header checkbox
- **Bulk Actions Bar**: Appears above table when items are selected

#### 2. JavaScript Classes and Methods

**SawronApp Class Extensions**:
```javascript
// New methods to add:
- handleRowSelection(): Manages checkbox state and bulk actions visibility
- toggleSelectAll(): Handles select all/unselect all functionality  
- getSelectedIds(): Returns array of selected item IDs
- bulkDownload(): Downloads single PDF or ZIP with multiple PDFs
- bulkDelete(): Deletes multiple selected items
- extractItemName(): Extracts display name from item data
```

#### 3. Bulk Actions Bar Component
- **Select All/Unselect All Button**: Toggles based on current selection state
- **Download Button**: Smart download (PDF for single, ZIP for multiple)
- **Delete Button**: Bulk deletion with confirmation
- **Selected Count Display**: Shows number of selected items

### Backend Components

#### 1. New API Endpoints

**POST /api/summaries/bulk-download**
- Input: `{ ids: string[] }`
- Output: ZIP file with PDFs or single PDF
- Logic: Generate PDFs for each ID, create ZIP if multiple

**POST /api/summaries/bulk-delete**
- Input: `{ ids: string[] }`
- Output: `{ deletedCount: number, errors: any[] }`
- Logic: Delete each summary, continue on errors

#### 2. Enhanced PDF Generation
- Extend existing PDF generation to handle bulk operations
- ZIP file creation using archiver library
- Error handling for individual item failures

## Data Models

### Frontend State Management

```javascript
// Selection state tracking
selectedItems: Set<string> // Track selected item IDs
bulkActionsVisible: boolean // Control bulk actions bar visibility
```

### API Request/Response Models

```javascript
// Bulk download request
{
  ids: string[] // Array of summary IDs
}

// Bulk delete request  
{
  ids: string[] // Array of summary IDs
}

// Bulk delete response
{
  deletedCount: number,
  errors: Array<{
    id: string,
    error: string
  }>
}
```

### Name Extraction Logic

```javascript
// Name extraction priority:
1. YouTube videos: Use video title
2. Documents: Use filename without extension  
3. Websites: Use hostname or page title
4. Fallback: "Unknown" or processing status
```

## Error Handling

### Frontend Error Handling
- **Network Errors**: Display user-friendly messages for API failures
- **Selection Errors**: Validate selection state before operations
- **Download Errors**: Handle blob creation and file download failures
- **Bulk Operation Errors**: Show progress and partial success messages

### Backend Error Handling
- **Individual Item Failures**: Continue processing other items, return error details
- **ZIP Creation Errors**: Fallback to individual downloads
- **Database Errors**: Proper transaction handling for bulk operations
- **File System Errors**: Handle missing files gracefully

## Testing Strategy

### Unit Tests
- **Name Extraction**: Test various source types and edge cases
- **Selection Management**: Test checkbox state synchronization
- **Bulk Operations**: Test single vs multiple item handling
- **Error Scenarios**: Test partial failures and recovery

### Integration Tests
- **API Endpoints**: Test bulk download and delete operations
- **File Generation**: Test PDF and ZIP creation
- **Database Operations**: Test bulk delete transactions
- **End-to-End**: Test complete user workflows

### Manual Testing Scenarios
1. **Name Display**: Verify names show correctly for all source types
2. **Selection Flow**: Test individual and bulk selection patterns
3. **Download Flow**: Test single PDF and multi-item ZIP downloads
4. **Delete Flow**: Test bulk deletion with confirmation
5. **Error Handling**: Test network failures and partial successes
6. **Processing Queue**: Verify single set of arrows in settings

## Implementation Phases

### Phase 1: Frontend Table Structure
- Add Name column to table header and rows
- Implement name extraction logic
- Update table rendering to include checkboxes
- Fix Processing Queue Settings arrows

### Phase 2: Selection Management
- Implement checkbox event handlers
- Add bulk actions bar with show/hide logic
- Implement select all/unselect all functionality
- Add selected count display

### Phase 3: Backend Bulk Operations
- Create bulk download API endpoint
- Create bulk delete API endpoint
- Implement ZIP file generation
- Add error handling for bulk operations

### Phase 4: Frontend Bulk Actions
- Implement bulk download functionality
- Implement bulk delete functionality
- Add user feedback and error handling
- Integrate with existing UI patterns

### Phase 5: Testing and Polish
- Add comprehensive error handling
- Test all user scenarios
- Optimize performance for large selections
- Ensure accessibility compliance