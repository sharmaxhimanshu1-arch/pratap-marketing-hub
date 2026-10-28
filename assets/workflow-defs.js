/* Workflow definitions for the Workflows page.
   Each workflow mirrors a Claude skill. The page never runs Claude: every step either explains what Claude does on its own,
   or builds the exact command / prompt to copy into Claude, Perplexity or Gemini, with a box to paste the result back.
   To add a workflow: add an object to WORKFLOWS below (same shape), no other file needs to change. */
(function () {
  "use strict";

  var NOTION_BANK = "https://app.notion.com/p/f692923174974b1a8c80d57b642f21f3";
  var SHEET = "https://docs.google.com/spreadsheets/d/1XAbTVerLDP4eOpA2PBIqyYyEbn6jU9-1C2subMXmS7c";
  var TOOLS = {
    claude: { name: "Claude", url: "https://claude.ai/new", tone: "claude" },
    perplexity: { name: "Perplexity", url: "https://www.perplexity.ai/", tone: "pplx" },
    gemini: { name: "Gemini", url: "https://gemini.google.com/app", tone: "gem" },
    you: { name: "You", tone: "you" },
    canva: { name: "Canva", url: "https://www.canva.com/", tone: "canva" },
    notion: { name: "Notion", url: NOTION_BANK, tone: "notion" },
    sheet: { name: "Content Calendar", url: SHEET, tone: "sheet" }
  };

  /* Company list: names the skills use, the calendar tab, and posting days (from the ideation skill's calendar-sync notes). */
  var COMPANIES = [
    { id: "pratap-group", name: "Pratap Group", cmd: "Pratap Group", tab: "Pratap Technocrats", days: [1, 3, 5] },
    { id: "telecrats", name: "Telecrats", cmd: "Telecrats", tab: "Telecrats", days: [2, 5] },
    { id: "beckhaul", name: "Beckhaul", cmd: "Beckhaul", tab: "Beckhaul", days: [1, 3] },
    { id: "corsis", name: "Corsis", cmd: "Corsis", tab: "Corsis", days: [1, 5] },
    { id: "ductel", name: "Ductel", cmd: "Ductel", tab: "Ductel", days: [2, 4] },
    { id: "pratap-diesels", name: "Pratap Diesels", cmd: "Pratap Diesels", tab: "Pratap Diesels", days: [3] },
    { id: "pals", name: "PALS", cmd: "PALS", tab: "PALS", days: [1, 4] },
    { id: "voltters", name: "Voltters", cmd: "Voltters", tab: "Voltters", days: [2, 4] },
    { id: "pratap-automobiles", name: "Pratap Automobiles", cmd: "Pratap Automobiles", tab: "Automobiles", days: [5] }
  ];

  function today() { return new Date().toISOString().slice(0, 10); }
  function v(ctx, k, fallback) { var x = (ctx.inputs[k] || "").trim(); return x || fallback || ""; }

  /* ---------- Workflow 1: LinkedIn Post Ideation ---------- */
  var ideation = {
    id: "ideation",
    name: "Post Ideas",
    skill: "/linkedin-post-ideation",
    blurb: "Turns a company name into the best 5 LinkedIn post ideas out of 100, with the evidence to choose in minutes.",
    steps: [
      {
        id: "start", title: "Start the run", who: ["you", "claude"],
        what: "Tell Claude which company. A name is enough; a goal, time window or formats to skip are optional.",
        fields: [
          { k: "goal", label: "Goal (optional)", type: "select", options: ["", "Leads", "Hiring", "Credibility", "Event buzz"] },
          { k: "window", label: "Time window (optional)", type: "text", ph: "e.g. next 3 months" },
          { k: "avoid", label: "Formats to avoid (optional)", type: "text", ph: "e.g. live, newsletter" }
        ],
        command: function (c) {
          var s = "/linkedin-post-ideation " + c.co.cmd;
          var extra = [];
          if (v(c, "goal")) extra.push("Goal: " + v(c, "goal").toLowerCase());
          if (v(c, "window")) extra.push("Time window: " + v(c, "window"));
          if (v(c, "avoid")) extra.push("Avoid formats: " + v(c, "avoid"));
          return s + (extra.length ? ". " + extra.join(". ") + "." : "");
        },
        open: "claude",
        note: "Paste this into Claude. From here Claude works on its own until it needs the Perplexity research or has the top 5."
      },
      {
        id: "gather", title: "Gather what exists", who: ["claude"], auto: true,
        what: "Claude reads before it researches, so nothing is repeated. This is silent and read-only.",
        list: [
          "Google Drive: saved Perplexity research on the company (Pratap Group folder)",
          "Content Calendar tab and Notion: posts already planned or published go on a do-not-repeat list",
          "Idea Bank in Notion: Approved, In calendar, Published and Rejected ideas are excluded; Banked ones come back as carry-overs",
          "The company's website and LinkedIn page: what it offers and how it posts now"
        ]
      },
      {
        id: "research", title: "Deep research", who: ["you", "perplexity"], optional: true,
        what: "If Drive has no recent research, Claude hands you a Perplexity prompt and keeps going meanwhile. Run it in Perplexity Pro (Research mode) and save the result to Drive.",
        fields: [
          { k: "desc", label: "One-line description of the company", type: "text", ph: "What it sells and to whom", company: true }
        ],
        command: function (c) {
          var desc = c.desc || "[what it sells and to whom]";
          return "You are researching " + c.co.name + ", part of Pratap Group, India, to find LinkedIn content opportunities. Use current sources and give a URL and date for every factual claim. If you can't verify something, say so instead of guessing.\n\n" +
            "About the company: " + desc + ". Audiences: telecom operators and ISPs, government and public sector, and SMBs across India.\n\n" +
            "Research and report, in these sections:\n\n" +
            "1. What the company actually does: products, services, differentiators, certifications, public projects and customers, anything citable about scale or track record.\n" +
            "2. Buyer pain points: the problems, questions and objections that operators, government buyers and SMBs raise in this space. Include sources such as industry forums, tenders, trade press and customer discussions.\n" +
            "3. India market and policy drivers over the next 6 months that affect this company's space (programmes, regulations, rollouts, standards), with dates.\n" +
            "4. Events and calendar hooks in the next 6 months: trade shows, conferences, awareness days, policy deadlines.\n" +
            "5. Competitor and peer LinkedIn activity: 5 to 8 relevant companies, what they post, which formats they use, which posts clearly drew strong interaction, and which topics nobody covers well.\n" +
            "6. Myths, misconceptions and surprising facts in this niche that could make strong educational posts, each with a source.\n" +
            "7. Numbers and benchmarks worth citing, each with its source and date.\n\n" +
            "Format: a section per item, short bullet points, a source list at the end. Mark anything older than 18 months.";
        },
        open: "perplexity",
        saveAs: function (c) { return c.co.name + " - LinkedIn ideation research - " + today(); },
        checks: [{ k: "saved", label: "Saved the Perplexity result to the Pratap Group Drive folder" }],
        note: "Skip this step when Drive already holds recent research for the company. Claude will tell you."
      },
      {
        id: "generate", title: "Generate 100 ideas", who: ["claude"], auto: true,
        what: "Claude writes 100 distinct ideas across every LinkedIn format and content pillar, grounded in the research findings. Two ideas that are the same post in different formats count as one.",
        chips: ["Text", "Image", "Carousel / document", "Video", "Poll", "Article", "Newsletter", "Event", "Live"],
        chipsLabel: "Formats covered",
        chips2: ["Educational", "Proof / case study", "Point of view", "Myth-busting", "Behind the scenes", "People and culture", "News reaction", "Product / solution", "Events"],
        chips2Label: "Pillars covered"
      },
      {
        id: "screen", title: "Screen, score, trim", who: ["claude"], auto: true,
        what: "A hard funnel from 100 down to 5. Click a stage to see what it checks.",
        widget: "funnel"
      },
      {
        id: "present", title: "Review the top 5", who: ["claude", "you"],
        what: "Claude shows a ranked table. Paste it here to read it as cards, pick favourites, and ask for Gemini briefs.",
        widget: "ideacards",
        note: "Scores are estimates. LinkedIn analytics are not available to Claude, so engagement comes from observed patterns and cited benchmarks."
      },
      {
        id: "bank", title: "Bank the five", who: ["claude", "notion"], auto: true,
        what: "Claude saves all five to the Notion LinkedIn Idea Bank with status Banked, without asking. Banked ideas come back in later runs and have to beat fresh ideas on merit.",
        links: [{ label: "Open the Idea Bank", url: NOTION_BANK }]
      },
      {
        id: "approve", title: "Approve in Notion", who: ["you", "notion"],
        what: "Only you decide. Set an idea's Status to Approved in the Idea Bank. Claude never approves, rejects or publishes on its own.",
        widget: "picks",
        links: [{ label: "Open the Idea Bank", url: NOTION_BANK }],
        checks: [{ k: "approved", label: "Set the chosen idea to Approved in Notion" }]
      },
      {
        id: "sync", title: "Sync to the Content Calendar", who: ["claude", "sheet"],
        what: "Approved ideas are written to the company's tab on the next free posting day. This runs as a weekday scheduled task, or on demand. A dry run only previews.",
        widget: "postingdays",
        command: function () { return "/linkedin-post-ideation sync approved ideas"; },
        command2: { label: "Dry run (preview only)", text: function () { return "/linkedin-post-ideation dry run the approved ideas sync"; } },
        open: "claude",
        links: [{ label: "Open the Content Calendar", url: SHEET }],
        note: "Claude confirms the sheet write before it marks the Notion row In calendar."
      }
    ]
  };

  /* ---------- Workflow 2: Pratap Post Creator ---------- */
  var creator = {
    id: "creator",
    name: "Post Creator",
    skill: "/pratap-post-creator",
    blurb: "Takes the next unpublished topic from the 2026 Content Calendar to a finished LinkedIn post, with your approval before any visual work.",
    steps: [
      {
        id: "topic", title: "Find the topic", who: ["you", "claude", "sheet"],
        what: "Claude reads the company's tab in the 2026 Content Calendar and takes the one topic not yet marked Published. It never edits the sheet.",
        command: function (c) { return "/pratap-post-creator Create the next post for " + c.co.cmd; },
        open: "claude",
        fields: [
          { k: "topic", label: "Topic Claude found", type: "text", ph: "Paste the Content Topic here" },
          { k: "pillar", label: "Pillar", type: "text", ph: "e.g. Educational" },
          { k: "format", label: "Format", type: "select", options: ["", "Carousel", "Single static post (infographic)", "Video", "Other"] },
          { k: "date", label: "Scheduled date", type: "text", ph: "YYYY-MM-DD" }
        ],
        stop: "If every row is Published, Claude says: \"There is no idea to execute for " + "{company}" + ".\" and stops. Run Post Ideas to fill the calendar.",
        links: [{ label: "Open the Content Calendar", url: SHEET }],
        note: "Fill the fields once Claude reports the topic. They feed the prompts further down."
      },
      {
        id: "brand", title: "Check the brand kit", who: ["claude"], auto: true,
        what: "Claude reads the company's brand kit from Drive and keeps its colours, fonts, logo rules, tone and layout for the build.",
        widget: "brandstatus",
        stop: "No brand kit? Claude pauses with \"Creation is paused until one exists. Want to build the brand kit first?\" Build it, then resume at the next step."
      },
      {
        id: "research", title: "Research", who: ["you", "perplexity"],
        what: "Claude decides whether more research is needed. When it is, it writes a Perplexity prompt. This one is built from your topic, ready to paste. Bring the answer back to Claude to be sanity-checked before drafting.",
        fields: [
          { k: "desc", label: "One-line description of the company", type: "text", ph: "What it sells and to whom", company: true }
        ],
        command: function (c) {
          var topic = v(c, "topic", "[topic]");
          return "You are researching a LinkedIn post for " + c.co.name + ", part of Pratap Group, India.\n\n" +
            "Topic: " + topic + (v(c, "pillar") ? "\nPillar: " + v(c, "pillar") : "") + (v(c, "format") ? "\nPlanned format: " + v(c, "format") : "") + "\n" +
            "Company: " + (c.desc || "[what it sells and to whom]") + ". Audience: telecom operators and ISPs, government and public sector, and SMBs across India. Focus on the Indian market.\n\n" +
            "Return:\n" +
            "1. Key facts about this topic, short bullets.\n" +
            "2. Figures with a source URL and a date for each. Mark anything older than 18 months.\n" +
            "3. Three or four angles worth taking for this audience.\n" +
            "4. Common misconceptions and how to correct them.\n" +
            "5. Anything that is estimated or disputed, flagged clearly.\n\n" +
            "Cite sources for every factual claim. If you can't verify something, say so instead of guessing.";
        },
        open: "perplexity",
        paste: { k: "research", label: "Paste Perplexity's answer", ph: "Paste the research here to build the hand-back message" },
        handback: function (c) {
          var r = v(c, "research");
          return "Here is the Perplexity research for \"" + v(c, "topic", "the topic") + "\" (" + c.co.name + "). Sanity-check it: note conflicting numbers, anything undated, anything that looks too good. Raise those before drafting.\n\n" + (r || "[paste the research above first]");
        },
        note: "Not needed for purely conceptual posts where existing research is enough. Claude will say so."
      },
      {
        id: "draft", title: "Draft the post", who: ["claude", "you"],
        what: "Claude drafts in the calendar's format. Nothing visual starts until you say the draft is final.",
        widget: "draftformat",
        command: function (c) { return "The research is checked. Draft the post in " + (v(c, "format", "the calendar's") + " format") + " for " + c.co.name + (v(c, "topic") ? ": " + v(c, "topic") : "") + ". No caption or hashtags yet."; },
        open: "claude",
        checks: [{ k: "approved", label: "I approved the draft as final" }],
        gate: true,
        note: "Ask for changes in Claude until the draft is right. Approval here is what keeps wasted visual work down."
      },
      {
        id: "assets", title: "Assets with Gemini", who: ["claude", "you", "gemini"],
        what: "Claude gives you one master prompt that fixes the visual style, then one follow-up prompt per asset. Run them in the same Gemini chat, then send the assets back for review.",
        needs: "draft",
        widget: "geminiflow",
        command: function (c) { return "The draft is final. Give me the Gemini master prompt and one follow-up prompt per asset for " + c.co.name + (v(c, "topic") ? " (" + v(c, "topic") + ")" : "") + ". Use the " + c.co.name + " brand kit."; },
        open: "claude",
        command2: { label: "After generating: send assets back", text: function (c) { return "Here are the Gemini assets for " + c.co.name + (v(c, "topic") ? " (" + v(c, "topic") + ")" : "") + ". Review them against the draft and the brand kit and tell me which to regenerate and why before building."; } },
        checks: [
          { k: "master", label: "Master prompt run in Gemini" },
          { k: "follow", label: "Follow-up prompts run in the same chat" },
          { k: "sent", label: "Assets sent back to Claude and reviewed" }
        ]
      },
      {
        id: "build", title: "Build the post", who: ["claude", "canva"],
        what: "Claude builds the post in the best tool for this one, using the approved copy exactly, your assets and the brand rules.",
        fields: [
          { k: "tool", label: "Build with", type: "select", options: ["Whichever fits best", "Canva", "Another tool"] }
        ],
        command: function (c) {
          var t = v(c, "tool", "Whichever fits best");
          var fmt = v(c, "format");
          var out = /carousel/i.test(fmt) ? "PDF for the LinkedIn carousel" : /video/i.test(fmt) ? "video" : fmt ? "PNG" : "the format the post needs";
          return "The assets are approved. Build the post for " + c.co.name + " now" + (t === "Canva" ? " in Canva" : t === "Another tool" ? " in the best tool for it, not Canva" : " in whichever tool fits best") + ". Use the approved draft copy exactly and follow the brand guidelines. Deliver as " + out + ".";
        },
        open: "claude"
      },
      {
        id: "caption", title: "Caption and hashtags", who: ["claude"],
        what: "Written last, once the post is finished, with a couple of hook options for the first line.",
        command: function () { return "The post is finished. Write the LinkedIn caption and hashtags, and give me two or three hook options for the first line."; },
        open: "claude"
      },
      {
        id: "publish", title: "Publish and mark", who: ["you", "sheet"],
        what: "You publish on LinkedIn and mark the row Published in the sheet yourself. Claude does not touch the sheet.",
        checks: [
          { k: "posted", label: "Published on the LinkedIn page" },
          { k: "marked", label: "Marked Published in the 2026 Content Calendar" }
        ],
        links: [{ label: "Open the Content Calendar", url: SHEET }]
      }
    ]
  };

  /* ---------- Pipeline: connects the two workflows ---------- */
  var pipeline = {
    id: "pipeline",
    name: "Pipeline",
    blurb: "Both workflows as one line, from a raw idea to a published post. It reads the progress you saved in each workflow and tells you the next move.",
    /* phases group steps of the two workflows, in order */
    phases: [
      { id: "ideate", name: "Ideate", wf: "ideation", steps: ["start", "gather", "research", "generate", "screen", "present"] },
      { id: "bank", name: "Bank and approve", wf: "ideation", steps: ["bank", "approve"] },
      { id: "calendar", name: "Calendar", wf: "ideation", steps: ["sync"] },
      { id: "create", name: "Create", wf: "creator", steps: ["topic", "brand", "research", "draft", "assets", "build", "caption"] },
      { id: "publish", name: "Publish", wf: "creator", steps: ["publish"] }
    ],
    handoffs: [
      { after: "bank", text: "Five ideas wait in the Idea Bank with status Banked." },
      { after: "calendar", text: "An approved idea is now a Pending row in the company's tab. The Post Creator picks the earliest one." }
    ]
  };

  window.WF = {
    TOOLS: TOOLS, COMPANIES: COMPANIES, WORKFLOWS: [ideation, creator], PIPELINE: pipeline,
    NOTION_BANK: NOTION_BANK, SHEET: SHEET
  };
})();
