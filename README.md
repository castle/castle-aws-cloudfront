# Castle at the Edge with AWS Lambda and CloudFront

## Overview

AWS CloudFront allows you to distribute your content globally so that your users can access your content from a source as close to home as possible. AWS Lambda@Edge allows you to add the power of Lambda functions to requests coming in to your CloudFront distribution.

This repo will allow you to attach Castle to a Lambda@Edge function, so that you can block bot traffic at the edge, before malicious requests reach your `/register` or `/login` endpoints (or whatever other endpoint you want to protect).

## How it works

Once you've installed this Lambda function, it will listen for POSTs to the

`/register`

route.

The POST should include a Castle `client_id` in the body of the request. Click [here](https://docs.castle.io/preauth/) to learn more about how to include a Castle `client_id` in a POST.

When the Lambda function receives the POST, it will in turn make a POST to Castle, and receive a risk score in return. If the risk score is above the `riskThreshold`, then the function will respond with a 403. If the risk score is below the `riskThreshold`, the function will respond with a 200.

## Prerequisites

You'll need a Castle account and an AWS account to get started.

### Castle

If you don't have a Castle account already, you can [set up a free trial](https://dashboard.castle.io/signup/new). You will need your Castle API Secret, which can be found in the Settings section of your Castle dashboard.

## Installation

### CloudFront

Lambda@Edge requires a CloudFront distribution to function. So, even though this particular solution will not be serving static files from an S3 bucket via CloudFront, you still need to set up a CloudFront distribution to attach the Lambda@Edge function to.

A couple of notes as you set up your CloudFront distribution:

* You must explicitly allow POST requests. (By default, POST requests are not allowed.)
* Ignore the Lambda section for now. We're going to attach the Lambda function "manually".

### Prepare the repo

Before you set up your Lambda function, you need to prepare this repo, which involves three main steps:

1. download the repo
2. install dependencies
3. add your Castle API key
4. create a .zip archive

#### Download the repo

`git clone https://github.com/castle/castle-cloudfront`

#### Install dependencies

`cd castle-cloudfront`

`npm install`

#### Add your Castle API key

Unlike "normal" Lambda functions, Lambda@Edge functions do not allow environment variables.

So, I have created a file - `apiKeyExample.json` - in this repo. Copy the file 

`apiKeyExample.json`

to

`apiKey.json`

and put your Castle API key in the `apiKey.json` file.

> Note: this pattern of putting the API key in a separate file simply allows the API key to be easily excluded from source control. The API key will be visible to any AWS user/role who has access to the source of the Lambda function (just like environment variables).

#### Create a .zip archive

This command will create a `.zip` archive:

`zip -r function.zip .`

### Create a new Lambda function

Log in to your AWS Console->Lambda

* Create function

* Author from scratch
* Function name: castle-edge
* Runtime: Node.js 12.x <- important! Lambda@Edge does not support Node 14!

* Create function

On the function home screen:

Scroll down to the Function code section and click Actions->Upload a .zip file

Upload the zip archive that you created.

Click on the Permissions tab and add 

`edgelambda.amazonaws.com` 

to the Trust Relationship for the role that was created automatically when you created the Lambda function. More details on Lambda@Edge IAM are available [here](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/lambda-edge-permissions.html).

#### Test your Lambda function

You can test your Lambda function with the `clientIDbody.json` sample event included in the `sampleEvents` directory.

#### Add a CloudFront trigger

Click Add Trigger

Select the CloudFront trigger

Click Deploy to Lambda@Edge

Distribution: select the Distribution that you previously created

CloudFront Event: Viewer Request (not the default!)

Include body: Yes (not the default!)

Confirm deploy to Lambda@Edge: Yes

Press Deploy

After you deploy, it will take a few minutes (sometimes longer) for the Lambda function to deploy across your CloudFront distribution. You can open your CloudFront dashboard to monitor the progress of the deployment in the "status" column of your distribution.

## Testing

To test the deployment, send a POST to:

`{{cloudfront_url}}/register`

For best results, include the Castle `client_id` in the POST. Click [here](https://docs.castle.io/preauth/) for more information about how to include the Castle `client_id` in the POST.

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

The "prodStatus" field indicates what the actual response would be in production.

## Adapting To Your Use Case

To add new routes and methods to be protected by Castle, you can edit the `routes.json` file to include additional routes. You may want to add the route for your login endpoint, as well as the route for your password reset endpoint.
