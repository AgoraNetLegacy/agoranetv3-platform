# Presentation Backlog; the owner's list

> **SUPERSEDED for build purposes (2026-07-13):** this list was the
> SOURCE for `Presentation/PRESENTATION_SPEC.md` (Desktop corpus),
> which the owner has since corrected and RATIFIED; build from the
> spec, never from here. Known divergences: item A1's "one place at
> two depths" framing was owner-overruled (the Agora dashboard IS
> the platform dashboard, one thing); item B4's renames were all
> REJECTED (every name kept); item C6's wizards are DEFERRED. This
> file stays as the historical record of his first-session findings.

Started 2026-07-11, the day after the build finished. The plan, in
Shawn's words: build to spec first, then fix and change presentation
from a safe starting point without fear of breaking anything. The
safety net that makes this true: 206 tests + 31 db:verify checks pin
every mechanic (ledgers, privacy, fees, ceremonies); styling and IA
can change freely, and the suite screams if a change ever touches
something load-bearing.

**Nothing on this list is scheduled until Shawn says so.** Items land
here as he brings them up; they build in ratified batches, each ending
in a browser walkthrough with tests green.

---

## A. Information architecture (needs a short spec + owner ratification before building)

1. **The Agora is the hub.** Home/default screen = The Agora, matching
   the thesis ("the six diagnose, The Agora equips"). The feed lives
   there. Design wrinkle to solve: home-Agora vs. the Agora pillar's
   own dashboard must feel like one place at two depths.
2. **Left-sidebar feature navigation.** The 7 Pillars become one
   feature among the features; persistent left nav lists the estate.
3. **Discussions surfaced inside pillar dashboards.** Structurally
   already true; fix the labeling and door placement (the domain
   page's conversation door is at the bottom of a long read; a soul
   couldn't find "discussions" by that name).

## B. Naming & framing (owner's language, not Claude's)

4. **Reconsider feature titles so they're self-explanatory.**
   Candidates for rename or explanation: Pollinator, Chambers,
   Circles, Light Score. NOTE: souls / fellow souls / hatching are
   ratified platform vocabulary (identity, not labels); renaming
   those is a spec amendment, not a style choice.
5. **Market features by why they matter.** Every feature gets a
   benefit-led one-liner used everywhere it appears ("a place to
   workshop an idea before defending it in public"; not "Chambers").

## C. Guidance

6. **Wizards / walkthroughs per feature.** Invitational, never
   nagging (house ethos: quietest defaults): summonable "show me
   around" tours + first-visit hints that dismiss forever. The
   60-second orientation is the existing seed.

## D. New surfaces (small feature work, not just style)

7. **User profile window; souls add information about themselves.**
   Per-face, always (an Alias bio and a True Self bio must never
   share a database row or a writing surface). ⚠ Privacy flag to
   design around: free-text self-description is a self-disclosure and
   stylometry vector (DUAL_IDENTITY §7.1 v2/v6); the composer should
   carry the same honest warning the Alias ceremony does, and place
   rules follow the ratified "place yourself on the map, never
   someone else's" amendment.
8. **Design the dashboards properly:** per-pillar dashboards, the
   moderation workbench, and each feature's landing page get a real
   design pass (current state is functional scaffolding).
8b. **A settings page; doesn't exist yet (owner, 2026-07-11).**
   First residents: switch-animation method (#12), display-name
   change (currently buried on /profile), notification/feed
   preferences (currently scattered on their own surfaces), and the
   future profile-bio editing (#7). Design rule: settings are
   PER-FACE wherever they touch identity or expression; an Alias's
   settings screen must never display or echo the True Self's
   choices (a shared "account settings" page would itself be a
   linkage surface). Browser-level choices like animation method can
   be per-session instead.

## E. Design system (pure styling; safe anytime)

9. **Custom icon set** replacing the standard/emoji icons; one
   matching platform family.
10. **Typography**; chosen fonts replacing defaults.
11. **Theme & effects**; a coherent visual style, built as design
    tokens (colors, spacing, type scale) so whole themes can be
    swapped and experimented with without touching structure.
12. **THEME = IDENTITY (owner's vision, 2026-07-11).** True Self =
    white theme with the platform's aqua blue; Alias = dark/black
    theme with the same blue; the blue is the brand thread across
    both; one brand, two faces. **Face switching = the card flip:**
    the entire page flips like a playing card, white side to dark
    side. The soul always knows which face they're wearing from the
    room's color alone; the dual-identity invariant rendered as
    ambient, unmissable state. Design notes: theme-as-signal
    deliberately overrides personal light/dark preference (the
    safety signal wins; posting as the wrong face is the error that
    self-doxxes); **the reader state is the BLUE theme** (owner,
    2026-07-11): signed-out / no-face = the aqua blue itself; blue
    means reading, white means True Self, dark means Alias, and the
    brand color doubles as "free to read" made visible; **the switch
    animation method is a soul's choice in settings** (card flip
    default; crossfade or instant as alternatives; this also covers
    reduced-motion needs by choice rather than detection); the
    permanent-space amber banner must read on all three themes.

## F. Process notes

- Presentation pass lands BEFORE the cohort test; don't spend real
  humans measuring a UI already slated for replacement.
- Each batch: short spec → owner ratifies → build → browser
  walkthrough → tests + db:verify green → owner looks when he wants.
- Once Shawn can test properly, findings from his own sessions land
  here and batch into slices.
