# convert-apps-to-homebrew

[![npm version](https://badge.fury.io/js/convert-apps-to-homebrew.svg)](https://badge.fury.io/js/convert-apps-to-homebrew)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-24+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![code style](https://antfu.me/badge-code-style.svg)](https://github.com/antfu/eslint-config)

A CLI tool for macOS that automatically discovers applications in your `/Applications` directory and converts them to Homebrew-managed installations.

## ✨ Features

- 🔍 **Automatic Discovery**: Scans `/Applications` directory and identifies available Homebrew packages
- ✅ **Interactive Selection**: Checkbox interface for selecting apps to install
- 🧪 **Dry-Run Mode**: Preview changes without executing them
- 🚫 **Flexible Filtering**: Pre-ignore specific applications

## 🚀 Quick Start

### Installation

```bash
# Run directly with npx (recommended)
npx convert-apps-to-homebrew@latest

# Or install globally
npm install -g convert-apps-to-homebrew
convert-apps-to-homebrew
```

## 📋 Requirements

- **macOS**: This tool is designed specifically for macOS
- **Node.js 24+**: Required for running the application
- **Homebrew**: Must be installed and accessible in PATH

## 🔧 Command-line options

| Option                      | Description                       | Example                                       |
| --------------------------- | --------------------------------- | --------------------------------------------- |
| `--ignore <apps...>`        | Ignore specific applications      | `--ignore "Adobe Photoshop" "Microsoft Word"` |
| `--dry-run`                 | Preview changes without executing |                                               |
| `--verbose`                 | Enable detailed logging           |                                               |
| `--applications-dir <path>` | Custom applications directory     | `--applications-dir /Applications`            |
| `--help`                    | Show help information             |                                               |
| `--version`                 | Show version number               |                                               |

## 🛠️ Development

### Building from source

```bash
# Clone the repository
git clone https://github.com/deepfriedmind/convert-apps-to-homebrew.git
cd convert-apps-to-homebrew

# Install dependencies
npm install

# Run the project
npm start

# Build the project
npm run build

# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

### Development guidelines

1. **TypeScript**: All code must be written in TypeScript
2. **Testing**: New features must include comprehensive tests
3. **Documentation**: Update README.md for new features
4. **Code Style**: Follow the existing code style and linting rules

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Homebrew](https://brew.sh/) - The missing package manager for macOS
- [Inquirer.js](https://github.com/SBoudrias/Inquirer.js) - Interactive command line interfaces
- [Commander.js](https://github.com/tj/commander.js) - Command-line interface framework

## 🐛 Troubleshooting

### Common Issues

**"Homebrew is not installed"**

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

**"Node.js version not supported"**

```bash
brew install node  # Installs latest Node.js
```

**"Permission denied"**

- Ensure you have read access to `/Applications`
- For cask installations, Homebrew's --force flag is used to overwrite existing applications

**"No applications found"**

- Check that applications exist in `/Applications`
- Try using `--applications-dir` to specify a different path

For more help, run with `--verbose` flag for detailed error information.

---
