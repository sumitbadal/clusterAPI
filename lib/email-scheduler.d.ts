import * as curriculumScheduler from './curriculum-scheduler';
export interface MocContentMapParams {
    manifestId: string;
    manifest: string;
    requestedMacros: string;
    requestedProgramCode: string;
    lang: string;
    courseType?: string;
    useLicenseAtStart?: boolean;
    licenseWizard?: boolean;
}
export interface MailLog {
    from: string;
    to: string;
    subject: string;
    mailBody: string;
}
export interface ScheduleResponseParams {
    errors: Object[];
    sentEmails: MailLog[];
    rejectedEmails: MailLog[];
}
export interface Email {
    [email: string]: {
        to: string;
        from: string;
        subject: string;
        mailTemplate?: string;
        params: {
            name: string;
            mocs: Object;
            lang?: string;
            setLocale?: any;
            gettext?: any;
        };
    };
}
export interface IManifestResult {
    base: string;
    manifest: curriculumScheduler.Manifest;
    manifestId?: string;
    error?: any;
    orgTimeZone?: string;
    lang?: string;
}
export declare class EmailScheduler {
    private db;
    private contentMap;
    private testParams;
    private mailTemplate;
    private attemptId;
    private fetchedEmailTemplates;
    private emails;
    private scheduleResponse;
    constructor(db: any, attemptId: string, contentMap: any, testParams: curriculumScheduler.TestParams);
    populateContentMap(manifestUrl: string): void;
    scheduleEmailForAttempt(done: (err, data) => void): void;
    scheduleAllEmails(done: (err: any, emails: Email) => void): void;
    calculateNewManifest(manifest: any, attempts: any, callback: (err: any) => void): void;
    calculateNotificationDays(attemptData: any, manifest: curriculumScheduler.ExpandedManifest, testParams: curriculumScheduler.TestParams): any;
}
