# Terva AI Working Notes

## Purpose

This repository is intended for heavy AI-assisted development. Keep generated work traceable, small in scope, and easy to review.

## Project Map

- `core/`: shared C++ domain logic and platform-neutral services.
- `apps/cli/`: headless interface for automation, testing, and server-style execution.
- `apps/desktop/`: Tauri desktop application and UI shell.
- `.ai/primers/`: background context for agents before they modify a subsystem.
- `.ai/skills/`: reusable task-specific instructions and workflows.
- `.ai/workflows/`: step-by-step execution protocols for recurring tasks.
- `.ai/prompts/`: reusable prompt fragments and templates.

## Working Rules

- Prefer small, reviewable changes over broad regeneration.
- Put subsystem assumptions in the relevant primer before scaling work with AI.
- Keep platform-specific logic near the edge of the system, not in `core/`.
- Treat the CLI as the first-class headless surface for testing and automation.
- Update docs when introducing new build steps, generated code conventions, or AI workflow requirements.

