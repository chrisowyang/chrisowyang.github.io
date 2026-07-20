---
title: "What incubating Discovery Mode taught me about AI products"
dek: "Three lessons from helping build a recommendation marketplace inside Spotify, back before every product was an AI product."
date: 2026-03-01
draft: true
slug: lessons-from-discovery-mode
---

<!-- DRAFT seeded by Claude from the PRD and public Discovery Mode
     material. Chris: keep, cut, or rewrite — public-safe details only. -->

*Working notes. Everything here is based on publicly available information
about [Discovery Mode](https://artists.spotify.com/en/discovery-mode).*

Discovery Mode let artists tell Spotify which tracks were priorities, and
let the recommendation system factor that in — a two-sided marketplace
built directly on top of machine learning. I helped incubate it, leading
data science and product work. Three lessons that have aged well:

**1. The model is rarely the hard part.** Our hardest problems were never
"can the system do this" — they were deciding what the system *should* do
when the interests of listeners, artists, and the platform pointed in
different directions. Objective functions are product decisions wearing a
math costume. Someone has to own them the way a PM owns a spec.

**2. Incentives are a feature you ship.** The moment your ML system has a
knob that outside parties can influence, you've built a marketplace whether
you meant to or not. Design the incentives with the same care as the
interface, because participants will find every seam.

**3. Trust is asymmetric.** One recommendation that feels wrong costs more
than ten good ones earn. This was true for music and it's *more* true for
LLM products, where the failure modes are fluent and confident. The craft
is in making the system's confidence legible — knowing when to recommend,
and when to shut up.

I notice these three lessons compounding in everything since: at Seek,
lesson three was practically the roadmap. More on that another time.
