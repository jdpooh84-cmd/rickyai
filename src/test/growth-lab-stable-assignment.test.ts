/**
 * Growth Lab stable variant assignment tests.
 *
 * The edge function uses SHA-256 to deterministically assign subjects to
 * experiment variants. The algorithm:
 *   1. Concatenate contactId + experimentId
 *   2. SHA-256 hash the UTF-8 encoded string
 *   3. Read the first 4 bytes of the hash as a Uint32 (big-endian)
 *   4. Modulo by variantCount (defaults to 10000) to get a bucket 0–9999
 *   5. Assign control (0–4999) or treatment (5000–9999) based on bucket
 *
 * These tests re-implement the same algorithm and verify:
 *   - Determinism: same (contactId, experimentId) always yields the same variant
 *   - Distribution: bucket values are roughly even across a large sample
 */

import { describe, it, expect } from "vitest";

/**
 * Re-implementation of the stable hash from growth-lab/index.ts.
 * Uses crypto.subtle.digest (available in Vitest's jsdom/node environment).
 */
async function stableHash(contactId: string, experimentId: string): Promise<number> {
  const encoder = new TextEncoder();
  const data = encoder.encode(contactId + experimentId);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = new Uint8Array(hashBuffer);
  // First 4 bytes as big-endian Uint32, same as the edge function
  const val =
    (hashArray[0] * 16777216 +
      hashArray[1] * 65536 +
      hashArray[2] * 256 +
      hashArray[3]) >>>
    0;
  return val % 10000;
}

function assignVariant(bucket: number): "control" | "treatment" {
  return bucket < 5000 ? "control" : "treatment";
}

const FIXED_EXPERIMENT_ID = "123e4567-e89b-12d3-a456-426614174000";

describe("Growth Lab stable bucket assignment", () => {
  it("is deterministic: same (contactId, experimentId) always returns the same bucket", async () => {
    const contactId = "aaa11111-bbbb-cccc-dddd-eeeeeeeeeeee";
    const run1 = await stableHash(contactId, FIXED_EXPERIMENT_ID);
    const run2 = await stableHash(contactId, FIXED_EXPERIMENT_ID);
    const run3 = await stableHash(contactId, FIXED_EXPERIMENT_ID);

    expect(run1).toBe(run2);
    expect(run2).toBe(run3);
  });

  it("produces different buckets for different contactIds with the same experimentId", async () => {
    const id1 = "aaaaaaaa-0000-0000-0000-000000000001";
    const id2 = "aaaaaaaa-0000-0000-0000-000000000002";

    const bucket1 = await stableHash(id1, FIXED_EXPERIMENT_ID);
    const bucket2 = await stableHash(id2, FIXED_EXPERIMENT_ID);

    // These should almost certainly differ (collision probability ~1/10000)
    expect(bucket1).not.toBe(bucket2);
  });

  it("produces different buckets for different experimentIds with the same contactId", async () => {
    const contactId = "contact-fixed-00-0000-000000000000";
    const expId1 = "exp00001-e89b-12d3-a456-426614174000";
    const expId2 = "exp00002-e89b-12d3-a456-426614174000";

    const bucket1 = await stableHash(contactId, expId1);
    const bucket2 = await stableHash(contactId, expId2);

    expect(bucket1).not.toBe(bucket2);
  });

  it("distributes variants roughly evenly across 1000 random IDs (within 10% of 50/50)", async () => {
    const sampleSize = 1000;
    let controlCount = 0;
    let treatmentCount = 0;

    const promises: Promise<void>[] = [];
    for (let i = 0; i < sampleSize; i++) {
      // Generate synthetic UUIDs that vary by index
      const contactId = `subject-${String(i).padStart(6, "0")}-0000-0000-000000000000`;
      promises.push(
        stableHash(contactId, FIXED_EXPERIMENT_ID).then((bucket) => {
          if (assignVariant(bucket) === "control") {
            controlCount++;
          } else {
            treatmentCount++;
          }
        }),
      );
    }

    await Promise.all(promises);

    const controlRate = controlCount / sampleSize;
    const treatmentRate = treatmentCount / sampleSize;

    // Within 10% of 50/50 (i.e., each variant gets 40%–60% of assignments)
    expect(controlRate).toBeGreaterThanOrEqual(0.40);
    expect(controlRate).toBeLessThanOrEqual(0.60);
    expect(treatmentRate).toBeGreaterThanOrEqual(0.40);
    expect(treatmentRate).toBeLessThanOrEqual(0.60);

    // Sanity: they sum to 100%
    expect(controlCount + treatmentCount).toBe(sampleSize);
  });

  it("all bucket values fall within [0, 9999]", async () => {
    const sampleSize = 200;
    const promises: Promise<number>[] = [];

    for (let i = 0; i < sampleSize; i++) {
      const contactId = `range-check-${i}-0000-0000000000`;
      promises.push(stableHash(contactId, FIXED_EXPERIMENT_ID));
    }

    const buckets = await Promise.all(promises);

    for (const bucket of buckets) {
      expect(bucket).toBeGreaterThanOrEqual(0);
      expect(bucket).toBeLessThanOrEqual(9999);
      expect(Number.isInteger(bucket)).toBe(true);
    }
  });
});
