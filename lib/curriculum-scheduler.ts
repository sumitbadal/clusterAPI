import * as _ from 'underscore';
import * as moment from 'moment-timezone';
import * as datastore from './datastore';
import * as async from 'async';
import * as utils from './utils';

export interface Manifest {
    id: string;
    title: string;
    type: string;
    style?: any;
    canskip?: boolean;
    repeat_cycle: number;
    start_alignment?: string;
    start_date: string; // Question: this can also be a number?
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
    depends_on?: {
        assign_on_complete?: {
            operator?: string;
            manifest: string[];
        },
        compliant_until_dependent?: string;
    };
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
    compliantOffset: number;
    compliant: {
        from: any;
        to: any;
        courses: Course[];
        date: any;
    };
    providerAttemptId?: string;
    compliantUntilDependentDate?: moment.Moment;
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
    departmentId: string;
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
    launch: {
        lti_link: string;
        oauthKey: string;
        oauth_consumer_key: string; // correct LTI name
        oauthSecret: string;
        oauth_consumer_secret: string; // correct LTI name
        resource_link_id: "";
        context_id: "";
        tool_consumer_info_product_family_code: "moc_lti_launch";
        tool_consumer_instance_guid: "moc_lti_launch";
        launch_presentation_return_url: "";
        lis_outcome_service_url: "";
        lis_result_sourcedid: "";
        roles: "";
    };
    start_dates: number[];
    due_period: number;
    depends_on: string[];
    // parameters which are added during calculation
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
    lti_launch_info_extra: any;
}

export interface TestParams {
    test_today_date?: moment.Moment;
    test_manifest?: string;
    test_lang?: string;
    error?: string;
}

export enum EmailPref {
    NONE = 0x0000,
    ONSTART = 0x0001,
    BEFOREDUE = 0x0002,
    PASTDUE = 0x0004,
    ALL = 0x0007
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
    departmentId: string;
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

export class CurriculumScheduler {
    private db: any;
    private csUrl: string;
    private launchPresentationReturnUrl: string;
    private testParams: TestParams;
    private attemptId: string;
    private courseCollection: Course[]; // this holds the courses array defined in manifest
    private progress: MocProgress[];
    private mocLaunchDataIsSet: boolean;
    private manifest: ExpandedManifest; // new manifest that will contain the scheduled courses
    private manifestUrl: string;
    private isTestTodayDateValid: { isValid: boolean; message?: string; };
    private lang: string;
    private nextCompliantUntilFound: boolean; // this is the first due date of an incompleted course
    private returnFormat: string;
    //that is greater than current compliantUntil

    /**
     *
     * @param db Content service database config
     * @param attemptId attempt id
     * @param manifest manifest. This can be either url to the manifest or manifest object that is fetched from the url
     * @param lang this is course lang, comes from content map
     * @param testParams Testparams null or {test_today_date?: string, test_lang?: string, test_manifest?: string}
     */
    constructor(db: any, csUrl: string, launchPresentationReturnUrl: string, attemptId: string, manifest: Manifest | string, lang: string, testParams?: TestParams, returnFormat?: string) {
        this.db = db;
        if (typeof manifest === "string") {
            this.manifestUrl = manifest;
            this.manifest = _.extend({}, {});
        } else {
            this.manifest = _.extend({}, manifest);
        }
        this.attemptId = attemptId;
        this.testParams = testParams ? testParams : {};
        this.lang = lang;
        this.nextCompliantUntilFound = false;
        this.csUrl = csUrl;
        this.launchPresentationReturnUrl = launchPresentationReturnUrl;
        this.returnFormat = returnFormat ? returnFormat.toUpperCase() : null;
    }

