# Permanent Design Reference Library — KING 253

This is the project's **permanent** design reference library (set by the owner, 2026-10-08).
It is not a one-task prompt. Use it automatically whenever you design, redesign, improve,
review or polish any frontend interface in this project. Never ask "should I use the design
references?" — the answer is always yes unless the owner explicitly says otherwise.

New references the owner sends (websites, screenshots, prompts, UI examples, design systems,
animation or typography references) are **added** to this library — never delete or replace it.
Analyze them and integrate only the useful ideas.

## 0. Global library (machine-wide)
The same nine resources are also kept in the owner's **global** design library at
`~/.claude/docs/design-reference-library.md`, loaded for every project via `~/.claude/CLAUDE.md`.
It holds the verified access status, installed tools and exact commands (last verified 2026-10-09).
Read it for *how* to reach each resource. This file stays authoritative for *KING 253*:
the brand context (§7), priority order (§3), anti-generic rule (§4) and quality loop (§5)
override the global library wherever they differ.

Installed globally and available here: Taste Skill skills (`design-taste-frontend`,
`redesign-existing-projects`, …), Impeccable (`/impeccable critique|audit|polish`, plus design
hooks), Playwright (`playwright-cli` + Playwright MCP, always with `--browser=chromium`) and
img2threejs. getdesign.md runs on demand via `npx getdesign`.

## 1. Resources

### Design thinking & quality
- **Taste Skill** — https://tasteskill.dev/
  Design direction, visual hierarchy, typography, layout, spacing, color, motion, design
  principles, avoiding generic AI-generated interfaces, deliberate visual decisions.
- **Impeccable** — https://impeccable.style/
  UI critique; typography, layout, color and animation refinement; accessibility; interaction
  design; visual polish; removing AI-slop and generic patterns.

### Visual inspiration
- **Awwwards** — https://www.awwwards.com/
  Premium websites, creative layouts, high-end visual direction, advanced interactions,
  typography, art direction, creative navigation, premium landing pages.
- **Godly** — https://godly.website/
  Modern web design, contemporary layouts, creative interfaces, modern interactions.
  *Access (2026-10-09):* godly.website now 301-redirects to https://recent.design/ ("Recent —
  Design Inspiration"); browse that. Gallery tiles have no text titles; inspect visually.
- **Mobbin** — https://mobbin.com/
  Real-world UI/UX patterns: navigation, mobile UX, e-commerce UX, product pages, forms,
  user flows, interaction patterns, interface conventions.
  *Access (2026-10-09):* restricted. Logged out, only the homepage is readable; library pages
  return 403. Mobbin MCP needs a Pro/Team plan (not connected). Until the owner signs in, use the
  owner's Mobbin screenshots and the Mobbin DESIGN.md on getdesign.md.
- **Land-book** — https://land-book.com/
  Landing pages, hero sections, marketing layouts, product presentation, section composition,
  conversion-oriented layouts.
  *Access (2026-10-09):* built-in browser only. WebFetch and Playwright get a Cloudflare 403.

### Design system
- **getdesign.md** — https://getdesign.md/
  DESIGN.md methodology, design systems, design tokens, typography/color/spacing systems,
  component rules, consistency, AI-agent-readable design instructions.

### Browser validation
- **Playwright** — https://playwright.dev/
  Browser, visual, responsive, interaction, navigation, form, mobile and desktop testing;
  screenshot verification. **The browser-rendered result is the source of truth** — never
  assume the UI is correct because the code compiles.
  Playwright is installed globally (2026-10-09), not as a project dependency. Start the dev
  server (`.claude/launch.json` → `king253-dev`), then screenshot with
  `playwright-cli open --browser=chromium http://localhost:3000` → `resize 375 812` /
  `768 1024` / `1440 900` → `screenshot`. Or use the `mcp__playwright__*` tools. Google
  Chrome is not installed, so `--browser=chromium` is required. The Claude in-app browser
  (preview of `king253-dev`) is still fine for live viewing.
  Viewports: phone 375px / tablet 768px / desktop.

### Optional 3D
- **img2threejs** — https://img2threejs.io/
  Three.js, 3D product visualization, image-to-3D, interactive or procedural 3D.
  Only when 3D genuinely improves the product or experience — never just because it exists.

## 2. How to use the references

Do not blindly copy a website:
1. Explore the relevant resources when access is available.
2. Analyze the design patterns.
3. Identify useful ideas.
4. Compare multiple references.
5. Extract the underlying principles.
6. Adapt them to this project's brand and requirements.
7. Combine ideas into ONE coherent original design.
8. Implement.
9. Inspect the rendered result in a real browser.
10. Critique it.
11. Improve it.
12. Test again.

**REFERENCE → ANALYZE → MIX → ADAPT → BUILD → TEST → POLISH**

### Mixing rule
Awwwards → creative visual direction · Godly → modern composition · Mobbin → proven UX
patterns · Land-book → landing-page structure · Taste Skill → design principles ·
Impeccable → critique and refinement · getdesign.md → design system · Playwright → browser
verification · img2threejs → 3D when useful.
The result must feel like ONE coherent brand, never several websites stitched together.

### Do not copy
Never copy logos, brand identity, exact layouts, exact text, exact images, exact animations,
exact component implementations or proprietary assets. References are for inspiration and
reasoning; the implementation is original.

## 3. Priority system
1. The owner's explicit project requirements
2. The owner's images / screenshots / references
3. The existing project design system
4. Taste Skill
5. Impeccable
6. Awwwards
7. Godly
8. Mobbin
9. Land-book
10. getdesign.md
11. Playwright (verification)
12. img2threejs (when 3D is appropriate)

Project requirements always override inspiration.

## 4. Anti-generic-design rule
Do not automatically produce: generic SaaS layouts, generic AI dashboards, excessive rounded
cards, excessive glassmorphism, random gradients, purple/blue AI gradients, excessive pills,
excessive shadows, giant centered headings everywhere, repetitive three-card sections,
unnecessary badges, random decorative blobs, excessive animations, purposeless components.
Every design decision must have a reason.

## 5. Design quality loop (important UI work)
1. Understand the brand, audience, product and conversion goal.
2. Consult the relevant resources above.
3. Create or update the design system.
4. Implement.
5. Run the website.
6. Inspect the actual rendered interface in a browser.
7. Check desktop, tablet and mobile.
8. Critique it, Impeccable-style.
9. Fix the visual problems.
10. Render and test again.

The design is not finished just because the code works.

## 6. Objective
Consistently produce beautiful, premium, original, non-generic interfaces with strong UX,
professional typography, a consistent design system, excellent responsive behaviour,
purposeful animation and strong product presentation — tailored to KING 253.

## 7. KING 253 context (existing design system — priority 3)
- Algerian men's streetwear brand; prices in DA; cash on delivery; mostly mobile visitors.
- Dark studio look: near-black backgrounds, red studio light (`king-red`, `king-bright-red`),
  brick/fence textures, grain, chamfered card corners (`king-chamfer`).
- Type: `king-display` (heavy condensed uppercase headlines), `king-label` (small tracked
  uppercase labels). Tokens live in `src/app/globals.css`.
- Admin uses a calmer, separate style (rounded panels, pills) — keep it functional.
