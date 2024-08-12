import * as moment from 'moment-timezone';
export interface Manifest {
    id: string;
    title: string;
    type: string;
    style?: any;
    canskip?: boolean;
    repeat_cycle: number;
    start_alignment?: string;
    start_date: string;
    notifications: {
        relative_to_due_date: number[];
        relative_to_start_date: number[];
        template: string;
    };
    from?: any;
    certType: string;
    include_in_certificate: string[];
    courses: Course[];
    attemptId: string;
    orgStartDate: Date;
    learnerStartDate: Date;
    user: Learner;
    compliantUntil: moment.Moment;
    allCoursesCompleted: boolean;
    anyCourseCompleted: boolean;
    currentCycle: number;
    orgTimeZone: string;
    lang?: string;
}
export interface ExpandedManifest extends Manifest {
    mailTemplate: string;
    complianceStatus: string;
    currentCourses: Course[];
    futureCourses: Course[];
    pastCourses: Course[];
    testParams: TestParams;
    firstAttemptDate: moment.Moment;
    lastCompliantUntil: moment.Moment;
    lastCompletionDate: moment.Moment;
    compliant: {
        from: any;
        to: any;
        courses: Course[];
        date: any;
    };
}
export interface MocLaunchData {
    attemptId: string;
    userId: string;
    lmsUserId: string;
    userName: string;
    userEmail: string;
    validationCode: string;
    emailNotifications: number;
    resourceLinkId: string;
    instanceId: string;
    contextId: string;
    lisResultSourceId: string;
    oauthKey: string;
    oauthSecret: string;
    lisOutcomeServiceUrl: string;
    manifestId: string;
    toolConsumerInfoProductFamilyCode: string;
    orgId: string;
    orgName: string;
    orgTimeZone: string;
    institutionId: string;
    institutionName: string;
    licenseKey: string;
    toolConsumerInstanceGuid: string;
    roles: string;
    compliantUntil: moment.Moment;
    learnerStartDate: Date;
    orgStartDate: Date;
}
export interface MocProgress {
    attemptId: string;
    courseId: string;
    startDate: moment.Moment;
    dueDate: moment.Moment;
    startedDate: moment.Moment;
    completedDate: moment.Moment;
    modifiedDate: string;
}
export interface Course {
    id: string;
    title: string;
    launch: any;
    start_dates: number[];
    due_period: number;
    depends_on: string[];
    allCourseMapIndex?: number;
    progress?: MocProgress;
    canLaunch?: boolean;
    dueDate?: moment.Moment;
    startDate?: moment.Moment;
    status?: string;
    dueDaysLeft?: number;
    instanceStartPeriod: number;
    locked: boolean;
    instance?: number;
}
export interface TestParams {
    test_today_date?: moment.Moment;
    test_manifest?: string;
    test_lang?: string;
    error?: string;
}
export declare enum EmailPref {
    NONE = 0,
    ONSTART = 1,
    BEFOREDUE = 2,
    PASTDUE = 4,
    ALL = 7,
}
export interface Learner {
    id: string;
    name: string;
    fullName: string;
    email: string;
    emailValidated: boolean;
    orgId: string;
    orgName: string;
    orgTimeZone: string;
    institutionId: string;
    institutionName: string;
    emailPref: EmailPreferences;
}
export interface EmailPreferences {
    onStart: number;
    beforeDue: number;
    pastDue: number;
}
export interface IStartEndDates {
    startDate: moment.Moment;
    dueDate: moment.Moment;
    dueDaysLeft: number;
    cycle: number;
}
export declare class CurriculumScheduler {
    private db;
    private testParams;
    private attemptId;
    private courseCollection;
    private progress;
    private mocLaunchDataIsSet;
    private manifest;
    private manifestUrl;
    private isTestTodayDateValid;
    private lang;
    private nextCompliantUntilFound;
    constructor(db: any, attemptId: string, manifest: Manifest | string, lang: string, testParams?: TestParams);
    prepareTestParams(orgTimeZone?: string): void;
    setManifest(done: (err) => void): void;
    setProgress(progress: MocProgress[]): void;
    initmanifest(): void;
    getFirstAttemptDate(): void;
    setMocLaunchData(data: MocLaunchData): void;
    getMocLaunchData(done: (err, data) => void): void;
    schedule(done: (err: any, manifest: ExpandedManifest) => void): void;
    populateCourseInstances(newCycle?: boolean): void;
    calculateComplianceStatus(): void;
    calculateMocStartEndDates(courseStartDate: number, courseDuePeriod: number, firstAttemptDate: Date): IStartEndDates[];
}
export declare function formatDate(date: any, timezone?: string): moment.Moment;
export declare function getTime(date?: string | Date): number;
export declare function isValidTestTodayDate(date: string | moment.Moment): {
    isValid: boolean;
    message?: string;
};