    prepareTestParams(orgTimeZone?: string) {
        this.isTestTodayDateValid = isValidTestTodayDate(this.testParams.test_today_date);
        // restricting test_today_date to be in format YYYY-MM-DD
        // Assign today's date anyways if not test_today_date is available
        if (this.isTestTodayDateValid.isValid) {
            const testTodayDate = formatDate(this.testParams.test_today_date, orgTimeZone);
            this.testParams.test_today_date = testTodayDate;
        }
        if (this.testParams.test_lang) {
            this.testParams.test_lang = this.testParams.test_lang.split("_").join("-");
        }
    }
    // sets the manifest
    //
    setManifest(): Promise<void>;
    setManifest(done: (err) => void): void;
    setManifest(done?: (err) => void): Promise<void> | void {
        if (done) {
            this.setManifest().then(() => done(null), err => done(err));
            return;
        }
        if (!this.manifestUrl) return Promise.resolve();
        return new Promise((resolve, reject) => {
            utils.fetchManifest(this.manifestUrl, (err, manifest) => {
                this.manifest = _.extend(this.manifest, manifest);
                err ? reject(err) : resolve();
            });
        });
    }

    setProgress(progress: MocProgress[]) {
        this.progress = progress;
    }

    initmanifest() {
        this.manifest.attemptId = this.attemptId;
        // we empty this.manifest.courses so we can push new calculated courses in array
        this.courseCollection = this.manifest.courses.slice(0);
        // Prepare a new manifest to be displayed on MOC landing page
        this.getFirstAttemptDate();
        this.manifest.allCoursesCompleted = true;
        this.manifest.currentCycle = 1;
        this.manifest.courses = [];
        // this will hold the new calculated compliantUntil date
        // this will be the closet greater due date than current compliantUntil
        // where course is not completed assign compliant until & last compliant until to 1970-01-01
        // if no compliant until
        if (!this.manifest.compliantUntil) {
            this.manifest.compliantUntil = formatDate("1970-01-01", this.manifest.orgTimeZone);
        } else {
            this.manifest.compliantUntil = formatDate(this.manifest.compliantUntil,
                this.manifest.orgTimeZone);
        }
        this.manifest.lastCompliantUntil = this.manifest.compliantUntil;
        this.manifest.lang = this.lang;
        this.prepareTestParams(this.manifest.orgTimeZone);
    }

    getFirstAttemptDate() {
        if (this.manifest.start_date === "learner") {
            this.manifest.firstAttemptDate = formatDate(this.manifest.learnerStartDate,
                this.manifest.orgTimeZone);
        } else if (this.manifest.start_date === "organization") {
            this.manifest.firstAttemptDate = formatDate(this.manifest.orgStartDate,
                this.manifest.orgTimeZone);
        } else if (this.manifest.start_date === "institution") {
            // to-do
        } else if (!isNaN(parseInt(this.manifest.start_date)) &&
            parseInt(this.manifest.start_date) >= 0 && parseInt(this.manifest.start_date) <= 11) {
            // to-do
        } else {
            throw ("Wrong configuration value of `start_date` in the manifest");
        }
    }
    setMocLaunchData(data: MocLaunchData) {
        const userFullName = data.userName;
        const username = utils.formatLearnerName(data.userName);
        this.manifest.user = {
            id: data.userId,
            name: username,
            fullName: userFullName,
            email: data.userEmail,
            emailValidated: data.validationCode === null,
            orgId: data.orgId,
            orgName: data.orgName,
            orgTimeZone: data.orgTimeZone,
            institutionId: data.institutionId,
            institutionName: data.institutionName,
            departmentId: data.departmentId,
            emailPref: {
                onStart: data.emailNotifications & EmailPref.ONSTART,
                beforeDue: data.emailNotifications & EmailPref.BEFOREDUE,
                pastDue: data.emailNotifications & EmailPref.PASTDUE
            }
        };
        this.manifest.compliantUntil = data.compliantUntil;
        this.manifest.orgTimeZone = data.orgTimeZone;
        this.manifest.orgStartDate = data.orgStartDate;
        this.manifest.learnerStartDate = data.learnerStartDate;
    }


