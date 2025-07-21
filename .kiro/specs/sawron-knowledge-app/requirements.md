# Requirements Document

## Introduction

SAWRON (CONNECT THE DOTS & FILL THE GAPS) is a fully local knowledge processing application that runs in the browser via localhost. The application leverages a local LLM (Phi4-mini via Ollama) to provide extensive, dense summaries of various content types including web pages, YouTube videos, playlists, and document files. The goal is to enable rapid knowledge acquisition by distilling essential information while removing non-important content, with all processing and storage happening locally without requiring external subscriptions.

## Requirements

### Requirement 1

**User Story:** As a knowledge seeker, I want to input URLs from websites and have their text content scraped and summarized, so that I can quickly absorb key information without reading entire articles.

#### Acceptance Criteria

1. WHEN a user enters a website URL THEN the system SHALL scrape the text content from that webpage
2. WHEN text content is successfully scraped THEN the system SHALL send it to the local Ollama LLM for processing
3. WHEN the LLM processes the content THEN the system SHALL generate an extensive, dense summary following the specified lesson format
4. WHEN a summary is generated THEN the system SHALL save it to the local database with metadata including source URL and timestamp
5. IF a URL cannot be accessed or scraped THEN the system SHALL display an appropriate error message

### Requirement 2

**User Story:** As a knowledge seeker, I want to input YouTube video URLs and have their transcripts extracted and summarized, so that I can learn from video content without watching the entire video.

#### Acceptance Criteria

1. WHEN a user enters a YouTube video URL THEN the system SHALL extract the video transcript
2. WHEN a transcript is successfully extracted THEN the system SHALL send it to the local Ollama LLM for processing
3. WHEN the LLM processes the transcript THEN the system SHALL generate an extensive, dense summary following the specified lesson format
4. WHEN a summary is generated THEN the system SHALL save it to the local database with metadata including video title, URL, and timestamp
5. IF a video has no transcript or transcript cannot be accessed THEN the system SHALL display an appropriate error message

### Requirement 3

**User Story:** As a knowledge seeker, I want to input YouTube playlist URLs and have all videos in the playlist processed automatically, so that I can efficiently learn from entire course series or topic collections.

#### Acceptance Criteria

1. WHEN a user enters a YouTube playlist URL THEN the system SHALL extract all video URLs from that playlist
2. WHEN video URLs are extracted THEN the system SHALL process each video's transcript sequentially
3. WHEN each transcript is processed THEN the system SHALL generate individual summaries for each video
4. WHEN all videos are processed THEN the system SHALL save each summary to the local database with appropriate metadata
5. WHEN processing a playlist THEN the system SHALL display progress indicators showing current video being processed
6. IF any video in the playlist fails to process THEN the system SHALL continue with remaining videos and report failed items

### Requirement 4

**User Story:** As a knowledge seeker, I want to upload text files (TXT, PDF, DOCX) and have their contents summarized, so that I can quickly extract knowledge from documents and research papers.

#### Acceptance Criteria

1. WHEN a user uploads a supported file type (TXT, PDF, DOCX) THEN the system SHALL extract the text content from the file
2. WHEN text content is successfully extracted THEN the system SHALL send it to the local Ollama LLM for processing
3. WHEN the LLM processes the content THEN the system SHALL generate an extensive, dense summary following the specified lesson format
4. WHEN a summary is generated THEN the system SHALL save it to the local database with metadata including filename and timestamp
5. WHEN processing large files THEN the system SHALL handle them efficiently without browser crashes
6. IF a file cannot be read or is corrupted THEN the system SHALL display an appropriate error message

### Requirement 5

**User Story:** As a knowledge seeker, I want all my summaries to be stored locally and accessible through a web interface, so that I can review my accumulated knowledge anytime without losing data.

#### Acceptance Criteria

1. WHEN summaries are generated THEN the system SHALL store them in a local database
2. WHEN a user accesses the application THEN the system SHALL display all previously generated summaries
3. WHEN displaying summaries THEN the system SHALL show metadata including source, date, and content type
4. WHEN a user clicks on a summary THEN the system SHALL display the full summary content
5. WHEN the application is restarted THEN all previously saved summaries SHALL remain accessible
6. WHEN storing summaries THEN the system SHALL organize them chronologically with search capabilities

### Requirement 6

**User Story:** As a knowledge seeker, I want the LLM processing to happen entirely locally through Ollama, so that I maintain privacy and avoid subscription costs.

#### Acceptance Criteria

1. WHEN the application starts THEN the system SHALL connect to the local Ollama instance
2. WHEN processing content THEN the system SHALL use the Phi4-mini model for summarization
3. WHEN sending content to the LLM THEN the system SHALL use the specified detailed prompt format
4. WHEN the LLM is unavailable THEN the system SHALL display an error message with troubleshooting guidance
5. IF Ollama is not running THEN the system SHALL provide clear instructions for starting the service

### Requirement 7

**User Story:** As a knowledge seeker, I want a clean, intuitive web interface accessible via localhost, so that I can easily input content and manage my knowledge base.

#### Acceptance Criteria

1. WHEN accessing localhost THEN the system SHALL display a clean, responsive web interface
2. WHEN using the interface THEN the system SHALL provide clear input methods for URLs, files, and playlists
3. WHEN processing content THEN the system SHALL show progress indicators and status updates
4. WHEN viewing summaries THEN the system SHALL provide an organized, searchable list view
5. WHEN the interface loads THEN the system SHALL work entirely offline after initial setup
6. WHEN using different browsers THEN the system SHALL maintain consistent functionality and appearance