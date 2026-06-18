(function(global) {
    'use strict';

    const distributionText = `Built with Alchemist
This publication was developed using Alchemist.

Alchemist is a knowledge-construction environment designed to transform ideas, research, learning sessions, and structured thinking into reusable knowledge artifacts.

---
Available Formats
This work may be distributed as:
PDF
EPUB
ZAY

PDF preserves presentation.
EPUB preserves reading.
ZAY preserves knowledge structure.

---
What is a ZAY Artifact?
A .zay artifact may contain:
concepts
entities
relationships
knowledge graphs
learning structures
metadata
allowing knowledge to be reconstructed rather than simply viewed.

---
Continue Exploring
Learn more about the ecosystem:
https://daxini.space`;

    const distributionHTML = `
        <h1>Built with Alchemist</h1>
        <p>This publication was developed using <strong>Alchemist</strong>.</p>
        <p>Alchemist is a knowledge-construction environment designed to transform ideas, research, learning sessions, and structured thinking into reusable knowledge artifacts.</p>
        <hr/>
        <h2>Available Formats</h2>
        <p>This work may be distributed as:</p>
        <ul>
            <li><strong>PDF</strong>: preserves presentation.</li>
            <li><strong>EPUB</strong>: preserves reading.</li>
            <li><strong>ZAY</strong>: preserves knowledge structure.</li>
        </ul>
        <hr/>
        <h2>What is a ZAY Artifact?</h2>
        <p>A .zay artifact may contain:</p>
        <ul>
            <li>concepts</li>
            <li>entities</li>
            <li>relationships</li>
            <li>knowledge graphs</li>
            <li>learning structures</li>
            <li>metadata</li>
        </ul>
        <p>...allowing knowledge to be reconstructed rather than simply viewed.</p>
        <hr/>
        <h2>Continue Exploring</h2>
        <p>Learn more about the ecosystem: <a href="https://daxini.space">https://daxini.space</a></p>
    `;

    /**
     * Appends the distribution footer to a jsPDF document.
     */
    function appendFooterToPDF(doc, currentY, marginLeft, width, addNewPageFn) {
        // Add a new page to ensure the distribution info stands alone
        if (typeof addNewPageFn === 'function') {
            currentY = addNewPageFn();
        } else {
            doc.addPage();
            currentY = 20;
        }

        doc.setFont("times", "bold");
        doc.setFontSize(16);
        doc.text("Built with Alchemist", 105, currentY, { align: "center" });
        currentY += 10;
        
        doc.setFont("times", "normal");
        doc.setFontSize(10);
        
        const lines = distributionText.split("\n");
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line === "---") {
                currentY += 5;
                doc.setDrawColor(200);
                doc.setLineWidth(0.1);
                doc.line(marginLeft, currentY, 195, currentY);
                currentY += 8;
                continue;
            }
            
            // Check if we need to wrap
            if (currentY > 270) {
                if (typeof addNewPageFn === 'function') {
                    currentY = addNewPageFn();
                } else {
                    doc.addPage();
                    currentY = 20;
                }
            }

            if (line.endsWith('?')) {
                doc.setFont("times", "bold");
            }

            const splitLines = doc.splitTextToSize(line, width);
            doc.text(splitLines, marginLeft, currentY);
            currentY += (splitLines.length * 5);
            doc.setFont("times", "normal");
        }
        
        return currentY;
    }

    /**
     * Returns a valid EPUB chapter object for the distribution footer.
     */
    function getEPUBFooterChapter() {
        return {
            id: 'distribution_footer',
            title: 'About this Artifact',
            content: distributionHTML
        };
    }

    global.AlchemistDistribution = {
        appendFooterToPDF: appendFooterToPDF,
        getEPUBFooterChapter: getEPUBFooterChapter,
        rawText: distributionText,
        rawHTML: distributionHTML
    };

})(typeof window !== 'undefined' ? window : globalThis);
