import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../'); // Back out to daxini.space-main root

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { bundle, metadata } = req.body;
        if (!bundle || !metadata || !metadata.slug) {
            return res.status(400).json({ error: 'Missing bundle or metadata.slug' });
        }

        const slug = metadata.slug;
        const appDir = path.join(rootDir, 'apps', slug);

        // Ensure app directory exists
        if (!fs.existsSync(appDir)) {
            fs.mkdirSync(appDir, { recursive: true });
        }

        const files = bundle.build || {};
        
        // Write the core bundle files directly to the app directory
        if (files['index.html']) fs.writeFileSync(path.join(appDir, 'index.html'), files['index.html']);
        if (files['app.js']) fs.writeFileSync(path.join(appDir, 'app.js'), files['app.js']);
        if (files['style.css']) fs.writeFileSync(path.join(appDir, 'style.css'), files['style.css']);
        if (files['manifest.json']) fs.writeFileSync(path.join(appDir, 'manifest.json'), files['manifest.json']);
        
        fs.writeFileSync(path.join(appDir, 'metadata.json'), JSON.stringify(metadata, null, 2));
        
        if (bundle.architecture_prd) {
            fs.writeFileSync(path.join(appDir, 'architecture.json'), JSON.stringify({ prd: bundle.architecture_prd }, null, 2));
        }

        // Update the local registry.json
        const registryPath = path.join(rootDir, 'apps', 'registry.json');
        let registry = { apps: [], updatedAt: new Date().toISOString(), source: 'local-publish' };
        
        if (fs.existsSync(registryPath)) {
            try {
                registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
            } catch (err) {
                console.warn('Could not parse existing registry.json, creating a new one.');
            }
        }

        const apps = Array.isArray(registry.apps) ? registry.apps : [];
        const withoutCurrent = apps.filter((app) => app.slug !== slug);
        
        const newAppEntry = {
            slug,
            name: metadata.name,
            creator: metadata.creator || 'local-creator',
            appUrl: `/apps/${slug}/index.html`, // Use local path
            source: 'logichub-local',
            publishedAt: new Date().toISOString()
        };

        const updatedRegistry = {
            apps: [newAppEntry, ...withoutCurrent],
            updatedAt: new Date().toISOString(),
            source: 'local-publish'
        };

        fs.writeFileSync(registryPath, JSON.stringify(updatedRegistry, null, 2));

        res.status(200).json({ success: true, slug, message: 'App successfully published locally.' });
    } catch (error) {
        console.error('[publish.js] Error processing local publish:', error);
        res.status(500).json({ error: error.message });
    }
}
