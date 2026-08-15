UPDATE "Rail"
SET "value" = 2,
    "description" = 'Reply micro-fee; two PollCoin units charged, with one participation unit accrued back when the daily and weekly ceilings allow (participation-cost rule, TOKENOMICS §1).'
WHERE "key" = 'discussion.replyFee';
