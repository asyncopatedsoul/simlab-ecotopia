// Window Watch — narrative/en.ink
// One short scenario (~10 min) that works from any window.
// No outdoor required, no kit required, no GPS.

=== brief ===

= start
Right now, somewhere outside your window, birds are doing their thing.
Let's meet three of the ones that live near us.
-> END

= start_5_6
Look out your window!
Birds are out there.
Let's find some.
-> END

=== sim ===

= done
Nice — you found all of them!
-> END

=== field ===

= instruction
Pick a window. Any window.
Spend two minutes just looking out.
You don't have to see a bird. Noticing things counts.
-> END

= indoor_fallback
That works too — watch from right here.
Two minutes. See what moves.
-> END

=== encode ===

= success
You saw something! That goes in your collection.
-> END

= encouragement
Nothing today — that happens.
The birds were probably there. Sometimes they hide.
See you tomorrow.
-> END

=== reflection ===

= start
Which one was your favorite from the sim?
-> END

=== permissions ===

= camera
If you want to photograph what you see, we'll need the camera.
You can always skip this and just tell us what you found.
-> END

=== parent_hints ===

= during_sim
Ask which bird card they want to look at first.
Point out details: the red chest on the robin, the tiny size of the hummingbird.
-> END

= during_field
Two minutes is a short time — it usually feels shorter once you start.
Let them lead the looking. Your job is just to be next to them.
-> END
