import type { Phase, PhaseId, PhaseLink } from './types';

/** The seven-phase defense lifecycle. Order is the clockwise order on the radial map. */
export const phases: Phase[] = [
  {
    id: 'visibility',
    order: 1,
    label: 'Visibility',
    short: 'Visibility',
    icon: 'eye',
    hue: 'slate',
    tagline: 'You cannot defend what you cannot see.',
    description:
      'The foundation of detection. Comprehensive, normalized telemetry from endpoints, identity, network, DNS and cloud. Invest in log coverage and normalization before adding more tools: every downstream phase inherits the gaps you leave here.',
    capabilities: ['SIEM · EDR', 'NDR · DNS', 'Identity · Cloud'],
    objectives: [
      'Land every Tier 1 log source before anything else: Security log, Sysmon, EDR, firewall, DNS, IdP',
      'Enable 4688 command-line auditing and PowerShell ScriptBlock (4104) logging',
      'Correlate process to network and DNS (Sysmon 3 and 22) to see C2 over 80/443',
      'Hold 90 days hot and 1 year preferred; archive to warm and cold tiers per compliance',
    ],
    keyTools: ['Splunk', 'Microsoft Sentinel', 'Elastic Security', 'Sysmon', 'Zeek'],
    measures: ['Tier 1 source coverage %', 'Ingest latency', 'Parsing/normalization error rate'],
    layers: ['visibility', 'endpoint', 'network'],
    sections: ['siem', 'edr', 'network'],
  },
  {
    id: 'detection',
    order: 2,
    label: 'Detection',
    short: 'Detection',
    icon: 'target',
    hue: 'sage',
    tagline: 'Detections analysts trust, mapped to the techniques that matter.',
    description:
      'Building, testing and maintaining detections across SIGMA, YARA, UEBA and network analytics. Coverage over MITRE ATT&CK, rule lifecycle management and false-positive reduction are the core disciplines. The goal is trust, not coverage theater.',
    capabilities: ['SIGMA · YARA', 'UEBA · IOC', 'Behavioral'],
    objectives: [
      'Store rules as code with CI that validates, compiles and deploys SIGMA on merge',
      'Measure false-positive rate per rule weekly and tune with hash + path + parent filters',
      'Track coverage depth per technique: Alert > Logged > Blind',
      'Validate with Atomic Red Team; fix the rule when the test does not alert',
    ],
    keyTools: ['SigmaHQ / sigma-cli', 'YARA', 'ATT&CK Navigator', 'Atomic Red Team', 'Suricata'],
    measures: ['False positives per rule per week', 'ATT&CK techniques at Alert tier', 'Rules silent > 6 months'],
    layers: ['detection'],
    sections: ['detection-eng', 'technique-detect', 'event-ids'],
  },
  {
    id: 'triage',
    order: 3,
    label: 'Triage',
    short: 'Triage',
    icon: 'search',
    hue: 'teal',
    tagline: 'Confirm, enrich and scope before you act.',
    description:
      'Turn an alert into a decision. Confirm the true positive, enrich with asset, user and threat-intel context, walk the process tree, and estimate scope. First compromised host is not the only compromised host: assume lateral movement until proven otherwise.',
    capabilities: ['Enrich · Scope', 'Process Trees', 'Memory / Disk'],
    objectives: [
      'Auto-enrich every P1/P2 alert with CMDB, HR, AD and IOC context before an analyst sees it',
      'Walk the full process tree and parent lineage, not just the alerting process',
      'Capture memory before any reboot; network isolation is fine, reboots destroy evidence',
      'Build the timeline: patient zero → first malicious action → lateral spread → impact',
    ],
    keyTools: ['Velociraptor', 'Volatility 3', 'MemProcFS', 'VirusTotal', 'TheHive'],
    measures: ['Mean time to triage', 'Alerts auto-enriched %', 'Escalation accuracy'],
    layers: ['response', 'endpoint'],
    sections: ['ir', 'soar', 'event-ids'],
  },
  {
    id: 'response',
    order: 4,
    label: 'Response',
    short: 'Response',
    icon: 'zap',
    hue: 'mauve',
    tagline: 'Contain early, but scope fully before you eradicate.',
    description:
      'Structured response from containment through eradication. Automate enrichment and low-risk actions; gate destructive actions (disable, isolate, block, purge) behind analyst approval. Containing the wrong host leaves the attacker active elsewhere.',
    capabilities: ['Contain · Hunt', 'Eradicate', 'SOAR / Playbooks'],
    objectives: [
      'Isolate via EDR or VLAN ACL; disable accounts, revoke tokens and kill sessions',
      'Contain silently where possible: a spooked attacker may trigger ransomware or exfil',
      'Remove all persistence: tasks, services, Run keys, sideloads, WMI subscriptions',
      'Rotate every exposed credential; for AD-wide compromise, krbtgt twice',
    ],
    keyTools: ['Palo Alto XSOAR', 'Splunk SOAR', 'Microsoft Defender for Endpoint', 'CrowdStrike Falcon', 'Shuffle'],
    measures: ['Mean time to contain', 'Playbook automation rate', 'Re-compromise within 30 days'],
    layers: ['response', 'hunt'],
    sections: ['ir', 'soar', 'hunting'],
  },
  {
    id: 'hardening',
    order: 5,
    label: 'Hardening',
    short: 'Hardening',
    icon: 'shield',
    hue: 'gold',
    tagline: 'Shrink the attack surface every incident exposed.',
    description:
      'Reduce attack surface through configuration management and defense-in-depth: phishing-resistant MFA, tiered administration, ASR and WDAC, ADCS template fixes, segmentation and risk-based patching. Identity is the new perimeter and the highest-ROI investment.',
    capabilities: ['Patch · LAPS', 'ASR · ADCS', 'MFA · Baselines'],
    objectives: [
      'FIDO2 / passkeys for all Tier 0 accounts first, then admins, then everyone',
      'Enable ASR rules in audit, move to block after 2–4 weeks; enforce Tamper Protection',
      'Run Locksmith and fix ESC1 / ESC4 / ESC6; enable CA audit events 4886/4887/4899',
      'Patch CISA KEV within 7 days regardless of CVSS',
    ],
    keyTools: ['Locksmith', 'PingCastle / Purple Knight', 'Microsoft LAPS', 'Tenable Nessus', 'Prowler'],
    measures: ['KEV SLA compliance', 'Tier 0 accounts on FIDO2 %', 'Open ESC findings'],
    layers: ['identity', 'hardening', 'network', 'cloud'],
    sections: ['identity', 'hardening', 'network', 'cloud', 'vuln'],
  },
  {
    id: 'intel',
    order: 6,
    label: 'Intel / Hunt',
    short: 'Intel / Hunt',
    icon: 'microscope',
    hue: 'khaki',
    tagline: 'Hunt for what automation missed, guided by intelligence.',
    description:
      'Intelligence drives hunting priority, detection coverage and hardening focus. Hypothesis-driven hunts look for adversaries that evaded automated detection. Every hunt ends in a finding that needs response or a new detection rule.',
    capabilities: ['CTI · Actors', 'Malware Analysis', 'Atomic Tests'],
    objectives: [
      'Prioritize techniques used by actors targeting your sector',
      'Write specific, testable, falsifiable hunt hypotheses',
      'Hunt beaconing, LOLBin abuse and persistence weekly',
      'Seed deception: canary tokens, honey accounts and honey SPNs give near-zero-FP alerts',
    ],
    keyTools: ['MISP / OpenCTI', 'RITA', 'CAPA / FLOSS', 'Thinkst Canary', 'Hayabusa'],
    measures: ['Hunts per month', 'Hunts converted to detections', 'Mean dwell time found'],
    layers: ['hunt', 'intel'],
    sections: ['hunting', 'intel', 'deception'],
  },
  {
    id: 'recovery',
    order: 7,
    label: 'Recovery',
    short: 'Recovery',
    icon: 'refresh',
    hue: 'rose',
    tagline: 'Rebuild clean, learn, and feed it back into detection.',
    description:
      'Return to production only from a validated clean state. Restore from immutable backups, monitor closely for secondary persistence, run root cause analysis, and turn every incident into at least one new detection rule.',
    capabilities: ['Rebuild · RCA', 'Lessons Learned', 'New Rules'],
    objectives: [
      'Validate backup integrity before restoring; ransomware crews target backups first',
      'Prefer reimage over clean for sophisticated intrusions',
      'Run RCA: which control failed, why, and what prevents recurrence',
      'Ship at least one new detection per incident',
    ],
    keyTools: ['Veeam / immutable storage', 'Velociraptor', 'Plaso / log2timeline', 'TheHive / IRIS'],
    measures: ['RTO / RPO met', 'Restore test success rate', 'Detections added per incident'],
    layers: ['hardening', 'response'],
    sections: ['hardening', 'ir'],
  },
];

