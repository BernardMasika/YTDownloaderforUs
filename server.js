const express = require('express');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const os = require('os');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Path to yt-dlp binary (yt-dlp.exe should be in your project folder)
const YTDLP_PATH = path.join(__dirname, 'yt-dlp.exe');

// Progress tracking
let progressClients = [];

// Common options for yt-dlp
const commonOptions = {
    noCheckCertificates: true,
    noWarnings: true,
};

function ensureTrailersDirectory() {
    const desktopPath = path.join(os.homedir(), 'Desktop');
    const trailersPath = path.join(desktopPath, 'TRAILERS');

    if (!fs.existsSync(trailersPath)) {
        fs.mkdirSync(trailersPath, { recursive: true });
    }

    return trailersPath;
}

// Send progress to all connected clients
function sendProgress(data) {
    progressClients.forEach(client => {
        try {
            client.write(`data: ${JSON.stringify(data)}\n\n`);
        } catch (error) {
            // Client disconnected
        }
    });
}

function runYtDlp(args, trackProgress = false) {
    return new Promise((resolve, reject) => {
        console.log('Running yt-dlp with args:', args);

        const process = spawn(YTDLP_PATH, args, {
            stdio: ['pipe', 'pipe', 'pipe'],
            shell: true
        });

        let stdout = '';
        let stderr = '';

        process.stdout.on('data', (data) => {
            const output = data.toString();
            stdout += output;
            console.log('STDOUT:', output.trim());

            if (trackProgress) {
                // Parse progress from yt-dlp output
                const progressMatch = output.match(/\[download\]\s+(\d+\.?\d*)%/);
                if (progressMatch) {
                    const percent = parseFloat(progressMatch[1]);
                    sendProgress({ percent: percent, status: 'downloading' });
                }

                if (output.includes('[Merger]')) {
                    sendProgress({ percent: 90, status: 'merging' });
                }
            }
        });

        process.stderr.on('data', (data) => {
            const output = data.toString();
            stderr += output;
            console.log('STDERR:', output.trim());
        });

        process.on('close', (code) => {
            console.log(`Process exited with code: ${code}`);
            if (code === 0) {
                if (trackProgress) {
                    sendProgress({ percent: 100, status: 'completed' });
                }
                resolve(stdout);
            } else {
                if (trackProgress) {
                    sendProgress({ status: 'error', message: stderr });
                }
                reject(new Error(stderr || `Process exited with code ${code}`));
            }
        });

        process.on('error', (error) => {
            console.error('Process error:', error);
            if (trackProgress) {
                sendProgress({ status: 'error', message: error.message });
            }
            reject(error);
        });
    });
}

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Progress endpoint
app.get('/progress', (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
    });

    progressClients.push(res);

    req.on('close', () => {
        progressClients = progressClients.filter(client => client !== res);
    });
});