    getMocLaunchData(done: (err, data) => void): void;
    getMocLaunchData(): Promise<any>;
    getMocLaunchData(done?: (err, data) => void): Promise<any> | void {
        if (done) {
            datastore.getMocLaunchData(this.db, this.attemptId, (err, data: MocLaunchData) => {
                done(err, data[0]);
            });
            return;
        }
        return new Promise((resolve, reject) => {
            this.getMocLaunchData((err, data) => {
                if (err) return reject(err);
                return resolve(data);
            });
        });
    }
    schedule(done: (err: any, manifest: ExpandedManifest) => void): void;
    schedule(): Promise<ExpandedManifest>;
    schedule(done?: (err: any, manifest: ExpandedManifest) => void): Promise<ExpandedManifest> | void {
        if (done) {
            this.schedule().then(result => done(null, this.manifest), err => done(err, this.manifest));
            return;
        }
        return (async () => {
            if (!this.mocLaunchDataIsSet) {
                const data = await this.getMocLaunchData();
                if (!data) throw new Error("Attempt not found, the user did not start the course");
                this.setMocLaunchData(data);
                await this.setManifest();
                this.initmanifest();
                if (!this.isTestTodayDateValid.isValid) {
                    throw new Error(this.isTestTodayDateValid.message);
                }
            }
            if (!this.progress) {
                const progressData = await datastore.getMocProgress(this.db, this.manifest.attemptId)
                this.setProgress(progressData)
            }
            // loop through the courses in MOC curriculum
            this.populateCourseInstances();
            this.calculateComplianceStatus();

            // When all courses are processed return the new manifest
            // remove courseInstance that are historic and were added after any manifest change
            // We assume courses added by manfest changes are
            // those that do not have progress and have due date less than current compliant until
            // We leave the future courses
            this.manifest.courses = _.compact(
                _.map(this.manifest.courses, (courseInstance: Course, key, list: Course[]) => {
                    if (!courseInstance.progress &&
                        this.manifest.compliantUntil.isAfter(courseInstance.dueDate)) {
                        return undefined;
                    } else {
                        // If we have previous courses that are over due
                        // We do not let users to launch any current scheduled course
                        if (this.manifest.compliantUntil.isBefore(courseInstance.startDate)) {
                            courseInstance.canLaunch = false;
                            // any progressData collected above maybe because of false calculatiion
                            // due to manifest change
                            courseInstance.progress = null;
                            courseInstance.locked = true;
                            courseInstance.canLaunch = false;
                            courseInstance.status = "lockedByPastDue";
                        }
                        // Don't calculate the dependency lock
                        // if it is already locked because of past due
                        if (courseInstance.status !== "lockedByPastDue" &&
                            (courseInstance.startDate.isSameOrBefore(this.testParams.test_today_date)
                                || courseInstance.dueDate.isSameOrBefore(this.testParams.test_today_date))) {
                            if (!isDependencyComplete(courseInstance, list)) {
                                courseInstance.canLaunch = false;
                                courseInstance.locked = true;
                                courseInstance.status = "lockedByDependencies";
                            }
                        }
                        if (!courseInstance.progress &&
                            courseInstance.startDate.isAfter(this.testParams.test_today_date)) {
                            courseInstance.locked = true;
                            courseInstance.status = "upcoming";
                        }
                        return courseInstance;
                    }
                }));

            // Sort the manifest based on status, start date etc. for display purposes.
            const statusSortOrder = ["completed", "pastDueStarted", "pastDueNotStarted", "lockedByPastDue",
                "started", "notStarted", "lockedByDependencies", "upcoming"];
            const sorter = (a: any, b: any): number => {
                return _.reduce([
                    (xarg: any): any => { return statusSortOrder.indexOf(xarg.status); },   // First criteria is course status.
                    (xarg: any): any => { return getTime(xarg.startDate); },               // If they are identical sort on start date.
                    (xarg: any): any => { return getTime(xarg.dueDate); },                 // Then sort according to due date.
                    (xarg: any): any => { return xarg.due_period; },                        // And then due period.
                    (xarg: any): any => { return xarg.title; },                             // If all above are identical, use title name.
                ], (acc: number, f: (xarg: any) => any) => {
                    return acc ? acc : (f(a) < f(b) ? -1 : (f(a) > f(b) ? 1 : 0));
                }, 0);
            };
            this.manifest.courses = this.manifest.courses.sort(sorter);
            let currentCourses: Course[] = [];
            let pastCourses: Course[] = [];
            let futureCourses: Course[] = [];
            this.manifest.courses.map((course, index, courses) => {
                course.allCourseMapIndex = index;
                if (course.progress && course.progress.completedDate) {
                    pastCourses.push(course);
                } else if (course.startDate.isAfter(this.testParams.test_today_date)) {
                    futureCourses.push(course)
                } else if (course.startDate.isSameOrBefore(this.testParams.test_today_date) &&
                    (!course.progress || (course.progress && !course.progress.completedDate))) {
                    currentCourses.push(course);
                }
            });
            this.manifest.currentCourses = currentCourses;
            this.manifest.futureCourses = futureCourses;
            this.manifest.pastCourses = pastCourses;
            this.manifest.testParams = this.testParams;
            return this.manifest;
        })();
    }

