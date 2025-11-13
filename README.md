# Messenger Analyzer - Multi-Format Edition

## What's New

This version includes:
- ✅ Multi-format support (Line Messenger, Facebook, Instagram)
- ✅ Identity mapping UI for merging conversations across platforms
- ✅ Universal adapter system for extensibility

## Files Included

### New Files
- `src/adapters/lineAdapter.js` - Parses Line Messenger TXT exports
- `src/adapters/jsonAdapter.js` - Parses Facebook/Instagram JSON exports
- `src/adapters/index.js` - Format detection and routing
- `src/components/IdentityMapper.jsx` - Identity mapping UI component
- `src/utils/conversationMerger.js` - Conversation merging logic

### Modified Files
- `App.js` - Integrated adapter system and identity mapping

### Configuration
- `package.json` - Dependencies
- `package-lock.json` - Locked dependency versions

## Installation

```bash
npm install
```

## Running

```bash
npm start
```

## Building

```bash
npm run build
```

## Supported Formats

1. **Line Messenger** (.txt)
   - Plain text format
   - Tab-separated: TIME\tSENDER\tMESSAGE

2. **Instagram** (.json)
   - JSON with `senderName` and `text` fields
   - Participants as string array

3. **Facebook Messenger** (.json)
   - JSON with `sender_name` and `content` fields
   - Participants as objects with `name` property

## Usage

1. Upload conversation files (any supported format)
2. If multiple files, optionally map identities
3. Click conversation to analyze
4. View relationship insights

## Documentation

See the uploaded markdown files for:
- IMPLEMENTATION_SUMMARY.md - Technical details
- QUICK_START_GUIDE.md - User guide
- SYSTEM_ARCHITECTURE.md - Architecture diagrams

## Adding New Formats

1. Create adapter in `src/adapters/[platform]Adapter.js`
2. Follow normalized output structure
3. Add detection logic to `src/adapters/index.js`
4. Test with sample files

That's it! No UI changes needed.
