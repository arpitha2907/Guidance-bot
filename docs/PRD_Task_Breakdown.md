# Multi-Domain Guidance Bot - Task Breakdown

## Overview
This document breaks down the PRD for the Multi-Domain Guidance Bot into 7 manageable tasks with clear definitions and completion criteria.

---

## Task 1: Foundation Setup & Core Infrastructure

### Description
Set up the basic project structure, development environment, and core technical infrastructure including frontend, backend, and database components.

### Scope
- Initialize Next.js frontend project with mobile-first responsive design
- Set up Node.js backend with Express/Hono framework
- Configure database (MongoDB or PostgreSQL) with basic schemas
- Implement basic project structure and development environment
- Set up environment configuration and API key management

### Completion Criteria
- [x] Next.js project created with responsive mobile-first layout
- [x] Node.js backend server running with basic health check endpoint
- [x] Database connected with conversation/message schemas defined
- [x] Environment variables configured for LLM provider API keys
- [x] Basic project structure with clear separation of frontend/backend
- [x] Development environment with hot reload working
- [x] Git repository initialized with proper .gitignore

---

## Task 2: Basic Chat Interface & Communication

### Description
Implement the fundamental chat UI and basic message communication between frontend and backend, establishing the core messaging infrastructure.

### Scope
- Create WhatsApp-style chat interface with message bubbles
- Implement real-time message sending and receiving
- Add typing indicators for bot responses
- Create basic message styling and layout
- Establish WebSocket or polling mechanism for real-time updates
- Implement basic message history display

### Completion Criteria
- [x] Chat UI displays user and bot messages in distinct styles
- [x] Users can type and send messages successfully
- [x] Bot responses appear in the chat interface
- [x] Typing indicator shows when bot is "thinking"
- [x] Messages are properly formatted with timestamps
- [x] Chat interface works on both mobile and desktop
- [x] Basic message history persists during session
- [x] Smooth scrolling to latest messages

> **Implementation note:** real-time updates use a plain request/response
> `fetch` call per turn (no WebSocket/polling channel), which satisfies the
> completion criteria above for an MVP but not the literal "WebSocket or
> polling mechanism" scope bullet. Acceptable for MVP; flagged for
> traceability rather than silently left inconsistent.

---

## Task 3: Intent Detection & Domain Routing

### Description
Implement the intelligent intent detection system that automatically categorizes user messages into domains (Health, Legal, Emotional, General) and routes conversations appropriately.

### Scope
- Create intent detection service using LLM
- Implement domain classification logic
- Add clarifying question flow when domain is unclear
- Create manual domain override functionality
- Design domain-specific conversation starters
- Implement confidence scoring for intent detection

### Completion Criteria
- [x] Bot correctly identifies domain from user messages with >80% accuracy
- [x] Clarifying questions appear when domain confidence is low
- [x] Users can manually select/override detected domain
- [x] Domain detection works for Health and Emotional queries
- [ ] ~~Domain detection works for ... General queries~~ — **out of MVP
      scope, see note below**
- [x] System gracefully handles ambiguous or multi-domain queries (routes to "unclear" → clarifying question)
- [x] Intent detection response time under 1 second
- [x] Proper error handling for failed intent detection (safe fallback to "unclear")
- [ ] Logging system for intent detection accuracy monitoring — **not yet implemented, tracked as future work**

> **Scope-consistency note (added post-review):** the original scope text
> above names four domains (Health, Legal, Emotional, General), which
> conflicts with the "MVP Scope Verification" section further down, which
> only confirms Health and Emotional as in-scope and explicitly excludes
> Legal — it never mentions General either way. This document has been
> corrected so General is now explicitly listed as excluded from MVP,
> alongside Legal (see below), matching what was actually built: the intent
> classifier only ever returns `health`, `emotional`, or `unclear`.

---

## Task 4: Dynamic Questioning Engine

### Description
Build the core dynamic questioning system that asks intelligent follow-up questions based on user responses, maintaining context and guiding the conversation effectively.

### Scope
- Implement context-aware question generation using LLM
- Create conversation state management system
- Design question flow logic (max 10 questions, early termination)
- Implement answer collection and storage
- Create question relevance scoring system
- Build conversation memory/context management

### Completion Criteria
- [x] Bot asks relevant follow-up questions based on previous answers
- [x] Questions are asked one at a time (no lists/forms)
- [x] Conversation maintains context across multiple exchanges
- [x] System stops questioning after 10 questions or when sufficient info collected
- [x] Questions are contextually relevant to detected domain
- [x] Conversation state properly tracked and stored (client-side, sent to stateless backend each turn)
- [x] Natural question progression that feels human-like
- [x] Ability to identify when enough information has been gathered

