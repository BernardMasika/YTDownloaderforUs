# YouTube Video Downloader

A modern web-based YouTube video downloader with real-time progress tracking and smart format selection. Built with Node.js and yt-dlp.

![Screenshot](https://img.shields.io/badge/Status-Working-brightgreen) ![Version](https://img.shields.io/badge/Version-1.0-blue)

## ✨ Features

- **🎯 Smart Format Selection** - Automatically prioritizes the most reliable video formats
- **📊 Real-time Progress** - Live download progress with percentage, speed, and ETA
- **🔍 Format Intelligence** - Color-coded quality indicators (🟢 Reliable, 🟡 Medium Risk, 🔴 High Risk)
- **🎵 Auto Audio Merging** - Automatically combines video-only formats with best available audio
- **🍪 Cookie Support** - Enhanced compatibility with YouTube authentication
- **📱 Responsive UI** - Clean, modern interface that works on all devices
- **⚡ Fast Downloads** - Direct yt-dlp integration for maximum speed
- **📁 Organized Storage** - Downloads saved to `Desktop/TRAILERS` folder

## 🚀 Quick Start

### Prerequisites

- **Node.js** (v14 or higher)
- **Windows** (for the included yt-dlp.exe binary)

### Installation

1. **Clone or Download** this project
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Download yt-dlp binary:**
    - Download `yt-dlp.exe` from [yt-dlp releases](https://github.com/yt-dlp/yt-dlp/releases/latest)
    - Place it in the project root folder

4. **Start the server:**
   ```bash
   # Option 1: Use the batch file
   start_server.bat
   
   # Option 2: Manual start
   node server- old using wrapper.js
   ```

5. **Access the app:**
   Open `http://localhost:3000` in your browser

## 📖 How to Use

### Basic Download Process

1. **Copy YouTube URL** - Get any YouTube video URL
2. **Paste & Get Info** - Paste URL and click "Get Video Info"
3. **Select Quality** - Choose from available formats (look for 🟢 indicators for best compatibility)
4. **Download** - Click "Download Video" and watch the real-time progress

### Understanding Format Indicators

| Indicator | Meaning | Recommendation |
|-----------|---------|----------------|
| 🟢 | HTTPS + Compatible codec | **Best choice** - High success rate |
| 🟡 | M3U8 or mixed compatibility | **Medium risk** - May work |
| 🔴 | Problematic protocol/codec | **Avoid** - High failure rate |

### Quality Selection Tips

- **1080p H.264 🟢** - Best balance of quality and reliability
- **4K formats** - Higher quality but more likely to be blocked
- **Video-only formats** - Automatically merged with audio
- **Lower resolutions** - More reliable, faster downloads

## 🛠️ Advanced Configuration

### Cookie Authentication (Recommended)

For better compatibility and access to higher quality formats:

1. **Install browser extension:**
    - Chrome: "Get cookies.txt LOCALLY"
    - Firefox: "cookies.txt"

2. **Export cookies:**
    - Visit YouTube and log in
    - Export cookies to `cookies.txt`
    - Place file in project root

3. **Restart server** - Cookies will be automatically detected

### Custom Output Location

Edit `server- old using wrapper.js` to change download location:
```javascript
// Change this line in ensureTrailersDirectory()
const trailersPath = path.join(desktopPath, 'YOUR_FOLDER_NAME');
```

## 📂 Project Structure

```
YTDownloaderforUs/
├── server- old using wrapper.js              # Main backend server
├── index.html             # Web interface
├── package.json           # Dependencies
├── yt-dlp.exe            # yt-dlp binary
├── cookies.txt           # YouTube cookies (optional)
├── start_server.bat      # Windows startup script
└── node_modules/         # Installed packages
```

## 🔧 Troubleshooting

### Common Issues

**❌ "yt-dlp.exe not found"**
- Download yt-dlp.exe from official releases
- Place in project root folder
- Restart server

**❌ "HTTP Error 403: Forbidden"**
- Try lower quality format (look for 🟢 indicators)
- Add cookies.txt for authentication
- Wait and try again later

**❌ "Format not available"**
- Video may not have that quality
- Try different format from dropdown
- Check if video is private/restricted

**❌ Download stuck at percentage**
- Large files take time - be patient
- Check internet connection
- Try different format if it fails

### Health Check

Visit `http://localhost:3000/health` to verify setup:
- ✅ yt-dlp binary found
- ✅ Cookies loaded (if present)
- ✅ Output folder ready

## 🎯 Format Selection Logic

The app intelligently ranks formats by:

1. **Protocol Reliability** (HTTPS > M3U8 > Others)
2. **Codec Compatibility** (H.264 > VP9 > Others)
3. **Container Format** (MP4 > WebM > Others)
4. **Audio Availability** (Combined > Video-only)
5. **Resolution Risk** (Lower = More Reliable)

## ⚙️ Technical Details

### Backend
- **Express.js** server with real-time progress via Server-Sent Events
- **yt-dlp** binary integration for video downloading
- **Smart format parsing** and compatibility scoring
- **Automatic video+audio merging** for high-quality downloads

### Frontend
- **Vanilla JavaScript** - No frameworks, fast loading
- **Real-time progress** - Live percentage, speed, and ETA updates
- **Responsive design** - Works on desktop and mobile
- **Error handling** - Clear feedback for all scenarios

### Download Process
1. **Format Analysis** - Fetches all available formats
2. **Compatibility Scoring** - Ranks formats by success probability
3. **Smart Selection** - Presents best options to user
4. **Progress Streaming** - Real-time download feedback
5. **Auto Processing** - Merges, adds metadata, embeds thumbnail

## 📋 Dependencies

```json
{
  "express": "^4.21.2",
  "ffmpeg-static": "^5.2.0", 
  "yt-dlp-exec": "^1.0.2"
}
```

## 🤝 Contributing

Found a bug or have a suggestion? Feel free to:
- Report issues
- Suggest improvements
- Submit pull requests

## 📄 License

This project is for educational purposes. Respect YouTube's Terms of Service and copyright laws.

## 🙏 Credits

- **yt-dlp** - The powerful video downloader that makes this possible
- **Express.js** - Fast, minimalist web framework
- Made with ❤️ by [bernard masika](http://www.bernardmasika.com)

---

**⚠️ Disclaimer:** This tool is for downloading videos you have permission to download. Always respect copyright laws and YouTube's Terms of Service.