---
name: "@sculli/qr-utils website"
description: Docs and live playground for the @sculli/qr-utils package.
colors:
  paper-white: "oklch(100% 0 0)"
  sidebar-wash: "oklch(98.5% 0 0)"
  hairline: "oklch(92.2% 0 0)"
  rule: "oklch(87% 0 0)"
  rule-hover: "oklch(70.8% 0 0)"
  muted-ink: "oklch(55.6% 0 0)"
  secondary-ink: "oklch(43.9% 0 0)"
  ink: "oklch(20.5% 0 0)"
  trace-amber: "oklch(82.8% 0.189 84.429)"
  trace-amber-edge: "oklch(66.6% 0.179 58.318)"
  amber-readout: "oklch(55.5% 0.163 48.998)"
  amber-halo: "oklch(92.4% 0.12 95.746)"
  error-red: "oklch(57.7% 0.245 27.325)"
  error-red-text: "oklch(50.5% 0.213 27.518)"
  error-halo: "oklch(93.6% 0.032 17.717)"
typography:
  banner:
    fontFamily: "Fira Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "clamp(4px, 2cqi, 15px)"
    fontWeight: 400
    lineHeight: 1.25
    letterSpacing: "-0.0667em"
  headline:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: 1.2
  title:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.556
  body:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.429
  command:
    fontFamily: "Fira Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "1.375rem"
    fontWeight: 400
    lineHeight: 1.455
  data:
    fontFamily: "Fira Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.667
    fontFeature: "\"tnum\""
rounded:
  sm: "0.25rem"
  md: "0.375rem"
spacing:
  hairline-gap: "4px"
  control-x: "12px"
  sidebar: "16px"
  stack: "20px"
  page: "24px"
  page-md: "40px"
components:
  nav-item:
    textColor: "{colors.secondary-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  nav-item-current:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper-white}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  input-data:
    backgroundColor: "{colors.paper-white}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "10px 12px"
  button-icon:
    textColor: "{colors.secondary-ink}"
    rounded: "{rounded.md}"
    size: "32px"
  button-icon-hover:
    textColor: "{colors.ink}"
  readout:
    textColor: "{colors.ink}"
    typography: "{typography.data}"
  install-slab:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper-white}"
    typography: "{typography.command}"
    rounded: "{rounded.md}"
    height: "4.5rem"
  install-copy:
    textColor: "{colors.rule-hover}"
    width: "4.5rem"
  install-copy-hover:
    textColor: "{colors.paper-white}"
  install-manager:
    textColor: "{colors.muted-ink}"
    typography: "{typography.data}"
    rounded: "{rounded.sm}"
    padding: "6px 10px 8px"
  install-manager-pressed:
    textColor: "{colors.ink}"
---

# Design System: @sculli/qr-utils website

## Overview

**Creative North Star: "The Bench Instrument"**

The site is a quiet white bench with one live instrument on it. Everything structural is neutral: white ground, near-black ink, hairline grey rules, a faintly washed sidebar. Against that restraint, the few moving parts carry the character: the sidebar's highlight that glides between links, the layered ASCII banner, the homepage install command whose changed characters re-set in an amber wave, and the playground's changed-module trace. The user's brief is "minimal in design, with flourishes where possible"; the flourishes are motion and craft details, never extra colour or ornament.

Density is low and the layout is plain: a sidebar and one content column. Type is the platform sans; the only loaded face is Fira Mono, and it appears where something is measured, quoted or drawn in characters. Warm amber is the single accent, and it means "this just changed" or "this has your attention".

**Key Characteristics:**
- White ground, neutral-900 ink, neutral-200/300 hairlines; no gradients, no shadows for depth.
- One accent (warm amber) reserved for change and focus.
- Fira Mono for data, code and the ASCII banner; platform sans for everything else.
- Flourishes are motion: gliding highlights and underlines, module trace, character wave, readout flash, stage settle, all removed or stilled under reduced motion.
- Gently rounded controls (6px), flat surfaces.

## Colors

