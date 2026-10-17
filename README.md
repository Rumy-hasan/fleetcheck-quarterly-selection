# fleetcheck-quarterly-selection

Reproducible, idempotent quarterly random vehicle selection. Business rules and their reasoning are in
[docs/decisions.md](docs/decisions.md).

## Known limits

- **Auditing proves consistency, not authenticity.** `verifyRun` recomputes the picks from the stored
  eligible vehicles, percentage and seed. It cannot tell whether those stored inputs were edited afterwards:
  removing a vehicle that was not picked can leave the picks unchanged. Protecting stored runs against edits
  (append-only audit log, a hash or signature kept elsewhere, no-update database permissions) is production
  design work and out of scope here. See [D9](docs/decisions.md#d9-verifyrun-answers-yes-or-no).
