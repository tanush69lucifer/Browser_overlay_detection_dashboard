// OWNER: Sohil. STUB: replace with the real scoring engine (SPEC.md section 7).
// Contract: processBatch({ sessionId, examId, candidate: { id, name }, signals }) -> { flags: [] }
// Each returned flag is emitted to proctors as `flag:new`.
async function processBatch() {
  return { flags: [] };
}

module.exports = { processBatch };
