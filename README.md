# TrackItUp

TrackItUp is a mobile application built with Expo and React Native that provides comprehensive tracking and workspace management capabilities with AI-powered features.

## Features

- Multi-workspace database management with local storage
- AI-powered action center with live dictation
- Recurring task planning and history tracking
- Calendar-based logging and visual history
- QR/barcode scanning for quick data entry
- Template-based form builder and import
- Account management with authentication
- Offline-first architecture with WatermelonDB
- Privacy mode with biometric authentication
- Cross-platform support (Android, iOS, Web)

## Prerequisites

- Node.js (LTS version recommended)
- Bun package manager
- For Android development: Android Studio and Android SDK
- For iOS development: Xcode (macOS only)
- Expo CLI

## Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd trackitup
```

2. Install dependencies:

```bash
bun install
```

3. Set up environment variables as needed for Clerk authentication and OpenRouter API access.

## Development

### Starting the development server

```bash
bun start
```

### Running on Android

```bash
bun expo run:android
```

### Running on iOS

```bash
bun expo run:ios
```

### Running on Web

```bash
bun expo start --web
```

## Building

### Building Android APK

```bash
bun run build:apk
```

This command will create a production APK with the `com.keepaside.trackitup` application ID.

### Development builds

To create a clean prebuild for Android:

```bash
bun run clean:prebuild
```

## Testing

### Run all tests

```bash
bun test
```

### Run specific test suites

```bash
bun run test:workspace-tools
```

### Type checking

```bash
bun run typecheck
```

### Full check (type check + tests)

```bash
bun run check
```

## Project Structure

- `app/` - Expo Router pages and layouts
- `components/` - Reusable React components
- `constants/` - Application constants and configuration
- `services/` - Business logic and data services
  - `ai/` - AI integration services
  - `dashboard/` - Dashboard data management
  - `spaces/` - Workspace management
  - `logs/` - Logging and history services
  - `recurring/` - Recurring task management
  - `reminders/` - Notification services
- `stores/` - State management with Zustand
- `types/` - TypeScript type definitions
- `tests/` - Unit and integration tests
- `plugins/` - Expo plugins for custom configurations

## Configuration

The application supports two build variants controlled by the `APP_VARIANT` environment variable:

- `development` - Development build with package `com.keepaside.trackitup.dev`
- `production` - Production build with package `com.keepaside.trackitup`

Default variant is `development`.

## Key Technologies

- **Framework**: Expo SDK 55, React Native 0.83
- **Database**: WatermelonDB (local, reactive)
- **Authentication**: Clerk Expo
- **AI Integration**: OpenRouter AI SDK
- **Routing**: Expo Router (file-based)
- **Language**: TypeScript with strict mode
- **State Management**: Zustand with Immer
- **Styling**: Custom theme system with light/dark mode support

## Platform-Specific Notes

### Android

- Uses custom ABI splits for optimized APK size
- Custom splash screen configuration
- Requires minimum SDK version defined in build.gradle

### iOS

- Supports iPad with universal layout
- Requires Xcode for building
- Configured through expo-config

## Documentation

Additional project documentation is available in the `docs/` directory, including:

- AI feature tracking implementation details
- Feature-specific guides and architecture notes

## License

Copyright (c) 2026 KeepAside. All rights reserved.
