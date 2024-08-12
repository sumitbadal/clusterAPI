/**
Email Scheduling Algorithm
Implementation as an endpoint, we can make a script which calls all the end points mentioned in a
config file. And put the script in backup server to be run as other scheduled tasks

// Else needs modification to parse all content maps and connect all cs dbs
// For now we assume start date defined as number (no learner)

1. Read the content map and create a course object containing courses that has courseType MOC
2. Fetch the manifest from manifest url.
3. Get all the info from from "cs_attempt" JOIN "cs_user" JOIN "cs_moc" tables where manifest_id
is from 2 with active in cs_attempt, cs_moc and cs_user and notifications enabled.
   If no users END.
   - Problem to address if there is no attempt we don't know if the user exists for that moc
4. Calculate a new manifest with all start and due dates for all the course instances in manifest(from moc.ts)
5. Decide when to send notifications
6. Send email function.
**/

import * as async from "async";
import * as _ from "underscore";
import * as fs from "fs";
import * as request from "request";
import * as moment from "moment-timezone";
import * as curriculumScheduler from "./curriculum-scheduler";
import * as utils from "./utils";
import * as datastore from "./datastore";
import * as path from "path";
import * as gettext from "node-gettext";

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
            setLocale?: any,
            gettext?: any
        }
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

export class EmailScheduler {
    private db: any;
    private contentMap: any;
    private testParams: curriculumScheduler.TestParams;
    private mailTemplate: any;
    private attemptId: string;
    private fetchedEmailTemplates: any;
    private emails: Email;
    private scheduleResponse: ScheduleResponseParams;
    constructor(db: any, attemptId: string, contentMap: any, testParams: curriculumScheduler.TestParams) {
        if (!db) {
            throw ("No db connection was passed.");
        }
        if (!contentMap) {
            throw ("No content map was passed.");
        }
        this.db = db;
        this.contentMap = typeof contentMap === "string" ? JSON.parse(contentMap) : contentMap;
        this.testParams = testParams ? testParams : {};
        this.attemptId = attemptId;
        this.emails = {};
        this.mailTemplate = path.resolve(__dirname, "../templates/moc-course-reminders-email.ejs");
        // Read the default mail template if it fails then no need going further
        // If there is a mail template defined in manifest it will be overwritten
        try {
            this.mailTemplate = fs.readFileSync(this.mailTemplate, "utf-8");
        } catch (err) {
            throw ("Error reading default mail template");
        }
    }

    populateContentMap(manifestUrl: string) {
        request.get({ uri: manifestUrl }, (err, res, body) => {
            this.contentMap = body;
        });
    }
    scheduleEmailForAttempt(done: (err, data) => void) {
        if (!this.attemptId) {
            throw "No attempt id provided";
        }
        async.waterfall([
            (callback) => {
                // fetch the manifest id
                datastore.getAttemptByManifestOrAttemptId(this.db, null, this.attemptId, (err, attemptData) => {
                    if (err) {
                        callback(err);
                    } else {
                        //fetch manifest
                        if (attemptData.length === 0) {
                            return callback("No attempt found for attemptId " + this.attemptId);
                        }
                        let courseInfo: MocContentMapParams = this.contentMap[attemptData[0].manifestId.split("/")[1]];
                        if (!courseInfo) {
                            return callback("no content map entry found");
                        }
                        courseInfo = courseInfo[0];
                        const mocSchd = new curriculumScheduler.CurriculumScheduler(this.db, "", "", this.attemptId,
                            courseInfo.manifest, courseInfo.lang, this.testParams);
                        mocSchd.schedule((err, manifest) => {
                            if (err) {
                                return callback(err);
                            }
                            if (manifest.notifications.template) {
                                request.get({ uri: manifest.notifications.template }, (err, res, body) => {
                                    manifest.mailTemplate = body;
                                    callback(err, manifest, attemptData[0]);
                                });
                            } else {
                                manifest.mailTemplate = this.mailTemplate;
                                callback(err, manifest, attemptData[0]);
                            }
                        });

                    }
                });
            },
            (manifest, attemptData, callback) => {
                this.calculateNotificationDays(attemptData, manifest, { test_today_date: manifest.testParams.test_today_date });
                return callback(null);
            }
        ], (err, result) => {
            // result now equals 'done'
            done(null, this.emails);
        });
    }

