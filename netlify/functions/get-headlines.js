const axios = require('axios');
const xml2js = require('xml2js');
const he = require('he'); // decode HTML entities in titles

const parser = new xml2js.Parser({
  explicitArray: true,
  ignoreAttrs: false,
  mergeAttrs: false,
});

exports.handler = async function(event, context) {
  const newsOutlets = {
    'daily-sun': 'https://thesun.ng/feed/',
    'business-day': 'https://businessday.ng/feed/',
    'tribune': 'https://tribuneonlineng.com/feed/',
    'daily-trust': 'https://dailytrust.com.ng/feed/',
    'daily-times': 'https://dailytimesng.com/feed/',
    'sahara-reporters': 'https://saharareporters.com/feed/',
    'guardian': 'https://guardian.ng/feed/',
    'punch': 'https://www.latestnigeriannews.com/feed/punch/rss.xml',
  };

  const results = {};

  for (const [outletName, feedUrl] of Object.entries(newsOutlets)) {
    try {
      const response = await axios.get(feedUrl);
      const xml = response.data;
      const json = await parser.parseStringPromise(xml);

      const items = (json.rss?.channel?.[0]?.item || []).slice(0, 5);

      results[outletName] = items.map(item => ({
        title: he.decode(item.title?.[0] || "No title"),
        link: item.link?.[0] || "#",
      }));

    } catch (error) {
      console.error(`Error fetching or parsing RSS feed for ${outletName}:`, error.message);
      results[outletName] = [];
    }
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(results),
  };
};