const axios = require("axios");
const xml2js = require("xml2js");
const he = require("he");
const cheerio = require("cheerio");

const parser = new xml2js.Parser({
  explicitArray: true,
  ignoreAttrs: false,
  mergeAttrs: false,
});

exports.handler = async function () {
  const newsOutlets = {
    "daily-sun": "https://thesun.ng/feed/",
    "business-day": "https://businessday.ng/feed/",
    "tribune": "https://tribuneonlineng.com/feed/",
    "daily-trust": "https://dailytrust.com.ng/feed/",
    "daily-times": "https://dailytimesng.com/feed/",
    "sahara-reporters": "https://saharareporters.com/feed/",
    "guardian": "https://guardian.ng/feed/",
    // Punch handled separately
  };

  try {
    // Fetch normal feeds
    const feedPromises = Object.entries(newsOutlets).map(async ([outletName, feedUrl]) => {
      try {
        const response = await axios.get(feedUrl, { timeout: 8000 });
        const xml = response.data;
        const json = await parser.parseStringPromise(xml);

        const items = (json.rss?.channel?.[0]?.item || []).slice(0, 10);

        return [
          outletName,
          items.map((item) => ({
            title: he.decode(item.title?.[0] || "No title"),
            link: item.link?.[0] || "#",
          })),
        ];
      } catch (err) {
        console.error(`❌ ${outletName} failed:`, err.message);
        return [outletName, []];
      }
    });

    // 👇 Special Punch Scraper
    const punchPromise = (async () => {
      try {
        const response = await axios.get("https://punchng.com/", { timeout: 8000 });
        const $ = cheerio.load(response.data);

        const articles = [];

        // Try multiple selectors
        $("h2.entry-title a, h3.post-title a, .post-title a").each((i, el) => {
          if (i < 10) {
            articles.push({
              title: $(el).text().trim(),
              link: $(el).attr("href"),
            });
          }
        });

        // If still empty, fallback to aggregator
        if (articles.length === 0) {
          console.warn("⚠️ Punch selectors empty, falling back to aggregator feed");
          const fallback = await axios.get("https://www.latestnigeriannews.com/feed/punch/rss.xml", { timeout: 8000 });
          const json = await parser.parseStringPromise(fallback.data);
          const items = (json.rss?.channel?.[0]?.item || []).slice(0);
          return [
            "punch",
            items.map((item) => ({
              title: he.decode(item.title?.[0] || "No title"),
              link: item.link?.[0] || "#",
            })),
          ];
        }

        return ["punch", articles];
      } catch (err) {
        console.error("❌ Punch scraper failed:", err.message);
        return ["punch", []];
      }
    })();

    const resultsArray = await Promise.all([...feedPromises, punchPromise]);
    const results = Object.fromEntries(resultsArray);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(results),
    };
  } catch (err) {
    console.error("General error:", err.message);
    return { statusCode: 500, body: "Failed to fetch headlines" };
  }
};