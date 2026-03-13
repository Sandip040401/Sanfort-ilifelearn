const fs = require('fs');
const path = require('path');

const managerPath = path.join(
  __dirname,
  '..',
  'node_modules',
  'react-native-video',
  'ios',
  'Video',
  'RCTVideoManager.swift',
);
const videoPath = path.join(
  __dirname,
  '..',
  'node_modules',
  'react-native-video',
  'ios',
  'Video',
  'RCTVideo.swift',
);

const beforeManager =
  'return RCTVideo(eventDispatcher: (RCTBridge.current().eventDispatcher() as! RCTEventDispatcher))';
const afterManager =
  'let dispatcher = bridge?.eventDispatcher() ?? RCTBridge.current()?.eventDispatcher()\\n' +
  '        return RCTVideo(eventDispatcher: dispatcher)';

try {
  if (fs.existsSync(managerPath)) {
    const src = fs.readFileSync(managerPath, 'utf8');
    if (!src.includes(afterManager) && src.includes(beforeManager)) {
      const next = src.replace(beforeManager, afterManager);
      fs.writeFileSync(managerPath, next, 'utf8');
      console.log('[fix-react-native-video-ios] patched manager');
    } else {
      console.log('[fix-react-native-video-ios] manager already patched or target not found');
    }
  } else {
    console.log('[fix-react-native-video-ios] manager file not found:', managerPath);
  }

  if (fs.existsSync(videoPath)) {
    let videoSrc = fs.readFileSync(videoPath, 'utf8');
    const beforeEvent = 'private var _eventDispatcher: RCTEventDispatcher?';
    const afterEvent = 'private var _eventDispatcher: RCTEventDispatcherProtocol?';
    const beforeInit = 'init(eventDispatcher: RCTEventDispatcher!) {';
    const afterInit = 'init(eventDispatcher: RCTEventDispatcherProtocol!) {';

    let updated = false;
    if (videoSrc.includes(beforeEvent)) {
      videoSrc = videoSrc.replace(beforeEvent, afterEvent);
      updated = true;
    }
    if (videoSrc.includes(beforeInit)) {
      videoSrc = videoSrc.replace(beforeInit, afterInit);
      updated = true;
    }

    if (updated) {
      fs.writeFileSync(videoPath, videoSrc, 'utf8');
      console.log('[fix-react-native-video-ios] patched video');
    } else {
      console.log('[fix-react-native-video-ios] video already patched or target not found');
    }
  } else {
    console.log('[fix-react-native-video-ios] video file not found:', videoPath);
  }
} catch (err) {
  console.error('[fix-react-native-video-ios] failed:', err);
  process.exit(0);
}
