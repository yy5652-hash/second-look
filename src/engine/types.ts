export interface Span {
  start: number;
  end: number;
}
export interface Finding {
  id: string;
  title: string;
  explanation: string;
  weight: number;
  spans: Span[];
}
export interface Link {
  raw: string;
  host: string;
  domain: string;
  span: Span;
  flags: { id: string; title: string; explanation: string; weight: number }[];
}
export type Level = 'stop' | 'caution' | 'none' | 'unsupported' | 'too_short';
export interface Analysis {
  level: Level;
  summary: string;
  scenario: { name: string; nextStep: string };
  findings: Finding[];
  links: Link[];
  notes: string[];
}
