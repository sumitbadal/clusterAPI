export function getMocLaunchData(db: any, attemptId: string, done: (err: any, data?: any) => void) {
    let query = `
           SELECT csa.id AS attemptId
                ,csa.user_id AS userId
                ,csu.lms_user_id AS lmsUserId
                ,csu.lms_user_name AS userName
                ,csu.lms_user_email AS userEmail
                ,csu.validation_code AS validationCode
                ,csu.notifications AS emailNotifications
                ,csa.resource_link_id AS resourceLinkId
                ,csa.instance_id AS instanceId
                ,csa.context_id AS contextId
                ,csa.lis_result_sourcedid AS lisResultSourceId
                ,csa.oauth_key AS oauthKey
                ,csa.lis_outcome_service_url AS lisOutcomeServiceUrl
                ,csa.manifest_id AS manifestId
                ,tool_consumer_info_product_family_code AS toolConsumerInfoProductFamilyCode
                ,csa.oauth_secret AS oauthSecret
                ,csa.org_id AS orgId
                ,csidmap1.NAME AS orgName
                ,csidmap1.time_zone AS orgTimeZone
                ,csa.institution_id AS institutionId
                ,csidmap2.NAME AS institutionName
                ,license_key AS licenseKey
                ,tool_consumer_instance_guid AS toolConsumerInstanceGuid
                ,csa.roles AS roles
                ,csa.compliant_until AS compliantUntil
                ,csa.start_date AS learnerStartDate
                ,csm.created AS orgStartDate
            FROM [cs_attempt] csa
            JOIN [cs_user] csu ON csu.id = csa.user_id
            LEFT JOIN cs_idmap csidmap1 ON csidmap1.id = CAST(csa.org_id AS NVARCHAR(128))
            LEFT JOIN cs_idmap csidmap2 ON csidmap2.id = CAST(csa.institution_id AS NVARCHAR(128))
            LEFT JOIN cs_moc csm ON csa.manifest_id = csm.manifest_id
                AND csa.org_id = csm.org_id
            WHERE csa.id = @attempt_id
        `;
    db.query(query,
        ["attempt_id", db.var.UniqueIdentifier, attemptId],
        done,
        true);
}

export function getMocProgress(db: any, attemptId: string, done: (err: any, data?: any) => void): void;
export function getMocProgress(db: any, attemptId: string): Promise<any>;
export function getMocProgress(
    db: any, attemptId: string,
    done?: (err: any, data?: any) => void
): Promise<any>|void {
    if (done) {
        let query = `
            SELECT attempt_id AS attemptId
                ,moc_course_id AS courseId
                ,start_date AS startDate
                ,due_date AS dueDate
                ,completed AS completedDate
                ,created AS startedDate
                ,modified AS modifiedDate
            FROM cs_moc_progress
            WHERE attempt_id = @attempt_id
            ORDER BY created ASC
        `;
        db.query(query,
            ['attempt_id', db.var.UniqueIdentifier, attemptId],
            done,
            true);
        return;
    }
    return new Promise((resolve, reject) => {
        getMocProgress(db, attemptId, (err, data) => {
            err ? reject(err) : resolve(data);
        });
    });
}

export function getAttemptByManifestOrAttemptId(db: any, manifestId: string, attemptId: string,
    done: (err: any, data?: any) => void) {
    manifestId = "manifest/" + manifestId;
    let query = `SELECT csa.id AS attemptId
            ,csa.compliant_until AS compliantUntil
            ,csa.active AS activeAttempt
            ,csa.org_id AS orgId
            ,csa.manifest_id AS manifestId
            ,csu.id AS userId
            ,csu.notifications AS emailNotification
            ,csu.active AS activeUser
            ,csu.lms_user_name AS userName
            ,csu.lms_user_email AS userEmail
            ,csm.created AS mocStartDate
            ,csu.validation_code
            ,csi.time_zone
        FROM cs_attempt csa
        JOIN cs_user csu ON csa.user_id = csu.id
        JOIN cs_moc csm ON csa.org_id = csm.org_id
            AND csa.manifest_id = csm.manifest_id
        JOIN cs_idmap csi on csi.id = CAST(csa.org_id AS NVARCHAR(128))
        WHERE csa.active = 1
            AND csu.active = 1
            AND csu.notifications IS NOT NULL
            AND csu.notifications <> 0
            AND csu.validation_code IS NULL`;
    if (attemptId) {
        query += " AND csa.id = @attempt_id";
    } else {
        query += " AND csa.manifest_id = @manifest_id";
    }
    db.query(
        query,
        ["manifest_id", db.var.NVarChar(256), manifestId],
        ["attempt_id", db.var.UniqueIdentifier, attemptId],
        done,
        true);
}

export function getMocAttempts(db: any, done: (err: any, data: any) => void) {
    let query = `SELECT csa.id AS attemptId
            ,csa.compliant_until AS compliantUntil
            ,csa.active AS activeAttempt
            ,csa.org_id AS orgId
            ,csa.manifest_id AS manifestId
            ,csu.id AS userId
            ,csu.notifications AS emailNotification
            ,csu.active AS activeUser
            ,csu.lms_user_name AS userName
            ,csu.lms_user_email AS userEmail
            ,csm.created AS mocStartDate
            ,csu.validation_code
            ,csi.time_zone
        FROM cs_attempt csa
        JOIN cs_user csu ON csa.user_id = csu.id
        JOIN cs_moc csm ON csa.org_id = csm.org_id
            AND csa.manifest_id = csm.manifest_id
        JOIN cs_idmap csi on csi.id = CAST(csa.org_id as NVARCHAR(128))
        WHERE csa.active = 1
            AND csu.active = 1
            AND csu.notifications IS NOT NULL
            AND csu.notifications <> 0
            AND csu.validation_code IS NULL`;
    db.query(
        query,
        done,
        true);
}
