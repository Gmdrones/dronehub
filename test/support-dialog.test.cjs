const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('support backdrop stays below the interactive card despite legacy CSS', () => {
  const source = fs.readFileSync(path.join(__dirname, '../js/main.js'), 'utf8');
  assert.match(source, /#dronehubSupportDialog\{isolation:isolate!important\}/);
  assert.match(source, /#dronehubSupportDialog \.dronehub-support-backdrop\{z-index:0!important\}/);
  assert.match(source, /\.dronehub-support-card\{position:absolute!important;z-index:1!important/);
});
