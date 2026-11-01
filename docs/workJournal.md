# Reddoor Starter — Work Journal

Running log of build work: what was done, why, and where it landed.
Chronological — newest entry at the bottom. [STARTER.md](STARTER.md) says what
the stack ships; this is the history of getting it there.

The convention is in [CLAUDE.md](../CLAUDE.md) under "The work journal". In
short: every working session appends a dated entry, prose over bullets, why
over what, and history is never edited to be right — a later entry corrects an
earlier one and says so.

---

## 2026-09-05 — Journal opened, and 280 commits of history summarised rather than reconstructed (`chore/work-journal`)

> Superseded in part by 2026-09-08 — The Webflow rebuild pipeline has a home,
> and it is not this repo.

The journal starts today, so this first entry is a **backfill**: a deliberately
coarse summary of what came before, written from the commit log rather than
from memory. Detail below this line is trustworthy; detail above it is not, and
nothing here should be cited as though someone wrote it down at the time. The
commit log remains the record for anything before 2026-09-05.

**What this repo is.** A forkable SvelteKit 2 / Svelte 5 / Tailwind v4 /
Prismic starting point for every site Reddoor builds, deployed on Netlify. 280
commits from `initial` on 2024-02-22 to here — 72 in 2024, 68 in 2025, 140 in
2026, which is the shape of a template that stopped being a side project once
sites started shipping from it.

