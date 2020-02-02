---
title: Link post_thumbnail in WordPress
slug: link-post_thumbnail-in-wordpress
date_published: 2010-07-14T21:07:09.000Z
date_updated: 2010-07-14T21:07:09.000Z
tags:
  - Tech
---

**Scenario:**

You're using the built-in post thumbnail feature in WordPress. That's all well and good, but you'd really like it to link to the originally uploaded image for a lightbox or something else.

How do you do it?

*I'm not the best at PHP syntax, so if there's a smarter/cleaner way, please let me know!*

First we need to use the `get_post_thumbnail_id()` function like this:

```
    <?php $thumbID = get_post_thumbnail_id(); ?>
```

This sets the variable `$thumbID` to the id of your post thumbnail.

Next, we want to build the URI for your link:

```
    <a href="<?php echo wp_get_attachment_url($thumbID); ?>">
```

Now, there's probably a cleaner way to do this, but again, I'm not all that awesome at syntax. But basically you're using the `wp_get_attachment_url();` function in conjunction with your post thumbnail's id to get the original image src.

Easy.

Thanks to @[cgrymala](http://twitter.com/cgrymala) over at [HTMLCenter](http://www.htmlcenter.com/) for this tip.
