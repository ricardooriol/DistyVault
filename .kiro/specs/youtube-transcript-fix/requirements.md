# Requirements Document

## Introduction

The YouTube transcript extraction feature is the most critical component of the SAWRON project, enabling users to extract and summarize content from YouTube videos. Currently, the system has multiple extraction strategies but is failing to successfully extract transcripts, causing the summarization process to fail. This feature must be robust, reliable, and provide clear error messaging when transcripts are unavailable.

## Requirements

### Requirement 1

**User Story:** As a user, I want to extract transcripts from YouTube videos with captions, so that I can summarize and analyze the video content.

#### Acceptance Criteria

1. WHEN a YouTube URL with available captions is provided THEN the system SHALL successfully extract the complete transcript text
2. WHEN the transcript is extracted THEN the system SHALL return the full text content with proper formatting and timing information removed
3. WHEN multiple caption languages are available THEN the system SHALL prioritize English captions first, then fall back to the first available language
4. WHEN the extraction is successful THEN the system SHALL log the success with transcript length and method used

### Requirement 2

**User Story:** As a user, I want clear error messages when transcript extraction fails, so that I understand why the summarization cannot proceed.

#### Acceptance Criteria

1. WHEN a YouTube video has no captions available THEN the system SHALL fail with a clear message "Unable to extract transcript: No captions available for this video"
2. WHEN transcript extraction fails for technical reasons THEN the system SHALL log detailed error information and return a specific failure message
3. WHEN all extraction strategies fail THEN the system SHALL NOT create fallback content but SHALL fail the summarization process
4. WHEN extraction fails THEN the logs SHALL contain sufficient debugging information to identify the root cause

### Requirement 3

**User Story:** As a developer, I want robust extraction strategies that work with current YouTube infrastructure, so that the system remains functional as YouTube changes.

#### Acceptance Criteria

1. WHEN the primary extraction method fails THEN the system SHALL attempt alternative extraction strategies in order of reliability
2. WHEN YouTube's page structure changes THEN the system SHALL have multiple parsing approaches to maintain functionality
3. WHEN extraction strategies are attempted THEN each SHALL be logged with detailed success/failure information
4. WHEN a strategy succeeds THEN the system SHALL use that method and not attempt additional strategies

### Requirement 4

**User Story:** As a user, I want the transcript extraction to work with various YouTube URL formats, so that I can use any valid YouTube link.

#### Acceptance Criteria

1. WHEN a standard YouTube watch URL is provided THEN the system SHALL extract the video ID and process the transcript
2. WHEN a youtu.be short URL is provided THEN the system SHALL extract the video ID and process the transcript
3. WHEN a YouTube embed URL is provided THEN the system SHALL extract the video ID and process the transcript
4. WHEN an invalid YouTube URL is provided THEN the system SHALL return a clear error message about the invalid URL format

### Requirement 5

**User Story:** As a system administrator, I want comprehensive logging of transcript extraction attempts, so that I can monitor system performance and troubleshoot issues.

#### Acceptance Criteria

1. WHEN transcript extraction begins THEN the system SHALL log the video ID and URL being processed
2. WHEN each extraction strategy is attempted THEN the system SHALL log the strategy name and detailed results
3. WHEN extraction succeeds THEN the system SHALL log the successful method, transcript length, and processing time
4. WHEN extraction fails THEN the system SHALL log all attempted strategies and their specific failure reasons