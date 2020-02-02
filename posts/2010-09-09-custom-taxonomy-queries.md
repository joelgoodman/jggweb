---
title: Custom Taxonomy Queries
slug: custom-taxonomy-queries
date_published: 2010-09-09T18:28:44.000Z
date_updated: 2010-09-09T18:28:44.000Z
tags:
  - Tech
---

On a recent project with [Department Three](http://departmentthree.com/) I needed to use a Custom Post Type and Custom Taxonomies to organize some of the content. So, the taxonomy was Directors and the custom post type was Videos.

From those I needed to use the taxonomy page to query videos for that specific director. I thought it would be pretty straightforward, but wasn't quite.

So, I solicited some help, and this is how you do it.

```  
    $director_slug = get_query_var('term'); /* Set $director_slug */
    $wp_query = new WP_Query("director=" . $director_slug);

    /* OR */

    query_posts(array('director' => $director_slug));

    /* Where 'director' is the slug for the custom taxonomy you
    created and $director_slug is the slug for the specific
    director you're querying */
```

Thanks @[cgrymala](http://twitter.com/cgrymala) and @[jaykz52](http://twitter.com/jaykz52) for the help.