    populateCourseInstances(newCycle?: boolean) {
        let courses: Course[] = [];
        let keySecret = {};
        let firstAttemptDate: Date = moment(this.manifest.firstAttemptDate).toDate();
        if (newCycle && this.manifest.currentCycle && firstAttemptDate) {
            firstAttemptDate = moment(this.manifest.firstAttemptDate).add
                (this.manifest.currentCycle * this.manifest.repeat_cycle, 'M').toDate();
            this.manifest.currentCycle++;
        }
        this.courseCollection.forEach(mocCourse => {
            if (_.isArray(mocCourse.start_dates)) {
                let sortedStartDates = _.sortBy(mocCourse.start_dates, (date: number): number => { return date; });
                const posByCycle = sortedStartDates.length * (this.manifest.currentCycle - 1);
                sortedStartDates.forEach((start_date, pos: number, arr: any[]) => {
                    // Populate each course start_date based on manifest.start_date and cs_moce start date
                    // If there are launches from previous cycles then also return their start and due date
                    let calculatedMocDates = this.calculateMocStartEndDates(start_date, mocCourse.due_period, firstAttemptDate);
                    // Loop through courses's start and due date from all available cycles
                    for (let i = 0; i < calculatedMocDates.length; i++) {
                        let courseInstance: Course = JSON.parse(JSON.stringify(mocCourse));
                        courseInstance.instance = pos + posByCycle;
                        courseInstance.startDate = calculatedMocDates[i].startDate;
                        courseInstance.instanceStartPeriod = start_date;
                        courseInstance.dueDate = calculatedMocDates[i].dueDate;
                        courseInstance.dueDaysLeft = calculatedMocDates[i].dueDaysLeft;
                        this.manifest.currentCycle = calculatedMocDates[i].cycle ?
                            calculatedMocDates[i].cycle : this.manifest.currentCycle;
                        courseInstance.progress = this.progress.filter((progress) => {
                            let startDate = formatDate(progress.startDate, this.manifest.orgTimeZone);
                            if (progress.attemptId === this.manifest.attemptId &&
                                progress.courseId === courseInstance.id &&
                                startDate.isSame(courseInstance.startDate)) {
                                progress.startDate = startDate;
                                progress.startedDate = formatDate(progress.startedDate, this.manifest.orgTimeZone);
                                if (progress.completedDate) {
                                    progress.completedDate = formatDate(progress.completedDate, this.manifest.orgTimeZone);
                                }
                                return progress;
                            }
                        })[0];

                        let courseCompleted = courseInstance.progress && courseInstance.progress.completedDate;
                        // Calculate compliantUntil
                        // This should be the closest greater date than last compliant until
                        // If compliant until is not in db then it's current epoch time "1970-01-01"
                        // If complaintUntil === oldCompliantUntil (this will run only one time, assign
                        // old compliant until to null) then assign compliantUntil = dueDate
                        // where dueDate > compliantUntil & course is not completed.
                        // Else if dueDate < compliantUntil & course is not completed
                        // compliantUntil = dueDate if dueDate is same or > than last compliant until
                        // if dueDate > oldCompliantUntil assign oldCompliantUntil null (compliantUntil should be greater or equal than previous compliantUntil)
                        if (courseInstance.dueDate.isSameOrAfter(this.manifest.compliantUntil)
                            && !this.nextCompliantUntilFound
                            && !courseCompleted) {
                            this.manifest.compliantUntil = courseInstance.dueDate;
                            this.nextCompliantUntilFound = true;
                        } else if (this.nextCompliantUntilFound && !courseCompleted &&
                            courseInstance.dueDate.isSameOrBefore(this.manifest.compliantUntil)
                            && courseInstance.dueDate.isSameOrAfter(this.manifest.lastCompliantUntil)) {
                            this.manifest.compliantUntil = courseInstance.dueDate;
                        }
                        if (courseInstance.dueDaysLeft <= 0 && (!courseInstance.progress)) {
                            courseInstance.status = "pastDueNotStarted";
                            this.manifest.allCoursesCompleted = false;
                        } else if (courseInstance.dueDaysLeft <= 0 && (courseInstance.progress && !courseInstance.progress.completedDate)) {
                            courseInstance.status = "pastDueStarted";
                            this.manifest.allCoursesCompleted = false;
                        } else if (courseInstance.dueDaysLeft > 0 && !courseInstance.progress) {
                            courseInstance.status = "notStarted";
                            this.manifest.allCoursesCompleted = false;
                        } else if (courseInstance.dueDaysLeft > 0 && (courseInstance.progress && !courseInstance.progress.completedDate)) {
                            courseInstance.status = "started";
                            this.manifest.allCoursesCompleted = false;
                        } else {
                            this.manifest.anyCourseCompleted = true;
                            if (!this.manifest.lastCompletionDate) {
                                this.manifest.lastCompletionDate = courseInstance.progress.completedDate;
                            } else {
                                this.manifest.lastCompletionDate = courseInstance.progress.completedDate.isAfter(this.manifest.lastCompletionDate) ? courseInstance.progress.completedDate : this.manifest.lastCompletionDate;
                            }
                            courseInstance.status = "completed";
                        }
                        // Calculate If can be launched or not
                        // A course can be launced if course due date is <= current time suggesting course is from previous cycle for review purpose
                        // Or if a current date is >= start_date And current data <= dueDate suggesting course belongs to current cycle
                        // All future courses cannot be launched
                        if (courseInstance.dueDate.isSameOrBefore(this.testParams.test_today_date)
                            || (this.testParams.test_today_date.isSameOrAfter(courseInstance.startDate) &&
                                this.testParams.test_today_date.isSameOrBefore(courseInstance.dueDate))) {
                            courseInstance.canLaunch = true;
                        }
                        if (courseInstance.launch.lti_link.indexOf("http") === -1
                            || courseInstance.launch.lti_link.indexOf("https") === -1) {
                            courseInstance.launch.lti_link = this.csUrl + "/launch_lti?manifest=manifest/" + courseInstance.launch.lti_link;
                        }

                        if (this.returnFormat === "JSON") {
                            // setting context_id and lis_result_sourcedid to resourceLinkId
                            const resourceLinkId = this.attemptId + "|" + courseInstance.id + "|" + moment.utc(courseInstance.startDate)
                                + "|" + moment.utc(courseInstance.dueDate);
                            courseInstance.launch = (<any>Object).assign(courseInstance.launch, {
                                "resource_link_id": resourceLinkId,
                                "context_id": resourceLinkId,
                                "tool_consumer_info_product_family_code": "moc_lti_launch",
                                "lis_result_sourcedid": resourceLinkId,
                                "lis_outcome_service_url": this.csUrl + "/moc_lis_endpoint",
                                "custom_start_date": courseInstance.startDate,
                                "custom_due_date": courseInstance.dueDate
                            });
                        }
                        courses.push(courseInstance);
                    }
                });
            }
        });
        this.manifest.courses = this.manifest.courses.concat(courses);
        if (this.manifest.allCoursesCompleted && (this.manifest.repeat_cycle > 0)) {
            this.populateCourseInstances(true);
        }
    }

