---
title: Battling the CMS
slug: battling-the-cms
date_published: 2008-06-30T13:57:24.000Z
date_updated: 2008-06-30T13:57:24.000Z
tags:
  - Tech
  - Higher Ed
---

We've been doing some research at work into finding a CMS to replace the one we currently have. About two years ago GC transitioned from a static html site to a php-driven, dynamic content management system (CMS). In higher ed, you usually end up with thousands and thousands of pages of web content, more if you're a large university. And we are no different.

I think [Jared](http://www.jms2k.com/) said we serve about 13,000 pages or so. And before switching to [Joomla!](http://www.joomla.org) that number was a huge burden for updating. Not to mention there was absolutely no on-demand content creation or display whatsoever.

But here we are two years after and we're running into the inherent problems with Joomla! in the type of application we're using it for. Not that it's a bad piece of software - it's not. Not at all. It's just really hard to fit into our plans and needs.

Joomla! is open source. And with that state comes a whole slew of benefits and problems. This leads to the inevitable battle with weighing pros and cons - free vs. slow response and slim support, etc. And for smaller applications, it's a great CMS. But with the importance of SEO in our line of work, it just doesn't cut it.

See, we were running OpenSEF, a community-created plugin, to change the long string of php-created url characters to something simpler, like .edu/getajob or something. Everytime a link was clicked, all 13,000 pages were queried in the database to find the one that the SEF url matched - and led to server crashes. A lot of server crashes. Think, thrice a day or more. Pretty ridiculous. So it's turned off now. And we have ugly URLs.

The organization of the backend doesn't work for us either. Only 3 levels of content - Section, category, content item. No sub categories, no cross-sectioning of articles. Not bad, just not for us.

So we're looking at others. One really cool one we've found is [dotCMS](http://www.dotcms.org). It's GPLed but also comes with pay-packages for support. They also have a kit option that comes with a customized server (actual hardware) some addon-apps and setup. It looks perfect for what we're wanting to do. And a lot of other schools have already started using it with really impressive results.

So. The next step is to convince administration to spend some money.

Do you have a favourite CMS or a suggestion for something we should look at? It needs to be able to handle large amounts of content, not necessarily OSS, but highly configurable.
