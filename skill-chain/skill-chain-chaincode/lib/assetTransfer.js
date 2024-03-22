"use strict";

const stringify = require("json-stringify-deterministic");
const sortKeysRecursive = require("sort-keys-recursive");
const { Contract } = require("fabric-contract-api");

class AssetTransfer extends Contract {
  /// Create New User
  async CreateUser(
    ctx,
    name,
    address,
    imageUrl,
    mobileNo,
    emailId,
    publicId,
    status,
    password,
    createdAt
  ) {
    const user = {
      name: name,
      address: address,
      imageUrl: imageUrl,
      mobile_no: mobileNo,
      email_id: emailId,
      public_id: publicId,
      status: true,
      password: password,
      skills: [],
      created_at: createdAt,
    };

    const exists = await this.CheckEmailExist(ctx, user.email_id);
    if (exists) {
      throw new Error(`The asset email_id already exists`);
    }
    try {
      await ctx.stub.putState(
        publicId,
        Buffer.from(stringify(sortKeysRecursive(user)))
      );
    } catch (e) {
      console.log(e);
    }
    return JSON.stringify(user);
  }

  /// Login user using publicid and password
  async ValidateUser(ctx, publicId, password) {
    const exists = await this.CheckPublicIdPasswordExist(
      ctx,
      publicId,
      password
    );
    if (exists == null) {
      throw new Error(`Invalid user details!`);
    }
    return exists;
  }

  // Use this to
  // 1. Get user by public ids
  async GetAllUsers(ctx) {
    const iterator = await ctx.stub.getStateByRange("", "");
    let results = await this._GetAllResults(iterator, false);
    return JSON.stringify(results);
  }

  // Add skill to user
  async AddSkill(ctx, userId, skillId, skillDocUrl, instituteId) {
    const exists = await this.GetUserById(ctx, userId);
    var matchedData;
    exists.skills.forEach((element) => {
      if (element.skill_id === skillId) {
        matchedData = element;
      }
    });
    if (matchedData != null) {
      throw new Error(`Skill already added.`);
    }
    let skill = {
      skill_id: skillId,
      skill_doc: skillDocUrl,
      institute_id: instituteId,
    };
    exists.skills.push(skill);
    await ctx.stub.putState(
      userId,
      Buffer.from(stringify(sortKeysRecursive(exists)))
    );
    return exists;
  }

  async ChangeProfile(ctx, userId, profileUrl) {
    const exists = await this.GetUserById(ctx, userId);

    if (exists == null) {
      throw new Error(`User not found!`);
    }
    exists.imageUrl = profileUrl;
    await ctx.stub.putState(
      userId,
      Buffer.from(stringify(sortKeysRecursive(exists)))
    );
    return exists;
  }

  // // DeleteAsset deletes an given asset from the world state.
  // async DeleteAsset(ctx, id) {
  //     const exists = await this.CheckUserExistById(ctx, id);
  //     if (!exists) {
  //         throw new Error(`The asset ${id} does not exist`);
  //     }
  //     return ctx.stub.deleteState(id);
  // }

  // // TransferAsset updates the owner field of asset with given id in the world state.
  // async TransferAsset(ctx, id, newOwner) {
  //     const assetString = await this.GetUserById(ctx, id);
  //     const asset = JSON.parse(assetString);
  //     const oldOwner = asset.Owner;
  //     asset.Owner = newOwner;
  //     // we insert data in alphabetic order using 'json-stringify-deterministic' and 'sort-keys-recursive'
  //     await ctx.stub.putState(id, Buffer.from(stringify(sortKeysRecursive(asset))));
  //     return oldOwner;
  // }

  /// Validation

  async CheckEmailExist(ctx, email) {
    let queryString = {};
    queryString.selector = {};
    queryString.selector.email_id = email;
    const assetJSON = await this.GetQueryResultForQueryString(
      ctx,
      JSON.stringify(queryString)
    );
    return assetJSON && assetJSON.length > 0;
  }

  async CheckPublicIdPasswordExist(ctx, publicId, password) {
    let queryString = {};
    queryString.selector = {};
    queryString.selector.public_id = publicId;
    queryString.selector.password = password;
    const assetJSON = await this.GetQueryResultForQueryString(
      ctx,
      JSON.stringify(queryString)
    );
    return assetJSON;
  }

  /// Query

  async GetQueryResultForQueryString(ctx, queryString) {
    let resultsIterator = await ctx.stub.getQueryResult(queryString);
    let results = await this._GetAllResults(resultsIterator, false);
    return results;
  }

  async GetUserById(ctx, id) {
    const assetJSON = await ctx.stub.getState(id);
    if (!assetJSON || assetJSON.length === 0) {
      throw new Error(`The asset ${id} does not exist`);
    }
    return JSON.parse(assetJSON.toString());
  }

  /// Utils

  async _GetAllResults(iterator, isHistory) {
    let allResults = [];
    let res = await iterator.next();
    while (!res.done) {
      if (res.value && res.value.value.toString()) {
        let jsonRes = {};
        console.log(res.value.value.toString("utf8"));
        if (isHistory && isHistory === true) {
          jsonRes.TxId = res.value.txId;
          jsonRes.Timestamp = res.value.timestamp;
          try {
            jsonRes.Value = JSON.parse(res.value.value.toString("utf8"));
          } catch (err) {
            console.log(err);
            jsonRes.Value = res.value.value.toString("utf8");
          }
        } else {
          jsonRes.Key = res.value.key;
          try {
            jsonRes.Record = JSON.parse(res.value.value.toString("utf8"));
          } catch (err) {
            console.log(err);
            jsonRes.Record = res.value.value.toString("utf8");
          }
        }
        allResults.push(jsonRes);
      }
      res = await iterator.next();
    }
    iterator.close();
    return allResults;
  }

  /// Temp
  async AddDummyUsers(ctx, count) {
    try {
      for (let i = 1; i <= count; i++) {
        let res = await this.CreateUser(
          ctx,
          stringify(i),
          "user name" + i,
          "address " + i,
          "imageUrl_" + i,
          "mobileNo_" + i,
          "emailId_" + i,
          "publicId_" + i,
          true,
          "123456",
          "2023-11-09T10:37:26.031Z"
        );
      }
      return "Success";
    } catch (error) {
      return Error(error);
    }
  }
}

module.exports = AssetTransfer;
