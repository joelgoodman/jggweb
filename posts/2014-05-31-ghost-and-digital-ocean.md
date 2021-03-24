---
title: Ghost and Digital Ocean
slug: ghost-and-digital-ocean
date_published: 2014-05-31T16:57:18.000Z
date_updated: 2019-05-09T19:06:51.000Z
tags:
  - tech
---

It's become commonplace for me that, while I'm in the middle of a bunch of projects that start to drain my creativity, I work on some personal projects. Usually that involves things a lot more complicated than I probably should take on. So this week I started working on two personal projects. The first one got finished last night.

WordPress has always been, and is still, my publishing platform of choice. So much of my client work is built on WordPress and all of my sites have been built on WordPress since 2007. But last year John O'Nolan (someone I followed from the WordPress scene) announced a new project on Kickstarter. [Ghost](http://ghost.org) was devised to go back to simple publishing by focusing on just blogging. I'm not sure what the initial drive for this was, but I imagine part of it has to do with the state of WordPress' codebase.

WordPress is great because they take good care of their users. Your site isn't going to break because you run an update (in most cases) because the team behind WordPress pays attention to backward compatibility. However, what started as a simple blogging platform has turned into a full-fledged CMS. And sometimes the flexibility and scope of WordPress is overkill for a project.

### Digital Ocean

So, I backed the Ghost Kickstarter campaign last year but never got around to playing with it short of installing it on my local computer. In comes [Digital Ocean](https://www.digitalocean.com/?refcode=7e7a6eabc4cd). For a lot of reasons I've been looking at hosting options over the past two months. Most of my WordPress sites are on WP Engine but that presents some limitations when I need to work on things beyond the scope of WordPress. But I also didn't want the time-sink and cost of a Virtual Private Server (VPS). Once I seriously started considering Digital Ocean the model made complete sense.

Digital Ocean operates a hybrid PaaS (Platform as a Service) offering. Essentially, you're charged on an hourly model (how many hours your server—or "droplet—instance is active) with a monthly cap on how much you'll pay based on the server resource settings. The lowest droplet setting is $5/mo and for a small blog like this, makes a lot of sense. The best part is that if, for some reason, I started getting more traffic than I can handle at 512mb of memory and one processor core, I can scale that droplet instance up to whatever is appropriate.

Best of all, they've got a Ghost droplet. So spinning up this site was simple. I've got plans to move a bunch of my sites—including most of my WordPress sites—over to Digital Ocean in the coming weeks precisely because of how slick the platform and their support is. If this sounds good and you're going to check out Digital Ocean, use my [referral link](https://www.digitalocean.com/?refcode=7e7a6eabc4cd) to sign up and I'll get a credit toward my account. And let me know that you did so I can say "thank you".

### Migrating to Ghost

Next I had to migrate my old WordPress blog content over to [Ghost](http://ghost.org). There are some interesting differences between the two publishing apps. A big one for me is the lack of custom post types (structure content). On the last iteration of this site I kept a portfolio section. That portfolio link now goes to the [Bravery Media](http://braverymedia.co) site and I've retired the portfolio section here.

I then had to do the content migration. Ghost provides a WordPress plugin that exports your post content into a massive JSON file. My first import attempt was done locally for development purposes and I ran into an error. It seems the export plugin duplicated one post and so on import into Ghost it was getting caught at a non-unique post slug. I had to sift through the hundreds of objects in the JSON tree, splitting it into sections and testing the uploads.

Finally I got it all to import, but it took a long time to suss out the errors. One issue that arose from having to split up the JSON object into different parts is that my tags weren't pulled over. I'll probably have to manually go through and add these at some point. But the practice of moving to Ghost was not hard... just a bit time-consuming.

The last step was to export the Ghost content from my local dev instance and import it into my production instance.

#### Porting my theme

I ported and updated the theme from my old WordPress blog to Ghost's templating system, and named it "Marley & Marley" (get it???). Ghost themes are built with Handlebars.js and are fairly simple to get up and running. It took longer to port this theme (about 5 hours) over than it did to build the original one (3 hours was the count from concept to code to production), but that's mostly due to learning the helpers Ghost has as well as what objects I'm able to use in the theme files.

There were things I had to add in manually, as well. I added infinite scrolling back into this theme, for example, where on the old site Jetpack handled all of that. There's no commenting in Ghost either, so I had to convert all my comments to Disqus and then integrate that.

But the majority of the time was spent realizing revisions. Ghost is still fairly limited in customization due to it being a really young platform. One big difference is not having different background or header images for each post. In fact, posts don't get featured images at all. I understand this is on the roadmap for a future core release, but it's currently missing from the platform. Not a big deal.

### Future Thinking

Not sure where it's going to go from here, but I'm hoping the focus on just writing and publishing will help me write more and more consistently. It might not, but it's the thought that counts, right? But seriously... the editing is all done in Markdown and there are so few options in the Ghost admin that there's not much I can play with to distract me from writing.

Plus it's new and shiny.
