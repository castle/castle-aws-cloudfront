'use strict';

const https = require("https");

const querystring = require('querystring');

/********************************************/

const riskThreshold = 0.9;

const apiKeyObj = require('./apiKey.json');
const routes = require('./routes.json');

/********************************************/

const apiKey = apiKeyObj.apiKey;

function getCastleClientID(request) {

  let obj = {}

  return new Promise(function(resolve, reject) {

    // is the client_id in the body?
    if (request.hasOwnProperty("body") && request.body.hasOwnProperty("data")) {
      const inboundBody = Buffer.from(request.body.data, 'base64').toString();
      const params = querystring.parse(inboundBody);

      obj.client_id = params["client_id"];
      obj.username = params["username"];

      return resolve(obj);
    }

    return resolve({});
  })
}

async function getCastleAssessment(request, castleEventName) {

  let props = await getCastleClientID(request);

  return new Promise(function(resolve, reject) {

    console.log("the castle client id is: " + props.client_id)

    let body = JSON.stringify({
      event: castleEventName,
      user_traits: {
        email: props.username
      },
      context: {
        client_id: props.client_id,
        ip: request.clientIp,
        headers: scrubHeaders(request.headers)
      }
    });

    const authzStringBuffer = new Buffer.from(`:${apiKey}`);

    const authzString = "Basic " + authzStringBuffer.toString('base64');

    let options = {
      hostname: "api.castle.io",
      path: "/v1/authenticate",
      method: "POST",
      headers: {
        Authorization: authzString,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body)
      }
    };

    https
      .request(options, res => {
        let data = "";
        res.on("data", d => {
          data += d;
        });
        res.on("end", () => {
          console.log("the http response from castle is: ");
          console.log(data);
          return resolve(JSON.parse(data));
        });
      })
      .on("error", () => {
        console.error;
        return reject({error: "something went wrong with the request to Castle"});
      })
      .end(body);
  });
}

function getCastleEventName(request) {
  for (const route of routes) {
    if (request.method === route.method && request.uri === route.uri) {
      return route.event;
    }
  }
  return "";
}

function scrubHeaders(requestHeaders) {

  var scrubbedHeaders = {};

  for (var header in requestHeaders) {

    const headersToExclude = ['cookie', 'authorization'];

    if (!(headersToExclude.includes(header))) {
      scrubbedHeaders[header] = requestHeaders[header][0].value;
    }
  }
  return scrubbedHeaders;
}

exports.handler = (event, context, callback) => {

    const request = event.Records[0].cf.request;

    console.dir(request);

    const castleEventName = getCastleEventName(request);

    let response;

    if (castleEventName === "") {
      console.log("rejecting request");
      response = {
        status: '405',
        statusDescription: 'Method Not Allowed'
      };
      callback(null, response);
      return;
    }

    /******************************************************/
    // the request is protected by Castle, so let's see what
    // Castle says about it
    getCastleAssessment(request, castleEventName)
    .then(castleAssessment => {
      console.log("the final castle assessment is:");
      console.dir(castleAssessment);
      const riskScore = castleAssessment.risk;

      console.log("the risk score is: " + riskScore);

      let prodStatus;

      if (riskScore > riskThreshold || castleAssessment.action === "deny" ) {
        prodStatus = "403";
      }
      else {
        prodStatus = "200";
      }

      let obj = {
        prodStatus: prodStatus,
        riskScore: riskScore,
        riskThreshold: riskThreshold,
        castleAssessment: castleAssessment
      };

      const resp = {
        status: '200',
        statusDescription: 'OK',
        headers: {
            'cache-control': [{
                key: 'Cache-Control',
                value: 'max-age=100'
            }],
            'content-type': [{
                key: 'Content-Type',
                value: 'application/json'
            }],
            'access-control-allow-origin': [{
                key: 'Access-Control-Allow-Origin',
                value: '*'
            }],
            'access-control-allow-methods': [{
                key: 'Access-Control-Allow-Methods',
                value: 'GET, HEAD, POST'
            }]
        },
        body: JSON.stringify(obj)
      };
      callback(null, resp);
    })
    .catch(error => {
      const errorResponse = {
        status: '200',
        statusDescription: 'OK',
        headers: {
            'cache-control': [{
                key: 'Cache-Control',
                value: 'max-age=100'
            }],
            'content-type': [{
                key: 'Content-Type',
                value: 'application/json'
            }]
        },
        body: JSON.stringify(error)
      };
      callback(null, errorResponse);      
    });
};