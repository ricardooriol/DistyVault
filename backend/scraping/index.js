// Scraping and parsing utilities
const axios = require('axios');
const cheerio = require('cheerio');
const { getYoutubeTranscript, getPlaylistTranscripts } = require('./youtube');
const { parseFile } = require('./file');

async function scrapeUrl(url) {
  const { data } = await axios.get(url);
  const $ = cheerio.load(data);
  return $('body').text();
}

module.exports = { scrapeUrl, getYoutubeTranscript, getPlaylistTranscripts, parseFile };
