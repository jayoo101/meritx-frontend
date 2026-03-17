// [AUDIT FIX] C2: Server-side Pinata upload to avoid exposing JWT to client bundle
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const PINATA_JWT = process.env.PINATA_JWT;

export async function POST(request) {
  if (!PINATA_JWT) {
    return NextResponse.json(
      { success: false, error: 'IPFS service not configured on server' },
      { status: 500 }
    );
  }

  try {
    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const json = await request.json();
      const res = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${PINATA_JWT}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pinataContent: json.data,
          pinataOptions: { cidVersion: 1 },
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        return NextResponse.json(
          { success: false, error: `Pinata JSON upload failed (${res.status}): ${text}` },
          { status: 502 }
        );
      }
      const result = await res.json();
      return NextResponse.json({ success: true, IpfsHash: result.IpfsHash });
    }

    const formData = await request.formData();
    const file = formData.get('file');
    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    const pinataForm = new FormData();
    pinataForm.append('file', file);
    pinataForm.append('pinataOptions', JSON.stringify({ cidVersion: 1 }));

    const res = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: { Authorization: `Bearer ${PINATA_JWT}` },
      body: pinataForm,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return NextResponse.json(
        { success: false, error: `Pinata file upload failed (${res.status}): ${text}` },
        { status: 502 }
      );
    }
    const result = await res.json();
    return NextResponse.json({ success: true, IpfsHash: result.IpfsHash });
  } catch (err) {
    console.error('Upload API error:', err);
    return NextResponse.json(
      { success: false, error: 'Upload failed' },
      { status: 500 }
    );
  }
}
