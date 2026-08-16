# Independent original-paper audit

Audit date: 2026-08-16  
Files reviewed: `evidence.md`, `chemistry.md`  
Decision: **APPROVE ViaLogic promotion for the current bounded claim set**

## Method

Each paper was independently resolved by DOI to its original publisher record. The title, authorship, affiliation where displayed, abstract, bibliographic data, and the exact propositions used in the profile were compared with `evidence.md` and `chemistry.md`. A separate scholarly-index extraction was used only as a cross-check; it did not replace the original record. No methodology extraction was available, so no procedural detail beyond the original abstracts is approved.

## Claim comparison

| Source | Original-paper proposition | Profile claim(s) tested | Result | Action |
|---|---|---|---|---|
| S05 · DOI 10.1007/BF02867446 | Formation constants for `[CuAL]` complexes were determined in 1:1 dioxane-water, ionic strength 0.2 mol dm⁻³ NaClO₄, at 30 °C using SCOGS; π-acid character and ligand substitution were discussed. | C007; coordination-thermodynamics paragraph | PASS | No correction required. |
| S06 · DOI 10.1007/BF02864187 | Formation constants for `[NiAL]` systems were measured under the stated mixed-solvent conditions and ΔlogK values were compared with corresponding Cu(II) complexes. | C008; nickel-comparison paragraph | PASS | Retain C014 so the title’s biological premise is not presented as modern consensus. |
| S03 · DOI 10.1246/bcsj.62.1325 | Mono- and binuclear Fe(III) Schiff-base chelates catalyzed alkene epoxidation with iodosylbenzene; binuclear complexes were superior for norbornene; pyridine bases increased rates and yields. | C009, C010; 1989 epoxidation paragraph | PASS | No correction required. The profile does not add unreported yields or mechanism. |
| S07 · DOI 10.1007/BF02841939 | Various olefin oxidations used Mn(III), binuclear Mn(II), and binuclear Fe(III) Schiff-base catalysts; activity was correlated with ligand structure, metal redox potential, and binuclear character. | C011; 1990 continuation sentence | PASS, UNDERSPECIFIED | Added C017 and C018 and expanded `chemistry.md` without exceeding the abstract. |

## Inference review

- **C015 · PASS:** The research-arc statement is a visible inference grounded in S03, S05, S06, and S07.
- **C016 · PASS:** The catalyst-design bridge is an inference grounded in the papers’ explicit treatment of ligand effects and binuclear character.
- Neither inference is attributed to the papers as a direct conclusion.

## Access and confidence limits

- Complete article text was not exposed by the public publisher interfaces for all four sources.
- The audit therefore approves only abstract-contained propositions and exact bibliographic facts.
- Paper-specific technical claims remain `REPORTED`, not `VERIFIED`, because a second index or publisher metadata record is not an independent experimental source.
- Yields, detailed substrate tables, kinetics, spectra, synthesis procedures, mechanistic assignments, and complete experimental conditions remain outside the approved scope.

## Decision

**APPROVE.** The current profile is internally consistent with the four principal original-paper records, preserves source confidence, separates inference, and states its access limits. ViaLogic promotion is approved for claims C001–C018 exactly as recorded. Any new or expanded claim reopens the gate.
