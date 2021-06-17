<div align="center">
  <img align="center" alt="Castle logo" src='./assets/castle-logo.svg' width='150'/>
</div>
<div align="center">
  <h1>Castle at the Edge with AWS Lambda and CloudFront
</h1>
</div>
<div align="center">
  <image alt="Package version" src="https://img.shields.io/github/package-json/v/castle/castle-aws-cloudfront-sample"/>
  <image alt="License" src="https://img.shields.io/github/license/castle/castle-aws-cloudfront-sample"/>
</div>

## Overview

AWS CloudFront allows you to distribute your content globally so that your users can access your content from a source as close to home as possible. AWS Lambda@Edge allows you to add the power of Lambda functions to requests coming in to your CloudFront distribution.

This repo will allow you to attach Castle to a Lambda@Edge function, so that you can block bot traffic at the edge, before malicious requests reach your `/users/sign_up` endpoint (or whatever other endpoint you want to protect).

## How it works

Once you've installed this Lambda function, it will listen for POSTs to the
`/users/sign_up`

route.

The POST should include a Castle `castle_request_token` in the body of the request. Click [here](https://castle.io/filter-api/) to learn more about how to include a Castle `request_token` in a POST.

When the Lambda function receives the POST, it will in turn make a POST to Castle, and receive a verdict (`policy[action]`) and risk score in return if the verdict is "deny", then the function will respond with a 403.

## Prerequisites

You'll need a Castle account and an AWS account to get started.

### Castle

If you don't have a Castle account already, you can [set up a free trial](https://dashboard.castle.io/signup/new). You will need your Castle API Secret, which can be found in the Settings section of your Castle dashboard.

## Installation

### CloudFront

Lambda@Edge requires a CloudFront distribution to function. So, even though this particular solution will not be serving static files from an S3 bucket via CloudFront, you still need to set up a CloudFront distribution to attach the Lambda@Edge function to.

A couple of notes as you set up your CloudFront distribution:

* You must explicitly allow POST requests. (By default, POST requests are not allowed. You need to allow `GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE` HTTP Methods)
* Ignore the Lambda section for now. We're going to attach the Lambda function "manually".

### Prepare the repo

Before you set up your Lambda function, you need to prepare this repo, which involves three main steps:

1. download the repo
2. install dependencies
3. add your Castle API Secret
4. create a .zip archive

#### Download the repo

`git clone https://github.com/castle/castle-aws-cloudfront-sample`

#### Install dependencies

`cd castle-aws-cloudfront-sample`

`npm install`

#### Add your Castle API key

Unlike standard Lambda functions, Lambda@Edge functions do *not* allow environment variables.

So to proceed you have to copy the file 

`config.example.json`

to

`config.json`

and put your Castle API Secret and APP ID in the `config.json` file.

> Note: this pattern of putting the API Secret in a separate file simply allows the API key to be easily excluded from source control. The API Secret will be visible to any AWS user/role who has access to the source of the Lambda function (just like environment variables).

> Note: the default CORS policy in this script is to allow all origins; you can adjust as necessary.

#### Create a .zip archive

This command will create a `.zip` archive:

`zip -x ".git" -r function.zip .`

### Create a new Lambda function

Log in to your AWS Console->Lambda

* Create function

* Select `Author from scratch`
* Enter function name: castle-edge
* Runtime: Node.js

* Create function

On the function home screen:

Scroll down to the Function `Code source` section and select `.zip fil`e from the `Upload from`

Upload the zip archive that you created.

Click on newly created roe in the Configuration/Permissions tab and add

`edgelambda.amazonaws.com` 

to the Trust Relationship for the role that was created automatically when you created the Lambda function. More details on Lambda@Edge IAM are available [here](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/lambda-edge-permissions.html).

> Note: reload the Lambda dashboard after you adjust the permissions for the Lambda function.

#### Test your Lambda function

You can test your Lambda function with the `cloudfront_request.json` sample event included in the `requests` directory and by running `node test.js`

#### Add a CloudFront trigger

> As of March 2021, Lambda@Edge functions are available only the `us-east-1` region. If you don't see Cloudfront in the list of triggers, make sure you're in the `us-east-1` region.

Click Add Trigger (Configuration/Trigger)

Select the CloudFront 

Click Deploy to Lambda@Edge

Distribution: select the Distribution that you previously created

CloudFront Event: Viewer Request (not the default!)

Include body: Yes (not the default!)

Confirm deploy to Lambda@Edge: Yes

Press Deploy

After you deploy, it will take a few minutes (sometimes longer) for the Lambda function to deploy across your CloudFront distribution. You can open your CloudFront dashboard to monitor the progress of the deployment in the "status" column of your distribution.

## Testing

To test the deployment, send a POST to:

`{{cloudfront_url}}/users/sign_up`

A sample CURL request is included in the `sampleRequests` folder.

Your result will look something like this:

{
    "prodStatus": "200",
    "riskScore": 0.4079629060878592,
    "riskThreshold": 0.9,
    "castleAssessment": {
        "action": "allow",
        "user_id": null,
        "user": {},
        "risk": 0.4079629060878592
    }
}

## Adapting To Your Use Case

To add new routes, methods and customize the sample to be protected by Castle. You may want to add the route for your login endpoint, as well as the route for your password reset endpoint.
