CREATE TRIGGER `connected_account_payout_validate_status_update`
BEFORE UPDATE OF `status` ON `connected_account_payout`
BEGIN
  SELECT CASE WHEN
    (OLD.`status` = 'pending' AND NEW.`status` NOT IN ('pending', 'in_transit', 'paid', 'failed', 'canceled')) OR
    (OLD.`status` = 'in_transit' AND NEW.`status` NOT IN ('in_transit', 'paid', 'failed', 'canceled')) OR
    (OLD.`status` IN ('paid', 'failed', 'canceled') AND NEW.`status` <> OLD.`status`)
  THEN RAISE(ABORT, 'invalid_connected_payout_transition') END;
END;

CREATE TRIGGER `connected_account_payout_identity_immutable`
BEFORE UPDATE OF `publisher_connected_account_id`, `publisher_id`, `provider`, `mode`, `provider_payout_id`, `amount`, `currency`, `created_at` ON `connected_account_payout`
BEGIN SELECT RAISE(ABORT, 'connected_payout_identity_immutable'); END;

CREATE TRIGGER `connected_account_payout_immutable_delete`
BEFORE DELETE ON `connected_account_payout`
BEGIN SELECT RAISE(ABORT, 'connected_payout_immutable'); END;

CREATE TRIGGER `stripe_payout_event_immutable_update`
BEFORE UPDATE ON `stripe_payout_event`
BEGIN SELECT RAISE(ABORT, 'stripe_payout_event_immutable'); END;

CREATE TRIGGER `stripe_payout_event_immutable_delete`
BEFORE DELETE ON `stripe_payout_event`
BEGIN SELECT RAISE(ABORT, 'stripe_payout_event_immutable'); END;

CREATE TRIGGER `stripe_transfer_event_immutable_update`
BEFORE UPDATE ON `stripe_transfer_event`
BEGIN SELECT RAISE(ABORT, 'stripe_transfer_event_immutable'); END;

CREATE TRIGGER `stripe_transfer_event_immutable_delete`
BEFORE DELETE ON `stripe_transfer_event`
BEGIN SELECT RAISE(ABORT, 'stripe_transfer_event_immutable'); END;
