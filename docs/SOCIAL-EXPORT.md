# Social export

The creator's Export dialog creates media locally without saving or publishing.

- PNG: 1080×1350 portrait or 1080×1920 story.
- Video: a roughly nine-second timeline reveal, with the same aspect options.
  Uses Canvas captureStream and MediaRecorder; prefers MP4 when supported,
  otherwise WebM. No audio, camera or microphone access.
- Share opens the system share sheet only when file sharing is supported.
  Download remains available independently.
- Private names/event labels are excluded unless the user enables them. Preset
  relationship types and the public tagline are included.
- Closing the dialog cancels recording and releases media streams/blob URLs.

The media renderer lives in public/social-export.js. The creator projects its
model before passing it to the renderer. No backend or database changes required.

Verified in the local in-app browser: PNG download, both canvas sizes, MP4
creation (1080×1350, video metadata loads without error), desktop/mobile dialog.
Native sharing targets and physical-device Safari have not been exercised.
