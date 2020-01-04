---
title: Lightbox Plugins
slug: lightbox-plugins
date_published: 2008-04-24T17:29:30.000Z
date_updated: 2008-04-24T17:29:30.000Z
---

So... I can't seem to get a lightbox to work here. Ideally I'd like to use something like multibox, but I can't even get a simple lightbox like Slimbox or Lightbox 2 to work. Most of the plugins for WordPress include their own scriptaculous libraries (though some use mootools) instead of hooking into the libraries included in wp-includes.

Obviously, if you are running two different plugins that are both built on Scriptaculous and Prototype, there could be conflicts. The plugin I use for my contact link in the top nav bar (SimpleModal Contact Form) uses a Lightbox-esque Javascript effect. I disabled it to see if it was conflicting with the Lightbox 2 plugin, but it didn't do anything. And my contact form still works with LB2 activated.

Anyway, I'm kind of stumped. It all started with Picturegrid's lightbox integration not working. And never has. But nothing else does too. It's as if the rel tag hooks aren't being picked up by the plugin script. I suppose I could just work on my own and include it in the header, but I'd rather just use a plugin; it's easier that way.

If anyone has any suggestions or wants to inspect my code on this site, feel free. I'd appreciate any leads.
