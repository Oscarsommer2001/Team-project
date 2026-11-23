const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'dist', 'index.html'), 'utf8');

// A closing tag can't carry attributes. When one did (</option value="read">), the browser
// silently dropped "Read a little" from the list of habit ideas.
const badEndTags = html.match(/<\/[a-z][a-z0-9-]*\s+[^>]*>/gi) || [];
assert.deepEqual(badEndTags, [], 'Closing tags must not have attributes');

// Every option in the list of habit ideas is opened and closed exactly once.
const ideaList = html.match(/<select id="template">([\s\S]*?)<\/select>/);
assert(ideaList, 'The habit form has a list of habit ideas');
const opened = (ideaList[1].match(/<option\b/g) || []).length;
const closed = (ideaList[1].match(/<\/option>/g) || []).length;
assert.equal(opened, closed, 'Each habit idea is opened and closed once');

console.log('index.html structure checks passed.');
