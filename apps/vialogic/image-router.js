/**
 * Sovereign Image Router — Daxini Space Integration
 * Adapts central registry for UI consumption.
 */

const IMAGE_REGISTRY_URL = "/registry/images.json";

/**
 * Normalizes registry data for UI rendering.
 * Ensures consistent schema even if underlying data drifts.
 */
function normalizeRegistry(data) {
  if (!data || !Array.isArray(data.apps)) return [];
  
  return data.apps.map(app => ({
    id: app.id,
    title: app.name,
    subtitle: app.tagline,
    description: app.description,
    url: app.download_url,
    repo: app.repo_url,
    mime: app.mime || "image/png",
    timestamp: app.created_at,
    type: "image_asset"
  }));
}

async function loadSovereignImages() {
  try {
    const response = await fetch(IMAGE_REGISTRY_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error("Registry offline");
    
    const data = await response.json();
    return normalizeRegistry(data);
  } catch (err) {
    console.error("[Sovereign] Image Registry Load Failed:", err);
    return [];
  }
}

window.ImageRouter = {
  loadSovereignImages,
  normalizeRegistry
};
