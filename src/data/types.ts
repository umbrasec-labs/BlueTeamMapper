/**
 * Content model for the Blue Team Mapper.
 *
 * Everything the UI renders comes from these shapes. Adding a phase, layer, chain,
 * tool, technique or event means editing the data modules in this folder; components
 * read the collections generically and never hard-code content.
 */

/** Named keys into the shared icon registry (src/lib/icons.ts). */
export type IconKey =
  | 'eye'
  | 'target'
  | 'search'
  | 'zap'
  | 'shield'
  | 'microscope'
  | 'refresh'
  | 'database'
  | 'cpu'
  | 'radar'
  | 'siren'
  | 'crosshair'
  | 'fingerprint'
  | 'cloud'
  | 'network'
  | 'brain'
  | 'ghost'
  | 'bug'
  | 'mail'
  | 'key'
  | 'lock'
  | 'flame'
  | 'certificate'
  | 'upload'
  | 'git'
  | 'bot'
  | 'wrench'
  | 'layers'
  | 'workflow'
  | 'table'
  | 'list';

/** The eight-hue coding set. Each maps to a Tailwind color in tailwind.config.js. */
export type Hue = 'ember' | 'gold' | 'khaki' | 'sage' | 'teal' | 'slate' | 'mauve' | 'rose';

export type Severity = 'critical' | 'high' | 'medium' | 'low';

export type PhaseId =
  | 'visibility'
  | 'detection'
  | 'triage'
  | 'response'
  | 'hardening'
  | 'intel'
  | 'recovery';

/* ------------------------------------------------------------------ */
/* Legacy section content (extracted from the v3 page)                 */
/* ------------------------------------------------------------------ */

export interface CardItem {
  /** Bold lead-in, e.g. "Risk-Based Alerting (RBA)". */
  lead: string;
  /** Body text. Inline code is wrapped in `backticks`. */
  text: string;
  note?: string;
}

export interface SectionCard {
  tag: string;
  title: string;
  summary: string;
  items: CardItem[];
}

export type MatrixTone = 'good' | 'warn' | 'bad';

export interface MatrixRow {
  label: string;
  value: string;
  tone?: MatrixTone;
}

export interface MatrixGroup {
  heading: string;
  note: string | null;
  rows: MatrixRow[];
}

/** A tree-style reference block (log source tiers, EDR layers, IR lifecycle...). */
export interface Matrix {
  title: string;
  groups: MatrixGroup[];
}

export type CalloutTone = 'warn' | 'success' | 'info' | 'danger';

export interface Callout {
  tone: CalloutTone;
  title: string;
  body: string;
}

export interface HuntQuery {
  title: string;
  language: 'spl' | 'kql' | 'eql';
  code: string;
}

export interface Section {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  callouts: Callout[];
  matrices: Matrix[];
  queries: HuntQuery[];
  cards: SectionCard[];
}

/* ------------------------------------------------------------------ */
/* Lifecycle, layers, chains                                           */
/* ------------------------------------------------------------------ */

export interface Phase {
  id: PhaseId;
  order: number;
  label: string;
  /** Very short label used on the ring. */
  short: string;
  icon: IconKey;
  hue: Hue;
  tagline: string;
  description: string;
  /** Capability keywords shown on the ring, from the v3 lifecycle bar. */
  capabilities: string[];
  objectives: string[];
  keyTools: string[];
  /** Metrics a SOC uses to know this phase is healthy. */
  measures: string[];
  layers: string[];
  sections: string[];
}

/** A directed relationship between phases drawn on the radial map. */
export interface PhaseLink {
  from: PhaseId;
  to: PhaseId;
  label: string;
  kind: 'flow' | 'feedback';
}

export type ControlPriority = 'P0' | 'P1' | 'P2';

export interface KeyControl {
  label: string;
  priority: ControlPriority;
}

export interface Layer {
  id: string;
  label: string;
  icon: IconKey;
  hue: Hue;
  tagline: string;
  phases: PhaseId[];
  /** Legacy section ids whose content this layer renders. */
  sections: string[];
  /** Tool arsenal categories that belong to this layer. */
  toolCategories: string[];
  keyControls: KeyControl[];
}

export interface FlowStep {
  id: string;
  label: string;
  phase: PhaseId;
  detail: string;
  actions: string[];
  /** Evidence or telemetry to look at, e.g. "Sysmon 10", "Event 4662". */
  evidence?: string[];
  tools?: string[];
  /** The mistake people make at this step. */
  pitfall?: string;
  /** Explicit successors. Defaults to the next step in the array. */
  next?: { to: string; label?: string }[];
  /** Marks a human approval gate. */
  gate?: boolean;
  /** This step can start one linked run of another chain per subject (v1: per host). */
  spawns?: {
    chainId: string;
    per: 'host';
    label: string;
    /** Index into the step's `actions` that starting linked runs ticks. */
    action: number;
  };
}

export interface FlowChain {
  id: string;
  title: string;
  /** The v3 chain label, e.g. "Phishing → Detection → Block → Hunt". */
  route: string;
  icon: IconKey;
  hue: Hue;
  severity: Severity;
  summary: string;
  phases: PhaseId[];
  techniques: string[];
  steps: FlowStep[];
}

/* ------------------------------------------------------------------ */
/* Reference collections                                               */
/* ------------------------------------------------------------------ */

export interface Tool {
  id: string;
  category: string;
  label: string;
  names: string[];
  description: string;
}

export interface ToolCategory {
  id: string;
  label: string;
  icon: IconKey;
  hue: Hue;
}

export type Tactic =
  | 'Initial Access'
  | 'Execution'
  | 'Persistence'
  | 'Privilege Escalation'
  | 'Stealth'
  | 'Defense Impairment'
  | 'Credential Access'
  | 'Lateral Movement'
  | 'Command and Control'
  | 'Exfiltration'
  | 'Impact';

export interface Technique {
  id: string;
  name: string;
  attackId: string;
  tactic: Tactic;
  detection: string;
  severity: Severity;
  response: string;
  events: number[];
  chain?: string;
}

export type EventSignal = 'good' | 'warn' | 'bad';

export interface EventRef {
  id: number;
  source: 'security' | 'sysmon';
  category: string;
  name: string;
  description: string;
  signal: EventSignal;
}
