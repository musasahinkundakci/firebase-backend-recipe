const express = require("express")
const bodyParser = require("body-parser");
const cors = require("cors");

const FirebaseConfig = require("./FirebaseConfig");
const utilities = require("./utilities.js");
const req = require("express/lib/request");

const firestore = FirebaseConfig.firestore;
const admin = FirebaseConfig.admin;
const auth = FirebaseConfig.auth;

const app = express();

app.use(cors({ origin: true }));

app.use(bodyParser.json());

// ~~ RESTFUL CRUD WEB API ENDPOINTS ~~
app.post("/recipes", async (req, res) => {
    const authorizationHeader = req.headers["authorization"];
    if (!authorizationHeader) {
        res.status(401).json("Missing Authorization Header");
        return;
    }
    try {
        await utilities.authorizeUser(authorizationHeader, auth);
    } catch (error) {
        res.status(401).json({ err: error.message });
        console.log(error)
        return;
    }
    const newRecipe = JSON.parse(req.body)

    const missingFields = await utilities.validateRecipePostPut(newRecipe);
    if (missingFields) {
        res.json(`Recipe is not valid.Missing fields => ${missingFields}`);
        return;
    }
    const recipe = utilities.sanitizeRecipePostPut(newRecipe);
    try {
        const firestoreResponse = await firestore.collection("recipes").add(recipe);
        const recipeId = firestoreResponse.id;
        res.status(201).json({ id: recipeId })
    } catch (error) {
        console.log(error)
        res.status(400).json({ err: error.message });
    }
})
app.get("/recipes", async (req, res) => {
    const authorizationHeader = req.headers["authorization"];
    const queryObject = req.query;
    const category = queryObject?.category;
    const orderByField = queryObject?.orderByField;
    const orderByDirection = queryObject?.orderByDirection;
    const pageNumber = queryObject?.pageNumber;
    const perPage = queryObject?.perPage;

    let isAuth = false;
    let collectionRef = firestore.collection("recipes");
    try {
        await utilities.authorizeUser(authorizationHeader, auth);
        isAuth = true;
    } catch (error) {
        console.log(error);
        collectionRef = collectionRef.where("isPublished", "==", true);
    }
    if (category) {
        collectionRef = collectionRef.where("category", "==", category);
    }
    if (orderByField) {
        collectionRef = collectionRef.orderBy(orderByField, orderByDirection);
    }
    if (perPage) {
        collectionRef = collectionRef.limit(Number(perPage));
    }
    if (pageNumber > 0 && perPage) {
        const pageNumberMultiplier = pageNumber - 1;
        const offset = pageNumberMultiplier * perPage;
        collectionRef = collectionRef.offset(offset);
    }
    let recipeCount = 0;
    let countDocRef;
    if (isAuth) {
        countDocRef = firestore.collection("recipeCounts").doc("all");
    }
    else {
        countDocRef = firestore.collection("recipeCounts").doc("published");
    }
    const countDoc = await countDocRef.get();

    if (countDoc.exists) {
        const countDocData = countDoc.data();
        if (countDocData) {
            recipeCount = countDocData.count;
        }
    }
    try {
        const firestoreResponse = await collectionRef.get();
        const fetchedRecipes = firestoreResponse.docs.map((recipe) => {
            const id = recipe.id;
            const data = recipe.data();
            data.publishDate = data.publishDate._seconds;
            return { ...data, id };
        })
        const payload = {
            recipeCount,
            documents: fetchedRecipes
        }
        res.status(200).send(payload)
    } catch (error) {
        res.status(400).json({ err: error.message });
    }
})
app.put("/recipes/:id", async (req, res) => {
    const authorizationHeader = req.headers["authorization"];
    if (!authorizationHeader) {
        res.status(401).json("Missing Authorization Header");
        return;
    }
    try {
        await utilities.authorizeUser(authorizationHeader, auth);
    } catch (error) {
        res.status(401).json({ err: error.message });
        console.log(error)
        return;
    }
    const id = req.params.id;
    const newRecipe = req.body;
    const missingFields = await utilities.validateRecipePostPut(newRecipe);
    if (missingFields) {
        res.status(400).send(`Recipe is not valid. Missing/invalid fields: ${missingFields}`);
        return;
    }
    const recipe = utilities.sanitizeRecipePostPut(newRecipe);
    try {
        await firestore.collection("recipes").doc(id).set(recipe);
        // await firestore.collection("recipes").doc(id).set(recipe,{merge:true});
        res.status(200).send({ id });
    } catch (error) {
        res.status(400).send(error.message);
    }

})
app.delete("/recipes/:id", async (req, res) => {
    const authorizationHeader = req.headers["authorization"];
    if (!authorizationHeader) {
        res.status(401).json("Missing Authorization Header");
        return;
    }
    try {
        await utilities.authorizeUser(authorizationHeader, auth);
    } catch (error) {
        res.status(401).json({ err: error.message });
        console.log(error)
        return;
    }
    const id = req.params.id;
    try {
        await firestore.collection("recipes").doc(id).delete();
        res.status(200).send();
    } catch (error) {
        res.status(400).send(error.message)

    }
})
app.get("/", (req, res) => {
    res.json({ msg: "Hello from firebase function express API" })
})

//Local dev
if (process.env.NODE_ENV !== "production") {
    //Local Dev
    app.listen(3005, () => {
        console.log("api started");
    })
}

module.exports = app;