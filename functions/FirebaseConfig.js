const functions = require("firebase-functions");
const admin = require("firebase-admin");

const FIREBASE_STORAGE_BUCKET = "daily--b6c06.appspot.com"//env den aldık web uyglamsın

const apiFirebaseOptions = {
    ...functions.config().firebase,
    credential: admin.credential.applicationDefault()
}
//this credentail applicationDefault is going to enable our  backend have full access to our entire project this ignores all firebase rules
//jsonservice file da ekleyblrdik aynı işlev

admin.initializeApp(apiFirebaseOptions);
const firestore = admin.firestore();
const settings = { timestampsInSnapshots: true }
firestore.settings(settings);
const storageBucket = admin.storage().bucket(FIREBASE_STORAGE_BUCKET);
const auth = admin.auth()

module.exports = {
    functions,
    auth,
    firestore,
    storageBucket,
    admin,
}
