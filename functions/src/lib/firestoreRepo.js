const { FieldPath } = require('firebase-admin/firestore');
const { normalizeCursorId, parseLimit, sanitizeIso, toTrimmedString } = require('./validators');

async function resolveCursorSnapshot(collectionRef, cursorId) {
  const safeCursor = normalizeCursorId(cursorId);
  if (!safeCursor) return null;
  const snapshot = await collectionRef.doc(safeCursor).get();
  return snapshot.exists ? snapshot : null;
}

function toPublicDoc(doc) {
  return {
    id: doc.id,
    ...doc.data()
  };
}

async function listCollectionPage(collectionRef, options = {}) {
  const safeLimit = parseLimit(options.limit, { min: 1, max: 200, fallback: 50 });
  let query = collectionRef.orderBy('updatedAt', 'desc').orderBy(FieldPath.documentId(), 'desc').limit(safeLimit + 1);

  if (options.where && Array.isArray(options.where)) {
    for (const rule of options.where) {
      if (!rule || !rule.field || !rule.op) continue;
      query = query.where(rule.field, rule.op, rule.value);
    }
  }

  if (options.dateField) {
    const fromIso = sanitizeIso(options.dateFromIso);
    const toIso = sanitizeIso(options.dateToIso);
    if (fromIso) query = query.where(options.dateField, '>=', fromIso);
    if (toIso) query = query.where(options.dateField, '<=', toIso);
  }

  const cursorSnapshot = await resolveCursorSnapshot(collectionRef, options.cursor);
  if (cursorSnapshot) {
    const cursorData = cursorSnapshot.data() || {};
    query = query.startAfter(
      toTrimmedString(cursorData.updatedAt || ''),
      cursorSnapshot.id
    );
  }

  const snapshot = await query.get();
  const docs = snapshot.docs || [];
  const hasMore = docs.length > safeLimit;
  const pageDocs = hasMore ? docs.slice(0, safeLimit) : docs;
  const nextCursor = hasMore && pageDocs.length ? pageDocs[pageDocs.length - 1].id : '';

  return {
    items: pageDocs.map(toPublicDoc),
    hasMore,
    nextCursor
  };
}

module.exports = {
  listCollectionPage,
  toPublicDoc
};