/**
 * Links drawn on the radial map. Each phase feeds the next (flow); recovery and
 * hunting feed new rules back into detection, and response findings drive hardening.
 */
export const phaseLinks: PhaseLink[] = [
  { from: 'visibility', to: 'detection', label: 'Telemetry', kind: 'flow' },
  { from: 'detection', to: 'triage', label: 'Alerts', kind: 'flow' },
  { from: 'triage', to: 'response', label: 'Confirmed incidents', kind: 'flow' },
  { from: 'response', to: 'hardening', label: 'Control gaps', kind: 'flow' },
  { from: 'hardening', to: 'intel', label: 'Reduced surface', kind: 'flow' },
  { from: 'intel', to: 'recovery', label: 'Scoped clean state', kind: 'flow' },
  { from: 'recovery', to: 'visibility', label: 'Enhanced monitoring', kind: 'flow' },
  { from: 'recovery', to: 'detection', label: 'New rules', kind: 'feedback' },
  { from: 'intel', to: 'detection', label: 'Hunts → detections', kind: 'feedback' },
  { from: 'triage', to: 'visibility', label: 'Visibility gaps', kind: 'feedback' },
];

// Null prototype: ids from a URL such as "toString" find nothing instead of an inherited method.
export const phaseById: Record<PhaseId, Phase> = Object.assign(
  Object.create(null),
  Object.fromEntries(phases.map((p) => [p.id, p])),
);
