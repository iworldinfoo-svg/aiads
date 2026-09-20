'use strict';
// Provider registry. Maps each api_slot to a provider implementation.
// The foundation always returns MOCK providers. When the Super Admin activates
// a real endpoint in an api_slot, a real adapter (implementing the contract in
// interface.js) would be selected here instead of the mock.

const db = require('../../db');
const {
  MockRenderProvider, MockImageProvider, MockTTSProvider, MockLipSyncProvider,
} = require('./mock');

function slotConfig(slotKey) {
  return db.get('SELECT * FROM api_slots WHERE slot_key = ?', [slotKey]);
}

// A slot is "ready" when it is active AND has an endpoint configured.
function slotReady(slotKey) {
  const s = slotConfig(slotKey);
  return !!(s && s.active && s.endpoint_url);
}

const registry = {
  render: () => MockRenderProvider(),
  image: () => MockImageProvider(),
  tts: () => MockTTSProvider(),
  lipsync: () => MockLipSyncProvider(),
  // Diagnostic used by admin "Test" button.
  async testSlot(slotKey) {
    const s = slotConfig(slotKey);
    if (!s) return { status: 'fail', note: 'Slot not found' };
    if (!s.endpoint_url) {
      return { status: 'untested', note: 'No endpoint configured — mock provider active.' };
    }
    // In production this would ping the endpoint with the stored (decrypted) key.
    return { status: 'ok', note: 'Endpoint reachable (mock check).' };
  },
};

module.exports = { registry, slotConfig, slotReady };
