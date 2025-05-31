# Publishing Guide

This document provides instructions for publishing `convert-apps-to-homebrew` to npm and maintaining the package.

## Pre-Publishing Checklist

### 1. Code Quality

- [ ] All tests passing (`npm test`)
- [ ] TypeScript compilation successful (`npm run build`)
- [ ] No linting errors (`npm run lint`)
- [ ] Code coverage acceptable (>70%)

### 2. Documentation

- [ ] README.md updated with latest features
- [ ] CHANGELOG.md updated with version changes
- [ ] Examples updated if needed
- [ ] API documentation current

### 3. Package Configuration

- [ ] package.json version updated
- [ ] Dependencies up to date
- [ ] Keywords relevant and complete
- [ ] Files array includes all necessary files
- [ ] bin entry points to correct file

### 4. Build Verification

- [ ] `npm run prepublishOnly` succeeds
- [ ] `npm pack --dry-run` shows correct files
- [ ] dist/ directory contains compiled code
- [ ] No source files in npm package

## Publishing Process

### 1. Version Management

Follow [Semantic Versioning](https://semver.org/):

```bash
# Patch release (bug fixes)
npm version patch

# Minor release (new features, backward compatible)
npm version minor

# Major release (breaking changes)
npm version major
```

### 2. Pre-publish Testing

```bash
# Clean build
rm -rf dist node_modules
npm install
npm run build

# Run all tests
npm test

# Test package contents
npm pack --dry-run

# Test installation locally
npm pack
npm install -g convert-apps-to-homebrew-1.0.0.tgz
convert-apps-to-homebrew --help
npm uninstall -g convert-apps-to-homebrew
```

### 3. Publishing to npm

```bash
# Login to npm (if not already logged in)
npm login

# Publish (this will run prepublishOnly automatically)
npm publish

# For scoped packages (if needed)
npm publish --access public
```

### 4. Post-publish Verification

```bash
# Test installation from npm
npx convert-apps-to-homebrew@latest --version

# Check package page
open https://www.npmjs.com/package/convert-apps-to-homebrew
```

## Release Workflow

### 1. Prepare Release

```bash
# Create release branch
git checkout -b release/v1.0.0

# Update version and changelog
npm version minor
# Edit CHANGELOG.md with new version details

# Commit changes
git add .
git commit -m "chore: prepare release v1.0.0"

# Push release branch
git push origin release/v1.0.0
```

### 2. Create Pull Request

- Create PR from release branch to main
- Review all changes
- Ensure CI passes
- Get approval from maintainers

### 3. Merge and Tag

```bash
# Merge to main
git checkout main
git merge release/v1.0.0

# Create and push tag
git tag v1.0.0
git push origin main --tags

# Clean up release branch
git branch -d release/v1.0.0
git push origin --delete release/v1.0.0
```

### 4. Publish Package

```bash
# Publish from main branch
git checkout main
npm publish
```

### 5. Create GitHub Release

- Go to GitHub releases page
- Create new release from tag
- Add release notes from CHANGELOG.md
- Attach any relevant files

## Maintenance

### Regular Updates

```bash
# Update dependencies
npm update
npm audit fix

# Check for outdated packages
npm outdated

# Update dev dependencies
npm update --dev
```

### Security Updates

```bash
# Check for vulnerabilities
npm audit

# Fix automatically if possible
npm audit fix

# Manual fixes for high/critical issues
npm audit fix --force
```

### Monitoring

- Monitor npm download statistics
- Watch for issues and bug reports
- Keep dependencies up to date
- Respond to community feedback

## Troubleshooting

### Common Publishing Issues

**"Package already exists"**

```bash
# Check current version
npm view convert-apps-to-homebrew version

# Update version
npm version patch
```

**"Authentication failed"**

```bash
# Re-login to npm
npm logout
npm login
```

**"Files missing from package"**

```bash
# Check files array in package.json
# Verify .npmignore doesn't exclude needed files
npm pack --dry-run
```

**"Build fails during publish"**

```bash
# Test prepublishOnly script
npm run prepublishOnly

# Check TypeScript compilation
npm run build
```

### Rollback Process

If a published version has critical issues:

```bash
# Deprecate the problematic version
npm deprecate convert-apps-to-homebrew@1.0.0 "Critical bug, use 1.0.1 instead"

# Publish fixed version immediately
npm version patch
npm publish
```

## Best Practices

### Version Strategy

- Use semantic versioning strictly
- Document breaking changes clearly
- Provide migration guides for major versions
- Consider deprecation warnings before breaking changes

### Documentation

- Keep README.md current with features
- Update examples with new functionality
- Maintain comprehensive CHANGELOG.md
- Document any breaking changes

### Testing

- Maintain high test coverage
- Test on multiple Node.js versions
- Verify package installation works
- Test CLI functionality end-to-end

### Community

- Respond to issues promptly
- Welcome contributions
- Maintain code of conduct
- Provide clear contribution guidelines

## Automation

### GitHub Actions (Future Enhancement)

Consider setting up automated workflows:

```yaml
# .github/workflows/publish.yml
name: Publish Package
on:
  release:
    types: [published]
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '22'
          registry-url: 'https://registry.npmjs.org'
      - run: npm ci
      - run: npm test
      - run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### Automated Testing

```yaml
# .github/workflows/test.yml
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: macos-latest
    strategy:
      matrix:
        node-version: [22, 23]
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: ${{ matrix.node-version }}
      - run: npm ci
      - run: npm test
      - run: npm run build
```

## Support

For questions about publishing or maintenance:

1. Check npm documentation: https://docs.npmjs.com/
2. Review semantic versioning: https://semver.org/
3. Consult Node.js best practices
4. Ask in project discussions or issues
