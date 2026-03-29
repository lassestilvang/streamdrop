# 🎧 Streamdrop

Turn your saved articles into a continuous audio stream using ElevenReader.

Streamdrop fetches articles from Raindrop.io, extracts clean readable content, batches them into listening-sized chunks, and generates a single “mega-article” optimized for text-to-speech playback.

---

## ✨ Why Streamdrop?

Most text-to-speech apps optimize for **reading one article at a time**.

Streamdrop flips that:

> Turn your reading backlog into a **podcast-like listening experience**

* ✅ Continuous playback (no manual switching)
* ✅ Works perfectly with ElevenReader
* ✅ No expensive TTS API costs
* ✅ Fully self-hosted (Vercel-friendly)
* ✅ Clean article extraction

---

## 🚀 How It Works

```
Raindrop → Fetch → Extract → Clean → Batch → HTML → ElevenReader
```

1. Fetch unread articles from Raindrop API
2. Extract clean content using Readability
3. Estimate reading time
4. Batch into ~30–60 min chunks
5. Generate a structured HTML document
6. Paste into ElevenReader → listen 🎧

---

## 📦 Features

* 📚 Fetch articles from Raindrop
* 🧹 Clean extraction (no ads, nav, clutter)
* ⏱️ Smart batching based on reading time
* 🎧 Optimized for TTS (clear separators, structure)
* ⚡ Serverless (deploy on Vercel)
* 💸 Zero ongoing cost (uses ElevenReader free tier)

---

## 🛠️ Setup

### 1. Clone repo

```
git clone https://github.com/yourname/streamdrop
cd streamdrop
```

### 2. Install dependencies

```
npm install
```

### 3. Configure environment variables

```
RAINDROP_TOKEN=your_token_here
MAX_MINUTES=45
WORDS_PER_MINUTE=180
```

### 4. Run locally

```
npm run dev
```

---

## ☁️ Deploy to Vercel

1. Push to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy

Your endpoint will be:

```
/api/generate
```

---

## ▶️ Usage

1. Open:

```
https://your-app.vercel.app/api/generate
```

2. Copy the generated HTML
3. Paste into ElevenReader
4. Press play → go for a walk 🚶‍♂️

---

## ⚙️ Configuration

| Variable         | Default | Description             |
| ---------------- | ------- | ----------------------- |
| MAX_MINUTES      | 45      | Target length per batch |
| WORDS_PER_MINUTE | 180     | Reading speed estimate  |

---

## 🧠 How Batching Works

Streamdrop estimates article length:

```
words / WORDS_PER_MINUTE = minutes
```

Then groups articles into batches until reaching `MAX_MINUTES`.

---

## 🔥 Roadmap

* [ ] Mark processed articles as read in Raindrop
* [ ] Cache extracted content (e.g. `/queue/latest`)
* [ ] Tag-based filtering (e.g. only `tts`)
* [ ] Generate AI summaries per article (e.g. before each article `Summary: ...`)
* [ ] Auto daily generation (cron)
* [ ] Multi-language support
* [ ] Web UI (view + copy queue easily)
* [ ] One-tap iPhone Shortcut integration (one tap to fetch latest queue and open in ElevenReader)
* [ ] Deduplication + scoring
* [ ] “Smart batching” (detect complexity, adjust pacing)
* [ ] Direct ElevenReader integration (if API becomes available)

---

## 💡 Tips

* Use clean article sources (avoid paywalls)
* Aim for 30–60 min batches
* Increase playback speed (1.8x–2.5x works great)

---

## ⚠️ Limitations

* No native queue inside ElevenReader (this is the workaround)
* Very large batches may impact performance
* Some websites may fail extraction

---

## 🤝 Contributing

PRs welcome — especially around:

* extraction quality
* batching logic
* mobile UX

---

## 📜 License

MIT

---

## 🙌 Inspiration

Built to solve a simple problem:

> “Why can’t my reading list behave like a podcast queue?”
