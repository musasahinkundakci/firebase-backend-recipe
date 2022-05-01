const FirebaseConfig = require("./FirebaseConfig");
const recipesApi = require("./recipesApi")
const functions = FirebaseConfig.functions;
const firestore = FirebaseConfig.firestore;
const storageBucket = FirebaseConfig.storageBucket;
const admin = FirebaseConfig.admin;

exports.api = functions.https.onRequest(recipesApi)

exports.newUserSignup = functions.auth.user().onCreate(async user => {
    await firestore.collection("user").doc(user.uid).set({
        name: user.displayName,
        email: user.email,
    });
    console.log("User Created => ", user.email);
})
exports.onCreateRecipe = functions.firestore.document("recipes/{recipeId}").onCreate(async (snapshot) => {
    const countDocRef = firestore.collection("recipeCounts").doc("all");//this going to refer all recipes
    const countDoc = await countDocRef.get();
    if (countDoc.exists) {
        countDocRef.update({ count: admin.firestore.FieldValue.increment(1) });
    }
    else {
        countDocRef.set({ count: 1 });
    }
    const recipe = snapshot.data();
    if (recipe.isPublished) {
        const countPublishedRef = firestore.collection("recipeCounts").doc("published");//published olanlar
        const countPublished = await countPublishedRef.get();
        if (countPublished.exists) {
            countPublishedRef.update({ count: admin.firestore.FieldValue.increment(1) });
        }
        else {
            countPublishedRef.set({ count: 1 });
        }
    }
}
);
exports.onDeleteRecipe = functions.firestore.document("recipes/{recipeId}").onDelete(
    async (snapshot) => {
        const recipe = snapshot.data();
        const imageUrl = recipe.imageUrl;
        if (imageUrl) {
            //image url varsa önce onu decode etmelyiz fileımızn nerde depolandığın göremek için
            const decodedUrl = decodeURIComponent(imageUrl);
            const startIndex = decodedUrl.indexOf("/o/") + 3;
            const endIndex = decodedUrl.indexOf("?");
            const fullFilePath = decodedUrl.substring(startIndex, endIndex);
            const file = storageBucket.file(fullFilePath);
            console.log(`Attempting to delete: ${fullFilePath}`);
            try {
                await file.delete();
                console.log("Succesfully deleted image.");
            } catch (error) {
                console.log(`Failed to delete file: ${error.message}`)
            }
        }
        const countDocRef = firestore.collection("recipeCounts").doc("all");//this going to refer all recipes
        const countDoc = await countDocRef.get();
        if (countDoc.exists) {
            countDocRef.update({ count: admin.firestore.FieldValue.increment(-1) });
        }
        else {
            countDocRef.set({ count: 0 });
        }
        if (recipe.isPublished) {
            const countPublishedRef = firestore.collection("recipeCounts").doc("published");//published olanlar
            const countPublished = await countPublishedRef.get();
            if (countPublished.exists) {
                countPublishedRef.update({ count: admin.firestore.FieldValue.increment(-1) });
            }
            else {
                countPublishedRef.set({ count: 0 });
            }
        }
    }
)
exports.onUpdateRecipe = functions.firestore.document("recipes/{recipeId}").onUpdate(async (changes) => {
    const oldRecipe = changes.before.data();
    const newRecipe = changes.after.data();
    let publishCount = 0;
    if (!oldRecipe.isPublished && newRecipe.isPublished) {
        publishCount += 1;
    }
    else if (oldRecipe.isPublished && !newRecipe.isPublished) {
        publishCount -= 1;
    }
    if (publishCount !== 0) {
        const publishCountDocRef = firestore.collection("recipeCounts").doc("published");
        const publishCountDoc = await publishCountDocRef.get();
        if (publishCountDoc.exists) {
            publishCountDocRef.update({
                count: admin.firestore.FieldValue.increment(publishCount)
            })
        }
        else {
            if (publishCount > 0) {
                publishCountDocRef.set({
                    count: publishCount
                })
            }
            else {
                publishCountDocRef.set({
                    count: 0
                })
            }
        }
    }
})
//https://crontab.guru/
//12 4 * * *
const runTimeOptions = {
    timeoutSeconds: 300,
    memory: "512MB"
};
exports.dailyCheckRecipePublishDate = functions.runWith(runTimeOptions).pubsub.schedule("0 0 * * *").onRun(async () => {
    console.log("dailyCheckRecipePublishDate() called - time to check!")
    const snap = await firestore.collection("recipes").where("isPublished", "==", false).get();
    snap.forEach(async doc => {
        const data = doc.data();
        const now = Date.now() / 1000;
        const isPublished = data.publishDate._seconds <= now ? true : false;
        if (isPublished) {
            console.log(`Recipe: ${data.name} is now published!`);
            firestore.collection("recipes").doc(doc.id).set({
                isPublished
            },
                { merge: true })//diğer field ları overirde etmesin diye

        }
    })
})

console.log("SERVER STARTED");