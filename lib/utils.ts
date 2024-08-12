import * as request from 'request';
import * as url from 'url';

export function fetchManifest(manifestUrl: string, done: (err: any, content?: any) => void): void {
    var message: string;
    // Setting the encoding to null means the body is a Buffer (not a string). This way we can easily remove any potential utf8 byteorder marking (BOM) from the response
    request.get({ uri: manifestUrl, encoding: null }, (error, response, body) => {
        if (error) {
            done("Failed loading manifest from: " + manifestUrl + ", Error: '" + error + "'");
        } else {
            try {
                done(null, JSON.parse(removeBom(body)));
            } catch (e) {
                done("Exception: '" + e + "' while passing: " + manifestUrl + ". Body: " + body.toString());
            }
        }
    });
}

// Function to extract `student_name` if available for display purpose.
// username can be username|student_name.
export function formatLearnerName(name: string): string {
    let username = "";
    if (name) {
        var names = name.split("|");
        if (names.length === 2) {
            if (names[0] !== "" && names[1] !== "") {
                username = names[1];
            } else if (names[1] === "") {
                username = names[0];
            }
        } else {
            username = names[0];
        }
    }
    return username;
}

// A function that removes the utf8 BOM and returns a string. It can be called both with a Buffer and a string
function removeBom(s: string): string;
function removeBom(s: Buffer): string;
function removeBom(s: any): string {
    if (s === null) {
        return null;
    } else if (typeof (s) === "string") {
        if (s.length >= 1 && s.charCodeAt(0) === 65279) {
            return s.slice(1);
        } else {
            return s;
        }
    } else if (s.length >= 3 && s[0] === 0xef && s[1] === 0xbb && s[2] === 0xbf) {
        return s.slice(3).toString('utf8');
    } else {
        return s.toString('utf8'); // Utf8 is the default so the argument is technicaly not needed.
    }
}