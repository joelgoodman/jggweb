// Make arbitrary global data available with this file.
export default {
  environment: process.env.ELEVENTY_ENV,
  newsletter: {
    // Loops' own Form endpoint — gives us native double opt-in (the DIY
    // Bunny edge script at scripts/edge/newsletter-signup.js is retired
    // but left in place for now, not deleted).
    action: "https://app.loops.so/api/newsletter-form/clmf097wq00iul50n9o7c9rqm",
    mailingListId: "cmo4kru8p0zn60iyq41zh7jo3",
    description: "Occasional letters on digital strategy, higher ed, and the work I'm thinking through. No spam, unsubscribe anytime."
  }
};
