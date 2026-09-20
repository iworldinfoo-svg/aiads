'use strict';
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const { DB_PATH } = require('../config');

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

// Initialize schema (idempotent - CREATE TABLE IF NOT EXISTS).
const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
schema
  .split(';')
  .map((s) => s.trim())
  .filter(Boolean)
  .forEach((stmt) => {
    try {
      db.exec(stmt);
    } catch (e) {
      if (!/already exists|duplicate/i.test(e.message)) throw e;
    }
  });

function all(sql, params = []) {
  return db.prepare(sql).all(...params);
}
function get(sql, params = []) {
  return db.prepare(sql).get(...params);
}
function run(sql, params = []) {
  return db.prepare(sql).run(...params);
}
function insert(sql, params = []) {
  const r = db.prepare(sql).run(...params);
  return r.lastInsertRowid;
}

module.exports = { db, all, get, run, insert, close: () => db.close() };
