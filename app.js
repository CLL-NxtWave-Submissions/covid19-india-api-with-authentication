const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

const secretKeyForJWT = "AUTHORIZATION_SECRET";

const covid19IndiaDatabaseFilePath = path.join(
  __dirname,
  "covid19IndiaPortal.db"
);
const sqliteDriver = sqlite3.Database;

let covid19IndiaDBConnectionObj = null;

const initializeDBAndServer = async () => {
  try {
    covid19IndiaDBConnectionObj = await open({
      filename: covid19IndiaDatabaseFilePath,
      driver: sqliteDriver,
    });

    app.listen(3000, () => {
      console.log("Server running and listening on port 3000 !");
      console.log("Base URL - http://localhost:3000");
    });
  } catch (exception) {
    console.log(`Error initializing database or server: ${exception.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();

/*
    End-Point 1: POST /login
    ------------
    To accept or reject user login 
    request based on input credentials
    and generate a JSON Web Token (JWT)
    for authorization to requested resources
    in subsequent api requests, after successful
    login.
*/

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const queryToGetRequestedUserData = `
    SELECT *
    FROM user
    WHERE username = '${username}';
    `;

  const requestedUserData = await covid19IndiaDBConnectionObj.get(
    queryToGetRequestedUserData
  );
  if (requestedUserData === undefined) {
    res.status(400);
    res.send("Invalid user");
  } else {
    // Valid user
    const isPasswordValid = await bcrypt.compare(
      password,
      requestedUserData.password
    );
    if (isPasswordValid) {
      const userIdentifiablePayload = { username };
      const jwtToken = jwt.sign(userIdentifiablePayload, secretKeyForJWT);
      res.send({ jwtToken });
    } else {
      res.status(400);
      res.send("Invalid password");
    }
  }
});

module.exports = app;
