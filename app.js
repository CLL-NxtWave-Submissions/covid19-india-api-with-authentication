const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

const SECRET_KEY_FOR_JWT = "AUTHORIZATION_SECRET";

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
    Express.js middleware to check
    user authorization for the 
    requested resource.

*/
const checkUserAuthorization = (req, res, next) => {
  const authTokenStringFromRequestHeader = req.headers.authorization;

  if (authTokenStringFromRequestHeader === undefined) {
    res.status(401);
    res.send("Invalid JWT Token");
  } else {
    const jwtFromAuthTokenString = authTokenStringFromRequestHeader.split(
      " "
    )[1]; // token string format: "Bearer JSON_WEB_TOKEN"

    jwt.verify(
      jwtFromAuthTokenString,
      SECRET_KEY_FOR_JWT,
      (hasVerificationError, userIdentifiablePayloadOnSuccess) => {
        if (hasVerificationError) {
          res.status(401);
          res.send("Invalid JWT Token");
        } else {
          next(); // Control given to next middleware/handler for
          // the API end-point matching the user request.
        }
      }
    );
  }
};

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
      const jwtToken = jwt.sign(userIdentifiablePayload, SECRET_KEY_FOR_JWT);
      res.send({ jwtToken });
    } else {
      res.status(400);
      res.send("Invalid password");
    }
  }
});

/*
    End-Point 2     : GET /states
    Header Name     : Authorization
    Header Value    : Bearer JSON_WEB_TOKEN
    -----------------
    To fetch data of all states from
    the state table after prior user
    login and with Authorization header
    that has Bearer token as the generated
    JSON Web Token at login. 
*/
app.get("/states", checkUserAuthorization, async (req, res) => {
  const queryToFetchDataOfAllStates = `
    SELECT *
    FROM state;
    `;

  const allStatesData = await covid19IndiaDBConnectionObj.all(
    queryToFetchDataOfAllStates
  );
  const allStatesProcessedData = allStatesData.map((currentStateData) => ({
    stateId: currentStateData.state_id,
    stateName: currentStateData.state_name,
    population: currentStateData.population,
  }));
  res.send(allStatesProcessedData);
});

/*
    End-Point 3  : GET /states/:stateId
    Header Name  : Authorization
    Header Value : Bearer JSON_WEB_TOKEN
    --------------
    To fetch data of specific state with
    id: stateId, after ensuring user has
    authorization to access this data,
    through the 
    middleware: checkUserAuthorization
*/
app.get("/states/:stateId", checkUserAuthorization, async (req, res) => {
  const { stateId } = req.params;
  const queryToGetSpecificStateData = `
    SELECT *
    FROM state
    WHERE state_id = ${stateId};
    `;

  const specificStateData = await covid19IndiaDBConnectionObj.get(
    queryToGetSpecificStateData
  );
  const processedSpecificStateData = {
    stateId: specificStateData.state_id,
    stateName: specificStateData.state_name,
    population: specificStateData.population,
  };

  res.send(processedSpecificStateData);
});

/*
    End-Point 4  : POST /districts
    Header Name  : Authorization,
    Header Value : Bearer JSON_WEB_TOKEN
    --------------
    To add new district data to
    the district table after checking 
    user authorization through the 
    middleware: checkUserAuthorization
*/
app.post("/districts", checkUserAuthorization, async (req, res) => {
  const { districtName, stateId, cases, cured, active, deaths } = req.body;

  const queryToAddNewDistrictData = `
    INSERT INTO
        district (district_name, state_id, cases, cured, active, deaths)
    VALUES
        ('${districtName}', ${stateId}, ${cases}, ${cured}, ${active}, ${deaths});
    `;

  const addNewDistrictDBResponse = await covid19IndiaDBConnectionObj.run(
    queryToAddNewDistrictData
  );
  res.send("District Successfully Added");
});

