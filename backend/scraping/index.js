// Scraping and parsing utilities
const axios = require('axios');
const cheerio = require('cheerio');
const { getYoutubeTranscript, getPlaylistTranscripts } = require('./youtube');
const { parseFile } = require('./file');

async function scrapeUrl(url) {
  // 5 minute timeout for scraping
  const { data } = await axios.get(url, { timeout: 300000 });
  const $ = cheerio.load(data);
  return $('body').text();
}

module.exports = { scrapeUrl, getYoutubeTranscript, getPlaylistTranscripts, parseFile };
