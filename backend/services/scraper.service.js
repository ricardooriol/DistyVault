const axios = require('axios');
const cheerio = require('cheerio');
const { JSDOM } = require('jsdom');
const createDOMPurify = require('dompurify');

class WebScraperService {
    constructor() {
        const window = new JSDOM('').window;
        this.DOMPurify = createDOMPurify(window);
    }

    /**
     * Scrape content from a URL
     * @param {string} url - The URL to scrape
     * @returns {Promise<Object>} The scraped content and metadata
     */
    async scrapeUrl(url) {
        try {
            const response = await axios.get(url);
            const $ = cheerio.load(response.data);
            
            // Remove unwanted elements
            $('script').remove();
            $('style').remove();
            $('nav').remove();
            $('header').remove();
            $('footer').remove();
            $('aside').remove();
            $('.advertisement').remove();
            $('#comments').remove();

            // Get main content
            const title = $('title').text();
            let mainContent = '';

            // Try to find the main content area
            const mainSelectors = ['article', 'main', '.content', '.post-content', '.article-content'];
            for (const selector of mainSelectors) {
                const element = $(selector);
                if (element.length > 0) {
                    mainContent = element.text();
                    break;
                }
            }

            // If no main content found, get body text
            if (!mainContent) {
                mainContent = $('body').text();
            }

            // Clean the text
            const cleanText = this.DOMPurify.sanitize(mainContent)
                .replace(/\\s+/g, ' ')
                .replace(/\\n+/g, '\\n')
                .trim();

            return {
                title,
                content: cleanText,
                url,
                metadata: {
                    date: new Date().toISOString(),
                    source: 'web'
                }
            };
        } catch (error) {
            console.error('Error scraping URL:', error);
            throw error;
        }
    }
}

module.exports = new WebScraperService();
