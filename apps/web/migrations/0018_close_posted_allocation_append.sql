CREATE TRIGGER `allocation_receipt_immutable_insert`
BEFORE INSERT ON `allocation_run_receipt`
WHEN (SELECT `status` FROM `allocation_run` WHERE `id` = NEW.`allocation_run_id`) = 'posted'
BEGIN SELECT RAISE(ABORT, 'posted_allocation_immutable'); END;

CREATE TRIGGER `ledger_entry_immutable_insert`
BEFORE INSERT ON `ledger_entry`
WHEN (SELECT `status` FROM `allocation_run` WHERE `id` = NEW.`allocation_run_id`) = 'posted'
BEGIN SELECT RAISE(ABORT, 'posted_allocation_immutable'); END;

CREATE TRIGGER `publisher_earning_immutable_insert`
BEFORE INSERT ON `publisher_earning`
WHEN (SELECT `status` FROM `allocation_run` WHERE `id` = NEW.`allocation_run_id`) = 'posted'
BEGIN SELECT RAISE(ABORT, 'posted_allocation_immutable'); END;
