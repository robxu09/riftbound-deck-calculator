# Riftbound Deck Repository & Analyzer

## Project

This is a Riftbound TCG deck repository and analysis platform.

The system will eventually include:

- Angular web application
- Kotlin backend/API
- Python analysis and simulation services
- Swift/iOS application
- Snowflake analytical data warehouse

## Architecture

- Angular is the primary web client.
- Kotlin owns the application/API layer.
- Python owns analytics, simulations, and data-processing workloads.
- Snowflake stores analytical and historical data.
- Swift is the native iOS client.

The clients must not access Snowflake directly.

## Repository Structure

Expected top-level structure:

- `apps/web` — Angular application
- `apps/api` — Kotlin application/API
- `apps/ios` — Swift/iOS application
- `services/analyzer` — Python analysis services
- `ingestion` — data ingestion and normalization
- `data/snowflake` — Snowflake schemas, SQL, and migrations
- `docs` — architecture and product documentation

## Domain

Core concepts include:

- Card
- Champion
- Legend
- Battlefield
- Rune
- Deck
- DeckVersion
- Format
- Tournament
- TournamentDeck
- Match

Riftbound rules, card text, legality, and errata must be treated as versioned data.

Do not assume that card text or game rules are immutable.

## Engineering Principles

- Prefer small, composable changes.
- Keep business logic out of Angular components.
- Keep domain logic independent from UI frameworks.
- Do not allow clients to access Snowflake directly.
- Keep Python analysis functionality behind well-defined interfaces.
- Do not hard-code secrets or credentials.
- Use environment variables or appropriate secret-management mechanisms.
- Write tests for domain logic.
- Run relevant tests after making changes.
- Do not modify unrelated parts of the repository.

## Agent Behavior

Before implementing a significant feature:

1. Inspect the relevant existing code.
2. Understand the current architecture.
3. Identify affected components.
4. Propose the smallest reasonable implementation.
5. Implement it.
6. Run relevant tests/builds.
7. Report what changed and what was verified.

Do not create large amounts of boilerplate unless it is required by the architecture.

When uncertain about product behavior or Riftbound rules, do not invent an answer. Identify the uncertainty and ask for clarification or use an authoritative source.