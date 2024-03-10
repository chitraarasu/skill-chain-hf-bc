/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

"use strict";

const { Gateway, Wallets } = require("fabric-network");
const FabricCAServices = require("fabric-ca-client");
const path = require("path");
const {
  buildCAClient,
  registerAndEnrollUser,
  enrollAdmin,
} = require("../../test-application/javascript/CAUtil.js");
const {
  buildCCPOrg1,
  buildWallet,
} = require("../../test-application/javascript/AppUtil.js");
const express = require("express");
const bodyParser = require("body-parser");
const { v4: uuidv4 } = require("uuid");
const jwt = require("jsonwebtoken");
const { log } = require("console");
var lodash = require("lodash");
require("dotenv").config();

const channelName = process.env.CHANNEL_NAME || "mychannel";
const chaincodeName = process.env.CHAINCODE_NAME || "basic";

const mspOrg1 = "Org1MSP";
const walletPath = path.join(__dirname, "wallet");
const org1UserId = "javascriptAppUser";

function prettyJSONString(inputString) {
  return JSON.stringify(JSON.parse(inputString), null, 2);
}

const app = express();

app.use(
  bodyParser.urlencoded({
    extended: false,
  })
);

app.use(bodyParser.json());

let _contract;

async function connect() {
  try {
    const ccp = buildCCPOrg1();
    const caClient = buildCAClient(
      FabricCAServices,
      ccp,
      "ca.org1.example.com"
    );
    const wallet = await buildWallet(Wallets, walletPath);
    await enrollAdmin(caClient, wallet, mspOrg1);
    await registerAndEnrollUser(
      caClient,
      wallet,
      mspOrg1,
      org1UserId,
      "org1.department1"
    );
    const gateway = new Gateway();
    try {
      await gateway.connect(ccp, {
        wallet,
        identity: org1UserId,
        discovery: { enabled: true, asLocalhost: true },
      });

      const network = await gateway.getNetwork(channelName);

      _contract = network.getContract(chaincodeName);

      console.log("Connection Successfull!");
    } finally {
      // gateway.disconnect();
    }
  } catch (error) {
    console.error(`******** FAILED to run the application: ${error}`);
    process.exit(1);
  }
}

connect();

app.get("/", async function (req, res) {
  let result = await _contract.evaluateTransaction("GetAllUsers");
  return res.json(JSON.parse(prettyJSONString(result)));
});

app.post("/signup", async function (req, res) {
  var body = req.body;
  try {
    let result = await _contract.submitTransaction(
      "CreateUser",
      body.name,
      body.address,
      body.image_url,
      body.mobile_no,
      body.email_id,
      generateUniqueId(),
      body.status,
      body.password,
      Date.now()
    );

    let jsonResult = JSON.parse(prettyJSONString(result));
    let token = generateAccessToken({
      id: jsonResult.id,
      public_id: jsonResult.public_id,
      email: jsonResult.email_id,
    });

    return res.json({
      status: true,
      message: "Signup Successfull",
      data: {
        token: token,
      },
    });
  } catch (e) {
    return getError(e, res);
  }
});

app.post("/login", async function (req, res) {
  var body = req.body;

  try {
    let result = await _contract.submitTransaction(
      "ValidateUser",
      body.public_id,
      body.password
    );

    let jsonResult = JSON.parse(prettyJSONString(result));
    let token = generateAccessToken({
      id: jsonResult.id,
      public_id: jsonResult.public_id,
      email: jsonResult.email_id,
    });
    return res.json({
      status: true,
      message: "Login Successfull",
      data: {
        token: token,
      },
    });
  } catch (e) {
    return getError(e, res);
  }

  // return res
  //   .status(400)
  //   .json({ status: false, message: "Username already taken!", data: null });
});

app.get("/user_from_public_id", async function (req, res) {
  var body = req.body;
  try {
    let result = await _contract.evaluateTransaction("GetAllUsers");
    var json = JSON.parse(prettyJSONString(result));
    console.log(json);

    const matchingRecords = json
      .filter((item) => body.public_ids.includes(item.Key))
      .map((item) => {
        const { password, ...recordWithoutPassword } = item.Record;
        return recordWithoutPassword;
      });
    // var jsonWithOutPassword = lodash.omit(json, "password");
    return res.json({
      status: matchingRecords.length > 0,
      message: matchingRecords.length > 0 ? "User found" : "No users found!",
      data: matchingRecords.length > 0 ? matchingRecords : null,
    });
  } catch (e) {
    return getError(e, res);
  }
});

app.post("/add_skill", async function (req, res) {
  var body = req.body;
  try {
    let responseData = [];
    await Promise.all(
      body.users.map(async (element) => {
        try {
          let result = await _contract.submitTransaction(
            "AddSkill",
            element.public_id,
            body.skill_id,
            element.skill_doc_url,
            element.institute_id
          );
          var json = JSON.parse(prettyJSONString(result));
          responseData.push(true);
        } catch (e) {
          responseData.push(false);
        }
      })
    );
    console.log(responseData);
    return res.json({
      status: true,
      message: "Add Skill Response",
      data: responseData,
    });
  } catch (e) {
    return getError(e, res);
  }
});

// Utils

function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (token == null) return res.sendStatus(401);

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
    console.log(err);
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

function generateAccessToken(user) {
  return jwt.sign(user, process.env.ACCESS_TOKEN_SECRET);
}

function getError(e, res) {
  return res.json({
    status: false,
    message: e.message,
    data: null,
  });
}

function generateUniqueId() {
  const timestamp = Date.now().toString();
  const randomNum = Math.floor(Math.random() * 1000000)
    .toString()
    .padStart(6, "0");
  const uniqueId = timestamp + randomNum;
  return uniqueId.slice(-12);
}

let port = process.env.PORT;
if (port == null || port == "") {
  port = 3000;
}

app.listen(port, function (req, res) {
  console.log("server has started successfully!");
});
