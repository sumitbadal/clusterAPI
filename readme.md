**hypermoc** npm module can be used to calculate curriculum & email schedules.

- curriculum schedules
    - returns a manifest with course schedules 
- email schedules
    - returns an object with emails that are to be sent on run date of the script
- This module is **db dependendent**.
    - In order to use this module we need to pass db instance of content service on which we want to run the scheduling.
    - This module should however contain only select queries. No insert or update to the db.
- a test date can be provided so that the scheduling runs on test date instead of current date.


**Running curriculum scheduling**


1. Import the module
    
       `import * as hypermoc from "hypermoc"`



2. get the content map "http://cs-dev.contentservice.net/get_content_map". Signing of the post request required.

3. Filter the content map for entries that are "MOC". "MOCADMIN" doesn't have any scheduling.

4. Loop through result of 3. Get the attempts for that manifestId (attemptId can be null if there is manifestId)

    `hypermoc.getAttemptByManifestOrAttemptId(dbConfig, manifestId, attemptId)`

    dbConfig is the database config of the content service 

    Optional: Can fetch the manifest from "manifest" attribute in content map entry

3. Loop through result of 4 and Start the scheduling

    `var mocSchd = new hypermoc.CurriculumScheduler(dbConfig, attemptId, manifest, course.lang, testParams);`   
    
    `mocSchd.schedule((err, newManifest) => { // newManifest contains scheduled courses});`

    manifest - it can be manifest that is already fetched from url (in step 4 optional) or it can be the manifest url
    course.lang & testParams can be null