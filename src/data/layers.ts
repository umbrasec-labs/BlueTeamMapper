import type { Layer } from './types';

/**
 * Defense architecture layers, top (telemetry) to bottom (intelligence).
 * Each layer pulls its cards, matrices and callouts from the listed v3 sections
 * and its tools from the listed arsenal categories.
 */
export const layers: Layer[] = [
  {
    id: 'visibility',
    label: 'Visibility',
    icon: 'database',
    hue: 'slate',
    tagline: 'SIEM, log pipeline, retention tiers and parsing',
    phases: ['visibility', 'detection'],
    sections: ['siem'],
    toolCategories: ['siem-log-management'],
    keyControls: [
      { label: 'Tier 1 log sources landed and parsed', priority: 'P0' },
      { label: '4688 + command line and 4104 ScriptBlock enabled', priority: 'P0' },
      { label: 'Sysmon with a maintained config (SwiftOnSecurity / Olaf Hartong)', priority: 'P1' },
      { label: '90-day hot retention, 1 year preferred', priority: 'P1' },
    ],
  },
  {
    id: 'endpoint',
    label: 'Endpoint',
    icon: 'cpu',
    hue: 'teal',
    tagline: 'EDR/XDR telemetry, tuning, tamper protection and blind spots',
    phases: ['visibility', 'detection', 'response'],
    sections: ['edr'],
    toolCategories: ['edr-endpoint-detection'],
    keyControls: [
      { label: 'Tamper Protection enforced via Intune', priority: 'P0' },
      { label: 'Credential Guard on all Windows 10/11 endpoints', priority: 'P0' },
      { label: 'ASR rules moved from audit to block', priority: 'P1' },
      { label: 'Extra-paranoid prevention on Tier 0 assets', priority: 'P2' },
    ],
  },
  {
    id: 'detection',
    label: 'Detection',
    icon: 'target',
    hue: 'sage',
    tagline: 'SIGMA, YARA, UEBA, NDR and ATT&CK coverage mapping',
    phases: ['detection'],
    sections: ['detection-eng'],
    toolCategories: ['detection-engineering', 'network-detection-and-response'],
    keyControls: [
      { label: 'Detection-as-code pipeline with CI validation', priority: 'P1' },
      { label: 'Weekly FP rate per rule', priority: 'P0' },
      { label: 'ATT&CK Navigator coverage: Alert / Logged / Blind', priority: 'P1' },
      { label: 'Monthly atomic tests on critical techniques', priority: 'P2' },
    ],
  },
  {
    id: 'response',
    label: 'Response',
    icon: 'siren',
    hue: 'mauve',
    tagline: 'IR lifecycle, forensics, chain of custody and SOAR playbooks',
    phases: ['triage', 'response', 'recovery'],
    sections: ['ir', 'soar'],
    toolCategories: ['forensics-and-incident-response', 'soar-platforms'],
    keyControls: [
      { label: 'Runbooks per incident type, tabletop quarterly', priority: 'P0' },
      { label: 'Memory captured before any reboot', priority: 'P0' },
      { label: 'Destructive actions gated by analyst approval', priority: 'P1' },
      { label: 'Every IR ships at least one new detection', priority: 'P1' },
    ],
  },
  {
    id: 'hunt',
    label: 'Threat Hunting',
    icon: 'crosshair',
    hue: 'gold',
    tagline: 'Hypothesis-driven hunts for beaconing, LOLBins and persistence',
    phases: ['intel', 'response'],
    sections: ['hunting'],
    toolCategories: ['threat-hunting'],
    keyControls: [
      { label: 'Weekly structured hunts aligned to CTI', priority: 'P1' },
      { label: 'Autoruns baseline collected fleet-wide', priority: 'P1' },
      { label: 'Every hunt yields a finding or a detection', priority: 'P0' },
      { label: 'Ad-hoc hunts after major CVE disclosures', priority: 'P2' },
    ],
  },
  {
    id: 'identity',
    label: 'Identity',
    icon: 'fingerprint',
    hue: 'mauve',
    tagline: 'MFA strength, PAM, AD hardening and Conditional Access',
    phases: ['hardening', 'visibility'],
    sections: ['identity'],
    toolCategories: ['identity-and-access'],
    keyControls: [
      { label: 'FIDO2 / passkeys on all Tier 0 accounts', priority: 'P0' },
      { label: 'Legacy auth blocked in Conditional Access', priority: 'P0' },
      { label: 'LAPS on every machine', priority: 'P1' },
      { label: 'CAP exclusions reviewed quarterly', priority: 'P1' },
    ],
  },
  {
    id: 'hardening',
    label: 'Hardening',
    icon: 'shield',
    hue: 'gold',
    tagline: 'Endpoint baselines, ADCS, patching, backups and vulnerability SLAs',
    phases: ['hardening', 'recovery'],
    sections: ['hardening', 'vuln'],
    toolCategories: ['vulnerability-management'],
    keyControls: [
      { label: 'CISA KEV patched within 7 days', priority: 'P0' },
      { label: 'ESC1 / ESC4 / ESC6 fixed, CA audit logging on', priority: 'P0' },
      { label: '3-2-1-1-0 backups with immutable copy', priority: 'P0' },
      { label: 'WDAC or AppLocker blocks user-writable paths', priority: 'P1' },
    ],
  },
  {
    id: 'network',
    label: 'Network',
    icon: 'network',
    hue: 'sage',
    tagline: 'Segmentation, DNS security, email hardening and TLS inspection',
    phases: ['visibility', 'hardening'],
    sections: ['network'],
    toolCategories: [],
    keyControls: [
      { label: 'Block SMB 445 workstation-to-workstation', priority: 'P0' },
      { label: 'DMARC p=reject with SPF -all and DKIM', priority: 'P1' },
      { label: 'Egress forced through proxy, DoH blocked', priority: 'P1' },
      { label: 'Crown jewels in a management VLAN', priority: 'P0' },
    ],
  },
  {
    id: 'cloud',
    label: 'Cloud',
    icon: 'cloud',
    hue: 'slate',
    tagline: 'Entra ID / M365, AWS, posture management and Kubernetes',
    phases: ['visibility', 'hardening', 'response'],
    sections: ['cloud'],
    toolCategories: [],
    keyControls: [
      { label: 'Org-wide multi-region CloudTrail; disable = P1', priority: 'P0' },
      { label: 'Graph Activity Logs and UAL enabled', priority: 'P0' },
      { label: 'GuardDuty in every region', priority: 'P1' },
      { label: 'OAuth consent alerts for sensitive scopes', priority: 'P1' },
    ],
  },
  {
    id: 'intel',
    label: 'Intel & Deception',
    icon: 'brain',
    hue: 'khaki',
    tagline: 'TI platforms, malware analysis, dark web monitoring and deception',
    phases: ['intel', 'detection'],
    sections: ['intel', 'deception'],
    toolCategories: ['threat-intelligence', 'deception'],
    keyControls: [
      { label: 'Honey accounts with honey SPNs in AD', priority: 'P1' },
      { label: 'Canary tokens on file shares and in code', priority: 'P1' },
      { label: 'ISAC membership and CISA advisories feed', priority: 'P2' },
      { label: 'Infostealer credential monitoring', priority: 'P2' },
    ],
  },
];

export const layerById: Record<string, Layer> = Object.fromEntries(layers.map((l) => [l.id, l]));

/** Find the layer that renders a given v3 section. */
export function layerForSection(sectionId: string): Layer | undefined {
  return layers.find((l) => l.sections.includes(sectionId));
}
