# NPM Publishing Setup

This document describes how to set up automated npm publishing with GitHub Actions using npm's Trusted Publishers feature with OIDC.

## Overview

The repository uses GitHub Actions to automatically publish to npm when:

- A new tag matching `v*` is pushed (e.g., `v1.0.0`)
- The workflow is manually triggered via workflow_dispatch

The workflow uses:

- **OIDC authentication**: Secure, tokenless authentication between GitHub and npm (no secrets required!)
- **Provenance statements**: Cryptographically signed attestations linking the package to its source
- **Automated testing**: Runs tests before publishing to ensure quality

## Setup Required on npmjs.com

### Configure Trusted Publisher (No Token Needed!)

The workflow uses OIDC (OpenID Connect) to authenticate with npm, which means you don't need to create or store any NPM_TOKEN secrets. Instead:

1. Log in to npmjs.com
2. Navigate to your package (or organization settings for new packages)
3. Go to **Settings** → **Publishing Access** → **Trusted Publishers**
4. Click **Add Trusted Publisher** and select **GitHub Actions**
5. Configure the publisher:
   - **Repository owner**: `tinovyatkin`
   - **Repository name**: `node-typescript-resolver`
   - **Workflow file path**: `.github/workflows/publish.yml`
   - **Environment name**: (leave empty unless you use GitHub environments)
6. Save the configuration

That's it! GitHub Actions can now publish directly to npm without any stored credentials.

## Publishing a New Version

### Automated Publishing (via Git Tag)

```bash
# Update version in package.json
npm version patch  # or minor, major

# Push the tag to trigger publishing
git push --follow-tags
```

### Manual Publishing (via Workflow Dispatch)

1. Go to **Actions** tab in GitHub
2. Select **Publish to npm** workflow
3. Click **Run workflow**
4. Select branch and click **Run workflow**

## Provenance

The workflow publishes with `--provenance` flag, which:

- Links the published package to the exact source code and build process
- Provides cryptographic proof of the package's origin
- Can be verified on npm package pages under the "Provenance" section
- Helps users verify the package hasn't been tampered with

## Workflow Permissions

The workflow uses minimal permissions:

- `contents: read` - To checkout code
- `id-token: write` - To generate OIDC tokens for provenance

## Troubleshooting

### Publishing fails with authentication error

- Verify that you've configured the trusted publisher on npmjs.com with the correct repository and workflow path
- Ensure the workflow has `id-token: write` permission (already set in the workflow)
- For first-time publishing, you may need to publish manually once with `npm publish` using a token, then subsequent publishes can use OIDC

### Provenance generation fails

- Verify the repository is public or has GitHub Enterprise with provenance support
- Check that `id-token: write` permission is set in the workflow
- Ensure you're using a recent version of npm (8.5.0+) that supports provenance

### Tests fail during publishing

The workflow runs `npm test` before publishing. Fix any test failures before attempting to publish.

### OIDC token not available

- Make sure `permissions.id-token: write` is set in the workflow
- Verify you're running on a GitHub Actions runner (OIDC doesn't work with self-hosted runners without additional configuration)

## References

- [npm Provenance Documentation](https://docs.npmjs.com/generating-provenance-statements)
- [npm Trusted Publishers](https://docs.npmjs.com/trusted-publishers)
- [GitHub Actions OIDC](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect)
