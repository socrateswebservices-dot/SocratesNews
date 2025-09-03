module.exports = function(eleventyConfig) {
  // 🔹 Serve static files (like CSS, images) from /src
  eleventyConfig.addPassthroughCopy("src/styles.css");
  eleventyConfig.addPassthroughCopy("src/images");

  // 🔹 Copy the admin folder to output
  eleventyConfig.addPassthroughCopy("admin");

  // 🔹 Collection: All news posts
  eleventyConfig.addCollection("news", function(collectionApi) {
    return collectionApi.getFilteredByGlob("src/news/*.md");
  });

  // 🔹 Collection: Categories (group news by category frontmatter)
  eleventyConfig.addCollection("categories", function(collectionApi) {
    let categories = {};
    let posts = collectionApi.getFilteredByGlob("src/news/*.md");

    posts.forEach(post => {
      let category = post.data.category || "Uncategorized";
      if (!categories[category]) categories[category] = [];
      categories[category].push(post);
    });

    return categories;
  });

  // 🔹 Custom filter: Excerpt (first 30 words)
  eleventyConfig.addFilter("excerpt", content => {
    if (!content) return "";
    return content.split(" ").slice(0, 30).join(" ") + "...";
  });

  return {
    dir: {
      input: "src",
      includes: "_includes",
      output: "_site"
    },
    templateFormats: ["liquid", "md"],
    htmlTemplateEngine: "liquid",
    markdownTemplateEngine: "liquid"
  };
};