app.post('/get-info', async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) {
            return res.status(400).json({ error: 'Please provide a YouTube URL' });
        }

        console.log('📥 Fetching video info for:', url);

        const args = [
            '--dump-single-json',
            '--no-warnings',
            url
        ];

        const output = await runYtDlp(args);
        const videoInfo = JSON.parse(output.trim());

        console.log('✅ Successfully got video info:', videoInfo.title);

        // Get the best audio format for merging
        const bestAudio = videoInfo.formats
            .filter(f => f.acodec !== 'none' && f.vcodec === 'none')
            .sort((a, b) => (b.filesize || b.filesize_approx || 0) - (a.filesize || a.filesize_approx || 0))[0];

        // Process formats for the frontend - prioritize compatible formats
        const formats = videoInfo.formats
            .filter(f => {
                // Only include formats that are actually downloadable
                return f.vcodec !== 'none' &&
                    f.height > 0 &&
                    f.height >= 144 &&
                    f.url && // Must have a URL
                    !f.format_note?.includes('DASH audio') && // Exclude audio-only DASH
                    f.protocol !== 'mhtml'; // Exclude problematic protocols
            })
            .map(f => {
                const hasAudio = f.acodec !== 'none';

                // Determine format priority (lower is better)
                let priority = 0;

                // Protocol priority (HTTPS is most reliable)
                if (f.protocol === 'https') priority += 0;
                else if (f.protocol === 'm3u8') priority += 20;  // M3U8 often blocked
                else priority += 15;

                // Prefer MP4 over WebM
                if (f.ext === 'mp4') priority += 0;
                else if (f.ext === 'webm') priority += 10;
                else priority += 20;

                // Prefer H.264 over VP9 for compatibility and lower blocking
                if (f.vcodec?.includes('avc1')) priority += 0;  // H.264 - best
                else if (f.vcodec?.includes('vp9')) priority += 5;   // VP9 - okay
                else priority += 15;

                // Prefer formats with audio
                if (hasAudio) priority += 0;
                else priority += 2;

                // Penalize very high resolutions (more likely to be blocked)
                if (f.height >= 2160) priority += 15;  // 4K+ penalty
                else if (f.height >= 1440) priority += 8;   // 1440p penalty
                else if (f.height >= 1080) priority += 3;   // 1080p slight penalty

                return {
                    formatId: f.format_id,
                    ext: f.ext || 'mp4',
                    resolution: `${f.width || 0}x${f.height || 0}`,
                    height: f.height || 0,
                    filesize: f.filesize || f.filesize_approx || 0,
                    quality: `${f.height}p${f.fps ? ` ${f.fps}fps` : ''}${!hasAudio ? ' (video only)' : ''} [${f.ext?.toUpperCase()}${f.vcodec?.includes('avc1') ? '/H.264' : f.vcodec?.includes('vp9') ? '/VP9' : ''}] ${f.protocol === 'https' ? '🟢' : f.protocol === 'm3u8' ? '🟡' : '🔴'}`,
                    fps: f.fps,
                    vcodec: f.vcodec,
                    acodec: hasAudio ? f.acodec : 'none',
                    hasAudio: hasAudio,
                    protocol: f.protocol,
                    formatNote: f.format_note || '',
                    priority: priority,
                    compatible: priority < 10 // Mark highly compatible formats
                };
            })
            .sort((a, b) => {
                // First sort by height (quality), then by compatibility
                if (a.height !== b.height) return b.height - a.height;
                return a.priority - b.priority;
            });

        // Remove duplicate resolutions, keeping the most compatible format for each
        const uniqueFormats = [];
        const seenHeights = new Set();

        for (const format of formats) {
            if (!seenHeights.has(format.height)) {
                uniqueFormats.push(format);
                seenHeights.add(format.height);
            }
        }

        console.log('📊 Available formats:', uniqueFormats.map(f => `${f.formatId}(${f.height}p,${f.protocol},${f.priority < 10 ? 'RELIABLE' : 'RISKY'})`).join(', '));
        console.log(`📊 Found ${uniqueFormats.length} unique formats`);

        res.json({
            title: videoInfo.title,
            thumbnail: videoInfo.thumbnail,
            duration: videoInfo.duration,
            formats: uniqueFormats
        });

    } catch (error) {
        console.error('❌ Error getting video info:', error.message);

        let errorMessage = 'Failed to get video information';
        if (error.message.includes('Private video')) {
            errorMessage = '🔒 This video is private and cannot be accessed';
        } else if (error.message.includes('Video unavailable')) {
            errorMessage = '❌ This video is unavailable or has been removed';
        } else if (error.message.includes('not found')) {
            errorMessage = '🔍 Video not found - please check the URL';
        }

        res.status(500).json({ error: errorMessage });
    }
});

