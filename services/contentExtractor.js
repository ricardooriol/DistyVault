/**
 * Content Extractor service for SAWRON
 * Handles extraction of content from various sources
 */
const axios = require('axios');
const cheerio = require('cheerio');
const { YoutubeTranscript } = require('youtube-transcript');
const pdf = require('pdf-parse');
const mammoth = require('mammoth');
const fs = require('fs').promises;
const path = require('path');

class ContentExtractor {
    /**
     * Extract content from a URL
     * @param {string} url - The URL to extract content from
     * @returns {Promise<{text: string, title: string}>} - The extracted content and title
     */
    async extractFromUrl(url) {
        try {
            console.log(`Starting content extraction from URL: ${url}`);
            const startTime = Date.now();
            
            // Check if it's a YouTube URL
            if (this.isYoutubeUrl(url)) {
                console.log(`Detected YouTube URL, extracting transcript...`);
                const result = await this.extractFromYoutube(url);
                
                const duration = (Date.now() - startTime) / 1000;
                console.log(`YouTube transcript extraction completed in ${duration.toFixed(2)}s`);
                console.log(`Extracted ${result.text.length} characters of transcript`);
                
                return result;
            }
            
            // Otherwise, treat as a regular web page
            console.log(`Fetching web page content...`);
            const response = await axios.get(url, {
                timeout: 30000, // 30 second timeout for initial fetch
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });
            
            console.log(`Web page fetched successfully (${response.data.length} bytes)`);
            
            const $ = cheerio.load(response.data);
            
            // Extract title
            const title = $('title').text() || url;
            console.log(`Page title: "${title}"`);
            
            // Remove unwanted elements
            console.log(`Cleaning page content...`);
            $('script, style, nav, footer, header, aside, .ads, .comments, .sidebar').remove();
            
            // Extract main content
            let content = '';
            
            // Try to find main content container
            const mainSelectors = ['main', 'article', '.content', '.post', '.entry', '#content', '.main'];
            let mainContent = null;
            
            for (const selector of mainSelectors) {
                if ($(selector).length) {
                    console.log(`Found main content using selector: ${selector}`);
                    mainContent = $(selector);
                    break;
                }
            }
            
            if (mainContent) {
                content = mainContent.text();
            } else {
                console.log(`No main content container found, using body content`);
                content = $('body').text();
            }
            
            // Clean up the text
            content = this.cleanText(content);
            
            const duration = (Date.now() - startTime) / 1000;
            console.log(`Web page extraction completed in ${duration.toFixed(2)}s`);
            console.log(`Extracted ${content.length} characters of content`);
            
            return { text: content, title };
        } catch (error) {
            console.error('Error extracting content from URL:', error);
            throw new Error(`Failed to extract content from URL: ${error.message}`);
        }
    }
    
    /**
     * Extract content from a YouTube video
     * @param {string} url - The YouTube URL
     * @returns {Promise<{text: string, title: string}>} - The extracted transcript and video title
     */
    async extractFromYoutube(url) {
        try {
            console.log(`Extracting transcript from YouTube URL: ${url}`);
            const startTime = Date.now();
            
            const videoId = this.extractYoutubeId(url);
            if (!videoId) {
                throw new Error('Invalid YouTube URL');
            }
            
            console.log(`Extracted video ID: ${videoId}`);
            
            // Get video info
            console.log(`Fetching video metadata...`);
            const videoInfoResponse = await axios.get(`https://www.youtube.com/oembed?url=${url}&format=json`);
            const title = videoInfoResponse.data.title || 'YouTube Video';
            console.log(`Video title: "${title}"`);
            
            // Get transcript
            console.log(`Fetching video transcript...`);
            const transcriptArray = await YoutubeTranscript.fetchTranscript(videoId);
            console.log(`Transcript fetched: ${transcriptArray.length} segments`);
            
            const transcript = transcriptArray
                .map(item => item.text)
                .join(' ');
            
            const duration = (Date.now() - startTime) / 1000;
            console.log(`YouTube transcript extraction completed in ${duration.toFixed(2)}s`);
            console.log(`Extracted ${transcript.length} characters of transcript`);
            
            return { text: transcript, title };
        } catch (error) {
            console.error('Error extracting YouTube transcript:', error);
            throw new Error(`Failed to extract YouTube transcript: ${error.message}`);
        }
    }
    
    /**
     * Extract content from a file
     * @param {Object} file - The file object
     * @returns {Promise<{text: string, title: string}>} - The extracted content and title
     */
    async extractFromFile(file) {
        try {
            console.log(`Starting content extraction from file: ${file.originalname}`);
            const startTime = Date.now();
            
            const filePath = file.path;
            const fileName = file.originalname || path.basename(filePath);
            const fileExt = path.extname(fileName).toLowerCase();
            
            console.log(`File type: ${fileExt}, Size: ${file.size} bytes`);
            
            let text = '';
            
            switch (fileExt) {
                case '.pdf':
                    console.log(`Processing PDF file...`);
                    const pdfData = await fs.readFile(filePath);
                    console.log(`PDF file read, parsing content...`);
                    const pdfResult = await pdf(pdfData);
                    text = pdfResult.text;
                    console.log(`PDF parsed successfully. Pages: ${pdfResult.numpages}`);
                    break;
                    
                case '.docx':
                    console.log(`Processing DOCX file...`);
                    const docxResult = await mammoth.extractRawText({ path: filePath });
                    text = docxResult.value;
                    console.log(`DOCX parsed successfully`);
                    break;
                    
                case '.txt':
                    console.log(`Processing TXT file...`);
                    text = await fs.readFile(filePath, 'utf8');
                    console.log(`TXT file read successfully`);
                    break;
                    
                default:
                    throw new Error(`Unsupported file type: ${fileExt}`);
            }
            
            // Clean the text
            const cleanedText = this.cleanText(text);
            
            const duration = (Date.now() - startTime) / 1000;
            console.log(`File extraction completed in ${duration.toFixed(2)}s`);
            console.log(`Extracted ${cleanedText.length} characters of content`);
            
            return { text: cleanedText, title: fileName };
        } catch (error) {
            console.error('Error extracting content from file:', error);
            throw new Error(`Failed to extract content from file: ${error.message}`);
        }
    }
    
    /**
     * Clean up extracted text
     * @param {string} text - The text to clean
     * @returns {string} - The cleaned text
     */
    cleanText(text) {
        return text
            .replace(/\s+/g, ' ')           // Replace multiple spaces with a single space
            .replace(/\n+/g, '\n')          // Replace multiple newlines with a single newline
            .replace(/\t/g, ' ')            // Replace tabs with spaces
            .trim();                        // Remove leading/trailing whitespace
    }
    
    /**
     * Check if a URL is a YouTube URL
     * @param {string} url - The URL to check
     * @returns {boolean} - True if the URL is a YouTube URL
     */
    isYoutubeUrl(url) {
        return url.includes('youtube.com/watch') || url.includes('youtu.be/');
    }
    
    /**
     * Extract the YouTube video ID from a URL
     * @param {string} url - The YouTube URL
     * @returns {string|null} - The YouTube video ID or null if not found
     */
    extractYoutubeId(url) {
        const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[7].length === 11) ? match[7] : null;
    }
}

module.exports = new ContentExtractor();