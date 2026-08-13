CREATE TRIGGER `transfer_attempt_validate_status_update`
BEFORE UPDATE OF `status` ON `transfer_attempt`
BEGIN
  SELECT CASE WHEN
    (OLD.`status` IN ('creating', 'failed') AND NEW.`status` NOT IN ('failed', 'succeeded')) OR
    (OLD.`status` = 'succeeded' AND NEW.`status` NOT IN ('succeeded', 'reversed')) OR
    (OLD.`status` = 'reversed' AND NEW.`status` <> 'reversed')
  THEN RAISE(ABORT, 'invalid_transfer_attempt_transition') END;
  SELECT CASE WHEN
    NEW.`status` = 'succeeded' AND (NEW.`provider_transfer_id` IS NULL OR NEW.`failure_code` IS NOT NULL OR NEW.`succeeded_at` IS NULL)
  THEN RAISE(ABORT, 'successful_transfer_evidence_required') END;
  SELECT CASE WHEN
    NEW.`status` = 'failed' AND (NEW.`provider_transfer_id` IS NOT NULL OR NEW.`failure_code` IS NULL)
  THEN RAISE(ABORT, 'failed_transfer_evidence_required') END;
END;

CREATE TRIGGER `transfer_attempt_provider_identity_immutable`
BEFORE UPDATE OF `provider_transfer_id` ON `transfer_attempt`
WHEN OLD.`provider_transfer_id` IS NOT NULL AND NEW.`provider_transfer_id` <> OLD.`provider_transfer_id`
BEGIN SELECT RAISE(ABORT, 'provider_transfer_identity_immutable'); END;

CREATE TRIGGER `settlement_validate_status_update`
BEFORE UPDATE OF `status` ON `settlement`
BEGIN
  SELECT CASE WHEN
    (OLD.`status` = 'pending' AND NEW.`status` NOT IN ('pending', 'transferred')) OR
    (OLD.`status` = 'transferred' AND NEW.`status` NOT IN ('transferred', 'reversed')) OR
    (OLD.`status` = 'reversed' AND NEW.`status` <> 'reversed')
  THEN RAISE(ABORT, 'invalid_settlement_transition') END;
END;

CREATE TRIGGER `publisher_earning_validate_reversal`
BEFORE UPDATE OF `status` ON `publisher_earning`
WHEN OLD.`status` = 'released' AND NEW.`status` = 'reversed'
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM `settlement`
    WHERE `publisher_earning_id` = OLD.`id` AND `status` = 'reversed'
  ) THEN RAISE(ABORT, 'earning_requires_reversed_settlement') END;
END;

CREATE TRIGGER `publisher_earning_reject_invalid_transition`
BEFORE UPDATE OF `status` ON `publisher_earning`
WHEN
  (OLD.`status` = 'accrued' AND NEW.`status` NOT IN ('accrued', 'released')) OR
  (OLD.`status` = 'released' AND NEW.`status` NOT IN ('released', 'reversed')) OR
  (OLD.`status` = 'reversed' AND NEW.`status` <> 'reversed')
BEGIN SELECT RAISE(ABORT, 'invalid_publisher_earning_transition'); END;
