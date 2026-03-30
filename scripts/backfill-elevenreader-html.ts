import { and, eq, inArray } from "drizzle-orm";

import { normalizeStoredBatchHtml } from "../api/_lib/queue.js";
import { getDatabase, getSqlClient } from "../db/client.js";
import { queueRunBatches, queueRuns } from "../db/schema.js";
import { loadLocalEnv } from "./load-env.js";

loadLocalEnv();

const database = getDatabase();
const sql = getSqlClient();
const runIds = process.argv.slice(2).filter(Boolean);

if (!database || !sql) {
  throw new Error("DATABASE_URL is required to run the ElevenReader HTML backfill.");
}

const runRows = await database
  .select({
    id: queueRuns.id,
    resultJson: queueRuns.resultJson,
  })
  .from(queueRuns)
  .where(
    runIds.length > 0
      ? and(eq(queueRuns.status, "succeeded"), inArray(queueRuns.id, runIds))
      : eq(queueRuns.status, "succeeded"),
  );

let updatedRuns = 0;
let updatedBatches = 0;

for (const run of runRows) {
  const batches = await database
    .select({
      batchIndex: queueRunBatches.batchIndex,
      html: queueRunBatches.html,
    })
    .from(queueRunBatches)
    .where(eq(queueRunBatches.runId, run.id));

  if (batches.length === 0) {
    continue;
  }

  const rewrittenBatches = batches.map((batch) => ({
    batchIndex: batch.batchIndex,
    html: normalizeStoredBatchHtml(batch.html),
  }));
  const rewrittenHtmlByBatch = new Map(
    rewrittenBatches.map((batch) => [batch.batchIndex, batch.html] as const),
  );
  const batchRowsChanged = rewrittenBatches.filter(
    (batch) => batch.html !== batches.find((row) => row.batchIndex === batch.batchIndex)?.html,
  );

  let resultJsonChanged = false;
  const rewrittenResult =
    run.resultJson === null
      ? null
      : {
          ...run.resultJson,
          batches: run.resultJson.batches.map((batch) => {
            const html = rewrittenHtmlByBatch.get(batch.index) ?? batch.html;

            if (html !== batch.html) {
              resultJsonChanged = true;
            }

            return {
              ...batch,
              html,
            };
          }),
        };

  if (batchRowsChanged.length === 0 && !resultJsonChanged) {
    continue;
  }

  await database.transaction(async (tx) => {
    for (const batch of batchRowsChanged) {
      await tx
        .update(queueRunBatches)
        .set({
          html: batch.html,
        })
        .where(and(eq(queueRunBatches.runId, run.id), eq(queueRunBatches.batchIndex, batch.batchIndex)));
    }

    if (rewrittenResult !== null && resultJsonChanged) {
      await tx
        .update(queueRuns)
        .set({
          resultJson: rewrittenResult,
        })
        .where(eq(queueRuns.id, run.id));
    }
  });

  updatedRuns += 1;
  updatedBatches += batchRowsChanged.length;
  console.log(`Backfilled run ${run.id} (${batchRowsChanged.length} batch rows updated).`);
}

await sql.end({ timeout: 5 });

console.log(
  `ElevenReader HTML backfill complete. Updated ${updatedRuns} runs and ${updatedBatches} batch rows.`,
);
