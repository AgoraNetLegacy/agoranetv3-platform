-- Helpdesk rate-limit rails for existing PostgreSQL deployments.
-- Preserve any value already established in a deployed environment.
INSERT INTO "Rail" ("key", "value", "unit", "boundMin", "boundMax", "description")
VALUES
    (
        'ratelimit.supportHelp',
        20,
        'actions',
        5,
        80,
        'Helpdesk questions per burst window per active identity or browser session. Conversation speed remains comfortable; scripted prompt floods do not.'
    ),
    (
        'ratelimit.supportCases',
        5,
        'actions',
        1.25,
        20,
        'Support-case submissions per hour per active identity or browser session. Repeated unresolved questions belong in one case, not a queue flood.'
    )
ON CONFLICT ("key") DO NOTHING;
