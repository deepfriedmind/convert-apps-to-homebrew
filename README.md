# convert-apps-to-homebrew

[![npm version](https://badge.fury.io/js/convert-apps-to-homebrew.svg)](https://badge.fury.io/js/convert-apps-to-homebrew)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-22+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)

A modern TypeScript CLI tool that automatically discovers applications in your `/Applications` directory and converts them to Homebrew-managed installations. This tool helps you maintain a clean, consistent, and reproducible macOS setup by replacing manually installed applications with their Homebrew equivalents.

## ✨ Features

- 🔍 **Automatic Discovery**: Scans `/Applications` directory and identifies available Homebrew packages
- 📦 **Smart Categorization**: Distinguishes between casks, formulas, and unavailable packages
- ✅ **Interactive Selection**: Checkbox interface with all available apps pre-selected
- 🔐 **Secure Installation**: Handles sudo authentication for cask installations
- 🧪 **Dry-Run Mode**: Preview changes without executing them
- 📊 **Detailed Reporting**: Comprehensive summaries and progress tracking
- 🚫 **Flexible Filtering**: Ignore specific applications
- 🎨 **Beautiful Interface**: Colorized output with emojis and progress indicators
- ⚡ **Batch Operations**: Efficient batch installation of multiple packages
- 🛡️ **Error Handling**: Comprehensive error handling with recovery suggestions

## 🚀 Quick Start

### Installation

```bash
# Run directly with npx (recommended)
npx convert-apps-to-homebrew

# Or install globally
npm install -g convert-apps-to-homebrew
convert-apps-to-homebrew
```

### Basic Usage

```bash
# Interactive mode - scan and select apps to convert
npx convert-apps-to-homebrew

# Dry-run mode - see what would happen without making changes
npx convert-apps-to-homebrew --dry-run

# Ignore specific applications
npx convert-apps-to-homebrew --ignore "Adobe Photoshop" "Microsoft Word"

# Verbose output for debugging
npx convert-apps-to-homebrew --verbose

# Custom applications directory
npx convert-apps-to-homebrew --applications-dir /Applications
```

## 📋 Requirements

- **macOS**: This tool is designed specifically for macOS
- **Node.js 22+**: Required for running the application
- **Homebrew**: Must be installed and accessible in PATH

### Installing Prerequisites

```bash
# Install Homebrew (if not already installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Node.js 22+ via Homebrew
brew install node
```

## 🎯 How It Works

1. **Discovery**: Scans your `/Applications` directory for installed applications
2. **Analysis**: Checks Homebrew for available cask and formula equivalents
3. **Categorization**: Groups apps as:
   - ✅ **Available**: Can be installed via Homebrew
   - 🍺 **Already Installed**: Already managed by Homebrew
   - 🚫 **Ignored**: Explicitly ignored by user
   - ❌ **Unavailable**: No Homebrew package available
4. **Selection**: Interactive checkbox interface for choosing apps to convert
5. **Installation**: Batch installs selected packages and optionally removes original apps
6. **Summary**: Detailed report of successful and failed installations

## 🔧 Command Line Options

| Option                      | Description                       | Example                                       |
| --------------------------- | --------------------------------- | --------------------------------------------- |
| `--ignore <apps...>`        | Ignore specific applications      | `--ignore "Adobe Photoshop" "Microsoft Word"` |
| `--dry-run`                 | Preview changes without executing | `--dry-run`                                   |
| `--verbose`                 | Enable detailed logging           | `--verbose`                                   |
| `--applications-dir <path>` | Custom applications directory     | `--applications-dir /Applications`            |
| `--help`                    | Show help information             | `--help`                                      |
| `--version`                 | Show version number               | `--version`                                   |

## 📖 Examples

### Basic Conversion

```bash
npx convert-apps-to-homebrew
```

This will:

1. Scan `/Applications` for installed apps
2. Show a summary of discoverable packages
3. Present an interactive checkbox with all available apps selected
4. Prompt for sudo password if cask installations are selected
5. Install selected packages and remove original apps

### Dry-Run Mode

```bash
npx convert-apps-to-homebrew --dry-run
```

Perfect for:

- Previewing what would be installed
- Testing the tool without making changes
- Understanding which apps are available in Homebrew

### Ignoring Specific Apps

```bash
npx convert-apps-to-homebrew --ignore "Adobe Creative Cloud" "Microsoft Office"
```

Useful for:

- Keeping certain apps as manual installations
- Avoiding apps with complex licensing
- Maintaining specific versions

### Verbose Mode

```bash
npx convert-apps-to-homebrew --verbose --dry-run
```

Provides detailed information about:

- App discovery process
- Homebrew package matching
- Command execution (in dry-run mode)
- Error details and troubleshooting

## 🔐 Security & Permissions

### Sudo Access

- **Required for**: Cask installations that need to delete original `.app` files
- **Not required for**: Formula installations or dry-run mode
- **Security**: Passwords are handled securely and never logged

### File System Access

- **Read access**: Required for scanning `/Applications` directory
- **Write access**: Required for deleting original apps (casks only)

## 🎨 User Interface

The tool provides a beautiful, intuitive interface:

```
🍺 convert-apps-to-homebrew v1.0.0

📊 Discovery Summary
══════════════════════════════════════════════════════

✅ Available for installation (3):
   📦 2 casks
   ⚙️  1 formula

🍺 Already installed via Homebrew (2):
   • Google Chrome
   • Node.js

🎯 Select applications to install via Homebrew:
❯ ◉ Visual Studio Code (📦 cask)
  ◉ Firefox (📦 cask)
  ◉ Git (⚙️  formula)
```

## 🛠️ Development

### Building from Source

```bash
# Clone the repository
git clone https://github.com/deepfriedmind/convert-apps-to-homebrew.git
cd convert-apps-to-homebrew

# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test

# Run with coverage
npm run test:coverage

# Run locally
npm run dev
```

### Project Structure

```
src/
├── __tests__/          # Comprehensive test suite
├── app-scanner.ts      # Application discovery logic
├── cli.ts             # Command-line interface
├── constants.ts       # Application constants
├── error-handler.ts   # Error handling and progress tracking
├── index.ts          # Main entry point
├── installer.ts      # Installation logic
├── prompts.ts        # Interactive user prompts
├── types.ts          # TypeScript type definitions
└── utils.ts          # Utility functions
```

## 🧪 Testing

The project includes comprehensive test coverage:

- **123 tests** across 9 test suites
- **74.18% statement coverage**
- Unit tests for all modules
- Integration tests for complete workflows
- Mocked external dependencies for reliability

```bash
npm test              # Run all tests
npm run test:coverage # Run with coverage report
npm run test:watch    # Watch mode for development
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

### Development Guidelines

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
- For cask installations, sudo access is required

**"No applications found"**

- Check that applications exist in `/Applications`
- Try using `--applications-dir` to specify a different path

For more help, run with `--verbose` flag for detailed error information.

---
