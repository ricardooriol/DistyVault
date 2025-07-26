# Requirements Document

## Introduction

This feature enhances the knowledge base table in the SAWRON application by adding a Name column for better item identification, implementing checkbox-based row selection, and providing bulk actions for selected items. The goal is to improve user experience by making it easier to identify, select, and perform actions on multiple knowledge base items simultaneously.

## Requirements

### Requirement 1

**User Story:** As a user, I want to see a clear name for each knowledge base item, so that I can easily identify YouTube videos, documents, and websites without having to look at the full URL or source details.

#### Acceptance Criteria

1. WHEN the knowledge base table is rendered THEN the system SHALL display a "Name" column as the second column (after checkbox)
2. WHEN a YouTube video is processed THEN the system SHALL display the video title as the name
3. WHEN a document is processed THEN the system SHALL display the document filename without extension as the name
4. WHEN a website is processed THEN the system SHALL display the website name/hostname as the name
5. WHEN the name is longer than 30 characters THEN the system SHALL truncate it with ellipsis

### Requirement 2

**User Story:** As a user, I want to select individual knowledge base items using checkboxes, so that I can perform bulk actions on multiple items at once.

#### Acceptance Criteria

1. WHEN the knowledge base table is rendered THEN the system SHALL display a checkbox as the first column of each row
2. WHEN a user clicks a row checkbox THEN the system SHALL update the selection state for that item
3. WHEN any checkbox is selected THEN the system SHALL show the bulk actions bar
4. WHEN no checkboxes are selected THEN the system SHALL hide the bulk actions bar
5. WHEN the header checkbox is clicked THEN the system SHALL toggle selection for all visible items

### Requirement 3

**User Story:** As a user, I want to use a "Select All" toggle button, so that I can quickly select or deselect all items without clicking individual checkboxes.

#### Acceptance Criteria

1. WHEN at least one item is selected THEN the system SHALL display a "Select All" button in the bulk actions bar
2. WHEN not all items are selected AND the "Select All" button is clicked THEN the system SHALL select all visible items
3. WHEN all items are selected THEN the system SHALL change the button text to "Unselect All"
4. WHEN all items are selected AND the "Unselect All" button is clicked THEN the system SHALL deselect all items
5. WHEN the selection state changes THEN the system SHALL update the selected count display

### Requirement 4

**User Story:** As a user, I want to download selected items in bulk, so that I can save multiple summaries efficiently without downloading them one by one.

#### Acceptance Criteria

1. WHEN items are selected THEN the system SHALL display a "Download" button in the bulk actions bar
2. WHEN exactly one item is selected AND the download button is clicked THEN the system SHALL download that item as a PDF
3. WHEN multiple items are selected AND the download button is clicked THEN the system SHALL create and download a ZIP file containing all PDFs
4. WHEN the download fails THEN the system SHALL display an appropriate error message
5. WHEN the download succeeds THEN the system SHALL provide user feedback

### Requirement 5

**User Story:** As a user, I want to delete selected items in bulk, so that I can remove multiple unwanted summaries quickly.

#### Acceptance Criteria

1. WHEN items are selected THEN the system SHALL display a "Delete" button in the bulk actions bar
2. WHEN the delete button is clicked THEN the system SHALL show a confirmation dialog with the count of items to be deleted
3. WHEN the user confirms deletion THEN the system SHALL delete all selected items
4. WHEN the user cancels deletion THEN the system SHALL not delete any items
5. WHEN deletion completes THEN the system SHALL refresh the knowledge base and hide the bulk actions bar