    // later restructure with async flow
    scheduleAllEmails(done: (err: any, emails: Email) => void) {
        // Step 1. Read the content type where courseType is MOC
        let mocContentMaps: MocContentMapParams[] = [];
        for (let key in this.contentMap) {
            if (this.contentMap.hasOwnProperty(key)) {
                this.contentMap[key].forEach((mocContentMap: MocContentMapParams) => {
                    if (mocContentMap.courseType && mocContentMap.courseType.toUpperCase() === "MOC") {
                        mocContentMap.manifestId = key;
                        mocContentMaps.push(mocContentMap);
                    }
                });
            }
        }
        // mocContentMaps is [], we do parallel processing
        // do not return error if one fails, instead we make a error log file and failed emails list
        // and send it as response at last
        async.each(mocContentMaps, (mocContentMap: MocContentMapParams,
            eachCallback: (err: any) => void) => {
            // These are operations in waterfall for each MOC course type
            async.waterfall([
                (callback) => {
                    // Step 2: Get user attempts for this manifest id
                    datastore.getAttemptByManifestOrAttemptId(this.db, mocContentMap.manifestId, null,
                        (err, attempts) => {
                            if (err) {
                                return callback(err);
                            }
                            callback(null, mocContentMap, attempts);
                        });
                },
                // Step 3: fetch the manifest from manifest url and start calculations
                (mocContentMap: MocContentMapParams, attempts, callback) => {
                    let processedAttemptIds = [];
                    if (attempts.length === 0) {
                        return callback(null);
                    }
                    let error = "";
                    attempts.forEach((attempt, index, attempts) => {
                        const mocSchd = new curriculumScheduler.CurriculumScheduler(
                            this.db, "", "", attempt.attemptId, mocContentMap.manifest, mocContentMap.lang, this.testParams);
                        mocSchd.schedule((err, manifest) => {
                            processedAttemptIds.push(attempt.attemptId);
                            if (err) {
                                error += JSON.stringify(err);
                                if (processedAttemptIds.length < attempts.length) {
                                    return;
                                }
                            }
                            if (error && processedAttemptIds.length === attempts.length) {
                                return callback(error);
                            }
                            if (manifest.notifications.template) {
                                request.get({ uri: manifest.notifications.template }, (error, res, body) => {
                                    if (error || res.statusCode !== 200) {
                                        return callback("Error reading mail template");
                                    }
                                    manifest.mailTemplate = body;
                                    this.calculateNotificationDays(attempt, manifest, { test_today_date: manifest.testParams.test_today_date });
                                    if (processedAttemptIds.length === attempts.length) {
                                        callback(null);
                                    }
                                });
                            } else {
                                manifest.mailTemplate = this.mailTemplate;
                                this.calculateNotificationDays(attempt, manifest, { test_today_date: manifest.testParams.test_today_date });
                                if (processedAttemptIds.length === attempts.length) {
                                    callback(null);
                                }
                            }
                        });
                    });
                },
            ], (err: any) => {
                // result now equals 'done'
                const noExitOnPossibleErrors = [
                    "no_attempts",
                    "calculate_newManifest_error",
                    "get_attempt_error",
                    "manifest_error"
                ];
                if (noExitOnPossibleErrors.indexOf(err) > -1) {
                    err = null;
                }
                eachCallback(err);
            });
        }, (err: any) => {
            done(err, this.emails);
        });
    }

    calculateNotificationDays(attemptData: any,
        manifest: curriculumScheduler.ExpandedManifest,
        testParams: curriculumScheduler.TestParams) {
        let mocCourse = {
            mocTitle: manifest.title,
            courses: []
        };
        // Figure out which bits are set
        const notifications = manifest.notifications;
        if (!notifications.relative_to_due_date && !notifications.relative_to_start_date) {
            return null;
        }
        manifest.courses.forEach((course) => {
            if (course.canLaunch || course.status === "pastDueNotStarted") {

                // Step 5: Calculating notification pattern
                const diffStartDay = Math.ceil(testParams.test_today_date.diff(course.startDate, "days", true));
                const diffDueDay = Math.ceil(testParams.test_today_date.diff(course.dueDate, "days", true));
                manifest.lang = this.testParams.test_lang ? this.testParams.test_lang : manifest.lang;
                let courseParams = {
                    name: course.title,
                    dueDate: course.dueDate.locale(manifest.lang).format("ll"), // Truncate off hours, minutes, seconds
                    startDate: course.startDate.locale(manifest.lang).format("ll"),
                    diffStartDay: null,
                    diffDueDay: null
                };
                // if this day is on
                // We assume days setting is same for due course and past course
                // i.e. if user wants to receive email 3 days before course starts,
                // user will also receive course if it is 3 days past due
                // We have 3 conditions on which to send an email
                if (attemptData.emailNotification !== 0 &&
                    (course.progress ? !course.progress.completedDate : !course.progress)) {
                    if (notifications.relative_to_start_date &&
                        notifications.relative_to_start_date.length > 0) {
                        // For now we send emails only on the day of the start
                        if ((diffStartDay === 0) &&
                            (attemptData.emailNotification & curriculumScheduler.EmailPref.ONSTART) &&
                            ((notifications.relative_to_start_date.indexOf(diffStartDay) > -1))) {
                            courseParams.diffStartDay = diffStartDay;
                        }
                    }
                    if (notifications.relative_to_due_date &&
                        notifications.relative_to_due_date.length > 0) {
                        if ((diffDueDay <= 0) &&
                            (attemptData.emailNotification & curriculumScheduler.EmailPref.BEFOREDUE) &&
                            (notifications.relative_to_due_date.indexOf(diffDueDay) > -1)) {
                            courseParams.diffDueDay = diffDueDay;
                        } else if ((diffDueDay > 0) &&
                            (attemptData.emailNotification & curriculumScheduler.EmailPref.PASTDUE) &&
                            (notifications.relative_to_due_date.indexOf(diffDueDay) > -1)) {
                            courseParams.diffDueDay = diffDueDay;
                        }
                    }
                    if (attemptData.userEmail &&
                        (courseParams.diffStartDay !== null || courseParams.diffDueDay !== null)) {
                        let userNames = attemptData.userName ? attemptData.userName.split("|") : [];
                        const userName = userNames.length === 0 ? "" : (userNames.length === 1 ? userNames[0] : userNames[1]);

                        if (!this.emails[attemptData.userEmail]) {
                            this.emails[attemptData.userEmail] = {
                                to: attemptData.userEmail,
                                from: null,
                                subject: "MOC course Notification",
                                mailTemplate: manifest.mailTemplate,
                                params: {
                                    name: userName,
                                    lang: manifest.lang,
                                    mocs: {}
                                }
                            };
                        }
                        mocCourse.courses.push(courseParams);
                        this.emails[attemptData.userEmail].params.mocs[manifest.attemptId] = mocCourse;
                    }
                }
            }
        });
    }
}