'use strict';

// Make arbitrary global data available with this file.
module.exports = function(eleventyConfig){
  environment: process.env.ELEVENTY_ENV;
  unsplashkey: process.env.UNSPLASH_ACCESS;
};
