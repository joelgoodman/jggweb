const pluginRss    = require("@11ty/eleventy-plugin-rss");

module.exports = function(eleventyConfig) {

  // Lots of other stuff probably goes here

  // RSS Setup via @freshyill 
  eleventyConfig.addCollection("allUpdates", function(collection) {
    return collection.getFilteredByGlob(["posts/*.md"]).sort(function(a, b) {
      return b.date - a.date;
    });
  });

  // Lots of other stuff probably goes here
}
