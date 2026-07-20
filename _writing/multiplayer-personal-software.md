---
title: "Multiplayer personal software"
dek: "Software is good at knowing you, and bad at knowing your people. Working notes on why, and what an AI-native fix might look like."
date: 2026-07-01
draft: true
slug: multiplayer-personal-software
---

<!-- DRAFT seeded by Claude from the PRD. Chris: replace with the
     public-safe version of the thesis before final polish. -->

*This is the public-safe sketch of a thesis I'm actively exploring. It's
deliberately incomplete.*

Every personalization system I've worked on — music recommendations at
Spotify, natural-language analytics at Seek, subscriptions at Uber — shares
an assumption so deep it's invisible: the unit of personalization is one
person.

But almost nothing important in life is single-player. Money is shared.
Meals are shared. Calendars, trips, kids, aging parents, the group chat
that plans everything — these run on small, durable groups of two to eight
people. And the software those groups use is remarkably bad. It's either
enterprise software wearing a costume (a "family workspace" with an
admin panel) or a shared note slowly losing its mind.

The interesting question isn't "how do we add sharing to personal apps."
It's what software looks like when the *group* is the first-class user:
when the system understands that a household has preferences no individual
member holds alone, tensions it should route around, and rituals it should
protect. LLMs make this newly possible — they're the first technology
cheap and flexible enough to model a group's messy, implicit state without
forcing the group to maintain a database about itself.

Open threads I'm pulling on:

- Where does group state actually live today, and who pays the cost of
  maintaining it? (Spoiler: usually one person, usually unpaid.)
- What's the multiplayer equivalent of a recommendation — a suggestion a
  *group* can accept without a meeting?
- Why did every "family OS" startup of the 2010s converge on chores and
  calendars, and why is that the wrong beachhead?

If any of this is a thread you pull on too, I'd genuinely like to compare
notes.
