import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { categoryFromQuery } from '../lib/smart-filters';

describe('categoryFromQuery', () => {
  it('maps travel language', () => {
    assert.equal(categoryFromQuery('avianca flight'), 'travel');
    assert.equal(categoryFromQuery('hotel in bogota'), 'travel');
  });
  it('maps bills and subs', () => {
    assert.equal(categoryFromQuery('utility bill'), 'bill');
    assert.equal(categoryFromQuery('netflix'), 'subscription');
  });
});