/*
    End-Point 5  : GET /districts/:districtId
    Header Name  : Authorization
    Header Value : Bearer JSON_WEB_TOKEN
    --------------
    To fetch specific district data from the
    district table, after checking user 
    authorization through
    middleware: checkUserAuthorization
*/
app.get("/districts/:districtId", checkUserAuthorization, async (req, res) => {
  const { districtId } = req.params;
  const queryToGetSpecificDistrictData = `
      SELECT *
      FROM district
      WHERE district_id = ${districtId};
      `;

  const specificDistrictData = await covid19IndiaDBConnectionObj.get(
    queryToGetSpecificDistrictData
  );
  const processedSpecificDistrictData = {
    districtId: specificDistrictData.district_id,
    districtName: specificDistrictData.district_name,
    stateId: specificDistrictData.state_id,
    cases: specificDistrictData.cases,
    cured: specificDistrictData.cured,
    active: specificDistrictData.active,
    deaths: specificDistrictData.deaths,
  };

  res.send(processedSpecificDistrictData);
});

/*
    End-Point 6  : DELETE /districts/:districtId
    Header Name  : Authorization
    Header Value : Bearer JSON_WEB_TOKEN
    --------------
    To delete specific district with
    id: districtId, after checking user
    authorization with 
    middleware: checkUserAuthorization
*/
app.delete(
  "/districts/:districtId",
  checkUserAuthorization,
  async (req, res) => {
    const { districtId } = req.params;
    const queryToDeleteSpecificDistrictData = `
    DELETE FROM
        district
    WHERE
        district_id = ${districtId};
    `;

    await covid19IndiaDBConnectionObj.run(queryToDeleteSpecificDistrictData);
    res.send("District Removed");
  }
);

/*
  End-Point 7  : PUT /districts/:districtId
  Header Name  : Authorization
  Header Value : Bearer JSON_WEB_TOKEN
  --------------
  To update specific district data with
  id: districtId, after checking user
  authorization with the
  middleware: checkUserAuthorization
*/
app.put("/districts/:districtId", checkUserAuthorization, async (req, res) => {
  const { districtId } = req.params;
  const { districtName, stateId, cases, cured, active, deaths } = req.body;

  const queryToUpdateSpecificDistrict = `
    UPDATE 
        district
    SET
        district_name = '${districtName}',
        state_id = ${stateId},
        cases = ${cases},
        cured = ${cured},
        active = ${active},
        deaths = ${deaths}
    WHERE
        district_id = ${districtId};
    `;

  await covid19IndiaDBConnectionObj.run(queryToUpdateSpecificDistrict);
  res.send("District Details Updated");
});

/*
    End-Point 8  : GET /states/:stateId/stats
    Header Name  : Authorization
    Header Value : Bearer JSON_WEB_TOKEN
    --------------
    To fetch aggregated stats of covid-19
    cases for a specific state, combining all
    districts data within the state. Request
    is served only after checking user authorization
    with middleware: checkUserAuthorization

*/
app.get("/states/:stateId/stats", checkUserAuthorization, async (req, res) => {
  const { stateId } = req.params;

  const queryToFetchAggregatedCovidDataForSpecificState = `
    SELECT 
        SUM(cases) AS total_cases,
        SUM(cured) AS total_cured,
        SUM(active) AS total_active,
        SUM(deaths) AS total_deaths
    FROM
        district
    WHERE
        state_id = ${stateId};
    `;

  const aggregatedCovidDataForSpecificState = await covid19IndiaDBConnectionObj.get(
    queryToFetchAggregatedCovidDataForSpecificState
  );
  const processedAggregatedCovidDataForSpecificState = {
    totalCases: aggregatedCovidDataForSpecificState.total_cases,
    totalCured: aggregatedCovidDataForSpecificState.total_cured,
    totalActive: aggregatedCovidDataForSpecificState.total_active,
    totalDeaths: aggregatedCovidDataForSpecificState.total_deaths,
  };

  res.send(processedAggregatedCovidDataForSpecificState);
});

module.exports = app;
