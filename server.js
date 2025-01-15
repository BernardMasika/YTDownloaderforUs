const express = require('express');
const ytdlp = require('yt-dlp-exec');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Check if ffmpeg is installed
function checkFFmpeg() {
    return new Promise((resolve, reject) => {
        exec('ffmpeg -version', (error) => {
            if (error) {
                reject(new Error('FFmpeg is not installed. Please install FFmpeg to merge video and audio.'));
            } else {
                resolve(true);
            }
        });
    });
}

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/get-info', async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) {
            return res.status(400).json({ error: 'Please provide a YouTube URL' });
        }

        const videoInfo = await ytdlp(url, {
            dumpSingleJson: true,
            noCheckCertificates: true,
            noWarnings: true
        });

        // Get the best audio format
        const bestAudio = videoInfo.formats
            .filter(f => f.acodec !== 'none' && f.vcodec === 'none')
            .sort((a, b) => (b.filesize || 0) - (a.filesize || 0))[0];

        // Get all video formats and combine them with best audio
        const formats = videoInfo.formats
            .filter(f => {
                // Get formats that either:
                // 1. Have both video and audio (combined formats)
                // 2. Have only video (will be merged with audio)
                return (f.vcodec !== 'none' && f.acodec !== 'none') ||
                    (f.vcodec !== 'none' && f.acodec === 'none');
            })
            .map(f => {
                const needsAudio = f.acodec === 'none';
                return {
                    formatId: needsAudio ? `${f.format_id}+${bestAudio.format_id}` : f.format_id,
                    ext: 'mp4',
                    resolution: `${f.width || 0}x${f.height || 0}`,
                    height: f.height || 0,
                    filesize: (f.filesize || f.filesize_approx || 0) +
                        (needsAudio ? (bestAudio.filesize || 0) : 0),
                    quality: `${f.height || 0}p${f.fps ? ` ${f.fps}fps` : ''}`,
                    fps: f.fps,
                    vcodec: f.vcodec,
                    acodec: needsAudio ? bestAudio.acodec : f.acodec
                };
            })
            .filter(f => f.height > 0)
            .sort((a, b) => b.height - a.height);

        // Remove duplicates by resolution
        const uniqueFormats = formats.reduce((acc, current) => {
            const x = acc.find(item => item.height === current.height);
            if (!x) return acc.concat([current]);
            // If a format with this height exists, prefer the one with better fps
            if (current.fps > x.fps) {
                acc[acc.indexOf(x)] = current;
            }
            return acc;
        }, []);

        console.log('Available formats:', uniqueFormats);

        res.json({
            title: videoInfo.title,
            thumbnail: videoInfo.thumbnail,
            duration: videoInfo.duration,
            formats: uniqueFormats
        });
    } catch (error) {
        console.error('Error getting video info:', error);
        res.status(500).json({ error: error.message || 'Failed to get video information' });
    }
});

app.post('/download', async (req, res) => {
    try {
        // First check if ffmpeg is installed
        await checkFFmpeg();

        const { url, formatId } = req.body;
        if (!url || !formatId) {
            return res.status(400).json({ error: 'Please provide both URL and format ID' });
        }

        const downloadDir = path.join(__dirname, 'downloads');
        if (!fs.existsSync(downloadDir)) {
            fs.mkdirSync(downloadDir);
        }

        const videoInfo = await ytdlp(url, {
            dumpSingleJson: true,
            noCheckCertificates: true,
            noWarnings: true
        });

        const videoTitle = videoInfo.title.replace(/[^\w\s]/gi, '_');
        const outputPath = path.join(downloadDir, `${videoTitle}.mp4`);

        console.log('Starting download with format ID:', formatId);

        // Updated download options
        await ytdlp(url, {
            output: outputPath,
            format: formatId,
            mergeOutputFormat: 'mp4',
            embedThumbnail: true,
            addMetadata: true,
            noCheckCertificates: true,
            noWarnings: true
        });

        res.json({
            message: 'Download completed successfully',
            filename: `${videoTitle}.mp4`
        });
    } catch (error) {
        console.error('Download error:', error);
        if (error.message.includes('FFmpeg is not installed')) {
            res.status(500).json({
                error: 'FFmpeg is not installed. Please install FFmpeg to merge video and audio.',
                details: 'Visit https://ffmpeg.org/download.html for installation instructions.'
            });
        } else {
            res.status(500).json({ error: error.message || 'Download failed' });
        }
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Access the downloader at http://localhost:${PORT}`);
});