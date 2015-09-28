---
layout: page
title: "Categories"
footer: false
---

{% for category in site.categories %}
  <a href="/categories/{{ category | first }}">{{ category | first }}</a>
{% endfor %}
