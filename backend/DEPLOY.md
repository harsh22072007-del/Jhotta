# Deploying Jhotta to AWS (ap-south-1, Mumbai)

You need: an AWS account, the AWS CLI and SAM CLI configured, and a Google Cloud OAuth client.
The app works fully in guest mode without any of this.

## 1. Google OAuth client
Google Cloud Console -> APIs & Services -> Credentials -> Create OAuth client ID (Web application).
Leave the redirect URI empty for now; you get it from the stack output in step 3.

## 2. Deploy the backend
```bash
cd backend
sam build
sam deploy --guided --region ap-south-1 --stack-name jhotta \
  --parameter-overrides GoogleClientId=<id> GoogleClientSecret=<secret> CognitoDomainPrefix=<unique-prefix>
```

## 3. Finish Google setup
Take the `GoogleRedirectUri` output and add it to the Google OAuth client under
"Authorized redirect URIs". It looks like `https://<prefix>.auth.ap-south-1.amazoncognito.com/oauth2/idpresponse`.

## 4. Configure and publish the PWA
```bash
cd ..                      # project root
cp .env.example .env       # fill in ApiUrl, CognitoDomain, UserPoolClientId from the outputs
npm run build
aws s3 sync dist/ s3://<BucketName> --delete
aws cloudfront create-invalidation --distribution-id <DistributionId> --paths "/*"
```
Open the `SiteUrl` output. Run the invalidation after every release so the service worker updates.

## Local development against the cloud
`npm run dev` works at http://localhost:5173 (already allowed as a callback URL). Put the same values in `.env`.

## Notes
- DynamoDB table `jhotta` has `DeletionPolicy: Retain` and point-in-time recovery, so deleting the stack does not delete user data.
- Costs are on-demand and tiny at personal scale (DynamoDB, Lambda, API Gateway, CloudFront).
- Sync conflicts: last write wins by `updated_at`. Deletes are soft (`deleted_at`) so they sync.
