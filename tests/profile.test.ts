import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeHandle,
  suggestHandleFromEmail,
  validateHandle,
  toPublicCard,
  type ProfileRecord,
} from '../lib/profile';

describe('profile handles', () => {
  it('normalizes and validates handles', () => {
    assert.equal(normalizeHandle('Jane_Doe!!'), 'jane-doe');
    const ok = validateHandle('jane-doe');
    assert.equal(ok.ok, true);
    const bad = validateHandle('ab');
    assert.equal(bad.ok, false);
    const reserved = validateHandle('admin');
    assert.equal(reserved.ok, false);
  });

  it('suggests handle from email', () => {
    const h = suggestHandleFromEmail('Chris.Miller@example.com');
    assert.match(h, /^chris/);
  });

  it('hides private fields on public card', () => {
    const profile: ProfileRecord = {
      userId: 1,
      handle: 'jane',
      displayName: 'Jane',
      headline: 'Hello',
      bio: 'Bio',
      avatarUrl: null,
      location: null,
      websiteUrl: null,
      publicEmail: 'jane@example.com',
      publicPhone: '+15551212',
      socials: {},
      theme: 'brand',
      accentColor: null,
      isPublic: true,
      showEmail: false,
      showPhone: true,
      showConnections: true,
      allowContactForm: true,
      defaultSendPlatform: 'sms',
      sendDefaults: {},
    };
    const card = toPublicCard(profile, ['SMS']);
    assert.ok(card);
    assert.equal(card!.email, undefined);
    assert.equal(card!.phone, '+15551212');
    assert.deepEqual(card!.availableChannels, ['SMS']);
  });

  it('returns null when not public', () => {
    const profile = {
      userId: 1,
      handle: 'secret',
      displayName: 'S',
      headline: null,
      bio: null,
      avatarUrl: null,
      location: null,
      websiteUrl: null,
      publicEmail: null,
      publicPhone: null,
      socials: {},
      theme: 'brand',
      accentColor: null,
      isPublic: false,
      showEmail: false,
      showPhone: false,
      showConnections: false,
      allowContactForm: false,
      defaultSendPlatform: null,
      sendDefaults: {},
    } satisfies ProfileRecord;
    assert.equal(toPublicCard(profile), null);
  });
});
