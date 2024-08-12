SELECT a.id AS attemptId
    ,user_id AS userId
    ,u.lms_user_id AS lmsUserId
    ,lms_user_name AS userName
    ,lms_user_email AS userEmail
    ,validation_code AS validation_code
    ,notifications AS emailNotifications
    ,resource_link_id AS resourceLinkId
    ,instance_id AS instanceId
    ,context_id AS contextId
    ,lis_result_sourcedid AS lisResultSourceId
    ,oauth_key AS oauthKey
    ,lis_outcome_service_url AS lisOutcomeServiceUrl
    ,manifest_id AS manifestId
    ,tool_consumer_info_product_family_code AS toolConsumerInfoProductFamilyCode
    ,oauth_secret AS oauthSecret
    ,org_id AS orgId
    ,csidmap1.NAME AS orgName
    ,csidmap1.time_zone AS orgTimeZone
    ,a.institution_id AS institutionId
    ,csidmap2.NAME AS institutionName
    ,license_key AS licenseKey
    ,tool_consumer_instance_guid AS toolConsumerInstanceGuid
    ,a.roles AS roles
    ,compliant_until AS compliantUntil
    ,csa.start_date AS start_date_learner
    ,csm.created AS start_date_org
FROM [cs_attempt] a
JOIN [cs_user] u ON u.id = a.user_id
LEFT JOIN cs_idmap csidmap1 ON csidmap1.id = CAST(a.org_id AS NVARCHAR(128))
LEFT JOIN cs_idmap csidmap2 ON csidmap2.id = CAST(a.institution_id AS NVARCHAR(128))
LEFT JOIN cs_moc csm ON a.manifest_id = csm.manifest_id
    AND a.org_id = csm.org_id
LEFT JOIN cs_moc_progress csmp ON csmp.attempt_id = a.id
WHERE a.id = @attempt_id
ORDER BY csmp.created ASC