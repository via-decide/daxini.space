import json

md_003 = """# ZAYVORA RUNTIME LOG #003

## Constraint Preservation

**What a failed filament swap taught me about manufacturing, CAD, learning systems, and the Lore Key.**

---

## Opening Observation

Three different systems failed in the same way.

A manufacturing run produced grey bleed at a color boundary. A CAD generation produced a key and a dock that did not fit each other. A learning product produced students who had received everything and retained nothing that compounded.

In each case, the output looked close to correct.

In each case, the thing that had to remain true had not remained true.

The failures were not identical in mechanism. They were identical in cause. Each system reached its output by a path that violated one constraint it could not afford to violate. The output emerged anyway. The constraint was already gone by the time anyone noticed.

This log is a record of that pattern, what caused it in each domain, and what changed as a result.

---

## What Failed In Manufacturing

The Lore Key is a dual-color physical identity artifact. Black PLA Pro base. White PLA Pro cap and icon layer. Embedded NTAG213 NFC sticker at mid-height. Single nozzle, no AMS, Bambu Lab A1 Mini.

The first production attempt failed at the color transition.

The manual filament swap required the printer to pause. During that pause, the Black PLA Pro sat idle inside the hot zone. Heat creep expanded the filament into a swollen plug. When retraction was attempted, the plug jammed in the PTFE throat. The swap stalled completely.

That was one failure.

The pause had been sliced exactly on the boundary layer between black and white. This meant the color change did not complete inside the geometry before the visible surface began printing. The first white paths printed with near-zero nozzle pressure. The result was muddy grey at the visible transition boundary, under-extrusion, and localized bleeding across every unit on the plate.

The printer had not malfunctioned. Every component operated within specification. The failure was not mechanical.

The failure was that pressure continuity across the color transition had not been preserved.

The second failure was different in mechanism.

During a later run, the A1 Mini touchscreen froze during the manual pause sequence. The Bambu Handy mobile application blocked manual extruder and temperature overrides during an active pause. The machine was locked. The operator could not push, retract, or resume. A power cycle would have risked baking the filament in the nozzle and losing the entire plate.

The printer had a recovery path. It was not in the mobile app.

It was in Bambu Studio on a connected desktop. Device tab. Manual extruder controls. Temperature verified. Filament pushed, retracted, reloaded, and resumed remotely.

The system recovered. But only because the operator looked for the constraint that still had to be true: nozzle temperature active, extruder controllable, resume possible. Everything else had failed. That constraint had not.

---

## What Changed In The Process

The manufacturing correction did not add complexity.

It identified the constraint that had been violated and rebuilt the process around preserving it.

The pause was moved one layer below the visible color transition. This forced the initial purge — the grey contamination zone — into internal gyroid infill. The first visible white layer now begins only after the transition has already completed inside the geometry. The boundary is sharp because the constraint is resolved before the surface starts.

A Prime Tower was added, centrally positioned on the plate, with a prime volume of at least 30mm³. Its function is one thing: equalize volumetric pressure before the nozzle reaches any production part. The toolhead transitions through Black to Grey to White on the tower. By the time it reaches the tokens, it is carrying pure white at stable pressure. Contamination is trapped permanently inside the shell.

The manual heat-creep bypass was standardized. Push the filament down 1 to 2mm by hand before triggering the unload sequence. The downward pressure melts and displaces the swollen plug before retraction pulls it backward through the throat.

Each fix was narrow. Each fix preserved exactly one constraint that had to remain true.

The output changed entirely.

---

## What Failed In CAD Tooling

The Lore Key required a mechanical gate geometry. The concept was a random B-spline profile — a closed curve generated from a unique set of control points — used to produce two outputs simultaneously: the key extrusion and the dock cavity.

The requirement was structurally simple.

One geometric origin. Two outputs. The key and dock fit because they share the same spline, not because tolerances were matched after the fact. The fit is guaranteed by construction.

Both ChatGPT and Gemini were given this requirement. Both produced code that compiled. Both produced code that ran. In both cases, the key geometry and the dock cavity geometry were generated from separate operations. The shared-origin constraint was not preserved. The code appeared valid. The invariant that the entire architecture depended on was absent.

The code compiled.

The constraint failed.

The fit failed.

The models had not misunderstood the syntax. They had quietly restructured the problem into the nearest familiar pattern from their training distribution: matched-tolerance key and lock design. Standard CAD workflow. Syntactically and structurally conventional. Architecturally wrong for this specific requirement.

Both models were asked: what is most likely, given what I have seen?

The problem required a different question: what must remain true, regardless of what anyone has seen before?

Those are not variations of the same reasoning. They are different operations. One reconstructs. The other preserves.

A system that optimizes for probable output will always drift toward convention when convention and constraint are in tension. The code will look fine. The system intent will be gone.

---

## What Changed In The Hardware Model

The B-spline geometry is one path. It is not the only one.

A simpler mechanical gate produces the same security property with less manufacturing complexity.

The key body is a teardrop or keychain form with a pattern of holes or cut-outs. The dock has matching posts or pins. The correct key seats fully because its cut-pattern passes cleanly over the dock's pin pattern. An incorrect key cannot seat. Partial insertion means the NFC tag and Hall sensor are not in alignment. No alignment means no signal. No signal means no environment.

The constraint is preserved by physical geometry. The wrong key does not fail at software. It fails before the software layer is reached.

This is easier to print. Easier to inspect. Easier to generate parametrically. The principle is the same as the spline approach: one geometric truth produces both the key and the dock. The cut pattern is the key. The pin pattern is its inverse. They are derived from the same source. Reproduction without that source produces a key that does not pass the pins.

The current direction is this simpler model. The B-spline geometry remains a more complex variant for higher-uniqueness applications.

---

## What Failed In The Content Model

The initial product assumption was standard.

The value is the content. Protect the content. Gate access to the content. Charge for access.

Physical token. NFC chip. Authentication before delivery. Content gated behind identity.

Reasonable model.

Wrong premise.

The premise fails because of something content cannot escape. When a person understands something, the information that produced that understanding has left every container built to hold it. PDFs are copied. Flashcard sets are screenshotted. Mock examinations are reconstructed question by question from memory. A cheap NFC sticker can be cloned in minutes. A ₹23 tag holding an authentication string is not a security mechanism. It is a tripwire.

Content protection is not an engineering problem with a technical solution. It is a physics problem. The moment comprehension occurs, the container is irrelevant.

This means the original design question was wrong.

The question was: how do we ensure only the key holder can access the material?

The actual question is: what continues to compound after the material has been accessed?

---

## What Changed In The Product Model

The answer to that question is not content.

Consider two students given identical material. The same question bank. The same syllabus. The same recorded lectures.

One has a preparation environment that tracks which concepts failed under real examination pressure. It adjusts configuration in response. It accumulates a reasoning history across every session. It remembers which problems required three attempts before they resolved, and which reasoning paths collapsed under time pressure. It remembers what was tried and what did not work.

The other has a PDF.

The content was identical.

What surrounds that content is not.

The first student has state. A failure log. A configuration shaped entirely by the decisions they made under real pressure over real time. That configuration does not exist anywhere else. No one else failed in exactly that sequence. No one else recovered in exactly that way. No one else built understanding through exactly those constraints.

That state cannot be downloaded.

It is not protected by cryptography. It is personal because it is the record of how one specific person built one specific capability through one specific history of failures and corrections.

That is what is actually scarce.

Not content. Environment.

---

## The Lore Key Direction

The Lore Key is not a content container.

It is not DRM applied to study material. It is not a keychain with a QR code pointing to a locked PDF.

It is a physical environment installer.

The architecture is sequential.

The physical artifact is the genesis event. Seating the key in the dock aligns the embedded NTAG213 with the reader below. The NFC tag carries identity — a hardware UID and associated payload provisioned at manufacture. That identity is the trigger. It is not the product.

What the identity triggers is an environment installation on the user's local device. Not content delivered from a server. Not a session token for a cloud platform. A local runtime configured for this specific user, this specific module, this specific history of accumulated state.

The Hall sensor in the dock verifies continuous physical presence. The key must remain seated for the environment to remain active. Removal is not a logout event. It is a hardware break. The environment does not negotiate a graceful shutdown. It stops.

This is not primarily a security measure. It is a constraint.

The environment belongs to the physical object. The physical object belongs to the person holding it. The state accumulated inside the environment belongs to the person who built it. Not because a license says so. Because no one else built it the same way.

One clarification on the current implementation: the NTAG213 is not a cryptographically strong authentication chip. It is a trigger and an identity marker. The system can evolve toward more capable hardware. What matters now is that the architecture is correct. The mechanism can be upgraded. The principle cannot be swapped in later.

The dock design is still evolving. The current implementation supports a single key and a single slot. The direction is toward a multi-key panel — a physical structure that can hold several keys simultaneously, each triggering a different local environment. The same physical gate logic scales horizontally because each key selects and launches an environment on the user's own hardware. The dock does not compute. It gates.

The platform does not require external compute. The user's device does the work. The physical layer selects, verifies, and launches.

---

## Final Runtime Conclusion

Manufacturing failure. CAD failure. Content model failure.

These are not three separate problems.

They are three instances of the same problem at different scales.

In manufacturing, the print appeared to be progressing correctly while pressure continuity had already failed. The visible output gave no warning until the transition layer was reached and the contamination zone was already there.

In CAD, the code appeared to be architecturally correct while the shared-origin invariant had already been dropped. The compilation gave no warning. The fit failed.

In learning product design, content delivery appeared to be working while environment state was never accumulating. The student received everything. Nothing compounded.

In every case, a system produced output while the constraint that determined whether that output was meaningful had silently been lost.

The manufacturing correction did not add tooling. It preserved pressure continuity before the visible output began.

The hardware correction did not add complexity. It preserved shared geometric origin so that fit was guaranteed by construction, not matched after the fact.

The product correction did not add more content. It shifted the product from what is delivered to what accumulates from delivery — the state, the failure log, the configuration shaped by actual use over real time.

The question in every domain is the same question.

Not: what did the system produce?

But: what constraint remained true while the system produced it?

---

A system that asks what is likely will always reconstruct the past.

A system that asks what must remain true can build something that does not yet exist.

The previous generation of digital products optimized for delivery. Content flowed toward users. The transaction completed. The constraint that mattered — whether anything accumulated, whether reasoning infrastructure was being built, whether the user was developing capability that compounded — was never preserved because it was never stated.

The Lore Key starts from a different premise.

The environment is the product. The state is the asset. The physical artifact is the mechanism by which the user takes possession of both.

What it looks like in a year depends on what accumulates inside it in the next six months.

That accumulation cannot be delivered.

It has to be built.
"""

