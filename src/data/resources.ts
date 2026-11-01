export type Region = 'US' | 'UK' | 'Canada' | 'China' | 'Elsewhere';
export interface Resource { label:string; description:string; url?:string; sourceUrl:string; lastChecked:'2026-11-01' }
const checked='2026-11-01' as const;
export const resources:Record<Region, Resource[]> = {
  US: [
    {label:'Forward unwanted texts to 7726',description:'Use your phone’s text forwarding feature.',sourceUrl:'https://consumer.ftc.gov/articles/how-recognize-and-report-spam-text-messages',lastChecked:checked},
    {label:'ReportFraud.ftc.gov',description:'Report scams to the Federal Trade Commission.',url:'https://reportfraud.ftc.gov/',sourceUrl:'https://consumer.ftc.gov/articles/how-recognize-and-report-spam-text-messages',lastChecked:checked},
    {label:'IdentityTheft.gov',description:'Get a plan if your identity was stolen.',url:'https://www.identitytheft.gov/',sourceUrl:'https://www.identitytheft.gov/',lastChecked:checked},
    {label:'ic3.gov',description:'Report online crime to the FBI.',url:'https://www.ic3.gov/',sourceUrl:'https://www.ic3.gov/',lastChecked:checked},
  ],
  UK: [
    {label:'report@phishing.gov.uk',description:'Forward suspicious emails. Forward suspicious texts to 7726.',sourceUrl:'https://www.gov.uk/report-suspicious-emails-websites-phishing',lastChecked:checked},
    {label:'Report Fraud — reportfraud.police.uk',description:'Lost money or been hacked? In England, Wales and Northern Ireland: report online or call 0300 123 2040.',url:'https://reportfraud.police.uk/',sourceUrl:'https://www.ncsc.gov.uk/collection/phishing-scams/report-scam-email',lastChecked:checked},
    {label:'Police Scotland: 101',description:'In Scotland, report fraud to Police Scotland.',sourceUrl:'https://www.ncsc.gov.uk/collection/phishing-scams/report-scam-email',lastChecked:checked},
    {label:'159 — reach your bank',description:'After an unexpected financial call, hang up and use 159 to reach participating banks. If unavailable, use the number on your card.',sourceUrl:'https://stopscamsuk.org.uk/159',lastChecked:checked},
  ],
  Canada: [
    {label:'Report Cybercrime and Fraud',description:'reportcyberandfraud.canada.ca or 1-888-495-8501, Monday–Friday, 10:00–16:45 ET.',url:'https://reportcyberandfraud.canada.ca/',sourceUrl:'https://antifraudcentre-centreantifraude.ca/report-signalez-eng.htm',lastChecked:checked},
  ],
  China: [
    {label:'96110 — anti-fraud line',description:'For anti-fraud advice. Call 110 in an emergency.',sourceUrl:'https://www.hnwx.gov.cn/2026/06-16/77025.html',lastChecked:checked},
    {label:'国家反诈中心 — National Anti-Fraud Center app',description:'Find the official app in your device’s app store. Do not install a copy sent in a message.',sourceUrl:'https://gat.fujian.gov.cn/ztzl/fjjffpzxrx/yjxx/202309/t20230913_6255881.htm',lastChecked:checked},
  ],
  Elsewhere: [
    {label:'Your bank and local police',description:'Call your bank using the number on your card, and contact your local police.',sourceUrl:'https://consumer.ftc.gov/articles/what-do-if-you-were-scammed',lastChecked:checked},
  ],
};
