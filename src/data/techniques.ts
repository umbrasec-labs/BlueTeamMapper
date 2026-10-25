import type { Tactic, Technique } from './types';
import raw from './legacy/techniques.json';

type RawTechnique = Pick<Technique, 'name' | 'detection' | 'severity' | 'response'>;

/**
 * ATT&CK alignment for each row of the v3 Technique Detection Matrix, plus the
 * event IDs and flow chain an analyst should open next. Keyed by technique name.
 */
const ENRICHMENT: Record<
  string,
  { attackId: string; tactic: Tactic; events: number[]; chain?: string }
> = {
  'Spear phishing (HTML smuggling)': { attackId: 'T1566.001', tactic: 'Initial Access', events: [], chain: 'phishing' },
  'LNK / ISO file delivery': { attackId: 'T1553.005', tactic: 'Defense Impairment', events: [1, 11], chain: 'phishing' },
  'Shellcode loader (custom)': { attackId: 'T1620', tactic: 'Stealth', events: [7, 8], chain: 'edr-alert' },
  'Process injection': { attackId: 'T1055', tactic: 'Stealth', events: [8, 10, 25], chain: 'edr-alert' },
  'DLL sideloading': { attackId: 'T1574.001', tactic: 'Stealth', events: [7], chain: 'edr-alert' },
  'LSASS credential dump': { attackId: 'T1003.001', tactic: 'Credential Access', events: [10], chain: 'credential-compromise' },
  Kerberoasting: { attackId: 'T1558.003', tactic: 'Credential Access', events: [4769] },
  DCSync: { attackId: 'T1003.006', tactic: 'Credential Access', events: [4662], chain: 'dcsync' },
  'Pass-the-Hash': { attackId: 'T1550.002', tactic: 'Lateral Movement', events: [4624, 4648, 4776] },
  'Golden Ticket': { attackId: 'T1558.001', tactic: 'Credential Access', events: [4769, 4768], chain: 'dcsync' },
  'PsExec lateral movement': { attackId: 'T1021.002', tactic: 'Lateral Movement', events: [7045, 1, 17, 18] },
  'WMI remote execution': { attackId: 'T1047', tactic: 'Execution', events: [1] },
  'Scheduled task persistence': { attackId: 'T1053.005', tactic: 'Persistence', events: [4698, 1] },
  'Registry Run key persistence': { attackId: 'T1547.001', tactic: 'Persistence', events: [12, 13] },
  'DNS exfiltration': { attackId: 'T1048.003', tactic: 'Exfiltration', events: [22], chain: 'data-exfil' },
  'HTTPS C2 beaconing': { attackId: 'T1071.001', tactic: 'Command and Control', events: [3, 22], chain: 'edr-alert' },
  'Cloud token theft / device code': { attackId: 'T1528', tactic: 'Credential Access', events: [], chain: 'cloud-token-theft' },
  'ADCS ESC1 exploitation': { attackId: 'T1649', tactic: 'Credential Access', events: [4886, 4887, 4899], chain: 'adcs-esc' },
  'Ransomware encryption': { attackId: 'T1486', tactic: 'Impact', events: [11, 23], chain: 'ransomware' },
  'BYOVD vulnerable driver': { attackId: 'T1068', tactic: 'Privilege Escalation', events: [7045] },
  'ClickFix / clipboard paste': { attackId: 'T1204.004', tactic: 'Execution', events: [1], chain: 'phishing' },
  'AS-REP Roasting': { attackId: 'T1558.004', tactic: 'Credential Access', events: [4768, 4738] },
};

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export const techniques: Technique[] = (raw as RawTechnique[]).map((t) => {
  const extra = ENRICHMENT[t.name];
  if (!extra) throw new Error(`Missing ATT&CK enrichment for technique "${t.name}"`);
  return { id: slug(t.name), ...t, ...extra };
});

export const tactics: Tactic[] = [
  'Initial Access',
  'Execution',
  'Persistence',
  'Privilege Escalation',
  'Stealth',
  'Defense Impairment',
  'Credential Access',
  'Lateral Movement',
  'Command and Control',
  'Exfiltration',
  'Impact',
];
