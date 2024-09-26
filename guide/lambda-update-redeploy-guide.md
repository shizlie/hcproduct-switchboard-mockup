# Updating and Redeploying AWS Lambda Function

## 1. Update Dependencies

If you've added a new module to your `package.json`, run in the lambda function folder:

```bash
npm install
```

This ensures the new module and its dependencies are installed in your `node_modules` directory.

## 2. Create New Deployment Package

In your project directory, create a new zip file:

```bash
zip -r function.zip .
```

This command zips all files and folders in the current directory, including `node_modules`.

## 3. Upload to Lambda

### Option A: AWS Management Console

1. Open the AWS Lambda console
2. Select your function
3. Scroll to the "Code source" section
4. Click "Upload from" and choose ".zip file"
5. Upload your `function.zip`
6. Click "Save"

### Option B: AWS CLI

If you have AWS CLI configured, use:

```bash
aws lambda update-function-code --function-name YOUR_FUNCTION_NAME --zip-file fileb://function.zip
```

Replace `YOUR_FUNCTION_NAME` with your actual function name.

## 4. Verify Deployment

Test your function in the AWS Console to ensure it works with the new changes.

## Notes:

- Ensure your zip is under Lambda's size limits (250 MB unzipped, 50 MB zipped for direct upload)
- For larger functions, consider using Lambda Layers for dependencies
- Always test after deployment to verify functionality
