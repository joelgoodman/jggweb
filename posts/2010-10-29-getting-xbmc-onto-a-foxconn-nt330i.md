---
title: Getting XBMC Onto a Foxconn nT330i
slug: getting-xbmc-onto-a-foxconn-nt330i
date_published: 2010-10-29T07:13:41.000Z
date_updated: 2014-05-31T21:41:41.000Z
tags:
  - tech
---

### Originally posted on 08 April, 2010.

**Note:** This tutorial should also work for the Viewsonic VOT 132 and KCS NanoBox 2030 - as they're all the same thing.

Last week Newegg had an incredible deal on a Foxconn NetBox nT330i Atom-based mini-computer. We are looking to get rid of our satellite TV, so I jumped on the deal. Everything arrived on Friday and I started putting the thing together. There is a great discussion about using this computer over at [AVForums.com](http://www.avforums.com/forums/home-entertainment-pcs/1136930-foxconn-netbox-nt330i-htpc-build.html), but there really isn't a step-by-step guide anywhere. So I've documented the whole process here.

![The Packages Arrived!](http://res.cloudinary.com/joelgoodman/image/upload/v1401313761/neweggB1_ldrxev.jpg)

![Have some food on Hand](http://res.cloudinary.com/joelgoodman/image/upload/v1401313762/lunch1_ljr8kv.jpg)

![Moral Support](http://res.cloudinary.com/joelgoodman/image/upload/v1401313768/friendlyhelper1_u9ieob.jpg)

This isn't for the novice computer-user, but if you know what XBMC is, you're probably not a beginner. To start out, you'll need both a small Phillips and flathead screwdriver, and if you're cautious, one of those nerdy anti-static wristbands (I haven't used one of those since my A+ certification back in the day).

Got your tools together? Good. These are the components you'll need:

- Foxconn NetBox nT330i Atom 330-based nettop
- 1 x 200pin DDR2 800/667 RAM (I suggest at least 2Gb, it'll accept up to 4Gb) *I went with a 2GB G-Skill stick from Newegg.com*
- USB Flash Drive (1Gb minimum - if you're going to run XBMC off your flash drive, you'll definitely want something bigger)
- Optional: 2.5" SATA Hard Drive (or Solid State Drive) *I went with a 320Gb Western Digital Scorpio Black 7200RPM HDD from Newegg.com*
- A USB Keyboard
- Cables to hook it up to your TV (may I recommend a HDMI cable from [monoprice.com](http://www.monoprice.com/products/subdepartment.asp?c_id=102&amp;cp_id=10240)?)

So, first things first, get all of your things assembled, check the boxes for missing components, etc.

![Major Pieces](http://res.cloudinary.com/joelgoodman/image/upload/v1401313770/components1_an3xxg.jpg)

![Unboxed and Arranged](http://res.cloudinary.com/joelgoodman/image/upload/v1401313759/parts1_zgqzc1.jpg)
*Everything unboxed, nothing missing*

Provided that everything's okay we can get started. Before any of this, I downloaded UNetbootin for Windows and the XBMC Live! ISO image and booted into Windows 7 to install it. I won't go into details on that here, because great instructions have been written over at the [UNetbootin Sourceforge site](http://unetbootin.sourceforge.net/). Plus, it's dead simple. But you'll want to have that on hand and it can take a few minutes to get XBMC Live! installed to your USB flash drive.

### 1. Opening the Foxconn nT330i box

![Remove the Screws](http://res.cloudinary.com/joelgoodman/image/upload/v1401313756/removescrews1_phmdxv.jpg)

Take the nT330i out of its protective plastic bag and place it top-side up in front of you. The bottom of the unit has small metal circles at the four corners - if you're looking at those, flip it over. There is a sticky cover on each side of the box to keep it looking shiny. You can remove these if you'd like. I waited until everything was installed just in case I slipped with the screwdriver.

Pull out your Phillips screwdriver and remove the screw in each of the four corners. They're tiny, so be sure to put them someplace you won't lose them in the process.

Next comes the tricky part. The top lid is secured by plastic tabs around the sides. I used the Phillips screwdriver wedge at an angle inside the four screw holes to lift one corner up while sliding the Flathead screwdriver into the gap around the edges.

![Remove the top cover](http://res.cloudinary.com/joelgoodman/image/upload/v1401313760/openit1_ipnlvl.jpg)

You'll definitely want to be gentle while doing this. The sides of the box aren't made of the most solid of plastics, and you'll see some flex as you move around. If you can get the back edge of the cover loose first, you'll have an easier time moving around the sides.

Word to the wise: The corners are free and have no tabs. If you get nervous, you can always go back to a corner.

After you have an edge free, use your fingers to pop the tabs out on the sides and pull the top off. Set it aside, you won't need it for a while.

### 2. Installing Your RAM and Hard Drive

![Inside the nT330i](http://res.cloudinary.com/joelgoodman/image/upload/v1401313766/insident330i1_tpstmz.jpg)

You're now faced with the insides of your nettop. You should easily be able to figure out where the RAM goes and where the hard drive goes. If not, check the quick setup guide for photos and diagrams.

The first step from this point is to install your RAM. **Make sure you discharge any static electricity** from your body before removing the DIMM from its packaging. Match the RAM card to the RAM slot and insert at an angle.

Make sure the RAM is seated securely and press down on the sides until you hear two clicks (one for each side). If your RAM card has a heat spreader attached like mine did, you may need to put some extra pressure on the sides to get it to lock. Just be careful not to break anything!

![Affix the hard drive bracket](http://res.cloudinary.com/joelgoodman/image/upload/v1401313763/installinghddB1_phutyu.jpg)

Your second task is to install the hard drive (provided you're using one). Remove the four screws securing the hard drive bracket to the case. Set them aside someplace where you won't lose them!

Lift it out of the case and slide your hard drive into the bracket.

**Note:** The bracket that came with my nT330i had a small tab over one hole that fits into one of the screw holes on your hard drive. It's easier to line that up before you fit the rest of the hard drive. I had two screws in before I saw that little tab and had to start over.

![Place your hard drive](http://res.cloudinary.com/joelgoodman/image/upload/v1401313758/placingHDD1_jzecge.jpg)

Take 3 (or 4) screws from the bag included with your nT330i and use them to fix the hard drive to its bracket.

Again, insert the hard drive at an angle, making sure the SATA pins on the drive match up with the SATA port inside the box. Lay the drive flat in the case and push toward the SATA connector and make sure it's sits snug.

Grab the 4 screws you set aside when you removed the bracket and re-secure the bracket and drive inside the case. At this point it would be a good idea to go get a drink and a snack and admire your handiwork:

![Admire your handiwork](http://res.cloudinary.com/joelgoodman/image/upload/v1401313767/inside1_p2jszl.jpg)

### 3. Closing it up again

Alright. We're almost done with the hardware side of this project. this is where we close it all up again.

![Close the lid](http://res.cloudinary.com/joelgoodman/image/upload/v1401314035/closinglid1_ik38xd.jpg)

Grab that lid and -- you guessed it -- at an angle, insert the back edge in first. The back edge of the lid has a small groove that matches where the connector for the WiFi antenna goes. Lay the edges down and press until you hear those tabs click and seat into place.

Make sure the edges are all snug and replace the four screws that fit into the corners. Make sure they're tight and then grab the strip of adhesive screw channel covers that came with the box. Place one over each of the holes and you're done!

Now comes the fun part: Getting XBMC Live installed and running.

### 4. Installing XBMC Live!

![Installing XBMC Live](http://res.cloudinary.com/joelgoodman/image/upload/v1401313764/installation1_vf3fyk.jpg)

First things first, make sure you have XBMC Live! installed to your USB flash drive. Plug your keyboard and flash drive into the nT330i and push the power button. Now, the manual will tell you to press F11 to get to the BIOS. This is wrong. If you have the American Megatrends BIOS that my unit shipped with, you'll want to hit DEL to boot into setup.

Check the boot device order and set it to your USB drive if it isn't already. At first you probably won't need to worry about this as there's nothing installed to your hard drive yet. But if you needed to reinstall XBMC, you'd want to go through this process.

Hit F10 to save and reboot. When your nT330i restarts it should boot from your USB flash drive and into the XBMC Live installer window. You'll see a bunch of options. If you want to just run XBMC live off your flash drive, all you have to do is select the one that shows Nvidia GPU drivers and you're done.

But in this tutorial we're installing it to disk. So go down to the last option that says "Install XBMC to disk" and select it. Follow the steps until you get to the partitioning section. Here you have a choice: You can use the whole disk, a percentage of the disk, or manually create some partitions. I opted to use the whole disk.

*You will see a red screen that says your network device isn't detected. Don't freak out. It's cool. We'll fix that once we're installed. Just hit 'Continue'.*

Let the partitioning do its magic and then continue following the instructions. In a few minutes you should be rebooting the unit and starting up into your new XBMC box.

*You might also try using [OpenELEC](http://openelec.tv) and their instructions*

### Tweaking the System

So at this point you've gotten past the hard part, now we just need to tweak a few things. First up, fixing the networking issue. Hit `Ctrl+Alt+F2` to open up console mode, we're going to do a little bit of hacking.

Login with the account you set up during installation and enter this:

```
    sudo nano /etc/network/interfaces

```

You'll be prompted for your password again. When the next screen comes up you'll want to add this below what's there already:

```
    auto eth0
    iface eth0 inet dhcp
```

Hit `Ctrl-X` to save and then `Y` to confirm.

Then enter:

```
    sudo reboot
```

...to reboot. And there you go, your networking should work.

By default the theme is Confluence, and we'll go from that. Settings locations may vary from skin to skin. Select 'Settings' from the menu and head down 'Video'. Under the 'Render Method' option, change it to VDPAU. This makes sure that XBMC is offloading the rendering of video to the ION GPU instead of the main processor.

Next, head to 'Audio'. If you're using HDMI like I am, you'll want to send the sound through your HDMI cable. In my experience, the nT330i did this automagically, so this is a better safe than sorry method. Change the 'Audio Output' to digital, and the 'Audio Output Device' to HDMI.

Last, if you want those interface clicks to play through your TV, you need to create a new plain text document in Notepad or Text Edit and enter:

```
    pcm.!default {
    	type plug
    	slave {
    		pcm "hdmi"
    	}
    }
```

Save that file as `asoundrc.txt`.

FTP into your box from another computer using the account you setup earlier to login. Upload the asoundrc.txt file to your home directory. Once uploaded, rename it to `.asoundrc` making sure that you remove the `.txt` extension.

You may have to restart to get the clicks to play properly, but there you have it. You're all set up. Now go play with XBMC!

---

### Updates

I've got a couple of questions so I'll answer them here. Sorry for the lack of video - grad school comes first and it's been getting in the way. Having the video still in my plans though, so sit tight.

**Chess asks...** *Does this get hot?*

So far, not too bad. I also don't have it stuffed into a cubby someplace with poor ventilation and all it's doing is either scraping media or playing media (any downloads, compressing, etc., happens on my NAS or on my laptop). The XBMC stats display won't show me the temp - I'm guessing this has to do with the ION drivers provided in the underlying Ubuntu build or maybe that BIOS features aren't fully supported.

**Chess asks...** *Does it play full screen media okay?*

YES! It really does. I had a few problems with horizontal clipping that a quick search on the XBMC forums showed was a common problem. Had to go and set Vertical Sync to "Always On". This menu is located (in Confluence and Aeon Auriga) under **Settings > System > Video Output** which I found to be different from what was posted in the XBMC forums.

But yes, I've watched full Blu-Ray rips of movies at 1080p, streaming from my NAS over the gigabit LAN with no stutter and great picture quality. The little fan in the unit does turn on, but it's not very loud especially when watching something. Quieter than my Dish Network HD-DVR has been, in any case.

![XBMC Compatible Remote](http://res.cloudinary.com/joelgoodman/image/upload/v1401313745/DSC_16781_xwhauj.jpg)

That's right, I picked up a remote finally. And I'm pretty pleased with it. It's a *[Noah Company MediaGate GP-IR02BK](http://www.amazon.com/gp/product/B000W5GK5C?ie=UTF8&amp;tag=joggo-20&amp;linkCode=as2&amp;camp=1789&amp;creative=390957&amp;creativeASIN=B000W5GK5C)* and I picked it up on Amazon for a little less than $30. It worked right out of the box too, though I might fiddle with key mapping later on.

But regardless, it has all seemed to work. had to work with it a little to figure out the quirks, but I've got access to all of the menus without any changes. It looks nice too, but doesn't feel too expensive -- probably because it was cheap.

## Flashing the BIOS

I've seen a lot of requests for info on how to flash the BIOS on this guy so here goes. You'll need access to Windows and the [HP USB Disk Storage Format Tool](http://www.pcworld.com/downloads/file/fid,64963-order,4/description.html) (long name).

1. Head over to [Foxconn Support](http://www.foxconnsupport.com) and use the filter to find the most recent BIOS file for the nT330i
2. Insert a USB flash drive and use the HP tool to format it with the Win98 boot files (may I recommend getting them from [BootDisk.com?](http://www.bootdisk.com/pendrive.htm))
3. Copy the BIOS files onto the USB drive
4. Boot your nT330i from that flash drive

If all goes well you'll be flashing the BIOS in no time. Now, you will need some DOS chops. It'll spit you out a familiar DOS C: prompt. Use a `dir` command to find the BIOS updater `.bat` file. Run it and you're good to go. Also check out [this excellent tutorial](http://www.jrin.net/2011_12_12/how-to-flash-the-bios-on-a-foxconn-nt-330i/) on flashing the BIOS, if you get stuck.