app.post('/download', async (req, res) => {
    let formatId = 'unknown'; // Initialize to avoid scope issues

    try {
        const { url, formatId: requestedFormatId } = req.body;
        formatId = requestedFormatId; // Set for error handling

        if (!url || !formatId) {
            return res.status(400).json({ error: 'Please provide both URL and format ID' });
        }

        console.log('🚀 Starting download process...');
        console.log('📺 Format ID:', formatId);

        const trailersPath = ensureTrailersDirectory();
        console.log('📁 Output directory:', trailersPath);

        console.log('⬬ Starting download...');
        console.log('📺 Selected format:', formatId);

        // Send initial progress
        sendProgress({ percent: 0, status: 'starting' });

        // Use simple format selection - our UI now shows the best formats
        let formatString = formatId;

        // For video-only formats, add best audio
        if (!formatId.includes('+')) {
            // Check if this is a video-only format
            const videoInfoResult = await runYtDlp(['--dump-single-json', '--no-warnings', url]);
            const videoData = JSON.parse(videoInfoResult.trim());
            const selectedFormat = videoData.formats.find(f => f.format_id === formatId);

            if (selectedFormat && selectedFormat.acodec === 'none') {
                formatString = `${formatId}+bestaudio`;
                console.log('🔊 Adding audio to video-only format:', formatString);
            }
        }

        // Use yt-dlp's built-in template system
        const outputTemplate = `${trailersPath.replace(/\\/g, '/')}/%(title)s.%(ext)s`;

        // Download arguments - use selected format
        let downloadArgs = [
            '--format', formatString,
            '--output', outputTemplate,
            '--merge-output-format', 'mp4',
            '--embed-thumbnail',
            '--add-metadata',
            '--no-warnings',
            '--restrict-filenames',
            '--retries', '10',
            '--fragment-retries', '10',
            '--skip-unavailable-fragments',
            '--no-keep-video',
            '--prefer-ffmpeg'
        ];

        // Add cookies if they exist
        const cookiesPath = path.join(__dirname, 'cookies.txt');
        if (fs.existsSync(cookiesPath)) {
            downloadArgs.push('--cookies', cookiesPath);
            console.log('🍪 Using cookies for authentication');
        }

        // Add URL at the end
        downloadArgs.push(url);

        await runYtDlp(downloadArgs, true); // Enable progress tracking

        console.log('🎉 Download completed successfully!');

        res.json({
            message: '✅ Download completed successfully!',
            filename: 'Video downloaded with original title',
            savedTo: trailersPath
        });

    } catch (error) {
        console.error('❌ Download failed:', error.message);

        let errorMessage = 'Download failed';

        if (error.message.includes('HTTP Error 403')) {
            if (formatId.includes('625') || formatId.includes('313') || formatId.includes('271')) {
                errorMessage = '🚫 High-quality format blocked by YouTube. Try a lower quality or use cookies for authentication.';
            } else {
                errorMessage = '🚫 Access denied - YouTube blocked the request. Try again later or use cookies.';
            }
        } else if (error.message.includes('HTTP Error 429')) {
            errorMessage = '⏳ Too many requests - please wait a few minutes before trying again';
        } else if (error.message.includes('Requested format is not available')) {
            errorMessage = `❌ Format ${formatId} is not available for this video. YouTube may have limited high-quality formats. Try a different quality.`;
        } else if (error.message.includes('No video formats')) {
            errorMessage = '📺 No suitable video format found for download';
        } else if (error.message.includes('Network')) {
            errorMessage = '🌐 Network error - please check your internet connection';
        } else if (error.message.includes('ffmpeg')) {
            errorMessage = '🔧 FFmpeg error - there may be an issue with video/audio merging';
        }

        res.status(500).json({
            error: errorMessage,
            details: error.message
        });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    const ytdlpExists = fs.existsSync(YTDLP_PATH);
    const cookiesExist = fs.existsSync(path.join(__dirname, 'cookies.txt'));

    res.json({
        status: 'ok',
        ytdlpBinary: ytdlpExists ? '✅ Found' : '❌ Missing',
        cookies: cookiesExist ? '✅ Found' : '⚠️  Not found (optional)',
        trailersFolder: '✅ Will be created automatically'
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('🚀 Server starting...');
    console.log(`🌐 Server running on http://localhost:${PORT}`);
    console.log('📁 TRAILERS folder:', path.join(os.homedir(), 'Desktop', 'TRAILERS'));

    // Check if binary exists
    if (fs.existsSync(YTDLP_PATH)) {
        console.log('✅ yt-dlp binary found');
    } else {
        console.log('❌ yt-dlp.exe not found in project folder');
        console.log('📥 Download from: https://github.com/yt-dlp/yt-dlp/releases/latest');
    }

    // Check for cookies
    if (fs.existsSync(path.join(__dirname, 'cookies.txt'))) {
        console.log('🍪 cookies.txt found - enhanced compatibility');
    } else {
        console.log('⚠️  cookies.txt not found (optional, but recommended for better compatibility)');
    }

    console.log('🎬 YouTube Downloader ready!');
});