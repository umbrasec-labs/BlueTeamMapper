import { sectionById } from './sections';
import { techniques } from './techniques';

/** A log source from the v3 Log Source Priority Matrix. */
export interface LogSource {
  label: string;
  tier: 1 | 2 | 3;
  note: string;
}

const matrix = sectionById.siem.matrices.find((m) => m.title === 'Log Source Priority Matrix');
if (!matrix) throw new Error('Log Source Priority Matrix missing from the SIEM section');

/** Tier 1-3 log sources; the retention group is not a source and is skipped. */
export const logSources: LogSource[] = matrix.groups.flatMap((g) => {
  const tier = Number(g.heading.match(/^TIER (\d)/)?.[1]);
  if (!tier) return [];
  return g.rows.map((r) => ({ label: r.label, tier: tier as 1 | 2 | 3, note: r.value }));
});

/**
 * Log sources each technique's primary detection depends on, read from the
 * "Primary Detection" column of the matrix. If none of a technique's sources is
 * collected, it is blind no matter what rules exist.
 */
export const techniqueSources: Record<string, string[]> = {
  'spear-phishing-html-smuggling': ['Email Security Gateway', 'Proxy / Web Filter'],
  'lnk-iso-file-delivery': ['Email Security Gateway', 'Windows Sysmon'],
  'shellcode-loader-custom': ['EDR Telemetry', 'PowerShell ScriptBlock (4104)'],
  'process-injection': ['Windows Sysmon', 'EDR Telemetry'],
  'dll-sideloading': ['Windows Sysmon'],
  'lsass-credential-dump': ['Windows Sysmon', 'EDR Telemetry'],
  kerberoasting: ['Windows Security Event Log'],
  dcsync: ['Windows Security Event Log', 'Active Directory'],
  'pass-the-hash': ['Windows Security Event Log'],
  'golden-ticket': ['Windows Security Event Log'],
  'psexec-lateral-movement': ['Windows Security Event Log', 'Windows Sysmon'],
  'wmi-remote-execution': ['WMI Activity Log', 'Windows Sysmon'],
  'scheduled-task-persistence': ['Windows Security Event Log', 'Windows Sysmon'],
  'registry-run-key-persistence': ['Windows Sysmon'],
  'dns-exfiltration': ['DNS Logs', 'Windows Sysmon'],
  'https-c2-beaconing': ['NetFlow / IPFIX', 'Proxy / Web Filter', 'Network Firewall / IDS'],
  'cloud-token-theft-device-code': ['Identity Provider', 'Cloud API Logs'],
  'adcs-esc1-exploitation': ['Windows Security Event Log', 'Active Directory'],
  'ransomware-encryption': ['EDR Telemetry', 'Windows Sysmon'],
  'byovd-vulnerable-driver': ['Windows Sysmon', 'EDR Telemetry'],
  'clickfix-clipboard-paste': ['PowerShell ScriptBlock (4104)'],
  'as-rep-roasting': ['Windows Security Event Log'],
};

// Fail fast if the mapping drifts from the techniques or the log source labels.
const known = new Set(logSources.map((s) => s.label));
for (const t of techniques) {
  const srcs = techniqueSources[t.id];
  if (!srcs) throw new Error(`No log sources mapped for technique "${t.id}"`);
  for (const s of srcs) if (!known.has(s)) throw new Error(`Unknown log source "${s}" for "${t.id}"`);
}

/** Coverage tiers from the Detection Engineering section: Alert > Logged > Blind. */
export type CoverageLevel = 'alert' | 'logged' | 'blind';

export const coverageMeta: Record<CoverageLevel, { label: string; hint: string; score: number; color: string }> = {
  alert: { label: 'Alert', hint: 'A tuned rule fires on it', score: 100, color: '#88a57d' },
  logged: { label: 'Logged', hint: 'Visible in logs, no alert', score: 50, color: '#d9a441' },
  blind: { label: 'Blind', hint: 'No visibility', score: 0, color: '#f25623' },
};
