# Blue Team Mapper v3.0

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT) ![Theme](https://img.shields.io/badge/theme-charcoal%20%2F%20orange-F25623)

**Comprehensive visual reference & workflow mapper for blue team / defensive security operations.**

A single-page, interactive defender dashboard mapping the full blue team lifecycle:

- Visibility → Detection → Triage → Response → Hardening → Intel/Hunt → Recovery

Built as a static HTML/CSS/JS site on a charcoal and orange palette.

**Live version:**  
https://umbrasec-labs.github.io/BlueTeamMapper/

**Companion project:**  
[Red Team Mapper](https://umbrasec-labs.github.io/RedTeamMapper/) - the offensive counterpart.

## Why This Exists
Red vs Blue is most effective when both sides speak the same language.  
This mapper flips the Red Team perspective into practical defensive controls, detection opportunities, hardening steps, and hunting queries - all in one clean visual reference.

## Features
- Sticky sidebar navigation (260px) with grouped phase categories and scroll-spy active states
- 7-phase defense lifecycle bar (Visibility → Detection → Triage → Response → Hardening → Hunt → Recovery)
- End-to-end workflow chains (phishing → detection → containment → recovery, ADCS abuse, credential attacks, ransomware, cloud identity, etc.)
- Callout boxes (danger/warn/info/success) for critical rules, caveats, and key hardening priorities
- Detailed sections covering:
  - Infrastructure & SIEM/Log Management (log pipeline, retention tiers, parsing)
  - Access Controls & Identity Protection (MFA hierarchy, PAM, Entra ID hardening)
  - Endpoint Protection (EDR/XDR tuning, exclusion hygiene, tamper protection)
  - Detection Engineering (Sigma rules, KQL queries, SPL hunt queries, YARA)
  - Technique Detection Matrix (22 techniques mapped to log source and event IDs)
  - SOAR Playbooks (phishing, lateral movement, ransomware, cloud identity)
  - Containment & Incident Response (isolation, evidence collection, chain of custody)
  - Threat Hunting Methodology (hypothesis-driven, IOC/TTP-based, behavioral)
  - Network & Data Protection (segmentation, DLP, proxy/TLS inspection)
  - Cloud & AD Hardening (ADCS ESC fixes, Entra ID CA policies, Tier 0 isolation)
  - MFA Strength Hierarchy with AitM bypass warnings
  - macOS/Linux Defense
  - AI Security Defense
  - Vulnerability SLA table (P0-P3 remediation timelines)
  - EDR blind spots (BYOVD, ETW tampering, syscalls, process ghosting, fork-and-run)
  - Full tool arsenal + critical Windows Event IDs & Sysmon references

## Tech Stack

- HTML5 + CSS + JavaScript (vanilla, no frameworks)
- Google Fonts: **Syne** (headings) + **IBM Plex Sans** (body) + **JetBrains Mono** (code/mono)
- CSS variable design system (charcoal / orange palette)
- IntersectionObserver API for sidebar scroll-spy

## Palette (charcoal / orange)

Surfaces, text and borders are the umbrasec.dev palette. The accent
variables keep their historical names and carry a muted eight-hue coding
set (orange, gold, khaki, sage, teal, slate, mauve, rose) so categories and
severities stay distinguishable on charcoal.

```css
:root {
  --bg:           #171717;
  --bg-card:      #222222;
  --bg-raised:    #2a2a2a;
  --bg-hover:     #2a2a2a;
  --border:       #525252;
  --border-dim:   #2a2a2a;
  --text:         #959c95;
  --text-bright:  #ccd0cf;
  --text-dim:     #7d837d;
  --text-muted:   #686c69;
  --red:          #f25623;   /* orange: critical, primary accent */
  --orange:       #d9a441;   /* gold: high, warnings */
  --yellow:       #d9a441;
  --green:        #88a57d;   /* sage: low, success */
  --teal:         #5fb3a1;
  --cyan:         #5fb3a1;   /* teal: commands, cyan roles */
  --blue:         #8fa3b8;   /* slate: info */
  --purple:       #b48ead;   /* mauve: tools, purple roles */
  --magenta:      #b48ead;
}
/* medium severity: khaki #aeab94 */
```

## Changelog

### v3.0
- Added sticky sidebar navigation (260px) with grouped phase categories and IntersectionObserver scroll-spy
- Replaced SVG defense lifecycle diagram with clean 7-phase lifecycle bar
- Added Syne 800 as heading font; increased base font to 14px / line-height 1.75
- Added callout boxes (danger/warn/info/success) for critical rules and hardening priorities
- Extended CSS variable set with `--bg-card`, `--bg-raised`, `--bg-hover`, `--border-dim`, `--text-muted`
- Card accent bars (2px colored top-border per phase)
- New content: SOAR Playbooks, Splunk SPL hunt queries, Technique Detection Matrix (22 techniques), Vulnerability SLA table, ADCS ESC1/ESC4/ESC6 remediation, EDR blind spots, Evidence & Chain of Custody card, MFA Strength Hierarchy with AitM bypass warning

### v2.0
- Initial public release
