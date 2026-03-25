---
name: website-interaction
description: "Use when the user asks to run the BondCredit website, open it in a browser, or interact with the frontend UI (click, inspect, verify rendering, basic smoke checks). Keywords: run website, open frontend, interact with UI, test web app, launch Vite app."
---

# Website Interaction Skill (BondCredit)

This skill standardizes how any agent should start and interact with the BondCredit frontend locally.

## Goal

Launch the frontend, open it in the integrated browser, and perform basic UI interaction checks.

## Project Context

- Frontend directory: frontend
- Dev server command: npm run dev
- Default local URL: http://localhost:5173
- Alternate Vite URL (if busy port): check terminal output and open the URL shown by Vite

## Required Workflow

1. Ensure dependencies are installed:
   - Root: npm install
   - Frontend: cd frontend && npm install
2. Start frontend dev server from the frontend directory:
   - cd frontend && npm run dev
3. Keep the server running in background mode when tooling supports it.
4. Open the app URL in the integrated browser.
5. Validate that the page loads without runtime errors.
6. Perform quick interaction checks:
   - Confirm primary UI sections render
   - Confirm wallet/connect or action buttons are visible
   - Confirm no obvious console/runtime crash indicators in page behavior

## Interaction Rules

- Prefer using the URL printed by Vite if it differs from port 5173.
- If the port is occupied, do not fail immediately; use the new URL Vite provides.
- If startup fails due to missing packages, install and retry once.
- If backend/contract dependencies are required for specific UI flows, report clearly which flow is blocked and why.

## Completion Criteria

Consider task successful when all are true:

- Frontend server is running
- Browser page opens successfully
- Main UI is visible and interactive
- Any blockers are reported with concrete next action

## Notes for Agents

- Prefer minimal, repeatable steps over custom ad-hoc commands.
- Do not modify unrelated files while only running/interacting with the website.
- If asked to stop services, terminate the background dev server cleanly.