A neutral greyscale with a single warm amber accent and a functional red for errors.

### Primary
- **Trace Amber** (trace-amber): the fill of modules that just turned dark in the playground trace. The loudest amber. It may be text or an icon stroke only on the ink slab (the install command's changed-character wave and its copied check); it never appears as text on white.
- **Trace Amber Edge** (trace-amber-edge): the inset outline of modules that just turned light, and the textarea caret.
- **Readout Amber** (amber-readout): the starting colour of a readout value that just changed, fading to ink over 900ms. The darker step exists for contrast: small text must stay above 4.5:1 while it flashes.
- **Amber Halo** (amber-halo): the 3px focus ring around the data input, and the text selection colour (on white and on the ink slab, where selected text turns ink).

### Neutral
- **Paper White** (paper-white): the page ground and the input background.
- **Sidebar Wash** (sidebar-wash): the sidebar layer, the only tonal surface change on the site.
- **Hairline** (hairline): the sidebar's dividing rule; the empty-state QR skeleton (landmark modules only).
- **Rule** (rule): input borders and the stage's corner ticks at rest; disabled icon buttons; link underlines at rest; the run verb on the ink slab.
- **Rule Hover** (rule-hover): input border on hover; the shaded under-layer of the ASCII banner; the resting copy icon on the ink slab.
- **Muted Ink** (muted-ink): readout labels, byte count, placeholder, empty-state copy, unpressed package-manager labels, the `$` prompt and a failed-copy cell on the ink slab.
- **Secondary Ink** (secondary-ink): body paragraphs, inactive nav links, resting icon buttons.
- **Ink** (ink): headings, values, the current nav item's fill, the install slab, focused input border, focused corner ticks. Hover washes are ink mixed at 10% (and 15% when pressed) rather than a separate grey.

### Error
- **Error Red** (error-red): invalid input border and the corner ticks while the input is invalid.
- **Error Red Text** (error-red-text): the error line and the byte count while invalid.
- **Error Halo** (error-halo): the focus ring of an invalid input.

### Named Rules
**The One Accent Rule.** Amber means change or attention: the trace, the readout flash, the caret, the selection and the focus ring. It does not decorate resting chrome, and a failure is never amber: a failed copy stays neutral.

**The Ink Wash Rule.** Hover and pressed states are ink at low opacity (10%, 15%) over whatever is beneath, so they read the same on white and on the sidebar wash. On an ink surface the wash inverts: white at 8% for hover and 14% for pressed, with white at 12% for hairlines.

## Typography

**Body Font:** platform sans stack (ui-sans-serif, system-ui, sans-serif); no sans webfont is loaded.
**Label/Mono Font:** Fira Mono 400 (with ui-monospace, SFMono-Regular, Menlo), the only loaded webfont, exposed as the `--font-mono` theme token.

**Character:** a neutral platform sans that stays out of the way, with Fira Mono as the voice of the machine: measured values, install commands and the character-drawn banner.

### Hierarchy
- **Banner** (Fira Mono 400, clamp(4px, 2cqi, 15px), line-height 1.25, tracking -0.0667em): the layered dos-rebel "QR-UTILS" ASCII art. It sizes to its container so 93 columns always fill the width.
- **Headline** (700, 1.875rem): one page title per page.
- **Title** (600, 1.125rem): the "@sculli/qr-utils" wordmark at the top of the sidebar.
- **Body** (400, 1rem, line-height 1.5): paragraphs and the data textarea.
- **Label** (500 for field labels, 400 for nav links; 0.875rem): form labels and navigation.
- **Command** (Fira Mono 400, 1.375rem, line-height 2rem; 1rem / 1.5rem under 40rem): the one-line install command on the ink slab.
- **Data** (Fira Mono 400, 0.75rem, line-height 1.25rem, tabular figures): the playground readout and byte count, and the package-manager labels.

### Named Rules
**The Measured Mono Rule.** Fira Mono is for things a machine produced or measured: readout values, byte counts, code and the ASCII banner. Prose, labels and headings stay in sans. Package-manager labels are the exception among labels: they are code identifiers, so they are mono.

**The Tabular Rule.** Any number that updates live uses tabular figures so it never shifts its neighbours.

## Layout

A two-part frame: a 224px sidebar (16px padding) on the left from the md breakpoint (768px) up, stacking above the content as a horizontal tab row on small screens, with the dividing hairline switching from bottom to right. The main column takes the rest with 24px padding, 40px from md up. Page titles sit 16px above their content (40px on the playground, where the stage needs air).

On the homepage the banner and install command share a 46.5rem wrapper (the banner's maximum width); the install block (max 36rem, 12px internal gap) is centred on the banner's centre line, 40px below it, with 64px before the page heading. The manager labels are inset so their text starts level with the command's `$`. The 40rem breakpoint steps the install command down for phones.

The playground is a centred column capped at 24rem with a 20px vertical rhythm: a square stage, a status row reserved at two lines tall (so a wrapped readout or an error never moves the input), then the labelled textarea. Nav items sit 4px apart. Reserving space for changing content is a standing rule: live states swap in place, they do not reflow the page.

## Elevation & Depth

The system is flat. No surface casts a shadow. Depth comes from one tonal step (the sidebar wash against white) and hairline rules. The only box-shadow in the build is the 3px focus halo on the data input, which is a state, not elevation.

### Named Rules
**The Flat Bench Rule.** Surfaces never lift. Emphasis comes from ink, a rule or the amber halo, not a shadow.

## Shapes

Gently rounded corners (6px, rounded.md) on every interactive control and on the install slab: nav items, the moving highlight, the textarea, icon buttons. Small text controls (package-manager labels, inline links) use a tighter 4px (rounded.sm) for their focus box. The QR itself is square-edged and rendered with crisp edges; it is framed not by a box but by four open corner ticks (14px, 1px rules) that darken to ink on focus and turn red on error. Borders are 1px hairlines throughout.

## Components

### Navigation (sidebar)
Quiet links with one gliding flourish.
- **Style:** label-size sans in secondary ink, 8px by 12px padding, 6px radius.
- **Current:** solid ink fill with white text.
- **Hover / Focus:** a single shared highlight (ink at 10%) uses CSS anchor positioning to glide to the hovered or focused link over 250ms; while the pointer is over the nav, the current item softens to ink at 80%. Reduced motion makes the highlight jump instead of glide. The sidebar persists across view transitions so the highlight is never re-mounted. (The user plans to refine this component.)
- **Mobile:** the same items in a horizontal row above the content.

### Inputs / Fields (data textarea)
- **Style:** white field, 1px rule border, 6px radius, 10px by 12px padding, body type, auto-growing between 5.5rem and 16rem, no resize handle, amber caret, amber selection.
- **Hover:** border steps to rule-hover.
- **Focus:** border goes to ink and a 3px amber halo appears; no outline. Transitions run 150ms.
- **Error:** border goes to error red, the halo to error halo, the byte count and status line to error red text, and the stage dims to 25% opacity while keeping the last valid code visible.

### Buttons (icon buttons)
- **Shape:** 32px square, 6px radius, 16px stroke icon (inline SVG, 2px stroke, round caps).
- **Rest:** secondary ink, no fill.
- **Hover / Active:** ink text over an ink wash at 10%, 15% when pressed; 150ms colour transition.
- **Focus:** 2px ink outline, 2px offset.
- **Disabled:** rule-coloured icon, no pointer events.
- Every icon button carries an aria-label and a matching title.

### Readout
A single mono line under the stage: label/value pairs (version, ecc, mask, size, fill) with labels in muted ink and values in ink, tabular figures. Pairs wrap only between two groups. A value that changes starts in readout amber and fades to ink over 900ms.

### QR Stage and Module Trace (signature)
The playground's defining component. A square stage with four corner ticks shows the live symbol. Empty input shows only the landmark skeleton (finder, timing, alignment) in hairline grey. On each edit, modules that flipped are overlaid for 900ms: filled trace amber where a module turned dark, an inset trace-amber-edge outline (20% of a module) where it turned light; the overlay holds near full strength for the first third and then fades to reveal the real code. A change of symbol size skips the trace and settles the new code in over 220ms (from 35% opacity with a 2px blur). Very large diffs (over 4000 modules) skip the trace. Reduced motion removes the trace, the settle and the readout flash.

### Install Command (homepage hero)
One command, set like an instrument readout, on the site's ink fill.
- **Slab:** ink, 6px radius, 4.5rem tall (4rem under 40rem), flat. The command is one line of real text with real spaces in command type: the `$` in muted ink (not selectable), the run verb in rule grey, the package name in white. It scrolls sideways rather than wrapping. Selection is amber halo with ink text.
- **Copy cell:** 4.5rem wide (4rem under 40rem) behind a white 12% hairline. The 18px icon is rule-hover grey at rest and white on hover, over a white wash at 8% (14% pressed). Focus is a 2px white outline inset 6px.
- **Copied:** the clipboard icon scales out and an amber trace check scales in for 1.6s, and the whole command plays the character wave once.
- **Failed copy:** stays neutral. For 4s the copy icon gives way to the shortcut ("⌘C" on Apple devices, "Ctrl C" elsewhere) in 0.75rem Fira Mono in neutral-300, the command text (without the prompt) is left selected, and the title and a live region explain it.
- **Manager row:** npm, pnpm, yarn, bun as 12px Fira Mono labels in muted ink, ink when pressed or hovered (150ms). A 2px ink underline glides between them via anchor positioning (`--install-manager`, 250ms); it only glides after the first pointer or focus interaction, so it sits still on load. Without anchor support, the pressed label carries its own 2px text underline. Focus is a 2px ink outline.
- **Memory:** the chosen manager is stored under `qr-util:package-manager` and applied by an inline script before first paint, so a returning visitor's command never jumps.
- **Character wave:** switching manager re-sets only the characters that differ between the old and new run (the common prefix and suffix are kept). Each changed character lands from amber trace with a 2px blur, 0.18em low, is crisp amber by 30%, then settles to its own colour over 760ms, staggered 18ms per character. Reduced motion removes the wave, the underline glide and the icon transitions.
- **Onward link:** "Try it in the playground" in label-size secondary ink with a rule-grey underline that turns to currentColor (and the text to ink) on hover, followed by a 14px inline arrow-right stroke icon.

### ASCII Banner
The homepage's brand mark: dos-rebel "QR-UTILS" drawn twice in Fira Mono, the full shaded art in rule-hover grey underneath and the solid blocks in ink on top, scaled with container query units to fill the column.

## Do's and Don'ts

### Do:
- **Do** keep the ground white and structure in neutral hairlines (neutral-200/300), with the sidebar wash as the only tonal layer.
- **Do** reserve amber for change and focus: trace-amber fills, trace-amber-edge outlines, amber-readout for text that flashes, amber-halo for focus and selection.
- **Do** use amber-readout (never trace-amber) for amber text on white; trace-amber is text only on the ink slab.
- **Do** put measured values, code and character art in Fira Mono with tabular figures for anything live.
- **Do** keep state transitions between 150ms and 250ms; the change flourishes (the 900ms module trace and readout flash, the 760ms character wave) are the deliberate exceptions. Make every flourish stand still under prefers-reduced-motion.
- **Do** reserve space for content that changes so live updates never shift the layout.
- **Do** build hover and pressed states from ink at 10% and 15%, or white at 8% and 14% on an ink surface.

### Don't:
- **Don't** add shadows for elevation; the only box-shadow is the focus halo.
- **Don't** use amber as resting decoration or as a fill behind controls that are not changing or focused.
- **Don't** set prose, labels or headings in Fira Mono (package-manager labels excepted: they are code identifiers).
- **Don't** load additional webfonts without a deliberate decision; Fira Mono is the only one.
- **Don't** let the playground trace or readout flash run when the user prefers reduced motion.
