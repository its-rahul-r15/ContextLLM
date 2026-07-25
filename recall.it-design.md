---
version: alpha
name: Recall
description: A dark, high-contrast SaaS landing system with soft glassy cards, rounded pills, and a bright orange call-to-action.
colors:
  primary: "#FFFFFF"
  primary-90: "#F2F2F2"
  primary-70: "#D9D9D9"
  secondary: "#151515"
  tertiary: "#FF5A1F"
  neutral: "#000000"
  surface: "#FFFFFF"
  surface-2: "#5F788D"
  surface-3: "#86A4BC"
  on-surface: "#FFFFFF"
  on-surface-muted: "#B8C2CC"
  border: "#FFFFFF"
  shadow: "#000000"
  error: "#FF4D4D"
typography:
  headline-display:
    fontFamily: "headingFont"
    fontSize: "45px"
    fontWeight: 500
    lineHeight: "45px"
    letterSpacing: "0px"
  headline-lg:
    fontFamily: "headingFont"
    fontSize: "35px"
    fontWeight: 500
    lineHeight: "42px"
    letterSpacing: "0px"
  headline-md:
    fontFamily: "headingFont"
    fontSize: "27px"
    fontWeight: 500
    lineHeight: "32px"
    letterSpacing: "0px"
  headline-sm:
    fontFamily: "bodyFont"
    fontSize: "21px"
    fontWeight: 500
    lineHeight: "25px"
    letterSpacing: "0px"
  body-lg:
    fontFamily: "bodyFont"
    fontSize: "17px"
    fontWeight: 500
    lineHeight: "25px"
    letterSpacing: "0px"
  body-md:
    fontFamily: "bodyFont"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: "25px"
    letterSpacing: "0px"
  body-sm:
    fontFamily: "bodyFont"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: "18px"
    letterSpacing: "0.04em"
  label-lg:
    fontFamily: "bodyFont"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: "20px"
    letterSpacing: "0.08em"
  label-md:
    fontFamily: "bodyFont"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: "18px"
    letterSpacing: "0.08em"
  label-sm:
    fontFamily: "bodyFont"
    fontSize: "11px"
    fontWeight: 500
    lineHeight: "16px"
    letterSpacing: "0.08em"
  nav-link:
    fontFamily: "bodyFont"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: "16px"
    letterSpacing: "0.12em"
rounded:
  none: "0px"
  sm: "4px"
  md: "10px"
  lg: "16px"
  xl: "24px"
  full: "9999px"
spacing:
  xs: "6px"
  sm: "14px"
  md: "24px"
  lg: "40px"
  xl: "96px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.secondary}"
    typography: "{typography.label-md}"
    rounded: "{rounded.full}"
    padding: "12px 16px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "{colors.primary-90}"
    textColor: "{colors.secondary}"
    typography: "{typography.label-md}"
    rounded: "{rounded.full}"
    padding: "12px 16px"
    height: "40px"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.on-surface}"
    typography: "{typography.label-md}"
    rounded: "{rounded.full}"
    padding: "12px 16px"
    height: "40px"
  button-tertiary:
    backgroundColor: "transparent"
    textColor: "{colors.on-surface}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.none}"
    padding: "0px"
  card:
    backgroundColor: "rgba(255,255,255,0.14)"
    textColor: "{colors.on-surface}"
    typography: "{typography.body-md}"
    rounded: "{rounded.md}"
    padding: "20px"
  input:
    backgroundColor: "rgba(255,255,255,0.12)"
    textColor: "{colors.on-surface}"
    typography: "{typography.body-md}"
    rounded: "{rounded.sm}"
    padding: "12px 14px"
  chip:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.on-surface}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
    padding: "6px 10px"
  badge:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.on-surface}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
    padding: "4px 8px"
  navbar:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.secondary}"
    typography: "{typography.nav-link}"
    rounded: "{rounded.full}"
    padding: "10px 16px"
  hero-panel:
    backgroundColor: "rgba(95,120,141,0.70)"
    textColor: "{colors.on-surface}"
    typography: "{typography.body-md}"
    rounded: "{rounded.md}"
    padding: "20px"
---

# Recall

## Overview
Recall feels like a premium productivity SaaS with a confident, futuristic edge. The page balances darkness and glow: it is professional and trustworthy, but still energetic thanks to the bright orange CTA and soft blue atmospheric gradient. The layout is spacious and editorial, with a strong left-to-right hero composition that frames the product as both smart and approachable.

