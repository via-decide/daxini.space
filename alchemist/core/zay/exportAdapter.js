(function(global) {
    'use strict';

    function buildZayPayload() {
        // Read directly from global Alchemist state to avoid double data models.
        const sessionAll = global.SESSION_ALL || [];
        const rawData = global.RAW_DATA || [];
        const sessionId = global.CURRENT_SES_ID || "SES_UNKNOWN";
        const mobile = global.USER_MOBILE || "GUEST";
        const score = global.XP || 0;
        const generatedAt = new Date().toISOString();

        // 1. Manifest
        const manifest = {
            format: ".zay",
            version: "2.0.0",
            compiler: "ALCHEMIST_ZAY_NATIVE",
            generatedAt: generatedAt,
            sessionId: sessionId,
            files: [
                "manifest.json",
                "cards.json",
                "entities.json",
                "graph.json",
                "metadata.json"
            ]
        };

        // 2. Cards (The core knowledge atoms)
        const uniqueCards = sessionAll.filter((q, i, self) => i === self.findIndex(t => (t.id === q.id)));
        const cards = {
            version: "1.0",
            total: uniqueCards.length,
            items: uniqueCards.map(c => ({
                id: c.id,
                domain: c.dom || "GEN",
                front: c.q || "",
                back: c.u || "",
                logic: c.logic || "",
                viewedAt: generatedAt
            }))
        };

        // 3. Entities (Derived from cards for semantic reasoning)
        const entitiesMap = {};
        uniqueCards.forEach(c => {
            const topic = c.dom || "Uncategorized";
            if (!entitiesMap[topic]) {
                entitiesMap[topic] = { id: `topic_${topic.replace(/\s+/g, "_")}`, type: "topic", label: topic, cardIds: [] };
            }
            entitiesMap[topic].cardIds.push(c.id);
        });

        const entities = {
            version: "1.0",
            items: Object.values(entitiesMap)
        };

        // 4. Graph (Edges mapping topics to cards)
        const edges = [];
        Object.values(entitiesMap).forEach(topicEntity => {
            topicEntity.cardIds.forEach(cardId => {
                edges.push({
                    source: topicEntity.id,
                    target: cardId,
                    relation: "contains"
                });
            });
        });

        const graph = {
            version: "1.0",
            nodes: entities.items.map(e => e.id).concat(uniqueCards.map(c => c.id)),
            edges: edges
        };

        // 5. Metadata (Scores, auth, telemetry)
        const metadata = {
            sessionId: sessionId,
            user: mobile,
            score: score,
            totalCardsSeen: sessionAll.length,
            uniqueCardsSeen: uniqueCards.length,
            exportedAt: generatedAt
        };

        return {
            manifest: JSON.stringify(manifest, null, 2),
            cards: JSON.stringify(cards, null, 2),
            entities: JSON.stringify(entities, null, 2),
            graph: JSON.stringify(graph, null, 2),
            metadata: JSON.stringify(metadata, null, 2)
        };
    }

    global.ZayExportAdapter = {
        buildZayPayload: buildZayPayload
    };

})(typeof window !== 'undefined' ? window : globalThis);
