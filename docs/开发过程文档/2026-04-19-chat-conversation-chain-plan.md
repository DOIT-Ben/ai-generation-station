# Chat Conversation Chain Plan

## Goal

Replace the current chat snapshot history with a real conversation chain model that behaves like an official chat product:

- one user can have many conversations
- each conversation owns an ordered message chain
- switching to a conversation reloads the full chain
- continuing a conversation appends new messages to the same chain

## Current Problem

The current chat path stores each turn as a history snapshot inside `user_history_entries`.

That creates three problems:

1. the same message chain is duplicated on every saved turn
2. chat is modeled as "recent snapshots", not "conversation -> messages"
3. the frontend restores the latest snapshot, but cannot manage true multi-thread chat

## Target Design

### Data Model

Add two SQLite tables:

- `conversations`
  - `id`
  - `user_id`
  - `title`
  - `feature`
  - `model`
  - `message_count`
  - `last_message_at`
  - `created_at`
  - `updated_at`
  - `archived_at`

- `conversation_messages`
  - `id`
  - `conversation_id`
  - `role`
  - `content`
  - `tokens_json`
  - `created_at`

### API

Keep non-chat feature history unchanged. Add dedicated chat conversation APIs:

- `GET /api/conversations`
- `POST /api/conversations`
- `GET /api/conversations/:id`

Reuse `POST /api/chat` for the actual upstream call, but switch its payload to support:

- `conversationId`
- `message`
- optional generation config

Server-side flow:

1. load conversation messages by `conversationId`
2. append the new user message to the prompt payload
3. call upstream
4. persist user message and assistant reply
5. return reply plus refreshed conversation summary

## Frontend Changes

Replace the current chat history panel behavior with:

- conversation list in the chat tab
- "new conversation" action
- current active conversation state
- message area loading from the selected conversation
- send action bound to the active conversation

The old chat snapshot history buttons will be removed from the chat feature only. Other feature history panels stay as they are.

## Migration Rules

- do not delete `user_history_entries`
- stop writing chat snapshots into that table
- leave lyrics/music/image/speech/cover history untouched
- bootstrap a new empty conversation for the user when none exists

## Testing Scope

Need coverage for:

- conversation creation
- conversation list ordering
- message append and reload
- switching between two conversations
- page markup anchors for the new chat session UI

## Known Boundaries

- this phase does not add conversation rename or delete
- this phase does not add message streaming persistence
- this phase does not summarize long conversations yet

## TODO

1. add SQLite conversation tables and store methods
2. expose conversation list/create/detail APIs
3. switch `/api/chat` to conversation-aware persistence
4. rebuild chat frontend around active conversation state
5. extend frontend/auth regression tests
6. commit as one feature checkpoint
