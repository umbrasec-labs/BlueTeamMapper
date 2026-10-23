import { findEvent } from '@/data';

/** Turn evidence strings like "Sysmon 10 (ProcessAccess)" or "Event 4662" into event links. */
export function evidenceLink(text: string): string | null {
  const sysmon = text.match(/^Sysmon (\d+)/);
  if (sysmon && findEvent('sysmon', Number(sysmon[1]))) return `/events?focus=sysmon-${sysmon[1]}`;
  const sec = text.match(/^Event (\d{4})/);
  if (sec && findEvent('security', Number(sec[1]))) return `/events?focus=security-${sec[1]}`;
  return null;
}
