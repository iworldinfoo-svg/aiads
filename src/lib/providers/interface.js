'use strict';
// Provider adapter contract.
//
// Every external AI capability is behind an interface so the Super Admin can
// swap real APIs in without touching the pipeline. The foundation ships a
// MOCK implementation for each. To add a real provider, implement the same
// methods and register it in registry.js keyed by the api_slot.slot_key.
//
// RenderProvider
//   renderScenes({ orderId, answers, scenes, references })
//     -> Promise<{ scenes: [{idx, poster_path, last_frame_path, continuity_score}] }>
//
// ImageProvider
//   generate({ prompt, style, count, aspect })
//     -> Promise<{ images: [{path, prompt}] }>
//
// TTSProvider
//   synthesize({ text, lang, gender, dialect, speed })
//     -> Promise<{ audioPath, transcript }>   // audioPath may be null in mock
//
// LipSyncProvider
//   sync({ videoPath, audioPath, characterRef })
//     -> Promise<{ syncedPath, provider }>
