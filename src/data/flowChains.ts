import type { FlowChain } from './types';

/**
 * End-to-end response workflows. Step labels follow the v3 flow chains; details,
 * actions and evidence are drawn from the matching IR, SOAR and hardening cards.
 * Steps run in array order unless a step lists explicit `next` successors.
 */
export const flowChains: FlowChain[] = [
  {
    id: 'phishing',
    title: 'Phishing',
    route: 'Phishing → Detection → Block → Hunt',
    icon: 'mail',
    hue: 'slate',
    severity: 'high',
    summary:
      'From a reported or gateway-flagged email to org-wide purge. Enrichment and blocking are automated; execution on any endpoint pauses automation and escalates to P1.',
    phases: ['visibility', 'detection', 'triage', 'response'],
    techniques: ['spear-phishing-html-smuggling', 'lnk-iso-file-delivery', 'clickfix-clipboard-paste'],
    steps: [
      {
        id: 'received',
        label: 'Email received',
        phase: 'visibility',
        detail:
          'A user reports the message with the Report Phishing button, or the email gateway flags it inbound. Either path starts the phishing triage playbook.',
        actions: ['Capture the original message with full headers', 'Open the SOAR phishing triage playbook'],
        evidence: ['Exchange / M365 audit', 'Email gateway logs'],
        tools: ['Microsoft Defender for Office 365', 'Proofpoint'],
      },
      {
        id: 'gateway',
        label: 'Gateway / Proofpoint scan',
        phase: 'detection',
        detail:
          'Attachments are detonated in a sandbox and URLs are rescanned at time of click. This catches macro-less payloads, LNK and ISO files, and links weaponized after delivery.',
        actions: [
          'Extract sender, reply-to, sending IP, URLs and attachment hashes',
          'Submit IOCs to VirusTotal, URLScan and the internal TIP in parallel',
        ],
        evidence: ['Sandbox detonation report', 'URL time-of-click verdict'],
        tools: ['VirusTotal', 'URLScan', 'MISP'],
      },
      {
        id: 'triage',
        label: 'SIEM alert → analyst triage',
        phase: 'triage',
        detail:
          'SIEM finds every recipient of mail from the same sender in the last 30 days, and EDR checks the fleet for execution of the attachment hashes. The result decides the branch.',
        actions: ['Query all recipients from the sender (30 days)', 'Fleet-wide EDR hunt for attachment hash execution'],
        evidence: ['Sysmon 1 (process create)', 'PowerShell 4104', 'Proxy click logs'],
        next: [
          { to: 'block', label: 'No execution' },
          { to: 'escalate', label: 'Execution found' },
        ],
      },
      {
        id: 'escalate',
        label: 'Escalate to P1 incident',
        phase: 'response',
        gate: true,
        detail:
          'Execution was found on at least one endpoint. Automation pauses, the on-call analyst is paged, and a P1 incident opens with all enrichment pre-populated. Hand off to the EDR alert chain for each affected host.',
        actions: ['Page on-call analyst', 'Create P1 with enrichment attached', 'Start EDR triage on affected hosts'],
        pitfall: 'Blocking the sender before scoping can tip off an attacker who already has a foothold.',
        next: [{ to: 'block', label: 'Analyst approves' }],
      },
      {
        id: 'block',
        label: 'Block sender + URL + hash',
        phase: 'response',
        detail:
          'Known-malicious IOCs are blocked across layers: sender at the gateway, URLs at proxy and DNS, hashes as EDR custom IOCs. A P2 ticket records the enriched context.',
        actions: ['Gateway sender block', 'Proxy URL + DNS sinkhole', 'EDR custom IOC for hashes'],
        tools: ['IOC Block Playbook'],
      },
      {
        id: 'hunt',
        label: 'Hunt all recipients org-wide',
        phase: 'intel',
        detail:
          'Hunt every recipient for clicks, downloads and follow-on execution. Look for lookalike senders and the same infrastructure in other campaigns.',
        actions: ['Proxy logs for URL clicks', 'Sysmon 1 / 11 on recipient hosts', 'Pivot on sending infrastructure'],
        evidence: ['Sysmon 1', 'Sysmon 11', 'Proxy logs'],
      },
      {
        id: 'purge',
        label: 'Purge from all mailboxes',
        phase: 'recovery',
        gate: true,
        detail:
          'After approval, bulk-purge matching messages from every mailbox through the Graph API and notify affected users with guidance.',
        actions: ['Bulk purge via Graph API', 'Notify affected users', 'Close with lessons learned'],
        next: [],
      },
    ],
  },
  {
    id: 'edr-alert',
    title: 'EDR Alert',
    route: 'EDR Alert → Triage → Contain → Forensics → Eradicate',
    icon: 'cpu',
    hue: 'teal',
    severity: 'critical',
    summary:
      'A behavioral EDR detection on a single host, worked through process-tree triage, isolation, memory-first forensics and lateral scope before reimage.',
    phases: ['detection', 'triage', 'response', 'recovery'],
    techniques: ['shellcode-loader-custom', 'process-injection', 'dll-sideloading', 'https-c2-beaconing'],
    steps: [
      {
        id: 'alert',
        label: 'EDR behavioral alert',
        phase: 'detection',
        detail:
          'Kernel callbacks, ETW-TI or behavioral analytics flag the host: an Office parent spawning PowerShell, unbacked executable memory, or a remote thread into another process.',
        actions: ['Acknowledge and assign', 'Pull the alert storyline / process tree'],
        evidence: ['Sysmon 8 (CreateRemoteThread)', 'Sysmon 10 (ProcessAccess)', 'ETW-TI'],
        tools: ['Microsoft Defender for Endpoint', 'CrowdStrike Falcon', 'SentinelOne Singularity'],
      },
      {
        id: 'tree',
        label: 'Process tree + memory check',
        phase: 'triage',
        detail:
          'Walk the full lineage and check for injected code. Confirm a true positive and decide severity before containment.',
        actions: ['Inspect parent-child chain and command lines', 'Scan process memory with YARA', 'Check network connections from the process'],
        evidence: ['Sysmon 1', 'Sysmon 3', 'Sysmon 7'],
        tools: ['Velociraptor', 'YARA'],
        next: [
          { to: 'isolate', label: 'True positive' },
          { to: 'tune', label: 'False positive' },
        ],
      },
      {
        id: 'tune',
        label: 'Tune rule + close',
        phase: 'detection',
        detail:
          'Log the false positive with source, rule ID and suppression. Filter on hash + path + parent, never on process name alone.',
        actions: ['Record in FP tracking system', 'Add a narrow filter condition'],
        next: [],
      },
      {
        id: 'isolate',
        label: 'Network isolate endpoint',
        phase: 'response',
        gate: true,
        detail:
          'Isolate through the EDR console so the host keeps its management channel. Do not reboot: the in-memory implant is your best evidence.',
        actions: ['EDR network isolation', 'Disable the logged-on account if credential access is suspected'],
        pitfall: 'Rebooting or powering off destroys volatile evidence including in-memory C2.',
      },
      {
        id: 'forensics',
        label: 'Memory + disk forensics',
        phase: 'triage',
        detail:
          'Capture memory first, hash it, then collect disk artifacts. malfind finds injected code; Prefetch, ShimCache and AmCache prove execution even after deletion.',
        actions: ['winpmem capture + SHA256', 'Volatility 3: pstree, netscan, malfind', 'KAPE triage collection'],
        evidence: ['Prefetch', 'AmCache.hve', 'ShimCache', '$MFT'],
        tools: ['winpmem / LiME', 'Volatility 3', 'Eric Zimmerman Tools'],
      },
      {
        id: 'scope',
        label: 'Scope lateral movement',
        phase: 'intel',
        detail:
          'First compromised host is not the only one. Hunt for the same IOCs, named pipes, service installs and logons from the affected account across the fleet.',
        actions: ['Fleet hunt on hashes, pipes and C2 domains', 'Review 4624 Type 3 and 7045 from the host'],
        evidence: ['Event 4624', 'Event 7045', 'Sysmon 17/18'],
        tools: ['Velociraptor', 'RITA'],
      },
      {
        id: 'reimage',
        label: 'Reimage + rules updated',
        phase: 'recovery',
        detail:
          'For a capable attacker, reimage beats cleaning. Reset exposed credentials, monitor the rebuilt host closely, and turn the investigation into a new detection.',
        actions: ['Reimage from golden image', 'Rotate exposed credentials', 'Ship a new detection rule'],
      },
    ],
  },
  {
    id: 'credential-compromise',
    title: 'Credential Compromise',
    route: 'Credential Compromise → Lock → Scope → Reset All',
    icon: 'key',
    hue: 'mauve',
    severity: 'critical',
    summary:
      'An identity alert such as impossible travel or a high-risk sign-in, worked through session kill, OAuth and authenticator audit, and full credential re-issue.',
    phases: ['detection', 'response', 'hardening', 'recovery'],
    techniques: ['lsass-credential-dump', 'pass-the-hash', 'cloud-token-theft-device-code'],
    steps: [
      {
        id: 'alert',
        label: 'Impossible travel alert',
        phase: 'detection',
        detail:
          'Entra ID Protection, UEBA or the SIEM flags impossible travel, a high-risk sign-in, MFA push spam or anomalous Graph activity.',
        actions: ['Enrich: manager, department, 30-day logins, MFA methods', 'Check source IPs against threat intel'],
        evidence: ['Entra sign-in logs', 'Risk detections'],
        tools: ['Microsoft Entra ID Protection', 'Microsoft Sentinel'],
      },
      {
        id: 'disable',
        label: 'Disable + kill all sessions',
        phase: 'response',
        gate: true,
        detail:
          'After analyst confirmation, disable the account and revoke every session. A password reset alone does not revoke refresh tokens in Entra ID.',
        actions: ['Disable in AD and Entra', 'Revoke-MgUserSignInSession', 'Remove mailbox forwarding rules'],
        pitfall: 'Resetting the password without revoking sessions leaves the attacker logged in.',
      },
      {
        id: 'enumerate',
        label: 'Enumerate access + OAuth apps',
        phase: 'triage',
        detail:
          'Map everything the account touched during the compromise window, and every consent grant or app the attacker may have added for persistence.',
        actions: ['Unified Audit Log review for the window', 'Get-MgOauth2PermissionGrant', 'List hosts where the account authenticated (7 days)'],
        evidence: ['Unified Audit Log', 'Graph Activity Logs', 'Event 4624'],
      },
      {
        id: 'revoke',
        label: 'Revoke all tokens + passkeys',
        phase: 'response',
        detail:
          'Remove attacker-registered authenticators (FIDO2 keys, authenticator apps) and attacker-granted consents. Delegated permissions survive credential resets.',
        actions: ['Audit and remove new authentication methods', 'Remove malicious consent grants'],
      },
      {
        id: 'reissue',
        label: 'New creds + re-enroll MFA',
        phase: 'recovery',
        detail:
          'Issue new credentials, re-enroll phishing-resistant MFA, and close the Conditional Access gap the attacker used.',
        actions: ['New password + FIDO2 enrollment', 'Close the exploited CAP exclusion', 'Enhanced monitoring on the account'],
        tools: ['Conditional Access', 'FIDO2 / Passkeys'],
      },
    ],
  },
  {
    id: 'ransomware',
    title: 'Ransomware',
    route: 'Ransomware → Emergency Segment → Scope → BC/DR → Rebuild',
    icon: 'flame',
    hue: 'ember',
    severity: 'critical',
    summary:
      'Mass encryption in progress. Segment (do not shut down), find patient zero, validate backups before trusting them, and rebuild into an environment with the root cause fixed.',
    phases: ['detection', 'response', 'triage', 'recovery'],
    techniques: ['ransomware-encryption', 'byovd-vulnerable-driver'],
    steps: [
      {
        id: 'alert',
        label: 'Mass file rename alert',
        phase: 'detection',
        detail:
          'Controlled Folder Access, canary files or a mass rename pattern fires. Treat as an emergency and open the BC/DR bridge.',
        actions: ['Declare a major incident', 'Notify the cyber insurer within the policy window'],
        evidence: ['Sysmon 11 (FileCreate)', 'Sysmon 23 (FileDelete)', 'Controlled Folder Access'],
      },
      {
        id: 'segment',
        label: 'Emergency network segment',
        phase: 'response',
        gate: true,
        detail:
          'Segment the network to stop spread while preserving evidence. A full shutdown destroys forensic data and can make encryption worse.',
        actions: ['Cut east-west SMB', 'Isolate affected VLANs', 'Protect backup infrastructure first'],
        pitfall: 'Pulling power on everything destroys memory evidence and can corrupt partially encrypted data.',
      },
      {
        id: 'scope',
        label: 'Patient zero + spread scope',
        phase: 'triage',
        detail:
          'Identify the strain (some have free decryptors) and trace initial access, usually phishing or exposed RDP. Look 2–6 weeks back for staging and exfil: double extortion means restore does not stop the leak.',
        actions: ['Identify the strain at nomoreransom.org', 'Trace initial access', 'Scope pre-encryption exfil'],
        evidence: ['VPN / RDP logs', 'Proxy upload volume', 'Event 4624 Type 10'],
      },
      {
        id: 'backups',
        label: 'Validate backups integrity',
        phase: 'recovery',
        detail:
          'Test backup integrity immediately. Ransomware crews target Veeam and backup agents first; contaminated backups prolong recovery.',
        actions: ['Test restore from immutable copies', 'Verify backup credentials were not exposed'],
        next: [
          { to: 'bcdr', label: 'Backups clean' },
          { to: 'legal', label: 'Backups compromised' },
        ],
      },
      {
        id: 'legal',
        label: 'Legal + payment review',
        phase: 'response',
        gate: true,
        detail:
          'Do not pay without legal review: OFAC sanctions apply to some groups and payment may be illegal. Coordinate with the insurer and counsel.',
        actions: ['Engage counsel and insurer', 'OFAC sanctions check'],
        next: [{ to: 'bcdr' }],
      },
      {
        id: 'bcdr',
        label: 'Activate BC/DR plan',
        phase: 'recovery',
        detail: 'Run the business continuity plan against documented RTO/RPO per system tier.',
        actions: ['Restore Tier 0 first: DCs, CA, backup servers', 'Communicate realistic timelines to executives'],
      },
      {
        id: 'restore',
        label: 'Restore from clean backups',
        phase: 'recovery',
        detail:
          'Rebuild from known-clean backups into an environment where the initial access path is closed, or the same actor walks straight back in.',
        actions: ['Fix the root cause before reconnecting', 'Rotate all credentials including krbtgt twice', 'Enhanced monitoring for secondary persistence'],
      },
    ],
  },
  {
    id: 'dcsync',
    title: 'DCSync',
    route: 'DCSync Alert → Verify → Lock Account → AD Reset',
    icon: 'git',
    hue: 'gold',
    severity: 'critical',
    summary:
      'Directory replication requested from a non-DC source. Assume every hash in the domain, and the DPAPI backup key, is exposed.',
    phases: ['detection', 'triage', 'response', 'recovery'],
    techniques: ['dcsync', 'golden-ticket'],
    steps: [
      {
        id: 'alert',
        label: 'Event 4662 DRS replication',
        phase: 'detection',
        detail:
          'Event 4662 with DS-Replication-Get-Changes rights on the domain object from a source that is not a domain controller.',
        actions: ['Pull the source IP, account and GUIDs'],
        evidence: ['Event 4662', 'Zeek dce_rpc / DRSUAPI'],
      },
      {
        id: 'verify',
        label: 'Confirm source is not a DC',
        phase: 'triage',
        detail: 'Rule out legitimate replication (new DC, Azure AD Connect). Anything else is credential theft at domain scale.',
        actions: ['Compare source to the DC list and AAD Connect servers'],
        next: [
          { to: 'disable', label: 'Not a DC' },
          { to: 'benign', label: 'Legitimate DC / sync' },
        ],
      },
      {
        id: 'benign',
        label: 'Document + allow-list',
        phase: 'detection',
        detail: 'Record the legitimate replication source so the rule stays precise.',
        actions: ['Add the source to a reviewed allow-list'],
        next: [],
      },
      {
        id: 'disable',
        label: 'Disable compromised account',
        phase: 'response',
        gate: true,
        detail: 'Disable the account that performed replication and isolate the source host.',
        actions: ['Disable the account', 'Isolate the source host', 'Snapshot AD for BloodHound'],
      },
      {
        id: 'audit',
        label: 'Audit DCSync-capable accounts',
        phase: 'hardening',
        detail:
          'Find every principal with replication rights and map attack paths from compromised accounts with BloodHound before resetting anything.',
        actions: ['Enumerate replication ACLs', 'BloodHound CE path analysis', 'Review recent trust changes'],
        tools: ['BloodHound CE / Adalanche', 'PingCastle / Purple Knight'],
      },
      {
        id: 'reset',
        label: 'krbtgt ×2 + all DA creds',
        phase: 'recovery',
        detail:
          'Rotate krbtgt twice with at least 10 hours between rotations, then Domain Admins, Enterprise Admins, built-in Administrator and service accounts in that order.',
        actions: ['krbtgt rotation ×2 (≥10h apart)', 'DA → EA → Administrator → service accounts', 'Treat DPAPI backup key as compromised'],
        pitfall: 'A single krbtgt rotation does not invalidate all outstanding golden tickets.',
      },
    ],
  },
  {
    id: 'cloud-token-theft',
    title: 'Cloud Token Theft',
    route: 'Cloud Token Theft → Revoke → CAP Fix → App Audit',
    icon: 'cloud',
    hue: 'slate',
    severity: 'critical',
    summary:
      'Stolen refresh or access tokens (AitM phishing, device code abuse) used against Microsoft Graph. Tokens outlive passwords, so revoke first and audit apps second.',
    phases: ['detection', 'response', 'hardening', 'visibility'],
    techniques: ['cloud-token-theft-device-code'],
    steps: [
      {
        id: 'alert',
        label: 'Anomalous Graph API access',
        phase: 'detection',
        detail: 'Graph calls from an unfamiliar IP, ASN or user agent; sign-in risk with token replay; device code flow from an unexpected location.',
        actions: ['Correlate sign-in IP with Graph Activity Logs'],
        evidence: ['MicrosoftGraphActivityLogs', 'Entra sign-in logs'],
        tools: ['Microsoft Sentinel', 'Defender for Cloud Apps'],
      },
      {
        id: 'revoke',
        label: 'Revoke all user tokens',
        phase: 'response',
        gate: true,
        detail: 'Revoke every refresh token and session for the user. A password reset alone does not invalidate tokens.',
        actions: ['Revoke-MgUserSignInSession', 'Require re-registration of MFA'],
      },
      {
        id: 'apps',
        label: 'Audit app registrations + consent',
        phase: 'triage',
        detail: 'Attackers register backdoor apps with mail.read or files.readwrite that survive resets. Review every grant since the compromise window.',
        actions: ['List app registrations and service principals', 'Remove attacker consent grants'],
      },
      {
        id: 'cap',
        label: 'Tighten Conditional Access',
        phase: 'hardening',
        detail: 'Close the gap the attacker used: require phishing-resistant MFA, compliant devices, and block device code flow where it is not needed.',
        actions: ['Authentication Strength policy for admins', 'Block device code flow', 'Review exclusions'],
      },
      {
        id: 'logging',
        label: 'Enhanced Graph audit logging',
        phase: 'visibility',
        detail: 'Graph Activity Logs are not on by default. Enable them and keep UAL retention long enough for the next investigation.',
        actions: ['Enable MicrosoftGraphActivityLogs diagnostic setting', 'Alert on new sensitive consent grants'],
      },
    ],
  },
  {
    id: 'adcs-esc',
    title: 'ADCS Exploitation',
    route: 'ADCS ESC Exploitation → Revoke → Fix Templates → Audit',
    icon: 'certificate',
    hue: 'gold',
    severity: 'critical',
    summary:
      'A certificate was issued with a privileged SAN or a template was modified. Certificates outlive password resets: revoke, fix the template, then scan everything.',
    phases: ['detection', 'response', 'hardening', 'visibility'],
    techniques: ['adcs-esc1-exploitation'],
    steps: [
      {
        id: 'alert',
        label: 'Certificate misuse detected',
        phase: 'detection',
        detail: 'Event 4887 with a SAN containing a privileged UPN, 4899 template modification, or PKINIT logons as a Domain Admin from an odd host.',
        actions: ['Identify the requester, template and SAN'],
        evidence: ['Event 4886', 'Event 4887', 'Event 4899'],
      },
      {
        id: 'revoke',
        label: 'Revoke issued certs',
        phase: 'response',
        gate: true,
        detail: 'Revoke every certificate issued from the abused template in the window and publish the CRL.',
        actions: ['Revoke certificates', 'Publish CRL', 'Disable the requester account'],
        pitfall: 'Resetting the impersonated account password does not invalidate a forged certificate.',
      },
      {
        id: 'fix',
        label: 'Fix vulnerable template perms',
        phase: 'hardening',
        detail: 'Remove ENROLLEE_SUPPLIES_SUBJECT (ESC1), template write rights for non-admins (ESC4), and EDITF_ATTRIBUTESUBJECTALTNAME2 on the CA (ESC6).',
        actions: ['ESC1: remove enrollee-supplied subject', 'ESC4: remove write ACLs', 'ESC6: clear the CA flag'],
      },
      {
        id: 'scan',
        label: 'Locksmith scan all templates',
        phase: 'hardening',
        detail: 'Run Locksmith across the environment to find ESC1–ESC8 everywhere, not just the template that was abused.',
        actions: ['Locksmith full scan', 'Schedule quarterly re-scan'],
        tools: ['Locksmith'],
      },
      {
        id: 'logging',
        label: 'ADCS audit logging enabled',
        phase: 'visibility',
        detail: 'CA audit events are off by default. Enable 4886, 4887 and 4899 on every CA and treat CA servers as Tier 0.',
        actions: ['Enable CA auditing per CA', 'Alert on privileged-UPN SANs and off-hours issuance'],
      },
    ],
  },
  {
    id: 'data-exfil',
    title: 'Data Exfiltration',
    route: 'Data Exfil Alert → Kill Channel → DLP Review → Scope',
    icon: 'upload',
    hue: 'rose',
    severity: 'high',
    summary:
      'Large DNS or HTTPS transfers to an unusual destination. Kill the channel, establish what data left, and bring in legal early for notification duties.',
    phases: ['detection', 'response', 'triage', 'recovery'],
    techniques: ['dns-exfiltration', 'https-c2-beaconing'],
    steps: [
      {
        id: 'alert',
        label: 'Large DNS/HTTPS transfer alert',
        phase: 'detection',
        detail: 'Long subdomains, high-entropy labels, TXT-heavy queries, or large uploads to a newly registered domain.',
        actions: ['Identify source host, process and destination'],
        evidence: ['Sysmon 22', 'Zeek dns.log', 'Proxy upload volume'],
        tools: ['Zeek (Bro)', 'RITA'],
      },
      {
        id: 'block',
        label: 'Block endpoint + egress path',
        phase: 'response',
        gate: true,
        detail: 'Sinkhole the domain, block the destination at proxy and firewall, and isolate the source host.',
        actions: ['DNS sinkhole via RPZ', 'Proxy + firewall block', 'EDR isolate'],
      },
      {
        id: 'dlp',
        label: 'Review DLP logs + proxy',
        phase: 'triage',
        detail: 'Reconstruct what was staged and sent: DLP hits, archive creation, cloud storage uploads and proxy byte counts.',
        actions: ['DLP incident review', 'Look for archive staging (7z, rar) before transfer'],
      },
      {
        id: 'data',
        label: 'Determine data touched',
        phase: 'triage',
        detail: 'Map the data sets accessed and their classification. This drives the notification decision.',
        actions: ['File access audit', 'Classify exposed data'],
      },
      {
        id: 'legal',
        label: 'Legal / breach notification',
        phase: 'recovery',
        gate: true,
        detail: 'Counsel decides on regulatory and customer notification within statutory windows.',
        actions: ['Engage counsel', 'Prepare notification timeline'],
      },
    ],
  },
];

/**
 * Null prototype, so ids that come from a URL or an imported file, such as "constructor"
 * or "toString", find nothing instead of an inherited Object method.
 */
export const flowChainById: Record<string, FlowChain> = Object.assign(
  Object.create(null),
  Object.fromEntries(flowChains.map((c) => [c.id, c])),
);

/** Chains that pass through a given phase. */
export function chainsForPhase(phaseId: string): FlowChain[] {
  return flowChains.filter((c) => c.phases.includes(phaseId as FlowChain['phases'][number]));
}
