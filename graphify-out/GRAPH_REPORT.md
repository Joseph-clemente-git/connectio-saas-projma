# Graph Report - src  (2026-08-23)

## Corpus Check
- Corpus is ~26,098 words - fits in a single context window. You may not need a graph.

## Summary
- 340 nodes · 281 edges · 83 communities (56 shown, 27 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Ticketing Domain Types
- Demo Data Seed Generator
- Pricing Feature Comparison Table
- Session Data Hooks
- Plan Config Source of Truth
- Entitlements Engine
- Members Management Page
- Org Calendar Page
- Marketing Landing Page
- Pricing Cards Component
- Dexie Database Schema
- Ticket Status/Priority UI Maps
- Workspace Detail Page
- App Bootstrap & Entry
- Kanban Board Component
- Task Detail Dialog
- Tenant Sidebar Navigation
- Badge UI Primitive
- Button UI Primitive
- Admin Cross-Tenant Data Hooks
- Super Admin Plan Editor
- Project Detail Page
- Demo Login Picker Page
- Gantt/Timeline Panel
- Milestones Panel
- Sprints Panel
- Plan Badge Component
- PWA Install/Update Status
- Ticket Categories Tab
- Custom Ticket Forms Tab
- Ticket Reports Tab
- Ticket SLA Policies Tab
- Super Admin Layout Shell
- Marketing Layout Shell
- Tenant App Layout Shell
- Org Dashboard Page
- API Keys Settings Page
- Session Auth Store
- Upgrade Dialog Store
- App Router Definition

## God Nodes (most connected - your core abstractions)
1. `buildOrg()` - 9 edges
2. `seedDatabase()` - 8 edges
3. `rand()` - 4 edges
4. `randInt()` - 4 edges
5. `iso()` - 3 edges
6. `uid()` - 3 edges
7. `sample()` - 3 edges
8. `personName()` - 3 edges
9. `limitFor()` - 3 edges
10. `App()` - 2 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Import Cycles
- None detected.

## Communities (83 total, 27 thin omitted)

### Community 0 - "Ticketing Domain Types"
Cohesion: 0.06
Nodes (30): ApiKey, AuditLog, CustomTicketForm, CustomTicketFormField, ID, Milestone, MilestoneStatus, Organization (+22 more)

### Community 1 - "Demo Data Seed Generator"
Cohesion: 0.13
Nodes (25): AVATAR_COLORS, Bag, buildOrg(), BuildOrgOptions, DEMO_IDS, emptyBag(), FIRST_NAMES, INDUSTRIES (+17 more)

### Community 2 - "Pricing Feature Comparison Table"
Cohesion: 0.17
Nodes (9): ALL_ROWS, BUSINESS_ROW_KEYS, BUSINESS_ROWS, CellValue, FEATURE_ROW_KEYS, FEATURE_ROWS, LIMIT_ROWS, REPORT_ROW (+1 more)

### Community 5 - "Plan Config Source of Truth"
Cohesion: 0.22
Nodes (7): DEFAULT_PLANS, FEATURE_LABELS, FeatureKey, PLAN_ORDER, PlanConfig, PlanLimits, ReportLevel

### Community 6 - "Entitlements Engine"
Cohesion: 0.32
Nodes (4): canCreate(), limitFor(), LimitKey, remaining()

### Community 9 - "Members Management Page"
Cohesion: 0.29
Nodes (5): COLORS, FIRST, LAST, ROLE_LABEL, TITLES

### Community 11 - "Org Calendar Page"
Cohesion: 0.33
Nodes (3): CalEvent, KIND_ICON, KIND_STYLE

### Community 12 - "Marketing Landing Page"
Cohesion: 0.33
Nodes (4): FAQS, FEATURES, TESTIMONIALS, VALUE_PROPS

### Community 15 - "Dexie Database Schema"
Cohesion: 0.40
Nodes (3): ConnectioDB, db, FeatureFlag

### Community 16 - "Ticket Status/Priority UI Maps"
Cohesion: 0.40
Nodes (4): TICKET_PRIORITY_DOT, TICKET_PRIORITY_LABEL, TICKET_STATUS_LABEL, TICKET_STATUS_VARIANT

### Community 17 - "Workspace Detail Page"
Cohesion: 0.40
Nodes (3): PROJECT_COLORS, STATUS_LABEL, STATUS_VARIANT

### Community 23 - "Badge UI Primitive"
Cohesion: 0.67
Nodes (3): Badge(), BadgeProps, badgeVariants

### Community 24 - "Button UI Primitive"
Cohesion: 0.67
Nodes (3): Button(), ButtonProps, buttonVariants

## Knowledge Gaps
- **116 isolated node(s):** `CellValue`, `Row`, `LIMIT_ROWS`, `FEATURE_ROW_KEYS`, `FEATURE_ROWS` (+111 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **27 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What connects `CellValue`, `Row`, `LIMIT_ROWS` to the rest of the system?**
  _116 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Ticketing Domain Types` be split into smaller, more focused modules?**
  _Cohesion score 0.06451612903225806 - nodes in this community are weakly interconnected._
- **Should `Demo Data Seed Generator` be split into smaller, more focused modules?**
  _Cohesion score 0.12615384615384614 - nodes in this community are weakly interconnected._