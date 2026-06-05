# HARD EXECUTION GUARD

If ANY of the following happens:

- multiple outputs generated
- more than 2 files modified
- more than 20 lines changed per file
- new modules created in INTEGRATION task

→ STOP EXECUTION  
→ return: VIOLATION_DETECTED

---

MULTI VERSION RULE:

- generate internally
- output only ONE version

---

UI RULE:

- swipe UI must remain unchanged
