const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

console.log('====================================================');
console.log('🧪 RUNNING HARDENED CLOUDINARY UPLOAD & RETRY TEST SUITE');
console.log('====================================================\n');

// 1. Robust extraction: find upload module script by signature, not fragile fixed index
const htmlPath = path.join(__dirname, '..', 'ادمن_2.HTML');
const htmlContent = fs.readFileSync(htmlPath, 'utf8');
const scripts = [];
const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
let match;
while ((match = scriptRegex.exec(htmlContent))) {
  scripts.push(match[1]);
}
const targetScript = scripts.find(
  (s) => s.includes('uploadMatchedFilesToCloudinary') && s.includes('EXCEL_IMAGE_UPLOAD_MODAL_ID')
);
assert(targetScript && targetScript.length > 50000, 'Upload module script must be extracted reliably from ادمن_2.HTML');

function createMockElement(tag = 'div') {
  return {
    tagName: tag.toUpperCase(),
    style: {},
    attributes: {},
    innerHTML: '',
    textContent: '',
    value: '',
    disabled: false,
    children: [],
    setAttribute(k, v) { this.attributes[k] = String(v); },
    getAttribute(k) { return this.attributes[k]; },
    addEventListener() {},
    removeEventListener() {},
    focus() {},
    select() {},
    click() {},
    appendChild(child) { this.children.push(child); return child; },
    querySelector() { return createMockElement('div'); },
    querySelectorAll() { return []; }
  };
}

function createEnvironment(customMocks = {}) {
  const ctx = {
    console,
    setTimeout,
    clearTimeout,
    AbortController,
    Set,
    Map,
    Array,
    Object,
    String,
    Number,
    Boolean,
    Math,
    Date,
    RegExp,
    Error,
    products: [],
    navigator: { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) NodeTest' }
  };

  ctx.window = ctx;
  ctx.window.addEventListener = () => {};
  ctx.document = {
    getElementById: () => null,
    createElement: (tag) => createMockElement(tag),
    body: createMockElement('body'),
    createDocumentFragment: () => createMockElement('fragment')
  };
  ctx.showNotification = () => {};
  ctx.requestAnimationFrame = (fn) => setTimeout(fn, 0);

  vm.createContext(ctx);
  vm.runInContext(targetScript, ctx);

  // Apply custom mocks AFTER script evaluation so declarations can be intercepted
  Object.assign(ctx, customMocks);

  return ctx;
}

let passedTests = 0;
let totalTests = 0;

async function runAsyncTest(name, fn) {
  totalTests += 1;
  try {
    await fn();
    console.log(`✅ [PASS] ${name}`);
    passedTests += 1;
  } catch (err) {
    console.error(`❌ [FAIL] ${name}:`, err.message);
    throw err;
  }
}