    calculateComplianceStatus(): void {
        const courses: Course[] = this.manifest.courses;
        const seInterim: string = "interim";
        const seCompliant: string = "compliant";
        const seUnCompliant: string = "uncompliant";

        // Let user be compliant from "start"" by default if somebody messed up the manifest.
        let status: string = seCompliant;
        let from: string = this.manifest.compliant && this.manifest.compliant.from && this.manifest.compliant.from.toLowerCase() || "start";

        // Helper:
        // Check of any courses in list are not completed.
        let isAnyInListNotCompleted = (courseInstances: any[]): boolean => {
            return _.some(courseInstances, (course: any): boolean => {
                return course.status != "completed";
            });
        }

        if (from === "start") {
            // The user is compliant from the beginning so just check if course is overdue.
            if (this.manifest.compliantUntil.isBefore(this.testParams.test_today_date)) {
                status = seUnCompliant;
            }
        } else if (from === "date") {
            // The user compliance is "interim" from the start. When all courses up to month "date" are passed
            // the user is "compliant". If the due date has passed month "date" the user is "uncompliant".
            if (this.manifest.compliantUntil.isSameOrAfter(this.testParams.test_today_date)) {
                // If the user already completed all of the courses before month "date" status is "compliant",
                // otherwise "interim".
                let monthDate: moment.Moment = moment(this.manifest.firstAttemptDate).add(parseInt(this.manifest.compliant.date) | 0, "M");
                //            let isAllCompletedWithin = (month: moment.Moment, courseInstances: any[]): boolean => {
                let isAnyNotCompletedWithin = (month: moment.Moment, courseInstances: any[]): boolean => {
                    let dueCourses: any[] = courseInstances.filter((course: any, index: number, courseArr: any[]) => {
                        return moment(course.dueDate).isBefore(month);
                    });
                    return isAnyInListNotCompleted(dueCourses);
                }
                if (!this.manifest.anyCourseCompleted ||
                    isAnyNotCompletedWithin(monthDate, courses)) {
                    status = seInterim;
                }
            } else {
                status = seUnCompliant;
            }
        } else if (from === "coursecompletion") {
            // Compliance is "interim" until all courses in the courses list are completed and the user becomes compliant.
            // When due date is exceeded the status is "uncompliant".
            if (this.manifest.compliantUntil.isSameOrAfter(this.testParams.test_today_date)) {
                // Status is "interim" until all courses in the list are completed.
                let courseDeps: Course[] = _.isArray(this.manifest.compliant.courses) ? this.manifest.compliant.courses : [];
                // Let user be compliant if the dependecies cannot be parsed.
                if (courseDeps.length > 0) {
                    let isAnyWithSameIdNotCompleted = (courseInstances: any[]): boolean => {
                        // Brush up dependencies. If no instance is given assume zero.
                        // If more are given per id take the first one.
                        let brushedDeps: any[] = _.uniq(courseDeps, (courseDep: any): string => {
                            return courseDep.id;
                        })
                        let courseDepsIds: string[] = _.map(brushedDeps, (courseDep: any): string => {
                            return courseDep.id.toLowerCase();
                        });
                        // Reduced list of courses that are in the dependency list.
                        let reducedCourses = _.filter(courses, (course: any): boolean => {
                            return _.contains(courseDepsIds, course.id.toLowerCase());
                        });
                        // Reduce list of courses where instance doesn't match.
                        courseDeps.forEach((courseDep: any, index: number, array: any[]): void => {
                            reducedCourses = _.filter(reducedCourses, (course: any): boolean => {
                                return course.id.toLowerCase() != courseDep.id || course.instance === (courseDep.instance | 0);
                            });
                        });
                        return isAnyInListNotCompleted(reducedCourses);
                    }
                    if (!this.manifest.anyCourseCompleted ||
                        isAnyWithSameIdNotCompleted(courses)) {
                        status = seInterim;
                    }
                }
            } else {
                status = seUnCompliant;
            }
        }
        this.manifest.complianceStatus = status;
    }

