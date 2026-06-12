/*
 * Service Worker for StudyOS
 *
 * This is a placeholder service worker that caches the app shell for offline usage.
 * Replace with Workbox or custom caching strategy for production.
 */

self.addEventListener('install', event => {
  console.log('StudyOS service worker installing');
  // Skip waiting to activate new service worker immediately
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  console.log('StudyOS service worker activating');
  // Clean up old caches or perform other activation tasks
});

self.addEventListener('fetch', event => {
  // Placeholder fetch handler for offline-first caching
});