(async () => {
  // Scenario A: Upload fails
  await runAsyncTest('Scenario A: Upload fails - metadata preserved in retry queue', async () => {
    const env = createEnvironment({
      uploadToCloudinary: async () => {
        const err = new Error('Cloudinary timeout (504 Gateway Timeout)');
        err.status = 504;
        throw err;
      }
    });

    const fileMock = { name: 'product-omega.png', size: 102400 };
    const matched = [
      {
        file: fileMock,
        key: 'product-omega',
        productIds: ['prod-omega-1'],
        productNames: ['Omega Watch']
      }
    ];

    const result = await env.uploadMatchedFilesToCloudinary(matched);
    assert.strictEqual(result.uploaded.length, 0, 'No files should be uploaded');
    assert.strictEqual(result.failed.length, 1, 'Failed count should be 1');
    const failedItem = result.failed[0];
    assert.strictEqual(failedItem.file, 'product-omega.png', 'File name preserved');
    assert.strictEqual(failedItem.key, 'product-omega', 'Match key preserved');
    assert.deepStrictEqual([...failedItem.productIds], ['prod-omega-1'], 'Product IDs preserved');
    assert.deepStrictEqual([...failedItem.productNames], ['Omega Watch'], 'Product names preserved');
    assert.strictEqual(failedItem.transient, true, 'Error recognized as transient');
    assert.strictEqual(env.getExcelImageUploaderRuntime().lastFailedItems.length, 1, 'Runtime retains lastFailedItems');
  });

  // Scenario B: Upload succeeds but persistence fails
  await runAsyncTest('Scenario B: Upload succeeds but persistence fails - asset identity preserved', async () => {
    const env = createEnvironment({
      updateProduct: async () => {
        const err = new Error('Firestore connection timeout');
        err.code = 'unavailable';
        throw err;
      }
    });

    const uploadedItems = [
      {
        file: 'product-alpha.jpg',
        publicId: 'salezone_prod_alpha',
        secureUrl: 'https://res.cloudinary.com/salezone/image/upload/v1234/product-alpha.jpg',
        productIds: ['prod-alpha-1'],
        productNames: ['Alpha Shoes']
      }
    ];

    const persistResult = await env.persistUploadedImagesToProducts(uploadedItems);
    assert.strictEqual(persistResult.linkedProducts.length, 0, 'No products linked');
    assert.strictEqual(persistResult.failed.length, 1, '1 product link failure');
    const fail = persistResult.failed[0];
    assert.strictEqual(fail.productId, 'prod-alpha-1', 'Product ID preserved');
    assert.strictEqual(fail.secureUrl, 'https://res.cloudinary.com/salezone/image/upload/v1234/product-alpha.jpg', 'Secure URL preserved');
    assert.strictEqual(fail.publicId, 'salezone_prod_alpha', 'Public ID preserved');
    assert.strictEqual(fail.transient, true, 'Transient failure flag set');
  });

  // Scenario C: Retry persistence without uploading again (Decisive Acceptance Test)
  await runAsyncTest('Scenario C: Retry persistence without uploading again - DECISIVE ACCEPTANCE TEST', async () => {
    let uploadCallCount = 0;
    let persistenceCallCount = 0;
    const updatedProducts = [];

    const env = createEnvironment({
      uploadToCloudinary: async () => {
        uploadCallCount += 1;
        return {
          url: 'https://res.cloudinary.com/salezone/image/upload/v999/unexpected.jpg',
          publicId: 'unexpected'
        };
      },
      updateProduct: async (id, data) => {
        persistenceCallCount += 1;
        updatedProducts.push({ id, data });
      }
    });

    const runtime = env.getExcelImageUploaderRuntime();
    runtime.mode = 'excel';
    runtime.failedRetryQueue = [
      {
        file: 'product-alpha.jpg',
        key: 'product-alpha',
        productId: 'prod-alpha-1',
        publicId: 'salezone_prod_alpha',
        secureUrl: 'https://res.cloudinary.com/salezone/image/upload/v1234/product-alpha.jpg',
        productNames: ['Alpha Shoes'],
        transient: true
      }
    ];

    const uploadCallsBeforeRetry = uploadCallCount;
    assert.strictEqual(uploadCallsBeforeRetry, 0, 'Upload call count starts at 0');

    // Trigger retry
    await env.retryFailedUploadsOnly();

    const uploadCallsAfterRetry = uploadCallCount;

    console.log(`   📊 uploadCallsBeforeRetry: ${uploadCallsBeforeRetry}`);
    console.log(`   📊 uploadCallsAfterRetry:  ${uploadCallsAfterRetry}`);
    console.log(`   📊 persistenceCallCount:   ${persistenceCallCount}`);

    // CRITICAL ASSERTION:
    assert.strictEqual(
      uploadCallsBeforeRetry,
      uploadCallsAfterRetry,
      'DECISIVE TEST: uploadCallsBeforeRetry and uploadCallsAfterRetry MUST BE EQUAL'
    );
    assert.strictEqual(persistenceCallCount, 1, 'Persistence was attempted for the product');
    assert.strictEqual(updatedProducts[0].id, 'prod-alpha-1', 'Target product updated');
    assert.strictEqual(
      updatedProducts[0].data.image,
      'https://res.cloudinary.com/salezone/image/upload/v1234/product-alpha.jpg',
      'Existing Cloudinary URL reused'
    );
    assert.strictEqual(updatedProducts[0].data.imagePublicId, 'salezone_prod_alpha', 'Existing publicId reused');
  });

  // Scenario D: True upload failure vs persistence failure isolation
  await runAsyncTest('Scenario D: True upload failure only sends upload failures to Cloudinary', async () => {
    let uploadCallCount = 0;
    const uploadedFiles = [];
    const updatedProducts = [];

    const env = createEnvironment({
      uploadToCloudinary: async (file) => {
        uploadCallCount += 1;
        uploadedFiles.push(file.name);
        return {
          url: `https://res.cloudinary.com/salezone/image/upload/v1/${file.name}`,
          publicId: `pub_${file.name}`
        };
      },
      updateProduct: async (id, data) => {
        updatedProducts.push({ id, data });
      },
      pickFolderFilesWithFallback: async () => [
        { name: 'failed-upload.png', size: 1024 }
      ]
    });

    const runtime = env.getExcelImageUploaderRuntime();
    runtime.mode = 'excel';
    runtime.failedRetryQueue = [
      // Item 1: True upload failure (NO secureUrl, NO productId)
      {
        file: 'failed-upload.png',
        key: 'failed-upload',
        productIds: ['prod-true-fail-1'],
        productNames: ['True Fail Product'],
        transient: true
      },
      // Item 2: Persistence-only failure (HAS secureUrl and productId)
      {
        file: 'already-uploaded.jpg',
        key: 'already-uploaded',
        productId: 'prod-persist-fail-2',
        publicId: 'pub_already_uploaded',
        secureUrl: 'https://res.cloudinary.com/salezone/image/upload/v1/already-uploaded.jpg',
        transient: true
      }
    ];

    await env.retryFailedUploadsOnly();

    assert.strictEqual(uploadCallCount, 1, 'Only 1 upload call made');
    assert.strictEqual(uploadedFiles[0], 'failed-upload.png', 'Only failed-upload.png was sent to Upload API');
    assert.strictEqual(
      uploadedFiles.includes('already-uploaded.jpg'),
      false,
      'already-uploaded.jpg was NOT re-sent to Upload API'
    );
    assert.strictEqual(updatedProducts.length, 2, 'Both products persisted successfully');
  });

  // Scenario E: Multiple targets / partial failures
  await runAsyncTest('Scenario E: Multiple targets / partial failures - independent status', async () => {
    let prodAFails = true;
    let prodASaved = 0;
    let prodBSaved = 0;

    const env = createEnvironment({
      updateProduct: async (id) => {
        if (id === 'prod-target-A' && prodAFails) {
          throw new Error('Firestore write quota exceeded on target A');
        }
        if (id === 'prod-target-A') prodASaved += 1;
        if (id === 'prod-target-B') prodBSaved += 1;
      }
    });

    const sharedAsset = {
      file: 'shared-banner.jpg',
      publicId: 'pub_shared_banner',
      secureUrl: 'https://res.cloudinary.com/salezone/image/upload/v1/shared-banner.jpg',
      productIds: ['prod-target-A', 'prod-target-B'],
      productNames: ['Product A', 'Product B']
    };

    const firstRun = await env.persistUploadedImagesToProducts([sharedAsset]);
    assert.deepStrictEqual([...firstRun.linkedProducts], ['prod-target-B'], 'Target B succeeded');
    assert.strictEqual(firstRun.failed.length, 1, 'Target A failed');
    assert.strictEqual(firstRun.failed[0].productId, 'prod-target-A', 'Failure specifically identifies Target A');
    assert.strictEqual(firstRun.failed[0].secureUrl, sharedAsset.secureUrl, 'Asset URL retained');
    assert.strictEqual(prodBSaved, 1, 'Target B saved once');
    assert.strictEqual(prodASaved, 0, 'Target A not yet saved');

    // Now retry Target A only
    prodAFails = false; // Firestore now healthy
    const retryRun = await env.persistUploadedImagesToProducts([
      {
        file: firstRun.failed[0].file,
        publicId: firstRun.failed[0].publicId,
        secureUrl: firstRun.failed[0].secureUrl,
        productIds: [firstRun.failed[0].productId],
        productNames: firstRun.failed[0].productNames
      }
    ]);

    assert.deepStrictEqual([...retryRun.linkedProducts], ['prod-target-A'], 'Target A now succeeded');
    assert.strictEqual(retryRun.failed.length, 0, 'No remaining failures');
    assert.strictEqual(prodBSaved, 1, 'Target B was not repeated unnecessarily');
    assert.strictEqual(prodASaved, 1, 'Target A saved once');
  });

  // Scenario F1: Real Concurrency Barrier - Direct Upload Queue Locking
  await runAsyncTest('Scenario F1: Concurrency barrier - duplicate concurrent batch execution locked', async () => {
    let resolveBatch1;
    const batch1Barrier = new Promise((resolve) => {
      resolveBatch1 = resolve;
    });

    let batch1UploadCalls = 0;
    let batch2UploadCalls = 0;

    const env = createEnvironment({
      uploadToCloudinary: async (file) => {
        batch1UploadCalls += 1;
        // Hang on barrier simulating in-flight network activity
        await batch1Barrier;
        return {
          url: `https://res.cloudinary.com/test/${file.name}`,
          publicId: `pub_${file.name}`
        };
      }
    });

    // 1. Launch Batch 1 asynchronously without awaiting
    const batch1Promise = env.uploadMatchedFilesToCloudinary([
      { file: { name: 'file-1.png' }, key: 'key-1' }
    ]);

    // Yield control so Batch 1 initializes and engages lock
    await new Promise((r) => setTimeout(r, 15));

    // Verify lock is actively held
    assert.strictEqual(
      env.getExcelImageUploaderRuntime().inFlight,
      true,
      'Lock must be held while Batch 1 is in-flight'
    );

    // 2. Attempt to launch Batch 2 while Batch 1 is running
    let warningMessage = '';
    env.showNotification = (type, msg) => { warningMessage = msg; };

    const batch2Result = await env.uploadMatchedFilesToCloudinary([
      { file: { name: 'file-2.png' }, key: 'key-2' }
    ]);

    // Verify Batch 2 was blocked by concurrency guard
    assert.strictEqual(batch2Result.locked, true, 'Batch 2 must be rejected with locked: true');
    assert.strictEqual(batch2Result.uploaded.length, 0, 'Batch 2 uploaded nothing');
    assert.strictEqual(warningMessage.includes('جارية بالفعل'), true, 'Warning notification shown for duplicate batch');

    // 3. Attempt retry click while Batch 1 is running
    let retryWarning = '';
    env.showNotification = (type, msg) => { retryWarning = msg; };
    await env.retryFailedUploadsOnly();
    assert.strictEqual(retryWarning.includes('جارية بالفعل'), true, 'Retry click during upload must be blocked');

    // 4. Release Batch 1 barrier
    resolveBatch1();
    const batch1Result = await batch1Promise;

    // Verify Batch 1 completed properly
    assert.strictEqual(batch1Result.uploaded.length, 1, 'Batch 1 completed successfully');
    assert.strictEqual(batch1UploadCalls, 1, 'Strictly 1 upload call occurred across both batch attempts');

    // Verify lock is released cleanly after completion
    assert.strictEqual(
      env.getExcelImageUploaderRuntime().inFlight,
      false,
      'Lock must be released after batch completion'
    );
  });

  // Scenario F2: Real Concurrency Barrier - Retry Queue Locking
  await runAsyncTest('Scenario F2: Concurrency barrier - duplicate retry click locked during persistence', async () => {
    let resolveRetry1;
    const retry1Barrier = new Promise((resolve) => {
      resolveRetry1 = resolve;
    });

    let persistenceAttempts = 0;
    const env = createEnvironment({
      updateProduct: async () => {
        persistenceAttempts += 1;
        await retry1Barrier; // Hang on barrier
      }
    });

    const runtime = env.getExcelImageUploaderRuntime();
    runtime.mode = 'excel';
    runtime.failedRetryQueue = [
      {
        file: 'cached.jpg',
        productId: 'P-LOCKED',
        publicId: 'pub_locked',
        secureUrl: 'https://res.cloudinary.com/test/cached.jpg',
        transient: true
      }
    ];

    // Launch Retry 1
    const retry1Promise = env.retryFailedUploadsOnly();
    await new Promise((r) => setTimeout(r, 15));

    // Assert lock is held as 'retry'
    assert.strictEqual(runtime.inFlight, 'retry', 'Runtime inFlight must be locked during retry');

    // Attempt second concurrent retry
    let blockedNotice = '';
    env.showNotification = (type, msg) => { blockedNotice = msg; };
    await env.retryFailedUploadsOnly();
    assert.strictEqual(blockedNotice.includes('جارية بالفعل'), true, 'Concurrent retry click must be blocked');

    // Release Retry 1
    resolveRetry1();
    await retry1Promise;

    // Verify clean release and execution
    assert.strictEqual(runtime.inFlight, false, 'Lock must be freed after retry completes');
    assert.strictEqual(persistenceAttempts, 1, 'Persistence executed strictly once');
  });

  // Scenario F3: Cancellation, accurate counters, and Object URL cleanup
  await runAsyncTest('Scenario F3: Cancellation, accurate counters, and clean state recovery', async () => {
    let uploadStarted = false;
    const cancelEnv = createEnvironment({
      uploadToCloudinary: async () => {
        uploadStarted = true;
        cancelEnv.getExcelImageUploaderRuntime().cancelRequested = true;
        const err = new Error('Upload canceled by user');
        throw err;
      }
    });

    const cancelResult = await cancelEnv.uploadMatchedFilesToCloudinary([
      { file: { name: 'cancel-file-1.png' }, key: 'cancel-1' },
      { file: { name: 'cancel-file-2.png' }, key: 'cancel-2' }
    ]);

    assert.strictEqual(uploadStarted, true, 'Upload started');
    assert.strictEqual(cancelResult.canceled, true, 'Canceled flag reported accurately');
    assert.strictEqual(cancelEnv.getExcelImageUploaderRuntime().inFlight, false, 'inFlight reset after cancel');

    // Final counters test via finalizeExcelImageUploadModal
    const finalEnv = createEnvironment();
    const finalRuntime = finalEnv.getExcelImageUploaderRuntime();
    finalEnv.finalizeExcelImageUploadModal({
      uploaded: [{ file: 'u1.jpg' }, { file: 'u2.jpg' }],
      failed: [{ file: 'f1.jpg', error: 'err' }],
      missingRequired: ['m1.jpg'],
      duplicatesSkipped: ['d1.jpg'],
      linkedProducts: ['P1', 'P2']
    });

    assert.strictEqual(finalRuntime.failedRetryQueue.length, 1, 'Failed queue populated with exact failed count');
    assert.strictEqual(finalRuntime.lastFailedItems.length, 1, 'lastFailedItems populated');
    assert.strictEqual(finalRuntime.missingListText.includes('m1.jpg'), true, 'Missing list text formatted correctly');
  });

  console.log('\n====================================================');
  console.log(`🎉 ALL ${passedTests}/${totalTests} HARDENED CLOUDINARY VALIDATION TESTS PASSED!`);
  console.log('====================================================\n');
})();
