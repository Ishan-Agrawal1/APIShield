---
name: APIShield
description: Authorized REST API security assessment
colors:
  terminal-bg: "#050505"
  terminal-panel: "#0a0a0a"
  terminal-border: "#1a1a1a"
  terminal-text: "#e0e0e0"
  terminal-muted: "#666666"
  terminal-critical: "#ff003c"
  terminal-high: "#ff8800"
  terminal-medium: "#ffcc00"
  terminal-low: "#00ccff"
  terminal-info: "#33ff55"
  terminal-accent: "#00ffcc"
typography:
  display:
    fontFamily: "\"Courier New\", Courier, monospace"
    fontSize: "1.5rem"
    fontWeight: "bold"
  body:
    fontFamily: "\"Courier New\", Courier, monospace"
    fontSize: "14px"
    lineHeight: "1.4"
components:
  button:
    backgroundColor: "{colors.terminal-border}"
    textColor: "{colors.terminal-text}"
    padding: "0.5rem 1rem"
---

# Design System: APIShield

## Overview

**Creative North Star: "The High-Density Stock Trading Terminal"**

The UI is a dense, high-contrast, data-heavy terminal for rapid security triage. It drops the conventional white SaaS dashboard look for a dark, glowing aesthetic that prioritizes scanning speed and data density.

**Key Characteristics:**
- Absolute dark mode (Deep charcoal/black).
- Monospaced typography for all data.
- Vivid neon severity markers.
- Distinct shapes accompanying colors for accessibility.

## Colors

The palette is extremely stark, using a near-black canvas to make neon accents pop.

### Primary
- **Terminal Accent** (#00ffcc): Used for active states, brand highlights, and data focus.

### Secondary
- **Critical** (#ff003c): Highest severity.
- **High** (#ff8800): Secondary severity.
- **Medium** (#ffcc00): Mid severity.
- **Low** (#00ccff): Low severity.
- **Info** (#33ff55): Informational severity or "completed/ok" states.

### Neutral
- **Terminal Background** (#050505): Absolute background.
- **Terminal Panel** (#0a0a0a): Slightly lighter surface for containers.
- **Terminal Border** (#1a1a1a): Subtle borders for structure.
- **Terminal Text** (#e0e0e0): Primary reading text.
- **Terminal Muted** (#666666): Secondary text and labels.

**The Shape Independence Rule.** Severity is never communicated by color alone. Every severity tier has an assigned geometric shape (▲ Critical, ◆ High, ■ Medium, ▼ Low, ● Info).

## Typography

**Display Font:** Courier New (with fallback Courier, monospace)
**Body Font:** Courier New

**Character:** Utilitarian, precise, unembellished data representation.

### Hierarchy
- **Display** (bold, 1.5rem): Used for rule IDs and major headers.
- **Body** (normal, 14px): Used for descriptions and data.
- **Label** (normal, 12px, uppercase): Used for metadata, filters, and tiny labels.

## Layout

Split-pane design emphasizing high density. The left pane functions as a rapid-triage ticker, and the right pane acts as a deep fundamental analysis view. Flex layouts control the split, switching to column-stack on narrow viewports.

## Elevation & Depth

No shadows. Depth is communicated strictly through structural borders and slight background color variations (bg -> panel).

## Shapes

Hard edges exclusively. No rounded corners. Borders are 1px solid to mimic terminal window panes.

## Components

### Buttons
- **Shape:** Square (0px radius).
- **Primary:** Dark gray background with muted border, uppercase monospace text.
- **Hover / Focus:** Border and text color shift to terminal-accent.

### Select / Inputs
- **Style:** Dark background, 1px border. Focus states use an accent-colored ring.

## Do's and Don'ts

### Do:
- **Do** use uppercase for small labels and metadata.
- **Do** pair severity colors with their explicit shapes.
- **Do** maintain extreme data density.

### Don't:
- **Don't** use rounded corners.
- **Don't** add shadows or gradients.
- **Don't** use sans-serif or serif fonts; stay strictly monospaced.