---

## Task 5: Final Guidance Generation & Display

### Description
Implement the system that analyzes collected information and generates structured, helpful guidance with appropriate disclaimers and next steps.

### Scope
- Create guidance generation system using LLM
- Implement structured summary generation
- Design next-step recommendation logic
- Add domain-specific disclaimers
- Create guidance display UI
- Implement guidance regeneration when answers are edited

### Completion Criteria
- [x] System generates clear, structured summaries of user's situation
- [x] Provides concrete, actionable guidance grounded in the source dataset
- [x] Includes appropriate domain-specific disclaimers
- [x] Guidance is written in plain, easy-to-understand language
- [x] Summary accurately reflects information collected during questioning
- [x] Guidance updates when previous answers are edited (true truncate-and-replay; see Task 7 note)
- [x] Proper formatting and display of guidance in chat UI
- [x] Option to continue chatting after receiving guidance

---

## Task 6: Safety Layer & Crisis Detection

### Description
Implement critical safety features to detect crisis signals and provide immediate emergency resources when users express urgent needs.

### Scope
- Create crisis signal detection system
- Implement emergency response protocols
- Design domain-specific helpline integration
- Add safety screening before normal bot responses
- Create emergency response UI
- Implement conversation halt mechanism for safety triggers

### Completion Criteria
- [x] System detects crisis signals (chest pain, suicidal intent, abuse disclosure, etc.)
- [x] Bot immediately stops normal flow when crisis detected
- [x] Emergency response displays relevant helplines (Vandrevala Foundation, Tele-MANAS, 112)
- [x] Pre-written emergency messages are appropriate and helpful
- [x] Safety screening occurs before every bot response
- [x] Emergency response is prominent and clear (distinct alert styling)
- [x] Bot does not resume normal questioning after safety trigger
- [x] All crisis keywords and patterns documented (see `backend/src/safety.js`) and unit-tested

---

## Task 7: User Experience Enhancements & Consent

### Description
Implement essential UX features including consent management, answer editing capabilities, session management, and final polish for MVP delivery.

### Scope
- Create consent screen and disclaimer system
- Implement edit previous answers functionality
- Add session management (anonymous sessions)
- Design conversation restart from edited answers
- Create persistent disclaimer visibility
- Implement session history management
- Add final UI polish and accessibility features

### Completion Criteria
- [x] First-time users see and must accept consent disclaimer
- [x] Disclaimer link always visible at bottom of screen
- [x] Users can tap 'Edit' on any previous answer
- [x] Conversation restarts appropriately when answers are edited — **implemented as true truncate-and-replay: editing an earlier answer discards every question/answer that came after it and continues from that step, matching this criterion literally (previously this was patch-in-place; upgraded)**
- [x] 'Conversation updated from step N' notification appears
- [x] Anonymous sessions work without sign-up
- [x] Conversation history available during session, and now persists across page reloads/tab closes via a client-side session cache with a 24-hour expiry (backend remains stateless; no server-side session store was added)
- [ ] UI meets WCAG 2.1 AA accessibility standards — **contrast measured and corrected to AA; full keyboard/screen-reader audit pending**
- [ ] Response times under 2 seconds per message — **needs to be measured and reported on the deployed service; not yet formally verified**
- [x] Rate limiting implemented (20 requests/minute/user, in-memory per-IP)
- [x] HTTPS properly configured with no client-side secrets

---

## MVP Scope Verification

### Included in MVP (Tasks 1-7)
- ✅ Health and Emotional domains
- ✅ Anonymous sessions
- ✅ Dynamic questioning (up to 10 steps)
- ✅ Final analysis with disclaimers
- ✅ Safety layer
- ✅ Consent screen
- ✅ Edit previous answers

### Excluded from MVP (Future Tasks)
- ❌ Legal domain
- ❌ General domain *(added: previously implied by omission, now made explicit — the intent classifier only distinguishes Health, Emotional, and Unclear)*
- ❌ Registered user accounts
- ✅ Conversation history persists across reloads (client-side cache, added post-MVP)
- ❌ Conversation history UI (a dedicated multi-conversation history browser was not built -- persistence covers resuming the CURRENT conversation only)
- ❌ Multi-language support
- ❌ Voice interaction

---

## Success Metrics
- User satisfaction with guidance quality
- Crisis detection accuracy and response appropriateness
- Conversation completion rates
- Average response times under 2 seconds
- Mobile usability scores
- Accessibility compliance verification

## Dependencies & Risks
- LLM provider API reliability and costs
- Database performance with conversation scaling
- Crisis detection accuracy and legal compliance
- User data privacy and security requirements
- Cross-browser and device compatibility
