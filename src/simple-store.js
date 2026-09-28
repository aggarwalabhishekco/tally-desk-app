// simple-store.js
// A tiny JSON-file settings store, so the app doesn't need an external
// dependency just to remember Tally host/port/sync-mode between launches.
const fs = require('fs');
const path = require('path');

class SimpleStore {
  constructor({ dir, name = 'settings.json', defaults = {} }) {
    this.filePath = path.join(dir, name);
    this.data = { ...defaults };
    this._load();
  }

  _load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        this.data = { ...this.data, ...JSON.parse(raw) };
      }
    } catch (err) {
      // Corrupt or unreadable settings file -- fall back to defaults rather
      // than crashing the app on launch.
      console.warn('Could not read settings file, using defaults:', err.message);
    }
  }

  _save() {
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (err) {
      console.warn('Could not save settings file:', err.message);
    }
  }

  get(key) {
    return this.data[key];
  }

  set(key, value) {
    this.data[key] = value;
    this._save();
  }
}

module.exports = SimpleStore;