**The eras, roughly.** 2024 and 2025 are the slow build of the stack itself.
2026 is where the volume is, and it clusters: **July alone carries 61 commits**,
mostly the Blux migration track — a frozen-render pipeline for pixel-faithful
migration of an existing catalog site, proven on `the-pointe-burbank` and then
upstreamed (#78, #81–#84, #88, #89). That layer was snapshotted out to
[reddoor-starter-blux](https://github.com/reddoorla/reddoor-starter-blux) on
2026-08-31 as forward-merge-only, so this repo keeps the general case and the
Blux specifics live next door. August and September are consolidation: the
shared configs adopted so sync drift went to zero (#110), Prismic srcset widths
capped with a real `sizes` on every image (#109), and `Testimonial` and
`CtaBanner` added to the slice library, taking it to nine.

**One trap worth pulling forward, because it recurred downstream.** #74
(2026-07-18) reworded a comment in `src/app.html` so that `%sveltekit.body%`
was not trapped inside it — SvelteKit substitutes the **first** occurrence of a
placeholder and only the first, so merely _mentioning_ one in prose consumes
it. The fix was correct and it held. The lesson did not generalise: on
2026-09-04 the Vida Legacy Foundation site shipped the identical defect against
`%sveltekit.head%` **twice in one hour**, the second time while writing the
explanation of the first. A fix that lands in one repo as a one-line reword,
with no test and no note that the whole placeholder _family_ is affected, is a
fix that gets to happen again. That is a large part of why this journal exists.

**State as of this entry.** `main` at `2377e9c`, CI green. Nine shared slices,
each with `model.json`, `mocks.json` and a vitest suite. The `pnpm verify`
gate runs prettier → eslint → svelte-check → build → axe → unit + smoke, which
is exactly CI's order. `docs/NEW-SITE.md` lists what is still a template
default in a fresh clone.

**What changed today.** `CLAUDE.md` gained "The work journal", and this file
exists. Because this file ships with the template, every site generated from
the starter now starts with the convention rather than acquiring it later —
which was the actual gap: Vida Legacy Foundation accumulated four days of
hard-won detail in `CLAUDE.md` prose and PR bodies, where it is real but
unordered, because there was nowhere chronological to put it.

## 2026-09-05 — Ten retrospective rules made into defaults, and the half of the journal rule that was missing (#115, `15abd0d`)

Two changes, a few hours apart, and the second exists because a research pass
went looking for what the first got wrong.

**The ten rules landed (#115).** `scripts/figma-compare/` is now in the template
rather than in one site's repo, `package.json` ships
`reddoor.a11yRoutes: ["/"]` so a clone's axe gate measures a real page from the
first commit instead of only `/dev/a11y-fixtures`, and `CLAUDE.md` gained "Six
rules that came from shipping a site". The provenance of all ten is Vida Legacy
Foundation's `docs/workJournal.md`, written the same week.

**And the journal rule turned out to be half a mechanism.** It says an entry
that stops being true is never rewritten — a later entry corrects it and names
which one. That is right, and on its own it fails at the only moment it
matters. The correction goes to the bottom of the file. A reader searching for
"sticky band" or "Turnstile" lands in the middle, on the superseded paragraph,
and leaves with the answer that was already known to be wrong. Nothing in the
old entry points forward, because the rule forbade touching it.

So: one line under a superseded heading, `> Superseded in part by <date> —
<title>.` It asserts nothing and retracts nothing, so the record of what was
believed at the time survives whole; it only redirects. The distinction that
makes it safe is that a pointer is *navigation*, not *content* — the prohibition
is on editing the claim, and a pointer makes no claim.

The evidence it was needed showed up by accident. Sweeping the convention across
the fleet found `a-budget`'s `CLAUDE.md` already doing it by hand, uncommitted:
`**SUPERSEDED WHILE IN DEBT PAYOFF — see "Envelopes: pure retroactive" below.**`
Somebody hit the problem and invented the fix locally, which is usually the sign
that a convention is missing rather than that a person is wrong.

**One thing not to copy from the site that produced these rules.** Its
`CLAUDE.md` is 963 lines and ~13K tokens, loaded into every session whatever the
task. The only measured study of this file class (Gloaguen et al., ETH Zurich,
arXiv:2602.11988, Feb 2026 — 138 tasks, four agents) puts developer-written
context files at **+4% task success for +19% inference cost**, and concludes
that unnecessary requirements in them make tasks _harder_. The archive is worth
having; keeping all of it in the always-on file is not. Traps and history belong
in the journal, and `CLAUDE.md` should hold the minimum a session must not
violate. This starter’s own is 194 lines and should stay closer to that than to 963.

## 2026-09-08 — The Webflow rebuild pipeline has a home, and it is not this repo (`docs/webflow-pipeline-records`)

Docs only. Nothing Webflow-specific enters this template, and that is the
decision worth recording.

The 2026-08-31 track-split spec said the Webflow importer targets the native
`page` type. **That was a third true.** The importer also emits `person`,
`news_article` and `collection_item` documents, and Beachfront renders them
through a `CollectionList` slice and a collections loader wired into the page
route — all of which exist in the Blux track and in Beachfront, none of them
here. Believing the old sentence would have made "point the importer at a native
clone" sound like a small job.

So the pipeline lives next door: importer and seed runner in reddoor-maintenance,
round scripts and the `/dev/match` twin installed by a new `match-harness`
recipe, the phase protocol in the `matching-a-page` skill, the round rules
written into each site's own `CLAUDE.md`. This repo gets one orientation row. The
rule behind that placement is what the Blux split taught: **the template ships no
hook whose default does work, and no field an editor cannot fill.** A "three-line
seam" in `page-load` was considered and rejected — same species as the two
document types probed per page load that native-ize deleted in #106 (242 files
changed, 178 deleted, slices 28 → 9, custom types 7 → 1, build 840K → 412K).

Lists on a rebuilt site are content relationships by default (a repeatable group
restricted to a type; order is the group's order; no route change), and automatic
indexes are dedicated routes with their own server load, like `/contact`. Both
are site-side patterns, not template mechanisms.

**The largest thing NOT done, so it is not rediscovered as new.** Fourteen
generic product-quality fixes Beachfront made between 2026-08-07 and 2026-09-02 —
noindex prefixes, reveal state in the markup, a focus-ring floor, live
reduced-motion, modal scroll-lock, nav tap response — are absent here and are
already propagating into sites bootstrapped from this template; Vida Legacy
Foundation inherited five of them on 2026-09-01 and independently re-fixed a
sixth. It is the largest per-site saving measured anywhere in this work (~18% of
a Beachfront-sized build, against ~10% for every conversion layer combined), and
it is now #121 on this repo with commits, files, native counterpart and a test
for each, one PR per item.

**Honest accounting, because this entry was drafted before the work it
describes.** The paragraphs above were written into the plan on 2026-09-08 and
are unchanged; what follows is what actually happened, and some of it contradicts
what was believed while planning. Two of the plan's own predictions were wrong on
contact. An empty Prismic repository does not 404 — it 500s, because the Content
API rejects the _predicate_ when nothing of that type is published. And the error
it gives, `unexpected field 'my.page.uid'`, was then documented as meaning "the
type was never pushed", which is also wrong: the same error appears with the type
registered, byte-identical to the error for a type that has never existed. Both
corrections are in reddoor-maintenance, the second one twice, because the first
fix asserted a discriminating check in both directions when it only holds in one.

That pattern is the entry's real content. Across one session, eight separate
claims failed the same way — a derived, cached, or configuration view of state
read as though it were the state. A CDN served a `no-store` response as a cache
hit. An author-filtered PR search returned a confident empty set because
self-hosted Renovate authors as a person, not an app. A `>>` redirect denied by a
sandbox still printed "appended", because the `echo` after it reports on itself.
Three of the eight were committed by someone actively holding the fleet rule
about positive evidence in mind, and one _while writing the correction to a
previous instance of it_. They are enumerated as reddoor-maintenance#711.

The eighth is the one worth carrying into this repo, because it is a different
shape and no rule here covers it. A verification step existed, was correct, was
run, and passed — and its coverage was exactly complementary to its bug: it
checked a CLI entry guard by invoking the script through a real path, and the
guard only fails when invoked through a symlink. An absent check is visibly
absent. A check blind in precisely the configuration that breaks reads as green
diligence. `CLAUDE.md`'s existing rules tell you to demand positive evidence and
to enumerate the class; neither tells you to ask **under what invocation the
evidence was produced, and whether that is the invocation that fails.**

## 2026-09-17 — Ready for site #2, except the a11y gate has been measuring a 404 page (audit only, no code change; #147)

A fifteen-agent workflow asked one question before the second client site is built
from this template: can `/new-site` clone `origin/main` today and produce a green
site? Four readiness audits — the starter itself, the `/new-site` and
`/figma-slices` skills, the Vida Legacy Foundation backport, and the
fleet-maintenance side — each had an adversarial verifier whose job was to
confirm, partially confirm or refute, and to list the claims that rested on the
absence of an error rather than on an artifact. Nothing in this repo was changed
today. This entry records what the audit found about the template and the
pipeline; the client-specific inventory is being written into another repo.

**The answer is yes, with numbers.** A fresh clone of `origin/main` at `0859ab8`,
with `/new-site`'s bootstrap edits applied (package name, the `netlify-site` CI
input, `SITE_NAME`, the README placeholders), installs from the frozen lockfile
and passes `pnpm verify`: prettier clean, eslint over 165 files with 0 errors and
0 warnings, svelte-check `COMPLETED 4519 FILES 0 ERRORS 0 WARNINGS`, a build, the
a11y audit, 60 test files / 469 unit tests, and 12 smoke specs. CI on that same
SHA (run 35182451450) logged the same counts, so the local run is not a different
configuration that happens to agree. eslint and prettier really do reach the
`.svelte` files — 46 of them, 0 different — which is the hole `.prettierrc`
closed and is worth re-measuring rather than assuming.

**The most valuable correction is that the a11y green is vacuous at bootstrap.**
The template ships `reddoor.a11yRoutes: ["/"]`, and `/new-site` step 3c sets it
before Prismic exists. While the `your-prismic-repo-name` sentinel is in place,
`/` returns 404 on purpose — `tests/smoke/routes.ts` knows that and asserts it.
The a11y audit does not: `@reddoorla/maintenance` 0.93.1, which the lockfile
pins, calls `page.goto(path)` and hands the page straight to axe with no status
check, so axe scans the SvelteKit error page and reports zero violations for a
home page that does not exist. A verifier reproduced the whole shape in its own
clone rather than trusting the auditor's logs: on 0.93.1 with `a11yRoutes ["/"]`,
`pnpm test:a11y` exits 0 and prints "0 violations across 2 routes"; pinned to
0.96.0 with the same config it exits 1 with `{id: "route-missing", impact:
"serious", route: "/", help: "/ returned 404"}`; the control, 0.96.0 with
`a11yRoutes []`, exits 0 again. The status branch first appears in v0.96.0 and is
absent from 0.93.1 through 0.95.1.

That matters more than a stale pin. This repo's own first rule says a pass must
require an artifact only a working system produces, and that a field which can
only observe configuration must not be named after the thing it cannot observe.
Here the rule fails _inside the instrument that enforces the other rules_: the
gate whose whole job is to produce positive evidence about rendered pages has
been producing an absence-of-violations result on an error page, and every
previous audit that cited "a11y: 0 violations" as evidence of health — including
this one's own positive-evidence list, as its verifier pointed out — inherited
that vacuity. The verifier also corrected the blast radius. Nothing is red today,
because `main` and fresh clones pin 0.93.1 and the shared Renovate config only
acts before 6pm on Mondays with a one-day `minimumReleaseAge`, so the earliest
window is 2026-09-21. When it fires, the red lands on the grouped
`renovate/all-minor-patch` PR, which carries `@lucide/svelte`, `@playwright/test`,
eslint, prettier, svelte, vite, typescript-eslint and the `reddoorla/.github` pin
along with the maintenance bump. One 404 therefore stalls every non-major update
in the group, not just the bump that exposes it.

**A fix that looked obvious would have broken the template.** The natural
follow-on to bumping to 0.96.0 is to take the new `reddoor.gateServer:
"preview"` option, which answers this repo's "verify on a production build" rule
and VLF's open issue about it. Two verifiers independently showed that setting it
at bootstrap is wrong. Under `preview`, the v0.96.0 Playwright `webServer` runs
the build and probes `http://localhost:<port>/` for readiness, and Playwright
1.62.1 treats a server as ready only for `statusCode >= 200 && statusCode < 404`
— so on the placeholder, where `/` is a deliberate 404, the server never becomes
ready and both gates fail at the five-minute timeout. Separately, the starter's
own browser specs target `/dev/a11y-fixtures` and `/dev/animate-in`, which `#134`
made 404 in a production build, so they would fail under preview even with a home
page. The order is: bootstrap on the dev server and report explicitly that the
gate is not yet measuring the site, publish the home document, then opt into
preview and split the `/dev`-targeting specs into their own project. One more
correction from the same thread: `gateServer` moves the hydration smoke, not the
axe scan, which stays on `vite dev` by design.

**VLF's process lessons came back; its code lessons largely did not.** The six
standing rules, the journal convention with its forward-pointer clause, the
figma-compare harness with the cap-height trim recorded per style, real
`a11yRoutes` at bootstrap, the locale-string inventory and the review-round rules
all landed here or in the skills. The generic defects VLF found while fixing its
own did not, and four of them were re-measured today rather than taken on
report. A Prismic preview of any non-home page lands on `/`: since `#90` the
client is routes-free, so the Content API leaves `doc.url` null, `/api/preview`
passes the bare client to `redirectToPreviewURL`, and `asLink` with no
linkResolver returns null, falling back to `defaultURL`. Run against the
installed `@prismicio/client` 7.22.0 with a stubbed fetch returning
`{uid: "about", url: null}`, this template answers `Location: /preview/` where
VLF's wrapper answers `Location: /preview/about`. The `--screen-*` tokens in
`app.css` are Tailwind v3 naming that v4 ignores: compiling `@theme { --screen-sm:
560px; --screen-xl: 1340px }` with the installed `@tailwindcss/node` 4.3.3 emits
`@media (width >= 40rem)` and `@media (width >= 80rem)`, so `sm` is really 640px
and `xl` really 1280px and the declared 560/1340 are dead — the second site to
rediscover this, after the Beachfront note. The fleet's Typekit swap,
`media="print" onload="this.media='all'"`, is an inline handler that the nonce
CSP refuses; measured in Chromium, media stays `print` and `faces=0`. The
verifier refuted half of that finding as received: all 210 font URLs in kit
`noj4tji.css` are `use.typekit.net/af/...`, so faces register and load with only
`use.typekit.net` in `style-src` and `font-src`; `p.typekit.net` is needed only
to silence the console error from the `p.css` tracking `@import`, which matters
because a console-error smoke assertion would fail on it. And `Nav.svelte` has no
no-JS path below `lg`: the link list is `hidden ... lg:flex` and the menu exists
only inside `{#if isMenuOpen}`, so a phone visitor without JS cannot navigate at
all — while the fleet Playwright config still forces `reducedMotion: "reduce"` on
every test, which is what made a class of no-JS assertions vacuous before.

**Four fleet-side facts would bite site #2 on day one.** The local maintenance
`dist/` was built at 2026-09-15 11:05, four hours before `#812` landed at 15:10,
so `ensure-site --name` still behaves create-only there; the skill never passes
`--name` anyway, which is why two fleet rows still carry their bare slug as the
client-facing Name sixteen days later. Checking `--version` does not detect this,
because the CLI reads its version from `package.json` at runtime and this stale
build cheerfully prints `0.96.0`. `sync-configs` still decides by exact byte
match for eslint, playwright, lighthouse and prettier: today's starter plans zero
writes, but VLF's `origin/main` plans two, and one of them replaces a 3020-byte
`playwright.config.ts` carrying a four-project no-JS/phone rendering matrix with
the 74-byte re-export — the suite still passes afterwards and simply covers less.
Across 24 local checkouts the planner would overwrite 38 such files. The starter
sits on maintenance 0.93.1 against a released 0.96.0, and on `reddoorla/.github`
v1.4.1 against v1.4.2 (22 of 23 org repos are on the old pin); v1.4.2 is the
commit that stops apt reading Google's Chrome repo, the failure that took out
every fleet CI run three times in forty minutes on 2026-09-09.

**Two of the traps the verifiers found are not about code at all.**
`ensure-site` throws unless the display name slugifies back to the slug, and
`siteSlug` lowercases and collapses non-alphanumerics, so the skill's own example
slug cannot take the client's real name — the slug decides the client-facing
name, in auto-reply copy and report subjects, and it also becomes the GitHub repo,
the Netlify site, the forms-ingest path and the suggested Prismic repo name.
Deciding it late means renaming five systems; the operator has now settled on
`roalson-interests`. The second: `FIGMA_PAT` is the only working Figma REST
credential on this machine — a read-only `/v1/me` with it returns 200 — and it is
what `scripts/figma-compare/pull-figma.mjs` in _this_ repo consumes at Stage A.
It appears on the maintenance meta-week list of "the four keys nothing reads",
tagged as measured, because that census grepped only the maintenance repo and
never saw the consumer that lives here. Carrying out that five-minute rider would
have deleted Stage A's credential days before it is needed.

**Honest accounting about the audit itself.** The verifiers' most useful output
was not the confirmations but the list of claims resting on absence of evidence:
grep finding no analytics IDs or font-kit strings is not proof the routes are
clean; `gh repo create --help` listing `--public` is not a repo created;
`node --check` passing on the figma-compare scripts is not the harness run
against a comp; "`/dev` routes 404 in production" was verified by observing that
the guard file exists in both repos, with no production build loaded; the
scroll-reveal no-JS spec was read, not mutated to watch it go red. Several
severities were corrected downward on contact — the missing capability-index
mention in the skills is belt-and-braces now that `docs/COMPONENTS.md` is tracked
and `CLAUDE.md` points every session at it, and the chrome-link prerender failure
names its own referrer in the error, so it costs one failed build rather than an
afternoon. Two side effects are worth recording because someone will otherwise
pay for them without knowing why: the starter-health agent's unsandboxed run of
`playwright install chromium` made Playwright 1.62.1 evict the cached
`chromium-1243` and `chromium_headless_shell-1243` builds from
`~/Library/Caches/ms-playwright`, so every other checkout pinned to 1243 will
re-download them on its next install; and one agent briefly wrote a probe script
into the `reddoor-maintenance` checkout before deleting it seconds later.

**Nothing was fixed today.** No file in this repo changed; this entry is the only
artifact. The skill patches — the `--name` argument, the rebuild step, the gate
order, the Typekit and Turnstile traps — are being made in the `claude-skills`
repo, and the template-side work (bump maintenance to 0.96.0 behind a
sentinel-aware a11y audit, the CI pin to v1.4.2, and the VLF backports named
above) is a separate batch that has not landed.

## 2026-09-17 — The maintenance bump and the CI pin, held together by a gate that was scanning a 404 (#148, `chore/bump-maintenance-0.96-ci-v142`)

Two pins were stale — `@reddoorla/maintenance` at `^0.93.1` against a published
0.96.0, and the reusable CI workflow at `v1.4.1`. They went in one PR because
bumping the first one alone turns this template's own CI red, and the reason it
does is worth more than either bump.

**The pairing.** 0.96.0 carries the route-status guard from
reddoor-maintenance#807 (closing #680): a route listed in
`package.json` → `reddoor.a11yRoutes` that does not answer 200 is recorded as
`route-missing`, impact `serious`, and axe is **not** run over the error page.
This template ships `a11yRoutes: ["/"]` and sits on the `your-prismic-repo-name`
sentinel permanently, so `/` 404s by design — `src/routes/[[preview=preview]]/+page.server.ts`
calls `error(404)` while `isPlaceholderRepo`, and `tests/smoke/routes.ts`
asserts exactly that 404. The two are not in conflict; they were never
introduced to each other.

**Measured, both directions, on this tree with 0.96.0 installed.** The rule is
that a guard you have not watched go red is not a guard you have tested, so the
`["/"]` case was restored on purpose and run:

```
a11yRoutes ["/"]  → exit 1
  a11y: 1 violations across 3 routes (2 fixtures + 1 from package.json) — route-missing on / (/ returned 404)

a11yRoutes []     → exit 0
  a11y: 0 violations across 2 routes (+1 hydration smoke)
```

**The belief that was wrong before contact.** The instinct was that this bump
merely _broke_ the template's a11y gate. It did the opposite: it exposed that
the gate had never been measuring anything here. For as long as `["/"]` has been
in this file against the sentinel, `pnpm test:a11y` was loading the 404 page,
running axe over it, finding nothing to flag on a bare error page, and reporting
a pass. The line `0 violations` was true and meant nothing — the exact shape
CLAUDE.md's "a pass needs positive evidence" rule names. 0.96.0 did not create a
red; it converted a false green into an honest one.

**Honest accounting: that diagnosis is not this session's.** It was made and
measured in the 2026-09-17 readiness audit (#147), whose verifier pinned 0.93.1
with `a11yRoutes ["/"]` in a clone and watched `pnpm test:a11y` exit 0 printing
"0 violations across 2 routes" for a home page that does not exist, then pinned
0.96.0 with the same config and watched it exit 1. This session measured only
the two runs above — 0.96.0 with `["/"]` and with `[]` — and did not re-run
0.93.1. Anyone re-deriving the blast radius should read #147's entry, not this
one; it also records the part that made the timing matter, which is that the red
would otherwise have landed on the grouped `renovate/all-minor-patch` PR on
2026-09-21, stalling eight unrelated updates behind one 404.

**The fix here is a workaround, and the better one is filed.** The template set
`a11yRoutes` to `[]` and `docs/NEW-SITE.md` grew a section saying why, and
saying that a real site adds `"/"` back at `/new-site` step 6 once the Prismic
repository exists and a `home` document is published — at which point the 0.96
guard becomes a genuine positive-evidence check instead of a scan of a 404.
Empty is not "gate off": the audit still scans `/dev/a11y-fixtures` and
`/dev/animate-in` and still hydration-smokes `/`, which is why the green above
reads `2 routes (+1 hydration smoke)`.

But `[]` is the only answer available to a template that can never have a real
route. It is the wrong answer for a real site, because an empty list is
precisely the configuration that once let a critical `image-alt` violation ship
to five production pages with CI green. The better fix is to make the audit
sentinel-aware the way `tests/smoke/routes.ts` already is — read
`slicemachine.config.json`, and on `your-prismic-repo-name` either expect the
404 or skip the route _with a labeled note in the summary_. That is
reddoorla/reddoor-maintenance#863. It matters well beyond this repo: `/new-site`
step 3c points the gates at real routes at bootstrap, step 6 replaces the
sentinel, and **every new site lives between those two steps** — so its first
maintenance-bump PR goes red for something that is not a defect in the site, and
whoever picks it up either debugs a non-bug or learns to route around the gate.

**The CI pin, and why it is not cosmetic.** `v1.4.2` adds one step before
`playwright install --with-deps`: `sudo rm -f /etc/apt/sources.list.d/google-chrome.list`.
On 2026-09-09 Google's Chrome apt repo served a `Packages.gz` whose hash did not
match its own signed `Release`, apt refused the entire update with "Hash Sum
mismatch", and every fleet CI run died there before a single test ran — three
times in forty minutes. Nothing in this stack installs `google-chrome`;
Playwright brings its own Chromium. Dropping the source takes a third party we
do not depend on out of the critical path. Pinned to the full SHA
`c714d9e472885bbf66f386e9f056a16aab7986d2`, tag comment kept, per the fleet
convention — a tag is a movable ref and a short SHA is not a pin.

**Found and not fixed.** The `/new-site` skill's step 3c still carries a "known
reporting trap" note claiming the a11y pass summary always reads
`0 violations across 2 routes` no matter how many routes ran (reddoor-maintenance#697),
and tells the operator to poll for the audit's temp spec file to learn the
truth. The run above disproves it — 0.96.0 prints
`3 routes (2 fixtures + 1 from package.json)`. The note lives in the
`claude-skills` repo, so it could not be fixed in this PR; it is recorded in
reddoorla/reddoor-maintenance#863 so it is not lost.

**Merge order.** This branch was cut from `origin/main` while #147
(journal-only) was still open against the same file. The conflict in
`docs/workJournal.md` duly happened; it was resolved by rebasing onto #147 and
keeping both entries in the order they merged, since they are appends to the
same tail and neither contradicts the other.

## 2026-09-17 — Two template defects the second site paid for: a frozen copyright year and a text token that cannot be trusted with a brand colour (`fix/footer-year-and-text-contrast`)

Both of these were found by bootstrapping roalson-interests earlier today, and
both are template problems rather than that site's, so they are fixed here.

**The copyright year could only be right once.** `SiteConfig.footer.text` is a
plain string and `<Footer>` rendered it verbatim, falling back to
`© ${new Date().getFullYear()} Company Name`. So a site had two options: leave
the placeholder, which says "Company Name" on every page, or set `text` to its
own line — which freezes whatever year it typed. Correct in the January it is
written, wrong every January after, in a repo nobody is looking at. Roalson took
the second option at bootstrap and its footer now reads a hardcoded 2026.

`footer.owner` is the fix: the site names the entity, `<Footer>` supplies the
year. `text` stays, documented down to what it is actually for — a rights line
that is not of the form `© <year> <owner>`, which is why composition-hospitality
has one. Its test asserts the CURRENT year computed at assertion time rather
than a literal, because a literal expectation would pass for a year and then
start failing on a date nobody associates with the change.

**`--color-secondary` asserts something the template never checked.** The name
says the token is text-capable. A brand's "secondary colour" very often is not,
and the template spends this one as text in eight places a new site never
touches — footer copyright, `Field.svelte`'s description, the eyebrows on
LeadText, TextColumns and Testimonial, the testimonial role line, the contact
intro, a dev fixture. So assigning a light tint to it does not fail somewhere; it
fails on every page that renders a footer.

Roalson's dust `#B2AC9F` measured **1.97:1** on the page ground. The a11y gate
caught it, and that is later than it sounds: the gate needs a built site and a
browser, it names one node rather than the class, and on a fresh clone it is
pointed at fixtures — on a site that had not yet published a home document it
would not have run on a real page at all.

`src/lib/theme-contrast.test.ts` now parses the `@theme` block and measures
every text/ground pair the template actually composes, failing below 4.5:1 in
milliseconds with no browser. Both halves were proven by mutation rather than
asserted:

- setting `--color-secondary` to Roalson's dust fails two cases with
  `--color-secondary on --color-background is 2.26:1, below AA (4.5:1)` — and
  the message names the fix, which is to split the token rather than to change
  the pair being measured;
- changing one `text-secondary` to `text-accent` fails the completeness case
  with `unmeasured: accent`, so a new text token cannot quietly arrive without
  someone saying which ground it lands on.

**One measurement worth recording, which is NOT asserted.** In the shipped
placeholder palette `secondary` `#6b7280` on `light` `#e5e7eb` is **3.90:1** —
already below AA. `bg-light` is used 17 times and `text-secondary` 12 times, but
no component currently nests one in the other: in `/dev/animate-in`, the only
file with both, they are siblings. So the pair is not asserted, because
asserting it would fail the template's own defaults for a composition that does
not exist. It is one nesting away from being real, and that is written into the
test beside the list rather than left to be rediscovered.

**Honest accounting.** The class was not obvious from the failure. The first fix
here repointed the dev fixture at a new `-aa` token, which left the gate red,
because the fixture was never the failing element — the footer was.
`grep -rn "text-secondary"` returns eight files and was available the whole
time. CLAUDE.md already says to enumerate the class before fixing an instance;
this session still had to pay for it once before doing so.

## 2026-09-29 — The none-hued Tailwind palette gets explicit hues, so axe can measure the Hero (#152, PR to follow)

Tailwind 4.3 writes 13 palette entries with a `none` hue: every `neutral-*`,
`zinc-50` and `mauve-50`. The Hero slice's `bg-neutral-900`, for example, is
`oklch(20.5% 0 none)`. Browsers render `none` as 0. axe-core 4.13.0, the
latest release, cannot parse it. The Hero's white "Explore" CTA sits on that
band, so axe finds the CTA's white first. It then parses every element under
the CTA to build the stacking context, reaches the band, and throws. The
color-contrast rule is skipped for the whole `/dev/a11y-fixtures` page. The
gate fails only on violations, so the page read as clean. Contrast had not
been measured there at all.

@reddoorla/maintenance#916 turns that crash into a `rule-errored` failure. It
also turns text sitting directly on such a colour into a
`contrast-unmeasured` failure. Measured in a copy of this repo at `f96b4ac`
with a packed build of that PR:

- On main: `rule-errored on a11y fixtures`. The crash node was the CTA
  (`.inline-block`), and 0 color-contrast nodes were measured on the page.
- With this change: `0 violations across 2 routes`. 64 color-contrast nodes
  were measured on the fixtures page.
- On main with the locked 0.97.0: `0 violations`. That was the blind green.

The fix overrides the 13 tokens in `@theme` with Tailwind 4.3.3's own values,
with the hue written as 0. The screenshots of `oklch(L 0 none)` and
`oklch(L 0 0)` are byte-identical at all 11 lightness values, so nothing on
screen moves. Once Tailwind or axe is fixed upstream, the override can go,
but only after the gate has been seen passing without it.

The override sits inside the `@theme` block that `theme-contrast.test.ts`
scans, and it stays there. That put the 13 tokens in front of a guard that
read only hex. A later `text-neutral-600` would have failed as unclassified,
and classifying it would then have failed as "cannot measure oklch". This
was found by review, by adding a throwaway `text-neutral-600` line. The guard
now reads an achromatic `oklch(L 0 H)` as the sRGB encoding of L³ in linear
light, which gives Tailwind's own greys: #fafafa, #525252, #171717, #0a0a0a.
It still refuses a `none` hue. With the fix, the same probe passes both
steps (15 tests), and the probe was removed. This is the first part of #152.
Field's `red-600` failing AA off white, the issue's second part, is not
touched here.

## 2026-10-01 — Mantis Landscaping P0: identity, the matching harness, and the Blux reference (this PR)

This repo was generated from reddoor-starter for mantislandscaping.com, which was served by Blux. The plan and the operator's answers are in reddoorla/reddoor-maintenance: `docs/mantis-landscaping-plan-2026-10.md`, #1107, and BACKLOG Operator decisions 59–62. This PR is P0 of that plan. Everything above this entry is the starter's own history.

**Identity.**

- `package.json#name`, the CI `netlify-site` and `SITE_NAME` are now `mantis-landscaping` / Mantis Landscaping.
- The Netlify name is assumed from the fleet convention (name = slug) and is not yet confirmed.
- `slicemachine.config.json` still carries `your-prismic-repo-name`. The Prismic repository `mantis-landscaping` exists (its `/api/v2` answers 200; a made-up name answers 404) but has no content. Naming it now would re-arm loud-fail prerendering and turn the build red. The rename rides with P2's seed.

**The matching harness** was installed by `reddoor-maint match-harness --ref https://mantislandscaping.com`, which committed to a branch of its own; that commit is folded in here.

- `refMark` is the Blux site id. `--check-ref` passed against the live site (200, no redirect, mark present).
- A deliberately wrong `refMark` was refused with "served 200 but WITHOUT refMark". So the check can say no, and it is not just printing OK.

**The reference, in `matching/spec/`** (2.7 MB, README there):

- **The Blux dashboard export** (the operator downloaded it). `site.json` is **redacted**: this repo is public, and the export carried 6 email addresses plus owner and collaborator records. The original's sha256 is in the README. Re-applying the same redaction to the parsed original gives byte-identical JSON. The 370 KB → 170 KB drop is only the export's pretty-printing.
- **The live-site capture** taken in the planning session. Its manifest still lists the 89 photo originals (242.3 MB); those bytes are not committed and stay on Blux's CDN until the seed.

**`blux convert` on the export: what it does and does not do.**

- Every page came back "FAITHFUL" (3 pages, 17 bands, 5 low-confidence blocks).
- It ignores the `projects` collection (water-wise and the three disabled drafts).
- It resolves only 2 of the 89 used images, even with `--probe`.
- So the seed will be built from the export's text plus the capture's images, not from `blux migrate`. The planning session had already chosen that, because `migrate` writes Blux-track types.

**Verification.**

- `pnpm verify` ran clean through prettier, eslint, svelte-check and the build.
- Its axe step wrote no results. The same step on an untouched checkout of `main` failed identically, so the cause is the cloud container, not this PR; CI's runner is the authority there.
- Unit tests found one real failure, from this PR: the harness adds `src/lib/site-pages.js`, so `docs/COMPONENTS.md` was stale. It was regenerated, and 503/503 now pass.
- The smoke suite was not run here: its script runs `playwright install`, which this container must not. CI runs it.

## 2026-10-01 — The first Netlify build failed on a third party's API key in `matching/spec/` (this PR)

The Netlify site `mantis-landscaping` was created at 18:33Z (`f0ce133b`), linked to this repo's `main`, and its first production build of `69b7975` failed: "Build script returned non-zero exit code: 2". The REST API had no build log for it. The Netlify connector's deploy record named the cause in `deploy_validations_report`: an enhanced secret-scan match for `AIza` at line 41 of `matching/spec/capture/files/mantislandscaping.com/__analytics.js`.

That is Blux's own analytics script. P0 vendored it with the rest of the live capture, and the key in it is Blux's browser key, which the live site serves to every visitor. P0's CI was green because CI does not run Netlify's scan, so nothing before the first production build could have caught it.

The file is removed rather than exempting `matching/spec/` from the scan. The matching gate compares rendering and never needs an analytics script, and an exemption would also hide a real secret committed there later. The manifest keeps the file's sha256. The key remains in P0's commit, because rewriting published history is not done here.

## 2026-10-04 — P2a built, two dirty review rounds, stopped (#3; reddoor-maintenance Operator decisions 64)

#3 adds the native content model:

- a `project` type, with a nested `case_studies.photos` group and an `order` field;
- seven slices: SplitHero, FeatureTrio, ServiceCards, Steps, TextBlock, CaseStudies and ProjectList;
- `/projects/[uid]`;
- 301s from `/ediblegardens` and `/projects/ediblegardens`, served by the hook and forced in `netlify.toml`.

It is not merged. Its second adversarial review round found a real defect: a single-photo case-study strip overflows at 768–1022px with no tab stop. The central repo's two-round rule sends it to the operator rather than into a third round.

**Gold, by job.** White on the Blux gold `#dfb726` measured 1.91:1. White on `gold-deep` `#836a10` measures 5.21:1, and `gold-deep` on `#f5f5f5` measures 4.77:1. The bright gold stays as text on the dark band (7.48:1), and as the ground under dark type on the project "How it Works" band, which already passed (8.33:1).

**Defects round 1 named, worth keeping.**

- `PrismicImage` drops `alt` entirely when the field's alt is blank and no `fallbackAlt` is given.
- SvelteKit throws on `url.search` during prerender. adapter-netlify writes a crawled redirect as a meta-refresh file, not a 301, hence `force = true`.
- The routes-free client makes every Document link `href=""`, hence `SiteLink`.
- Slice `items` is legacy, so the repeatables moved into primary Groups before any content existed.

**An instrument that first failed its own mutation.** The class-pair contrast scan in `theme-contrast.test.ts` let `text-gold` on `bg-light` (the Blux Submit pair, 1.76:1) pass. Its quote regex paired across `class="… {x ? '…' : '…'}"`. Fixed, it reports 1.76:1.

**Types without Slice Machine.** `scripts/generate-prismic-types.mjs` runs `prismic-ts-codegen`. On main's untouched models, `slices/index.js` came out byte-identical, and the types differed only by the `form_replies` type the committed file lacked.

**Waiting:**

- the seed content, all five documents with alt text on 74 photos, on `claude/p2b-seed-draft`;
- the seed script; the Migration API does not dedupe existing assets, so a re-run must look up its own uploads;
- the model push, with `PRISMIC_TOKEN_MANTIS_LANDSCAPING` set explicitly, because a generic token for another repository sits in the cloud environment;
- the placeholder swap, P4 and P5.

## 2026-10-04 — P2a round 3 landed; P2b seeded, repaired, and waiting on the publish (#3 `e9d5f95`, #7 `2470e01`, #8 `95ddb1a`)

**Round 3 of #3.** Operator decision 64 (a) limited this round to round 2's list.

- Fixes:
  - one case-study photo now fills its column instead of scrolling;
  - `SiteLink` renders no anchor for a link that resolves to nothing;
  - empty groups render no band;
  - the ProjectList scrim's weakest point is 0.6 black, so white text on a pure-white photo is 5.74:1;
  - the photo strip's focus ring is two-tone;
  - TextBlock offers no h1.
- Tests were added for the orderings, the meta fallbacks, `SiteLink`'s `target`/`rel`, the `building` guard, and fields inside primary groups.
- The one review of those fixes found a real gap. The two-tone ring is a `box-shadow` on a frame, Windows High Contrast drops box-shadows, and `outline: none` had removed the fallback, so a focused strip showed nothing at all. The strip now keeps a transparent outline that forced colours repaint.

**The seed (#7).** It fetches each original from the Blux CDN and checks its sha256 against the capture manifest. The bytes stay out of this repo.

Round 1 of #7's review found that the manifest lists five photos twice: the original, and a 1000px copy under `/w:1000/` on a second CDN host. The planner kept whichever came last, so three heroes would have shipped as thumbnails, edible gardens' at 220 KB instead of 8.0 MB. The sha check could not catch it, because it compared against the thumbnail's own hash.

`src/lib/site-pages.content.test.ts` holds every value the documents set to its model. The Migration API validates against the models and drops what does not fit, so this is the check that stands between a passing build and a page that publishes wrong.

**What the first live run got wrong (#8).**

- **Photos with no dimensions.** 18 of 74 uploads came back without width or height. Every one carried more than 64 KB of metadata before the image data, almost all of it a Pixel phone's portrait depth map stored as extended XMP. Prismic sized every photo with 57,187 bytes or less and none with 71,782 or more.
  - Stripping XMP losslessly (same pixels; EXIF and ICC kept) leaves at most 58,268 bytes, and the two largest of those were probed and sized.
  - So the seed strips XMP from every JPEG and refuses a header over 58,268 bytes. A file whose segment walk does not reach the image data is refused too.
- **An icon default.** FeatureTrio's icon had a default, so the home pillars' empty icons became "design". The default is gone, and the content test reports any empty Select whose model has one.

`seed.mjs --update <ids.json>` repaired the release in place: 18 stripped uploads, all sized, and five documents PUT by id. The 18 old assets were deleted once a query of every image path showed nothing used them.

**State.**

- Models are in Prismic.
- The five documents are in migration release `asKQBhIAAC0ATypp`.
- The library holds 74 photos, all sized.
- Nothing is published; that is reddoor-maintenance Operator decisions 66.
- The placeholder is still in `slicemachine.config.json`. Swapping it makes the build require a published `home`, so it waits on the publish.

## 2026-10-04 — The content is published, and the site builds from Prismic (#10, `8a005df`)

The operator answered reddoor-maintenance decision 66: publish. `seed.mjs --publish` returned `{"totalItems":5}`, and about 25 seconds later the Content API's master ref (`asKx_xIAACkAT7mT`) listed all five documents. The publish is accepted at once and completes a little later, so the read-back is the proof, not the 202.

#10 replaced `your-prismic-repo-name`, listed the five kept paths in `reddoor.a11yRoutes`, and taught the smoke manifest to expect 200 on each and 404 on an unknown page and an unknown project. The build now prerenders exactly those five paths. axe reports 0 violations on them. Nothing in the output points at Blux.

Two things the review found, filed rather than fixed:

- **#11:** the starter's `/contact` (with a form, linked from nowhere) and the Prismic `/contact-us` (linked everywhere, no form yet) are both indexable. P4 puts the form on `/contact-us`, removes `/contact`, and 301s it. The same overlap is why a smoke mutation using `/contact` passed when it should have failed.
- **#12:** bare `/preview` serves home without `noindex`, because the prefix list says `/preview/`. This is a starter defect.

**Still open:**

- **The Prismic-side publish webhook.** With every page prerendered, a publish reaches production only through the "Prismic publish" Netlify build hook, and the Prismic webhook that calls it is the operator's to add.
- **The model-delivery workflow** (#13) waits on the `PRISMIC_WRITE_TOKEN` secret (reddoor-maintenance Operator decisions 69).

## 2026-10-04 — The contact form moves to /contact-us, and survives a Prismic outage (#15)

> Superseded in part by 2026-10-05 — The newsletter signup goes native, through Resend and the digest (P4b).

P4a, for reddoor-maintenance P1-30. The starter's `/contact` form route and the Prismic `contact-us` page (#11) are now one route. `/contact-us` renders the page's slices and then the form. `/contact` answers 301 there from both the hook and `netlify.toml`, with the query string kept, so form-e2e's `goto('/contact')` still finds the form. The generic `[uid]` route no longer prerenders `contact-us`, because a form action cannot live on a prerendered page.

**A defect the review caught.** The first cut threw on any Prismic error other than a 404, which I chose on purpose so an outage would not hide behind the fallback. That was the wrong trade, for a reason I had not counted: every other page is prerendered, so `/contact-us` became the only page whose render depended on Prismic at request time. With Prismic unreachable, the reviewer saw `/` answer 200 and `/contact-us` answer 500. Worse, a no-JS POST reached ingest and then the post-action reload threw, so a visitor whose message had been received was shown an error page and would resubmit. That also broke a rule this repo already states in `reply-copy.ts`: an outage costs a tailored confirmation, never the submission. The load now serves the form on any error and `console.error`s anything that is not a 404. `/health` already reports Prismic outages, so nothing is hidden.

**Tests that existed but proved nothing.** Three of the reviewer's mutations survived:

- `_reply` taken from the visitor's own form field, which would make the autoresponder a phishing relay. This gap predates the PR.
- `testMode` from `form.has`, so `testMode=false` would count as a test.
- The 404 check loosened.

Each now has a test, and each was mutated back and went red, along with the outage and logging tests and a new smoke check that `/contact` 301s with its query string.

**Filed, not fixed:** #16. A Prismic preview of `contact-us` lands on the generic route and shows no form.

**Next:** P4b, the newsletter signup, waits on the client's Mailchimp API key. The Turso row has neither the key nor the audience ID. When it lands, form-e2e fills the first `[name="email"]` on the page and marks the first `<form>`, so a newsletter form placed above the contact form would take the probe's submission.

## 2026-10-05 — The newsletter signup goes native, through Resend and the digest (P4b)

The Blux `/contact-us` carried Mailchimp's embed: 143 KB of `mc-validate.js`, an unlabelled badge, and a list that posted straight to Mailchimp. The plan said to replace it with a native signup "backed by Mailchimp". The Turso row for this site has no Mailchimp key and no audience ID. The operator says the client does not use Mailchimp, and that signups should go through our own Resend and the digest.

The central code already does exactly that, so no credential was needed. Central ingest saves a `newsletter` submission, sends it through the same Resend notification as a contact message (subject "New newsletter from Mantis Landscaping"), and counts it as a signup in the digest. Mailchimp and a webhook are optional add-ons that run only when the site row names them.

**Two forms on one route.** `/contact-us` now has two named actions, `contact` and `subscribe`. Each result is tagged with the form it came from, so one form's confirmation or error never appears in the other. Without the tags, a successful signup would have unmounted the contact form. The `?/contact` key that a named action adds to the URL is removed from `sourceUrl`.

The signup sits **below** the contact form on purpose. form-e2e fills the first `[name="email"]` on the page and marks the first `<form>`. A test checks that the contact form owns both. The signup has its own honeypot, timing token and Turnstile widget. Without Turnstile, a signup would be bucketed as spam on any site row with `requireTurnstile` set.

Its copy ("Mantis Monthly Newsletter" and the one-line pitch) is the Blux band's, and is written in the route rather than in Prismic, because the seed never carried that band. The home page's "Join Newsletter" button still links to `/contact-us` without the `#newsletter` anchor. Adding the anchor is a content change in Prismic.

**Proof.** The seven mutations named before the code each went red. On a production build pointed at a local fake ingest:

- A no-JS POST to `?/subscribe` delivered `{email, firstName, lastName, sourceUrl, formType: "newsletter"}` and left the contact form on the page.
- A no-JS POST to `?/contact` delivered a contact payload and left the signup on the page.
- A browser signup with JS showed and focused its confirmation, and the text typed into the contact form survived.
- form-e2e, run against that build, still submitted the contact form (`formType: contact`, `testMode: true`).

`pnpm verify` passed: 699 unit and 21 smoke tests, and axe 0 violations on 7 routes.

**Review round 1 found the PR's own evidence was hand-built.** A relative `action="?/contact"` _replaces_ the page's query string. So once the forms had named actions, every POST from `/contact-us?utm_source=x` went to `/contact-us?/contact`, and no lead carried its UTMs. On `main`, the form had no `action`, posted to the page's own URL and kept them. My unit test and PR body "showed" UTMs surviving, from a URL no browser sends (`?/subscribe&utm_source=x`). Each form's action is now built from the live query (`$lib/action-url.ts`, through `$app/state`), and a component test renders the page at `?utm_source=x`.

Two more from the same round:

- **Each form's result was the only record of it.** The confirmations derived from the single `form` prop, so sending the contact form and then signing up brought the contact form back, empty, which invites a duplicate. Each success now latches.
- **A POST to `/contact-us` naming no action 404s** once named actions exist. That is what a tab opened before this deploy sends. The hook answers it with a 307 to `?…&/contact`, and the browser re-sends the same body there.

Also: each form's timing token is fixed when it mounts. `update()` re-runs `load`, which used to re-plant the other form's token and could screen a quick second submit as too fast. The forms got distinct accessible names, and `testMode`, which form-e2e never sends to the signup, was dropped from it.

**Round 2 confirmed every round-1 fix on a production build, and found one defect the fix had introduced.** SvelteKit decodes each query key and takes the first that starts with `/` as the action. My filter matched only the raw prefixes `/` and `%2F`, so a crafted `?%2fsubscribe=` link sent the contact form's fields to the signup action. The name and message were dropped with no error. The filter now decodes each key first, which is the same rule SvelteKit and `pageUrl` apply. Round 2's other finding: the signup latch had no test of its own, because round 1's mutation removed both latches at once. It now has one.

That made two dirty rounds. The operator chose to fix and land on green CI rather than run a third. The reviewer's request for a comment on the hook's 307 went unmet, because the operator wants code without comments. The reason is here instead: a tab opened before this deploy posts to `/contact-us` with no action. A 303 would turn that POST into a GET and lose the body, while a 307 makes the browser re-send it to `?…&/contact`.

One instrument failure is worth remembering. Round 1's reviewer wrote its fake ingest over mine in the shared scratchpad and left it bound to another port. My next browser run then showed a 502 and an error banner on a correct page. A probe confirming the fake ingest answers, run first, would have caught that before the browser run.

## 2026-10-05 — P5: faster than Blux on every measured page, 0 axe violations; the matching gate waits on the laptop (#19, #20, #24, #25)

P5's "done when" had five parts. Four are met and measured here. The fifth, the matching gate, cannot run in a cloud container: `page-diff.mjs` lives in the laptop's `~/.claude/skills/matching-a-page`. No page has a `matching/SPEC.md` section yet either, and the matching rules forbid a geometry round without one.

**Lighthouse.** Lighthouse 12.6.1, mobile, 3 runs per page, medians. Blux was measured the same way on the same day, because single runs swing too far to compare against the plan's one-run baseline from 10-01. Blux's project page ran 92, 74 and 66.

| Page                           | Blux perf | This site's perf, production `f636d3d` |
| ------------------------------ | --------- | -------------------------------------- |
| `/`                            | 97        | **98**                                 |
| `/projects/water-wise-gardens` | 74        | **98**                                 |
| `/contact-us`                  | 92        | **100**                                |

The other categories:

- **Accessibility:** 100 on every page, against Blux's 76–79.
- **SEO** reads 69 on the `netlify.app` mirror, whose only failing audit is `is-crawlable`: the mirror's deliberate `noindex`. A production build served from a non-mirror host scores SEO 100 and Best Practices 100 on all three pages. That build lists five URLs in the sitemap and names the sitemap in `robots.txt`.
- **Best Practices** on `/contact-us` reads 96 because headless Chrome draws Turnstile error 600010. Cloudflare refuses automation, and the operator's live submission in an ordinary browser passed Turnstile.

**What moved the numbers.**

- On `/`, first paint was 2.0–2.9 s behind three render-blocking stylesheets: Google Fonts' CSS at 850 ms, plus a gstatic hop, and two app CSS files, one of them 122 bytes costing 592 ms. Self-hosting Nunito (#20; Google's own two variable woff2 files, sha256-pinned) and inlining the 43 KB of CSS brought first paint to 1.1 s on every page.
- `/contact-us` weighed 1,532 KiB, of which 1,366 KiB was Cloudflare's challenge, about 570 KB per Turnstile widget. The signup's widget now renders on first focus and keeps its reserved box, which brought the page to 288 KiB at load.

**Accessibility, checked by more than one instrument.**

- The CI gate's axe found 0 violations.
- A full axe run (all rules) on the five live pages at 1440 and 390 also found 0. A positive control on the same page proved axe could see faults: an injected unlabelled image and `#ddd` text on white came back `critical: image-alt` and `serious: color-contrast`.
- Text over photos, which axe can only call "incomplete", was measured by pixel sampling with the text hidden. The fifth-percentile contrast ran 5.49–14.67 against the required 3 or 4.5.

**Defects found and fixed.**

- **The logo was squashed** (#19, #24). It rendered at 240×32 (7.5:1) from a 1377×153 (9:1) file. It was invisible until #19 gave the image its intrinsic size and Lighthouse could compare the two. The fix is sized from the Blux capture (`navigation0logobox` 260px, the footer 280px) and shrinks at 320 px instead of pushing the menu button off-screen.
- **A single case-study photo's `sizes` was wrong at both ends** (#25, #6). It undersold the slot by 13% at 1440 and oversold it by 25% at 834.

**A defect in my own test, which the mutation caught.** #25's first smoke test made a one-photo strip by mutating the DOM after `load`. Svelte then hydrated, found DOM it had not rendered, re-mounted, and the test measured the original strip. Restoring the old `sizes` passed at 1440 on one run and failed on another. This is the same pre-hydration trap that made form-e2e report a "wipe" on 10-04 (reddoor-maintenance#1148). The test now measures the strip region, mutates nothing, passes 3 out of 3, and fails 3 out of 3 under the old value. One more mutation (X3, in #24) survived, so the class it tested, `min-w-0`, was removed rather than kept untested.

**One false alarm, avoided.** The live sitemap was empty. That is the mirror rule working (`isNetlifyMirrorHost`), and the non-mirror build lists all five pages.

## 2026-10-05 — Matching Phase 1 for `/`, in the cloud; the gate's first real run is blocked by the nav (#27)

The matching gate was believed to be laptop-only, because `matching/harness.json` points at `~/.claude/skills/matching-a-page`. The skill's source is the private `reddoorla/claude-skills` repo. Once that repo is attached to the session, its `install.sh` and one `npm ci` give a cloud container the same path. `page-diff --version` printed `report-schema 1`, which is what `harness.mjs` reads.

**The first "baseline" measured nothing.** Before Phase 1, I ran the gate with `SPEC_OPTIONAL=1` and read its FAIL ("ref 7 regions, cand 4") as a real comparison. Phase 0's candidate check then showed `/dev/match/home` answering **500**: the match twin passes the seed's photo filenames to `PrismicImage` as URLs (#27). The run had compared Blux against an error page. The skill's first Phase 0 step, curl the candidate and check it is this site, exists for exactly this. `home`'s candidate is now `/`, the published page, and the decision is in the LEDGER.

**Phase 0, measured on both pages:**

- Root font-size is 16px at 1440, 834 and 390, so there is no rem ladder.
- The reference reserves no scrollbar gutter, and the candidate does (1425 against 1440).
- The reference loads Nunito 300 and 700 only, so its computed 600 and 900 render with the 700 face.
- The live page's sha256 equals the 10-01 capture.

**Phase 1** (`matching/SPEC.md`, built from `spec-sections/home.md` and `_chrome.md`):

- a 13-row census;
- nine anchors that resolve once each, in the same order, on both pages at all three widths;
- the container and type ladders, and four button patterns with their hover and active colours, all from the inline CSS;
- a 17-entry interaction inventory and the reveal census, from the inline script.

The script settled things no screenshot could. The pillars become a carousel below 900px. The values become a 2-second autoplaying carousel below 600px, which is why that section is 612px tall at 390 against 1364px at 834. The nav is in flow at load and turns fixed after one pixel of scroll.

**The first real gate run (r0) is TRUNCATED and counts for nothing.** All nine anchors resolve, but the candidate's `top` region is empty: our nav is fixed from load and overlays the hero, which starts at y=0, while the reference's hero starts at y=70 below an in-flow nav. That is the first geometry item, and nothing was changed in this round.

**Three structural differences wait on the operator** (LEDGER, ACK-required):

- the projects carousel against our stacked list;
- the two responsive carousels against our grids;
- whether the 901–1200px band, which has its own CSS rules, joins the matrix.

## 2026-10-05 — Matching round 1 on `/`: the chrome, and the gate now counts

The operator answered the three Phase 1 asks: keep the projects list, match the two responsive carousels, and add 1024 to the matrix. This round was the chrome, because nothing else could be scored until the nav was in flow.

**Each change, with its source in `matching/spec/export/index.html`:**

- The nav is `sticky` and 70px tall: `.navigation0` is static at load, then fixed after `scrollTop > 1` (`checkYoScroll`), plus `padding:5px 4%` and a 60px `:before` strut. It has a 1280px inner container (`.navigation0h`).
- `scroll-padding-top: 70px`, because the script scrolls hash targets to `offsetTop - navH`.
- No scrollbar gutter: the reference's `body.clientWidth` equals the viewport.
- Nav links are 300 16px with `line-height: normal` and 10px padding.
- The footer box is `#ededed`, `40px 4%`, two columns, with 600 `#444d33` links and the Instagram link back. The columns path had never rendered socials.

The anchor-offset and gutter bullets above were wrong as written; the review paragraphs at the end of this entry say what shipped instead.

**Measured.** r1 was the first countable run, and `top` (the nav) passed at all four widths. After the link and footer work it reads 1.3/1.8/2.9/5.8%, and the style census fell from 111 to 105 mismatches. Every other region still fails; those are the next batches.

**Three instruments were wrong before they were right**, each caught by its mutation surviving:

- The anchor-offset test first sampled before the browser had scrolled.
- It then targeted `#newsletter`, which sits so close to the page end that it can never reach the top.
- It now inserts an anchor mid-page on `/`, and goes red (−70px) without `scroll-padding-top`.

**Two side effects caught by the gates, not by me.**

- Removing the gutter widened every slot by 15px, so #25's `sizes` formula (`100vw − 63px`, where the 63 was 48px of padding plus the 15px gutter) went red in two smoke tests. It is now `100vw − 48px`, re-measured.
- Tailwind v4's `leading-normal` is 1.5, not CSS `normal`, which made the nav 78px. `leading-[normal]` is the real value. The same debugging showed that "Contact Us" had always wrapped to two lines, hidden under the old 60px minimum height.

**A composite region got worse, and that is fine.** The flourish+footer region went from 40.3% to 45.8% at 1440 while its height delta improved. The footer is now grey like the reference's, but it sits under a band that is still 448px against 700, so the grey box covers the reference's photo. The skill's composite-region rule applies: verify at the element level (the smoke tests do), and let the number move when the band is matched.

**The adversarial review of #29 found one major defect and two wrong citations, all mine.** I first put the anchor offset on `html` as `scroll-padding-top: 70px`, citing the reference's `offsetTop - navH`. Chrome then treats the stuck nav as hidden under the scroll padding, so every `focus()` inside it scrolls the page: at 390, tapping Close on the mobile menu moved the page from 1500 to 1078, and tabbing through the nav at 1440 went 1500 → 1050 → 600. No test caught it. The citation was also wrong: `scrollPageToTarget` only sets `navH` when the nav's `data-type` contains "sticky", and this nav has no `data-type`, so the reference lands anchors under its nav. The offset is now `main [id] { scroll-margin-top: 70px }`, ledgered as an a11y deviation. The "no gutter" evidence was a headless artifact too, because headless Chromium hides scrollbars. With real 15px scrollbars at 1440 both builds read 1425 on `/`, so the change only matters on short pages, where it brings back a 15px sideways shift; it is ledgered as a trade-off. Four new behaviours had no guard. Removing the nav's `z-50` let slice images paint over the nav at 45–305 scroll positions per page, the footer could lose its one-column stack at 600px, and the Instagram box could shrink, all with every test passing. The old gutter test was also vacuous under headless. Each now has a smoke test, and the seven mutations named for this fix all went red.

**The second review found that the fix moved the problem.** `main [id]` covers targets inside `main`, but the site's only real in-page anchor is the skip link, and its target is `<main id="main-content">` itself. After the round-1 fix, Enter on the skip link left `scrollY=70` with main's top 70px and its focus ring under the nav, which was worse than round 1. The mid-page anchor test never exercised it. The rule is now `main, main [id]`, with a smoke test that follows the skip link. Under the two-dirty-rounds rule, the PR went to Operator decisions instead of a third review. The three bullets above about `scroll-padding-top` and the gutter are left as they were believed when written; this entry's later paragraphs correct them.

The operator then asked for a third review round (OD 80, answer (b)). It came back clean, with two nits: the skip-link test now also asserts that focus lands on `main`, and this entry points from its bullets to the corrections.

## 2026-10-06 — Home carousels and project galleries on the shared Slider (#30 `1150d1a`, #32 `9569aac`)

The operator asked for the home page's two responsive carousels to be matched, and then for the project pages' side-scrolling photo strips to become carousels "using the prebuilt component for logic". Both now run on `$lib/components/Slider`; nothing was hand-rolled.

**The breakpoint was not a viewport width.** SPEC had read the reference's "below 900px / 600px" as viewport widths. Its `sliderAt` compares the grid's own `offsetWidth` with the configured width (`calcWidth<=self.config.width`). Measured on the live reference, the pillars switch at a viewport of ≤978 and the values at ≤652, where the grid is 900 and 600 wide. The first draft used `max-[899px]:hidden` / `min-[900px]:hidden`. That draft switched on the wrong quantity, and it also showed the grid and the carousel together at exactly 899 and 599, because Tailwind v4's `max-[899px]` means `width < 899`. The build now uses `@container` on the content box with `[@container(width<=900px)]`. Our content box is `vw − 63` against the reference's 92% of vw, so today the candidate switches at ≤963/≤663. That gap closes when the section box is matched, and the LEDGER records it.

**Three review rounds on #30, each finding something real.**

- Round 1: Pause did not pause when the press landed on the button's padding. Focus set `userPaused`, and the click then flipped it back; tabbing onto the button flipped its label as well. The fix makes focus on the rotation button itself not count as a focus-pause.
- Round 1 also found that both carousels were named "Highlights" (axe `landmark-unique`), and that inactive dots on gold-deep were 2.53:1.
- Round 2: the colour fix had painted nothing. `bg-footer` is a token that #29 adds, and this branch was based on `main`, which did not have it yet, so Tailwind generated no class and the inactive dots were `rgba(0,0,0,0)`. The unit test only checked the class string, so it passed. The class is now `bg-[#ededed]`, confirmed in the built CSS and as a computed colour.
- Round 3 (the operator chose a third round over landing) was clean.

The home release (`asQ6NhIAAIoP2_HX`: pillars 900, values 600 with autoplay 2000) is staged and was presented for the operator to publish.

**Project galleries.** The reference gives each case study a slideshow (`columns 1, Fade, speed 500, autoplay 0`). We take its fade and timing, keep our 4:3 photos and put the controls in a row under the photo; we do not copy its square ratio or its overlay controls. On a production build with live content, every study on both project pages is a carousel (13 studies, 2–9 photos each), with CLS 0 and no blank flash. Lazy images in opacity-0 slides load early, which costs data: 5.6 MB against 3.1 MB after a full scroll at 1440. That was accepted.

The review's useful find was keyboard cost. Every dot was a tab stop, so edible-gardens went from 17 tab stops to 63. `Slider` dots now use a roving tabindex, and the arrow keys move focus along the dots. Measured at 1440: 63 → 33 on edible-gardens and 47 → 24 on water-wise-gardens. The home carousels get the same improvement. The `.scroll-strip` focus-ring CSS from #3 is gone along with the strip.

**Instruments that lied.**

- A mutation run whose baseline was already red (the dot test read the button's class, not the inner span's) counted D6 as red for the wrong reason.
- Twice a mutation silently failed to apply, because prettier had reflowed the text it searched for.

Both were caught by checking `git diff --shortstat` and the baseline before trusting a result.

Still open: the type scale on `/` (style census 105 rows), `/dev/match/home` returning 500 (#27), and a hidden autoplaying `Slider` that keeps rotating (#31).

## 2026-10-06 — Slideshow arrows float over the photo (#34, `f2cb9d3`)

The operator asked for the project slideshows' arrows to float over the images. `Slider` gained an `arrowPlacement` prop: `"row"`, the default, which the home carousels keep, or `"overlay"`. The two arrow buttons became snippets that both placements share, so each button is still written once.

Overlay arrows are 40px white chevrons on a `black/50` disc, vertically centred and 12px in from each edge. The disc is there because a bare white chevron disappears on a bright sky. The review sampled 132 real arrow positions; the lightest pixel under a disc was (255,255,253), which gives 3.95:1. That is the floor, and it passes the 3:1 non-text rule.

The review found what the chevron numbers hid: the focus ring. The site's white outline sits 2px _outside_ the button, directly on the photo, and fell below 3:1 against it at 112 of the 132 positions. Overlay arrows now add a 6px `rgb(0 0 0/0.6)` halo on `:focus-visible`, so the ring always sits on dark, at about 5.7:1 even over white. That was read back as the computed `box-shadow` in Chromium.

A mutation that removed the disc survived the first test. The assertion was a substring check, and `aria-disabled:hover:bg-black/50` satisfied it on its own; it now checks the class token. Another survivor showed that `arrowClass` had lost its only caller and its only test, so a test now covers both placements.

## 2026-10-06 — Slideshow dots over the photo, and photos run the card's full height (#38, `49355bc`)

The operator asked for the dots to float over the photo like the arrows, and for the image to be full bleed vertically. `Slider` gained `dotPlacement` (`"row"` default, or `"overlay"`: the dots on a dark pill 12px above the bottom of the slides) and `fill` (in fade mode the slides stretch to the parent). With nothing left in the controls row, the row no longer renders. The home carousels keep the defaults.

**Two layout defects, both found by measuring, not by looking.**

- **Grid row:** the fade grid's implicit row sized itself to the image's natural height, so a 497px card held an 883px photo; overflow hid the excess. The row is now `minmax(0,1fr)`.
- **Aspect ratio:** the photo column is `aspect-[4/3] self-stretch`, which gives 4:3 on phones and, from md up, the card's height. On a card whose text was taller than 4:3, the aspect ratio turned the stretched height back into width: at 834 one photo grew to 522px and ran under the text. `w-full` pins the width.

A production-build probe then checked every card on both project pages at five widths from 390 to 1440: flush top and bottom, column width, no overlap.

**What the review found.** At 320 the 9-dot pill (304px) was wider than the 272px photo and clipped its own ends; the overlay dots dropped their gap and the pill is capped at the photo width, giving 240px. The dots' focus ring fell off the 24px pill onto the photo, so the dots got the arrows' dark halo. The pill went to `black/70`: inactive dots are 4.28:1 and active ones 8.52:1 over a pure-white pixel.

**The smoke test lied twice before it was right.**

- It compared the photo with the card only from md up, so the grid-row bug was invisible at 390. It now compares the photo with its own column at every width.
- It loaded only edible-gardens, whose studies have at most 7 photos, so the 9-dot overflow could not appear. It now covers both pages and adds 320.

With the pill's width cap removed, water-wise at 320 goes red and the other seven cases stay green.

I pushed one commit before reading its `pnpm verify` result. It had failed on a svelte-check ordering error, and the next commit fixed it. Chaining commit after verify with `;` instead of `&&` is how that happened.

## 2026-10-12 — SvelteKit 3 and adapter-netlify 7 on `staging`, and the staging flow (#42, #43; promotion #44)

The second repo of the fleet's kit 3 migration and the feature → staging → main flow (reddoor-maintenance Operator decisions 113 and 116, #545), done after vida-legacy-foundation by the same runbook. `staging` was cut from `main` at `6e87f02`, Netlify builds branch deploys for `main` and `staging` (`staging--mantis-landscaping.netlify.app`), and `main-gate` (#42, byte-identical to vida's) and the migration (#43) landed on `staging`. Only the operator merges the promotion, #44.

**`main` here has no protection at all.** There is no ruleset, and `branches/main` reads `protected: false`; vida's reads `true` as the control. The fleet Renovate preset assumes a required check on every default branch, and its own description says Renovate attempts a merge before CI has started. So a routine group with no held package could reach production unbuilt. The fix is a ruleset, which is the operator's; #44 carries the command.

**The port was nearly the starter's.** `sveltekit.config.js` was generated from this repo's own `svelte.config.js` by the starter's transform. It differs from reddoor-starter#187's only where mantis already did: `slicemachine.config.json` and `inlineStyleThreshold`. robots and sitemap are per request here, so `Seo`'s `siteOrigin` is the only prerendered origin. What the starter's patch could not reach:

- the `contact-us/` action's `$env/dynamic/private` read, and four tests mocking `$env/dynamic/*`;
- `$app/environment` in three files;
- the `preview` matcher, which had no test. Under kit 3 a `false` return is a match, so `src/params.test.ts` now runs it through kit's validate path, and the boolean form goes red.

**Review round 1 was clean.** Its two nits, folded in: the remaining `error(404, { message })` calls, and `docs/security.md` and `docs/NEW-SITE.md` pointing CSP edits at a file that no longer exists.

**Smoke on staging matched production.** Run against `staging--…` and, as the control, `mantis-landscaping.netlify.app` (kit 2): 53 passed on each, and the same 2 failed on each. Those 2 load `/dev/a11y-fixtures`, which is never deployed.

**Left behind.** The head branches `claude/staging-flow` and `claude/kit-3` are still on GitHub. This repo does not auto-delete head branches, and the cloud proxy refuses the delete with a 403.

## 2026-10-27 — The fleet test audit's rewrite: design pins out, every real catch kept and proved (#62)

Why: the fleet test audit (reddoorla/reddoor-workspace `audits/2026-10-26-fleet-test-audit/report.md`, batch B, picked by the operator on 2026-10-27) found unit tests here that pin class names, pixel sizes and durations, so a designer's one-line change turns them red without a bug. This PR applies the audit's rewrite of 20 unit test files and 4 Playwright specs, minus every place where the rewrite would have let a real bug through.

The audit sorted the 40 removed or weakened assertions. 9 were design values (the slider's fade grid rows, the dot pill's gap, the inverse button's border, the display title's size, the footer's column split, the wait cursor, and three more). 13 guarded code no visitor reaches: Modal and ScreenWidthMedia mount only on `/dev` routes here, and the rest were restatements of the source. Those 22 went. The other 18 were real catches, and each is back as an assertion that measures a relation instead of naming a class. Each was then proved by the audit reviewer's own mutant, which re-creates the bug in the component: 18 of 18 went red (`mutate.mjs --in-place`).

The keeps, briefly:

- **Contrast is computed from the compiled stylesheet** (`src/test-utils/theme-colors.ts`, which runs Tailwind's real build and cascade over the rendered DOM, after vida-legacy-foundation's helper): the headline and the CTA's label (>= 4.5) and outline (>= 3) on every CtaBanner ground, at rest, hovered, keyboard-focused and visited; SplitHero's heading at every width the sheet's media queries distinguish; the overlay and CaseStudies dots on their pill over both a white and a black photo (>= 3). Every border colour a Field can take, in any state or at any width, is checked against the page at 3:1, and its forced-colors focus outline is read through the cascade. The sending Send button's label is measured in the DOM's own disabled and aria-busy state, with any opacity composited onto the page. Review round 1 found the first version of the helper read class names against `@theme` and silently skipped Tailwind's palette, alpha, arbitrary values and every variant. Review round 2 found the second version still dropped container queries (`@md:`), `dark:` and background images without an error, so a SplitHero `@md:text-gold` at about 2.7:1 passed; it now throws unless the caller passes the container size or the colour scheme, and `groundOf` throws on a gradient or image ground. Review round 3 found the same shape again, one level down: the sheet parser lost step on any quoted arbitrary class (`font-['Nunito']` anywhere in the document turned stone-300 on white, 1.49:1, into black at 21:1), pointer, hover-capability and reduced-motion queries were decided without being asked, `@supports not` was taken as supported, and `:visited` and `:target` never matched. So the helper became an allowlist: it models exactly the forms the site's own classes compile to, which a test checks against every class in `src/`, and throws, naming the rule, on everything else. Round 3 also found that `vite build` failed, because Tailwind scans test files and one probe class emitted a media query lightningcss rejects; `app.css` now has `@source not` entries for test files, `src/test-utils` and `docs`, so no probe class ships. Review round 4 found two more classes the allowlist let through, and the CTA passed 9 of 9 with its label dark on the dark band at about 1:1. A state on another element (`peer-hover:`, `group-focus-visible:`) was "modelled" because the selector parsed, but no state a caller could pass ever put a marker on a sibling, or focus on an ancestor, so the rule never applied. And `::first-line`, `brightness-0`, `invert`, `mix-blend-*` and `-webkit-text-fill-color` repaint the text with no colour class, which the helper never read. The fix is at the selector, not per variant: a state pseudo-class before a combinator is now another element's (`group` for an ancestor, `peer` for a sibling, which covers `in-*:` and arbitrary `[.card:focus_&]:` too), and it throws unless the caller passes that element's state. The element's own hover, active and focus imply its ancestors' hover, active and focus-within, so `{ hover: true }` still reads `group-hover:`. Every filter, backdrop filter, blend mode, text fill or stroke, `background-clip: text`, mask, and every animation whose keyframes set a colour now throws on the element or any ancestor. The pseudo-elements that restyle the element's own text throw too. The `unmodelled()` audit had a vacuity guard of more than 500 tokens, which junk satisfies. It now proves it read every slice the file glob finds, and that each slice writing a class attribute compiles to real rules. The Steps gold band now measures every element with text, step bodies included, not just the headings. Review round 5 found the same shape for fills: an `inset` box-shadow, or a `::before`/`::after` that sets a background or a box-shadow, paints the ground with no colour class, so the CTA's sliding hover fill (white label on a white fill) passed 9 of 9. `groundOf` now reads the resolved box-shadow, Tailwind's `--tw-*` chain included, and throws, naming the class, on an inset layer that paints (a colour with alpha, unless its spread, blur and offsets are all zero) on the element or an ancestor up to its ground; outer shadows stay unread. Review round 6 found that sentence claimed more than the check covered: a gradient, an image, a border or an outline on a `::before` or `::after` painted a white fill with no colour class and passed (the CTA's label was invisible in Chromium), an inward `outline` was never read, and Tailwind's `--tw-*` variables inherited from the parent refused a focus-ringed link inside `shadow-inner`; the check now refuses any pseudo-element that paints a box, reads the outline offset, resolves `--tw-*` from each element's own rules, and reads zero-alpha and zero-width forms as no fill.
- **Prismic options are checked for distinctness**: SplitHero's gold-deep tone, every Steps background, and TextBlock's gold-deep must paint a ground different from the default's. TextBlock's `image` option shares dark's ground under its photo on purpose, so only gold-deep is compared.
- **Relations stand in for values.** The overlay arrows float over the slides, Previous on the left edge and Next on the right. FeatureTrio's grid and carousel queries use complementary comparators and sit inside a `@container`. MediaText's imageLeft media sorts before the copy. A photo-less case study's text spans the card's whole column count. An overlay arrow's focus indicator, composited on white, clears 3:1.

**Belief corrected:** the audit's losses file proposed Playwright for seven of the keeps (trial clicks, forced colours). The reviewer's mutants run only under vitest, so a Playwright keep could not be proved red here. Every keep is a unit assertion instead, and "positioned out of flow" is read as `absolute` or `fixed` on the element, the closest jsdom gets to a layout fact.

Two of the Playwright reviewer's notes were cheap enough to fold in. The nav sticking after scroll is back, as a poll on `top == 0` with no height pin. The logo spec again requires a logo in both the nav and the footer, not just "more than zero". `src/lib/actions/animateIn.test.ts` is untouched, because it is an inherited starter copy handled separately (batch C). `docs/COMPONENTS.md` is regenerated, since its test counts moved.

**Checks.** At round 6's head: `vite build` exits 0, and the shipped CSS holds none of the round-4 probe classes. The full vitest suite passes, 810 of 810 in 94 files (round 4 gave 808; round 5 added the known-bad fills, and round 6 adds the known-bad and known-good pseudo-element, outline and transparent cases). prettier and eslint are clean. svelte-check reports 28 errors, all `./$types` or implicit-any, the same 28 a clean worktree of `main` gives with the same linked `node_modules`, so they come from the worktree setup, not this change. Playwright was last run in round 1, against a production build (`REDDOOR_GATE_SERVER=preview`): case-study-slideshow, chrome-geometry and logo, 43 passed, and `modal-centring` on the dev server, 3 passed. It was not re-run after `app.css` gained its `@source not` lines in round 3; the shipped-CSS comparison in round 4's review found no class a page uses was dropped.
