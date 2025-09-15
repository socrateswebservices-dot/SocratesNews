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
    "vanguard": "https://www.vanguardngr.com/feed/",
    "business-day": "https://businessday.ng/feed/",
    "channels": "https://www.channelstv.com/feed/",
    "tribune": "https://tribuneonlineng.com/feed/",
    "daily-trust": "https://dailytrust.com.ng/feed/",
    "daily-times": "https://dailytimesng.com/feed/",
    // Punch, Guardian, Sahara handled separately
  };

  try {
    // Fetch standard feeds
    const feedPromises = Object.entries(newsOutlets).map(async ([outletName, feedUrl]) => {
      try {
        const response = await axios.get(feedUrl, { timeout: 8000 });
        const xml = response.data;
        const json = await parser.parseStringPromise(xml);

        const items = (json.rss?.channel?.[0]?.item || []);

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

    // 👇 Punch Scraper
    const punchPromise = (async () => {
      try {
        const response = await axios.get("https://punchng.com/", { timeout: 8000 });
        const $ = cheerio.load(response.data);

        const articles = [];
        $("h2.entry-title a, h3.post-title a, .post-title a").each((i, el) => {
          articles.push({
            title: $(el).text().trim(),
            link: $(el).attr("href"),
          });
        });

        if (articles.length === 0) {
          console.warn("⚠️ Punch selectors empty, falling back to aggregator feed");
          const fallback = await axios.get("https://www.latestnigeriannews.com/feed/punch/rss.xml", { timeout: 8000 });
          const json = await parser.parseStringPromise(fallback.data);
          const items = (json.rss?.channel?.[0]?.item || []);
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

    // 👇 Guardian Scraper
    const guardianPromise = (async () => {
      try {
        const response = await axios.get("https://guardian.ng/", { timeout: 8000 });
        const $ = cheerio.load(response.data);

        const articles = [];
        $("h3.entry-title a, h2.post-title a").each((i, el) => {
          articles.push({
            title: $(el).text().trim(),
            link: $(el).attr("href"),
          });
        });

        if (articles.length === 0) {
          console.warn("⚠️ Guardian selectors empty, falling back to aggregator feed");
          const fallback = await axios.get("https://www.latestnigeriannews.com/feed/guardian/rss.xml", { timeout: 8000 });
          const json = await parser.parseStringPromise(fallback.data);
          const items = (json.rss?.channel?.[0]?.item || []);
          return [
            "guardian",
            items.map((item) => ({
              title: he.decode(item.title?.[0] || "No title"),
              link: item.link?.[0] || "#",
            })),
          ];
        }

        return ["guardian", articles];
      } catch (err) {
        console.error("❌ Guardian scraper failed:", err.message);
        return ["guardian", []];
      }
    })();

    // 👇 Sahara Reporters Scraper
    const saharaPromise = (async () => {
      try {
        const response = await axios.get("https://saharareporters.com/", { timeout: 8000 });
        const $ = cheerio.load(response.data);

        const articles = [];
        $("h2.node-title a, h3.entry-title a").each((i, el) => {
          articles.push({
            title: $(el).text().trim(),
            link: "https://saharareporters.com" + $(el).attr("href"),
          });
        });

        if (articles.length === 0) {
          console.warn("⚠️ Sahara selectors empty, falling back to aggregator feed");
          const fallback = await axios.get("https://www.latestnigeriannews.com/feed/saharareporters/rss.xml", { timeout: 8000 });
          const json = await parser.parseStringPromise(fallback.data);
          const items = (json.rss?.channel?.[0]?.item || []);
          return [
            "sahara-reporters",
            items.map((item) => ({
              title: he.decode(item.title?.[0] || "No title"),
              link: item.link?.[0] || "#",
            })),
          ];
        }

        return ["sahara-reporters", articles];
      } catch (err) {
        console.error("❌ Sahara scraper failed:", err.message);
        return ["sahara-reporters", []];
      }
    })();

    // Combine everything
    const resultsArray = await Promise.all([...feedPromises, punchPromise, guardianPromise, saharaPromise]);
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
