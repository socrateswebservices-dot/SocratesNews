const axios = require("axios");
const xml2js = require("xml2js");
const he = require("he");
const cheerio = require("cheerio"); // 👈 added

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

        // Select article links — Punch uses h2.article-title > a
        const articles = [];
        $("h2.entry-title a").each((i, el) => {
          if (i < 10) {
            articles.push({
              title: $(el).text().trim(),
              link: $(el).attr("href"),
            });
          }
        });

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