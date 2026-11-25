import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../src/server.js';
import TokenManager from '../src/tokenize/TokenManager.js';

/**
 * Membangun body multipart/form-data untuk pengujian server.inject Hapi.
 */
function buildMultipartPayload({ fields = {}, file } = {}) {
  const boundary = '----EsbeTestBoundary7MA4YWxkTrZu0gW';
  const parts = [];

  for (const [key, value] of Object.entries(fields)) {
    parts.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`,
      ),
    );
  }

  if (file) {
    parts.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${file.fieldName || 'file'}"; filename="${file.filename}"\r\nContent-Type: ${file.contentType}\r\n\r\n`,
      ),
    );
    parts.push(file.buffer);
    parts.push(Buffer.from('\r\n'));
  }

  parts.push(Buffer.from(`--${boundary}--\r\n`));

  return {
    headers: {
      'content-type': `multipart/form-data; boundary=${boundary}`,
    },
    payload: Buffer.concat(parts),
  };
}

describe('Mock POST /transactions/extract', () => {
  const employeeToken = TokenManager.generateAccessToken({
    id: 2,
    username: 'employee',
    role: 'employee',
  });

  const sampleImageBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);

  it('mengembalikan 401 jika request tanpa token JWT', async () => {
    const server = await createServer();
    const multipart = buildMultipartPayload({
      file: { filename: 'struk.jpg', contentType: 'image/jpeg', buffer: sampleImageBuffer },
    });

    const response = await server.inject({
      method: 'POST',
      url: '/transactions/extract',
      headers: multipart.headers,
      payload: multipart.payload,
    });

    assert.equal(response.statusCode, 401);
    assert.equal(response.result.error.code, 'UNAUTHORIZED');
  });

  it('mengembalikan data ekstraksi dummy sesuai kontrak (skenario default)', async () => {
    const server = await createServer();
    const multipart = buildMultipartPayload({
      fields: { shift: 'pagi', payment_method: 'qris' },
      file: { filename: 'struk-qris.jpg', contentType: 'image/jpeg', buffer: sampleImageBuffer },
    });

    const response = await server.inject({
      method: 'POST',
      url: '/transactions/extract',
      headers: {
        ...multipart.headers,
        authorization: `Bearer ${employeeToken}`,
      },
      payload: multipart.payload,
    });

    assert.equal(response.statusCode, 200);
    const { status, data } = response.result;
    assert.equal(status, 'success');
    assert.equal(data.is_mock, true);
    assert.equal(data.manual_input_required, false);
    assert.equal(data.ai_status, 'success');
    assert.equal(data.proof.original_filename, 'struk-qris.jpg');
    assert.equal(data.proof.mime_type, 'image/jpeg');
    assert.equal(data.proof.file_size, sampleImageBuffer.length);
    assert.equal(data.proof.sha256_hash.length, 64);
    assert.equal(data.extraction.amount, 145000);
    assert.match(data.extraction.transaction_time, /\+07:00$/);
    assert.equal(data.extraction.source, 'QRIS');
    assert.equal(data.extraction.method_used, 'ocr');
    assert.equal(data.duplicate_check.is_duplicate, false);
    assert.equal(data.draft.payment_proof_id, data.proof.proof_id);
  });

  it('mengembalikan peringatan duplikat saat mock_scenario=duplicate', async () => {
    const server = await createServer();
    const multipart = buildMultipartPayload({
      fields: { mock_scenario: 'duplicate' },
      file: { filename: 'struk-ulang.png', contentType: 'image/png', buffer: sampleImageBuffer },
    });

    const response = await server.inject({
      method: 'POST',
      url: '/transactions/extract',
      headers: {
        ...multipart.headers,
        authorization: `Bearer ${employeeToken}`,
      },
      payload: multipart.payload,
    });

    assert.equal(response.statusCode, 200);
    const { data } = response.result;
    assert.equal(data.duplicate_check.is_duplicate, true);
    assert.equal(data.duplicate_check.severity, 'high');
    assert.ok(data.duplicate_check.warning_message);
    assert.equal(data.duplicate_check.matches.length, 1);
    assert.equal(data.draft.is_duplicate, true);
  });

  it('mengembalikan field null (tanpa tebakan) saat mock_scenario=partial', async () => {
    const server = await createServer();
    const multipart = buildMultipartPayload({
      fields: { mock_scenario: 'partial' },
      file: { filename: 'struk-sebagian.webp', contentType: 'image/webp', buffer: sampleImageBuffer },
    });

    const response = await server.inject({
      method: 'POST',
      url: '/transactions/extract',
      headers: {
        ...multipart.headers,
        authorization: `Bearer ${employeeToken}`,
      },
      payload: multipart.payload,
    });

    assert.equal(response.statusCode, 200);
    const { data } = response.result;
    assert.equal(data.extraction.method_used, 'llm_fallback');
    assert.equal(data.extraction.amount, 75000);
    assert.equal(data.extraction.transaction_time, null);
    assert.equal(data.extraction.transaction_id, null);
    assert.equal(data.extraction.confidence.transaction_time, 0);
    assert.ok(data.extraction.warnings.includes('UNREADABLE_TIME'));
  });

  it('mengembalikan manual_input_required=true saat mock_scenario=ai_fallback', async () => {
    const server = await createServer();
    const multipart = buildMultipartPayload({
      fields: { mock_scenario: 'ai_fallback' },
      file: { filename: 'struk-buram.jpg', contentType: 'image/jpeg', buffer: sampleImageBuffer },
    });

    const response = await server.inject({
      method: 'POST',
      url: '/transactions/extract',
      headers: {
        ...multipart.headers,
        authorization: `Bearer ${employeeToken}`,
      },
      payload: multipart.payload,
    });

    assert.equal(response.statusCode, 200);
    const { data } = response.result;
    assert.equal(data.manual_input_required, true);
    assert.equal(data.ai_status, 'timeout');
    assert.equal(data.fallback_reason.code, 'AI_TIMEOUT');
    assert.equal(data.extraction, null);
    assert.equal(data.draft.amount, null);
    assert.ok(data.proof.proof_id);
  });

  it('mengembalikan 415 UNSUPPORTED_MEDIA_TYPE jika file bukan jpg/png/webp', async () => {
    const server = await createServer();
    const multipart = buildMultipartPayload({
      file: {
        filename: 'dokumen.pdf',
        contentType: 'application/pdf',
        buffer: Buffer.from('%PDF-1.4 mock'),
      },
    });

    const response = await server.inject({
      method: 'POST',
      url: '/transactions/extract',
      headers: {
        ...multipart.headers,
        authorization: `Bearer ${employeeToken}`,
      },
      payload: multipart.payload,
    });

    assert.equal(response.statusCode, 415);
    assert.equal(response.result.error.code, 'UNSUPPORTED_MEDIA_TYPE');
  });

  it('mengembalikan 400 VALIDATION_ERROR jika field file tidak dikirim', async () => {
    const server = await createServer();
    const multipart = buildMultipartPayload({
      fields: { shift: 'pagi' },
    });

    const response = await server.inject({
      method: 'POST',
      url: '/transactions/extract',
      headers: {
        ...multipart.headers,
        authorization: `Bearer ${employeeToken}`,
      },
      payload: multipart.payload,
    });

    assert.equal(response.statusCode, 400);
    assert.equal(response.result.error.code, 'VALIDATION_ERROR');
  });

  it('mengembalikan 413 FILE_TOO_LARGE jika ukuran file melebihi 5 MB', async () => {
    const server = await createServer();
    const oversizedBuffer = Buffer.alloc(5 * 1024 * 1024 + 1024, 0x61);
    const multipart = buildMultipartPayload({
      file: { filename: 'besar.jpg', contentType: 'image/jpeg', buffer: oversizedBuffer },
    });

    const response = await server.inject({
      method: 'POST',
      url: '/transactions/extract',
      headers: {
        ...multipart.headers,
        authorization: `Bearer ${employeeToken}`,
      },
      payload: multipart.payload,
    });

    assert.equal(response.statusCode, 413);
    assert.equal(response.result.error.code, 'FILE_TOO_LARGE');
  });
});
