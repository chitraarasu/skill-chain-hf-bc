/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'; 
 
const { Gateway, Wallets } = require('fabric-network');
const FabricCAServices = require('fabric-ca-client');
const path = require('path');
const { buildCAClient, registerAndEnrollUser, enrollAdmin } = require('../../test-application/javascript/CAUtil.js');
const { buildCCPOrg1, buildWallet } = require('../../test-application/javascript/AppUtil.js');
const express = require("express");
const bodyParser = require("body-parser");
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const { log } = require('console');
var lodash = require('lodash');
require("dotenv").config();
 
const channelName = process.env.CHANNEL_NAME || 'mychannel';
const chaincodeName = process.env.CHAINCODE_NAME || 'basic';
 
const mspOrg1 = 'Org1MSP';
const walletPath = path.join(__dirname, 'wallet');
const org1UserId = 'javascriptAppUser';

function prettyJSONString(inputString) {
	return JSON.stringify(JSON.parse(inputString), null, 2);
}

const app = express();

app.use(bodyParser.urlencoded({
    extended: false
}));

app.use(bodyParser.json());

let _contract;

async function connect() {
	try {
		const ccp = buildCCPOrg1();
		const caClient = buildCAClient(FabricCAServices, ccp, 'ca.org1.example.com');
		const wallet = await buildWallet(Wallets, walletPath);
		await enrollAdmin(caClient, wallet, mspOrg1);
		await registerAndEnrollUser(caClient, wallet, mspOrg1, org1UserId, 'org1.department1');
		const gateway = new Gateway();
		try {
			await gateway.connect(ccp, {
				wallet,
				identity: org1UserId,
				discovery: { enabled: true, asLocalhost: true } 
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

app.get("/", async function (req, res)  {
	let result = await _contract.evaluateTransaction('GetAllUsers');
	return res.json(JSON.parse(prettyJSONString(result)));
});

async function checkIsEmailExist(email){
	try{
		let result = await _contract.evaluateTransaction('GetUserByEmail', email);
		console.log(JSON.parse(prettyJSONString(result)));
		return result != null;
	} catch(e) {
		console.log(e.message);
		return false;
	}
}

async function checkIsMobileExist(mobile){
	try{
		let result = await _contract.evaluateTransaction('GetUserByMobile', mobile);
		console.log(JSON.parse(prettyJSONString(result)));
		return result != null;
	} catch(e) {
		console.log(e.message);
		return false;
	}
}

async function checkIsUserNameExist(username){
	try{
		let result = await _contract.evaluateTransaction('GetUserByUserName', username);
		console.log(JSON.parse(prettyJSONString(result)));
		return result != null;
	} catch(e) {
		console.log(e.message);
		return false;
	} 
}

app.post("/validate_username", async function (req, res)  {
	var body = req.body;
	if(!await checkIsUserNameExist(body.username)){
		return res.json({
			"status": true,
			"message": "Valid username",
			"data": null,
		})
	} else {
		return res.status(400).json({ status: false, message: 'Username already taken!', data: null });
	}
});

app.post("/signup", async function (req, res)  {
	var body = req.body;
	if(await checkIsUserNameExist(body.user_name)){
		return res.status(400).json({
			"status": false,
			"message": "Username already taken!",
			"data": null
		}); 
	} 
	if(await checkIsEmailExist(body.email_id)){
		return res.status(400).json({
			"status": false,
			"message": "EmailId already exist!",
			"data": null
		});
	}
	if(await checkIsMobileExist(body.mobile_no)){
		return res.status(400).json({
			"status": false,
			"message": "Mobile number already exist!",
			"data": null
		});
	}
	addTryBlock(
		async ()=>{
	    let result = await _contract.submitTransaction('CreateUser', uuidv4(), body.full_name, body.user_name, body.dob, body.mobile_no, body.email_id, body.password, Date.now());
		let jsonResult = JSON.parse(prettyJSONString(result));
		console.log(jsonResult.id);
		let token = generateAccessToken({
			id: jsonResult.id,
			mobile: jsonResult.mobile_no,
			email: jsonResult.email_id,
		});
	
		return res.json({
			"status": true,
			"message": "Signup Successfull",
			"data": {
				"token": token,
			}
		});
		}
	);
    
});

function addTryBlock(func){
	try {
		func();
	} catch (e){
		return res.json({
			"status": false,
			"message": e.message,
			"data": null
		});
	}
}

function identifyInputType(input) {
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	const mobileRegex = /^[0-9]{10}$/;
	const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
  
	if (emailRegex.test(input)) {
	  return 'Email';
	} else if (mobileRegex.test(input)) {
	  return 'Mobile';
	} else if (usernameRegex.test(input)) {
	  return 'Username';
	} else {
	  return 'Unknown';
	}
  }
  

app.post("/signin", async function (req, res)  {
	var body = req.body;
	var emailMobileName = body.email_mobile_name;
	var password = body.password;

	addTryBlock(
		async ()=>{
		let result = await _contract.evaluateTransaction('GetAllUsers');
		var userList = JSON.parse(prettyJSONString(result));

		var currentUser;
		userList.forEach(element => {
			if(identifyInputType(emailMobileName) == "Email"){
				if(element.email_id == emailMobileName){
					currentUser = element;
				}
			}
			if(identifyInputType(emailMobileName) == "Mobile"){
				if(element.mobile_no == emailMobileName){
					currentUser = element;
				}
			} 
			if(identifyInputType(emailMobileName) == "Username"){
				if(element.user_name == emailMobileName){
					currentUser = element;
				}
			}
			if(identifyInputType(emailMobileName) == "Unknown"){
				return res.status(403).json({status: false, message: 'Invalid Credentials!', data: null});
			}
		}); 

		if(currentUser == null){
			return res.status(400).json({status: false, message: 'Invalid Credentials!', data: null});
		}   

		if(currentUser.password == password){
			let token = generateAccessToken({
				id: currentUser.id,
				mobile: currentUser.mobile_no,
				email: currentUser.email_id,
			});

			return res.json({
				"status": true,
				"message": "Login Successfull",
				"data": {
					"token": token,
				}
			});
		} else {
			return res.status(400).json({ status: false, message: 'Invalid Credentials!', data: null });
		}
	});
});

function generateAccessToken(user) {
	return jwt.sign(user, process.env.ACCESS_TOKEN_SECRET)
}

function authenticateToken(req, res, next) {
	const authHeader = req.headers['authorization']
	const token = authHeader && authHeader.split(' ')[1]
	if (token == null) return res.sendStatus(401)
  
	jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
	  console.log(err)
	  if (err) return res.sendStatus(403)
	  req.user = user
	  next()
	})
}

app.get("/profile", authenticateToken,  async function (req, res)  {
	addTryBlock(
		async ()=>{
		let result = await _contract.evaluateTransaction('GetUserById', req.user.id);
		var json = JSON.parse(prettyJSONString(result));
		var jsonWithOutPassword = lodash.omit(json, "password");
		return res.json({
			"status": true,
			"message": "",
			"data": jsonWithOutPassword
		});
	});
});

app.post("/change_password", async function (req, res)  {
	var body = req.body;
	addTryBlock(
		async ()=>{
		let result = await _contract.submitTransaction('UpdatePassword', body.mobile_no, body.password, Date.now());
		var json = JSON.parse(prettyJSONString(result));
		var jsonWithOutPassword = lodash.omit(json, "password");
		return res.json({
			"status": true, 
			"message": "Password Updated",
			"data": jsonWithOutPassword
		});
	});
}); 

let port = process.env.PORT;
if (port == null || port == "") {
    port = 3000;
}

app.listen(port, function (req, res) {
    console.log("server has started successfully!");
});