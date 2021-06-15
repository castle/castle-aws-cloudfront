const sample = require('./requests/cloudfront_request.json');
const handler = require('./index.js').handler;

handler(sample, null, (_, response) => {
  console.log(response);
});
