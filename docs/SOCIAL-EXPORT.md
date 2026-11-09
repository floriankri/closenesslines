# Social export

The creator's Publish & share button publishes the timeline and opens one sharing
dialog with three copy buttons (editing, named, anonymous gallery) and media
downloads. Save / editing link opens the same dialog without publishing a new
private timeline. Media generation itself remains local.

- PNG: a complete timeline at 1080×1920 (9:16).
- Video: a 12–24 second scrolling reveal at 1080×1920. It starts at birth with
  an 18-year window, follows the unfolding lines and keeps the closeness header
  fixed. The camera clamps at the final age.
  Uses Canvas captureStream and MediaRecorder; prefers MP4 when supported,
  otherwise WebM. No audio, camera or microphone access.
- There is no separate Export button. The dialog has Download image and Download video. Video downloads when ready;
  clicking Download video again reuses the result. No native Share button.
- Private names/event labels are excluded unless the user enables them. Preset
  relationship types and the public tagline are included.
- Closing the dialog cancels recording and releases media streams/blob URLs.

The media renderer lives in public/social-export.js. The creator projects its
model before passing it to the renderer. No backend or database changes required.

Verified in the local in-app browser: PNG download, image dimensions, MP4
creation (1080×1920, video metadata loads without error), desktop/mobile dialog.
Native sharing targets and physical-device Safari have not been exercised.
