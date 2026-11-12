# Open product decisions

Questions that need an answer from the client. Each one lists what the app does today,
the alternative, and where the switch is, so the decision can be applied without
re-investigating.

## 1. After a message request is declined, can the sender ask again?

**Status:** open. Raised 2026-11-13.

**Today (unchanged from the original app):** no. When a request is declined the chat is
removed, but the sender stays marked as "request sent" for that person. On that person's
profile the sender sees the disabled "requested" state and cannot send another request.
The sender is not told the request was declined.

**Alternative:** declining also clears the mark, so the sender sees the normal "send
request" button again and can ask again.

**Trade-off**

| | Keep the mark (today) | Clear the mark |
|---|---|---|
| Person who declined | Is not asked again by the same sender | Can be asked again; has to block to stop it |
| Sender | Cannot tell "pending" from "declined"; can never retry, even much later | Learns indirectly that the request is gone; can retry |
| Data | The sender's record keeps pointing at a request that no longer exists | Nothing left behind |

A middle option is to allow a new request only after a waiting period (for example 30
days). That needs the decline time to be stored and is not built.

**Where to change it:** `DECLINE_ALLOWS_NEW_REQUEST` in
`src/app/core/core.facade.ts` (`false` = today's behaviour, `true` = the alternative).

**Related data:** the export of 2026-11-12 has 33 of these marks with no matching chat.
The data cleanup leaves them in place while this is open. If the answer is "clear the
mark", they should be removed in the same change.
