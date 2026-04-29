// Narrative for the scaffolded scenario. Every knot/stitch referenced from
// the manifest exists below. Replace the placeholder copy with your scenario's
// real lines. Run `npm run scenario:validate -- .` after edits to keep the
// manifest and narrative in sync.

=== brief ===
= start
Welcome. Let's see what's out there today.
+ [Begin] -> END

=== sim_complete ===
You found something.
-> END

=== field ===
= instruction
Spend a few minutes looking out a window. Anything counts.
-> END

= indoor_fallback
Can't go outside? That's okay — just look around the room.
-> END

=== encode ===
= success
You found something. Nice work.
-> END

= encouragement
Nothing showed up today. That's fine — let's try again tomorrow.
-> END

=== reflection ===
= start
What did you like best?
-> END

=== permissions ===
= camera
We use the camera so you can take a picture of what you see.
-> END

=== parent_hints ===
= during_sim
While they explore the scene, you can ask "which one looks most like
something you've seen before?"
-> END

= during_field
If they get distracted after a few minutes, that's fine. The point is
the noticing, not the finishing.
-> END