## Colors
- **Primary (#FFFFFF):** Crisp white used for the main surface, navigation pill, large headlines, and high-contrast UI elements. It gives the system its clean, modern clarity.
- **Secondary (#151515):** Near-black text used for dark UI text on light controls, especially the primary button label and compact navigation wordmark details.
- **Tertiary (#FF5A1F):** A vivid orange accent that powers the main “Get Started” call-to-action. It is the most emotionally expressive color in the system and should be used sparingly.
- **Neutral (#000000):** True black used for the page backdrop and the upper portion of the ambient gradient. It creates strong contrast and a cinematic feel.
- **Surface (#FFFFFF):** White card and panel surfaces for the navigation container and content cards, keeping the interface legible against the dark environment.
- **Surface-2 (#5F788D):** Muted slate-blue used for elevated panels and muted card tiles. It supports the cool, technical tone of the product mockups.
- **Surface-3 (#86A4BC):** Lighter blue used in lower contrast tiles and the gradient’s midtones. It helps the page transition from dark to airy without feeling abrupt.
- **On-surface (#FFFFFF):** Primary text and icon color for dark backgrounds and glassy panels.
- **On-surface-muted (#B8C2CC):** Softer supporting text for metadata, captions, and secondary labels.
- **Border (#FFFFFF):** White borders used for cards, thumbnails, and pills when separation from darker layers is needed.
- **Shadow (#000000):** Black shadow foundation for soft depth and ambient lift.
- **Error (#FF4D4D):** Reserved for destructive or alert states; it is not prominent in the source, but should remain vivid and distinct.

## Typography
The system uses two font voices: a headline font for hero impact and a body font for most interface text. Headings are medium-weight and compact, with strong geometric shapes that reinforce the product’s modern, slightly futuristic personality. Body text is clean and highly readable, with a modest line height and a small, UI-friendly scale.

Use `headline-display` for the main hero statement, `headline-lg` and `headline-md` for section titles, and `headline-sm` for smaller featured headings inside cards. `body-lg` and `body-md` support the supporting copy and product descriptions, while `body-sm`, `label-lg`, `label-md`, and `label-sm` handle metadata, pills, and utility text. Navigation and microcopy lean on a slightly expanded tracking rhythm, especially for all-caps or near-caps labels like the top nav and trust statement.

## Layout
The composition is built around a wide, centered hero area with large negative space and a two-column balance: copy on the left, product mockup on the right. Content feels fluid rather than strictly grid-bound, but it still respects strong alignment and a clear central axis. The visual rhythm is generous, using the `xl` spacing scale for major section gaps and `md` to `lg` for internal content separation.

Pill-shaped navigation and CTA elements sit inside a centered top container, while cards inside the product mockup use tight, consistent gutters and compact padding. The overall spacing strategy favors breathing room over density, with the content stack on the left remaining concise and the product preview carrying more visual detail.

## Elevation & Depth
Depth is achieved with soft shadows, translucent overlays, and tonal layering rather than hard borders or dramatic z-axis stacking. The interface uses a subtle glow effect around cards and controls, plus a cool glass-like panel treatment on the main product mockup. In a few places, thin white borders define image cards and pills, but the experience stays intentionally airy and low-contrast.

The result is polished and cinematic, not skeuomorphic. Shadows should feel diffused and ambient, and surfaces should retain enough transparency or tonal variation to separate layers without making them heavy.

## Shapes
The shape language is rounded and pill-forward. Interactive controls use full-radius capsules, while cards use a restrained `10px` radius that keeps the overall system soft but still structured. The mix creates a friendly, consumer-ready feel without losing the sense of precision.

Use `rounded.full` for buttons, nav containers, and status pills; use `rounded.md` for cards and panels; and reserve `rounded.sm` for smaller inputs or utility elements. Sharp corners are rare and should only appear when a component needs to feel purely functional.

## Components
### Buttons
Primary buttons are high-contrast white pills with dark text, compact padding, and a soft shadow. Use `button-primary` for the main conversion action and keep it short, uppercase or near-uppercase, and visibly tactile. Hover states should slightly soften the white toward `primary-90` while preserving the same shape and size.

Secondary buttons are transparent or outlined pills with white text, ideal for less prominent actions on dark backgrounds. Tertiary buttons are text-only and should feel lightweight, with no fill and no shadow. Buttons should generally be `40px` tall, with `12px 16px` padding and full rounding.

### Cards
Use `card` for elevated content containers, especially when they sit on dark or gradient backgrounds. Cards should be softly lit, lightly shadowed, and kept visually clean with `20px` padding. Avoid heavy borders; the shadow and background tone should do most of the work.

### Inputs
Inputs should inherit the same translucent, rounded language as cards but remain quieter. Use subtle fill, white text, and `rounded.sm` or similar compact corner treatment. Focus states should brighten the surface slightly rather than introducing aggressive outlines.

### Chips and badges
Chips and badges are small, pill-shaped labels used for content types such as Podcast, YouTube, Blog, or PDF. They should remain compact, with `label-sm` type and dense padding. Use high contrast and keep icons minimal so the label reads instantly.

### Navigation
The navigation bar is a centered, white rounded container with compact links and a prominent CTA on the right. It should feel like a floating control strip rather than a full-width site header. Links use small, tracked labels and should stay visually quiet relative to the brand mark and CTA.

### Product tiles
The content tiles inside the mockup are image-led cards with white frames or muted slate fills. They mix thumbnail, title, and a tiny category pill, and the system should preserve that compact editorial structure. Titles may wrap aggressively, but the cards should remain uniform in size and spacing.

## Do's and Don'ts
- Do keep the interface spacious, with generous margins and clear breathing room around the hero.
- Do use full-radius pills for primary actions and top-level navigation containers.
- Do favor white, slate-blue, and black with one vivid orange accent for emphasis.
- Do keep typography compact, medium-weight, and highly legible at small sizes.
- Don't introduce heavy gradients, neon hues, or overly saturated secondary accents.
- Don't use sharp corners or boxy buttons when a pill shape is available.
- Don't crowd the page with dense content blocks; the design depends on restraint.
- Don't replace soft shadows with harsh outlines or loud drop shadows.