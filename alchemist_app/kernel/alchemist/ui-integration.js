/**
 * MODULE_CONTRACT
 * Inputs: dependencies ({ ingestionEngine, blockSystem, sessionEngine, threeDBlock }), options ({ eventTarget, adapter })
 * Outputs: selection routing results and lifecycle connection controls
 * Functions: createUIIntegrationLayer(), connectSelection(), connectSessionEnd(), disconnect()
 * Constraints: non-invasive hookup, selection-layer only, framework-free, reversible integration
 */
(function (global) {
  'use strict';

  function fail(code, message) {
    var error = new Error(message || code);
    error.code = code;
    throw error;
  }

  function createNoopResult(reason) {
    return { ok: false, reason: reason, block: null, session: null };
  }

  function createDefaultAdapter() {
    return {
      normalizeSelection: function (selection) {
        if (!selection || typeof selection !== 'object') {
          fail('UI_INTEGRATION_SELECTION_REQUIRED', 'Selection payload must be an object.');
        }

        return {
          contentType: selection.contentType || 'text',
          payload: selection.payload || { value: String(selection.value || '') },
          attach3D: Boolean(selection.attach3D),
          modelPath: selection.modelPath || '',
          interaction: selection.interaction,
          sessionName: selection.sessionName || null
        };
      }
    };
  }

  function createUIIntegrationLayer(deps, options) {
    var config = deps || {};
    var sessionEngine = config.sessionEngine;
    var ingestionEngine = config.ingestionEngine;
    var threeDBlock = config.threeDBlock || null;

    if (!sessionEngine || typeof sessionEngine.getSession !== 'function') {
      fail('UI_INTEGRATION_SESSION_REQUIRED', 'sessionEngine dependency is required.');
    }
    if (!ingestionEngine || typeof ingestionEngine.ingest !== 'function') {
      fail('UI_INTEGRATION_INGESTION_REQUIRED', 'ingestionEngine dependency is required.');
    }

    var opts = options || {};
    var adapter = opts.adapter || createDefaultAdapter();
    var listeners = [];

    function ensureSession(name) {
      var active = sessionEngine.getSession();
      if (active) return active;
      if (typeof sessionEngine.startSession !== 'function') {
        fail('UI_INTEGRATION_SESSION_START_MISSING', 'No active session and startSession is unavailable.');
      }
      return sessionEngine.startSession(name || 'UI Session');
    }

    function routeSelection(selection) {
      var safe;
      try {
        safe = adapter.normalizeSelection(selection);
      } catch (error) {
        return createNoopResult(error.code || 'UI_INTEGRATION_ADAPTER_FAILED');
      }

      try {
        ensureSession(safe.sessionName);
        var result = ingestionEngine.ingest({ type: safe.contentType, payload: safe.payload });

        if (safe.attach3D && threeDBlock && typeof threeDBlock.create === 'function' && typeof threeDBlock.addToSession === 'function') {
          var optional3D = threeDBlock.create('blk3d_' + result.blockId, safe.modelPath, safe.interaction);
          result.session = threeDBlock.addToSession(sessionEngine, optional3D);
          result.optional3D = optional3D;
        }

        return { ok: true, reason: null, block: result.block, session: result.session, optional3D: result.optional3D || null };
      } catch (error) {
        return createNoopResult(error.code || 'UI_INTEGRATION_ROUTE_FAILED');
      }
    }

    function connectSelection(eventTarget, eventName) {
      if (!eventTarget || typeof eventTarget.addEventListener !== 'function') {
        fail('UI_INTEGRATION_TARGET_REQUIRED', 'Event target with addEventListener is required.');
      }

      var resolvedEventName = eventName || 'alchemist:selection';
      var handler = function (event) {
        routeSelection(event && event.detail ? event.detail : null);
      };

      eventTarget.addEventListener(resolvedEventName, handler);
      listeners.push({ eventTarget: eventTarget, eventName: resolvedEventName, handler: handler });
      return function unsubscribe() {
        eventTarget.removeEventListener(resolvedEventName, handler);
      };
    }

    function connectSessionEnd(eventTarget, eventName) {
      if (!eventTarget || typeof eventTarget.addEventListener !== 'function') {
        fail('UI_INTEGRATION_TARGET_REQUIRED', 'Event target with addEventListener is required.');
      }
      var resolvedEventName = eventName || 'alchemist:session:end';
      var handler = function () {
        try {
          if (typeof sessionEngine.finalizeSession === 'function' && sessionEngine.getSession()) {
            sessionEngine.finalizeSession();
          }
        } catch (error) {
          return null;
        }
        return null;
      };
      eventTarget.addEventListener(resolvedEventName, handler);
      listeners.push({ eventTarget: eventTarget, eventName: resolvedEventName, handler: handler });
      return function unsubscribe() {
        eventTarget.removeEventListener(resolvedEventName, handler);
      };
    }

    function disconnect() {
      listeners.forEach(function (item) {
        item.eventTarget.removeEventListener(item.eventName, item.handler);
      });
      listeners = [];
    }

    return {
      routeSelection: routeSelection,
      connectSelection: connectSelection,
      connectSessionEnd: connectSessionEnd,
      disconnect: disconnect
    };
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { createUIIntegrationLayer: createUIIntegrationLayer };
  }

  global.AlchemistUIIntegration = {
    create: createUIIntegrationLayer
  };
})(typeof window !== 'undefined' ? window : globalThis);
