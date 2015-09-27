---
layout: post
title: "Debug ghost CSS elements causing unwanted scrolling"
date: 2013-04-26 22:47:37 -0400
comments: true
categories: css debugging
---

Have you ever been working on a site and come across strange horizontal scrolling? Or perhaps you opened your site on mobile and the width does not fit. This often happens from some rogue style breaking out of the main layout. Sometimes this can be found by scanning through the html with your favorite web inspector, but often the task is like finding a needle in a haystack. I came up with this css trick to help quickly scan a page for unexpected styling.
Place this snippet at the bottom of you css file:
{% gist e9456b7aba5a3f9f91a6 %}

To make things even easier, I created a bookmarklet that inserts this code to the bottom of any page.
Drag this link >> [Ghost CSS](javascript:\(function\(\){document.body.innerHTML+="<style>*{background: #000 !important;color: #0f0 !important;outline: solid #f00 1px !important;}</style>";}\)\(\);) << to your bookmarks to use anywhere… or just click and see what happens.