    calculateMocStartEndDates(courseStartDate: number, courseDuePeriod: number,
        firstAttemptDate: Date): IStartEndDates[] {
        // this will contain end result
        let startEndDates: IStartEndDates[] = [];
        const repeatYear = this.manifest.repeat_cycle / 12;
        // If there is no attempt date (it will be) assign this year
        const attemptDate = formatDate(firstAttemptDate, this.manifest.orgTimeZone);
        const today = this.testParams.test_today_date ? this.testParams.test_today_date :
            formatDate(null, this.manifest.orgTimeZone);

        // Calculate course start date
        // manifest start_date can be fixed number, leaner, organization or institution
        let manifestStartMonth = attemptDate.month();
        /*
        if (manifestStartDate === "learner" || manifestStartDate === "organization") {
            //var start_date_type = manifestStartDate;
            manifestStartMonth = attemptDate.getUTCMonth();
        } else if (manifestStartDate === "institution") {
            // To do
            //var start_data_type = "institution";
        }*/
        // Calculate course start date
        const startPeriod = manifestStartMonth + courseStartDate;
        let startMonth = startPeriod % 12; // if the month > 12
        if (this.manifest.start_alignment && this.manifest.start_alignment === "quarter") {
            if (startMonth >= 0 && startMonth <= 2) {
                startMonth = 0;
            } else if (startMonth >= 3 && startMonth <= 5) {
                startMonth = 3;
            } else if (startMonth >= 6 && startMonth <= 8) {
                startMonth = 6;
            } else {
                startMonth = 9;
            }
        }
        let startYear = attemptDate.year() + Math.floor(startPeriod / 12);
        // calculate all the start dates and due dates for all the available cycles
        const timeDiff = today.diff(attemptDate, "years", true);
        if (timeDiff >= repeatYear && (repeatYear > 0)) {
            let cycle = Math.ceil(timeDiff / repeatYear);
            if (timeDiff % repeatYear === 0) {
                cycle++;
            }
            let i = 0;
            while (i < cycle) {
                startYear = startYear + (i === 0 ? 0 : repeatYear);
                const startDate = formatDate([startYear, startMonth, 1, 0, 0, 0], this.manifest.orgTimeZone);
                const startDateString = startDate.format("YYYY-MM-DDT00:00:00");
                const dueDateJs = new Date(Date.UTC(startDate.year(), startDate.month() + courseDuePeriod, 0));
                const dueDate = formatDate([dueDateJs.getUTCFullYear(), dueDateJs.getUTCMonth(), dueDateJs.getUTCDate(), 23, 59, 59, 999], this.manifest.orgTimeZone);
                const dueDateString = dueDate.format("YYYY-MM-DDT23:59:59.999");
                const dueDaysLeft = Math.ceil(dueDate.diff(today, "days", true));
                startEndDates.push({
                    startDate: startDate,
                    dueDate: dueDate,
                    dueDaysLeft: dueDaysLeft,
                    cycle: cycle
                });
                i++;
            }
        } else {
            const startDate = formatDate([startYear, startMonth, 1, 0, 0, 0], this.manifest.orgTimeZone);
            const startDateString = startDate.format("YYYY-MM-DDT00:00:00");
            let dueDate;
            if (courseDuePeriod) {
                const dueDateJs = new Date(Date.UTC(startDate.year(), startDate.month() + courseDuePeriod, 0))
                dueDate = formatDate([dueDateJs.getUTCFullYear(), dueDateJs.getUTCMonth(), dueDateJs.getUTCDate(), 23, 59, 59, 999], this.manifest.orgTimeZone);
            } else {
                dueDate = formatDate([9999, 11, 31, 23, 58, 58, 999], "utc");
            }
            const dueDateString = dueDate.format("YYYY-MM-DDT23:59:59.999");
            const dueDaysLeft = Math.ceil(dueDate.diff(today, "days", true));
            startEndDates.push({
                startDate: startDate,
                dueDate: dueDate,
                dueDaysLeft: dueDaysLeft,
                cycle: undefined
            });
        }
        return startEndDates;
    }
}

export function formatDate(date: any, timezone?: string): moment.Moment {
    let momentDate: moment.Moment;
    // if timezone is undefined we use "Europe/Dublin" by default
    timezone = timezone ? timezone : "Europe/Dublin";
    if (!date) {
        momentDate = moment().tz(timezone);
    } else if (date && timezone) {
        momentDate = moment.tz(date, timezone);
    } else {
        momentDate = moment(date);
    }
    // override toJSON so that timezone is included when object is stringfied
    // by default it gives ISO utc date
    momentDate.toJSON = function () { return moment(this).format(); }
    return momentDate;
}

/**
 * Calculates if dependencies of a course are complete
 * Dependecy check is done if a course start & due date is within the dependecy period.
 * @param {any} courseInstance - course of which depencies completion are to be calculated.
 * @param {any} courses - all the courses in the manifest.
 * @return {bool} isDependencyComplete - returns true if all the dependencies are complete
 */
function isDependencyComplete(courseInstance: Course, courses: Course[]) {
    if (!courseInstance.depends_on) {
        return true;
    }
    // isDependencyComplete = !dependencyNotComplete
    // Use array some to return true if any of the dependency is incomplete
    let isDependencyComplete = !courseInstance.depends_on.some((dependency) => {
        return courses.some((course) => {
            if (course.id === dependency &&
                courseInstance.startDate.isSameOrAfter(course.startDate) &&
                courseInstance.startDate.isSameOrBefore(course.dueDate)) {
                if (!course.progress || (course.progress && !course.progress.completedDate)) {
                    return true;
                }
            }
        });
    });
    return isDependencyComplete;
}

export function getTime(date?: string | Date): number {
    if (date) {
        if (typeof date === "string") {
            return new Date(date).getTime();
        } else if (moment.isMoment(date)) {
            return new Date(moment.utc(date).toISOString()).getTime();
        } else {
            return date.getTime();
        }
    } else {
        return new Date().getTime();
    }
}

export function isValidTestTodayDate(date: string | moment.Moment): { isValid: boolean; message?: string } {
    let valid = true;
    // restricting test_today_date to be in format YYYY-MM-DD
    if (date && typeof date === "string") {
        const testTodayDate: any = date;
        const testTodayDateParts = testTodayDate.split("T")[0].split("-");
        if (testTodayDateParts.length !== 3 || testTodayDateParts[0].length !== 4 ||
            testTodayDateParts[1].length !== 2 || testTodayDateParts[2].length !== 2) {
            valid = false;
        }
    } else if (!moment(date).isValid()) {
        valid = false;
    }
    if (!valid) {
        return {
            isValid: false,
            message: "Invalid test_today_date in URL.It should be a date string e.g.YYYY-MM-DD, 2016-01-29."
        };
    } else {
        return { isValid: true };
    }
}
