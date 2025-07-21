const { YoutubeTranscript } = require('youtube-transcript');
const ytdl = require('ytdl-core');
const axios = require('axios');

class YouTubeService {
    /**
     * Get video information and transcript
     * @param {string} videoUrl - YouTube video URL
     * @returns {Promise<Object>} Video info and transcript
     */
    async getVideoInfo(videoUrl) {
        try {
            // Extract video ID from URL
            const videoId = ytdl.getVideoID(videoUrl);
            
            // Get video details
            const info = await ytdl.getInfo(videoId);
            const videoDetails = {
                title: info.videoDetails.title,
                author: info.videoDetails.author.name,
                description: info.videoDetails.description,
            };

            // Get transcript
            const transcript = await YoutubeTranscript.fetchTranscript(videoId);
            const fullTranscript = transcript.map(t => t.text).join(' ');

            return {
                ...videoDetails,
                transcript: fullTranscript,
            };
        } catch (error) {
            console.error('Error fetching YouTube video:', error);
            throw error;
        }
    }

    /**
     * Get all videos from a playlist
     * @param {string} playlistUrl - YouTube playlist URL
     * @returns {Promise<Array>} Array of video information
     */
    async getPlaylistVideos(playlistUrl) {
        try {
            // Implementation for playlist handling
            // You'll need to use the YouTube Data API for this
            // Will return an array of video URLs that can be processed individually
        } catch (error) {
            console.error('Error fetching playlist:', error);
            throw error;
        }
    }
}

module.exports = new YouTubeService();
