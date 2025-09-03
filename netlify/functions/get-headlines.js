const axios = require("axios");
const xml2js = require("xml2js");
const he = require("he"); // decode HTML entities in titles

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
    "punch": "https://www.latestnigeriannews.com/feed/punch/rss.xml",
  };

  try {
    // Fetch all feeds in parallel
    const feedPromises = Object.entries(newsOutlets).map(async ([outletName, feedUrl]) => {
      try {
        const response = await axios.get(feedUrl, { timeout: 8000 }); // timeout helps avoid hangs
        const xml = response.data;
        const json = await parser.parseStringPromise(xml);

        const items = (json.rss?.channel?.[0]?.item || []).slice(0, 10);

        // 🔎 Debug: log Punch feed structure
        if (outletName === "punch" && items.length > 0) {
          console.log("DEBUG Punch Feed Item:", JSON.stringify(items[0], null, 2));
        }

        return [
          outletName,
          items.map((item) => ({
            title: he.decode(item.title?.[0] || "No title"),
            link: item.link?.[0] || "#",
          })),
        ];
      } catch (err) {
        console.error(`❌ ${outletName} failed:`, err.message);
        return [outletName, []]; // empty fallback
      }
    });

    // Wait for all feeds at once
    const resultsArray = await Promise.all(feedPromises);
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