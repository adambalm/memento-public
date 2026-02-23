# The Resume Problem

I asked two chatbots how to build a browser extension that tracks tabs over time. They gave me architecture diagrams. IndexedDB vs localStorage. Multi-pass reasoning pipelines. Service workers.

All very competent. All missing the point.

---

Here's what actually happened when I built the thing:

The system surfaced a pattern. A document opened 48 times across three weeks. Classic "ghost tab" — something you keep returning to but never finish.

The obvious move: tell the user to deal with it or let it go. That's what the architecture diagrams would suggest. Pattern detected → intervention delivered.

The document was a resume.

---

A resume opened 48 times isn't procrastination. It's a job search. The person is updating it before interviews, checking details compulsively, tweaking the wording because they're anxious about whether they're good enough.

"You keep opening this. Finish it or let it go" is not just unhelpful. It's insulting.

What would actually help: "Looks like you're job hunting. Want me to find five positions that match?"

---

The chatbots talked about memory. Recall. "What was that website with the walnut desk?" They talked about proactive agents. "Help you complete tasks you've forgotten."

None of them talked about inference. What does it *mean* that someone keeps opening a document? What do they *need*?

A resume means job search.
A recipe means they want to cook it.
A bank statement checked daily means financial anxiety.
An arxiv paper means research interest or avoidance — you have to look closer to tell which.

Same behavioral pattern. Completely different interventions. The memory is easy. The understanding is hard.

---

Google, OpenAI, Arc — they're building the memory. They're building the agents. They'll probably get there.

But when I look at the demos, I see recall. I see task execution. I don't see: "Based on your behavior, you seem to be [going through something]. Here's what might actually help."

Maybe they're working on it. Maybe it's coming. Maybe I've just missed the demo.

Or maybe the path from "user opened this 48 times" to "user is job hunting and anxious about it" is harder than it looks. Maybe semantic inference at scale is a different problem than retrieval at scale.

I don't know. I only built it for myself.

---

What I do know: the resume isn't a ghost tab. The chatbots couldn't see that from their architecture diagrams. I couldn't see it either, until I looked at my own data and felt the difference.

The pattern is not the insight. The insight is what the pattern means. The value is what you do about it.
