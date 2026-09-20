import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { looksLikeTravel } from '../lib/travel';

describe('looksLikeTravel', () => {
  it('flags airline itineraries', () => {
    assert.equal(
      looksLikeTravel('Avianca itinerary: BOG to CHA confirmation ABC123 $412'),
      true
    );
  });

  it('flags Uber rides but not Uber Eats', () => {
    assert.equal(looksLikeTravel('Your Uber trip to the airport $28', 'Uber'), true);
    assert.equal(looksLikeTravel('Uber Eats order $28', 'Uber'), false);
  });

  it('does not flag Netflix', () => {
    assert.equal(looksLikeTravel('Your Netflix subscription renews $15.99', 'Netflix'), false);
  });
});