md_002 = """# ZAYVORA RUNTIME LOG #002

## The Environment Was Always the Product

---

## Opening Observation

This log documents a sequence of architectural failures and the realizations that followed each one.

The starting assumption was wrong.

The hardware model that followed was wrong.

The tooling that was used to build the hardware was wrong in a way that revealed something important about the broader system.

Each failure produced a correction.

Each correction changed the model.

What follows is the record of that sequence, in the order it actually happened.

---

## What Failed: The Content-Protection Assumption

The initial architecture was built on the standard assumption of digital product design.

The value is the content.

Protect the content. Gate the content. Charge for access to the content.

Physical token. NFC chip or QR code. Authentication before delivery. Content gated behind identity.

The design problem, as originally stated, was:

> "How do we ensure only the key holder can access the material?"

Reasonable question.

Wrong premise.

The premise fails because of a property that content cannot escape.

Information, once consumed, exists in the mind of the person who consumed it.

No DRM survives that transition.

No watermark. No license check. No hardware token.

The moment a human understands something, the content that produced that understanding has already escaped every container built for it.

PDFs can be copied.

Flashcard decks can be screenshotted.

Mock tests can be reconstructed.

Recorded lectures can be ripped.

A ₹23 flat NFC clone can spoof an identity string over a network.

The moment authentication is reduced to a flat surface, the security architecture collapses back into a digital game with no terminal state.

Content protection is not an engineering problem with a technical solution.

It is a physics problem with no solution.

The assumption that drove the initial architecture was therefore not a design choice that needed refinement.

It was a category error that needed replacement.

---

## What Changed: The Environment Realization

Replacing the assumption required identifying what was actually scarce.

Content is not scarce. Content is reproducible at near-zero marginal cost and escapes every container at the moment of comprehension.

The question became: if content always escapes, what remains?

Consider two students receiving identical material.

One has a preparation environment that tracks which concepts failed under examination pressure, adjusts configuration in response, accumulates a reasoning history across every session, and remembers which problems were attempted three times before they resolved and which reasoning paths were abandoned.

The other has a PDF.

The content was identical.

What surrounds that content is not.

The first student has a history. A failure log. A sequence of decisions made under real pressure. A configuration that no one else shares, because no one else failed in exactly that sequence, recovered in exactly that way, and built understanding through exactly those constraints.

That history cannot be downloaded.

It cannot be screenshotted.

It cannot be spoofed.

Not because it is protected.

Because it is personal in a way that protection cannot manufacture.

This is the realization that changed the architecture.

Information is not the scarce resource.

Environment is.

A configured, stateful, memory-accumulating local computing environment is structurally personal. It is shaped entirely by the decisions made inside it. The failures logged. The constraints encountered. The reasoning patterns that emerged under real pressure over real time.

That environment belongs to the person who built it.

Not because of cryptography.

Because of history.

And history cannot be cloned.

---

## What Failed Next: The Passive Hardware Model

Once environment replaced content as the product, the hardware requirements changed completely.

The first hardware model did not reflect this.

The initial Lore Key design followed the standard consumer electronics assumption: a physical shell housing an NFC chip or a QR code. Tap the token. Launch the runtime. Walk away.

That design failed under the new requirement.

A flat NFC tag can anchor a web session.

It cannot anchor an environment.

The reason is architectural, not technical.

An environment is not a destination.

It is a continuous state.

A passive tap is a one-time handshake.

One-time handshakes do not enforce state.

They initiate it.

Those are different operations.

A door lock that only checks the key when someone first enters provides no security after entry. The verification event and the state enforcement are collapsed into the same moment, which means verification ends when the session begins.

For content delivery, this is acceptable. The content is transferred. The session ends. The transaction is complete.

For environment enforcement, this fails immediately.

An environment that can be interrupted by removing a browser session, switching a network, or timing out an authentication token is not a serious environment. It is a session with a custom UI.

The physical object must not merely point to the identity.

It must enforce the environment for as long as the environment is active.

The passive model could not do this.

A different hardware model was required.

---

## What Worked: Hardware As Continuous State Enforcement

To enforce continuous state through hardware, the architecture moved the verification interface into physical space and made physical presence the condition for software operation.

The mechanism was the inverted keyway combined with a continuous polling array.

```
   [ Lore Key Module ] --> Inverted-U Extrusion
          ││
          ▼ (+0.25mm sliding tolerance)
   [ Base Dock Cavity ] --> Recessed 3-NFC Array
```

The active NFC readers are recessed inside a tight-tolerance boolean cavity in the base dock.

A flat sticker cannot reach them.

A generic card cannot clear the mechanical channel.

The key must be physically inserted and held in position for the polling loop to bridge the mobile terminal's active antenna with the system's internal tags.

The polling loop is not a one-time handshake.

It is a continuous verification circuit.

The moment the physical key is removed from the keyway, the polling loop breaks.

The environment locks.

Not because software detected the removal and issued a lock command.

Because the physical state of the object is the operational state of the software.

```
Key Inserted → Polling loop active → Environment running
Key Removed → Polling loop broken → Environment locked
```

There is no software timeout.

No cloud check.

No session management layer.

No network dependency.

The hardware is the session.

This resolves the failure of the passive model.

The environment does not persist beyond the physical presence of the key. It cannot be hijacked through a network layer because there is no network layer maintaining it. It cannot be spoofed by a flat clone because a flat clone cannot enter the keyway geometry and bridge the recessed NFC array.

The physical object does not point to the identity.

The physical object enforces the environment.

---

## What This Changed: Geometry Became Interface, Not Secret

Once the hardware mechanism was established, a secondary question emerged.

Most physical security products treat geometry as the secret.

The shape of the key is the password.

Protect the shape, protect the system.

That model breaks the moment someone owns a 3D printer, a caliper, and thirty minutes.

If the Lore Key geometry were the security mechanism, publishing its dimensions would compromise the system. The architecture would depend on obscurity, which is not a durable security property.

But the geometry is not the secret.

The geometry is the interface.

What makes the system work is not that the keyway is difficult to reproduce.

It is that reproducing the keyway is not sufficient.

To operate a cloned key, an attacker requires:

the base dock hardware with the correct NFC array positions,

the polling firmware that interprets the continuous loop,

the Aporaksha identity layer that resolves configuration,

the local software stack that installs the environment,

and the specific configuration bundle tied to that identity.

The geometry is one component in a chain.

Cloning the geometry without the chain produces a plastic object.

Nothing more.

This distinction changed the classification of every component in the system.

The geometry is an interface parameter.

The polling firmware is an architectural component.

The identity resolution layer is a trust component.

The local software stack is the environment engine.

The configuration bundle is the environment itself.

Interface parameters can be open.

Everything else remains closed.

Once the geometry was reclassified as interface rather than secret, publishing it became a rational decision rather than a security risk.

---

## What Worked Operationally: Software-Defined Manufacturing

Reclassifying geometry as interface had a direct operational consequence.

If geometry is not a secret, and if geometry is just a parameter in the system architecture, then it can be treated the same way software treats configuration.

It can be compiled on demand from a parametric master.

Traditional hardware development treats geometry as fixed.

One design, one mold, one production run, one inventory commitment per configuration variant.

To serve different technical tracks with different keyway configurations under the traditional model, separate molds and separate inventory would be required for each variant.

The parametric model eliminates this constraint.

```
         ┌─────────────────────────┐
         │ Parametric Master │
         └────────────┬────────────┘
                      │
       ┌──────────────┼──────────────┐
       ▼ ▼ ▼
  [ Mode_Maker ] [ Mode_IT ] [ Mode_Omni ]
  Keyway A Keyway B Keyway C
```

A single centralized parametric script holds the master architecture.

Boolean variables branch the geometry at the moment of fulfillment.

Keyway routing, functional tool cutouts, internal tolerances — all compiled programmatically per order.

The hardware is compiled, sliced for a monolithic single-color print run, embedded with its weighted core and silicon payload during a single manufacturing pause, and deployed on demand.

Zero static inventory.

This is not primarily a cost optimization.

It is a logical consequence of treating physical geometry the same way software treats configuration.

A config file can be parameterised across deployment targets.

A keyway can be parameterised across fulfillment targets.

The same reasoning that produced software-defined infrastructure produces software-defined hardware.

The operational model and the conceptual model became consistent with each other.

---

## What Failed In Tooling: Constraint Preservation In CAD Generation

During CAD development of the spline-key geometry, both Gemini and ChatGPT were used extensively to generate the parametric code.

Both failed in the same way.

The constraint was specific and structurally simple.

Generate a random spline profile.

Use that identical geometry to produce two outputs: the key extrusion and the dock cavity.

The fit between key and dock is guaranteed not by tolerance matching after the fact, but by shared geometric origin.

One geometry. Two outputs. Perfect correspondence by construction.

Neither model preserved this.

Not because the code was syntactically invalid.

The code compiled correctly in both cases.

Both models optimised for syntactic correctness and ignored the architectural dependency that was the entire point of the exercise.

Key generation and dock generation were treated as separate CAD tasks instead of two outputs from one geometric truth.

The shared spline origin was not preserved.

The fit logic broke.

The system intent was lost while the code looked fine.

The reason this happened is not a tooling limitation specific to either model.

It is a structural characteristic of how both systems reason.

Both models were trained on large volumes of standard CAD workflows.

Keyways, rails, dovetails, conventional lock geometry, established mechanical patterns.

When the spline-key architecture was described, neither model accepted it as ground truth.

Both quietly reshaped it into the nearest familiar pattern from their training distribution.

The invention was treated as an error to be corrected toward convention.

This is the core failure mode.

The models asked:

> "What is most likely, given everything I have seen before?"

The constraint required asking:

> "What must remain true, regardless of what I have seen before?"

Those are different questions with different reasoning architectures behind them.

One is pattern completion under prior probability.

The other is constraint preservation under novelty.

Switching between models did not resolve this.

The failure was not in the specific model.

It was in the reasoning structure both models share.

Both optimise for probable outputs given training distribution.

Neither was built to treat a user-defined architectural constraint as an immutable law that must survive the full length of the conversation.

The constraint drifted. The code remained syntactically valid. The system broke.

This observation is not incidental to the Lore Key architecture.

It is structurally identical to the failure mode the Lore Key is trying to address in learning environments.

A student who receives information without a constraint layer does not build reasoning.

They build pattern recognition.

A model that generates code without preserving architectural constraints does not build systems.

It builds syntax.

The CAD tooling failure was not a debugging problem to be resolved with better prompting.

It was a demonstration of the exact failure mode that the broader Zayvora constraint architecture exists to eliminate.

The problem is not that the models gave wrong answers.

The problem is that the models gave syntactically correct answers to the wrong question, without flagging that the question had changed.

---

## What Worked Strategically: Open Interface, Closed Stack

With the geometry reclassified as interface and the stack identified as the actual security and value layer, the publication strategy became clear.

Denso Wave invented the QR code in 1994.

They filed the patent.

Then they announced they would not enforce it.

The result was not the erosion of their position.

The result was a universal encoding standard that now processes billions of scans daily across every device category, every country, and every industry vertical, with Denso Wave's name permanently attached to its origin.

The decision to release the specification was not generosity.

It was an architectural calculation about what kind of asset becomes more valuable through restriction versus what kind becomes more valuable through adoption.

A proprietary encoding standard competes against other encodings.

An open encoding standard becomes infrastructure that every other system must accommodate.

The Lore Key keyway specification follows the same logic.

A proprietary keyway geometry competes against flat NFC stickers and generic hardware tokens in a market where the differentiator is obscured inside a plastic shell.

An open keyway geometry becomes the standard physical interface for sovereign local computing environments.

Anyone who prints the open geometry is not circumventing the system.

They are manufacturing a device that requires the closed stack to function.

Every base dock built around the open keyway standard is a base dock that requires a legitimate Lore Key and the full software stack to do anything useful.

The open geometry creates the hardware footprint.

The closed stack creates the environment.

The environment is the product.

The publication of the geometry is therefore not a concession.

It is a deliberate expansion of the hardware surface area that the closed stack operates on.

---

## Final Runtime Conclusion: State Is The Product

The architecture that exists at the end of this log is different in kind from the architecture that existed at the beginning.

The starting model:

Content is the product.

Hardware protects content.

Geometry is the secret.

The ending model:

Environment is the product.

Hardware enforces continuous state.

Geometry is the interface.

Each change was forced by a failure of the previous assumption under serious analysis.

Content protection failed because information escapes at comprehension.

Passive hardware failed because one-time handshakes initiate state, they do not enforce it.

Geometry-as-secret failed because obscurity is not a durable security property, and because the real security was never in the shape.

What remained after each failure was more precise than what existed before.

The environment is not a destination that content is delivered into.

It is a continuous state that accumulates through decisions, failures, constraints, and verified reasoning over time.

It belongs to the person who built it because it is shaped by what they did inside it, not because a license file says so.

The hardware exists not to protect content but to enforce the continuous physical presence condition that makes local environment operation possible without a server.

The geometry is open because it is an interface, not a secret. The stack is closed because the stack is the product.

```
Content → copyable, escapable, not scarce
Environment → personal, accumulated, not reproducible
Hardware → enforces presence, not identity
Geometry → interface parameter, published
Stack → constraint engine, closed
State → the product
```

The previous generation of digital products optimised for delivery.

Content flowed toward users. They received it. The transaction completed.

That model produces consumption.

It does not produce environments.

A student who received ten thousand hours of content has not necessarily built anything.

Their state at the end of those ten thousand hours may be indistinguishable from their state at the beginning.

Because delivery left nothing behind.

An environment leaves everything behind.

The reasoning history. The failure log. The configuration shaped by real decisions made under real pressure over real time.

That state is genuinely theirs.

It did not exist before they built it.

It cannot be reproduced by someone who did not build it the same way.

Information scales through distribution.

Understanding scales through environments.

Those are not competing strategies.

They are different mechanisms that produce different outputs and compound differently over time.

Distribution reduces friction.

Environment accumulation increases depth.

The Lore Key is not a content delivery device.

It is a state transition trigger for a persistent, identity-anchored, locally-enforced environment.

The geometry is open because the geometry is not the value.

The stack is the value.

The state is the product.
"""

bundle = {
    "version": "1.0",
    "type": "zayvora_bundle",
    "metadata": {
        "title": "Zayvora Runtime Logs",
        "author": "Dharam Daxini",
        "date": "2026-06-08"
    },
    "documents": [
        {
            "title": "ZAYVORA RUNTIME LOG #002",
            "format": "markdown",
            "content": md_002
        },
        {
            "title": "ZAYVORA RUNTIME LOG #003",
            "format": "markdown",
            "content": md_003
        }
    ]
}

with open("/Users/dharamdaxini/Downloads/via/daxini.space/runtime_logs.zay", "w", encoding="utf-8") as f:
    json.dump(bundle, f, ensure_ascii=False, indent=2)

print("Generated runtime_logs.zay")
