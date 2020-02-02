---
title: afMicro Project
slug: afmicro-project
date_published: 2009-04-23T12:23:56.000Z
date_updated: 2009-04-23T12:23:56.000Z
tags:
  - Media
  - Tech
---

Pretty close to being done. I think I'll end up putting it live on Wednesday of next week, when we start going out to the fairgrounds to hammer fence posts and do preliminary festival setup.

I tried to make it look more Twitter-y, I guess. That wasn't really intentional, but it's the direction it took. I'm using a plugin called [Fresh From FriendFeed and Twitter](http://www.hitching.net/fresh-from-friendfeed-and-twitter) which is a ridiculously long name. The author doesn't give enough options in the backend, so I had to modify some of the PHP for this one project. It's a little sad. I wish I could've just left it, but it was so convoluted.

Basically, the plugin monitors your twitter feed and imports your latest tweet and creates a post out of it. Cool right? Well, the instructions in the backend are a little hard to understand. I'm all for making language in your posts/docs sound cool, relaxed and comfortable (see how I write on [agapefest.com](http://www.agapefest.com)), but not when you lose clarity of meaning. I'd like the settings to say things like: "Import each Tweet as a post. (We'll refresh to keep you current.)" and "Import your tweets once a week/day/month" instead of the craziness he has in the backend.

One of the cool things about the plugin is that it automagically parses media from Twitpic and YouTube (and others) and creates the embed code while inserting it into your new post. Well, it would be cool if the images were given any classes whatsoever. Or if the layout had any classes whatsoever. Really. No classes. Metadata is there for the alt attributes... but not one class. So custom styling is a no-go without poking around in the plugin code and adding your own for each item. Annoying.

Also, every post title begins with "Fresh From {Service Name}" and you can't change it in the graphical config. Once again, you have to poke around in the plugin code. Oh, and on top of that, by default it adds a filter to redirect all of your meta links (including permalink in headers) to the service URI. That means "leave a comment" takes you out to Twitter to leave a reply. And there's not option to turn it off. It's a cool idea, and definitely useful in some cases. But a on/off option would be killer.

So, I've had a few annoyances, but had no other recourse short of learning PHP to a degree where I could write my own plugin. Not conceivable for me at the moment, though it's on my list. That, or the time will come when Twitter is ubiquitous and I won't have to deal with so many visitors not having an account.

Apart from all the headaches, I'm pretty excited about this little experiment next week. Hopefully the plugin will refresh quick enough to keep things going (documentation doesn't exist. No FAQ. Just a FriendFeed room that you, again, have to search through to find what you need -- if it's there at all). Otherwise I really may have to write my own plugin. Maybe I will for next year anyway.
