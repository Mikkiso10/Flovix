# 🎬 Flovix

A Netflix-style local streaming site using VidKing embeds.

---

## 🚀 How to Start

1. **Install Node.js** (only needed once)
   - Go to https://nodejs.org
   - Download the **LTS** version and install it

2. **Double-click `START.bat`**
   - Your browser will open automatically at http://localhost:3000
   - That's it!

---

## 🎨 Optional: Get Real Movie Posters & Search

1. Go to https://www.themoviedb.org/settings/api (free account)
2. Create an API key (takes ~30 seconds)
3. Open `public/js/app.js` in Notepad
4. Find this line near the top:
   ```
   const TMDB_KEY = "";
   ```
5. Paste your key inside the quotes:
   ```
   const TMDB_KEY = "your_key_here";
   ```
6. Save and restart the server

---

## 📁 File Structure

```
flovix/
├── START.bat          ← Double-click to launch!
├── server.js          ← Lightweight Node.js server
├── README.txt
└── public/
    ├── index.html     ← Main page
    ├── css/style.css  ← All styling
    └── js/app.js      ← All logic + player integration
```

---

## 🎮 Player Info

Powered by VidKing (`https://www.vidking.net`)
- Movies: `/embed/movie/{tmdbId}`
- TV:     `/embed/tv/{tmdbId}/{season}/{episode}`

Watch progress is auto-saved to your browser's localStorage.
