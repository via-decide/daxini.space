import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  // CORS setup
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { traces, userSignals } = req.body;
    
    // Anonymize IP (from Vercel headers or socket)
    const rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const anonymizedIp = crypto.createHash('sha256').update(rawIp).digest('hex');

    const logEntry = {
      timestamp: new Date().toISOString(),
      anonymizedIp,
      signals: userSignals || [],
      traces: traces || []
    };

    // Vercel Serverless Functions can write to /tmp
    const tmpLogPath = '/tmp/traces.log';
    fs.appendFileSync(tmpLogPath, JSON.stringify(logEntry) + '\n');
    
    // Also console.log for Vercel Logs / GN8R to scrape
    console.log('[VIA-TRACE-ENGINE]', JSON.stringify(logEntry));

    return res.status(200).json({ success: true, message: 'Trace recorded' });
  } catch (err) {
    console.error('Error processing trace:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
