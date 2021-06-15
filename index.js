'use strict';

const https = require('https');
const querystring = require('querystring');
const config = require('./config.json');

const CASTLE_API_SECRET = config.CASTLE_API_SECRET;
const CASTLE_APP_ID = config.CASTLE_APP_ID;

// Modify the routes according to your use case
const routes = [
  {
    // Castle event
    event: '$registration', // function to be executed if the route is matched
    method: 'POST', // HTTP method of the matched request
    pathname: '/users/sign_up', // pathname of the matched request
  },
];

/**
 * Generate HTML response
 */
function generateHTMLResponse() {
  return `
  <html>
    <head>
      <link rel="icon" href="data:,">
      <script src="//d2t77mnxyo7adj.cloudfront.net/v1/c.js?${CASTLE_APP_ID}"></script>

      <script>
        window.onload = function() {
          var form = document.getElementById('registration-form');

          form.addEventListener('submit', function(evt) {
            evt.preventDefault();

            // Get the one-time request token from Castle
            _castle('createRequestToken').then(function(token){

              // Populate a hidden <input> field named 'castle_request_token'
              var hiddenInput = document.createElement('input');
              hiddenInput.setAttribute('type', 'hidden');
              hiddenInput.setAttribute('name', 'castle_request_token');
              hiddenInput.setAttribute('value', token);

              // Add the 'castle_request_token' to the HTML form
              form.appendChild(hiddenInput);

              form.submit();
            });

          });
        }
      </script>
    </head>

  <body>
    <form action= "/users/sign_up" method="POST" id="registration-form">
      <label for="email">Email</label>
      <input type="text" name= "email"><br><br>
      <input type="submit" value= "submit">
  </body>
  </html>
`;
}

/**
 * Return prefiltered request headers
 * @param {object} requestHeaders
 */
function scrubHeaders(requestHeaders) {
  const scrubbedHeaders = ['cookie', 'authorization'];

  if (!requestHeaders) {
    return {};
  }

  return Object.keys(requestHeaders).reduce((acc, headerKey) => {
    const isScrubbed = scrubbedHeaders.includes(headerKey.toLowerCase());
    return {
      ...acc,
      [headerKey]: isScrubbed ? true : requestHeaders[headerKey][0].value,
    };
  }, {});
}

/**
 * Return the result of the POST /filter call to Castle API
 * @param {string} event
 * @param {object} request
 */
async function filterRequest(event, request) {
  let requestToken = '';
  let user = {};

  if (request.body && request.body.data) {
    const body = Buffer.from(request.body.data, 'base64').toString();

    /* HTML forms send the data in query string format. Parse it. */
    const params = querystring.parse(body);

    requestToken = params['castle_request_token'];

    if (params['email']) {
      user = { email: params['email'] };
    }
  }

  const castleRequestBody = JSON.stringify({
    event,
    request_token: requestToken,
    user: user, // optional
    context: {
      ip: request.clientIp,
      headers: scrubHeaders(request.headers),
    },
  });

  const authorizationString = Buffer.from(`:${CASTLE_API_SECRET}`).toString(
    'base64'
  );

  const requestOptions = {
    hostname: 'api.castle.io',
    path: '/v1/filter',
    method: 'POST',
    headers: {
      Authorization: `Basic ${authorizationString}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(castleRequestBody),
    },
  };

  return new Promise(function (resolve, reject) {
    const castleApiRequest = https.request(requestOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        return resolve(JSON.parse(data));
      });
    });

    castleApiRequest.on('error', () => {
      reject({
        // failover action on error
        policy: {
          action: 'allow',
        },
        failover: true,
        failover_reason: 'something went wrong with the request to Castle',
      });
    });

    // use its "timeout" event to abort the request
    castleApiRequest.on('timeout', () => {
      castleApiRequest.abort();
      reject({
        // failover action on timeout
        policy: {
          action: 'allow',
        },
        failover: true,
        failover_reason: 'request timeout to Castle',
      });
    });
    castleApiRequest.write(castleRequestBody);
    castleApiRequest.end();
  });
}

/**
 * Return matched action or undefined
 * @param {object} request object
 */
function findMatchingRoute(request) {
  for (const route of routes) {
    if (request.uri === route.pathname && request.method === route.method) {
      return route;
    }
  }
}

/**
 * generate response
 * @param {string} body
 * @param {number} status
 * @param {string} contentType
 */
function generateResponse(body, status, contentType) {
  return {
    body: body,
    status: status,
    headers: {
      'cache-control': [
        {
          key: 'Cache-Control',
          value: 'max-age=100',
        },
      ],
      'content-type': [
        {
          key: 'Content-Type',
          value: contentType,
        },
      ],
      'access-control-allow-origin': [
        {
          key: 'Access-Control-Allow-Origin',
          value: '*',
        },
      ],
      'access-control-allow-methods': [
        {
          key: 'Access-Control-Allow-Methods',
          value: 'GET, HEAD, OPTIONS, POST',
        },
      ],
    },
  };
}

/**
 * Process the received request
 * @param {object} request
 */
async function handleRequest(request) {
  if (!CASTLE_API_SECRET) {
    throw new Error('CASTLE_API_SECRET not provided');
  }

  if (request.uri === '/') {
    // render page with the form
    if (!CASTLE_APP_ID) {
      throw new Error('CASTLE_APP_ID not provided');
    }
    return generateResponse(
      generateHTMLResponse(),
      200,
      'text/html;charset=UTF-8'
    );
  }

  const route = findMatchingRoute(request);

  if (!route) {
    // return request;
    return generateResponse('', 403, 'text/html;charset=UTF-8');
  }

  const castleResponseJSON = await filterRequest(route.event, request);
  const castleResponseJSONString = JSON.stringify(castleResponseJSON);

  if (castleResponseJSON && castleResponseJSON.policy.action === 'deny') {
    // deny response
    return generateResponse(castleResponseJSONString, 403, 'application/json');
  }

  // Respond with result fetched from Castle API or fetch the request
  // return request;
  return generateResponse(castleResponseJSONString, 200, 'application/json');
}

exports.handler = async (event, context, callback) => {
  const request = event.Records[0].cf.request;
  const response = await handleRequest(request);

  callback(null, response);
};
