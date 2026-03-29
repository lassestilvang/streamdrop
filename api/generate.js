import fetch from "node-fetch";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";

const RAINDROP_TOKEN = process.env.RAINDROP_TOKEN;
const MAX_MINUTES = parseInt(process.env.MAX_MINUTES || "45");
const WORDS_PER_MINUTE = parseInt(process.env.WORDS_PER_MINUTE || "180");

const MAX_WORDS = MAX_MINUTES * WORDS_PER_MINUTE;

async function getRaindrops() {
  const res = await fetch(
    "https://api.raindrop.io/rest/v1/raindrops/0?perpage=50",
    {
      headers: {
        Authorization: `Bearer ${RAINDROP_TOKEN}`,
      },
    },
  );

  const data = await res.json();
  return data.items.filter((item) => item.link);
}

async function extractArticle(url) {
  try {
    const res = await fetch(url, { timeout: 10000 });
    const html = await res.text();

    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    if (!article || !article.textContent) return null;

    return {
      title: article.title,
      content: article.textContent,
    };
  } catch (err) {
    console.error("Failed:", url);
    return null;
  }
}

function estimateWords(text) {
  return text.split(/\s+/).length;
}

function chunkArticles(articles) {
  const batches = [];
  let currentBatch = [];
  let currentWords = 0;

  for (const article of articles) {
    const words = estimateWords(article.content);

    if (currentWords + words > MAX_WORDS) {
      batches.push(currentBatch);
      currentBatch = [];
      currentWords = 0;
    }

    currentBatch.push(article);
    currentWords += words;
  }

  if (currentBatch.length) {
    batches.push(currentBatch);
  }

  return batches;
}

function buildHTML(batch, index) {
  let html = `
  <html>
    <head>
      <meta charset="UTF-8" />
      <title>Queue ${index + 1}</title>
      <style>
        body { font-family: -apple-system; line-height: 1.6; padding: 20px; }
        h1 { margin-top: 40px; }
        .separator { margin: 40px 0; font-weight: bold; }
      </style>
    </head>
    <body>
      <h1>🎧 Listening Queue ${index + 1}</h1>
      <hr/>
  `;

  batch.forEach((article, i) => {
    html += `
      <div class="separator">========== NEXT ARTICLE ==========
      </div>
      <h2>${i + 1}. ${article.title}</h2>
      <p>${article.content.replace(/\n/g, "</p><p>")}</p>
    `;
  });

  html += `
    </body>
  </html>
  `;

  return html;
}

export default async function handler(req, res) {
  try {
    const raindrops = await getRaindrops();

    const articles = [];

    for (const item of raindrops) {
      const article = await extractArticle(item.link);
      if (article) articles.push(article);
    }

    const batches = chunkArticles(articles);

    const result = batches.map((batch, i) => ({
      index: i + 1,
      html: buildHTML(batch, i),
    }));

    res.status(200).json({
      batches: result,
      total_articles: articles.length,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to generate queue" });
  }
}
