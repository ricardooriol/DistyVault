# Content Extraction Fixes Requirements

## Introduction

The content extraction system is currently failing to extract content from both YouTube videos with transcripts and PDF files. The YouTube extractor is returning 0 segments even for videos that have transcripts available, and the PDF extractor is parsing successfully but extracting 0 characters of content. Additionally, YouTube URLs with playlist parameters are being incorrectly labeled as "YouTube Playlist" instead of "YouTube Video".

## Requirements

### Requirement 1: Fix YouTube Transcript Extraction

**User Story:** As a user, I want to extract transcripts from YouTube videos that have captions available, so that I can summarize the video content.

#### Acceptance Criteria

1. WHEN a YouTube video with available transcripts is processed THEN the system SHALL extract the transcript text successfully
2. WHEN the transcript extraction is attempted THEN the system SHALL try multiple language options (en, auto-generated, etc.)
3. WHEN transcript extraction fails for one method THEN the system SHALL attempt alternative extraction approaches
4. WHEN transcript segments are found THEN the system SHALL properly concatenate them into readable text
5. IF no transcript is available THEN the system SHALL provide meaningful fallback content with video metadata

### Requirement 2: Fix YouTube URL Classification

**User Story:** As a user, I want YouTube videos to be correctly identified as "YouTube Video" regardless of playlist parameters, so that the content type is accurately displayed.

#### Acceptance Criteria

1. WHEN a YouTube URL contains playlist parameters (e.g., &list=) THEN the system SHALL still classify it as "YouTube Video"
2. WHEN extracting video metadata THEN the system SHALL focus on the individual video, not the playlist
3. WHEN displaying the content type THEN the system SHALL show "YouTube Video" for individual video URLs

### Requirement 3: Fix PDF Content Extraction

**User Story:** As a user, I want to extract text content from PDF files, so that I can summarize document content.

#### Acceptance Criteria

1. WHEN a PDF file is processed THEN the system SHALL extract readable text content
2. WHEN PDF parsing reports success with pages THEN the system SHALL ensure text extraction also succeeds
3. WHEN the primary PDF extraction method fails THEN the system SHALL attempt alternative extraction methods
4. WHEN PDF contains scanned images or complex layouts THEN the system SHALL provide appropriate fallback content
5. IF PDF extraction yields empty content THEN the system SHALL implement OCR or alternative text extraction methods

### Requirement 4: Improve Error Handling and Logging

**User Story:** As a developer, I want detailed logging and error handling for content extraction, so that I can diagnose and fix extraction issues.

#### Acceptance Criteria

1. WHEN content extraction fails THEN the system SHALL log detailed error information
2. WHEN extraction methods are attempted THEN the system SHALL log which methods are being tried
3. WHEN fallback methods are used THEN the system SHALL clearly indicate this in the logs
4. WHEN extraction succeeds THEN the system SHALL log the amount of content extracted and method used

### Requirement 5: Robust Fallback Mechanisms

**User Story:** As a user, I want the system to provide meaningful content even when primary extraction fails, so that I always get some useful information.

#### Acceptance Criteria

1. WHEN primary extraction fails THEN the system SHALL provide descriptive fallback content
2. WHEN fallback content is used THEN the system SHALL include available metadata (title, file size, etc.)
3. WHEN no content can be extracted THEN the system SHALL explain why extraction failed
4. WHEN providing fallback content THEN the system SHALL ensure it's substantial enough for summarization